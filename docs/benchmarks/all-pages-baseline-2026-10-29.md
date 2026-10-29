# All-pages production baseline, October 29, 2026

## Conditions and limits

This guest baseline ran from 2026-10-29T08:34:09.791Z to 2026-10-29T11:54:57.318Z. It covers 14 P1, 24 P2, and 14 P3 URL examples, with three mobile and three desktop Lighthouse reports per URL. All 364 HTTP probes returned 200, including the no-encoding and Googlebot probes. Every final raw Lighthouse report has all four category scores, no runtime error, and no load warning. Twenty member or authorization-dependent route entries were skipped.

Run ID: `20261029T083409Z-pages-guest-baseline-final-2026-10-29`. Raw reports and `summary.json` remain in the ignored benchmark results directory. The inventory accounts for 294 route files: 64 page entries and 230 explicit exclusions.

Lighthouse 13.5.0 ran in the existing Docker image with Chromium 155.0.8059.79. Mobile used CPU slowdown 2.7; desktop used 1. The host exposed 32 logical CPUs. Lighthouse CPU benchmark indices ranged from 2,556 to 4,770.5. The 2.7 setting follows the existing budget convention and was not recalibrated for this host. These numbers cannot be directly compared with the older generator reports or interpreted as real-phone or field measurements.

The controlled browser sent GET requests only, with at most two requests in flight and analytics host blocking off. It blocked 2,325 attempted non-GET requests. Background workers and WebSockets were disabled. Request queuing and blocked telemetry affect both performance and browser-error audits. The suite measures that constrained load. Ordinary HTML responses stream normally.

Collection started at source commit `b9e473665` and resumed at `e167686e6` and `0be687137`; all three recorded clean worktrees. Harness development exposed two request-queue defects. The repeated-font-pause fix required refreshing affected captures in this run. All 17 title captures with load warnings were repeated, and their originals remain as `*.before-font-fix.json.gz`. Failed share-list captures remain as `*.failed.json.gz`. Explorer exposed an intermittent hang in Lighthouse's unscored back/forward-cache diagnostic. The final runner omits `bf-cache`, which has zero category-score weight, and records that omission. Earlier completed reports retain their successful diagnostic. First-load metrics are collected before that diagnostic. No unresolved failed capture remains in the final medians.

All 28 P1 PSI device requests returned HTTP 429 after four attempts each. Google supplied no remote lab or CrUX field data. The run does not verify distant visitor performance. Production deploys and data were not pinned during the collection window.

## Coverage of the owner's targets

| Measure in this constrained lab run | URL examples |
| ----------------------------------- | ------------ |
| Mobile performance at least 90      | 37 of 52     |
| Desktop performance 100             | 36 of 52     |
| Mobile LCP at most 2,500 ms         | 35 of 52     |
| Mobile SEO 100                      | 35 of 52     |

Sixteen of the 17 pages below SEO 100 explicitly block indexing. This includes filtered Discover, personal tools, authentication pages, share lists, and the draft blog surfaces. A noindex failure does not establish an SEO defect. Missing image alternatives on the profile lists tab and share list, and missing descriptions on search results, the collection list, and email verification are separate audit findings. Failed audit lists contain the union across successful runs, including zero-weight diagnostics.

## Fifteen priority findings

Times and payloads below are mobile medians unless a row names an individual HTTP probe. KB means bytes divided by 1,024; MiB means bytes divided by 1,048,576. These observations prioritize unstable layouts, slow paints, heavy payloads, and server outliers.

