# Native and CSV imports

The Imports settings page accepts native Letterboxd and Trakt ZIP exports alongside generic CSV, MovieLens ratings/wishlist CSV, Kodi library XML/ZIP and the existing IMDb ratings CSV flow. The new routes live at `/api/imports`; the IMDb routes remain at `/api/imdb-import` and reject imports belonging to another source.

Anime entry offsets and crosswalk lookup are available to server adapters through the shared resolver. See [anime episode placement](anime-episode-mapping.md) for the observation contract, Anime-Lists/Fribb attribution, snapshot refresh and rollout. Native anime source adapters are separate builds.

## Member flow

1. Choose Letterboxd or Trakt and upload the original ZIP.
2. Review the catalog matches, conflicts, unsupported rows and warnings. Preview stores an import journal but changes no ratings, watches or lists.
3. Select ratings, watches, Want to See, favorites and reviews as available. Keep GoodWatch changes is the default conflict policy. When importing watches, explicitly choose to preserve the source dates or import them without dates.
4. Confirm and follow progress. A stopped operation can resume. Its original choices stay fixed.
5. Review the receipt and download unmatched, unsupported and invalid rows. Undo reverses the import's changes where later member edits have not superseded them. Imported watches remain owned by their import even if their dates were edited, and the undo confirmation explains this.

Only an unambiguous catalog match is imported. Trakt uses external IDs; Letterboxd can use exact title and year. Ambiguous or missing titles are left out with a reason. Letterboxd and Trakt previews need no scraper or external API connection; the shared episode resolver can use TMDB for other adapters’ TVDB IDs and episode groups.

## Source semantics

- Letterboxd ratings are doubled from 0.5–5 stars to GoodWatch's 1–10 scale. `ratings.csv` supplies the current rating. Diary ratings do not replace it.
- Only `Watched Date` supplies a Letterboxd viewing date. The `Date` column in `watched.csv` is not a viewing date. Diary, watched and review overlap does not create multiple watches of one viewing.
- Trakt uses the paginated `watched-history-*` files and their history IDs. Aggregate play counts do not create additional watches. Distinct history IDs at the same time remain distinct source viewings.
- Repeated timestamps produce a warning; they do not automatically lose their dates.
- Episode and season ratings and custom lists are not applied. Unsupported observations and export notes make this visible. Deleted/orphaned Letterboxd content and account/social metadata are not imported as active library data.
- No Simkl, TMDB, Netflix or TV Time upload path is advertised by this change: their samples remain unavailable.

Watch writes use the existing tracking writer and the rules in [the tracking data model](tracking/data-model.md). They preserve On hold, Dropped and Seen decisions made in GoodWatch. Movies retain the invariant that a score owns one undated watch only while no other watch exists. Each title has a durable watch plan saved before applying it, so retries use the same source identities and undo has the earlier state.

As with a watch recorded in GoodWatch, imported watches can clear an existing Want to See or Not interested entry. Import undo follows section 7 of the tracking model: it removes imported watches and restores owned states and scores, but does not put those cleared intentions back. Preview and undo explain this limitation.

Rating-only imports preserve existing intention lists, following the existing IMDb importer rather than the interactive rating action. A newly imported Want to See entry clears an unchanged Not interested entry.

## Show status observations

Issue #645 adds `kind: "show_status"` with `showStatus: "watching" | "on_hold" | "dropped" | "plan_to_watch" | "completed"`. No shipped source adapter emits it yet. Adapters can submit a `ParsedImport` through `previewParsedImport(userId, fileName, parsed, fileHash)`; uploads delegate to the same boundary after parsing and hashing their original bytes. All observations still pass through catalog matching, preview, selection, the durable receipt, resume and undo.

- Watching, On hold and Dropped can arrive without any watches. Only Not started or Watching may change; On hold, Dropped and Seen already in GoodWatch are kept, even with “Use the export instead”. A state version changed after preview is also kept. One applicable status per matched TMDB show is required; multiple applicable statuses are invalid with a reason.
- Plan to watch remains a selectable show status observation and writes Want to See through the existing list journal, only when the show has not started and has no watches. It does not create a tracking state or a watch.
- Completed requires `completionScope: "show"`, meaning the adapter has established completion of the **whole matched TMDB show**. `"part"` and missing scope are unsupported and remain visible in the receipt. Episode/season coordinates on a status are unsupported. An anime cour or part must never claim whole-show scope merely because its title matches a show.
- Whole-show completion follows the machine's Seen press: mark missing aired regular episodes in the current pass, with unknown dates and import ownership. Specials and unaired episodes are excluded. There is no standing Seen press; the import's Undo owns these watches. Completion scope does not change the ordinary episode-watch state rules.
- A source status follows any selected watches in the same per-show journal. Statuses that start Watching, put On hold, Drop or complete a show clear the observed Want to See and Not interested entries. Dropped uses the existing state, so recommendation exclusion remains the existing rule and is not a taste signal. Cleared intentions are not restored by Undo, as for imported watches; preview and Undo explain this.
- Undo restores the previous status, including Watching without watches, while leaving later member edits alone. The journal lives in the existing payload column: no schema migration. A source-only move to Watching stores `state_changed_at = 0` as “no dated member move”; both activity readers ignore that sentinel. `updated_at` retains the real write timestamp for undo ownership. Watches keep their source dates and imports never manufacture recent activity.

