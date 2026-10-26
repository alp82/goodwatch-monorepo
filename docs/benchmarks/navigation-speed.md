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

### On production after tickets 1 to 4

Measured on October 23, 2026, with the same script, flow, profiles, and three runs as [Results on production](#results-on-production), after commit `16e27739` and a later deploy that contains it. Anonymous visitor. Paint time in ms from the press. Raw results: `navigation-speed/after-*.json`.

| Profile, mode | Before: median, p90 | After: median, p90 |
| --- | --- | --- |
| Desktop, hover | 165, 475 | 36, 338 |
| Desktop, tap | 188, 303 | 91, 308 |
| Phone (slow 4G, 4× CPU), tap | 355, 1,448 | 51, 675 |

| Step | Desktop hover, before → after | Phone tap, before → after |
| --- | --- | --- |
| List → first title | 90 → 22 | 1,119 → 88 |
| Title → first person | 91 → 25 | 1,744 → 1,170 |
| Person → title | 197 → 21 | 312 → 51 |
| Back or Forward | 198 → 36 | 274 → 26 |
| Category → title | 89 → 21 | 397 → 62 |

What is still slow:

- **A click with no hover before it** (the desktop tap mode presses at once) still waits for one server round trip: 200 to 300 ms right after two deploys. Server work was 1 to 80 ms per request (`Server-Timing`); the rest is network and proxy time. People moving a mouse onto a link rest on it long enough for the hover prefetch, so the hover row is closer to what they see.
- **The phone's first person page** took about 1.2 s (1.7 s before). Its data was already being prefetched when the tap came, but on slow 4G that request shared the connection with poster pictures and other prefetches.
- **Hub → Discover** didn't get faster: the hub's links open in a dialog and the step waits for Discover's own server answer (170 to 340 ms).

Documents: a Googlebot and browser snapshot of 60 production URLs after the deploy, compared with the snapshot from before any change, showed no change in structure apart from two title pages that were incomplete (`no-store`) on one side, which the page cache never stores, and loader data keys that differ with them. Text differences are data updates and [#754](https://github.com/alp82/goodwatch-monorepo/issues/754).


## Production remeasurement, October 26, 2026 (#753)

Measurement only. The October 23 analysis above remains historical; this section measures the current
anonymous baseline after tickets 1–4. Source checkout `bb1265d4a`; the production deployment SHA was
not independently established. Direct public `https://goodwatch.app`, from the owner's machine, using
**unmodified** `goodwatch-benchmark/navigation/nav.mjs`. Measurements ran at 00:16–00:30 UTC. Three fresh browsers per profile/mode,
Playwright 1.58.2 and Chromium build 1248 (the same browser build named in the earlier method), no cookies,
proxy, related-map blocking, local app server or production environment file. Profiles remain desktop
1440 × 900 unthrottled, and Pixel 7 slow 4G (150 ms latency, 1.6 Mbit/s down, 750 kbit/s up), CPU 4×.
The script's 1.2 s reader pause and 300 ms desktop hover remain unchanged. Runs are sequential on this
machine; Lighthouse ran on worker3. Navigation timing is measured in the page, from pointerdown to the
first frame after Remix commits, not until all images finish or the initial page load completes.

Reproduction (with Playwright available and `TMPDIR=$HOME/.cache/gw-work/236-753`):

```sh
CHROME_PATH="$HOME/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome" \
  node goodwatch-benchmark/navigation/nav.mjs https://goodwatch.app desktop hover 3 "$TMPDIR/desktop-hover.json"
CHROME_PATH="$HOME/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome" \
  node goodwatch-benchmark/navigation/nav.mjs https://goodwatch.app desktop tap 3 "$TMPDIR/desktop-tap.json"
CHROME_PATH="$HOME/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome" \
  node goodwatch-benchmark/navigation/nav.mjs https://goodwatch.app mobile tap 3 "$TMPDIR/mobile-tap.json"
```

Raw navigation evidence (all requests, without filtering) is in [remeasure-2026-10-26/](remeasure-2026-10-26/), retaining each step's
target, timing, error and requests. Percentiles are nearest rank, pooled over successful steps as in
`navigation/stats.py`. Three runs per mode are a small lab sample, not a field p90.

| Anonymous profile | October 23 before: median, p90 (ms) | October 23 after: median, p90 (ms) | October 26: median, p90 (ms) | Successful steps |
| --- | --- | --- | --- | --- |
| Desktop, hover | 165, 475 | 36, 338 | 25, 170 | 39/39 |
| Desktop, tap | 188, 303 | 91, 308 | 88, 338 | 39/39 |
| Phone, tap | 355, 1,448 | 51, 675 | 43, 1,273 | 24/39 |

| Step | October 23 after: desktop hover / phone tap median (ms) | October 26 desktop hover median / max (ms) | October 26 desktop tap median / max (ms) | October 26 phone tap median / max (ms) |
| --- | --- | --- | --- | --- |
| List → first title | 22 / 88 | 23 / 54 | 170 / 194 | 1,276 / 1,277 |
| Title → first person | 25 / 1,170 | 188 / 275 | 106 / 118 | 886 / 1,193 |
| Person → title | 21 / 51 | 21 / 52 | 22 / 41 | 54 / 54 |
| Back or Forward (12 samples each) | 36 / 26 | 30 / 93 | 54 / 96 | 31 / 35 |
| Hub → Discover | Not separately tabulated / unavailable | 23 / 23 | 338 / 905 | Unavailable |
| Shows → category | Not separately tabulated / unavailable | 170 / 505 | 222 / 370 | Unavailable |

**Phone coverage caveat:** each run had two 30-second hub-selector timeouts and one missing shows/category
link: nine explicit errors total. In addition, the `title→title` and `discover→title` slots produced
`commit: null, paint: null` in all three runs: six further unmeasured steps. The unchanged harness waited
for them but recorded no commit/paint; this does not establish either their latency or whether their target
navigation completed. `stats.py` excludes these entries, so only **24/39** steps enter the phone aggregate,
versus **39/39** for each desktop mode. A 43 ms phone median is not evidence that the full journey became
faster than October 23: the mix of timed steps differs, and slow/missing steps are not assigned zero.
After the failed hub navigation, the `category→title` slot actually starts from a title page; its median
is 63 ms (max 65), not a verified category-page transition. All timed steps were SPA changes; no recorded
step triggered a document load. Phone hub and intended category coverage remain open.

**Specific slow paths:** the phone's first title is consistently 1,273–1,277 ms, versus the earlier after
median of 88 ms. In every run 29 script requests start between pointerdown and paint; `detailsMeta` starts
10–13 ms after the press and takes 1,215–1,224 ms. This aligns closely with the delayed commit, although
it is not an isolated causal test. The first person route's script starts 6–8 ms after the tap and takes
820–1,099 ms, alongside its 859–1,193 ms paint times. The first-person targets differ between runs
(Diane Keaton and Robert Duvall), and the desktop target is Richard S. Castellano: these automatic link
choices are not a controlled comparison of one identical page. Desktop tap's hub → Discover median is
338 ms, maximum 905 ms. These tails matter despite fast cached/history transitions.

### Member measurement remains open

No production member session was supplied to this task. The harness starts a fresh isolated browser and
cannot reuse the owner's signed-in browser. No password or credentials were requested, copied from `.env`,
or committed. Anonymous results cannot establish member speed or the cost of session resolution.

The smallest owner input is **one valid goodwatch.app member session cookie export**, in the Playwright
cookie-array JSON format accepted by `browserContext.addCookies`, placed outside the repository, for example
`$HOME/.cache/gw-work/236-753/private/member.cookies.json` (directory mode 700, file mode 600).
Each cookie needs `name`, `value`, and either `url` or `domain` plus `path`; preserve the export's `secure`,
`httpOnly`, `sameSite` and expiry fields. This is a cookie array, not an entire `storageState` wrapper.
Only cookies needed for the current site's member session are needed; a password is unnecessary.
The owner can supply the private file path via the orchestrator. Do not paste cookie values in an issue,
benchmark document, or console output.

Then repeat each command with that private file path as the final argument, verify that the browser is
actually a member (rather than silently accepting an expired session as anonymous), and report member
results separately. Record only that the member identity was verified, not the identity or cookie values.
These runs were not performed, and #753's member question is still unanswered. The existing catalog-only
flow does not cover member-only My movies/My shows pages either; those would need a separately specified
flow, with their visit side effects considered before running under this read-only brief.

### Recommendation and validation

- **First #753 follow-up:** supply the member session and measure it before choosing an authentication
  optimization. Session memoization/cookie caching changes next-request sign-out behavior and remains an
  owner decision; these anonymous timings do not justify it.
- **Anonymous follow-up:** first confirm and repair the phone benchmark's missing commits and
  mobile selectors in a separate benchmark task, so it verifies the intended destination for every step.
  Then prioritize warming the first title/person route code before the tap, and inspect prefetch/network
  contention, before an instant frame from card data. The first title is now about 1.276 s, with late
  route code reaching nearly the same duration; history steps are already around 31 ms. If the owner
  chooses an app follow-up from today's partial evidence, that route-code path is the best-supported
  #753 candidate. Do not change session caching on the strength of these anonymous runs.
- **Alternative priority:** the home median improved from 4,559 to 2,349 ms, but still misses #236's 2 s
  goal, and median TBT is 986 ms with 33 scripts. See the
  [home report](viral-spike-render-path-budget.md#production-remeasurement-october-26-2026-236).
  A small rendering/preload investigation with payload/TBT guardrails is the recommended implementation
  option if work must start before the member session is available. Otherwise keep this as measurement
  only until the member baseline is available. Doing nothing accepts the remaining delays and overruns.
- **Checks on unchanged application source:** benchmark Node tests **51 passed, 0 failed**; benchmark
  self-test passed (summaries, abort reporting, trimming, medians, deltas, 1,535 long-tail entries).
  `npm ci --include=dev` succeeded with `SHARP_IGNORE_GLOBAL_LIBVIPS=1` after the first attempt failed
  because global libvips triggered a Sharp source build. No environment file was copied or server started.
  `npx tsc --noEmit` exited 2 with **192 TS diagnostics** (including existing `usePageTracking` undefined
  `data.pages` and route indexing errors). `npm test` exited 1: **5,244 tests, 5,226 passed, 9 failed,
  8 skipped, 1 todo**. Failures include search/title-snapshot module loading, committed interaction cache
  invalidation, IMDb import/watch assertions, auth notice assertions and library picker assertions.
  This commit changes no app source or test and makes no claim that the existing app checks pass.
  Flows/`pytest` were not run because no flow changed. Raw command logs remain in
  `$HOME/.cache/gw-work/236-753/` on the measurement machine.
- **Limits:** no member session, real phone, Safari, Firefox or field measurements. Navigation timing
  does not prove that destination images are visible at the first measured frame.

## Complete phone coverage and member measurements — October 26, 2026 (#753)

This section supersedes the partial phone aggregate and the open member-measurement status above.
Application source was unchanged. Measurements used production `https://goodwatch.app`, Chromium
1248 (Chrome for Testing 156.0.8078.4), Playwright 1.58.2, five fresh-browser rounds for each of
six identity/profile/mode combinations. Desktop remains 1440 × 900; phone remains Pixel 7,
150 ms network latency, 1.6 Mbit/s download, 750 kbit/s upload and 4× CPU throttling.
The 1.2 s reader pause, 300 ms desktop hover and 3.5 s settling period remain in the harness.
No local server, production environment file or application changes were used.

### What was wrong with the phone harness

The earlier phone result contained **24/39 timings**, nine selector errors and six missing
commit/paint timings. The desktop-only `header` selector could not reach the phone's **Browse
GoodWatch** dock button: two hub failures per round caused six errors and left the later
shows/category selector on the wrong page, causing the other three. The category step now
selects the documented `/shows/best` destination explicitly.

The other six failures were first taps on action-enabled poster cards. Those taps reveal an
action overlay and deliberately prevent navigation; no route commit exists to time. The harness
now waits for that asynchronous reveal and taps **only its Open anchor**, checking its destination.
It never taps the overlay's centre, Seen, score, Want to See or other action buttons. It records
`preparationTap` and `preparationMs` separately. Navigation latency remains from the **navigation
press** to the frame after the router commit; add `preparationMs` for the measured automated
first-tap-to-frame duration. That extra time includes harness processing, not a human decision pause.

The timing hook freezes the first commit and its frame for each navigation press. A later internal
query restoration cannot overwrite that pair or produce paint before commit. A bare `/discover`
link may restore its member-default query (observed: `?foryou=0`); explicit queries and history
entries still match exactly. A regression test reproduced the overwrite before the fix.

Every step now records its actual source and destination, checks the expected destination (including
Back/Forward's expected history entry), and requires non-null commit/paint timings. A failure stops
the journey and makes the command exit unsuccessfully; later steps cannot silently inherit the
wrong page. Output is saved after each round. Resource evidence also includes requests begun before
the press that finished afterward (`start < 0`), first-party loader/script/API timing and
`Server-Timing`. Images and external resources are omitted from the saved resource list to avoid
member-avatar identifiers. The router build version is recorded to detect deployment changes.

### Member access and read-only method

`ghostex browser --help` documented the embedded CEF CDP connection. Playwright connected to
`http://127.0.0.1:9334` only to read goodwatch.app cookies once. The export was stored exclusively at
`~/goodwatch-private/753/cookies.json` (directory 0700, file 0600), imported into separate headless
contexts, and deleted after the runs. No owner's tab was navigated or reused. Each fresh context
verified the root loader's member boolean before measuring; an expired session would fail the run.
No identity, response body, cookie or authentication header is included in evidence.

The harness blocks write fetch/XHR methods, form submission and beacons in page APIs.
It permits the app’s documented catalog-query POST endpoints (including anonymous Discover
queries); these read data and do not change member state. Telemetry and poster impressions
are blocked equally in every profile. It avoids Playwright request routing, which disables the browser HTTP cache and would change the measurement.
The flow visits catalog pages and history only; it does not change member data or settings.

### Complete results

Final runs: **01:50–02:26 UTC**, October 26. All 30 fresh browsers reported Remix manifest
**`27679bb9`**. All **390/390** steps verified their destination and recorded commit/paint; all
were SPA navigations. Both phone identities recorded **65/65**, including **39/39** in the first
three rounds, against the earlier anonymous **24/39**. Every final batch used the corrected
first-commit hook, query handling and read-only query guard. Exploratory runs that exposed these
harness defects were discarded before these final batches; no failed or null slot enters this table.
Raw evidence: [remeasure-2026-10-26-complete/](remeasure-2026-10-26-complete/).

Navigation press → first frame, milliseconds; median and nearest-rank p90:

| Profile | Anonymous median, p90 | Member median, p90 | Timed coverage (each identity) |
| --- | --- | --- | --- |
| Desktop, hover | 21, 41 | 24, 288 | 65/65 |
| Desktop, tap | 73, 176 | 89, 407 | 65/65 |
| Phone, tap | 56, 2464 | 97, 2744 | 65/65 |

**Phone two-tap cost:** each identity revealed a card overlay on ten of its 65 steps (title → title
and Discover → title in each round). Preparation took 116–348 ms for anonymous visitors and
134–349 ms for members. Including that measured preparation, first tap → frame is **317, 2,464 ms
anonymous** and **374, 2,744 ms member** (median, p90). The primary table times the Open/navigation
press; the inclusive figures expose the extra gesture rather than treating the first tap as a
missing page change. A person's pause before choosing Open would add to these automated figures.

Per-route median, p90 in ms. Each ordinary cell has five samples (so p90 is its maximum);
Back/Forward pools 20 samples per profile. Automatic title/person choices can differ across identities.

| Step | Anonymous phone | Member desktop hover | Member desktop tap | Member phone |
| --- | --- | --- | --- | --- |
| List → first title | 1264, 1274 | 20, 171 | 380, 574 | 1064, 1139 |
| Title → first person | 1072, 1082 | 25, 288 | 90, 137 | 1103, 1330 |
| Person → title | 48, 51 | 20, 21 | 21, 21 | 56, 71 |
| Title → title | 55, 56 | 23, 1455 | 269, 353 | 85, 97 |
| Back / Forward | 27.5, 35 | 22.5, 37 | 23, 67 | 33, 42 |
| Hub → Discover | 580, 585 | 593, 1106 | 357, 589 | 660, 797 |
| Discover → title | 55, 58 | 21, 21 | 20, 33 | 76, 286 |
| Hub → shows | 317, 379 | 25, 38 | 89, 134 | 289, 428 |
| Shows → best list | 3476, 3695 | 89, 491 | 225, 420 | 4064, 4219 |
| Best list → title | 2461, 2546 | 159, 209 | 258, 605 | 2699, 3905 |

### Slowest member routes and what they wait on

- **Phone `/shows` → `/shows/best`: 4,064 ms median, 4,219 ms p90.** In member-phone round 4,
  the 20 KB loader starts 5 ms after the press and lasts 4,186 ms. TTFB is 430 ms and the server
  reports 385 ms total (346 ms session). Most of that wait remains after the first response byte.
  Anonymous phone median is also high: 3,476 ms. This newly covered step was absent from the old
  phone aggregate.
- **Phone best list → Avatar: 2,699 ms median, 3,905 ms p90.** In round 2, the 19 KB title loader
  starts at +8 ms and lasts 3,852 ms, with TTFB 146 ms and server total 100 ms (42 ms session).
  Its request finishes close to the commit. These two multi-second paths point to a browser/network
  transfer or scheduling bottleneck; headers alone do not identify the competing resource or prove
  a request-priority cause.
- **First phone title/person pages: 1,064 / 1,103 ms member medians, p90 1,139 / 1,330 ms.**
  Title round 2 loads `detailsMeta-C0Wav1cc.js` at +13 ms for 1,076 ms, close to its 1,139 ms paint.
  Person round 2 loads `person._personKey-BHVctQO9.js` at +6 ms for 1,147 ms; its loader began
  577 ms before the navigation press and finishes around +1,296 ms, near the 1,330 ms paint.
  The first title is primarily aligned with late route code; the person tail can wait for both
  route code and an unfinished loader prefetch. This remains about a second despite fast cached steps.
- **Hub → Discover: member hover 593/1,106 ms, desktop tap 357/589 ms, phone 660/797 ms.**
  Hover round 5 begins its loader 270 ms before the press, but that request lasts 1,352 ms
  (TTFB 1,348 ms): server total 1,261 ms, session 393 ms. Phone round 1 spends 756 ms on the
  loader (TTFB 703 ms), with server total 623 ms and session 326 ms. Server work, including
  session resolution and discovery reads, is material here; hover's head start cannot always hide it.
- **Session resolution can dominate member desktop waits.** Hover round 5's title → title takes 1,455 ms;
  the loader lasts 1,715 ms after starting 273 ms before the press. Server total is 1,625 ms,
  of which session resolution reports 1,483 ms. Desktop tap's first-title median is 380 ms;
  its worst response reports session 406 ms within 447 ms server total. Cached medians alone
  conceal this cost. `Server-Timing` fields can overlap, so do not add session and data durations.
- **History is usually fast, with one member-phone outlier:** median 33 ms, p90 42 ms across
  20 steps; one Forward takes 1,058 ms. It refetches Avatar's loader for 1,012 ms (353 ms server,
  including 290 ms session). These captures establish the refetch, not why that history entry
  was unavailable in the client cache.

### Recommended follow-up

**Prioritize the phone's critical network path on catalog navigations.** The biggest newly verified
waits are 2.7–4.2 seconds while the corresponding loaders report only 0.1–0.4 seconds on the server.
Start with a CDP network/priority trace and a controlled experiment that gives the navigation loader
and required route modules precedence over competing image/speculative work. Test a small,
byte-budgeted warm-up of the first reachable title/person module after catalog load: late code still
costs roughly a second. Measure the full repaired journey, including preparation taps, and retain
payload/TBT/LCP guardrails. Scope this work to catalog/navigation preparation and coordinate shared
root changes with #236's separate home-LCP thread; this benchmark changed no webapp file.

**Next, investigate member session-store latency and Discover's server work.** The 1,483 ms session
outlier and repeated 300–400 ms session spans warrant a backend investigation; Discover can also spend
well over that in total server work. Earlier preparation when the hub opens may hide some of the wait,
but does not make the backend cheaper. Preserve next-request sign-out enforcement. Cross-request
session memoization or cookie caching still needs a separate owner decision; this task authorizes
measurement, not that behavior change. Neither another cache/history tweak nor a universal route-code
warm-up alone addresses the measured multi-second phone loader transfers.

Reproduction uses an external Playwright installation, keeping dependencies outside the benchmark tree:

```sh
export TMPDIR="$HOME/.cache/gw-work/753"
export PLAYWRIGHT_FROM="$TMPDIR/package.json"
export CHROME_PATH="$HOME/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome"
node goodwatch-benchmark/navigation/nav.mjs https://goodwatch.app desktop hover 5 /path/to/results.json
# Repeat for desktop tap and mobile tap. For members, append the private cookie path.
# The export used here was deleted; a future run needs a newly authorized session export.
python goodwatch-benchmark/navigation/stats.py docs/benchmarks/remeasure-2026-10-26-complete/*.json
```

### Validation and limits

- The original evidence confirms 24/39 timed phone slots, nine explicit selector errors and six
  null timings. A fresh original-harness phone reproduction again produced a title-to-title tap
  with null commit/paint and no destination change. The corrected production pilot completed 13/13.
- New browser regression checks exercise the hidden desktop header/visible phone dock, an
  asynchronously revealed card overlay, safe Open-anchor navigation, the write guard (including
  allowing Discover's read-only POST), first-commit timing under query restoration, destination-query
  validation, and rejection of missing/unverified timings: **4 passed**.
  Existing benchmark Node tests: **51 passed, 0 failed**. The benchmark self-test passed summaries,
  abort reporting, trimming, medians, deltas and 1,535 long-tail entries.
- `npm ci --include=dev` with `SHARP_IGNORE_GLOBAL_LIBVIPS=1` succeeded. On unchanged webapp source,
  `npx tsc --noEmit` exited 2 with **192 diagnostics**. `npm test` exited 1 with **5,289 tests:
  5,273 passed, 8 failed, 8 skipped**. Failures cover combined-search/title-snapshot module loading,
  committed interaction invalidation, IMDb ratings refresh, auth-notice assertions and library-picker
  wording. These checks do not pass on the starting main; no webapp file was edited to fix them here.
- `pytest goodwatch-flows` exited 2 during collection with **87 collection errors**, including missing
  `mongomock`, `mongoengine`, `pymongo`, `crate`, `croniter`, `duckdb` and other flow dependencies.
  No flows were changed. Logs for all checks remain under `~/.cache/gw-work/753/` on this machine.
- These are headless synthetic production measurements, not real-phone, Safari/Firefox or field data.
  The metric is the frame after the router commit, not completion of destination pictures. Automatic
  link choices and member discovery preferences can differ between profiles and rounds; the identity
  comparison is a journey comparison, not an isolated causal test of session lookup cost. Server timings
  and overlapping resources identify candidates to investigate, not proof of isolated critical paths.

The final combined benchmark test command passed **55 tests, 0 failures**. A separate evidence
check verified all six files: five rounds each, the exact 13-step flow, intended destinations,
member/anonymous identity flags, nonnegative commit ≤ paint, a recorded build, and no document loads.
A private audit checked the report and evidence against the session's identifiers and exported cookie
values before deleting the cookie export. No cookies or member identifiers are committed.