| #   | Page                           | Measured evidence                                                                                                                                                              |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | /taste/quiz                    | Lowest mobile performance: 61. LCP 5,427 ms; CLS 0.351.                                                                                                                        |
| 2   | /lists/new                     | Mobile performance 68; largest layout shift, CLS 0.508. LCP 3,769 ms.                                                                                                          |
| 3   | /u/alperortac/wishlist         | Largest mobile LCP: 5,794 ms; performance 79. Images 1.70 MiB; total 2.23 MiB.                                                                                                 |
| 4   | /u/alperortac/lists            | Mobile LCP 5,547 ms; performance 79. SEO 92 and accessibility 91; failed image-alt audit.                                                                                      |
| 5   | /shows/moods/funny             | Mobile LCP 5,409 ms; performance 79. Accessibility 91; failed label and color-contrast audits.                                                                                 |
| 6   | /discover?q=heist              | P1 search results: mobile LCP 4,707 ms, performance 82, SEO 58. Failed meta-description audit; is-crawlable also fails because search results explicitly use noindex.          |
| 7   | /movies/genres/drama           | Mobile LCP 4,593 ms; performance 83. One browser probe reached 1,646 ms TTFB; median 164 ms.                                                                                   |
| 8   | /shows/moods                   | Heaviest captured page: 2.52 MiB total; 2.07 MiB in 67 images, despite mobile performance 98.                                                                                  |
| 9   | /movies/genres                 | 2.09 MiB total and 1.66 MiB images. Largest browser-probe TTFB: 3,453 ms; median 220 ms. The outlier was a page-cache miss.                                                    |
| 10  | /discover?type=movie           | Largest script transfer: 456,577 bytes (445.9 KB) across 53 scripts. Unfiltered /discover also transfers 438.3 KB of scripts.                                                  |
| 11  | /u/alperortac/stats            | Largest compressed HTML body: 151,319 bytes (147.8 KB). The uncompressed probe returned 1,219,720 bytes; maximum browser TTFB 1,705 ms.                                        |
| 12  | /u/alperortac                  | Browser-probe TTFB reached 1,736 ms versus median 336 ms. That miss reported data;dur=1559.0 in Server-Timing.                                                                 |
| 13  | /u/alperortac/tropes           | Googlebot TTFB 1,754 ms; full response 1,840 ms. Server-Timing reported data;dur=1105.0 on a miss.                                                                             |
| 14  | /u/alperortac/lists/o1H79d4fVu | SEO 61 and accessibility 87. Failed image-alt, link-name, and color-contrast audits. The route explicitly uses noindex, so its is-crawlable failure represents current policy. |
| 15  | /show/1396-breaking-bad        | P1 title accessibility 87. Failed aria-required-children, button-name, and color-contrast audits; mobile performance 97 and SEO 100.                                           |

The separate /shows/best probe also reached 1,608 ms TTFB on a cache miss, against a 169 ms median. The earlier reported ten-second no-encoding symptom on /hot-on-socials did not appear in its one no-encoding probe: TTFB was 74 ms and the full response took 186 ms. That single observation does not establish that the intermittent issue is fixed.

Started: 2026-10-29T08:34:09.791Z. Base: https://goodwatch.app. Audience: guest.

Lighthouse 13.5.0; 3 runs per device; analytics blocking: false. GET only, two concurrent requests maximum. Browser request queuing changes lab timings.

## P1

| Page | Mobile perf/a11y/bp/seo | Desktop perf | LCP ms | TBT ms | CLS | TTFB ms | HTML KB | JS KB | Top failed audits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / | 99/97/100/100 | 100 | 1771 | 10 | 0.000 | 94 | 28.7 | 348.9 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; image-delivery-insight: Improve image delivery; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests |
| /movie/603-the-matrix | 97/97/100/100 | 100 | 2077 | 1 | 0.000 | 205 | 60.1 | 367.6 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; speed-index: Speed Index; cache-insight: Use efficient cache lifetimes; forced-reflow-insight: Forced reflow |
| /movie/14337-primer | 96/92/100/100 | 99 | 2183 | 0 | 0.002 | 89 | 50.0 | 371.6 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; speed-index: Speed Index; cache-insight: Use efficient cache lifetimes; lcp-discovery-insight: LCP request discovery |
| /show/1399-game-of-thrones | 97/93/100/100 | 100 | 2470 | 16 | 0.001 | 152 | 64.8 | 367.6 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; speed-index: Speed Index; cache-insight: Use efficient cache lifetimes; lcp-discovery-insight: LCP request discovery |
| /show/1396-breaking-bad | 97/87/100/100 | 100 | 2032 | 0 | 0.001 | 176 | 62.8 | 371.8 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; speed-index: Speed Index; cache-insight: Use efficient cache lifetimes; image-delivery-insight: Improve image delivery |
| /person/138-quentin-tarantino | 98/96/100/100 | 98 | 2092 | 0 | 0.000 | 142 | 33.8 | 362.0 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; image-delivery-insight: Improve image delivery; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests |
| /discover | 95/100/96/100 | 100 | 2660 | 5 | 0.028 | 161 | 29.4 | 438.3 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; speed-index: Speed Index; image-delivery-insight: Improve image delivery; network-dependency-tree-insight: Network dependency tree |
| /discover?type=movie | 97/100/100/69 | 100 | 2430 | 5 | 0.042 | 170 | 27.7 | 445.9 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; cumulative-layout-shift: Cumulative Layout Shift; speed-index: Speed Index; image-delivery-insight: Improve image delivery |
| /discover?q=heist | 82/100/100/58 | 97 | 4707 | 12 | 0.051 | 139 | 17.2 | 350.0 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; cumulative-layout-shift: Cumulative Layout Shift; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests |
| /movies/best | 99/96/100/100 | 100 | 1917 | 0 | 0.000 | 152 | 44.4 | 357.4 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; speed-index: Speed Index; image-delivery-insight: Improve image delivery; network-dependency-tree-insight: Network dependency tree |
| /shows/best | 99/96/100/100 | 100 | 1790 | 0 | 0.000 | 169 | 43.0 | 357.5 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; speed-index: Speed Index; image-delivery-insight: Improve image delivery; network-dependency-tree-insight: Network dependency tree |
| /movies | 99/96/100/100 | 100 | 1765 | 0 | 0.000 | 111 | 17.9 | 272.5 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; image-delivery-insight: Improve image delivery; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests |
| /shows | 98/96/100/100 | 100 | 1804 | 0 | 0.000 | 118 | 17.8 | 272.8 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; image-delivery-insight: Improve image delivery; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests |
| /for-you | 99/100/100/69 | 100 | 1758 | 0 | 0.000 | 103 | 15.9 | 325.7 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; speed-index: Speed Index; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests |

## P2

| Page | Mobile perf/a11y/bp/seo | Desktop perf | LCP ms | TBT ms | CLS | TTFB ms | HTML KB | JS KB | Top failed audits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /movies/genres/drama | 83/91/100/100 | 98 | 4593 | 22 | 0.000 | 164 | 29.3 | 366.3 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; speed-index: Speed Index; image-delivery-insight: Improve image delivery; lcp-discovery-insight: LCP request discovery |
| /shows/moods/funny | 79/91/96/100 | 97 | 5409 | 16 | 0.000 | 145 | 28.8 | 366.4 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; speed-index: Speed Index; image-delivery-insight: Improve image delivery; lcp-discovery-insight: LCP request discovery |
| /movies/genres | 100/96/100/100 | 100 | 1261 | 3 | 0.000 | 220 | 44.7 | 357.8 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; image-delivery-insight: Improve image delivery; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests |
| /shows/moods | 98/96/96/100 | 100 | 1955 | 27 | 0.000 | 244 | 48.9 | 359.0 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; image-delivery-insight: Improve image delivery; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests |
| /blog | 98/96/100/69 | 100 | 1840 | 0 | 0.000 | 92 | 14.6 | 239.4 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests; unused-javascript: Reduce unused JavaScript |
| /hot-on-socials | 98/100/100/100 | 100 | 1804 | 0 | 0.000 | 116 | 17.6 | 258.4 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests; unused-javascript: Reduce unused JavaScript |
| /lists/o1H79d4fVu | 99/100/100/58 | 100 | 1760 | 0 | 0.000 | 143 | 14.7 | 324.6 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests; unused-javascript: Reduce unused JavaScript |
| /lists/new | 68/100/100/69 | 83 | 3769 | 0 | 0.508 | 154 | 41.6 | 273.5 | largest-contentful-paint: Largest Contentful Paint; cumulative-layout-shift: Cumulative Layout Shift; cache-insight: Use efficient cache lifetimes; cls-culprits-insight: Layout shift culprits; image-delivery-insight: Improve image delivery |
| /new/us/netflix | 98/96/100/100 | 100 | 2193 | 14 | 0.000 | 217 | 41.3 | 257.7 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; cache-insight: Use efficient cache lifetimes; image-delivery-insight: Improve image delivery; lcp-discovery-insight: LCP request discovery |
| /new/us | 98/96/100/100 | 100 | 1906 | 50 | 0.000 | 250 | 60.8 | 257.7 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; speed-index: Speed Index; cache-insight: Use efficient cache lifetimes; image-delivery-insight: Improve image delivery |
| /people | 99/100/100/100 | 100 | 1803 | 0 | 0.000 | 119 | 22.6 | 329.3 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; image-delivery-insight: Improve image delivery; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests |
| /taste | 98/96/100/69 | 100 | 1758 | 0 | 0.000 | 104 | 14.7 | 437.9 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; speed-index: Speed Index; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests |
| /taste/quiz | 61/100/96/69 | 88 | 5427 | 0 | 0.351 | 157 | 102.6 | 353.1 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; cumulative-layout-shift: Cumulative Layout Shift; speed-index: Speed Index; cls-culprits-insight: Layout shift culprits |
| /u/alperortac | 97/93/100/100 | 100 | 2269 | 0 | 0.000 | 336 | 58.4 | 415.6 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; cache-insight: Use efficient cache lifetimes; image-delivery-insight: Improve image delivery; lcp-discovery-insight: LCP request discovery |
| /u/alperortac/lists/o1H79d4fVu | 92/87/100/61 | 100 | 2653 | 0 | 0.000 | 143 | 19.6 | 270.8 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; speed-index: Speed Index; cache-insight: Use efficient cache lifetimes; image-delivery-insight: Improve image delivery |
| /u/alperortac/lists | 79/91/100/92 | 97 | 5547 | 0 | 0.000 | 155 | 21.3 | 347.7 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; cache-insight: Use efficient cache lifetimes; image-delivery-insight: Improve image delivery; lcp-discovery-insight: LCP request discovery |
| /u/alperortac/scores | 84/96/100/100 | 99 | 4458 | 33 | 0.000 | 219 | 47.5 | 421.7 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; speed-index: Speed Index; cache-insight: Use efficient cache lifetimes; image-delivery-insight: Improve image delivery |
| /u/alperortac/seen | 98/96/100/100 | 100 | 1897 | 0 | 0.000 | 254 | 55.3 | 420.1 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; cache-insight: Use efficient cache lifetimes; image-delivery-insight: Improve image delivery; network-dependency-tree-insight: Network dependency tree |
| /u/alperortac/shows | 100/92/100/100 | 100 | 1085 | 0 | 0.000 | 78 | 28.4 | 417.0 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; cache-insight: Use efficient cache lifetimes; image-delivery-insight: Improve image delivery; network-dependency-tree-insight: Network dependency tree |
| /u/alperortac/stats | 96/93/100/100 | 100 | 2253 | 4 | 0.000 | 355 | 147.8 | 336.0 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; speed-index: Speed Index; cache-insight: Use efficient cache lifetimes; image-delivery-insight: Improve image delivery |
| /u/alperortac/tropes | 98/96/100/100 | 96 | 1997 | 0 | 0.028 | 116 | 53.7 | 334.9 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; speed-index: Speed Index; cache-insight: Use efficient cache lifetimes; image-delivery-insight: Improve image delivery |
| /u/alperortac/wishlist | 79/96/96/100 | 100 | 5794 | 5 | 0.000 | 261 | 53.8 | 419.8 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; cache-insight: Use efficient cache lifetimes; image-delivery-insight: Improve image delivery; lcp-discovery-insight: LCP request discovery |
| /watch-next | 99/100/100/66 | 100 | 1770 | 0 | 0.028 | 114 | 14.6 | 330.5 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests; unused-javascript: Reduce unused JavaScript |
| /blog/streaming-by-country-2026 | 99/92/100/69 | 100 | 1758 | 0 | 0.000 | 92 | 26.3 | 251.6 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests; unused-javascript: Reduce unused JavaScript |

