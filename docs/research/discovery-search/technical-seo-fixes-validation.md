# Small technical SEO fixes: validation

October 27, 2026. Implements the four owner-approved changes from
[tweet-technical-seo.md](tweet-technical-seo.md). These improve metadata and sitemap consistency; they do not
establish why Google has not indexed the title cohort.

## Before and after

- Both Space: 1999 pages previously had `Space: 1999 (1975): Where to Stream and Ratings | GoodWatch`.
  They now have `Space: 1999 (1975) Movie: Ratings and Streaming | GoodWatch` and
  `Space: 1999 (1975) TV Show: Ratings and Streaming | GoodWatch`.
- An ordinary movie title is now `Interstellar (2014) Movie: Ratings and Streaming | GoodWatch`.
  Names stay first. The suffix shortens to `Ratings`, then disappears, when needed to fit the portion before
  ` | GoodWatch` into 60 characters. A name longer than that remains intact, with its year and media type.
  For example: `The Chronicles of Narnia: Prince Caspian (2008) Movie | GoodWatch`.
- `/discover`: `Discover | GoodWatch` becomes `Discover Movies and TV Shows | GoodWatch`.
  Its H1 becomes `Discover movies and TV shows`. The existing Search control keeps its accessible name and action.
- Hero poster: empty alt becomes `Poster for Interstellar`, or the equivalent title name. Its button remains
  `Poster for Interstellar. Show it full screen`. Decorative images are unchanged.
- The static sitemap index has six children instead of seven; its three-profile child file is removed.
  Profile selection returns nothing without querying member data. Writing removes any stale profile file, and
  indexing refuses even a caller's stale profile lastmod. The Saturday 03:00 UTC Windmill wrapper already downloads
  these generator sources from its pinned main revision, so no wrapper or schedule deployment is necessary.
  This takes effect for scheduled runs after the change reaches main. Profile routes and indexing policy, and all
  other sitemap files, are unchanged.

## Automated verification

- Production build: `SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm run build` passed. Dependency installation required the same
  environment setting to use the packaged sharp binary rather than the machine's global libvips.
- Focused suite: `node --test app/utils/meta.test.ts app/utils/detailsMeta.test.ts app/ui/discover/*.test.ts
  app/server/sitemap-root.test.ts` passed all 39 tests. The four new tests cover both media types, ordinary and long
  names, canonical URLs, Open Graph titles, and JSON-LD names/types.
- `make sitemaps-test`: 100 tests, no failures, one existing optional dependency skip. New regression checks cover
  held selection, deletion of a stale profile file and exclusion from an index with stale profile results.
- `npm test`: 5,381 tests; 5,361 passed, 12 failed, 8 skipped. A complete untouched checkout at the starting HEAD
  (`d5fa01bd7`) with the same dependencies had 5,377 tests; 5,357 passed, 12 failed, 8 skipped. Eleven failures match:
  combined-search API-route import, both late-catalog sibling cases, generated MCP poster-grid consistency,
  personal-order writes, title-snapshot reader-seam import, IMDb ratingsChanged, three auth cutover-notice checks,
  and score-control wording. The branch also hit the TV Time publication-race test; the baseline instead hit the
  12k pool timing budget. Both files passed on a focused rerun on this branch (29 tests). No reproducible new
  failure was found; no unrelated test or implementation was changed.
- `npm run typecheck` ran and failed with 192 diagnostics. Its complete output is byte-for-byte identical to the
  untouched checkout's output; this change introduces no additional diagnostic. Existing problems include route
  types, missing exports, and missing conformance-test dependencies.

## Local rendered pages

A production build on loopback was checked in Chromium at 360 × 844 using Playwright. Interstellar, Breaking Bad
and Discover all returned 200 and exactly one expected document title. Both title pages passed checks for the
poster image alt, its button's accessible name, unchanged H1 and canonical, matching og:title, and the proper
JSON-LD name with Movie/TVSeries type. Discover passed H1 and title checks, no horizontal document overflow, and
heading containment inside its control. At 360 px the H1 wraps over three lines without clipping. Clicking Search
focuses the field and Escape restores browsing. The check was repeated with a local 174-title development snapshot
loaded so Discover also rendered its results. Separate local HTTP checks confirmed distinct titles on both
Space: 1999 routes, the full Narnia name with its shortened suffix, and six children without profiles in the served
`/sitemaps/sitemap.xml`. Temporary evidence: `/tmp/gw-seo-render.log` and
`/tmp/gw-seo-discover-360.png`.

The first local server start mistakenly used the existing app environment, which also enabled routine background import
cleanup. Its log contains eight successful DELETE statements against `doc.user_import_item` across two cleanup
passes; affected-row counts were not logged, so whether any rows were removed is unknown. It was stopped.
Subsequent verification uses a read-only SQL proxy, a process-level non-loopback network guard, no TMDB API key,
and the local development snapshot. The initial log remains at `/tmp/gw-seo-server.log`.

## Performance budget

Ran the required `./bench.sh budget --where generator --label seo-branch-final` with its default three runs per
surface and unchanged limits in `goodwatch-benchmark/urls/budget.json`. The generator reached this local production
build over an SSH tunnel; CPU slowdown stayed at the calibrated 2.7. The same read-only data proxy and 174-title
local development snapshot were used for both builds. These are local-build measurements, not live-production or
field Core Web Vitals measurements.

The budget **failed on all six surfaces**. Built the complete untouched starting checkout and ran
`./bench.sh budget --where generator --runs 1 --label seo-baseline` through a second tunnel for comparison. That
also **failed on all six surfaces**. There are **no branch-only failed budget lines**: every failed line in the
branch's three-run medians also fails the baseline sample. The baseline additionally failed Discover's score
threshold. All six LCP-element checks and all six CLS limits pass in both builds. The baseline has one sample per
surface, so this comparison establishes existing failures, not precise timing differences or a green budget.

Existing failures include script bytes/counts, request counts, total bytes and TBT; home also exceeds image and
render-blocking limits. Movie, person and Discover exceed their HTML caps, and Discover exceeds its image-byte cap.
No limit was raised and no unrelated performance implementation was changed. The requirement to retain a green
budget cannot be claimed satisfied on this checkout; the baseline already fails it.

Reports (ignored local artifacts):

- `goodwatch-benchmark/results/20261027T153908Z-lighthouse-seo-branch-final/budget.md`
- `goodwatch-benchmark/results/20261027T155020Z-lighthouse-seo-baseline/budget.md`

An earlier tunnel attempt was stopped because its HTTP relay mishandled 103 Early Hints and caused Chromium
interstitial errors; the final runs use a transparent TCP relay and have valid Lighthouse reports for every surface.
The live Windmill job was not invoked, since it would regenerate and commit to main; its existing wrapper's use of
these generator sources and the generator regression tests establish the next-run behavior after merge.
