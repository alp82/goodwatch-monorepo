# Season and episode scores: score APIs, aggregators and episode-grid sites

Researched September 25, 2026. This follows [external-sources.md](external-sources.md), which covered the IMDb datasets, the TMDB/TVmaze basics, Rotten Tomatoes and Metacritic pages, TheTVDB and Letterboxd. Nothing from there is repeated here unless it changed. This file adds four things:
- Trakt in depth.
- Aggregator APIs: MDBList, OMDb, Simkl, JustWatch, Wikidata, Watchmode and Streaming Availability.
- Specialist episode-grid sites.
- A **measured** TMDB benchmark for the top 10k shows.

Method: official docs, terms and policy pages, providers' own source code on GitHub, and live responses. Only a handful of requests went to each site. No bot challenge was worked around. No key was signed up for; keyless responses are recorded as they came back. The TMDB benchmark used the existing `u/Alp/TMDB_API_KEY` Windmill variable. Catalog statistics come from the Crate `show` table.

## TL;DR

- **Trakt is no longer a realistic source.**
  - Since **August 2026**, creating an API app requires a paid VIP membership.
  - On **2026-09-16** Trakt cut off MDBList for "service-to-service" use.
  - A draft API Use Policy bans "bulk harvesting … ratings".
  - The data itself would have been ideal. With one app key and no OAuth, you get:
    - Trakt `rating` and `votes` for every season and episode in one call per show.
    - IMDb, TMDB, RT and Metascore per season or episode through `/ratings?extended=all`.
- **MDBList** aggregates IMDb, RT (critics and audience), Metacritic (critics and users), Letterboxd, TMDB and others, but **only at show level**. It has no seasons and no episodes.
- **OMDb** gives per-episode IMDb ratings with one call per season. Its legal page contradicts its "CC BY-NC" label and forbids building an index.
- **Simkl, JustWatch, Watchmode and Streaming Availability** are show-level only.
- **Wikidata** has almost no season scores (about 58 seasons in total). It is useful only for its season-level RT and Metacritic **IDs** (`P1258`, `P1712`).
- **Every episode-grid site runs on IMDb data**, mostly the non-commercial datasets:
  - None exposes a public API, and none shows RT or Metacritic season scores.
  - A season-score column and dimmed low-vote cells would be new; nobody does either.
- **TMDB is measured, fast and cheap.**
  - The top 10k shows take **10,693 requests**. At the measured **33 req/s** (concurrency 8) that is about **5.5 min**, with about 230 MB on the wire. No 429 was seen.
  - The full catalog of 246,636 shows takes **248,045 requests**, about **2–3.5 h**.
  - The catch is coverage. In a random top-10k sample, the median show had **2 %** of its aired episodes with at least one TMDB vote. Only 16 of 39 shows had at least one vote on 80 % or more of their episodes.

## 1. Trakt API

