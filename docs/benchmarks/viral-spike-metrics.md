# Where to read the viral spike metrics

This page says where each number for the "Serve a viral traffic spike" map lives, and the exact query to read it. Two tools hold them:

- **PostHog** holds field Web Vitals from real visitors, by route pattern and device type.
- **Grafana Cloud** holds server response time, the cacheable share of responses, and the data cache hit ratio, by route pattern or cache name.

Both use the same route names. A route pattern is the route's path with its parameters, for example `/movie/:movieKey` or `/u/:handle/lists/:id`. No metric stores a concrete URL, a handle, a title key, or a query string.

## Field Web Vitals in PostHog

PostHog's JavaScript SDK captures LCP, INP, CLS, and FCP as `$web_vitals` events. The webapp adds three properties in `goodwatch-webapp/app/utils/web-vitals-telemetry.ts`:

| Property | On | Meaning |
| --- | --- | --- |
| `route_pattern` | Every event that has a path | The route the visitor was on when the event was sent. |
| `landing_route_pattern` | `$web_vitals` | The route the browser loaded from the server. |
| `ttfb_ms` | The `$web_vitals` event that carries FCP | Time to first byte of the page load, from Navigation Timing. Once per page load. |

PostHog adds `$device_type` (`Mobile`, `Tablet`, `Desktop`) by itself. Values are in milliseconds, except CLS, which has no unit.

Group by `landing_route_pattern`. LCP, FCP, and TTFB always describe the page load. CLS and INP keep counting during in-app navigation and are sent when the page is hidden, so their `route_pattern` is the last route of the visit, not the route that caused them.

A page load sends one to three `$web_vitals` events: one about 5 seconds after the first metric, and more when the page is hidden. Each event carries only the metrics that were ready, so use the `...If` aggregates below instead of `count()`.

### Query: p75 per landing route and device type

Run this in PostHog under **SQL editor** (or **Product analytics > New insight > SQL**):

```sql
SELECT
    properties.landing_route_pattern AS route,
    properties.$device_type AS device,
    countIf(properties.$web_vitals_LCP_value IS NOT NULL) AS lcp_samples,
    round(quantileIf(0.75)(toFloat(properties.$web_vitals_LCP_value), properties.$web_vitals_LCP_value IS NOT NULL)) AS lcp_p75_ms,
    round(quantileIf(0.75)(toFloat(properties.$web_vitals_INP_value), properties.$web_vitals_INP_value IS NOT NULL)) AS inp_p75_ms,
    round(quantileIf(0.75)(toFloat(properties.$web_vitals_CLS_value), properties.$web_vitals_CLS_value IS NOT NULL), 3) AS cls_p75,
    round(quantileIf(0.75)(toFloat(properties.$web_vitals_FCP_value), properties.$web_vitals_FCP_value IS NOT NULL)) AS fcp_p75_ms,
    round(quantileIf(0.75)(toFloat(properties.ttfb_ms), properties.ttfb_ms IS NOT NULL)) AS ttfb_p75_ms
FROM events
WHERE event = '$web_vitals'
    AND timestamp > now() - INTERVAL 7 DAY
    AND properties.landing_route_pattern IS NOT NULL
GROUP BY route, device
HAVING lcp_samples >= 20
ORDER BY lcp_samples DESC
```

"Good" is at or below 2,500 ms for LCP, 200 ms for INP, 0.1 for CLS, 1,800 ms for FCP, and 800 ms for TTFB, each at the 75th percentile. The landing surfaces of the map are `/`, `/movie/:movieKey`, `/show/:showKey`, `/u/:handle/lists/:id`, and `/person/:personKey`.

Events from before the deploy of this change have no `landing_route_pattern`. To read those, group by `properties.$pathname` instead.

### Insight: one metric over time

To chart one metric, create a **Trends** insight:

- Series: `$web_vitals`, aggregated by **Property value > 75th percentile** of `$web_vitals_LCP_value`.
- Breakdown: `landing_route_pattern`. Add `$device_type` as a second breakdown, or filter `$device_type = Mobile`.

PostHog's own **Web analytics > Web vitals** tab also works, but it groups by concrete path.

