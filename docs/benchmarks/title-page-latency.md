# Title loader deadlines, October 19, 2026

## Finding and limits

A stalled optional episode-ratings read held a real production-build show document for **10.027 seconds**, even
though the title details and the other grid reads had finished. The show loader awaited the entire grid before SSR.
Its catch provided a fallback only after the database client's 10-second deadline. React's five-second abort timer
starts **after loaders finish**, so it cannot protect this wait.

The genre row had another gap: its timer covered missing cards, but started after awaiting the related map and
did not cover the subsequent localization. Several individually bounded reads could therefore exceed the row's
advertised budget. Essential details also had no deadline across their cache, marker, SQL and presentation reads.

These are reproduced application problems, **not a confirmed explanation of the October 18 90-second events**.
The initial live sweep returned 200 for all 378 requests over 63 titles, with a maximum of 2,302 ms. Current
container logs cover only the deployment after the reported crawl; the longest retained title request was about
2.6 seconds. The configured historical log credential refused a read query with HTTP 403. No production settings
were changed. A SQL deadline is already present, so a single ordinary stalled SQL request does not
explain a 90-second wait on this build.

## Change

- Bound the whole episode-grid dependency, including mapping, cache reads, parallel ratings queries and localized
  labels, to 1,000 ms for either client. A late or failed grid leaves a usable title page and `private, no-store`.
- Bound the whole genre-row operation, including its related-map dependency and localization, to its existing
  150 ms browser / 1,000 ms crawler budget. A late row remains incomplete and cannot enter either page cache.
- Bound essential title details to 3,000 ms across the whole read. A timeout returns **503**, `private, no-store`
  and `Retry-After: 5`; it never turns an unavailable title into a cached 404. Preserve the retry header through
  Remix's error boundary.
- Leave shared data-cache fills running under their existing backend deadlines. One departing document must not
  cancel another caller's shared read. A late successful fill can make the next request complete. No partial grid
  or partial genre row is stored as a complete HTML page.

The limits are in `app/server/title-page-budget.ts`. They are page policies, not new deployment settings. Timers
bound asynchronous waits; they cannot interrupt a blocked JavaScript thread. No healthy-query rewrite or new
cache tier was justified by these measurements.

## Measurements

All times below measure through the **complete final response body**, in milliseconds. Time to the first byte can
instead measure a 103 Early Hints response. Percentiles use nearest rank. This is a backend/render experiment;
the browser client in the sweep is a browser user agent, without JavaScript execution.

The fixed cohort contains 63 titles: 33 movies and 30 shows, 45 in the committed sitemap and 18 outside it. It
includes Captain Phillips, Don't Trust the B---- in Apartment 23, the large Johnny Carson page, long episode grids,
animation and small movies. Paths and individual timings are in
[the machine-readable evidence](title-page-latency-2026-10-19.json).

Local runs use a production build, the page role, `PAGE_CACHE=off`, an isolated single-node Valkey cluster and a
read-only copy of the title snapshot. Other cache entries are cleared **only in that isolated cluster** before
each client pass. Every title is requested three times. The first request misses title-details data; the third is
a warm **render**, not a stored HTML hit. Catalog/process stores can already be warm. SQL and Qdrant use the real
read-only data path, so the local network's database round trip remains in the measurements.

| Local condition | Titles | Before p50 / p95 / max | After p50 / p95 / max |
| --- | ---: | ---: | ---: |
| Googlebot, cold render and details | 63 | 327 / 457 / 647 | 333 / 450 / 863 |
| Browser, cold render and details | 63 | 327 / 460 / 507 | 321 / 443 / 466 |
| Googlebot, third render | 63 | 21 / 29 / 34 | 23 / 32 / 47 |
| Browser, third render | 63 | 21 / 34 / 50 | 20 / 28 / 34 |

All 756 requests in these paired local passes returned 200. Healthy-path differences are small and noisy; this
change does **not** establish a general healthy-path speedup. The additional first-request maximum is an
outlier, not evidence of a faster cold start. The exploratory first local request immediately after starting a
process took 759 ms; this is not a controlled deployment study.

| Controlled fault in a real production build | Before | After |
| --- | --- | --- |
| Hold Apartment 23's IMDb episode read open | 200 in 10,027 ms | 200 in 1,035 ms, no-store |
| Hold Captain Phillips' essential details read open | 500 in 10,011 ms | 503 in 3,020 ms, no-store, retry after 5 s |

