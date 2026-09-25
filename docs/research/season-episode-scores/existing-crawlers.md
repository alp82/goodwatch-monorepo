# Existing crawlers relevant to season and episode scores

Audit date: 2026-09-25. Scope: what already exists in the repo and on the live Windmill instance that a pipeline for **per-season and per-episode scores** (for an episode-ratings grid: rows = seasons, columns = episodes) can reuse.

Paths under `goodwatch-flows/windmill/` are shortened to `f/...`. Live figures come from the read-only Windmill API (`/schedules/list`, `/jobs/completed/list`, `/jobs/completed/get_result`), read-only `mongosh` counts on `gw-mongo1`, and read-only `SELECT count(...)` on CrateDB, all taken on 2026-09-25 around 07:40 UTC.

## TL;DR

- **Nothing fetches per-episode data today.** The only per-season data is the `seasons[]` summary that TMDB embeds in `/tv/{id}`: `episode_count`, `air_date`, and a TMDB `vote_average` per season. There is no vote count per season.
- **That per-season TMDB score never reaches the site.** The CrateDB `season` table has 364,462 rows and **0 non-null `vote_average`**, because `f/sync/copy/tmdb_details.py:341` passes `tmdb_vote_average=` to a Pydantic model whose field is named `vote_average` (`f/sync/models/crate_models.py:262-271`). Pydantic silently drops the unknown keyword.
- **IMDb scraping from production is blocked.** All 500 recent `f/imdb_web/imdb_crawl_ratings/fetch` jobs failed with `IMDb HTTP 202`, an AWS WAF challenge with an empty body. There have been about 4,200 failed leaf jobs a day since 2026-09-22, and the last success was 2026-09-22 19:00 UTC. Any per-episode IMDb scraping would hit the same wall.
- **Rotten Tomatoes and Metacritic are not blocked but rarely match a page.** In a sample of 80 fetches, about 80% never found a page for their guessed slug. Only 30,721 of 217,081 RT TV records and 10,234 of 217,098 Metacritic TV records have a URL.
- **TV Tropes** is Cloudflare-challenged on production workers: 496 of the last 500 fetches failed with "Rate limit reached". It has no scores and is irrelevant here except as the model for polite, honestly identified crawling.
- **Scale.** Mongo `tmdb_tv_details` holds 246,533 non-deleted shows with 352,300 seasons and **5,736,980 episodes**. Shows with `popularity >= 10` number 10,406, with 2,006,639 episodes.
- **Reusable pieces:**
  - the TMDB API fetcher and its error handling;
  - the Mongo "source collection + completeness queue" pattern;
  - the CrateDB `crawl_priority` lease queue and `f/priority/crawl_all` fan-out;
  - the TMDB-watch shared upstream backoff (`f/tmdb_web/country_state.py`);
  - the "publish to CrateDB" sync pattern;
  - the existing `season` table and webapp query.

## 1. Crawlers and fetchers in `goodwatch-flows`

All crawlers follow the same shape:

1. An `*_init_*` script copies one source document per title from `tmdb_*_details` into a per-source Mongo collection.
2. A `next.py` reserves a batch through `f/data_source/common.py`.
3. A `crawl_all_by_id` flow runs `iterate.py`, then a for-loop over `fetch.py`.
4. Separate `f/sync/copy/*` scripts publish Mongo state to CrateDB.

Schedules exist only on the live instance. They are not stored in the repo (see [windmill-drift-2026-09-21.md](../tvtropes-repair/windmill-drift-2026-09-21.md)).

### 1.1 Shared queue helper: `f/data_source/common.py`

- `completeness_queue` (`:159-215`):
  - picks never-selected titles by `-popularity`, plus titles whose `is_selected` reservation has gone stale past `buffer_minutes`;
  - then picks the oldest `selected_at`;
  - skips `tmdb_deleted`.
- `update_selected_for_next_entries` (`:241-261`) reserves the batch by setting `selected_at` and `is_selected`.
- `priority_queue` (`:218-238`, popularity >= 10) exists but is unused; `prepare_next_entries` (`:264-267`) always uses `completeness_queue`.
- Everything is keyed by `(movie_model, tv_model)` pairs. A season or episode source would need its own model pair or a new helper, because this helper assumes one document per title.

