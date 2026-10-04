# Render profile of the webapp's server

This page says where the Node main thread spends its time when the webapp serves a page, what the fixes of October 4, 2026 changed, and what the larger remaining costs are. It belongs to the "Serve a viral traffic spike" map and follows the [production baseline](viral-spike-baseline.md), which found that the main thread is the first limit.

The scripts are in [`viral-spike-render-profile/`](viral-spike-render-profile/). Raw CPU profiles aren't in Git.

## Summary

- **A title page costs 118 to 380 ms of main-thread time before the fixes.** A warm movie page takes 118 ms, a warm show page 159 ms, a movie page that misses the data cache 247 ms, and a show page that misses it 380 ms. Production misses the data cache on 98% of title lookups, so the cold numbers describe most production requests.
- **Top three costs of a title page:** the React render (59 to 92 ms), decoding Qdrant's related-title responses on a cache miss (74 ms), and sending the HTML in 2 KB chunks (26 to 104 ms).
- **The streamed remainder waits for the main thread, not for data.** No title page has deferred data or a Suspense boundary. The headers leave after the whole page is rendered. The HTML then left in 162 to 517 chunks of 2 KB, and each chunk needed its own turn of the event loop behind every other request's render.
- **The per-minute stalls are page renders.** React renders a whole page in one synchronous block: 80 ms for a movie page, 89 to 106 ms for a show page, and up to 540 ms for a long-running show. No timer job, garbage collection pause, or metrics scrape came close.
- **Six small fixes cut the main-thread time per page by 29% to 51%**, with the same HTML. On unpatched builds without the profiler, a warm movie page went from 120 to 69 ms, a cold one from 230 to 134 ms, a show page from 149 to 79 ms, and a person page from 53 to 26 ms. At 8 warm movie pages per second, the p95 of the full response went from 4,646 to 108 ms.
- **Largest remaining costs:** the render itself (Swiper instances and the related titles section), the remaining Qdrant decoding on a miss, and Discover's scan of the title snapshot on every request.

## Conditions

