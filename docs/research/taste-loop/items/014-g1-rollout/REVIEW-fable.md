# Review of the G1 rollout plan (014)

Reviewer: Fable. Read-only against `.claude/worktrees/g1-order` at origin/main (`d3867c10`). No production queries.

## Verdict: accept with fixes

The plan reads the code correctly: every `file:line` citation I checked points at the construct it names (a few are off by one or two lines, none misleading; see the citation table at the end). The staged sequence (offline, cohort in shadow then preview, backfill, `on`) and the rollback (`REC_G1_ORDER=off`, existing fail-closed gates, retained plans expiring) are sound.

What needs fixing is in two places. First, the plan under-weights the one path that actually breaks at 170 members: every interaction enqueues a full job that re-reads all member tables and the whole reference pool. Second, several of the webapp and job proposals carry more machinery than ~170 members justify (revision key under hash tags with race retry, byte-budget LRU, resumable batches, dual readers), while the cheap fix that makes most of them unnecessary (stop re-fetching on every request) is not named.

## Fixes, in priority order

### 1. Interaction rebuilds do not scale as designed (must fix before the cohort stage)

`markG1Changed` is called from seven write paths: ratings (`goodwatch-webapp/app/server/scores.server.ts:85`), skips (`skipped.server.ts:64`), wishlist (`wishList.server.ts:69`), not-interested (`not-interested.server.ts:52,61`, `not-interested-store.server.ts:31`) and the taste member write (`taste/member.server.ts:196`). Each one, after a 1.5 s process-local debounce, POSTs a Windmill run for one member (`g1/rebuild.server.ts:34`, `member_ids: [member]`). Every such run executes `read_members` over all four tables for all members and `read_titles` over the full pool (`goodwatch-flows/windmill/f/sync/copy/g1_order.py:585-586`) before ~1 s of per-member compute, under `concurrent_limit: 1` (`g1_order.script.yaml:4`). The plan's own figure is 6.19 s of array construction alone; Crate paging (37 pool pages plus member pages) was never measured.

At 170 members, interaction volume turns this into a serial queue of full reloads: N interactions per hour cost N × (reads + 6 s) of a single worker, and the "within five minutes" freshness target fails as soon as the queue is deeper than a handful. "Short priority jobs" (plan §3) do not exist as a Windmill primitive at script level without a second script, and "durable deduplication across instances" is extra state for a problem that a batching design removes.

Simpler and robust: the webapp marks the member dirty in Valkey (`SADD g1:dirty <member>`, one round trip, no Windmill token in the request path, cross-instance for free) and a scheduled job every 2 to 5 minutes does `SPOP`/`SMEMBERS` and rebuilds the dirty members in one run with one shared read. Nightly/snapshot runs rebuild everyone the same way. This replaces the webapp debounce, the per-member POST, priority jobs, resumable progress and dedup with one set and one schedule. Keep `enqueueG1` only as a manual tool if at all.

### 2. Stop fetching the full payload on every warm request; do not add a revision key

The reader does a Valkey `GET` of the whole value on every request and compares `cached.raw === raw` (`g1/reader.server.ts:117-131`), retaining the raw string per cached member. This is the actual per-request cost (3.2 MB today, 735 KB after compaction) and the reason the plan proposes an atomic revision key under a `{member}` hash tag with header validation, a race retry and dual-key deletion (§4).

That is over-engineered for this product. The freshness target is five minutes; a payload becoming visible 30 to 60 s after publish is invisible to users. Replace the per-request GET with a revalidation interval (fetch only when `now > lastChecked + 30–60 s`, otherwise serve the cached prepared payload) and drop `raw` from the cache. No second key, no hash-tag coupling, no race window, one `DEL` on removal. If a cheap change check is still wanted later, store the value as one hash (`HSET g1:v2:<m> rev <n> body <bytes>` in a single command) and read `HGET rev` first: same slot by construction, atomic, one TTL.

### 3. Compaction: get the memory win without a new wire format first

The 3.2 MB JSON is the right target, but two independent things are conflated in §1 and §4:

- In-process memory: `decode` keeps the parsed JS arrays (`reader.server.ts:48`) and the cache keeps `raw` (`:113`). Converting to typed arrays at decode (`Float32Array.from(p.b3Rank)`, `Uint8Array` for the three boolean columns, `Uint32Array` for `movieSeriesId`) and dropping `raw` (fix 2) cuts per-member webapp memory by roughly 5x with no format change and no parity work.
- Valkey bytes and transfer: `zlib`/gzip of the current JSON (stdlib in both Python and Node) typically lands within 1.5x of the proposed binary layout, keeps `format: 1` semantics exactly (no dense franchise relabeling, no float32 round-trip rules, no new fixtures), and is ~20 lines. Measure that first. Adopt the binary layout only if the measured size or decode time still misses a stated budget. If the binary layout is built anyway, the row-based design is fine; note that `decode` must then also check `row < snapshot.count` and strictly increasing rows, and the plan's "derive show from the row" matches `factsAt` (`title-snapshot/snapshot.server.ts:253-256`).

Either way, use a new key namespace (`g1:v2:<member>`) and deploy the reader before the job switches. The old reader sees `missing-payload` or `malformed-shape` and falls back; there is no need for "preserving the prior reader" or a budgeted "v1/v2 coexistence" (§5).

### 4. Cache bounds: size by count, raise the two caps that bite first

