# Local search comparison

From this worktree's goodwatch-webapp directory:

```sh
GOODWATCH_PREVIEW_ENV_DIR=/home/alp/dev/projects/goodwatch/goodwatch-monorepo/goodwatch-webapp node scripts/search-preferences-preview/server.mjs
```

Open **http://localhost:5219**. SEARCH_PREFERENCES_PORT changes the port.

This standalone loopback server does not boot Remix, sessions, import jobs, tracking, or search-history writers. Production access is read-only: snapshot Redis GETs, catalog SELECTs and vector searches. Eager availability warm-up is suppressed in the local SSR loader; an explicitly requested service filter can load its read-only availability data on demand. No production configuration is modified.

The left column reproduces the original search; the right uses the tested preference policy and identity fix. Use free-text searches, Relevance/Best rated, pagination, and manual filters. Manual selections remain hard.

Recorded readings/retrievals can be reused when source-compatible. New queries use the usual query-model calls and title lookup. New local cache files go into ~/.cache/goodwatch-search-preferences-preview, never into the frozen evidence.

Checks: 180 captured contexts / 1,800 parity fields matched the frozen baseline/V7 before the catalog refreshed. Desktop and mobile browser checks covered Historical Action 8→78, the original Best rated prefix, 40-card pagination, required manual type/genre/theme, unchanged explicit exclusions, and 1917 title recognition.

Selecting both Action and History manually consumes those descriptions into hard filters and can use the existing catalogue flow (497 results in the tested snapshot), rather than the free-text Historical Action retrieval (8 original / 78 updated). This is the original interpreter's behavior in both versions.

First startup loads the search index and snapshot and can take about a minute. Current catalog version and reference date are exposed by /api/config. The archived quality measurements refer to the frozen tested snapshot; data refreshes do not change the ranking rules.

Each comparison captures one current title snapshot and one current search index build for both columns. If either refreshes during the comparison, the partial answer is discarded and the comparison retries, up to three attempts in total. Search responses expose the actual snapshot and testedSnapshot separately. Posters and scores use the most recently completed comparison. The normal app's background jobs are not started.

Stop with Ctrl+C. The normal GoodWatch app is unchanged.

## Current build vs frozen study build (November 4, 2026)

The study ran on search index build `20261103T051503Z` (`config.frozenIndex`), with identity tables `fa555e26…` (title table) and `d0c554f1…` (alternate cuts). The app's search index refreshes itself on a timer, and `rankSearch` always uses the build currently loaded. Before this fix, the preview pinned the frozen build. Once the app loaded `20261104T051503Z`, every uncached query failed with `Live ranker index drift: 20261104T051503Z`. Cached queries kept working only because their ranks came from the old build.

The preview now ranks on the current build and builds its identity folding (IMDb ids and alternate cuts) from that same build. `/api/config` and every answer's `source` report:

- `index`: the build used for this answer.
- `frozenIndex`: the study's build.
- `indexIsFrozen`: whether they're the same.
- `identityTables`: the current tables' sha1 values, and `matchFrozen`.

Rank caches are keyed by build. A rank from another build, such as the frozen study's ranks in `docs/verification/…`, is never reused or shown as current. Readings (query-model outputs) don't depend on the index and are still reused. The archived measurements and pins stay as historical evidence. Answers on a newer build are live previews under the same ranking policy, not the study's measured numbers.
