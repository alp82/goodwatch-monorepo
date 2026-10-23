# Navigation speed

How long a page change takes on goodwatch.app, what it waits for, and which changes would make it instant. Measured on October 23, 2026, against production at commit `ce79bb19`, as an anonymous visitor. The primary-source facts behind the browser and Remix behavior are in [instant-navigation.md](../research/instant-navigation.md).

## Summary

- **A page change takes a median of 170 to 190 ms on desktop and 350 to 400 ms on a throttled phone.** The p90 is 300 to 475 ms on desktop and about 1.5 s on the phone. The first visit to a page type on the phone takes 0.9 to 1.8 s.
- **Prefetch saves nothing today.** The browser throws away every prefetched loader response, because loader data has no cache lifetime. The click fetches the same data again, so the prefetch only doubles the server's work.
- **Back and Forward fetch everything again.** They take 130 to 200 ms on desktop and up to 1.3 s on the phone.
- **Phones never prefetch data or code in time.** The hover prefetch starts 100 ms after a touch, after the tap's own request. A tap on the first title loads 13 route script files after the tap.
- **A tap on a title page starts eight related-map requests (72 KB)** that compete with the next page's data.
- **Members weren't measured, and the owner is one.** Member loader data is `private, no-store`, and every member loader call runs an uncached Better Auth session lookup (a Valkey read, a session row, and a user row). For members this may cost more than anything else here. The ranking at the end is proven for visitors only.
- **What-if runs through a local proxy:** with a 60-second private lifetime on loader data, the median page change with hover drops from 143 to 59 ms on desktop (p90 415 to 112 ms). On the phone, if the prefetch could start before the tap, it would drop from 279 to 62 ms.

## How it was measured

- **Script:** [`goodwatch-benchmark/navigation/nav.mjs`](../../goodwatch-benchmark/navigation/nav.mjs), Playwright with Chromium 1248. It clicks real links in a fixed path and times each step inside the page: from `pointerdown` on the link to the frame after the Remix router commits the new location ("paint"). It also records every request after the press.
- **Path:** `/movies/best` → a title → a person → a title → another title → Back → Back → hub → Discover → a title → hub → `/shows` → `/shows/best` → a title → Back → Forward. On the phone profile, the hub steps failed (the phone header has no hub button). The phone's next steps then started elsewhere: its "Discover → title" started on a person page, and its "Category → title" on a title page. The table lists them as person → title and title → title.
- **Profiles:**
  - Desktop: 1440 × 900, no throttling, from the owner's machine (about 25 ms to the site).
  - Phone: Pixel 7 emulation, slow 4G (150 ms latency, 1.6 Mbit/s down), CPU slowed 4×.
- **Modes:** `tap` presses the link without a pause. `hover` rests the pointer on the link for 300 ms first, which lets `prefetch="intent"` fire. On the phone profile, `hover` is synthetic: it shows what would happen if the prefetch started before the tap, which a real phone doesn't do.
- **Paint:** the first frame after the Remix router commits the new location. The new page's markup is in that frame, but its pictures may not be loaded yet.
- **Percentiles:** nearest rank.
- **Runs:** three per profile and mode on production, each in a fresh browser. The what-if runs on the phone with hover have two runs each. One step waits 1.2 s before the press, as a reader pauses.
- **What-if runs:** [`proxy.mjs`](../../goodwatch-benchmark/navigation/proxy.mjs) runs on `localhost` in front of production and changes only response headers. The baseline goes through the same proxy, so both sides pay the same HTTP/1.1 cost. Absolute proxy figures aren't comparable with the production figures.
- **Raw results:** [`navigation-speed/`](navigation-speed/), trimmed to loader data, API, and script requests.

## Results on production

Median and worst paint time in ms, from the press to the new page's first frame. Back/Forward rows pool 12 steps, the others 3. A phone cell with two figures holds two steps of the same kind.

