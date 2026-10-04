# Open Graph images: render cost, storage, and weight

This page says what an Open Graph (OG) card costs when it isn't cached, what the per-page-view warm request costs, how heavy the cards are, and what the changes of October 4, 2026 did to each. It belongs to the "Serve a viral traffic spike" map and covers three tickets: "Measure the OG render cost on a miss under load", "Render OG cards off the main thread and store them outside the process", and "Cut the weight of OG images". A fourth ticket, "Serve a cached OG card without reading it from Redis on every request", added the section [A hot card](#a-hot-card) on October 5, 2026. It follows the [production baseline](viral-spike-baseline.md), which measured only cached cards.

The scripts are in [`viral-spike-og-images/`](viral-spike-og-images/). The production check after the deploy is in the tickets' resolutions, not here.

## Summary

- **A title card miss cost 88 ms of main-thread CPU, not 250 to 470 ms.** The 250 to 470 ms was the wall time of the request. The main thread ran satori and the PNG encoder (88 ms, with one event-loop stall of about 60 ms per card), and resvg ran on another thread (129 ms).
- **Next to 5 warm title pages per second, cold cards raised the page p95** from 68 ms to 84 ms at 1 card per second, 106 ms at 2, 156 ms at 5, and 199 ms at 10. At 10 per second the two render slots were full: a card took 10 seconds at the median and 16 seconds at most, with no bound on the queue.
- **The warm request cost 5.2 ms of main-thread CPU per page view when the card was cached** and 84 ms when it wasn't. At 500 page views per second, the cached case alone is 2.6 seconds of main-thread CPU per second. In production, 31% of warm requests started a render, almost all for long-tail person pages that crawlers visit. Link-preview bots asked for a title or person card about 300 to 1,100 times per day.
- **Decision: the per-page-view warm request is gone.** A card renders on its first request, in a child process. Share list cards, which take about 20 seconds, are drawn when a list is saved, when its owner shares it, and when its page is viewed and the card is missing.
- **After the change a title card miss costs 25 ms of main-thread CPU** and 354 ms in a child process. Next to 5 title pages per second, the page p95 is 71 ms at 1 card per second and 81 ms at 2. At 10 and 20 per second the renderer answers what it can (about 3 cards per second on this 4-core host) and the rest get a generic card after 4 seconds, with no error.
- **Cards are JPEG now, 58 to 144 KB for titles (median 132 KB), from 24 to 770 KB as PNG (median 554 KB).** Every title card in a sample of 60 is under 150 KB. Before, 56 of 60 were over.
- **Cards live in Valkey for 7 days**, so they survive a deploy and two instances share them. Estimated memory: 0.1 to 0.3 GB per cache node at most.
- **A hot card is answered before Express since October 5, 2026.** It cost five times as much main-thread time as a stored page, and the cause wasn't a read from Valkey: the process's copy answered, but the request still went through Express and Remix. On a development machine a hot card went from 0.61 ms to 0.10 ms, which is what a stored page costs there. See [A hot card](#a-hot-card).

## Conditions

| Item | Value |
| --- | --- |
| Date | Sunday, October 4, 2026 |
| Host | worker3, 4 vCPUs, 7.75 GB RAM, shared with a Windmill worker and, for part of the time, another agent's measurement containers |
| Process | One container (`gw-og-app`) with the Dockerfile's command, `NODE_ENV=production`, Node 24.21.0, memory limit 3 GB. The image holds `node_modules`, and each build's `build/` directory is mounted over it |
| Before build | `origin/main` at `66e44e10` |
| After build | The same commit plus the changes of the three tickets |
| Data stores | Production Crate and Qdrant, read only. Its own single-node Valkey cluster in a container (`gw-og-redis`), with the title snapshot copied in. Never the production cache cluster |
| Search | The query encoder doesn't start. Nothing here searches |
| Client | One request at a time with `curl` from the host for the per-card numbers. k6 1.8.1 with fixed arrival rates on the same host for the bursts. Card requests carry a link-preview user agent |
| CPU time | Main thread: `process.threadCpuUsage()` through the render profile's preload. Rest of the container: the container's cgroup CPU time minus the main thread, which covers the other threads and the renderer's child processes. An idle process's CPU for a window of the same length is subtracted |

The load generator shares the 4 cores with the server and the renderer's children. From 5 cards per second on, the host itself is busy (load average 3.3 to 5.3), and page times include that contention. Runs marked "overlap" ran while the other agent's load generator was running.

## A card on a miss

One request at a time, each card requested once. Titles are 33 long-tail movies and shows, people are 30 people from long-tail titles' casts (most have no photo), and the share list is the benchmark's list (a `podium` design with five titles).

| Card | Build | Wall p50 | Wall p95 | Main-thread CPU | Rest of the container | Stalls of 50 ms or more | Bytes, mean |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Title | Before | 227 ms | 451 ms | 87.6 ms | 129 ms | 20 in 33 cards, 60 ms at p50, 88 ms at most | 504 KB |
| Title | After | 275 ms | 509 ms | 24.9 ms | 354 ms | 1 in 33 cards | 122 KB |
| Person | Before | 83 ms | 281 ms | 63.1 ms | 74 ms | 7 in 30 cards | 233 KB |
| Person | After | 142 ms | 347 ms | 26.2 ms | 240 ms | None | 79 KB |
| Share list | Before | 19.5 to 20.4 s | | 82 to 141 ms | 19.9 to 20.8 s | 1 in 3 | 2.2 MB card, 170 KB preview |
| Share list | After | 19.2 s | | 237 ms (one run) | 19.2 s | None | 2.2 MB card, 145 KB preview |

- The "before" title and person runs overlapped with the other agent's load. CPU times aren't affected by that, wall times may be.
- **Before, a share list card already rendered in a child process.** Its 20 seconds are child CPU: two resvg renders of a 1080 by 1920 card with ten embedded pictures. That time is unchanged and not part of these tickets.
- **After, the child's CPU per title card is higher than the other threads' before** (354 against 129 ms): the child renders synchronously and encodes the JPEG one to four times. It's off the main thread, which is what the page latency depends on.
- A card request that hits the cache cost 9.2 ms of main-thread CPU before (504 KB per answer) and 6.5 ms after (122 KB).
- A missing page's card costs 13 ms of main-thread CPU in both builds: one Crate lookup, then a 404.
- The first card after a child starts takes about 1.1 to 1.3 seconds.

## Cold cards next to page views

5 warm title pages per second (eight well-known movies in turn) next to uncached title cards at a fixed rate, 30 seconds per rate, every card requested once.

### Before

| Cards per second | Page p95 | Page p99 | Card p50 | Card p95 | Main thread busy | Rest of the container | Stalls of 50 ms or more | Longest stall |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 68 ms | 71 ms | | | 27% | 10% | 0 | |
| 1 | 84 ms | 125 ms | 352 ms | 450 ms | 37% | 22% | 27 | 116 ms |
| 2 | 106 ms | 133 ms | 369 ms | 476 ms | 42% | 29% | 22 | 85 ms |
| 5 | 156 ms | 187 ms | 416 ms | 575 ms | 60% | 52% | 64 | 95 ms |
| 10 | 199 ms | 400 ms | 9,960 ms | 15,891 ms | 56% | 55% | 120 | 313 ms |

At 10 per second, k6 dropped 44 card requests because 300 were waiting. Two renders ran at a time and the queue had no bound.

### After

| Cards per second | Page p95 | Page p99 | Card p50 | Card p95 | Main thread busy | Rest of the container | Stalls of 50 ms or more | Longest stall | Generic answers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 71 ms | 78 ms | | | 28% | 10% | 3 | 61 ms | |
| 1 | 71 ms | 76 ms | 453 ms | 688 ms | 29% | 44% | 4 | 54 ms | 0 of 31 |
| 2 | 81 ms | 132 ms | 450 ms | 696 ms | 30% | 74% | 9 | 97 ms | 0 of 61 |
| 5 | 158 ms | 219 ms | 517 ms | 1,077 ms | 35% | 166% | 48 | 155 ms | 0 of 151 |
| 10 | 157 ms | 238 ms | 2,600 ms | 4,063 ms | 37% | 199% | 54 | 237 ms | 212 of 301 |
| 20 | 175 ms | 465 ms | 263 ms | 4,050 ms | 47% | 184% | 48 | 218 ms | 535 of 601 |

- **Verified:** the main thread's share stays at 28% to 37% up to 10 cards per second (37% to 60% before). No request failed and none waited longer than 4.5 seconds.
- **Verified:** two children render about 3 cards per second on this host next to the page load. Above that, the queue fills and requests get the generic card.
- **Inferred:** the page p95 at 5 cards per second (158 ms, the same as before) is the host's CPU, not the main thread: two children and the load generator use the 4 cores (load average 3.3). Production's host has 8 cores.
- A stall of 50 to 60 ms is a page render (see the [render profile](viral-spike-render-profile.md)). The "before" stalls at 1 and 2 cards per second are card renders.

## The warm request

Until this change, every page view sent `POST /api/og-image-warm` three seconds after the page loaded.

| Case | Main-thread CPU per request | Rest of the container | Notes |
| --- | --- | --- | --- |
| Card cached | 5.2 ms | 0.6 ms | 198 requests. The request's floor: a request that does nothing costs 4.7 ms, and a health check that never reaches Remix 1.7 ms |
| Card not cached | 84.4 ms | 117.6 ms | 26 requests. The answer leaves in 5 ms, and the render runs after it, with a stall of about 57 ms in 8 of 26 |

### How often real traffic hits a cold card

Production, read from the metrics endpoint and the container log in five windows between 15:00 and 16:20 UTC (3,356 seconds in total, across four containers because other work deployed in between):

| Measure | Count | Per day |
| --- | --- | --- |
| Warm requests | 197 | about 5,100 |
| Renders that a warm request started (three windows, 2,694 s) | 41 of 131 warm requests (31%) | about 1,300 |
| Of those renders: person pages, title pages | 36, 5 | |
| Requests for a title or person card (`/og/:first/:second`) | 12 | about 300 |
| Requests for a share list image | 8 | about 200 |
| Render time in production, p50 and maximum | 244 ms, 351 ms | |

The slow-paths audit counted 17 card requests in 1,310 seconds earlier that day, about 1,100 per day. No OG cache counter existed, so "cold" for card requests is read from response times: about 5 of the 12 card requests took longer than 200 ms.

### Decision

**Drop the per-page-view request. Render a card on its first request.**

| Option | Verdict |
| --- | --- |
| Keep it | No. It's one of two dynamic requests per anonymous page view, it costs 5.2 ms of main-thread CPU when it has nothing to do (2.6 CPU seconds per second at 500 page views per second), and four in five renders it starts are for long-tail pages that crawlers visit and nobody shares |
| Send it only when the card isn't known to exist | No. The loader would need a cache lookup per page render to know, and the request would still start renders for crawler visits |
| Warm from the server when a page is first rendered | No for title and person pages: crawlers render about 350,000 different title and person pages per day, and each would draw and store a card. Yes for share lists, as a check (see below) |
| Drop it and render on the first request | Yes. A cold title card answers in 0.3 to 0.5 seconds from a child process (1.3 seconds if the child has to start), which is inside what link-preview crawlers wait for |

Share list cards are the exception, because one takes about 20 seconds: a list's card is drawn when the list is saved, when its owner uses **Share** (the request still exists for that), and from the list page's loader when the card isn't in the cache. The loader's check is one in-process lookup per view and one cache read per list and process.

## Where rendering runs and what bounds it

- **One renderer for both kinds of card:** the child process pool that share list cards already used, moved to `app/server/card-renderer/`. Two children by default (`CARD_RENDERERS`). A child holds about 350 MB once it has rendered, measured after 830 cards with no further growth, and exits after ten minutes without a job.
- **Open Graph cards first:** a share list card may use all children but one, so one child is always free for the short jobs.
- **Bounds:** 24 waiting Open Graph cards and 8 waiting share list cards. A job gets 15 seconds (60 for a share list card) before its child is killed.
- **A full queue or a slow render:** the request waits at most 4 seconds, then gets a generic card (the home page's headline, no picture) with status 200, `Cache-Control: public, max-age=60`, and `X-OG-Card: fallback`. The render keeps running and stores its card. If the generic card doesn't exist yet, the answer is 503 with `Retry-After: 2` and `no-store`. A failed render gets the same generic answer. No answer is a 500, and no generic card is cacheable for longer than a minute.

## Storage

- **Store:** Valkey, key `og-card:v1:<canonical path>`, for example `og-card:v1:/movie/603`. The version covers the design, the text rules, and the image format.
- **Lifetime:** 7 days in Valkey. After 24 hours a card is still served and redrawn once in the background, so changed title data reaches a card within a day of its next request.
- **In process:** 32 MB per process (about 250 cards) in front of Valkey. A repeated request for a card that is in this copy reads nothing from Valkey.
- **Before Express:** each complete answer stays under its request path for 10 seconds, see [A hot card](#a-hot-card).
- **Deduplication:** concurrent requests for one card share one render per process. No lock across processes: two instances draw a cold card at most once each, about 0.35 seconds of child CPU.

### Memory estimate

- **Card size:** 125 KB on average (60 title cards), plus 8 bytes.
- **Cards per day:** only requested cards are drawn now. Production's rate is about 300 to 1,100 title and person card requests per day. Counting every one as a different card: 38 to 140 MB per day.
- **At a 7-day lifetime:** 0.27 to 0.96 GB across the cluster, 0.09 to 0.32 GB per node. Each node has about 1.8 GB below its 7 GB limit, and `volatile-lfu` evicts the least used keys first.
- **With the warm request kept**, its 1,300 renders per day would add 0.16 GB per day, 1.1 GB per week.
- **As PNG** (505 KB on average) the same cards would need four times as much.
- Share list images are stored as before: 30 days, one 2.2 MB card and one preview per list and content.

## A hot card

The [checkpoint](viral-spike-checkpoint.md) measured 3.1 to 3.6 ms of main-thread time for a cached card in production, three to five times a stored page, and both instances full at about 500 cards per second. It took the cause to be a read of 132 KB from Valkey per request. That isn't what happens.

### Cause

- **The in-process copy answers.** In a local production build, 18,000 repeated requests for one title card counted as `memory` in `goodwatch_og_cards_total` and one as `rendered`. No request read Valkey.
- **The cost is the way to the loader and back.** A CPU profile of the main thread during 4,500 requests for one hot card: about 0.26 ms of the 0.56 ms per request is Remix matching the path against the app's routes (129 route files), and the rest is Express (the static file lookup, compression, the request log), the Remix request and response objects, and Node's HTTP code.
- **The body doesn't matter.** A 304 without a body cost 0.58 ms, the 139 KB answer 0.61 ms.
- **A share list image does read Valkey on every request:** the list view (10 + 10 seconds, no copy in the process), to learn whether the list still exists and which content hash is current. The image itself comes from the process.

### Change

The `/og/` routes leave each complete answer (headers and a reference to the image buffer) in `app/server/og-image/hot-cards.server.ts` for 10 seconds, under the request path. A request for that path within that time is answered before Express, like a stored page: one map lookup and one write.

- **After 10 seconds** the next request takes the route again, which checks the card's age (and starts a redraw after 24 hours) or the share list's view. So one request per card, process, and 10 seconds costs what every request cost before.
- **Bounds:** 32 MB of referenced images, oldest first. The entries hold no copies. Share list images of the current content hash only, not an old hash's short-lived answer, not the generic card, and no 404.
- **Share lists:** the process that gets a write drops the list's images at once. In the other process, a deleted list's image outlives the list view's 20 seconds by at most 10 more. Its URL was `immutable` for a year before the delete, so every client that fetched it keeps it anyway.
- **Headers:** the same as from the route, plus `X-OG-Card: hot`. The route's own answers now say where the card came from: `X-OG-Card: memory`, `store`, `stale`, or `rendered`.

### Cost

A development machine (a 16-core desktop processor, several times faster per core than the production hosts), one process of a local production build on a throwaway Valkey, production Crate read only. 300 requests per second for 15 seconds over keep-alive connections, three runs each, before and after next to each other. Main-thread CPU comes from `/proc` in ticks of 10 ms.

| Request | Before | After | Wall p50, before and after |
| --- | --- | --- | --- |
| Title card, 139 KB | 0.61 to 0.65 ms | 0.09 to 0.13 ms | 0.70 and 0.20 ms |
| Title card, 304 | 0.58 to 0.63 ms | 0.08 to 0.09 ms | 0.65 and 0.16 ms |
| Share list preview, 145 KB | 0.45 to 0.50 ms | 0.09 to 0.12 ms | 0.58 and 0.20 ms |
| For comparison: a stored page (the About page, Brotli) | 0.12 to 0.14 ms | | 0.20 ms |

- **A hot card costs what a stored page costs.** In production a stored page costs 0.5 to 0.8 ms of main-thread time when measured alone and 0.6 to 1.5 ms in the checkpoint's ramps, which include background work.
- 4,498 of 4,500 requests per run were answered before Express. Two took the route, one per 10 seconds.
- **Not measured:** the production hosts under load. The checkpoint's OG image ramps are the measurement to repeat.

## Weight

### What link-preview crawlers accept

From each platform's own documentation or source code, read on October 4, 2026. "Not stated" means no primary source says.

| Platform | Formats | Limits | Source |
| --- | --- | --- | --- |
| Facebook | `og:image:type` is "one of image/jpeg, image/gif or image/png". WebP isn't listed | 8 MB. At least 200 by 200, recommended 1200 by 630. Caches images by URL | `developers.facebook.com/docs/sharing/webmasters/images/` |
| X | "JPG, PNG, WEBP and GIF formats are supported" | Under 5 MB, 2:1, 300 by 157 to 4096 by 4096. Caches images by URL | Cards documentation, archived copy of February 4, 2026 |
| LinkedIn | Not stated for link shares | 5 MB, at least 1200 by 627, 1.91:1 | `linkedin.com/help/linkedin/answer/a521928` |
| WhatsApp | Not stated | "Under 600KB", at least 300 wide | `developers.facebook.com/docs/whatsapp/link-previews/` |
| Slack | Not stated | Not stated. Cached for about 30 minutes | `api.slack.com/robots` |
| Apple Messages | Not stated | At least 900 wide. Resources up to 10 MB | Apple technical note TN3156 |
| Mastodon | JPEG, PNG, GIF, WebP | 8 MB | `app/models/preview_card.rb` in the Mastodon repository |
| Signal | Desktop: GIF, ICO, JPEG, PNG, WebP, checked by `Content-Type` | 1 MiB on desktop, 2 MB on Android | Signal-Desktop and Signal-Android repositories |
| Bluesky | `image/*` | 1 MB | `app/bsky/embed/external.json` in the atproto repository |
| Google | BMP, GIF, JPEG, PNG, WebP, SVG, AVIF for images in general | Discover: at least 1200 wide | Google Search Central |
| Discord, Telegram, Pinterest, Reddit | Not stated | Not stated | No primary source found |

- **JPEG at 1200 by 630 is accepted everywhere a platform says anything.** Facebook, X, Mastodon, Signal, and Google name it.
- **WebP isn't safe:** Facebook's list leaves it out, and LinkedIn, WhatsApp, Slack, Apple, Discord, and Telegram say nothing.
- **Extension and redirects:** no platform says that it goes by the URL's extension. Signal Desktop checks the `Content-Type` header. No platform documents whether it follows a redirect for the image.
- Facebook and X cache an image by its URL, so a new URL is what makes them fetch the new file.

### Formats compared

60 title cards from the "before" build (47 well-known movies and shows of varied color and title length, 13 long-tail ones), re-encoded from the same pixels. Dissimilarity is ImageMagick 7's SSIM metric against the PNG, where 0 means identical.

| Variant | Min | p50 | p95 | Max | Over 150 KB | Dissimilarity, mean |
| --- | --- | --- | --- | --- | --- | --- |
| PNG as rendered | 24 KB | 554 KB | 721 KB | 770 KB | 56 | 0 |
| PNG, optimized (Pillow) | 16 KB | 415 KB | 555 KB | 570 KB | 56 | 0 |
| PNG, 256 colors | 7 KB | 150 KB | 204 KB | 239 KB | 29 | 0.020 |
| JPEG 4:4:4, quality 90, jpeg-js | 66 KB | 167 KB | 215 KB | 225 KB | 45 | 0.008 |
| JPEG 4:4:4, quality 85, jpeg-js | 58 KB | 139 KB | 178 KB | 186 KB | 14 | 0.012 |
| JPEG 4:4:4, quality 80, jpeg-js | 53 KB | 121 KB | 155 KB | 163 KB | 3 | 0.015 |
| JPEG 4:4:4, quality 85, libjpeg-turbo | 46 KB | 132 KB | 170 KB | 179 KB | 9 | 0.012 |
| JPEG 4:2:0, quality 85, libjpeg-turbo | 32 KB | 100 KB | 125 KB | 132 KB | 0 | 0.020 |
| WebP, quality 80 | 13 KB | 50 KB | 71 KB | 73 KB | 0 | 0.018 |

### Choice

**JPEG without chroma subsampling, encoded by `jpeg-js` (already a dependency), at the first of the qualities 85, 80, 75, 70 that fits into 145 KB.**

- **Why not a 256-color PNG:** half of the cards stay over 150 KB, and posters show banding.
- **Why not 4:2:0:** it's smaller, but it blurs the amber text on black and draws a pale line where the black tag meets the amber panel. That's visible at seven times zoom and faintly at full size.
- **Why not WebP:** a third of the size, but Facebook doesn't list it and six platforms don't say.
- **Why a quality ladder:** a fixed quality of 80 leaves 3 of 60 cards over 150 KB. The ladder keeps simple cards at 85 and lowers only the cards with a busy poster.
- **No resvg setting changes the PNG size.** resvg's PNG encoder has no options.
- `jpeg-js` takes 22 ms per encode on the development machine.

### Size distribution, before and after

Cards from the two builds on the measurement instance, the same pages.

| Cards | Build | Min | p25 | p50 | p75 | p95 | Max | Mean | Over 150 KB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 60 titles | Before (PNG) | 24 KB | 417 KB | 554 KB | 626 KB | 721 KB | 770 KB | 505 KB | 56 |
| 60 titles | After (JPEG) | 58 KB | 124 KB | 132 KB | 138 KB | 143 KB | 144 KB | 125 KB | 0 |
| 5 people | Before | 454 KB | 480 KB | 523 KB | 567 KB | 658 KB | 658 KB | 537 KB | 5 |
| 5 people | After | 95 KB | 101 KB | 103 KB | 112 KB | 122 KB | 122 KB | 107 KB | 0 |
| 7 other pages | Before | 447 KB | 511 KB | 563 KB | 801 KB | 847 KB | 847 KB | 625 KB | 7 |
| 7 other pages | After | 105 KB | 107 KB | 124 KB | 141 KB | 148 KB | 148 KB | 127 KB | 0 |
| Share list preview (one list) | Before | | | 170 KB | | | | | 1 |
| Share list preview (one list) | After | | | 145 KB | | | | | 0 |

- All 72 "after" cards decode as 1200 by 630 baseline JPEG.
- **A card without a poster got larger:** 24 KB as PNG, 58 KB as JPEG. Flat color is what PNG is good at. It's 3 of 60 cards and still small.
- The Discover card is 148 KB at quality 70, the lowest step: it shows twelve posters.
- Existing share list previews keep their file until the list changes. New and changed lists get the 145 KB limit.

### Side by side

Each card as PNG and as the JPEG that the ladder picks, compared at full size, at seven times zoom on text edges, and scaled to 600 pixels wide (a preview's size).

| Card | PNG | JPEG | Dissimilarity at full size | At 600 wide | What differs |
| --- | --- | --- | --- | --- | --- |
| Dark poster (The Matrix) | 721 KB | 139 KB, quality 80 | 0.020 | 0.006 | Nothing visible at full size. At seven times zoom, faint ringing inside the black tag next to the amber letters |
| Bright poster (Barbie) | 417 KB | 113 KB, quality 85 | 0.011 | 0.003 | Nothing visible |
| Long title (Dr. Strangelove) | 364 KB | 144 KB, quality 85 | 0.021 | 0.005 | Nothing visible at two times zoom. Letter edges and the score block are clean |
| Person (Quentin Tarantino) | 480 KB | 101 KB, quality 85 | 0.008 | 0.003 | Nothing visible |
| Share list preview, 720 wide | 889 KB | 132 KB, quality 76 | 0.015 | 0.011 | Nothing visible at 2.5 times zoom on a poster and a dark backdrop |
| Busiest poster in the sample (a hand-drawn collage) | 770 KB | 134 KB, quality 70 | | | Nothing visible at full size. The lowest step |

The comparison images aren't in Git, because they show film posters. [`compare-formats.py`](viral-spike-og-images/compare-formats.py) and [`encode-jpegjs.mjs`](viral-spike-og-images/encode-jpegjs.mjs) reproduce the numbers from any folder of card PNGs.

### URLs and tags

- A page's card is `/og/<page path>.jpg` with `Content-Type: image/jpeg`. `og:image`, `twitter:image`, and `og:image:type` say so. Width and height are unchanged.
- `/og/<page path>.png` keeps answering, with the same JPEG and `Content-Type: image/jpeg`. Links that were shared before name that URL.
- Share list image URLs are unchanged.

## HTTP caching

| Answer | Before | After |
| --- | --- | --- |
| A page's card | `public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400`, no validator | The same `Cache-Control`, plus a strong `ETag` and `Last-Modified`. A matching `If-None-Match` gets 304. Since October 5, 2026, also `X-OG-Card` with the card's source: `hot`, `memory`, `store`, `stale`, or `rendered` |
| A missing page's card | 404, `no-store` | The same |
| Renderer busy or render failed | 500, `no-store` for a failure. No busy answer existed | 200 with the generic card and `public, max-age=60`, or 503 with `Retry-After: 2` and `no-store` |
| Share list image, current content | `public, max-age=31536000, immutable` | The same, plus an `ETag` |
| Share list image, renderer busy | 500 after up to 30 seconds | 503 with `Retry-After: 5` and `no-store` |

A card changes when its title's data changes, so its URL carries no version and it isn't `immutable`. The `ETag` lets a shared cache revalidate without the body.

## Metrics

- `goodwatch_og_cards_total{result}`: `memory`, `store`, `stale`, `rendered`, `missing`, `busy`, `failed`. The cold share of card requests is `rendered` plus `busy` over the total. A page's card that is answered before Express counts as `memory`.
- `goodwatch_og_hot_cards_entries` and `goodwatch_og_hot_cards_bytes`: the answers kept for requests before Express, share list images included.
- `goodwatch_card_renderer_running` and `goodwatch_card_renderer_waiting{kind}`.

## Repeat a run

On the measurement host, with `/opt/gw-og/bench.env` (the webapp's variables with the cache hosts pointing at the measurement Valkey) and the two builds in `/opt/gw-og/build-main` and `/opt/gw-og/build-branch`:

```sh
cd /opt/gw-og/work
./start.sh /opt/gw-og/build-branch            # or build-main
export $(./idle.sh 20)                        # the idle process's CPU, subtracted by batch.sh
./batch.sh title-miss og-title-jpg.txt        # one line per card: wall, main-thread CPU, rest, stalls
METHOD=WARM ./batch.sh warm warm-cached-200.txt
OG=og-cold-jpg.txt ./burst.sh after 30 0 1 2 5 10 20
```

`og-title.txt`, `og-cold.txt`, and `pages.txt` hold one path per line: long-tail titles from the benchmark's long-tail set with `/og` in front and `.png` or `.jpg` behind, and eight well-known title pages. Every script waits while a container named `gw-pagecache-k6` runs and marks its line `overlap` if one started during the run.

## Not measured

- The platforms' preview debuggers. They need accounts. The check after the deploy fetches the cards with link-preview user agents instead.
- Whether any platform follows a redirect for an image, and how long each waits for one. No primary source says.
- More than one share list design. The 20 seconds are from one `podium` card.
- The renderer on production's 8 cores, and with two instances.
- A burst of cold cards for different pages on the public path through the proxy.
