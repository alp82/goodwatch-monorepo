# Static assets served by the webapp process

This page says what a static request costs the webapp's Node process, what the change of October 4, 2026 did to that cost, and what remains. It belongs to the "Serve a viral traffic spike" map and is step one of "Serve static assets without the Node process". The remaining cost is the input for the owner's decision about moving assets to the proxy or a CDN.

The scripts are in [`viral-spike-static-assets/`](viral-spike-static-assets/). Raw CPU profiles aren't in Git. The production check after the deploy is in the ticket's resolution, not here.

## Summary

- **Before:** `remix-serve` served every file of the client build with `express.static` behind `compression`. It compressed each response again on every request: 5.3 ms of main-thread time and 20 ms of thread pool time for the 258 KB script. Every file, hashed or not, went out as `immutable` for a year.
- **After:** the build writes a Brotli and a gzip file next to each compressible file. A handler in front of Express answers from a manifest that it builds once at start. The same script costs 0.39 to 0.53 ms of main-thread time and no thread pool time.
- **Capacity of one process next to 5 title pages per second:** about 200 static requests per second before the page p95 doubles, and about 3,000 after.
- **What remains:** 0.3 to 0.5 ms of main-thread time per static request, of which the handler is 0.015 ms. The rest is Node's HTTP server and the socket write. At 500 page views per second with 30 to 40 static files each, that's 4 to 6 fully used main threads for static files alone. Only moving the files off the process removes it.
- **Found on the way:** the proxy gzips images, not the app. Coolify's `gzip` middleware on the HTTPS router compresses every response without a `Content-Encoding`. The app can't switch that off.

## Conditions

| Item | Value |
| --- | --- |
| Date | Sunday, October 4, 2026 |
| Host | worker3, 4 vCPUs (Intel Xeon Skylake), 7.75 GB RAM, shared with a Windmill worker and other agents' measurement containers |
| Process | One container with the Dockerfile's command, `remix-serve ./build/server/index.js`, `NODE_ENV=production`, Node 24.21.0, memory limit 3 GB |
| Before build | `origin/main` at `032ed5a5` |
| After build | The same commit plus the change. A last check ran on the change rebased onto `ea8875a1` |
| Data stores | Production Crate and Qdrant, read only. Its own single-node Valkey cluster in a container, with the title snapshot copied in |
| Search | The query encoder doesn't start (its model directory is empty and read-only). Nothing here searches |
| Client | For CPU per request: one request at a time over one keep-alive connection from a second container on the same Docker network. For the mixed run: k6 1.8.1 with fixed arrival rates, on the same host |
| CPU time | `utime + stime` of the main thread from `/proc/<pid>/task/<pid>/stat`, and of all other threads of the process, before and after each batch |

The load generator shares the 4 cores with the server. Rates above 3,000 per second include its own contention.

## What handled a static request before

Read from `node_modules/@remix-run/serve/dist/cli.js` (version 2.17.5):

1. `compression()` with its defaults: Brotli at quality 4 or gzip at level 6, for every compressible response above 1,024 bytes, on every request.
2. `express.static(build/client, { immutable: true, maxAge: "1y" })` mounted at `/`. The client build holds Vite's hashed files under `assets/` and a copy of everything in `public/`, so `robots.txt`, `site.webmanifest`, and the favicons were `immutable` for a year too. Each request cost a `stat`, an `open`, reads, and a `close` on the thread pool.
3. `express.static("public", { maxAge: "1h" })`, which finds nothing in the image: the directory isn't copied.
4. `morgan("tiny")`, one log line per request that reaches it. Static hits return before it.
5. The Remix handler. A path under `/assets/` that matches no file ends here and gets a 302 to `/`.

In front of Express, two wrappers see every request: the browser gate (a few string checks, about 0.002 ms of own time per static request) and the metrics hook.

**The metrics hook costs 0.03 to 0.07 ms per static request** (own time in the CPU profile: 0.035 ms for an image, 0.046 ms for a small script, 0.068 ms for the large one; 0.045 to 0.11 ms with what it calls). That was 1% to 3% of a static request before the change and is about 10% now.

## Main-thread CPU per static request

Milliseconds of main-thread CPU per request, 1,500 requests per case before and 4,000 after. "Other" is CPU time on the process's other threads (thread pool and V8). Transferred is the body size.

