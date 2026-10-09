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

## Roles on several hosts

Measured on October 9, 2026 for [Benchmark search roles on vector1 and the worker hosts behind one route](https://github.com/alp82/goodwatch-monorepo/issues/397). The first benchmark above ran on one 4-core host that also ran the load generator. This one puts the roles on the hosts they could run on.

### Setup

- **Roles:** the same image, one encoder with 2 threads each. Two on vector1 (16 cores, capped at 4 CPUs and 4 GB each, next to Qdrant and a live webapp instance), one on worker1, and one on worker2 (4 cores each, next to a Windmill worker).
- **Route:** a throwaway Traefik on the generator host with a health check on `/health/ready` every 2 seconds. A layout is its server list. The load generator sends searches only, no pages.
- **No title snapshot and no cache credentials:** the role starts without the snapshot, because the ranking doesn't read it.
- **Probe:** once per second a health request to Qdrant and to the public site. Three answers in a row slower than 1 second would have stopped the run. It never did.
- **Runs:** 60 seconds, three per cell. 79 runs in all.

Summaries and the per-host CPU and memory samples are in `search-role/results-hosts/`.

### Capacity

"Ranked" is searches per second that end ranked within the 1,500 ms deadline. "p95" is the p95 of the ranked searches. The rest of the searches sent get the busy answer.

| Roles | Sent per second | Limit 4: ranked | Limit 4: p95 | Limit 8: ranked | Limit 8: p95 |
| --- | --- | --- | --- | --- | --- |
| vector1 | 10 | 7.9 | 837 ms | 9.0 | 1,220 ms |
| vector1 twice | 10 | 9.9 | 624 ms | 10.0 | 682 ms |
| vector1 and worker1 | 10 | 10.0 | 574 ms | 10.0 | 647 ms |
| vector1, worker1, worker2 | 10 | 10.0 | 549 ms | 10.0 | 562 ms |
| vector1 | 20 | 9.1 | 890 ms | 10.2 | 1,313 ms |
| vector1 twice | 20 | 15.8 | 806 ms | 18.3 | 1,166 ms |
| vector1 and worker1 | 20 | 16.6 | 780 ms | 19.0 | 975 ms |
| vector1, worker1, worker2 | 20 | 19.3 | 668 ms | 19.9 | 756 ms |
| vector1 | 40 | 9.3 | 850 ms | 10.2 | 1,368 ms |
| vector1 twice | 40 | 16.8 | 922 ms | 18.4 | 1,430 ms |
| vector1 and worker1 | 40 | 18.6 | 798 ms | 21.6 | 1,298 ms |
| vector1, worker1, worker2 | 40 | 25.9 | 782 ms | 29.2 | 1,244 ms |
| vector1, worker1, worker2 | 80 | | | 29.4 | 1,127 ms (all searches) |

- **One role ranks about 9 searches per second with the limit at 4,** and each further role adds 8 to 9. A 4-core worker does as well as a capped role on vector1.
- **The limit of 8 buys 10% to 15% more ranked searches per role and costs 400 to 500 ms of p95.** An overloaded role then answers close to the deadline, and basic-result fallbacks rise from at most 10 to at most 56 per cell of 7,200 searches.
- **Overload is graceful at every rate.** At 80 per second on three hosts, 27 to 31 searches per second end ranked, about 60% get the busy answer, and 13 to 41 of 4,800 per run end as basic results. The stall at 40 per second in the first benchmark doesn't appear, so it belonged to that host.
- **The target of 20 per second:** three roles reach 19.3 (limit 4) or 19.9 (limit 8). Two roles reach 15.8 to 16.6 (limit 4) or 18.3 to 19.0 (limit 8).

### CPU and memory per role

From each role's cgroup, sampled every 5 seconds, median of three runs.

| State | CPU | Peak memory |
| --- | --- | --- |
| Shared load, about 3.3 ranked per second per role | 0.9 to 1.0 cores | 2.0 to 2.9 GB |
| Shared load, about 6.5 per second per role | 1.7 to 1.8 cores | 2.0 to 3.0 GB |
| Full, limit 4 (about 9 per second) | 2.2 to 2.6 cores | 2.1 to 2.3 GB |
| Full, limit 8 (about 10 per second) | 2.6 to 3.0 cores | 2.0 to 3.1 GB |

A role never needed its 4 CPU cap. That's about 250 ms of CPU per ranked search, in line with the first benchmark.

### One role killed mid-run

vector1 and worker1 at 10 searches per second, limit 8. The role on worker1 was killed about 25 seconds in.

- 9 of 601 searches failed, all within one second around the kill: seven 502 answers from the balancer and two connection errors.
- After that the balancer sent every search to vector1. In the rest of the run 271 searches ended ranked, 30 got the busy answer, and 4 ended as basic results.
- So the browser needs to treat a bare 502 on the search path like the busy answer, and the health check interval bounds how long that lasts.

### vector1 during the runs

- Qdrant's slowest probe answer was 0.75 seconds, once, with three hosts at 40 per second and the limit at 8. Otherwise it stayed under 0.2 seconds.
- The public site had single slow probe answers of 1.2 to 3.0 seconds, never three in a row. The same single slow answers appeared before any load, as TCP connect time from the generator host, so they aren't caused by the runs. They're worth their own look.
- `./bench.sh smoke --host vector1` passed after each phase.
- The roles on vector1 reached Qdrant through one firewall rule that the owner asked for and keeps: Qdrant's HTTP port from the measurement network, with the comment "gw-bench: search role measurement network to local Qdrant HTTP".

### Not verified

- **One row appeared in `search_history` during the runs** (1,262 before, 1,263 after, written at 06:04 UTC with the outcome "cached"). The other two search tables didn't change. The roles logged about 43,000 searches with the write switch on and would have written thousands of rows without it, so this row is most likely one real search in production. That's an inference: production doesn't log searches, so it couldn't be confirmed.
- More than 4 CPUs per role, and a limit between 4 and 8.
- A role deployed by Coolify behind the live proxy, the member path, and the paid reading call under load.
- Page instances weren't part of this benchmark. The first one covers them.