- `createG1Reader` cache: with fix 2 an entry is the typed payload plus the `Int32Array(snapshot.count)` map (`reader.server.ts:86`), near-uniform per member. A count LRU of ~40 to 60 with the existing 10-minute expiry is equivalent to the proposed 64 MiB byte budget and simpler; keep the byte accounting only as a logged metric.
- Order cache: `maxTitles = 200_000` (`reader.server.ts:221`) is the binding bound at scale, not `maxEntries = 40`. A Discover Best match result over the catalog is tens of thousands of keys, so the cache holds a handful of compositions in total and every other member's page request recomposes (two sorts over ~60k plus the mix). The result object stores two `Map`s per title (`:206-214`), which is why the budget is small. Benchmark cold composition as §4 already says; if it is more than a few tens of ms, store `titles`/`ranks` as typed arrays indexed by payload position and raise `maxTitles` accordingly.
- Watch next plans: `maxEntries = 40` (`watch-next-plans.server.ts:7`) across all members. Under `on`, a cards request whose plan was evicted returns `refreshRequired` (`watch-next.server.ts:846-847`), so 40 plans shared by 170 members in a 10-minute window produces visible full-page refreshes during normal paging. Wishlists are small; raise `maxEntries` to the low hundreds before `on`, with `maxTitles` as the real guard. Also confirm the webapp runs as one instance or with sticky routing: plans and the G1 caches are process-local, and a second instance turns every cards request into a refresh.

### 5. Eligibility: reuse the job's own taste rule; discover members in the job

`taste_vector` in the job already encodes the webapp's rule (`MIN_LIKED = 5` liked with usable fingerprints, nonzero norm; `g1_order.py:263-269` vs `taste/formula.server.ts:28,122`). Eligibility for "all" should simply be: build for every member id `read_members` returns (`g1_order.py:505-506`) whose `taste_vector` is not `None`; skip the rest and delete their key if present. No separate SQL threshold, no parallel rule. `validate_members` and the `main()` allowlist (`g1_order.py:567-572, 613-616`) reject `"all"` today, so the rollout policy variable (`cohort` list or `all`) replaces both `f/sync/g1_preview_members` reads (`g1_trigger.py:12-29`, `g1_order.py:612-616`) in one change, as §3 says.

### 6. Drop resumable batches and batch-of-10 jobs

One run for all members shares one read; 17 batches of 10 means 17 full Crate reloads. With ~1 s/member and a 30-minute timeout (`g1_order.script.yaml:32`) a single run has 10x headroom. Per-member `try/except` with a per-member line in the summary (timing, bytes, error) is all the failure isolation needed; a failed run is simply rerun, since each key write is idempotent. Keep the mid-build snapshot-change abort (`g1_order.py:593-595`); it fires at most once a night.

### 7. Logging under `on`

`logG1` emits `console.warn` on every fallback (`reader.server.ts:322-327`). Under `on`, every ineligible member's Best match request and every request during a snapshot transition warns, on every page. Rate-limit per member/reason or lower `missing-payload` to info; the exposure row already carries `g1_fallback_reason` (`list-exposure.server.ts:73`).

### 8. Gates and the final stage

The "≥99% G1 success" gate cannot be observed for the whole population before `on`, since shadow is allowlist-only (`utils/features.ts:24`). State that the gate is measured on the cohort before `on` and on everyone in the first 48 hours after, as the rollback trigger. Also add one operational check before backfill: Valkey `maxmemory`/eviction policy versus 170 payloads plus the title snapshot chunks, so G1 keys cannot evict the snapshot (or vice versa) under `allkeys-*` policies.

## Things the plan gets right (keep)

- Snapshot binding, 36 h reader max age / 48 h TTL, immediate invalidation on snapshot change, nightly and no-change triggers (`title_snapshot.py:666-668`).
- Truncation as a separate, deferred quality experiment: it is a model change (B5 top-half is a global median, `g1_order.py:415`), and 125 MB (or compressed JSON) does not force it.
- Rollback via `off`: Discover gate at `title-filter/index.server.ts:257-262`, Watch next gate at `watch-next.server.ts:702-709`, retained plans fail closed at `:846-847`. Note the env change needs a container restart in Coolify, which also clears process caches.
- Keep B5 leave-one-member-out as is; no global fit without parity.

## Citation check

| Plan citation | Found at | Note |
|---|---|---|
| snapshot.server.ts:54, :253 | 54 `TitleColumns`, 253 `factsAt` | ok |
| snapshot.server.ts:222 | 223 `rowOf` | off by one |
| format.server.ts:5 | layout comment | ok |
| order.ts:71, :63 | 71 groups, 63 `requestOrder` | ok |
| g1_order.py:402, :412, :579, :585, :588, :593, :605, :234, :297, :136, :109, :57, :316 | as named | :374 is inside `build_view` (starts 365); :316 is `PAGE_SIZE`, TTL at 317 |
| reader.server.ts:54, :105, :45, :178, :218 | as named | ok |
| features.ts:19 | 19-25 | ok |
| index.server.ts:257, :259, :268 | 257 gate, 259 flag, 270-273 prefixes | ok |
| order.server.ts:109 | `sortToUse` | ok |
| watch-next.server.ts:238, :297, :368, :408, :702, :843, :847 | 238, 298, 368, 408, 703, 843, 846 | ok |
| formula.server.ts:95 | loop at 96; `MIN_LIKED` check at 122 | cite 122 for the threshold |
| g1_trigger.py:12; g1_order.script.yaml:4; rebuild.server.ts:43; scores.server.ts:85 | as named | ok |
| title_snapshot.py:664 | 666 | off by two |
| list-exposure.server.ts:44, :51 | 45, 51; `MAX_PENDING` at 12, `EXPOSURE_TITLES` at 10 | ok |
| watch-next-plans.server.ts:3 | 3-8 | ok |
| g1_pack_parity.py:98; order.test.ts:26 | as named | ok |
| g1-order-stage1.md:102; stage2.md:111 | as named | ok |
