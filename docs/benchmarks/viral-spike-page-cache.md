# The in-process page cache, measured

This page holds the measurements for the in-process page cache: what a request costs when the cache answers it, how
many requests per second one process then serves, and what a deploy looks like. It belongs to the "Serve a viral
traffic spike" map. The cache is described in [page-cache.md](../page-cache.md). The scripts are in
[`viral-spike-page-cache/`](viral-spike-page-cache/).

## Summary

- **A stored page costs 0.5 to 0.8 ms of main-thread time.** A render costs 14 to 63 ms.
- **One process serves one hot URL more than 1,300 times per second** with a p95 of 2 ms. Without the cache, it holds
  20 per second and fails at 22.
- **The benchmark's hot mix holds 400 requests per second** (25 before). Share list pages are private and still
  rendered, and OG images take the other threads: they set the new limit.
- **Analytics cookies, tracking parameters, and several languages don't defeat it.**
- **A long-tail crawl next to a hot URL stores nothing** and doesn't evict the hot page.
- **After a deploy, a hot URL renders once per process.** The first stored answer leaves 0.35 seconds after the first
  request.

## Conditions

| Item | Value |
| --- | --- |
| Date | Sunday, October 4, 2026 |
| Host | worker3, 4 vCPUs, 7.75 GB RAM. The load generator runs on the same host. |
| Process | One container with the Dockerfile's command, `NODE_ENV=production`, memory limit 4 GB, no search models |
| Before | `origin/main` at `9d87bff6` |
| After | The same commit plus the cache, for the cost and capacity tables. The final build (the cache on `66e44e10`) for the long-tail, stale, and cold start runs |
| Data stores | Production Crate and Qdrant, read only. Its own single-node Valkey cluster in a container, with the title snapshot copied in |
| Load | k6 1.8.1 with an open model (fixed arrival rate), as a mobile browser with `Accept-Encoding: gzip, deflate, br` |

Read single numbers as plus or minus 10%. CPU time comes from `/proc` in ticks of 10 ms, so a batch of 200 requests
resolves 0.05 ms per request.

## Cost per request

Main-thread CPU per request, one request at a time over one connection. Wall time is the full response.

| Page | Render, before | Render, cache on | Hit, Brotli | Hit, gzip | Hit, no encoding | 304 | Hit, wall p50 / p95 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Movie | 41.3 ms | 44.2 ms | 0.80 ms | 0.75 ms | 3.6 ms | 0.65 ms | 1.2 / 2.2 ms |
| Show | 41.2 ms | 44.2 ms | 0.45 ms | 0.50 ms | 3.0 ms | 0.50 ms | 0.7 / 1.3 ms |
| Person | 23.3 ms | 24.8 ms | 0.70 ms | 0.50 ms | 2.0 ms | 0.45 ms | 1.0 / 1.7 ms |
| Home | 14.1 ms | 14.3 ms | 0.65 ms | 0.50 ms | 1.2 ms | 0.45 ms | 1.0 / 1.5 ms |
| Discover | 62.5 ms | 62.7 ms | 0.70 ms | 0.70 ms | 2.0 ms | 0.60 ms | 0.7 / 3.7 ms |

- **Render, cache on:** a request whose URL doesn't repeat. The cache counts it, tracks its render, and doesn't store
  it. The difference to "before" is inside the run-to-run range.
- **With analytics cookies:** 0.35 to 0.60 ms. **With tracking parameters:** 0.50 to 0.70 ms. Every one of those
  requests was a hit.
