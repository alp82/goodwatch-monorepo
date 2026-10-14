# Slice 15: the `REC_*` flags go

Every `REC_*` feature flag is gone from the webapp: what `on` did is what the site does, and the code, routes,
assets and settings that only `off`, `shadow` or `preview` reached are deleted. Proof for [the plan](../README.md),
slice 15. Built on October 14, 2026 on `chore/remove-rec-flags`, branched from `origin/main` at `4003c90d` (the
revamp merged and live). Not pushed.

Decided by the owner before the slice: production runs every flag `on`, `REC_RELATED_MAP` included, and
`REC_RELATED_MAP` and `REC_PREVIEW_USERS` go too. The owner removes the variables from Coolify after the deploy.

## The commits

One commit per flag, each revertable by itself, in the plan's order (the error page first, the flag modules last).
Every commit builds and passes the tests on its own.

| # | Commit | | Files deleted / changed | Lines |
| --- | --- | --- | --- | --- |
| 1 | `0418796b` | The error page draws the site's navigation (no flag yet) | 0 / 1 | +48 -44 |
| 2 | `d842a528` | `REC_EXPLORER` | 0 / 9 | +6 -20 |
| 3 | `de234260` | `REC_AGE_FILTER` | 0 / 13 | +27 -73 |
| 4 | `30098e2c` | `REC_RELATED_MAP` | 1 / 10 | +21 -239 |
| 5 | `5b12004a` | `REC_TASTE_MATCH` | 1 / 23 | +86 -232 |
| 6 | `37dee1c4` | `REC_FILTER_BAR` | 30 / 17 | +59 -4,682 |
| 7 | `e6286a5a` | `REC_WATCH_NEXT` | 2 / 15 | +33 -425 |
| 8 | `c42de02b` | `REC_TASTE_PAGE` | 51 / 11 | +37 -6,668 |
| 9 | `e4f16453` | `REC_TRACKING` | 0 / 37 | +69 -191 |
| 10 | `541baf52` | `REC_NAVIGATION` | 4 / 29 | +147 -870 |
| 11 | `a02f37bb` | The flag modules, `REC_PREVIEW_USERS`, the settings files and the documents | 3 / 51 | +130 -182 |

In all, before this notes commit: 248 files, +626 -13,589, 92 files deleted. The commit messages name what went in each.

**What each flag left behind, in short:**

- **`REC_EXPLORER`**: only the checks. The hub's Explorer tile always links.
- **`REC_AGE_FILTER`**: only the parameter (`readRatingsChunks`, `loadRatings`, `ladderFor`, Discover's filter
  cache key). The filter still hides itself while a snapshot has no ratings.
- **`REC_RELATED_MAP`**: the setting, `"off"` among the lookup's answers, the loader's prefetch of the carousel's
  first panel (`prefetchRelatedSection`, `prefetchRelatedTitlesState`, `server/related-prefetch.ts`). The carousel
  stays for a title whose pack was late.
- **`REC_TASTE_MATCH`**: shadow mode and its log (`server/taste/shadow.server.ts`). The recommend call stays for a
  person without a taste vector. The seven tests that set the flag to `off` to keep the scheduled rebuild out call
  `holdTasteRebuildsForTest()` now.
- **`REC_FILTER_BAR`**: the old Discover loader and page, `ui/filter/FilterBar` and the sections and controls only
  it used, the `/search` page (`JourneyResultsPage`, `JourneyFilters`, the result list), `/api/crew`, and the old
  hooks of `/api/cast` and `/api/genres/all`. `/search` is the 301 to `/discover?q=`; `/discover/movies` and
  `/discover/show` are 301 now (were 302).
- **`REC_WATCH_NEXT`**: the old Wishlist page (`/wishlist` is only its redirects), `ui/filter/WishlistFilter.tsx`,
  `ui/discovery/WatchableList.tsx`.
- **`REC_TASTE_PAGE`**: the unlock-ladder profile with its components, hooks and scorers, `/api/taste-profile/*`
  with `server/taste-profile.server.ts`, the old quiz, and `/api/interest-discovery` with its module and hook.
- **`REC_TRACKING`**: the branches for a member without tracking (Seen as a plain toggle for a movie, the finish
  prompt without its watch, the show page without the status box and the episode list, a member's Watch next first
  view on the server), and the flag's own tests.
