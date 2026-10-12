# Align episode seasons across watched episodes and ratings

Final plan and implementation record after independent Claude Code Fable and Opus 5.5 reviews, October 12, 2026. Start with a reviewed MF GHOST mapping that gives both views three seasons while keeping existing watched progress attached to TMDB episode IDs. Implementation was authorized after a wider catalog audit confirmed the method for seven complete one-to-one regroupings. Enable MF GHOST first; the other cases remain opt-in candidates.

## Verified problem

The live page, database and current TMDB API agree on 37 regular episodes for MF GHOST (`154526`, IMDb `tt28299608`). Their groupings differ:

| Episodes | TMDB watched list | IMDb grid |
| --- | --- | --- |
| 1–12 | S1 E1–12 | S1 E1–12 |
| 13–24 | S1 E13–24 | S2 E1–12 |
| 25–37 | S1 E25–37 | S3 E1–13 |

TMDB's alternative group `6700dcb6c9a10d46ea7cfcdd` contains these same episode IDs in groups of 12, 12 and 13, with an empty fourth season. TMDB also lists two specials.

The current matcher searches within equal season numbers: replaying the actual data matches 12/37 ratings and reports no numbering note for the other 25. The watched list also receives IMDb's first-season average, 7.92, for its 37-episode season; those 37 current ratings average 8.28 weighted by votes. Pin these changing values in fixtures.

Episode external IDs sampled from TMDB match IMDb. A title-only fix cannot match everything: TMDB S1E17 is A Harsh Reality; IMDb S2E5 is A Cruel Reality.

## Decisions

- **Pilot scope:** MF GHOST gets shared display grouping. Other shows keep their existing grouping and ratings grid; the aggregate-score correction can apply generally. Select additional shows only after reviewing their mapping.
- **Identity:** check in a versioned per-show mapping of TMDB ID, canonical position, display position and optional IMDb ID. The audit supplies all pilot external IDs; future approvals fetch IDs only for the show being reviewed, with bounded requests and retries. The existing catalog copier preserves foreign `episode.imdb_id` values, but this pilot uses the checked-in mapping and needs no schema or ingestion change.
- **Ordering:** display grouping preserves canonical regular-episode order. Tracking and imports continue to use canonical numbers. Apply display labels to the episode section, search, hero, toasts, Seen-press summaries, My shows and Tonight's pick through the same lightweight lookup; unselected card reads add no catalog query, and the pilot reads its shared presentation cache.
- **Specials and scores:** selected shows use TMDB's Specials classification in both views. Specials remain outside progress and season averages. An IMDb season average uses the actual matched episodes and votes in that display row. Show rating coverage; suppress the aggregate while episode identity is unresolved. Confirmed unrated episodes contribute no vote weight. Enable other providers' season scores only through an explicitly reviewed provider-to-display-season mapping; the pilot enables IMDb alone.
- **New episodes:** preserve approved seasons when later canonical episodes appear. Put trailing episodes absent from the mapping in an Additional episodes row in both views, using explicitly labelled TMDB numbers. Move them into a numbered season through a reviewed mapping update. Hide the empty fourth group. Structural conflicts, duplicate IDs or positions, or changed episode order trigger canonical grouping for the selected show in both views, with an explanatory note. Removed episodes leave their approved display positions vacant; a re-created ID needs revalidation and must not inherit another episode's rating.

## Delivery steps

1. **Fix aggregate correctness and capture fixtures.** Compute tracking season averages from matched episode ratings and vote counts instead of copying `imdb_season` averages by number. On incomplete matching, show coverage and suppress the average. Expose complete rating coverage for the selected presentation; retain legacy numbering-note semantics for unselected shows. Capture the public catalog, grouping and IMDb rows for MF GHOST, and verify every mapped external ID before enabling the pilot.

2. **Add one shared presentation module.** Its interface accepts catalog episodes, the selected mapping and raw IMDb episode ratings, then returns display rows, canonical identities, rating coverage and scores. Read `imdb_episode` by IMDb ID without first passing through the existing grid builder: that builder discards IDs, unrated episodes and duplicate positions. Route both the public show loader/guest grid and member tracking read through this module for selected shows. Extend/version the selected-show grid wire format to carry blank ratings and catalog specials. The legacy grid path stays intact for unselected shows. Title requests make no TMDB calls.

