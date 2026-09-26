# External ids from Wikidata

Issue [#150](https://github.com/alp82/goodwatch-monorepo/issues/150). `f/external_ids/wikidata_backfill` fills missing
IMDb ids and Rotten Tomatoes and Metacritic URLs from Wikidata once a week. The IMDb dataset ingest (#149) and the
rebuilt Rotten Tomatoes and Metacritic crawlers (#152) read what it stores.

## Source

Two Wikidata Query Service exports per run, one after the other:

| Export | Join property | Also reads | Rows (2026-09-25) | Time |
|---|---|---|---|---|
| Shows | P4983 (TMDB TV series id) | P345 IMDb, P1258 Rotten Tomatoes, P1712 Metacritic | 64,095 | about 35 s |
| Movies | P4947 (TMDB movie id) | the same | 285,526 | about 30 s |

- The join goes through the TMDB id properties, not the `wikidata_id` TMDB stores, which few id-less titles have.
- One query over both properties hit the 60 s deadline. Without the `hint:Query hint:optimizer "None"` hint, the movie
  export also timed out, because Blazegraph started from P345, which holds millions of ids, people included.
- A query that hits the deadline still answers HTTP 200 and appends a Java stack trace. The job rejects an export
  whose rows don't all start with an entity IRI, or that has fewer than 40k (shows) or 200k (movies) rows. Nothing is
  written from a rejected export.
- Rate limits: the User-Agent names GoodWatch and a contact address. The job waits at least 60 s, and at least as long
  as the first query took, before the second. A 429 stops the run with its `Retry-After` in the error. It never
  retries.
- Only series-level and film-level values are used: `tv/<slug>` and `m/<slug>` for Rotten Tomatoes, `tv/<slug>` and
  `movie/<slug>` for Metacritic. Season and episode ids are dropped.

## Storage and precedence

| Id | Stored in | Precedence |
|---|---|---|
| IMDb | `imdb_id_override`, `imdb_id_override_source: "wikidata"`, `imdb_id_override_at` on `tmdb_movie_details` / `tmdb_tv_details` | TMDB's id (`imdb_id`, `external_ids.imdb_id`) always wins. The override is written only when TMDB has no valid `tt` id. |
| IMDb, effective | `imdb_*_rating.imdb_id` with `imdb_id_source` (`tmdb` or `wikidata`); Crate `show`/`movie` `imdb_id` and `imdb_url` | TMDB's id, else the override (`f/external_ids/imdb_ids.effective_imdb_id`). |
| Rotten Tomatoes, Metacritic | `rotten_tomatoes_url` / `metacritic_url` on `rotten_tomatoes_*_rating` / `metacritic_*_rating`, with `url_source` and `url_verified_at` | A crawled URL (`url_source: "crawl"`, or no `url_source` on older documents) is never replaced. An empty URL is filled with `url_source: "wikidata"`. A URL this job filled follows Wikidata when Wikidata changes it. |
| Wikidata's value | `wikidata_url` on the same rating documents | Always Wikidata's current value, even when the stored URL differs, so a crawler can fall back to it. |

- `url_verified_at` is when the URL's source last confirmed it: the crawler's successful fetch, or the Wikidata export
  the URL came from. A Wikidata URL is not fetched before it is stored.
- The crawlers now set `url_source: "crawl"` and `url_verified_at` whenever they store a URL.
- The details copy (`f/sync/copy/tmdb_details`), the ratings copy and the IMDb rating initializer read the effective
  id. Without that, the next details copy would clear the Crate `imdb_id` it owns.
- The IMDb dataset ingest (#149) builds its tconst-to-TMDB map from `imdb_*_rating.imdb_id`. The backfill creates the
  rating document when it doesn't exist, so a filled id reaches the ingest on its next run.

A value is skipped, and counted in the run log, when:
- Wikidata gives the title more than one value (`ambiguous`);
- the title is deleted on TMDB or missing from the catalog;
- another title already holds the IMDb id on TMDB, or the URL, or Wikidata gives the same value to two titles
  (`claimed_by_other_title`).

Disagreements with TMDB ids (`disagree_with_tmdb`) and with crawled URLs (`disagree_with_stored`) are counted, and
20 of each are printed. The job never acts on them. It never removes a value when Wikidata drops it.

Before each write, the previous values go to the Mongo collection `_backup_<YYYYMMDD>_wikidata_ids`, one document
per changed document: `collection`, `doc_id`, `tmdb_id`, `previous`, `set`, `inserted`, `run_at`.

### Ignored Wikidata values

`IGNORED` in `f/external_ids/wikidata.py` maps a title (`kind`, TMDB id) to Wikidata values that are wrong for it.
`collect_ids` drops them before planning, so the job acts as if Wikidata didn't have them, and counts them as
`ignored` in the export stats. Wikidata itself is not edited. Add an entry, with a comment saying why, when a repair
would otherwise be undone by the next weekly run. Dropping a value doesn't remove what an earlier run stored, so clear
that once, with a backup: a wrong `wikidata_url` also steers the critic crawl and the shared-URL repair.

| Title | Ignored value | Why |
|---|---|---|
| CBC's Heartland (tv 14929, tt1094229) | Metacritic `tv/heartland` | TNT's Heartland page (tv 2756, tt0839847). CBC's is `tv/heartland-2007`. The `wikidata_url` it left on 14929 was cleared on 2026-09-26 (backup in `_backup_20260926_wikidata_ids`). |

## Schedule

Windmill schedule `f/external_ids/wikidata_backfill`, Sundays at 03:30 Europe/Berlin (`0 30 3 * * SUN`), no
arguments. The daily IMDb dataset ingest runs at 04:00. Windmill schedules are not synced from the repository; this
one was created through the API. `{"dry_run": true}` runs the exports and reports the counts without writing.

## First run, 2026-09-25

The job took 7.2 minutes and wrote 133,511 documents. The backup is `_backup_20260925_wikidata_ids`.

| | Shows | Movies |
|---|---:|---:|
| IMDb ids filled | 4,677 | 8,397 |
| IMDb: agree with TMDB / disagree / ambiguous / claimed | 52,018 / 354 / 203 / 225 | 267,542 / 422 / 481 / 299 |
| Rotten Tomatoes URLs filled | 715 | 12,153 |
| Rotten Tomatoes: agree with stored / disagree / claimed | 6,568 / 882 / 26 | 44,913 / 18,067 / 885 |
| Metacritic URLs filled | 713 | 861 |
| Metacritic: agree with stored / disagree / claimed | 5,264 / 90 / 36 | 16,552 / 585 / 159 |

Most Rotten Tomatoes disagreements are legacy underscore slugs against the canonical hyphen slug (`tv/top_gear` and
`tv/top-gear`), or a year suffix the crawler guessed (`m/princess_mononoke_1997` and `m/princess_mononoke`). Many
claimed movie URLs are guesses stored on several titles, for example `m/good_night` on 11 titles.

Coverage before and after. The top 10k are the shows with the highest TMDB popularity, measured in Mongo. Popularity
updates between the two counts shifted that set a little: its TMDB-only IMDb count moved from 9,072 to 9,089.

| | Before | After |
|---|---:|---:|
| Top 10k shows with an IMDb id | 9,072 | 9,211 |
| Top 10k shows with a Rotten Tomatoes URL | 4,215 | 4,497 (276 from Wikidata) |
| Top 10k shows with a Metacritic URL | 2,821 | 3,062 (236 from Wikidata) |
| Crate `show.imdb_id` | 94,242 | 98,919 |
| Crate `movie.imdb_id` | 648,309 | 656,706 |
| `imdb_tv_rating` with an IMDb id | 94,942 | 99,815 |
| `imdb_movie_rating` with an IMDb id | 649,377 | 660,062 |
| Show Rotten Tomatoes / Metacritic URLs | 30,742 / 10,237 | 31,457 / 10,950 |
| Movie Rotten Tomatoes / Metacritic URLs | 297,432 / 85,656 | 309,592 / 86,517 |

Spot check of the five most popular shows with a new URL, one request each: 4 of 5 Rotten Tomatoes URLs returned 200
without a redirect, and `tv/knowing_bros` returned 404. All 5 Metacritic URLs returned 200 after a redirect to the
trailing-slash form.

## Follow-ups

- Sitemaps. The Rotten Tomatoes `tv-series_*` and Metacritic `tvshows.xml` sitemaps add about 96 exact-title matches
  per site for the top 10k shows ([rt-metacritic-speedup.md](research/season-episode-scores/rt-metacritic-speedup.md)
  §1.2). #150 didn't ask for them. They fit #152, which needs the sitemaps as a directory and negative cache anyway.
- #152 must fetch a Wikidata URL before trusting it: one of five checked returned 404. It should store the canonical
  URL after redirects, and compare canonical URLs rather than slugs. Done, with the sitemaps: see
  [critic-scores.md](critic-scores.md).