- **`REC_NAVIGATION`**: `ui/main/Header.tsx`, `ui/Search.tsx` (the search journey's header box), `ui/nav/BottomNav.tsx`,
  the slab's own navigation row and fixed frame, `useHasDock` and every page's dock-less branch, and the room's
  rules for the old bottom navigation (the notch, the 4rem, `lr-docked` and `lrb-docked`). `useNavigation` is never
  null now.

## Kept, against the plan's lists

- **`ui/main/UserMenu.tsx` and `LazyUserMenu.tsx`.** The plan has them go with `REC_NAVIGATION`, but the new site
  header's account slot (`ui/navigation/bits.tsx`, `AccountSlot`) opens that menu.
- **`Slab.tsx`'s import from `BottomNav.tsx` was not moved.** What it imported fed `SlabNav`, the slab's own
  navigation row, which only a page without the dock showed. It went with `BottomNav`.
- **The search journey's provider and its bar on title pages** (`ui/search/SearchJourney.tsx`, `JourneyNavigation`).
  The plan lists only the search page's parts. A link with `searchJourney=1` (an old bookmark of a result) still
  reaches the bar, so it stays; its controller still runs a search for such a link. A candidate for a follow-up.
- **The plan's line numbers** were from before the revamp merged; the call sites were found again by a search of
  `goodwatch-webapp` for `isEnabled`, `getFeatureMode`, `getEnabledFeatures`, `useFeature`, `useFeatures` and the
  fields of `EnabledFeatures`.

Deleted although the plan did not list them, because only a flag's off side reached them: `server/related-prefetch.ts`,
`/api/crew`, the `/search` og image copy, and eleven files that were already unused on `main` but imported files
this work deleted (`ui/filter/FilterSelection.tsx`, `ui/filter/sections/SectionDNA.tsx`,
`ui/discovery/DetailsWatchability.tsx`, `ui/taste/hooks/index.ts`, and seven leftover components of the unlock
ladder in `ui/taste/components`).
Dead files were found by reachability from the routes, the entries, the tests and the scripts, against the same
count on `origin/main`.

## Proof

**Per commit**, in a separate worktree with the branch's `node_modules`: `npm test`, `npm run build` (with
`precompress`) and `tsc`.

