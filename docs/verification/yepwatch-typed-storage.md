# Typed YepWatch storage verification

Implemented on `feat/yepwatch-shared-services` after `5bda62bd`, in the isolated worktree `/tmp/yepwatch-shared-release-20261022`. This replaces release storage; it does not alter retained development runtimes or production databases. No deployment, phone action, production provisioning or purge occurred.

## Implementation

- Fourteen explicit typed tables, generated DDL and shared runtime validators; no generic payload, dynamic-object or arbitrary JSON columns in the new release tables.
- Changed votes, agreements, proposals and decisions are immutable domain records. A small room-head CAS publishes the set together. Publication still serializes commands within a room; this is not a claim of conflict-free writes or Crate multi-table transactions.
- Full-primary-key reads reconstruct a consistent published revision. Domain records are integrity-checked and cached immutably with bounded capacity. Interaction data is SQL-queryable; member tokens/PKCE verifiers are separately encrypted fields.
- Capacity/window bookkeeping has explicit strict columns and object arrays, preserving database-clock fencing and exact retries.
- Operator installation, readiness, inventory, complete typed backup and stopped-writer expired-record cleanup updated. Incompatible legacy schema is rejected; there is no automatic migration.

See [schema and SQL examples](../../goodwatch-webapp/app/server/yepwatch/SCHEMA.md), [complete DDL](../../goodwatch-webapp/app/server/yepwatch/schema.sql), and [consistency ADR](../adr/yepwatch-typed-room-storage.md).

## Results

- 36 domain/release/member/control tests passed, zero skipped.
- Two real disposable Crate integration suites passed, zero skipped. Together with the above: 38 passed.
- Focused strict TypeScript for changed storage/runtime/operator/tests passed. The broader existing YepWatch config still reports unrelated countries/discover/explore diagnostics; no changed-file diagnostics.
- Standalone API/operator bundle and dependency-graph isolation passed, with the existing seven direct/25 pinned runtime packages.
- Generated schema contains all fourteen tables; database introspection confirmed no `payload` column. Valid typed objects are accepted; undeclared object fields and invalid vote choices are rejected.
- `git diff --check` passed.

### Actual Crate evidence

`proposal-relational-crate.test.ts` covers:

- Concurrent votes through independent repositories/services. Both votes survive and produce the shared match.
- Interruption after preparing records but before publication. The vote and command sequence remain invisible/unconsumed.
- Lost child-insert and room-publication acknowledgements, followed by exact receipt recovery.
- No candidate/deck writes during voting.
- A late join while final availability checking is held. The old unanimous result cannot publish; explicit agreement from the newcomer is required.
- Current-state SQL joins, schema checks, isolated cached records, separately encrypted credential fields and cold reads after actual database restart.

`proposal-release-control-crate.test.ts` covers:

- Two real HTTP API instances and nine simultaneous creates: exactly three accepted at cap three.
- Database-clock window fencing, global/actor budgets, actual lost acknowledgements and exact retry.
- Database restart plus recovery from a new OS process.
- Expiry replacement and a delayed expired insert rejected at the database fence.
- Quiesced typed backup, expired-record cleanup preserving active rooms, and restoration into the emptied disposable store with the same key.

The suites create/remove only their own containers. The control harness uses documented loopback port 15978; the relational harness uses a Docker-assigned loopback port and rediscovers it after restart. No production catalog/account service is used; catalog and member values are explicit local fixtures.

## Reproduce

From `goodwatch-webapp`:

```sh
node app/server/yepwatch/write-storage-schema.mjs
node app/server/yepwatch/build-release.mjs
YEPWATCH_TEST_CONTROL_CRATE=1 YEPWATCH_TEST_RELATIONAL_CRATE=1 \
  node --experimental-strip-types --test \
  app/server/yepwatch/proposal-release-control-crate.test.ts \
  app/server/yepwatch/proposal-relational-crate.test.ts
```

Docker and free loopback15978 are required. Use only disposable stores. Production activation requires rebuilding images and rehearsing the new schema; prior release images/backups are not interchangeable. App/wire behavior is unchanged, so native/browser UI suites were not repeated for this storage-only change. Sustained capacity, production recovery, automatic cleanup scheduling, live-version reclamation and full key rotation remain unverified or separate work.
