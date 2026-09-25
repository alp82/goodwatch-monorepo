# Season and episode data: what GoodWatch already stores

Read-only inventory, 2026-09-25. It supports the planned per-season and per-episode score pipeline for an episode-ratings grid (rows are seasons, columns are episodes). All counts come from live production queries run on that date. Mongo used `countDocuments` with indexed or small-collection filters and `$sample`; Crate used `count(*)` aggregates.

## 1. Live databases

| Store | Role | Where it runs | Repo definition |
| --- | --- | --- | --- |
| **MongoDB 8** (`goodwatch` db) | Raw source-of-truth crawl state: TMDB details, IMDb/RT/Metacritic/TV Tropes ratings, DNA | Native `mongod` on `10.0.0.17–19:28017`, replica set | `goodwatch-mongo/primary`, `goodwatch-mongo/secondary` (Docker Compose, historical); models in `goodwatch-flows/windmill/f/*/models.py` (mongoengine) |
| **CrateDB** (`doc` schema) | Denormalized serving store read by the webapp; user data; priority queue | `10.0.0.11–13`, HTTP 4200, PG wire 5432 | `goodwatch-crate/docker-compose.yml`; table schemas in `goodwatch-flows/windmill/f/sync/models/crate_schemas.py`, row models in `crate_models.py` |
| **Qdrant** (`media_fingerprint_v1`, search collections) | Vectors and filter payloads for discovery and search | `10.0.0.20` (`qdrant-main`) | `goodwatch-qdrant/main`, schemas in `f/sync/models/qdrant_schemas.py`. It holds no season or episode fields. |
| **Redis 7.2 cluster** | Webapp response cache (`cached()` in `goodwatch-webapp/app/utils/cache.ts`) | `10.0.0.14–16:6379` | `goodwatch-cache/main`, `goodwatch-cache/replica`; see `docs/private-redis.md` |
| Windmill's bundled Postgres, Coolify DBs | Platform-internal only | `10.0.0.10` | Not application data |

**Retired:** application Postgres was removed on 2026-09-15 (`docs/postgres-final-removal.md`). `goodwatch-db/` is now an empty directory. Arango and Milvus are retired too (`docs/text-embedding-removal.md`). `f/main_db/*` and `goodwatch-webapp/app/utils/arango.ts` are dead code; no webapp route imports `arango.ts`.

Data flow: the Windmill crawlers write to Mongo. `f/sync/copy/tmdb_details.py` (`copy_media`) and `f/sync/copy/all_ratings.py` copy that data into Crate. They run from the scheduled `f/sync/populate_crate` flow and from `f/priority/publish.py` for priority titles. The webapp reads Crate, caches the results in Redis and queries Qdrant for vectors.

### Mongo collections (estimated counts)

```
tmdb_tv_details            247,027   tmdb_movie_details         1,345,129
imdb_tv_rating              95,448   imdb_movie_rating            650,274
rotten_tomatoes_tv_rating  217,081   rotten_tomatoes_movie_rating 1,157,011
metacritic_tv_rating       217,098   metacritic_movie_rating    1,155,738
tv_tropes_tv_tags          217,365   dna_tv 104,636 / genome_tv 188,749
tmdb_tv_providers        1,550,191   tmdb_daily_dump_data       1,592,845
```

No Mongo collection stores seasons or episodes.

### Crate tables relevant to shows

`show` (246,636 rows) and `season` (364,462 rows). Crate has no `episode` table. `user_watch_history` has `season_number`/`episode_number` columns for a user's watch progress, but they are not catalog data.

## 2. What a TV show record contains

### Mongo `tmdb_tv_details` (model `TmdbTvDetails`, `f/tmdb_api/models.py`)

The fetch is `GET /tv/{id}?append_to_response=aggregate_credits,alternative_titles,content_ratings,external_ids,images,keywords,recommendations,similar,translations,videos,watch/providers` (`f/tmdb_api/tmdb_fetch_details_from_api/fetch.py:140`). It does **not** call `/tv/{id}/season/{n}` and does not append `season/N`, so episode lists are never fetched.

Relevant fields:

```python
number_of_seasons = IntField()
number_of_episodes = IntField()
episode_run_time = ListField(IntField())
seasons = EmbeddedDocumentListField(Season)          # summary only
last_episode_to_air = EmbeddedDocumentField(EpisodeToAir)
next_episode_to_air = EmbeddedDocumentField(EpisodeToAir)
external_ids = EmbeddedDocumentField(ExternalIds)    # imdb_id, tvdb_id, wikidata_id, ...
vote_average = FloatField(); vote_count = IntField()

class Season(EmbeddedDocument):
    air_date, episode_count, id, name, overview, poster_path, season_number, vote_average
class EpisodeToAir(EmbeddedDocument):
    air_date, episode_number, episode_type, id, overview, production_code, runtime,
    season_number, show_id, still_path, title, vote_average, vote_count
```

Sample: Breaking Bad, `tmdb_id: 1396`, fetched 2026-09-19. Season overviews are truncated here.

```js
{ tmdb_id: 1396, title: 'Breaking Bad', number_of_seasons: 5, number_of_episodes: 62,
  vote_average: 8.951, vote_count: 18644,
  external_ids: { imdb_id: 'tt0903747', tvdb_id: 81189, tvrage_id: 18164, wikidata_id: 'Q1079',
                  freebase_mid: '/m/03d34x8', facebook_id: 'BreakingBad', ... },
  last_episode_to_air: { id: 62161, season_number: 5, episode_number: 16, title: 'Felina',
                         episode_type: 'finale', air_date: 2013-09-29, runtime: 56,
                         vote_average: 9.289, vote_count: 320 },
  seasons: [
    { id: 3577, season_number: 0, name: 'Specials', episode_count: 9,  air_date: '2009-02-17', vote_average: 0 },
    { id: 3572, season_number: 1, name: 'Season 1', episode_count: 7,  air_date: '2008-01-20', vote_average: 8.4 },
    { id: 3573, season_number: 2, name: 'Season 2', episode_count: 13, air_date: '2009-03-08', vote_average: 8.4 },
    { id: 3575, season_number: 3, name: 'Season 3', episode_count: 13, air_date: '2010-03-21', vote_average: 8.4 },
    { id: 3576, season_number: 4, name: 'Season 4', episode_count: 13, air_date: '2011-07-17', vote_average: 8.6 },
    { id: 3578, season_number: 5, name: 'Season 5', episode_count: 16, air_date: '2012-07-15', vote_average: 8.9 } ] }
```

Answers:

- **`seasons` array:** yes, TMDB season summaries including the TMDB season id, `episode_count` and `air_date`.
- **Per-season `vote_average`:** yes in Mongo (TMDB's season average). TMDB sends no per-season vote count.
- **Episode lists:** no. The only episodes stored are `last_episode_to_air` and `next_episode_to_air`, one each per show.
- **Show IMDb id:** yes, in `external_ids.imdb_id` (indexed).
- **Episode IMDb ids or ratings:** none anywhere, in any store.
- **Season-level RT or Metacritic URLs and scores:** none. The RT and Metacritic models store one show-level URL and score only, for example `https://www.rottentomatoes.com/tv/breaking_bad` and `https://www.metacritic.com/tv/breaking-bad`.

### Mongo rating collections (show level only)

```js
imdb_tv_rating:            { tmdb_id: 1396, imdb_id: 'tt0903747', user_score_original: 9.5,
                             user_score_vote_count: 25000000, updated_at: 2026-08-16,
                             error_message: 'IMDb HTTP 202', failed_at: 2026-09-19 }
rotten_tomatoes_tv_rating: { tmdb_id: 1396, rotten_tomatoes_url: 'https://www.rottentomatoes.com/tv/breaking_bad',
                             tomato_score_original: 96, tomato_score_vote_count: 250,
                             audience_score_original: 97, audience_score_vote_count: 25,
                             title_variations: ['breaking_bad'], release_year: 2008 }
metacritic_tv_rating:      { tmdb_id: 1396, metacritic_url: 'https://www.metacritic.com/tv/breaking-bad',
                             meta_score_original: 73, meta_score_vote_count: 98,
                             user_score_original: 9.4, user_score_vote_count: 18419 }
```

Each rating collection has indexes on `tmdb_id`, `popularity`, `selected_at`, `updated_at` and `is_selected`. Every document follows the crawl-state pattern (`selected_at`, `is_selected`, `failed_at`, `error_message`, `tmdb_deleted`).

Several of these values look wrong. IMDb 25,000,000 votes for Breaking Bad is implausible; it predates the current `K/M` parser, and later fetches fail with `IMDb HTTP 202`, so the bad value is never overwritten. RT's audience count of 25 also looks like a mis-parse ("250,000+ ratings"). Neither affects the season/episode design, but a new crawler should not copy these parsers.

### Crate `season` table

```
tmdb_id INTEGER (PK)  show_id INTEGER  name TEXT  season_number INTEGER  air_date TIMESTAMP
episode_count INTEGER  overview TEXT  poster_path TEXT  vote_average DOUBLE  created_at  updated_at
```

Breaking Bad in Crate: six rows (seasons 0–5) with correct `episode_count` and `air_date`, but **`vote_average` is NULL on every row**.

**Bug: `season.vote_average` is NULL in all 364,462 rows.** `f/sync/copy/tmdb_details.py:341` passes `tmdb_vote_average=season.get("vote_average")`, but the Pydantic `Season` model field is named `vote_average`. Pydantic ignores the extra keyword, so the value is always None. The webapp selects `s.vote_average` into `SeasonResult.vote_average`, so it receives NULL. `f/priority/publish.py` uses the same `copy_media`, so priority crawls have the bug too. Renaming the keyword would restore TMDB season averages on the next sync.

### Crate `show` table (serving row)

The table has one row per show, with flattened show-level scores: `tmdb_*`, `imdb_*`, `metacritic_*`, `rotten_tomatoes_*` and `goodwatch_*` (`_url`, `_original`, `_normalized_percent`, `_rating_count`/`_review_count`), plus `number_of_seasons`, `number_of_episodes`, `episode_runtime` and `imdb_id`. Breaking Bad: IMDb 9.5, RT 96/97, Metacritic 73 / 9.4, TMDB 8.951 (18,644 votes), GoodWatch overall 89.0.

## 3. Coverage (2026-09-25)

| Measure | Count | Share of 246,636 Crate shows |
| --- | ---: | ---: |
| Shows (Crate `show`) / Mongo `tmdb_tv_details` | 246,636 / 247,027 (494 flagged `tmdb_deleted`) | |
| Show IMDb id (Mongo `external_ids.imdb_id`; equals Crate `imdb_url LIKE '.../tt%'`) | **94,408** | 38% |
| IMDb show score | 76,837 | 31% |
| RT URL | 30,707 | 12% |
| RT tomatometer / audience score | 5,991 / 7,457 | 2.4% / 3.0% |
| Metacritic URL | 10,040 (Mongo 10,234) | 4% |
| Metacritic metascore / user score | 5,356 / 5,509 | 2.2% |
| TMDB show score with votes | 76,709 | 31% |
| `number_of_seasons > 0` | 196,180 | 80% |
| Crate `season` rows / distinct shows | 364,462 / 196,547 (12,120 are "Specials", season 0) | |
| Sum of `number_of_episodes` (upper bound on episode rows) | 5,736,840 | |

Shows with at least 50 TMDB votes (6,108 shows, the realistic grid audience):

| Measure | Count |
| --- | ---: |
| IMDb score | 6,034 |
| RT tomatometer | 2,286 |
| Metacritic metascore | 2,191 |
| Total episodes | 542,677 |

TMDB season `vote_average > 0` (Mongo sample): in a random 2,000 shows, 397 of 3,635 seasons (11%) have one. Among the top 1,000 by popularity, 4,308 of 10,084 seasons (43%) do. Also from the random sample, `last_episode_to_air.vote_average > 0` for 125 of 2,000 shows. TMDB episode votes are sparse outside popular shows; Breaking Bad's finale has 320 votes.

Two Crate data-quality issues:

- `show.imdb_id` is filled for only 9,830 rows. The 94k valid ids exist only in `imdb_url`.
- About 118k `imdb_url` values are the literal string `https://www.imdb.com/title/None`, left behind by older syncs.

Use Mongo `external_ids.imdb_id`, or parse `imdb_url` for `tt…`, as the IMDb join key.

## 4. How the webapp reads show data

- Route `app/routes/show.$showKey.tsx` calls `getDetailsForShow` in `app/server/details.server.ts`. The data is cached in Redis for 30 minutes under `details-show` and read from Crate via `app/utils/crate.ts` (`node-crate`).
- `_fetchFromDB` builds one CTE query. `media_data` comes from the `show` table (fields from `getFieldsByMediaType`, which includes all rating keys from `app/utils/ratings.ts`). Show pages also get a `seasons` CTE over `season WHERE show_id = … ORDER BY air_date`, which returns `{id, name, season_number, air_date, episode_count, overview, poster_path, vote_average}`. The remaining CTEs cover translations, releases, streaming, cast/crew, images and videos. Type: `SeasonResult` in `app/server/types/details-types.tsx:427`.
- The only current consumer of `seasons` is the "aired" answer in `app/ui/details/DetailsQuestions.tsx:169`, which draws an episodes-per-season bar chart. `DetailsHeader.tsx` shows `number_of_seasons`/`number_of_episodes` from the show row. `app/ui/details/DetailsContent.tsx:33–42` contains a commented-out "Ratings per Season" block, a leftover of an earlier idea.

The existing pattern fits new data: add Crate tables, add a CTE (or a separate cached loader) in `details.server.ts`, and extend the types.

## Gaps

1. **No episode catalog.** Nothing stores episode ids, numbers, titles or air dates (only `last_episode_to_air` and `next_episode_to_air`). The grid needs TMDB `/tv/{id}/season/{n}` (or `append_to_response=season/1,season/2,…`, up to 20 per call), which returns episodes with `vote_average`/`vote_count`.
2. **No episode IMDb ids.** TMDB's `/tv/{id}/season/{n}/episode/{e}/external_ids` returns them one call per episode. The better source is IMDb's `title.episode.tsv.gz` (parent tconst → season/episode → episode tconst) together with `title.ratings.tsv.gz` (averageRating, numVotes), which yields IMDb episode ratings without page crawling. The current page crawler is already blocked by `IMDb HTTP 202`.
3. **No season or episode RT/Metacritic data.** RT season pages follow `/tv/<slug>/s01`, where the show slug is already stored in 30,707 rows. Metacritic has `/tv/<slug>/season-1/`, with the show slug stored in about 10k rows. Both are show-level only today, and base coverage is low (2–3% have scores), so expect sparse cells.
4. **The TMDB season average is lost in Crate** because of the `vote_average` keyword bug above. Mongo has it.
5. **Show IMDb id is unreliable in Crate** (see the data-quality notes in section 3).
6. Season 0 ("Specials") exists for 12,120 shows; the grid should decide whether to show it.

## Suggestion: where season and episode scores should live

Follow the existing two-tier split:

- **Mongo (raw crawl state):** add a `tmdb_tv_season_details` collection with one document per `(show tmdb_id, season_number)` holding the raw TMDB season payload, including the `episodes[]` array. Give it the usual `selected_at`/`updated_at`/`failed_at` crawl fields and an index on `tmdb_id`. Store per-source episode rating state the same way, either in one `episode_ratings_<source>` collection per source keyed by `(tmdb_id, season_number, episode_number)`, or as a bulk import from IMDb datasets keyed by the episode tconst. Reuse the RT/Metacritic show slugs to derive season URLs.
- **Crate (serving):** fix `season.vote_average`, then add season-level score columns to `season` (`imdb_*`, `rotten_tomatoes_*`, `metacritic_*`, `tmdb_vote_count`, `goodwatch_*`) mirroring the `show` naming. Add a new `episode` table: primary key `(show_id, season_number, episode_number)` plus `tmdb_id`, `imdb_id`, `name`, `air_date`, `runtime`, `still_path`, `tmdb_user_score_original/_rating_count` and `imdb_user_score_original/_rating_count`, with RT/MC columns kept nullable. Shard on `show_id` so one show's grid is a single-routing read. At about 5.7M rows in total (about 0.5M for shows with 50+ votes) this is well within Crate's range.
- **Webapp:** load the grid in its own cached loader (`getEpisodeGrid(showId)`, one `SELECT … FROM episode WHERE show_id = ?`) rather than growing the details CTE, so the main details payload and cache entry stay small. Qdrant and Redis need no schema changes.
