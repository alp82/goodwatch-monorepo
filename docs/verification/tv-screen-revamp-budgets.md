# The new TV: rendering budget and Lighthouse (slice 12)

Measured on 2026-10-14 on `feat/tv-slice-12-budgets`, on `/home-preview`, against a production build of the branch
(`npm run build`) served on this machine without any service (no `.env`, no Redis, no Crate: a production process
with Redis would publish its build to the shared store, see [webapp-deploys.md](../webapp-deploys.md)). There is no
deploy target for the branch, so `./bench.sh budget` could not run; nothing was deployed.

**How quiet the machine was:** not quiet. Other sessions kept the load average between 5 and 18 on 8 cores for the
whole session (8 to 12 during most runs), with 11 of 16 GB of swap in use. Every timing here is from a shared
machine; counts of long tasks were taken over 5 to 15 repetitions for that reason, and the CPU benchmark Lighthouse
reported (1,207) is close to the generator's (about 1,170, which the 2.7 slowdown is calibrated for).

## Lighthouse mobile, against `goodwatch-benchmark/urls/budget.json`'s home limits

Lighthouse 13.5.0 with the benchmark's own settings (`lighthouse/run.sh`: mobile, CPU slowdown 2.7,
`--hide-scrollbars`), the median of 3 runs, read by `goodwatch-benchmark/scripts/budget.mjs check` with a copy of
`budget.json` whose home path is `/home-preview` (`budget.json` itself is unchanged). The full table:
[lighthouse-budget.md](../implementation/tv-screen-revamp/budgets/lighthouse-budget.md).

| Line | Limit | `/home-preview` | |
| --- | --- | --- | --- |
| HTML, compressed | 20,480 | 16,977 bytes without data; **about 18,300** with the real start titles (below) | Pass |
| Host requests | 37 | 27 | Pass |
| Scripts | 16 | 13 | Pass |
| Script bytes | 262,144 | 206,234 (201.4 KB) | Pass |
| Images before scrolling | 32 | 7 without data; **22** with real data | Pass |
| Image bytes before scrolling | 378,880 | 91.4 KB without data; **217.9 KB** with real data | Pass |
| Font requests | 2 | 1 | Pass |
| **Render-blocking requests** | 2 | **3**: `tailwind.css`, `living-room.css`, `tv.css` | **Fail**, until slice 13 |
| Third-party origins | 1 | 0 | Pass |
| Total bytes | 768,000 | 386.8 KB | Pass |
| LCP | 6,050 ms | 3,382 ms | Pass |
| TBT | 150 ms | 47 ms | Pass |
| CLS | 0.01 | 0.000 | Pass |
| Score | 63 at least | 87 | Pass |
| **LCP element** | an `img` with `/assets/room-phone-` | **the hand photo** (`/assets/hand-…avif`) in 3 of 3 runs | **Fail** |

- **Render-blocking:** `/home-preview` links `tv.css` beside `living-room.css`. Slice 13 folds `tv.css` into
  `living-room.css`, as the plan says, which makes it 2, the limit. Not changed here: the route's links are slice
  13's.
- **LCP element:** on a phone in the hand form (Lighthouse's 412 x 823) the hand photo is the largest picture
  (751 x 1,127 px drawn, the visible part from 119 px down). It is a file of this host, 28 KB, asked for at once and
  loaded in 50 to 110 ms with no delay before its request; the room photo the line names is the next largest. The
  line exists so that the LCP is not the TV's TMDB picture, and it is not. Whether the line should name the hand
  is the owner's call (below); `budget.json` is not changed.
- **Data:** the build served without services has no start titles, so its HTML and images miss the TV's first
  picture and the posters. Those lines were measured on real data separately:
  - HTML: the room and the section below from a dev server on real data (45,721 characters against 37,442), spliced
    into the build's page: 15,825 bytes at Brotli 11 against 14,650 for the page without data. The server's own
    compression gave 16,977 for the page without data, so the page with data is about 18,300 bytes: under 20,480,
    with 2.2 KB left.
  - Images: a phone at 412 x 823 on real data asks for 22 images, 217.9 KB, before any scroll: the room photo
    (36 KB), the hand (28 KB), the TV's first picture (`w780`, 61 KB), four posters on the Discover tile (`w154`,
    6 to 9 KB), and the section below's small posters (`w92`, lazy, within the browser's look-ahead). Today's TV
    measured 347 to 364 KB on production.
- **Today's TV on the same build and machine** (`/`) for orientation: 26 scripts, 622 KB, TBT 462 ms, score 70, LCP
  4,068 ms. Production measured 16 scripts and 243.8 KB for it, so this build without services loads more than
  production does for the old page; the comparison of first-view scripts between `main` and the branch belongs to
  slice 13.
