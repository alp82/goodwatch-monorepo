# Free signals for “Talked about now”

## Short answer

- **What works:** Wikimedia supplies anonymous daily article pageviews back to **2015-07-01**; TMDB supplies daily/weekly trending and popularity with an application key; Netflix supplies weekly global/country TSVs; AniList supplies hourly anime activity; Simkl supplies watcher-ranked charts. Successful live responses and the qualifications are recorded below.[^wm-live][^wm-history][^tmdb-live][^netflix-global][^netflix-country][^anilist-api][^simkl-live]
- **What does not:** these measure reading, catalog activity, viewing, or news coverage rather than social conversation. Wikidata handles identify accounts/communities, not current posts. TMDB movie/show external IDs do **not** contain `tiktok_id` or `youtube_id`. GDELT's live DOC queries returned 429; its owner describes an overloaded service. AniList and Simkl have use conditions; the other community sites are link sources unless sanctioned access is established.[^wm-definition][^tmdb-metric][^tmdb-oas][^gdelt-live][^gdelt-migration][^anilist-terms][^simkl-rules]
- **What it means for map #537 — recommendation:** prototype daily TMDB candidates plus Wikipedia attention lift, with Netflix as a separate weekly reason. Evaluate Simkl as an additional viewing signal; enable AniList only if GoodWatch fits its terms. Keep GDELT optional. Display the source, measurement window, and freshness instead of implying a measured number of social mentions. This is an inference from the evidence here, not a validated ranking formula. Map #543 can use the verified interfaces and coverage below; content discovery remains a separate research/build concern.[^map]

## Scope and method

