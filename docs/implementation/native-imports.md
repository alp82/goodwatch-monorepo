# Native and CSV imports

The Imports settings page accepts native Letterboxd and Trakt ZIP exports alongside generic CSV, MovieLens ratings/wishlist CSV, Kodi library XML/ZIP, MyAnimeList/Kitsu anime XML/gzip and the existing IMDb ratings CSV flow. The new routes live at `/api/imports`; the IMDb routes remain at `/api/imdb-import` and reject imports belonging to another source.

Anime entry offsets and crosswalk lookup are available to server adapters through the shared resolver. See [anime episode placement](anime-episode-mapping.md) for the observation contract, Anime-Lists/Fribb attribution, snapshot refresh and rollout. MyAnimeList and Kitsu XML share the `myanimelist` adapter; AniList remains a separate build.

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

## Import and Undo result

After an import finishes, and again after its Undo, the Imports page shows what changed per title (#664): a success message with a one-line summary, then one list per kind of change. After an import: ratings added, ratings replaced (old and new value), reviews, watches with their days or "Date unknown" and the show status they set, show statuses, Want to See, favorites, what was taken off a list, what was kept, and the rows not imported or not saved, with their reasons. After Undo: what Undo could not put back comes first, with buttons that add the title to Want to See or Not interested again (now, without the original date) where the member doesn't already have it there; then ratings removed and put back, reviews, watches removed, show statuses put back, Want to See and favorites removed, lists put back, and what was left as the member changed it. Every source uses this screen, IMDb included.

`GET /api/imports/:id/items?by=title` and `GET /api/imdb-import/:id/items?by=title` serve it (`ImportResult` in `app/domain/import-result.ts`) with the first 25 titles of each section; `&section=…&offset=…&limit=…` serves the rest. Native imports read the journal in each row's payload and each title's watch plan; IMDb imports read `prior_score`, `applied_score` and `undo_outcome`. Titles, years and posters come from the catalog, only for the titles on the page. A finished or undone import's result is mapped once and kept in the process for five minutes (ten imports at most), so paging through a long section doesn't read every row again.

- Importing Want to See records the Not interested choice it clears in the row's journal (`cleared`), before deleting it. Undo does not put it back; the result lists it.
- Undo records per row what it did in `undo_outcome`: `reverted`; `left` where the member changed or removed the rating, review, list entry or show status after the import; or `not_restored` where Undo can't put the earlier value back (a journal without the earlier rating's dates). Before each write Undo marks the row `reverting`. A resumed Undo skips rows with an outcome, and reads a row already as before the import as its own work only when it carries the marker; without it, the member made that change. Watch plans record theirs on the title's `state` row. IMDb Undo checks each rating before writing and keeps outcomes an earlier run recorded. Imports undone before this change have no outcome; their rows count as reverted.

Apply the additive [migration](imports/import-undo-outcome.sql) (`ALTER TABLE doc.user_import_item ADD COLUMN undo_outcome TEXT`) before deploying: Undo writes the column and the import routes read it, so without it they answer "Importing isn't available yet".

## Show status observations

Issue #645 adds `kind: "show_status"` with `showStatus: "watching" | "on_hold" | "dropped" | "plan_to_watch" | "completed"`. The MyAnimeList/Kitsu adapter emits this kind. Adapters can submit a `ParsedImport` through `previewParsedImport(userId, fileName, parsed, fileHash?)`; uploads delegate to the same boundary after parsing and hashing their original bytes. All observations still pass through catalog matching, preview, selection, the durable receipt, resume and undo.