| File | Client | Before: main | Before: other | Before: bytes | After: main | After: other | After: bytes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Script, 258 KB | Brotli | 5.28 | 20.11 | 86,018 | 0.45 | 0.26 | 73,980 |
| Script, 258 KB | gzip | 5.66 | 20.32 | 85,189 | 0.44 | 0.04 | 85,068 |
| Script, 258 KB | `If-None-Match` | 0.58 | 0.19 | 0 | 0.30 | 0.04 | 0 |
| Script, 158 KB | Brotli | 3.59 | 10.77 | 54,102 | 0.34 | 0.00 | 45,905 |
| Script, 2.4 KB | Brotli | 1.39 | 1.09 | 992 | 0.30 | 0.00 | 893 |
| Stylesheet, 333 KB | Brotli | 3.98 | 12.51 | 34,933 | 0.33 | 0.00 | 27,593 |
| Stylesheet, 333 KB | gzip | 4.09 | 12.78 | 38,641 | 0.37 | 0.00 | 37,425 |
| SVG, 55 KB | Brotli | 1.90 | 2.51 | 41,235 | 0.36 | 0.00 | 40,986 |
| PNG, 224 KB | any | 1.82 | 2.41 | 224,306 | 0.48 | 0.16 | 224,306 |
| AVIF, 28 KB | any | 0.79 | 0.20 | 27,967 | 0.34 | 0.00 | 27,967 |
| TTF font, 130 KB | Brotli | 2.69 | 8.73 | 61,615 | 0.34 | 0.00 | 54,350 |
| `favicon.ico`, 15 KB | Brotli | 1.41 | 1.14 | 3,985 | 0.31 | 0.13 | 3,140 |
| `robots.txt`, 198 bytes | Brotli | 0.83 | 0.23 | 198 | 0.30 | 0.00 | 110 |
| `site.webmanifest` | Brotli | 0.84 | 0.20 | 263 | 0.29 | 0.00 | 121 |

- **The large script, repeated runs after the change:** 0.45 and 0.46 ms on the measured build, and 0.53, 0.39, and 0.47 ms on the rebased build (which also carries the new shutdown hook). Read single numbers as plus or minus 15%.
- **Cold and repeated:** neither stack caches a response, so a first request differs from a repeated one only by the JIT compiler and the page cache. The first request for the large script took 37 ms of wall time before and 14 ms after, right after a start. The first request for each other file took 2 to 15 ms before and 0.6 to 1.4 ms after.
- **A client that accepts no encoding** gets the file streamed from disk: 2.0 ms for the large script. Browsers and the benchmark never do that.
- **A WOFF2 font** (12 KB, on the rebased build): 0.39 to 0.43 ms, sent as it is.

### Where the remaining time goes

CPU profile of 6,000 repeated requests after the change, per request, without the profiler's own share:

| Part | Script, 258 KB (74 KB sent) | Script, 2.4 KB |
| --- | --- | --- |
| Socket write (`writev`) | 0.14 ms | 0.08 ms |
| Node's HTTP server, streams, events | about 0.13 ms | about 0.12 ms |
| Metrics hook, own time | 0.03 ms | 0.03 ms |
| Static handler, own time | 0.015 ms | 0.017 ms |
| Garbage collection | 0.02 ms | 0.002 ms |
| **Total** | **0.35 ms** | **0.27 ms** |

Before the change, the same profile for the large script showed about 1.6 ms of garbage collection, 0.8 ms in the compression stream, and 0.8 ms in file reads per request.

### Bodies in memory or streamed

The handler keeps the bodies a page view asks for in memory: the Brotli and gzip variants, and files without variants (images, WOFF2), each up to 256 KB and 32 MB in total. It holds 5.2 MB for the current build. Source maps and the uncompressed form of files with variants are streamed.

| File, Brotli client | In memory | Streamed from disk |
| --- | --- | --- |
| Script, 258 KB | 0.46 ms main, 0.19 other | 1.23 ms main, 1.92 other |
| Script, 2.4 KB | 0.38 ms | 0.78 ms main, 1.19 other |
| PNG, 224 KB | 0.49 ms | 1.52 ms main, 2.54 other |
| `If-None-Match` | 0.30 ms | 0.30 ms |

Memory cuts the main-thread cost to between a half and a third and keeps the thread pool free, so it stays. `STATIC_MEMORY_FILE_MAX_BYTES=0` turns it off.

## Mixed run: static requests next to title pages

