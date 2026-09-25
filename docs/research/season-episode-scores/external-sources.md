# Season and episode scores: external sources

Researched September 25, 2026. The question is where GoodWatch can get **per-season** and **per-episode** scores for TV shows, including data for an episode ratings grid (rows are seasons, columns are episodes, one colored box per episode). The crawl has to be fast and reliable, and it must not trip rate limits easily.

Method: official docs, terms, and robots.txt, plus live responses I fetched myself. I used Breaking Bad (`tt0903747`, TMDB `1396`, TVmaze `169`), The Bear (`tt14452776`, TMDB `136315`, TVmaze `54198`) and a smaller show, Patriot (`tt4687882`, TVmaze `8817`). I sent only a few requests to each site. I did not work around any bot challenge. Every 403 is recorded where it happened.

## TL;DR

- **Episode grid: use the IMDb datasets.** Two daily gzip files (about 63 MB together) give an IMDb rating and vote count for every rated episode: 884,806 rated episodes across 47,789 series. There are no per-title requests and no rate limit. The catch is the license, which covers **personal and non-commercial use only** and bars republishing the data as an online database. The owner has to decide whether that is acceptable.
- **Second episode source: TMDB.** `/tv/{id}` with `append_to_response=season/1,…,season/N` returns every episode's `vote_average` and `vote_count`. That is 20 seasons per call, so about one request per show. The API limit is roughly 40 requests per second. Vote counts are about 100× smaller than IMDb's.
- **TVmaze** has a per-episode `rating.average` with **no vote count**. It is the only source with a truly open license (CC BY-SA).
- **Per-season scores:**
  - TMDB has a season `vote_average` but no count.
  - Trakt documents `rating` and `votes` per season. I could not verify this because it needs an app key.
  - Rotten Tomatoes season pages have Tomatometer and Popcornmeter with counts, in embedded JSON.
  - Metacritic season pages have a Metascore for every season in `__NUXT_DATA__`, and a user score for the current season.
- **Hard to justify: RT, Metacritic and scraped imdb.com.** All three work with plain HTTP today, but their terms forbid automated collection. Episode-level RT and Metacritic data is sparse or needs one request per episode.
- **Infeasible or irrelevant:** Letterboxd (films and miniseries only; the API page sits behind a Cloudflare challenge), TheTVDB (its v4 schema has no ratings), and OMDb (IMDb data again, with a 1,000 requests/day free tier).

## Comparison

| Source | Per-episode score | Per-season score | Vote counts | Access | Full crawl (~30k shows) | Limits | License / terms |
|---|---|---|---|---|---|---|---|
| **IMDb datasets** | ✅ 1–10, weighted avg | ❌ (derive from episodes) | ✅ `numVotes` (min 5) | 2 bulk TSV.gz, daily | **2 downloads** | none observed (S3/CloudFront) | personal + non-commercial only, attribution, no republishing as a database |
| **TMDB API** | ✅ `vote_average` 0–10 | ⚠️ `vote_average`, no count | episodes ✅, season ❌ | JSON API, key | **~30k req** (20 seasons/call) | "~40 req/s" upper limit | free for non-commercial, attribution + logo; commercial needs license |
| **TVmaze API** | ✅ `rating.average` 0–10 | ❌ | ❌ | JSON API, no key | ~30k req (`?embed=episodes`) + ~300 index pages | ≥20 req/10 s per IP | **CC BY-SA**, any purpose, link back |
| **Trakt API** | ✅ `rating` + `votes` (documented) | ✅ `rating` + `votes` (documented) | ✅ | JSON API, client_id | ~30k req (`/seasons?extended=…`) | 500 GET / 5 min | ToS: personal, non-commercial |
| **Rotten Tomatoes** | ⚠️ Tomatometer only, few episodes | ✅ Tomatometer + Popcornmeter | ✅ | HTML embedded JSON | 1 per season (~90k) | Akamai; not tested at volume | ToS forbids automated collection |
| **Metacritic** | ⚠️ user score, 1 page per episode | ✅ Metascore (all seasons per page); user score per season page | ✅ | HTML `__NUXT_DATA__`, JSON-LD | 1 per season; 1 per episode | Cloudflare | Fandom ToS page returned 403 |
| OMDb | IMDb rating (copy) | ❌ | ❌ | JSON API, key | 1 per season | 1,000/day free | CC BY-NC 4.0 |
| TheTVDB v4 | ❌ | ❌ | – | – | – | – | – |
| Letterboxd | ❌ (films / miniseries only) | ❌ | – | API by request | – | Cloudflare challenge | – |

