# One episode grid for everyone

The shared `ui/details/episode-grid/RatingsGrid.tsx` now renders the guest overview, the member's initial overview, and the member's tracking grid. `EpisodeGrid.tsx` supplies read-only season and episode details for guests; `EpisodeList.tsx` supplies the member's tracking actions. Opening guest details loads their code on demand. Guests make no tracking requests.

The old two-orientation table, its gap columns, legend and season tooltip helpers are removed. The initial HTML contains readable ratings; hydration measures the container and enables the tile-to-dot animation. Long seasons wrap, while sparse catalogs render only actual episodes. Episode numbers in the header reflect the data, including a window starting late in a season. The page-size estimate and reserved heights follow this renderer.

Dark's 26 regular episodes use the reviewed identity mapping described in the [alignment audit](../../../research/season-episode-scores/episode-alignment-audit.md#dark-translated-titles-october-18-2026). TMDB external IDs independently verified every IMDb identity. Watch history stays canonical.

## Validation (2026-10-19)

- Production build passes.
- 80 focused domain, server, tracking-store, grid-label and grid-size tests pass. The Dark regression failed with `2 !== 26` before the mapping.
- The browser harness passes 46 assertions at 390 and 1280 px, guest and member: 327 episodes, Grid/Consistency, episode details, member-only tracking, arrow-key navigation, no tracking requests from guests, no horizontal overflow, and no page errors.
- The real local production Dark page shows all 26 ratings without JavaScript and after hydration.
- The full suite reports 3,551 passes, two failures, one skip and one expected failure. The two failures are the TV rating-level picker and the library score picker; both reproduce on unchanged main `808ad169`. The expected failure is the retained movie-state key test, also present on main. TypeScript reports 185 errors outside the changed files.
- The nine long-show server-render fixtures stay within their one-megabyte grid budget. Estimates stay within 10% of actual HTML plus loader data. Scripted runs render whole, and extreme daily shows offer their remaining seasons on request.

Run the browser checks against the development server:

```sh
HARNESS=http://127.0.0.1:3098 node docs/implementation/tracking/episode-grid/drive.mjs
```

`PLAYWRIGHT_MODULE` can specify an installed Playwright module, `CHROMIUM_EXECUTABLE_PATH` can specify Chrome, and `SHOTS` selects the screenshot directory (default `/tmp`).

## Title-page budget

Compared production builds on the same host, with the same current catalog and one mobile Lighthouse run per build, CPU slowdown 2.7. `./bench.sh budget --where local --runs 1 --budget <show-only budget>` runs the affected show surface without requiring an unrelated private share-list fixture.

| Metric | Unchanged main | Shared grid |
| --- | ---: | ---: |
| Performance score | 95 | 96 |
| LCP | 2,656 ms | 2,651 ms |
| TBT | 0 ms | 13 ms |
| CLS | 0 | 0 |
| Site requests | 40 | 40 |
| Script requests | 25 | 25 |
| Script bytes | 332.3 KiB | 332.8 KiB |
| Compressed HTML | 62.3 KiB | 61.2 KiB |
| Images before scrolling | 19 | 19 |
| Image bytes | 170.2 KiB | 170.2 KiB |
| Total bytes | 661.5 KiB | 660.7 KiB |

The former show resource limits already failed on unchanged main. The show limits are recalibrated to these measurements with a margin, including the shared grid script required on the guest's first render. The guest season details remain lazy. The affected show-page budget passes. These single runs establish resource counts and size; their timing differences are too small to establish a speed improvement.
