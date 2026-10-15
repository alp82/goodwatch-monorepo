Recommend **full-pool binary payloads first**, then a small member cohort, then `REC_G1_ORDER=on`. Treat truncation as a separate quality experiment. The supplied measurements imply **550,879,900 bytes** for 170 current payloads; the proposed binary layout reduces that to approximately **125 MB**, before Valkey overhead.

This is a repository-only plan. No production queries or file edits were made. Sizes and capacity figures below are estimates unless identified as recorded benchmarks.

1. **Compact payload**

   The snapshot already contains point IDs, title type derived from those IDs, and genre bits. It does **not** contain movie-series IDs or production method. G1’s animation flag specifically means `production_method == "Animation"`; substituting the Animation genre or anime flag would change behavior. ([Snapshot columns](goodwatch-webapp/app/server/title-snapshot/snapshot.server.ts:54), [title type](goodwatch-webapp/app/server/title-snapshot/snapshot.server.ts:253), [stored layout](goodwatch-webapp/app/server/title-snapshot/format.server.ts:5), [G1 facts](goodwatch-flows/windmill/f/sync/copy/g1_order.py:402))

   Introduce `format: 2` with this binary layout:

   | Component | Proposed representation |
   |---|---|
   | Point ID | Snapshot row, unsigned 32-bit; derive ID and `show` from snapshot |
   | `b3Rank` | Float32, preserving today’s stored precision |
   | `movieSeriesId` | Dense unsigned 32-bit franchise label; zero for no franchise |
   | `b5TopHalf`, `animation` | Two packed bits per candidate |
   | Metadata | Small header: format, model, snapshot, build time, count, own shares, diagnostics |

   Dense franchise labels preserve behavior because request composition uses only positive membership and equality. Keep B5 membership global and recompute franchise promotion over the filtered request. Preserve `ownShares` from **all own ratings**, rather than deriving it from retained candidates. ([Franchise composition](goodwatch-webapp/app/server/g1/order.ts:71), [Float32, B5 median and shares](goodwatch-flows/windmill/f/sync/copy/g1_order.py:402))

   Estimated payload sizes, excluding the small header:

   | Representation | Per member | 170 members |
   |---|---:|---:|
   | Full 60,000 candidates, 12.25 bytes each | 735 KB | 125 MB |
   | Full pool, sorted row deltas averaging 1–2 varint bytes | 555–615 KB | 94–105 MB |
   | Top 10,000, fixed-width rows | 123 KB | 20.8 MB |

   Start with fixed-width rows: simple decoding and predictable bounds. The job must load the selected snapshot’s row mapping, validate every candidate against it, and bind the payload to that version. Today it reads the manifest and separately reads title data; the reader rejects snapshot mismatches or unmappable IDs. ([Job inputs/publication](goodwatch-flows/windmill/f/sync/copy/g1_order.py:579), [reader validation](goodwatch-webapp/app/server/g1/reader.server.ts:54))

   **Truncation option:** compute full-pool B3/B5 and shares first, retain the top 10,000 by B3 with deterministic ties, then store them in row order. Order retained matches through G1 and append every other filtered title in today’s relative order—the current composer already appends unknown candidates this way. However, this is a model change: B5 promotion and the first-100 mix can elevate lower-B3 titles. Compare N=5k/10k/20k against full G1 across narrow service, mood, type and Wishlist filters before adopting it. ([Known/suffix composition](goodwatch-webapp/app/server/g1/reader.server.ts:178), [group ranking and mix](goodwatch-webapp/app/server/g1/order.ts:63))

   Keep TS/Python parity through shared binary fixtures: exact Float32 round-trips, franchise equality, stable request-order ties, all four mix categories, filtered franchise leaders, empty inputs and suffix preservation. Extend the existing Python-generated ordering fixtures and TS exact comparisons. ([Python cases](goodwatch-flows/tests/g1_pack_parity.py:98), [TS parity](goodwatch-webapp/app/server/g1/order.test.ts:26))

2. **Eligibility when `on`**

   `on` enables the flag for every authenticated member; preview and shadow remain allowlisted. That does **not** make every member’s lists use G1: Discover requires catalog Best match, which requires taste; Watch next also requires usable taste and Best match. Without taste, Discover falls back to Popular and Watch next defaults to Added. ([Flag resolution](goodwatch-webapp/app/utils/features.ts:19), [Discover gate](goodwatch-webapp/app/server/title-filter/index.server.ts:257), [sort fallback](goodwatch-webapp/app/server/title-filter/order.server.ts:109), [Watch next availability/default](goodwatch-webapp/app/server/watch-next.server.ts:238), [default sort](goodwatch-webapp/app/server/watch-next.server.ts:297))

   The offline job accepts empty history. With fewer than five usable liked ratings, B3 returns **0.5 for every candidate**. B5 can still predict from other members: with no own ratings it uses the pooled prior; personal residual weights start at three ratings. With insufficient other-member data it falls back to public scores plus a shrunk offset. No ratings means no mix; even one rating supplies own type/animation shares. ([Empty history](goodwatch-flows/windmill/f/sync/copy/g1_order.py:588), [B3 threshold/fallback](goodwatch-flows/windmill/f/sync/copy/g1_order.py:234), [B3 constant](goodwatch-flows/windmill/f/sync/copy/g1_order.py:297), [B5 behavior](goodwatch-flows/windmill/f/sync/copy/g1_order.py:136), [shares](goodwatch-flows/windmill/f/sync/copy/g1_order.py:412))

   **Recommendation:** retain the existing usable-taste eligibility; add no separate total-ratings threshold. Build payloads for members who can use Best match: five liked, usable fingerprints and a valid taste vector. Five total ratings is insufficient, so the supplied 170 members is a capacity ceiling for this cohort, not its verified eligible count. Reevaluate eligibility after interactions and delete payloads when members lose eligibility. ([Taste construction](goodwatch-webapp/app/server/taste/formula.server.ts:95))

