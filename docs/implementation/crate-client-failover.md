# CrateDB client failover (#588)

Scope: branch from `origin/main`, local verification only, draft PR against main. No production access, merge or deployment. Read the complete [#547 report](https://github.com/alp82/goodwatch-monorepo/issues/547#issuecomment-6180527783) before implementation.

## Test boundaries and first failing case

The brief authorizes the public Crate client (`query`, `execute`, `upsert`, `insertRows`) and a disposable local three-node Docker cluster as the test boundaries. HTTP fixture servers stand in for coordinator connection failures; real SQL and persisted rows provide the final fault proof.

- First red: `node --test app/utils/crate-failover.test.ts` failed on unmodified code with `ECONNRESET: socket hang up`. A read routed to a disconnected coordinator reached the caller instead of failing over. The test also requires failing hosts to be excluded from subsequent rotation.
- Checkpoints are pushed to `fix/crate-client-failover`; draft PR [#589](https://github.com/alp82/goodwatch-monorepo/pull/589). Work is ongoing; this document will contain the completed proof and read-only Python-client assessment.

## Docker-discovered regression

The first complete stop-under-load run caught four failed reads on surviving coordinators while shard routing still referenced the lost node. HTTP 500 carried `NodeNotConnectedException`, `NoSuchNodeException`, and disconnect-related `JobKilledException`. The upsert's readback also encountered this condition. Full red observations: [distributed-failure-red.json](../../goodwatch-webapp/scripts/crate-failover/results/distributed-failure-red.json).

A public-client regression test reproduced this before extending the fix. Reads now allow bounded rounds with short backoff for those exact node-loss conditions, within their original timeout budget. These errors do not evict a healthy coordinator. Generic writes still return the original error; safe helpers may read back or replay their fixed keys. All 22 targeted tests pass at this checkpoint. A fresh Docker run is next.