k6 sends 5 title pages per second (ten warm movie and show pages in turn) and static requests at a fixed rate, 30 seconds per step. The static requests cycle through the 40 same-origin files that the movie page's HTML references (scripts, stylesheets, icons, images), with `Accept-Encoding: gzip, deflate, br`.

**Before** (13:17 to 13:22 UTC, no other measurement container running):

| Static per second | Page p50 | Page p95 | Static p95 | Main thread | Other threads | Dropped by k6 |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 55 ms | 70 ms | | 24% | 6% | 0 |
| 100 | 56 ms | 77 ms | 43 ms | 42% | 35% | 0 |
| 200 | 59 ms | 132 ms | 60 ms | 53% | 68% | 0 |
| 300 | 80 ms | 420 ms | 257 ms | 59% | 142% | 76 |
| 400 | 1,275 ms | 2,190 ms | 4,684 ms | 60% | 219% | 1,171 |
| 500 | 1,349 ms | 1,811 ms | 13,457 ms | 46% | 179% | 3,533 |

**After** (13:41 to 13:45 UTC, no other measurement container running):

| Static per second | Page p50 | Page p95 | Static p95 | Main thread | Other threads | Dropped by k6 |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 56 ms | 74 ms | | 25% | 11% | 0 |
| 1,000 | 58 ms | 77 ms | 31 ms | 56% | 7% | 14 |
| 2,000 | 67 ms | 93 ms | 32 ms | 72% | 8% | 174 |
| 3,000 | 79 ms | 138 ms | 38 ms | 82% | 6% | 562 |
| 4,000 | 109 ms | 264 ms | 50 ms | 86% | 8% | 1,895 |
| 5,000 | 306 ms | 872 ms | 107 ms | 91% | 6% | 8,293 |

- **The page p95 doubles at about 200 static requests per second before and at about 3,000 after.**
- **Before, the thread pool is the first limit.** Its four threads are full at 300 to 400 static requests per second, and the HTML's own compression then waits behind static files. The main thread is at 60%.
- **After, the main thread is the limit.** From the slope, a static request costs 0.24 to 0.31 ms of main-thread time under load (1.8 ms before, plus 3 ms on other threads).
- **A static request's p95 of 31 to 38 ms** is the time it waits behind a page render (about 55 ms each, 5 per second), not its own cost. Its p50 is 0.7 to 2 ms.
- **An earlier run of the after build** (13:34 to 13:41 UTC) overlapped a Lighthouse run of another lane on the same host. It showed the same shape with more noise: page p95 96 ms at 1,500, 138 ms at 2,000, 136 ms at 3,000.

## Transferred size

The 40 files that the movie page's HTML references, on the build of `032ed5a5`:

| Client | Before | After |
| --- | --- | --- |
| Brotli | 783,965 bytes | 724,333 bytes (-8%) |
| Scripts, stylesheets, and SVG of those, Brotli | 403,585 bytes | 344,216 bytes (-15%) |
| gzip | not measured | 783,168 bytes |

The whole client build: 684 files have variants. 15.2 MB become 3.9 MB with Brotli at quality 11 and 4.5 MB with gzip at level 9. The step takes 3.2 seconds of wall time and 13 seconds of CPU time on the dev machine.

## Design

`goodwatch-webapp/scripts/precompress.mjs` runs at the end of `npm run build`. It writes `<file>.br` and `<file>.gz` next to every file of `build/client` with one of these extensions: `js`, `mjs`, `css`, `html`, `svg`, `json`, `map`, `webmanifest`, `xml`, `txt`, `ttf`, `otf`, `ico`, `wasm`. It keeps a variant only when it's smaller than the file. The Dockerfile copies the whole `build` directory, so the image has the variants without a change.

`goodwatch-webapp/app/server/static-files.server.ts` answers before Express:

- **Manifest:** built once at start from whatever is in `build/client`, with no hand-kept list. Each entry has the file, its size, type, cache policy, an ETag from the content's SHA-1, and its variants. Building it takes 2 to 5 seconds, because it shares the main thread with the rest of the start. Requests whose path has a dot wait for it. Pages and health checks don't.
- **Lookup:** the request path is looked up in the manifest as it is, and once more after decoding when it has a `%`. No path from a request reaches the file system.
- **Negotiation:** Brotli when the client accepts `br`, else gzip, else the file. `q=0` and `*` are respected.
- **Headers:** `Content-Type`, `Content-Length`, `ETag` (different per encoding), `Cache-Control`, `Vary: Accept-Encoding` on files with variants, and `Content-Encoding` only on a variant. Images, WOFF2, and video never get one.
- **Conditional requests:** `If-None-Match` answers 304. The ETag doesn't change across deploys or processes while the content is the same.
- **`HEAD`** sends the headers. **Ranges** work on files without variants (206, 416, `If-Range`). A range on a file with variants gets the whole file.
- **Fall through:** other methods, unknown paths outside `/assets/`, file types it doesn't know, and compressible files above 1 KB without a variant go to Express as before. A build without the precompression step therefore stays correct.
- **Missing asset:** an unknown path under `/assets/` answers 404 with `Cache-Control: no-store`. It was a 302 to `/`.
- **Registration:** `startStaticFiles()` in `app/entry.server.tsx`, when the server build loads. It finds the HTTP server through Node's request event, as the browser gate and the shutdown module do, and keeps its own state. It only wraps the server on `PORT`.

### Cache headers

| Files | Before | After |
| --- | --- | --- |
| Hashed files under `/assets/`, source maps included | `public, max-age=31536000, immutable` | The same |
| `robots.txt`, `site.webmanifest`, `/sitemaps/*`, and other `txt`, `xml`, `json`, `html` files from `public/` | `public, max-age=31536000, immutable` | `public, max-age=3600` |
| Favicons, touch icons, images, and fonts from `public/` | `public, max-age=31536000, immutable` | `public, max-age=86400, stale-while-revalidate=604800` |
| A missing file under `/assets/` | 302 to `/` | 404, `no-store` |

- **One hour** for the files that crawlers and browsers read as instructions: a change is live everywhere within the hour.
- **One day** for icons, images, and fonts without a hash, with a week in which a browser may show the old file while it fetches the new one. A replaced image is live within a day. After the lifetime, a browser revalidates with the ETag and gets a 304.
- **Browsers that already have a file as `immutable`** keep it until they clear their cache. Rename a file to replace it for them.

### Source maps

Source maps stay public and `immutable`, as before. The repository is public, so they reveal nothing new, and they make production stack traces readable in the browser and in Sentry. Browsers fetch them only with developer tools open. With their variants they are 15 MB of the 31 MB client build, and two thirds of the precompression time. Removing them from the image makes sense only if Sentry gets them during the build. Whether the Coolify build uploads them wasn't checked: a local build has no token and uploads nothing.

## Previous build's files

A tab opened before a deploy asks for chunk files of the previous build. The server now answers 404 with `no-store`, so no cache keeps a wrong answer and a script tag doesn't get an HTML page. The browser-side reload on a failed chunk (from "Consolidate client script chunks") still handles the click.

Ways to keep the old files for a while:

| Option | Who | Cost |
| --- | --- | --- |
| A Docker volume mounted into the webapp, where each start copies its `assets/` and the manifest also reads the older builds | Owner adds the volume in Coolify. The app needs about 30 lines more | About 7 MB per build without source maps. At 17 deploys a day and 7 days kept: about 0.8 GB, with a purge at start |
| A CDN in front of `/assets/` | Owner (see the next section) | The CDN keeps what it has fetched for as long as its cache lives. Files nobody requested before the deploy are still missing |
| The data cache: each start writes its hashed scripts and stylesheets to Redis with a lifetime, and a miss under `/assets/` looks there before the 404 | App only, not built | About 0.85 MB per build as Brotli. At 17 deploys a day and 2 days kept: about 30 MB in a cache of three nodes with 7 GB each. Entries can be evicted, so it's best effort |

## Input for the decision about moving assets off the process

**Measured:** a static request costs 0.3 to 0.5 ms of main-thread time one at a time and 0.24 to 0.31 ms under load. One process serves about 3,000 per second next to 5 title pages per second.

**Inferred for the destination:**

- 500 page views per second with 30 to 40 static files each is 15,000 to 20,000 static requests per second: 4 to 6 fully used main threads, or 5 to 7 processes at the measured 3,000 per second.
- A first title page view costs about 12 ms of main-thread time in static files (40 files at 0.3 ms). A warm title page render costs about 69 ms. If a page cache answers the HTML in 2 to 3 ms, static files are about 80% of what a page view costs the process.
- A first title page view downloads about 0.72 MB of own static files. At 500 per second that's about 360 MB per second, or 2.9 Gbit per second. That was an estimate from before the script and image cuts: the checkpoint measured 453 KB per movie page view from the host, which is 1.8 Gbit per second at 500 per second (see [the checkpoint](viral-spike-checkpoint.md)). The host's uplink speed isn't verified here, but this is likely above it. TMDB images aren't in this number: they come from TMDB.

