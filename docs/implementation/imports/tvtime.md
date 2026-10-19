# TV Time file import (#629)

Backend built against main `b15b6cbe`, following the owner's 2026-10-19 reopening decision. The map #365 is unchanged. No production writes, uploads, ticket edits or resolution comments are part of this work.

The upload API accepts `source=tvtime` through the existing multipart preview endpoint, then the ordinary kind/date selection, confirm, receipt, re-import, resume and Undo machinery. The Imports page and its Trakt advice are unchanged; a separate frontend thread will expose this adapter. The only UI-module change is the existing file-size table's required `tvtime` entry, to keep the shared source type exhaustive; it adds no recognition rule or source row. Upload descriptor strings in the domain contract are initial integration copy for that thread.

## Supported files

- Official GDPR `gdpr-data.zip`, also loose tracking CSVs. An in-memory filename allowlist opens only `tracking-prod-records-v2.csv`, `tracking-prod-records.csv`, `followed_tv_show.csv`, `user_tv_show_data.csv` and `ratings-live-votes.csv`. Nested directories, hash prefixes and punctuation/case variants of these names are accepted. Private account/authentication tables are never decompressed or parsed. Other filenames are listed in receipt warnings.
- Liberator `tv-time-export.zip`: `shows.json`, `movies.json`, `activity_history.csv`. Movie ratings use its documented doubled star scale. Episode and show ratings remain unsupported. Its computed `is_watchlisted` is never used to create wishes.
- TV Time Out `tvtime-export-<date>.zip`: `tvtime-series-<date>.json`/`.csv`, `tvtime-series-episodes-<date>.csv`, `tvtime-movies-<date>.json`/`.csv`. When JSON and CSV representations coexist, JSON is used for that media category once. TV Time Out rating values remain unsupported because its scale is unverified.
- Loose extension JSON arrays and CSVs can be renamed: content and normalized headers identify their shape. UTF-8, BOM, reordered/additional columns, CRLF and quoted fields use the existing CSV reader. Duplicate normalized headers reject the file.
- Older email-era exports and Data Extractor files are deliberately unsupported. Custom lists, favorites lists, failed-export records, summaries and emotions are reported as unread files. Only the source's explicit For later / not started / movie to-watch intentions become wishes; custom list names are never interpreted as intentions.

The original research is `docs/research/imports/tv-time-exports.md` at `b202e111` on `research/tv-time-exports`. Fixtures here are synthetic records written from its headers. No GPL fixtures or real member data were copied. Liberator's pinned first-party types and CSV writer at `a18caa46fbf8d611cc60f048c480e8981d7e6c05` were also read to check the JSON nesting and computed watchlisted behavior.

## Field mapping

| TV Time evidence | GoodWatch concept / behavior |
| --- | --- |
| `s_id`, numeric `series_id`, `tv_show_id`, series `tvdb_id`, JSON `id.tvdb` | `showTvdbId`; unique TMDB find result, then local show catalog validation |
| `ep_id` / `episode_id`, episode `tvdb_id`, JSON episode `id.tvdb` | `episodeTvdbId`; shared #630 resolver validates unique episode and matched parent, returns canonical TMDB episode and coordinates |
| Episode ID without parent (Liberator activity CSV, older v1 tracking rows) | TMDB find resolves the parent by episode identity first; never catalog title guessing |
| `s_no` / `season_number`, `ep_no` / `episode_number`, extension season/episode | Source evidence with unknown numbering; zeroed modern fields accept legacy aliases. Numbers alone cannot match an episode |
| `watch-episode-*`, `rewatch-episode-*`, v1 episode watch/rewatch | One watch per distinct play, including separate undated source events; shared timestamps for one episode collapse to one watch |
| V1 movie `watch`, `rewatch`; `uuid`, `type-uuid-n` | Movie watch evidence; event IDs retained in source keys; no extra watch from a count |
| `created_at`, `watched_at` without a time zone | Viewing day only; time of day is discarded. Distinct source timestamps still distinguish plays on that day |
| Explicit ISO time zone, `watch-date-<epoch seconds>` | Exact moment; invalid/missing dates stay unknown |
| `bulk_type` | Undated watch: the mark time is not assumed to be the viewing date |
| `rewatch_count` | Warning only; no fabricated plays or dates |
| `is_archived`, `archived`, `stopped` | Dropped, through #645's show status observations |
| `continuing`, `up_to_date` | Watching, including with zero watches as #645 permits; never blanket Completed or Seen. Imported episode watches may produce Seen |
| `is_followed` / active follow | Watching when this export also has watches for the show; otherwise Want to See. V2 show flags supersede older followed-table rows |
| `is_for_later`, `not_started_yet`, v1 movie `towatch`/`follow`, explicitly unwatched extension movies | Additive Want to See, with shared wishlist evidence and guards |
| Extension movie `imdb_id`, JSON movie `id.imdb` | Typed local IMDb match; `-1` is missing. TVDB movie IDs never become TMDB IDs |
| Official `movie_name`, `release_date`, `uuid` | Immutable source evidence for explicit movie matching; no title-only movie auto-match, even on unique exact title/year agreement |
| Liberator movie `rating` | Verified score 2/4/6/8/10; off-scale values stay invalid. Episode/show scores and TV Time Out/unidentified scales stay unsupported |
| Official `vote_key` | Unsupported observation; the live scale can no longer be verified |
| A resolved TMDB special | Watch is imported and flagged; does not count toward regular episode progress |