3. **Job expansion, runtime and freshness**

   Replace preview-only discovery and authorization with a server-controlled rollout policy: explicit cohort during canary, all eligible members afterward. Change **both** `g1_trigger` and the job’s authoritative check; changing the webapp flag alone cannot expand builds. ([Trigger allowlist](goodwatch-flows/windmill/f/sync/copy/g1_trigger.py:12), [job authorization](goodwatch-flows/windmill/f/sync/copy/g1_order.py:605))

   The job already loads shared member/title inputs once and processes members sequentially. B5 refits against everyone except the target member, so do not replace those fits with one global fit without separate parity work. Its main feature matrix is approximately `8 × titles × (85 + genre_count)` bytes: roughly **50 MB at 60,000 titles and 20 genres**, plus substantial temporaries, input records and arrays. ([Shared inputs/member loop](goodwatch-flows/windmill/f/sync/copy/g1_order.py:585), [leave-one-member-out view](goodwatch-flows/windmill/f/sync/copy/g1_order.py:374), [feature allocation](goodwatch-flows/windmill/f/sync/copy/g1_order.py:57), [pooled fit](goodwatch-flows/windmill/f/sync/copy/g1_order.py:109))

   Recorded offline evidence is **6.19 seconds shared construction, 0.75 seconds/member prediction and encoding, 375 MiB peak RSS**. Production reads and the full member population were not measured. Use **1 GiB initial worker headroom**, batch 10 members, and one batch at a time initially. Seventeen batches imply roughly **four minutes of compute**, plus database/network time; benchmark the first cohort before committing to a schedule. Memory should remain roughly one dataset plus one member’s working state, rather than multiplying by batch size. ([Recorded benchmark and limits](docs/implementation/g1-order-stage1.md:102))

   Add per-member timings/RSS, failure isolation, resumable batch progress and durable deduplication. Keep short priority jobs for interaction rebuilds so backfills cannot delay them. Current execution is globally limited to one job with a 30-minute timeout; the webapp debounce is only process-local, 1.5 seconds, and repeatedly checks preview membership. Widen all those checks and deduplicate across instances. Rating writes already invoke the scheduler. ([Job limits](goodwatch-flows/windmill/f/sync/copy/g1_order.script.yaml:4), [rebuild scheduler](goodwatch-webapp/app/server/g1/rebuild.server.ts:43), [rating hook](goodwatch-webapp/app/server/scores.server.ts:85))

   Preserve the **48-hour storage TTL / 36-hour reader maximum age**. Schedule reconciliation every 12 hours, retain post-snapshot rebuilds, and target interaction freshness within five minutes. A snapshot change currently invalidates old payloads immediately and aborts an ongoing build; prioritize active members and allow today’s ordering during that transition. Snapshot publication already enqueues G1, including successful no-change attempts. ([TTL](goodwatch-flows/windmill/f/sync/copy/g1_order.py:316), [age/version checks](goodwatch-webapp/app/server/g1/reader.server.ts:54), [build guard](goodwatch-flows/windmill/f/sync/copy/g1_order.py:593), [snapshot trigger](goodwatch-flows/windmill/f/sync/copy/title_snapshot.py:664))