### 1.2 TMDB API details: `f/tmdb_api/`

| | |
|---|---|
| Fetch | `f/tmdb_api/tmdb_fetch_details_from_api/fetch.py` |
| TV URL | `https://api.themoviedb.org/3/tv/{id}?api_key=…&append_to_response=aggregate_credits,alternative_titles,content_ratings,external_ids,images,keywords,recommendations,similar,translations,videos,watch/providers` (`:136-144`) |
| Movie URL | `/3/movie/{id}?append_to_response=…` (`:125-133`) |
| Auth | Windmill variable `u/Alp/TMDB_API_KEY` (`:19`). Error messages redact the key (`:31-36`). |
| Stores | Mongo `tmdb_tv_details` / `tmdb_movie_details` (models in `f/tmdb_api/models.py:455-577`) |
| Batching | `next.py` takes `BATCH_SIZE = 50` (`next.py:6`). Fetches go through `asyncio.gather` (`fetch.py:322-327`), but `requests` is synchronous, so they actually run one after another. |
| Errors | Each title's failure is isolated (`:67-80`). A TMDB 404 with `status_code 34` flags the title as deleted (`:83-117`). The batch fails if more than 50% of titles fail or any request gets a 401 (`:24-27`, `:356-376`). There is no 429 handling and no throttling. |
| Flow | `f/tmdb_api/tmdb_fetch_details_from_api.flow`: `next` (timeout 60 s), then `fetch` (timeout 300 s) |
| Seeding | `f/tmdb_api/tmdb_init_details/main.py` copies IDs from `tmdb_daily_dump_data`, which the daily dump at `http://files.tmdb.org/p/exports` fills (`f/tmdb_daily/tmdb_check_daily_dump_availability/main.py:10`). |

The TV details model already contains these season and episode fields:

- `Season` (`models.py:272-281`): `air_date`, `episode_count`, `id`, `name`, `overview`, `poster_path`, `season_number`, `vote_average`. It has no `vote_count`, because TMDB does not return one in this summary.
- `EpisodeToAir` (`models.py:256-269`), used for `last_episode_to_air` and `next_episode_to_air` (`:539-540`). It includes `vote_average` and `vote_count` for those two episodes only.
- `number_of_seasons` and `number_of_episodes` (`:542-543`), and `seasons` (`:550`).
- `ExternalIds` (`models.py:93-103`): `imdb_id`, `tvdb_id`, `tvrage_id` and `wikidata_id`. These are ready-made cross-source keys. For example, Game of Thrones has `tt0944947`, tvdb `121361` and wikidata `Q23572`.

Nothing calls `/tv/{id}/season/{n}` or `/tv/{id}/season/{n}/episode/{m}`, and no `season/N` entries are appended to `append_to_response`.

Live status:

- Scheduled `10/15 * * * * *` (every 15 s, but a run never overlaps the previous one).
- 160 of the last 200 flow runs succeeded. All 40 failures were step `a` (`next.py`) hitting its 60 s timeout, which means the Mongo selection query is slow.
- All 500 recent `fetch` leaf jobs succeeded.

### 1.3 IMDb: `f/imdb_web/`

