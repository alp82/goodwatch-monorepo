# CrateDB auth primitives: local verification

Research date: 2026-10-14. Ticket: [#530](https://github.com/alp82/goodwatch-monorepo/issues/530).
Branch: `research/cratedb-cas-proof`. Map: [#529](https://github.com/alp82/goodwatch-monorepo/issues/529).
Base: [#528](https://github.com/alp82/goodwatch-monorepo/issues/528), including its three research notes at
[`ccr-fe57dab2-zqtzlr`, commit `ae7c482`](https://github.com/alp82/goodwatch-monorepo/tree/ae7c482c00b205bb99848c56813c6087baffd855/docs/research).

## Answer

CrateDB 5.10.12 supplies the single-row primitives required by the proposed strict auth adapter: filtered full-primary-key reads are real-time; key plus `_seq_no` and `_primary_term` updates and deletes have one winner under ordinary contention; primary-key inserts enforce uniqueness. The unsafe `id = ? AND used_at IS NULL` update is substantially worse than a narrow race: with refresh disabled, all 24 callers succeeded in every round, and an unrefreshed insert was missed entirely. Primary failover also reproduced an applied CAS returning zero to its original HTTP caller, without any client retry. This preserves the CAS safety argument but requires a correction to #528's outcome handling: a zero or timeout followed by a missing row does not identify the winner. Recover ownership from an operation identifier retained atomically with its outcome, or return an indeterminate failure and fail closed. Blindly retrying a logical increment with a newly read version can execute the same operation twice.

## Environment and evidence

Only a disposable local Docker cluster was used. No production connection, production credentials, deployment,
host firewall change, or production table was involved. Docker ran through the local rootless Unix socket
`/run/user/1000/docker.sock`; HTTP ports were bound to `127.0.0.1:15430`–`15432`.

- Three nodes, `node1`, `node2`, `node3`, each reporting `5.10.12` and build `9795f35`.
- Official image pinned as `crate:5.10.12@sha256:cfce7e180eafa1eb57ebda20a7b3678d65fbac2bbd08ba7e5a7b0dbf553d7696`.
- Source tag `5.10.12`, pinned commit [`9795f359c2c3a6234ca0e4a0f910403d4e0aa1f8`](https://github.com/crate/crate/tree/9795f359c2c3a6234ca0e4a0f910403d4e0aa1f8).
- Docker Engine 29.7.2, Compose 5.5.1, Node.js 26.8.1; Linux amd64.
- One unpartitioned shard; `number_of_replicas = '2'`, `write.wait_for_active_shards = 1`,
  `translog.durability = 'REQUEST'`, `refresh_interval = -1`. Each node had a 384 MiB Java heap,
  a 1 GiB memory limit, and one CPU quota. All three shard copies were STARTED before testing.
- [`cratedb-cas-proof/verify.mjs`](cratedb-cas-proof/verify.mjs) records SQL responses and checks invariants.
  [`observed-results.json`](cratedb-cas-proof/observed-results.json) is the committed passing-run evidence.
  Fresh rerun output goes into the ignored `cratedb-cas-proof/results/` directory.

Disabling public refresh deliberately holds the search snapshot constant. This isolates the difference between
real-time key reads and query collection; it does not measure the frequency of a race with the default refresh interval.
All contention races use `Promise.all` with 24 independent requests, distributed over all three HTTP coordinators.

## Assumed versus observed

| Check | Assumption from #528 | Observed locally | Consequence |
| --- | --- | --- | --- |
| Full-PK SELECT with extra predicates | Real-time read, with current predicate evaluation | `EXPLAIN` selected `Get`; all three coordinators read the unrefreshed insert with `id = ? AND n = 0 AND used_at IS NULL`. A non-PK query saw zero rows. Immediately after setting `used_at`, the filtered key read returned zero. | Supported for this simple query shape. Preserve full-key reads. [S1] |
| CAS UPDATE | Exactly one winner | 20 rounds × 24 contenders: one rowcount 1, 23 zeros, final `n = 1` in every round. No refresh between the insert, version read and updates. | Supported in a stable cluster; use the tuple from the observed row. [S2] |
| CAS with extra business predicate | The adapter checks predicates before its bare CAS write | Appending `AND used_at IS NULL` to the key/seq/term UPDATE failed with HTTP 400, code 4000, `VersioningValidationException`. | SELECT and UPDATE have different rules. Do not translate all adapter predicates into the CAS WHERE clause. [S2] |
| `UPDATE WHERE id = ? AND used_at IS NULL` | Can double-win; can miss recent inserts | Before refresh, rowcount 0 for an existing new row. After one explicit refresh, 10 rounds × 24 contenders: all 24 returned 1, and final `n = 24`, even though the first update set `used_at`. | Confirmed unsafe. The query's old match is not rechecked against the current row before writing. [S3] |
| Plain DELETE by key | Exact rowcount under ordinary contention | 10 rounds × 24: one 1, 23 zeros, then the row was absent. | Supported for key-only deletion in the stable cluster. A delete attempt is not always counted as a deletion. [S4] |
| CAS DELETE | One winner for the observed version | Another 10 rounds × 24: one 1 and 23 zeros per round. | Supported for contention; ambiguous fault outcomes need separate handling. [S4] |
| Plain INSERT | One winner; duplicate-key code 4091 | 10 rounds × 24: one successful insert and 23 HTTP 409/code 4091 errors per round. | Deterministic primary keys can enforce claims. [S5] |
| `ON CONFLICT DO NOTHING` | Existing key gives zero | 10 rounds × 24: one 1 and 23 zeros per round. | Supported for idempotent create semantics. [S5] |
| Primary failover during CAS UPDATE | Zero can hide this request's own applied write | Three fault rounds: the original, still-open HTTP request returned rowcount 0 after the primary stopped; `n = 1` and that operation's unique `op` survived. An explicit replay of the old tuple also returned 0. | Reproduced internal-retry ambiguity, not just a client-side replay. There can be one applied mutation and zero acknowledged winners. [S6] |
| Primary failover during CAS DELETE | Base says a missing row after zero means another caller consumed it | Three fault rounds with no competing consumer: original request returned 0, its deletion survived, and an explicit old-tuple replay returned 0. | Contradicts that ownership inference. A deleted row cannot carry its consumer's provenance. [S4, S6] |
| DELETE RETURNING | Unsupported | HTTP 400/code 4000, SQL parse error. | Consume must use the prior read or a logical-consumption UPDATE. |
| EXPLAIN for UPDATE/DELETE | No design assumption | Both rejected with HTTP 400/code 4004. | Their execution-path explanation comes from pinned planner source, not an invented EXPLAIN plan. |

## How the failover was forced

The harness discovers the actual primary from `sys.shards`, rather than assuming `node1` owns it. For each fault round:

1. Insert a fresh row and read its version tuple.
2. Pause one replica with `docker compose pause`. Use the other replica as the HTTP coordinator.
3. Start a CAS UPDATE or DELETE. The paused replica holds up acknowledgement.
4. Poll a real-time key read until the mutation is visible, and assert the original HTTP request is still pending.
   Reads can route to a replica even through the primary's HTTP endpoint; polling therefore has bounded individual
   timeouts and retains the successful read instead of issuing another read while a replica is paused. [S7]
5. Stop the actual primary with `docker compose stop --timeout 0`; unpause the held replica.
6. Wait until a survivor is the STARTED primary. Collect the original HTTP response, replay the exact old CAS tuple,
   and verify the surviving state. For updates, the unique `op` identifies this harness operation and `n = 1` excludes
   double application. For deletes, no other delete is issued until the original request finishes.
7. Restart the old primary and wait for all three copies to be STARTED before the next round.

The original SQL fetch is sent once; `verify.mjs` has no HTTP retry loop around it. Thus its zero response after
failover is distinct from the explicitly labelled second request. The pinned transport layer retries when the
primary connection disappears; its retried stale version is excluded from the affected-row count. [S6]

This tests one controlled fault schedule. It is not a complete partition or durability proof. Pausing a replica is
a timing aid, and the primary is killed before acknowledgement; the mutation's survival is verified empirically.
The test does not infer that every unacknowledged write must survive. An unchanged row's `_primary_term` can remain
the term of its last write after promotion; it does not have to immediately equal the new primary's term. [S8]

## Changes required in the adapter design

The core choice in #528 remains viable; there is no evidence here requiring a different database. The corrections
are to the strict adapter's outcome contract:

- **Qualify “exactly one winner.”** In stable contention, exactly one response reports success. Under faults,
  distinguish at-most-one application of an observed version from reliable knowledge of the operation's outcome.
- **Fix `consumeOne`'s missing-row inference.** #528's “gone means another caller consumed” is false in the reproduced
  delete scenario. A missing row can be this caller's own deletion. Failing closed is safe, but must be described
  as indeterminate rather than a known competing winner.
- **Do not retry an ambiguous logical increment using a fresh tuple.** The prior increment may already have applied
  while its business predicate remains true. A subsequent successful CAS would be a second execution of the same
  logical operation. Normal retry after a known competing version conflict is a different case.
- **If recovery must return success, retain ownership atomically with the outcome.** For consumption, a CAS UPDATE
  to a consumed tombstone carrying an operation identifier and enough prior data to recover the response is a
  possible single-row design; physically delete later. For increments, keep an operation receipt in the same
  atomic row mutation for the required retry window. A separate receipt table is not an atomic substitute, and
  a last-operation marker overwritten before a retry cannot guarantee attribution. Otherwise expose an
  indeterminate failure and fail closed. These are design recommendations, not implemented auth code.
- **Keep the narrow write shape.** Check expiry, `revoked`, `used_at`, and other conditions in the real-time read or
  application code, then write using full key + seq + term only. Maintain an access-pattern allowlist. [S2]
- **Make fault assertions count state transitions.** A fault test that insists on exactly one rowcount-1 response
  would reject legitimate outcomes observed here. Assert no duplicate consumption/increment, then separately
  exercise ownership recovery or the indeterminate error path.

These are corrections to the research proposal, not changes to the accepted tracking ADRs or production writers.
The Better Auth adapter, its plugin call inventory, Valkey fallback, and end-to-end OAuth/MCP flows are outside this
primitive-verification ticket. Later CrateDB releases also require rerunning this evidence; this run pins 5.10.12.

## Re-run

Requirements: local Docker Engine with Compose, Node.js 22 or newer, about 3 GiB for the cluster, free loopback
ports 15430–15432, and a host satisfying CrateDB's bootstrap checks. This host already had
`vm.max_map_count = 1048576`; the scripts do not modify host settings.

From the repository root:

```bash
bash docs/research/cratedb-cas-proof/run.sh
```

The wrapper forces a local Unix Docker socket, removes any inherited Docker context, and refuses to reuse existing
containers in project `goodwatch-cas-530`. It creates only that project's containers, network and volumes. The SQL
script uses fixed loopback URLs and checks the three node names and exact database version before creating
`doc.cas_proof_530`. Each run has fresh volumes. Its EXIT trap unpauses containers, captures logs and removes the
containers, network and volumes after success or failure. An abrupt host shutdown or SIGKILL cannot run that trap;
manual cleanup of this dedicated project is:

```bash
docker -H unix:///run/user/$(id -u)/docker.sock compose \
  -f docs/research/cratedb-cas-proof/compose.yaml -p goodwatch-cas-530 unpause
docker -H unix:///run/user/$(id -u)/docker.sock compose \
  -f docs/research/cratedb-cas-proof/compose.yaml -p goodwatch-cas-530 down --volumes
```

Use `unix:///var/run/docker.sock` instead if using the local system daemon. New observations and container logs
are written to `docs/research/cratedb-cas-proof/results/`; `CRATE_PROOF_OUTPUT` can specify an absolute output
directory. Exit status 0 and `"passed": true` in `observations.json` indicate all required assertions passed.
Fault timing may vary with host load; failed partial runs retain their evidence and are not labelled passing.
The final verification also checked that no containers, project volumes or project network remained.

## Primary sources

All implementation links below resolve to the pinned CrateDB 5.10.12 commit. Local observations above are backed
by the committed harness output, rather than secondary articles.

- **S1 — real-time filtered Get:** [SELECT optimizer](https://github.com/crate/crate/blob/9795f359c2c3a6234ca0e4a0f910403d4e0aa1f8/server/src/main/java/io/crate/planner/optimizer/rule/OptimizeCollectWhereClauseAccess.java#L76-L84),
  [remaining predicate filter](https://github.com/crate/crate/blob/9795f359c2c3a6234ca0e4a0f910403d4e0aa1f8/server/src/main/java/io/crate/planner/operators/Get.java#L158-L183),
  [engine real-time get](https://github.com/crate/crate/blob/9795f359c2c3a6234ca0e4a0f910403d4e0aa1f8/server/src/main/java/org/elasticsearch/index/engine/InternalEngine.java#L630-L705).
- **S2 — write shape and OCC:** [UPDATE by-id choice](https://github.com/crate/crate/blob/9795f359c2c3a6234ca0e4a0f910403d4e0aa1f8/server/src/main/java/io/crate/planner/consumer/UpdatePlanner.java#L135-L152),
  [query-path version rejection](https://github.com/crate/crate/blob/9795f359c2c3a6234ca0e4a0f910403d4e0aa1f8/server/src/main/java/io/crate/planner/consumer/UpdatePlanner.java#L274-L289).
- **S3 — assignments applied to current document, unversioned conflicts retried:**
  [TransportShardUpsertAction](https://github.com/crate/crate/blob/9795f359c2c3a6234ca0e4a0f910403d4e0aa1f8/server/src/main/java/io/crate/execution/dml/upsert/TransportShardUpsertAction.java#L430-L492).
- **S4 — deletion and counts:** [DELETE planner](https://github.com/crate/crate/blob/9795f359c2c3a6234ca0e4a0f910403d4e0aa1f8/server/src/main/java/io/crate/planner/statement/DeletePlanner.java#L103-L110),
  [found versus missing](https://github.com/crate/crate/blob/9795f359c2c3a6234ca0e4a0f910403d4e0aa1f8/server/src/main/java/io/crate/execution/dml/delete/TransportShardDeleteAction.java#L103-L138),
  [version conflicts and missing rows omitted from counts](https://github.com/crate/crate/blob/9795f359c2c3a6234ca0e4a0f910403d4e0aa1f8/server/src/main/java/io/crate/execution/dml/ShardRequestExecutor.java#L233-L254).
- **S5 — uniqueness:** [create semantics and IGNORE](https://github.com/crate/crate/blob/9795f359c2c3a6234ca0e4a0f910403d4e0aa1f8/server/src/main/java/io/crate/execution/dml/upsert/TransportShardUpsertAction.java#L373-L417),
  [duplicate exception conversion](https://github.com/crate/crate/blob/9795f359c2c3a6234ca0e4a0f910403d4e0aa1f8/server/src/main/java/io/crate/exceptions/SQLExceptions.java#L209-L217),
  [HTTP 4091 mapping](https://github.com/crate/crate/blob/9795f359c2c3a6234ca0e4a0f910403d4e0aa1f8/server/src/main/java/io/crate/rest/action/HttpErrorStatus.java#L50-L52).
- **S6 — failover retry:** [transport retry on disconnect](https://github.com/crate/crate/blob/9795f359c2c3a6234ca0e4a0f910403d4e0aa1f8/server/src/main/java/org/elasticsearch/action/support/replication/TransportReplicationAction.java#L775-L820),
  [official resiliency warning](https://github.com/crate/crate/blob/9795f359c2c3a6234ca0e4a0f910403d4e0aa1f8/docs/appendices/resiliency.rst#L48-L64).
  The warning describes retry of already-applied writes; the zero-CAS response follows from retry plus OCC and the
  counting implementation, and is independently reproduced here.
- **S7 — key-read routing:** [RoutingProvider.forId](https://github.com/crate/crate/blob/9795f359c2c3a6234ca0e4a0f910403d4e0aa1f8/server/src/main/java/io/crate/metadata/RoutingProvider.java#L106-L120).
- **S8 — document version tuple:** [engine compares the stored document's seq/term](https://github.com/crate/crate/blob/9795f359c2c3a6234ca0e4a0f910403d4e0aa1f8/server/src/main/java/org/elasticsearch/index/engine/InternalEngine.java#L654-L664).
- **Release context:** [5.10.10 ON CONFLICT race fix](https://github.com/crate/crate/blob/9795f359c2c3a6234ca0e4a0f910403d4e0aa1f8/docs/appendices/release-notes/5.10.10.rst#L47-L49).
  This run establishes behaviour for 5.10.12; it does not test 5.10.9 or independently evaluate 5.10.11 regressions.
