# All-pages performance benchmark

Use this suite to measure first loads for every public page type. It complements the [navigation benchmark](navigation-speed.md), the [render path budget](viral-spike-render-path-budget.md), and the existing Lighthouse commands. It does not change their behavior.

## Run the suite

Use Node.js 20 or later, Docker with Linux host networking, and the existing Lighthouse image recipe. Lighthouse 13.5.0 runs on Node.js 22 inside the container. The host runner has no npm dependencies.

```sh
docker build -t gw-bench-lighthouse:pages-13.5.0 goodwatch-benchmark/lighthouse
node --test goodwatch-benchmark/pages/pages.test.mjs
node goodwatch-benchmark/pages/run.mjs --tier P1,P2,P3 --runs 3 --psi --label baseline
```

The default base URL is `https://goodwatch.app`. Run one suite at a time and keep the measuring machine idle. The runner processes tiers in order, runs one Lighthouse browser at a time, and holds at most two browser requests in flight. Server probes run sequentially, with a one-second pause between samples. This is a low-rate diagnostic suite, not a load test.

```sh
node goodwatch-benchmark/pages/run.mjs --tier P1 --only /movies/best --runs 1 --label check
node goodwatch-benchmark/pages/run.mjs --verify --server-only --label inventory
node goodwatch-benchmark/pages/run.mjs --resume goodwatch-benchmark/results/<run-directory> \
  --tier P1,P2,P3 --runs 3 --psi --label baseline
node goodwatch-benchmark/pages/run.mjs --compare <run-A-directory> <run-B-directory> > comparison.md
```

`--resume` keeps completed pages and raw Lighthouse runs. Supply the original base URL, tiers, run count, audience, PSI setting, image, analytics setting, server-only setting, and path filter. A failed Lighthouse run remains incomplete and can be retried. The summary updates after every page and device. Resume metadata records the source commit and dirty state for each continuation. Resume retains incomplete raw reports with a `.failed.json.gz` suffix and retries their slots. A directory lock prevents two pages runners from overlapping. If the runner is killed, inspect its process and the `gw-pages-<pid>` container before removing a stale `goodwatch-benchmark/results/.pages-lock` directory. Existing benchmark commands have separate locks; do not run them concurrently.

Use `--base-url http://127.0.0.1:<port>` for an isolated local server, and `--image <tag>` to select an already built image. The suite never starts a webapp. Follow the repository's isolated-server recipe; never start a webapp with its production `.env`.

## Choose pages and audiences

[pages.json](../../goodwatch-benchmark/pages/pages.json) accounts for every file in `goodwatch-webapp/app/routes` exactly once, either as a page or as an explicit exclusion. The validation test fails when a new route lacks a decision. Each page has a priority, audiences, and example paths. One dynamic route can have several examples. The title set includes large shows, a popular movie, and the smaller movie _Primer_. Search results use `/discover?q=heist`, the destination of the legacy search redirect.

- P1 covers the start page, title and person pages, Discover, search results, best lists, movie and show hubs, and For you.
- P2 covers categories, people, new streaming pages, social trends, Taste, public profiles, public lists, Watch next, and blog posts.
- P3 covers supporting pages, authentication forms, legal pages, and other pages.

`unavailable` explains a page for which no suitable example is available. These entries remain visible in skipped results. Redirects and resource routes have explicit reasons in `skippedRoutes`. The suite requires a 200 HTML response before launching Lighthouse; it does not follow server-probe redirects or misreport an error page as a successful page benchmark. A route that redirects for only one audience can still have an example for the other audience.

Guest mode skips member-only pages. To measure members, store a Cookie header value in a private file outside the repository:

```sh
node goodwatch-benchmark/pages/run.mjs --cookie-file "$HOME/.cache/gw-perf/member-cookie" \
  --tier P1,P2,P3 --label member
```

Member mode measures routes marked `member`, including shared routes such as For you. It sends credentials only to the exact base origin. The runner never prints the cookie or copies the cookie file. It redacts its values from raw Lighthouse reports. Results can still contain personal page content, list addresses, or profile information. Keep member results private and review any artifact before sharing it.

A GET-only browser does not make a server's GET handler read-only. For example, member visit handlers can acknowledge page visits. Run member mode against an isolated target or with explicit authorization for those effects. The guest production baseline uses no member credentials.

## Understand the request policy

Server probes send a Chrome user agent, `Accept: text/html`, `Accept-Encoding: br, gzip`, `Accept-Language: en-US`, and the anonymous `gw_browser=1` browser-gate cookie. Each URL gets five probes, then one probe with no `Accept-Encoding` header and one with a Googlebot user agent. The Googlebot probe uses the same language and encoding settings so the user-agent comparison changes one input. No probe follows redirects.

TTFB measures the interval from request start to response headers, including DNS, TCP, and TLS. Byte counts measure the response body on the wire, before decompression; they exclude response headers. Full response duration includes the streamed body. Every sample retains status, encoding, `GW-Page-Cache`, `Server-Timing`, `Cache-Control`, and any redirect location. Samples with TTFB or full duration above one second appear in the slow-response table. Repeated probes can warm application caches; these are not cold-cache measurements.

