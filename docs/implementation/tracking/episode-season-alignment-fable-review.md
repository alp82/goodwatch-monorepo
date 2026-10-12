# Claude Code Fable review of the episode season alignment plan

Independent review of the initial draft, October 12, 2026. Model confirmed by Claude Code result metadata: `claude-fable-5-1`. Amendments and decisions are incorporated in [the final plan](episode-season-alignment-plan.md). This review preserves the original feedback, including suggestions that the final plan declines.

# Review of `docs/implementation/tracking/episode-season-alignment-plan.md`

## Verdict

**Approve the diagnosis, amend the plan before implementation.** The two defects are real and the direction is right. Three things block the plan as written. The season actions cannot express a display season. The per-episode IMDb ID ingestion is not feasible as a general first release. And the plan names events that do not exist. A much smaller first release is available that needs no ingestion change at all.

## Verified against the code

- `app/domain/tracking/episode-ratings.ts:68` matches only inside an equal season number. Confirmed.
- `app/server/show-tracking.server.ts:98-106` copies the IMDb season score by IMDb season number, and `app/ui/tracking/EpisodeList.tsx:319` reads it by TMDB season number. Confirmed. The figures 12/37, 7.92 and 8.28 come from live data I could not run. Treat them as plausible, not verified.
- `imdb_episode.imdb_episode_id` already exists (`episode-grid.server.ts:80,147`), so identity only needs the TMDB side. The `episode.imdb_id` ownership question is already settled: the copy's model has only its own columns (`crate_models.py:274-275`) and `tests/test_episode_copy.py:203-211` proves a foreign `imdb_id` survives an upsert.
- The tracking read is `private, no-store` (`routes/api.tracking.show.ts:26`). The grid is cached six hours keyed by `showId` only (`episode-grid.server.ts:134-140`) and is embedded in the show page HTML (`routes/show.$showKey.tsx:69-73`), which the page cache holds.
- `CONTEXT.md:227-231` assigns TMDB numbering to the list and IMDb numbering to the grid. `EpisodeList.tsx:684-688` repeats it in the toggle's label.

## Ranked findings

1. **Blocker: season actions carry one canonical season number.** `markSeason` and `unmarkSeason` filter on `e.season === event.season` against the catalog (`machine.ts:1117-1123, 1143-1147`), and the schema allows nothing else (`show-tracking.server.ts:140-147`). Display season 2 of MF GHOST cannot be sent. Reinterpreting `season` as a display number would break stored clients and imports. Add explicit `markEpisodes { ids }` and `unmarkEpisodes { ids }` events, validated on the server against the presentation and grouped under one `actionId`, so the existing `undoGroup` and resend rules apply unchanged. `watchUpTo` and the browser's "up to here" count (`EpisodeList.tsx:1359-1369`) compare canonical fields and stay correct if `PageEpisode` keeps them.

2. **Blocker: per-episode IMDb IDs cost one TMDB request per episode.** The season append (`tmdb_fetch_episodes_from_api/fetch.py:46`) carries no episode external IDs. The catalog has about 6.7 million episodes (`docs/episode-catalog.md:130`). "First release the identity matching in canonical grouping" is therefore a per-show backfill, not a general release. Say so, or drop identity from release 1.

3. **Defect: wrong event names.** The plan audits `watchSeason` and `watchThrough`. The events are `markSeason`, `watchUpTo`, `unmarkSeason` and `undoGroup` (`machine.ts:121-131`).

4. **Gap: the grid is a guest surface built without the catalog.** The grid build reads only IMDb and provider tables. A display-season grid needs the presentation inside the grid build, one more routed `episode` read, and a grouping version in the cache key. The invalidation list must also name the show's page cache entry.

5. **Gap: surfaces off the show page keep canonical numbers.** `furthest`, `episodesWatched` and labels on cards and Tonight come from stored `season_number`/`episode_number` (`data-model.md:325-328`, `show-page.ts:337-366`, `machine.ts:217`). Those pages never load the episode list. Decide and record: release 1 shows display numbers on the show page only.

6. **Minor: votes on the tracking page.** `RatedSeason` (`episode-ratings.ts:16-19`) carries no votes, while `GridEpisode` already does. A vote-weighted display-season average needs votes passed through the matcher input.

7. **Minor: provider season scores.** TMDB season scores are gated by an episode-count tolerance (`episode-grid.server.ts:127-130, 225-226`) and will vanish for 12-episode display seasons. Rotten Tomatoes and Metacritic rows attach by their own season number. State the rule: attach provider rows to a display season only when the grouping was validated against that provider's numbering, otherwise hide them.

## Simplifications

- **Release 1 needs no ingestion.** Feed `matchEpisodeRatings` the display season and number from the grouping instead of the canonical ones. For MF GHOST the existing same-number-with-agreeing-title rule then yields 37 of 37 with no IMDb IDs. Compute season averages from the matched scores and votes. IMDb ID identity becomes a separate later ticket.
- **Store the grouping as a checked-in constant,** validated against the catalog at read time and falling back to canonical on any mismatch. No schema, no flow, reversible by one line. A Crate table can follow with the second approved show.
- Score coverage is the matcher's existing `missing` count surfaced per display season.

## Missing acceptance tests

- Pure presentation: an unknown ID, a duplicate, a missing regular episode, a special in the group, or an empty fourth season falls back to canonical and records the reason.
- Matcher with display numbering on the MF GHOST fixture: 37 matches, no note. With one title changed: 36 and a note.
- `markEpisodes` refuses an ID outside the display season or not aired. The same `actionId` sent twice writes once. `undoGroup` removes exactly those rows.
- Browser finder: "2x1" resolves to the canonical S1 E13 ID.
- Guest grid for MF GHOST: three rows plus specials. The grid cache key and the page cache change with the grouping version.
- `watchStateEntryOf.furthest` is unchanged after the switch.
- Season average fixture with votes. A partial match shows "n of m rated", not a complete average.

## Proposed plan amendments

1. Replace `watchSeason`/`watchThrough` with `markSeason`/`watchUpTo`/`unmarkSeason`/`undoGroup`.
2. Step 1 becomes "checked-in grouping constant for MF GHOST, matcher fed display numbers, season averages from matched episodes." Move per-episode IMDb ID ingestion to a follow-up ticket and delete the ownership check.
3. Step 3 adds `markEpisodes` and `unmarkEpisodes` with explicit IDs. `markSeason` keeps its canonical meaning.
4. Step 3 adds "the grid builder reads the catalog and the grouping; one presentation module serves tracking and grid."
5. Step 4 adds the show's page cache to invalidation and the grouping version to the grid cache key.
6. Add the off-page numbering decision and the provider-score rule to Proposed behavior.
7. Mark the 12/37, 7.92 and 8.28 figures as to be pinned by the fixture.
