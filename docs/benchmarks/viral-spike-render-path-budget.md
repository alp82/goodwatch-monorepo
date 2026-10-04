# The render path budget

This page holds the render path budget for the landing surfaces, the measurements it comes from, and what still
stands between today's pages and good mobile Core Web Vitals. It belongs to the "Serve a viral traffic spike" map.
The limits are in [`goodwatch-benchmark/urls/budget.json`](../../goodwatch-benchmark/urls/budget.json), and
`./bench.sh budget` checks them (see the [benchmark README](../../goodwatch-benchmark/README.md#render-path-budget)).

## Summary

- **The budget has 15 lines per surface** for a first-time mobile visitor who doesn't scroll: bytes, requests, the LCP
  element, LCP, TBT, CLS, and the Lighthouse performance score. Each limit is a measured value plus a margin.
- **Lighthouse on the generator observed the first paint about one second late.** The cause was the measurement
  setup, not the page. With `--hide-scrollbars`, the observed first paint is at 0.4 to 0.7 s (1.2 to 2.3 s before).
- **With the corrected setup, the scores are 65 to 87** (63 to 82 with the old setup on the same build), and LCP is
  3.6 to 5.1 s.
- **No surface meets the targets yet.** The largest gaps are the first render's style and layout work, hydration on
  title pages, and the posters that Discover loads before scrolling.

## Conditions

| Item | Value |
| --- | --- |
| Date | Sunday, October 4, 2026 |
| Generator | worker3, 4 vCPUs. Lighthouse's CPU benchmark reads 1,060 to 1,240 there |
| Tool | Lighthouse 13.5.0 with Chromium 154 in Docker, mobile emulation, simulated throttling (slow 4G, 4x CPU) |
| Target | Production over the public path, without cookies, median of 3 runs |
| Build | `origin/main` at `72200599` for the calibration run |

Lighthouse's documentation puts a CPU benchmark of 1,000 to 1,500 in the "low-end desktop" class and calibrates the
4x slowdown for a benchmark of 1,500 to 2,000. On worker3, 4x therefore models a slower phone than Lighthouse
intends, and the development machine (benchmark 4,700) models a much faster one. The budget keeps 4x on worker3, so
that numbers stay comparable with earlier runs. Read TBT and the score as pessimistic.

## The late first paint on the generator

Earlier runs on worker3 observed the first paint at about 2.3 s on every page, even on `/about`, while
`example.com` painted at 0.1 s. Headless Chromium on the development machine painted the same pages at 0.2 to 0.7 s.

### Cause

Chromium holds the page's first frame for about one second when the blank page's overlay scrollbar is still fading
out as the navigation starts.

- Lighthouse's mobile emulation gives the blank start page an overlay scrollbar. It fades out while the navigation
  to the measured page begins. The fade draws compositor frames for 130 to 200 ms.
- When the page's first frame becomes ready after the fade's last frame, Chromium doesn't draw it. The next draw
  comes 1,026 to 1,028 ms after the fade's last frame (or one second later again).
- When the page is ready before the fade ends, or long after it, nothing is delayed. `example.com` is ready early.
  The development machine has a faster CPU and a shorter route, so pages were usually ready early there too.

### Evidence

Traces of `/about` (`--save-assets`), times in ms after the navigation start:

| Run | Stylesheet loaded | First frame painted by the renderer | Frames drawn | First paint |
| --- | --- | --- | --- | --- |
| worker3 | 193 | 300, committed at 308, activated at 333 | 130 to 257, then 1,260 | 1,283 |
| Development machine, same image | 165 | 174 | 177 | 181 |
| Development machine, 120 ms of added request latency | 425 | 1,355 | 287 to 335, then 1,360 | 1,362 |

Between 333 and 1,260 ms in the worker3 trace, no thread is busy: the renderer's main thread runs 276 ms of script,
and the compositor receives a frame signal every 16.7 ms without drawing. The observed first paint on worker3 takes
one of two values, about 1.25 s or about 2.3 s, in every run: a timer, not a slow resource.

What changes the result, on `/about` (the development machine with 120 ms of added latency, and worker3):

| Variant | Observed first paint |
| --- | --- |
| The benchmark's flags (`--headless=new --no-sandbox --disable-dev-shm-usage`) | 1.24 to 2.33 s on worker3 (7 runs), 1.36 s locally (3 runs) |
| `--disable-gpu` | No change: 2.29 and 2.33 s on worker3 |
| Without `--disable-dev-shm-usage` | No change: 2.30 s on worker3 |
| The private path | No change: 1.24 s on worker3 |
| `--enable-unsafe-swiftshader`, `--ozone-platform=headless`, `--window-size=412,823` | No change locally |
| `--disable-features=PaintHolding` | 0.45 and 0.47 s locally |
| `--hide-scrollbars` | 0.42 and 0.44 s locally, 0.27 to 0.32 s on worker3 (3 runs) |

Ruled out by these runs: software rendering, the shared memory setup, the container's CPU share, the route and TLS
setup of the public path, and the page itself. Puppeteer starts headless Chromium with `--hide-scrollbars` by
default, which is why the development machine's own measurements never showed the delay.

### What changed

`goodwatch-benchmark/lighthouse/run.sh` starts Chromium with `--hide-scrollbars`. Mobile emulation uses overlay
scrollbars, which take no space, so the layout is the same.

Lighthouse's simulation takes the observed first paint to decide which requests and tasks came before the paint.
With a late paint, it counted scripts and hydration as work before the first paint. The same build with both
setups, median of 3 runs:

| Surface | Observed FCP | Score | LCP | TBT |
| --- | --- | --- | --- | --- |
| Home | 1,250 to 502 ms | 70 to 83 | 5.16 to 3.85 s | 221 to 105 ms |
| Movie | 2,278 to 575 ms | 68 to 68 | 4.17 to 3.77 s | 425 to 586 ms |
| Show | 1,329 to 653 ms | 63 to 65 | 4.38 to 4.02 s | 567 to 637 ms |
| Person | 1,246 to 482 ms | 82 to 82 | 3.85 to 3.95 s | 143 to 158 ms |
| Discover | 1,227 to 596 ms | 67 to 69 | 4.98 to 5.14 s | 361 to 304 ms |
| Share list | 1,251 to 421 ms | 79 to 87 | 4.36 to 3.62 s | 110 to 67 ms |

On title pages, TBT rises: hydration now runs after the first paint, where TBT counts it. Numbers from before this
change aren't comparable with numbers after it.

## The budget

The limits, with the calibration run's values in parentheses. The run is from before the brand font change
("Load the brand font on every page"), so the limits for requests, fonts, and total bytes already include that
change: one font request of 34 KB per page, and two card font files less on the share list page.

| Line | Home | Movie | Show | Person | Discover | Share list |
| --- | --- | --- | --- | --- | --- | --- |
| HTML, compressed (KB) | 18.5 (16.4) | 54.5 (49.3) | 57.5 (52.3) | 32 (29.1) | 28.5 (25.8) | 24 (21.8) |
| Requests to the webapp host | 39 (37) | 36 (33) | 36 (33) | 30 (27) | 41 (37) | 28 (27) |
| Scripts | 18 (18) | 24 (24) | 24 (24) | 20 (20) | 31 (31) | 12 (12) |
| Script bytes (KB) | 320 (304) | 320 (304) | 320 (304) | 308 (293) | 354 (337) | 267 (254) |
| Images before scrolling | 20 (18) | 12 (10) | 10 (8) | 19 (17) | 30 (28) | 33 (31) |
| Image bytes before scrolling (KB) | 370 (294) | 86 (68) | 152 (121) | 225 (179) | 930 (741) | 220 (175) |
| Font requests | 2 (2) | 1 (0) | 1 (0) | 1 (0) | 1 (0) | 2 (3) |
| Render-blocking requests | 2 (2) | 1 (1) | 1 (1) | 1 (1) | 1 (1) | 1 (1) |
| Third-party origins | 1 (1) | 1 (1) | 1 (1) | 1 (1) | 1 (1) | 1 (1) |
| Total bytes (KB) | 790 (717) | 540 (456) | 600 (512) | 630 (535) | 1,300 (1,137) | 640 (608) |
| LCP (ms) | 4,300 (3,847) | 4,300 (3,772) | 4,550 (4,025) | 4,450 (3,947) | 5,800 (5,138) | 4,100 (3,616) |
| TBT (ms) | 300 (105) | 900 (586) | 1,000 (637) | 400 (158) | 550 (304) | 250 (67) |
| CLS | 0.01 (0) | 0.01 (0) | 0.01 (0) | 0.01 (0) | 0.04 (0.028) | 0.02 (0.011) |
| Performance score, minimum | 76 (83) | 61 (68) | 58 (65) | 75 (82) | 62 (69) | 80 (87) |

The LCP element per surface, which the budget also checks:

| Surface | LCP element | Source |
| --- | --- | --- |
| Home | The living room photo | A local AVIF, 90 KB, `fetchpriority="high"` |
| Movie, show | The hero backdrop | `image.tmdb.org`, `w780`, 30 to 80 KB, `fetchpriority="high"` |
| Person | The hero backdrop | `image.tmdb.org`, `w780`, 28 KB, `fetchpriority="high"` |
| Discover | The first poster | `image.tmdb.org`, `w342`, `fetchpriority="high"` |
| Share list | The card's title | Text in the card font (Anton), in the server HTML |

### Margins

- **Bytes:** 5% on scripts, 10% on HTML and total bytes, 25% on images, because the catalog changes the images.
- **Counts:** none on scripts, fonts, blocking requests, and third-party origins. Two on images and host requests.
- **LCP:** 12% to 14%. Runs of one surface differ by 2% to 4%, with two outliers of 20% to 23% in 18 runs.
- **TBT:** the widest margin. One of three runs can double (show: 532, 637, and 1,089 ms).
- **Score:** 7 points below the median. Runs of one surface differ by up to 10 points, with one outlier of 25.

A limit that a change improves for good gets lowered in the same commit.

## Targets and gaps

The targets: LCP 2.5 s, TBT 200 ms, CLS 0.1, and a score of 90. CLS meets its target on every surface.

| Surface | Score | LCP gap | TBT gap | Simulated FCP |
| --- | --- | --- | --- | --- |
| Home | 83, 7 short | 1.35 s | Met | 2.87 s |
| Movie | 68, 22 short | 1.27 s | 386 ms | 3.02 s |
| Show | 65, 25 short | 1.53 s | 437 ms | 2.98 s |
| Person | 82, 8 short | 1.45 s | Met | 2.74 s |
| Discover | 69, 21 short | 2.64 s | 104 ms | 2.93 s |
| Share list | 87, 3 short | 1.12 s | Met | 2.56 s |

What stands between today and the targets, with measured sizes. Times are Lighthouse's, under 4x CPU throttling.

| Gap | Surfaces | Measured size | Ticket |
| --- | --- | --- | --- |
| Style and layout of the first render | All, title pages most | Main-thread time of the document itself (parsing, style, and layout): 1.0 to 1.2 s on home, Discover, and the share list, 1.7 s on person, 1.9 to 2.3 s on title pages (2,401 and 2,783 elements). It's why FCP is 2.6 to 3.0 s everywhere, and FCP is where LCP starts | Proposed, 1 |
| Hydration | Movie, show | React runs for 2.5 s. TBT 586 and 637 ms | Proposed, 2. Carousels: "Render title carousels on the server without a Swiper instance" |
| Scripts that don't run | All | 84 to 138 KB compressed per page by Lighthouse's estimate (0.3 to 0.6 s of LCP): `headless` 35 of 40 KB, `shell` 27 of 50, `remix` 24 of 36, `supabase` 20 of 27, and `motion` 32 of 35 on person pages. By coverage, 31% to 40% of own script bytes run | Proposed, 3 |
| Posters before scrolling | Discover | 26 posters, 730 KB, next to the LCP poster. Lighthouse estimates 543 KB of savings | Proposed, 4 |
| The stylesheet | All | 33 KB compressed, 359 KB raw, about 4,300 rules for all routes. Lighthouse estimates 150 to 450 ms of blocking time | Proposed, 5 |
| Local and oversized images | Home, person, show | Estimated savings: 164 KB on home (a 40 KB provider logo as SVG among them), 136 KB on person, 89 KB on show | Proposed, 6 |
| Card fonts | Share list | Anton as a 53 KB TTF transfer for the LCP text. 16 card fonts are declared as TTF | Proposed, 7 |
| CPU calibration of the generator | All | 4x on a host with benchmark 1,100: TBT and the score read worse than on Lighthouse's reference | Proposed, 8 |
| The trailer | Title pages | Nothing loads before a click, after "Load the trailer player on click" | None needed |
| Loader data in the HTML | Title pages | 46 to 52 KB of compressed HTML | "Stop the JSON round trip of loader data" |

## Proposed tickets

1. **Skip the layout of title page sections below the fold.** A title page lays out 2,401 to 2,783 elements before
   its first paint, and the document's parsing, style, and layout cost 1.9 to 2.3 s under Lighthouse's throttling. Give the sections below the hero
   `content-visibility: auto` with a reserved size, or render them after the first paint. Done when the simulated FCP
   of the movie and show page is under 2.2 s with CLS still 0, and the budget's LCP lines are lowered to match.
2. **Decide how title pages hydrate less.** React needs 2.5 s to hydrate a title page, and TBT is 586 to 637 ms.
   Compare hydrating sections when they scroll into view, server-only sections, and less markup. Done when the
   owner has picked one and a task exists with a TBT limit under 300 ms for both title pages.
3. **Load the sign-in client, the dialogs, and the animation library on first use.** Per page, 84 to 138 KB of
   compressed script doesn't run before the page is interactive. Load the Supabase client and the dialog library when
   a visitor opens something that needs them, and keep `motion` off the person page. Done when script bytes are under
   240 KB on title pages, sign-in still works, and the budget's script lines are lowered.
4. **Load only the first screen of posters on Discover.** Discover loads 26 posters (730 KB) before scrolling,
   and its LCP is 5.1 s. Check the `sizes` values against the rendered widths, and keep lazy posters out of the
   first load. Done when image bytes before scrolling are under 350 KB and Discover's LCP is under 4.0 s.
5. **Cut the stylesheet to the rules that pages use.** The one blocking stylesheet has about 4,300 rules (359 KB
   raw, 33 KB compressed). Find what the safelists and the prototype routes add, and remove it. Done when the
   stylesheet is under 22 KB compressed and screenshots of the landing surfaces are unchanged.
6. **Shrink the remaining local images.** Lighthouse estimates 164 KB of image savings on home, 136 KB on person
   pages, and 89 KB on the show page. Done when its estimate is under 30 KB on each landing surface and the
   budget's image lines are lowered.
7. **Serve the share card fonts as WOFF2.** The share list page's LCP element is the card title in Anton, which
   arrives as a 53 KB TTF transfer. Done when the browser loads card fonts as WOFF2 subsets, the card looks the same
   in the browser and in the image, and the share list's total bytes are under 560 KB.
8. **Calibrate Lighthouse's CPU slowdown for the generator.** worker3's CPU benchmark is about 1,100, below the
   1,500 to 2,000 that Lighthouse's 4x is made for. Pick the multiplier from Lighthouse's calibration guidance,
   record how the six surfaces shift, and reset the budget's time lines. Done when the multiplier is a documented
   setting and the budget passes with it.

## First run

Run `20261004T163656Z-lighthouse-budget-before-315` on production at `72200599`, before the brand font change,
compared with the committed budget: 89 of 90 lines pass. The one failure is expected: the share list page loads 3
font files where the budget allows 2, and the brand font change removes two of them and adds one.

| Surface | Result | Score | LCP | TBT | CLS | Observed FCP |
| --- | --- | --- | --- | --- | --- | --- |
| Home | Pass | 83 | 3,847 ms | 105 ms | 0 | 502 ms |
| Movie | Pass | 68 | 3,772 ms | 586 ms | 0 | 575 ms |
| Show | Pass | 65 | 4,025 ms | 637 ms | 0 | 653 ms |
| Person | Pass | 82 | 3,947 ms | 158 ms | 0 | 482 ms |
| Discover | Pass | 69 | 5,138 ms | 304 ms | 0.028 | 596 ms |
| Share list | Fail: 3 font requests, limit 2 | 87 | 3,616 ms | 67 ms | 0.011 | 421 ms |

## Not verified

- A real phone. Every number here is Lighthouse's simulation on a server.
- Whether Chromium on a real phone can show the same one-second hold. The measurements here only show it for the
  blank start page under emulation.
- Safari and Firefox.