3. **Make displayed-season actions explicit.** Add `markEpisodes { episodeIds, displaySeason, presentationVersion, today }` to the browser machine, server schema, named-action validation and writer. The server derives the displayed season's eligible aired IDs using the existing device-date/UTC-tolerance rules and validates the submitted set/version; foreign IDs or stale versions are refused and the browser reloads. Apply the existing mark-season transition rules to that explicit set, with deterministic watch IDs, one `actionId`, `origin = season`, and existing `undoGroup` behavior. Preserve canonical fields on every watch. Existing `markSeason`, `unmarkSeason` and `watchUpTo` retain their meanings. Current main now exposes Unmark season. Add `unmarkEpisodes` with the same membership/version check and existing restore-season undo, targeting only the displayed membership. Resolve watch-up-to's target canonically. The optimistic browser uses the same target selection as the server.

4. **Roll out with coherent caches and labels.** Use a new versioned presentation cache keyed by show and mapping version for both read paths; ensure the episode-list cache supplies the current required fields. Keep catalog/grouping fallback decisions in that shared cached result. Expose its version with labels and actions so stale pages cannot submit a silently reinterpreted season. On initial launch and mapping updates, restart all webapp instances to clear anonymous HTML caches, which otherwise may retain old pages for up to 2.5 hours. Verify fresh member/guest responses from each instance; open tabs reload on a version conflict. Coordinate the label lookup with the published presentation's active mapping/fallback state. Record an ADR and update `CONTEXT.md` and tracking docs during implementation: the current glossary explicitly assigns different numbering to the two views.

## Acceptance checks

- Both MF GHOST views have 12, 12 and 13 regular episodes, plus the two catalog specials. Canonical S1E13 and S1E25 display as S2E1 and S3E1 with their original TMDB IDs. Verify all 37 ratings against IDs, including the differently titled episode.
- Marking display season 2 adds only its 12 eligible episodes, retaining existing watches and pass. Resending the action writes once; Undo removes only its added watches. Browser and server agree. Wrong-show IDs, future targets and stale versions are rejected.
- Stored progress, Next episode, Seen, new-episode counts, imports, rewatch passes, `restoreSeen` and `countedEpisode` fallback retain their rules. Display labels agree across the listed surfaces; searches for `s2e1` and `2x1` find the original S1E13 ID.
- Test partial/absent ratings, repeated titles, invalid mappings, a new trailing episode, removal and re-creation, failed catalog reads, fallback and stale cached HTML. A failed read does not publish an incomplete fallback; the page uses existing incomplete-response handling. Unselected shows retain their grid payload and layout. Score fixtures assert membership, votes and coverage.
- Run focused presentation, show-page read, tracking-action and wire tests, TypeScript checks, desktop/phone member and guest checks, `goodwatch-benchmark/bench.sh budget`, and Lighthouse for the title-page change.

## Review resolution

Both reviewers confirmed the matcher and aggregate lookup defects and requested explicit season-action targets, bounded identity work, guest-grid wiring, cache handling and a numbering decision beyond the episode section. These are incorporated above. Opus additionally identified grouping instability when new episodes arrive; the Additional episodes rule addresses it.

Fable's title-only shortcut is declined because of the verified title difference. Its existing-missing-count shortcut is also insufficient: the original replay reports zero numbering notes despite 25 absent matches. General external-ID ingestion and automatic ordering selection remain follow-up work after the pilot. The reviewers suggested a target-set unmark event. Current main gained a season-wide unmark control after the planning review, so the implementation includes it.

