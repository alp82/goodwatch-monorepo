# Slow queries on uncached paths

Measured on 2026-10-04 (00:42 to 01:10 UTC) for [Find slow queries on uncached paths](https://github.com/alp82/goodwatch-monorepo/issues/247), a child of [Serve a viral traffic spike](https://github.com/alp82/goodwatch-monorepo/issues/237). Every number comes from production. No production code or data changed.

## How to read this document

- **Verified** means a metric, a log line, a database statistic, or a timed request shows it, and the source line explains it.
- **Inference** means reasoning from measured numbers. The text says so each time.
- **Estimate** marks every expected gain. No fix was applied, so no gain was measured.
- "In-process" times come from the webapp's own histograms. They leave out the proxy, TLS, and the network. "From worker3" times are single `curl` requests over the private path. Each one includes a new TLS connection, which took 41 ms in four of four checks.
- Source paths are relative to `goodwatch-webapp/` at `origin/main` commit `dba07e44`.
- The target that sets the bar: 500 anonymous requests per second for one hour, p95 under 300 ms for the full response on cached pages.

## Answer

No single slow query explains the slow pages. The databases answer fast: Crate runs the title details statement in 67 ms at p50 and 116 ms at p95, Qdrant answers 95% of recommend calls within 100 ms, and Redis commands take 30 to 40 microseconds. The cost sits in three other places:

1. **The Node process is the bottleneck, and it's already 72% busy.** One thread serves every request. At today's 47 requests per second, of which about 9 per second render a page, the main thread used 43.3 of 60 seconds. That leaves room for about 4 more page renders per second before requests queue (inference). Every minute, the longest event-loop stall is 104 to 319 ms.
2. **The data cache barely helps under a long-tail crawl, and it has no protection against a stampede.** 98% of title details lookups, 97% of availability lookups, and 78% of person and related-title lookups miss. A miss on a movie page costs 247 ms at p50 and 918 ms at p95 for the full response. At 500 requests per second on one cold URL, about 85 identical misses start before the first one finishes (inference from the 170 ms p50 time to headers).
3. **Two thirds of all requests are a crawler loop that never ends.** A scraper behind rotating residential addresses requests filtered person pages, gets redirected to `/browser-check`, and never keeps the cookie. Each loop is two requests on two new TLS connections. The proxy burns more than one core on it.

Two cheap findings stand out: every cache write also sends an `INFO` command to Redis, which is the most expensive Redis command by total CPU time on all three nodes, and share list pages run five to six uncached Crate statements per view.

## Method

| Source | What it gave | Volume |
| --- | --- | --- |
| Webapp metrics on port `9464`, read on abio | Request duration, time to headers, cache outcomes, and miss durations, as deltas between snapshots | Three snapshots over 1,310 s, plus a 151 s pair |
| Crate `sys.jobs_log` on all three nodes | Statement shapes with count, average, p50, p95, and maximum | 30,000 statements covering about 21 minutes |
| `EXPLAIN ANALYZE` and plain runs of the title details statement | Sub-executions, result size, duration per title | 1 `EXPLAIN ANALYZE`, 15 plain runs, 10 member-data reads |
| Qdrant `/metrics` and `/telemetry` | Latency histograms per endpoint, as deltas | Two samples 1,111 s apart |
| Redis `SLOWLOG`, `INFO commandstats`, `INFO latencystats`, and a `SCAN` sample of 7,997 keys with `STRLEN` on one node | Command cost, slow commands, value sizes per prefix | Three nodes |
| Webapp container log | Per-minute event-loop stalls, startup load times, "cached (big)" warnings, the app's own slow-statement lines | 23 minutes (the container restarted at 00:41 UTC) |
| `/proc` per-thread CPU of the webapp process and the proxy | CPU split between the main thread and helper threads | One 60 s window |
| Single `curl` requests from worker3 over the private path | Cold and warm timings per surface | About 155 requests in total, one per second |
| Supabase auth endpoint, timed from abio without a session | The cost of one `getUser()` round trip | 12 requests on reused connections |
| A 20-second passive header summary between the proxy and the webapp, and three connection counts at the proxy | The crawler's user agents, address spread, and connection rate | Aggregates only. Nothing was stored. |
| Source at `origin/main` | The call graph behind each number | |

Limits that apply to every number:

- The container restarted about one minute before the first snapshot, so counters start there. Rates are stable across the three windows.
- The traffic is real and crawler-heavy. Title pages come from crawlers on long-tail URLs, so the cache miss ratios describe a crawl, not a viral spike on one URL.
- No member request arrived in 23 minutes. The `audience="member"` series is empty.

## What production looks like today

Rates over 1,310 seconds, all anonymous:

| Route | Status | Rate | Full response avg | p50 | p95 | p99 | Headers p50 | Headers p95 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/person/:personKey` | 3xx | 17.2/s | 11 ms | | | | | |
| `/browser-check` | 2xx | 16.5/s | 20 ms | | 84 ms | 175 ms | | |
| `/person/:personKey` | 2xx | 4.1/s | 215 ms | 155 ms | 734 ms | 1,448 ms | 78 ms | 213 ms |
| `/movie/:movieKey` | 2xx | 2.8/s | 332 ms | 247 ms | 918 ms | 1,799 ms | 170 ms | 385 ms |
| `/sign-up` | 2xx and 3xx | 2.4/s | 106 ms (2xx) | 55 ms | 413 ms | 909 ms | | |
| `/` | 2xx | 0.9/s | 32 ms | | 116 ms | 225 ms | | |
| `/api/e` | 2xx | 0.8/s | 470 ms | 423 ms | 898 ms | 998 ms | | |
| `/api/tonight`, `/api/search-config`, `/api/og-image-warm` | 2xx | 0.7/s each | 21, 30, and 3 ms | | | | | |
| `/show/:showKey` | 2xx | 0.4/s | 576 ms | 455 ms | 1,658 ms | 3,395 ms | 242 ms | 537 ms |
| `/api/related` | 2xx | 0.08/s | 759 ms | 760 ms | 1,814 ms | 1,963 ms | | |
| `/discover/:type?` | 2xx | 0.01/s | 313 ms | 238 ms | 812 ms | 962 ms | 107 ms | 350 ms |
| `/u/:handle/lists/:id` | 2xx | 9 requests | 190 ms | 138 ms | 775 ms | | 75 ms | 245 ms |
| `/og/:first/:second` | 2xx | 17 requests | 195 ms | 225 ms | 457 ms | | | |

Quantiles below 50 ms aren't meaningful: the lowest histogram bucket ends at 50 ms. Use the averages there.

Data cache, same window:

| Cache name | Lookups | Hit | Miss | Miss duration avg | p50 | p95 | p99 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `details-movie` | 2.8/s | 2% | 98% | 102 ms | 106 ms | 191 ms | 199 ms |
| `details-show` | 0.4/s | 8% | 92% | 119 ms | 129 ms | 198 ms | 275 ms |
| `availability-evidence-v1` | 3.2/s | 3% | 97% | 14 ms | | | 87 ms |
| `related-movie` | 3.2/s | 22% | 78% | 79 ms | 37 ms | 300 ms | 827 ms |
| `related-show` | 3.2/s | 22% | 78% | 57 ms | 36 ms | 207 ms | 569 ms |
| `person-profile-v2` | 3.6/s | 22% | 78% | 80 ms | 74 ms | 188 ms | 264 ms |
| `episode-grid` | 0.4/s | 16% | 84% | 18 ms | | | 95 ms |
| `person-fingerprint-baseline` | 2.8/s | 100% | | | | | |
| `user-settings` | 3.2/s | 99% | | | | | |

The `stale` result occurred once in 4,188 lookups. It can't occur in practice, because the Redis lifetime and the freshness check use the same number of minutes (`app/utils/cache.ts:160`, `:248`).

Process and hosts:

- **Webapp process:** 60.6 CPU seconds in 60 seconds. The main thread used 43.3 s (72%), libuv worker threads 10.0 s, and V8 worker threads 7.3 s. Memory: 2.6 GB resident, 300 to 580 MB heap.
- **Event loop:** the longest stall per minute was 104 to 319 ms in 22 of 23 minutes (median 150 ms), and 2,010 ms in the first minute after the start. The delay's p99 is 38 to 53 ms.
- **Proxy:** Traefik used 58 and 76 CPU seconds in two 60-second windows, so 97% to 127% of a core. It accepted 773 new TCP connections in 20 seconds (38.7 per second) against about 47 requests per second. Almost every request arrives on a new TLS connection.
- **Crate:** about 25 statements per second in total. 50 of 30,000 logged statements took 300 ms or longer, and 14 took 1 s or longer. `stats.enabled` is `true` with `jobs_log_size` 10,000 per node, so the log covers only about 21 minutes. `stats.jobs_log_persistent_filter` is `false`: **no persistent slow-query log exists**, and the 300 ms threshold in the ticket isn't configured.
- **Qdrant:** in the 1,111 s window, `Recommend` ran 1.18 times per second: 74.6% within 50 ms, 94.8% within 100 ms, and all within 500 ms. `Get` ran 4.81 times per second with 92.8% within 10 ms. The numbers of the Qdrant research hold.
- **Redis:** `GET` averages 30 to 44 microseconds, `SETEX` 36 to 39. The slow log (10 ms threshold) holds 41 to 67 entries per node over 22 days: `GET` of person profiles and related titles (10 to 30 ms), `SCAN ... title-snapshot:*` from the pipeline (10 to 28 ms), and `INFO` from the webapp.

## Ranked list

Ranked by impact during a spike: the cost of a cache miss on the primary scenario first, then dynamic requests per page view, then member paths, then the rest.

| # | Problem | Measured cost | Fix | Effort | Area |
| --- | --- | --- | --- | --- | --- |
| 1 | One Node thread renders every page | Main thread 72% busy at about 9 rendered pages per second. Stalls of 104 to 319 ms every minute | Page cache in front, more processes, less to render | Large | Backend |
| 2 | `cached()` has no lock and no stale serving | 98% miss on title details. About 85 identical misses per cold URL at 500 req/s (inference) | In-flight deduplication, a lock, stale-while-revalidate | Medium | Backend |
| 3 | Title page miss path | Movie: p50 247 ms, p95 918 ms. Show: p50 455 ms, p95 1,658 ms | Parallel evidence read, time budget for related titles, longer lifetime | Small | Backend |
| 4 | Full details cached and parsed, trimmed afterwards | Up to 1.03 MB per value. "cached (big)" warnings at 679 and 938 KB | Cache what the page reads | Medium | Backend |
| 5 | Share list page is uncached | 5 to 6 Crate statements per view. 75 to 105 ms to headers warm | Cache the reads, then the page | Small | Backend |
| 6 | OG image render on a miss | 250 to 470 ms cold, on the main thread. 390 to 706 KB each | Render in the child pool, store outside the process | Medium | Backend |
| 7 | `/api/related` | 16 per title view. avg 759 ms, p95 1,814 ms in production | Public caching, smaller request, see ticket for the panels | Small | Backend |
| 8 | `INFO` on every cache write | 3.45 million calls per node. The top Redis command by CPU time | Delete one line | Small | Backend |
| 9 | Backend calls without a real timeout | Redis: none. Crate: 10 s without abort. Supabase: none | Timeouts that cancel | Small | Backend |
| 10 | Supabase `getUser()` | 24 to 63 ms per call, twice per member page | Verify the token locally, once per request | Small | Backend |
| 11 | Member root loader | 5 uncached Crate statements per navigation. 12 to 62 ms each for the largest account | Cache with reset on write | Small | Backend |
| 12 | Crawler loop on filtered person pages | 33.7 of 47 req/s. 38.7 new TLS connections per second | One request instead of two, no crawlable filter links | Small | Both |
| 13 | Discover reads 40 title cards with 40 Redis commands | avg 313 ms, p95 812 ms | One pipelined read | Small | Backend |
| 14 | Cold process after every deploy | 12.4 s search index load. 2,010 ms stall | Covered by other tickets | | |

### 1. One Node thread renders every page

- **Cost:** the main thread used 43.3 of 60 CPU seconds while the process served 46.9 requests per second: 4.1 person pages, 2.8 movie pages, 0.4 show pages, 1.2 sign-up pages, and 0.9 home pages per second, plus about 37 light requests per second (redirects, `/browser-check`, small API routes).
- **Inference:** if a light request costs 1 to 6 ms of main-thread time, a rendered page costs 50 to 75 ms. One process then renders 13 to 20 pages per second with nothing else running. Today it has room for about 4 more per second.
- **Evidence:** per-thread CPU from `/proc`. The gap between headers and the end of the response is 147 ms on average for movies (332 minus 185) and 314 ms for shows (576 minus 262). From worker3, on a warm data cache, the same gap was 30 to 800 ms for 52 KB pages. The per-minute stall line in the log (`Process: ... longest event loop stall`).
- **Cause:** `remix-serve` runs one process. Loaders await everything, and React renders the whole page on the main thread. Large `JSON.parse` calls (cache hits up to 1 MB, Crate responses, a 226 KB Qdrant response) and the OG renderer share the same thread.
- **Fix:** this is what the page cache is for, so the fix is in existing tickets: [Choose the page cache layer](https://github.com/alp82/goodwatch-monorepo/issues/253), [Serve static assets without the Node process](https://github.com/alp82/goodwatch-monorepo/issues/264), [Cap the cast and trim embedded related data](https://github.com/alp82/goodwatch-monorepo/issues/258), and the map's open decision about the number of webapp hosts. This audit adds the number: **the page cache must keep misses below about 10 page renders per second per process**, crawler traffic included.
- **Gain:** not estimated here. **Confidence** in the capacity range: medium. It comes from one 60-second window and an assumed cost for light requests.

### 2. `cached()` has no lock and no stale serving

- **Cost:** during a miss, every concurrent request for the same key runs the target again. A movie page takes 170 ms at p50 to reach its headers on a miss. At 500 requests per second on one cold URL, about 85 requests start in that window (inference). Each runs the details statement (73 sub-executions in Crate, see item 3), up to four Qdrant calls, and a page render of 50 to 75 ms. That is 4 to 6 seconds of main-thread work for one URL, which extends the window further.
- **Evidence:** `app/utils/cache.ts:215-276`: lookup, target, awaited `SETEX`, no shared promise, no lock. The miss ratios in the table above. The Redis lifetime equals the freshness window, so an expired value is gone, and the `stale` branch at `:246-257` never serves anything.
- **Cause:** the helper was written for a low request rate. Only the person profile loader deduplicates in-flight loads itself (`app/server/person.server.ts:479`, `:496-510`).
- **Fix:** deduplicate in-flight calls per key in the process, keep values in Redis longer than their freshness window, serve the stale value while one caller refreshes, and don't await the write. The owner accepts title data that is up to 24 hours stale.
- **Gain (estimate):** one target run per key instead of one per concurrent request. With stale serving, the miss ratio for returning keys falls to near zero. **Confidence:** high for the stampede, medium for the crawl, because a crawl mostly asks for keys that were never cached.
- **Effort:** medium. **Area:** backend.
- **Note:** a page cache that collapses concurrent requests (Varnish does) absorbs the stampede on HTML. It doesn't cover `/api/related`, OG images on a miss, or the long tail.

### 3. Title page miss path

- **Cost:** full response on a miss, in-process: movie p50 247 ms, p95 918 ms, p99 1,799 ms. Show p50 455 ms, p95 1,658 ms, p99 3,395 ms. From worker3, ten long-tail movies: 188 to 381 ms to first byte cold against 79 to 202 ms warm. Ten long-tail shows: 213 to 468 ms cold against 81 to 145 ms warm. 2.8 movie misses and 0.4 show misses per second today.
- **Evidence and cause, step by step:**
  1. `getUserSettings` for a guest: one Redis `GET` that always hits (`app/routes/movie.$movieKey.tsx:53-54`). 3.2 per second, pure overhead.
  2. The details statement (`app/server/details.server.ts:55-526`): p50 67 ms and p95 116 ms in Crate over 3,664 runs, with a maximum of 1,242 ms. 9 of 3,664 runs (0.25%) took longer than 300 ms. In the webapp, the miss takes 106 ms at p50 and 191 ms at p95. `EXPLAIN ANALYZE` shows 73 sub-executions with 897 ms of summed execution time for one long-tail movie: the statement is about 25 scalar subqueries, each fanned out to 12 shards. Parameters are inlined as literals (`:114-116`, validated at `:105-106`).
  3. `getAvailabilityEvidence` runs **after** the details, not next to them (`app/server/details.server.ts:40`, `:52`): 14 ms on average, 97% miss.
  4. `prefetchRelatedTitlesState` runs in parallel (`app/server/related.server.ts:145-160`): two cached lookups, each a Qdrant `Get` and, when the title has a fingerprint, a `Recommend`. p50 37 ms, p95 300 ms, p99 827 ms. Qdrant itself answers 94.8% within 100 ms, so the tail comes from the webapp: a 226 KB response and a busy thread. This step sets the page's p95 time to headers.
  5. Shows add the episode grid: five parallel statements, 18 ms on average (`app/server/episode-grid.server.ts:145-180`).
  6. Then the render, see item 1.
- **Also verified:** the `language` query parameter is part of the cache key and unused in the statement (`app/routes/movie.$movieKey.tsx:61`), so `?language=x` creates a new entry per value. The country is in the key too: crawlers with `zh-CN` create a second entry per title (the job log shows `'CN'` next to `'US'`). A 404 isn't cached: 45 movie 404s in the window each ran the statement (179 ms on average).
- **Fix:** read the evidence in parallel with the details. Give the related-titles prefetch a time budget of about 150 ms and let the browser load it otherwise. Drop `language` from the key. Raise the details lifetime from 30 minutes to 24 hours once item 2 serves stale values. Cache "not found" briefly.
- **Gain (estimate):** time to headers on a miss falls by about 15 ms at p50 and from 385 ms to about 250 ms at p95 for movies. **Confidence:** medium.
- **Effort:** small. **Area:** backend.

### 4. Full details cached and parsed, trimmed afterwards

- **Cost:** the details statement returns 45 KB for a long-tail movie, 164 KB for The Matrix, 741 KB for The Simpsons (210 to 307 ms in Crate), and 1.03 MB for Grey's Anatomy (224 to 486 ms). The webapp parses that response, stores all of it in Redis, and parses all of it again on every hit. The page then keeps actors with a photo, a filtered crew, and one backdrop. The log shows "cached (big)" warnings for `cached-details-show` at 679 KB and 938 KB within 20 minutes. Grey's Anatomy from worker3: 322 to 431 ms to first byte and 1.48 to 1.54 s in total for 404 KB compressed, warm.
- **Evidence:** `app/utils/cache.ts:175` parses on every hit. `app/server/details-page.server.ts:17-39` trims afterwards (`app/routes/movie.$movieKey.tsx:67`). In a sample of 7,997 keys: `cached-details-movie` p50 10 KB, p95 34 KB, maximum 56 KB. `cached-person-profile-v2` p50 8.7 KB, p95 75 KB, maximum 473 KB.
- **Cause:** the cache sits below the trimming step, and the statement has no limit on cast, crew, images, or translations.
- **Fix:** store the trimmed page payload under its own cache name, and limit the arrays in the statement. The OG renderer and `/api/watchability` read the same details, so they need what they use kept. This is the server half of [Cap the cast and trim embedded related data](https://github.com/alp82/goodwatch-monorepo/issues/258).
- **Gain (estimate):** the largest cached values fall from about 1 MB to under 100 KB. Stalls from parsing them fall with it. **Confidence:** medium. The share of the per-minute stalls that comes from parsing wasn't measured.
- **Effort:** medium. **Area:** backend.

### 5. Share list page is uncached

- **Cost:** three public lists from worker3, three requests each. First request: 139 to 369 ms to first byte. Repeat requests: 115 to 144 ms to first byte and 140 to 207 ms in total, 20 to 22 KB. In-process over 9 requests: 190 ms on average, p50 138 ms. Minus TLS, a warm view takes 75 to 105 ms to its headers, every time. A missing list answers 404 in 90 ms.
- **Evidence:** `app/routes/u.$handle.lists.$id.tsx:53-116`. In order: the list (1 statement), the owner's profile (1), then in parallel the titles (1 or 2) and the availability (2, sequential). Nothing uses `cached()`. The response is `private, no-store` (`:114`). The link preview image route runs the first two statements on every request, before it looks at its own cache (`app/server/share-card/images.server.ts:131-135`): 63 to 152 ms from worker3 for 118 to 181 KB, already `public, immutable`.
- **Cause:** the page was built private first. Lists hold exactly five titles, so the work per view is small but never reused.
- **At the target rate:** 500 views per second would send 2,500 to 3,000 statements per second to a cluster that sees about 25 per second today. Not tested.
- **Fix:** [Design public caching and purge for share list pages](https://github.com/alp82/goodwatch-monorepo/issues/250) decides the page cache rules. Below it, put the list, profile, titles, and availability reads behind `cached()` with a reset on edit, keyed by list id.
- **Gain (estimate):** a warm view needs one or two Redis reads instead of five to six statements. **Confidence:** high.
- **Effort:** small. **Area:** backend.

### 6. OG image render on a miss

- **Cost:** from worker3, cold: 268 to 333 ms for five movie cards, 246 to 411 ms for three show cards, 319 to 469 ms for two person cards. Warm: 52 to 75 ms. The cards weigh 390 to 706 KB. In-process over 17 requests: 195 ms on average, p95 457 ms. The title data was already cached for the movie and show cards, so a fully cold card costs a title miss on top.
- **Evidence:** `app/server/og-image/render.server.ts:194` runs `satori` on the main thread, and `:203` encodes the PNG synchronously. Title and person cards live only in a 64 MB in-process cache (`app/server/og-image/og-image.server.tsx:20`), which holds about 90 cards and is empty after every deploy. Two renders run at once, and the wait queue has no limit (`:21`, `:94-111`). The browser asks for a render three seconds after every page view (`app/ui/og-image/useOgImageWarmup.ts`): 0.7 `POST /api/og-image-warm` per second today.
- **Cause:** rendering shares the request thread, and the cache dies with the process.
- **Fix:** render title and person cards in the child process pool that share list cards already use, and store them in Redis or on disk like the other cards. Drop the warm request for cards that a page cache holds. The map lists "where OG rendering runs" as open, waiting for the baseline.
- **Gain (estimate):** renders stop blocking page responses. After a deploy, cards come from the store. **Confidence:** medium. The main-thread share of a render wasn't measured, only its duration.
- **Effort:** medium. **Area:** backend.

### 7. `/api/related`

- **Cost:** in production, 108 requests: 759 ms on average, p50 760 ms, p95 1,814 ms. Browsers send 16 at once per title page view, so they queue behind each other on one thread. From worker3, one at a time: 191 to 603 ms cold and 87 to 332 ms warm, 12 to 20 KB each.
- **Evidence:** `app/routes/api.related.tsx:23-59`. One `cached()` lookup with a 24 hour lifetime, then a Qdrant `Get` and a `Recommend` for 100 results, of which 32 are kept (`app/server/related.server.ts:295`, `:334`). The response sets no `Cache-Control`. The cache key includes `sourceFingerprintScore`, a number the browser sends (`app/routes/api.related.tsx:44`). In the Redis sample, the median related-titles value is 37 bytes: half of the entries are empty lists, and each still costs a Qdrant `Get`.
- **Cause:** nine panels mount at once, and the endpoint is neither publicly cacheable nor trimmed.
- **Fix:** [Mount only the selected related titles panel](https://github.com/alp82/goodwatch-monorepo/issues/255) cuts 16 requests to 2. On the server: send a public `Cache-Control`, look the score up on the server, and ask Qdrant for 32 results.
- **Gain (estimate):** with both, a title page view sends 2 cacheable requests instead of 16 uncacheable ones. **Confidence:** high.
- **Effort:** small. **Area:** backend.

### 8. `INFO` on every cache write

- **Cost:** each node has processed 3.45 million `INFO` commands, which matches its 3.44 to 3.48 million `SETEX` commands. `INFO` costs 167 to 202 microseconds per call against 36 to 39 for `SETEX`. Total CPU time per node since the start: `INFO` 578 to 699 s, `GET` 270 to 294 s, `SETEX` 123 to 136 s. `INFO` is the most expensive command on all three nodes. It also appears in the slow log at 10 to 13 ms, and each reply is several kilobytes that the webapp receives and discards.
- **Evidence:** `app/utils/cache.ts:155`: `redis.info()` without `await`, inside `cacheSet`. With a 78 to 98% miss ratio, that is about 14 calls per second today.
- **Cause:** a leftover connection check.
- **Fix:** delete the line.
- **Gain (estimate):** more than half of the Redis CPU time the webapp causes, and one reply less to read per miss. **Confidence:** high.
- **Effort:** small. **Area:** backend.

### 9. Backend calls without a real timeout

- **Cost:** not a steady cost. It decides what happens when one backend slows down during a spike.
- **Evidence:**
  - Redis has no `commandTimeout` (`app/utils/cache.ts:27-47`). A command that never returns holds every `cached()` call that waits on it.
  - The Crate timeout is 10 seconds and only stops waiting. The HTTP request and the statement keep running (`app/utils/crate.ts:4-7`, `:21-31`). The client uses the global HTTP agent with no socket limit, so slow statements pile up in Crate.
  - `supabase.auth.getUser()` has no timeout (`app/utils/auth.ts:45`).
  - Qdrant calls time out after 10 seconds (`app/utils/qdrant.ts:18`), which is the page's worst case on a miss.
  - The TMDB genre fetch has no timeout (`app/server/genres.server.ts:63`, `:78`).
- **Fix:** a Redis command timeout of a few hundred milliseconds, an abortable Crate request with a concurrency limit, and a timeout on the Supabase and TMDB calls.
- **Gain (estimate):** a slow backend degrades one feature instead of holding all requests. **Confidence:** high for the mechanism. It wasn't observed failing.
- **Effort:** small. **Area:** backend.

### 10. Supabase `getUser()`

- **Cost:** one network round trip to the hosted Supabase auth server per call. From abio, on a reused connection: 24 to 63 ms over seven requests (median 34 ms). On a new connection: 304 ms. The requests carried an invalid token, so a valid session, which needs a user lookup, is likely slower.
- **Evidence:** `app/utils/auth.ts:23-45` builds a client and calls `auth.getUser()`. A member's title page calls it twice per document request: in the root loader (`app/root.tsx:149`) and in the route loader (`app/routes/movie.$movieKey.tsx:53`). Each API route that reads the user adds one more. No memoization per request, no local token check. Requests without the auth cookie skip it (`app/utils/auth.ts:21`), so anonymous traffic pays nothing.
- **Cause:** the simplest correct way to validate a session.
- **Fix:** verify the token's signature locally and call the auth server only to refresh. Memoize the result per request.
- **Gain (estimate):** 50 to 130 ms less waiting per member page view, and no dependency on the auth server's latency for reads. **Confidence:** medium. Supabase's local verification needs asymmetric signing keys on the project, which wasn't checked.
- **Effort:** small. **Area:** backend.

### 11. Member root loader

- **Cost:** five parallel Crate statements on every member navigation that changes the path. For the largest account (1,006 scores, 979 watch history rows), each statement took 12 to 62 ms, and the five tables hold about 300 KB of raw rows. The average account is small: 14 wishlist rows, 28 watch history rows. Together with item 10, a member waits about 100 to 130 ms per navigation before the route's own work.
- **Evidence:** `app/server/userData.server.ts:14-20` wraps the read in `cached()` with `ttlMinutes: 0`, which bypasses the cache. `:37-63` runs the five statements without a `LIMIT`. `app/root.tsx:125-138` reruns the loader on every path change and embeds the result in the HTML.
- **Cause:** the cache was switched off, probably to avoid stale data after a write. A reset function already exists (`:120`).
- **Fix:** cache the user data and reset it on every write. Keep the root loader from rerunning on navigation, and invalidate it after a mutation instead.
- **Gain (estimate):** five statements less per member navigation. **Confidence:** high for the statements, low for the user-visible effect, because no member request was observed.
- **Effort:** small. **Area:** backend.
- **Verdict for the spike:** members wait on I/O here, not on the CPU. This path doesn't drag the process down. It stays below the anonymous items.

### 12. Crawler loop on filtered person pages

See [The crawler](#the-crawler).

### 13. Discover reads 40 title cards with 40 Redis commands

- **Cost:** in-process over 15 requests: 313 ms on average, p50 238 ms, p95 812 ms. From worker3, 12 requests with six `Accept-Language` values: 130 to 425 ms to first byte and 192 to 823 ms in total.
- **Evidence:** production runs the browse path (`REC_FILTER_BAR=on`). It filters the in-memory title snapshot, then reads each of the 40 cards with its own `GET` (`app/server/title-cards.server.ts:245-247`) and loads the misses with one Crate statement. Results aren't cached.
- **Fix:** read the cards with one pipelined call, or keep hot cards in the process.
- **Gain (estimate):** 39 fewer Redis round trips per Discover view. **Confidence:** medium. **Effort:** small. **Area:** backend.

### 14. Cold process after every deploy

- **Cost:** after the start at 00:41 UTC, the process loaded the search index in 12.4 s, the query models in 6.6 s, the title snapshot in 2.1 s, the people index in 1.3 s, and four availability indexes (a Crate statement of 1.1 to 2.5 s each, 65,000 to 180,000 rows). The longest event-loop stall in that minute was 2,010 ms. OG cards and in-process caches start empty.
- **Fix:** no new ticket. [Limit webapp deploys to webapp changes](https://github.com/alp82/goodwatch-monorepo/issues/254) reduces how often this happens, and [Measure the search footprint in the webapp process](https://github.com/alp82/goodwatch-monorepo/issues/252) covers the search index.

## The crawler

**What it is (verified):**

- **Rate:** 17.2 requests per second to filtered person URLs, each answered with a 302, and 16.5 requests per second to `/browser-check`. Together 33.7 of 46.9 requests per second, or 72%.
- **User agent family:** ordinary desktop Chrome and Edge strings, versions 142 to 145, on Windows and macOS, rotating per request. The requests carry a full browser header set (`sec-fetch-*`, `sec-ch-ua`, a referrer, `Accept-Language: en-US,en;q=0.9`, `Accept-Encoding: gzip, deflate, br, zstd`). 90% of the loop's requests look like this. About 6% carry `zh-CN` instead, and 4% send no `Accept-Language`.
- **Addresses:** not one range. In 20 seconds, 311 client addresses sent 312 filtered person requests. Over 30 seconds, the proxy held connections from 862 addresses in 692 different /16 networks and 142 different /8 networks. The largest /16 held 37 addresses. Only 29 of 311 addresses requested both the person URL and the following `/browser-check`: the redirect is followed from a different address. This is the pattern of a rotating residential proxy pool.
- **Cookies:** none, on any request. So the check never passes, and the loop never ends. The same client family also requests `/sign-up?redirectTo=...` with person URLs inside, at 2.4 requests per second.
- **It ignores `robots.txt`:** `public/robots.txt` disallows `/browser-check` and `/person/*?`.
- **A few clients pass:** the log counts 0 to 156 filtered views served per minute against 960 to 1,130 sent to the check. Those clients run scripts, get the cookie, and receive filtered pages with more filter links.
- **Not this crawler:** title pages are crawled by declared bots. In the 20-second sample, ClaudeBot sent 32 of 82 title requests from one address.

**What each request costs:**

- **In the webapp (verified):** 11 ms on average for the redirect and 20 ms for `/browser-check`, in-process. Neither does I/O (`app/routes/person.$personKey.tsx:65-77`, `app/routes/browser-check.tsx:14-30`), but both run through the Remix request handler and the root loader.
- **At the proxy (verified, attribution inferred):** 38.7 new TCP connections per second, so nearly every request pays a full TLS handshake. Traefik uses 97% to 127% of a core, and a new TLS connection from worker3 takes 41 ms. The loop is the largest source of new connections.
- **Inference:** at 1 to 6 ms of main-thread time each, the loop takes 3% to 20% of the webapp's one thread.

**Cheapest fix:**

1. Answer a filtered person URL without the cookie with the small check page itself, at the same URL, instead of a redirect. That halves the loop: 16.5 fewer requests and TLS handshakes per second. One loader change.
2. Stop feeding it: render the filter controls and the sign-up links on person pages so that they aren't plain links with a crawlable URL. The crawler can't request combinations that it never sees.
3. When the page cache exists, answer the cookie check there, so the request never reaches Node. This depends on [Choose the page cache layer](https://github.com/alp82/goodwatch-monorepo/issues/253).

An address or user agent rule doesn't work: the addresses and the agents rotate.

## Candidates from the ticket

| Candidate | Verdict | Number |
| --- | --- | --- |
| Title details statement on a miss, movies | Confirmed as a cost, dismissed as a slow query | 67 ms p50 and 116 ms p95 in Crate. 0.25% above 300 ms. 73 sub-executions per run. 98% of lookups miss |
| Title details, long-running shows | Confirmed | 1.03 MB result and 224 to 486 ms in Crate for Grey's Anatomy. 1.48 to 1.54 s full response from worker3, warm |
| Discover: five parallel pages | Dismissed | Only with `?page=N`, capped at 5. A plain `/discover` loads one page |
| Discover: the 40-second timeout | Not reproduced, not explained | 12 requests, 192 to 823 ms. Candidates below |
| Discover: `/discover?q=` at p95 3,157 ms | Not reproduced | 268 and 286 ms. The loader returns no results in search mode: the browser posts to `/api/combined-search`, which this audit didn't call |
| Share list pages | Confirmed | 5 to 6 statements per view, 75 to 105 ms to headers warm, `private, no-store` |
| Member root loader | Confirmed, low priority | 5 uncached statements per navigation, 12 to 62 ms each for the largest account |
| Supabase `getUser()` | Confirmed | A network round trip per call, 24 to 63 ms on a reused connection, twice per member page |
| `/api/related` | Confirmed | avg 759 ms, p95 1,814 ms, 16 per title view, no `Cache-Control` |
| Person pages | Confirmed as load, dismissed as a slow query | 78% miss, 74 ms p50 and 188 ms p95 per miss, 7 statements. Already deduplicated in flight |
| `/og/*.png` on a miss | Confirmed | 250 to 470 ms cold, main thread, in-process cache only |
| `/browser-check` | Dismissed as slow, confirmed as volume | 20 ms on average, no I/O, 16.5 per second |
| N+1 patterns | Dismissed | None on anonymous read paths. The 40 `GET`s on Discover are the only fan-out |
| Queries without a cache wrapper | Confirmed | Share list reads, member data (`ttlMinutes: 0`), Discover browse results, `/api/watchability` |
| Low hit ratio, long miss | Confirmed | See the cache table |
| Huge cached values | Confirmed | `details-show` at 679 and 938 KB. Person profiles up to 473 KB |
| Redis round trips per request | Confirmed | Warm movie page: 5 `GET`s. Show: 6. Discover: 40. Each miss: 1 `SETEX` plus 1 `INFO` |
| Event-loop blocking | Confirmed | Stalls of 104 to 319 ms every minute. Sources not attributed |
| Qdrant as the slow part | Dismissed | 94.8% of `Recommend` calls within 100 ms, none above 500 ms in the window |
| Crate slow-query log | Not available | `stats.jobs_log_persistent_filter` is `false`. The in-memory log covers 21 minutes |

### The Discover timeout

Twelve requests with six `Accept-Language` values, including `en-US` alone, answered in 192 to 823 ms. The cause of the single 40-second request stays unknown. Three mechanisms in the source can hold a request that long, and none was observed:

- A Redis command with no timeout. Discover sends 40 per view.
- A process restart. Every push to `main` deploys, and the research that saw the timeout ran on a day with several deploys. A request that reaches a container during the switch can hang until the proxy's own timeout.
- An event-loop stall. The longest one measured was 2 seconds, so this alone doesn't explain 40.

The legacy Discover path can't explain it: a Crate statement stops waiting after 10 seconds, and production doesn't run that path.

## Proposed execution tickets

Each is sized for one agent session. Titles are proposals.

1. **Add in-flight deduplication and stale-while-revalidate to `cached()`**
   One target run per key at a time in the process, values kept in Redis past their freshness window, stale values served while one caller refreshes, and writes not awaited.
   Sharpens the map's open item on stampede protection. Backend, medium.
   Done when: a test shows 100 concurrent calls for one cold key run the target once, an expired value is served while it refreshes, and the `stale` counter is non-zero in production.
   Depends on: nothing.

2. **Remove the `INFO` call per cache write and add a Redis command timeout**
   Delete `redis.info()` in `cacheSet`, and set `commandTimeout` so that a hung command fails over to the target.
   Part of the map's "client cleanup in `cache.ts`". Backend, small.
   Done when: `cmdstat_info` stops growing with `cmdstat_setex` on all three nodes, and a test shows a hung `GET` falls through within the timeout.
   Depends on: nothing. Touches the same file as ticket 1, so run them in sequence.

3. **Shorten the title page miss path**
   Read availability evidence in parallel with the details, give the related-titles prefetch a 150 ms budget with a browser fallback, drop `language` from the cache key, cache "not found" briefly, and raise the details lifetime to 24 hours.
   Sharpens the map's open item on related titles on the request path. Backend, small.
   Done when: `goodwatch_http_response_headers_seconds` p95 for `/movie/:movieKey` on a miss is below 250 ms in the benchmark's long-tail run, and a slow Qdrant no longer delays the page.
   Depends on: ticket 1 for the longer lifetime. Blocked by [Record the production baseline](https://github.com/alp82/goodwatch-monorepo/issues/241).

4. **Cache the trimmed title payload and limit the details statement**
   Store what the page reads under its own cache name, and limit cast, crew, images, and translations in the statement, keeping what the OG renderer and `/api/watchability` need.
   The server half of [Cap the cast and trim embedded related data](https://github.com/alp82/goodwatch-monorepo/issues/258): do them together or in sequence. Backend, medium.
   Done when: no "cached (big)" warning appears for a details cache in a day of logs, and the Grey's Anatomy value is under 100 KB.
   Depends on: [Cap the cast and trim embedded related data](https://github.com/alp82/goodwatch-monorepo/issues/258) for the cast limit.

5. **Cache share list reads**
   Put the list, profile, titles, and availability reads behind `cached()` keyed by list id, reset on every edit, and reuse them in the link preview image route.
   Backend, small.
   Done when: a warm share list view and a warm `/og/lists/*` request send no Crate statement, and an edit shows up on the next view.
   Depends on: ticket 1. Coordinates with [Design public caching and purge for share list pages](https://github.com/alp82/goodwatch-monorepo/issues/250), which owns the page-level rules.

6. **Render title and person OG cards off the main thread and store them outside the process**
   Use the child process pool that share list cards use, store cards in Redis or on disk, bound the render queue, and stop the warm request for cards that the page cache holds.
   Sharpens the map's open item on where OG rendering runs. Backend, medium.
   Done when: a cold card render doesn't show up as an event-loop stall, and cards survive a deploy.
   Depends on: [Record the production baseline](https://github.com/alp82/goodwatch-monorepo/issues/241). Coordinates with [Cut the app shell's per-page API calls](https://github.com/alp82/goodwatch-monorepo/issues/257) for the warm request.

7. **Make `/api/related` publicly cacheable and smaller**
   Send a public `Cache-Control`, look `sourceFingerprintScore` up on the server so that the key and URL are stable, and ask Qdrant for 32 results instead of 100.
   Backend, small.
   Done when: the response carries `s-maxage`, the cache key has no client-supplied score, and the Qdrant response for one call is under 80 KB.
   Depends on: [Mount only the selected related titles panel](https://github.com/alp82/goodwatch-monorepo/issues/255), which changes the caller.

8. **Give every backend call a timeout that cancels**
   Abort Crate requests on timeout and limit concurrent statements, and add timeouts to `supabase.auth.getUser()` and the TMDB genre fetch.
   Backend, small.
   Done when: a test with a stalled Crate, Supabase, and TMDB shows each call fail within its limit and the socket closed.
   Depends on: nothing.

9. **Verify the member session locally, once per request**
   Check the token's signature in the process, call the auth server only to refresh, and memoize the result per request.
   Backend, small.
   Done when: a member title page view makes no call to the auth server for a valid token, and an expired or revoked session still signs the member out.
   Depends on: a check that the Supabase project can use asymmetric signing keys. If it can't, do the per-request memoization only.

10. **Cache member data and stop reloading it on navigation**
    Give `user-data` a lifetime with a reset on every write, and keep the root loader from rerunning on path changes.
    Backend, small.
    Done when: a member navigation sends no user data statement, and a rating shows up at once after it's saved.
    Depends on: ticket 1.

11. **End the crawler loop on filtered person pages**
    Serve the cookie check at the filtered URL instead of a redirect, and render filter controls and sign-up links on person pages without crawlable URLs.
    Sharpens the map's open item on the crawler loop. Frontend and backend, small.
    Done when: `/browser-check` receives under 1 request per second in production, and `/person/:personKey` 3xx falls below 2 per second.
    Depends on: nothing. Do it before [Record the production baseline](https://github.com/alp82/goodwatch-monorepo/issues/241) if the baseline should exclude the crawler, or after if it should show the gain. Owner's choice.

12. **Read Discover's title cards in one call**
    Replace 40 `GET`s per page with one pipelined read, and filter once for all requested pages.
    Backend, small.
    Done when: a Discover view sends at most 3 Redis commands.
    Depends on: nothing.

Needs the owner, not an agent:

- **Turn on Crate's persistent slow-query log.** `SET GLOBAL "stats.jobs_log_persistent_filter" = 'ended - started > ''300ms''::interval'` (check the syntax for 5.10). Without it, slow statements outside a 21-minute window leave no trace.

## What wasn't measured

- **Member requests.** No session was available, and no member request arrived in 23 minutes. The member numbers are the Supabase round trip with an invalid token, the five statements run by hand for the largest account, and the call count from source.
- **Main-thread time per request type.** Only the process total was measured. The 50 to 75 ms per rendered page and the 1 to 6 ms per light request are inferences.
- **What causes the per-minute stalls.** Candidates are large `JSON.parse` calls, the page render of long shows, and OG renders.
- **Any path under concurrency.** Every request was single. The stampede numbers are arithmetic, not a test.
- **`POST /api/combined-search`.** It can trigger paid model calls. [Measure the search footprint in the webapp process](https://github.com/alp82/goodwatch-monorepo/issues/252) covers it.
- **A title snapshot rebuild.** It runs on the main thread when the pipeline publishes a version, about every four hours. None happened in the window. The initial load took 2.1 s.
- **Crate statements outside the 21-minute log window**, and Crate CPU per statement.
- **The public path.** All timings used the private path from worker3.
- **Whether the Supabase project supports local token verification.**

## Verified facts and inferences

Verified by measurement:

- Every rate, duration, and ratio in the tables above.
- The main thread's 72% and the proxy's 97% to 127% of a core.
- The `INFO` call count and cost on all three Redis nodes.
- The details statement's duration, sub-execution count, and result sizes.
- The crawler's address spread, header set, cookie behavior, and connection rate.
- The absence of a persistent Crate slow-query log.

Verified in source only:

- The call graphs, cache names, lifetimes, and timeouts.
- That `getUser()` runs twice per member title page.

Inferences:

- The CPU cost per rendered page and the capacity of 13 to 20 page renders per second per process.
- The 85 concurrent misses per cold URL at 500 requests per second.
- That the crawler loop causes most of the proxy's TLS work.
- That a valid Supabase session costs at least as much as the invalid one measured.
- All expected gains.
