# Search footprint in the webapp process

This page answers "Measure the search footprint in the webapp process" for the map "Serve a viral traffic spike". It
measures what search adds to the webapp process, lists optimizations, and gives the inputs for "Decide whether search
becomes its own service". It makes no decision and changes no production code.

Measured on October 4, 2026, 01:15 to 02:25 UTC, on the build of commit `dba07e44`.

## Summary

- **Memory:** search adds about 1.76 GB of resident memory to a 0.59 GB process. The two ONNX models and their
  tokenizers are 1.33 GB of that, the search index is 0.25 GB, and the people index is within noise. The model files
  are 882 MB on disk, not 1.35 GB.
- **Startup:** the server listens after 4 to 7 seconds and loads search in the background. Parsing the search index
  blocks the event loop once for 2.4 to 2.6 seconds. Building the title snapshot blocks it for 0.8 to 1.0 seconds.
  The models load in a worker thread and block nothing.
- **CPU per search:** about 80 ms on the main thread and 340 to 420 ms on the encoder's threads, 230 ms wall at p50.
  The libuv pool does no search work.
- **Concurrent search and pages:** in one process on a 4-core host, 5 searches per second raise the p95 of a warm
  title page from 124 ms to 1,520 ms. 20 per second make pages time out. With search in a second process on the same
  host, 20 searches per second leave the page p95 at 154 ms.
- **Two separate causes:** the encoder's 4 threads starve the main thread on a 4-core host, and each search needs
  50 to 80 ms of main-thread time. With the encoder idle (cached vectors), 20 searches per second still saturate the
  main thread (95% busy).
- **Today's traffic:** production served 112 searches in the last 7 days. In 94 minutes of metrics, no request reached
  `/api/combined-search`, `/api/command-palette`, or `/api/search`. The encoder's threads used 7.2 CPU seconds in 58
  minutes. `/api/search-config` is 1% of all requests.

## Method

### Where the numbers come from

| Source | What | Access |
| --- | --- | --- |
| Production (abio) | Process memory, per-thread CPU time, start log lines, per-route request counts | Read only: `/proc/<pid>`, `docker stats`, `docker logs`, the metrics endpoint |
| Production Crate | Search volume, outcomes, and stage times from `doc.search_history` (no search text, no account ids) | `SELECT` only |
| Measurement instance (worker3) | Memory per component, startup, CPU per search, load tests | A container built from `origin/main` with a measurement patch |

No request went to a production search endpoint. `doc.search_history` has no row from the measurement
(`SELECT count(*) ... WHERE created_at > '2026-10-04T01:00:00Z'` returned 0).

### The measurement instance

