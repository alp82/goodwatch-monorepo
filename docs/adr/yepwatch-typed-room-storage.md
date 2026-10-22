# YepWatch typed interaction storage

Status: implemented locally; supersedes encrypted aggregate storage for the first release. Historical development rooms and their repository remain unchanged. No production migration or deployment.

## Decision

Use explicit typed CrateDB tables for rooms, participants, votes, proposals, agreements, decisions, screens, candidates, command receipts, tickets, linked grants, pending account connections, runtime metadata and admission controls. There are no generic `payload`, dynamic object or arbitrary JSON columns in the release schema.

Domain objects such as episode identity, provider offers and room constraints have enumerated `OBJECT(STRICT)` fields. They are queryable through SQL; they are not serialized documents. The same source definitions produce SQL column declarations and runtime validation. Additional database checks reject invalid vote choices, phases and negative timing/revision values. Runtime validation enforces the remaining domain constraints and relationships.

## Atomic publication with CrateDB

CrateDB has no multi-table transactions; its supported optimistic concurrency check is on an individual primary-key row ([official reference](https://cratedb.com/docs/crate/reference/en/latest/general/occ.html)). Independent in-place updates of votes and approvals would allow finalization to observe a mixture of revisions. A process-local lock would not protect multiple API instances.

Interaction records are therefore immutable versions with explicit typed columns. `record_id` identifies a particular version; `participant_id` and `candidate_id` identify domain entities. The room row references the current participant/candidate/proposal/decision versions. Participant records reference their own vote, agreement, receipt and grant versions.

For a command:

1. Read one room head by full primary key and follow its exact record IDs. All record reads also use full primary keys, so search refresh timing is not part of correctness.
2. Validate the command against that consistent state.
3. Insert only changed domain records, then prove each insert through a full-key read. An ambiguous insert is usable only after proof.
4. Publish all changes with one `_seq_no`/`_primary_term` compare-and-swap of the room head. A competing writer retries against the new head.
5. Save the command receipt in the same publication. A lost acknowledgement recovers the published receipt, without applying the action twice.

A crash before step 4 leaves unreferenced records, which are never part of current room state. A crash after step 4 leaves a complete, readable state. The decision and its final evidence are published the same way. A join, withdrawn agreement or changed proposal while final evidence is loading causes the old finalization CAS to fail.

Votes no longer rewrite or encrypt the deck, other people's votes, or credentials. **The small room-head publication still serializes commands within a room.** This change does not promise zero conflicts or unlimited throughput. Commands retain the existing bounded retry/explicit recovery behavior. This is a deliberate consistency boundary, not a claim that Crate supports transactions.

## Querying and lifecycle

Current SQL queries follow references from the room head, then participant references. A raw scan of an interaction table includes old versions and abandoned unpublished versions; it must not be treated as an interaction audit log. SQL joins are near-real-time reporting reads and may temporarily omit unrefreshed records; the API does not use them to decide agreement. Examples and full generated DDL are in the [storage schema](../../goodwatch-webapp/app/server/yepwatch/SCHEMA.md).

No history-retention feature is inferred from these versions. Room expiry and operator access rules remain applicable. An explicit quiesced-writer operator command deletes expired records by their room lifetime, including unpublished preparations. This is separate from live-version reclamation. Never delete unreferenced records of an active room based only on an instantaneous query: a command may still be preparing publication.

Room data is now typed/queryable private application data. Database roles and backups must restrict access accordingly. Only access tokens and pending PKCE verifiers remain field-encrypted with room/table/record/field binding. No passwords are stored. Backup files contain private interaction data and must use private storage; the operator writes new files with mode 0600 and requires stopped writers. Credentials in those files remain encrypted.

## Compatibility

The release refuses the legacy blob schema and incompatible runtime marker. Installation is explicit and requires a new/empty store with stopped writers. Existing local runtimes are not reset, migrated or silently reinterpreted. Wire contract and app behavior stay unchanged; internal schema format is distinct from product release numbering.