4. **Webapp capacity and serving**

   Today every eligible request fetches the entire JSON value. A warm reader avoids parsing, but misses synchronously parse/validate arrays and perform a binary-search snapshot lookup per candidate. Its 20-entry cache expires after ten minutes and evicts by insertion order. At the supplied snapshot size, mappings alone occupy **18.9 MiB for 20 members**; retained raw payloads add approximately **61.8 MiB** with one-byte strings, before parsed arrays. ([Reader/cache](goodwatch-webapp/app/server/g1/reader.server.ts:105), [decode/mapping](goodwatch-webapp/app/server/g1/reader.server.ts:45), [binary search](goodwatch-webapp/app/server/title-snapshot/snapshot.server.ts:222))

   Use binary buffers and typed views. Start with a **64 MiB prepared-payload LRU budget**, rather than simply raising 20 to 170. A full compact payload plus its current dense mapping costs about **1.65 MiB/member**, accommodating roughly 38 members within that budget. Coalesce concurrent loads per member/build.

   Avoid fetching 735 KB on every warm request: publish a small revision key and payload atomically under the same member hash tag. Check revision each request; fetch/decode only on change. Validate revision against the payload header, retry a publication race once, then fall back. Deletion must update both keys.

   Account for payload references retained by the separate order cache, currently bounded at 40 entries/200,000 titles/four variants per member. Watch next also retains plans with a 40-entry/100,000-title bound; missing plans force browser refresh. Instrument aggregate retained bytes and refresh frequency before raising either cap. ([Order cache](goodwatch-webapp/app/server/g1/reader.server.ts:218), [plan bounds](goodwatch-webapp/app/server/watch-next-plans.server.ts:3), [refresh behavior](goodwatch-webapp/app/server/watch-next.server.ts:843))

   Preserve existing on-mode scope and Watch next’s fit/time/Not tonight tiers. Benchmark cold decode, cold composition, warm requests and a rotating 170-member workload separately. The recorded **1.14 ms median** is a warm synthetic order-cache result excluding real network, filtering and rendering—not a cold-request estimate. ([Watch next composition](goodwatch-webapp/app/server/watch-next.server.ts:368), [benchmark scope](docs/implementation/g1-order-stage2.md:111))

5. **Stages, monitoring and rollback**

   Deploy in this sequence:

   - **Offline:** implement format/parity checks and capacity benchmarks; leave owner preview serving the full pool.
   - **Small cohort:** owner plus 5–10 eligible members spanning rating counts and movie/show preferences. Backfill first; use shadow, then preview. Expand both webapp and job cohort configuration.
   - **All eligible:** backfill remaining members in batches, verify freshness and coverage, then set `REC_G1_ORDER=on`. Observe at least one snapshot transition and 48 hours before removing migration support. Keep truncation separate.

   In `doc.user_list_exposure`, segment by surface, actual sort, filters, page/batch and member eligibility. Monitor actual `ordering`, fallback reason, payload age, model/snapshot versions, group distribution, mix placements and Watch next tiers. The logger already stores these, plus up to 30 returned cards and comparison prefixes. Enabled serving records `today_first_100`; shadow records `g1_first_100`, so those columns are not normally populated together. ([Exposure fields](goodwatch-webapp/app/server/list-exposure.server.ts:51), [Discover prefixes](goodwatch-webapp/app/server/title-filter/index.server.ts:268), [Watch next prefixes](goodwatch-webapp/app/server/watch-next.server.ts:408))

   Proposed promotion gates: **≥99% G1 success on eligible Best match requests outside snapshot transitions**, no unexplained tier violations, interaction rebuild p95 below five minutes, and no sustained loader-latency/RSS regression. Separately monitor cold/warm cache latency, event-loop delay, queue age, worker RSS, Valkey bytes/evictions and exposure-write failures. Exposure logging drops writes after 1,000 pending operations and catches failures, so table rows alone cannot establish completeness. ([Logging bounds/failures](goodwatch-webapp/app/server/list-exposure.server.ts:44))

   **Rollback:** set `REC_G1_ORDER=off` across webapp instances and disable expanded triggers. New list compositions return to today’s ordering; refresh existing Watch next pages to discard retained G1 plans. Leave payloads to expire, or delete only G1 keys. Preserve the prior reader during migration, and budget temporary v1/v2 coexistence explicitly. Off-mode request gates and retained-plan behavior support this rollback. ([Discover gate](goodwatch-webapp/app/server/title-filter/index.server.ts:259), [Watch next gate](goodwatch-webapp/app/server/watch-next.server.ts:702), [retained plans](goodwatch-webapp/app/server/watch-next.server.ts:847))
## Adopted after review (orchestrator, October 15, 2026)

Fable accepted with fixes (REVIEW-fable.md). All eight fixes are adopted; they replace the matching parts above:

1. Rebuilds: the webapp adds the member to a Valkey set `g1:dirty`; a scheduled job every 3 minutes rebuilds the dirty set in one run with one shared read. No one-member jobs, priority jobs or resumable progress.
2. No revision key: the reader revalidates a member's payload at most every 45 seconds.
3. Payload: gzip of the existing JSON under a new key namespace `g1:v2`, decoded into typed arrays; `raw` is not retained. The binary layout is built only if measured size or decode time misses budget. The reader ships first.
4. Caches: count LRU of 50 prepared payloads; raise the Watch next plan cache before `on`; benchmark cold composition at the order cache's bound.
5. Eligibility: the job builds for every member whose taste vector exists and deletes the others' keys; one rollout variable (`f/sync/g1_members`: a list for the cohort, or "all") replaces the preview allowlist in trigger and job.
6. One run for all members, per-member try/except and summary lines; reruns are idempotent.
7. `missing-payload` fallbacks are not warned per request.
8. The 99% gate is measured on the cohort, then serves as the rollback trigger after `on`; check Valkey maxmemory and eviction policy before the backfill.
