# CrateDB client failover (#588)

Scope: branch from `origin/main`, local verification only, draft PR against main. No production access, merge or deployment. Read the complete [#547 report](https://github.com/alp82/goodwatch-monorepo/issues/547#issuecomment-6180527783) before implementation.

## Test boundaries and first failing case

The brief authorizes the public Crate client (`query`, `execute`, `upsert`, `insertRows`) and a disposable local three-node Docker cluster as the test boundaries. HTTP fixture servers stand in for coordinator connection failures; real SQL and persisted rows provide the final fault proof.

- First red: `node --test app/utils/crate-failover.test.ts` failed on unmodified code with `ECONNRESET: socket hang up`. A read routed to a disconnected coordinator reached the caller instead of failing over. The test also requires failing hosts to be excluded from subsequent rotation.
- Checkpoints are pushed to `fix/crate-client-failover`; draft PR [#589](https://github.com/alp82/goodwatch-monorepo/pull/589). Work is ongoing; this document will contain the completed proof and read-only Python-client assessment.

## Docker-discovered regression

The first complete stop-under-load run caught four failed reads on surviving coordinators while shard routing still referenced the lost node. HTTP 500 carried `NodeNotConnectedException`, `NoSuchNodeException`, and disconnect-related `JobKilledException`. The upsert's readback also encountered this condition. Full red observations: [distributed-failure-red.json](../../goodwatch-webapp/scripts/crate-failover/results/distributed-failure-red.json).

A public-client regression test reproduced this before extending the fix. Reads now allow bounded rounds with short backoff for those exact node-loss conditions, within their original timeout budget. These errors do not evict a healthy coordinator. Generic writes still return the original error; safe helpers may read back or replay their fixed keys. All 22 targeted tests pass at this checkpoint. A fresh Docker run is next.

## Passing local proof

The completed 5.10.16 run on 2026-10-14 23:24–23:25 UTC passed: **1,717 reads, zero failed reads; 215 keyed inserts and 201 upserts, zero safe-write failures; no row mutated twice**. Four concurrent readers mixed primary-key reads with distributed aggregates. Node2 was SIGKILLed three seconds into 22 seconds of concurrent load, and remained stopped for the rest of that load. The two survivors held all acknowledged writes. Two generic increment attempts returned connection errors without replay; persisted increment values never exceeded one. Maximum observed read latency was 1,411 ms.

After node2 rejoined and all nine table shard copies were STARTED, six controlled lost-response cases passed: reset and timeout for each of generic increment, upsert and keyed insert. The loopback proxy dropped an HTTP response only after CrateDB acknowledged its mutation. In every case the value stayed one and `_seq_no` stayed exactly at its value immediately after the first application. Increments sent one write and returned an indeterminate error; upserts sent one write and recovered by readback; keyed inserts sent two identical writes and the second was a no-op.

Evidence: [observations.json](../../goodwatch-webapp/scripts/crate-failover/results/observations.json). Rerun: `bash goodwatch-webapp/scripts/crate-failover/run.sh` with Node 26 and webapp dependencies installed. The runner selects a local Unix Docker socket, uses only loopback-published ports and its dedicated Compose project, refuses existing owned containers, and removes its containers, volumes and network on exit. Their absence was verified after the passing run. No production endpoint, credentials, client, firewall or deployment was accessed or changed.