Watches and explicit source statuses go through the shipped writer. Imports do not overwrite member Seen, On hold or Dropped decisions. Imported activity does not become recent member activity. Wishes never remove absent titles. Existing show tracking remains authoritative. Seen titles need the existing explicit Want to rewatch choice (`conflictChoice=source`) before a wish is added; default keep leaves them alone. Watches selected in the same import take precedence over that import's wishes. Undo uses the existing journals and member-edit protections.

## Matching limits and blocker re-check

#645 covers every status needed here; #621 is no longer a blocker. `up_to_date` has no independent whole-TMDB-show completion evidence and does not set Completed.

Owner decision Q15, 2026-10-19: title-only official movie rows can now be resolved through the shipped manual matching endpoints before TV Time goes live. #374's general title-only matching work is not needed for this explicit path. Automatic exact title/year matching still does not apply to TV Time's localized movie names. An explicit member choice creates a fresh TV Time child preview; no watch, rating or wish is written until Confirm. The source snapshots retain localized title, full release date, native movie ID, stable source play key, original kind, date/precision and any supported score. Grouping uses the native movie ID, never title text. Clearing a choice restores these snapshots; separate native IDs remain separate even with identical names. The child retains unrelated watches, statuses and unsupported rows from a mixed archive. Re-importing and explicitly choosing the same target keeps existing source watches instead of duplicating them. Undo removes only what the confirmed child added, preserving earlier member watches.

A title-only movie stays unmatched until the member chooses. Search is restricted to local catalog movies and never selects a result automatically. There is no reviewed suggestion rule for localized TV Time names: the existing suggestions endpoint returns `manual` / `unsupported_source` for these groups and offers no proposal or preselection. Explicit choice provenance is recorded as `wishlistResolution.basis = member`, with the typed canonical target, catalog title/year, selection time and parent preview/row. Movies with valid extension IMDb IDs still match directly. Missing/ambiguous/unavailable TVDB parents, episodes outside the matched show, and episodes with only TVDB coordinates stay unmatched. Official vote keys remain unsupported because their scale is unverified; selecting a title does not make an unsupported rating applicable.

Limits are the existing 20 MiB upload, bounded ZIP decoding and UTF-8/CSV validation, plus 50,000 non-omitted rows and 50,000 output observations. Unwatched episode rows without ratings are omitted before the 50,000-row counter, for CSV and nested JSON alike; malformed flags and rating-bearing rows remain reviewable. A separate 500,000 raw-row ceiling bounds parsing work across the accepted files. JSON representations with duplicate CSVs are applied once. Protected ZIPs reject with local extraction guidance. No provider credentials, source account IDs, unrelated JSON properties or private CSV columns are retained.

## Copy handover

The following strings are produced by the new backend. Codes live on `ImportFileError.code` or `ImportObservation.problem.code`; codes are not inserted into the member-facing text. Generic UTF-8/CSV limit/corruption errors retain their existing wording and receive `tvtime_file_invalid` when they lack a more specific TV Time code. Uncoded failures while opening a ZIP receive the generic `tvtime_zip_unreadable` message; password/encryption detection keeps the regex on the existing error text and its specific extraction guidance.

