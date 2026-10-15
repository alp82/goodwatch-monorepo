# G1 rollout preparation — October 15, 2026

Implemented items 1–8 under “Adopted after review” in the supplied research PLAN.md,
using REVIEW-fable.md for references. This is repository preparation only: no production
Crate, Valkey or Windmill calls, deployment, variable changes, schedule changes or commit.

The webapp now marks every changed member with `SADD g1:dirty <member>`, without a
Windmill token, HTTP call, preview restriction or process-local debounce. The builder
owns rollout selection. The reader reads only `g1:v2:<member>` as gzip of format-1 JSON.
It validates before converting columns to typed arrays, retains no raw payload, coalesces
concurrent reads, revalidates resident entries (including fallbacks) no more than once every 45 seconds,
and uses a 50-entry count LRU with the existing ten-minute expiry. Snapshot mismatches
and the 36-hour maximum payload age still fail closed during that interval. Franchise
ids use Float64Array to preserve negative sentinels and all safe integer ids; point ids
also require Float64Array. B3 uses Float32Array and boolean columns use Uint8Array.

Watch next plans now allow 300 entries, retaining the 100,000-title guard and ten-minute
TTL. This accommodates a low-hundreds cohort without removing the total-title bound.
Missing payloads retain their exposure fallback reason without a request warning.
Off/shadow/preview/on resolution and Watch next tiers are unchanged.

The builder loads shared members and titles once per nonempty run. It selects the
configured cohort or all discovered members, tests `taste_vector(view) is not None`,
builds eligible members, and deletes selected ineligible `g1:v2` keys. Full `all` runs
also scan only the v2 namespace for orphaned payloads whose last interaction disappeared.
Each member has its own error boundary, timing/byte/status line, and the run prints an
aggregate summary. Writes are idempotent and retain the default 48-hour TTL. The frozen
B3/B5 math and model hash are unchanged.

Both triggers and manual builds authorize against `f/sync/g1_members`. A dirty run
claims one bounded snapshot with SPOP, restores members outside the rollout, and
processes the selected members together. Marks arriving during compute remain queued.
Member failures are requeued; shared-read failures or a changed snapshot restore the
claimed selection before aborting. Dry runs inspect without popping, publishing,
deleting or requeueing. `main` keeps `dry_run=True`; explicit None still means a dry run
and the default TTL. None member selection uses the rollout; None dirty_only means false.
Both full and dirty triggers enqueue the same `g1_order` script with `concurrent_limit: 1`.

Changed files:

| File | Change |
| --- | --- |
| `goodwatch-webapp/app/server/g1/rebuild.server.ts` | Dirty-set marker replaces HTTP/debounce scheduler. |
| `goodwatch-webapp/app/server/g1/reader.server.ts` | Gzip-only v2 reads, typed columns, 45-second revalidation, coalescing, 50-entry LRU, quiet missing fallback. |
| `goodwatch-webapp/app/server/taste/member.server.ts` | Remove obsolete G1 timer shutdown hook. |
| `goodwatch-webapp/app/server/watch-next-plans.server.ts` | Raise plan entry bound to 300. |
| `goodwatch-webapp/app/server/g1/rebuild.test.ts` | Dirty writes, deduplication semantics, no HTTP, failure containment. |
| `goodwatch-webapp/app/server/g1/reader.test.ts` | Gzip/typed decoding, interval and negative caching, concurrent loads, eviction, invalid payloads, age/snapshot checks. |
| `goodwatch-webapp/app/server/g1/order.test.ts` | Existing Python parity plus parity through gzip decode and typed arrays. |
| `goodwatch-webapp/app/server/g1/writes.test.ts` | Real committed interaction paths with fake Valkey, including removals and unlisted members. |
| `goodwatch-webapp/app/server/g1/integration.test.ts` | V2 gzip adapter and revalidation clock; preserve modes, filtered franchises, tiers and retained-plan provenance. |
| `goodwatch-webapp/scripts/bench-g1-order.ts` | Cold decode/composition at the order cache bound, warm requests and rotating 170-member synthetic workload. |
| `goodwatch-flows/windmill/f/sync/copy/g1_order.py` | Rollout discovery/authorization, taste eligibility, gzip publication/deletion, shared runs, failure isolation and dirty claims/retries. |
| `goodwatch-flows/windmill/f/sync/copy/g1_order.script.yaml` | Optional cohort/all selection, safe defaults, dirty_only argument and updated contract. |
| `goodwatch-flows/windmill/f/sync/copy/g1_trigger.py` | Shared rollout parser; full and dirty runs enqueue the serialized builder. |
| `goodwatch-flows/windmill/f/sync/copy/g1_trigger.script.yaml` | Scheduled dirty entry argument and rollout documentation. |
| `goodwatch-flows/windmill/f/sync/copy/title_snapshot.py` | Update trigger alias/log wording; retain snapshot and nightly/no-change calls. |
| `goodwatch-flows/tests/test_g1_order.py` | Gzip publication, real taste threshold, eligibility/deletion, orphan cleanup, shared reads, dirty selection, retries, concurrent marks and None defaults. |
| `goodwatch-flows/tests/test_g1_trigger.py` | Cohort/all policy and dirty arguments; preserve snapshot/nightly tests with fake connectors. |
| `docs/implementation/g1-rollout-preparation.md` | This implementation and owner handoff report. |