- Watching, On hold and Dropped can arrive without any watches. Only Not started or Watching may change; On hold, Dropped and Seen already in GoodWatch are kept, even with “Use the export instead”. A state version changed after preview is also kept. Identical statuses for a matched TMDB show collapse to one applicable change; the other rows remain on the receipt. Different statuses (including Completed) are invalid with a reason naming them.
- Plan to watch remains a selectable show status observation and writes Want to See through the existing list journal, only when the show has not started and has no watches. It does not create a tracking state or a watch.
- Completed requires `completionScope: "show"`, meaning the adapter has established completion of the **whole matched TMDB show**. `"part"` and missing scope are unsupported and remain visible in the receipt. Episode/season coordinates on a status are unsupported. An anime cour or part must never claim whole-show scope merely because its title matches a show.
- Whole-show completion uses the machine’s import transitions (rows 38–39): mark missing aired regular episodes in the current pass, with unknown dates and import ownership. Specials and unaired episodes are excluded. There is no standing Seen press; the import's Undo owns these watches. It stays Watching when a started regular season still has unaired episodes; otherwise it becomes Seen. A wholly future season does not count as still airing. Completion scope does not change the ordinary episode-watch state rules.
- A source status follows any selected watches in the same per-show journal. Seen produced by those watches is protected too; the source status is kept. Statuses that start Watching, put On hold, Drop or complete a show clear the observed Want to See and Not interested entries. Dropped uses the existing state, so recommendation exclusion remains the existing rule and is not a taste signal. For status-only plans, Undo restores the cleared intentions and their original timestamps when restoring the earlier state. Existing later intentions are kept. Plans that add watches retain the watch-import limitation: Undo does not restore cleared intentions; preview and Undo explain this.
- Undo restores the previous status, including Watching without watches, while leaving later member edits alone. The journal lives in the existing payload column: no schema migration. A source-only move to Watching stores `state_changed_at = 0` as “no dated member move”; both activity readers ignore that sentinel. `updated_at` retains the real write timestamp for undo ownership. Watches keep their source dates and imports never manufacture recent activity.

This extends the earlier import-status restriction in ADR 0009 and tracking model section 7, which required an absent state and a watch for On hold. The ticket explicitly permits statuses without watches; `CONTEXT.md` permits imports to change Not started and Watching. Interactive member actions keep their existing guards. The consistency query still detects Watching without regular watches, exempting only the zero-timestamp Watching state supplied by an import. A member’s first tick replaces zero with a real activity date. Resume without any watches follows row 21 back to Not started.

## Shared episode resolver

`app/server/imports/episode-resolver.server.ts` resolves evidence within an already matched show. `episode-resolver-data.server.ts` connects it to the existing import database helpers and TMDB; `preview.server.ts` uses it for every episode observation. Trakt keeps TMDB IDs first and retains canonical positions for successful ID matches. A stale ID can now fall through to the remaining evidence. Kodi also supplies episode evidence to this resolver.

Evidence order:

1. **TMDB episode ID:** exactly one live catalog episode of the matched show.
2. **TVDB episode ID:** read the catalog cache and revalidate through TMDB `find` with `external_source=tvdb_id` once per distinct ID per preview. Only `tv_episode_results` counts; the returned show and live catalog episode must match. Fresh evidence wins over stale cached identities. If TMDB is unavailable, a unique cached match remains usable; an ambiguous cache or an explicit negative TMDB response does not establish a match. **TV Time exception (owner decision, 2026-10-19):** read requested episode and show TVDB identities together from Crate before any TMDB call and trust stored positive identities without revalidation. Missing identities alone use TMDB; this lets successive previews spend their budget on new episodes. Duplicate identities remain unmatched and removed episodes are excluded. Other sources retain the revalidation policy above.
3. **Anime entry:** validated Anime-Lists placement after the Fribb identity crosswalk. The full reported progress and known total must fit the current catalog; failure stays unmatched without guessing coordinates. See [anime episode placement](anime-episode-mapping.md).
4. **Episode group:** `episodeGroup` carries an optional explicit group `id`, a required part/volume `label`, and optional source `groupCount`. The group must be listed for this show. Without an ID, only Netflix digital groups or Part/Volume groups with the supplied part count qualify. Labels match group names exactly, ignoring case and surrounding whitespace. Source episode numbers are one-based positions in the group's zero-based episode order.
5. **Season and episode:** only with `episodeNumbering: "tmdb"` (the Trakt adapter supplies this). Rows without an episode number may match an exact, case-insensitive catalog name within the show, selected group, or trusted season. An untrusted source season never filters a show-wide name lookup.

The first unique match wins. Failed TMDB IDs fall through to TVDB IDs, then anime placement when supplied, otherwise groups; trusted coordinates or a numberless name are considered only without anime entry evidence. Group candidates are deduplicated by TMDB episode ID, so two complete groups agreeing on one episode are not ambiguous. Receipts name failed evidence. Specials retain their canonical IDs, carry `episodeSpecial: true`, and produce a row explanation and preview warning; duplicate-watch explanations append to that reason. Regular episodes omit the flag. The normal tracking writer still applies special matches.

Group validation checks the entire alternative cut: declared counts, dense group and episode positions, unique live episode IDs, and complete regular-season coverage through the latest catalog season. A cut containing specials may replace leading regular seasons, as Money Heist's Netflix Parts 1 and 2 do; all regular seasons from its first represented regular season onward must be complete. Specials absent from a cut are not required. This validates structure, not the editorial correspondence of community cuts, and does not change the reviewed display presentations in ADR 0012.