| Code | Parser error or row reason |
| --- | --- |
| `tvtime_no_tracking` | That TV Time archive has no supported tracking data. |
| `tvtime_variants_mixed` | These files come from different TV Time export variants. Upload one export at a time. |
| `tvtime_limit` | That TV Time export has more than 50,000 rows. / That TV Time export has more than 50,000 observations. |
| `tvtime_json_invalid` | That TV Time JSON file is malformed. |
| `tvtime_json_shape` | Choose a TV Time shows or movies JSON array. |
| `tvtime_columns_duplicate` | The TV Time CSV has duplicate columns. |
| `tvtime_variant_unsupported` | This older TV Time or Data Extractor layout is not supported. Use a Trakt export if you moved your history there. |
| `tvtime_format_unknown` | The TV Time export columns are not recognized. |
| `tvtime_zip_encrypted` | This TV Time ZIP is password-protected. Extract it locally, then upload its tracking CSV files. |
| `tvtime_row_invalid` | This TV Time row is missing an identity, title or valid watched flag. |
| `tvtime_episode_identity_missing` | This TV Time episode has no TVDB episode ID. TVDB season and episode numbers alone cannot identify a TMDB episode. |
| `tvtime_status_unknown` | This TV Time show status is unknown and was not applied. |
| `tvtime_episode_rating` | TV Time episode ratings are not applied. |
| `tvtime_rating_invalid` | This value isn't on TV Time's rating scale, so it wasn't imported. |
| `tvtime_vote_scale_unknown` | TV Time official vote keys have no verified rating scale. Ratings are not applied. |
| `tvtime_movie_identity_missing` | This TV Time movie has no catalog ID. Choose a movie to match it. |
| `tvtime_movie_match_required` | Choose a movie for this TV Time entry. |
| `tvtime_movie_imdb_missing` | This TV Time movie has no IMDb ID, so it wasn't matched. |
| `tvtime_rating_scale_unknown` | This export's rating scale isn't known, so this rating wasn't imported. |
| `tvtime_show_rating_unsupported` | TV Time show ratings haven't been verified, so this rating wasn't imported. |
| `tvtime_zip_unreadable` | GoodWatch couldn't open this TV Time ZIP. Check the file and try again. |
| `tvtime_lookup_unavailable` | The TVDB lookup is unavailable or reached this preview's limit. Retry this import later. |
| `tvtime_show_unmatched` | This TV Time show could not be matched uniquely by its TVDB identity. Its episodes and status were not applied. |

New receipt warnings:

- `TV Time file not imported: <filename>.`
- `A TV Time watch date is invalid or records a bulk mark; the watch is imported without a date.`
- `TV Time plays with a shared timestamp were imported as one watch.`
- `Repeated undated TV Time records for the same item were imported as one watch.`
- `TV Time JSON and CSV contain the same export. The JSON representation is used once.`
- `TV Time rewatch counts do not add watches: only one viewing date is available.`
- `<N> unwatched TV Time episode rows were left out before counting import items.`

Existing shared copy also applies, including:

- `Seen in GoodWatch. Choose whether to add this title as Want to rewatch.`
- `Your GoodWatch show status is kept.`
- `This title could not be matched uniquely in the GoodWatch catalog.`
- `This watch is already in your GoodWatch watch log.`
- `This episode maps to a TMDB special. It is imported but does not count toward regular show progress.`
- The shared episode resolver's specific TVDB ambiguity/unavailability/current-catalog reasons, and the status writer's protected-state/replacement reasons.

Initial domain upload copy: `TV Time`; `ZIP, CSV or JSON`; `Choose a TV Time ZIP, CSV or JSON export.`; `Choose a smaller TV Time export.` The frontend owner should add its own source instructions and retain the existing Trakt migration alternative.

## Verification and private file

Validation results are recorded in the accompanying handover commit. Parser tests use synthetic headers and source shapes. Service tests exercise the real preview, matching, tracking writer, confirmation, re-import and Undo with fake database/provider boundaries, including specials, foreign episodes, multiple plays on one day, unknown-date selection and protected show statuses/rewatch choices. No schema change or new dependency is needed.

The private folder `~/goodwatch-private/tvtime/` was empty during implementation. No real-file parser run, real catalog lookup, browser run or production confirm/Undo has been performed. When a real file arrives, validate locally and report filenames, columns, counts per kind, match/unmatched counts and parse error codes only. Do not call the persisted preview service for this check: it writes journals, and the shared episode resolver can cache TVDB IDs. A real catalog check must use a read-only boundary. A password-protected or unreadable file stops that step.