| | |
|---|---|
| Fetch | `f/imdb_web/imdb_crawl_ratings/fetch.py`. Uses plain `requests.get("https://www.imdb.com/title/{imdb_id}/")` with a spoofed Chrome/58 User-Agent (`:39-51`). |
| Parse | Requires HTTP 200 and a verified canonical URL (`:50-56`). Score comes from `[data-testid="hero-rating-bar__aggregate-rating__score"] span:nth-child(1)`; the vote count sits in a sibling `div` (`:59-83`). |
| Stores | Mongo `imdb_tv_rating` / `imdb_movie_rating`: `user_score_original`, `user_score_normalized_percent`, `user_score_vote_count` (`models.py:27-63`) |
| Seeding | `imdb_init_ratings/main.py` copies titles that have `external_ids.imdb_id` (`:22-25`, `:90-111`). The per-title variant is `update.py`, used by `crawl_all`. |
| Batching | `next.py` takes 15 titles with a 10 min buffer (`next.py:6-7`). `crawl_all_by_id` runs sequentially (`parallel: false`) with `skip_failures: true`. Each fetch retries 4 times with exponential backoff: 2 s base, multiplier 6, 50% jitter (`crawl_all_by_id.flow/flow.yaml:31-47`). |
| Errors | On failure it keeps the old score, sets `failed_at` and `error_message` to e.g. `IMDb HTTP 202`, and releases the title (`fetch.py:140-157`). Background: [retirement-processing-fixes.md](../../retirement-processing-fixes.md) ("IMDb freshness"). |
| Tests | `goodwatch-flows/tests/test_imdb_fetch.py` |

Live status:

- Crawl scheduled `12/20 * * * * *`; init at `0 0 11 * * *` (daily 11:00).
- The flow-level jobs all show "success" only because of `skip_failures`.
- All 500 recent leaf `fetch` jobs failed with `IMDb HTTP 202`. By day (UTC): 288 failures on 09-22, 4,215 on 09-23, 4,158 on 09-24 and 1,339 so far on 09-25. No leaf succeeded in that window. The last successful leaf ran at 2026-09-22 19:00 UTC.
- Mongo: `imdb_tv_rating` has 95,448 documents, 76,840 of them with a score, and 2,634 currently marked `IMDb HTTP 202`.
- 12 of 14 recent `imdb_init_ratings` runs succeeded. The median run takes 46 minutes.

Nothing is per-episode. Prior art: the retired 2024 webapp scraper fetched `https://www.imdb.com/title/{id}/episodes?season={n}` and read `.eplist .ipl-rating-star__rating`. It is in git at `e76633cf^:goodwatch-webapp/app/server/ratings/imdb-scraper.ts:37-66`, and that markup no longer exists.

### 1.4 Rotten Tomatoes: `f/rotten_web/`

| | |
|---|---|
| Fetch | `rotten_tomatoes_crawl_ratings/fetch.py`. Uses **Playwright Chromium** (`playwright==1.62.0`, `:1-2`) with a default context: headless user agent, no custom headers (the headers block is commented out at `:103-108`). Timeout 180 s (`:20`). |
| URLs | Guesses `https://www.rottentomatoes.com/tv/{title_underscored}[_{year}]` from `title_variations` (`:67-87`). The variations are built from the title and US English alternative titles (`rotten_tomatoes_init_ratings/main.py:91-131`). |
| Parse | Reads `script#media-scorecard-json` for `criticsScore`, `audienceScore` and `overlay.audienceAll` (`fetch.py:133-182`). |
| Stores | Mongo `rotten_tomatoes_tv_rating`: tomato and audience scores with their counts, plus `rotten_tomatoes_url` (`models.py:31-73`) |
| Rate limit | A 403 returns `rate_limit_reached` (`:114-125`). `store_result` then sets `failed_at` (`:234-239`) and the job raises so Windmill retries it (`:275-278`). |
| Batching | 3 titles per run with a 30 min buffer (`next.py:6-7`), run sequentially. Retries are the same as IMDb. |

Live status:

- Crawl scheduled `14/20 * * * * *`; init at `0 0 5 * * *`.
- All 500 recent `fetch` leaves succeeded. In a sample of 80 results, 65 found no URL, 9 found a URL but no score, and 6 found a scored page. There were no 403s.
- Only 6 of the last 13 init runs succeeded; each takes about 4.4 h.

Nothing is per-season. Prior art: the 2024 scraper used `/tv/{slug}/s{NN}` (`e76633cf^:goodwatch-webapp/app/server/ratings/rottentomatoes-scraper.ts:19-55`). RT does have season pages, and episode pages at `/tv/{slug}/s{NN}/e{NN}`, but the existing parser has only been used on title pages.

### 1.5 Metacritic: `f/metacritic_web/`

