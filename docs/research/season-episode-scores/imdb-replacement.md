# Replacing the `imdb_web` crawler

Researched 2026-09-25. The question is how GoodWatch can get IMDb data quickly and reliably now that every production fetch of `www.imdb.com` is blocked. The owner has decided that GoodWatch is and stays non-commercial, so the IMDb non-commercial datasets are an accepted source.

Rules followed: no challenge solving and no proxies. I sent one request per probe with an honest user agent (`GoodWatchBot/0.1 (+https://goodwatch.app)`) and stopped at the first 403 or 202. Background: [existing-crawlers.md](existing-crawlers.md), [existing-data.md](existing-data.md), [external-sources.md](external-sources.md).

Paths under `goodwatch-flows/windmill/` are shortened to `f/...`. Numbers come from:
- a download of the 2026-09-24 dataset run (`x-amz-meta-run-date: 2026-09-24`);
- a read-only Mongo export of `tmdb_tv_details` (246,533 non-deleted shows), `imdb_{tv,movie}_rating` and movie IMDb ids;
- read-only `SELECT count(...)` queries on CrateDB;
- scratch scripts, which are not committed.

## TL;DR

- **The crawler collects three numbers per title:** rating, vote count, and the normalized percent. `title.ratings.tsv.gz` (8.7 MB) covers all three. It gives exact vote counts, where the page only showed "2.5M", and it covers every episode as well. The crawler collects nothing else. Plot and Metacritic come from TMDB and from the Metacritic crawler.
- **Proposed daily ingest:** download 2 files (63 MB), join them in DuckDB (1.2 s, 411 MB RSS in a local test), and bulk-write only the values that changed into the existing Mongo `imdb_*_rating` collections. The Crate/Qdrant sync then works unchanged. The same run fills a new episode table for the episode grid.
- **Breaking Bad shows "25M" votes because of a parser bug.** The parser in use before 2026-09-11 deleted the `.` in "2.5M", turning it into "25M" = 25,000,000. That inflated **8,591 shows and 38,098 movies about 10×**. The values are still live because every fetch since then has failed. `goodwatch_*_voting_count`, which drives popularity sorts and thresholds, inherits the inflation.
- **The block is on the user agent and on policy, not on our IP.** One honest request got **HTTP 403 from CloudFront** from both the dev machine (residential IPv4) and production (Hetzner IPv6). `robots.txt` now has `User-agent: * / Disallow: /` with an allowlist of search and social bots. That rule was already in place on 2026-09-01 (Wayback). `caching.graphql.imdb.com` also returned 403. Scraping has no legitimate path left.
- **ID coverage is better than "38%" suggests.** 62% of shows have no IMDb id, but almost all of them are long-tail. Only **272 of 16,675 shows with ≥10 TMDB votes (1.6%)** lack one. Wikidata adds 5,116 ids in one 9-second SPARQL query.
- **The Crate id problems are sync bugs, not missing data.** `/title/None` comes from a 2025 sync, and a `COALESCE` upsert never clears it. `movie.imdb_id` is empty in all 1.34M rows because a projection drops it.

## 1. What `imdb_web` collects and who reads it

`f/imdb_web/imdb_crawl_ratings/fetch.py:39-99` fetches `https://www.imdb.com/title/{id}/` and parses only the hero rating bar. The fields are stored in Mongo `imdb_{movie,tv}_rating` (`f/imdb_web/models.py:27-47`).

| Field (Mongo → Crate) | Where it is used | Replacement |
|---|---|---|
| `user_score_original` → `imdb_user_score_original` | Hero IMDb chip (`app/ui/details/hero/RatingChips.tsx:12,41`), `RatingBadges.tsx:129`, `Ratings.tsx:69`, Q&A cards (`titleQuestions.ts:56,135`), showcase (`showcase-examples.server.ts:125`), discover select (`discover.server.ts:665`) | `title.ratings.averageRating` |
| `user_score_normalized_percent` → `imdb_user_score_normalized_percent` | The GoodWatch user score average (`f/sync/copy/all_ratings.py:231-247`) and the Qdrant payload (`f/sync/copy/vector_data.py:229-263`), which feeds recommendations (`app/server/utils/recommend.ts:268`, `guest-recommendations`, `related`, `user-recommendations`) | `averageRating × 10` |
| `user_score_vote_count` → `imdb_user_score_rating_count` | Summed into `goodwatch_user_score_rating_count` and `goodwatch_overall_score_voting_count` (`all_ratings.py:240-277`). Those drive `ORDER BY … voting_count` and thresholds such as `>= 1000` in `discover.server.ts:442`, `>= 10000` in `smart-titles.server.ts:185,226` and `>= 500` in `popular-picks.server.ts:63,100` | `title.ratings.numVotes` (exact) |
| `imdb_url` (built from the TMDB id, not crawled) | Chip link | Unchanged. Fix the `/title/None` rows (§3). |
| `imdb_id` (from TMDB) | JSON-LD `sameAs` (`app/utils/meta.ts:126`), search dedup identity (`combined-search/search.server.ts:306`, `search/SearchJourney.tsx:379`) | Unchanged. Fix the empty `movie.imdb_id` (§3). |