Full reviews: [Fable](episode-season-alignment-fable-review.md), [Opus 5.5](episode-season-alignment-opus55-review.md). Sources: [episode catalog](../../episode-catalog.md), [tracking model](data-model.md), [watch identity ADR](../../adr/0008-one-row-per-watch.md), [page cache ADR](../../adr/0007-in-process-page-cache.md), [TMDB episode groups](https://developer.themoviedb.org/reference/tv-episode-group-details), [TMDB external IDs](https://developer.themoviedb.org/reference/tv-episode-external-ids).

## Catalog audit gates

The [wide audit](../../research/season-episode-scores/episode-alignment-audit.md) covers 40,216 overlapping shows and 113 detailed samples. Seven full regular-episode mappings pass identity, membership and order checks. Before enabling a mapping, also verify the IMDb parent, episode granularity and Specials classification. A current Pokémon example demonstrates conflicting external-ID and title evidence; handle conflicts through a reviewed override or an unresolved rating. MF GHOST explicitly records the reviewed A Harsh Reality / A Cruel Reality alias. Group names and counts alone are insufficient, as One Piece has a complete absolute group with an incorrect local ordering.

## Implemented review changes

Claude Code Fable (`claude-fable-5-1`) and Opus 5.5 (`claude-opus-5-5`) reviewed the implementation as well as the plan. The implementation reviews are preserved as snapshots: [Fable](episode-season-alignment-fable-implementation-review.md), [Opus](episode-season-alignment-opus55-implementation-review.md). Their actionable findings are resolved:

- The shared cached presentation carries the entire catalog snapshot, including dates, runtime, artwork and overview. Member tracking, the guest grid and Next episode consume that snapshot rather than mixing independent cache generations.
- An IMDb outage preserves reviewed labels and tracking with blank ratings; the failed ratings read is not cached. Catalog failures cannot publish an empty presentation, and a bulk action refuses with a reload response before writing.
- A completed Mark resend confirms its existing deterministic group after a presentation-version change without inserting watches again. New stale actions still refuse.
- New-episode signals, Seen-press summaries, season-count metadata, search, toasts and Next labels carry the display positions. Re-created episode IDs use the same unique canonical-position fallback as progress when summarizing old watches. Additional episodes do not inflate numbered-season counts.
- The server error class uses syntax supported by the repository's Node test runner. The small episode-label helper keeps server presentation code out of landing-page imports.

The legacy matcher cannot distinguish an unmatched aired episode from a verified unrated episode, so its aggregate remains suppressed with visible coverage until identity is complete. Unaired episodes do not suppress that aggregate. A time-based grace period would hide this uncertainty and was declined. MF GHOST's captured IMDb dataset has no special rows; its two TMDB specials intentionally appear as unrated catalog episodes in both views.

The implementation rebases cleanly onto the October 12 activity-date correction. Its generic storage rule also covers explicit Unmark actions: removing watches does not create a new Watching-since date.

## Validation record

The focused suite after rebasing passes **170 tests**, including all seven audited mapping fixtures (311 regular episodes), tracking writes, explicit membership/version rejection, Mark resend, Undo, Unmark, restored seasons, outage handling, cache snapshots, grid serialization, storage and display labels. The earlier full suite ran 1,614 tests: 1,603 passed, one skipped and ten timing-sensitive failures under severe local load. Rerunning the three affected files passed all 33 tests.

Production client and server builds pass. TypeScript reports existing errors elsewhere in the repository; the checked modified files have no diagnostics. Public SSR against the branch's production build reports three MF GHOST seasons and the correctly matched White Reaper Descends episode. The compiled real-component browser harness passes on phone and desktop for members and guests: display grouping, S2E1 search, canonical storage of the 12 season-two targets, Undo, Unmark and both responsive grid layouts. A read against the production build and live catalog confirms rows of 12 / 12 / 13 plus two specials, with S2E1 rated 8.4. The full TypeScript run currently reports 212 diagnostics in pre-existing files and none in the implementation files. Performance checks ran with Lighthouse 13.5 on the dedicated generator at the prescribed 2.7 slowdown. The production-build branch, with production feature flags and read-only search routing, passed home, person and share-list budgets across three runs. Movie, show and Discover retained failures in timing, image or request limits. A separately built, unchanged `main` control (`5fe7d597`) reproduced the same failures with identical captured-page and asset serving; both builds also exceeded the person HTML bound in that fixture setup. The control and branch had the same Discover script count (33) and image count (19), and both had 12 show-page images against the older limit of 11. The unchanged-main control's movie/show TBT was 358/323 ms; the corresponding branch fixture was 305/332 ms. This establishes existing failures and measurement sensitivity rather than a passing performance budget. A direct production check also failed the existing movie image-byte and total-byte limits before this change (108.7 KB / 504.2 KB against 100 KB / 472 KB), while its other five surfaces passed. No limits were relaxed. Full production performance acceptance remains a separate baseline issue; do not describe the budget as passing.

Benchmark artifacts are local and ignored under `goodwatch-benchmark/results/`: `20261012T112537Z-lighthouse-episode-alignment-final`, the run labelled `episode-alignment-cached-render`, and the runs labelled `episode-alignment-main-control` and `episode-alignment-production-baseline`. Cached-page fixtures used actual SSR responses and built assets to remove the local serving/tunnel bottleneck; they were test-only, with no application changes. The local development server, temporary route-enabling configuration and benchmark network override are excluded from the commit.