| | |
|---|---|
| Fetch | `metacritic_crawl_ratings/fetch.py`. Uses plain `requests.get` with the Chrome/58 User-Agent, **no timeout** (`:58-65`). |
| URLs | Guesses `https://www.metacritic.com/tv/{title-dashed}[-{year}]` (`:41-56`). Variations come from `to_dashed` (`metacritic_init_ratings/main.py:114-131`). |
| Parse | Metascore from `.c-siteReviewScore[title^="Metascore"] span`, user score from `.c-siteReviewScore[title^="User score"] span`, counts from the `.c-ScoreCard` review links (`:99-106`) |
| Stores | Mongo `metacritic_tv_rating`: meta and user scores with counts, plus `metacritic_url` (`models.py:31-73`) |
| Rate limit | A 403 returns `rate_limit_reached` and the job raises (`:69-79`, `:203-206`). Any status other than 200 still gets parsed, and the loop keeps the **last** response (`:62-93`). That is a latent bug: a 404 page gets "parsed" and advances `updated_at`. |
| Batching | 6 titles per run with a 10 min buffer (`next.py:6-7`), run sequentially. |

Live status:

- Crawl scheduled `0 */2 * * * *` (every 2 min); init at `0 0 8 * * *`.
- All 500 recent leaves succeeded. In a sample of 80, 71 found no URL and 8 found a scored page. There were no 403s.
- Only 4 of the last 14 init runs succeeded.

Nothing is per-season. Prior art: the 2024 scraper used `/tv/{slug}[-{year}]/season-{n}` (`e76633cf^:goodwatch-webapp/app/server/ratings/metacritic-scraper.ts:18-65`). Metacritic has season pages with a Metascore and user score per season, and no episode scores.

### 1.6 TV Tropes: `f/tvtropes_web/` (tags, no scores)

- `tv_tropes_crawl_tags/fetch.py`:
  - Playwright with an honest user agent, `GoodWatchBot/0.1 (+https://goodwatch.app; contact …)` (`:25-28`).
  - At least 4 s between navigations via `paced_goto` (`:29-41`).
  - Caps candidate URLs at 60 per title (`:103-105`).
  - Treats 403, 429 or `cf-mitigated: challenge` as blocked (`:172-178`).
- Stores `tvtropes_*_tags.tropes` in Mongo (`models.py:40-77`).

Live status:

- The dedicated schedule `16 * * * * *` is **off**. The crawler runs only inside `f/priority/crawl_all`.
- 496 of the last 500 leaves failed with "Rate limit reached …" (Cloudflare challenge on the datacenter IP).
- Documented in [tvtropes-repair/access-options-2026-09-21.md](../tvtropes-repair/access-options-2026-09-21.md) (addendum L148-191) and [scheduled-rollout-2026-09-21/README.md](../tvtropes-repair/scheduled-rollout-2026-09-21/README.md).

TV Tropes has per-episode `Recap/` pages, but they contain no scores.

### 1.7 TMDB watch pages (streaming): `f/tmdb_web/`

- `tmdb_crawl_providers/fetch.py` scrapes the TMDB website's watch page, not the API.
  - It sends `requests.get` with headers `Accept-Language: en-US` and `User-Agent: Mozilla/5.0` and a 15 s timeout (`:76-86`).
  - It treats 403, 429, or a page titled "Request Error (403)" as a rate limit and honours `Retry-After` (`:29-44`, `:87-100`).
- Mongo `tmdb_{movie,tv}_providers` holds one document per title and country.
- It has the most robust concurrency and backoff in the repo, in `f/tmdb_web/country_state.py`:
  - per-country lease claims: `claim` at `:50`, `LEASE_DURATION` of 5 min at `:17`;
  - 7-day freshness (`:16`);
  - failure backoff with jitter (`save_failure` at `:129-142`);
  - a **shared upstream deadline** in Mongo `tmdb_streaming_upstream` (`upstream_deadline` at `:120-124`, written at `:159-160`), so one worker's rate limit pauses all workers.
  - Background: [streaming-country-retries.md](../../streaming-country-retries.md).