| Step | Desktop, tap | Desktop, hover | Phone, tap | Phone, hover |
| --- | --- | --- | --- | --- |
| List → title (first title) | 159 (291) | 90 (388) | 1,119 (1,177) | 874 (978) |
| Title → person (first person) | 114 (115) | 91 (379) | 1,744 (1,809) | 1,528 (1,528) |
| Person → title | 208 (238) | 197 (273) | 312 (546); 295 (663) | 286 (4,746); 532 (648) |
| Title → title | 139 (241) | 76 (244) | 314 (1,448); 397 (984) | 282 (779); 847 (999) |
| Back or Forward | 195 (340) | 198 (475) | 274 (971) | 274 (857) |
| Hub → Discover | 224 (406) | 141 (489) | - | - |
| Discover → title | 172 (232) | 241 (613) | - | - |
| Hub → `/shows` | 149 (303) | 73 (475) | - | - |
| `/shows` → `/shows/best` | 224 (333) | 156 (165) | - | - |
| Category → title | 188 (200) | 89 (476) | - | - |
| **All steps: median, p90** | **188, 303** | **165, 475** | **355, 1,448** | **398, 1,510** |

Server time for loader data alone, measured with `curl` for 12 random movie titles, three rounds: median 84 ms, p90 181 ms, maximum 333 ms, including one round trip of about 25 ms. A second request for the same title wasn't reliably faster, because requests alternate between the two page instances.

## What a page change waits for

The findings are ranked by how much time they cost. "Measured" means the benchmark shows it. "Code" means the code shows it, and the effect wasn't measured.

### 1. Prefetched loader data is thrown away (measured)

- `<Link prefetch="intent">` inserts `<link rel="prefetch">` for the next page's `?_data=` URL. The click then calls `fetch()` on the same URL. Remix keeps no copy, so reuse depends on the browser's HTTP cache.
- Since Chrome 133, a prefetched response is reused only when normal HTTP caching allows it. The older "five-minute rule" is gone. Firefox already worked this way. Safari doesn't support `rel=prefetch`.
- Title, person, and Discover data have no `Cache-Control` and no `Last-Modified`, so they can't be reused. Start page data says `private, max-age=0`. Member data says `private, no-store` (`applyCachePolicy` in `cache-identity.server.ts`).
- In every hover run, the click's own data request went to the network and waited for the server (30 to 500 ms), although the pointer had rested on the link long enough for the prefetch to fire. In the tap runs, the prefetch fired about 100 ms after the press and fetched the same URL a second time, alongside the click's request. (The recorded requests start at the press, so the hover runs' earlier prefetches aren't in the raw files.)
- Arriving on `/shows` starts 10 more viewport and render prefetches (one is 105 KB). None can be reused either.

### 2. Members wait for a session lookup on every loader call (code, not measured)

- Production runs Better Auth (`BETTER_AUTH_ENABLED` is `true` in the root loader data). `resolveSession` in `utils/auth-session.ts` has no memo and no cookie cache for Better Auth ("signing out takes effect on the next request"), and `auth.server.ts` sets `cookieCache: { enabled: false }`. Every member loader call reads the session from Valkey and then finds the session and the user in the database (`secondaryStorage.get`, `auth.server.ts:229-245`).
- Title loaders run the session check, then the media context, then the title read, in that order. The code audit found loaders that run the session and context steps again in `presentCatalogLoader` and `liveMediaLanguage`.
- Member data is `no-store`, so for members a hover prefetch is always wasted, and the server runs each loader twice.

### 3. Phones load route code after the tap (measured)

- The first tap on a title waited for the route's 13 script files: 1.1 s on slow 4G, with the data fetch done after 0.7 s. The first person page waited 1.2 s for its route file.
- `prefetch="intent"` waits 100 ms after `touchstart`, so on a tap it starts after the navigation already asked for everything. Viewport prefetch is used on only 8 links.
- Once the code is cached, a phone page change costs one round trip for data: about 260 to 300 ms on slow 4G.

