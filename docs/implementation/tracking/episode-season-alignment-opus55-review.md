# Claude Code Opus 5.5 review of the episode season alignment plan

Independent review of the initial draft, October 12, 2026. Model confirmed by Claude Code result metadata: `claude-opus-5-5`. Amendments and decisions are incorporated in [the final plan](episode-season-alignment-plan.md). This review preserves the original feedback, including suggestions that the final plan declines.

# Review: episode-season-alignment-plan.md

## Verdict

**Approve step 1 in a reduced form; step 2 is not ready.** Both stated defects are real in code. The plan leaves four design decisions open that block the 3-season display, and its ingestion wording can be read as an unaffordable crawl. I ran nothing, so the figures 12/37, 7.92 and 8.28 are unconfirmed.

## Ranked findings

**1. Blocker (verified): no tracking event can mark a display season.**
- Events name episodes by canonical season and number (`machine.ts:121-125`, `findEpisode` at `:629`).
- `markSeason` selects `e.season === event.season` (`machine.ts:1121`); `unmarkSeason` does the same (`:1146`).
- The server schema only accepts those shapes (`show-tracking.server.ts:140-147`), and the browser runs the same machine (`show-page.ts:167`).
- Display season 2 is canonical S1E13–24, so "expand to its canonical episodes" needs a new event or a canonical-range event. The plan names neither.
- Undo is safe as is: `undoGroup` removes by group id (`machine.ts:1172-1180`).

**2. Blocker (verified): the grid cannot support ID matching or blank cells today.**
- `buildEpisodeGrid` drops `imdb_episode_id` (`episode-grid.server.ts:210`); the wire tuple has no id (`episode-grid-wire.ts:7`).
- It omits unrated episodes (`:196`) and collapses two episodes under one number (`:209`).
- The grid is built from IMDb tables only. A shared presentation makes the guest show page read the `episode` catalog too (`show.$showKey.tsx:72`).

**3. Blocker (design gap): fallback scope is contradictory.**
- "When alignment data is unavailable, both views use the same canonical grouping" converts every show's grid from IMDb to TMDB numbering.
- That removes ratings the grid shows today for the shifted titles (705, per the comment at `episode-grid.server.ts:127`).
- It contradicts "start with MF GHOST" and `CONTEXT.md:227-231`.

**4. Blocker (design gap): validation flaps on an airing show.**
- "Covers every regular catalog episode, else canonical for the entire show" means a new TMDB episode not yet in the group flips the show back to one season. The group's empty fourth season suggests more episodes are coming.
- No rule or test covers this.

**5. High (verified): labels diverge outside the show page.**
- My shows builds "S1 E13" from canonical numbers (`my-shows.ts:237`), with `furthest` from `tracking-sql.ts:8-11`.
- The hero, toasts and Seen-press words do the same (`HeroTracking.tsx:412-432`, `actions.ts:137`, `seen-press.ts:130`).
- Ordering is unaffected because canonical order is preserved; only the labels differ. "Audit every consumer" is not a decision.

**6. High (cost): ingestion scope is unbounded as written.**
- TMDB external IDs cost one request per episode, as far as I know. The catalog has 6.7 million rows against about 13,000 requests a day (`episode-catalog.md:130`, `:264`).
- The copy does not own `imdb_id` (`episode_catalog.py:39-51`, `episode-catalog.md:41-42`), and recopy rebuilds from season documents. IDs written elsewhere need a durable home.

**7. Medium (verified): the caching step misses the anonymous page cache.**
- Stored HTML embeds the grid, lives 30 minutes fresh plus 2 hours stale per process, and has no reset path (ADR 0007).
- `episode-grid` (6 h) and `tracking-episode-list-v1` (10 min) are not declared resettable (ADR 0006), so "invalidate together" is not possible today.
- Members and guests can disagree for up to 2.5 hours.

**8. Medium (verified): Specials mean different things in each view.**
- The grid's specials are IMDb episodes without a season (`CONTEXT.md:240`, `episode-grid.server.ts:199`).
- The list's are TMDB season 0, which the matcher never rates (`episode-ratings.ts:62`).
- "Two Specials in both views" needs a ruling.

**9. Medium: critic scores.** "Demonstrably compatible" is undefined; Rotten Tomatoes and Metacritic attach by season number (`episode-grid.server.ts:227-239`).

**10. Low:** selection storage and ownership are unnamed, and the missing-note cause is `episode-ratings.ts:105`.

## Simplifications

- **Step 1 needs no ingestion.** The grid already carries votes (`episode-grid.server.ts:15`). Compute the season score from matched episodes and suppress it on partial coverage. That removes the wrong 7.92 now.
- **MF GHOST needs no pipeline.** Check in one reviewed mapping of TMDB episode id to display position to IMDb id, about 39 one-off requests. It also removes the "compatible snapshot" refresh machinery.
- **Leave the grid alone for unselected shows.**

## Proposed amendments

1. **§Implementation 1:** "No general episode-ID crawl. Step 1 computes season scores from matched episodes and votes, and shows none when coverage is partial. IDs are fetched only for selected shows and stored in a checked-in per-show mapping."
2. **§Proposed behavior:** replace the fallback sentence with "Shows without a selected grouping keep today's episode grid and episode list unchanged."
3. **§Implementation 3:** "Add one event that marks an explicit set of canonical episode ids under one group; the server recomputes membership from the stored selection. Watch rows keep canonical season and number (ADR 0008)."
4. **§Implementation 2:** "Episodes after the last grouped episode: [owner decides: fall back, or keep grouped seasons with a trailing ungrouped row]."
5. **§Implementation 3:** "Display labels apply on: show page, hero, toasts, Seen-press words, My shows, Tonight's pick. [Owner decides each, or scopes to the show page with a stated inconsistency.]"
6. **§Implementation 4:** "Version the cache names. Accept and state the page-cache window of up to 2.5 hours, or deploy to empty it."
7. **§Scope:** add an ADR, since this reverses two glossary definitions, and define Specials and critic scores per selected show.

## Missing acceptance tests

- A new canonical episode outside the group: both views stay coherent with no flapping.
- A resend of the new mark event writes nothing twice, and the browser guess equals the server answer.
- Unmark of a display season; `restoreSeen` and the Seen-press summary across display seasons.
- `countedEpisode` fallback (`machine.ts:239`) for a re-added episode in a grouped show.
- My shows' Next episode label matches the show page.
- A tampered id set from another show is refused.
- An unselected show's grid wire is byte-identical before and after.
- A stale cached guest page beside a fresh member read.
- The "s2e1" search in the episode list (`EpisodeList.tsx:498`).

No files were written, including the plan-mode plan file, per your instruction.