Validation:

- **79 webapp tests pass across 10 files.** Each file was run directly with `node <file>`:
  all five `app/server/g1/*.test.ts`, `list-exposure-lists.test.ts`,
  `list-exposure.test.ts`, `taste/taste.test.ts`, `title-filter/passes.test.ts`,
  and `watch-next-plans.test.ts`. The G1 order file includes six Python fixtures
  checked both directly and through the compressed reader (14 tests total).
- **33 G1 flow tests pass:**
  `python -m unittest discover -s goodwatch-flows/tests -p 'test_g1*.py'`.
  All connectors and Windmill enqueue functions are fake. The copied-math digest and
  committed Python ordering fixtures pass. The copied research math still emits its
  existing empty-slice warning on synthetic missing-data inputs.
- `npm run typecheck` ran in `goodwatch-webapp` and exited 2 with **175 diagnostics in
  untouched files**, including route, pointer and random utility errors. None name a
  changed file. A baseline typecheck comparison was not run; this is not a clean
  repository-wide typecheck.
- The additional `test_title_snapshot.py` suite was attempted but could not import
  because `fakeredis` is unavailable locally. Its G1 snapshot/nightly trigger behavior
  is covered by the passing G1 trigger tests. The full external research-pack driver
  was not run; it requires a scratch write path outside the allowed workspace.
- Python syntax checks and both modified Windmill YAML parses pass. Biome formatting
  checks pass for the eight changed G1 TypeScript/test/benchmark files checked.
  `git diff --check` passes.

Synthetic benchmark: run `node goodwatch-webapp/scripts/bench-g1-order.ts` locally.
It uses 60,000 titles, the existing 200,000-title order-cache bound (three full catalog
compositions fit), 12 cold samples, 20 warm samples and 170 rotating members. No backend
connector is loaded. The final separate run, after typechecking finished, measured:

| Measurement | Minimum | Median | Maximum |
| --- | ---: | ---: | ---: |
| Cold gzip decode, validation and typed preparation | 78.53 ms | 111.67 ms | 168.22 ms |
| Cold composition with the default order-cache bound | 200.53 ms | 252.72 ms | 373.12 ms |
| Warm reader + composition-cache hit | 0.91 ms | 1.12 ms | 1.18 ms |
| Rotating 170 members, read/decode + composition | 101.95 ms | 122.27 ms | 1,233.54 ms |