**Getting a key**
- **A paid membership is required.** "Yes, creating API apps is now a VIP feature and requires an active VIP membership." (Trakt co-founder, 2026-08-07, [trakt-api#902](https://github.com/trakt/trakt-api/issues/902#issuecomment-5220950652)). VIP costs about $4.99/month according to a [secondary source](https://ettayeb.fr/en/selfhosted/trakt-api-paywall-selfhosted-media/); trakt.tv itself returned 403 and I stopped there.
- **Free-tier apps were deleted** around 2026-07-31 ([#897](https://github.com/trakt/trakt-api/issues/897), [#906](https://github.com/trakt/trakt-api/issues/906)).
- **Steps:**
  - A **verified GitHub account** is required: "Creating an app requires a verified GitHub account." ([create-an-app.md](https://github.com/trakt/trakt-api/blob/HEAD/projects/developer/src/lib/guides/create-an-app.md), commit of 2026-09-22).
  - Create the app in the developer portal (listed at `app.trakt.tv/settings/apps/api`). The form asks for:
    - a name
    - an optional description
    - 1–25 redirect URIs; `urn:ietf:wg:oauth:2.0:oob` is allowed (`parseApplication.ts`)
    - optional allowed origins
  - The portal shows an "Approved" or "Pending approval" state, and there is a per-account app limit.
  - The rules you agree to include "Use only documented API methods… don't scrape", "don't create additional API apps to avoid rate limits", "effectively cache data", and branding rules.
- **Auth:** "All POST, PUT, and DELETE methods require a valid OAuth access_token. Some GET calls require OAuth" (those are marked 🔒). None of the season or episode summary or ratings endpoints are marked. A `trakt-api-key` header (the client_id) plus `trakt-api-version: 2` is enough.

**Rate limits** ([rate-limiting.md](https://github.com/trakt/trakt-api/blob/HEAD/projects/developer/src/lib/guides/rate-limiting.md), updated 2026-08-21)

| Limit | Applies to | Allowed |
|---|---|---|
| `UNAUTHED_API_GET_LIMIT` | GET with the app key only | 500 per 5 min |
| `AUTHED_API_GET_LIMIT` | GET with a user login | 500 per 5 min |
| `AUTHED_API_POST_LIMIT` | POST, PUT, DELETE | 1 per second |

A throttled request gets a 429 with `Retry-After`. The example header in the docs still shows `"limit":1000`, which is out of date.

**Endpoints**
- `GET /shows/{id}/seasons?extended=full,episodes`: every season with `rating` and `votes`, and every nested episode with `rating` and `votes`. That covers Trakt's own scores **for the whole grid in one call**.
  - The docs only document `extended=episodes`.
  - The combined form is what Trakt's own app, Showly, calls: `@GET("shows/{traktId}/seasons?extended=full,episodes")` in `TraktShowsService.kt`, which reads `rating` and `votes` on `model/Episode.kt` ([trakt/showly](https://github.com/trakt/showly)).
  - The response is not paginated.
- `GET /shows/{id}/seasons/{s}/ratings?extended=all` and `GET /shows/{id}/seasons/{s}/episodes/{e}/ratings?extended=all`: "Use `?extended=all` to include ratings from TMDB, IMDb, Metascore, and Rotten Tomatoes. External ratings, vote counts, and links can be `null` when unavailable." (`ratingsResponseSchema.ts`). The response shape is:
  - `imdb{rating,votes}`
  - `tmdb{rating,votes}`
  - `metascore{rating}`
  - `rotten_tomatoes{rating,state,user_rating,user_state}`
  - `trakt{rating,votes,distribution}`

  I have not verified this live because I had no key. IMDb has no native season rating, so expect `imdb` to be null for seasons.

**Terms and policy**
- The Terms of Use allow "personal, non-commercial use" (see external-sources.md).
- **MDBList was blocked on 2026-09-16:** "The API is intended for client applications and we've determined that MDBList operates as a service-to-service integration… Please do not attempt to restore access through alternative API keys, accounts, or third parties." ([#933](https://github.com/trakt/trakt-api/issues/933)).
- **Draft API Use Policy** ([PR #941](https://github.com/trakt/trakt-api/pull/941), open as of 2026-09-23). It forbids "Scraping, bulk harvesting, or mirroring Trakt data to build a reusable copy of its catalog, community activity, ratings, or lists", and adds: "Staying below a rate limit does not make a prohibited use permitted."
- A server-side crawl that stores season and episode ratings for 10k shows is exactly that pattern.

**Requests for the top 10k shows**
- Trakt's own scores: 10k calls, about **1 h 40 min** at 100/min.
- External scores per season: about 53k more calls (53,102 seasons), about 9 h.
- External scores per episode: about 1.95M calls, about 13.5 days.

The budget is fine. The policy is not.

## 2. Aggregator APIs

### MDBList (api.mdblist.com)
- **Without a key:** `401 {"error":"Authentication required. Provide either 'Authorization: Bearer <token>' header or '?apikey=<key>' parameter"}`.
- **Keys** are free from mdblist.com preferences. The limit is daily, resets at 00:00 UTC, and returns 429 "Daily API limit exceeded!" when exceeded ([API blueprint](https://jsapi.apiary.io/apis/mdblist.apib)).
- **Supporter tiers** ([docs.mdblist.com/docs/supporter](https://docs.mdblist.com/docs/supporter)):

  | Tier | Price | Requests per day |
  |---|---|---|
  | Free | €0 | 1,000 |
  | Basic | €1/mo | 10,000 |
  | Standard | €2/mo | 25,000 |
  | Plus | €3/mo | 100,000 |
  | VIP | €5–20/mo | 250k–1.5M |

- **Scores**, each with value, score and votes: `imdb`, `tmdb`, `trakt`, `letterboxd`, `tomatoes`, `audience` (RT audience, on the bulk rating endpoint), `metacritic`, `metacriticuser`, `rogerebert`, `myanimelist`, plus `score` and `score_average`.
- **Show level only.** It has no season or episode ratings. Its Trakt scores are gone since the block above (a search summary citing MDBList; I did not read MDBList's own page).
- **Batch calls:**
  - `POST /{provider}/{movie|show}` takes "up to 200 media items".
  - `POST /rating/{type}/{source}` takes a list of IDs and returns one source.
  - The docs don't say how batch calls count against the daily limit.
- **Terms** ([mdblist.com/terms](https://mdblist.com/terms/), 2025-03-08) say nothing about reusing data. The only relevant line is "You must comply with applicable laws and third-party provider terms." In practice it passes IMDb, RT and Metacritic data through with those sources' own restrictions.
- **Use for GoodWatch:** cross-checking show-level RT audience and Metacritic user scores. It does not help the grid.

### OMDb
- **Without a key:** `401 {"Response":"False","Error":"No API key provided."}`.
- **Tiers:** a free key gives 1,000 per day. Patreon tiers ([patreon.com/omdb/membership](https://www.patreon.com/omdb/membership)):

  | Tier | Price | Includes |
  |---|---|---|
  | Basic | $1/mo | 100k per day |
  | Standard | $5/mo | 500k per day, plus posters |
  | Pro | $10/mo | private server, no limit |

- `?i=tt…&Season=N` returns `Episodes[{Title, Released, Episode, imdbRating, imdbID}]`. There are **no votes** and **no season score** ([node-imdb-api fixture](https://github.com/worr/node-imdb-api/blob/HEAD/test/data/how-I-met-your-mother-episodes.json)).
- The undocumented `&detail=full` returns full episode objects with `imdbVotes`, `Metascore` and `Ratings`. Jellyfin uses it ([OmdbProvider.cs](https://github.com/jellyfin/jellyfin/blob/HEAD/MediaBrowser.Providers/Plugins/Omdb/OmdbProvider.cs)), but it was reported broken in [OMDb-API#340](https://github.com/omdbapi/OMDb-API) in 2026-08. Episode RT and Metacritic values are essentially always "N/A".
- **Known issues** ([OMDb-API](https://github.com/omdbapi/OMDb-API)):
  - Season lists are capped at 100 episodes (#106).
  - Ratings come back "N/A" although IMDb has them (#328).
  - Current seasons are incomplete (#334).
- **Terms conflict.** The footer says "CC BY-NC 4.0", but [legal.htm](https://www.omdbapi.com/legal.htm) says "you may not create, recreate, distribute or advertise an index of any Contributions unless authorized by us in writing" (4.2.4) and "You may not build a business utilizing the Contributions, whether or not for profit." (4.2.5).
- **Requests for the top 10k:** about 53k (one per season). That is 53 days on the free key, or under a day on the $1 tier.
- **Verdict:** it is an IMDb copy with worse terms and worse data than the IMDb datasets.

### Simkl
- **Keys:** a free `client_id` from [simkl.com/settings/developer/new](https://docs.simkl.org/how-to-use-simkl/for-developers/how-to-register-an-app).
- **Terms** ([api-rules](https://api.simkl.org/api-rules)):
  - "Free for non-commercial apps and personal projects".
  - A backlink to the Simkl item page is required.
  - The API is "not authorized for use in conjunction with other competing services … if your service or app does not provide Simkl login and Sync".
- **Rate limits:** 10 GET/s ([rate-limits](https://api.simkl.org/resources/rate-limits)).
- **Show level** (keyless, served from Cloudflare cache): `"ratings":{"simkl":{"rating":8.8,"votes":15083},"imdb":{"rating":9.2,"votes":2665117}}`.
- **Episodes** carry no rating field. This was confirmed live on `/tv/episodes/17465` and in the [OpenAPI](https://api.simkl.org/openapi.json) `EpisodeDetail` schema.
- **Verdict:** no season or episode scores.

### TVmaze (additions to external-sources.md)
- There is no bulk dump. Use `/shows?page=N` plus `/updates/shows` ([api](https://www.tvmaze.com/api)).
- Specials need `specials=1` on `/shows/:id/episodes`.
- The Premium tier gives a user-level API and does not raise the public limit.
- An episode rating appears only after at least 3 votes ([forum, admin](https://www.tvmaze.com/threads/3092/hate-voting-how-to-get-rid-of-the-problem?page=3)). Vote counts are deliberately not exposed ([thread 770](http://www.tvmaze.com/threads/770/add-number-of-votes-to-api)).

### JustWatch
- **Partner API only:** "Once the contract is concluded, each partner is handed a unique partner token" ([docs](https://apis.justwatch.com/docs/api/)).
- **Scores in the spec** ([jw-partner-api.yaml](https://apis.justwatch.com/docs/static/jw-partner-api.yaml)):
  - Title level: `jw_rating` and `vote_numbers`.
  - For other sources it carries only IDs (`imdb_id`, `tmdb_id`, `rottentomatoes_id`), not their scores.
  - Seasons and episodes carry no scores.
- **Terms** forbid "data mining, robots, scraping" ([ToU](https://support.justwatch.com/article/just-watchs-terms-of-use)).
- **Verdict:** not usable.

### Wikidata (CC0)
- **Properties:** seasons (`Q3464665`) can carry `P444` (review score) with qualifier `P447` (review score by), plus `P1258` (RT ID) and `P1712` (Metacritic ID).
- **Coverage, from live SPARQL:**
  - Seasons with `P444`: Douban 39, RT 10, Metacritic 7, no source 2. That is about **58 seasons in total**.
  - Episodes with `P444`: a few hundred, from sources such as The A.V. Club and IMDb.
- **Quality:** Breaking Bad S1 has a Metacritic `P444` of 100, while Metacritic's own page says 73 (see external-sources.md).
- **Use for GoodWatch:** only the season-level `P1258`/`P1712` IDs, to map seasons to RT and Metacritic URLs.
- **Limits:** 60 s query timeout, 5 parallel queries per IP, and a User-Agent is required ([manual](https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual)).

### Watchmode and Streaming Availability (Movie of the Night)
- **Watchmode** ([openapi](https://api.watchmode.com/openapi.json)):
  - Title level only: `user_rating` (no vote count) and `critic_score` (source not stated). Seasons and episodes have no scores.
  - Free plan: 2,500 credits per month, non-commercial, attribution required, and cached data must be refreshed or deleted within 30 days.
- **Streaming Availability** ([openapi](https://github.com/movieofthenight/streaming-availability-api/blob/main/openapi.yaml)): one blended show `rating` (0–100). The free plan allows 1,000 requests per month.
- **Verdict:** neither has season data.

## 3. Episode-grid sites (design references)

Every site below takes its episode scores from IMDb. None offers a public API, and none shows RT or Metacritic season scores.

| Site | Data source | API / JSON | Automation terms | Freshness | Design takeaways |
|---|---|---|---|---|---|
| [SeriesHeat](https://vallandingham.me/seriesheat/) | IMDb datasets ([InsideHook](https://www.insidehook.com/television/imdb-heatmap-tv-series)) | private Cloudflare Worker `seriesheat-api…/api/series/{id}`, undocumented | robots allows all; no terms page | not stated | Fixed named buckets: Garbage <5, Bad, Regular, Good, Great ≥8.6 (thresholds 5 / 6.6 / 7.6 / 8.6). Also a spectral palette and a colour-blind diverging palette. Text colour flips with cell lightness. Duplicate episodes resolved by most `numVotes`. |
| [Ratingraph](https://www.ratingraph.com) | IMDb (unnamed; "1515 million user ratings") | internal `data-url` JSON (`/show-episodes-graph/{id}/…`) | robots `Allow: /`; no terms page | "daily updates"; history since 2020-03-07 | A line chart, not a grid. Season average shown in the legend label. Trendline. Autoscale, 0-based or 0–10 axis. Votes-per-episode chart. Rank = votes per episode adjusted by rating. |
| [TVCharts](https://tvcharts.co) | "sourced from IMDb"; the field names match the paid IMDb-API.com service (inferred) | Next.js, no public API | no robots.txt or terms found | not stated | Colour-blind toggle, screenshot sharing, views by season, episode or air date. A `metacriticRating` field exists but is unused. |
| [SeriesGraph](https://seriesgraph.com) | TMDB/Trakt metadata, IMDb scores, MAL for anime | none | **terms ban scraping** | not stated | Grid or wrapped layout, sparklines, save as image, community ratings for episodes and seasons, and a toggle to hide public ratings. |
| [TV Heatmap](https://tvshows.denialof.services) | IMDb, with the footer "Information courtesy of IMDb … Used with permission." | static HTML | robots allows all | not stated | Transposed layout (seasons as columns). Fixed RdYlGn scale in 0.1–0.3 steps. Blank cells for missing episodes. Hover shows the episode title. |
| [EpisodeGraph](https://episodegraph.com/about) | TMDB metadata, IMDb ratings and votes, community votes | `/api/` disallowed in robots.txt | – | "refresh … automatically" | Bayesian community score that shows only after enough votes. |
| [Showgrid](https://theshowgrid.com) | IMDb; describes itself as "Non-commercial" | – | – | – | Avoids red and green; uses orange and purple. |
| RateMap, TVRANKD | IMDb | RateMap: `/api/heatmap` behind Turnstile | TVRANKD blocks AI crawlers, so I fetched nothing beyond robots.txt | RateMap's provider is currently offline | PNG export; a leaderboard. |
| Graph TV, episoderatings.com | – | – | – | dead: Heroku "No such app" / Cloudflare 522 | – |

**Open-source clones** all use the IMDb datasets and rebuild daily or weekly with a GitHub Action:
- [mokronos/imdb-heatmap](https://github.com/Mokronos/imdb-heatmap): top 10k shows. It breaks on an unrated pilot.
- [steodose/imdb](https://github.com/steodose/imdb): "used under IMDb's dataset terms for personal, non-commercial use".
- [aria-amini/imdbgraph](https://github.com/aria-amini/imdbgraph)

**What this means for data sourcing:** the grid ecosystem normalises the use of the IMDb non-commercial datasets by hobby sites with an attribution line. That does not change the license text quoted in external-sources.md. Scraping any of these sites is pointless because the upstream data is the same, and SeriesGraph and TVRANKD forbid it.

**Design takeaways**
- Use fixed thresholds, not a relative scale per show.
- Offer a colour-blind palette.
- Show missing episodes as blank or neutral cells.
- A **season-score column** (TMDB, IMDb-derived, RT and Metacritic) would be unique.
- So would **dimming or hatching low-vote cells**.

## 4. TMDB throughput benchmark (measured 2026-09-25)

**Setup**
- Shows were sampled at random from the top 10k by `popularity` in the Crate `show` table. The minimum popularity in that set is 10.98.
- Each show got one call: `GET /3/tv/{id}?append_to_response=season/1,…,season/min(n,20)`.
- Requests used gzip. Python ran on the dev box. No retries.

**Results**

| Run | Shows | Concurrency | Wall time | Throughput | Latency p50 / p90 / max | Mean wire size (gzip) | Mean JSON size (max) | Status codes |
|---|---|---|---|---|---|---|---|---|
| A | 20 | 4 | 1.13 s | 17.7 req/s | 0.19 / 0.28 / 0.35 s | 21.5 KB | 170 KB (1.23 MB) | 19×200, 1×404 |
| B | 40 | 8 | 1.21 s | 33.0 req/s | 0.21 / 0.32 / 0.42 s | 22.7 KB | 145 KB (0.99 MB) | 39×200, 1×404 |

- Every request was a CloudFront cache miss. There were no 429s and no `x-ratelimit` headers.
- The 404s are shows that have been removed from TMDB, so the crawler should apply the existing 404 deletion rule.
- Payloads are dominated by each episode's `crew` and `guest_stars` arrays. TMDB has no field filter. The gzip wire size is about 1/7–1/20 of the JSON size.

**Behaviour checked**
- Appending a season that does not exist (for example `season/9` on Breaking Bad) is **silently omitted**. The crawler can therefore append `season/1..20` blindly, without knowing the season count.
- `season/0` (specials) works. It counts toward the limit of 20 appends.

**Scores TMDB returns**

| Level | Fields | Vote count |
|---|---|---|
| Show | `vote_average`, `vote_count` | yes |
| Season, in the show's `seasons[]` | `vote_average` (keys: `air_date, episode_count, id, name, overview, poster_path, season_number, vote_average`) | **no** |
| Season, as an appended `season/N` | `vote_average` | **no** |
| Episode | `vote_average`, `vote_count`, plus `episode_number, season_number, air_date, runtime, episode_type, still_path, crew, guest_stars` | yes |

Seasons with no votes return `vote_average` 0.0. Breaking Bad S0 is 0.0; S1 is 8.4.

**Coverage in sample B**
- Episodes: 7,074 episodes across 39 shows, heavily weighted by one daily show.
  - 11.7 % have at least 1 vote.
  - 4.3 % have at least 5 votes.
  - 1.9 % have at least 10 votes.
- Seasons: 32.6 % have a non-zero `vote_average`.
- Per show:
  - The median show has 2 % of its aired episodes with at least one vote.
  - 16 of 39 shows have at least one vote on 80 % or more of their aired episodes.
  - 6 of 39 have at least five votes on 80 % or more.
- The distribution is bimodal: popular Western dramas are well covered, while daily soaps, anime and talk shows are nearly empty. **TMDB alone cannot colour most grids.** The IMDb datasets cover 884,806 rated episodes, each with at least 5 votes.

**Extrapolation**

| Scope | Shows | Seasons | Episodes | Requests (`ceil(seasons/20)`) | Transfer (gzip) | At 20 req/s | At 33 req/s (measured) | At ~40 req/s (documented ceiling) |
|---|---|---|---|---|---|---|---|---|
| Top 10k by popularity | 10,000 | 53,102 | 1,952,896 | **10,693** (499 shows have >20 seasons) | ~230 MB (~1.5 GB JSON) | 9 min | **5.5 min** | 4.5 min |
| Full catalog | 246,636 | 352,295 | 5,736,840 | **248,045** (1,045 shows have >20 seasons) | ~0.4–0.6 GB (~3–5 GB JSON, estimated per episode) | 3.4 h | **2.1 h** | 1.7 h |

The full-catalog byte figures are scaled by episode count, not measured. Incremental refreshes via `/tv/changes` (see external-sources.md) make daily runs a small fraction of this.

## 5. Provider comparison

| Provider | Per-season score | Per-episode score | Vote counts | Requests for top 10k | Wall time at allowed rate | Terms fit (non-commercial public site) |
|---|---|---|---|---|---|---|
| **IMDb datasets** (prior doc) | derived from episodes | ✅ | ✅ (≥5) | 2 downloads | seconds | ⚠️ personal/non-commercial, no online database. Widely used by grid hobby sites with the attribution line. **Owner decision.** |
| **TMDB** (measured) | ✅ `vote_average`, free with the show call | ✅ but sparse | episodes ✅, seasons ❌ | 10,693 | ~5.5 min (33 req/s, no 429) | ✅ already in use; attribution |
| **TVmaze** | ❌ | ✅ (≥3 votes) | ❌ | ~10k + ~1k index pages | ~1.5 h at 2 req/s | ✅ CC BY-SA |
| **Trakt** | ✅ Trakt; IMDb, TMDB, RT and Metascore via `/ratings?extended=all` | ✅ same | ✅ | 10k (Trakt only); +53k (external, per season) | 1 h 40 min; +9 h | ❌ VIP required; draft policy bans bulk rating harvesting; MDBList was blocked for this |
| **MDBList** | ❌ | ❌ | show only | ~50 batch calls (show level) | minutes | ⚠️ silent; passes through third-party terms |
| **OMDb** | ❌ | ✅ IMDb copy | only with `detail=full` (unreliable) | ~53k | 53 days free; <1 day at $1/mo | ❌ legal page bans building an index |
| **Simkl** | ❌ | ❌ | show only | – | – | ⚠️ backlink required; "competing service" clause |
| **JustWatch** | ❌ | ❌ | JW rating at title level | – | – | ❌ contract only; scraping banned |
| **Wikidata** | ~58 seasons in total | a few hundred episodes | ❌ | 1–2 SPARQL queries | seconds | ✅ CC0; useful only for RT and Metacritic season IDs |
| **Watchmode / Streaming Availability** | ❌ | ❌ | ❌ | 10k+ | months on the free quota | ✅ but no season data |
| **RT / Metacritic pages** (prior doc) | ✅ critics (and audience per season page) | ⚠️ sparse | ✅ | 10k (all seasons' critic scores) to ~53k | not tested at volume | ❌ terms forbid automated collection |
| **Episode-grid sites** | ❌ | IMDb copies | IMDb | – | – | ❌/⚠️ no APIs, some ban scraping; same upstream data |

## 6. Ranked recommendation

**Per-episode grid**
1. **IMDb datasets**, if the owner accepts the non-commercial dataset license the way the grid hobby sites do. That means shipping the attribution line "Information courtesy of IMDb (https://www.imdb.com). Used with permission." and refreshing daily. It is the only source that can colour most grids.
2. **TMDB season appends** as the always-on, license-clean layer. It takes about 10.7k requests and about 6 min for the top 10k. Append `season/1..20` blindly and hide cells below a vote threshold. Expect well-filled grids only for popular Western shows.
3. **TVmaze** as a CC BY-SA fallback colour where TMDB is empty. It has no counts, so show it visually as a lower-confidence cell.
4. Do not use OMDb or Trakt, for the terms reasons above.

**Per-season scores**
1. **TMDB season `vote_average`**. It comes free with the show call, has no count, and 0.0 means no votes. Fix the dropped `vote_average` mapping first (see existing-crawlers.md).
2. **IMDb, derived** as a vote-weighted mean of the season's episodes, if option 1 of the grid list is accepted.
3. **RT Tomatometer and Metacritic Metascore** remain the only per-season critic scores, and they are what users recognise. No API provides them legitimately: Trakt's `extended=all` does, but it is behind VIP and policy. Wikidata's `P1258`/`P1712` give season URLs for mapping, but the terms problem from external-sources.md stands.
4. **Not recommended:** Trakt (VIP plus the harvesting ban), MDBList (show level only), and Simkl, JustWatch and Watchmode (no season data).