- `crawl_all_by_id` runs with `parallel: true, parallelism: 3` (`f/tmdb_web/crawl_all_by_id.flow/flow.yaml:47-50`).

Live status:

- Scheduled `18/20 * * * * *`; init at `0 0 0 * * * *`.
- In a sample of 100 leaves: 60 fetched, 40 "failed" (34 were TMDB 404s, 5 were country mismatches). No rate limits.

### 1.8 Other fetch helpers (mostly dead)

- `f/data_source/request_with_proxy.flow/`:
  - An abandoned experiment that pulls free proxy lists from proxyscrape (`a.inline_script.py:4-8`) and free-proxy-list.net (`d.inline_script.py:6-15`).
  - It picks proxies at random (`b.inline_script.py:5-22`) and has a hardcoded proxy IP test (`c.inline_script.py:5`).
  - No crawler uses it.
  - Rotating proxies and challenge evasion are ruled out by the owner's TV Tropes decisions ([access-options-2026-09-21.md](../tvtropes-repair/access-options-2026-09-21.md) L3-7).
- `f/utils/web.py` provides `url_exists` (HEAD request) and `fetch_file_from_url`.
- `f/other/screenshot.py` provides a Playwright screenshot.
- `f/other/proxy/bland.ts` is an API wrapper for bland.ai, unrelated to crawling.
- `goodwatch-proxy/` is **not** an egress proxy. It is a Caddy reverse proxy for inbound subdomains: PostHog, Uptime Kuma, Windmill (`goodwatch-proxy/Caddyfile`).
- No code exists for Trakt, Wikidata, TVmaze, TheTVDB, OMDb, or the IMDb bulk datasets (`datasets.imdbws.com`, `title.ratings.tsv`, `title.episode.tsv`). A grep over the whole repo found only competitor mentions and TODO notes: `TODO.md:853` (TVmaze API), `TODO.md:1721-1727` (mdblist, thetvdb).

## 2. How show scores are stored and consumed

### 2.1 Mongo to CrateDB

- `f/sync/copy/all_ratings.py` merges several Mongo collections into one CrateDB `show` row per title (`:95-344`):
  - `tmdb_tv_details` (`vote_average`, `vote_count`);
  - `imdb_tv_rating`;
  - `metacritic_tv_rating`;
  - `rotten_tomatoes_tv_rating`.
- The GoodWatch aggregate scores are simple averages of the normalized percents:
  - user score: TMDB, IMDb, Metacritic user and RT audience (`:231-247`);
  - official score: Metascore and Tomatometer (`:250-262`);
  - overall: the mean of the user and official scores (`:265-277`).
  - The counts are sums.
- Schedule `0 0 1/6 * * *` (every 6 h) with a 48 h `updated_at` lookback (`:23`, `:117-121`). 67 of 67 recent runs succeeded.
- The `show` table columns are in `f/sync/models/crate_schemas.py:197-` (score columns around `:242-263`).
- CrateDB counts: 246,636 shows. 76,837 have an IMDb score, 5,991 a Tomatometer and 5,356 a Metascore.

### 2.2 Seasons in CrateDB

- `f/sync/copy/tmdb_details.py:326-342` writes one `season` row per TMDB season summary.
- The table is `season (tmdb_id PK, show_id, name, season_number, air_date, episode_count, overview, poster_path, vote_average)` (`crate_schemas.py:320-334`). The model is at `crate_models.py:262-271`.
- **Bug:** the call passes `tmdb_vote_average=season.get("vote_average")` (`tmdb_details.py:341`), but the model field is `vote_average`. As a result, `SELECT count(vote_average) FROM season` returns 0 of 364,462 rows. Mongo has 18,795 shows with at least one season `vote_average > 0`.
- No episode table exists.

### 2.3 Webapp (`goodwatch-webapp`)

