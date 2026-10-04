# Front-end weight audit on production

Measured on 2026-10-04 (00:12 to 00:45 UTC) for [Audit front-end weight on production](https://github.com/alp82/goodwatch-monorepo/issues/246), a child of [Serve a viral traffic spike](https://github.com/alp82/goodwatch-monorepo/issues/237). Every number comes from production `https://goodwatch.app`, not from a local build. No production code changed.

## How to read this document

- **Verified** means a request, a response header, or a Lighthouse audit shows it, and the source line explains it.
- **Inference** means reasoning from measured numbers. The text says so each time.
- **Estimate** marks every expected gain. No fix was applied, so no gain was measured.
- Sizes are transferred (compressed) bytes unless the text says "raw".
- Source paths are relative to `goodwatch-webapp/` at `origin/main` commit `919d809a`.

## Answer

One anonymous title page view sends **131 requests to the webapp host**: 107 static assets and 24 dynamic requests. At 500 page views per second, that is 65,500 requests per second, of which 12,000 reach loaders and API routes. The page then downloads 13.5 MB (movie) to 34.8 MB (show) of TMDB images, through 381 to 495 redirects.

Three causes explain most of it, and each has a small fix:

1. The related titles section mounts all nine fingerprint panels at once. That costs 16 `/api/related` requests, 287 extra poster downloads (about 8.4 MB), and about 5,000 extra DOM elements per title page view.
2. No TMDB image loads lazily, and cast photos use the `original` size. Five images are in the first viewport. The page loads 613 to 797.
3. The app shell loads 75 to 107 JavaScript chunks and sends five dynamic requests on every page, before the page's own content asks for anything.

Mobile Lighthouse scores are 30 to 37 on every surface. Largest Contentful Paint (LCP) is 9.1 to 15.7 s (good is 2.5 s or less). Total Blocking Time (TBT) is 7.5 to 9.9 s on title pages (good is 200 ms or less). Discover has a layout shift of 0.79 to 0.82 in two of seven runs (good is 0.1 or less).

## Method

| Tool | What it measured | Runs |
| --- | --- | --- |
| `./bench.sh lighthouse` (Lighthouse 13.5.0, Docker on worker3, mobile profile, simulated slow 4G and 4x CPU, public path) | Scores, LCP element and breakdown, TBT, main-thread work per script, unused JavaScript, render-blocking resources, layout shift culprits | 3 runs each for home, movie, show, person, and discover, plus 5 more for discover. One discover run failed. |
| Headless Chrome 154 with `playwright-core` on the dev machine, Pixel 7 emulation, no cookies | Every request by origin, type, phase (load, then scroll), cache headers, encoding, protocol. Image attributes. HTML composition. | 1 run per surface without throttling. 1 run each for home, movie, person, and discover with applied throttling (1.6 Mbps, 150 ms latency, 4x CPU). |
| `curl` | Response headers, compression, HTML sizes of long-running shows, chunk contents | About 30 GET requests |

Notes on the method:

- `goodwatch-webapp` has no Playwright dependency. The capture script used `playwright-core` from the local Bun cache with the system Chrome. The script is [`frontend-weight-audit/capture.cjs`](frontend-weight-audit/capture.cjs), and the per-surface request counts are in [`frontend-weight-audit/requests.json`](frontend-weight-audit/requests.json).
- Both tools blocked `POST /api/og-image-warm`, as the benchmark runner does. The request is counted as one dynamic request per page view, because real browsers send it.
- A deploy went live during the first Lighthouse run (the asset manifest changed from `manifest-85097d62.js` to `manifest-68a32a80.js`). One home run and one movie run loaded without scripts (110 and 318 requests, scores 77 and 52). The medians below are not affected, because two of three runs were normal.
- About 55 page loads in total. No sign-up, no sign-in, no form posts, no load test.

## Numbers per surface

### Lighthouse, mobile, median

| Surface | Score | FCP | LCP | TBT | CLS | Weight | Requests |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home `/` | 34 | 5.3 s | 10.0 s | 1.4 s | 0 | 1.39 MB | 127 |
| Movie `/movie/603-the-matrix` | 30 | 3.4 s | 9.6 s | 7.5 s | 0 | 16.9 MB | 948 |
| Show `/show/1396-breaking-bad` | 32 | 3.6 s | 9.1 s | 9.9 s | 0 | 39.3 MB | 1,176 |
| Person `/person/138-quentin-tarantino` | 37 | 3.2 s | 12.2 s | 2.0 s | 0 | 2.96 MB | 239 |
| Discover `/discover` (7 runs) | 30 | 3.2 s | 15.7 s | 3.3 s | 0.028, and 0.79 to 0.82 in 2 runs | 2.58 MB | 296 |
| Share list `/u/<handle>/lists/<id>` | Not measured | | | | | | |

Lighthouse simulates the slow network. With throttling applied in the browser instead (one run each, dev machine), a visitor on a 1.6 Mbps connection sees:

| Surface | FCP | LCP | Load event |
| --- | --- | --- | --- |
| Home | 4.0 s | 5.4 s | 6.9 s |
| Movie | 16.2 s | 25.9 s | 79.6 s |
| Person | 10.7 s | 14.4 s | 15.3 s |
| Discover | 6.2 s | 9.6 s | 14.1 s |

Inference: on a slow connection, every byte the parser discovers early competes with the render-blocking CSS and the LCP image. The first paint tracks the total early weight, not the HTML. The movie page's 15 MB of eager images delays its first paint to 16 s.

### Requests to the webapp host per page view

Load phase: navigation plus 10 seconds, anonymous first visit, empty browser cache.

| Surface | Same-origin total | Static | of which scripts | Dynamic | Dynamic requests |
| --- | --- | --- | --- | --- | --- |
| Home | 94 | 88 (810 KB) | 75 | 6 | document, `POST /api/tonight`, `POST /api/living-room/picks`, `GET /api/search-config`, `POST /api/e`, `POST /api/og-image-warm` |
| Movie | 131 | 107 (1,042 KB) | 93 | 24 | document, 16 x `GET /api/related`, `POST /api/tonight`, `GET /api/genres/all`, `GET /api/movie/collection`, `GET /api/search-config`, `POST /api/e`, 1 loader prefetch, `POST /api/og-image-warm` |
| Show | 130 | 107 (1,042 KB) | 93 | 23 | As movie, without the collection request |
| Person | 101 | 95 (671 KB) | 85 | 6 | document, `POST /api/tonight`, `GET /api/search-config`, `POST /api/e`, 1 loader prefetch, `POST /api/og-image-warm` |
| Discover | 123 | 116 (797 KB) | 107 | 7 | As person, plus `POST /api/poster-impressions` |
| Missing share list (404) | 129 | 120 (790 KB) | 112 | 9 | document, 6 loader prefetches, `GET /api/search-config`, `POST /api/e` |

After the load phase:

- Scrolling to the footer adds 19 script requests and 3 loader requests (`/movies`, `/shows`, `/discover`) on every surface with the standard footer.
- Discover adds one `POST /api/discover/results` and 40 posters per page of results. Scrolling 60 viewports loaded 9 pages.
- Nothing polls. The 15 seconds of idle time after scrolling produced no requests.

All 107 static assets send `Cache-Control: public, max-age=31536000, immutable`, so a returning visitor sends none of them. The viral scenario is first-time visitors, so the full count applies. At 500 title page views per second:

| | Per page view | At 500 page views per second |
| --- | --- | --- |
| Static, cacheable | 107 | 53,500 req/s |
| Dynamic | 24 | 12,000 req/s |
| Total on the webapp host | 131 | 65,500 req/s |

### All requests per page view, load phase

| Surface | Requests | Weight | TMDB requests | of which redirects | TMDB weight | Other third-party requests |
| --- | --- | --- | --- | --- | --- | --- |
| Home | 121 | 1.3 MB | 8 | 0 | 0.2 MB | 19 |
| Movie | 928 | 15.1 MB | 763 | 381 | 13.5 MB | 34 |
| Show | 1,155 | 36.5 MB | 991 | 495 | 34.8 MB | 34 |
| Person | 233 | 2.8 MB | 116 | 50 | 1.8 MB | 16 |
| Discover | 290 | 2.5 MB | 151 | 75 | 1.4 MB | 16 |

**What the 949 requests on the movie page are:** 382 images from `image.tmdb.org`, 381 redirects from `www.themoviedb.org` (each image URL in the source points at the redirecting host), 131 requests to the webapp host, 15 country flags from GitHub Pages, 11 from YouTube (inside the trailer frame, 1.0 MB), 6 from the PostHog proxy, 4 avatars from DiceBear, and about 10 others (Google Tag Manager, Google Analytics, Google Fonts, JustWatch, a texture image).

### HTML documents

| Page | Compressed | Raw | Inlined loader data | DOM elements after load |
| --- | --- | --- | --- | --- |
| Home | 16 KB | 59 KB | 1 KB | 430 |
| Movie (The Matrix) | 61 KB | 433 KB | 140 KB | 7,906 |
| Show (Breaking Bad) | 84 KB | 623 KB | 152 KB | 9,442 |
| Show (The Simpsons) | 243 KB | 2.23 MB | Not split | Not loaded in a browser |
| Show (Grey's Anatomy) | 405 KB | 2.96 MB | 544 KB | Not loaded in a browser |
| Person | 31 KB | 181 KB | 32 KB | 1,403 |
| Discover | 26 KB | 154 KB | 33 KB | 1,278 |

What inflates title page HTML:

- The dehydrated related titles state is 87 KB raw on every title page (62% of the movie page's loader data).
- The cast is unbounded. Breaking Bad sends 223 actors (30 KB of JSON). Grey's Anatomy sends 2,734 actors (366 KB of JSON) and renders 2,825 `<img>` tags. Its full response took 2.3 s with `curl`.
- Class attributes are 37 to 44% of the raw HTML.

The benchmark smoke run reported a 770 KB show page. Breaking Bad is 84 KB today. Long-running shows reach 405 KB, so the size depends on the title.

### Largest Contentful Paint element per surface

| Surface | LCP element | Why it's late |
| --- | --- | --- |
| Home | `room-phone-*.avif` (90 KB), `fetchpriority="high"`, in the HTML | It loads in 154 ms. Lighthouse reports 2.0 s of render delay. Six render-blocking stylesheets and 75 script requests come first. |
| Movie, show | Backdrop `www.themoviedb.org/t/p/w1920_and_h800_multi_faces/...` (133 to 218 KB), shown 416 px wide | No `fetchpriority`. The URL redirects to a second host that has no preconnect. It competes with 600 to 800 eager images. |
| Person | Backdrop `image.tmdb.org/t/p/w1280/...` (165 KB), priority Low | No `fetchpriority`. It competes with 63 eager posters. |
| Discover | First poster in the grid (`w300_and_h450_bestv2`) | No `fetchpriority`. The URL redirects. The grid needs 107 scripts first. |

### Main thread

Lighthouse on title pages, 4x CPU slowdown:

| Script | Movie | Show | Person | Home |
| --- | --- | --- | --- | --- |
| `index-NaWRGODI.js` (React DOM: hydration) | 13.4 s | 14.6 s | 2.1 s | 2.0 s |
| `module-DM2CjcOI.js` (PostHog) | 7.1 s | 8.5 s | 1.7 s | 0.9 s |
| `entry.client-*.js` (Sentry, with session replay) | 2.9 s | 3.1 s | 0.7 s | 0.5 s |
| PostHog session recorder | 1.4 s | 0.1 s (2.4 s of long tasks) | 0.1 s | 0.3 s |
| Google tag | 1.0 s | 0.7 s | 0.7 s | 0.8 s |
| Total main-thread work | 37.8 s | 42.4 s | 9.8 s | 10.9 s |

Inference: React, PostHog, and Sentry all cost five to eight times more on title pages than on the person page. Their cost follows the DOM size (7,900 to 9,400 elements against 1,400), which follows the nine related titles panels and the cast list.

### Transport and caching

| Check | Result |
| --- | --- |
| Protocol | HTTP/2 on every same-origin request. No `Alt-Svc` header, so no HTTP/3. |
| Text compression | Brotli on HTML, JavaScript, CSS, and JSON. |
| Static asset cache headers | `public, max-age=31536000, immutable` on every file, including unversioned files from `public/` (`robots.txt`, `site.webmanifest`, favicons, `/images/hooks/sign-up-hook.png`). |
| Static asset compression | On the fly. Compressed responses have no `Content-Length` and carry two `Vary: Accept-Encoding` headers. |
| Images | PNG and WebP files are sent with `Content-Encoding: gzip`. `rotten-logo-icon-250.png` is 224,306 bytes raw and 224,346 bytes after gzip. |
| Who serves `/assets` | Inference: the Node process. The `ETag` has the size-and-time format of Express static serving (`W/"51543-1a10441a2a4"`). |
| Document | `max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400`, `Vary: Cookie, Accept-Language, Accept-Encoding`. |
| API responses | `/api/related`, `/api/genres/all`, and `/api/movie/collection` send no `Cache-Control`. `/api/search-config` sends `no-store`. `/api/tonight` sends `private, no-store`. |
| Source maps | Public: `/assets/root-*.js.map` answers 200. Not a weight problem, because browsers don't fetch them. |

## Ranked problems

Ranked by impact on, in this order: same-origin requests per page view, mobile LCP, TBT (the lab stand-in for Interaction to Next Paint), layout shift, bytes.

| # | Problem | Measured cost | Work | Effort |
| --- | --- | --- | --- | --- |
| 1 | Related titles mounts nine panels at once | 16 dynamic requests, 287 extra posters (8.4 MB), about 5,000 extra DOM elements per title page view | Frontend | Small |
| 2 | The app shell loads 75 to 107 script chunks | 93 static requests per title page view, 640 KB (1.87 MB raw), 57% unused at load | Frontend | Medium |
| 3 | Five dynamic requests on every page, besides the document | 5 of the 6 dynamic requests on home and person | Frontend, small backend part | Small |
| 4 | The Node process serves and compresses static assets | 107 static requests per title page view hit the webapp host, compressed per request | Backend | Medium |
| 5 | TMDB images: eager, oversized, behind a redirect | 763 to 991 requests and 13.5 to 34.8 MB per title page view. LCP 9.1 to 15.7 s. | Frontend | Small |
| 6 | Unbounded cast, and related data embedded in the HTML | HTML up to 405 KB compressed and 2.3 s for the full response | Backend, with a frontend part | Medium |
| 7 | Analytics and error tracking on the main thread | PostHog 7.1 to 8.5 s, Sentry 2.9 to 3.1 s, Google tag 0.7 to 1.0 s on title pages. 370 KB of script. | Frontend, needs an owner decision | Small |
| 8 | The trailer player loads on every title page | 11 requests and 1.0 MB (3.7 MB raw) per title page view | Frontend | Small |
| 9 | Posters reserve no space | Discover layout shift 0.79 to 0.82 in 2 of 7 runs | Frontend | Small |
| 10 | Render-blocking CSS and Google Fonts | 4 to 6 blocking stylesheets. Lighthouse estimates 450 ms (title pages) to 960 ms (home). | Frontend | Small |
| 11 | A hardcoded image preload in the root | 54 KB at high priority on every page, used on none | Frontend | Small (one deletion) |
| 12 | Oversized local images | 358 KB in 7 same-origin requests per title page view. One logo is 219 KB. | Frontend | Small |
| 13 | Eager prefetch in the header, dock, and footer | 1 loader request per page view, 3 more plus 19 scripts at the footer, 6 on the error page | Frontend | Small |
| 14 | Decorative third-party requests | 15 flags, 4 avatars, 1 texture, 1 logo from four other origins | Frontend | Small |
| 15 | The sign-up image downloads on phones that never show it | 3.15 MB per mobile sign-up page view, served by the Node process | Frontend | Small |

### 1. Related titles mounts nine panels at once

- **Cost (verified):** 16 `GET /api/related` requests per title page view, 244 KB compressed, 67 to 130 KB raw each, no `Cache-Control`. The server-rendered HTML has 2,936 elements, 192 `<img>` tags, and 65 posters. After hydration the page has 7,906 elements and 613 TMDB images (576 are related posters, 352 unique, 10.3 MB).
- **Evidence:** `app/ui/details/DetailsRelated.tsx` lines 68 to 80 render `<RelatedTitles>` for every key (`overall` plus eight highlight keys) and hide the inactive ones with `opacity-0`, not by leaving them out. `app/ui/details/RelatedTitles.tsx` lines 83 to 95 start two queries per panel. The loader prefetches only the `overall` pair (`app/server/related.server.ts` line 117), so 16 queries run in the browser.
- **Fix:** Render only the selected panel. Fetch a fingerprint panel when the visitor selects its tab.
- **Expected gain (estimate, high confidence for the request count):** dynamic requests per title page view drop from 24 to 8. 287 fewer images (574 fewer requests with the redirects) and about 8.4 MB less. The DOM stays near the server-rendered 2,900 elements. Medium confidence that TBT falls by more than half, because hydration, PostHog, and Sentry costs follow the DOM size.
- **Page cache:** independent.

### 2. The app shell loads 75 to 107 script chunks

- **Cost (verified):** 93 script requests on a title page (640 KB, 1.87 MB raw), 75 on home, 85 on person, 107 on discover. 49 of the 93 are under 2 KB raw: mostly one icon each. The root route alone imports 58 chunks. JavaScript coverage after load: 43% of same-origin script bytes ran on the movie page, 39% on home, 36% on person.
- **Evidence:** the production manifest (`/assets/manifest-68a32a80.js`) lists 60 chunks for the root, 85 for a title route, and 63 for the share list route. `vite.config.js` sets no chunking options. Lighthouse `unused-javascript`: `SearchPeople-*.js` 26 KB, 88 to 90% unused. `_index-*.js` (the home route) 29 KB, 92% unused, loaded on title, person, and discover pages. `detailsMeta-*.js` 43 KB, 86% unused on discover. `free-mode-*.js` (Swiper) 28 KB, 93% unused on discover. Lighthouse also reports `@headlessui/react` duplicated across chunks (26 KB).
- **Fix:** Merge small chunks with Rollup's `manualChunks` or a minimum chunk size. Load the search panel on first use. Stop shared modules from importing whole route files.
- **Expected gain (estimate, medium confidence):** static requests per title page view drop from 107 to about 30. Script bytes drop by 150 to 250 KB.
- **Page cache:** independent. A cache layer in front removes these requests from the Node process (problem 4), but the browser still pays for each one.

### 3. Five dynamic requests on every page, besides the document

- **Cost (verified):** every surface sends these after hydration:
  - `POST /api/tonight` with the guest's progress, answered `private, no-store`. A first-time visitor has no progress. Source: `app/ui/navigation/useTonightsPick.ts` lines 12 to 25.
  - `GET /api/search-config`, answered `no-store`, refetched on every mount and on every window focus. It returns one version string. Source: `app/ui/search/SearchJourney.tsx` lines 184 to 196.
  - `POST /api/e`, the Sentry tunnel. One per page load, because `tracesSampleRate` is 1 (`app/entry.client.tsx` line 15). The route awaits the upstream call to Sentry (`app/routes/api.e.tsx` line 29), so its time to first byte was 194 to 358 ms, against 32 to 59 ms for `/api/tonight`.
  - `GET /?_data=routes/_index`, a prefetch of the home loader, because the header and dock link home with `prefetch="render"` (`app/ui/main/Header.tsx` lines 211 to 215, `app/ui/nav/BottomNav.tsx` lines 43 and 67).
  - `POST /api/og-image-warm`, 3 seconds after every page view (`app/ui/og-image/useOgImageWarmup.ts`).
- Title pages add `GET /api/genres/all` and, for movies in a collection, `GET /api/movie/collection`.
- **Fix:** Skip the tonight request when the guest has no progress. Put the search config version in the root loader data. Lower the trace sample rate. Change `prefetch="render"` to `"intent"`. Load genres and the collection in the title loader.
- **Expected gain (estimate, high confidence):** with problem 1 fixed too, a title page view sends 1 or 2 dynamic requests instead of 24. Home and person send 1 or 2 instead of 6.
- **Page cache:** mostly independent. Whether the warm request stays is already an open decision on the map. The Sentry tunnel is an owner decision: the tunnel avoids ad blockers, and sending straight to Sentry removes the request from the Node process.

### 4. The Node process serves and compresses static assets

- **Cost:** 107 static requests per title page view reach the webapp host (verified). Each compressed response is produced per request: no `Content-Length`, and two `Vary: Accept-Encoding` headers (verified). Images are gzip-encoded for no gain (verified). Inference: Express inside `remix-serve` serves the files, and both it and the proxy apply compression.
- **Evidence:** `package.json` starts `remix-serve`. Response headers in [Transport and caching](#transport-and-caching).
- **Fix:** Let the page cache layer store and serve `/assets/*` (immutable, one variant per encoding). Exclude image types from proxy compression. Give unversioned `public/` files a short lifetime.
- **Expected gain (estimate, medium confidence):** the Node process sees about 0 static requests once the cache is warm, instead of 53,500 per second at the target rate.
- **Page cache:** this is part of the page cache decision.

### 5. TMDB images: eager, oversized, behind a redirect

- **Cost (verified):** no TMDB image on any surface has `loading="lazy"`, `srcSet`, or `width` and `height` (0 of 613 on movie, 0 of 797 on show). Five are in the first viewport of the movie page. 217 cast photos on the show page use the `original` size: 28.6 MB, shown as 140 px circles, natural sizes up to 2000x3000. Every `www.themoviedb.org/t/p/...` URL answers 301 to `image.tmdb.org`, which doubles the request count and needs a second connection. The root preconnects only to `image.tmdb.org`.
- **Evidence:** `app/ui/Poster.tsx` line 16 and line 20. `app/ui/details/Actors.tsx` line 53. `app/ui/details/hero/Trailer.tsx` lines 11 and 12. Lighthouse `image-delivery-insight` estimates 11.7 MB of savings on the movie page. Lighthouse `lcp-discovery-insight` fails "fetchpriority=high should be applied" on movie, show, person, and discover.
- **Fix:** Add `loading="lazy"`, `decoding="async"`, and dimensions to posters and cast photos. Use `image.tmdb.org` directly. Use a sized profile image for cast. Give the hero backdrop `fetchpriority="high"` and a phone-sized source.
- **Expected gain (estimate, high confidence for bytes):** load-phase image weight on a title page drops from 13.5 to 34.8 MB to under 0.5 MB. TMDB requests drop from 763 to about 10. Medium confidence that LCP falls below 4 s on title pages with problem 1 also fixed. Posters at `w300_and_h450` are the right size for a phone with a pixel ratio of 2.6, so poster size itself is fine.
- **Page cache:** independent. None of these requests reach the webapp host.

### 6. Unbounded cast, and related data embedded in the HTML

- **Cost (verified):** see [HTML documents](#html-documents). Grey's Anatomy is 405 KB compressed, 2.96 MB raw, 2.3 s for the full response. This breaks the 300 ms full-response target for any long-running show, with or without a cache in front of a slow client. Extrapolation: 2,734 cast photos at the measured 132 KB average would be about 360 MB. That page was not loaded in a browser.
- **Evidence:** the loader data of `routes/show.$showKey` holds `media.actors` with 2,734 items. `app/ui/details/Actors.tsx` renders every actor. `app/server/related.server.ts` embeds two full related lists (87 KB raw) for cards that show a poster, a title, and a score.
- **Fix:** Cap the cast in the page payload (for example the first 20) and load the rest on request. Trim related items to the fields the card reads.
- **Expected gain (estimate, medium confidence):** title page HTML drops by about half for typical titles and by about 90% for long-running shows.
- **Page cache:** independent, and worth doing before sizing the cache. The country research wants per-country streaming data out of the HTML. Coordinate the payload changes.

### 7. Analytics and error tracking on the main thread

- **Cost (verified):** see [Main thread](#main-thread). Bytes per page view: Google tag 174 KB (533 KB raw, 42% unused). PostHog 86 KB in the bundle plus five lazy scripts from `a.goodwatch.app` (recorder 63 KB, surveys 32 KB, dead clicks 9 KB, web vitals 4 KB, config 1 KB) and one flags request. Sentry with session replay is in `entry.client-*.js` (54 KB). `a.goodwatch.app` is PostHog's managed proxy behind CloudFront, so these requests don't reach the webapp host.
- **Evidence:** `app/root.tsx` lines 212 to 223 start PostHog for every visitor, with session recording options. Lines 374 to 388 load the Google tag. `app/entry.client.tsx` lines 15 to 17 set traces to 100% and replay to 10% of sessions.
- **Fix:** Decide which page view analytics to keep. Turn off session recording, surveys, and dead click capture for anonymous visitors, or sample them. Load the Google tag after the page is idle. Load Sentry replay lazily, and lower the trace sample rate.
- **Expected gain (estimate, low to medium confidence):** 1.5 to 3 s less TBT on title pages after problem 1, and up to 370 KB less script.
- **Page cache:** independent. Needs an owner decision first.

### 8. The trailer player loads on every title page

- **Cost (verified):** `react-player` mounts a YouTube frame on load: 11 requests, 1.0 MB (3.7 MB raw), including two DoubleClick requests.
- **Evidence:** `app/ui/details/Media.tsx` lines 84 to 97. The hero's trailer dialog (`app/ui/details/hero/Trailer.tsx`) already mounts its player only when opened.
- **Fix:** Show the video thumbnail and mount the player on click.
- **Expected gain (estimate, high confidence):** 1.0 MB and 11 requests less per title page view.
- **Page cache:** independent.

### 9. Posters reserve no space

- **Cost (verified):** discover layout shift 0.79 and 0.82 in two of seven Lighthouse runs, and 0.028 to 0.046 in the other five. Lighthouse names the poster grid cards and gives "Unsized image element" as a cause. The remaining 0.028 is the mobile dock (`body > div.fixed`) growing after hydration.
- **Evidence:** `app/ui/Poster.tsx` line 20: `block w-full`, with no `width`, `height`, or aspect ratio.
- **Fix:** Give the poster a 2:3 aspect ratio and dimensions. Render the dock at its final height.
- **Expected gain (estimate, high confidence):** layout shift under 0.05 in every run.
- **Page cache:** independent. The change sits in the same component as problem 5.

### 10. Render-blocking CSS and Google Fonts

- **Cost (verified):** four to six blocking stylesheets per page. `tailwind-*.css` is 34.8 KB (333 KB raw). Only 18 to 25% of its rule bytes match an element on a landing page. `swiper-*.css` matches 1 to 15%, `ReactToastify-*.css` 17%, `main-*.css` 3%. Home also blocks on a Google Fonts stylesheet and loads two font files (41 KB). On every other page, the root preloads a Google Fonts stylesheet that no page applies, so the brand font is requested but never loaded there.
- **Evidence:** `app/root.tsx` lines 81 to 83 and 100 to 104. `app/routes/_index.tsx` lines 57 to 62. `app/main.css` line 2. Lighthouse `render-blocking-insight`. Chrome's CSS coverage reported Tailwind as 98% used, which is wrong for layered CSS, so the share comes from matching each rule's selector against the rendered page.
- **Fix:** Self-host Gabarito as one `woff2` file with `font-display: swap`. Remove the unused preload. Merge the small stylesheets, and load the toast styles with the first toast.
- **Expected gain (estimate, medium confidence):** two to three fewer blocking requests and no third-party font origin. Tailwind itself is a single shared sheet. Splitting it is not worth the effort at 35 KB.
- **Page cache:** independent.

### 11. A hardcoded image preload in the root

- **Cost (verified):** every surface requests `image.tmdb.org/t/p/w780/gqby0RhyehP3uRrzmdyUZ0CgPPe.jpg` (54 KB) at high priority. No page displays it.
- **Evidence:** `app/root.tsx` lines 94 to 99. The string appears nowhere else in `app/`.
- **Fix:** Delete the preload entry.
- **Expected gain (high confidence):** 54 KB and one high-priority request less on every page.
- **Page cache:** independent.

### 12. Oversized local images

- **Cost (verified):** `rotten-logo-icon-250-*.png` is 219 KB for a small rating icon. `secured-by-shieldaze-*.webp` and `fingerprint-*.webp` are 42 KB each, `metacritic-logo-icon-250-*.png` 37 KB.
- **Evidence:** `app/ui/details/hero/RatingChips.tsx` lines 3 and 4. Lighthouse `image-delivery-insight` reports 219 KB wasted on the first.
- **Fix:** Re-export the icons at display size.
- **Expected gain (estimate, high confidence):** about 330 KB less per title page view from the webapp host.
- **Page cache:** independent.

### 13. Eager prefetch in the header, dock, and footer

- **Cost (verified):** one home loader request per page view at load. Three loader requests and 19 scripts when the footer scrolls into view. Six loader requests on the error page, which uses the older header. Title pages hold 115 `modulepreload` links after load, discover 380.
- **Evidence:** `prefetch="render"` in `app/ui/main/Header.tsx` (lines 93 to 233) and `app/ui/nav/BottomNav.tsx`. `prefetch="viewport"` in `app/ui/Footer.tsx` lines 233 to 274.
- **Fix:** Use `prefetch="intent"` for navigation links.
- **Expected gain (estimate, high confidence):** one to four dynamic requests less per page view.
- **Page cache:** independent. Prefetched loader responses for anonymous visitors become cacheable once the `Vary: Cookie` work from the page cache research lands.

### 14. Decorative third-party requests

- **Cost (verified):** 15 flag images from `purecatamphetamine.github.io` on title pages (10-minute cache lifetime). On every page: 4 avatars from `api.dicebear.com`, a texture from `www.transparenttextures.com`, and a logo from `widget.justwatch.com` (no cache lifetime).
- **Evidence:** `app/ui/Footer.tsx` lines 117, 142 to 160, and 314. `app/ui/country/CountryFlag.tsx` line 45.
- **Fix:** Self-host or inline them, and load the flags when the country selector opens.
- **Expected gain (estimate, high confidence):** 21 requests and four origins less per title page view. Bytes are small (about 40 KB).
- **Page cache:** independent.

### 15. The sign-up image downloads on phones that never show it

- **Cost (verified):** `/sign-up` on a phone downloads `/images/hooks/sign-up-hook.png`: 3.15 MB, 1024x1536, displayed at 0x0 because its container is `hidden lg:block`. The page weighs 4.2 MB in total. No landing surface requests the file.
- **Evidence:** `app/ui/auth/CustomAuthForm.tsx` lines 281 to 287. The same image is in `forgot-password.tsx` and `reset-password.tsx`.
- **Fix:** Convert it to WebP or AVIF at display size and add `loading="lazy"`.
- **Expected gain (estimate, high confidence):** about 3 MB less per mobile sign-up page view. This matters for the spike, because sharing a list requires an account.
- **Page cache:** independent.

## Candidates from the ticket

| Candidate | Verdict | Number |
| --- | --- | --- |
| Tailwind CSS size | Confirmed, low priority | 34.8 KB transferred, 333 KB raw, 18 to 25% of rule bytes used on a landing page, render-blocking |
| React Query Devtools shipped to everyone | Dismissed | The root chunk holds no devtools code, and no devtools chunk is requested. The import in `app/root.tsx` line 42 compiles to nothing in a production build. |
| The 3.2 MB sign-up image | Dismissed for landing pages, confirmed for `/sign-up` | 0 requests on landing surfaces. 3.15 MB on `/sign-up`, even on phones that hide it. |
| TMDB posters without lazy loading or `srcSet` | Confirmed | 0 of 613 lazy, 0 with `srcSet`, 13.5 to 34.8 MB per title page view |
| Google Fonts loading | Confirmed | Home: 1 blocking stylesheet, 1 unused preload, 2 font files (41 KB), `display=swap`. Other pages: 1 unused preload. |
| Sentry trace sampling at 100% | Confirmed | 1 `POST /api/e` per page load |
| Sentry tunnel through the Node process | Confirmed | 1 request per page view on the webapp process, held for 194 to 358 ms |
| gtag cost | Confirmed | 174 KB, 0.7 to 1.0 s of main-thread time, 2 requests |
| PostHog cost | Confirmed | 195 KB in 6 script files, 7 requests, 7.1 to 8.5 s of main-thread time on title pages. The session recorder loads for anonymous visitors. |
| Prefetch volume | Confirmed, small | 1 loader request per page view, 3 more at the footer, 1 warm request |
| Bundle chunks per route | Confirmed | 93 script requests on a title page, 49 under 2 KB, 57% of bytes unused at load |

## Proposed execution tickets

Each ticket is one agent session. All are frontend work unless marked.

**A. Mount only the selected related titles panel** (problem 1)
Render one `RelatedTitles` panel in `DetailsRelated` and fetch a fingerprint panel on tab selection.
Done when a title page view sends no `/api/related` request at load and the DOM is under 3,200 elements.
Depends on: nothing. Do this first: it changes the baseline for tickets B, F, and G.

**B. Load TMDB images lazily, at display size, without the redirect** (problems 5, 9, and 11)
Add lazy loading, dimensions, and a 2:3 aspect ratio to `Poster` and cast photos. Use `image.tmdb.org`. Give hero images `fetchpriority="high"`. Delete the root preload.
Done when a title page loads under 15 TMDB images before scrolling and discover's layout shift is under 0.05 in five runs.
Depends on: nothing. Best after A, which removes most of the images.

**C. Cut the app shell's per-page API calls** (problems 3 and 13)
Skip the tonight request for guests without progress, move the search config into root loader data, load genres and collection in the title loader, and change navigation links to `prefetch="intent"`.
Done when home and person send only the document and the telemetry requests.
Depends on: nothing.

**D. Cap the cast and trim embedded related data** (problem 6, backend with a frontend part)
Limit actors and crew in the title payload, add a way to load the rest, and reduce related items to the fields the card reads.
Done when the Grey's Anatomy page is under 80 KB compressed and the Matrix page under 35 KB.
Depends on: nothing. Coordinate with the country-neutral HTML work, which touches the same payload.

**E. Consolidate client chunks** (problem 2)
Set chunking options in `vite.config.js`, load the search panel on first use, and remove cross-route imports of `_index` and `detailsMeta`.
Done when a title page view loads under 35 scripts and no route loads another route's chunk.
Depends on: nothing. Measure before and after with the Lighthouse benchmark.

**F. Decide and trim analytics and error tracking** (problem 7)
Owner decides: keep Google Analytics next to PostHog or not, session recording for anonymous visitors or not, and the Sentry trace rate and tunnel. Then apply the choices and load what remains after the page is idle.
Done when third-party and telemetry scripts cost under 1 s of main-thread time on a title page in Lighthouse.
Depends on: an owner decision. Measure after A.

**G. Load the trailer player on click** (problem 8)
Replace the eager player in `Media.tsx` with a thumbnail that mounts the player on click.
Done when a title page view sends no request to YouTube before a click.
Depends on: nothing.

**H. Self-host fonts and reduce blocking CSS** (problem 10)
Serve Gabarito and VT323 from `/assets`, remove the Google Fonts links, merge the small stylesheets, and load toast styles with the first toast.
Done when no surface requests `fonts.googleapis.com` and each page has at most two blocking stylesheets.
Depends on: nothing.

**I. Shrink local images and drop decorative third-party requests** (problems 12, 14, and 15)
Re-export the rating icons and the sign-up image, self-host the flags, avatars, texture, and JustWatch logo, and load the flags with the country selector.
Done when a title page view requests no image over 20 KB from the webapp host and `/sign-up` weighs under 1 MB on a phone.
Depends on: nothing.

**J. Serve static assets from the cache layer** (problem 4, backend)
Cache `/assets/*` in the page cache per encoding, stop compressing images in the proxy, and give unversioned `public/` files a short lifetime.
Done when a warm cache answers every `/assets/*` request without the Node process.
Depends on: the page cache decision. This ticket must wait.

### What waits for the page cache decision

- Ticket J waits for it.
- Adding `Cache-Control` to `/api/related` and to prefetched loader data only pays off with a shared cache and without `Vary: Cookie`. After tickets A and C, few of these requests remain.
- Whether `POST /api/og-image-warm` stays is already open on the map and waits for the baseline.
- Tickets A to I are independent of the cache. They reduce what the cache has to hold and what the browser has to do.

### Expected result of tickets A, B, C, and E together

Estimate, not measured:

| | Today | After |
| --- | --- | --- |
| Same-origin requests per title page view | 131 | About 35 |
| of which dynamic | 24 | 2 to 3 |
| At 500 page views per second | 65,500 req/s | About 17,500 req/s, 1,000 to 1,500 dynamic |
| Total requests | 928 to 1,155 | About 80 |
| Page weight | 15 to 37 MB | About 1.5 MB |

## What this audit did not measure

- **The share list page.** No public list URL is known, three guessed profile handles answered 404, and the rules excluded reading the database. From the manifest, the route loads 63 script chunks, three more than the root alone. From the source, it loads five `w185` posters, one flag, and card fonts from `/fonts/share-card/` (TrueType files, 1.7 MB for all designs). The document is `private, no-store`. A deleted or mistyped list URL costs 129 same-origin requests.
- **Analytics event traffic.** PostHog sent no event requests in headless Chrome, most likely because it filters automated browsers. The number of event and recording requests per real page view is unknown. They go to PostHog's proxy, not to the webapp host.
- **Sentry session replay.** No sampled session occurred. A replay session sends extra envelopes through `/api/e`. The count is unknown.
- **Interaction to Next Paint.** Lab runs have no interactions. TBT stands in for it.
- **Field data.** The Web Vitals reporting from the earlier ticket has just shipped, so no field percentiles exist yet.
- **Real devices and real mobile networks.**
- **Which component compresses responses.** The two `Vary` headers suggest both the proxy and the Node process do. This was not confirmed on the host.
- **Requests after taps.** `prefetch="intent"` links start a loader request on touch. This comes from the source, not from a measurement.
- **Long-running shows in a browser.** The Grey's Anatomy page was fetched with `curl` only, to avoid downloading about 2,700 full-size photos.
- **The first paint on worker3.** Lighthouse observed the first paint at 2.3 s on an unthrottled page whose stylesheets finished at 0.4 s. The dev machine painted at 0.6 to 1.0 s. The cause of the gap is unknown. It can make Lighthouse's simulated LCP pessimistic.
