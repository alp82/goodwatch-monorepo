# TV expand flicker — October 20, 2026

The recording `2026-10-20 New Season Airing.mp4` shows the old TV image returning briefly after expansion
into the Cyberpunk: Edgerunners page. Reproduced on the actual title screen and Remix navigation in Chromium.

## Cause and fix

The room's `animationend` event fires before the browser releases its View Transition snapshots. Cleanup
removed `data-tv-transition` and the geometry properties in that event handler. The existing snapshots then
inherited the browser's default fade animations: the new page started again at opacity zero, exposing the old
room at its original size.

`tv-transition.ts` now waits in animation frames until the snapshot animations are gone before folding the
brackets and removing the styles. Cancellation clears that scheduled cleanup too. The same fix applies when
returning into the TV. No animation durations or styles changed.

## Regression check

From `goodwatch-webapp`, with a local app running and Playwright installed outside the repository:

```sh
PLAYWRIGHT=/path/to/playwright/index.mjs CHROMIUM=/path/to/chrome \
  node scripts/check-tv-transition.mjs
```

`ORIGIN` selects the server (default `http://localhost:3003`); `CASES` selects checks.
The script observes the real router's `ViewTransition.ready` and `finished` promises and samples the snapshot
animation names and transition mark every frame. A default fade restarting, early style cleanup, a skipped
transition, or a missing custom animation fails the check.

- Original cleanup, restored in the browser's module response: **fails**, seven frames of fallback fade.
- Fixed source and production build: **pass**, expansion and browser Back at 1982 × 1600 and 390 × 844.
- Escape during pending navigation, reduced motion, and missing View Transition API: **pass**.
- `node --test app/ui/living-room/tv-way-back.test.ts app/ui/living-room/tv/tv-machine.test.ts`: **201 pass**.
- Production build and Biome lint of the changed code: **pass**.

## Existing verification failures

The full typecheck reports the same 188 diagnostics with the original and fixed source, including missing auth
conformance test dependencies. There are no diagnostics for `tv-transition.ts`.

`./bench.sh budget` initially stops because `SHARE_LIST_PATH` is not configured. Home-only runs use a temporary
copy of the existing budget with its limits unchanged. An isolated build with the original transition and the
fixed build both fail the same three lines: 25 host requests (limit 24), 12 scripts (limit 11), and 220.9 KB of
scripts (limit 198 KB). Total transfer differs by 39 bytes. Both pass LCP, TBT, CLS, and score limits; scores are
85 and 84 respectively, with LCP about 3.69 seconds. These single-run comparisons measure counts and bytes;
their timing differences are not statistically significant. Budget limits were not raised.

The first local production verification inherited shared Valkey configuration and published hashed assets to
the shared build-file cache. That process was stopped. The subsequent original/fixed performance comparison
ran without Crate or Redis. The shared assets use the store's normal 24-hour expiry; no deployment was made.