- **Loader.** `app/routes/show.$showKey.tsx:54` calls `getDetailsForShow`. That goes to `app/server/details.server.ts:43-53`, which has a 30 min Redis cache, and then to `_fetchFromDB` (`:98-526`), which runs one CrateDB query `FROM show WHERE tmdb_id = …` (`:120`).
- **Score fields.** Listed in `COMMON_FIELDS` (`app/server/types/details-types.tsx:303-330`). The `AllRatings` type is at `app/utils/ratings.ts:5-34`.
- **Score UI:**
  - `app/ui/details/hero/ScoreRing.tsx` shows the overall score.
  - `app/ui/details/hero/RatingChips.tsx:12-43` shows chips for IMDb, Metacritic critics and user, and RT critics and audience. TMDB is not shown.
  - Both are placed in `DetailsHero.tsx:39-45`.
  - The Q&A cards use scores too: `titleQuestions.ts:50-63` ("worth") and `:125-138` ("agree").
- **Seasons query.** The `seasons AS (...)` CTE at `details.server.ts:146-162` selects `vote_average` among other columns. It is returned as `seasons` (`:502`) and typed as `SeasonResult` (`details-types.tsx:427-436`).
- **Existing season UI.** It is minimal:
  - "N Episodes in M Seasons" in the header (`DetailsHeader.tsx:58-66,101-110`);
  - a bar chart of `episode_count` per season in the "aired" Q&A card (`DetailsQuestions.tsx:168-182`, `titleQuestions.ts:199-207`).
  - There is **no per-season or per-episode rating UI**.
- **Dead code worth reviving:**
  - `app/ui/ratings/Ratings.tsx` takes `compact` and `title` props intended for per-season use. It is imported only in commented-out "Ratings per Season" code at `DetailsContent.tsx:34-41`.
  - A `ratings` section is commented out at `app/ui/details/sections.ts:6-9`.
  - A "Seasons" nav entry is commented out at `app/ui/explore/main-nav.ts:117-124`.
- **Other mismatch.** The query selects `episode_runtime`, but the type and `titleQuestions.ts:92` read `episode_run_time`.
- **History.** Early 2024 had live per-season scraping in a webapp route: `goodwatch-webapp/app/routes/api/ratings/tv-seasons.tsx` and `getRatingsForTVSeasons` in `app/server/ratings.server.ts:104-150`, both at commit `e76633cf^`. It was removed in the Remix v2 upgrade (commit `e76633cf`). It scraped IMDb, Metacritic and RT per season at request time.

## 3. Infrastructure worth reusing

- **Priority queue.**
  - Demand comes from the webapp: `increasePriority` (`app/server/utils/priority.ts:9-25`) upserts `crawl_priority.demand` on poster impressions.
  - `f/priority/queue.py` provides OCC lease claims: 2 h lease, 7-day cooldown (`:6-9`, `:39-90`); `acknowledge` (`:93-124`) and `release` (`:127-146`).
  - `f/priority/next.py:28-76` claims **one movie and one show per run**.
  - `f/priority/crawl_all.flow/flow.yaml` then:
    - refreshes TMDB details (`:17-38`);
    - runs a `branchall` over IMDb, Metacritic, RT, TV Tropes, TMDB streaming and Fingerprint, each as `init/update` followed by `crawl_all_by_id` (`:39-259`);
    - calls `f/priority/publish` to push only those TMDB IDs to CrateDB and Qdrant (`publish.py:31-82`);
    - calls `f/priority/reset`.
  - It is scheduled `*/20 * * * * *`, and 200 of 200 recent runs succeeded.
  - Design doc: [postgres-retirement.md](../../postgres-retirement.md) L72-95.