### What the browser data leaves out

- PostHog doesn't start on `localhost`, and it drops events from browsers it takes for bots. Lighthouse runs from the benchmark scripts may be dropped for that reason.
- Safari and Firefox report fewer of these metrics than Chromium browsers. LCP and INP come mostly from Chromium.
- The SDK in use (1.295.0) has no TTFB metric of its own. `ttfb_ms` is the webapp's addition.

## Server metrics in Grafana Cloud

The webapp process counts its own requests in memory (`goodwatch-webapp/app/server/metrics/`) and serves them in Prometheus text format on a second port, `9464`, at `/metrics`. Coolify doesn't publish that port and Traefik routes only to port 3000, so the endpoint is reachable only from containers on the same Docker network. Port 3000 has no metrics route. The Alloy instance on abio scrapes the port every 15 seconds and sends the samples to Grafana Cloud with `job="goodwatch_webapp"`.

Read them in Grafana Cloud under **Explore**, with the Prometheus data source that holds the node metrics (`job="vps_node_metrics"`).

### Metrics

| Metric | Type | Labels | Meaning |
| --- | --- | --- | --- |
| `goodwatch_http_request_duration_seconds` | Histogram | `route`, `status_class`, `audience` | Request start to the last byte handed to the socket. |
| `goodwatch_http_response_headers_seconds` | Histogram | `route`, `audience` | Request start to the response headers. Only `GET` responses with `text/html`. This is the server's part of the time to first byte for streamed pages. |
| `goodwatch_http_responses_total` | Counter | `route`, `status_class`, `audience`, `cache_control` | Finished responses. |
| `goodwatch_http_requests_in_flight` | Gauge | None | Requests being served at scrape time. |
| `goodwatch_data_cache_requests_total` | Counter | `cache`, `result` | Lookups in the Redis-backed data cache (`cached()` in `app/utils/cache.ts`). |
| `goodwatch_data_cache_miss_duration_seconds` | Histogram | `cache` | Time for every target run: `miss`, `unavailable`, `error`, `open`, `bypass`, and background refreshes. |
| `goodwatch_data_cache_refreshes_total` | Counter | `cache`, `result` | Finished background refreshes. |
| `goodwatch_redis_breaker_open_nodes` | Gauge | None | Redis nodes with an open breaker. Zero when all are closed. |
| `goodwatch_redis_breaker_events_total` | Counter | `node`, `event` | Breaker events: `opened`, `closed`, `probe_failed`, and `rejected`. Capped at 64 label sets. |
| `goodwatch_redis_client_ready` | Gauge | None | One when a Redis client is published, otherwise zero. |
| `goodwatch_redis_client_events_total` | Counter | `event` | Client events: `ready`, `connect_failed`, and `ended`. A connect attempt against an unreachable cluster counts as `ended`. Each `ended` or `connect_failed` is followed by a new connect attempt after 1, 2, 4, 8, 16, then 30 seconds. |
| `goodwatch_data_cache_in_flight` | Gauge | None | Registered cache runs at scrape time. |
| `goodwatch_related_lookups_total` | Counter | `result` | Related titles panels asked of the server: `no_fingerprint` (the title snapshot doesn't hold the source title, so the panel is empty without a Qdrant call or a cache entry), `no_point` (the same answer from Qdrant while the snapshot isn't loaded), `lookup` (went to the `related-cards` data cache). |
| `goodwatch_related_requests_total` | Counter | `variant` | `/api/related` requests: `panel` (one panel with movies and shows), `legacy` (pages from before October 4, 2026 that ask with `mediaType`). Remove the legacy branch when it stays at zero. |
| `goodwatch_data_cache_reset_guard_total` | Counter | `cache`, `event` | Events of the reset guard on caches that have a reset path. Capped at 64 label sets. |
| `goodwatch_data_cache_pending_resets` | Gauge | None | Resets that Redis hasn't confirmed yet in this process. Zero in normal hours. |
| `goodwatch_page_cache_requests_total` | Counter | `route`, `result`, `audience` | Page requests that the in-process page cache saw, by how they were answered. |
| `goodwatch_page_cache_bypass_total` | Counter | `route`, `reason` | Requests that must not use the cache. |
| `goodwatch_page_cache_misses_total` | Counter | `route`, `reason` | Requests that the app rendered, by why. |
| `goodwatch_page_cache_stores_total` | Counter | `route` | Pages stored, including refreshed ones. |
| `goodwatch_page_cache_not_stored_total` | Counter | `route`, `reason` | Renders that the cache tracked and didn't store. |
| `goodwatch_page_cache_evictions_total` | Counter | `reason` | Stored pages removed. |
| `goodwatch_page_cache_refreshes_total` | Counter | `route`, `result` | Finished background refreshes of stale pages. |
| `goodwatch_page_cache_not_modified_total` | Counter | `route` | 304 answers from the store. They also count as `hit` or `stale`. |
| `goodwatch_page_cache_entries`, `goodwatch_page_cache_bytes` | Gauge | None | Pages held, and their compressed bytes plus 1 KB each. |
| `goodwatch_page_cache_flights`, `goodwatch_page_cache_waiters`, `goodwatch_page_cache_admission_keys` | Gauge | None | Renders the cache tracks, requests waiting for one, and URLs in the admission counters. |
| `goodwatch_process_resident_memory_bytes`, `goodwatch_process_heap_used_bytes` | Gauge | None | Memory of the server process. |
| `goodwatch_process_event_loop_delay_seconds` | Gauge | `quantile` (`0.5`, `0.99`, `max`) | How late the event loop ran since the previous scrape. |
| `goodwatch_process_uptime_seconds`, `goodwatch_build_info` | Gauge | `commit` on the second | A restart or deploy shows as a reset or a new commit. |
| `goodwatch_metrics_dropped_label_sets_total` | Counter | `metric` | Label sets refused by the per-metric cap. Anything above zero is a bug. |

