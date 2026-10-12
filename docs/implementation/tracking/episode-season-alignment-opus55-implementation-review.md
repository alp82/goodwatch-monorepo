# Claude Code opus55 implementation review

**Verdict:** no blocking findings on watch targeting. I'd fix findings 1 and 2 before merge, because 1 changes behaviour for every show, not just MF GHOST. This is from reading the code only; I ran no tests or `tsc`. The working tree has also moved past `/tmp/gw-align-implementation.diff` (e.g. `app/domain/tracking/episode-presentation-grid.ts` is new), so I checked against the current files.

Paths are under `goodwatch-webapp/app/`; `~` marks line numbers estimated from diff hunks.

## High

**1. Season scores disappear for unselected shows with any unmatched episode** — `server/show-tracking.server.ts` ~121–155
- The new legacy branch returns no score when `scored.some((e) => !e)`.
- The legacy grid drops unrated rows (`server/episode-grid.server.ts:226`), so an unaired or not-yet-rated episode is "unmatched".
- Every currently airing season, and any season with an IMDb gap, therefore loses its score in the tracking list.
- No coverage is shown either: the "x/y rated" line only renders when `page.presentation` exists.
- This contradicts the plan's "confirmed unrated episodes contribute no vote weight".
- Fix: suppress only on unmatched aired episodes that IMDb rates, or show coverage. Only the fully rated case is tested (8.4 → 8.3).

**2. The page stitches two independently cached catalog snapshots** — `server/show-tracking.server.ts` ~61–115, `server/episode-presentation.server.ts`
- Page episodes come from `getEpisodeList`; `displaySeason` and the version come from the separate 10-minute presentation cache.
- When they are out of phase, a new episode has no `displaySeason`, so the browser groups it into display Season 1 by its canonical season.
- Mark or Unmark season 1 then sends 13 IDs, the server refuses with `reload`, and the reload returns the same mismatch until the cache turns over.
- No wrong write happens, but it is a refusal loop of up to 10 minutes, with the wrong label and a legacy-matcher rating meanwhile.
- Fix: carry the catalog snapshot inside the cached presentation and build page episodes from it.

## Medium

**3. Label lookups now depend on the `imdb_episode` read** — `server/episode-presentation.server.ts` ~16–21
- `getEpisodePresentation` is awaited without a catch in `getShowTrackingPage`, in `readNextEpisodes` (`server/my-shows.server.ts` ~308) and in the action pre-check.
- An IMDb read failure used to cost only ratings (`grid(id).catch`). It now fails the tracking page, My shows and Tonight's pick for anyone tracking MF GHOST, and blocks mark/unmark.
- An empty catalog list now throws as well.
- The plan asked for a lightweight lookup; split the labels/version from the ratings, or degrade to labels without ratings.

**4. Missed display labels**
- `domain/new-episodes-signal.ts:41` still builds `S${only.season} E${only.number}` for the badge, tile and door, so it disagrees with My shows and the hero.
- `ui/details/DetailsQuestions.tsx:188` still lists TMDB seasons ("Season 1: 37 episodes"), while the route overrides only `number_of_seasons` (`routes/show.$showKey.tsx` ~115).
- Check any other reader of `media.details.seasons` on the title page.

**5. Seen-press loses the position fallback** — `domain/tracking/seen-press.ts` ~67–78
- A row whose `episode_tmdb_id` is no longer listed (a re-created episode) never tries season/number.
- It falls back to the canonical `season_number`, which for MF GHOST lands in display Season 1.
- The set then mixes episode IDs with episode numbers, so "x of 12" can miscount.
- Fix: try the position when the ID lookup misses, and key the set consistently.

**6. A resend after a catalog change is refused instead of replayed** — `server/show-tracking.server.ts` ~330–373
- The version check runs before the idempotent writer.
- A retried `markEpisodes` with an already applied `actionId` gets "The episode list changed" if an air date moved in between, because the version hashes `airDate`.
- The watches are there, but the browser shows a failure and loses its Undo toast.
- Fix: look for existing rows with that group before refusing.

## Low

- **Duplicate imports:** `ui/tracking/store.ts:5–34` has the same `displaySeason, displayNumber` import nine times. esbuild accepts it; I did not run `tsc` or Biome, which may not.
- **Bundle coupling:** `domain/new-episodes.ts:1` has a value import of `./my-shows.ts`, placed above the file header, which pulls My shows domain code into the shared signal module.
- **Empty unmark:** `ui/tracking/actions.ts` ~240 can send `episodeIds: []` on a stale page; the schema's `.min(1)` then fails as a parse error rather than a reload.
- **Constant note:** a trailing unmapped episode counts as unresolved, so "Some episode ratings could not be matched safely" shows for the whole show once an Additional episode exists. Unmapped should be distinguished from conflicted.
- **Other providers' season scores:** `presentationGrid` hard-codes Rotten Tomatoes, Metacritic and TMDB to null. This follows the plan, but MF GHOST visibly loses any it has today.

## Checked and sound

- **Targeting:** `markEpisodes` and `unmarkEpisodes` act on the intersection of the submitted IDs with aired-and-unwatched (or watched) episodes. The machine rejects foreign, special and duplicate IDs; the server requires exact membership and version.
- **Canonical semantics:** `markSeason`, `unmarkSeason` and `watchUpTo` are unchanged; origin, group, `undoGroup` and restore are preserved. The "up to here" count compares canonically (`ui/tracking/EpisodeList.tsx:1390`).
- **Device date:** the pre-check uses the raw device date and the machine uses max(UTC, device), but the ID intersection keeps both directions safe.
- **Mapping activation:** it requires unique IDs and positions, monotonic order and matching canonical positions. A re-created ID in an old slot falls back to canonical grouping.
- **Ratings:** they require the IMDb ID, parent, position and a name or reviewed alias. Nothing is guessed.

## Missing regression tests

- Legacy show with an unaired or unrated episode in a season (finding 1).
- Page read with the list and presentation caches out of phase (finding 2).
- `imdb_episode` failure for a selected show on the tracking page, My shows and the action path.
- Search for `s2e1` and `2x1` resolving to canonical S1E13 through `findEpisodes`; it is an acceptance check with no test.
- Label tests with display fields for `seenPressOf`/`seenPressCovers`, `episodeCode`, `waitingWords` and `signalWords`, including the Additional row.
- A resent `markEpisodes` after a version change, and the browser session's `reload` → `onStale` path.
- The six non-enabled fixtures through activation and score membership, votes and coverage; I only saw MF GHOST exercised by name.
- `unmarkEpisodes` when the display season contains unaired members, and on a rewatch pass.
