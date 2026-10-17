# Landing page: SEO, SSR and Lighthouse

Research for the landing prototype on `/` (branch `prototype/landing-experience`). The owner wants a boot animation
when the TV turns on, then a short intro or capability tiles for first-time visitors, with pointer and ripple hints
like the Explorer tutorial. The page must stay "super SEO friendly": real SSR content and good Lighthouse scores.

Taken on 2026-10-17. Sources are primary (Google Search Central, web.dev, Chrome docs and source, React, Remix,
MDN). Each source's own "last updated" date is given where it has one.

## Recommendation

Build the intro as page content, not as a splash. The server HTML carries the H1, a short explanation of what
GoodWatch is, the capability tiles as real `<a href>` links, and the start titles. All of it is painted at full
opacity on the first frame. The boot animation is a CSS-only layer over the TV screen that animates `transform` and
`opacity` of decorative parts only, never of the H1, the intro text or the LCP image. The decision "first visit or
not" is made in the browser before first paint by a tiny inline script that sets an attribute on `<html>`. The
server HTML stays the same for every guest, so the shared page cache keeps working and React sees no mismatch.

Today's `/` is close. The main gaps are: the H1 is generic, the "What is GoodWatch?" text exists only in a
client-only chunk, the mobile LCP element is the decorative hand photo, the desktop LCP image is `loading="lazy"`,
and the 32 KB (360 KB raw) Tailwind stylesheet blocks render for about 1 s on Lighthouse's mobile profile.

## 1. What the primary sources say

### How Google renders and indexes

- Google crawls, renders and indexes in three phases. Every 200 page is queued for rendering; "The page may stay
  on this queue for a few seconds, but it can take longer than that." Server-side or pre-rendering "is still a great
  idea because it makes your website faster for users and crawlers."
  ([JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), updated 2026-03-04)
- "Google can only discover your links if they are `<a>` HTML elements with an `href` attribute." A `<button>` that
  navigates is not a link to Google. (same page)
- "Google can only see content that's visible in the rendered HTML." (same page)
- Google does not click, type, swipe or scroll. "Don't lazy-load primary content upon user interaction." "Google
  won't load content that requires user interactions (for example, swiping, clicking, or typing) to load."
  ([Mobile-first indexing](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing), updated 2025-12-10;
  [Lazy-loaded content](https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading), updated 2025-12-10)
- The renderer "does not retain state across page loads". Local Storage, Session Storage and HTTP cookies are
  cleared across page loads. So Googlebot is always a first-time visitor.
  ([Fix Search-related JavaScript problems](https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript), updated 2025-12-18)
- Mobile-first indexing explicitly allows "moving content into accordions or tabs to save space", as long as the
  mobile content is equivalent to desktop. (Mobile-first indexing page above)