| Commits | `npm test` | Build | `tsc` errors |
| --- | --- | --- | --- |
| `origin/main` | 2,290 tests, 2,289 pass, 1 skipped | passes | 212 (the baseline) |
| 1 to 5 | 2,290, 2,289 pass | pass | 212 |
| 6 to 8 | 2,290, 2,289 pass | pass | 176 |
| 9 | 2,288, 2,287 pass (the two tests of the flag itself are gone) | passes | 176 |
| 10, 11 | 2,287, 2,286 pass (the room's "over the dock" variant is gone) | pass | 176 |

- Three runs had one timing test fail, each time another one, in a file the commit does not touch:
  `lifecycle.test.ts` (commit 1), `search-ranking/qdrant-http.test.ts` (commit 5), `auth-session.test.ts`
  (commit 7). Run alone three times at the same commit, each passes every time. `auth-session.test.ts` failed once in
  three runs on `origin/main` too, on this loaded machine.
- `tsc`: no commit adds an error; the 36 fewer are in deleted files.
- `npx biome lint` on the 115 changed TypeScript and CSS files: 53 findings, against 60 in the same files on
  `origin/main`, and no file has more of any rule than before. The changed files are formatted by hand.
- `goodwatch-search/test-deploy.sh`: all pass (its copy-env example used `REC_NAVIGATION`; it copies
  `TMDB_API_KEY` now).
- **The search for the flags** in `goodwatch-webapp` (`REC_`, `isEnabled`, `getFeatureMode`, `useFeature`,
  `useFeatures`, `EnabledFeatures`): no match but three local variables named `isEnabled` that have nothing to do
  with the flags (`ui/filter/explore/DidntWatchCheckbox.tsx`, `MyStreamingCheckbox.tsx`, `utils/random.ts`). In
  `goodwatch-search` and `goodwatch-benchmark`: none. In `docs/`: only documents that record how something was built
  and run then (the implementation notes of the recommendation experience, tracking and this revamp, the prototype
  notes and three verification records); the ones that ran servers with flags say under their title that the flags
  are gone. The documents of the system as it is (`cache-identity.md`, `serving-architecture.md`,
  `search-role-deploy.md`, `implementation/related-map.md`) lost the flags.

**In the browser**, as a guest, on a dev server of the last commit started with no `REC_*` variable at all (the
main checkout's `.env`, a pure reader: no `APP_ORIGIN`, no sign-in, no writes), in headless Chromium at 1280×900
and at 390×844 (phone), with analytics and error reports kept in the browser:

| Page | Answer | The new design |
| --- | --- | --- |
| `/` | 200 | The room with the TV and the Remote; the site header; on the phone the dock with the lip as its upper row |
| `/discover` | 200 | Discover's filter bar; on the phone its slab docked above the dock |
| `/movie/603-the-matrix` | 200 | The related map |
| `/explorer` | 200 | The map |
| `/taste` | 200 | The Taste tabs |
| `/search?q=heist` | 301 to `/discover?q=heist` (`private, no-store`) | Discover's search mode |
| `/discover/movies` | 301 to `/discover?type=movie` | Discover |
| `/watch-next` | 200 | Watch next |
| `/this-page-does-not-exist` | 404 | The site header, the dock and the hub on the error page |

Every page had the site header and the dock's key, none the old header or bottom navigation, none a horizontal
scroll. The only console errors: the 403 of `/api/combined-search` on the search page (a server without
`APP_ORIGIN` refuses it, as on `main`) and the error page's own 404. Also answered as before: `/wishlist` 301 to
`/watch-next` for a guest, `/discover/show?moods=funny` 301 to `/discover?moods=funny&type=show`,
`/api/command-palette?q=mat` 200, `/api/related-map?key=m603` 200. A first walk right after the server started
showed React's invalid hook call on a few pages: Vite optimizing dependencies while the pages loaded. The walk
after it was clean.

The error page's account slot stays empty: the error page has no root data and no auth provider, so nobody is
known there, as before with the old header.

**The first view's scripts**, `SENTRY_RELEASE=compare npx remix vite:build` and `scripts/precompress.mjs` for
`origin/main` and the last commit, counted by `../tonight-title/first-view.mjs` (raw / gzip / Brotli bytes):

| Page | `origin/main` | This branch | Brotli |
| --- | --- | --- | --- |
| `/` | 10 files, 670,358 / 221,279 / 191,662 | 10 files, 632,764 / 209,662 / 182,311 | -9,351 |
| Discover | 31 files, 1,094,236 / 363,373 / 317,100 | 19 files, 814,555 / 271,542 / 237,507 | -79,593 |
| A movie's page | 20 files, 859,154 / 284,649 / 245,364 | 18 files, 823,873 / 273,418 / 236,162 | -9,202 |
| A show's page | 20 files, 859,706 / 284,936 / 245,631 | 18 files, 824,425 / 273,708 / 236,425 | -9,206 |
| Explorer | 17 files, 883,623 / 299,600 / 261,307 | 17 files, 844,622 / 287,509 / 251,576 | -9,731 |
| Taste | 23 files, 956,588 / 308,643 / 267,786 | 17 files, 743,345 / 249,042 / 217,258 | -50,528 |

- **Every page:** the shell went from 55,273 to 47,679 Brotli (the old header's and the flags' code), the vendor
  chunk from 17,069 to 15,514.
- **Discover:** the old page's route chunk, the old filter bar and its sections, the dialog library
  (`headless`, 41,024) and `Select` left the first view. The new filter bar's state moved into one chunk
  (`useFilterState`, 2,067 to 13,129).
- **Title pages:** the chunks were cut differently (`free-mode` went into `detailsMeta`); in all 9.2 KB less.
- **Taste:** the old profile's and quiz's share list pieces (`ScaledCard`, 22,349, `ShareTopFiveCard`, `ShareFlow`,
  `HandlePicker`) and `genres` left the first view.
- The whole client build went from 839 files, 4,490,062 Brotli bytes, to 797 files, 4,194,008.

Not run: `./bench.sh smoke` and `./bench.sh budget`, which measure the deployed site and belong after the deploy.

## For the owner: the variables to remove from Coolify

After this is deployed, from the webapp application, and from the search role's `.env` on its host (written by
`./deploy.sh copy-env`; harmless until then, since nothing reads them):

`REC_TASTE_MATCH`, `REC_FILTER_BAR`, `REC_WATCH_NEXT`, `REC_TASTE_PAGE`, `REC_EXPLORER`, `REC_NAVIGATION`,
`REC_AGE_FILTER`, `REC_TRACKING`, `REC_RELATED_MAP` (if it is set), `REC_PREVIEW_USERS`.

The order no longer matters: no code reads them after the deploy.