### 4. A tap on a title page starts the related map's warm-up (measured)

- `ui/related-map/engine.ts` starts loading packs for up to eight titles on the first `pointerdown`, `pointermove`, `touchstart`, `keydown`, or `wheel`. A tap on a link to leave the page counts as use.
- On desktop the person page's data and the eight requests all waited about 600 ms in one run. On the phone the eight requests (72 KB, `private, no-store`) shared the slow link with the next page's data.
- Blocking them cut the phone's title → person step from 1,543 to 1,330 ms (median of three, through the proxy). The proxy speaks HTTP/1.1 with six connections per host, where these requests compete more than over production's HTTP/2, so the gain on production is likely smaller.

### 5. Back and Forward fetch again (measured)

- A history step runs the loaders again, because neither Remix nor the HTTP cache keeps the data. Desktop: 130 to 200 ms. Phone: 215 to 1,340 ms.

### 6. The whole loader must finish before anything changes (code)

- No production route uses `defer`. A title page waits up to 150 ms for related titles, genre links, and the collection, and members wait up to 500 ms for the "sides" line. Until the loader ends, the old page stays on screen with a 4 px bar at the top (`ui/nav/GlobalLoading.tsx`).

### 7. Smaller costs (code)

- **A full reload after some navigations:** `ui/DiscoveryContinuity.tsx` calls `window.location.replace` when someone opens `/discover`, `/movies`, `/shows`, and other listing paths without a query string and their last visit had one. That loads a whole document after the client navigation finished.
- **Storage writes while scrolling:** the same component reads and writes its whole history object in `localStorage` on every scroll event, and its per-path map is never trimmed.
- **Animated scroll to the top:** `<html class="scroll-smooth">` in `root.tsx` makes the scroll after a navigation animate on pages that the continuity component doesn't handle.
- **Links without prefetch:** start page titles, the related map, search palette results, breadcrumbs, the genre row heading, and most profile links. The person page's "Highest rated" link (`person.$personKey.tsx:507`) has no prefetch.
- **No hero preload:** the hero backdrop request starts only after the new page renders. 103 Early Hints cover full document loads only.

## What-if runs

Each pair ran through the local proxy against production. Median and p90 of all steps, in ms.

| Change | Profile | Before | After |
| --- | --- | --- | --- |
| Loader data `private, max-age=60`, hover | Desktop | 143, 415 | 59, 112 |
| Loader data `private, max-age=60`, synthetic hover, two runs | Phone | 279, 916 | 62, 584 |
| Related-map requests blocked, tap: title → person only | Phone | 1,543 | 1,330 |

With cacheable data, a prefetched click committed 13 to 27 ms after the press, and Back and Forward took 44 ms on desktop and 59 ms on the phone. What remained slow on the phone was the first visit to each page type (549 to 710 ms), which waits for route code.

## What would make it instant

"Instant" here means the new page is on screen within 100 ms of the press for links someone can reach on the page, and within 300 ms for the rest, on a phone too. Ranked by expected effect. Every figure is from the runs above; the rest is inference.

1. **Keep loader data in the browser.** Two ways, and they combine:
   - Give anonymous loader data a short private lifetime, such as `private, max-age=60`, in `handleDataRequest`. Measured: desktop median 143 → 59 ms. It needs a guard: today `applyCachePolicy` drops `Vary: Cookie` and `Accept-Language` from private responses (`cache-identity.server.ts:196-201`), so without one, a visitor who signs in, or changes country or language, would get the cached anonymous data on Back for up to 60 seconds. Either vary on the cookie or put the cache identity into the data URL.
   - Make title data the same for everyone. Member state already lives in a client query (`/api/user-data`). The only member-specific part of a title loader is the "sides" line (up to 500 ms). Fetched on the client instead, title data could carry one cache lifetime for members and visitors alike.
   - Add an app-level cache of loader data with `clientLoader`, filled by our own prefetch, read on click and on Back/Forward, and refreshed in the background. It covers Safari's missing `rel=prefetch` and gives full control of freshness after a member's own writes. Remix doesn't prefetch data for a route with a `clientLoader`, so our prefetch must warm it.