- The spam policy names hidden text by "zero font size or opacity", off-screen positioning and text behind images.
  It does not count "Accordion or tabbed content", sliders, tooltips, or "Text that's only accessible to screen
  readers" as abuse. Intent matters: hiding "solely to manipulate search engines" is the problem.
  ([Spam policies](https://developers.google.com/search/docs/essentials/spam-policies), updated 2026-08-28)

What this means for each way of hiding content:

| Pattern | Indexed? | Notes |
| --- | --- | --- |
| In SSR HTML, visible | Yes | The safe default. |
| In SSR HTML, in a closed tab or accordion (`display:none` until a click) | Yes, per mobile-first guidance | Fine for secondary text. Keep the main intro visible. |
| In SSR HTML, `opacity:0` that a CSS animation brings to 1 | Google renders the final state, but Chrome LCP may never count it (see below) | Do not do this to the H1 or the intro text. |
| `aria-hidden="true"` | Google publishes nothing on it | It hides content from screen readers. Use it only for decoration. |
| Fetched or rendered only after a click, key press or first interaction | No | Google never interacts. This is how the TV's "What is GoodWatch?" screen works today. |
| Rendered only on the client after hydration (`useEffect`, `ClientOnly`, `React.lazy` with no SSR) | Maybe, after the render queue | Not in the HTML that is crawled first, and slower for users. Avoid for primary content. |

### Core Web Vitals

| Metric | Good | Poor | Source |
| --- | --- | --- | --- |
| LCP | ≤ 2.5 s | > 4.0 s | [Defining the thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds) (updated 2025-05-07) |
| INP | ≤ 200 ms | > 500 ms | [INP](https://web.dev/articles/inp) (updated 2025-09-02) |
| CLS | ≤ 0.1 | > 0.25 | [CLS](https://web.dev/articles/cls) (updated 2023-04-12) |

All three are judged at the 75th percentile of real page loads, split by mobile and desktop.

### LCP and a boot or splash animation

From [web.dev LCP](https://web.dev/articles/lcp) (updated 2025-09-04) and the
[Chromium LCP changelog](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/speed/metrics_changelog/lcp.md):

- Candidates are `<img>`, `<image>` in SVG, `<video>`, `url()` background images, and block elements with text.
- Chromium excludes "Elements with an opacity of 0", elements that "cover the full viewport", and low-entropy
  placeholder images. Changelog: opacity 0 paints ignored since Chrome 86, full-viewport images since 88,
  low-entropy images since 112, transparent text since 130.
- LCP stops being reported at the first tap, scroll or key press.
- Size changes and moves do not create new candidates. A removed element stays the LCP unless a larger one paints.
- Size is the visible part inside the viewport. For text it is the box around the text nodes.
- Since Chrome 147 the candidate is the largest painted image, not the largest pending image.

Fade-ins are not specified. In [w3c/largest-contentful-paint#148](https://github.com/w3c/largest-contentful-paint/issues/148)
(opened 2025-09-19, still open), a keyframe fade from opacity 0 never produced an LCP entry in Chrome. A Chrome
engineer replied that Chromium tracks opacity-0 content that later becomes visible, but "this may apply only to
changes on the document element, not nested content". Treat it as: an element that starts at opacity 0 may be
counted late or not at all. If a page fades all its content in, it can get an FCP and no LCP, which Lighthouse
reports as an error.

What follows for the boot:

- An intro overlay that covers the content does not by itself hurt LCP, if the content under it is painted at full
  opacity. The overlay is the thing that paints. If the overlay is a big image or big text, it can become the LCP
  itself, which is fine as long as it paints on the first frame.
- What hurts is content that waits: hidden until JavaScript runs, faded in from 0, or added by a client effect. web.dev
  names "the LCP element is hidden until the JavaScript code finishes loading" as a render-delay cause.
  ([Optimize LCP](https://web.dev/articles/optimize-lcp), updated 2025-03-31)
- A boot that replaces the screen with black and then fades content in (the TV's current `Boot` after power-on)
  must never run on page load for the content that should be the LCP.
- Speed Index is computed from a video of the load: "computes the visual progression between frames". A 1.7 s
  animation that changes most of the viewport keeps the page visually incomplete and raises Speed Index.
  Mobile green is 0 to 3.4 s. ([Speed Index](https://developer.chrome.com/docs/lighthouse/performance/speed-index), updated 2019-05-02)
- Layout shifts: animating `transform` does not cause layout shifts; changing width, height, top or left does.
  Shifts within 500 ms after input are excluded. ([CLS](https://web.dev/articles/cls))

### Lighthouse scoring

Lighthouse 10 to 12 weights: TBT 30 %, LCP 25 %, CLS 25 %, FCP 10 %, Speed Index 10 %. Scores come from log-normal
curves fit to HTTP Archive data. Most run-to-run variance is not caused by Lighthouse.
([Performance scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring), updated 2019-09-19;
the weights are also in the JSON of the 12.8.2 runs below.)

So on `/` the two levers are LCP and FCP. TBT and CLS are already 0.

### LCP image hints

- "Never lazy-load your LCP image." Use `fetchpriority="high"` on the likely LCP image, on one or two images only.
  ([Optimize LCP](https://web.dev/articles/optimize-lcp))
- Render-blocking stylesheets delay every paint, including the LCP. (same)

### Hydration in React 18 and Remix 2

- [hydrateRoot](https://react.dev/reference/react-dom/client/hydrateRoot) (React docs, current; the repo is on
  React 18.3.1): common mismatch causes are `typeof window` checks and browser-only APIs like `window.matchMedia`
  in render, and different data on server and client. The two-pass pattern (render the server version, switch in
  `useEffect`) "makes hydration slower because your components have to render twice", and "rendering a different
  UI immediately after hydration may also feel jarring". `suppressHydrationWarning` works one level deep and React
  "will not attempt to patch mismatched text content". (The page also shows `use(browser())`, which is newer than
  React 18 and not available here.)
- Remix 2 streaming: return an unawaited promise from the loader and render it with `<Suspense>` and `<Await>`.
  Start deferred promises before awaiting anything else. `abortDelay` defaults to 5 s.
  ([Streaming guide](https://v2.remix.run/docs/guides/streaming)). The docs say nothing about crawlers. Our inference: content that streams in the same response ends up in
  the HTML, but content behind a Suspense fallback that fails or passes `abortDelay` does not. Keep the landing's text and links in the awaited part.

### Structured data for the home page

- **WebSite** with `name` and `url` on the home page is what Google's site names feature reads. `alternateName` is
  optional. ([Site names](https://developers.google.com/search/docs/appearance/site-names), updated 2025-12-10)
- **Organization** goes on the home page or an about page. Recommended: `name`, `url`, `logo` (at least 112 x 112,
  crawlable), `sameAs`, `description`.
  ([Organization](https://developers.google.com/search/docs/appearance/structured-data/organization), updated 2026-09-08)
- **SearchAction / sitelinks search box:** Google removed the box from results starting 2024-11-21. The markup
  causes no errors and need not be removed, but it does nothing.
  ([Farewell, Sitelinks Search Box](https://developers.google.com/search/blog/2024/10/sitelinks-search-box))
  Google announced further simplification of result features in November 2025
  ([update on our efforts](https://developers.google.com/search/blog/2025/11/update-on-our-efforts)); not
  relevant to the home page's types.

### Reduced motion

`prefers-reduced-motion: reduce` means the user asked for less motion; scaling and panning large objects are
vestibular triggers. MDN's example swaps motion for a dissolve.
([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion), modified 2026-06-10)

## 2. What `/` serves today

### Live HTML (curl, 2026-10-17)

| | Normal UA | Googlebot smartphone UA |
| --- | --- | --- |
| Status, cache | 200, `gw-page-cache: miss` | 200, `gw-page-cache: hit` (age 761 s) |
| HTML size | 96.8 KB raw, 18.6 KB gzip | 91.5 KB raw (5 KB less inline script) |
| Headings | same | `h1` "Let's find something good for tonight." twice (desktop and phone editions), `h2` "Popular right now", `h2` "Browse GoodWatch", `h3` Movies, TV shows, Join the Chat |
| Links | same | 52 `<a href>`, 44 unique: 16 start titles, 6 hubs, mood/genre/service hubs, footer |
| Visible text | same | about 2,150 characters |

Both answer the same content. The HTML has `<link rel="canonical" href="https://goodwatch.app/">`,
`robots: index, follow`, a good meta description, and JSON-LD with Organization, WebSite and WebPage
(`app/routes/_index.tsx`). Organization has no `sameAs` (Discord, Reddit, GitHub are linked in the footer).

### What the code renders

- The loader (`app/server/living-room/tv-loader.server.ts`) awaits the start titles and one backdrop. A guest's HTML
  is the same for everyone and goes into the shared page cache (`docs/page-cache.md`, `docs/cache-identity.md`).
- The TV's home screen (`app/ui/living-room/tv/screens/Home.tsx`) is server-rendered in both editions. CSS shows the
  one the window fits (`.tvr[data-room="unmeasured"]` in `living-room.css`). Its H1 is `HOME_HEADLINE`. The tiles on
  the TV are `<button>`s driven by the TV machine, not links.
- "What is GoodWatch?" (`screens/About.tsx`) has the best explanation on the site ("One score, how it feels, where it
  streams. IMDb, Rotten Tomatoes and Metacritic in one number. Free, no account needed."). It is a lazy chunk drawn
  only after hydration and an interaction (`screen-code.tsx`). Google never sees it.
- The section below the room (`BelowRoom.tsx`) is plain SSR links with visible names. This is where crawlers find
  the site today, and it is good.
- **The boot does not run on load.** `readTvState` starts with `power: "on"` (`tv-machine.ts:331`). `Boot` (`kit.tsx`)
  shows only after the power key turns the set off and on, for `TV_BOOT_MS = 1700` ms (`use-tv.ts`).
- **The headline fades in on load.** The big screen name sits in `.tvc-fade`, an animation from opacity 0 over
  0.42 s (`living-room.css:1425`, `@keyframes tvc-fade`). It is not the LCP today because the images are larger,
  but it would be a problem if text became the LCP.

### Lighthouse (12.8.2, local headless Chromium, simulated throttling, against production)

PageSpeed Insights without a key returned 429 (daily quota of the shared key), so these are local runs.

| Run | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS | SI | LCP element |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mobile 1 | 83 | 96 | 96 | 100 | 3.1 s | 3.8 s | 0 ms | 0 | 3.1 s | hand photo `hand-*.avif` |
| Mobile 2 | 75 | | | | 3.0 s | 4.7 s | 0 ms | 0 | 4.7 s | hand photo |
| Desktop | 98 | 96 | 100 | 100 | 0.8 s | 1.1 s | 0 ms | 0 | 0.8 s | TV backdrop `image.tmdb.org/t/p/w1280/…` |

Unthrottled Playwright check with a `PerformanceObserver`: on a 412 px phone the LCP is the hand at first paint
(328 ms), so it is painted from SSR, not after hydration. On desktop the LCP moves hand → room photo → TV backdrop
(408 ms).

Findings from the reports:

- Render-blocking: `tailwind-*.css` (32.8 KB transferred, 360 KB raw) costs about 1,046 ms on the mobile profile.
  `living-room-*.css` (6.7 KB) also blocks. This is most of the 3 s FCP.
- The mobile LCP is a decorative, `aria-hidden` hand photo. It has no `fetchpriority`. The repo's budget already
  accepts it (`goodwatch-benchmark/urls/budget.json`, `lcp_element` contains `/assets/hand-`), and the slice 12
  notes left the choice to the owner (`docs/implementation/tv-screen-revamp/budgets/README.md`).
- The desktop LCP image is `loading="lazy"` in the SSR HTML (`kit.tsx` `Img`: lazy while both editions are in the
  HTML). That adds about 540 ms of load delay on desktop.
- Unused JavaScript: about 47 KB, half of `shell-*.js`. Route JS transferred: about 200 KB brotli across 12 files.
- Accessibility: the IMDb notice in the footer has 4.18:1 contrast; the dock button's accessible name does not
  contain its visible text.
- Existing budget work: `docs/benchmarks/viral-spike-render-path-budget.md` and `urls/budget.json` (home: HTML
  ≤ 20 KB compressed, scripts ≤ 11 and ≤ 198 KB, 2 blocking requests, LCP ≤ 5.2 s at 2.7x CPU, CLS ≤ 0.01, score
  ≥ 70; targets LCP 2.5 s, score 90). Measurements for the new TV are in
  `docs/implementation/tv-screen-revamp/budgets/lighthouse-budget.md`.

## 3. Checklist for the landing prototype

### In the server HTML, on every request

- [ ] One H1 that says what GoodWatch is, for example "Find movies and shows worth your evening". Today there are
      two H1s, one per TV edition. Keep one real H1 and make the other edition's copy a plain `div`.
- [ ] Two or three sentences of intro text that a visitor can read without the TV, taken from `About.tsx` (one
      score from IMDb, Rotten Tomatoes and Metacritic; how a title feels; where it streams; free, no account).
- [ ] Capability tiles as `<a href>` to `/discover`, `/explorer`, `/taste`, `/watch-next`, `/how-it-works`, with a
      visible name and one line each. A tile may also drive the TV on click, but the href must be real.
- [ ] Keep the start titles and hub links of `BelowRoom.tsx` as they are.
- [ ] Nothing the crawler needs behind `screenCode`, `useEffect`, `onFirstInteraction`, or a closed accordion.
- [ ] Add `sameAs` (Discord, Reddit, GitHub) to Organization. Do not add `SearchAction`; it does nothing now.

### Boot and intro without hurting LCP

- [ ] The real content paints first, at full opacity. The intro text and the H1 never start at `opacity: 0`.
      Remove `.tvc-fade` from the first screen's text on load, or start it at a transform-only entrance.
- [ ] The boot is CSS only, so it runs before any JavaScript: a layer over the TV screen (the wordmark on black)
      that animates `opacity` and `transform` out, then leaves the DOM to CSS (`animation-fill-mode: forwards`,
      `pointer-events: none`). It must not depend on hydration to end.
- [ ] Keep the boot short: about 0.8 to 1.2 s, under the 1.7 s `TV_BOOT_MS`, so Speed Index on mobile stays under
      3.4 s. The boot layer covers only the TV screen, not the whole viewport.
- [ ] Pick the LCP on purpose. Either the room photo (make it the largest painted image again), or the intro text
      block. Give that image `fetchpriority="high"`, never `loading="lazy"`. For the two editions, use
      `<link rel="preload" as="image" media="…">` per edition instead of lazy on both.
- [ ] Pointer and ripple hints (like `Tutorial.tsx`) start after hydration and after a delay. They are decoration:
      `aria-hidden`, `transform`/`opacity` only, never layout properties. Stop them on the first input.
- [ ] `@media (prefers-reduced-motion: reduce)`: no boot motion, a short dissolve at most; no ripples, a text hint
      instead. The current `lr-boot` rules already do this.

### First visit vs repeat visit vs member

- [ ] The server never decides "first visit" for guests. A cookie read on the server would split the shared cache
      key (`anon;US;en`), and a response that sets a cookie becomes `private, no-store`
      (`docs/cache-identity.md`).
- [ ] Use a tiny blocking inline script in `<head>` that reads `localStorage` (in `try`) and sets
      `<html data-gw-seen>` before first paint. CSS then hides the boot layer and collapses the intro to its compact
      form. React renders the same markup either way, so there is no mismatch and no flash. Keep the script
      under 300 bytes and allow it in the CSP if one is added.
- [ ] Googlebot always gets the first-visit page (no storage across loads), so the full intro is what is indexed.
- [ ] Members: the server knows them and their page is never cached. The member HTML can skip the intro and keep
      a short boot only, decided on the server. If the owner wants the boot for members on every visit, it is the
      same CSS layer.
- [ ] Mark "seen" after the intro ends or the visitor interacts, not at load, so a bounced first visit still
      counts as first next time (owner's call).

### Hydration and JS

- [ ] No `typeof window` or `matchMedia` in render on `/`. The room already follows this rule (both editions in
      HTML, CSS picks); keep it for the intro.
- [ ] Intro and tiles are plain server components of the route with no client state. Animations live in CSS.
- [ ] The tutorial-style hints are a lazy chunk loaded after first interaction or idle, like the TV's screens.
- [ ] Do not stream the intro. Await it with the start titles; it is static text.

### Budgets for `/` (mobile, Lighthouse, 2.7x CPU)

| Line | Today | Prototype budget |
| --- | --- | --- |
| HTML, compressed | 18.6 KB | ≤ 20 KB (current limit). Intro text adds about 1 KB. |
| Render-blocking CSS | 2 files, 39 KB transferred | ≤ 2 files; aim to inline the first-paint CSS of the room and intro, or split Tailwind per route. |
| Route JS | about 200 KB brotli, 12 files | No new JS on first load. Hints chunk ≤ 10 KB, loaded later. |
| Images before scroll | 7 to 9 | No new images for the intro. The boot uses the existing wordmark SVG. |
| FCP | 3.0 to 3.1 s | ≤ 1.8 s |
| LCP | 3.8 to 4.7 s | ≤ 2.5 s target; never above the 5.2 s limit |
| TBT, CLS | 0, 0 | stay 0 and ≤ 0.01 |
| Speed Index | 3.1 to 4.7 s | ≤ 3.4 s |
| Score | 75 to 83 | ≥ 90 target |

### How to verify

- `curl` with a Googlebot UA: one H1, the intro sentences, the tile links all present in the raw HTML.
- Lighthouse 3 runs mobile and desktop through `goodwatch-benchmark` (`bench.sh budget`), and check that the LCP
  element is the one chosen above, with the boot running.
- A `PerformanceObserver` for `largest-contentful-paint` in Playwright, with and without `data-gw-seen`, to confirm
  the boot does not move LCP later.
- After launch: URL Inspection in Search Console for `/` to see the rendered HTML Google stored.

## Open questions for the owner

- Which element should be the LCP on phones: the room photo, the hand, or the intro text?
- Do members see the boot on every visit, or only after the power key?
- What counts as "seen": the intro finished, any interaction, or a number of visits like the Explorer tutorial?