A loopback SQL proxy held only the selected read and forwarded other statements normally. The pre-change socket
closed at its existing 10-second database deadline. Separate fixture tests exercise actual production loaders,
SSR, HTTP headers, recovery after the original query finishes and eight concurrent cold show requests. The eight
requests returned 200 together in about 1.05 seconds. These tests need no production connections.

Both live instances were also requested directly, sequentially at no more than one request per 1.1 seconds: the
two previously failing titles, Johnny Carson and Demon Slayer, both client types, three visits each. All 24
requests per instance returned 200. Maximum complete-response time was 497 ms on instance A and 768 ms on B.
Each instance returned 16 misses and eight hits. No instance-specific stall was reproduced. These direct timings
exclude the public proxy and TLS; they should not be compared as if they were public end-to-end latency.

Sixteen additional public requests covered German and Japanese browser presentation for those four titles. All
returned 200; the maximum was 529 ms. Live Redis state cannot be forcibly made cold without changing production,
so a live page-cache miss does not establish a Redis miss.

A final public recheck used the committed harness with a separate header file. All 126 requests returned 200 and
were page-cache misses. Across 63 titles, Googlebot p50 / p95 / max was 218 / 338 / 1,328 ms; browser was
218 / 573 / 3,342 ms. This measures the deployed baseline, not this unpushed patch. Public requests in all runs were
sequential, at most one per 1.1 seconds. No 5-second or 90-second event was reproduced.

The 3,342 ms response was Lilo & Stitch. Its two corresponding retained application log lines were about 100 and
55 ms, so the public duration alone does not establish slow loader work. These logs cannot distinguish proxy
queueing, connection setup and network delay. Other threads deployed the site during this investigation; live
measurements are observations of the running site, not a comparison of one pinned production build.

## Repeat and validation

From `goodwatch-webapp`, against a local production server or the public site:

```sh
python scripts/benchmark-title-pages.py --base-url "$BENCH_BASE_URL" \
  --urls ../docs/benchmarks/title-page-latency-2026-10-19.json \
  --output "$HOME/.cache/title-pages.jsonl"
npm run build
npm run test:title-timeouts
```

The committed script always uses at least 1.1 seconds between sequential requests, records redirects separately
without following them, writes its own header scratch file, and never evicts cache entries. To reproduce the
local data-cold passes, clear the isolated cache between client passes and run one client pass at a time; the
general-purpose script interleaves clients and does not promise a data-cold first visit.

Disable `TMDB_CONNECT_KEY` and `PLEX_CONNECT_KEY` in a local measurement process and restrict its SQL transport to
SELECT/WITH statements. The reused environment initially enabled TMDB cleanup: the access audit found its SELECTs
and `REFRESH TABLE doc.user_import_connection` calls. No INSERT, UPDATE or DELETE appeared in any measurement
server's logs. The processes were stopped and the local launcher corrected. Table refreshes exceeded the intended
read-only SQL scope even though no stored-row changes were observed.

Validation: 98 focused unit/regression tests passed, plus all five production-fixture tests. The unmodified
baseline and changed tree each report the same 185 existing TypeScript errors. A local mobile Lighthouse check
on the final production build scored 97 for The Matrix and 96 for Breaking Bad (LCP 2,475 / 2,730 ms, TBT 10 / 4 ms,
CLS zero). These single-run checks are sanity checks, not a before/after frontend benchmark. No client scripts,
styles, fonts or images changed.

## Owner follow-up

No infrastructure change is required for this patch. Deployment and a subsequent public-site verification are
still required; the patch was committed without pushing.

To attribute the historical 90-second events, use a credential with historical log read permission and inspect
October 18's request/ingress logs for `/movie/109424-captain-phillips` and
`/show/39331-dont-trust-the-b-----in-apartment-23`, including the response before the successful retry. Compare
request arrival, upstream instance/build, upstream connection time, final-header/body time and restart/drain
events. Check whether a 103 was sent without a final response. The successful retries were recorded near
17:56 UTC; that is a retry timestamp, not the original failure time. If a future stall reaches the app, correlate
its request id with the existing redacted SQL diagnostics and event-loop/process metrics. Without those records,
blaming a particular instance, query or proxy for the 90-second waits would be speculation.