## 1. IMDb non-commercial datasets

**Data.** The files are at `https://datasets.imdbws.com/`. The docs describe ([source](https://data.imdb.com/non-commercial-datasets/)):
- `title.episode.tsv.gz`: `tconst` (the episode), `parentTconst` (the series), `seasonNumber`, `episodeNumber`.
- `title.ratings.tsv.gz`: `tconst`, `averageRating` ("weighted average of all the individual user ratings"), `numVotes`.
- Both are UTF-8, tab-separated, gzipped, with `\N` for null.

**Verified by download** (both files had `last-modified: Fri, 25 Sep 2026 00:39–00:40 GMT` and `x-amz-meta-run-date: 2026-09-24`):
- `title.episode.tsv.gz` is 54.8 MB with 9,909,561 episode rows across 241,944 parent series. 2,081,478 of those rows have a null season.
- `title.ratings.tsv.gz` is 8.7 MB with 1,713,837 rated titles. The minimum `numVotes` in the file is **5**, so titles with fewer votes are left out.
- Joining the two gives **884,806 rated episodes** in **47,789 series**. 29,575 series have at least 5 rated episodes. Of the series with at least 1,000 votes that also have rated episodes (12,716 of them), the average is 3.1 seasons.
- The joined data is ready for a grid. Samples (`season: [(episode, rating, votes)]`):
  - Breaking Bad S1: `(1, 9.1, 85939) (2, 8.6, 63903) … (7, 8.8, 59106)`
  - Breaking Bad S5E14 (Ozymandias): `9.5, 508,632 votes`
  - The Bear S2E7: `9.7, 26,336`
  - Patriot S2E8: `8.7, 492`
  - Some rows have no season, for example a `tt14452776 \N \N` row. Filter those out.
- There is **no season-level rating.** A per-season IMDb score has to be derived, for example as a vote-weighted mean of that season's episodes.

**Update frequency.** "The data is refreshed daily" ([source](https://data.imdb.com/non-commercial-datasets/)). The headers above confirm a daily run date.

**Crawl cost.** A full refresh is 2 HTTP GETs, about 63 MB. With ETag / `last-modified` a refresh can be skipped when nothing changed. Mapping to GoodWatch shows needs only the series `tconst`, which we already hold through TMDB `external_ids.imdb_id`. `title.basics` (228 MB) is not needed. Incremental updates are easiest as a daily full reload plus a diff.

**License. This is the blocker.** IMDb's help page "Can I use IMDb data in my software?" ([source](https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX)) says:
- "Limited non-commercial use of IMDb data is allowed …"
- "The data can only be used for personal and non-commercial use and must not be altered/republished/resold/repurposed to create any kind of online/offline database of movie information (except for individual personal use)."
- Required attribution: "Information courtesy of IMDb (https://www.imdb.com). Used with permission."
- "You may not use data mining, robots, screen scraping, or similar online data gathering and extraction tools on our website." This also applies to the existing `goodwatch-flows/windmill/f/imdb_web` crawler, which fetches `www.imdb.com/title/{id}/`.

Commercial IMDb data is sold through AWS Data Exchange ([source](https://data.imdb.com/documentation/)). Pricing is by contact.

## 2. TMDB API

**Data (verified).** `GET /3/tv/{id}/season/{n}` returns season `vote_average`, but **no season `vote_count`**. Each `episodes[]` item has `vote_average` and `vote_count`, plus `episode_number`, `season_number`, `air_date`, `runtime`, `episode_type` and `still_path`.
- Breaking Bad S1: `(1, 8.5, 557) (2, 8.241, 297) … (7, 8.387, 247)`. Season `vote_average` is 8.4.
- The Bear S1: `(1, 7.599, 147) … (8, 8.165, 85)`. Season average is 7.8.
- The show endpoint's `seasons[]` also carries `vote_average` for each season. Breaking Bad gives `S0 0.0, S1–S3 8.4, S4 8.6, S5 8.9`. So **one show call already returns every season's average.**
- Vote counts are roughly 100× smaller than IMDb's, so small shows will often have empty or noisy episodes.

**Batching (verified).** `append_to_response` works on TV show details ([source](https://developer.themoviedb.org/docs/append-to-response)). `GET /3/tv/1396?append_to_response=season/1,season/2,season/3,season/4,season/5,external_ids` returned all five seasons with their episodes, plus IMDb and TVDB IDs, in one response. Asking for 21 appended items returned `{"status_code":27,"status_message":"Too many append to response objects: The maximum number of remote calls is 20."}`. So one call covers up to 20 seasons. 678 IMDb series have more than 20 seasons (from the dataset join above), and those need `ceil(seasons/20)` calls.

**Rate limit.** The legacy limit of 40 requests per 10 s was disabled in December 2019. There are still "upper limits … somewhere in the 40 requests per second range. … respect the 429" ([source](https://developer.themoviedb.org/docs/rate-limiting)).

**Crawl cost.** About 1 request per show, so around 30k requests. At about 20 req/s that is under 30 minutes. For incremental updates, `GET /3/tv/changes` (verified: 1,991 changed IDs, 20 pages) gives the IDs changed in the last 24 h. Intersect those with the catalog, then refetch only those shows.

**License.** "Our API is free to use for non-commercial purposes as long as you attribute TMDB … If you are interested in obtaining a license to use our API and/or our data/images for commercial purposes, please contact sales." The attribution notice and an approved logo are required ([source](https://developer.themoviedb.org/docs/faq)). GoodWatch already depends on TMDB, so this adds no new legal exposure.

## 3. TVmaze API

**Data (verified).**
- `GET https://api.tvmaze.com/lookup/shows?imdb=tt0903747` answers with a 301 to `/shows/169`.
- `GET /shows/{id}?embed=episodes` returns show `rating.average` and each episode's `season`, `number` and `rating.average`.
- Breaking Bad S1: `8.3, 7.9, 8.1, 7.6, 7.8, 8.8, 8.0`. The Bear S1: `7.4 … 8.6`. Patriot S1: `7.0 … 6.8`.
- **There are no vote counts** anywhere, and **no season ratings**. `/shows/{id}/seasons` has no rating field.

**Rate limit.** "at least 20 calls every 10 seconds per IP … you might receive an HTTP 429". Rate limiting is not applied on the edge cache. All output is cached for 60 minutes ([source](https://www.tvmaze.com/api)).

**Crawl cost.** Build the ID mapping from the show index `/shows?page=N` (250 shows per page, ID-based pages, `externals.imdb` included). That is a few hundred pages. Then send one `?embed=episodes` request per show, about 30k requests. At 2 req/s that takes about 4 h, and it is faster when responses are cached. For incremental updates, `/updates/shows?since=day` returns changed show IDs ([source](https://www.tvmaze.com/api)).

**License.** "Use of the TVmaze API is licensed by CC BY-SA. This means the data can freely be used for any purpose, as long as TVmaze is properly credited … and your usage complies with the ShareAlike provision" ([source](https://www.tvmaze.com/api)). This is the most permissive source here.

## 4. Trakt API

**Data (documented, not verified live).**
- `GET /shows/{id}/seasons` has schema fields `rating` (float) and `votes` (int) per season. `?extended=episodes` "will return all episodes for all seasons" ([source](https://docs.trakt.tv/reference/getshowsseasons)).
- `GET /shows/{id}/seasons/{season}` has episode objects with `rating` and `votes` ([source](https://docs.trakt.tv/reference/getshowsseasonepisodes)).
- If this holds, Trakt is the only API with **season-level scores that include vote counts**.

**Auth.** The required headers are `trakt-api-key: <client_id>`, `trakt-api-version: 2` and a `User-Agent` ([source](https://docs.trakt.tv/docs/required-headers)). A keyless request to `https://api.trakt.tv/shows/breaking-bad/seasons?extended=full` returned **HTTP 403 from Cloudflare** (HTML page, `server: cloudflare`). I stopped there. The next step is to register a free app at trakt.tv to verify the actual responses.

**Rate limit.** `UNAUTHED_API_GET_LIMIT` is **500 calls every 5 minutes** ([source](https://docs.trakt.tv/docs/rate-limiting)). That is half the 1,000 in the deprecated Apiary docs ([source](https://jsapi.apiary.io/apis/trakt.apib)). A 429 can also come from abuse-prevention systems without an `X-Ratelimit` header.

**Crawl cost.** One request per show with `?extended=full,episodes` (the combined parameter is unverified), about 30k requests. At 100/min that is **about 5 h**. That is fine for a weekly or rolling refresh, but not for a fast full re-crawl.

**License.** Trakt's Terms of Use grant a right to use the Services "for your personal, non-commercial use" ([source](https://trakt.tv/terms)). I found no separate API license in the docs. Commercial use needs clarifying, but the owner has ruled out emailing sites.

## 5. Rotten Tomatoes (HTML with embedded JSON)

**robots.txt** disallows only `/m/*/pictures`, `/tv/*/pictures`, `/search`, `/critics/self-submission/` and `/user/account/*` ([source](https://www.rottentomatoes.com/robots.txt)).

**Season page (verified, plain curl got HTTP 200, Akamai headers).** `https://www.rottentomatoes.com/tv/breaking_bad/s01` has two useful parts:
- `<script id="media-scorecard-json" type="application/json">`, the same block the existing `rotten_web` crawler reads:
  - `criticsScore`: `score` 86, `averageRating` 8.30, `likedCount` 37, `notLikedCount` 6, `reviewCount` 43.
  - `audienceScore` (the Popcornmeter): `score` 95, `averageRating` 4.4, `likedCount` 6790, `notLikedCount` 370, `bandedRatingCount` "5,000+ Ratings".
  - `criticsTop` (top critics): 85, based on 27 reviews.
- JSON-LD `TVSeason` with `aggregateRating` (Tomatometer 86, `ratingCount` 43). It also has an `episode[]` list with names and URLs, but no scores.
- The Bear S4: Tomatometer 84 (88 reviews), Popcornmeter 69 (avg 3.7, 1,000+ ratings).

**Series page.** `/tv/breaking_bad` has `<tile-season>` elements with each season's Tomatometer, for example `Season 5 … 97%`, along with JSON-LD `containsSeason` URLs. That gives **critic scores for all seasons in one request**. It has no Popcornmeter per season and no counts.

**Episode pages.** Breaking Bad `s01/e01` has 0 critic reviews and no audience score. Game of Thrones `s08/e06` has a Tomatometer of 47 from 137 reviews, but no audience score. Episode Tomatometers exist only for heavily reviewed episodes, so they cannot fill a grid.

**Terms.** RT's Terms of Use prohibit "any form of data extraction or data mining … without prior written permission of Fandango". Users must also agree not to "use any automated method (including … robots, scripts, spiders, data extractors …) to collect data from … the Services" ([source](https://www.rottentomatoes.com/policies/terms-of-use)).

**Crawl cost.** The series page covers all seasons' Tomatometers in one request per show. Popcornmeter and counts need one request per season. RT covers far fewer shows than IMDb.

## 6. Metacritic (HTML with `__NUXT_DATA__` and JSON-LD)

**robots.txt** blocks named AI and SEO bots entirely. For `*` it disallows only `/search`, `/signup`, `/login`, `/user` and a few ad paths ([source](https://www.metacritic.com/robots.txt)). The site is behind Cloudflare.

**Season page (verified, HTTP 200).** `https://www.metacritic.com/tv/breaking-bad/season-1/` has:
- JSON-LD `TVSeason` with `aggregateRating` `{name: Metascore, ratingValue: 73, reviewCount: 27}`.
- HTML `title="User score 9.2 out of 10"` and "Based on 4,319 User Ratings".
- `__NUXT_DATA__` (devalue format), which contains a season object for **every** season with `criticScoreSummary` (`score`, `normalizedScore`, `reviewCount`, positive/neutral/negative counts). Breaking Bad S1–S5 = 73, 84, 89, 96, 99. So one request gives all Metascores, and each season needs its own page for the user score.

**Episode page (verified).** `/tv/breaking-bad/season-1/episode-1-pilot/` has JSON-LD `TVEpisode` with `aggregateRating` `{name: "Metacritic User Score", ratingValue: 8.6, ratingCount: 53}`. There is no episode Metascore. A grid would need **one request per episode**, which is about 20× the season crawl, and counts are small.

**Terms.** Metacritic links to Fandom's `https://www.fandom.com/terms-of-service-pp1`, which returned **HTTP 403** to curl. I stopped there. I have not verified its terms text.

## 7. Others

- **OMDb.** `?i=tt…&Season=N` returns a season's episodes ([source](https://www.omdbapi.com/), change log 11/16/15). The episode ratings are IMDb's, so this is redundant with the dataset. The free key allows 1,000 requests per day, and content is CC BY-NC 4.0 ([source](https://www.omdbapi.com/apikey.aspx)). A keyless request returned `"No API key provided."`.
- **TheTVDB v4.** The schemas `EpisodeBaseRecord` and `SeasonBaseRecord` have no rating fields. `SeriesBaseRecord.score` is the only score, and it is series-level ([source](https://thetvdb.github.io/v4-api/swagger.yml)).
- **Letterboxd.** It imports films from TMDB and "manually add[s] limited and miniseries from its TV section" ([source](https://letterboxd.com/about/faq/)). So it has no series seasons or episodes. `letterboxd.com/api-beta/` returned a Cloudflare "Just a moment…" challenge (403), and I stopped there.

## Recommendation (ranked)

**Per-episode grid:**
1. **IMDb datasets.** They offer complete coverage, large vote counts, 2 downloads a day and zero rate-limit risk. This is the obvious technical choice. The **license decision is the gating item**: the terms are personal and non-commercial, with no online database. The existing IMDb page scraper has the same problem, only worse.
2. **TMDB season appends.** Use these if IMDb is off the table, or as a second overlay. The terms are acceptable because GoodWatch already uses TMDB. It takes about 1 request per show, and `/tv/changes` handles incremental updates. Hide cells with low `vote_count`.
3. **TVmaze.** This is the cleanest license (CC BY-SA, any purpose). But there are no vote counts, so it cannot weight or suppress noisy cells. Use it as a fallback color or a third dataset.

**Per-season scores:**
1. **TMDB**: season `vote_average` for every season from the show call you already make. There is no count.
2. **IMDb, derived**: a vote-weighted mean of each season's episodes, with the total votes as the count.
3. **Trakt**: `rating` and `votes` per season. Register an app and verify first. At 500 req/5 min this is a slow rolling refresh.
4. **Rotten Tomatoes and Metacritic.** These are the only per-season critic scores, and they are what users recognize, and both expose clean JSON (`media-scorecard-json`, JSON-LD, `__NUXT_DATA__`). One page per show gets critics' scores for all seasons, and one page per season adds audience scores. But both terms forbid automated collection, and both sit behind bot-protection CDNs (Akamai for RT, Cloudflare for Metacritic). Treat them as **possible but risky**, extending the existing `rotten_web` and `metacritic_web` crawlers at low volume. Do not put them in the fast core pipeline.

**Infeasible or not worth it:**
- RT episode scores (critics only, rare).
- Metacritic episode user scores (one request per episode, small counts).
- Letterboxd (no TV seasons).
- TheTVDB (no ratings).
- OMDb (IMDb copy, 1,000/day).
