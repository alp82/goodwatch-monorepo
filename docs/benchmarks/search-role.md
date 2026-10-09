# Search role benchmark

Measured on October 8, 2026 for [Benchmark the search role behind the webapp's route and behind the proxy](https://github.com/alp82/goodwatch-monorepo/issues/390). It feeds [Decide whether search becomes its own service](https://github.com/alp82/goodwatch-monorepo/issues/251).

The build under test is branch `bench/search-role`. It isn't meant to merge: it holds measurement switches next to the role setting.

## Summary

- **Pages stay protected in both variants.** With search in its own process, the warm page p95 stays between 67 and 92 ms up to 20 searches per second (64 ms without searches).
- **The two variants serve searches equally well.** The webapp-in-front variant costs the page role about 10 ms of main-thread time per search and 7 to 18 ms of warm page p95.
- **Today's encoder setting is the worst one on 4 cores.** One encoder with 4 threads holds about 5 ranked searches per second. With 2 threads, or with 4 threads and spinning off, the same process holds 10.
- **The in-flight limit makes overload graceful.** With the limit at 4, overflow gets a fast busy answer. With the limit at 64, most searches at 20 per second miss the deadline and end as basic results.
- **When the search role is down,** pages are unaffected. Behind the webapp's route a search gets the busy answer after the 2-second timeout. Behind the proxy the request fails at the connection, and a proxy fallback rule wasn't built.
- **40 searches per second wasn't measurable on this host.** See [What isn't usable](#what-isnt-usable).

## Setup

- **Host:** the generator host, 4 vCPUs (Skylake at 2.0 GHz) and 7.6 GB. The load generator (k6 in Docker) and an idle Windmill worker run on the same host, so every number includes their CPU use.
- **Containers:** one page role and one search role from the same image, and a throwaway single-node Valkey cluster. Production Crate and Qdrant are read only.
- **No writes, no paid call:** the search role serves recorded readings for the test queries and skips the search store and the history row (`GW_BENCH_NO_WRITES`). The row counts of `search_history`, `search_interpretations`, and `search_spending` were identical before and after the warm-up.
- **Queries:** 140 of the search arena's 168 queries, the ones that end ranked. The other 28 have no recorded reading.
- **Page mix:** 2 warm title pages and 2 title page misses per second, as in the search footprint measurement. The page role runs with `PAGE_CACHE=off`, so a warm page is rendered on every request.
- **Runs:** 60 seconds, open model. Variant cells are the median of three runs, encoder cells of two.
- **Variant 1, proxy in front:** the load generator sends searches and palette lookups straight to the search role.
- **Variant 2, webapp in front:** it sends them to the page role, which verifies the session and calls `POST /internal/search` or `GET /internal/command-palette` on the search role with a shared key.

Scripts are in `search-role/scripts/`, and the per-run summaries in `search-role/results/`. The load generator's per-request logs aren't in the repository.

## Variants

One encoder with 4 threads. Times in milliseconds. "Ranked in time" is the share of all searches sent that end ranked within the 1,500 ms deadline.

| Searches per second | In-flight limit | Variant | Warm page p95 | Miss page p95 | Search p50 | Search p95 | Ranked in time | Busy | Page role main thread | Host busy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | | | 64 | 233 | | | | | 18% | 13% |
| 5 | 4 | 1 | 74 | 211 | 232 | 750 | 97% | 3% | 15% | 66% |
| 5 | 4 | 2 | 81 | 211 | 248 | 786 | 95% | 4% | 20% | 69% |
| 20 | 4 | 1 | 74 | 223 | 69 | 890 | 36% | 64% | 14% | 94% |
| 20 | 4 | 2 | 92 | 235 | 85 | 892 | 35% | 65% | 24% | 95% |
| 5 | 64 | 1 | 77 | 219 | 235 | 976 | 99% | 0% | 16% | 68% |
| 5 | 64 | 2 | 81 | 218 | 252 | 990 | 98% | 0% | 19% | 70% |
| 20 | 64 | 1 | 76 | 230 | 688 | 2,569 | 6% | 0% | 13% | 99% |
| 20 | 64 | 2 | 91 | 259 | 750 | 2,532 | 4% | 1% | 23% | 100% |

- At 20 per second with the limit at 4, about 7 searches per second end ranked in time and 13 get the busy answer. The low search p50 is the busy answer.
- At 20 per second with the limit at 64, about 1,100 of 1,200 searches per run end as basic results, because the encoder queue is full or the ranking misses its deadline.
- No page request failed in any of these runs.

### Cost of the webapp's route in variant 2

Searches without pages, 5 per second for 60 seconds, one run each:

| Variant | Page role main thread | Search role main thread |
| --- | --- | --- |
| 1 | 0.3 s | 19.7 s |
| 2 | 3.3 s | 17.7 s |

That's about 10 ms of page role main-thread time per search in variant 2: the session check, the call, and passing the response through.

### Command palette

20 lookups per second next to the page mix, one run each:

| Variant | Palette p50 | Palette p95 | Warm page p95 | Page role main thread |
| --- | --- | --- | --- | --- |
| 1 | 5 | 36 | 66 | 16% |
| 2 | 13 | 58 | 72 | 28% |

Variant 2 costs the page role about 6 ms of main-thread time per lookup. The load generator's prefixes repeat, so most lookups come from the 6-hour cache.

## Encoder settings

Variant 1, in-flight limit 64, next to the page mix.

| Encoder setting | Searches per second | Ranked in time | Search p50 | Search p95 | Encoder CPU per search | Search role main thread | Peak memory | Host busy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 encoder, 4 threads (today) | 5 | 98% | 240 | 966 | 377 ms | 28% | 2.8 GB | 69% |
| 1 encoder, 4 threads (today) | 10 | 21% | 1,741 | 2,600 | 314 ms | 41% | 2.8 GB | 99% |
| 1 encoder, 4 threads, no spinning | 5 | 100% | 231 | 560 | 196 ms | 30% | 2.9 GB | 48% |
| 1 encoder, 4 threads, no spinning | 10 | 97% | 536 | 1,298 | 185 ms | 53% | 2.9 GB | 78% |
| 1 encoder, 2 threads | 5 | 100% | 225 | 609 | 193 ms | 31% | 2.9 GB | 50% |
| 1 encoder, 2 threads | 10 | 100% | 379 | 1,106 | 170 ms | 51% | 2.8 GB | 72% |
| 1 encoder, 2 threads, no spinning | 5 | 100% | 236 | 590 | 169 ms | 30% | 2.8 GB | 44% |
| 1 encoder, 2 threads, no spinning | 10 | 97% | 727 | 1,285 | 164 ms | 52% | 2.8 GB | 72% |
| 2 encoders, 1 thread each | 5 | 100% | 237 | 715 | 140 ms | 30% | 4.6 GB | 40% |
| 2 encoders, 1 thread each | 10 | 98% | 371 | 981 | 139 ms | 54% | 4.6 GB | 68% |
| 2 encoders, 2 threads each | 5 | 100% | 209 | 570 | 221 ms | 30% | 4.6 GB | 50% |
| 2 encoders, 2 threads each | 10 | 98% | 327 | 1,011 | 214 ms | 47% | 4.6 GB | 80% |

- Each further encoder holds its own copy of both models: 1.7 GB more peak memory for the second one.
- Two single-thread encoders use the least CPU per search and have the best p95 at 10 per second, for 1.7 GB.
- One encoder with 2 threads is the cheapest setting that holds 10 per second.
- At 10 per second the search role's main thread is 47% to 54% busy in every setting that holds the rate. By that number, one process tops out near 18 to 20 searches per second whatever the encoder does (extrapolated, not measured).
- Warm page p95 is 67 to 83 ms in every cell.

## Search role stopped mid-run

5 searches and 5 palette lookups per second next to the page mix, in-flight limit 4. The search role is killed 20 seconds into the run and stays down. One run per variant.

| | Variant 1 | Variant 2 |
| --- | --- | --- |
| Warm page p95 | 89 | 91 |
| Miss page p95 | 220 | 243 |
| Failed page requests | 0 | 0 |
| Search after the kill | Connection error | Busy answer (503) after 2,006 ms |
| Palette after the kill | Connection error | Answered from TMDB, p50 650 ms |

- In variant 1 a proxy would sit where the load generator's connection failed. What a person gets depends on the proxy's rule for a dead backend. No such rule was built or tested.
- In variant 2 every search waits for `SEARCH_ROLE_TIMEOUT_MS` (2,000 ms) before the busy answer, because a killed container's address doesn't refuse the connection. The palette waits for its 500 ms timeout and then asks TMDB.

## What isn't usable

The runs at 40 searches per second (`*-s40-*` in the results) say nothing about either variant. Pages and searches timed out in both, and a 60-second run took up to 173 seconds. The page role's event loop stalled for 14 to 16 seconds while its main thread used under 20% of a core.

Checked and not the cause: swap (the host has none), out-of-memory kills, container CPU throttling, the connection tracking table, hypervisor steal time, and the throwaway Valkey (no evictions, slowest command 26 ms). The cause is open. The host is too small for that rate with the load generator on it.

## Load on production during the measurement

- The snapshot copy read 75 keys (74.5 MB) from the production cache with `SCAN` and `GET`.
- Every title page miss and every ranked search read production Crate and Qdrant.
- A search that ends as basic results sends two full-text statements to Crate. At 20 per second with the limit at 64 that was about 37 statements per second for a minute, six times between 19:05 and 19:25 UTC. Whether production noticed wasn't checked.

## Not verified

- More than 4 cores, a host without the load generator on it, and two search roles behind one route.
- Any encoder setting above 10 searches per second.
- A proxy in front of the search role, including its answer when the search role is down.
- The member path: a session, member taste, and the cookies in variant 2.
- The paid reading call under load. Readings were recorded.
- The first full encoder phase was stopped after one run, which is in the results as the first `enc1x2-lim64-v1-s05` run.