- **Browser.** Playwright 1.62 Chromium is available on the default workers. Scripts declare it with `# extra_requirements: playwright==1.62.0`, as in RT `fetch.py:1-2` and TV Tropes. Notes: [playwright-1.62-upgrade.md](../playwright-1.62-upgrade.md), including that headless user agents trigger Cloudflare and that zombie Chrome processes are a known issue (`TODO.md:1934-1938`).
- **Egress.** All workers share one datacenter IP (`10.0.0.10` host). There is no proxy pool, and the owner has ruled out evasion. IMDb (AWS WAF 202) and TV Tropes (Cloudflare) already block this IP.
- **Conventions for a new crawler:**
  1. Create a folder `f/<source>_web/` containing `folder.meta.yaml`, `models.py` (mongoengine `Document` pairs plus a Pydantic `*CrawlResult`), `<x>_init_*/{main,update}.py`, `<x>_crawl_*/{next,iterate,fetch}.py`, and the flows `<x>_crawl_*.flow`, `crawl_all_by_id.flow` and `<x>_init_*.flow`.
  2. Each script needs `.script.yaml` and `.script.lock`. Generate them with `wmill script generate-metadata`.
  3. Add a publish step in `f/sync/copy/` and register it in `f/priority/publish.py:53-59`.
  4. Add a branch to `crawl_all`.
  5. Write unittest-style tests in `goodwatch-flows/tests/test_<x>.py`, putting `windmill/` on `sys.path` and patching `requests` and Mongo (see `test_imdb_fetch.py:1-40`).
  6. Deploy: pushing to `main` under `goodwatch-flows/**` runs `wmill sync push` (`.github/workflows/push-windmill-workspace.yml:42-66`).
  7. Schedules are **not** synced from git. Create them in the Windmill UI or API.
- **Monitoring.** `f/monitoring/check` runs every 5 min and `backlog_collection.py:153-189` reads `crawl_priority`. See [backlog-monitoring.md](../../backlog-monitoring.md) and [workflow-monitoring.md](../../workflow-monitoring.md). Rate-limit failures count as tolerable backoff.

## 4. Relevant docs

- [retirement-processing-fixes.md](../../retirement-processing-fixes.md) ("IMDb freshness", L17-19): IMDb returns 202 with an empty body. Failures must not advance `updated_at`.
- [tvtropes-repair/access-options-2026-09-21.md](../tvtropes-repair/access-options-2026-09-21.md): the access policy the owner accepted. No evasion, no proxy rotation. Use an honest user agent, space requests, stop on 403, 429 or `cf-mitigated: challenge`. Also covers Cloudflare Verified Bots and Web Bot Auth.
- [streaming-country-retries.md](../../streaming-country-retries.md): lease, jittered backoff and shared upstream deadline design.
- [postgres-retirement.md](../../postgres-retirement.md) L72-95: `crawl_priority` semantics.
- `TODO.md:90-98` states the feature intent: TV seasons, episodes, "ratings for seasons and episodes: tmdb, imdb, metacritic, rt", and a "score matrix" (reference: tvcharts.co). `TODO.md:1318` adds "scores: history + by season + by episode", and `TODO.md:1868` points to the old `tv-seasons.tsx`.
- [roadmap-backlog-reconciliation.md](../roadmap-backlog-reconciliation.md) L82 and L195 list TV seasons as unresolved.
- No ADR covers crawling. `CONTEXT.md` has no terms for external ratings, crawl priority or source freshness.

## 5. What can be reused directly

1. **TMDB API fetcher** (`f/tmdb_api/tmdb_fetch_details_from_api/fetch.py`): key handling, redaction, per-title failure isolation, and 404 deletion semantics. TMDB is the cheapest source of per-episode scores and the one least likely to block. It is also the canonical source of the season and episode skeleton (numbers, air dates, still images) that every other source must map onto.
2. **ID mapping**: `external_ids.imdb_id`, `tvdb_id` and `wikidata_id` are already stored on every TV details document.
3. **Queue patterns**:
   - `completeness_queue` for background coverage;
   - `crawl_priority` + `crawl_all` for on-demand freshness of the shows people actually look at;
   - `country_state` for per-subunit leases, backoff, and a shared upstream deadline. That last one fits "one lease per (show, season)" well.
4. **Publish path**: the `f/sync/copy/*` + `f/priority/publish.py` pattern, the existing CrateDB `season` table, and the webapp `seasons` CTE.
5. **Polite-crawler template**: TV Tropes `paced_goto`, `is_blocked` and the honest user agent.
6. **UI scaffolding**: `Ratings.tsx` (`compact` and `title` props), the commented-out "Ratings per Season" slot and `ratings` section, and the per-season bar chart in `DetailsQuestions.tsx`.

