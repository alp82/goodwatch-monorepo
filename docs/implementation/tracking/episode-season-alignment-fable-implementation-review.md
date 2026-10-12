# Claude Code Fable implementation review

Review complete. Note first: the diff file is stale. The working tree already moved the grid adapter into its own module, added an IMDb-unavailable fallback, rating coverage, and the new-episodes signal label. Findings below are against the working tree.

**What I ran**

- TypeScript check: clean.
- Presentation unit tests: all 14 pass, including the seven audited fixtures.
- Server tracking tests: the file fails to load, so none of its tests currently run.

**Findings, highest severity first**

1. **Blocking: server test suite cannot load.** `goodwatch-webapp/app/server/episode-presentation.server.ts:8` declares a constructor parameter property (`readonly presentation`). Node's strip-only TypeScript mode rejects that syntax, and `npm test` imports this module through `show-tracking.server.ts`. Every server tracking test is dark until the field is declared and assigned in the constructor body.

2. **Medium: legacy season scores vanish for airing shows.** `goodwatch-webapp/app/server/show-tracking.server.ts:134` now suppresses the season average for any show where an aired episode has no match. The grid builder drops IMDb rows with no score (`episode-grid.server.ts:226`), so an episode that aired yesterday and is not yet rated hides the whole season score for every airing show. Before this change the `imdb_season` average showed. Consider a short grace window, or show the coverage line while keeping the aggregate.

3. **Medium: catalog failure on an action returns a 500.** `show-tracking.server.ts:330` awaits the presentation without a catch. The read path handles IMDb failure through the fallback error, but a catalog read failure during markEpisodes or unmarkEpisodes throws instead of refusing with reload.

4. **Low: specials lose IMDb ratings on the selected show.** `goodwatch-webapp/app/domain/tracking/episode-presentation-grid.ts:49` emits every TMDB special as unrated. The legacy grid showed IMDb-rated specials, so MF GHOST's two specials regress to a dash.

5. **Low: hero season count includes the Additional episodes row.** `goodwatch-webapp/app/ui/tracking/HeroTracking.tsx:305` counts display season -1 as a season, so a trailing unmapped episode reads as a fourth season.

6. **Low: lint noise.** `goodwatch-webapp/app/ui/tracking/store.ts:5` through line 34 import `displaySeason` and `displayNumber` nine times. Both tsc and esbuild accept it, but Biome will not. New blocks in `show-tracking.server.ts` and `new-episodes.ts` use space indentation.

7. **Missing regression tests.** No test checks that the browser target selection in `actions.ts` produces the same eligible set as the server. No test exercises the IMDb-unavailable fallback or the inactive-mapping fallback through the server read. Seen-press grouping by display season has no test. The wire round-trip test exists but is inside the file that cannot load.

**What looks sound**

- Watch targeting is safe. The server validates version, exact membership, duplicates, foreign IDs, and future dates, and the machine refuses foreign IDs independently. Watches keep canonical season and number.
- Legacy markSeason, unmarkSeason, watchUpTo, undoGroup and restore paths are unchanged; the new events branch only when a presentation is present.
- Display labels are covered on the list, grid, search, hero, toasts, seen-press summary, My shows, Tonight's pick and the new-episodes signal.
- Caching is coherent: both read paths and the action validator share the versioned presentation cache keyed by show and mapping version, and the failed-ratings result is not cached.
- Mapping validation catches duplicate IDs, duplicate positions, order inversions, renumbering, and inserted episodes, with fallback preserving identity.

No blocking correctness findings in the tracking logic itself. The one blocker is the test suite load failure in finding 1, which must be fixed before the branch's server tests can prove anything.

Correction to my earlier note: the full type-check does not pass, but none of the errors are from this branch.

- The type-check reports errors in four files: `app/routes/$type.$category.$page.tsx`, `app/routes/$type.$category._index.tsx`, `app/root.tsx`, and `app/hooks/usePageTracking.ts`.
- None of those files are modified on this branch, so the errors are pre-existing on main and not a finding against the alignment work.
- No type errors appear in any of the 26 files the branch touches, including the new presentation, mapping, grid adapter, and server modules.

Everything else in the review stands. The single blocker remains the parameter-property syntax in `episode-presentation.server.ts:8`, which stops the server test file from loading.
