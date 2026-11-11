# YepWatch first-release database schema

The release stores interactions in **19 explicit typed tables**, not three opaque containers. There are no `payload`, dynamic-object or arbitrary JSON columns. [schema.sql](schema.sql) contains the complete generated DDL. [proposal-storage-schema.ts](proposal-storage-schema.ts) is the shared SQL/runtime-validation definition; regenerate with `node app/server/yepwatch/write-storage-schema.mjs` from `goodwatch-webapp`.

## Tables

All names below are in the `doc` schema. Every immutable domain record has `record_id TEXT PRIMARY KEY`, `room_id TEXT`, `generation BIGINT` and `expires_at BIGINT`. The remaining columns describe that entity explicitly.

| Table | Main fields / purpose |
|---|---|
| `yepwatch_invitation` | `code_hash` primary key, `room_id`, `expires_at`; short invitation lookup with no plaintext key |
| `yepwatch_room` | `id`, `revision`, `phase`, `expires_at`, `host_id`, roster/context/generation counters; shared country/service IDs/confirmation, typed prompt interpretation, constraints, stream and final-check state; exact references to current domain records; pending notification/check markers |
| `yepwatch_participant` | Participant ID, optional GoodWatch account ID, nickname, joined/archive/leave metadata, independent device sessions with credential hashes and command sequences/receipts; references to shared private votes, agreement and grant |
| `yepwatch_vote` | Participant ID, candidate ID, `choice` (`watch`, `pass`, NULL), vote revision, active exposure milliseconds and timing source |
| `yepwatch_proposal` | Candidate ID, proposal version, proposer ID, previous candidate ID, participant IDs present when proposed |
| `yepwatch_agreement` | Participant ID, approved proposal version (nullable), agreement revision |
| `yepwatch_decision` | Candidate ID, agreement-check version, decision time, strictly typed availability evidence |
| `yepwatch_candidate` | Candidate ID, typed movie/show/episode identity, title/year, summary, poster/backdrop/trailer URLs, score/genres/runtime, typed availability and viewing duration |
| `yepwatch_command_receipt` | Participant ID, command ID, sequence, request digest and accepted room revision |
| `yepwatch_ticket` | Ticket hash, participant ID, optional login session ID, participant epoch and ticket expiry |
| `yepwatch_member_grant` | Participant ID, encrypted access token and grant expiry |
| `yepwatch_member_intent` | State hash, participant ID, epoch, client/return URI, PKCE challenge and encrypted verifier, connection status, code hash and intent expiry |
| `yepwatch_idea` | Authored room idea, enabled state and immutable interpretation |
| `yepwatch_history` | Immutable decision snapshot, account and participant entitlements; referenced by the committed room head before projection |
| `yepwatch_account_rooms` | Hashed account locator with live room IDs and expiries; membership always checked against the room head |
| `yepwatch_account_history` | Durable confirmed decision snapshots and account entitlements, independent of room expiry |
| `yepwatch_revoked_session` | Hashed login session ID and revocation time horizon; prevents signed-out credentials from minting new access |
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

New installations use the generated DDL. This account-identity release requires runtime marker 3 and a fresh store; the existing room envelope format remains 2 and the wire contract remains 3. Existing test data may be removed with the explicit [account-identity reset procedure](../../../../yepwatch-app/docs/account-identity-deployment.md). Startup checks every table and refuses incompatible schemas; it performs no reset or migration. Table names have no version suffix. Production uses two replicas; tests use zero only on disposable loopback Crate. Soft reset of a room starts a new round without deleting account history.

Only access tokens and pending PKCE verifiers are encrypted fields. Guest credentials remain hashed. No passwords or duplicated GoodWatch accounts are stored. Votes and private relationships are now queryable application data: restrict database roles, SQL logs and backups accordingly. Never expose catalog readers to room tables.

The API role needs DQL/DML on room/domain/control tables and DQL on runtime metadata. The gateway still receives no database credentials. Provisioning and cleanup use separate operator credentials.

Room access expires after six hours. Before deleting any expired room records, cleanup projects every history snapshot reachable from the committed room head. Account history and session revocations are retained independently and are excluded from expired-room deletion. Each domain record carries the same room lifetime, including unreferenced preparations. `purge-expired --apply --writers-stopped` deletes expired records and heads using the database clock; it does not reset capacity or change active rooms. Stop writers and back up first. This operator command is implemented and tested locally; no automatic cleanup schedule or production purge is configured. Never reclaim unreferenced versions of a live room without a separate safe reclamation protocol.

`backup FILE --writers-stopped` exports all typed records, runtime metadata and controls into a new mode-0600 file. It contains private interaction data; credential fields remain encrypted. Keep the file and matching secret private. Restore only to an empty compatible store with writers stopped, inserting domain rows before room heads.

## Short invitation upgrade

New rooms use six-character opaque room keys derived from the room secret and an attempt counter. Keys omit ambiguous 0/O/1/I/L characters; lookup accepts lowercase, spaces and dashes. Existing 16-character and signed invitations remain valid and retain their format. New keys are atomically reserved by hash before room creation; collisions try another candidate without overwriting the prior mapping. Reservation expiry is preserved through retries. Room IDs and participant credentials are unchanged.

The invitation table stores only the key hash and a room reference with the same six-hour expiry. Full-primary-key reads avoid search-refresh delays. The mapping is published/proven before returning an admission; exact retries repair a missing mapping after an interrupted response. Resolution still checks the live room and its stored invitation hash. A mapping collision fails closed. Backup and expired-record cleanup include the table.

For an already provisioned typed store, apply only [migrations/20261023-short-invitations.sql](migrations/20261023-short-invitations.sql) using the established trusted operator connection before deploying this source. It adds the table and its runtime grant without modifying existing room rows, keys, quotas or metadata. New empty-store provisioning includes it automatically.

## Room descriptions and departures

`yepwatch_room.intent` declares prompt text, interpretation chips (text/kind/key), ranked numeric catalog keys and interpretation time as a strict typed object. Country and providers are direct room columns. The old screen table and selection/evidence screen-ID columns are removed by the explicit migration. A singleton context is derived for old wire/catalog adapters only. `yepwatch_participant.left_at` records departure; departed people are excluded from the active group but their credentials/receipts remain bounded records for retry recovery.


## Account identity and history

One room-head CAS publishes account membership uniqueness. Account indexes are registered first and may contain harmless references to failed admissions; a primary-key room read must confirm the account participant before exposing any state. Device sessions share the participant's votes/approval but have separate credentials and ordered command receipts. Every account HTTP operation also requires a current sealed GoodWatch login; a room credential alone cannot recover account access after logout. Logout on the account's last device in a room turns that participant into a guest (link, grant and sessions removed; the session's token hash, sequence and receipts become the guest's), so the device keeps its seat without account access. Session expiry follows the room lifetime, while the GoodWatch login is renewed independently, so access-token rotation does not lose pending-command receipts.

A final decision adds a typed snapshot and its participant/account entitlements to the same room publication. The existing pending marker remains set until these committed snapshots have been copied idempotently to account history. Repair also projects expired rooms. Restart projects retained history before clearing the round; expired-room cleanup does likewise before removing the head. Unpublished history preparations are never copied. Guest upgrades may add account entitlement to a retained decision without changing its title or participants. Decision history never records GoodWatch watches, Seen or taste.

Account history listing explicitly refreshes the archive index before the account-filtered query, making a just-confirmed choice visible to another device. Existing DQL privileges cover REFRESH ([CrateDB privileges](https://docs.cratedb.com/projects/crate-reference/en/latest/admin/privileges.html)); no runtime DDL privilege is needed.