Label values:

- `route`: a route pattern, `static` (files under `/assets/` and from `public/`), or `unmatched` (no route, status 400 or above).
- `status_class`: `2xx`, `3xx`, `4xx`, `5xx`.
- `audience`: `member` when the request carries the Supabase auth cookie, else `anon`. Only the cookie's presence is read.
- `cache_control`: what the response's `Cache-Control` header allows. `shared` has `public` or `s-maxage` and nothing private. `keyed` has exactly `private, max-age=0` and a `GW-Cache-Identity` starting with `anon;`: the in-process page cache may store it under URL plus identity, but intermediaries must honor private. Other `private` responses have `private`, `no-store`, or `no-cache`. `none` is everything else.
- `cache`: the cache name passed to `cached()`. The three related-title caches have request data in their name, so they report as `related-movie`, `related-show`, and `related-by-category`.
Share list reads report as `share-list-view-v1` and `share-list-availability-v1`.

For `goodwatch_data_cache_requests_total`, `result` has nine values:

- `hit`: The lookup returned a fresh value.
- `stale`: The lookup returned an expired value while a refresh may run in the background.
- `miss`: No usable value was found, and this call ran the target.
- `joined`: No usable value was found, and this call waited for an existing run.
- `unavailable`: No Redis client was available, and this call ran the target.
- `error`: The cache read failed or exceeded the 1-second Redis command limit, and this call ran the target.
- `open`: The key's Redis node is marked down. The lookup skipped Redis and ran the target.
- `bypass`: The lifetime was zero or negative, so the call ran the target without using Redis or deduplication.
- `reset_pending`: This process has an unconfirmed reset for the key. The lookup skipped Redis, ran the target or waited for a run, and stored nothing.

The breaker opens at the first timeout or connection failure of a node. It fails commands for that node's slots at once. While traffic continues, it probes in the background, with at most one probe in flight: one second after it opened, and one second after each failed probe. A probe to a silent node takes up to one second, so probes run about every two seconds. The first answer closes the breaker. Healthy nodes keep serving their slots. The client disconnects an ended or failed cluster before retrying, with delays from one to 30 seconds.

Before this change, `stale` meant "expired value found, target run inline".

