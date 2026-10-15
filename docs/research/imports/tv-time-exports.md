# What a saved TV Time export contains

Research date: 2026-10-15. Question: [#611](https://github.com/alp82/goodwatch-monorepo/issues/611), part of [#365](https://github.com/alp82/goodwatch-monorepo/issues/365). Status: findings and a recommendation, not an approved build plan. This note extends the TV Time rows of [the import sources inventory](../import-sources-inventory.md).

No account was signed in to and no real TV Time file was available. The owner's sample folder (`~/dev/projects/goodwatch/third-party-exports`) holds Letterboxd and Trakt exports only. TV Time can no longer produce a file, so every column below comes from TV Time's own pages, from the source code of the tools that wrote the files, or from the parsers and fixtures of tools that read them.

Labels:

- **Confirmed**: read from a first-party source. For the official export, that is TV Time's own pages. For a third-party export, that is the source code of the tool that writes the file.
- **Secondary**: read in a consumer of the file: an importer's parser, its tests or fixtures, its documentation, or the press.
- **Unconfirmed**: inferred, or not established.

## Summary

1. **There are five variants, and only one came from TV Time.** TV Time offered one official export, the GDPR data export `gdpr-data.zip` (confirmed). The other files people hold were written by three browser extensions (TV Time Liberator, TV Time Out by Refract, TV Time Data Extractor) or come from older GDPR requests answered by email. Trakt's importer detects all five ([`TvTimeCsvParser.ts`][trakt-dispatch], secondary).
2. **Trakt's comments call the extension output TV Time's "export my data" tool. It is not.** The `tvtime-*.csv`/`tvtime-*.json` files and the `tvtime-summary-*.html` page come from the TV Time Out by Refract extension ([`exporter.js`][tvto-exporter], confirmed).
3. **Episodes carry TheTVDB ids in every variant except the Extractor, and shows do too except in the Extractor and the older layout.** Movies carry no id at all in the official export: only a localized name, an English slug and a release date ([`TvTimeGdprParser.ts`][trakt-gdpr], [Yamtrack PR #1561 docs][yam-pr], secondary). The extension exports add IMDb ids for movies where TV Time had one (confirmed). TMDB cannot look up a movie by TheTVDB id ([TMDB find][tmdb-find], confirmed), so a TheTVDB movie id is useless to GoodWatch.
4. **Only the official export records rewatches one row per play.** It writes a `rewatch-episode-*` row per episode rewatch and a `rewatch` row per movie rewatch, each with its own timestamp (secondary). The extensions keep one date per item plus a `rewatch_count` (confirmed).
5. **Statuses exist, but not as GoodWatch's.** The extension files carry `continuing`, `up_to_date`, `not_started_yet` and `stopped` per show (confirmed). The official export carries `is_followed`, `is_for_later` and `is_archived` flags (secondary). `stopped` and `is_archived` are the closest thing to Dropped. GoodWatch's import observation has no status kind yet.
6. **Usable fixtures exist, but the best ones are GPL-3.0.** Trakt's repository holds nine anonymized captures of real files ([fixtures README][trakt-fixtures], secondary) under GPL-3.0. GoodWatch is MIT. Copying them is not advisable; re-creating synthetic fixtures from their headers is.
7. **Few GoodWatch members can hold one.** The export window was about two weeks. TV Time Out lists 70,000 users and the Extractor 10,000 in the Chrome Web Store. GoodWatch has a few hundred members with any score or watch. A realistic estimate is zero to five members today (unconfirmed).
8. **Recommendation: build from fixtures, scoped and late in wave 2.** Read the official GDPR export and the Liberator/TV Time Out shape. Leave out the old email layout and the Extractor's episodes. Point everyone else to the Trakt route, which GoodWatch already imports. See [Recommendation](#recommendation).

## The shutdown and the export window

- TV Time published "TV Time is Shutting Down" on its support site, modified on 2026-07-01. "The service will end after July 15, 2026" and "All personal TV Time account data will be deleted after July 15, 2026" ([support article, archived 2026-07-13][tvt-shutdown], confirmed).
- The same article pointed to "our data download export tool" at `gdpr.tvtime.com/gdpr/self-service`, behind a TV Time login ([support article][tvt-shutdown], confirmed).
- The self-service page asked the server to generate the data, polled the status, and saved the result as `gdpr-data.zip` (`a.download = 'gdpr-data.zip'`) ([self-service page, archived 2026-07-01][tvt-gdpr-page], confirmed).
- The support portal now redirects to a login page ([Wayback CDX shows 302 from 2026-09-27][tvt-cdx], confirmed). TV Time no longer answers.
- TechCrunch reported "north of 26.4 million lifetime installs" per Appfigures, and Whip Media's own figure of "more than 25 million users" ([TechCrunch, 2026-07-02][tc-2026], secondary). In 2020 the app had "anywhere between 800,000 and a million active users per day" ([TechCrunch, 2020-01-29][tc-2020], secondary).

So a member could save an official export between about 2026-07-01 and 2026-07-15. The extensions worked only while TV Time's API answered, so they share that deadline (unconfirmed for the days after 2026-07-15).

## The five variants

| Variant | Made by | How a member got it | Archive and files | Trakt's detector |
| --- | --- | --- | --- | --- |
| Official GDPR export | TV Time | Self-service page, or a support request | `gdpr-data.zip`, one CSV per database table, under a `gdpr-data/` folder | `gdpr`: any entry starting `tracking-prod-records`, or a CSV with `key`, `type-uuid-n`, `notification_offset` or `vote_key` |
| Older GDPR layout | TV Time, by email | `support@tvtime.com` GDPR request, before the self-service tool | Loose CSVs such as `seen_episode.csv` | `native`: `episode_id` plus one of `ts`, `show_name`, `episode_name`, `episode_season_number` |
| TV Time Liberator | Hobo-Ware, MIT | Chrome extension or CLI | `tv-time-export.zip` with `shows.json`, `movies.json`, `activity_history.csv`, `favorites.json`, `favorites.csv`, `lists.json`, `list_<name>.csv` | `liberator`: `activity_history.csv`, or a CSV with `imdb_id` |
| TV Time Out by Refract | jeremyndeby, no license | Chrome extension | `tvtime-export-<date>.zip` or loose files: `tvtime-series-<date>.json/.csv`, `tvtime-series-episodes-<date>.csv`, `tvtime-movies-<date>.json/.csv`, `tvtime-lists-<date>.json/.csv`, `tvtime-failed*-<date>.*`, `tvtime-summary-<date>.html` | `export`: names starting `tvtime-`, or a CSV with `series_tvdb_id` |
| TV Time Data Extractor | Series Graph (Henri Elezi), proprietary | Chrome extension | `tv-time-export.csv`, sometimes zipped | `extractor`: `tv-time-export.csv`, or a CSV with `media_type` |

Sources: TV Time's [self-service page][tvt-gdpr-page] (confirmed); [Liberator `content.ts` and `download.ts`][lib-repo] (confirmed); [TV Time Out `exporter.js` and `background.js`][tvto-repo] (confirmed); [AlternativeTo on the Extractor][alt-extractor] (secondary); [Trakt's dispatcher][trakt-dispatch] (secondary). The older layout's origin is from [lukearran/TvTimeToTrakt's README][luke-readme], which tells people to email `support@tvtime.com` (secondary).

Trakt rejects uploads that mix variants ("These files come from different TV Time exports") and gives a specific error for its own `trakt-export-*.zip`, for a GDPR zip without tracking files, and for a zip holding only `tvtime-summary-*.html` ([`TvTimeCsvParser.ts`][trakt-dispatch], [`en.json`][trakt-i18n], secondary). Its commit [834e6104][trakt-834e6104] reports that "about half the untriaged TV Time reports upload their own Trakt export" and "another ~20 upload a GDPR export that TV Time shipped without any tracking-prod-records files" (secondary).

## Official GDPR export

All column lists in this section are secondary. They come from Trakt's parser and its anonymized captures of real files, cross-checked against Yamtrack's open pull request and two MIT command-line importers.

### Archive

- The archive is `gdpr-data.zip` (confirmed). Trakt's tests place entries under `gdpr-data/` ([`TvTimeCsvParser.spec.ts`][trakt-dispatch-spec], secondary).
- Some archives are password protected. Trakt's error says "If it is password protected, extract it first" ([`en.json`][trakt-i18n], secondary). Yamtrack's pull request adds an "Export password" field and notes that some use AES encryption ([Yamtrack PR #1561][yam-pr], secondary). GoodWatch's archive reader rejects encrypted entries ([native imports][gw-native], confirmed for GoodWatch).
- Names are inconsistent. Yamtrack matches files "by a normalized key (lowercase, alphanumeric only)" because "the export uses inconsistent, hash-prefixed names" ([Yamtrack `tvtime.py`][yam-code], secondary).
- The archive holds account data besides watch data: `access_token.csv` and `auth-prod-login.csv` ("password hashes, tokens"), `ip_address.csv`, `device_data.csv`, `user.csv`, `gdpr_requests.csv` ([Yamtrack `tvtime.py`][yam-code], [`TvTimeCsvParser.spec.ts`][trakt-dispatch-spec], secondary). An importer must open only an allowlist of files.
- Some exports have no tracking files at all, so nothing can be imported (about 20 reports, [Trakt 834e6104][trakt-834e6104], secondary).

### Files that matter

| File | What it holds | Columns |
| --- | --- | --- |
| `tracking-prod-records-v2.csv` | Episode watches and rewatches, one row per play; per-show flags; one stats row | `created_at, user_id, key, total_series_runtime, updated_at, total_movies_runtime, movie_watch_count, ep_watch_count, series_follow_count, uuid, is_archived, is_followed, s_id, is_for_later, most_recent_ep_watched, followed_at, runtime, bulk_type, s_no, ep_no, is_unitary, ep_id, rewatch_count, gsi, is_special, movie_name, series_name, season_number, episode_number` |
| `tracking-prod-records.csv` ("v1") | Movie watches, rewatches, to-watch and follows; older episode watches; aggregate count rows | `watch_count, uuid, type, series_name, type-uuid-n, updated_at, user_id, created_at, series_id, watches, runtime, release_date_range_key, release_date, alpha_range_key, movie_name, entity_type, follow_date_range_key, rewatch_count, watch_date, series_uuid, season_number, episode_number, episode_id, total_movies_runtime, total_series_runtime, unitarian, watched_episode_range_key, bulk_type, watch_date_range_key, country` |
| `followed_tv_show.csv` | Followed shows, including follows older than the v2 flags | `user_id, tv_show_id, notification_type, notification_offset, created_at, updated_at, active, diffusion, folder_id, archived, tv_show_name` |
| `ratings-live-votes.csv` | Movie and episode star votes | `episode_id, movie_name, uuid, vote_key, user_id` |
| `emotions-live-votes.csv` | Emotion reactions, same header as ratings | Same as above; not ratings |
| `lists-prod-lists.csv` | Custom lists, favorites and a "collection" row naming them | `ordering, s_key, name, type, description, is_public, user_id, objects, created_at, lists, list_count` |
| `user_tv_show_data.csv` | Per-show follow data (Yamtrack only) | `tv_show_name, user_id, tv_show_id, is_followed, is_favorited, nb_episodes_seen` |
| `watched_on_episode.csv` | A simpler episode log, read when v2 is absent (Yamtrack only) | `tv_show_name, episode_season_number, episode_number, episode_id, created_at` (partial) |

Sources: [Trakt's real-file fixtures][trakt-fixtures] for the v2 header and the lists file; [`TvTimeGdprParser.spec.ts`][trakt-gdpr-spec] for the v1, followed and ratings headers; [Yamtrack `tvtime.py`][yam-code] and [PR tests][yam-pr-files] for the last two rows. The v2 header differs between exports. An account without watch history gets a slim header with no episode columns ([`TvTimeGdprParser.spec.ts`][trakt-gdpr-spec], secondary).

### Rows in the v2 file

- Each row is keyed by `key`. `watch-episode-<uuid>-<uuid>` is a first watch, `rewatch-episode-<uuid>-<n>` a rewatch, `user-series-<uuid>` the member's flags for one show, `tracking-stats` the totals ([`TvTimeGdprParser.ts`][trakt-gdpr], [CaptainRatax `tvtime.js`][ratax-code], secondary).
- `s_id` is the TheTVDB series id. `ep_id` is the TheTVDB episode id, "verified against the Trakt search API", with season and episode in `s_no` and `ep_no` ([Trakt 1c29a71a][trakt-1c29a71a], secondary).
- Some exports carry the episode under the legacy names `episode_id`, `season_number`, `episode_number`, or zero `s_no` and `ep_no` ([`TvTimeGdprParser.ts`][trakt-gdpr], secondary). Trakt first read only the legacy names, which the real file lacked; the bug passed its tests "because the mock fabricated a column the real export never had" ([fixtures README][trakt-fixtures], secondary). Yamtrack's pull request still reads only the legacy names ([`tvtime.py`][yam-code], secondary). A reader must accept both.
- `created_at` is the watch time. It has no time zone, for example `2024-11-02 11:53:58` ([fixture][trakt-fixtures], secondary).
- `bulk_type` is `season` on some rows, with a `runtime` in seconds ([fixture][trakt-fixtures], secondary). This most likely marks a whole season ticked at once, so its time is the click, not the viewing (unconfirmed).
- On `user-series-*` rows, `is_followed`, `is_for_later` and `is_archived` are `true` or `false` ([fixture][trakt-fixtures], secondary).

### Rows in the v1 file

- `type` is `watch`, `rewatch`, `towatch`, `follow`, or a `count-*` aggregate. `entity_type` is `movie` or `episode` ([`TvTimeGdprParser.spec.ts`][trakt-gdpr-spec], [CaptainRatax `tvtime.js`][ratax-code], secondary).
- A movie is identified only by TV Time's `uuid`, `movie_name` (localized, for example 승리호), `alpha_range_key` (an English slug such as `watch-alpha-what-happened-to-monday`) and `release_date`. An unknown release date is the Go zero time `0001-01-01` ([`TvTimeGdprParser.ts`][trakt-gdpr], secondary). Yamtrack's documentation says "TV Time exports them without a TheTVDB, TMDB or IMDb id" ([PR #1561][yam-pr], secondary).
- The watch time is `watch_date_range_key` (`watch-date-<unix seconds>`) or `created_at`. In Trakt's test data the two agree when `created_at` is read as UTC ([`TvTimeGdprParser.spec.ts`][trakt-gdpr-spec], secondary).
- Trakt imports only `watch` and `towatch` movie rows and drops `rewatch` rows ([`TvTimeGdprParser.ts`][trakt-gdpr], secondary, from the code). CaptainRatax's importer imports both ([`tvtime.js`][ratax-code], secondary).

### Ratings and lists

- `vote_key` ends in a rating id. Trakt maps TV Time's `stars_wording_scalev2` set as `1` to 2, `27` to 4, `28` to 6, `29` to 8 and `3` to 10, "verified against msapi.tvtime.com/live/v1/ratings/sets" ([`TvTimeGdprParser.ts`][trakt-gdpr], secondary). TVmaze found "no data to map the voting keys to actual ratings" ([TVmaze blog][tvmaze], secondary). Yamtrack leaves its mapping table empty ([`tvtime.py`][yam-code], secondary). The API that could verify the mapping is gone, so it can no longer be checked (unconfirmed).
- Vote rows name a movie only by `movie_name` and `uuid`. Trakt joins them to v1 rows on `uuid` to get the slug and year ([Trakt a980b968][trakt-a980b968], secondary).
- The `objects` column of `lists-prod-lists.csv` is a printed Go map array: `[map[created_at:1.707766149e+09 id:422981 type:series] ...]` ([fixture][trakt-fixtures], secondary). Series ids are TheTVDB ids. Movie members carry TV Time's internal id ([PR #1561][yam-pr], secondary). Rows with `s_key` `favorite-*` are favorites ([`TvTimeGdprParser.ts`][trakt-gdpr], secondary).

## Older GDPR layout

Trakt calls this format `native`. It reads `ts` (Unix seconds) or `created_at`, `show_name`, `episode_id` (a TheTVDB episode id), `episode_season_number`, `episode_number` and `episode_name`, and its test names the file `seen_episode.csv` ([`TvTimeNativeParser.ts`][trakt-native], [`TvTimeCsvParser.spec.ts`][trakt-dispatch-spec], secondary). There is no real fixture, only a hand-written mock, and the format dates from the first version of Trakt's importer (2026-03-26) ([Trakt a3731f76][trakt-a3731f76], secondary).

The rows carry no TheTVDB series id, only a show name. Nobody publishes a real sample. Whether any member still holds such a file is unknown (unconfirmed).

## TV Time Liberator

Read from the tool's source at [`a18caa46`][lib-repo] (confirmed unless marked).

- The extension saves `tv-time-export.zip` ([`download.ts`][lib-download]). The CLI writes the same files to a folder ([`cli/index.ts`][lib-cli]).
- `shows.json`: per show `uuid`, `id` (`tvdb`, `imdb`), `created_at`, `title`, `status`, and `seasons` of `episodes` with `id`, `number`, `special`, `is_watched`, `watched_at`, `rating` ([`Show.ts`, `Season.ts`][lib-types]).
- `movies.json`: `id`, `uuid`, `title`, `created_at`, `rating`, `is_watched`, `watched_at`, `rewatch_count` ([`Movie.ts`, `WatchInfo.ts`][lib-types]).
- `activity_history.csv`: `imdb_id, tvdb_id, type, title, season, episode, is_special, is_watched, watched_at, status, is_watchlisted, rating`. One row per movie, per watched episode and per show ([`toCsv.ts`][lib-csv]).
- An IMDb id of `-1` means none ([`IMDBReference.ts`][lib-types]).
- `status` is one of `stopped`, `continuing`, `up_to_date`, `not_started_yet` ([`Show.ts`][lib-types]).
- `is_watchlisted` is computed, not stored by TV Time. For a movie it is "no watch date". For a show it means "has an unwatched episode" ([`toCsv.ts`][lib-csv]). It is not a watchlist.
- `rating` is TV Time's star position doubled to 2, 4, 6, 8 or 10, read from TV Time's live rating set ([`ratings.ts`][lib-ratings]). The column exists only since 2026-06-16 ([commit 408a1687][lib-408a1687]).
- `watched_at` became a millisecond ISO string in UTC on 2026-06-16. Before, it was TV Time's raw value, either `2024-09-13T10:50:29.147929Z` or `2024-09-13 10:50:49` with no zone ([`normalizeWatchedAt.ts`][lib-normalize], [commit ac1a45c0][lib-ac1a45c0]).
- Lists: `lists.json` holds `name`, `description`, `is_public`, `shows` and `movies` with `added_at` ([`List.ts`][lib-types]).

The Chrome Web Store listing for the Liberator now returns an empty title ([store page][cws-lib], checked 2026-10-15). It may have been removed (unconfirmed).

## TV Time Out by Refract

Read from the tool's source at [`73d99b64`][tvto-repo] (confirmed unless marked). The repository has no license file. The store lists version 1.3.0 updated 2026-07-21 and "70,000 users" ([store page][cws-tvto], checked 2026-10-15), while the repository's manifest says 1.2.29. The published build may differ from the source read here (unconfirmed).

- The member chooses JSON, CSV or both, and optionally one ZIP `tvtime-export-<date>.zip`, which also holds `tvtime-summary-<date>.html` ([`exporter.js`][tvto-exporter], [`background.js`][tvto-background]).
- The JSON follows the Liberator shape ("au format TV Time Liberator") and adds `rewatch_count`, `is_favorite`, `special`, `name` and `watched_count` ([`background.js`][tvto-background]).
- `tvtime-series-<date>.csv`: `uuid, tvdb_id, imdb_id, title, status, created_at`.
- `tvtime-series-episodes-<date>.csv`: `series_tvdb_id, series_imdb_id, series_uuid, title, season, episode, tvdb_id, is_watched, watched_at, rewatch_count, special`. One row per episode, watched or not.
- `tvtime-movies-<date>.csv`: `uuid, tvdb_id, imdb_id, title, year, created_at, watched_at, is_watched, rewatch_count`.
- `tvtime-lists-<date>.csv`: `list_id, list_name, item_type, tvdb_id, imdb_id, uuid, name, custom_order`.
- `tvtime-failed-<date>.csv`: `title, tvdbId`, shows and movies TV Time timed out on ([`exporter.js`][tvto-exporter]). An export can be partial.
- Episode IMDb ids are always `null` ([`background.js`][tvto-background]). In Trakt's real captures `series_imdb_id` and the series `imdb_id` are empty, while movie `imdb_id` is filled ([fixtures][trakt-fixtures], secondary).
- `status` is TV Time's follow filter, the same four values as the Liberator, or `unknown` ([`apiClient.js`][tvto-api]).
- `watched_at` is written as `YYYY-MM-DDTHH:MM:SSZ` ([`background.js`][tvto-background]). Trakt's captured episode file uses `2019-10-04 03:43:42` instead, while its movie file uses the `Z` form ([fixtures][trakt-fixtures], secondary). Older versions wrote the other form (unconfirmed).
- Movies the member followed but has not watched appear with `is_watched` `false` and no date ([fixture][trakt-fixtures], secondary).
- Files are UTF-8, comma-separated, CRLF line endings, quotes doubled ([`exporter.js`][tvto-exporter]).
- A list named `LIKE` appears in a real capture ([fixture][trakt-fixtures], secondary). It is probably TV Time's liked shows (unconfirmed).

## TV Time Data Extractor

Series Graph's extension is proprietary, has "10,000 users" and was last updated 2026-06-23 ([store page][cws-ext], checked 2026-10-15). It writes `tv-time-export.csv` ([AlternativeTo][alt-extractor], secondary).

- Header, from Trakt's test built after "Eight reports uploaded this file": `type, media_type, tmdb_id, imdb_id, tvdb_id, title, year, season, episode, watched_at, rating, review` ([`TvTimeExtractorParser.spec.ts`][trakt-ext-spec], [Trakt 04e880c2][trakt-04e880c2], secondary).
- Movies come with an IMDb id where available. "Episodes carry only the show title and no ids at all" ([Trakt 04e880c2][trakt-04e880c2], secondary).
- `watched_at` is `2019-10-21T06:31:39Z` in the test (secondary). The meaning of `rating` and `review` is unknown (unconfirmed).

## Ids, episodes, statuses, dates and rewatches

### Ids

| Variant | Show | Episode | Movie |
| --- | --- | --- | --- |
| Official GDPR, v2 | TheTVDB `s_id` | TheTVDB `ep_id`, plus `s_no`/`ep_no` | n/a |
| Official GDPR, v1 | n/a | TheTVDB `episode_id` (older rows) | None: `movie_name`, slug, `release_date`, TV Time `uuid` |
| Older GDPR layout | Name only | TheTVDB `episode_id` | Unknown |
| Liberator | TheTVDB and IMDb | TheTVDB and IMDb | TheTVDB and IMDb, `-1` when missing |
| TV Time Out | TheTVDB; IMDb often empty | TheTVDB; IMDb always empty | TheTVDB and IMDb |
| Extractor | Name only | None | IMDb (or TMDB, unconfirmed) |

GoodWatch matches on TMDB id, then IMDb id, then exact title and year ([`preview.server.ts`][gw-preview], confirmed for GoodWatch). TMDB's find endpoint resolves TheTVDB ids for TV, seasons and episodes, but not movies ([TMDB find][tmdb-find], confirmed). GoodWatch's Mongo copy of TMDB details stores `external_ids.tvdb_id` ([`models.py`][gw-models], confirmed), but the Crate `show` table has no TheTVDB column. The `episode` table has a `tvdb_id` column that stays empty "until an import or backfill resolves them" ([`crate_schemas.py`][gw-schema], confirmed).

### Episode rows

- The official export and the older layout list watched episodes only (secondary). TV Time Out lists every episode with `is_watched` (confirmed). The Liberator CSV lists watched episodes only; its JSON lists all (confirmed).
- Specials: season `0` in every variant. TV Time Out also writes a `special` flag; v2 has `is_special` (confirmed, secondary).
- TheTVDB and TMDB number some shows differently, notably long-running anime ([PR #1561][yam-pr], secondary). A season and episode number is a fallback only.

### Statuses

| TV Time state | Where | Nearest GoodWatch term |
| --- | --- | --- |
| `not_started_yet` | Liberator, TV Time Out | Want to See |
| `is_for_later = true` | GDPR v2 `user-series-*` | Want to See |
| Followed, nothing watched | GDPR v2, `followed_tv_show.csv` | Want to See (Trakt and Yamtrack both do this) |
| `continuing` | Liberator, TV Time Out | Watching, implied by the episode watches |
| `up_to_date` | Liberator, TV Time Out | Watching or Seen, implied by the watches |
| `stopped` | Liberator, TV Time Out | Dropped |
| `is_archived = true`, `archived = 1` | GDPR v2, `followed_tv_show.csv` | Dropped (unconfirmed) |
| `towatch` movie | GDPR v1 | Want to See |
| Unwatched followed movie | Liberator, TV Time Out | Want to See (unconfirmed) |

Sources: [`Show.ts`][lib-types] (confirmed), [fixtures][trakt-fixtures] (secondary), [`TvTimeGdprParser.ts`][trakt-gdpr] and [`TvTimeExportParser.ts`][trakt-export] (secondary). Trakt does not import dropped shows: "any shows you dropped there need to be dropped again on Trakt" ([`en.json`][trakt-i18n], secondary). GoodWatch's show status allows an import to set On hold or Dropped ([`CONTEXT.md`][gw-context], confirmed), but `ImportKind` has no status kind ([`imports.ts`][gw-imports], confirmed). TV Time has no On hold.

### Watch dates

| Variant | Field | Format | Zone |
| --- | --- | --- | --- |
| GDPR v2 | `created_at` | `2024-11-02 11:53:58` | None written. UTC per CaptainRatax's default and Trakt's test data (secondary) |
| GDPR v1 | `watch_date_range_key`, `created_at` | `watch-date-1649590015`, `2022-04-10 11:26:55` | Unix seconds; UTC (secondary) |
| Older layout | `ts`, `created_at` | Unix seconds | UTC (secondary) |
| Liberator, since 2026-06-16 | `watched_at` | `2024-09-13T10:50:29.147Z` | UTC (confirmed) |
| Liberator, before | `watched_at` | Either ISO with microseconds or `2024-09-13 10:50:49` | Mixed (confirmed) |
| TV Time Out | `watched_at` | `2026-06-03T13:02:31Z`, or `2019-10-04 03:43:42` in older files | UTC (confirmed, older form secondary) |
| Extractor | `watched_at` | `2019-10-21T06:31:39Z` | UTC (secondary) |

Trakt parses a zone-less value as the browser's local time ([`toImportISOString.ts`][trakt-iso], secondary). Yamtrack's pull request makes it aware in the server's zone ([`tvtime.py`][yam-code], secondary). CaptainRatax's README says "The default timestamp timezone is UTC. Keep it unless you are sure TV Time exported local timestamps" ([README][ratax-readme], secondary). Reading as UTC is the better default (unconfirmed).

A watched item without a date exists: TV Time Out's summary flags "watched but no date" ([`exporter.js`][tvto-exporter], confirmed). Bulk marks in v2 carry the click time ([fixture][trakt-fixtures], secondary).

### Rewatches

- **Official export:** each episode rewatch is its own `rewatch-episode-*` row with its own `created_at`. Trakt's commit [97a55144][trakt-97a55144] counted "~10k plays dropped, up to 3.6k on a single account" before it read them (secondary). Each movie rewatch is a v1 `rewatch` row ([CaptainRatax][ratax-code], secondary).
- **"Watched N times" shares one timestamp.** "TV Time logs 'watched N times' as N rewatch rows sharing one timestamp ... One export had ~1.9k of them" ([Trakt ad63d66d][trakt-ad63d66d], secondary). Trakt collapses plays of one item within one minute.
- **Liberator, TV Time Out:** one `watched_at` per episode or movie plus `rewatch_count` (confirmed). Whether that date is the first or the last viewing is unknown (unconfirmed). Trakt ignores `rewatch_count` ([`TvTimeExportParser.ts`][trakt-export], secondary).
- **Extractor:** unknown (unconfirmed).

### Encoding and size

- The extensions write UTF-8 CSV with CRLF line endings and RFC 4180 quoting ([`exporter.js`][tvto-exporter], [`toCsv.test.ts`][lib-csv-test], confirmed).
- The official export's encoding is not documented. Yamtrack decodes with `utf-8-sig`, which also strips a byte-order mark ([`tvtime.py`][yam-code], secondary).
- Large accounts are large. Trakt guards against "100k+ watch rows" ([`TvTimeGdprParser.ts`][trakt-gdpr], secondary). TVmaze caps uploads at "about 12 MB, which is roughly 50,000 lines" ([TVmaze blog][tvmaze], secondary). GoodWatch's limits are 20 MB and 50,000 observations ([`imports.ts`][gw-imports], confirmed). A heavy TV Time user will exceed the observation limit.

## Which importer reads which variant

| Importer | Variants read | Notes |
| --- | --- | --- |
| Trakt (web) | All five, ZIP or loose files | GPL-3.0. Real-file fixtures. Movie ratings from GDPR and Liberator; episode ratings and dropped status not imported ([parsers][trakt-parsers], secondary) |
| TVmaze | Official GDPR, `tracking-prod-records-v2.csv` only | Shows, episodes, watched status, progress; votes not mapped ([TVmaze blog][tvmaze], secondary) |
| Moviebase | "a TV Time ZIP archive or CSV files" | Variants not named; "title matching affect[s] the result" ([Moviebase guide][moviebase], secondary) |
| Simkl | Not documented | Lists "Import from TV Time to SIMKL" ([Simkl docs][simkl-docs], secondary). The file it reads is unconfirmed |
| SeriesGuide converter | TV Time Out JSON (series, movies, lists) | Movies need an IMDb id known to TMDB ([converter][seriesguide], secondary) |
| Yamtrack | None merged | Open [PR #1561][yam-pr] reads the official GDPR ZIP. Issue [#1557][yam-1557] asks for the Liberator (secondary) |
| Ryot | None built in | Community [TvTimeToRyot][ryot-community] (secondary) |
| lukearran/TvTimeToTrakt | Official GDPR, v1 and v2 | MIT CLI ([README][luke-readme], secondary) |
| CaptainRatax/tvtime-trakt-safe-importer | Official GDPR, v1 and v2, with rewatches | MIT CLI ([`tvtime.js`][ratax-code], secondary) |

## Fixtures and licenses

| Source | What it holds | Real or synthetic | License |
| --- | --- | --- | --- |
| [Trakt `__fixtures__/tvtime`][trakt-fixtures] | 9 files: GDPR v2 tracking, GDPR lists, TV Time Out CSV (series, episodes, movies, lists) and JSON (series, movies) | Anonymized real exports from import-failure reports, sampled "to cover every parser branch" | GPL-3.0 ([LICENSE][trakt-license]; GitHub reports `NOASSERTION`) |
| Trakt parser specs | Inline CSV for GDPR v1, followed shows, ratings, older layout, Liberator, Extractor | Hand-written; the Extractor test was modeled on 8 real reports | GPL-3.0 |
| [Liberator `src/.test/data.ts`][lib-testdata] | Movies and shows in Liberator JSON | Built from real titles, synthetic accounts | MIT |
| [Yamtrack PR #1561 tests][yam-pr-files] | Inline CSV for GDPR v2, `user_tv_show_data.csv`, episode votes | Hand-written; uses the legacy column names | AGPL-3.0, unmerged |
| TV Time Out | No fixtures | n/a | No license |

GoodWatch is MIT ([LICENSE][gw-license]). Copying Trakt's GPL-3.0 fixtures into it would bring GPL terms into a test directory of an MIT repository. Column names and value formats are facts, so writing new synthetic fixtures from them is safe (unconfirmed, not legal advice). The Liberator data is MIT and can be reused with its notice.

Can an importer be built safely from fixtures alone? Partly:

- **The Liberator and TV Time Out shapes:** yes. The writing code is public, so the format is known exactly (confirmed), apart from the drift noted above.
- **The official GDPR export:** mostly. Trakt's real captures pin the v2 and lists headers. The v1, followed and ratings headers come from hand-written tests only. Name drift, password protection and missing tracking files are known failure modes. Trakt shipped a broken v2 parser from a mock and fixed it from real reports ([fixtures README][trakt-fixtures], secondary). Expect the same.
- **The older layout and the Extractor:** no. Neither has a real sample, and the Extractor's episodes have no ids.

## How many members could still hold an export

Worldwide signals:

- TV Time had 0.8 to 1 million daily users in 2020 and 26.4 million lifetime installs ([TechCrunch 2020][tc-2020], [TechCrunch 2026][tc-2026], secondary).
- The official export could be made for about two weeks, 2026-07-01 to 2026-07-15 ([support article][tvt-shutdown], confirmed). How many people used it is not published.
- TV Time Out reports 70,000 users and the Extractor 10,000 ([store pages][cws-tvto], checked 2026-10-15). Store "users" count current installs, not exports (unconfirmed).
- A share of people who exported have since moved to Trakt. About half of Trakt's untriaged TV Time reports were people uploading a Trakt export ([Trakt 834e6104][trakt-834e6104], secondary).

GoodWatch:

- On 2026-10-07, 212 members had a watch row, and 231 members had at least one scored title without a watch row ([tracking data model, section 6][gw-datamodel], confirmed). The two groups may overlap, so a few hundred members are active.
- If 1 to 2 percent of them used TV Time actively and a third of those saved a file, that is zero to three members. Allowing for new members who arrive with a file, zero to five (unconfirmed, an estimate).
- The number only shrinks. No new TV Time export can be made.

## What GoodWatch would need

These follow from the findings, not from a design:

1. **A TheTVDB to TMDB lookup for shows.** The Mongo TMDB details hold `external_ids.tvdb_id`; the Crate `show` table does not. Plex, Kodi and Jellyfin also carry TheTVDB ids, so this would be reused.
2. **Episode resolution by TheTVDB episode id, with a season and number fallback.** TMDB's find endpoint resolves one episode per call ([TMDB find][tmdb-find], confirmed). Filling `episode.tvdb_id` once per show is cheaper than a call per watch row (unconfirmed).
3. **A status observation.** Without it, `stopped` and `is_archived` become unsupported rows with a reason.
4. **An encrypted-ZIP message.** The reader rejects encrypted entries today. Members need "extract it and upload the CSV files".
5. **An allowlist of entries,** so the credential files in `gdpr-data.zip` are never opened.
6. **A plan for the 50,000-observation cap.** For example, collapse unwatched TV Time Out episode rows before counting, and say so in the receipt.
7. **Title-only movie matching for the official export.** The localized `movie_name` rarely equals TMDB's title. The English slug drops punctuation. Expect many unmatched movies, which [Matching titles without ids](https://github.com/alp82/goodwatch-monorepo/issues/374) would help.

## Recommendation

**Build from fixtures, scoped, as the last source of wave 2.** Do not wait for a real file; none will appear. Keep the scope where the format is known:

- **Read** the official `gdpr-data.zip` (v2 episodes, v1 movies, `followed_tv_show.csv`, `ratings-live-votes.csv`) and the Liberator/TV Time Out shape (`shows.json`/`tvtime-series-*.json`, `movies.json`/`tvtime-movies-*.json`, and the matching CSVs).
- **Leave out** the older email layout and the Extractor's episodes. Accept Extractor movies only if it costs one header check.
- **Do not import** lists or episode ratings; report them as unsupported, as the Trakt import does.
- **Write the fixtures** from the headers in this note, mirroring each real-capture quirk: both v2 column families, zeroed `s_no`/`ep_no`, the slim header, `-1` IMDb ids, both date forms, `bulk_type` rows, same-minute rewatch clusters.
- **Tell members on the source picker** that a TV Time history moved to Trakt can come in through the Trakt export, which carries TMDB ids.

If the owner judges zero to five members not worth a TheTVDB lookup, leave TV Time out and show only that Trakt hint. The lookup is the main cost, and it is reusable.

### Observations each variant would produce

All observations use `source` `tvtime` (a new value of `IMPORT_SOURCES`), `tmdbId` resolved from TheTVDB before preview, and the rules of [native imports][gw-native].

| Variant | Row | Observation |
| --- | --- | --- |
| GDPR v2 | `watch-episode-*`, `rewatch-episode-*` | `kind: "watch"`, `mediaType: "show"`, `season` from `s_no` or `season_number`, `episode` from `ep_no` or `episode_number`, `episodeTmdbId` from `ep_id`, `watchedAt` from `created_at` as UTC, `precision: "moment"` (`"unknown"` when `bulk_type` is set, if the owner agrees), `pass: 1`, `key: "tvtime:" + key`. Same-minute clusters get a warning, as for Trakt |
| GDPR v2 | `user-series-*` with `is_for_later` | `kind: "want"`, show, `addedAt` from `created_at` |
| GDPR v2 | `user-series-*` followed, no plays; `followed_tv_show.csv` active and not archived | `kind: "want"` (owner decision; Trakt and Yamtrack both do it) |
| GDPR v2 | `is_archived`, or `archived = 1` | Unsupported, "Dropped isn't imported yet", until a status kind exists |
| GDPR v1 | `watch`, `rewatch` movie | `kind: "watch"`, `mediaType: "movie"`, `title` from `movie_name`, `year` from `release_date` (null for `0001`), `tmdbId`/`imdbId` null, `watchedAt` from `watch_date_range_key`, `key` from `type-uuid-n` |
| GDPR v1 | `towatch` movie | `kind: "want"`, movie, title and year as above |
| GDPR | `ratings-live-votes.csv`, `episode_id = 0` | `kind: "rating"`, movie, `score` from Trakt's id table. Mark the mapping as unverified in the preview |
| GDPR | Episode votes, `emotions-live-votes.csv`, lists | Unsupported or ignored |
| Liberator, TV Time Out | Watched episode | `kind: "watch"`, show from `id.tvdb`/`series_tvdb_id`, `episodeTmdbId` from the episode TheTVDB id, `watchedAt` from `watched_at` (`precision: "unknown"` when empty), `key` from show and episode ids. `rewatch_count` N adds N watches with `precision: "unknown"`, distinct keys |
| Liberator, TV Time Out | Unwatched episode row | None |
| Liberator, TV Time Out | Show `not_started_yet` | `kind: "want"`, show |
| Liberator, TV Time Out | Show `stopped` | Unsupported until a status kind exists |
| Liberator, TV Time Out | Watched movie | `kind: "watch"`, movie, `imdbId` (not `-1`), `title`, `year`, `watchedAt`; `rewatch_count` as for episodes |
| Liberator, TV Time Out | Unwatched movie | `kind: "want"`, movie (unconfirmed meaning; offer it as a choice) |
| Liberator | `rating` on a movie | `kind: "rating"`, `score` as given (2 to 10). Episode ratings unsupported |
| Liberator `activity_history.csv` | `is_watchlisted` on a show | Ignore; it means "has unwatched episodes" |
| TV Time Out | `is_favorite` | `kind: "favorite"` |

## What a real file would settle

- The time zone of zone-less GDPR timestamps.
- Whether `bulk_type` marks bulk actions, and what `is_unitary` means.
- Whether TV Time Out's `watched_at` is the first or the last viewing.
- What `is_archived` meant in the app (stopped watching, or hidden).
- The current v1, `followed_tv_show.csv` and `ratings-live-votes.csv` headers.
- The Extractor's `rating` and `review` columns, and whether it writes rewatch rows.

## Sources

TV Time:

- [TV Time is Shutting Down, archived 2026-07-13][tvt-shutdown]
- [GDPR self-service page, archived 2026-07-01][tvt-gdpr-page]
- [Wayback CDX for the support article][tvt-cdx]

Tools that write the files:

- [Hobo-Ware/tv-time-liberator at a18caa46][lib-repo] (MIT)
- [jeremyndeby/TV-Time-Out at 73d99b64][tvto-repo] (no license)
- [TV Time Data Extractor on AlternativeTo][alt-extractor], [Chrome Web Store][cws-ext]

Tools that read the files:

- [trakt/trakt-web import parsers at 0e301c14][trakt-parsers] and commits [a3731f76][trakt-a3731f76], [1c29a71a][trakt-1c29a71a], [a980b968][trakt-a980b968], [97a55144][trakt-97a55144], [ad63d66d][trakt-ad63d66d], [834e6104][trakt-834e6104], [04e880c2][trakt-04e880c2]
- [TVmaze: The TV Time importer is now available][tvmaze]
- [Moviebase: How to export TV Time data][moviebase]
- [Simkl: Importing to Simkl][simkl-docs]
- [SeriesGuide: TV Time converter][seriesguide]
- [Yamtrack PR #1561][yam-pr], [issue #1557][yam-1557]
- [lukearran/TvTimeToTrakt][luke-readme], [CaptainRatax/tvtime-trakt-safe-importer][ratax-readme]
- [Ryot community importers][ryot-community]

Reference:

- [TMDB: Find by ID][tmdb-find]
- [TechCrunch, 2026-07-02][tc-2026], [TechCrunch, 2020-01-29][tc-2020]

[tvt-shutdown]: https://web.archive.org/web/20260713092713/https://whipmedia.freshdesk.com/support/solutions/articles/68000029988-tv-time-is-shutting-down
[tvt-gdpr-page]: https://web.archive.org/web/20260701214206/https://gdpr.tvtime.com/gdpr/self-service
[tvt-cdx]: https://web.archive.org/cdx/search/cdx?url=whipmedia.freshdesk.com/support/solutions/articles/68000029988*
[tc-2026]: https://techcrunch.com/2026/07/02/popular-tv-tracking-app-tv-time-is-shutting-down-as-company-focuses-on-ai
[tc-2020]: https://techcrunch.com/2020/01/29/whip-media-group-parent-to-tv-show-tracking-app-tv-time-raises-50m
[trakt-parsers]: https://github.com/trakt/trakt-web/tree/0e301c14967da6d3224ef9a97430ee1e4dd2082c/projects/client/src/lib/sections/settings/import/parsers
[trakt-dispatch]: https://github.com/trakt/trakt-web/blob/0e301c14967da6d3224ef9a97430ee1e4dd2082c/projects/client/src/lib/sections/settings/import/parsers/TvTimeCsvParser.ts
[trakt-dispatch-spec]: https://github.com/trakt/trakt-web/blob/0e301c14967da6d3224ef9a97430ee1e4dd2082c/projects/client/src/lib/sections/settings/import/parsers/TvTimeCsvParser.spec.ts
[trakt-gdpr]: https://github.com/trakt/trakt-web/blob/0e301c14967da6d3224ef9a97430ee1e4dd2082c/projects/client/src/lib/sections/settings/import/parsers/TvTimeGdprParser.ts
[trakt-gdpr-spec]: https://github.com/trakt/trakt-web/blob/0e301c14967da6d3224ef9a97430ee1e4dd2082c/projects/client/src/lib/sections/settings/import/parsers/TvTimeGdprParser.spec.ts
[trakt-export]: https://github.com/trakt/trakt-web/blob/0e301c14967da6d3224ef9a97430ee1e4dd2082c/projects/client/src/lib/sections/settings/import/parsers/TvTimeExportParser.ts
[trakt-native]: https://github.com/trakt/trakt-web/blob/0e301c14967da6d3224ef9a97430ee1e4dd2082c/projects/client/src/lib/sections/settings/import/parsers/TvTimeNativeParser.ts
[trakt-ext-spec]: https://github.com/trakt/trakt-web/blob/0e301c14967da6d3224ef9a97430ee1e4dd2082c/projects/client/src/lib/sections/settings/import/parsers/TvTimeExtractorParser.spec.ts
[trakt-iso]: https://github.com/trakt/trakt-web/blob/0e301c14967da6d3224ef9a97430ee1e4dd2082c/projects/client/src/lib/sections/settings/import/parsers/utils/toImportISOString.ts
[trakt-fixtures]: https://github.com/trakt/trakt-web/tree/0e301c14967da6d3224ef9a97430ee1e4dd2082c/projects/client/src/lib/sections/settings/import/parsers/__fixtures__/tvtime
[trakt-i18n]: https://github.com/trakt/trakt-web/blob/0e301c14967da6d3224ef9a97430ee1e4dd2082c/projects/client/i18n/meta/en.json
[trakt-license]: https://github.com/trakt/trakt-web/blob/0e301c14967da6d3224ef9a97430ee1e4dd2082c/LICENSE
[trakt-a3731f76]: https://github.com/trakt/trakt-web/commit/a3731f76
[trakt-1c29a71a]: https://github.com/trakt/trakt-web/commit/1c29a71a
[trakt-a980b968]: https://github.com/trakt/trakt-web/commit/a980b968
[trakt-97a55144]: https://github.com/trakt/trakt-web/commit/97a55144
[trakt-ad63d66d]: https://github.com/trakt/trakt-web/commit/ad63d66d
[trakt-834e6104]: https://github.com/trakt/trakt-web/commit/834e6104
[trakt-04e880c2]: https://github.com/trakt/trakt-web/commit/04e880c2
[lib-repo]: https://github.com/Hobo-Ware/tv-time-liberator/tree/a18caa46fbf8d611cc60f048c480e8981d7e6c05
[lib-download]: https://github.com/Hobo-Ware/tv-time-liberator/blob/a18caa46fbf8d611cc60f048c480e8981d7e6c05/src/extension/src/utils/download.ts
[lib-cli]: https://github.com/Hobo-Ware/tv-time-liberator/blob/a18caa46fbf8d611cc60f048c480e8981d7e6c05/src/cli/index.ts
[lib-types]: https://github.com/Hobo-Ware/tv-time-liberator/tree/a18caa46fbf8d611cc60f048c480e8981d7e6c05/src/core/types
[lib-csv]: https://github.com/Hobo-Ware/tv-time-liberator/blob/a18caa46fbf8d611cc60f048c480e8981d7e6c05/src/core/serializer/toCsv.ts
[lib-csv-test]: https://github.com/Hobo-Ware/tv-time-liberator/blob/a18caa46fbf8d611cc60f048c480e8981d7e6c05/src/core/serializer/toCsv.test.ts
[lib-ratings]: https://github.com/Hobo-Ware/tv-time-liberator/blob/a18caa46fbf8d611cc60f048c480e8981d7e6c05/src/core/api/ratings.ts
[lib-normalize]: https://github.com/Hobo-Ware/tv-time-liberator/blob/a18caa46fbf8d611cc60f048c480e8981d7e6c05/src/core/utils/normalizeWatchedAt.ts
[lib-testdata]: https://github.com/Hobo-Ware/tv-time-liberator/blob/a18caa46fbf8d611cc60f048c480e8981d7e6c05/src/.test/data.ts
[lib-408a1687]: https://github.com/Hobo-Ware/tv-time-liberator/commit/408a1687
[lib-ac1a45c0]: https://github.com/Hobo-Ware/tv-time-liberator/commit/ac1a45c0
[tvto-repo]: https://github.com/jeremyndeby/TV-Time-Out/tree/73d99b649c452c76830beb6ed89c92c1bd12d853
[tvto-exporter]: https://github.com/jeremyndeby/TV-Time-Out/blob/73d99b649c452c76830beb6ed89c92c1bd12d853/exporter.js
[tvto-background]: https://github.com/jeremyndeby/TV-Time-Out/blob/73d99b649c452c76830beb6ed89c92c1bd12d853/background.js
[tvto-api]: https://github.com/jeremyndeby/TV-Time-Out/blob/73d99b649c452c76830beb6ed89c92c1bd12d853/apiClient.js
[cws-tvto]: https://chromewebstore.google.com/detail/tv-time-out-by-refract/pmejpdpjbkjklfceogdkolmgclldogbi
[cws-ext]: https://chromewebstore.google.com/detail/tv-time-data-extractor/jmpoblamjmpbhnggdihhcoejomkpkgpp
[cws-lib]: https://chromewebstore.google.com/detail/tv-time-liberator-extensi/pohobkcjhigehafgnhehkanhjakajhpm
[alt-extractor]: https://alternativeto.net/software/tv-time-data-extractor/about/
[tvmaze]: https://www.tvmaze.com/blogs/63/the-tv-time-importer-is-now-available
[moviebase]: https://moviebase.app/resources/how-to-export-tv-time-data
[simkl-docs]: https://docs.simkl.org/how-to-use-simkl/advanced-usage/import-export-data/importing-to-simkl
[seriesguide]: https://www.seriesgui.de/convert-tv-time/
[yam-pr]: https://github.com/FuzzyGrim/Yamtrack/pull/1561
[yam-pr-files]: https://github.com/FuzzyGrim/Yamtrack/pull/1561/files
[yam-code]: https://github.com/Breezyslasher/Yamtrack/blob/e50b619a43bf4feab098fd264dc10502729e4476/src/integrations/imports/tvtime.py
[yam-1557]: https://github.com/FuzzyGrim/Yamtrack/issues/1557
[ryot-community]: https://github.com/IgnisDa/ryot/blob/main/apps/docs/src/importing/community.md
[luke-readme]: https://github.com/lukearran/TvTimeToTrakt/blob/42ff96cb7790b664a2439b702f89b187c9ad9cde/README.md
[ratax-readme]: https://github.com/CaptainRatax/tvtime-trakt-safe-importer/blob/cf8fe7bd181be205a268cdfb1f9eaf73ea28abdc/README.md
[ratax-code]: https://github.com/CaptainRatax/tvtime-trakt-safe-importer/blob/cf8fe7bd181be205a268cdfb1f9eaf73ea28abdc/src/tvtime.js
[tmdb-find]: https://developer.themoviedb.org/reference/find-by-id
[gw-native]: ../../implementation/native-imports.md
[gw-preview]: ../../../goodwatch-webapp/app/server/imports/preview.server.ts
[gw-imports]: ../../../goodwatch-webapp/app/domain/imports.ts
[gw-models]: ../../../goodwatch-flows/windmill/f/tmdb_api/models.py
[gw-schema]: ../../../goodwatch-flows/windmill/f/sync/models/crate_schemas.py
[gw-context]: ../../../CONTEXT.md
[gw-datamodel]: ../../implementation/tracking/data-model.md
[gw-license]: ../../../LICENSE