## P3

| Page | Mobile perf/a11y/bp/seo | Desktop perf | LCP ms | TBT ms | CLS | TTFB ms | HTML KB | JS KB | Top failed audits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /about | 99/96/100/100 | 100 | 1762 | 0 | 0.000 | 104 | 16.2 | 242.8 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; image-delivery-insight: Improve image delivery; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests |
| /disclaimer | 99/100/96/100 | 100 | 1790 | 2 | 0.000 | 105 | 14.5 | 235.8 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests; interactive: Time to Interactive |
| /discord | 89/95/100/100 | 100 | 3596 | 0 | 0.000 | 110 | 21.9 | 255.0 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; image-delivery-insight: Improve image delivery; lcp-discovery-insight: LCP request discovery; network-dependency-tree-insight: Network dependency tree |
| /explorer | 85/100/100/100 | 100 | 3429 | 23 | 0.000 | 217 | 75.3 | 364.4 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; total-blocking-time: Total Blocking Time; speed-index: Speed Index; network-dependency-tree-insight: Network dependency tree |
| /forgot-password | 86/100/100/69 | 98 | 4122 | 0 | 0.000 | 114 | 20.1 | 282.7 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; speed-index: Speed Index; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests |
| /how-it-works | 99/96/100/100 | 100 | 1830 | 0 | 0.000 | 115 | 17.8 | 253.9 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; image-delivery-insight: Improve image delivery; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests |
| /privacy | 99/100/100/100 | 100 | 1862 | 0 | 0.000 | 112 | 23.2 | 207.2 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests; unused-javascript: Reduce unused JavaScript |
| /reset-password | 89/100/100/69 | 95 | 3661 | 0 | 0.000 | 127 | 20.2 | 249.8 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests; interactive: Time to Interactive |
| /sign-in | 89/100/100/69 | 95 | 3637 | 0 | 0.000 | 122 | 20.6 | 245.6 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests; interactive: Time to Interactive |
| /sign-up | 89/96/100/69 | 95 | 3635 | 0 | 0.000 | 81 | 20.0 | 245.5 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests; interactive: Time to Interactive |
| /support | 99/100/100/100 | 100 | 1831 | 0 | 0.000 | 122 | 19.2 | 229.1 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests; unused-javascript: Reduce unused JavaScript |
| /terms | 99/100/100/100 | 100 | 1796 | 0 | 0.000 | 110 | 15.6 | 201.1 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests; unused-javascript: Reduce unused JavaScript |
| /use-with-ai | 99/97/100/100 | 99 | 1892 | 0 | 0.000 | 107 | 24.5 | 226.2 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; image-delivery-insight: Improve image delivery; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests |
| /verify-email | 89/100/100/58 | 99 | 3652 | 0 | 0.000 | 105 | 15.2 | 247.2 | first-contentful-paint: First Contentful Paint; largest-contentful-paint: Largest Contentful Paint; speed-index: Speed Index; network-dependency-tree-insight: Network dependency tree; render-blocking-insight: Render-blocking requests |