For `goodwatch_data_cache_refreshes_total`, `result` is `ok` (value stored), `error` (target threw or storage failed), or `discarded` (a reset or newer run replaced the refresh, so it stored nothing). After a refresh with result `error`, no new refresh starts for that key for 30 seconds; lookups keep counting `stale`.

For `goodwatch_data_cache_reset_guard_total`, `event` has six values. Only caches declared with `declareResettableCache` report them (`user-settings` and `share-list-view-v1` today). The design is [ADR 0006](../adr/0006-reset-markers-for-the-data-cache.md).

- `reset_confirmed`: Redis acknowledged a reset at the first attempt.
- `reset_unconfirmed`: Redis didn't acknowledge a reset. The key stays pending in this process, which retries every 5 seconds.
- `retry_confirmed`: A retried reset was acknowledged.
- `store_rejected`: A run finished after a reset in any process, so the store script refused its value. A background refresh also counts `discarded`.
- `store_skipped`: A run didn't try to store, because its lookup couldn't read the marker, the key was pending, or the run took 270 seconds or longer.
- `join_refused`: A lookup found a registered run that had seen another marker, and started its own run.

The page cache metrics come from `goodwatch-webapp/app/server/page-cache.server.ts`. The cache is described in [page-cache.md](../page-cache.md). Its counters appear with the first page request, and its gauges with the start of the process. With `PAGE_CACHE=off`, none of them exist.

For `goodwatch_page_cache_requests_total`, `result` has five values. The response header `GW-Page-Cache` says `hit`, `stale`, `miss` (for `miss` and `joined`), or `bypass`.

- `hit`: answered from the store, fresh.
- `stale`: answered from the store past its fresh time, while one background render refreshes it.
- `joined`: waited for another request's render and was answered from the store.
- `miss`: the app rendered it. `goodwatch_page_cache_misses_total` says why.
- `bypass`: the request must not use the cache. `goodwatch_page_cache_bypass_total` says why.

`audience` is read from the cookie again when the request is counted, apart from the cache's own decision. A `member` row with `hit`, `stale`, or `joined` would mean that a member got a stored page.

