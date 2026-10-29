# Poster grid LCP

This work addresses ticket 8 of [#784](https://github.com/alp82/goodwatch-monorepo/issues/784).

## Findings from the production baseline

The slow pages have different LCP elements. The fast comparison pages have text LCP, so their scores do not establish that their posters load faster.

| Page | Baseline LCP element | Mobile LCP (ms) |
| --- | --- | ---: |
| `/shows/moods/funny` | Category header's CSS backdrop, 172 KB at `w1280` | 5,409 |
| `/movies/genres/drama` | Category header's CSS backdrop, 61 KB at `w1280` | 4,593 |
| `/u/alperortac/wishlist` | Lazy poster in the second row | 5,794 |
| `/u/alperortac/scores` | Lazy poster in the first score tier | 4,458 |
| `/u/alperortac/lists` | Large TMDB image in the second share-card preview | 5,547 |
| `/discover?q=heist` | Busy message after the guard blocks the search POST | 4,707 |

The category images are discoverable in the initial document but lack an initial high-priority hint. The profile posters use `loading="lazy"`. The list previews use export-sized images. The browser also starts route module requests before these images paint.

`/movies/best` and `/movies/genres` have paragraph LCP. Their recorded production baseline values are 1,917 ms and 1,261 ms.

Search is a measurement exception. Its [client](../../goodwatch-webapp/app/ui/search/search-request.ts) sends a POST to `/api/combined-search`. The guard blocks that POST, and the client displays the busy message. The [handler](../../goodwatch-webapp/app/routes/api.combined-search.ts) can write search history and incur model cost, so this ticket did not call it in production. This result does not establish a service outage or measure populated search results. Search keeps its existing eager bootstrap because it needs JavaScript to produce results.

## Changes

Category pages draw the same `w1280` file as an absolutely positioned image. The cover crop, top alignment, rounded corners, dark overlay, and content layout stay the same. The image is eager, high priority, and marked for Element Timing. Its URL and request mode stay the same as the old background image, preserving cache reuse.

Category pages and the profile Wishlist, Scores, and Lists tabs use the existing `START_AFTER_PAINT` route handle. Their complete server documents remain available before JavaScript runs. Category scripts wait for the backdrop. Wishlist and Scores wait for their prioritized posters while those posters intersect the viewport. Images outside the viewport do not hold up scripts, and an image error releases the wait immediately. The existing 5 s fallback remains.

Wishlist prioritizes the first six posters in its first title section, including the baseline's second-row LCP candidate. Scores prioritizes the first four posters in its first tier. Later posters keep lazy loading and use the existing card's `skipOffscreen` option. Its `content-visibility: auto` and 2:3 frame preserve layout while the browser defers distant images. The legacy category grid uses the same option for its lazy posters. Every title, image source, and link stays in the initial HTML.

The first two list tiles prioritize their largest TMDB image. Later tiles load lazily. Previews offer responsive files for their fitted dimensions, accounting for magnification from `object-fit: cover`. They retain the original `src` and largest candidate and use native device density without a cap. Exports and editor previews retain their existing behavior.

A browser probe on the actual app confirms that normal TMDB requests emit Element Timing entries with both the element and render time. The branch keeps those original URLs and request modes. It does not introduce extra CORS image variants or connections. Existing title-page 103 hints keep their required CORS mode.

Extra category preload experiments did not establish a stable benefit. The branch uses the initial document's high-priority image instead.

## Controlled mobile results

Medians from five baseline and five candidate runs per page. LCP values are Lighthouse simulated timings.

| Page | Score before → after | LCP before → after (ms) | Candidate LCP range (ms) | TMDB transfer before → after (KiB) |
| --- | ---: | ---: | ---: | ---: |
| `/shows/moods/funny` | 81 → 93 | 5,171 → 3,208 | 3,165–4,465 | 917 → 255 |
| `/movies/genres/drama` | 84 → 98 | 4,522 → 2,401 | 2,216–2,519 | 713 → 117 |
| `/u/alperortac/wishlist` | 80 → 92 | 5,325 → 3,394 | 3,194–3,725 | 1,717 → 291 |
| `/u/alperortac/lists` | 80 → 99 | 5,325 → 2,200 | 2,197–2,277 | 612 → 68 |
| `/u/alperortac/scores` | 89 → 99 | 3,750 → 2,030 | 2,011–2,175 | 1,084 → 112 |

All five pages exceed 90 at the median. Drama, Lists, and Scores meet the median LCP target of 2,500 ms. Funny and Wishlist do not. The recorded CLS medians stay unchanged, at 0 to 0.000231. All 50 successful reports have no Lighthouse run warnings and respect the two-request cap. All 25 candidate LCP discovery audits confirm an initial-document, eager, high-priority image.

TMDB transfer totals cover each Lighthouse observation window. They show deferred distant images as well as smaller list previews; they do not imply that scrolling the entire page transfers fewer original posters.

## Measurement method

The baseline is `438767171`, the `origin/main` ref when this worktree started. Both sides use production builds with the same installed npm dependencies. Six sequential public document GETs supplied public loader-data fixtures. The servers replace those loaders and the root loader, retaining the compiled route components and browser code. The root fixture preserves public feature booleans and blanks external URLs and keys.

Servers and builds use `env -i`, explicit loopback endpoints, empty external keys, and the repository's outbound TCP guard. A loopback TLS proxy serves each build's own assets over HTTP/2 with Brotli and correct content types. No production backend supplies data to the running local apps.

Lighthouse 13.5.0 uses the pages suite's mobile CPU multiplier of 2.7 and its two-request guard. Analytics are blocked on both sides. The harness permits the local self-signed certificate. A scratch guard fix reads complete Remix data-prefetch responses before releasing their slots: missing fixture titles return 404 and otherwise leave Chrome's prefetch completion unreported. Document responses still stream normally, and the two-request cap remains.

Each populated page gets five baseline runs immediately followed by five candidate runs, with one Lighthouse browser at a time. Other tickets use this machine concurrently. These are controlled browser measurements, not quiet-host, geographic, production backend, or member measurements.

The analysis excludes setup samples with resource errors and retains failed browser attempts separately. Chrome certificate interstitial errors trigger a retry; they do not enter the medians. All reported medians use five successful reports per side. The proxy does not forward 103 responses, so these measurements do not claim an Early Hints improvement.

## Validation

The repository HTML equivalence runner compares 348 documents and reports 315 expected differences. Existing home and title pages contain the updated inline scheduler, which checks viewport intersection and releases failed-image waits. Category pages also replace the decorative CSS background with an image and adjust poster loading and rendering attributes. The other 33 documents match. The strict gate exits with differences. It uses its original normalization and an empty class allowlist; the supplemental checks below review the intended differences without accepting content omissions.

A supplemental check compares all 348 documents' visible text, complete normalized loader data, JSON-LD values, SEO metadata, and anchor attributes. All match. The six populated fixture documents also retain their text, JSON-LD, and loader data. No content or data omission enters the comparison allowlist.

A category screenshot check with JavaScript disabled finds identical header geometry. Maximum channel difference is 7/255, with mean difference 0.080/255 across the screenshot. The original and CORS-query backdrop downloads also have identical file hashes; the final code retains the original URL.

Responsive preview checks pass at viewport/density combinations of 412 px/1.75×, 412 px/4×, 500 px/3×, 800 px/2×, 1100 px/2×, and 1440 px/1.5×. Every visible image has enough source pixels for its actual cover crop, up to the original file's limit.

From `goodwatch-webapp`, run:

```sh
node --test app/ui/share-card/page-images.test.ts app/ui/share-card/font-faces.test.ts app/utils/tmdb-image.test.ts app/utils/start-after-paint.test.ts app/server/hero-hints.test.ts app/server/early-hints.test.ts
npm run typecheck
```

The focused Node command passes 78 tests, including all 15 real share-card designs, responsive fallbacks, loading priority, script scheduling, hero hints, and Early Hints. The share-card tests remove only loading and responsive attributes and compare the remaining output exactly with the original design. The viewport and failed-image scheduler tests fail before their fixes.

TypeScript reports the same 178 diagnostics as both the starting main and main at `39172781b`, with no new diagnostic after ignoring shifted line numbers. Main advanced while other tickets worked; performance comparisons remain pinned.

## Remaining work and owner questions

Funny still has a median LCP of 3,208 ms, and Wishlist has 3,394 ms. Funny retains its 172 KiB `w1280` backdrop. Wishlist still needs six visible poster transfers. This ticket does not establish that reducing visible image detail would be acceptable. Any such reduction requires an owner decision; the current changes preserve the existing available detail.

One Wishlist candidate run starts its first route script request at 5,374 ms, while TMDB transfers finish at 5,309–5,378 ms. It reaches the existing scheduler fallback window despite a simulated LCP of 3,294 ms. The measurements therefore do not establish instant interaction on every visit. Investigate image connection stalls and the scheduler's interaction tradeoff before claiming that goal.

A follow-up can evaluate image delivery that reduces transfer without losing visible detail. This ticket does not verify the benefit or cost of an image proxy, alternate format, or Cloudflare change. No visible design change needs approval for the delivered code.

Production mobile scores and member behavior need verification after deployment. A populated search benchmark requires an isolated backend or fixture that can accept its POST safely. Production GET-only measurements cannot cover completed search results.

This ticket performs no production configuration changes or deployment. Raw reports and the local harness remain under `~/.cache/gw-perf/scratch-lcpgrid/`.