Research for [#540](https://github.com/alp82/goodwatch-monorepo/issues/540), child of [#537](https://github.com/alp82/goodwatch-monorepo/issues/537), checked **2026-10-14**. Every source footnote includes its URL and check date. “Confirmed” means the touched prior claim matches primary evidence; “corrected” means evidence changes it; “unverifiable” means this check did not establish it. Successful calls are samples, not availability guarantees. Recommendations are explicitly inferences.[^ticket][^map]

Prior material was read with `git show origin/ccr-327ca25f-xd6xns:<path>` at commit `5db32f8212c35b6a5452d684a1745f9af32f36c5`: the report and the film/community notes. The following sections classify the claims from those files that this ticket touches; unrelated platform histories, embeds, and legal claims are outside this check.[^prior-report][^prior-film]

Public endpoint checks used normal HTTP clients and an identifying `GoodWatchResearch/1.0 (https://goodwatch.app; hello@goodwatch.app) issue-540` User-Agent for Wikimedia. No browser/user login flows, security challenges, or anti-bot bypasses were used. TMDB read calls used the project's existing application key; catalog measurements used existing access for read-only Crate SELECTs. No credentials or raw authenticated URLs are included. Evidence needed to reproduce the findings is included in this single file; temporary response captures are not committed.

## 1. Wikimedia: broad daily attention

**Confirmed:** the prior keyless pageviews interface works. Read:

```text
GET https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/
    {project}/{access}/{agent}/{article}/{granularity}/{start}/{end}
```

Use a Wikipedia project such as `en.wikipedia.org`, `all-access`, `user`, a URL-encoded article title with underscores, `daily`, and UTC `YYYYMMDD00` boundaries. The tested range is inclusive. `items[]` carries `project`, `article`, `granularity`, `timestamp`, `access`, `agent`, and integer `views`. The key is the article title **within a Wikipedia project**, not the Wikidata QID. Resolve the work's sitelink before calling.[^wm-live][^wm-getting-started][^wd-sitelinks]

| Live request, checked 2026-10-14 | Result |
|---|---|
| [Fight Club, 2026-10-01–13](https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/Fight_Club/daily/2026100100/2026101300) | HTTP 200; 13 daily items; October 13: 2,625 views |
| [Fight Club, 2015-07-01–03](https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/Fight_Club/daily/2015070100/2015070300) | HTTP 200; 3,399 / 3,524 / 3,336 views |
| [Fight Club, 2015-06-01–03](https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/Fight_Club/daily/2015060100/2015060300) | HTTP 404; outside documented history |

**Confirmed history and current rate budget:** per-article data starts **2015-07-01**. The current Analytics access policy delegates limits to Wikimedia's 2026 policy: **200 requests/minute** for unauthenticated bots with a compliant User-Agent; **10/minute** for unidentified clients. The Analytics policy recommends waiting for each request to finish before the next. Respect `429`/`Retry-After`. These are documented limits, not limits tested by flooding the endpoint.[^wm-history][^wm-policy][^wm-limits]

**Confirmed qualification:** daily data loads after its UTC day finishes, usually within hours but potentially 24 hours or more. HTTP 404 can mean zero views **or** unloaded data; omitted dates can also be zeros. Keep missing recent data distinct from a confirmed zero. `user` excludes traffic classified as spiders/automated, but the classification does not certify every remaining request as human. Redirect article views are not automatically consolidated into the target.[^wm-troubleshooting][^wm-definition]

**Recommendation/inference:** start with explicitly matched English/German sitelinks and a small candidate pool, comparing each article against its own preceding 28 days. Keep language coverage consistent and a minimum absolute-volume floor. A z-score/lift formula from the prior report is **unverifiable as a good ranking** without an evaluation; treat it as the scoring prototype's hypothesis. Pageviews establish attention, not what anyone said.[^prior-report][^wm-definition]

## 2. Wikidata: verified properties and GoodWatch coverage

### The film-note SPARQL was actually run

**Confirmed:** the suggested formatter search completed on `https://query.wikidata.org/sparql`, HTTP 200, **60 bindings / 59 distinct properties**. The query requests `?pLabel` but does not bind a label service, so its label column is empty. Labels were obtained separately through the public `wbgetentities` API. Multiple formatter URLs can belong to one property; this is neither a title coverage query nor proof of access to the linked site's API.[^wd-query][^wd-api][^wd-manual]

```sparql
SELECT ?p ?pLabel ?f WHERE {
  ?p wikibase:propertyType wikibase:ExternalId; wdt:P1630 ?f .
  FILTER(REGEX(STR(?f), "letterboxd|trakt|kinopoisk|douban|metacritic|rottentomatoes|fandom|knowyourmeme|tumblr|reddit|filmarks|watcha|filmaffinity|moviepilot|filmstarts|mubi|simkl|serializd|justwatch|boxofficemojo|the-numbers"))
}
```

The formatter search cannot discover every social property: `hashtag` is not an ExternalId, and TikTok/YouTube/Instagram domains are absent from its regex. Those properties were checked directly. Property existence also does not mean a work has a value or that a listed account is its current official account.[^wd-api]

### Social and community coverage

**Corrected:** “GoodWatch already has Wikidata links” is insufficient as an implementation assumption. The live serving catalog contained **1,261,069 movies** and **234,440 shows**, with **zero nonempty `wikidata_id` values** in either table. For this measurement, join public Wikidata **P4947/P4983 TMDB IDs** to the actual Crate catalog TMDB IDs rather than relying on that empty field. These are all catalog rows, not just presentable titles or the map's eventual candidate pool.[^catalog][^wd-api][^repo-external]

| Property (definition confirmed) | Value and link template | Movies in catalog | Shows in catalog |
|---|---|---:|---:|
| [P3984](https://www.wikidata.org/wiki/Property:P3984) | Subreddit; `https://www.reddit.com/r/$1/` | 57 | 588 |
| [P2572](https://www.wikidata.org/wiki/Property:P2572) | Hashtag; `https://hashtags-hub.toolforge.org/$1` | 157 | 492 |
| [P2002](https://www.wikidata.org/wiki/Property:P2002) | X (Twitter) username; `https://x.com/$1` | 2,927 | 5,133 |
| [P2003](https://www.wikidata.org/wiki/Property:P2003) | Instagram username; `https://www.instagram.com/$1/` | 2,084 | 3,145 |
| [P2013](https://www.wikidata.org/wiki/Property:P2013) | Facebook username; `https://www.facebook.com/$1` | 3,678 | 2,959 |
| [P7085](https://www.wikidata.org/wiki/Property:P7085) | TikTok username; `https://www.tiktok.com/@$1` | 93 | 531 |
| [P2397](https://www.wikidata.org/wiki/Property:P2397) | YouTube channel ID; `https://www.youtube.com/channel/$1` | 246 | 1,285 |
| [P3943](https://www.wikidata.org/wiki/Property:P3943) | Tumblr username; `https://$1.tumblr.com/` | 55 | 31 |

Definitions and formatter templates: confirmed by live Wikidata entity data. Counts: checked 2026-10-14 by complete, parsed exports intersected with the serving catalog.[^wd-api][^wd-query][^catalog]

Across these eight properties, **6,080 movies** and **7,790 shows** have at least one matched value. The seven-property show export returned 8,798 bindings in 40.10 seconds; the movie export returned 6,294 in 15.87 seconds. Tumblr adds 55 movies and 31 shows before deduplication against the other properties. These are distinct title counts, not a sum of property counts.[^wd-query][^catalog]

These counts mean “a catalog TMDB ID has at least one corresponding Wikidata statement,” **not** “GoodWatch stores this handle.” Each title is counted once per property even when multiple QIDs/values match. No account ownership, present-day URL resolution, or post availability was inferred. A subreddit/hashtag can be useful for matching but is not itself a volume signal.[^wd-query][^catalog]

Reproduction: read the two catalog ID sets with the following read-only SQL and run the SPARQL separately with `P4983` for shows and `P4947` for movies. Intersect distinct numeric `?tmdb` strings containing each optional field with the respective SQL ID set.[^catalog][^wd-query]

```sql
SELECT tmdb_id, wikidata_id FROM doc.movie ORDER BY tmdb_id LIMIT 2000000;
SELECT tmdb_id, wikidata_id FROM doc."show" ORDER BY tmdb_id LIMIT 2000000;
```

```sparql
SELECT ?item ?tmdb ?subreddit ?hashtag ?twitter ?instagram ?facebook ?tiktok ?youtube WHERE {
  hint:Query hint:optimizer "None" .
  ?item wdt:P4983 ?tmdb . # Replace P4983 with P4947 for movies.
  OPTIONAL { ?item wdt:P3984 ?subreddit }
  OPTIONAL { ?item wdt:P2572 ?hashtag }
  OPTIONAL { ?item wdt:P2002 ?twitter }
  OPTIONAL { ?item wdt:P2003 ?instagram }
  OPTIONAL { ?item wdt:P2013 ?facebook }
  OPTIONAL { ?item wdt:P7085 ?tiktok }
  OPTIONAL { ?item wdt:P2397 ?youtube }
  FILTER(BOUND(?subreddit)||BOUND(?hashtag)||BOUND(?twitter)||BOUND(?instagram)||
         BOUND(?facebook)||BOUND(?tiktok)||BOUND(?youtube))
}
```

Tumblr was measured in a separate small export, then intersected and included in the union above:

```sparql
SELECT ?item ?value ?movie ?show WHERE {
  ?item wdt:P3943 ?value .
  OPTIONAL { ?item wdt:P4947 ?movie }
  OPTIONAL { ?item wdt:P4983 ?show }
  FILTER(BOUND(?movie)||BOUND(?show))
}
```

A first combined query hit the 60-second deadline and returned **HTTP 200 with truncated JSON plus a Java error**. It was rejected, not counted. Split requests use the repository's existing optimizer hint and pauses of at least 60 seconds. WDQS documents 60 seconds per query and 60 seconds of processing per client per minute; honor 429/Retry-After. Its 2026–27 backend migration means the Blazegraph-specific hint must be revisited when migrating endpoints.[^wd-manual][^repo-external]

### Previously provisional ID crosswalks

**Confirmed** by the live property definitions: IMDb **[P345](https://www.wikidata.org/wiki/Property:P345)**, TMDB movie/show **[P4947](https://www.wikidata.org/wiki/Property:P4947)/[P4983](https://www.wikidata.org/wiki/Property:P4983)**, TVDB **[P4835](https://www.wikidata.org/wiki/Property:P4835)**, Trakt path **[P8013](https://www.wikidata.org/wiki/Property:P8013)**, Letterboxd film **[P6127](https://www.wikidata.org/wiki/Property:P6127)**, MAL anime **[P4086](https://www.wikidata.org/wiki/Property:P4086)**, AniList anime/manga **[P8729](https://www.wikidata.org/wiki/Property:P8729)/[P8731](https://www.wikidata.org/wiki/Property:P8731)**, Kitsu anime **[P11495](https://www.wikidata.org/wiki/Property:P11495)**, Know Your Meme slug **[P13484](https://www.wikidata.org/wiki/Property:P13484)**, Kinopoisk film **[P2603](https://www.wikidata.org/wiki/Property:P2603)**, Douban film **[P4529](https://www.wikidata.org/wiki/Property:P4529)**, Rotten Tomatoes **[P1258](https://www.wikidata.org/wiki/Property:P1258)**, Metacritic **[P1712](https://www.wikidata.org/wiki/Property:P1712)**, FilmAffinity film **[P480](https://www.wikidata.org/wiki/Property:P480)**, The Numbers movie **[P3808](https://www.wikidata.org/wiki/Property:P3808)**, AlloCiné film/series **[P1265](https://www.wikidata.org/wiki/Property:P1265)/[P1267](https://www.wikidata.org/wiki/Property:P1267)**, Filmweb.pl film **[P5032](https://www.wikidata.org/wiki/Property:P5032)**, Netflix **[P1874](https://www.wikidata.org/wiki/Property:P1874)**, Fandom article/wiki **[P6262](https://www.wikidata.org/wiki/Property:P6262)/[P4073](https://www.wikidata.org/wiki/Property:P4073)**, AniDB anime **[P5646](https://www.wikidata.org/wiki/Property:P5646)**, aniSearch anime **[P12477](https://www.wikidata.org/wiki/Property:P12477)**. These confirm identity/labels, not numerical catalog coverage for these non-social properties.[^wd-api]

**Corrected/refined:** [P1237](https://www.wikidata.org/wiki/Property:P1237) is explicitly the **former Box Office Mojo scheme**; [P7299](https://www.wikidata.org/wiki/Property:P7299) is **MUBI film numeric ID**; [P6760](https://www.wikidata.org/wiki/Property:P6760) is **Know Your Meme numeric ID**, distinct from slug [P13484](https://www.wikidata.org/wiki/Property:P13484); [P8731](https://www.wikidata.org/wiki/Property:P8731) is **manga**, so use [P8729](https://www.wikidata.org/wiki/Property:P8729) for AniList anime. The formatter query establishes previously unknown **Filmarks [P13904](https://www.wikidata.org/wiki/Property:P13904)**, **Moviepilot movie/show [P5786](https://www.wikidata.org/wiki/Property:P5786)/[P5925](https://www.wikidata.org/wiki/Property:P5925)**, **Filmstarts title [P8531](https://www.wikidata.org/wiki/Property:P8531)**, and a separate **Trakt film ID [P12492](https://www.wikidata.org/wiki/Property:P12492)** in addition to path [P8013](https://www.wikidata.org/wiki/Property:P8013). It did not establish JustWatch, Simkl, Serializd, or Watcha property numbers; absence from this query is **unverifiable evidence of absence**, not proof that none exists.[^wd-api][^wd-query]

## 3. TMDB: titles, handles, trending, popularity

**Confirmed/corrected:** movie/show external IDs support Facebook, Instagram, Twitter, IMDb and Wikidata (TV also TVDB and legacy fields). **TikTok/YouTube are person fields, absent from the movie and TV response schemas and all four live title samples.** Thus “are they filled on titles?” has no supported title-field path in the current schema; they are absent, not present-but-null. This is sample/schema evidence, not an exhaustive audit of every TMDB title.[^tmdb-movie][^tmdb-tv][^tmdb-person][^tmdb-oas][^tmdb-live]

| Live HTTP 200 sample | Wikidata | Facebook / Instagram / Twitter | TikTok / YouTube |
|---|---|---|---|
| [Movie 550: Fight Club](https://api.themoviedb.org/3/movie/550/external_ids) | Q190050 | FightClub / null / null | Both keys absent |
| [Movie 11: Star Wars](https://api.themoviedb.org/3/movie/11/external_ids) | Q17738 | StarWars / starwars / starwars | Both keys absent |
| [TV 1399: Game of Thrones](https://api.themoviedb.org/3/tv/1399/external_ids) | Q23572 | GameOfThrones / gameofthrones / GameOfThrones | Both keys absent |
| [TV 66732: Stranger Things](https://api.themoviedb.org/3/tv/66732/external_ids) | Q19798734 | StrangerThingsTV / strangerthingstv / Stranger_Things | Both keys absent |

Checked **2026-10-14** using the existing app key. Both required examples also returned 401 when requested without a key. The official OAS example for movie 550 has an outdated null Wikidata value; the live response has Q190050. Examples are not current observations.[^tmdb-live][^tmdb-oas]

**Confirmed:** read `GET /3/trending/movie/{day|week}` and `/3/trending/tv/{day|week}` for short-window candidate ordering. Read `/3/movie/popular`, `/3/tv/popular`, or discover with `sort_by=popularity.desc` for popularity ordering. Live movie/day, TV/week and both popular endpoints each returned HTTP 200 with 20 page-one results. Use `(media_type, id)` as the join key. Do not interpret the returned `popularity` value as the hidden trending score merely because it appears in a trending response.[^tmdb-trending-movie][^tmdb-trending-tv][^tmdb-popular-movie][^tmdb-popular-tv][^tmdb-live][^tmdb-metric]

Popularity combines daily votes, pageviews, favorites/watchlists, release or episode timing, total votes, and the previous score; trending has shorter daily/weekly windows. Exact weights are not published here. Retain your own dated snapshots for a change-over-time signal instead of inventing a documented historical trending endpoint. TMDB says its old 40-per-10-seconds limit was removed; a changeable upper limit around **40 requests/second** remains. Respect 429. The map already settles non-commercial TMDB usage; this research does not redefine it.[^tmdb-metric][^tmdb-rate][^map]

## 4. Netflix: official weekly viewing attention

**Confirmed:** the suspected official URL works: [all-weeks-global.tsv](https://www.netflix.com/tudum/top10/data/all-weeks-global.tsv), HTTP 200, `text/tab-separated-values`, **11,000 rows**, weeks **2021-07-04 through 2026-10-04**. Its nine columns are:[^netflix-global]

```text
week category weekly_rank show_title season_title weekly_hours_viewed
runtime weekly_views cumulative_weeks_in_top_10
```

The [country TSV](https://www.netflix.com/tudum/top10/data/all-weeks-countries.tsv) also returned 200, **512,200 rows**, the same date range, with `country_name country_iso2 week category weekly_rank show_title season_title cumulative_weeks_in_top_10`. It contains **ranks, not country hours/views**. Neither header contains TMDB/IMDb IDs; resolve title, category, and season, then retain an explicit matching decision. Missing numeric fields must stay missing, rather than becoming zero.[^netflix-country][^netflix-global]

**Confirmed cadence:** Netflix describes Monday–Sunday measurement and Tuesday publication; views equal hours watched divided by runtime. **Newly verified freshness limit:** the inspected Top 10 page already displayed the following week while both downloaded TSVs ended October 4. Record `max(week)` from each download, not merely fetch time. **Unverifiable:** the prior “rounded to nearest 10,000” rule was not established from the inspected primary material. Recommendation/inference: show Netflix's weekly rank as a separate reason, not a daily discussion count or an all-streamer chart.[^netflix-method][^netflix-global][^netflix-country][^prior-film]

## 5. AniList: hourly anime activity, conditional use

**Confirmed live:** no key is needed for this public query; POST JSON to `https://graphql.anilist.co` returned HTTP 200 with `id`, `idMal`, `trending`, `popularity`, and `siteUrl`:[^anilist-api]

```graphql
{
  Page(page: 1, perPage: 3) {
    media(type: ANIME, sort: TRENDING_DESC) {
      id idMal title { romaji english } trending popularity siteUrl
    }
  }
}
```

`Media.trending` means related activity **in the past hour**; `Media.trends` supplies daily statistics and `MediaTrend.trending` means that day's activity. `popularity` is the number of users with the media on their lists. Recommendation: join anime through MAL P4086 or AniList anime P8729; do not substitute manga P8731.[^anilist-media][^anilist-trend][^wd-api]

**Confirmed:** docs still warn of a degraded **30 requests/minute**, normally 90, plus burst limits. **Corrected:** the prior “headers do not reflect the reduced limit” is not true of the tested response: `X-RateLimit-Limit: 30`, `X-RateLimit-Remaining: 29`. Use the lower documented budget and back off on 429.[^anilist-rate][^anilist-api]

**Corrected qualification:** technical access is not unrestricted permission. AniList prohibits mass collection/backup/storage and competing non-complementary anime/manga trackers. Commercial use above its stated $150/month threshold needs licensing. Recommendation/inference: assess GoodWatch's tracker functionality before choosing this adapter; do not assume a public endpoint authorizes a catalog-wide mirror.[^anilist-terms]

## 6. GDELT: news volume, currently an unreliable baseline

**Confirmed documented interface:** DOC 2.0 supports phrase queries and JSON timelines. `timelinevol` reports the percentage of monitored coverage matching the query; `timelinevolraw` reports matching article counts with `norm`, the monitored denominator. These are press attention, not audience opinions. Read, for example:[^gdelt-doc]

```text
GET https://api.gdeltproject.org/api/v2/doc/doc
    ?query=%22Stranger%20Things%22&mode=timelinevolraw&format=json&timespan=7d
```

**Unverifiable live success:** two spaced requests returned **HTTP 429**, asking for at most one request every five seconds. No bypass was attempted. **Corrected operational assumption:** the owner's June 30, 2026 post says legacy search is overloaded during its Spanner migration and directs researchers to temporary minute quadgram/TOC files. That alternative is not a drop-in per-title volume endpoint and was not validated here.[^gdelt-live][^gdelt-migration]

Recommendation/inference: keep this adapter optional and mark missing data unavailable. If it recovers, use exact title plus discriminating terms for ambiguous names, aggregate matched articles over a fixed window, and retain the denominator. Validate matching against sampled links before treating “It,” “You,” or remake titles as measured attention. An unavailable source must not become a zero-coverage penalty.[^gdelt-doc][^gdelt-live]

## 7. Other sources: one-line disposition each

| Source | Prior claim status and usable role |
|---|---|
| **Simkl** | **Confirmed with qualification:** current official docs offer today/week/month watcher charts and ID crosswalks; bare [today CDN JSON](https://data.simkl.in/discover/trending/today_100.json) returned 200 with 100 movies + 100 shows + 100 anime. Heading says “No API key required,” but body requires `client_id`, app name/version, and User-Agent; honor documented integration, attribution, sync and commercial-use requirements rather than treating the bare request as the complete contract.[^simkl-live][^simkl-doc][^simkl-rules] |
| **Serializd** | **Unverifiable** absolute “no API”; **confirmed** public weekly most-watched episode posts on its blog. Use community/chart links; no sanctioned machine ranking interface established in this check.[^serializd] |
| **Douban** | **Unverifiable** API-closure dates/blanket scraping assertions; live film request returned 418 and web retrieval reached a security boundary. Stop there; use optional known-ID outbound film links, not a validated signal adapter.[^douban] |
| **Kinopoisk** | **Confirmed** public title pages show ratings and critic/audience reviews; **unverifiable** absolute “no official public API.” Use title links; no sanctioned ranking API established.[^kinopoisk] |
| **Filmarks** | **Confirmed** public title/review pages and Wikidata P13904; **unverifiable** absolute “no API.” Use outbound links; no sanctioned signal interface established.[^filmarks][^wd-api] |
| **Podcast Index** | **Confirmed** free-key search/trending/feed/episode interfaces; **corrected** auth: first-party example hashes key + secret + timestamp with **SHA-1, not HMAC**. Feed title/author/owner matching and podcast trending are not per-movie discussion volume; useful episode/feed links, no authenticated call made.[^podcast-oas][^podcast-auth] |
| **Listen Notes** | **Confirmed, qualified:** 150 free requests/month, free search capped at 30 results/query, required attribution, and restrictions on server-side prefetch/cache/index/storage except IDs/publication dates. Sparse episode discovery/links, not a free catalog-wide ranking backbone; no authenticated call made.[^listen-pricing] |

**Additional Simkl signal detail — confirmed:** the live CDN response had `Cache-Control: max-age=3600` and `Last-Modified: Wed, 14 Oct 2026 10:32:01 GMT`; category lists were ordered by descending `watched`. The first movie had `watched: 217` and `rank: 899`, so `rank` is **not** the item's position within that trending list. Docs target hourly today refresh and daily week/month refresh; the extra CDN hour matters. The rules require source/title links and constrain commercial use; they also require Simkl sync when a tracker already syncs another tracker.[^simkl-live][^simkl-doc][^simkl-rules]

## 8. How existing products present “what people are saying”

Descriptions below are from public first-party pages inspected **2026-10-14**. They establish UI patterns, not permission to copy those services' review text.

| Product and inspected page | What appeared | Implication for the map (inference) |
|---|---|---|
| [JustWatch / Oppenheimer](https://www.justwatch.com/us/movie/oppenheimer) | Daily chart place/movement, ratings/counts and nearby titles. Its explanation uses last-24-hour offer clicks, watchlist additions and “seen” actions. No review-text/conversation module appeared in that inspected response.[^justwatch] | Give a concrete source/window and chart movement for attention. A streaming chart does not itself show conversation. |
| [Letterboxd / Oppenheimer](https://letterboxd.com/film/oppenheimer-2023/) | **Confirmed** prior “Popular reviews” claim: member attribution, review text, review/interaction links; a separate “Mentioned by” section links publisher stories.[^letterboxd] | Individually attributed voices and links, separate from popularity; use outbound links within the map's scope. |
| [Rotten Tomatoes / Ticket to Paradise](https://www.rottentomatoes.com/m/ticket_to_paradise_2022) | Tomatometer/Popcornmeter and counts; “What to Know” separates **Critics Consensus** and **Audience Says**, linking to respective reviews; individual reviews have author/date. RT's own product post explains Audience Says as common points in users' reviews.[^rt-title][^rt-product] | Distinguish critic assessment, audience sentiment and attention. GoodWatch has not established evidence for generating its own review consensus. |

The prior JustWatch “web-only charts/partner API,” Letterboxd API eligibility, RT API closure, and review-widget absence claims are **unverifiable in this scoped check**; the observed public UI cannot establish an API contract or a historical shutdown. Do not promote those absolutes into implementation facts. #537 already limits these sites to deep links.[^prior-film][^map]

## 9. Handoff to the ranking prototype

Recommended experiments, not implementation decisions:

1. Build a daily, shared candidate set from TMDB movie/show trending; attach Wikipedia's most recent complete day and comparison baseline where a verified sitelink exists. Test rank movement and normalized attention lift separately before blending them.[^tmdb-live][^wm-live]
2. Add explicitly labeled weekly Netflix ranks. Show each source's actual latest measurement timestamp; Simkl and AniList have different clocks and eligibility conditions.[^netflix-global][^simkl-doc][^anilist-media][^anilist-terms]
3. Compare results against a small editorial sample: remakes, generic names, new episodes, long-running anime and older rediscoveries. Account/hashtag presence is matching evidence, not a scoring bonus. Do not multiply unrelated raw units together.[^wd-query][^tmdb-metric]
4. If one source fails, retain valid others and freshness flags. Handle 404/omitted Wikimedia dates and GDELT 429 without inventing zeros. Keep source contributions explainable and content attachment independent.[^wm-troubleshooting][^gdelt-live]

Remaining verification limits: no sustained availability or saturation tests; no calibrated ranking evaluation; no ownership checks for individual social handles; no authenticated Podcast Index/Listen Notes calls; no resolution of AniList/Simkl integration eligibility for GoodWatch. These are bounded follow-ups, not missing evidence disguised as confirmations.

## Sources and dated observations

[^ticket]: [GitHub #540](https://github.com/alp82/goodwatch-monorepo/issues/540), full issue and comments read with `gh issue view`, checked 2026-10-14.
[^map]: [GitHub #537](https://github.com/alp82/goodwatch-monorepo/issues/537), full issue and comments read with `gh issue view`, checked 2026-10-14.
[^prior-report]: [Prior report at inspected commit](https://github.com/alp82/goodwatch-monorepo/blob/5db32f8212c35b6a5452d684a1745f9af32f36c5/docs/research/reports/Social%20content%20embeds%20deep%20dive.md), read with `git show`, checked 2026-10-14. Provenance only, not independent confirmation.
[^prior-film]: [Prior film/community notes](https://github.com/alp82/goodwatch-monorepo/blob/5db32f8212c35b6a5452d684a1745f9af32f36c5/docs/research/research_notes/Social%20content%20embeds%20deep%20dive/film_communities_media.md), read with `git show`, checked 2026-10-14. Provenance only.
[^wm-live]: [Live recent pageviews](https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/Fight_Club/daily/2026100100/2026101300), [July 2015](https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/Fight_Club/daily/2015070100/2015070300), [June 2015](https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/Fight_Club/daily/2015060100/2015060300); checked 2026-10-14, HTTP 200/200/404 respectively.
[^wm-history]: [Wikimedia pageview reference](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/reference/page-views.html), checked 2026-10-14.
[^wm-getting-started]: [Analytics getting started](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/getting-started.html), checked 2026-10-14.
[^wm-policy]: [Analytics access policy](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/access-policy.html), checked 2026-10-14.
[^wm-limits]: [Wikimedia 2026 rate limits](https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits), checked 2026-10-14.
[^wm-troubleshooting]: [Analytics troubleshooting](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/troubleshooting.html), checked 2026-10-14.
[^wm-definition]: [Pageview definition and automated traffic](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/concepts/page-views.html), checked 2026-10-14.
[^wd-sitelinks]: [Wikidata public entity data](https://www.wikidata.org/wiki/Special:EntityData/Q190050.json), checked 2026-10-14; sitelinks identify the Wikipedia project/title.
[^wd-api]: [Wikidata `wbgetentities` live lookup](https://www.wikidata.org/w/api.php?action=wbgetentities&ids=P345%7CP4947%7CP4983%7CP3984%7CP2572%7CP2002%7CP2003%7CP2013%7CP7085%7CP2397%7CP8013%7CP6127%7CP4086%7CP8731%7CP8729%7CP11495%7CP13484&props=labels%7Cclaims&languages=en&format=json), plus property-label batches for every additional P-number named above using the same public API; checked 2026-10-14, HTTP 200. Individual definitions are accessible at `https://www.wikidata.org/wiki/Property:<P-number>`.
[^wd-query]: [Wikidata SPARQL endpoint](https://query.wikidata.org/sparql), checked 2026-10-14; exact queries and catalog-intersection procedure above.
[^wd-manual]: [WDQS manual, limits, query formats and migration notice](https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual), checked 2026-10-14.
[^catalog]: [GoodWatch private live Crate SQL endpoint](http://10.0.0.11:4200/_sql), checked 2026-10-14 with the SELECTs above; HTTP 200, movie 1,261,069 rows / show 234,440 rows. No database writes. This source requires existing infrastructure access and is not public.
[^repo-external]: [GoodWatch existing Wikidata mapping documentation](https://github.com/alp82/goodwatch-monorepo/blob/4003c90d/docs/external-ids.md) and [export implementation](https://github.com/alp82/goodwatch-monorepo/blob/4003c90d/goodwatch-flows/windmill/f/external_ids/wikidata.py), checked 2026-10-14.
[^tmdb-movie]: [TMDB movie external IDs](https://developer.themoviedb.org/reference/movie-external-ids), checked 2026-10-14.
[^tmdb-tv]: [TMDB TV external IDs](https://developer.themoviedb.org/reference/tv-series-external-ids), checked 2026-10-14.
[^tmdb-person]: [TMDB person external IDs](https://developer.themoviedb.org/reference/person-external-ids), checked 2026-10-14.
[^tmdb-oas]: [TMDB official OpenAPI JSON](https://developer.themoviedb.org/openapi/tmdb-api.json), downloaded/parsed, checked 2026-10-14.
[^tmdb-live]: Live [movie 550](https://api.themoviedb.org/3/movie/550/external_ids), [movie 11](https://api.themoviedb.org/3/movie/11/external_ids), [TV 1399](https://api.themoviedb.org/3/tv/1399/external_ids), [TV 66732](https://api.themoviedb.org/3/tv/66732/external_ids), [movie/day trending](https://api.themoviedb.org/3/trending/movie/day), [TV/week trending](https://api.themoviedb.org/3/trending/tv/week), [popular movies](https://api.themoviedb.org/3/movie/popular), [popular TV](https://api.themoviedb.org/3/tv/popular); checked 2026-10-14, HTTP 200 with existing app key. URLs deliberately omit the secret query parameter.
[^tmdb-trending-movie]: [TMDB movie trending reference](https://developer.themoviedb.org/reference/trending-movies), checked 2026-10-14.
[^tmdb-trending-tv]: [TMDB TV trending reference](https://developer.themoviedb.org/reference/trending-tv), checked 2026-10-14.
[^tmdb-popular-movie]: [TMDB popular movies](https://developer.themoviedb.org/reference/movie-popular-list), checked 2026-10-14.
[^tmdb-popular-tv]: [TMDB popular TV](https://developer.themoviedb.org/reference/tv-series-popular-list), checked 2026-10-14.
[^tmdb-metric]: [TMDB popularity/trending explanation](https://developer.themoviedb.org/docs/popularity-and-trending), checked 2026-10-14.
[^tmdb-rate]: [TMDB rate limits](https://developer.themoviedb.org/docs/rate-limiting), checked 2026-10-14.
[^netflix-global]: [Netflix global TSV](https://www.netflix.com/tudum/top10/data/all-weeks-global.tsv), checked 2026-10-14, HTTP 200; parsed header, row count and week range.
[^netflix-country]: [Netflix countries TSV](https://www.netflix.com/tudum/top10/data/all-weeks-countries.tsv), checked 2026-10-14, HTTP 200; parsed header, row count and week range.
[^netflix-method]: [Netflix Top 10 page/methodology/download links](https://www.netflix.com/tudum/top10), checked 2026-10-14.
[^anilist-api]: [AniList GraphQL endpoint](https://graphql.anilist.co), checked 2026-10-14, unauthenticated POST of query above returned HTTP 200 and limit/remaining headers 30/29.
[^anilist-media]: [AniList Media schema](https://docs.anilist.co/reference/object/media), checked 2026-10-14.
[^anilist-trend]: [AniList MediaTrend schema](https://docs.anilist.co/reference/object/mediatrend), checked 2026-10-14.
[^anilist-rate]: [AniList rate-limit guide](https://docs.anilist.co/guide/rate-limiting), checked 2026-10-14.
[^anilist-terms]: [AniList API terms](https://docs.anilist.co/guide/terms-of-use), checked 2026-10-14.
[^gdelt-doc]: [GDELT DOC 2.0 first-party reference](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/), checked 2026-10-14.
[^gdelt-live]: [GDELT seven-day raw-volume query](https://api.gdeltproject.org/api/v2/doc/doc?query=%22Stranger%20Things%22&mode=timelinevolraw&format=json&timespan=7d), checked 2026-10-14, HTTP 429 on two spaced attempts.
[^gdelt-migration]: [GDELT June 30, 2026 migration/overload notice](https://blog.gdeltproject.org/using-the-new-web-ngrams-dataset-to-find-relevant-coverage/), checked 2026-10-14.
[^simkl-live]: [Simkl today CDN JSON](https://data.simkl.in/discover/trending/today_100.json), checked 2026-10-14, HTTP 200; parsed lists, external IDs, watched/rank and cache headers.
[^simkl-doc]: [Simkl current trending reference](https://api.simkl.org/api-reference/trending), checked 2026-10-14.
[^simkl-rules]: [Simkl API rules](https://api.simkl.org/api-rules), checked 2026-10-14.
[^serializd]: [Serializd public blog](https://www.serializd.com/blog), checked 2026-10-14; includes October 4–11 most-watched episodes.
[^douban]: [Douban film-page probe](https://movie.douban.com/subject/1291546/), checked 2026-10-14, HTTP 418; security challenge not bypassed.
[^kinopoisk]: [Kinopoisk Inception page](https://www.kinopoisk.ru/film/447301/), checked 2026-10-14.
[^filmarks]: [Filmarks public movie page](https://filmarks.com/movies/109427), checked 2026-10-14.
[^podcast-oas]: [Podcast Index first-party OpenAPI](https://podcastindex-org.github.io/docs-api/pi_api.json), checked 2026-10-14.
[^podcast-auth]: [Podcast Index first-party auth example](https://github.com/Podcastindex-org/example-code/blob/master/README.md), checked 2026-10-14.
[^listen-pricing]: [Listen Notes API pricing and free-use restrictions](https://www.listennotes.com/api/pricing/), checked 2026-10-14.
[^justwatch]: [JustWatch Oppenheimer title page](https://www.justwatch.com/us/movie/oppenheimer), checked 2026-10-14.
[^letterboxd]: [Letterboxd Oppenheimer title page](https://letterboxd.com/film/oppenheimer-2023/), checked 2026-10-14.
[^rt-title]: [Rotten Tomatoes Ticket to Paradise](https://www.rottentomatoes.com/m/ticket_to_paradise_2022), checked 2026-10-14.
[^rt-product]: [Rotten Tomatoes first-party score-box explanation](https://editorial.rottentomatoes.com/article/weve-updated-our-score-boxes/), checked 2026-10-14.