## PageSpeed Insights

| Page                          | Device  | HTTP status | Performance | LCP ms | URL field data | Origin field data | Error                                      |
| ----------------------------- | ------- | ----------- | ----------- | ------ | -------------- | ----------------- | ------------------------------------------ |
| /                             | mobile  | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /                             | desktop | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /movie/603-the-matrix         | mobile  | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /movie/603-the-matrix         | desktop | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /movie/14337-primer           | mobile  | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /movie/14337-primer           | desktop | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /show/1399-game-of-thrones    | mobile  | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /show/1399-game-of-thrones    | desktop | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /show/1396-breaking-bad       | mobile  | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /show/1396-breaking-bad       | desktop | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /person/138-quentin-tarantino | mobile  | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /person/138-quentin-tarantino | desktop | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /discover                     | mobile  | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /discover                     | desktop | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /discover?type=movie          | mobile  | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /discover?type=movie          | desktop | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /discover?q=heist             | mobile  | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /discover?q=heist             | desktop | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /movies/best                  | mobile  | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /movies/best                  | desktop | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /shows/best                   | mobile  | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /shows/best                   | desktop | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /movies                       | mobile  | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /movies                       | desktop | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /shows                        | mobile  | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /shows                        | desktop | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /for-you                      | mobile  | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |
| /for-you                      | desktop | 429         | n/a         | n/a    | Unavailable    | Unavailable       | Keyless quota exceeded after four attempts |

## Slow server responses

| Page                 | Request   | Status | TTFB ms | Full response ms |
| -------------------- | --------- | ------ | ------- | ---------------- |
| /shows/best          | Browser 1 | 200    | 1608    | 1676             |
| /movies/genres/drama | Browser 1 | 200    | 1646    | 1709             |
| /movies/genres       | Browser 1 | 200    | 3453    | 3533             |
| /u/alperortac        | Browser 1 | 200    | 1736    | 1896             |
| /u/alperortac        | Browser 3 | 200    | 908     | 1017             |
| /u/alperortac/stats  | Browser 1 | 200    | 1705    | 1904             |
| /u/alperortac/tropes | Googlebot | 200    | 1754    | 1840             |

## Skipped and unavailable

- my-library.$list.tsx: Member page requires --cookie-file
- my-library._index.tsx: Member page requires --cookie-file
- my-library.hidden.tsx: Member page requires --cookie-file
- my-library.scores.tsx: Member page requires --cookie-file
- my-movies.tsx: Member page requires --cookie-file
- my-shows.tsx: Member page requires --cookie-file
- u.$handle_.lists.$id_.edit.tsx: Requires an owned editable list and member cookie; public GET baseline does not open edit handlers
- wishlist.tsx: Member page requires --cookie-file
- lists.mine.tsx: Member page requires --cookie-file
- auth.mcp.consent.tsx: Requires a live OAuth authorization request and member credentials; do not replay authorization flows in a page benchmark
- settings._index.tsx: Member page requires --cookie-file
- settings.account.tsx: Member page requires --cookie-file
- settings.connected-apps.tsx: Member page requires --cookie-file
- settings.country.tsx: Member page requires --cookie-file
- settings.discover-privacy.tsx: Member page requires --cookie-file
- settings.imports.tsx: Member page requires --cookie-file
- settings.language.tsx: Member page requires --cookie-file
- settings.profile.tsx: Member page requires --cookie-file
- settings.services.tsx: Member page requires --cookie-file
- settings.tsx: Member page requires --cookie-file

## Measurement errors
