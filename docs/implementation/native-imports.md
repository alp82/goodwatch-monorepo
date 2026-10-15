# Native and CSV imports

The Imports settings page accepts native Letterboxd and Trakt ZIP exports alongside generic CSV, MovieLens ratings/wishlist CSV and the existing IMDb ratings CSV flow. The new routes live at `/api/imports`; the IMDb routes remain at `/api/imdb-import` and reject imports belonging to another source.

## Member flow

1. Choose Letterboxd or Trakt and upload the original ZIP.
2. Review the catalog matches, conflicts, unsupported rows and warnings. Preview stores an import journal but changes no ratings, watches or lists.
3. Select ratings, watches, Want to See, favorites and reviews as available. Keep GoodWatch changes is the default conflict policy. When importing watches, explicitly choose to preserve the source dates or import them without dates.
4. Confirm and follow progress. A stopped operation can resume. Its original choices stay fixed.
5. Review the receipt and download unmatched, unsupported and invalid rows. Undo reverses the import's changes where later member edits have not superseded them. Imported watches remain owned by their import even if their dates were edited, and the undo confirmation explains this.

Only an unambiguous catalog match is imported. Trakt uses external IDs; Letterboxd can use exact title and year. Ambiguous or missing titles are left out with a reason. No scraper or external API connection is involved.

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
