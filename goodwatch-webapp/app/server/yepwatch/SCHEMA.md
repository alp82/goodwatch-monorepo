# YepWatch first-release database schema

The release stores interactions in **14 explicit typed tables**, not three opaque containers. There are no `payload`, dynamic-object or arbitrary JSON columns. [schema.sql](schema.sql) contains the complete generated DDL. [proposal-storage-schema.ts](proposal-storage-schema.ts) is the shared SQL/runtime-validation definition; regenerate with `node app/server/yepwatch/write-storage-schema.mjs` from `goodwatch-webapp`.

## Tables

All names below are in the `doc` schema. Every immutable domain record has `record_id TEXT PRIMARY KEY`, `room_id TEXT`, `generation BIGINT` and `expires_at BIGINT`. The remaining columns describe that entity explicitly.

| Table | Main fields / purpose |
|---|---|
| `yepwatch_room` | `id`, `revision`, `phase`, `expires_at`, `host_id`, roster/context/generation counters; typed constraints, stream and final-check state; exact references to current domain records; pending notification/check markers |
| `yepwatch_participant` | Participant ID, nickname, credential hashes/epoch/sequence, screen/readiness, member status; references to this participant's votes, agreement, receipts and grant |
| `yepwatch_vote` | Participant ID, candidate ID, `choice` (`watch`, `pass`, NULL), vote revision, active exposure milliseconds and timing source |
| `yepwatch_proposal` | Candidate ID, proposal version, proposer ID, previous candidate ID, participant IDs present when proposed |
| `yepwatch_agreement` | Participant ID, approved proposal version (nullable), agreement revision |
| `yepwatch_decision` | Candidate ID, agreement-check version, decision time, strictly typed availability evidence |
| `yepwatch_screen` | Screen ID/label, country, service IDs, explicit context confirmation |
| `yepwatch_candidate` | Candidate ID, typed movie/show/episode identity, title/year, summary, poster/backdrop/trailer URLs, score/genres/runtime, typed availability and viewing duration |
| `yepwatch_command_receipt` | Participant ID, command ID, sequence, request digest and accepted room revision |
| `yepwatch_ticket` | Ticket hash, participant ID, credential epoch and ticket expiry |
| `yepwatch_member_grant` | Participant ID, encrypted access token and grant expiry |
| `yepwatch_member_intent` | State hash, participant ID, epoch, client/return URI, PKCE challenge and encrypted verifier, connection status, code hash and intent expiry |
| `yepwatch_runtime` | Compatibility marker, key ID/check (not the key), fixed room TTL |
| `yepwatch_control` | Explicit configuration fingerprint/window, typed room reservations, admission digests and typed command grants; bounded capacity/rate bookkeeping |

**Time-column detail:** common record `expires_at` is the room lifetime. Ticket/grant/intent deadlines use their own `ticket_expires_at`, `grant_expires_at`, `intent_expires_at` columns. These are separate so cleanup cannot delete a currently referenced record merely because a credential expires.

Typed objects such as episode identity, constraints, provider offers and control reservations use `OBJECT(STRICT)` with declared fields. They remain SQL-queryable, not JSON strings. SQL rejects undeclared fields; runtime validation also rejects malformed stored records and inconsistent relationships. Votes/agreements/decisions do not contain encrypted JSON documents.

## Concurrency and current state

A row's `record_id` identifies an immutable version, distinct from a domain `participant_id` or `candidate_id`. Only changed records are inserted. One small room-head compare-and-swap publishes their references together. Readers follow full primary keys and never infer committed state from the newest timestamp or search refresh. A failed publication leaves unpublished records that are not current votes or agreements.

**Commands still contend on publication within one room**, with bounded retries and exact-command recovery. They no longer rewrite everybody's votes or the deck. See [the storage ADR](../../../../docs/adr/yepwatch-typed-room-storage.md) for the crash/consistency protocol and CrateDB constraints.

This reporting query follows the current published vote references (verified against disposable Crate). SQL search/join results can lag index refresh; they are not the authoritative realtime read path. For a complete operator snapshot, stop writers and refresh the referenced tables first. The API uses full-primary-key reads instead:

```sql
SELECT p.participant_id, v.candidate_id, v.choice,
       v.active_exposure_ms, v.revision
FROM doc.yepwatch_room r
JOIN doc.yepwatch_participant p ON p.record_id = ANY(r.participant_records)
JOIN doc.yepwatch_vote v ON v.record_id = ANY(p.vote_records)
WHERE r.id = ?;
```

Likewise, join `r.proposal_record` to `yepwatch_proposal.record_id`, `r.decision_record` to `yepwatch_decision.record_id`, or `p.agreement_record` to `yepwatch_agreement.record_id`. A raw scan includes superseded and unpublished records; it is **not an action history**. Do not use these private SQL queries as public room projections.

## Installation, privacy and lifecycle

This is an explicit empty-store install, not an automatic migration of legacy `doc.yepwatch_room`. Startup checks every table and refuses incompatible schemas/metadata. Internal storage format 1 and wire contract 3 have different purposes; table names have no version suffix. The operator uses four room shards, one shard per related table and two replicas on the three-node cluster; tests use zero on disposable local Crate only.

Only access tokens and pending PKCE verifiers are encrypted fields. Guest credentials remain hashed. No passwords or duplicated GoodWatch accounts are stored. Votes and private relationships are now queryable application data: restrict database roles, SQL logs and backups accordingly. Never expose catalog readers to room tables.

The API role needs DQL/DML on room/domain/control tables and DQL on runtime metadata. The gateway still receives no database credentials. Provisioning and cleanup use separate operator credentials.

Room access expires after six hours. Each domain record carries the same room lifetime, including unreferenced preparations. `purge-expired --apply --writers-stopped` deletes expired records and heads using the database clock; it does not reset capacity or change active rooms. Stop writers and back up first. This operator command is implemented and tested locally; no automatic cleanup schedule or production purge is configured. Never reclaim unreferenced versions of a live room without a separate safe reclamation protocol.

`backup FILE --writers-stopped` exports all typed records, runtime metadata and controls into a new mode-0600 file. It contains private interaction data; credential fields remain encrypted. Keep the file and matching secret private. Restore only to an empty compatible store with writers stopped, inserting domain rows before room heads.