This extends the earlier import-status restriction in ADR 0009 and tracking model section 7, which required an absent state and a watch for On hold. The ticket explicitly permits statuses without watches; `CONTEXT.md` permits imports to change Not started and Watching. Interactive member actions keep their existing guards. The old diagnostic “Watching must have a watch” no longer applies to a status-only import or a member resuming one.

## Shared episode resolver

`app/server/imports/episode-resolver.server.ts` resolves evidence within an already matched show. `episode-resolver-data.server.ts` connects it to the existing import database helpers and TMDB; `preview.server.ts` uses it for every episode observation. Trakt keeps TMDB IDs first and retains canonical positions for successful ID matches. A stale ID can now fall through to the remaining evidence. Kodi also supplies episode evidence to this resolver.

Evidence order:

1. **TMDB episode ID:** exactly one live catalog episode of the matched show.
2. **TVDB episode ID:** read the catalog cache and revalidate through TMDB `find` with `external_source=tvdb_id` once per distinct ID per preview. Only `tv_episode_results` counts; the returned show and live catalog episode must match. Fresh evidence wins over stale cached identities. If TMDB is unavailable, a unique cached match remains usable; an ambiguous cache or an explicit negative TMDB response does not establish a match.
3. **Anime entry:** validated Anime-Lists placement after the Fribb identity crosswalk. The full reported progress and known total must fit the current catalog; failure stays unmatched without guessing coordinates. See [anime episode placement](anime-episode-mapping.md).
4. **Episode group:** `episodeGroup` carries an optional explicit group `id`, a required part/volume `label`, and optional source `groupCount`. The group must be listed for this show. Without an ID, only Netflix digital groups or Part/Volume groups with the supplied part count qualify. Labels match group names exactly, ignoring case and surrounding whitespace. Source episode numbers are one-based positions in the group's zero-based episode order.
5. **Season and episode:** only with `episodeNumbering: "tmdb"` (the Trakt adapter supplies this). Rows without an episode number may match an exact, case-insensitive catalog name within the show, selected group, or trusted season. An untrusted source season never filters a show-wide name lookup.

The first unique match wins. Failed TMDB IDs fall through to TVDB IDs, then anime placement when supplied, otherwise groups; trusted coordinates or a numberless name are considered only without anime entry evidence. Group candidates are deduplicated by TMDB episode ID, so two complete groups agreeing on one episode are not ambiguous. Receipts name failed evidence. Specials retain their canonical IDs, carry `episodeSpecial: true`, and produce a row explanation and preview warning; duplicate-watch explanations append to that reason. Regular episodes omit the flag. The normal tracking writer still applies special matches.

Group validation checks the entire alternative cut: declared counts, dense group and episode positions, unique live episode IDs, and complete regular-season coverage through the latest catalog season. A cut containing specials may replace leading regular seasons, as Money Heist's Netflix Parts 1 and 2 do; all regular seasons from its first represented regular season onward must be complete. Specials absent from a cut are not required. This validates structure, not the editorial correspondence of community cuts, and does not change the reviewed display presentations in ADR 0012.

Catalog reads and TMDB requests are memoized per preview, including lookup failures. TMDB responses are schema-checked and use the existing timeout helper (`TMDB_TIMEOUT_MS`, five seconds by default). HTTP errors, malformed responses and timeouts permit cached matches or later evidence; without a match, the receipt explains the lookup failure. Automatic HTTP 429 retry/backoff is deferred and should be addressed before enabling high-volume TV Time or Simkl imports. Catalog-read errors stop preview. Cache writes stay in preview but are best effort: errors are logged and the settled match is returned. Writes go only through `store.server.ts` helpers. A compare-and-set update checks the previously read TVDB ID and the live-episode guard; only a one-row update permits clearing that TVDB ID from other episodes of the show and changing the in-memory cache. Thus fresh evidence can repair old mappings without overwriting a concurrent edit. No change is made to the in-memory cache on a zero-row update or failed write. A catalog read reaching the 50,001-row sentinel is rejected rather than used to infer uniqueness.