Legacy episode lookup adapters memoize catalog reads and TMDB requests per preview, including lookup failures. TV Time's bounded transport caches successful responses and evicts failures. TMDB responses are schema-checked and use the existing timeout helper (`TMDB_TIMEOUT_MS`, five seconds by default). HTTP errors, malformed responses and timeouts permit cached matches or later evidence; without a match, the receipt explains the lookup failure. TV Time now supplies a shared bounded TVDB transport: four concurrent requests, a 30-second/2,000-attempt preview budget, at most three attempts per lookup and shared HTTP 429 cooldown with Retry-After seconds/date support (500 ms then 1,000 ms fallback). Successful TV Time evidence is cached per preview; failed requests are evicted. Budget exhaustion produces `tvtime_lookup_budget_exhausted` receipt rows; outages use `tvtime_lookup_unavailable`. Both parent and episode phases preserve these codes and the same corresponding text. The remote budget begins after the batched catalog identity read. Stored show IDs use the nullable `show.tvdb_id` column; deploy the schema initializer before exposing TV Time (see its handover). Other adapters retain their existing request behavior; Simkl must opt into an appropriate bounded transport before high-volume enablement. See [TV Time limits and review corrections](imports/tvtime.md#independent-review-corrections). Catalog-read errors stop preview. Cache writes stay in preview but are best effort: errors are logged and the settled match is returned. Writes go only through `store.server.ts` helpers. A compare-and-set update checks the previously read TVDB ID and the live-episode guard; only a one-row update permits clearing that TVDB ID from other episodes of the show and changing the in-memory cache. Thus fresh evidence can repair old mappings without overwriting a concurrent edit. No change is made to the in-memory cache on a zero-row update or failed write. A catalog read reaching the 50,001-row sentinel is rejected rather than used to infer uniqueness.