- **No encoding:** the gzip copy is decompressed on the thread pool (1 to 4 ms of other threads' time), and the
  response is 62 to 413 KB.
- **Stale:** the visitor gets the stored page in 2.3 to 3.1 ms (p50, with one request every 1.5 seconds). The process
  then renders the page once in the background, which costs what a render costs.
- **Sizes:** a movie page is 356,577 bytes of HTML, 46,701 bytes with Brotli at quality 5 (Express sends 49,714 at
  quality 4), and 58,808 bytes with gzip.

## One hot URL

`/movie/603-the-matrix` at a fixed arrival rate, 20 to 30 seconds per step.

| Rate | Before: p95 | Before: main thread | After: p95 | After: main thread |
| --- | --- | --- | --- | --- |
| 5/s | 77 ms | 26% | | |
| 10/s | 67 ms | 46% | | |
| 20/s | 108 ms | 83% | | |
| 22/s | 2,045 ms | 89% | | |
| 50/s | | | 2.1 ms | 9% |
| 100/s | | | 2.0 ms | 14% |
| 200/s | | | 1.9 ms | 23% |
| 400/s | | | 1.5 ms | 34% |
| 600/s | | | 1.3 ms | 40% |
| 800/s | | | 1.5 ms | 45% |
| 1,000/s | | | 1.6 ms | 54% |
| 1,300/s | | | 2.1 ms | 61% |
| 1,600/s | | | 4.5 ms | 68% |

- **Before:** holds 20 per second, and the p95 passes 300 ms at 22.
- **After:** the p95 never passed 300 ms. At 1,600 per second, the load generator dropped 155 of 32,000 requests in
  one run and none in the next, so the limit of this host with the generator on it is near there. The process's main
  thread was 68% busy.
- **The first step** rendered once: 1 miss, 7 requests that waited for it, and 993 hits.

### Things that must not defeat the cache

| Run at 500 to 1,600/s | Hits | p95 |
| --- | --- | --- |
| A different set of analytics cookies and different `utm_*` and `fbclid` values on every request, 1,000/s | 20,001 of 20,001 | 2.3 ms |
| The same, 1,600/s | 32,001 of 32,001 | 4.1 ms |
| The same with five `Accept-Language` values, 500/s, on a store that held one of them | 9,912 of 9,983, 67 waited, 4 renders | 2.5 ms |

Five languages are five pages: the run stored four new ones, one per language.

## The hot mix

The benchmark's `hot` mix (`goodwatch-benchmark/urls/hot.json`): 63% the movie page, 9% a share list page, the home
page, a show, a person, Discover, and 6% OG images. A link-preview bot sends 10% of the requests.

| Rate | Before: page p95 | Before: main thread | After: page p95 | After: main thread | After: other threads |
| --- | --- | --- | --- | --- | --- |
| 10/s | 72 ms | 41% | 34 ms | 9% | 7% |
| 20/s | 160 ms | 74% | 25 ms | 8% | 2% |
| 25/s | 200 ms | 87% | | | |
| 30/s | 11,214 ms | 92% | 23 ms | 10% | 4% |
| 100/s | | | 22 ms | 27% | 5% |
| 200/s | | | 21 ms | 47% | 16% |
| 300/s | | | 26 ms | 62% | 21% |
| 400/s | | | 42 ms | 77% | 32% |
| 500/s | | | 1,486 ms | 79% | 148% |

- **Before:** holds 25 per second and fails at 30.
- **After:** holds 400 per second and fails at 500.
- **What limits it now:** the share list page. It answers `private, no-store`, so every request for it is rendered:
  9% of the mix, 36 renders per second at 400. The page p95 of 21 to 42 ms is that page. At 500 per second, the other
  threads (OG image rendering and compression) take 1.5 cores of a host that also runs the load generator.
- The cache held 5 pages and 373 KB.

## A long-tail crawl next to the hot URL

The hot movie page at 300 per second, with a crawl of production's long tail next to it for 120 seconds. The paths
are 3,266 title URLs from production's log, each of which the data cache had never seen.

| Run | Hot URL | Long tail | Stores | Evictions | Pages held | Bytes held | Admission keys |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 titles per second, each once | 36,001 hits of 36,001, p95 14 ms | 481 renders, p50 148 ms | 0 | 0 | 1 | 108 KB | 333 |
| 6 requests per second, each title twice, with a bound of 100 pages | 36,000 hits of 36,000, p95 15 ms | 721 requests | 360 | 261 (`lru`) | 100 | 5.3 MB | 253 |

- A title that is requested once costs one counter for 60 seconds and no stored page.
- When the long tail does repeat and the store is full, the least recently used pages go. The hot page is used all
  the time and stays.
- The main thread was 41% to 43% busy in both runs.

## Stale serving

The app with a fresh time of 1 second (`PAGE_CACHE_MAX_FRESH_SECONDS=1`), and the hot movie page at 500 per second for
30 seconds.

| Requests | Hits | Stale | Rendered for a visitor | Background renders | p95 |
| --- | --- | --- | --- | --- | --- |
| 15,000 | 14,009 | 991 | 0 | 29 | 4.9 ms |

One background render ran per second, however many requests arrived while the page was stale. Every refresh in the
runs stored its page (229 of 229).

## A deploy's cold start

A container that has just become ready and has served no page, with the hot movie page at a fixed rate from the
first request on.

| Rate | Requests | Renders | First stored answer | First second: p50 / p95 / max | After the first second: p95 |
| --- | --- | --- | --- | --- | --- |
| 500/s | 5,000 | 1 | 343 ms | 2.0 / 290 / 342 ms | 2.2 ms |
| 500/s, second run | 5,000 | 1 | 363 ms | 2.6 / 333 / 343 ms | 1.8 ms |
| 50/s | 500 | 1 | 343 ms | 3.2 / 293 / 343 ms | 3.5 ms |

- The first render in a new process takes about 340 ms, because the JIT compiler is cold. It blocks the main thread,
  so the requests that arrive meanwhile are answered when it ends: about 170 requests at 500 per second.
- No request failed. The cache's own counters: 1 render, 15 to 28 requests that waited inside the cache, and the rest
  hits.
- With two instances, a deploy costs one render per instance and hot URL.

## Stored bytes compared with a fresh render

For each page on a fresh instance: request 1 is a render that isn't stored, request 2 is the render that is stored,
and requests 3 to 5 come from the store as Brotli, gzip, and without an encoding.

| Page | The stored page equals its render | Two renders equal each other |
| --- | --- | --- |
| Movie, show | Yes, in all three encodings | No: the related panel's query state holds the time of the render (`dataUpdatedAt`). Equal without that number on a warm process. |
| Person, filtered person, home, Discover, About | Yes | Yes |
| Category list (`/movies/moods`) | Yes | Yes on a warm process. The first render after a start listed other titles. |
| Share list | Not stored (`private, no-store`): five misses | Yes |

- The time in a title page is the only value that differs per request on a warm process: five renders in a row of
  the movie page, the show page, Discover, and the home page, with the cache off, are equal without that number. The
  client treats the related panel's data as never stale, so an old time doesn't make it request the panel again.
- The first render after a start can differ in more: a movie page's embedded query states come in the order in which
  the lookups finished, and a category page listed other titles while the title data was still loading. Each is a
  valid render of the page, and the stored page is one of them.
- No page holds a nonce or a request id.
- Discover copies the query string into its links. That is why the cache removes tracking parameters before the app
  renders.

## Memory

- A stored movie page takes 107 KB (47 KB Brotli, 59 KB gzip, 1 KB of headers and key). Long-tail titles average
  53 KB.
- The store is bounded at 128 MB, which is 3% of the planned 4 GB limit of the process.
- The admission counters hold at most 20,000 keys of about 150 bytes: about 3 MB at the bound. A crawl of 8 pages per
  second, as in production, holds about 500 keys.

## How to repeat

On the measurement host, with the scripts copied to `/opt/gw-pagecache/work`:

```bash
./setup.sh                                  # network, Valkey, directories
./copy-snapshot.sh <image>                  # the title snapshot from production's cache cluster, read only
./start.sh <image> SOURCE_COMMIT=test       # the app, with the cache on
./percall.sh <label> 200 /movie/603-the-matrix,movie /,home
./load.sh <label> hot-movie.txt 20 50 100 200 400
COOKIES=unique TRACK=1 ./load.sh <label> hot-movie.txt 20 1000
LONGTAIL=longtail.txt LONGTAIL_RATE=4 ./load.sh <label> hot-movie.txt 120 300
./coldstart.sh <image> /movie/603-the-matrix 500 10
docker run --rm --network gw-pagecache-net -v /opt/gw-pagecache/work:/work:ro --entrypoint node <image> \
  /work/compare.mjs http://172.31.247.20:3000 /movie/603-the-matrix /
./start.sh <image> PAGE_CACHE=off           # every request is a fresh render
docker run --rm --network gw-pagecache-net -v /opt/gw-pagecache/work:/work:ro --entrypoint node <image> \
  /work/fresh.mjs http://172.31.247.20:3000 /movie/603-the-matrix /
```

`hot-movie.txt` holds one line, `1 browser /movie/603-the-matrix`. The hot mix file has one `weight client path` line
per entry of `goodwatch-benchmark/urls/hot.json`, with the share list paths from the ignored `config.env`. Remove the
containers, the images, the network, and `/opt/gw-pagecache` when done: the directory holds the app's credentials.

## Not measured

- More than one process, and the proxy in front. The requests here go straight to the process.
- Member traffic next to the cache.
- A refresh that fails in production.
- The 128 MB bound filled with real pages.