Lighthouse uses the existing Chromium and Lighthouse 13.5.0 image. It measures all four categories. It omits `bf-cache`, a diagnostic with zero score weight that can hang Chromium while visiting its internal `chrome://terms` page. This omission does not change category scores. Use the navigation benchmark for back/forward behavior. Mobile uses Lighthouse's mobile simulation with CPU slowdown 2.7, as the existing budget suite does. Desktop uses Lighthouse's desktop configuration and CPU slowdown 1. The runner records each report's CPU benchmark and configured slowdown. Compare runs on the same machine and with the same configuration. It retains every successful report; it does not apply the older budget report's CPU or observed-FCP exclusion rule.

The browser guard blocks every non-GET request, known stateful GET endpoints, and WebSocket requests. It disables background workers, bypasses service workers, and scopes member headers to the base origin. It releases ordinary requests only when the full response finishes, preserving normal HTML streaming. DevTools stylesheet inspection makes additional requests without network completion events; the guard reads those response bodies before releasing their slots. Chromium can pause a font request more than once; continuations with the same network request ID reuse its existing slot. The `repeatedPauses` counter records those events. Analytics host blocking defaults to off. `--block-analytics` additionally blocks the PostHog, Sentry, Google Analytics, Google Tag Manager, and DoubleClick hostname families defined in `pages/guard.mjs`. Same-origin write requests remain blocked in either mode. Per-run guard counters show blocked requests and the maximum concurrency.

These safeguards affect timing. A visitor can load more resources in parallel and can send telemetry writes. The baseline measures this constrained GET-only page load; it is not directly comparable to an unrestricted Lighthouse run. Browser queueing can increase network delays and Lighthouse warnings. The guard does not override server-side effects of GET handlers or restrict third-party audit infrastructure.

## Read the output

Results go to `goodwatch-benchmark/results/<UTC timestamp>-pages-<label>/`. The benchmark `.gitignore` excludes these new directories.

- `summary.json` contains configuration, source commit, dirty state, response samples, per-device medians, all failed audit IDs and titles by category (the union across successful runs), LCP elements, render-blocking details, third-party origins, guard counters, PSI data, skipped routes, and errors.
- `summary.md` contains a table per tier, slow server responses, skipped pages, and errors.
- Each page directory contains mobile and desktop `*.json.gz` Lighthouse reports and guard counters. With PSI, it also contains compressed PSI responses. Transient jobs and Chromium profiles live under `~/.cache/gw-perf/scratch-bench/` and are removed when the runner finishes. The cookie file is mounted read-only and never copied.

| Column                  | Meaning                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| Page                    | Example path, including meaningful query parameters                                                |
| Mobile perf/a11y/bp/seo | Median mobile performance, accessibility, best practices, and SEO scores, each on a 0 to 100 scale |
| Desktop perf            | Median desktop performance score; JSON includes the other desktop categories                       |
| LCP ms                  | Median simulated mobile largest contentful paint                                                   |
| TBT ms                  | Median mobile total blocking time                                                                  |
| CLS                     | Median mobile cumulative layout shift, without a unit                                              |
| TTFB ms                 | Median of the five independent browser HTTP probes, including connection setup                     |
| HTML KB                 | Median compressed HTML body bytes from those probes, divided by 1,024                              |
| JS KB                   | Median mobile transferred script bytes, divided by 1,024                                           |
| Top failed audits       | First five failed mobile audits, with IDs and titles; JSON contains all failures for both devices  |

JSON also includes FCP, speed index, Lighthouse document TTFB, script count, image bytes, total transfer bytes, render-blocking requests, third-party origins, and the LCP element snippets from each run. Resource totals use the existing `scripts/budget.mjs` extractor and Lighthouse's capture window. They include dynamically loaded resources and HTTP transfer overhead. They do not describe resources loaded after scrolling or interaction. Metrics are independent medians and need not come from the same run. Lighthouse load warnings remain attached to summaries and raw reports. They can indicate an incomplete capture even when category scores exist. Failed or missing runs do not contribute to medians; the successful and attempted counts remain visible. `n/a` means no measurement, never zero.

Comparison mode prints B minus A for both devices and server metrics, retaining added and removed pages. Positive score deltas improve; positive time and byte deltas regress. Check configuration and run counts before interpreting a comparison.

## Add remote and field evidence

`--psi` requests PageSpeed Insights for P1 URLs, mobile and desktop, sequentially and without an API key. It waits 15 seconds before each API call and retries quota and transient server errors up to four attempts with increasing delays. It records API failures rather than inventing remote scores.

When available, `summary.json` includes PSI lab medians from its single report and both URL-level and origin-level CrUX field data. Missing field data means insufficient or unavailable field evidence. PSI uses Google's infrastructure and its own browser policy; local request guards and analytics blocking do not apply to Google's browser. Its lab scores are a separate observation, not a controlled regional comparison or a known geographic location. A keyless quota failure leaves far-away visitor performance unverified.

## Verify the browser guard

The optional integration check starts a small loopback fixture inside Docker. It verifies GET-only traffic, the two-request cap through complete response bodies, and DevTools CSS inspection with three external stylesheets. The stylesheets catch a deadlock that a plain HTML fixture does not reproduce.

```sh
mkdir -p "$HOME/.cache/gw-perf/scratch-bench/guard-check"
docker run --rm --network host --shm-size=1g --env TMPDIR=/out/tmp \
  --volume "$PWD/goodwatch-benchmark/pages:/suite:ro" \
  --volume "$HOME/.cache/gw-perf/scratch-bench/guard-check:/out" \
  --entrypoint node gw-bench-lighthouse:pages-13.5.0 /suite/guard.integration.mjs
```