The crawler never collected a Metacritic score, a plot, cast or genres from IMDb. Those come from TMDB and `f/metacritic_web`. Nothing in the webapp needs an IMDb field that the datasets lack.

## 2. The IMDb non-commercial datasets

### 2.1 Files

The file list is from [data.imdb.com/non-commercial-datasets](https://data.imdb.com/non-commercial-datasets/). The page says "The data is refreshed daily" and that customers "can hold local copies of this data". Sizes and dates come from `HEAD` requests on 2026-09-25.

| File | Size | Columns | Use for GoodWatch |
|---|---:|---|---|
| `title.ratings` | 8.7 MB | tconst, averageRating, numVotes | **Required**: show, movie and episode ratings. There are 1,713,837 rows. Titles with fewer than 5 votes are omitted. |
| `title.episode` | 54.8 MB | tconst, parentTconst, seasonNumber, episodeNumber | **Required**: the episode grid. 9,909,561 rows. |
| `title.basics` | 227.6 MB | tconst, titleType, primaryTitle, originalTitle, isAdult, startYear, endYear, runtimeMinutes, genres | Optional. Useful for id matching and for title-type checks. Not needed daily. |
| `title.crew` | 83 MB | tconst, directors, writers | Not needed; TMDB credits cover it. |
| `title.principals` | 784 MB | tconst, ordering, nconst, category, job, characters | Not needed. |
| `title.akas` | 515 MB | titleId, ordering, title, region, language, types, … | Only useful for fuzzy matching of non-English titles. Not worth the size. |

Downloads from the dev machine took 0.27 s, 0.70 s and 2.25 s for ratings, episode and basics. The files are on S3/CloudFront and return an `etag` and `last-modified`. The daily run lands around 00:40 UTC.

**Terms:** "personal and non-commercial use", with the attribution "Information courtesy of IMDb (https://www.imdb.com). Used with permission." ([IMDb help](https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX)). The same page forbids republishing the data "to create any kind of online/offline database of movie information". The owner has accepted the non-commercial constraint. Showing ratings next to our own titles is the same use the scraper had. Add the attribution line in the footer or on `/how-it-works`.

### 2.2 Coverage for our catalog

| | Count |
|---|---:|
| Shows with a TMDB `external_ids.imdb_id` | 93,805 of 246,533 |
| …of those with a `title.ratings` row | 79,627 (today's crawler has 76,840 scored) |
| …with at least one rated episode | 38,455 shows, 799,915 rated episodes |
| Episodes of our mapped shows in `title.episode` | 4,126,981 (792,401 rated) |
| Seasons with at least one rated episode | 73,778 |
| Movies with an IMDb id in Mongo | 648,325 of 1,344,143 |
| …with a `title.ratings` row | 542,038 (today's crawler has 463,076 scored) |

Breaking Bad from the join: show 9.5 with 2,680,743 votes. The vote-weighted season means are S1 8.73, S2 8.82, S3 8.74, S4 9.12 and S5 9.46; S5 has 1,897,997 episode votes.

### 2.3 Mapping shows to tconsts

Coverage of IMDb ids by show popularity (TMDB vote count):

| Shows with ≥ N TMDB votes | Total | Without IMDb id |
|---|---:|---:|
| 0 | 246,533 | 152,128 (61.7%) |
| 1 | 76,944 | 18,608 (24.2%) |
| 10 | 16,675 | 272 (1.6%) |
| 50 | 6,107 | 42 (0.7%) |

The gap is almost entirely long-tail titles, which have no IMDb ratings to show anyway. Options, in order:

1. **TMDB `external_ids`**: already the source, via `f/tmdb_api` with `append_to_response=external_ids`. Keep it as the primary key. A reverse lookup does not help. `GET /3/find/{tt}?external_source=imdb_id` for 4 highly voted IMDb series that have no GoodWatch show returned no TV result for any of them. TMDB lacks those shows, not just the link.
2. **Wikidata**, P4983 (TMDB TV series ID) paired with P345 (IMDb ID). One SPARQL query over the whole of Wikidata returned 57,811 pairs in 9 s:
   - For shows that already have an id, 52,016 agree and 371 disagree, a 0.7% conflict rate.
   - It adds **5,116 shows** that have no id today; 4,177 of them have an IMDb rating, but only 99 have ≥10 TMDB votes.
   - Run it weekly and only fill ids that are missing. Log the disagreements; do not overwrite TMDB.
   - Only 1,287 id-less shows carry a `wikidata_id` in TMDB, so the query has to go through P4983, not the TMDB-stored QID.
3. **Join on title and year** against `title.basics` (tvSeries/tvMiniSeries, normalized primary or original title, `startYear` = first-air year):
   - Validated on shows that already have an id: 66,737 correct and 982 wrong, **precision 98.5%**. 18k found no match and 1.2k were ambiguous.
   - On shows without an id it finds 20,788 unique matches, 12,087 of them rated, but only 147 among shows with ≥10 votes. 229 tconsts would be claimed by more than one show.
   - A 1.5% error rate would put wrong ratings on pages. Use it only as a **candidate** that needs a second signal, such as an episode count within ±10% of TMDB's `number_of_episodes` or a match with the Wikidata id. Otherwise skip it; the payoff is small.
4. Movies use the same approach. TMDB `imdb_id` covers 48% of movies, and Wikidata P4947 (TMDB movie ID) plays the same role.

## 3. Bugs found on the way

### 3.1 Breaking Bad "25M" votes

The Mongo record reads `user_score_vote_count: 25000000`, `updated_at: 2026-08-16`. The dataset has **2,680,743**.

The parser in use until `c69dbf22` (2026-09-11), shown via `git show f28ec30e^:…/imdb_crawl_ratings/fetch.py`, did this:

```python
vote_count = int(vote_count_text.replace(".", "").replace("K", "000").replace("M", "000000")...)
```

The page shows "2.5M", which becomes "25M" and then 25,000,000. "2.2K" likewise became 22,000; `tt0000001` stores 22,000 against 2,231 in the dataset. Any abbreviated count with a decimal was inflated 10×.

`c69dbf22` fixed the parser, but no fetch has succeeded since, so the bad values remain.

Comparison of stored counts with `title.ratings`:

| | Scored docs | ≈1× | ≈10× (7–14×) | Other |
|---|---:|---:|---:|---:|
| `imdb_tv_rating` | 76,840 | 65,008 | **8,591** | 2,311, plus 930 not in the dataset |
| `imdb_movie_rating` | 463,076 | 403,440 | **38,098** | 14,149, plus 7,389 not in the dataset |

The worst cases are The Shawshank Redemption (32M against 3.24M), The Dark Knight (31M), Breaking Bad, Game of Thrones and Fight Club (25M to 26M). Scores themselves have a median difference of 0.0; 4.6k TV and 20k movie scores differ by more than 0.3 because they are stale. The first dataset ingest fixes all of these.

### 3.2 When the block started

Every `failed_at` is `IMDb HTTP 202`: 7,048 movies and 2,644 shows. **The first failure is 2026-09-11 12:25 UTC** in both collections. The last `updated_at` is 2026-09-11 12:22 UTC.

That is the moment `c69dbf22` (the strict HTTP 200 check) deployed. The old code parsed the empty 202 body as "no score" and still advanced `updated_at` ([retirement-processing-fixes.md](../../retirement-processing-fixes.md) L17-21). So the challenge probably started before 2026-09-11 and was hidden.

This corrects [existing-crawlers.md](existing-crawlers.md): the "last successful leaf 2026-09-22" there was flow-level success under `skip_failures`. No IMDb value in Mongo is newer than 2026-09-11, and "fresh" values from August may be masked failures.

### 3.3 Crate `imdb_url = …/title/None` (118,477 shows, 495,445 movies)

- **Origin.** The June 2025 Postgres-era sync `f/main_db/sync/movies_and_shows.py` (commit `80818c71`) built `imdb_url = f"https://www.imdb.com/title/{imdb_id}"` without a null guard. For shows it also read the top-level `imdb_id`, which TV documents do not have, so every show without that field became `/title/None`.
- **Why it persists.** The current copiers guard with `if imdb_id else None` (`f/sync/copy/tmdb_details.py:216`, `all_ratings.py:210`). But `CrateConnector.upsert_many` defaults to `"c" = COALESCE(excluded."c", "c")` (`f/db/cratedb.py:152-153`), so a new NULL never clears the old string.
- **Effect.** The IMDb chip renders as a live link to `https://www.imdb.com/title/None` for those titles (`RatingChips.tsx:26-33`, whose `href` is truthy).
- **Checked examples.** Sampled `/None` shows, such as tmdb 275102 "Scandals", have `external_ids: {}` in Mongo. The `/None` rows are titles without an id, not lost ids.
- **Fix.** Run `UPDATE show SET imdb_url = NULL WHERE imdb_url = 'https://www.imdb.com/title/None'` and the same on `movie`, once. Alternatively, pass `replace_nulls` for id-derived columns.

### 3.4 Empty Crate `imdb_id`

- **`show.imdb_id` is filled in 9,833 rows, while 94,408 rows have a `tt` URL.** `tmdb_details.py` has written `imdb_id` only since `3a4a32b9` (2025-12-31), and it copies only titles updated in the last 48 h (`HOURS_TO_FETCH`). Of shows copied since 2026-01-01, 7,270 of 13,245 have `imdb_id`, and only 3 have a `tt` URL but no id. Fix: run `copy_media(..., recent_only=False)` once for shows.
- **`movie.imdb_id` is filled in 0 of 1,344,731 rows.** The copier's Mongo projection is `{"_id": 0, "imdb_id": 0, ...}` (`tmdb_details.py:166-171`). That excludes the top-level movie `imdb_id`, and then `imdb_id = tmdb_details.get("imdb_id")` is always None. Shows escape this bug because their id sits in `external_ids`.
  - Effect: movies get no JSON-LD `sameAs`, and search dedup falls back to `r.key`.
  - Fix: drop `"imdb_id": 0` from the projection, then do a full-lookback copy.

## 4. Proposed daily ingest (`f/imdb_datasets/`)

**Schedule.** Run daily at about 02:00 UTC, after IMDb's roughly 00:40 UTC export. Before downloading, send a `HEAD` request for both files and skip the run if the `etag` values match the ones stored from the last run (keep them in a Mongo `imdb_dataset_state` document).

**Download and parse.**
- Stream the 2 files (63 MB) to the worker's temp dir.
- Join them in **DuckDB** (`read_csv(... delim='\t', quote='', nullstr='\N')`).
  - Measured locally for the full episode × ratings join (868,647 rated episodes, 46,513 series): 1.2 s with `memory_limit=512MB, threads=2`, peak RSS 411 MB.
  - Pure-Python streaming also works (ratings 1.0 s; episode filter to our shows 5 s; peak 0.8–1.4 GB because of dicts), but it is heavier.
- The `windmill-default_worker` has 4 GB and 2 CPUs, so either approach fits; DuckDB leaves plenty of headroom. Disk use is about 65 MB, deleted after the run.

**Title ratings.**
- Load the set of `imdb_id → tmdb_id` for shows (`tmdb_tv_details.external_ids.imdb_id`) and movies (`tmdb_movie_details.imdb_id`), 740k ids in total.
- Build `UpdateOne` operations on the **existing** `imdb_tv_rating` and `imdb_movie_rating` collections, keyed by `tmdb_id`. Set `user_score_original`, `user_score_normalized_percent`, `user_score_vote_count`, `source: "imdb_dataset"`, `dataset_run_date` and `updated_at`, and clear `failed_at`/`error_message`.
- Keeping these collections means `all_ratings.py`, `vector_data.py`, `f/priority/publish.py` and the webapp need **no changes**.

**Diff-only writes.**
- Compare against the stored values and write only when `averageRating` changed, or `numVotes` changed by at least 1% (or by at least 50 votes for small titles).
- This limits how many rows the 48 h `all_ratings` window re-copies every 6 h. I could not measure day-over-day churn from one snapshot. **The first 3 runs should log changed-row counts** so the thresholds can be tuned.
- The first run rewrites roughly 540k movies and 80k shows. Run the `all_ratings` full backfill once after it.

**Episodes.**
- Create a Mongo `imdb_tv_episode_rating` collection with one document per show: `{tmdb_id, imdb_id, seasons: {n: [{episode, tconst, rating, votes}]}, season_summary: [{season, rating_vw, votes, rated_episodes}]}`. Write it only when the show's episode hash changes.
- Alternatively, write straight to a new Crate `episode` table (see [existing-data.md](existing-data.md), "Suggestion"): primary key `(show_id, season_number, episode_number)`, with `imdb_tconst`, `imdb_user_score_original` and `imdb_user_score_rating_count`.
- Season scores are derived: a vote-weighted mean over rated episodes, with summed votes. Add them as `imdb_*` columns on Crate `season`. The dataset has no season rating of its own.
- Episode rows can be matched to TMDB episodes by `(season_number, episode_number)`. Specials (S0) and rows with a null season number (2.08M in the file) are dropped.

**Id backfill.** A weekly job runs the Wikidata P4983/P4947 → P345 query (2 queries, about 10 s each) and fills missing ids into a separate `imdb_id_override` field. Do not overwrite TMDB data. Title and year matching only with a second signal, if at all.

**Retire.**
- Delete the `imdb_web` crawl schedule.
- Remove the IMDb branch from `f/priority/crawl_all.flow`. A daily bulk import makes per-title on-demand refreshes pointless.
- Keep `imdb_init_ratings` only if something else relies on it. The ingest upserts by `tmdb_id` itself.
- Add the attribution text on the site.

**Monitoring.** Alert when:
- the dataset `last-modified` is more than 48 h old;
- the changed-row count is 0 two days running, or exceeds 50% (which suggests a format change);
- the row count of `title.ratings` drops by more than 5%.

## 5. Other routes (for completeness)

| Route | What it gives | Cost / limits | Verdict |
|---|---|---|---|
| IMDb API (official, GraphQL) via AWS Data Exchange, "IMDb Essential Metadata" | Everything, live | **$150,000 per 12 months plus metered usage** ($0.00000093 per 100 bytes) ([AWS Marketplace listing](https://aws.amazon.com/marketplace/pp/prodview-wdqq4hg3bcbws)). A 1-month free trial exists. | Out of scope for a non-commercial site |
| `caching.graphql.imdb.com` | IMDb's internal site GraphQL | One honest POST got **403 from CloudFront (`server: awselb/2.0`)**. Undocumented and not licensed for third parties; the `robots.txt` header forbids automated data mining without written permission. | Do not use |
| OMDb | IMDb rating copy, per title or season | Free 1,000 requests/day; CC BY-NC 4.0 ([apikey page](https://www.omdbapi.com/apikey.aspx)) | Redundant with the datasets |
| Wikidata | IDs only (P345, P4983, P4947). It holds no reliable IMDb rating. | Free SPARQL, 9 s for all 57.8k TV pairs | Use for id backfill (§2.3) |
| TMDB | Plot, credits, genres, season `vote_average`, episode votes | Already integrated | Keep for non-IMDb fields and as the second grid overlay ([external-sources.md](external-sources.md) §2) |

## 6. Is the challenge IP-based?

One `GET https://www.imdb.com/title/tt0903747/` from each host, using `User-Agent: GoodWatchBot/0.1 (+https://goodwatch.app)`:

| Origin | Egress | Result |
|---|---|---|
| Dev machine | 92.208.111.117 (residential IPv4) | **HTTP/2 403**, `x-cache: Error from cloudfront`, 118-byte nginx-style "403 Forbidden" |
| Production `10.0.0.10` | 2a01:4f8:c012:dcbe::1 (Hetzner IPv6) | **HTTP/2 403**, identical response |

With an honest bot user agent the block is identical on both IPs, so it is **UA and policy based, not IP based**. The production crawler's spoofed `Chrome/58` user agent gets HTTP 202 (the WAF challenge) instead.

`https://www.imdb.com/robots.txt` explains the 403. It allows only named search and social bots (Googlebot, bingbot, Applebot, facebookexternalhit, …) and ends with `User-agent: * / Disallow: /`. Its header says scraping "is prohibited without prior written permission from IMDb". The Wayback snapshot of 2026-09-01 already has the same rule.

I did not test a browser-like user agent from the dev IP. That would be evasion, and it would not change the policy answer.

## 7. Recommended plan

1. **Now (small, independent fixes):**
   - Keep the `imdb_web` schedule off, and remove the IMDb branch from `f/priority/crawl_all`.
   - One-off Crate cleanup: `imdb_url = NULL` where the URL ends in `/title/None`.
   - Drop `"imdb_id": 0` from the `tmdb_details.py` projection.
   - Run a full-lookback `copy_media` for shows and movies.
2. **Daily dataset ingest** (§4) into the existing `imdb_*_rating` collections, with diff-only writes. The first run corrects the 46.7k inflated vote counts and every score frozen since 2026-09-11 or earlier. Then run a full `all_ratings` and Qdrant payload backfill.
3. **Episode grid:** extend the same job to write episode and season rows (Crate `episode` table, `season.imdb_*`). This uses the join already measured at 1.2 s.
4. **ID backfill:** a weekly Wikidata job (+5.1k shows). Skip title and year matching unless a second signal confirms the match.
5. **Attribution:** add "Information courtesy of IMDb (https://www.imdb.com). Used with permission." to the site.
6. Delete `f/imdb_web` fetch code once the ingest has run cleanly for a week.