- **Host:** worker3, 4 vCPUs (Intel Xeon Skylake, the same model as abio's 8), 7.75 GB RAM. It also runs an idle
  Windmill worker (2% of a core when checked).
- **Image:** `goodwatch-webapp/Dockerfile` at `dba07e44` plus
  [`scripts/measurement-build.patch`](search-footprint/scripts/measurement-build.patch). The patch adds environment
  switches only. Without them the build behaves like production.
- **Start command:** the Dockerfile's `remix-serve ./build/server/index.js` with `NODE_ENV=production`, memory limit
  4 GB, no published port.
- **Environment:** production's variables, copied host to host without printing them, minus `TYPESAFE_API_KEY`.
- **Redis:** its own single-node Redis cluster in a container, so the data cache starts cold and nothing is written
  to production Redis. The title snapshot keys were copied in from production with `SCAN` and `GET` (73 keys, 73 MB).
- **Crate and Qdrant:** production, read only.
- **Models:** downloaded from Hugging Face by the app into a Docker volume, as on production. The Dockerfile doesn't
  download them. The app does it on the first encoder start (17 seconds for 882 MB on worker3) and verifies SHA-256
  hashes.

### What the patch switches

| Switch | Effect |
| --- | --- |
| `GW_BENCH_NO_HISTORY=1` | Skips the `doc.search_history` insert and logs the stage times instead (no search text) |
| `GW_BENCH_READINGS=<file>` | Serves a recorded Jev reading for a known search text instead of the cache lookup and the paid call |
| `GW_BENCH_SKIP=encoder,index,people,jevwarm` | Skips a boot-time load |
| `GW_BENCH_NO_VECTOR_CACHE=1` | Turns off the in-process cache of query vectors, so every search runs the encoder |
| `GW_BENCH_ENCODER_THREADS=<n>` | Sets the encoder's intra-op thread count (4 in the code) |
| `GW_BENCH_TITLE_TTL_MS=<ms>` | Extends the in-process cache of TMDB title lookups (10 minutes in the code) |

### How the paid call was avoided

`POST /api/combined-search` reads the search text with two parallel Jev requests (`runJevStage` in
`app/server/search-runtime/runtime.server.ts`). The ranking and the encoder only run for a search that has a reading.
Three facts made a free measurement possible:

- Without `TYPESAFE_API_KEY`, a search without a cached reading returns `basic("configuration")` before any claim.
  No paid call, no quota write, no Redis admission write.
- The branch `proto/search-simplify` holds captures of the search arena's 168 queries with the real Jev readings
  (`reading.raw`, question version `accepted-d4-corrected-v1`, the version in production). The measurement build
  serves these readings by search text.
- `doc.search_history` records `readingCall` per search, so the paid call's latency is known without calling it:
  p50 299 ms, p95 453 ms (74 fresh readings since September 27).

**Paid calls made: 0.**

**Excluded from the load numbers:** the Jev call and its bookkeeping (cache lookup in Redis and Crate, claim,
dispatch, settlement), the `search_history` insert, and the TMDB title lookup after the first pass over the 168
queries. All of them are network waits, not CPU in the webapp. Production stage times for them are in
[Request path](#5-request-path).

**Query set limits:** the captures predate the people step. For 28 of the 168 queries ("funny brad pitt movies"), the
people step narrows the search to the leftover words, no recorded reading matches, and the search runs as a basic
search. The ranked numbers for the `person` type use `allTitles: true` (the "search all titles" link), which skips the
narrowing.

### Tools

- **Memory:** `/proc/<pid>/smaps_rollup` and `VmHWM` of the Node process, 73 to 93 seconds after start, after one page
  request. Per-model numbers come from [`scripts/mem-probe.mjs`](search-footprint/scripts/mem-probe.mjs), a bare Node
  process with the session options of `query-encoder.worker.js`.
- **Startup stalls:** a probe requests `/api/search-config` every 50 ms during the boot. A slow probe means a blocked
  event loop ([`scripts/boot.sh`](search-footprint/scripts/boot.sh)).
- **CPU per thread:** `/proc/<pid>/task/<tid>/schedstat`, summed by thread name, before and after each search or run.
- **Event-loop delay:** the webapp's own `goodwatch_process_event_loop_delay_seconds` gauge
  (`perf_hooks.monitorEventLoopDelay`), scraped at the start and the end of each run.
- **Load:** k6 1.8.1 in Docker on the same host and Docker network, open model
  ([`scripts/mixed.js`](search-footprint/scripts/mixed.js)). Every run is 60 seconds and ran once.

Raw output is in [`search-footprint/raw/`](search-footprint/raw/).

## 1. Memory

### Per component, in the webapp process

Each row is one start of the measurement instance.

| Loaded | RSS | Peak RSS (`VmHWM`) | Added over the base |
| --- | --- | --- | --- |
| No search (two starts) | 557 MB, 618 MB | 584 MB, 632 MB | Base: 588 MB average |
| People index | 609 MB | 623 MB | Within noise (about 60 MB between identical starts) |
| Search index | 840 MB | 1,096 MB | 252 MB |
| Query encoder (both models) | 1,920 MB | 2,300 MB | 1,332 MB |
| Everything, as in production | 2,351 MB | 2,544 MB | 1,763 MB |

- The base includes the title snapshot (237,867 titles). The snapshot loads in every start, because pages ask for it.
  It wasn't measured alone. The ranking doesn't read it. Only the command palette's fallback does.
- Under load the full process held 2.37 to 2.56 GB.
- Production held 2.77 GB after 36 minutes (2.67 GB anonymous memory, 391 MB JavaScript heap) and 2.54 GB after 58
  minutes in the next process. The container has no memory limit.

### Per model, in a bare Node process

| Step | Added RSS | Time |
| --- | --- | --- |
| Node, `onnxruntime-node`, `@huggingface/tokenizers` | 56 MB in total | 0.1 s |
| `bge-base-en-v1.5`: tokenizer (0.7 MB file) | 16 to 19 MB | 0.1 s |
| `bge-base-en-v1.5`: session (436 MB file) | 456 to 660 MB | 1.9 to 2.6 s |
| `multilingual-e5-small`: tokenizer (17 MB file) | 233 to 273 MB, of which 157 MB JavaScript heap | 1.6 to 1.9 s |
| `multilingual-e5-small`: session (470 MB file) | 357 to 557 MB | 2.3 to 3.5 s |
| Three warm-up runs per model | 1 to 6 MB | 0.1 to 0.4 s |
| Both models | 1.27 to 1.45 GB over bare Node | 6.6 to 9.2 s |

- The range comes from the allocator. ONNX Runtime reads the whole file and builds the weights from it. Sometimes the
  file buffer goes back to the operating system, sometimes it stays.
- The same range shows in the webapp: one start had the encoder at 1,552 MB total, another at 1,920 MB.
- Model files on disk: 882 MB (436 MB, 470 MB, and 18 MB of tokenizer files). The ticket's 1.35 GB matches the
  resident size, not the disk size.

## 2. Startup time

| Step | Production (two starts) | worker3 | Where it runs | Blocks |
| --- | --- | --- | --- | --- |
| Server listens | About 1 s after the first log line | 4.1 to 7.1 s after `docker run` | Main thread | Everything before it |
| People index (58,500 people) | 1,322 ms, 1,370 ms | 1,092 to 1,350 ms | Main thread, mostly waiting for Crate | No stall above 0.5 s seen |
| Title snapshot | 2,147 ms, 1,680 ms | 1,124 to 1,690 ms | Main thread. 370 to 830 ms reading Redis, the rest building | **One stall of 0.83 to 1.03 s** |
| Query models | 6,608 ms, 5,695 ms | 7,097 to 9,245 ms (23,420 ms with the download) | Worker thread | Nothing |
| Search index | 12,359 ms, 9,343 ms | 7,480 to 9,070 ms | Download and gunzip off-thread, `JSON.parse` and table building on the main thread | **One stall of 2.39 to 2.59 s** |

- **Loading is at boot, in the background.** Importing `combined-search/search.server.ts` starts the index, the
  encoder, the people index, and the TypeSafe keep-alive ping. The server bundle imports every route at start. The
  server accepts requests while they load.
- **The title snapshot and the metrics start with the first page request**, not at boot (`app/root.tsx` loader).
- **Until search is ready**, a search falls back to the basic search (`"index not loaded"`, `"encoder not ready"`), and
  the command palette falls back to TMDB.
- **The 2,010 ms stall from the slow-path audit is the search index.** A start with only the index reproduces a 2.39 s
  stall. A start without it has none above 1.03 s. Production logged "longest event loop stall 2066 ms" in its first
  minute.
- **The stall repeats.** The loader checks for a new index build every 5 minutes and loads it the same way. The build
  runs nightly, so production stalls about once per night per process (inference from the code, not observed).
- **Peak memory during the start** is 0.2 to 0.4 GB above the settled size.

## 3. CPU during queries

One search at a time, 168 queries, every search encoded (vector cache off), TMDB lookup cached, recorded readings,
`discover: true` as the live page sends it. CPU is per search, in milliseconds.

| Query type | n | Wall p50 | Wall p95 | Main thread | Encoder threads | libuv pool | V8 workers | Total CPU |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| All ranked searches | 168 | 230 | 495 | 84 | 344 | 0.1 | 14 | 441 |
| Plain title ("Inception") | 7 | 148 | 187 | 56 | 274 | 0 | 3 | 332 |
| Person name with words ("keanu reeves action") | 39 | 292 | 403 | 101 | 252 | 0.2 | 41 | 394 |
| Creator name alone ("tarkovsky") | 3 | 215 | 313 | 81 | 100 | 0.2 | 20 | 201 |
| Short vague ("cozy") | 12 | 150 | 168 | 57 | 212 | 0 | 2 | 270 |
| Descriptive phrase ("slow burn space horror") | 9 | 238 | 411 | 77 | 377 | 0 | 6 | 459 |
| Long sentence | 10 | 287 | 489 | 77 | 544 | 0.2 | 13 | 634 |
| Non-English sentence | 11 | 534 | 772 | 188 | 879 | 0 | 7 | 1,073 |
| Basic search, no reading | 28 | 75 | 105 | 23 | 257 | 0 | 3 | 282 |

- **Thread pools:** the encoder runs in one worker thread plus ONNX Runtime's intra-op threads (8 threads named
  `query-encoder` for two sessions). The ranking, the Qdrant response parsing, and the response run on the main
  thread. The libuv pool does nothing for search.
- **The main-thread share is 50 to 100 ms per search.** A title page render costs about 132 ms of main-thread time on
  the same host (31.9 CPU seconds for 241 pages). One search costs as much main-thread time as 0.4 to 0.75 page
  renders.
- **A basic search still runs the encoder.** The ranking's early part starts before the reading is known. When the
  search then has no reading, 257 ms of encoder CPU is thrown away.
- **Thread count and CPU per search**, from the warm-up runs at 3 searches per second with no page load:

| Encoder threads | Encoder CPU per search | Early encode p50 | Late encode p50 | Search p50 | Search p95 |
| --- | --- | --- | --- | --- | --- |
| 4 (production) | 319 ms | 43 ms | 85 ms | 190 ms | 636 ms |
| 2 | 183 ms | 42 ms | 96 ms | 194 ms | 561 ms |
| 1 | 130 ms | 71 ms | 181 ms | 234 ms | 709 ms |

  Four threads on four cores use 2.5 times the CPU of one thread and are no faster than two. With pages running
  next to 1 search per second, four threads are slower: 126 ms (early) and 174 ms (late). Production's 8-core host
  encodes in 36 ms (early) and 67 ms (late) at p50 with 4 threads.
- **Production today:** the encoder threads used 7.2 CPU seconds in 58 minutes, nearly all of it loading and warming
  up. The main thread used 2,365 seconds (68% of a core).

## 4. Concurrent search and page response times

Every run: 2 warm title page requests per second (`/movie/603-the-matrix`, data cache warm) and 2 title page misses
per second (a different long-tail movie each time, data cache cold), for 60 seconds. Times are full responses in
milliseconds.

"Warm page" means the data cache is warm. The page is still rendered by Node. A page served by a future page cache
doesn't reach Node, and search can't slow it.

### One process, as in production

| Searches per second | Warm p50 | Warm p95 | Miss p50 | Miss p95 | Loop delay p50 | p99 | Max | Main thread | Encoder threads | Search p50 | Search p95 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 93 | 124 | 305 | 370 | 0.4 | 81 | 120 | 52% | 0 | | |
| 0, search not loaded | 94 | 128 | 301 | 355 | 0.4 | 75 | 202 | 50% | 0 | | |
| 1 | 115 | 213 | 332 | 473 | 0.4 | 117 | 242 | 56% | 50% | 353 | 757 |
| 2 | 133 | 264 | 357 | 644 | 0.9 | 127 | 245 | 61% | 84% | 300 | 722 |
| 5 | 317 | 1,520 | 1,181 | 4,458 | 10.9 | 263 | 554 | 69% | 194% | 639 | 2,199 |
| 20 | 13,501 | 30,001 | 30,000 | 30,001 | 43 | 940 | 1,365 | 59% | 283% | 13,070 | 30,001 |

- At 20 per second, 43% of warm page requests, 57% of miss requests, and 41% of searches hit the 30-second timeout.
  The host was 99% busy. Only 118 of 1,180 searches got ranked results. The others ended as basic searches
  (`timeout` 284, `encoder queue full` 174).
- An idle search costs nothing: the first two rows match.
- Percentages are of one core.

### Variants at 5 and 20 searches per second

| Variant | Searches per second | Warm p50 | Warm p95 | Miss p50 | Miss p95 | Loop delay p50 | Main thread | Encoder threads | Search p50 | Search p95 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Production settings | 5 | 317 | 1,520 | 1,181 | 4,458 | 10.9 | 69% | 194% | 639 | 2,199 |
| 2 encoder threads | 5 | 111 | 272 | 361 | 892 | 2.4 | 75% | 90% | 299 | 838 |
| 1 encoder thread | 5 | 120 | 446 | 376 | 1,709 | 2.1 | 77% | 62% | 386 | 1,689 |
| Vector cache hits only | 5 | 108 | 276 | 365 | 693 | 1.7 | 76% | 0% | 222 | 522 |
| Vector cache hits only | 20 | 9,975 | 28,260 | 8,635 | 28,888 | 25 | 95% | 0% | 9,775 | 28,359 |
| Basic searches only (no reading) | 5 | 123 | 215 | 366 | 498 | 1.2 | 61% | 122% | 152 | 284 |
| Command palette lookups | 20 | 96 | 123 | 311 | 385 | 0.5 | 61% | 0 | 17 | 109 |

- **Two encoder threads beat four on this host** for pages and for search.
- **The main thread is the second limit.** With every vector cached, the encoder is idle, and 20 searches per second
  still take the main thread to 95% and pages to 10 seconds.
- **The command palette is harmless.** 20 prefix lookups per second (Redis-cached per prefix, a scan of the in-memory
  title table on a miss) change nothing.

### Search in a second process on the same host

The page process starts without search. A second container of the same image takes the searches. No CPU pinning.

| Searches per second | Encoder threads | Warm p50 | Warm p95 | Miss p50 | Miss p95 | Loop delay p50 | Page process main thread | Search process main thread | Search process encoder | Search p50 | Search p95 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5 | 4 | 104 | 139 | 314 | 389 | 0.3 | 47% | 28% | 195% | 282 | 1,531 |
| 5 | 2 | 94 | 129 | 302 | 367 | 0.3 | 50% | 29% | 90% | 184 | 640 |
| 20 | 4 | 102 | 154 | 322 | 446 | 0.3 | 42% | 44% | 229% | 700 | 3,020 |
| 20 | 2 | 115 | 193 | 362 | 496 | 0.3 | 50% | 59% | 171% | 487 | 2,004 |

- Pages stay within 30 to 120 ms of the no-search numbers, with the host at 94 to 99% CPU.
- At 20 per second the search process still can't rank most searches (71 of 1,201 with 4 threads, 154 with 2). The
  rest get basic results in 0.5 to 3 seconds. No search request failed.

## 5. Request path

### Endpoints

| Endpoint | What it runs | Search cost | `Cache-Control` |
| --- | --- | --- | --- |
| `POST /api/combined-search` | People step, language routing, TMDB title lookup, Jev reading, ranking (encoder, Qdrant, index), display fields, history row | All of it | `private, no-store, no-transform` |
| `GET /api/command-palette` | Prefix scan of the search index's title table, Redis-cached 6 hours per prefix, display fields from Crate. TMDB until the index has loaded | Needs the index in memory. No encoder, no Jev | `private, no-store` |
| `GET /api/search-config` | Returns a version string | None | `no-store` |
| `GET /api/search` | TMDB multi-search, cached 2 hours in Redis | None. No browser code calls it (`useSearch` is unused) | None |
| `/discover?q=` | The loader skips the browse query and runs no search. The browser then posts to `/api/combined-search` | None on the server render | Page headers |
| `/search?q=` | Redirects to `/discover?q=` (301) while the filter bar is on | None | `private, no-store` |
| `POST /api/discover/results` | Filters the ranked list that the browser sends back (up to 100 keys). No search code | None | `private, no-store` |

### What an anonymous visitor's typing triggers

Production runs with `REC_NAVIGATION=on` and `REC_FILTER_BAR=on`. A visitor who types "the matrix" and presses Enter:

1. Opening the palette sends nothing.
2. Typing sends `GET /api/command-palette?q=<prefix>` each time typing pauses for 150 ms, from 2 characters on. Steady
   typing sends one request. The worst case is one per distinct prefix. The browser caches each prefix for 5 minutes.
3. Enter navigates to `/discover?q=the%20matrix` (one or two loader requests).
4. The page sends one `POST /api/combined-search` with `discover: true`, which asks for up to 100 ranked rows (105 KB
   on average).
5. The page sends `POST /api/discover/results`, and again on scroll and on filter or sort changes.

Typing in Discover's own search field sends one search per pause of 800 ms or on Enter. A change to an eligibility
filter (type, genre, release, services) sends a new search. Every page load and every tab focus sends
`GET /api/search-config`, whose result the live Discover page doesn't use.

### Limits that already exist

| Limit | Value | Effect |
| --- | --- | --- |
| Fresh readings, all visitors | 240 per minute | Above it: basic search |
| Fresh readings, per network address or account | 20 per minute | Above it: basic search |
| Concurrent paid readings | 16 | Above it: basic search |
| Spending | 1 USD per day, 5 USD per month | Above it: basic search. A fresh reading costs 0.00032 USD on average (429 readings), so about 3,000 per day and 15,000 per month (inference) |
| Encoder queue | 32 waiting requests | Above it: basic search |
| Ranking deadline | 1,500 ms | After it: basic search. The ranking can't be cancelled and keeps running |
| Query vector cache | 500 requests, in the process | A repeated search skips the encoder |
| Title lookup cache | 200 texts, 10 minutes, in the process | A repeated search skips TMDB |
| Reading cache | Redis 24 hours, Crate without expiry | A repeated text skips the paid call |

A cached reading has no rate limit. A search without a reading still costs 23 ms of main-thread time, 257 ms of
encoder time, two Crate full-text queries, and up to five TMDB requests.

### Share of production requests

| Window | All requests | `/api/search-config` | `/api/combined-search` | `/api/command-palette` | `/api/search` | `/discover` |
| --- | --- | --- | --- | --- | --- | --- |
| 36 minutes to 01:18 UTC | 47.3 per second | 0.59 per second (1.24%) | 0 | 0 | 0 | 67 requests |
| 58 minutes to 02:20 UTC | 47.3 per second | 0.44 per second (0.92%) | 0 | 0 | 0 | 104 requests |

`doc.search_history`: 112 searches in the last 7 days. The busiest day in the last 14 was September 26 with 760 (an
agent's test day). Outcomes over 7 days: 70 fresh readings, 34 cached readings, 8 basic.

Production stage times since September 27 (searches that got ranked results):

| Stage | Fresh reading (n=74) p50 | p95 | Cached reading (n=35) p50 | p95 |
| --- | --- | --- | --- | --- |
| Total | 816 ms | 1,831 ms | 703 ms | 2,631 ms |
| Reading, of which the Jev call | 474 ms, 299 ms | 952 ms, 453 ms | 23 ms | 184 ms |
| Ranking | 268 ms | 755 ms | 508 ms | 2,481 ms |
| Encoder, early and late | 36 ms, 67 ms | 178 ms, 258 ms | 0.2 ms, 0.1 ms | 180 ms, 331 ms |
| Qdrant, wall and server | 170 ms, 99 ms | 636 ms, 597 ms | 418 ms, 223 ms | 1,120 ms, 532 ms |
| Display | 42 ms | 116 ms | 53 ms | 281 ms |

## Optimizations worth trying

Ranked by gain per effort.

| # | Change | Evidence | Expected gain | Effort |
| --- | --- | --- | --- | --- |
| 1 | Make the encoder thread count a setting, and use half the cores (2 on a 4-core host) | Variants table: at 5 searches per second, warm page p95 1,520 to 272 ms, search p95 2,199 to 838 ms, encoder CPU 194% to 90% | Large on 4-core hosts. Unmeasured on abio's 8 cores | One constant |
| 2 | Serve `/api/combined-search` from a second container of the same image, with search turned off in the page container | Second-process table: page p95 stays at 139 to 193 ms up to 20 searches per second | Search can no longer slow pages. The page process shrinks by 1.5 to 1.76 GB | Small: a start switch and a proxy path rule |
| 3 | Stop fetching `/api/search-config` on every page and tab focus | 1% of all production requests. The live Discover page doesn't use the result | 0.4 to 0.6 requests per second today, and one request per page view in a spike | Small |
| 4 | Answer "busy" before any work when too many searches are in flight | At 20 per second, 90% of searches end as basic after burning encoder and main-thread time, and pages time out | Bounds the damage of a search burst in any topology | Small |
| 5 | Start the encoder only when the search can have a reading | A basic search wastes 257 ms of encoder CPU. 5 per second cost 122% of a core | Removes encoder load from rate-limited and over-budget searches | Small. It may add 40 to 130 ms to a fresh-reading search if the early start moves after the claim |
| 6 | Parse and build the search index off the main thread, or in slices | One 2.4 to 2.6 s stall per start and per nightly build | Removes the longest known stall | Medium |
| 7 | Build the title snapshot off the main thread, or in slices | One 0.8 to 1.0 s stall per start and per new snapshot version | Removes the second-longest stall | Medium |
| 8 | Cache anonymous search results by text, filters, and index build | A search costs 50 to 100 ms of main-thread time even with cached vectors and reading. In a spike many visitors search the same title | A repeated search drops to a cache read | Medium |
| 9 | Profile the main-thread share of a search and cut it | 84 ms per search. Candidates: parsing Qdrant responses (Qdrant wall time is 50 to 190 ms above its server time), the 105 KB response for `discover: true`, the display stage | Raises the search rate one main thread survives (about 12 per second alone today, by arithmetic) | Medium, needs a CPU profile |
| 10 | Load the models on the first search, and unload them after an idle period | 1.33 GB for 16 searches a day. `stopQueryEncoder()` exists | 1.3 GB per process while nobody searches | Small. The first search after a load waits 6 to 9 s or gets basic results |
| 11 | Raise the query vector cache from 500 entries | An entry is up to 20 KB. Cached vectors cut a search's CPU from 441 ms to about 50 ms, all on the main thread | Fewer encoder runs for repeated texts | One constant |
| 12 | Cut the multilingual tokenizer's 157 MB heap | Per-model table | Up to 0.2 GB | Unknown. Needs a different tokenizer representation |

Not worth trying now:

- **Quantized models.** The ranking port found that int8 models fail parity. Not re-tested.
- **Client debounce and minimum length.** They exist (150 ms and 2 characters in the palette, 800 ms in Discover), and
  the palette's lookups don't slow pages.
- **Moving the encoder to a worker thread.** It already runs in one.
- **HTTP caching of `/api/search`.** Nothing calls it.

## Inputs for the extraction decision

### What a separate search process needs

| Resource | Need | Basis |
| --- | --- | --- |
| Memory | 2.4 GB resident, 2.6 GB peak, for the same image with search on. About 1.7 to 1.9 GB for a dedicated small server (inference: encoder 1.33 GB, index 0.25 GB, a bare Node process) | Section 1 |
| CPU | 1.2 cores at 5 searches per second with 2 encoder threads (0.9 encoder, 0.3 main thread). The paid-reading limit is 4 per second | Second-process table |
| Throughput | One process ranks 4 to 5 searches per second within the 1.5 s deadline on 4 cores. Above that it serves basic results | Sections 3 and 4 |
| Host | worker1 or worker3 (4 cores, 6.5 GB free) fit one search process with 2 encoder threads. vector1 (16 cores, 18.8 GB free) also runs Qdrant, which every ranked search calls several times | Host survey, section 5 |

### What stays shared

- **Crate:** the index files, catalog metadata, the people index, readings, spending, history.
- **Redis:** the reading cache and the admission counters.
- **Qdrant, TMDB, TypeSafe:** called per search.
- **Secrets:** `SEARCH_STORAGE_KEY`, `TYPESAFE_API_KEY`, `TMDB_API_KEY`, and the Crate, Redis, and Qdrant credentials.
- **Not the title snapshot:** the ranking doesn't read it.
- **The search index, partly:** the command palette reads the index's title table in the webapp. If the index leaves
  the webapp, the palette needs another source (the title snapshot has the titles and votes) or a call to the search
  process.
- **The route's member work:** `/api/combined-search` verifies the session and adds a member's taste to the rows. That
  code reads the webapp's taste data.

### What the webapp saves

- **Memory:** 1.76 GB per process if the index leaves too, 1.33 to 1.5 GB if the palette keeps the index.
- **Startup:** the 2.4 to 2.6 s stall, if the index leaves.
- **CPU under search load:** all of section 4's damage.
- **Per extra webapp instance:** the map considers more webapp hosts. Each instance that keeps search carries
  1.76 GB and its own encoder threads. A worker host has 6.5 GB free and runs a Windmill worker with a 4 GB limit.

### Added latency of one private-network hop

- Round trip between worker3 and abio, and between worker3 and worker1: 0.58 ms average, 1.7 ms maximum (20 pings
  each).
- A search takes 700 to 800 ms at p50 in production. The hop is below 1% of that.
- The response is 105 KB of NDJSON. Not measured through a proxy.

### The paths, with their costs

| Path | Pages protected | Webapp memory saved | New moving parts | Measured |
| --- | --- | --- | --- | --- |
| Stay in process, with changes 1, 4, and 5 | Partly. At 5 per second the page p95 doubles (124 to 272 ms). At 20 per second the main thread saturates unless the "busy" answer holds searches near 5 per second | None | None | Yes, for change 1 |
| Worker thread for the ranking | From main-thread work, not from CPU contention | None, and the index must load in the worker | A second copy of the index code path, message passing for 100 KB results | No |
| Same host, second container of the same image | Yes, up to 20 per second, with the host at 99% CPU | 1.76 GB in the page process. The host total grows by one base process (about 0.6 GB) | A start switch that turns search off, a proxy path rule for `/api/combined-search`, a second health check, 2.4 GB on abio (10 GB available) | Yes |
| Other host, same image | Yes, and no shared CPU | Same | The above, plus a container on a second host and its deploy | No. Expected to match or beat the same-host numbers |
| Dedicated search service | Yes | Same | A new service, its API, its deploy, and a second place for the search code | No |

### Recommendation

This is a recommendation, not a decision.

1. Set the encoder to 2 threads on any host with 4 cores, and add the "busy" answer. Both are small and help in every
   path.
2. Take the middle path first: one more container of the same image for `/api/combined-search`, on abio or on a
   worker host, with search turned off in the page containers. It gives the full page protection that was measured,
   needs no new service, and makes every further webapp instance 1.76 GB lighter.
3. Skip the dedicated service for now. Search is 16 requests a day, and the paid-reading limits cap ranked searches at
   4 per second.

## What wasn't measured

- **abio's 8 cores.** All load numbers are from a 4-core host that also ran k6. The thread-count result may differ
  on 8 cores.
- **The paid call under load.** Recorded readings replaced it. Its latency comes from 74 production rows.
- **The member path:** session check and taste rows.
- **Ranked searches that the people step narrows.** They ran as basic searches (28 of 168 queries).
- **The title snapshot's memory alone, and the nightly index reload on a live process.**
- **Repeats.** Each load run is one 60-second run. Identical starts differ by about 60 MB of RSS.
- **A search process on another host, a worker thread for the ranking, and a proxy in front of the search response.**
- **Spinning.** ONNX Runtime's intra-op threads may spin while they wait. Turning it off wasn't tested.
- **Qdrant's side.** The measurement sent up to about 5 ranked searches per second to production Qdrant. Its server
  time stayed at 44 to 53 ms at p50.

## Verified facts and inferences

**Verified by measurement or by reading the code:** every number in sections 1 to 5 with a named source, the endpoint
table, the limits table, the typing sequence (code reading, not a browser trace), the production flags, zero paid
calls, zero history rows.

**Inferences:**

- The nightly index reload stalls production once per night.
- A dedicated search server needs 1.7 to 1.9 GB.
- 3,000 fresh readings per day and 15,000 per month fit the spending limits.
- One main thread alone handles about 12 searches per second (1,000 ms divided by 84 ms).
- On a 4-core host, encoder threads starve the main thread. The evidence: the main thread used only 59 to 69% of a
  core while pages slowed, the host was 80 to 99% busy, and halving the threads fixed it.
- The other-host path performs at least as well as the same-host path.

## Reproduce

1. Build the image from `goodwatch-webapp/` at `dba07e44` with `scripts/measurement-build.patch` applied.
2. Create a Docker network and a single-node Redis cluster, and copy the title snapshot with
   `scripts/copy-snapshot.mjs`.
3. Build `readings.json` from the captures on `proto/search-simplify`
   (`docs/prototypes/search-arena/data/captures/*.json`): a map from the lowercased, whitespace-collapsed query to
   `reading.raw`.
4. Start with `scripts/start.sh`, measure a boot with `scripts/boot.sh`, single searches with `scripts/seq.py`, and
   load with `scripts/load.sh` (which runs `scripts/mixed.js` in k6).

The environment file must not contain `TYPESAFE_API_KEY`.

## Cleanup state

- **worker3:** the containers `gw-search-footprint`, `gw-search-footprint-search`, and `gw-search-footprint-redis`,
  the network, the model volume, both images, and `/opt/gw-search-footprint` (including the copied environment files)
  are removed. Left behind: about 1.8 GB of reclaimable Docker build cache (`docker buildx prune` frees it).
- **abio:** a temporary helper script in `/tmp` is removed. Nothing else was written.
- **Production data:** no writes to Crate, Redis, or Qdrant.
- **Dev machine:** no server was started and no port was used.