| Item | Value |
| --- | --- |
| Date | Sunday, October 4, 2026 |
| Host | worker3, 4 vCPUs (Intel Xeon Skylake, the same model as abio's 8), 7.75 GB RAM |
| Process | One container with the Dockerfile's command, `remix-serve ./build/server/index.js`, `NODE_ENV=production`, Node 24.21.0, memory limit 4 GB |
| Profile build | Commit `28a5c510` plus [`measurement-build.patch`](viral-spike-render-profile/measurement-build.patch): marks, switches that turn search loading off, and each candidate fix behind a switch |
| Before and after builds | `origin/main` at `e86bb212` and the branch with the fixes, both without the measurement patch. The search index loads as in production. The query encoder doesn't start under the preload |
| Data stores | Production Crate and Qdrant, read only. Its own single-node Redis cluster in a container, with the title snapshot copied in |
| Load | One request at a time from the same host, as an anonymous browser with `Accept-Encoding: gzip, deflate, br`. Concurrency runs use k6 1.8.1 with an open model |
| Production | Read only: the metrics endpoint, `/proc` thread CPU, and `docker logs` |

## Method

- **Marks:** a preload script ([`prof-preload.mjs`](viral-spike-render-profile/prof-preload.mjs)) follows each request with `AsyncLocalStorage` and records wall time and main-thread CPU time (`process.threadCpuUsage()`) at each mark: the start and end of every loader, the start of the render, the end of the shell, the end of React's write, and the end of the response. With one request at a time, the CPU time between two marks belongs to that phase.
- **CPU profile:** the V8 sampling profiler through `node:inspector`, at 200 microseconds. [`analyze-profile.mjs`](viral-spike-render-profile/analyze-profile.mjs) maps every frame to a package or to an app source file through the server build's source map. [`inclusive.mjs`](viral-spike-render-profile/inclusive.mjs) sums the samples below a function.
- **Runs:** 150 requests to warm the JIT compiler, then 200 measured requests on a fresh process. A cold run warms the JIT with 150 other titles, then requests 200 different long-tail titles (150 for shows) that the data cache has never seen.
- **Stalls and garbage collection:** a 5 ms timer in the preload reports every time it fires more than 50 ms late, with the request that ran last. A `PerformanceObserver` records every garbage collection pause.
- **Other threads:** process CPU time minus main-thread CPU time. It covers the libuv thread pool (compression) and V8's helper threads.

The profiler adds main-thread time. The per-phase tables come from profiled runs. The before and after table in [Before and after on unpatched builds](#before-and-after-on-unpatched-builds) comes from runs without the profiler and without the measurement patch.

## Where a title page's main-thread time goes

All times are milliseconds per request, before the fixes. Share is the share of the request's main-thread CPU time.

### Per phase

| Phase | Movie, warm | Show, warm | Movie, cold | Show, cold |
| --- | --- | --- | --- | --- |
| Before the loaders: HTTP parse, Express, request object, route match | 4.1 (3%) | 5.9 (4%) | 6.5 (3%) | 5.9 (2%) |
| Loaders: root and route | 9.1 (8%) | 11.0 (7%) | 123.3 (50%) | 140.8 (37%) |
| After the loaders: loader data to JSON and back, headers, handoff string | 6.2 (5%) | 7.1 (4%) | 7.4 (3%) | 11.3 (3%) |
| React render | 62.6 (53%) | 67.5 (43%) | 58.7 (24%) | 92.4 (24%) |
| React writes the HTML into the response stream | 9.4 (8%) | 13.4 (8%) | 8.8 (4%) | 25.4 (7%) |
| Stream to the socket: stream bridge, compression, socket writes | 26.2 (22%) | 53.8 (34%) | 41.7 (17%) | 104.3 (27%) |
| **Main-thread CPU per request** | **117.7** | **158.8** | **246.5** | **380.1** |
| Wall time per request, mean | 141.1 | 203.0 | 335.3 | 568.9 |
| Wall time until the headers, mean | 91.5 | 104.6 | 261.2 | 379.8 |
| CPU on other threads per request | 69.2 | 117.0 | 153.6 | 258.5 |
| HTML size, uncompressed | 443 KB | 638 KB | 442 KB mean | 1,239 KB mean |
| Chunks from React, socket writes | 162, 165 | 248, 253 | 160, 163 | 509, 517 |

- **Warm:** `/movie/603-the-matrix` and `/show/1396-breaking-bad`, every data cache lookup a hit.
- **Cold:** long-tail titles from the sitemap, every data cache lookup a miss.
- A second warm movie run on another build of the same code measured 130.4 ms. Read single numbers as plus or minus 10%.

### By what the question asked for

Inclusive CPU profile time for the warm movie page, in milliseconds per request, with the cold movie page where it differs.

| Part | Warm movie | Share | Notes |
| --- | --- | --- | --- |
| Route matching | 4.4 | 4% | The router flattens and ranks all 169 routes and compiles each path pattern on every match. Two matches before the render and one inside it. 9.1 ms on the cold page |
| Root loader and auth | 0.6 wall, 0.07 CPU in the auth check | under 1% | An anonymous request makes no Supabase call |
| Route loader, cache hits | 9.1 | 8% | Reads five cached values |
| Redis reads and JSON parse of cached values | 5.0 parse and copy, 1.6 Redis client | 6% | 351,000 characters per request: the details, the availability evidence, and two related-title lists |
| Route loader, cache misses (cold movie) | 123.3 | 50% of the cold page | Decoding Qdrant's responses 64.5, mapping them 9.8, cache writes 6.4, Crate client 3.0, query log lines 1.8 |
| Loader data to JSON and back | 3.5 | 3% | Remix turns each loader result into a JSON response and parses it again |
| Loader data and query state serialized into the HTML | 1.8 for the handoff string | 2% | 140,048 characters, of which the related titles state is 87,654 |
| React render and HTML write | 68.8 | 58% | See the next table |
| Streaming and deferred data | None | | No route defers data and no component suspends, so the shell is the whole page |
| Compression | 5.5 in zlib calls, 1.7 in the middleware | 6% | The Node process compresses with Brotli at quality 4. The proxy passes the result through and doesn't compress again |
| Socket writes | 7.6 | 6% | 165 writes per page |
| Garbage collection | 4.7 | 4% | Scavenges of 8 ms each. The longest pause in any run was 43 ms |
| Request log line (`morgan`) | 0.4 | under 1% | |
| Metrics hooks | 0.06 | under 1% | |
| Sentry on the server | None | | Sentry starts only in the browser entry |

### Inside the render

| Owner | Warm movie | Share of the request | Notes |
| --- | --- | --- | --- |
| Swiper | 17.0 | 14% | The React component creates a Swiper instance during the server render. A movie page has 20 carousels, 16 of them loading placeholders in the eight hidden related panels |
| TanStack Query | 15.1 | 13% | Of which `useUserData` 12.3: 137 calls per page, two per title card, each building a query observer |
| React DOM | 14.9 | 13% | The renderer itself, including the HTML write |
| `extractRatings` | 2.6 | 2% | Copies a growing object once per rating key, per card |
| React Router and Remix components | 4.8 | 4% | |
| Everything else in app components | about 8 | 7% | |

The related titles section is 42 of the 61 ms of a movie page's render: a run with the section removed rendered in 18.5 ms.

## What the streamed remainder waits for

**Verified:**

- **Nothing is deferred.** No title, person, Discover, home, or share list route returns deferred data, and no component in `app/ui` or `app/routes` suspends. React calls `onShellReady` when the whole page is rendered, and only then do the headers leave.
- **The body left in 2 KB chunks.** React writes its output in 2,048-byte chunks. Remix's default entry passed each chunk through a Node stream, a web stream, the compression middleware, and the socket, and flushed the compressor after every chunk. A movie page made 165 socket writes, a show page 253, a long-tail show page 517 on average.
- **Each chunk needs the main thread.** The compressor takes one chunk at a time on a libuv thread and reports back on the main thread before it takes the next. On an idle instance, the time between the headers and the last byte was 50 ms for the movie page and 98 ms for the show page, with 26 and 54 ms of main-thread time.
- **The time is main-thread work and hand-offs between threads, not a wait for data.** With compression off (`Accept-Encoding: identity`), the phase took 1.0 ms of main-thread time and 3 ms of wall time.

**Inferred:** under load, every one of those 165 to 517 turns of the event loop waits behind the synchronous renders of other requests (60 to 170 ms each). That explains the baseline's gap between a first byte at 380 ms and a full response at 11.6 s. The concurrency runs in [Under concurrency](#under-concurrency) show the gap before and after the fix.

After the fix, a page leaves in one chunk: 4 socket writes, and 13 ms between the headers and the last byte.

## The per-minute event loop stalls

**The stalls are page renders.** React's server renderer renders the whole shell in one synchronous block, and its write of the HTML runs in the same block.

| Evidence | Value |
| --- | --- |
| Stalls of 50 ms or more in 200 sequential warm movie pages | 200, one per request, right after the render: 80 ms at p50, 125 ms maximum |
| Same for 200 warm show pages | 200: 89 ms at p50, 141 ms maximum |
| Same for 150 cold show pages | 148 after the render: 106 ms at p50, 540 ms maximum. 29 more inside the loader (Qdrant decoding): 56 ms at p50 |
| Same for 200 cold movie pages | 198 after the render: 71 ms at p50. 59 more inside the loader: 57 ms at p50, 124 ms maximum |
| Person pages, Discover, home | Person: 2 in 200. Discover: 40 in 200, inside the loader (the snapshot scan), 55 ms at p50. Home: none |
| Longest garbage collection pause in any run | 43 ms (a mark-sweep). Scavenges take 7 to 12 ms each |

**Under a production-like mix**, the same cause shows, and turns of the event loop hold more than one render. The mix ran for 200 s at 7 requests per second: 2.5 long-tail movie pages, 0.5 long-tail show pages, 3 person pages, 0.5 home pages, and 0.5 Discover requests per second, with the search index loaded and the profiler at 1 ms.

| Measure | Before the fixes | After the fixes |
| --- | --- | --- |
| Main thread busy | 70% | 43% |
| Stalls of 50 ms or more | 779 | 428 |
| Request that ran last before the stall | 633 movie, 94 show, 34 Discover, 18 person | 344 movie, 55 show, 20 Discover, 9 person |
| Stall length p50, p90, p99 | 76, 172, 504 ms | 60, 165, 699 ms |
| Stalls of 250 ms or more | 36 | 23 |
| Longest stall | 1,719 ms | 1,700 ms |
| The process's own "longest event loop stall" lines, per minute | 278 to 1,736 ms | 236 to 1,719 ms |
| Longest garbage collection pause | 62 ms | 65 ms |
| Full response p50, p95 | 238 ms, 10,405 ms | 70 ms, 2,937 ms |

- **The two longest stalls after the fixes follow a long-running show page.** The CPU profile of those two windows (1,700 and 1,635 ms) is 77% React render and write (1,198 and 1,260 ms) and 5% garbage collection (76 ms). The top app frame is the cast carousel (`Actors.tsx`, 65 and 158 ms of self time), with Swiper next (230 and 159 ms). The cast cap of "Cap the cast and trim embedded related data" addresses this stall.
- **A turn can hold several renders.** React schedules each render with `setImmediate`, and Node runs every immediate that is queued in one turn. With 10 to 60 requests in flight, the stalls of 250 to 760 ms in both runs follow movie pages that render in 60 ms alone.
- **Timer jobs don't show.** The app's timer callbacks (the title snapshot check and the explorer pool check, once a minute each) use 0.3 ms of main-thread time per second in the profile. Renders, which run as immediates, use 238 ms per second.

**Candidates from the ticket:**

| Candidate | Verdict |
| --- | --- |
| Process stats timer | Dismissed. One log line a minute, no measurable time |
| Title snapshot refresh | Dismissed for the per-minute stalls. It builds only when a new version is published. The 0.8 to 1.0 s stall at the first build is known |
| Search index refresh | Dismissed for the per-minute stalls. The 2.4 to 2.6 s parse runs at start and once per nightly build |
| Log capping | Dismissed. No samples above 1 ms per request |
| Garbage collection of a large heap | Dismissed as the main cause: 43 ms at most. It adds to a render block when both fall together |
| Metrics endpoint render | Dismissed. One scrape costs 1.4 ms of main-thread time on average, 8 ms at most (30 scrapes) |
| Redis or Crate keep-alive | Dismissed. All of the app's timer callbacks together use 0.3 ms per second |

**Why the stalls reach 100 to 330 ms in production:** production renders about three title pages per second, so every minute holds about 190 render blocks. The per-minute maximum is the largest page of that minute. A show page with a large cast is 1.2 MB of HTML and blocks for 100 to 540 ms on an idle 4-core host.

## Other pages

Milliseconds of main-thread CPU per request, before the fixes.

| Phase | Home | Person | Discover | Share list |
| --- | --- | --- | --- | --- |
| Before the loaders | 5.7 | 6.5 | 6.0 | 4.5 |
| Loaders | 0.7 | 2.9 | 41.9 | 22.0 |
| After the loaders | 0.5 | 1.7 | 1.6 | 1.5 |
| React render | 9.6 | 23.8 | 24.4 | 9.2 |
| React writes the HTML | 1.9 | 4.5 | 3.9 | 2.9 |
| Stream to the socket | 9.5 | 20.5 | 16.8 | 14.6 |
| **Main-thread CPU per request** | **27.9** | **60.0** | **94.6** | **54.7** |
| Wall time per request, mean | 35.8 | 76.9 | 109.3 | 105.7 |
| HTML size, uncompressed | 61 KB | 181 KB | 157 KB | 120 KB |

- **Home:** route matching is 6.1 ms, 22% of the request.
- **Person:** `useUserData` is 8.5 ms and `extractRatings` 1.9 ms of the 23.8 ms render.
- **Discover:** the loader scans the in-memory title snapshot on every request: 37.6 ms in `filterTitles`, of which 29.0 ms in `runPasses`. The 40 Redis reads for the cards cost 1.2 ms of main-thread time.
- **Share list:** the loader waits 61 ms for five to six Crate statements and uses 22 ms of main-thread time, of which 2.9 ms format the clock time of the query log lines.

## Fixes

Each fix was measured alone on the warm movie page against a baseline run of the same build (130.4 ms of main-thread time, 60.8 ms of render, 36.4 ms of stream phase), then all together on every page.

| # | Fix | Where | Measured alone |
| --- | --- | --- | --- |
| 1 | Send a page's HTML in one chunk per React pass, and clear the abort timer when the response is done | `app/entry.server.tsx`, `app/server/html-stream.server.ts` | Stream phase 36.4 to 5.3 ms. Wall time 161.8 to 109.8 ms. Other threads 92.3 to 62.6 ms. Socket writes 165 to 4. Compressed size 60.5 to 56.0 KB |
| 2 | Read the viewer's title marks without a query observer on the server | `app/routes/api.user-data.tsx` | Render 60.8 to 46.4 ms |
| 3 | Fill one object in `extractRatings` | `app/utils/ratings.ts` | Render 60.8 to 57.9 ms |
| 4 | Leave `streaming_availability` out of related-title lookups that don't read it | `app/server/related.server.ts` | Cold movie loader 123.3 to 80.7 ms. Qdrant decoding 64.5 to 23.8 ms. Cached related lists 173 to 87 KB per title |
| 5 | Flatten and rank the routes once, and keep compiled path patterns | `patches/@remix-run+router+1.23.0.patch` | Time before the loaders 6.6 to 3.4 ms on the movie page, 5.7 to 3.3 ms on the home page |
| 6 | Format the clock time of query log lines with one formatter | `app/utils/crate.ts`, `app/utils/qdrant.ts` | Not measured alone. The old call cost 1.8 ms per cold movie page and 2.9 ms per share list page in the profile |

- **Fix 1** replaces Remix's default server entry with the app's own. The default entry also left its 5-second abort timer running after every response, which kept each request's render and loader data reachable for 5 seconds.
- **Fix 2** changes only the server render. The browser keeps the query. The member's data comes from the query cache that the root loader fills.
- **Fix 4** keeps the field for the lookup by streaming service (`getRelatedByCategory`), the only reader.
- **Fix 5** patches the server build of the router only. `patch-package` warns when the router version changes, and fails the build when the patch no longer applies.
- **Same HTML:** eight pages (movie, show, home, person, Discover, share list, a second movie, a static page), each as a browser and as a crawler, are identical with and without the fixes in the measurement build, once asset names and timestamps are masked. A 404 page is identical too. Between the two unpatched builds, seven pages are identical. The person page has the same characters in a different order: two collaborators with the same count swap places between two runs of the query.

### All fixes together, profiled

Main-thread CPU per request in milliseconds. Fix 6 isn't in these runs.

| Page | Before | After | Change | Wall before | Wall after | Other threads before | Other threads after |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Movie, warm | 117.7 | 74.6 | -37% | 141.1 | 82.6 | 69.2 | 45.6 |
| Show, warm | 158.8 | 94.6 | -40% | 203.0 | 106.4 | 117.0 | 56.1 |
| Movie, cold | 246.5 | 152.1 | -38% | 335.3 | 231.4 | 153.6 | 91.9 |
| Show, cold | 380.1 | 233.1 | -39% | 568.9 | 387.4 | 258.5 | 154.4 |
| Home | 27.9 | 20.5 | -27% | 35.8 | 23.3 | 23.6 | 16.9 |
| Person | 60.0 | 29.8 | -50% | 76.9 | 34.9 | 51.8 | 23.0 |
| Discover | 94.6 | 66.8 | -29% | 109.3 | 71.9 | 54.7 | 33.1 |
| Share list | 54.7 | 38.1 | -30% | 105.7 | 78.1 | 46.7 | 34.3 |

Per phase after the fixes, warm movie page: 3.5 before the loaders, 10.8 loaders, 6.3 after the loaders, 40.4 render, 7.9 React's write, 5.8 stream to the socket.

### Before and after on unpatched builds

`origin/main` at `e86bb212` against the branch with all six fixes. No measurement patch, no profiler, the search index loaded. Milliseconds per request, 200 sequential requests each.

| Page | Main-thread CPU before | After | Change | Wall mean before | After | Wall p95 before | After | Other threads before | After | Socket writes before | After |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Movie, warm | 120.4 | 69.1 | -43% | 156.5 | 78.4 | 184.6 | 92.3 | 53.4 | 19.0 | 165 | 4 |
| Show, warm | 149.1 | 79.4 | -47% | 209.5 | 91.8 | 258.9 | 108.8 | 67.9 | 22.8 | 253 | 5 |
| Person | 53.4 | 26.0 | -51% | 71.1 | 31.2 | 88.9 | 39.9 | 26.3 | 10.2 | 79 | 2 |
| Home | 24.8 | 14.2 | -43% | 33.2 | 20.6 | 41.5 | 32.0 | 12.4 | 5.0 | 36 | 1 |
| Movie, cold | 229.6 | 134.3 | -42% | 335.8 | 343.4 | 387.0 | 1,225.2 | 81.4 | 31.0 | 163 | 4 |

- **Cold movie wall time:** the median fell from 335 to 219 ms. The mean and the p95 of the after run hold a few slow backend answers (waits, not CPU): the main-thread time has no such outliers (p95 174.9 ms against 276.9 ms).
- **Compressed size:** a movie page went from 60.5 to 56.0 KB, a show page from 83.7 to 75.9 KB, because the compressor no longer flushes after every 2 KB.
- **Render block:** before the fixes, every warm movie page blocked the event loop for 50 ms or more (68 ms at p50). After them, 75 of 200 did. A warm show page's block went from 81 to 63 ms at p50.

### Under concurrency

k6 on the same host, open model, the same two builds. Milliseconds as k6 sees them.

| Run | Build | Requests | Full p50 | Full p95 | Full p99 | First byte p50 | First byte p95 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| One warm movie page, 4 per second, 60 s | Before | 241 | 155 | 182 | 195 | 88 | 112 |
| | After | 240 | 86 | 101 | 111 | 81 | 94 |
| One warm movie page, 8 per second, 60 s | Before | 478 | 348 | 4,646 | 6,511 | 89 | 283 |
| | After | 481 | 85 | 108 | 758 | 80 | 103 |
| Long-tail titles with a cold data cache, 70% movies and 30% shows, 3 per second, 90 s | Before | 271 | 188 | 2,059 | 3,194 | 110 | 433 |
| | After | 270 | 97 | 537 | 3,424 | 90 | 514 |

- **The baseline's gap is reproduced and gone.** At 8 requests per second the build before the fixes sent the first byte at 283 ms (p95) and finished at 4,646 ms: 120 ms of main-thread time per page times 8 is 96% of the thread, and every one of the 165 chunks waits. The build with the fixes finishes 5 ms after the first byte.
- **No request failed** in any run. The before run at 8 per second dropped 3 iterations.
- **Long-tail p99** stays above 3 s in both builds. Those requests wait before their headers, so the time is in the loaders (backend waits and the synchronous Qdrant decoding), not in the response.

## What each existing ticket would save

Measured on the instance, on top of the fixes unless a row says otherwise.

| Ticket | Measured saving in main-thread time | How measured |
| --- | --- | --- |
| Mount only the selected related titles panel | 13.1 ms per warm movie page (74.6 to 61.5 ms, 18%). Before the fixes: 17.6 ms of render | A switch that renders only the selected panel on the server |
| Cap the cast and trim embedded related data | The longest stalls: one long-running show page rendered for 1,198 and 1,260 ms in the mix run, with the cast carousel on top. A long-tail show page is 1,239 KB of HTML on average and costs 77 ms of render and 25 ms of write after the fixes, against 54 and 14 ms for a 638 KB show page. Related state: 87,654 of the 140,048 characters of loader data in a movie page | CPU profile of the two longest stalls, the cold show run, sizes from the HTML |
| Cache the trimmed title payload and limit the details statement | About 1.5 ms per hit for a movie (the page reads 51 KB of a details value of 176 KB), about 12 ms per hit for a 1 MB value, and 2.7 to 5.3 ms of `JSON.stringify` per miss. Cached details values: 133 KB on average for movies, 249 KB for shows, 625 KB at most in these runs. A request that joins a running cache fill copies the value with `structuredClone`: 49 ms in one profile window for a large show | 12.6 microseconds per KB of parse and copy in `cacheGet`. Inferred for the 1 MB value |
| Shorten the title page miss path | Wall time, not CPU: the cold movie loader waits 150 ms and uses 81 ms of main-thread time after the fixes | Cold movie run |
| Make the related titles endpoint publicly cacheable and smaller | About 20 ms per cold title page if the lookup asks Qdrant for the 32 to 40 titles it keeps instead of 100: decoding and mapping 200 results costs 31 ms after the fixes | Profile of the cold movie run. The saving is inferred from the result count |
| Cache share list reads | About 20 ms of 38 ms per share list page, and 60 ms of wall time | Loader phase of the share list run |
| Read Discover's title cards in one call | 1.2 ms of 67 ms. The Redis reads aren't Discover's cost: the snapshot scan is | Profile of the Discover run |
| Parse the search index and build the title snapshot off the main thread | No per-request time. The stalls of 2.4 to 2.6 s and 0.8 to 1.0 s per start, as the search footprint measured | Not measured again |
| Serve static assets without the Node process | 5.0 ms per request for a 262 KB script (2.9 ms with `Accept-Encoding: identity`), 4.1 ms for the 35 KB-compressed stylesheet, plus 17 to 19 ms on other threads: the process compresses every static file again on every request. A first title page view requests 107 static files, so its static files cost more main-thread time than its HTML (inferred: at least 1.5 ms each, the time until the headers) | 300 sequential requests per file |
| Render OG cards off the main thread and store them outside the process | Not measured here. The slow-path audit measured 250 to 470 ms of main-thread time per render | |
| Cut the app shell's per-page API calls | Not measured per call. Every request that reaches Remix costs at least 3.3 ms of main-thread time before its loader runs (5.7 ms before the router fix) | Home page run |
| Consolidate client script chunks | No server render time. Each chunk request is a static file request: see the static assets row | |
| Give every backend call a timeout that cancels | No CPU saving. It bounds how long a request holds memory | |

## Proposed tickets

| # | Title | Measured share | Expected saving | Confidence |
| --- | --- | --- | --- | --- |
| 1 | Cache Discover's result per filter set in memory | 37.6 of 66.8 ms per Discover request after the fixes (56%) | About 35 ms per repeated request | High for the default view, medium for filtered views |
| 2 | Split the title page render into two turns of the event loop | The render block after the fixes: about 50 ms for a warm movie page, 63 ms at p50 for a warm show page | No CPU saving. The longest stall per title page drops to about half | Medium |
| 3 | Render title carousels on the server without a Swiper instance | 14.4 of 74.6 ms per warm movie page after the fixes (19%). About 3 ms remain once only the selected panel mounts | 3 to 14 ms per title page, depending on the order | High |
| 4 | Stop the JSON round trip of loader data | 5.3 ms per warm movie page (JSON and back 3.5, handoff string 1.8), 9.9 ms per cold show page | 3 to 4 ms per title page | Medium |

1. **Cache Discover's result per filter set in memory.** Discover scans the 238,000 titles of the snapshot on every request (`filterTitles`, 37.6 ms). Keep the result of a filter set, country, and page in memory until the snapshot version changes. Done when a repeated anonymous Discover request with the same filters doesn't call `runPasses`.
2. **Split the title page render into two turns of the event loop.** One synchronous block renders the whole page. Defer the related titles section (loader promise and a Suspense boundary) so that browsers get the shell first and the event loop gets a turn in between. Crawlers still get the complete document. Done when no title page blocks the event loop for more than 100 ms on the measurement instance.
3. **Render title carousels on the server without a Swiper instance.** `swiper/react` builds a Swiper instance during the server render (`extend`, 8.3 ms of self time). Render the slides' markup directly on the server and start Swiper after hydration. Done when the CPU profile of a title page has no `swiper` frame.
4. **Stop the JSON round trip of loader data.** Remix serializes each loader result to a JSON response, parses it again, and serializes it a third time into the HTML. Turn on single fetch or return prebuilt responses. Done when the profile shows one serialization of the loader data per document request.

Considered and not proposed: rendering only the first cards of the selected related panel on the server. After the fixes its 64 cards cost about 8 ms, and the page would lose 48 links to related titles.

Not proposed, because an existing ticket or open map item covers it: more webapp processes (the map's host count item), the Qdrant result count (the related titles endpoint ticket), and prototype routes in the production build (169 route files make every route match slower: a note for the recommendation redesign map).

## A rendered-HTML cache below the request level

An input for the owner. Nothing was built.

### What a hit would save

| Page | Render it, after the fixes | Serve it from a stored copy | Saving per hit |
| --- | --- | --- | --- |
| Movie, warm data cache | 69 ms | 2 to 3 ms | 96% |
| Movie, cold data cache | 134 ms | 2 to 3 ms | 98% |
| Show, warm | 79 ms | 2 to 3 ms | 97% |
| Person | 26 ms | 2 to 3 ms | 90% |
| Home | 14 ms | 2 to 3 ms | 80% |
| Discover | 67 ms (profiled) | 2 to 3 ms | 96% |
| Share list | 38 ms (profiled) | 2 to 3 ms | 93% |

- **Hit cost:** measured with a static file. Express sends a 262 KB file in 2.9 ms of main-thread time when it doesn't compress, and the headers leave after 1.5 ms. A stored page would be kept compressed (56 KB for a movie page), so 2 to 3 ms is the estimate. A copy that is compressed on every hit costs 5 ms plus 17 ms on other threads.
- **Capacity of one main thread:** about 14 rendered warm movie pages per second, about 7 cold ones, or 330 to 500 stored pages.
- **The viral case:** at 500 requests per second for a few URLs, stored pages still cost 1 to 1.5 main threads. A stored-page cache in the process lowers the number of processes that the spike needs from about 35 to 2 or 3 (inferred from the per-page times). It doesn't replace more than one process or a cache in front of the process.

### What it costs

- **Size:** 56 KB compressed for a movie page, 76 KB for a show page, 123 KB for the average long-tail show page (440 KB to 1.2 MB uncompressed).
- **Key:** build commit, path with query, country, and language. The page embeds the locale from `Accept-Language` and the country's streaming offers, so country-specific entries match the owner's decision. Asset names change with every build, so entries can't outlive a deploy.
- **Variants:** 51 countries have their own data today. One hot title in every country is 2.9 MB.
- **Where:** in the process, 300 entries are about 21 MB per process, private to it and gone at a deploy. In Redis, entries are shared between processes. Crawlers walk about 175,000 different titles a day, so a 24-hour lifetime would add 10 to 21 GB a day: admit only keys that repeat within minutes, or keep the lifetime at 30 minutes (about 0.3 GB).
- **Hit ratio on a normal day:** low. 98% of title lookups miss the data cache because almost no title repeats within its lifetime, and a page cache sees the same traffic. With 3.2 title pages per second and a hit ratio of 2% to 5%, it saves under 2% of the main thread. Home (one key per country and language) would hit nearly always, but costs only 14 ms.
- **Hit ratio in a spike:** nearly 100% on the viral URLs, after one render per country.
- **Members:** only requests without the auth cookie may read or write it. Member HTML carries the member's data in the same document.
- **Staleness:** the lifetime decides. Title data may be 24 hours old by the map's accepted trade-off, and the page already sends `s-maxage=1800`.
- **Code:** the server entry already holds the complete HTML in one buffer (`HtmlStream`), and the browser gate shows how to answer before Remix. An estimate is 100 to 150 lines plus tests for the member rule.

### Verified for this estimate

- Two anonymous requests for the same URL return the same HTML apart from the timestamps of the embedded query state. The comparison of the fixes shows it for eight pages.
- Rendered sections can't be cached separately without a change of approach: React has to render a component tree to produce markup that hydrates. The related titles section is 42 of 61 ms of a movie page's render, and "Mount only the selected related titles panel" cuts it without a cache.

### Against a cache in front of the process

Both see the same hit ratio. A cache in front (Varnish) costs the Node process nothing on a hit. A stored-page cache in the process costs 2 to 3 ms on a hit, needs no `Vary` rules at the proxy, decides the country with the app's own resolver, and keeps the member rule in one place. For a normal day neither saves much: cheaper renders do. For the spike, the process-level cache alone isn't enough at 500 requests per second on one process.

## Production before and after

Read only: the webapp's histograms and `/proc` thread CPU over 10 minutes. Times are measured inside the Node process. The histogram percentiles are estimates between bucket edges.

**Before** (07:52 to 08:02 UTC, commit `e86bb212`, process up 42 to 52 minutes):

| Route | Requests per second | Full mean | Full p50 | Full p95 | Headers mean | Headers p50 | Headers p95 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/movie/:movieKey` | 2.77 | 341 | 217 | 1,033 | 233 | 170 | 515 |
| `/show/:showKey` | 0.40 | 483 | 366 | 1,571 | 282 | 225 | 788 |
| `/person/:personKey`, 2xx | 3.60 | 198 | 140 | 539 | Not separable | | |
| `/` | 0.33 | 23 | 27 | 65 | 18 | 26 | 49 |

- **Main thread:** 54.4% of a core on average, 37% to 81% per 10-second step. libuv threads 11.5%, V8 helper threads 6.5%.
- **Responses:** 81.0 per second, of which 70.1 on `/person/:personKey` (mostly the browser gate's 403 answers, which also fill that route's headers histogram). No 5xx.
- **Longest event loop stall per minute** (the process's log lines, 40 minutes): 108 ms at least, 174 ms at p50, 253 ms at p90, 905 ms at most.
- An earlier window (07:13 to 07:23 UTC, the first minutes of the same process) had the main thread at 53.7%, movie pages at 287 ms mean and 799 ms p95, and show pages at 397 ms mean and 967 ms p95.

**After:** this page was pushed together with the fixes, and every push redeploys the webapp. The numbers after the deploy are in the resolution of the ticket "Profile the server render of title pages and cut its main-thread time".

## Verified, inferred, and not measured

**Verified on the measurement instance:** every number in the phase tables, the fixes' before and after, the chunk and write counts, the stall counts, and the HTML comparison.

**Inferred:**

- That production's per-minute stalls have the same cause. The production process wasn't profiled. The instance reproduces stalls of the same size from renders alone, and production's stall log lines can't tell a render from another cause.
- The savings marked as inferred in the tickets table.
- Production's main-thread time per page. abio has the same CPU model as worker3, but production runs next to other containers and with requests overlapping.

**Not measured:**

- Member requests. The instance had no session. Fix 2 changes the member render path: it reads the same query cache entry that the query read.
- `POST /api/combined-search`, OG image renders, and API routes other than `/api/related`.
- The browser. Fixes 2 and 3 also run in the browser bundle (fix 3) or leave it unchanged (fix 2). No Lighthouse run was made.
- A CPU profile of the production process, by the ticket's rules.

## Repeat the measurement

1. On a host with Docker on the private network, build the image from `goodwatch-webapp/Dockerfile`. For the per-phase marks and the switches, apply `measurement-build.patch` first.
2. Create a Docker network and a single-node Redis cluster, and copy the title snapshot with `copy-snapshot.mjs`.
3. Put production's Crate, Qdrant, Supabase, and feature variables in an environment file, with the Redis variables pointing at the local Redis. Leave `TYPESAFE_API_KEY` out.
4. Start with `start.sh`, which mounts `prof-preload.mjs`. Run one page with `variant.sh <label> <path>`, the page set with `suite.sh <prefix>`, a fixed rate with `rate.sh`, and the before and after with `ab.sh`.
5. Copy the output directory and run `analyze-requests.mjs <label>.jsonl` and `analyze-profile.mjs <label>.cpuprofile <requests> <server source map>`.

## Cleanup state

- **worker3:** the containers `gw-render-profile` and `gw-render-profile-redis`, the network `gw-render-profile-net`, the model volume, the five webapp images, the Redis and BusyBox images, and `/opt/gw-render-profile` (with the copied environment files and the CPU profiles) are removed. Docker's build cache from the five builds remains (`docker buildx prune` frees it).
- **abio:** a temporary copy of the probe script in `/tmp` is removed. Nothing else was written.
- **Production data:** no writes to Crate, Redis, or Qdrant. Production got no load, no signal, and no profiler.
- **Dev machine:** no server was started and no port was used.