Tests use synthetic episode IDs with Friends, The Office and Money Heist numbering/count examples from [the episode-numbering research note on its origin branch](https://github.com/alp82/goodwatch-monorepo/blob/research/episode-numbering/docs/research/imports/episode-numbering.md). Database and TMDB boundaries are faked locally. Anime placement tests additionally cover Frieren, Spy x Family, Attack on Titan, Bleach and One Piece. Translated-name lookups and new source parsers remain separate work.

## Getting an export

- [Letterboxd](https://letterboxd.com/user/exportdata/): sign in on the web, open Settings → Data and choose Export Data. Upload the resulting ZIP intact.
- [Trakt](https://app.trakt.tv/settings/data): sign in on the web, open Profile → Settings → Data and choose Export now. Wait for the ZIP, then upload it intact. This raw export is available to free and VIP members, unlike the separate CSV page exports. See [Trakt's export instructions](https://forums.trakt.tv/t/how-do-i-export-my-data/54762) and [all-members announcement](https://forums.trakt.tv/t/freemium-experience-more-features-for-all-with-usage-limits/41641/97).

## Rollout

The production migration was applied on 2026-10-10. All 55 columns across both import tables were checked against the Windmill schema declarations. A synthetic 70,014-byte journal was stored and read back successfully, then deleted. The payload column disables both indexing and column storage so large per-show watch plans are supported.

Apply the additive [CrateDB migration](imports/native-import-schema.sql) before deploying the new routes. The canonical schema declarations are also updated in `goodwatch-flows/windmill/f/sync/models/crate_schemas.py`; the existing schema initialization workflow can add missing columns. Inspect the existing columns first: the explicit SQL is a one-time migration, not an idempotent script.

No existing IMDb rows need rewriting. The new columns are nullable. Keep the columns if rolling back the webapp so previously created import journals are retained.

After migration, check a synthetic account end to end: preview, confirm, re-upload the same export, resume an interrupted import, and undo. Check both a movie and a show, a manual rating edited after preview, and a show already On hold. A production account's private archive is not a test fixture.

## Validation and limits

The archive reader works in memory with bounded compressed size, expanded size, entry count and observation count. It checks archive integrity, rejects encrypted/unsafe entries and does not extract files to disk. The public upload limit is 20 MB and the observation limit is 50,000.

Synthetic tests cover archive parsing, rendered preview controls, service ownership and receipts, interrupted writes, later edits, dependent rating/review writes, duplicate watches, concurrent tracking and undo ordering. Run them from `goodwatch-webapp`:

```sh
node --test app/server/imports/*.test.ts app/server/tracking.test.ts app/server/imdb-import/*.test.ts app/ui/imports/SourceImportHooks.test.ts
```

The service tests inject the database boundary; they do not replace a live CrateDB rollout check. The supplied private archives were read directly outside the repository; their contents are not committed. These establish real export shapes, not complete coverage of every export variant.

Source watch identity is strongest for Trakt history IDs and Letterboxd diary-entry URLs. Older Letterboxd rows without distinct entry URLs cannot identify every historical edit unambiguously. Unknown and ambiguous data must remain visible rather than being silently guessed.

## Generic CSV

Choose **Generic CSV** on Imports and upload a UTF-8 CSV in [Letterboxd import format](https://letterboxd.com/about/importing-data/). Matching uses TMDB ID, then IMDb ID, then an exact title and year only when unique. Letterboxd URLs are source identities, not catalog IDs. `Name` and `Watched Date` are accepted as export aliases. Unknown columns are listed in preview and receipt notes.

A valid `Rating10` takes priority over `Rating` regardless of column order; an invalid `Rating10` falls back to a valid `Rating`. Ratings without a watched date do not invent a viewing date. Each dated row supplies a day-precision watch; invalid dates and scores remain visible as invalid items. Reviews use the existing review importer. Tags, Directors and Rewatch metadata are not applied; Rewatch does not invent extra viewings. The normal kind selection, conflict policy, date choice, receipts, resume and undo apply.

CSV supports both backslash-escaped and doubled quotes, escaped backslashes and multiline fields. Letterboxd ZIP parsing retains its original permissive handling of unclosed quotes. Limits are 20 MB, 50,000 rows and 50,000 observations. Generic files without stable entry URLs use per-title occurrence identities; historical edits or adding/removing repeated viewings may change those identities, as with older Letterboxd exports. Matching review improvements remain deferred to #374.

## MovieLens

Choose **MovieLens** on Imports. In MovieLens, open Settings → Import or export and download `movielens-ratings.csv` and, optionally, `movielens-wishlist.csv`. Select both before pressing Preview import. This is the personal export, not the anonymized GroupLens research dataset.

Ratings use `movie_id,imdb_id,tmdb_id,rating,average_rating,title`; wishlist uses the same columns without `rating`. Reordered and additional columns are accepted. `average_rating` is ignored. The member's half-star rating is doubled exactly; no rating or watch date is invented. Wishlist entries become Want to See. Matching uses TMDB, then IMDb (adding `tt` and padding short numeric IDs to seven digits); there is no title-only fallback. Duplicate movie IDs within one file are rejected. Both files share the 20 MB and 50,000-item limits.

Preview and receipt always explain that tags and activity logs are not applied: activity times describe ratings, not viewings. The shared import journal owns both files' observations and keeps the existing selection, conflict, resume and undo behavior. No migration is needed beyond the shipped native import schema.

MovieLens fixtures are synthetic, based on the research note on `research/criticker-movielens-sofa-exports`; they are not represented as a current member export. Parser, service and rendered upload tests cover the two CSV adapters alongside the existing imports. These changes affect only the Imports settings route and server modules, not a landing surface or app shell, so the landing render-budget trigger does not apply.


## Kodi

Choose **Kodi** on Imports. Switch Kodi's settings level to Advanced, then open Settings → Media → Library → Export library → Single file. Upload `videodb.xml` from the `kodi_videodb_YYYY-MM-DD/` folder, alone or in a ZIP containing exactly one such file. Artwork is unnecessary; separate `.nfo` exports are not supported. Kodi ZIPs allow up to 50,000 directory entries and inflate only `videodb.xml`; artwork is skipped. All entry paths and structural bounds are still checked. The XML retains the shared 32 MB per-entry and 64 MB total expansion limits and CRC verification. The 20 MB upload limit still applies; oversized-upload errors advise uploading `videodb.xml` by itself. Other import sources retain their 200-entry archive limit.

Movie and show ratings use `userrating` 1–10 unchanged; 0 is unset. Episode ratings and music videos remain visible as unsupported items. Movie/show matches use TMDB then IMDb, including recognizable legacy IMDb `<id>` values, with no title-only match. Missing IDs remain unmatched. A positive movie/episode `playcount` creates one watch, with `lastplayed` at day precision; higher counts do not invent rewatches. Show play counts, partial plays, resume positions and library dates are ignored. Missing or invalid dates produce undated watches; invalid supplied dates are explained in preview warnings. The existing explicit date choice can discard all source dates. Clusters of 100 or more watches on one day produce a warning.

Repeated movie versions with the same source identity collapse to one rating and one watch, retaining the latest valid viewing date. IMDb-only movie versions use a TMDB identity when another movie entry establishes an unambiguous IMDb-to-TMDB pair; conflicting pairs are not guessed. The first supplied rating wins if versions disagree. Source identities exclude dates and archive paths, so repeated uploads and date edits use the same watch identity.

Episode rows carry the parent's title IDs, their own TMDB and TVDB episode IDs, name, season and number. Numbering is `unknown`: Kodi supports different scrapers and user-selected episode orders, so coordinates alone do not establish TMDB numbering. The shared resolver matches episode IDs and returns canonical coordinates; the adapter contains no matching logic. TVDB-only show identities without a TMDB/IMDb parent remain unmatched.

The XML reader uses Saxes, rejects all DTDs (including external entity declarations), does not fetch external resources, and rejects malformed XML. It enforces the existing 20 MB upload and 50,000 row/observation limits, plus a 64-element nesting limit and one million XML elements. Only importer fields are retained in memory; actor, artwork and file metadata subtrees are discarded while parsing, and all elements still count toward the complexity limits. A synthetic actor-heavy export is tested in a subprocess with a 64 MB JavaScript heap. ZIP structural checks and selected-file integrity/expansion checks are shared with the other sources. No migration is needed. Kodi's current Imports controls use the existing layout; no landing surface or app-shell assets changed.

Fixtures are synthetic from the Kodi source research for #612/#628. Parser, rendered upload controls, and service preview/apply/receipt/re-upload/undo tests cover Kodi, including both watch-date choices and canonical episode resolution. Validation against real Kodi 21/22 exports remains deferred until a member export is available; no live CrateDB or browser session was used by these tests.
