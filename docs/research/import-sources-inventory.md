# Import sources: inventory and what to add

Research date: 2026-10-06. Status: exploration and recommendations, not an approved implementation plan. This follows [the IMDb ratings import note](imdb-ratings-import.md) and [its deep dive](imdb-ratings-import-deep-dive.md), and widens the question from "IMDb ratings" to "everything a person could bring with them": ratings, watches with dates, rewatches, Want to See, favorites, reviews and lists, from as many platforms as is sensible.

Five parallel research agents produced the material: one mapped the import that ships today, four read official documentation, official repositories, live API responses and (where nothing official exists) third-party importers' source code. The citations were gathered by those agents and were not independently re-checked during synthesis, apart from a spot check of the watch-history schema and writer. No account was signed in to, no export file was generated, nobody was contacted, and nothing here is legal advice.

Labels used in the tables: **confirmed** means read from a first-party source; **secondary** means read only in a third-party importer, blog or forum post; **unconfirmed** means not established. Several official help pages (Amazon, Plex support, Kodi wiki, Simkl, Letterboxd help centre, Criticker, FilmAffinity, aniDB) refused automated fetches, so more rows are secondary than one would like. [What to verify with real files](#what-to-verify-with-real-files) lists what must be checked before building.

## Summary

1. **Today GoodWatch imports one thing: the score from an IMDb ratings CSV.** No watch dates, no Want to See, no favorites, no reviews, no lists, no episode ratings. The pipeline around it (preview, conflict choice, resumable apply, receipt, undo) is solid and source-agnostic in shape, but every name and query in it is IMDb-specific.
2. **The storage for dated watches and rewatches already exists and is unused.** `user_watch_history` has `watched_at_list`, `first_watched_at`, `last_watched_at`, `watch_count` and `ingest_source`. The only writer stores "now" and replaces the list on every write. There is no per-episode table.
3. **The richest sources for watch dates and rewatches are Trakt, Letterboxd and Simkl, in that order of accessibility.** Trakt keeps one dated row per play for everyone and exports it free. Letterboxd keeps one diary row per viewing with a rewatch flag. Simkl's rewatches are separate sessions, available only to its paying members, capped at 50 per title.
4. **File upload is the safe default almost everywhere.** Letterboxd excludes recommendation products from its API by name. Trakt's draft API policy says it does not support competing platforms built on its data. Simkl allows a tracker to use its API only if it also offers Simkl login and sync. AniList prohibits use by competing trackers. MyAnimeList forbids storing its users' content server-side. Only TMDB and Kitsu are straightforward to connect to.
5. **Two generic formats cover the long tail.** Nearly every community exporter (Criticker, MUBI, Filmweb, ČSFD, SensCritique, Douban, Kinopoisk, FilmAffinity, Moviepilot, Rotten Tomatoes) targets the Letterboxd import CSV. Accepting that format reaches all of them without a line of per-site code.
6. **The work that unlocks everything is in GoodWatch, not in the parsers:** a source-neutral import pipeline, a watch-history writer that appends past dates, and decisions on episode-level data, title-only matching, and how foreign statuses map onto GoodWatch's vocabulary.

## What GoodWatch imports today

Shipped in `f4224c3d` (2026-10-02). Paths are relative to the repository root.

| Aspect | Today |
| --- | --- |
| Entry points | Settings → Imports (`goodwatch-webapp/app/routes/settings.imports.tsx`) and a hint line above the taste quiz (`app/ui/imports/ImdbImportEntry.tsx`) |
| Input | One IMDb ratings CSV, read in the browser and posted as JSON. Max 10 MB and 50,000 rows. The header must contain `Const`, `Your Rating` and `Title Type`; a watchlist or list file is rejected (`app/server/imdb-import/file.server.ts:115-134`) |
| Matching | Exact IMDb ID against the catalog table for the row's type; names are never compared (`preview.server.ts:27-48`) |
| Types | Movie, TV movie, video, TV special → movie. TV series, mini-series → show. Episodes, shorts, games, music videos, podcasts → unsupported with a reason (`file.server.ts:98-108`) |
| Written | `user_score.score` only, 1–10 unchanged (`apply.server.ts:81-99`) |
| Kept but not used | `Date Rated`, stored in `user_import_item.date_rated` |
| Never touched | Review text, watch history, Want to See, skipped, favorites (`apply.server.ts:10-11`) |
| Safety | Two-phase preview and confirm; one global conflict choice (keep GoodWatch, the default, or use IMDb); updates only where the score still equals what the preview saw; idempotent re-import; resume after a stall; undo that leaves later edits alone |
| Receipt | Per-outcome counts and lists, downloadable CSV of skipped rows |
| Tests | None for the parser, classifier, apply or undo |

Two details matter for what follows:

- `user_import.source` exists and is always `'imdb'`; the list query filters on it (`store.server.ts:98`). The tables are already shaped for more sources, the code is not.
- An imported rating does not clear a Not interested flag, although the normal rating path does (`scores.server.ts:70`). The glossary says rating clears Not interested, so this looks like a gap to close when the pipeline is generalised.

### The user-data model an importer can write to

From `goodwatch-flows/windmill/f/sync/models/crate_schemas.py`. All tables are keyed by `(user_id, tmdb_id, media_type)` with `media_type` in `movie`, `show`.

| Table | Holds | Limits for import |
| --- | --- | --- |
| `user_score` | `score` (integer 1–10), `review` | No source column; half-point and 100-point scales must be converted |
| `user_wishlist` | Want to See, with `created_at` | Can carry the source's added date |
| `user_favorite` | Favorites | Same shape |
| `user_skipped`, `user_not_interested` | Quiz skip, Not interested | No equivalent of "dropped" or "on hold" |
| `user_watch_history` | `watched_at_list` (array of timestamps), `first_watched_at`, `last_watched_at`, `watch_count`, `ingest_source`, plus unused single `season_number` / `episode_number` | One row per title. No per-episode rows. Timestamps only, so a date-only or unknown-date watch needs a convention |
| `user_list` | Share lists of exactly five titles | Not a general list store; imported custom lists have nowhere to go |

The only watch-history writer (`goodwatch-webapp/app/server/watchHistory.server.ts:42-58`) upserts `watched_at_list: [now]`, `watch_count: 1`, and the generic upsert replaces every column on conflict. A second "watched" therefore overwrites the first. Every reader found treats the row as a boolean. So the schema supports rewatches with dates; no code path does.

## Inventory

### What each platform holds

"Dated watches" means the platform records when something was watched, not when it was rated. "Rewatches" says how repeats are represented.

| Platform | Ratings | Dated watches | Rewatches | Episode level | Watchlist | Other | IDs in the data |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IMDb | 1–10, date rated | No. "Watched" is undated and not exportable | No | Episode ratings | Yes, with added date | Custom lists with notes, check-ins | `tt` id on every row |
| Trakt | 1–10 on movie, show, season, episode, with `rated_at` | Yes, one row per play, minute precision | Each play is its own dated row | Yes | Yes, `listed_at`, rank, notes | Favorites, lists, comments, notes, dropped shows, collection | Trakt, IMDb, TMDB, TVDB, slug |
| Simkl | 1–10, title level, `user_rated_at` | Yes, per title and per episode | Separate sessions with own dates; paying members only; max 50; two watches must be 2+ days apart | Yes | `plantowatch` status with added date | Statuses watching, hold, dropped, completed; memos; custom lists (paying members) | Simkl, IMDb, TMDB, TVDB, and MAL, AniDB, AniList, Kitsu for anime |
| Letterboxd | 0.5–5 per film and per viewing | Yes, diary date (calendar date) | One diary row per viewing with a `Rewatch` flag | Not yet; TV types exist in the API schema | Yes, with added date | Likes, reviews, tags, ranked lists with notes | Export: name, year, `boxd.it` link only. RSS: TMDB id |
| TMDB | 0.5–10 on movie, TV, episode | No watch history at all | No | Episode ratings, undated | Yes, undated | Favorites, lists with comments | Native TMDB ids |
| TheTVDB | None | None | No | n/a | None | Favorites only | TVDB ids |
| Netflix | Thumbs (stars on old entries) | Yes; quick CSV is date only, full archive is a UTC timestamp per play session (secondary) | Full archive: one row per session (secondary) | Yes, in the title string | My List in the archive (secondary) | | None, title strings |
| Prime Video | Unconfirmed | Yes (secondary) | Unconfirmed | Unconfirmed | Yes (secondary) | | Amazon ids at best |
| Plex | Yes | Yes, per play | Yes | Yes | Yes | | IMDb, TMDB, TVDB |
| Jellyfin, Emby | Yes | Last played only | Play count only | Yes | No | Favorites | Provider ids |
| Kodi | `userrating` | `lastplayed` only | `playcount` only | Yes | No | | `uniqueid` with type |
| TV Time | Votes (not mappable to ratings per TVmaze) | Unconfirmed | Unconfirmed | Yes | Yes | | Internal ids; movies by title |
| MyAnimeList | 0–10 | Start and finish date per entry | Count only | Progress count | `plan_to_watch` | On hold, dropped, tags, comments | MAL id |
| AniList | Five formats (3, 5, 10, 10 decimal, 100) | Started and completed dates | Count only | Progress count | `PLANNING` | Paused, dropped, notes, custom lists, reviews | AniList id, MAL id |
| Kitsu | Out of 20 | Started, finished, progressed dates | Count only | Progress count | Yes | Notes | Kitsu id plus mappings to MAL, AniList, AniDB, TVDB, Trakt |
| Criticker | 0–100, date rated | No | No | No | No | Mini review | IMDb id (secondary) |
| MovieLens | 0.5–5 | Via activity logs (secondary) | No | No | Wishlist | | IMDb and TMDB ids (secondary) |
| Sofa | Unconfirmed | Yes, ISO 8601 | Unconfirmed | Unconfirmed | Lists | Notes, tags | TMDB id |
| Google "Watched it?" | Thumbs, stars | Published timestamp | No | No | Unconfirmed | | None, title string |

### How to get the data out, and whether GoodWatch may

| Platform | Route | Cost to the user | Terms risk for GoodWatch | Verdict |
| --- | --- | --- | --- | --- |
| IMDb | CSV per list: ratings, watchlist, check-ins, each custom list | Free | None for upload. Automated retrieval is prohibited (see the deep dive) | Extend the existing import |
| Trakt, file | Settings → Data → Export now. ZIP of JSON built in the browser from the public API | Free; only saved filters are paywalled | None for upload | Build |
| Trakt, API | OAuth with PKCE; 500 GET per 5 minutes per user | Free accounts may connect only two community apps | Unclear. The draft policy says Trakt does not support "another service using Trakt's data and resources to build a competing platform", while the current text permits migrating a user's own history "at the user's request" | Ask Trakt before building |
| Simkl, file | Backup page: CSV summary, or ZIP with JSON | Official pages contradict each other on whether the JSON download is free | None for upload | Build once a sample is in hand |
| Simkl, API | OAuth with mandatory PKCE; 500 requests a day per free user | Rewatches need a paying account | Rule 2: a tracker that syncs with another tracker may use the API only if it also offers Simkl login and sync. Free only under $150 a month revenue | Feasible if GoodWatch accepts those conditions |
| Letterboxd, file | Settings export, ZIP of CSVs | Free | None for upload | Build |
| Letterboxd, RSS | `letterboxd.com/{username}/rss/`, about the 50 most recent diary entries, with TMDB ids | Free | Offered by Letterboxd as the machine-readable route; terms prohibit scraping pages | Optional follow-up for staying current |
| Letterboxd, API | By request | n/a | Excluded: "not granting access for data-analysis, visualization or recommendation projects" | Do not plan on it |
| TMDB, API | Request-token approval, then v4 for rated movies and TV with timestamps, v3 for episode ratings, watchlist, favorites | Free | GoodWatch already operates under TMDB's terms; note the clause on machine-learning use | Build; cheapest of all, native ids |
| TMDB, file | "Export CSV" on the rated, watchlist and favorites pages; delivered by email (secondary) | Free | None | Accept as an alternative |
| TheTVDB | API with the user's subscriber PIN | $12 a year for the user | n/a | Skip; favorites only |
| Netflix | Viewing activity → Download all (CSV per profile); or full archive, up to 30 days | Free | None for upload | Build, with a title parser |
| Prime Video, Disney+, Hulu, Max, Apple TV | Privacy data request; days to a month; formats undocumented | Free | None for upload | Skip until a real file is seen |
| Plex | Sign in with Plex, read history from the user's server | Free | None found | Later; the server must be reachable from GoodWatch |
| Tautulli | Exporter file (CSV, JSON, XML) with external ids | Free | None | Later, cheap |
| Jellyfin, Emby | REST API with the user's server address and key | Free | None | Later; same reachability problem |
| Kodi | Library export to a single XML file | Free | None | Later, cheap |
| TV Time | Shut down 2026-07-15; only previously saved exports | n/a | None | Time-limited; build only if cheap |
| JustWatch | No export, no public API | n/a | n/a | Not possible |
| MyAnimeList | Official XML export; API v2 | Free | Upload is fine. The API agreement forbids storing users' content server-side | File only |
| AniList | Public GraphQL by username; privacy export as JSON | Free | Prohibits use "within competing … list or tracker services" | File only, or ask |
| Kitsu | Public JSON:API by username, no key | Free | None found | Build with anime |
| Criticker, MovieLens, Sofa | Self-serve CSV with ids | Free | None | Cheap extras |
| iCheckMovies, Rate Your Music | Export file; paid on iCheckMovies; no ids | Mixed | None | Through the generic CSV |
| Rotten Tomatoes, Metacritic, MUBI, Douban, FilmAffinity, Moviepilot, SensCritique, Kinopoisk, Filmweb, ČSFD | No official export; community scripts that mostly emit Letterboxd-format CSV | Free | Scraping is the user's act, not GoodWatch's | Through the generic CSV only |
| Google "Watched it?" | Data Portability API with OAuth | Free | Verification process | Skip; no ids, thin data |

### What the other importers accept

A person choosing where to move looks at this list. It is also the best evidence of which sources are worth the effort.

| Importer | Sources |
| --- | --- |
| Trakt | TV Time (five format variants), IMDb ratings and watchlist CSV, Letterboxd ZIP, its own JSON and CSV |
| Simkl | "18 providers": Trakt, MyAnimeList, AniList, Kitsu, AniSearch, IMDb, Letterboxd, TV Time, Netflix and Crunchyroll (through its browser extension), BetaSeries, Criticker, EpisodeCalendar, SeriesFad, others, plus its own CSV and JSON |
| Letterboxd | Its own CSV, IMDb CSV, iCheckMovies, Delicious Library |
| TMDB | IMDb CSV, Trakt (older templates), and Letterboxd export since about August 2026 |
| Yamtrack | Trakt, Simkl, MyAnimeList, AniList, Kitsu, IMDb CSV, its own CSV |
| Ryot | Trakt, IMDb watchlist, Netflix archive, MyAnimeList XML, AniList JSON, Plex, Jellyfin, Movary, Watcharr, MediaTracker |
| Movary | Letterboxd, Netflix, Trakt, Plex, Jellyfin |
| MediaTracker | Trakt |

Trakt is in every one. IMDb, Letterboxd, Netflix and the three anime trackers form the next tier. Nobody imports a regional site directly.

## Source details that shape the design

### IMDb beyond ratings

- The watchlist, check-ins and each custom list export as separate CSVs. List-shaped files start with `Position, Const, Created, Modified, Description` and, since February 2018, also carry `Your Rating` and `Date Rated`, so a watchlist upload can yield ratings too ([staff post](https://community-imdb.sprinklr.com/conversations/imdbcom/updates-to-list-pages/5f4a79d78815453dba8cdc5f)). The exact current list header is unconfirmed.
- `Created` on a watchlist row is the date the title was added.
- IMDb's own "Watched" (launched 2025-03-31) has no date and no export: "Doesn't require knowing when you watched it" ([Col Needham](https://community-imdb.sprinklr.com/conversations/imdbcom/difference-between-watch-history-and-check-ins/68e4752653b7872ee1bda1d0), [announcement](https://community-imdb.sprinklr.com/conversations/imdbcom/imdb-introduces-watched-formerly-known-as-seen/67ea80e2dedd5e250dbb2bdb)). So there is no watch date to import from IMDb, and the existing decision never to treat `Date Rated` as one stands.
- Check-ins are the closest thing to a dated watch: "the order you've seen titles in time" ([FAQ](https://help.imdb.com/article/imdb/track-movies-tv/check-ins-faq/GG59ELYW45FMC7J3)). The only timestamp is the list `Created` date.
- Reviews cannot be exported ([IMDb employee](https://community-imdb.sprinklr.com/conversations/imdbcom/export-data/6760999e0e882547778c536d)).

### Trakt

- **Export ZIP** `trakt-export-{slug}.zip`, flat JSON files, each the raw response of one API endpoint; paginated endpoints become `<name>-<page>.json`; `_errors.json` appears when an endpoint failed, so a ZIP can be partial ([export code](https://github.com/trakt/trakt-web/blob/HEAD/projects/client/src/lib/sections/settings/export/runRawExport.ts)).
- The files that matter: `watched-history*` (one row per play with `watched_at` and `action`), `ratings-movies`, `ratings-shows`, `ratings-seasons`, `ratings-episodes`, `lists-watchlist`, `lists-favorites`, `lists-list-*`, `comments-*`. `watched-movies` and `watched-shows` are aggregates with play counts only.
- Dropped shows are not in the ZIP; they exist only at `users/hidden/dropped` in the API.
- Every `watched_at` has had seconds zeroed since 2026-03-01 ([announcement](https://github.com/trakt/trakt-api/discussions/694)), so deduplicate on title and minute.
- Trakt accepts the literals `released` and `unknown` as watch dates on write. How they read back is unconfirmed.
- **Trakt history is not always real history.** Trakt's own IMDb importer writes a play dated with the rating date by default, and staff believe undated imports get "today's date" (see the deep dive, Part A). A Trakt export can therefore contain hundreds of plays sharing one timestamp. An importer should detect such clusters and offer to import them as Seen without a date.
- **API policy.** The [first draft](https://github.com/trakt/trakt-api/blob/9a15f016addfe31c6c910d9d27bf45594c2e1a0a/projects/developer/src/lib/guides/api-use-policy.md) (2026-09-16) forbade "continuously synchronizing Trakt account data into a separate tracking or list platform's own accounts and database" and said a Connect button does not make a use permitted. The [current text](https://github.com/trakt/trakt-api/blob/HEAD/projects/developer/src/lib/guides/api-use-policy.md) (2026-09-22) is softer and tells developers to write to support@trakt.tv when a use is not covered. The [announcement](https://github.com/trakt/trakt-api/discussions/943) calls it a draft under review. New apps need a GitHub-verified account and are deleted after 30 idle days.

### Simkl

- **Rewatches** ([guide](https://api.simkl.org/guides/rewatches)): with `allow_rewatch=yes` each title returns its canonical row plus one row per rewatch session carrying `is_rewatch`, `rewatch_id`, `rewatch_status` and its own `last_watched_at`. Per-episode dates on a session need `extended=full&episode_watched_at=yes`. For a free account the flag is silently ignored. The canonical row's `last_watched_at` never reflects rewatches.
- **Placeholder date.** `1970-01-01T00:00:01Z` means "watched, date unknown" ([dates](https://api.simkl.org/conventions/dates)).
- **Synthesised episode dates.** `include_all_episodes=yes` stamps every episode of a bulk-completed show with the show's last-watched time; `=original` returns only episodes actually recorded ([sync guide](https://api.simkl.org/guides/sync)).
- **Statuses**: watching, plantowatch, hold, dropped, completed; each title is in exactly one ([statuses](https://api.simkl.org/conventions/list-statuses)).
- **A full import is about four requests**, well inside a free user's 500 a day, but that quota is shared with the user's other connected apps ([rate limits](https://api.simkl.org/resources/rate-limits)).
- **Conditions** ([API rules](https://api.simkl.org/api-rules)): free under $150 a month revenue; Simkl data shown must link back to Simkl; rule 2 as quoted above.
- **File export.** The JSON backup is said to contain the full lists with ratings, memos, external ids and the full episode list ([formats](https://docs.simkl.org/how-to-use-simkl/advanced-usage/import-export-data/exporting-from-simkl/export-data-formats)). Its schema, file names, paywall status and whether rewatch sessions are included are all unconfirmed.

### Letterboxd

- **Export ZIP** (schema not published; headers from third-party parsers, secondary):

| File | Header |
| --- | --- |
| `diary.csv` | `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date` |
| `reviews.csv` | `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date` |
| `ratings.csv` | `Date,Name,Year,Letterboxd URI,Rating` |
| `watched.csv`, `watchlist.csv`, `likes/films.csv` | `Date,Name,Year,Letterboxd URI` |
| `lists/<slug>.csv` | A metadata block, a blank line, then `Position,Name,Year,URL,Description` |

- `Date` is when the entry was logged, `Watched Date` is the viewing date, `Rewatch` is `Yes` or blank. Diary dates are calendar dates, not timestamps.
- `ratings.csv` holds the current film rating; `diary.csv` holds a rating per viewing. They can differ.
- **No ids in the export**, only name, year and a `boxd.it` link. Letterboxd takes all film data from TMDB ([FAQ](https://letterboxd.com/about/faq/)), so name and year are TMDB's title and release year and match well. Resolving the link to a TMDB id needs either the gated API or fetching Letterboxd pages, which the terms prohibit.
- The profile **RSS feed** carries `tmdb:movieId`, `letterboxd:watchedDate`, `letterboxd:rewatch` and `letterboxd:memberRating`, but only for about the 50 most recent entries.
- **The import CSV** ([documented](https://letterboxd.com/about/importing-data/)) is the interchange format: `LetterboxdURI`, `tmdbID`, `imdbID`, `Title`, `Year`, `Directors`, `Rating` (0.5–5), `Rating10` (1–10), `WatchedDate`, `Rewatch`, `Tags`, `Review`. Quotes inside a field are escaped with a backslash, not doubled. Header names differ from the export (`Title` against `Name`, `WatchedDate` against `Watched Date`); accept both.

### TMDB

- v4 `GET /4/account/{id}/movie/rated` and `/tv/rated` return `account_rating.created_at`, the only rated-at timestamp TMDB exposes ([reference](https://developer.themoviedb.org/v4/reference/account-rated-movies)). Episode ratings exist only in v3 and are undated. Watchlist and favorites have no dates, only a `created_at` sort order.
- TMDB has no watch history, diary or rewatch concept.
- Ids are GoodWatch's own keys, so there is no matching step at all.

### Netflix

- The quick CSV comes from Account → Profiles → Viewing activity → Download all ([help](https://help.netflix.com/en/node/101917)). Its columns (believed to be `Title, Date`) were not confirmed in this research.
- The full archive ([request page](https://www.netflix.com/account/getmyinfo), up to 30 days) has `ViewingActivity.csv` with profile, start time in UTC, duration, title and `Supplemental Video Type`, one row per play session including autoplayed trailers (secondary: [walkthrough](https://www.dataquest.io/blog/python-tutorial-analyze-personal-netflix-data/)). Ryot reads `ViewingActivity.csv`, `Ratings.csv` and `MyList.csv` from it and handles English exports only.
- No ids. Episodes are written as `Show: Season 7: Episode Name`; limited series and localised season labels vary.

### Anime trackers

- All three give start and finish dates per entry and a rewatch **count**, never a date per rewatch.
- The structural problem: an anime tracker has one entry per season or cour, TMDB has one show with seasons. A MyAnimeList id maps to a (TMDB show, season, episode offset) triple.
- Mapping data: [Kometa Anime-IDs](https://github.com/Kometa-Team/Anime-IDs) (MIT, generated daily, keyed by AniDB id with TVDB, IMDb, MAL, AniList and TMDB ids) for the title-level bridge; [Fribb/anime-lists](https://github.com/Fribb/anime-lists) and [Anime-Lists/anime-lists](https://github.com/Anime-Lists/anime-lists) carry the season and episode offsets but declare no licence.
- Kitsu returns MAL, AniList, AniDB, TVDB and Trakt mappings itself, with no key.
- AniList's privacy export is poorer than its API: Ryot's importer shows no start or finish dates in it (secondary).

### Media servers

- Plex keeps a dated row per play and external ids, and has ratings and a watchlist. Reading it needs a Plex sign-in, and the history lives on the user's own server, which GoodWatch must be able to reach.
- Jellyfin, Emby and Kodi keep only a play count and the last played date.
- Kodi's single-file XML export and Tautulli's exporter file both carry external ids and need no network access to the user's machine.

## What I would add

### First: the foundation in GoodWatch

None of the sources below is worth much until these exist. They are listed in dependency order.

1. **A source-neutral import pipeline.** Each source becomes a small adapter that turns its file or API response into a common set of observations: a rating, a watch (with a date, a date-only value, or no date), Want to See, a favorite, a review. Matching, preview, conflict handling, apply, receipt and undo are shared. The current IMDb code is the template; its tables already have a `source` column.
2. **A watch-history writer that appends.** Merge imported dates into `watched_at_list`, keep the earliest and latest, recount, and never drop dates already there. Undo must remove only the dates an import added. This also fixes the existing behaviour where marking a title watched twice forgets the first time.
3. **A convention for imprecise watch dates.** Three cases must stay distinguishable: a full timestamp (Trakt, Netflix archive, Plex), a calendar date (Letterboxd, Netflix quick CSV, anime finish dates), and "seen, date unknown" (Letterboxd `watched.csv`, Simkl's 1970 placeholder, Trakt `unknown`). The existing rule holds: never invent a date.
4. **Preview toggles per kind of data.** Ratings, watches, Want to See, favorites and reviews each get a count and a switch, as Trakt does. A person may want their Letterboxd diary but not their watchlist.
5. **Title-only matching with a review step.** Letterboxd, Netflix and every scraper-derived CSV have no ids. Today's rule is exact IMDb id only. The proposal: exact title and year against the catalog, automatic only when exactly one title matches, everything else shown for the person to pick or skip.
6. **Scale conversion.** Letterboxd and MovieLens ×2 (lossless). Criticker ÷10, Kitsu ÷2, TMDB halves, AniList's five formats: all need rounding, and the rounding rule should be stated in the preview. Thumbs are not scores and should not become them.

### Then the sources, in order

**Wave 1: the big four, all with low terms risk.**

| Source | Brings | Why now |
| --- | --- | --- |
| IMDb watchlist, lists and check-ins CSV | Want to See with added dates; extra ratings found in list files | Smallest step from what exists; same ids, same parser |
| Letterboxd export ZIP | Diary with watch dates and rewatches, ratings, undated watched films, Want to See, likes as favorites, reviews | The largest film-diary community; the best source of dated rewatches for films |
| Trakt export ZIP | Per-play history with dates, ratings on four levels, Want to See, favorites | In every competitor's importer; free export; ids on every row; richest TV data |
| TMDB connect | Ratings with dates, Want to See, favorites | No matching step, no file handling, one approval click |
| Generic CSV (Letterboxd import columns, plus Trakt's flat columns) | Whatever the file holds | One parser reaches every community exporter listed above |

**Wave 2: the sources that need a sample file or a decision first.**

| Source | Brings | What is needed first |
| --- | --- | --- |
| Simkl JSON backup upload | Statuses, ratings, per-episode dates, possibly rewatch sessions | A real backup file; the schema and paywall are unconfirmed |
| Simkl connect | The same, plus rewatch sessions for paying members | Accepting rule 2 (offer Simkl login and sync) and the revenue threshold |
| Netflix viewing activity CSV and full archive | Dated watches, rewatches from the archive, thumbs | A real file of each; a title parser for episodes |
| TV Time saved exports | Episode history, Want to See | A real file; demand shrinks every month since the shutdown |
| Trakt connect | The same as the ZIP without the download, plus dropped shows | A written answer from Trakt |

**Wave 3: breadth.**

| Source | Brings | Note |
| --- | --- | --- |
| Kodi XML, Tautulli exporter file | Seen, last played date, play count, ratings | File uploads with ids; cheap |
| Plex, Jellyfin, Emby connect | Plex: dated plays. Others: last played and count | Connection and reachability are the cost |
| MyAnimeList XML, Kitsu by username, AniList JSON | Scores, statuses, start and finish dates, rewatch counts | Needs the anime id bridge and the season mapping |
| Criticker, MovieLens, Sofa CSV | Ratings with ids; Sofa also dates | A few hours each once the pipeline exists |

### What I would not build

- **Letterboxd API, IMDb retrieval, any scraper.** Excluded by the platforms' terms or already ruled out in the deep dive.
- **JustWatch.** No export exists.
- **Prime Video, Disney+, Hulu, Max, Apple TV.** Slow privacy requests with undocumented formats. Revisit when a user sends a real file.
- **TheTVDB.** Undated favorites for paying subscribers only.
- **Per-site regional importers** (Douban, FilmAffinity, Moviepilot, SensCritique, Kinopoisk, Filmweb, ČSFD), **Rotten Tomatoes, Metacritic, MUBI.** No official exports. The generic CSV serves the people who use the community scripts.
- **Google "Watched it?".** Title strings only, behind an OAuth verification process.

### About rewatches with dates specifically

| Source | What a rewatch looks like | Who has it |
| --- | --- | --- |
| Trakt | Another history row with its own `watched_at` | Everyone |
| Letterboxd | Another diary row with `Rewatch = Yes` and its own date | Everyone; films only; one viewing per day survives its own importer |
| Netflix full archive | Another play-session row with a timestamp | Everyone, after a wait of up to 30 days |
| Plex, Tautulli history | Another play row | Self-hosters |
| Simkl | A rewatch session with its own last-watched date and episode dates | Paying members; max 50 per title; watches less than 2 days apart are merged |
| MyAnimeList, AniList, Kitsu, Jellyfin, Emby, Kodi | A count | No dates to import |

Simkl is the platform that names the feature, but Trakt and Letterboxd will supply far more dated rewatches in practice, because every member has them and the export is free.

## Decisions this needs

1. **Episode-level data.** Trakt, Simkl, TV Time, Netflix and Plex are mostly episode rows, and GoodWatch has no per-episode user table. Options: collapse episodes to the show (Seen, with first and last date) and keep the raw rows in the import tables for a later backfill; or add episode tracking first. Collapsing loses "which episodes" but imports today.
2. **When is a show Seen?** One imported episode, a completed status, or all aired episodes? Trakt refused to mark whole shows watched from a show rating; the reverse question applies here.
3. **Statuses with no GoodWatch term.** Watching, on hold, dropped. Dropped is not Not interested ("has not seen and does not want to watch") and not Skip. Either drop these on import and say so in the receipt, or add vocabulary.
4. **Title-only matching.** Whether to relax "exact id only", and how much review the person must do.
5. **Reviews.** Importing into `user_score.review` is possible; whether an imported review may replace an existing one needs the same conflict treatment as scores.
6. **Custom lists.** There is no general list store. Skip them, or map only a list of exactly five to a share list (probably not worth it).
7. **Trakt and Simkl connections.** Whether to ask Trakt, and whether offering Simkl login and sync is acceptable.
8. **Bulk-dated history.** Whether to detect clusters of plays sharing one timestamp and import them undated by default.

No ADR covers imports. Decisions 1 to 4 are the kind an ADR should record once made, and "import", "source" and "watch" would need glossary entries in `CONTEXT.md`.

## What to verify with real files

Nothing below was confirmed from a first-party source. Each needs a real export before code is written against it.

| Item | Why it matters |
| --- | --- |
| IMDb watchlist, list and check-ins headers; current `Title Type` strings | The list header is recalled, not sourced |
| Letterboxd ZIP manifest, the first lines of list files, `deleted/` and `orphaned/` folders | Schema is unpublished |
| Trakt ZIP from a real account; how `unknown` and `released` watch dates read back | Flat or foldered layout is disputed between code and a forum post |
| Simkl JSON backup: file names, schema, rewatch sessions, whether a free account can download it | Official pages contradict each other |
| Netflix quick CSV columns; archive file names and columns | Help page lists none |
| TV Time column names | Take them from an open-source importer and a saved export |
| TMDB CSV `Date Rated` format; v4 token to v3 session conversion; rating increments | Recalled, not sourced |
| Kodi `userrating` scale | Believed 0–10 |
| Whether Letterboxd RSS exposes private or close-friends entries | Untested |
| Catalog coverage: share of a real Letterboxd and Trakt library that matches | Decides how much the review step matters |

## Sources

Primary documentation and code the findings rest on. Per-claim links are inline above; the IMDb material is cited in full in the two earlier notes.

- Trakt: [API blueprint](https://trakt.docs.apiary.io/api-description-document), [API guides](https://github.com/trakt/trakt-api/tree/HEAD/projects/developer/src/lib/guides), [import parsers](https://github.com/trakt/trakt-web/tree/HEAD/projects/client/src/lib/sections/settings/import/parsers), [export instructions](https://forums.trakt.tv/t/how-do-i-export-my-data/54762), [pagination changes](https://github.com/trakt/trakt-api/discussions/775)
- Simkl: [API reference](https://api.simkl.org), [changelog](https://api.simkl.org/changelog), [import sources](https://docs.simkl.org/how-to-use-simkl/advanced-usage/import-export-data/importing-to-simkl), [standard media objects](https://api.simkl.org/conventions/standard-media-objects)
- Letterboxd: [importing data](https://letterboxd.com/about/importing-data/), [migrating from IMDb](https://letterboxd.com/about/migrating-from-imdb/), [FAQ](https://letterboxd.com/about/faq/), [API access](https://letterboxd.com/api-beta/) and [API docs](https://api-docs.letterboxd.com/) (both read through archived snapshots), [terms](https://letterboxd.com/legal/terms-of-use/)
- TMDB: [authentication](https://developer.themoviedb.org/v4/docs/authentication-user), [account endpoints](https://developer.themoviedb.org/reference/account-rated-movies), [find by id](https://developer.themoviedb.org/reference/find-by-id), [API terms](https://www.themoviedb.org/api-terms-of-use), [staff on exports](https://www.themoviedb.org/talk/5b801e399251416c8c00e3ec), [staff on Letterboxd import](https://www.themoviedb.org/talk/646f2b2a71ffdf0106c8fa6b)
- TheTVDB: [OpenAPI spec](https://thetvdb.github.io/v4-api/swagger.yml), [licensing](https://thetvdb.com/api-information)
- IMDb: [ratings FAQ](https://help.imdb.com/article/imdb/track-movies-tv/ratings-faq/G67Y87TFYYP6TWAV), [watchlist FAQ](https://help.imdb.com/article/imdb/track-movies-tv/watchlist-faq/G9PA556494DM8YBA), [Watched FAQ](https://help.imdb.com/article/imdb/new-features-updates/mark-as-watched-faq/GR2SD7Y4LZVNHUVH)
- Streaming: [Netflix viewing activity](https://help.netflix.com/en/node/101917), [Netflix personal information](https://help.netflix.com/en/node/100624), [Google Takeout](https://support.google.com/accounts/answer/3024190), [Apple TV app privacy](https://www.apple.com/legal/privacy/data/en/apple-tv-app/)
- Media servers: [Plex API](https://developer.plex.tv/pms/), [Tautulli API](https://github.com/Tautulli/Tautulli/wiki/Tautulli-API-Reference) and [exporter](https://github.com/Tautulli/Tautulli/wiki/Exporter-Guide), [Jellyfin user data](https://typescript-sdk.jellyfin.org/interfaces/generated-client.UserItemDataDto.html), [Emby user data](https://dev.emby.media/reference/pluginapi/MediaBrowser.Model.Dto.UserItemDataDto.html), [Kodi XML writer](https://github.com/xbmc/xbmc/blob/master/xbmc/video/VideoInfoTag.cpp)
- Tracker apps: [TV Time importer at TVmaze](https://www.tvmaze.com/blogs/63/the-tv-time-importer-is-now-available), [Moviebase on TV Time exports](https://moviebase.app/resources/how-to-export-tv-time-data), [Sofa export](https://sofahq.com/support/data-management/exporting-sofa-data)
- Anime: [MyAnimeList API v2](https://myanimelist.net/apiconfig/references/api/v2) and [API agreement](https://myanimelist.net/static/apiagreement.html), [AniList media list](https://docs.anilist.co/reference/object/medialist) and [terms](https://docs.anilist.co/guide/terms-of-use), [Kitsu server](https://github.com/hummingbird-me/kitsu-server/blob/the-future/app/controllers/library_entries_controller.rb)
- Open-source trackers: [Yamtrack imports](https://github.com/FuzzyGrim/Yamtrack/blob/dev/docs/media-imports.md), [Ryot importing](https://github.com/IgnisDa/ryot/tree/main/apps/docs/src/importing), [Movary features](https://github.com/leepeuker/movary/tree/main/docs/features), [MediaTracker](https://github.com/bonukai/MediaTracker)
- Google: [Data Portability schema for Search](https://developers.google.com/data-portability/schema-reference/search_ugc)