**Options:**

| Option | Removes | Needs from the owner |
| --- | --- | --- |
| Switch off Coolify's gzip option for the webapp, or exclude image and font types in its labels | The proxy's gzip of every image and WOFF2 response, and the missing `Content-Length` on them. Proxy CPU saved: not measured. The app compresses HTML, API responses, and static files itself, so the middleware does nothing else | One setting in the Coolify UI, then a check that HTML and API responses are still compressed |
| A static file server (nginx or Caddy) behind the proxy for `/assets/` and the `public/` files | All of the 0.3 to 0.5 ms per static request from the Node process. The file server's own cost isn't measured. Traefik v2.10 can't serve files itself | A second service in Coolify with a router rule for the static paths, and a volume that the webapp fills with `build/client` at start. The same volume can keep previous builds. The bytes still leave through the same host |
| A CDN for assets only (a pull zone with the site as origin, and the client build's public path set to the CDN host) | Almost all static requests and their bytes from the host, its proxy, and its TLS, after the first fetch per edge location. The `immutable` hashed files and the `Content-Length` and `ETag` headers of this change are what a CDN needs | An account and a DNS record. In the app: one build setting and `crossorigin` handling. At an assumed list price of about 0.01 USD per GB (not checked today): about 13 USD per spike hour at 1.3 TB, near zero otherwise |
| More webapp processes | Divides the static load with the page load. Planned anyway (a second instance on another host) | Nothing new |

## Verification

- **Every file:** [`check-static.mjs`](viral-spike-static-assets/check-static.mjs) requests every file of the client build with Brotli, gzip, and no encoding, decodes the body, compares it with the file on disk, and checks `Content-Encoding`, `Content-Length`, `ETag`, `Vary`, `Cache-Control`, and `Content-Type`. It then checks `If-None-Match` and `HEAD` for every file, ranges, and a missing asset. On the rebased build: 718 files, 3,590 requests, all checks passed.
- **Path traversal:** 16 attempts over a raw socket (`/assets/../`, encoded dots and slashes, doubled slashes, null bytes, backslashes, a path into the server build). Under `/assets/` they answer 404. Outside they reach Express and Remix as before and answer 302 or 404. None returns a file.
- **Start:** a request for `robots.txt` during the start waited 4.1 seconds for the manifest and got the one-hour policy. The readiness check answered at once.
- **Repository checks:** Biome passes on the touched files. Type errors: 228 before and after. The existing suite passes (326 tests).

## Not measured

- The proxy. The instance has no Traefik in front, so the cost of TLS, HTTP/2, and the proxy's gzip of images isn't in any number here.
- A new connection per request. All runs reuse connections, as the proxy does toward the app.
- The static file server and CDN options. Their costs are estimates.
- Rates above 5,000 per second, and a load generator on another host.

## Repeat the measurement

1. On a host with Docker on the private network, build the image from `goodwatch-webapp/Dockerfile` for both commits.
2. Put the webapp's production variables in `/opt/gw-static/bench.env` with the Redis variables pointing at `172.31.249.10` and the password `bench`. Run `setup.sh`, and copy the title snapshot with the render profile's `copy-snapshot.mjs`.
3. Copy this directory to `/opt/gw-static/work`. Start with `start.sh <image> -`, or `start.sh <image> <build directory>` to run another build with the same image.
4. `percall.sh <label> <count> <path>,<name> ...` for the CPU per request. `page-assets.mjs` writes the static file list of a page, and `mixed.sh <label> <seconds> <rate> ...` runs the mixed run with `pages.txt` and `static-<label>.txt` in the work directory.
5. For a CPU profile, start with `NODE_OPTIONS=--import /work/prof-preload.mjs`, run `profile.sh`, and read the result with `analyze-profile.mjs`.
6. `check-static.mjs <base URL> <client build directory>` checks every file. Run `busy.sh` before each run to see what else uses the host.

After a deploy, two scripts check production from any machine:

- `check-page-files.mjs <origin> <page path> ...` requests every static file that the pages' HTML references, with Brotli and with gzip, and checks the status, the headers, and that both decode to the same bytes. It also lists what the proxy encodes on the way.
- `check-surfaces.mjs <origin> <page path> ...` loads each page in headless Chromium and reports failed requests and console errors. It needs `PLAYWRIGHT` set to a `playwright-core` package.
