# CrateDB client failover (#588)

Scope: branch from `origin/main`, local verification only, draft PR against main. No production access, merge or deployment. Read the complete [#547 report](https://github.com/alp82/goodwatch-monorepo/issues/547#issuecomment-6180527783) before implementation.

## Test boundaries and first failing case

The brief authorizes the public Crate client (`query`, `execute`, `upsert`, `insertRows`) and a disposable local three-node Docker cluster as the test boundaries. HTTP fixture servers stand in for coordinator connection failures; real SQL and persisted rows provide the final fault proof.

- First red: `node --test app/utils/crate-failover.test.ts` failed on unmodified code with `ECONNRESET: socket hang up`. A read routed to a disconnected coordinator reached the caller instead of failing over. The test also requires failing hosts to be excluded from subsequent rotation.
- Checkpoints are pushed to `fix/crate-client-failover`. Work is ongoing; this document will contain the completed proof and read-only Python-client assessment.
