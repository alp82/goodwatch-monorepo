# Graceful CrateDB restart: real route proof, 2026-10-15

#604 released catalog/index failover and redacted diagnostics as `dd7ab0a9c07fb2f6e933a2d53da69bb11f4ddd59`. The local follow-up here addresses additional failures demonstrated against that released client. It is not deployed. No production CrateDB node was restarted or decommissioned during this work.

## Run it

From `goodwatch-webapp/`, with the locked dependencies installed and a local Docker daemon:

```sh
# Red control: released client and catalog transport, current real loader/action boundaries.
CRATE_PROOF_BASELINE=1 CRATE_PROOF_BASELINE_COMMIT=dd7ab0a9 \
CRATE_PROOF_GRACEFUL=1 CRATE_PROOF_PAGES=1 \
CRATE_PROOF_OUTPUT=/tmp/crate-released/observations.json bash scripts/crate-failover/run.sh

# Follow-up recovery implementation.
CRATE_PROOF_GRACEFUL=1 CRATE_PROOF_PAGES=1 \
CRATE_PROOF_OUTPUT=/tmp/crate-fixed/observations.json bash scripts/crate-failover/run.sh
```

The script accepts only a local Unix Docker socket, replaces Crate configuration with loopback addresses and owns only Compose project `goodwatch-client-588`. It refuses an existing project and verifies removal of its containers, volumes and network. Three digest-pinned CrateDB **5.10.16** nodes use disposable data and loopback SQL ports. Never adapt this command to production.

`build-page-proof.mjs` bundles actual Remix loaders/actions; `page-proof.mjs` runs them through Remix's static handler over real concurrent HTTP requests. It seeds the application's Crate schemas, 24 titles, 1,000 people with credits, a member fixture, tracking and library data. Crate queries and write logic are unchanged. Auth is a fixed fixture; cache/Valkey and external service boundaries are replaced; a real encoded/decoded fixture title snapshot drives Explorer. This proves loader/action SQL behavior, not rendering, browser behavior, Supabase or Valkey resilience.

All fixture tables must be visible through every coordinator, shards GREEN, and every route warmed before the fault. Eight route workers plus read, fixed-key insert/upsert and generic increment workers run for 75 seconds. After three seconds, the proof uses graceful decommission with `min_availability=primaries`, `force=false`, a two-hour graceful timeout and allocation restricted to primaries. It waits for normal exit code 0 and membership removal, restarts node1, reenables allocation and verifies requests continue after rejoin. Final reports include selected-client and supporting-source SHA-256 hashes (including tracking and the generated route bundle), error events, route outcomes, durable-write audits and independent cleanup receipts.

## Results

| Route | Released-client HTTP failures / requests | Follow-up HTTP failures / requests |
| --- | ---: | ---: |
| Movie | 0 / 129 | 0 / 138 |
| Show | 0 / 126 | 0 / 159 |
| Person | 0 / 103 | 0 / 134 |
| Library | 3 / 116 | 0 / 160 |
| Explore | 1 / 173 | 0 / 225 |
| Watch | 3 / 43 | 0 / 60 |
| Score | 1 / 43 | 0 / 53 |
| Catalog | 1 / 331 | 0 / 449 |

Request totals include warm-up; the fixed run also includes its two post-load lost-CAS checks.

Released baseline: **9 / 1064 HTTP 500**, three probe-read failures, zero fixed-key helper failures, two indeterminate generic writes. The nine route failures were `RelationUnknown` (4041) from rejoining node1: library 3, explore 1, watch 3, score 1, catalog 1. There were 15 terminal SQL `RelationUnknown` events across route and probe queries; parallel query failures overlap HTTP requests. A separate post-write REFRESH failed too, but the score path caught it and returned 200. Movie/show/person stayed clean in this sample.

An earlier 45-second route control (`graceful-refresh-red.json`, selected-source hash in the receipt) produced a watch HTTP 500 when `REFRESH TABLE user_watch_log` timed out for 10 seconds on the draining node. Its preceding fixed-key write was already applied; REFRESH was still treated as a non-replayable generic mutation.

The first candidate removed metadata/REFRESH failures but left one score 500 from a CAS connection refusal. After handling pre-send connection refusal, another run exposed one score 500 from a CAS mid-write `ECONNRESET`. Those red controls are retained beside the released baseline; they explain each additional policy change.

Final proof: **0 / 1378 route HTTP failures**, **2247 successful probe reads**, **329 keyed inserts** and **305 upserts**, no failures in those probes. Generic mutations remain allowed to return an indeterminate error; this run had 2. The proof checks acknowledged writes, no duplicated row effects and the unique stored watch IDs. It additionally drops **eight acknowledged responses**: reset and timeout for a generic increment, upsert, keyed insert and a real score action's tracking CAS. Generic increments return an error without replay; guarded operations recover. Every case compares durable sequence numbers to rule out a second application. All owned Docker resources are removed.

## Recovery changes

- A joining HTTP coordinator may lack cluster table metadata. Reads try other coordinators once for exact `RelationUnknown`/4041. A success elsewhere proves metadata mismatch and triggers a short coordinator cooldown. A table missing everywhere remains a typed error after one pass. Fixed-key helpers can use their existing readback/replay guard for this refusal.
- `REFRESH TABLE` changes visibility and can be repeated. Only a strict table-list grammar receives bounded failover; comments, additional statements and all other generic writes retain their existing policy.
- `ECONNREFUSED` means TCP did not connect and no SQL was sent. Another coordinator may receive the statement once. Resets, broken pipes and timeouts do not receive this generic permission.
- Tracking's state writer owns its key, original sequence/primary-term condition, timestamp and intended values. On an availability failure it reads the key back. An observed intended update (or completed delete) succeeds; an unchanged row permits one replay of exactly the original CAS. Even a delayed first request can apply at most once. Another row version goes through the existing optimistic-conflict loop. Recovery emits redacted operation/readback/replay events.

The tracking regressions cover applied, unapplied and still-pending lost responses for updates and deletes. Other client tests retain the no-replay guarantee for unsafe/compound SQL and truly absent relations.

## Validation

Full webapp suite: **2,687 passed, one optional Valkey-cluster skip, zero failures**. Targeted tracking/client suite: **119 passed**. Typecheck: **174 diagnostics on both main and follow-up, no additions**. Production build and precompression: **passed**. `graceful-validation.json` records these gates.

## Production release evidence and maintenance decision

Release verification is on [#604](https://github.com/alp82/goodwatch-monorepo/pull/604#issuecomment-6197936504) and [#547](https://github.com/alp82/goodwatch-monorepo/issues/547#issuecomment-6197937593). All four containers were captured on `dd7ab0a9`, healthy with live/readiness 200 and zero restarts. Later unrelated #606 moved pages to `f1c9f61d`; its webapp tree and image ID are identical. The stable five-minute window had **0 HTTP 5xx / 3,773 responses**, one recovered read timeout (crate-02 to crate-03) and zero terminal Crate failures. Container startup samples and the actual failed-attempt/failover/recovered-query/HTTP trace are redacted.

Axiom storage is unverified: query-read access was skipped and the ingest token returned 403. Vector1 currently uses json-file logging with no Coolify drain. Production Crate container IDs, start times, PIDs and restart counts matched before/after.

**#604 alone does not make crate-01 maintenance safe for these page workloads:** this released-client red control still produced nine route 500s. Hold crate-01 until the follow-up recovery changes have been reviewed and deployed. These local classes are demonstrated restart hazards; they cannot be assigned retrospectively to the original 27 production failed-query lines because those incident logs were lost. This proof does not establish full production workload coverage or Valkey resilience.
