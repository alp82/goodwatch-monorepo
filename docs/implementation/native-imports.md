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

Status preview reads state versions and watched-title presence in batches of 800 shows. Status-only previews do not read episode catalogs; mixed watch/status rows reuse the watch plans. A re-import can replace a resumed Watching show with Dropped again; that show’s preview and receipt explicitly explain this.

## TMDB Connect

Issue [#619](https://github.com/alp82/goodwatch-monorepo/issues/619) adds a one-time v4 connection on the existing Imports page. The [owner decision of 2026-10-15, “Decisions so far” in map #365](https://github.com/alp82/goodwatch-monorepo/issues/365#user-content-decisions-so-far) settles that these imported ratings are the member's own data and ship. The implementation follows [the research for #609](https://github.com/alp82/goodwatch-monorepo/blob/research/tmdb-connect/docs/research/imports/tmdb-connect.md).

The member chooses TMDB → Connect TMDB, approves on themoviedb.org, then chooses Preview TMDB import on returning. The return loader reads the owned import directly, since previews are absent from import history. The existing selection, conflict policy, confirm, receipt, skipped CSV and undo follow. Movie and show ratings round half steps up (7.5 → 8, 0.5 → 1). Original rating timestamps stay in the observation/receipt; the score writer retains its own GoodWatch mutation timestamps for ownership and undo. Rating dates never become watch dates. Watchlists become Want to See; favorites become favorites, both without source dates. A cluster of 100 or more ratings on one UTC calendar day warns about possible migration dates without changing those dates. Episode ratings, custom lists and ongoing sync are excluded; no v3 session is created.

`previewFetchedImport(member, displayName, observations)` accepts the `ParsedImport` returned by a fetch adapter. File adapters and fetched sources enter the same `createParsedPreview`; connections fabricate neither files nor archives. The shared 50,000-observation limit, catalog-ID matching, classification, journal and later operations apply. `IMPORT_SOURCE_UPLOAD` supplies each file source’s extensions, accept value, upload instructions and receipt credits; its null TMDB descriptor distinguishes connections from file sources. Missing catalog titles remain unapplied.

The client reads all six v4 lists sequentially, with at least 30 ms between pages. A shortfall or changing count warns and retains the data read; duplicate IDs and unexpected page numbers still fail. Page estimates (`total_pages * 20`) and reported totals cannot exceed 50,000. Each request uses `TMDB_TIMEOUT_MS` (five seconds by default), with a five-minute account-read budget. HTTP 429 honors `Retry-After` (seconds or HTTP date), with exponential fallback and at most three retries per request. Waits over 30 seconds defer cleanup instead of holding an interactive request. The panel includes the [required notice and approved TMDB logo](https://developer.themoviedb.org/docs/faq#what-are-the-attribution-requirements); `public/tmdb-logo.svg` is an unchanged copy of TMDB's blue short logo from its [branding page](https://www.themoviedb.org/about/logos-attribution).

### Credential lifecycle

The existing `TMDB_API_TOKEN` application v4 bearer starts/exchanges the flow and authorizes [access-token deletion](https://developer.themoviedb.org/v4/reference/auth-logout). `TMDB_API_KEY` continues to serve existing v3 catalog calls. The member token grants read and write access, but this adapter performs only account-list reads and token deletion, never rating/list writes. A deletion response with [TMDB code 35 / HTTP 401 or code 37 / HTTP 404](https://developer.themoviedb.org/docs/errors) counts as already revoked only after read-only checks confirm that the application bearer works (`/3/authentication`) **and** that the member token is also invalid for its known account (`/4/account/{id}/movie/rated`). A still-readable token or missing account ID prevents this shortcut. Generic 401/404 and invalid application credentials remain failures.

Only a random flow ID goes into GoodWatch's callback URL and HttpOnly/SameSite cookie. Start, return and abandon require a signed-in member, POST and exact `APP_ORIGIN`; return/abandon also require the originating browser cookie and member. Responses use private/no-store and no-referrer. The short-lived request token necessarily appears in TMDB's approval URL; the access token never enters browser responses, journal rows, logs or error messages.

**Phishing limitation:** TMDB's v4 approval link is transferable. An attacker can start a connection on their own GoodWatch account and send that TMDB approval link to someone else, then use their original cookie to import the approving person's data into the attacker's account. Our member/cookie binding prevents callback theft but cannot prove that the approving TMDB account belongs to the GoodWatch member who started the flow. Members should only approve links they opened themselves from GoodWatch's Imports page, never forwarded approval links. The panel reminds them of this. No claim of account-identity verification is made.

The separate `user_import_connection` table holds AES-256-GCM credentials under **`TMDB_CONNECT_KEY`**, a dedicated 32-byte random key encoded as 64 hex characters. Payloads start with `v1:<16-hex-key-id>:` (the ID is a truncated SHA-256 of the key); the random connection ID is authenticated as associated data. `TMDB_CONNECT_PREVIOUS_KEY` optionally decrypts rows written with the prior key; only the current key encrypts writes. No key is derived from the TMDB application credential. Encryption happens before database calls, whose parameter logging therefore sees no plaintext credential.

Three database slots per member, keyed by `(user_id, slot)`, reserve capacity before any TMDB request, including simultaneous starts on different processes. Pending approvals, active imports and paused cleanup all occupy slots. Failed starts release their reservation. A ten-minute compare-and-set lease prevents duplicate exchange/read/cleanup work. Credentials are persisted before reading lists. Access is revoked and the row removed **before preview creation**, including cancel, read failure and handled credential-storage failure. Preview/apply failure or abandonment consequently has no usable token. An expired return revokes access and shows “Connection expired, start again.”

Cleanup runs at startup and every minute on page/both processes. It recovers pending approvals after ten minutes and interrupted work after lease expiry; it never imports data. Cancel before approval retains cleanup until TMDB's fifteen-minute request-token expiry, catching late approvals. Confirmed denied/expired requests without an access token are then removed. Missing configuration prevents new starts and leaves rows waiting until a configured process restarts.

Failed remote deletion retains encrypted credentials. After eight failed cleanup attempts, `cleanup_at` becomes NULL and retries stop; an unreadable row or persistence failure is paused immediately. Each row is isolated so another member's cleanup continues. The error-level alert **“TMDB Connect cleanup paused; operator action required.”** logs only the connection ID. Configure log monitoring for that message and for a nonzero paused-row count. Automatic retries are bounded; paused credentials require operator recovery, not deletion of the row. A live access token may remain while the provider is unavailable. An abrupt process kill or lost exchange response between TMDB issuing a token and the database saving it remains a provider-boundary limitation.

### Rollout and development check

1. **Create the table before deploying.** Review `f/sync/init/cratedb` with `dry_run=true` (it proposes all pending schema differences), then apply only the intended change, or execute [tmdb-connect-schema.sql](imports/tmdb-connect-schema.sql) directly against the target development/production database. Verify six columns (`id`, `user_id`, `slot`, `payload`, `cleanup_at`, `lease_until`), primary key `(user_id, slot)`, nullable `cleanup_at`, and an initial count of zero. This touches no existing journal/tracking table. An earlier five-column draft table is incompatible: `CREATE IF NOT EXISTS` does not upgrade it. If one exists, first drain it with the earlier cleanup-capable build and its original application token, then recreate the empty draft table with the final DDL before deploying. Never drop a table containing cleanup credentials.
2. **Set secrets on every page/both process.** Generate an independent key securely with `openssl rand -hex 32` and store its 64-character result in the secret manager as `TMDB_CONNECT_KEY`; do not commit or log it. All instances must use the same key. Leave `TMDB_CONNECT_PREVIOUS_KEY` empty on first rollout. Keep the existing `TMDB_API_TOKEN` set to the v4 read access token, not the v3 key. Set `APP_ORIGIN` to the exact browser origin (no trailing slash); aliases such as `www` do not pass the origin check. Retain the normal database/auth environment. Missing keys return 503 without contacting TMDB and disable the cleanup loop.
3. **Deploy/restart the page processes after the schema and environment are ready.** The cleanup loop starts automatically. For local testing in `goodwatch-webapp`, use `npm ci` and `npm run dev -- --host 127.0.0.1 --port 3000` with `APP_ORIGIN=http://localhost:3000` and the development database/auth configuration. Real TMDB credentials must stay in the local secret environment.
4. **Owner smoke check:** Sign in, open `/settings/imports?source=tmdb`, connect an account you control, approve, and choose Preview TMDB import within ten minutes. The preview must open directly. Check the rounding/count warnings, select the kinds, confirm, inspect the receipt/skipped rows and Undo. Separately deny approval, cancel before/after approval, and approve then close the browser; verify cleanup clears the corresponding row (normally within ten minutes plus the next tick, up to fifteen minutes for unapproved requests). Return after ten minutes and verify the expiry message. Verify actual remote deletion too: in a secure local test harness, retry a read with the just-deleted access token and require rejection, keeping that token only in memory and out of logs. This real-provider check is pending; synthetic tests do not prove TMDB's production bearer behavior.
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