Tests use synthetic episode IDs with Friends, The Office and Money Heist numbering/count examples from [the episode-numbering research note on its origin branch](https://github.com/alp82/goodwatch-monorepo/blob/research/episode-numbering/docs/research/imports/episode-numbering.md). Database and TMDB boundaries are faked locally. Anime placement tests additionally cover Frieren, Spy x Family, Attack on Titan, Bleach and One Piece. Translated-name lookups and new source parsers remain separate work.

## Imports page and file recognition

`/settings/imports` (#649) has one upload box on top and a searchable list of every live source below it, most common first (`app/ui/imports/ImportSources.ts`). A row opens in place with that source's own flow: its steps, its upload box, and its history. A row shows "Imported <date>" after a finished import. `?source=<id>` opens a row, so the IMDb entry links to `?source=imdb`. Sources whose import isn't built are not listed; TV Time members are pointed to Trakt.

`recognizeImportFile` (`app/ui/imports/ImportFileRecognition.ts`) reads a file in the browser without uploading it: a ZIP's file names, a CSV header, or an XML root, after gunzip for gzip. Each rule mirrors what that source's import accepts, so the one box only routes a file to an import that can read it. A file that matches no rule stays unrecognized and is never sent. The one box hands a recognized file to its source's upload panel, which sends it. A source's own box holds back a file recognized as another source's and offers **Import it as …**. A MovieLens file waits in the MovieLens panel for its partner file.

When a new source's import ships, add its entry to `ImportSources.ts` and its rule to `ImportFileRecognition.ts`, with a test built from the header or file names its adapter reads.

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
node --test app/server/imports/*.test.ts app/server/tracking.test.ts app/server/imdb-import/*.test.ts app/ui/imports/*.test.ts
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

Status preview reads state versions and watched-title presence in batches of 800 shows. Status-only previews do not read episode catalogs; mixed watch/status rows reuse the watch plans. A re-import can replace a resumed Watching show with Dropped again; that show’s preview and receipt explicitly explain this.

## TMDB Connect

Issue [#619](https://github.com/alp82/goodwatch-monorepo/issues/619) adds a one-time v3 connection on the existing Imports page. The [owner decision of 2026-10-15, “Decisions so far” in map #365](https://github.com/alp82/goodwatch-monorepo/issues/365#user-content-decisions-so-far) settles that these imported ratings are the member's own data and ship. The owner’s key-only sign-in decision supersedes the v4 flow in [the earlier research for #609](https://github.com/alp82/goodwatch-monorepo/blob/research/tmdb-connect/docs/research/imports/tmdb-connect.md).

The member chooses TMDB → Connect TMDB, approves on themoviedb.org, then chooses Preview TMDB import on returning. The return loader reads the owned import directly, since previews are absent from import history. The existing selection, conflict policy, confirm, receipt, skipped CSV and undo follow. Movie and show ratings round half steps up (7.5 → 8, 0.5 → 1). TMDB v3 returns a flat `rating` score and no rating timestamp, so imported ratings stay undated; the preview explains this. The score writer retains its own GoodWatch mutation timestamps for ownership and undo. Release dates never become rating or watch dates. Watchlists become Want to See; favorites become favorites, both without source dates. Episode ratings, custom lists and ongoing sync are excluded.

`previewFetchedImport(member, displayName, observations)` accepts the `ParsedImport` returned by a fetch adapter. File adapters and fetched sources enter the same `createParsedPreview`; connections fabricate neither files nor archives. The shared 50,000-observation limit, catalog-ID matching, classification, journal and later operations apply. `IMPORT_SOURCE_UPLOAD` supplies each file source’s extensions, accept value, upload instructions and receipt credits; its null TMDB descriptor distinguishes connections from file sources. Missing catalog titles remain unapplied.

The client reads all six v3 lists sequentially, with at least 30 ms between pages. A shortfall or changing count warns and retains the data read; duplicate IDs and unexpected page numbers still fail. Page estimates (`total_pages * 20`) and reported totals cannot exceed 50,000. Each request uses `TMDB_TIMEOUT_MS` (five seconds by default), with a five-minute account-read budget. HTTP 429 honors `Retry-After` (seconds or HTTP date), with exponential fallback and at most three retries per request. Waits over 30 seconds defer cleanup instead of holding an interactive request. The panel includes the [required notice and approved TMDB logo](https://developer.themoviedb.org/docs/faq#what-are-the-attribution-requirements); `public/tmdb-logo.svg` is an unchanged copy of TMDB's blue short logo from its [branding page](https://www.themoviedb.org/about/logos-attribution).

### Credential lifecycle

Only `TMDB_API_KEY` authenticates the application. The [v3 sign-in flow](https://developer.themoviedb.org/reference/authentication-how-do-i-generate-a-session-id) creates a request token with `GET /3/authentication/token/new`, redirects to `/authenticate/{request_token}?redirect_to=...`, and exchanges the approved token with `POST /3/authentication/session/new`. The session ID is persisted before `GET /3/account` resolves the numeric account ID, so account-lookup failures still revoke the session. Account lists use `/3/account/{id}/{rated,watchlist,favorite}/{movies,tv}` with `api_key` and `session_id` query parameters. [Session deletion](https://developer.themoviedb.org/reference/authentication-delete-session) uses `DELETE /3/authentication/session` with a JSON `session_id`. No application bearer token is read. The session grants read and write access, but this adapter performs only reads and session deletion, never rating/list writes. A deletion response of HTTP 404 / TMDB code 34 counts as already revoked only after read-only checks confirm that the API key works (`/3/authentication`) and that `/3/account` rejects the session with HTTP 401 / TMDB code 3. Other errors and invalid application credentials remain failures.

Only a random flow ID goes into GoodWatch's callback URL and HttpOnly/SameSite cookie. The panel forwards a `denied=true` callback as a hidden form field; closing a denied connection removes its row without minting a session. Start, return and abandon require a signed-in member, POST and exact `APP_ORIGIN`; return/abandon also require the originating browser cookie and member. Responses use private/no-store and no-referrer. The short-lived request token necessarily appears in TMDB's approval URL; the session ID never enters browser responses, journal rows, logs or error messages.

**Phishing limitation:** TMDB's approval link is transferable. An attacker can start a connection on their own GoodWatch account and send that TMDB approval link to someone else, then use their original cookie to import the approving person's data into the attacker's account. Our member/cookie binding prevents callback theft but cannot prove that the approving TMDB account belongs to the GoodWatch member who started the flow. Members should only approve links they opened themselves from GoodWatch's Imports page, never forwarded approval links. The panel reminds them of this. No claim of account-identity verification is made.

The separate `user_import_connection` table holds AES-256-GCM credentials under **`TMDB_CONNECT_KEY`**, a dedicated 32-byte random key encoded as 64 hex characters. Payloads start with `v1:<16-hex-key-id>:` (the ID is a truncated SHA-256 of the key); the random connection ID is authenticated as associated data. `TMDB_CONNECT_PREVIOUS_KEY` optionally decrypts rows written with the prior key; only the current key encrypts writes. The existing encrypted `accessToken` payload field holds the v3 session ID; table columns and payload fields are unchanged. No key is derived from the TMDB application credential. Encryption happens before database calls, whose parameter logging therefore sees no plaintext credential.

Three database slots per member, keyed by `(user_id, slot)`, reserve capacity before any TMDB request, including simultaneous starts on different processes. Pending approvals, active imports and paused cleanup all occupy slots. Failed starts release their reservation. A ten-minute compare-and-set lease prevents duplicate exchange/read/cleanup work. Credentials are persisted before reading lists. Access is revoked and the row removed **before preview creation**, including cancel, read failure and handled credential-storage failure. Preview/apply failure or abandonment consequently has no usable session. An expired return revokes access and shows “Connection expired, start again.”

Cleanup runs at startup and every minute on page/both processes. It recovers pending approvals after ten minutes and interrupted work after lease expiry; it never imports data. Cancel before approval, without `denied=true`, retains cleanup until TMDB's sixty-minute request-token expiry plus five minutes of clock margin, catching late approvals; expired request tokens without a session are then removed. A return or cancel carrying `denied=true` removes its row immediately, without exchanging the request token or waiting for late approval. The store refuses this path once a session is stored. Missing configuration prevents new starts and leaves rows waiting until a configured process restarts.

Failed remote deletion retains encrypted credentials. After eight failed cleanup attempts, `cleanup_at` becomes NULL and retries stop; an unreadable row or persistence failure is paused immediately. Each row is isolated so another member's cleanup continues. The error-level alert **“TMDB Connect cleanup paused; operator action required.”** logs only the connection ID. Configure log monitoring for that message and for a nonzero paused-row count. Automatic retries are bounded; paused credentials require operator recovery, not deletion of the row. A live session may remain while the provider is unavailable. An abrupt process kill or lost exchange response between TMDB issuing a session and the database saving it remains a provider-boundary limitation.

### Rollout and development check

1. **Create the table before deploying.** Review `f/sync/init/cratedb` with `dry_run=true` (it proposes all pending schema differences), then apply only the intended change, or execute [tmdb-connect-schema.sql](imports/tmdb-connect-schema.sql) directly against the target development/production database. Verify six columns (`id`, `user_id`, `slot`, `payload`, `cleanup_at`, `lease_until`), primary key `(user_id, slot)`, nullable `cleanup_at`, and an initial count of zero. This touches no existing journal/tracking table. An earlier five-column draft table is incompatible: `CREATE IF NOT EXISTS` does not upgrade it. If one exists, first drain it with the earlier cleanup-capable build and its original application token, then recreate the empty draft table with the final DDL before deploying. Never drop a table containing cleanup credentials.
2. **Set secrets on every page/both process.** Generate an independent key securely with `openssl rand -hex 32` and store its 64-character result in the secret manager as `TMDB_CONNECT_KEY`; do not commit or log it. All instances must use the same key. Leave `TMDB_CONNECT_PREVIOUS_KEY` empty on first rollout. Set `TMDB_API_KEY` to the v3 API key. `TMDB_API_TOKEN` can be removed after this build is deployed. When upgrading from v4, first drain any pending v4 connection rows with the old build and its original application credential; v3 cleanup cannot revoke v4 access tokens. Do not discard pending credentials. Set `APP_ORIGIN` to the exact browser origin (no trailing slash); aliases such as `www` do not pass the origin check. Retain the normal database/auth environment. Missing keys return 503 without contacting TMDB and disable the cleanup loop.
3. **Deploy/restart the page processes after the schema and environment are ready.** The cleanup loop starts automatically. For local testing in `goodwatch-webapp`, use `npm ci` and `npm run dev -- --host 127.0.0.1 --port 3000` with `APP_ORIGIN=http://localhost:3000` and the development database/auth configuration. Real TMDB credentials must stay in the local secret environment.
4. **Owner smoke check:** Sign in, open `/settings/imports?source=tmdb`, connect an account you control, approve, and choose Preview TMDB import within ten minutes. The preview must open directly. Check the rounding/count warnings, select the kinds, confirm, inspect the receipt/skipped rows and Undo. Separately deny approval, cancel before/after approval, and approve then close the browser; verify a denied return/cancel clears its row immediately; other cleanup normally completes within ten minutes plus the next tick, up to sixty-five minutes for unapproved requests. Return after ten minutes and verify the expiry message. Verify actual remote deletion too: in a secure local test harness, retry a read with the just-deleted session ID and require rejection, keeping that session ID only in memory and out of logs. This real-provider check is pending; synthetic tests do not prove TMDB's production session behavior.
5. **Monitor without reading credentials:** `SELECT id, cleanup_at, lease_until FROM doc.user_import_connection` and `SELECT count(*) FROM doc.user_import_connection WHERE cleanup_at IS NULL`. Alert on paused rows and the fixed cleanup-alert message. Resolve the provider/key/storage fault before manually scheduling a paused row with `UPDATE doc.user_import_connection SET cleanup_at = CURRENT_TIMESTAMP, lease_until = CURRENT_TIMESTAMP WHERE id = '<alerted-id>' AND cleanup_at IS NULL`, then `REFRESH TABLE doc.user_import_connection`. Only do this after any live worker's lease has expired. The next attempt either deletes the token and row or pauses/alerts again; it never starts another unlimited retry loop. If deletion cannot be restored, arrange revocation with TMDB before removing local credentials.
6. **Key rotation:** Keep both keys available throughout any rolling deployment. First distribute the new key in `TMDB_CONNECT_PREVIOUS_KEY` while all writers still use the old `TMDB_CONNECT_KEY`. After every process can decrypt both, switch `TMDB_CONNECT_KEY` to the new key and `TMDB_CONNECT_PREVIOUS_KEY` to the old key everywhere. New payloads use the new ID; old rows remain readable. Keep the previous key until the connection table is empty (including paused rows), then remove it. A lost key cannot be recovered from its ID; restore it from the secret manager before requeuing affected rows.
7. **Rollback:** Drain active/paused connections with a cleanup-capable process and both needed keys before removing this code. Keep the table and keys available while any row remains. Neither reverting the UI nor removing environment variables revokes remote access.

Validation runs at the TMDB HTTP boundary, server endpoints, settings loader, shared import service and rendered controls, using synthetic data. Every connect scenario uses the real encrypted store over `ConnectDb`, including return/abandon races, slot reservations, lease expiry, key rotation and cleanup failure. No live TMDB request, real-account write, live schema migration or browser approval was exercised during implementation. The required regression command includes these tests. No landing-page script, stylesheet, font or image changed; the server entry starts only the cleanup timer, so the landing asset-budget trigger does not apply.

## MyAnimeList and Kitsu

Built for #647 from the synthetic shapes in `docs/research/imports/anime-tracker-exports.md`
on `research/anime-tracker-exports` (#614). Select **MyAnimeList / Kitsu** on the
existing Imports page. MyAnimeList: sign in at
<https://myanimelist.net/panel.php?go=export>, select **Export my: Anime List**, then
**Export My List**. Upload the original `animelist_*.xml.gz` (or `.gz`) or its plain
`.xml`. For Kitsu, try **Settings → Export → Download Anime Library** and upload
`kitsu-<slug>-anime.xml`; availability depends on Kitsu's member feature flag.
No credentials, API access, scripts or conversion are needed.

The adapter sets MAL identity, progress, known episode total, completion and date
evidence on every observation. Kitsu's omitted title/type is accepted, with a
`MyAnimeList #id` label when the file has no title. Kitsu XML already contains MAL
ids and integer scores; no second score conversion is applied. Parent matching
and episode placement use the shared pinned crosswalk and resolver. Movies and
unsupported media types remain visible as unsupported; the current crosswalk only
provides TMDB shows. Missing or ambiguous mappings remain unmatched.

- `my_score` 1–10 is retained as a score for that entry/cour, never as a show
  rating; 0 is unset and malformed scores are invalid. Per the owner decision of
  2026-10-16, each score remains an unsupported observation in the existing
  `doc.user_import_item.payload` journal, the same durable container used for
  unapplied Trakt season/episode ratings. The payload retains `score`,
  `animeEntry.source`/`id`, the TMDB show, and `animeScorePlacement`: the pinned
  snapshot mapping plus resolved season/first-episode/last-episode ranges for the
  **full entry**, independent of watched progress. Missing totals or unavailable,
  ambiguous or incompatible mappings retain the evidence and a reason with null
  ranges; no range is guessed. Apply and Undo keep this receipt evidence. Scores
  never enter `user_score` or mark a show Seen. The receipt says season scores are
  kept for later and not applied. **DDL: none**; the existing payload is durable.
- Watching, On-Hold (including Kitsu's On Hold), Dropped and Plan to Watch use the
  existing show-status kind, selection, conflict and protection rules. Identical
  statuses collapse to one change; differing statuses are invalid with a reason
  naming them, including Completed. Completed carries `part`
  scope and remains unsupported as a status: only its reported episode watches
  may make the show Seen. It never fills the rest of a TMDB show.
- Progress N emits exactly N observations, numbered 1…N within the tracker entry,
  with stable MAL-id/episode/pass keys. Rewatch counts create no additional watches.
  The resolver establishes dates only for a completed entry whose progress equals
  its known total and whose full start and finish dates are the same valid day.
  Other progress is “don't know when”; no interpolation or endpoint guesses.
  Kitsu is recognized by `kitsu-*-anime.xml[.gz]` or absent MAL identity and titles;
  all Kitsu episode watches are undated because its dates can be completion click
  times. A cluster of 100 or more entries sharing a start/finish day warns about
  migration or click dates. The member's “without dates” choice also discards
  MyAnimeList single-day evidence.
- Comments and tags are not retained or imported, and receipt notes say so.
  The receipt visibly links **Anime-Lists** for episode mapping and **Fribb** for
  tracker identities. Their server-side use was approved on 2026-10-15.

The shared `boundedXml()` used by Kodi and MyAnimeList enforces `MAX_XML_DEPTH`
and `MAX_XML_ELEMENTS`; Saxes rejects DTDs/entities and malformed XML. The adapter
rejects manga (`user_export_type` 2 or manga
entries), duplicate entry ids and duplicate supported fields. Parsing retains only
one entry's supported fields at a time; metadata is ignored. Limits are 20 MB
uploaded, 32 MB expanded gzip, 50,000 entries/observations, 64 nested elements and
one million total elements. Gzip integrity is checked by the bounded decoder.

Tests exercise public parsing, the real import service and tracking writer with
fake database boundaries, and rendered upload/receipt controls. Preview, apply,
repeat receipts, identical/conflicting statuses, retained season scores and their
pinned placement, date selection, completed cours and Undo
are covered. Real member exports, browser interaction and live Crate verification
remain untested. No schema or landing-surface changes are required.

## Connect Plex (#643)

Choose **Plex** on Imports, sign in with Plex, then return to preview. Optionally paste the **personal** Watchlist RSS URL generated in Plex Settings → Watchlist (Plex Pass required). GoodWatch discovers owned servers; it does not ask for a password, API key, or server database. The existing fetched-source service handles preview, kind/date selection, apply, receipts, repeat imports and undo.

Only documented routes are used:

- [Plex Media Server API](https://developer.plex.tv/pms/), “Authenticating with Plex”: `POST https://plex.tv/api/v2/pins?strong=true`, the `https://app.plex.tv/auth#?...` forwarding sign-in, `GET https://plex.tv/api/v2/pins/{id}`.
- The same documentation, “Talking to PMS”: `GET https://clients.plex.tv/api/v2/resources?includeHttps=1&includeRelay=1`. Only resources marked owned and providing a server qualify. Public direct connections are tried before relay. `/identity` must match the advertised machine identifier before sending the server token.
- On that server: `/status/sessions/history/all?accountID=1&sort=viewedAt:asc`, paged with Plex container headers, and `/library/metadata/{ratingKey}?skipRefresh=1&includeGuids=1` for item and parent-show GUIDs. Only owned servers qualify, so account `1` is the owner’s local history identity, as [Plex staff explain](https://forums.plex.tv/t/api-users-play-history/796964/2); it is not the Plex account’s numeric ID. Rows for other accounts are discarded even if the server ignores the filter. One stable `plex:watch:<machineIdentifier>:<historyKey>` observation per play preserves exact epoch-second dates, including repeated plays at the same time. Deleted or unavailable metadata and malformed history rows stay unmatched on the receipt without dropping good plays or the watchlist. Modern GUID arrays and legacy IMDb/TMDB agent GUIDs are supported. History stops at the first reported total, tolerates appended plays, and rejects shrinking totals. Aggregate view counts do not create watches, and source coordinates are never assumed to be TMDB numbering. Episodes go through the shared resolver using episode TMDB/TVDB GUIDs and parent-show TMDB/IMDb GUIDs. No whole-show status is inferred.
- [Plex’s documented Watchlist RSS feature](https://support.plex.tv/articles/universal-watchlist/), restricted to HTTPS `rss.plex.tv` generated feed paths. Movie/show categories and TMDB/IMDb GUIDs become Want to See; absent identities remain unmatched. No title guessing, external metadata URLs, account-wide history, cloud ratings, or undocumented Discover/community APIs. RSS publication dates are not watch dates or known intention dates. The receipt explicitly says the feed may omit part of the watchlist; no undocumented fallback attempts to fill it.

**Reachability and network isolation.** GoodWatch’s server must reach the Plex server. Every discovered connection and feed request uses a dedicated HTTPS transport with normal certificate verification, no proxy/global fetch dispatcher and no redirects. It rejects non-public IPv4, non-global IPv6, mapped/transition addresses, and the process’s own interface addresses. A per-request DNS Resolver (2-second query timeout, two tries, canceled at the 10-second DNS deadline) avoids libuv worker-pool lookups. All A/AAAA answers must qualify; the selected address is pinned into the actual socket lookup, and each request validates again. Identity/metadata keys cannot introduce arbitrary paths or destinations. Network requests have ten-second DNS and request deadlines and a 5 MiB response cap; the import has a five-minute read deadline and 50,000-item limit. Invalid paging is rejected. An unreachable server produces an actionable preview/receipt warning mentioning public HTTPS Remote Access; the RSS feed can still be imported. If a history page becomes unreachable, that server’s partial rows are discarded and the receipt says no history from that server was imported. Feed failure also has an explicit receipt warning. RSS uses the shared bounded XML parser (no DTD/entities, 64 levels, one million elements), and exceeding 50,000 feed items is reported explicitly.

**Credentials.** Plex uses the existing `doc.user_import_connection` AES-GCM store and `TMDB_CONNECT_KEY`/`TMDB_CONNECT_PREVIOUS_KEY` rotation settings. An encrypted source discriminator keeps Plex and TMDB claims and cleanup separate; old rows without it remain TMDB. Member, browser cookie, origin, expiry and atomic lease checks protect return/cancel. PIN IDs are encrypted before database writes; issued account and server tokens exist only in memory. An encrypted boolean consumption marker blocks replays after the lease expires. The PIN is wiped and the connection removed before preview, on cancellation and on failed reads. A page-process cleanup loop wipes then removes expired or interrupted Plex connections without a browser, isolates failed rows, retries failed deletions and pauses undecryptable rows with a credential-free operator alert. It also wipes legacy encrypted account tokens during cleanup. Failures return fixed messages and never log provider bodies, URLs or tokens. The feed URL is neither journaled nor logged. Discarding the token is not remote revocation: Plex can still list GoodWatch in Authorized Devices, where the member can remove it. No undocumented token-revocation route is used.

**Production steps.** No new table, column, package, API registration or environment variable. The existing Connect TMDB connection table migration and encryption key must already be available on every page process; preserve the previous key during rotation. Deploy the reviewed webapp normally. No production command was run for this build. With a consenting test member, verify PIN forwarding, owned-server account filtering, direct/relay reachability, a real generated RSS sample, preview/apply/re-import/undo, and abandoned-connection cleanup before broad rollout.

**Validation limits.** Tests use synthetic provider responses and fake database/network boundaries, including private DNS/literals, mixed DNS answers, DNS rebinding, pinned socket lookup and redirect rejection. They exercise the real encryption store, endpoint flow and shared import service. No signed-in Plex account, live server, live feed or production database was used. Plex Pass and feed coverage are provider limitations. Ratings, friends’/shared-server history, managed-user switching, TVDB-only watchlist identity, and cloud-wide history are outside this ticket; unmatched rows stay visible. Public plain-HTTP-only servers are intentionally refused to keep tokens off unencrypted connections.

Build validation against `origin/main` at `c1d23766`: `npm ci` in `goodwatch-webapp`; `node --test app/server/imports/*.test.ts app/server/tracking.test.ts app/server/imdb-import/*.test.ts app/ui/imports/*.test.ts app/domain/tracking/*.test.ts` reports 477 passed, zero failed, one pre-existing movie-state TODO. Biome passes all 21 changed TypeScript/TSX files. `npm run typecheck` reports the same 174 diagnostics as that main baseline (compared by file, diagnostic code/message and multiplicity, ignoring shifted line numbers); no diagnostics added.


## Unmatched item media types

Native previews persist an observation's declared `media_type` for unmatched rows too, instead of null. Reading a declared show back therefore keeps it a show. This is source evidence, not a catalog match: an unmatched row keeps null `tmdb_id`, cannot apply, and the shared-wishlist unknown-type placeholder still carries its original unknown evidence. The separate legacy IMDb importer is unchanged. TV Time's manual movie-match extension and cross-source regression coverage are recorded in [its handover](imports/tvtime.md).