Initial build checks on 2026-10-19:

- `npm ci` completed; no package or lockfile changes.
- `node --test app/server/imports/*.test.ts`: 309 passed, zero failed, including 18 new TV Time parser/service tests.
- `node --test app/server/imdb-import/*.test.ts`: 12 passed, zero failed.
- `node --test app/ui/imports/*.test.ts`: 100 passed, zero failed.
- `node --test app/server/tracking.test.ts app/domain/tracking/*.test.ts`: 263 passed, zero failed, one existing movie-state TODO (264 total).
- `npm run typecheck`: 185 existing diagnostics. An independent `git archive` of base main `b15b6cbe`, using the same installed dependencies, also reports 185. Compared by file, diagnostic code/message and multiplicity with line/column numbers removed: zero additions and zero removals. Typecheck still exits 2 because of those baseline diagnostics.
- Biome checks all eight touched TypeScript files; `git diff --check` passes.
- The private export directory remained empty at the final check; real match/unmatched aggregates are unavailable.


## Q15 interface handover for Opus

No UI component changed in Q15. TV Time still uses the general import preview; the UI thread must compose its existing kind/date controls with the match panel. Do not route the source into the wishlist-only confirmer: TV Time also contains watches and statuses. The existing hooks and routes accept the added fields without a compatibility change.

Existing endpoints now also accept owned TV Time previews:

- `GET /api/imports/:id/matches?offset=0`: grouped eligible official movie rows, 50 groups per page. The summary exposes `wishlistMatchCount` including resolved groups, plus `wishlistRewatchChoiceCount` when relevant.
- `GET /api/imports/:id/matches?entry=<row index>`: opens the whole native-ID group from any of its rows.
- `GET /api/imports/:id/matches?index=<row index>&q=<query>[&type=movie]`: bounded catalog candidates, always movies for this scope. `type=show` returns `tvtime_movie_match_required`.
- `GET /api/imports/:id/suggestions?offset=0`: no TV Time suggestions; `state: manual`, `reason: unsupported_source` until resolved, then `already_resolved`. No new confidence signal is invented.
- `POST /api/imports/:id/resolve`: unchanged body `{choices:[{index:0,target:{mediaType:"movie",tmdbId:862}}]}`; `target:null` clears that native-ID group's choice. Response `{import,parentImportId}` names a new preview, with `import.source: tvtime`. The regular Confirm endpoint and kind/date/rewatch decisions still apply afterwards.

Added or extended data fields:

| Field | Meaning |
| --- | --- |
| `group.matchScope: tvtime_movie` | Explicit title-only official movie matching scope |
| `group.allowedMediaTypes: [movie]` | Movie-only target constraint |
| `group.intentCounts` | Counts by original kind, e.g. `{watch:2,want:1}` |
| `group.entryCount` | All eligible observations sharing the native movie ID |
| `group.evidenceVariants[].releaseDate` | Full original release date; other evidence fields remain title, year and native source ID |
| `item.tvtimeMovie` | `{sourceId?,releaseDate}` from official tracking rows, never catalog identity |
| `item.wishlistOriginal` | Immutable normalized observation; `manualMatchScope`, original `kind`, localized title/year, TV Time evidence, stable source key, watch date/precision/pass or supported score |
| `item.wishlistResolution` | Existing explicit selection provenance and authoritative catalog identity; source fields remain in the immutable snapshot |
| `item.wishlistParent` | Immediate child-preview lineage, `{importId,rowIndex}` |

Only new/changed member-facing strings in Q15:

- `tvtime_movie_identity_missing` now says: **This TV Time movie has no catalog ID. Choose a movie to match it.**
- New error `tvtime_movie_match_required`: **Choose a movie for this TV Time entry.**

The existing manual-matching error messages, including missing target, conflicting source choices, ownership, stale preview and restart guidance, are reused. Pre-Q15 TV Time previews lack the immutable snapshots needed here and require reupload. Unsupported official votes and extension rows cannot opt into this scope by supplying extra JSON fields.

Q15 checkpoint: imports server 318/318, legacy IMDb 12/12, imports UI 100/100, tracking 263 passed with the existing TODO. Typecheck remains the same 185 diagnostics as base main, with zero added or removed normalized diagnostics. Nine tests were added for the manual path. The independent review's corrections to the original adapter are being handled in subsequent commits.