2. **Make member loads cheap.** Memoize the Better Auth session per request and for a few seconds per session (or turn on its cookie cache), run it in parallel with the title read, and drop the repeated session and context steps. For the owner's own experience this may matter more than item 1. Measure members first, see [Open questions](#open-questions).
3. **Load route code before the tap.** After hydration, when the browser is idle, `modulepreload` the code of the main page types (title, person, Discover, category, best lists). Measured on the phone: a first title visit costs 0.9 to 1.1 s today against about 0.3 s with the code cached.
4. **Prefetch data on phones.** Start the prefetch on `touchstart` without the 100 ms delay, and prefetch the first visible cards when the list stops scrolling. It needs item 1 to be of any use.
5. **Leave the related-map warm-up out of navigations.** Don't count a press on a link as use of the map, or wait for an idle moment. Measured on the phone through the proxy: title → person 1,543 → 1,330 ms.
6. **Show the next page at once.** Render the title page's frame from what the card already knows (title, poster, year), and stream the slow parts with `defer`. This is what makes a link that couldn't be prefetched still feel instant.
7. **Small fixes:** remove the reload in `DiscoveryContinuity`, throttle its storage writes, remove `scroll-smooth` from `<html>`, add prefetch to the links listed in finding 7, and preload the hero picture in the title routes' `links`.

Not worth it as a speed lever: Speculation Rules (they don't apply to client navigations), View Transitions (they start after loaders), and moving to Single Fetch or React Router 7 (the same prefetch reuse rules apply).

## Open questions

- **Member page changes aren't measured.** The benchmark accepts a cookie file (`nav.mjs ... <cookieFile>`), but it needs a production session. A local stack wouldn't show production's session store latency.
- **Field data:** PostHog has Web Vitals by route pattern, but no figure for client navigations was read for this page.
- **Which links people tap most** wasn't checked. The ranking above assumes title cards and Back.

## Changes

### Ticket 2: client cache of loader data and our own prefetch

Catalog pages now keep their loader data in the browser, and the site prefetches it on hover, focus, press, and (on phones) for visible cards. The rules, what clears the cache, and the guarantee that documents stay server rendered are in [navigation-cache.md](../navigation-cache.md).

Measured on October 23, 2026, with `nav.mjs` against two local production builds on the bench data stack (134 movies, no people, an empty `/shows`): the base commit `955a6a12` and the candidate. The flow was adapted to that data: person and `/shows` steps became title steps. The timing method is unchanged. Three runs per profile and mode, paint time in ms from the press.

| Profile, mode | Base: median, p90 | Candidate: median, p90 |
| --- | --- | --- |
| Desktop, hover | 58, 76 | 23, 70 |
| Desktop, tap | 56, 83 | 55, 77 |
| Phone (slow 4G, 4× CPU), tap | 209, 1,053 | 145, 211 |

- **Phone taps:** list → title went from 1,054 to 93 ms (the code warm-up loaded the route before the tap), title → title from 209 to 40 ms, and Discover → title from 213 to 44 ms (prefetch on touch and on scroll stop).
- **Desktop hover:** forward steps went from 38 to 73 ms to 20 to 26 ms. The local server answers in a few ms, so on production, with 30 to 500 ms of server time, the gain is larger.
- **Desktop tap without hover:** no change. The press prefetch starts only a few ms before the click.
- **Back and Forward didn't change on the bench (about 50 ms desktop, 205 ms phone).** Every history step in this flow lands on a title page, and every bench title page is incomplete (the related map has no data source locally), so the cache doesn't keep it. A step back to a complete page (`/movies/best`) committed 2 to 4 ms after the press. On production most title pages are complete.
- **HTML:** 15 URLs fetched as a browser and as Googlebot were identical between the builds after normalizing asset hashes.
