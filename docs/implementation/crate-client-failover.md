# CrateDB client failover (#588)

Scope: branch from `origin/main`, local verification only, draft PR against main. No production access, merge or deployment. Read the complete [#547 report](https://github.com/alp82/goodwatch-monorepo/issues/547#issuecomment-6180527783) before implementation.

## Test boundaries and first failing case

The brief authorizes the public Crate client (`query`, `execute`, `upsert`, `insertRows`) and a disposable local three-node Docker cluster as the test boundaries. HTTP fixture servers stand in for coordinator connection failures; real SQL and persisted rows provide the final fault proof.

- First red: `node --test app/utils/crate-failover.test.ts` failed on unmodified code with `ECONNRESET: socket hang up`. A read routed to a disconnected coordinator reached the caller instead of failing over. The test also requires failing hosts to be excluded from subsequent rotation.
- Checkpoints are pushed to `fix/crate-client-failover`; draft PR [#589](https://github.com/alp82/goodwatch-monorepo/pull/589), against `main`. The issue remains open for review and separately authorized production work.

## Docker-discovered regression

The first complete stop-under-load run caught four failed reads on surviving coordinators while shard routing still referenced the lost node. HTTP 500 carried `NodeNotConnectedException`, `NoSuchNodeException`, and disconnect-related `JobKilledException`. The upsert's readback also encountered this condition. Full red observations: [distributed-failure-red.json](../../goodwatch-webapp/scripts/crate-failover/results/distributed-failure-red.json).

A public-client regression test reproduced this before extending the fix. Reads now allow bounded rounds with short backoff for those exact node-loss conditions, within their original timeout budget. These errors do not evict a healthy coordinator. Generic writes still return the original error; safe helpers may read back or replay their fixed keys. The regression test failed before the fix; the final targeted suite has 25 passing tests.

## Resulting client policy

- Each configured host has its own driver instance. Connection errors, request timeouts and HTTP 502/503/504 remove that coordinator from normal round-robin rotation for five seconds. An all-unhealthy pool may probe the earliest due host, so one-node clients can recover.
- SELECTs and conservative read-only CTEs can try each host once. A caller's timeout is shared across attempts, reserving time for another host; cancellation closes the active request and prevents further attempts. The three observed node-loss SQL conditions allow up to ten rounds with 100–500 ms backoff within the same deadline, without evicting healthy coordinators. Other SQL/authentication errors propagate unchanged.
- Generic SQL writes, including increments and CAS, are sent once. There is no inference that an arbitrary `ON CONFLICT` statement is safe. Only the existing helpers can recover: `upsert` reads back its fixed key and timestamp before a second fixed-data attempt; `insertRows` may replay the identical `ON CONFLICT DO NOTHING` batch once. They now handle connection and observed node-loss failures as well as timeouts. Recovery requires a nonempty conflict key with every value explicitly bound and non-null; missing keys return the original error after one write, without readback or replay. An unconfirmed outcome still reaches the caller.

## Passing local proof

Three complete local 5.10.16 fault runs passed, with three shards, two replicas and REQUEST durability:

| Run | Reads | Keyed inserts | Upserts | Generic increments | Duplicate effects |
| --- | --- | --- | --- | --- | --- |
| First green, 23:24–23:25 UTC | 1,717 successful / 0 failed | 215 / 0 | 201 / 0 | 164 acknowledged / 2 returned errors | 0 |
| Second green, 23:31–23:33 UTC | 979 successful / 0 failed | 116 / 0 | 115 / 0 | 104 acknowledged / 1 returned error | 0 |
| Final guarded code, 23:38–23:40 UTC | 1,917 successful / 0 failed | 198 / 0 | 183 / 0 | 146 acknowledged / 0 returned errors | 0 |

Four concurrent readers mixed primary-key reads with distributed aggregates during concurrent keyed inserts, upserts and increments. Node2 was SIGKILLed three seconds into 22 seconds of load and remained stopped for the rest of the load. The surviving nodes held all acknowledged writes; no persisted increment exceeded one. Maximum read latency was 1,411 ms in the first run, 5,345 ms in the second run alongside the full webapp test suite, and 1,427 ms in the final run. All remained below the default ten-second budget.

After node2 rejoined and all nine table shard copies were STARTED, each complete run passed six controlled lost-response cases: reset and timeout for generic increment, upsert and keyed insert. The loopback proxy dropped a response only after CrateDB acknowledged its mutation. Every value stayed one, and `_seq_no` stayed at its value immediately after the first application. Increments sent one write and returned an indeterminate error; upserts sent one write and recovered by readback; keyed inserts sent two identical writes, with a no-op second attempt.

Evidence: [first green](../../goodwatch-webapp/scripts/crate-failover/results/observations.json), [second green](../../goodwatch-webapp/scripts/crate-failover/results/final-proof.json), [final guarded proof](../../goodwatch-webapp/scripts/crate-failover/results/fixed-keys-proof.json), [verified final cleanup](../../goodwatch-webapp/scripts/crate-failover/results/fixed-keys-proof-cleanup.json). The final proof records Node 26.8.1 and SHA256 `05c5b3c128b5f506265a3e86dc6f07e0f007687a662dd913c0bddfc3bed45587`, verified against the final `crate.ts`.

Rerun: install the webapp's locked dependencies and apply `patch-package`, then `bash goodwatch-webapp/scripts/crate-failover/run.sh`. Node 26 runs the TypeScript imports directly. The runner selects a local Unix Docker socket, uses only loopback ports and its dedicated Compose project, refuses existing owned containers, and removes its containers, volumes and network on exit. It verifies their absence and writes a cleanup record. No production endpoint, credentials, client, firewall or deployment was accessed or changed.

## Read-only Python and search assessment

No Python client, Windmill job or search configuration was changed or contacted. Checked repository code, the pinned Python wheel and upstream source; ran the unchanged driver against loopback HTTP fixtures with in-memory counters only.

| Consumer | Existing behavior | Needs follow-up? |
| --- | --- | --- |
| Current `goodwatch-search` services | These are TypeScript search roles of the webapp image, per ADR 0011 and their Compose file. They use this same `app/utils/crate.ts`. There is no separate Python search server in this checkout. | This patch also covers the search roles when their image is eventually updated. Their lack of logged failures in #547 does not demonstrate client failover. No deployment was performed. |
| Python search indexing (`f/search/build_indexes.py`, `embed_titles.py`) and other Windmill jobs | All use `f/db/cratedb.py:CrateConnector`, pinned to `crate==2.2.1` and `urllib3==2.7.0`. It passes all hosts and `Timeout(connect=1, read=180)`. Native driver already retries coordinator transport failures and HTTP 502/503/504/509, drops failed servers and reintroduces them after 30 seconds. | No duplicate host-eviction layer is needed. Read-only retry of node-loss SQL errors and a bounded overall read deadline do need a follow-up: HTTP 500 `NodeNotConnectedException` propagates immediately, and the 180-second per-host read wait is unsuitable for quick failover. |
| Windmill writes | The native `_request` retry loop does not inspect SQL or distinguish reads from writes. `Retry(read=0)` controls urllib3, but the outer driver still resends the SQL POST on another host after a lost response. `run` and `run_many` accept arbitrary SQL; `upsert_many` also has its own fixed-data transient-row retries. | Write replay safety needs a separate policy/audit before claiming the same no-double-application guarantee. Keep keyed idempotent ingestion distinct from arbitrary increments, CAS and other outcome-sensitive writes. Do not add blanket retries. |
| Python sitemap utility (`goodwatch-webapp/scripts/create_sitemaps.py:init_crate`) | Passes only `hosts[0]`, despite reading `CRATE_HOSTS`; no explicit timeout. Its dependency is broadly declared as `crate>=0.35.2`. | Needs all-host configuration, an explicit deadline and resolved-version verification if this utility must continue through a restart. No running version was inspected. |

The [pinned upstream HTTP client](https://github.com/crate/crate-python/blob/2.2.1/src/crate/client/http.py) contains `Server.request`, `Client._request`, `_get_server` and `_drop_server`; the [official timeout documentation](https://cratedb.com/docs/python/en/latest/connect.html) describes the connect/read settings. Local fixture evidence is [python-assessment.json](../../goodwatch-webapp/scripts/crate-failover/results/python-assessment.json), generated by [inspect-python.py](../../goodwatch-webapp/scripts/crate-failover/inspect-python.py). Five reads survived the first coordinator disconnect with only one request to that failed host. A simulated applied increment with its response lost produced **two effects from one caller request**, confirming the outer retry risk. A node-loss SQL error made one request and propagated with all three hosts still active.

Rerun the assessment in a disposable venv: install `crate==2.2.1 urllib3==2.7.0`, then run `python goodwatch-webapp/scripts/crate-failover/inspect-python.py <output.json>`. This is a client behavior fixture, not a Python three-node database fault proof.

## Other validation

- Full webapp tests after applying the repository's dependency patches: `node --test --test-concurrency=4 'app/**/*.test.ts'`: **2,648 tests, 2,647 passed, one skipped, zero failed** (88.3 seconds).
- Strict standalone TypeScript compilation of `crate.ts` and all four Crate test files passed.
- Repository-wide `npm run typecheck` still reports errors in unchanged files (routes, pointer utilities and other existing areas); there were no diagnostics in the changed Crate files. No unrelated fixes were made.
- An initial full-suite run before applying `patch-package` failed seven tests. A later run alongside Docker exposed three fixture deadlines of 150–300 ms that were too short under CPU contention. The new failover fixtures now use the real default budget except for dedicated timeout cases. The complete suite passed again after applying repository patches and running after Docker cleanup.

## Negative controls and limits

- Running the identical harness with the original client from branch base `a05bbf3f` correctly failed: **971 failed reads**, 92 failed keyed inserts and 126 failed upserts. [Baseline evidence](../../goodwatch-webapp/scripts/crate-failover/results/baseline-red.json). Reproduce with `CRATE_PROOF_BASELINE=1 CRATE_PROOF_OUTPUT=<absolute-output.json> bash goodwatch-webapp/scripts/crate-failover/run.sh`; the runner obtains the original client at the branch merge-base and cleans up the temporary source copies.
- That baseline also observed one generic counter at two, despite the original client having no generic-write retry. This observation is consistent with CrateDB's internal failover retries, already implicated by #530; the precise internal execution was not traced. This patch prevents **client replay** of generic writes, but cannot grant arbitrary non-idempotent SQL an exactly-once guarantee inside CrateDB. Outcome-sensitive operations still need CAS, an operation id and readback. The passing runs explicitly audit their observed durable effects; they do not prove every possible distributed fault schedule.
- A final-code rerun again passed its node-loss load (**1,553 successful reads, zero failed; 378 safe writes, zero failed; no duplicate mutation**) but the additional proxy/readback phase exhausted an artificially shortened one-second deadline during recovery. [Short-deadline evidence](../../goodwatch-webapp/scripts/crate-failover/results/short-deadline-red.json). It returned a bounded error without another upsert write. The final complete run above used the actual ten-second default for deterministic lost-response timeouts and passed all six cases.
- The exploratory harness initially misparsed Docker Compose's newline-delimited `ps --format json`; [first-run.json](../../goodwatch-webapp/scripts/crate-failover/results/first-run.json) records that harness error. Its parser was fixed before the complete red and green runs.