JSON was **3,240,845 bytes**; gzip was **644,853 bytes**. Typed columns plus the row map
were **1,620,000 bytes** per synthetic member. This uses a 60,000-row synthetic snapshot:
actual retained array bytes are `23 * candidates + 4 * snapshot.count`. The synthetic
170-member gzip extrapolation is about 109.6 MB before Valkey overhead and snapshots.
The maximum sampled process RSS was **495.86 MiB**. There were **182 GETs** for 182 cold
members across the two phases and no extra GETs for the 20 warm requests.

These are local synthetic measurements with a Map for row lookup, excluding network,
real filtering, rendering and production input distribution. JIT/GC and host contention
cause substantial variance. Cold composition exceeds the review's “few tens of ms”
expectation and remains a rollout performance concern; warm timing alone cannot clear
the serving gate. No binary wire-format change or order-cache redesign was added.

Owner/orchestrator deployment actions, in order:

1. **Deploy the webapp reader first**, together with the dirty marker and raised plan
   bound. The v2-only reader falls back to today's ordering until v2 backfill completes;
   it does not read v1. No changes to the mode-resolution semantics are needed.
   `G1_WINDMILL_URL`, `G1_WINDMILL_TOKEN` and `G1_WINDMILL_WORKSPACE` are no longer read
   by the webapp and can be removed by the owner.
2. Before backfill, check actual Valkey maxmemory, free memory, eviction policy and
   snapshot protection on every node. ADR 0003 documents 7 GiB/volatile-lfu and persistent
   snapshot chunks, but live settings were not checked. Include payloads, snapshots,
   ordinary caches and worker headroom in the budget. The required `g1:dirty` set is a
   deliberate small persistent-queue exception to ADR 0003's ordinary-cache TTL rule;
   v2 payloads continue to expire after 48 hours.
3. Create Windmill variable **`f/sync/g1_members`** with a JSON list of cohort ids, e.g.
   `["owner-id","cohort-member-id"]`. For the full rollout its value is the string
   **`all`** (literal `all` or JSON `"all"`); `["all"]` is rejected. This replaces both
   old preview-variable reads. Keep `REC_PREVIEW_USERS` aligned with the cohort while
   using shadow/preview; that webapp flag remains a separate serving control.
4. Deploy the modified Windmill scripts/schema after the reader. Run a dry run first
   (the default, including explicit None), inspect per-member summaries, then backfill
   once with `f/sync/copy/g1_order` and `{"dry_run":false}`. Omitted member_ids selects
   the rollout. Keep the existing snapshot/nightly schedule and its no-change trigger.
5. Create a **new schedule `f/sync/copy/g1_dirty`**, targeting the **script
   `f/sync/copy/g1_trigger`**, every **three minutes**: UTC cron v2
   **`0 */3 * * * *`**, arguments **`{"dirty_only":true}`**. This trigger supplies
   `dry_run:false` to the builder; ordinary snapshot calls omit dirty_only and stay
   full reconciliations. Both paths use the default Python workers and the same
   serialized builder. The schedule and variable are not created by this patch.
6. Backfill the cohort, use shadow then preview, and measure **at least 99% G1 success
   on eligible cohort Best match requests outside snapshot transitions**. Expand the
   rollout to `all` and backfill before setting `REC_G1_ORDER=on`. After `on`, use the
   same 99% threshold as the rollback trigger over all eligible Best match requests;
   observe the first 48 hours and a snapshot transition. Monitor interaction rebuild
   age (target under five minutes), worker/webapp memory, loader latency and evictions.
   Roll back with `REC_G1_ORDER=off` and disable expanded triggers. Restart webapp
   containers for flag changes and refresh retained Watch next pages.

Open checks: production coverage/freshness and the 99% gate are unmeasured; the owner
must create/verify the above variable and schedule, validate live memory policy and
confirm a single webapp instance or sticky routing for process-local Watch next plans.
A worker hard termination after SPOP can lose the claimed work until a later interaction
or snapshot/nightly reconciliation; the adopted design has no resumable progress.
Cold serving performance needs a rollout decision against an agreed latency budget;
the order-cache representation/bounds and binary wire format have not been redesigned.
