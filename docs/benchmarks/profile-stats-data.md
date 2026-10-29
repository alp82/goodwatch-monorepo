# Profile Stats data time

Ticket 12 of [#784](https://github.com/alp82/goodwatch-monorepo/issues/784) reduces Stats catalog reads and removes full portrait work from the public Stats path. The local benchmark meets the 300 ms cold and 50 ms warm data targets. Production timing remains unverified until the owner deploys the change.

## Measurement setup

The baseline is `39172781b`, which includes the per-read timing instrumentation from `93cbb413d`. Both production builds run on loopback with an empty inherited environment, empty external keys, an egress guard, and page caching disabled. CrateDB 5.10.12 and Valkey 8 are disposable local instances.

The synthetic member has 1,000 scores: 700 movies and 300 shows. The catalog contains another 100 unscored movies. Public metadata and title analyses come from the local bench catalog, repeated under synthetic IDs. Credits and trope arrays are synthetic. No member data comes from production or from the source bench. The separate title snapshot contains all 1,100 synthetic titles.

[The benchmark instructions](../../goodwatch-benchmark/stats/README.md) describe the fixture, commands, and assertions. The raw artifacts remain under `~/.cache/gw-perf/scratch-stats/`.

## Why the reads cost time

The baseline performs 12 catalog statements per Stats computation in this fixture. The changed implementation performs eight. The process-wide catalog concurrency limit stays at four. Larger batches remove round trips without increasing the number of active database requests.

- Details use the movie or show's `tmdb_id` primary key. The optimized literal plan uses Get, bounded by the number of requested titles. The baseline splits 700 movies into two batches of 400 and 300. The new limit of 4,000 covers the module's existing maximum title count in one batch per media type.
- Tropes use another primary-key read, but transfer every loved title's full array. The fixture returns about 902 KB for 300 loved titles. The new query unnests unique labels and counts them in SQL, returning about 4.3 KB in 240 aggregate rows. Counts from movies and shows are combined before applying the existing JavaScript sorting and top-28 selection. This preserves ties and labels that occur across both media types.
- Credits use secondary-index IN scans. The primary key includes media ID, media type, person ID, and credit ID, so filtering by media IDs alone cannot use a complete primary-key lookup. The baseline plan collects and fetches individual rows, then applies `LIMIT 20000` per batch. That limit bounds returned rows, not index work, and can silently truncate a large credit set.
- The new credit queries group by person and role and collect distinct title IDs on the catalog node. They return 1,000 aggregate rows instead of 10,800 individual credit rows for this member. Duplicate Writer and Screenplay credits still count as one title per person and role. Credits for unscored titles are skipped because the people rankings never use them. The cast result limit follows the eight billing positions per scored title. Crew and trope vocabulary guards reject a saturated result instead of publishing truncated statistics.
- People use primary-key name and photo reads. The fixture's 450 eligible people now fit in one request instead of two sequential batches.

Across the complete Stats computation, catalog responses shrink from approximately 1.22 MB to 229 KB. Row counts fall from 12,550 to 2,690. No schema or secondary index changes are required.

Crate's parameterized EXPLAIN retains placeholders and can report Collect where a literal primary-key plan uses Get. The benchmark therefore saves plans with synthetic constants as well as timings from the actual parameterized reads. Generic EXPLAIN output alone is not evidence that title or person reads scan the table.

## Portrait summaries

Stats and member comparisons use a separate owner summary cache. A warm lookup happens before reading the member's viewer context. Fingerprint and everyone summaries do not load a taste vector. Summaries skip card-service reads, service-list reads, personal-order reads, More of this ranking, and display reads for discarded suggestions and defining titles.

Sides retain their edge-selection calculation and taste vector. The agreement card can select a title from an edge's rated titles, so removing edges would change the existing page. The summary strips suggestions after preserving that dependency. Full `/taste` portraits and share-card portrait callers keep their full portrait path.

The Stats cache applies the existing `statsPayload` projection before storage. It retains both director rankings and the alternative decade order needed when a viewer cannot see scores. It removes unused people previews. Owner statistics still pass through `statsForViewer` on every request.

## Refresh and visibility rules

The summary namespace is `profile-summary:v2`. Each entry contains its read start time and a compressed payload. Gzip reduces Redis transfer and the memory cost of retaining stale summaries without changing the decoded model.

Entries stay fresh for ten minutes and remain available for seven days after a successful build. `taste:touched` makes an entry stale, including the existing 1.5-second write-settling interval, but does not delete it. A visitor gets the last value while one computation per owner and summary runs in the process. A failed refresh retains the last successful value. A Lua ordering guard prevents a computation that started earlier from replacing a later one across processes.

The existing delayed activity task also refreshes Stats and all three public portrait summaries after a rating or other taste change. It coalesces writes and starts another computation after any older in-flight computation ends. Each portrait reads its context when that computation starts, so a queued refresh cannot publish an old context with a new timestamp. Reads within the settling interval cannot mark an entry fresh. A first visit, an expired or evicted entry, or a cache outage can still require a cold computation. Separate serving processes can each run one refresh; the single-flight map is process-local.

Every route still resolves current profile visibility before requesting data. Every summary response applies the viewer's current score and other part permissions after the cache read. The cache contains no visitor state, service list, or recommendations. Member HTML remains private and is never shared. See [cache identity](../cache-identity.md).

This summary cache intentionally permits stale statistical data after taste activity. It does not change the reset guarantees for the generic data cache in [ADR 0006](../adr/0006-reset-markers-for-the-data-cache.md), profile settings, or profile visibility.

## Full-page timing results

The following values come from the final local production-build probe on October 29, 2026. Cold means an empty app cache with the title snapshot ready; the database and operating-system caches are already warm. Each cold column is one request, followed by five warm requests. These are fixture results, not production estimates. Overlapping read timings are not additive; details and tropes also accumulate across media types.

| Server-Timing entry | Base cold (ms) | Candidate cold (ms) |
| --- | ---: | ---: |
| `stats_details` | 20.0 | 15.8 |
| `stats_tropes` | 116.3 | 54.8 |
| `stats_credits` | 66.0 | 9.9 |
| `stats_people` | 6.2 | 3.1 |
| `portrait_fingerprint` | 82.0 | 88.2 |
| `portrait_sides` | 100.1 | 94.8 |
| `portrait_everyone` | 79.6 | 81.2 |
| `data` | 130.4 | 122.8 |

Warm `data` time is 6.1–7.1 ms on the base and 3.6–4.3 ms on the candidate. The first request after `taste:touched` takes 13.2 ms and uses all four retained summary values.

The three portrait values occupy 179,181 bytes in the original cache and 34,073 bytes in the compressed summary cache. The full-page fixture's compacted, compressed Stats entry occupies 19,567 bytes. The isolated Stats adapter benchmark decodes 135,869 bytes on a base hit versus 93,475 after projection; compression further reduces Redis transfer. On loopback, compression adds a small decoding cost to an isolated Stats hit, while removing member-context reads makes the full page faster.

## Validation

The profile and portrait test command passes all 141 tests. The real Redis benchmark verifies that an older writer cannot replace a newer one and that visitors return while a stale refresh is held. The unchanged base fails the held-refresh check. All 16 combinations of score, seen, shows, and hours visibility produce the same before and after Stats payloads, including cold and warm cache paths.

The repository HTML equivalence gate passes 2,385 documents with zero differences, including Stats for browser, Googlebot, and Bingbot clients. A separate check with all 1,000 scores represented in the snapshot confirms identical rendered Stats markup and parsed loader values. Object property order in the serialized loader can differ because SQL results are unordered.

The production build succeeds. TypeScript produces the same existing diagnostics as the base, with no added diagnostics. The full-suite run during this change reported 5,843 passes, 12 failures, and eight skipped tests. Ten failures reproduce in the unchanged base when rerun directly. The other two are unrelated performance-budget tests that pass in the isolated base run and failed during the concurrent full-suite run. No browser scripts, styles, fonts, images, or landing-surface imports change.

No production requests or production data access were used. After deployment, the owner can compare a few public GET responses for `/u/alperortac/stats`, including cold, warm, and the first visitor after a rating. Keep requests sequential and inspect the existing duration-only Server-Timing entries. Member-comparison latency and real production cache latency remain to be measured; local guest results do not establish those production budgets.