| Metric | Label | Values |
| --- | --- | --- |
| `goodwatch_page_cache_bypass_total` | `reason` | `member` (the auth cookie), `gate` (the browser gate answers the request), `long_url` (over 2,048 characters), `shutdown` |
| `goodwatch_page_cache_misses_total` | `reason` | `not_admitted` (first request for the URL in 60 seconds), `lead` (a repeated URL: this render is stored, and others wait for it), `probe` (a repeated URL that wasn't storable before: nobody waits), `pass` (the URL wasn't storable and is inside its pass period), `busy` (a render is in flight that can't be joined, or a limit is reached), `wait_timeout` (waited 3 seconds), `released` (waited, and the render wasn't stored), `head` (a HEAD request without a stored page) |
| `goodwatch_page_cache_not_stored_total` | `reason` | `not_admitted` (the URL didn't repeat during the render), `unstorable` (a 200 response that no cache may store: a private route, a cookie, an incomplete title page, a render error), `status` (not 200), `aborted` (the client left), `too_large`, `compress_error`, `reset` |
| `goodwatch_page_cache_evictions_total` | `reason` | `lru` (a bound was reached), `expired` (past the stale time), `reset`, `gone` (a refresh answered a redirect or a 404) |
| `goodwatch_page_cache_refreshes_total` | `result` | `ok`, `error` (the render failed or took over 15 seconds), `not_storable` (a 200 response that may not be stored this time), `gone` |

Before the route list has loaded (the first requests after a start), `route` is `unmatched`.

Histogram buckets are 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 5, and 10 seconds. The map's target of 300 ms is a bucket edge, so the share of requests under 300 ms is exact. Percentiles are estimates between two edges.

### Queries

Set the range to the benchmark run. With a 15 second scrape, `[1m]` is the shortest window that works. Use `[5m]` for normal traffic.

Response time per route, 95th percentile, full response and time to headers:

```promql
histogram_quantile(0.95, sum by (le, route) (rate(goodwatch_http_request_duration_seconds_bucket{job="goodwatch_webapp", audience="anon"}[5m])))

histogram_quantile(0.95, sum by (le, route) (rate(goodwatch_http_response_headers_seconds_bucket{job="goodwatch_webapp", audience="anon"}[5m])))
```

Share of anonymous responses under 300 ms, per route (the target is 0.95 or higher):

```promql
sum by (route) (rate(goodwatch_http_request_duration_seconds_bucket{job="goodwatch_webapp", audience="anon", le="0.3"}[5m]))
/
sum by (route) (rate(goodwatch_http_request_duration_seconds_count{job="goodwatch_webapp", audience="anon"}[5m]))
```

Requests per second per route, and the server error ratio:

```promql
sum by (route) (rate(goodwatch_http_responses_total{job="goodwatch_webapp"}[5m]))

sum(rate(goodwatch_http_responses_total{job="goodwatch_webapp", status_class="5xx"}[5m]))
/
sum(rate(goodwatch_http_responses_total{job="goodwatch_webapp"}[5m]))
```

Data cache hit ratio per cache name, and the cost of a miss:

```promql
sum by (cache) (rate(goodwatch_data_cache_requests_total{job="goodwatch_webapp", result="hit"}[5m]))
/
sum by (cache) (rate(goodwatch_data_cache_requests_total{job="goodwatch_webapp", result!="bypass"}[5m]))

histogram_quantile(0.95, sum by (le, cache) (rate(goodwatch_data_cache_miss_duration_seconds_bucket{job="goodwatch_webapp"}[5m])))

sum by (cache, result) (rate(goodwatch_data_cache_requests_total{job="goodwatch_webapp", result=~"unavailable|error|open"}[5m]))
```

Lookups that skipped an open Redis node, per cache:

```promql
sum by (cache) (rate(goodwatch_data_cache_requests_total{job="goodwatch_webapp", result="open"}[5m]))
```

Open breakers per process:

```promql
goodwatch_redis_breaker_open_nodes{job="goodwatch_webapp"}
```

Breaker events per node:

```promql
sum by (node, event) (rate(goodwatch_redis_breaker_events_total{job="goodwatch_webapp"}[5m]))
```

Redis client ready per process:

```promql
goodwatch_redis_client_ready{job="goodwatch_webapp"}
```

Share of lookups served without waiting for the target, per cache:

```promql
sum by (cache) (rate(goodwatch_data_cache_requests_total{job="goodwatch_webapp", result=~"hit|stale"}[5m]))
/
sum by (cache) (rate(goodwatch_data_cache_requests_total{job="goodwatch_webapp", result!="bypass"}[5m]))
```

Share of lookups that ran the target, excluding bypasses and background refreshes:

```promql
sum by (cache) (rate(goodwatch_data_cache_requests_total{job="goodwatch_webapp", result=~"miss|unavailable|error|open"}[5m]))
/
sum by (cache) (rate(goodwatch_data_cache_requests_total{job="goodwatch_webapp", result!="bypass"}[5m]))
```

Joined calls per second:

```promql
sum by (cache) (rate(goodwatch_data_cache_requests_total{job="goodwatch_webapp", result="joined"}[5m]))
```

Background refresh outcomes per second, by result:

```promql
sum by (cache, result) (rate(goodwatch_data_cache_refreshes_total{job="goodwatch_webapp"}[5m]))
```

Reset guard events per second, and resets that wait for Redis:

```promql
sum by (cache, event) (rate(goodwatch_data_cache_reset_guard_total{job="goodwatch_webapp"}[5m]))

max(goodwatch_data_cache_pending_resets{job="goodwatch_webapp"})
```

Registered cache runs at scrape time:

```promql
goodwatch_data_cache_in_flight{job="goodwatch_webapp"}
```

Event loop lateness, and whether the scrape works:

```promql
goodwatch_process_event_loop_delay_seconds{job="goodwatch_webapp", quantile="0.99"}

up{job="goodwatch_webapp"}
```

### Two instances

Each webapp instance is scraped by the Alloy on its own host, and its series carry that host's `VPS_INSTANCE_NAME` as the `instance` and `host` labels (`gw-abio`, `gw-vector1`). Counters and histograms are per process. What that means for the queries above:

- **Rates, ratios, and percentiles work as written.** Every query that starts with `sum(...)`, `sum by (route) (...)`, `sum by (cache) (...)`, or `histogram_quantile(..., sum by (le, ...) (...))` already adds the instances up, because `instance` isn't in the `by` list. The result is the site's number.
- **Add `instance` to the `by` list to compare the instances**, for example to see whether the proxy balances evenly or whether one host is slower:

```promql
sum by (instance) (rate(goodwatch_http_responses_total{job="goodwatch_webapp"}[5m]))

histogram_quantile(0.95, sum by (le, instance) (rate(goodwatch_http_request_duration_seconds_bucket{job="goodwatch_webapp", audience="anon"}[5m])))

sum by (instance, cache) (rate(goodwatch_data_cache_requests_total{job="goodwatch_webapp", result="hit"}[5m]))
/
sum by (instance, cache) (rate(goodwatch_data_cache_requests_total{job="goodwatch_webapp", result!="bypass"}[5m]))
```

- **Gauges return one series per instance.** Read them per instance, or aggregate them on purpose:

| Query | With two instances |
| --- | --- |
| `goodwatch_http_requests_in_flight`, `goodwatch_data_cache_in_flight` | `sum(...)` for the site, plain for each process. |
| `goodwatch_redis_breaker_open_nodes` | `max(...)`: each process has its own breakers, and one open breaker is enough to look. |
| `goodwatch_redis_client_ready` | `min(...)`: zero when any process has no client. |
| `goodwatch_data_cache_pending_resets` | `max(...)`: a reset is pending only in the process that issued it. |
| `goodwatch_process_resident_memory_bytes`, `goodwatch_process_heap_used_bytes` | Per instance. A sum is the footprint across hosts, which no single host has. |
| `goodwatch_process_event_loop_delay_seconds{quantile="0.99"}` | Per instance, or `max(...)`. Never average quantiles. |
| `goodwatch_process_uptime_seconds`, `goodwatch_build_info` | Per instance. Two different `commit` values mean a deploy is between the two hosts: `count(count by (commit) (goodwatch_build_info{job="goodwatch_webapp"})) > 1`. |
| `up{job="goodwatch_webapp"}` | Per instance. `sum(...)` is the number of instances that answer the scrape. |

- **Breaker events** (`goodwatch_redis_breaker_events_total`) add up across instances in `sum by (node, event)`. Each process opens and closes its own breaker, so one node outage shows two `opened` events.
- **Reset guard events** (`goodwatch_data_cache_reset_guard_total`) show a reset in the process that received the write (`reset_confirmed`) and its effect in the other one (`store_rejected`, `join_refused`).
- **The series count doubles**: `count({job="goodwatch_webapp"})` counts both instances. Check it against the tenant's limit after the second instance starts.
- **The page cache formula** keeps working: its numerator sums the responses of all instances.

### Page cache hit ratio

The in-process page cache answers repeated anonymous page requests. No cache runs in front of the webapp yet.

The share of page requests answered from the in-process store, in total and per route:

```promql
sum(rate(goodwatch_page_cache_requests_total{job="goodwatch_webapp", result=~"hit|stale|joined"}[5m]))
/
sum(rate(goodwatch_page_cache_requests_total{job="goodwatch_webapp"}[5m]))

sum by (route) (rate(goodwatch_page_cache_requests_total{job="goodwatch_webapp", result=~"hit|stale|joined"}[5m]))
/
sum by (route) (rate(goodwatch_page_cache_requests_total{job="goodwatch_webapp", result!="bypass"}[5m]))
```

A member that got a stored page. This must stay empty:

```promql
sum by (route, result) (rate(goodwatch_page_cache_requests_total{job="goodwatch_webapp", audience="member", result=~"hit|stale|joined"}[5m])) > 0
```

Why requests were rendered, why they bypassed, and why renders weren't stored:

```promql
sum by (reason) (rate(goodwatch_page_cache_misses_total{job="goodwatch_webapp"}[5m]))

sum by (reason) (rate(goodwatch_page_cache_bypass_total{job="goodwatch_webapp"}[5m]))

sum by (route, reason) (rate(goodwatch_page_cache_not_stored_total{job="goodwatch_webapp"}[5m]))
```

What the store holds, how fast it turns over, and whether refreshes work:

```promql
goodwatch_page_cache_entries{job="goodwatch_webapp"}

goodwatch_page_cache_bytes{job="goodwatch_webapp"}

sum by (reason) (rate(goodwatch_page_cache_evictions_total{job="goodwatch_webapp"}[5m]))

sum by (result) (rate(goodwatch_page_cache_refreshes_total{job="goodwatch_webapp"}[5m]))
```

- Evictions with `lru` while `goodwatch_page_cache_bytes` sits at 134,217,728 mean the byte bound is too small for the URLs that repeat.
- `goodwatch_page_cache_waiters` above zero for more than a few seconds means renders are slow: waiting requests go to the app after 3 seconds.
- With two instances, each process has its own store. Sum the counters, and read the gauges per instance.

The share of anonymous responses that a shared cache could store, per route. This is the upper limit of a page cache hit ratio:

```promql
sum by (route) (rate(goodwatch_http_responses_total{job="goodwatch_webapp", audience="anon", cache_control=~"shared|keyed"}[5m]))
/
sum by (route) (rate(goodwatch_http_responses_total{job="goodwatch_webapp", audience="anon"}[5m]))
```

Member responses that a shared cache could store. This must stay empty, because member HTML must never enter the page cache:

```promql
sum by (route) (rate(goodwatch_http_responses_total{job="goodwatch_webapp", audience="member", cache_control="shared", route!~"static|/api/.*|/og/.*"}[5m])) > 0
```

Error responses that a shared cache could store. This must stay empty:

```promql
sum by (route, status_class) (rate(goodwatch_http_responses_total{job="goodwatch_webapp", status_class=~"4xx|5xx", cache_control="shared"}[5m])) > 0
```

When a page cache (Varnish is the likely choice) also sits in front of the webapp, every request that reaches the webapp is a miss or a pass of that cache. The cache layer exports its own request counter, and the hit ratio is one minus the webapp's share:

```promql
1 - sum(rate(goodwatch_http_responses_total{job="goodwatch_webapp"}[5m])) / sum(rate(<the cache layer's request counter>[5m]))
```

Add the cache layer's exporter as one more scrape target in `goodwatch-metrics/webapp.alloy`, with a `job` label of its own, so that both numbers sit in the same data source. A per-route ratio needs the cache layer to label its counter with the same route patterns, or to send a header that the webapp can count.

### Limits of the server data

- The first request after a start isn't counted: the counting starts in the root loader of that request. Coolify's health check sends it within seconds of the start.
- A request that the client drops before the response finishes isn't counted in the histograms.
- All counters restart at zero on a deploy. `rate()` handles that. During the rolling switch, scrapes can alternate between the old and the new container for a few seconds.
- The time is measured inside the Node process. It leaves out Traefik, TLS, and the network. The k6 numbers from `goodwatch-benchmark/` include them.
- The health check requests `/` every 5 seconds, so `/` always shows 0.2 requests per second of its own.

## How the scrape is deployed

`goodwatch-metrics/config.alloy` and `docker-compose.yml` are the same on all hosts. A host that runs a webapp instance (abio, and vector1 for the second instance) adds two files:

- `webapp.alloy` scrapes `goodwatch-webapp:9464` (override with `WEBAPP_METRICS_TARGET`) and forwards to the remote write of `config.alloy`.
- `docker-compose.webapp.yml` mounts that file, starts Alloy with the directory so that both files load, and attaches Alloy to the `coolify` network.

The name `goodwatch-webapp` is a network alias that Coolify gives the container: the **Network aliases** field in the application's settings in Coolify. It takes effect with the next deploy. The container's own name changes on every deploy, so Alloy can't use it.

On abio, in the `goodwatch-metrics` directory of the repository checkout:

```sh
git pull
grep -q '^COMPOSE_FILE=' .env || echo 'COMPOSE_FILE=docker-compose.yml:docker-compose.webapp.yml' >> .env
docker compose up -d grafana-alloy
docker logs --since 2m grafana-alloy 2>&1 | grep -iE 'level=error|webapp'
```

`COMPOSE_FILE` in `.env` makes every later `docker compose` command on abio use both files.

On vector1, the checkout is at an old commit with local changes, so check the two files out one by one instead of pulling:

```sh
cd /root/goodwatch/goodwatch-monorepo
git fetch origin main
git checkout FETCH_HEAD -- goodwatch-metrics/webapp.alloy goodwatch-metrics/docker-compose.webapp.yml
cd goodwatch-metrics
grep -q '^COMPOSE_FILE=' .env || echo 'COMPOSE_FILE=docker-compose.yml:docker-compose.webapp.yml' >> .env
docker compose up -d grafana-alloy
docker logs --since 2m grafana-alloy 2>&1 | grep -iE 'level=error|webapp'
```

Coolify gives the container on every server the same alias, so the target is `goodwatch-webapp:9464` on both hosts. While no instance runs on a host, the name doesn't resolve: Alloy logs nothing at its `info` level and reports `up{job="goodwatch_webapp"}` as 0 for that host. The scrape starts by itself with the first deploy.

To check the endpoint from the host without Grafana:

```sh
# Inside the webapp container: does the process serve metrics?
docker exec "$(docker ps -q --filter label=coolify.resourceName=goodwatch-webapp | head -1)" wget -qO- http://localhost:9464/metrics | grep -c '^goodwatch_'
# From the coolify network: does the alias reach it? This is the path Alloy uses.
docker run --rm --network coolify busybox:1.37-musl wget -qO- http://goodwatch-webapp:9464/metrics | grep -c '^goodwatch_'
```

To check the added series count in Grafana Cloud, and to drop a metric if the count is too high:

```promql
count({job="goodwatch_webapp"})
```

Add a `rule { source_labels = ["__name__"], regex = "<metric>_bucket", action = "drop" }` block to the `prometheus.relabel "webapp"` component in `webapp.alloy`.

## Node series that Alloy drops

The Grafana Cloud tenant has a limit of 15,000 active series. Over the limit, Mimir rejects every new series with `err-mimir-max-active-series` and keeps accepting the ones it already knows. So the newest series, such as the webapp's, are the ones that go missing.

To stay under the limit, the `prometheus.relabel "trim_node_metrics"` component in `config.alloy` drops these node series on every host before the remote write:

| Dropped | Rule |
|---|---|
| `node_scrape_collector_*`, `go_*`, `promhttp_*` | Scrape bookkeeping and node_exporter's own runtime metrics |
| `node_cpu_guest_seconds_total`, `node_softnet_*`, `node_schedstat_*`, `node_cooling_device_*` | Per-CPU detail beyond `node_cpu_seconds_total` |
| `node_network_*` with `device` matching `veth*`, `br-*`, `docker*`, or `lo` | Virtual interfaces |
| `node_filesystem_*` with a pseudo `fstype` such as `tmpfs` or `overlay`, or a `mountpoint` under `/run` or `/var/lib/docker` | Pseudo and container filesystems |
| `node_disk_*` with `device` matching `sr`, `loop`, or `ram` plus a number | Virtual block devices |

Everything else stays, including `node_cpu_seconds_total` per core and mode, memory, load, pressure, and all series for real disks, mounts, and interfaces. On October 4, 2026, the rules took the 15 hosts from 13,638 to 5,366 node series.

To get a family back, delete its rule or narrow its `regex`, then roll the file out. The hosts don't follow `main` on their own. On each host, in the repository checkout:

```sh
git fetch origin main
git checkout FETCH_HEAD -- goodwatch-metrics/config.alloy
cd goodwatch-metrics && docker compose restart grafana-alloy
```

To count what one host sends, read Alloy's own metrics from the host. Alloy listens only inside its container:

```sh
nsenter -t "$(docker inspect -f '{{.State.Pid}}' grafana-alloy)" -n \
  curl -s http://127.0.0.1:12345/metrics | grep -E '^prometheus_remote_(storage_samples_(failed_)?total|write_wal_storage_active_series)'
docker logs --since 5m grafana-alloy 2>&1 | grep -c max-active-series
```