## 6. Gaps

- **No episode data at all.** There is no Mongo collection, no CrateDB table and no webapp type. At the full catalog's 5.7M episodes, storage and crawl budget need a scope decision. Candidate scopes are popular shows only (2.0M episodes at `popularity >= 10`) or on-demand via `crawl_priority`.
- **The season TMDB score is lost** in publication (the `tmdb_vote_average` bug above). There is no season vote count because the TMDB season summary has none; the per-season endpoint gives per-episode `vote_count`.
- **IMDb is blocked** for datacenter scraping (HTTP 202 WAF). Per-episode IMDb scores would need another route. Options not present in the repo: the official non-commercial IMDb datasets (`title.episode.tsv.gz` + `title.ratings.tsv.gz`), which need a licence check for a commercial site; or a licensed API. The current crawler also burns about 4,000 failing jobs a day and should be paused or backed off independently of this work.
- **Title-level RT and Metacritic matching is weak** (slug guessing, about 80% misses in the sample). Season URLs built from the same guesses inherit that. Season crawls should start only from a **verified** `rotten_tomatoes_url` / `metacritic_url`, which `TODO.md:1862` already asks for ("existing crawlers use existing url instead of guessing").
- **No shared upstream backoff** for IMDb, RT or Metacritic. Each only raises on 403 and relies on Windmill retries (4 retries, multiplier 6). There is no `Retry-After` handling and no 429 handling in RT or Metacritic. Metacritic has no request timeout and parses non-200 responses.
- **No egress options.** There is one IP and no proxy, by policy.
- **No sources for** Trakt (it has a free API with per-episode ratings), TVmaze (free, per-episode `rating.average`), Wikidata or OMDb.
- **Schedules are not in git.** Adding a crawler requires a manual schedule creation step.

## 7. Suggested integration points

1. **Fix first (small, independent):** rename `tmdb_vote_average` to `vote_average` in `f/sync/copy/tmdb_details.py:341`. Seasons then get TMDB scores in CrateDB on the next `f/sync/copy/tmdb_details` run (every 12 h, 48 h lookback). A full-lookback run is needed to backfill older titles.
2. **TMDB seasons and episodes source (new `f/tmdb_api/` sibling):**
   - Fetch `/3/tv/{id}/season/{n}` per season. Alternatively, piggyback on the existing details call with `append_to_response=season/1,season/2,…`; TMDB caps `append_to_response` at 20 items, so check this against current TMDB docs.
   - Store in a Mongo `tmdb_tv_seasons` collection (one document per show and season, episodes embedded). Enqueue through `completeness_queue` for background work and add a `crawl_all` branch for on-demand work.
   - Trigger re-fetches when `last_episode_to_air` or `number_of_episodes` changes in `tmdb_tv_details`. That is cheap change detection.
3. **CrateDB:** extend `season` with vote count and aggregated external scores, and add an `episode` table (`show_id`, `season_number`, `episode_number`, `air_date`, `name`, `still_path`, plus per-source score, count and url columns). Publish from a new `f/sync/copy/season_scores.py` and register it in `f/priority/publish.py:53-59`.
4. **External per-season scores (RT, Metacritic):** add them as `crawl_all` branches that act only when the title-level record has a verified URL. Derive `/s{NN}` (RT) or `/season-{n}` (Metacritic) from that URL. Reuse the TV Tropes pacing and blocked-detection and the `country_state`-style shared upstream deadline.
5. **IMDb per-episode:** do not extend `f/imdb_web` scraping. Evaluate the IMDb datasets (a daily bulk import job modeled on `f/tmdb_daily`, joined through `external_ids.imdb_id`) or a licensed source, and decide on licensing first.
6. **Webapp:** add episode rows to the `details.server.ts` query, or better a separate lazy loader, because the grid can be large. Render it in the commented-out `ratings` section slot (`sections.ts:6-9`, `DetailsContent.tsx:33-42`).