## Independent review corrections

The original commits `ec6e982e` and `4aefef10` are unchanged. Q15 and the review corrections are new commits above them.

- Official v1 episode plays now prefer `type-uuid-n`, then source timestamp, then a per-episode/type ordinal. They never share only `tvtime:<uuid>`. A watch plus two rewatches sharing the episode UUID imports three watches on a fresh member and re-imports unchanged; the same Undo removes those three additions.
- TV Time parent and episode `find` requests share one preview-local lookup transport and successful/in-flight evidence cache. Both phases process batches of four. The transport enforces at most **4 active requests**, **30,000 ms** from lookup construction and **2,000 HTTP attempts** per preview, including retries. Each request is bounded by the smaller of the remaining budget and `TMDB_TIMEOUT_MS` (default 5 seconds). At most **3 attempts** are made per lookup invocation. HTTP 429 sets a shared cooldown, honours Retry-After seconds or an HTTP date, and otherwise backs off 500 ms then 1,000 ms. A Retry-After beyond the remaining budget stops rather than retrying early. Requests beyond either budget become unavailable/retry receipt rows, not preview exceptions. Existing unique episode-cache evidence can still be used through the shared resolver when a fresh request is unavailable. Large exports can therefore be partially matched; retry or use smaller source files for the remaining rows.
- Failed HTTP requests, malformed provider responses, deadlines and exhausted retries are evicted, so a later row can retry. A validated negative/ambiguous provider response remains a distinct unmatched outcome. An unavailable parent still gets the retry reason when its supplied IMDb fallback also fails locally. Parent and episode requests for the same TVDB number share the complete returned show/episode evidence rather than duplicating the network call.
- **Known timestamp difference:** only identical trimmed timestamp strings for the same source item collapse. Differently formatted equivalents and different times within one minute do not collapse; Trakt's minute window is not used. This exact-match policy is intentional. Source epoch fields are first rendered as ISO timestamps by their existing reader.
- `continuing` and `up_to_date` can explicitly write Watching with zero imported watches, as #645 permits. They never imply whole-show completion.
- Only Liberator movie scores use the verified 2/4/6/8/10 mapping. Named Liberator JSON files or its distinctive activity CSV shape establish that adapter provenance. Renamed, unidentified JSON and TV Time Out rating fields remain unsupported; episode and show scores remain unsupported. No real file has established another scale.
- **Cross-source receipt compatibility:** native import preview items now persist their declared `media_type` even when unmatched, where main stored null. This fixes unmatched shows reading back as movies across native sources. It does not establish a match: `tmdbId: null` and the unmatched outcome remain authoritative, and shared-wishlist unknown-type placeholders still carry explicit unknown source evidence. A regression test reads an unmatched show from the separate shared-wishlist source. No schema change is required; the separate legacy IMDb implementation is unchanged.
- Unwatched extension movies still become Want to See pending the owner's decision. That single policy is isolated in `unwatchedMovieIntention()` for a later preview choice. Bulk marks remain undated as accepted by the owner. Nothing has been enabled in production by these commits.

New coverage uses synthetic source rows and mocked network/time/database boundaries. Provider tests cover bounded concurrency, Retry-After seconds and dates, fallback backoff, attempt limits, time/request budgets, aborted in-flight requests, malformed responses and failure-cache eviction. The private export remains outside Git and is never included in fixtures.


Final combined Q15 + review validation, 2026-10-19:

- Imports server: **329 passed**, zero failed.
- Legacy IMDb: **12 passed**, zero failed.
- Imports UI: **100 passed**, zero failed.
- Tracking server/domain: **263 passed**, zero failed, one existing TODO.
- Typecheck: **185 diagnostics**, identical to the archived `b15b6cbe` main baseline by file, diagnostic code/message and multiplicity with line/column positions removed. Zero additions and zero removals; its baseline exit status remains 2.
- Biome and `git diff --check` pass for the changed code. No dependency, schema or UI component changes were introduced in Q15/review work.
- All review items are addressed in new commits; `ec6e982e` and `4aefef10` were neither amended nor rebased. No push, production write, issue edit or resolution comment was made.
- The private export folder was still empty at the final check. A real file and live TMDB/catalog validation remain unverified. The new commits have not had an independent re-review.
