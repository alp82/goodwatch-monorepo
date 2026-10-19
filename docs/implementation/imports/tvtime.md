# TV Time file import (#629)

Backend built against main `b15b6cbe`, following the owner's 2026-10-19 reopening decision. The map #365 is unchanged. No production writes, uploads, ticket edits or resolution comments are part of this work.

The upload API accepts `source=tvtime` through the existing multipart preview endpoint, then the ordinary kind/date selection, confirm, receipt, re-import, resume and Undo machinery. The Imports page and its Trakt advice are unchanged; a separate frontend thread will expose this adapter. The only UI-module change is the existing file-size table's required `tvtime` entry, to keep the shared source type exhaustive; it adds no recognition rule or source row. Upload descriptor strings in the domain contract are initial integration copy for that thread.

## Supported files

- Official GDPR `gdpr-data.zip`, also loose tracking CSVs. An in-memory filename allowlist opens only `tracking-prod-records-v2.csv`, `tracking-prod-records.csv`, `followed_tv_show.csv`, `user_tv_show_data.csv` and `ratings-live-votes.csv`. Nested directories, hash prefixes and punctuation/case variants of these names are accepted. Private account/authentication tables are never decompressed or parsed. Other filenames are listed in receipt warnings.
- Liberator `tv-time-export.zip`: `shows.json`, `movies.json`, `activity_history.csv`. Movie ratings use its documented doubled star scale. Episode ratings remain unsupported. Its computed `is_watchlisted` is never used to create wishes.
- TV Time Out `tvtime-export-<date>.zip`: `tvtime-series-<date>.json`/`.csv`, `tvtime-series-episodes-<date>.csv`, `tvtime-movies-<date>.json`/`.csv`. When JSON and CSV representations coexist, JSON is used for that media category once.
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
| `continuing`, `up_to_date` | Watching; never blanket Completed or Seen. The imported episode watches may produce Seen |
| `is_followed` / active follow | Watching when this export also has watches for the show; otherwise Want to See. V2 show flags supersede older followed-table rows |
| `is_for_later`, `not_started_yet`, v1 movie `towatch`/`follow`, explicitly unwatched extension movies | Additive Want to See, with shared wishlist evidence and guards |
| Extension movie `imdb_id`, JSON movie `id.imdb` | Typed local IMDb match; `-1` is missing. TVDB movie IDs never become TMDB IDs |
| Official `movie_name`, `release_date`, `uuid` | Title/year/source identity retained for review; no title-only movie auto-match, even on unique exact title/year agreement |
| Extension `rating` | Movie score 2/4/6/8/10; invalid scores stay invalid. Episode scores stay unsupported |
| Official `vote_key` | Unsupported observation; the live scale can no longer be verified |
| A resolved TMDB special | Watch is imported and flagged; does not count toward regular episode progress |

Watches and explicit source statuses go through the shipped writer. Imports do not overwrite member Seen, On hold or Dropped decisions. Imported activity does not become recent member activity. Wishes never remove absent titles. Existing show tracking remains authoritative. Seen titles need the existing explicit Want to rewatch choice (`conflictChoice=source`) before a wish is added; default keep leaves them alone. Watches selected in the same import take precedence over that import's wishes. Undo uses the existing journals and member-edit protections.

## Matching limits and blocker re-check

#645 covers every status needed here; #621 is no longer a blocker. `up_to_date` has no independent whole-TMDB-show completion evidence and does not set Completed.

#374 remains relevant to official movie watches and wishes. Automatic exact title/year matching currently applies to Letterboxd, generic CSV and shared wishlist sources, not TV Time's localized movie names. The manual matching shipped in `a3954d76` and the #714 hold only support shared-wishlist previews, for originally unknown types and conflicting supplied IDs. They cannot resolve typed title-only TV Time watch rows. TV Time therefore keeps these rows unmatched and visible in the receipt/skipped export. There is no new manual matching endpoint or interaction in this backend build. The member must identify those titles outside this import until a separate reviewed matching extension exists. Extension IMDb movies can match today. Missing/ambiguous/unavailable TVDB parents, episodes outside the matched show, and episodes with only TVDB coordinates stay unmatched too.

Limits are the existing 20 MiB upload, bounded ZIP decoding and UTF-8/CSV validation, plus 50,000 source rows across accepted files and 50,000 output observations. Nested JSON episodes count even when unwatched; supplementary and duplicate CSV rows count toward the input limit. JSON representations with duplicate CSVs are applied once. Protected ZIPs reject with local extraction guidance. No provider credentials, source account IDs, unrelated JSON properties or private CSV columns are retained.

## Copy handover

The following strings are produced by the new backend. Codes live on `ImportFileError.code` or `ImportObservation.problem.code`; codes are not inserted into the member-facing text. Generic ZIP/UTF-8/CSV limit/corruption errors retain their existing wording and receive `tvtime_file_invalid` when they lack a more specific TV Time code.

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
| `tvtime_rating_invalid` | TV Time ratings must be 2, 4, 6, 8 or 10. |
| `tvtime_vote_scale_unknown` | TV Time official vote keys have no verified rating scale. Ratings are not applied. |
| `tvtime_movie_identity_missing` | This TV Time movie has only a title and release date. It stays unmatched for review; no title-only match was applied. |
| `tvtime_show_unmatched` | This TV Time show could not be matched uniquely by its TVDB identity. Its episodes and status were not applied. |

New receipt warnings:

- `TV Time file not imported: <filename>.`
- `A TV Time watch date is invalid or records a bulk mark; the watch is imported without a date.`
- `TV Time plays with a shared timestamp were imported as one watch.`
- `Repeated undated TV Time records for the same item were imported as one watch.`
- `TV Time JSON and CSV contain the same export. The JSON representation is used once.`
- `TV Time rewatch counts do not add watches: only one viewing date is available.`

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

Final checks on 2026-10-19:

- `npm ci` completed; no package or lockfile changes.
- `node --test app/server/imports/*.test.ts`: 309 passed, zero failed, including 18 new TV Time parser/service tests.
- `node --test app/server/imdb-import/*.test.ts`: 12 passed, zero failed.
- `node --test app/ui/imports/*.test.ts`: 100 passed, zero failed.
- `node --test app/server/tracking.test.ts app/domain/tracking/*.test.ts`: 263 passed, zero failed, one existing movie-state TODO (264 total).
- `npm run typecheck`: 185 existing diagnostics. An independent `git archive` of base main `b15b6cbe`, using the same installed dependencies, also reports 185. Compared by file, diagnostic code/message and multiplicity with line/column numbers removed: zero additions and zero removals. Typecheck still exits 2 because of those baseline diagnostics.
- Biome checks all eight touched TypeScript files; `git diff --check` passes.
- The private export directory remained empty at the final check; real match/unmatched aggregates are unavailable.