- **Lighthouse's other categories** (one run, mobile and desktop): accessibility 96 (the only failure is the site
  footer's grey text), best practices 96 mobile (the phone's wall photo is drawn stretched, by design, slice 2) and
  100 desktop, SEO 61 only because `/home-preview` is `noindex` and has no description of its own, both on purpose;
  the meta block of `/` is untouched. The SEO score of 100 is to be checked on `/` after the switch.

## Long tasks and frames while pointing, moving the focus and changing screens

`docs/implementation/tv-screen-revamp/budgets/drive.mjs budget` against the production build. It counts every
frame's callback time, the tasks over 50 ms, the long animation frames with their scripts, and the slowest
interaction (Event Timing). Per round: pointing (the cursor around the window and twice across the picture; on the
phone a finger dragging across the picture), ten focus moves with the Remote's keys, and opening Tonight, Discover
and Explorer from home and going Back. Sentry (the error reporting) loads before each measurement, as on the site.

| Profile, 5 rounds | Pointing: rounds with a task over 50 ms | Focus moves: tasks over 50 ms (of 50 moves) | Screen changes: tasks over 50 ms | Slowest interaction, median of rounds (worst) | At rest |
| --- | --- | --- | --- | --- | --- |
| Desktop 1920 x 1080, GPU | 2 of 5 (51, 58 ms) | 0 | 0 | 96 ms focus, 96 ms screen (880 ms once, the first key press, which loads the screens' code) | no frame asked for; main thread 1.45% |
| Desktop, `--disable-gpu` | 1 of 5 (84, 62 ms) | 0 | 0 | 168 ms (192) focus, 128 ms (168) screen | no frame; 1.41% |
| Phone 390 x 844, CPU slowed 4 times | 3 of 5 (53 to 130 ms) | 28, 50 to 95 ms | 20, 50 to 335 ms | 160 ms (184) focus, 232 ms (248) screen | no frame; 4.5% of the slowed core |

- **Pointing itself** costs 0.12 to 0.19 ms of main thread per frame on the desktop (longest 5 to 12 ms over 15
  sweeps), 0.8 ms on the slowed phone, and nothing at rest. The budget is 10 ms a frame.
- **Sentry's mouse listener, the long tasks of earlier slices:** across 15 sweeps per variant on the GPU desktop,
  as served 0 of 15 sweeps had a task over 50 ms; with the Remote and the ring kept out of Sentry's recording
  (`block`) 0 of 15; with the recorder off 2 of 15 (260, 136, 879 and 50 ms, during a load spike to 12). In the
  first 5-round run as served, 2 of 5 sweeps had one, and the browser put the one it could attribute to
  `#document.onmousemove` in `sentry-browser.js` (41 ms). So the tasks exist, are rare, are Sentry's when they are
  attributed, and do not go away measurably by keeping our moving parts out of the recording or by turning the
  recorder off. **Not changed:** no fix on our side changes them by an amount this machine can measure.
- **Focus moves on the slowed phone, ours:** each is a task of 50 to 95 ms there. A CPU
  profile of ten moves shows about a third of it Sentry's session recorder handling the DOM changes
  (`processMutation`, `addEvent`: 221 to 326 ms of ten moves), a third React, and the rest style and layout
  forced by measuring the items for the direction rule (`bringIntoView`). **Fixed:** a focus move drew the whole
  room again, both Remotes and the section below with its 16 titles; they are memoized now (`TvRoom.tsx`). React's
  share of ten moves fell from 303 to 377 ms to 178 to 253 ms in three profiles each. The count of tasks over
  50 ms did not change measurably on this machine (28 before, 26 after, at a load average of 12): the rest is the
  recorder and layout.
- **Screen changes on the slowed phone:** the first opening of each app loads its code; the 335 ms task is a timer
  in `sentry-browser.js` (Sentry's buffered replay takes a full snapshot of the page once a minute, here during the
  run). Without the recorder the worst was 137 ms.
- **INP:** on the desktop the slowest interactions are 72 to 120 ms with a GPU and up to 192 ms without; on the
  phone slowed 4 times, up to 248 ms when a screen changes. The budget's 200 ms is met on the desktop and missed by
  the slowed phone's screen changes, which include loading each app's code the first time.

## Idle CPU and software rendering

At rest no frame is asked for in 5 s on any profile; the page's main thread is 1.4% busy on the desktop with and
without a GPU (the budget: 5% and 10%), mostly the telemetry's timers. With `--disable-gpu` the long animation frames
while the picture changes are rendering, not script (50 to 150 ms frames with no script over 10 ms): the larger TV
is 2.4 times the pixels, as the plan's risk 5 says. Lighthouse's "Avoid non-composited animations" names two
elements, both the lip's `lrb-lip-out` animation (it animates `pointer-events`; `living-room.css`, the section below,
which this slice must not touch); nothing of the room or the TV.

## Not covered

- Production itself, and `./bench.sh budget`: the branch has no deploy target. Slice 13's merge deploy is the
  first run there.
- A real phone. "CPU slowed 4 times" is Chromium's throttling on this desktop CPU.
- The tab hidden for a minute.
