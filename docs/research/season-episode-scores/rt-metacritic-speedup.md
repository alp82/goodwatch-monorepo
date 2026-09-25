# Rotten Tomatoes and Metacritic: faster, more reliable show and season crawls

Researched 2026-09-25. The question: how can the `f/rotten_web` and `f/metacritic_web` crawlers, and new per-season crawlers built on them, become much faster and more reliable? Read [existing-crawlers.md](existing-crawlers.md) §1.4–1.5 and [external-sources.md](external-sources.md) §5–6 first. This doc builds on them and does not repeat them.

Method:
- Read the crawler code.
- Read Windmill job history through the read-only API (2,000 recent `fetch` leaf jobs per site, plus logs and results of 100 per site).
- Pulled the top 10k shows by popularity from CrateDB `show` and `season`.
- Ran 15 Wikidata SPARQL queries. The last one returned HTTP 429, and I stopped there.
- Sent a small number of live requests:
  - Rotten Tomatoes: 5 pages and 4 sitemap files.
  - Metacritic: 3 pages, 10 sitemap files, 2 backend JSON calls.
  - One RT page and one Metacritic page from the production host `10.0.0.10`.
- Every request used an honest user agent, `GoodWatchResearch/0.1 (+https://goodwatch.app)`. None of them hit a 403, a 429 or a challenge.

## TL;DR

- **Most of the ~90% misses are not bad guesses. They are titles that are not on RT or Metacritic at all.**
  - Of the top 10k shows, GoodWatch already has an RT URL for 4,085 and a Metacritic URL for 2,698.
  - Wikidata adds only 281 (RT) and 272 (MC) more.
  - An exact title match against the sites' own sitemaps adds only about 96 more for each site.
  - So the rest (about 5.6k shows for RT, 7k for MC) are mostly shows the sites don't list.
  - The real waste is sending 1–4 guessed requests, in a headless browser, for every one of the 1.37M movie and TV titles, over and over.
- **ID resolution without guessing works and costs about 16 requests in total:**
  - one SPARQL query (15,336 rows in 18 s);
  - the RT sitemaps: 25,398 series slugs, and ~20k season URLs in the first of 3 season files;
  - the Metacritic TV sitemap: 9 files, 6,767 unique slugs.
- **Metacritic IDs are reliable.** Wikidata agrees with the stored GoodWatch URL for 98% of shows (2,172 of 2,213).
- **The RT URLs GoodWatch stores are often legacy slugs.** Wikidata agrees for only 86% (2,398 of 2,777). Most of the differences are old underscore slugs that 301-redirect to the canonical hyphen slug; `/tv/the_mentalist` redirects to `/tv/the-mentalist`. The crawler stores the requested URL, not the canonical one.
- **No headless browser is needed.**
  - Plain HTTP returns 200 with full server-rendered data from this machine and from production. RT answers in 0.3–0.7 s (31–40 KB gzip); Metacritic in 0.9–1.2 s (145 KB gzip).
  - The RT crawler spends about 9.5 s per title (median 9.8 s) launching Chromium.
- **One request per show gets every season's critic score:**
  - The RT series page has `<tile-season>` elements with each season's Tomatometer, and JSON-LD `containsSeason` URLs.
  - Metacritic's show page (`__NUXT_DATA__`), or its backend JSON (`backend.metacritic.com/composer/...`, 49 KB gzip, 0.44 s), has every season's Metascore and review count. It also has the show's **IMDb ID**, which verifies the match for free.
  - Audience or user scores per season still need one season page each.
- **Estimated time for the top 10k shows' seasons at a polite 1 request per 2 s per site:**
  - With today's design (guess, Playwright, one Windmill job per title): about **3 days for RT and 5–6 days for MC**, if dedicated to this. Today the queue actually cycles through 1.37M titles, so a full pass takes **~200 days for RT and ~290 days for MC**.
  - With the recommended design: **~2.4 h (RT) and ~1.7 h (MC) for critic scores of all seasons**, and **~15 h (RT) and ~10 h (MC) including per-season audience and user scores**. After that, a weekly refresh of airing shows takes a few thousand requests per site.

## 1. ID resolution without slug guessing

### 1.1 Wikidata

Properties, with English labels confirmed by SPARQL:
- P1258 Rotten Tomatoes ID
- P1712 Metacritic ID
- P345 IMDb ID
- P4983 TMDB TV series ID
- P4947 TMDB movie ID

Values are site paths, for example `tv/breaking_bad`, `tv/the-crazy-ones` and `tv/barry/season-4`.

Counts measured on query.wikidata.org on 2026-09-25:

| Query | Count |
|---|---|
| Items with a TMDB TV ID (P4983) | 63,777 |
| … of which with an RT ID | 8,640 |
| … of which with a Metacritic ID | 6,143 |
| … with both | 4,051 |
| All RT IDs starting `tv/` | 25,077 |
| RT series-level IDs (`^tv/[^/]+$`) | 8,567 on 8,526 items; 8,367 items have a TMDB or IMDb ID |
| RT season IDs (`tv/x/sNN`) | 1,558 |
| RT episode IDs (`tv/x/sNN/eNN`) | 14,912 |
| All Metacritic IDs starting `tv/` | 70,375 |
| MC series-level IDs | 6,726 on 6,715 items; 6,500 items have a TMDB or IMDb ID |
| MC season-and-episode IDs (`tv/x/season-N…`) | 63,649, of which 59,543 are episodes, so about 4.1k are seasons |
| Items that are a TV season (Q3464665) | 26,537; 1,408 have an RT ID and 4,015 have an MC ID |

**Per-season IDs exist but are sparse.** There are about 1.5k RT and 4k MC season IDs. They are not needed anyway: RT and MC season URLs are deterministic once the show slug is known (`/sNN`, `/season-N/`), and both sites list their seasons on the show page.

**Joined against the GoodWatch top 10k shows** (CrateDB `show` ordered by `popularity`, down to 10.86; the join key is the Wikidata P4983 value = `tmdb_id`):

| | RT | Metacritic |
|---|---|---|
| GoodWatch has a URL | 4,085 (score: 1,614) | 2,698 (score: 1,717) |
| Wikidata has an ID | 3,058 | 2,485 |
| Both have one | 2,777, 2,398 agree (86%) | 2,213, 2,172 agree (98%) |
| Wikidata only (new) | **281** | **272** |
| Union | 4,366 shows, 22,570 seasons | 2,970 shows, 15,739 seasons |

The top 1k looks the same: RT 568 stored, +30 new; MC 474 stored, +27 new.

In the RT disagreements, both sides usually point to the same page: GoodWatch has `law_order` or `gilmore_girls`, and Wikidata has `law-and-order` or `gilmore-girls`, which is the slug in RT's sitemap. Some are real mismatches: `the_daily_show_1996` vs `the_daily_show`, `jujutsu_kaisen_2020` vs `jujutsu_kaisen`. Fix: store the canonical URL (`<link rel="canonical">` or the redirect target) and compare canonical to canonical.

CrateDB `show.wikidata_id` is empty (0 of 246,722) and `show.imdb_id` is filled for only 19,277 rows. Mongo `tmdb_tv_details.external_ids` has both. Join in Mongo on `tmdb_id` first, then fall back to `wikidata_id` or `imdb_id`.

**Limits** ([WDQS user manual](https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual)):
- 60 s query deadline.
- "One client (user agent + IP) is allowed 60 seconds of processing time each 60 seconds."
- 30 error queries per minute.
- 5 parallel queries per IP.
- A 429 comes with `Retry-After`. Clients that ignore it can be banned. A good User-Agent is required.

I hit a 429 after about 12 queries of 3–27 s each within a few minutes. A single export query runs in 18 s:

```sparql
SELECT ?s ?rt ?mc ?tmdb ?imdb WHERE {
  { ?s wdt:P1258 ?rt FILTER(REGEX(?rt,"^tv/[^/]+$")) } UNION { ?s wdt:P1712 ?mc FILTER(REGEX(?mc,"^tv/[^/]+$")) }
  OPTIONAL { ?s wdt:P4983 ?tmdb } OPTIONAL { ?s wdt:P345 ?imdb } }
```

A weekly run of that query is enough. The JSON dump is about 130 GiB, weekly, with daily incremental dumps; that is overkill for about 15k rows ([Wikidata:Database download](https://www.wikidata.org/wiki/Wikidata:Database_download)). Wikidata data is CC0 (same source). Production can reach WDQS (HTTP 200).

### 1.2 Sitemaps

- **RT.** `robots.txt` points to `https://www.rottentomatoes.com/sitemaps/sitemap.xml`, an index of 157 files: `tv-series_0..1`, `tv-seasons_0..2`, `tv-episodes_0..29`, `movie_*`, `person_*` and others.
  - `tv-series_0` + `_1`: 820 KB gzip in total, 0.5 s each, **25,398 unique series slugs**.
  - `tv-seasons_0`: 19,774 `/sNN` season URLs across 8,800 shows. There are 3 season files in total.
  - Every index `lastmod` says 2025-11-12, but the files contain later slugs (for example `pluribus`, `*_2025`, one `*_2026`). Treat `lastmod` as unreliable and re-download the files weekly.
  - 8,303 of 8,563 Wikidata RT series slugs are in the sitemap. So is Wikidata's hyphen slug in every disagreement listed above.
- **Metacritic.** `robots.txt` lists `https://www.metacritic.com/tvshows.xml`, an index of 9 files with about 1,000 URLs each (10 KB gzip each).
  - Together they hold **6,767 unique TV slugs**. `Last-Modified` was 2026-09-24, and they are served through Cloudflare with `max-age=3600`.
  - The listing is not complete: only 2,130 of GoodWatch's 2,698 stored MC slugs appear in it.
- **Title match against the sitemaps.** This is a normalized exact title (plus an optional year suffix) for top-10k shows that have neither a stored URL nor a Wikidata ID. It finds only **96 RT candidates (88 unique) and 95 MC candidates (92 unique)**, out of 5,631 and 7,027 missing shows. The sitemaps are a good *directory and negative cache*: if a show is not in any directory, don't fetch at all. They are not a big source of new matches.

### 1.3 Search and autocomplete endpoints

- **RT.** `robots.txt` disallows `/search`. The page loads `algoliasearch-lite`. I did not call Algolia; using RT's embedded search key is not an intended public API. The only `/napi/` reference in a show page is `/napi/device/inspection`. **Do not use RT search.**
- **Metacritic.** `backend.metacritic.com/finder/metacritic/autosuggest/{query}?apiKey=…` returned 200 in 0.35 s (2.3 KB gzip), with `title`, `type`, `slug` and `premiereYear`. For "the bear" it returned `('The Bear','show','the-bear',2022)` among movies and games.
  - The `apiKey` is embedded in every public page (`__NUXT_DATA__` footer links).
  - `robots.txt` disallows `/search` on www. This is a separate host whose robots file I did not check.
  - At most, use it as a fallback for a few hundred unmatched popular shows. That is the owner's call.

## 2. Fastest fetch path per page

All figures are single requests from this machine unless noted.

| Page | Status | Transfer (gzip) | Raw HTML | Latency | What's in it |
|---|---|---|---|---|---|
| RT `/tv/breaking_bad` | 200 | 30.9 KB | 176 KB | 0.42 s (prod: 0.31 s) | `media-scorecard-json` (series Tomatometer / Popcornmeter); JSON-LD `TVSeries` with `aggregateRating` and `containsSeason[]` URLs; `<tile-season href="/tv/x/sNN">` with `slot="critics-score"` per season (`97%`) |
| RT `/tv/the_bear/s04` | 200 | 40.1 KB | 230 KB | 0.71 s | `media-scorecard-json`: critics 84 (88 reviews, 74/14 liked/not); audience 69 (1,290 liked+not, avg 3.7); JSON-LD `TVSeason` with 10 `episode[]` |
| RT nonexistent `/tv/the_bear_2022` | 404 | 17 KB | – | 0.30 s | – |
| RT `/tv/the_mentalist` | 301 → `/tv/the-mentalist`, 200 | 28.8 KB | – | 0.84 s | series critics `null` (0 reviews), audience 90; 7 season tiles, only S7 scored (83%) |
| RT `/tv/ncis` | 200 | 32 KB | – | 1.36 s | series critics `null`; 24 season tiles, none scored |
| MC `/tv/the-bear/` | 200 | 144.8 KB | 770 KB | 0.91 s (prod: 0.96 s, breaking-bad) | JSON-LD `TVSeries` Metascore 83 / 181 reviews; `__NUXT_DATA__` with the product (`imdbId: tt14452776`, `seasonCount`) and seasons 0–5 with `criticScoreSummary` (88/24, 92/43, 80/45, 72/40, 83/29) |
| MC `backend.metacritic.com/composer/metacritic/pages/shows/the-bear/web?apiKey=…` | 200 | **49.1 KB** | 226 KB JSON | 0.44 s | components `product` (`imdbId`), `critic-score-summary` (83/181), `user-score-summary` (7.7/947), `seasons` (same per-season Metascores) |
| MC `/tv/the-bear/season-3/` | 200 | 145 KB | 777 KB | 1.22 s | JSON-LD `TVSeason` Metascore 80/45; `title="User score 6.3 out of 10"`, "Based on 148 User Ratings" |

Takeaways:
- **The fastest fetch path per show is one request that returns all seasons' critic scores.**
  - RT: the series page (parse `tile-season` plus `media-scorecard-json`).
  - MC: the composer JSON (1/3 the bytes of HTML, twice as fast, clean JSON, and includes the IMDb ID for verification). The HTML `__NUXT_DATA__` is the fallback if the backend changes.
- **Per-season audience and user scores and counts need one season page each.** Fetch only the seasons the show page lists (RT tiles or `containsSeason`, MC `seasons[]`), never guessed ones.
- **Sparse by nature.** Long-running network procedurals often have no series or season Tomatometer (NCIS: 0 of 24 seasons scored). That is why only 1,614 of the 4,085 stored RT URLs in the top 10k carry a score. It is not a crawler failure.
- **Plain HTTP works from production.** RT returned 200 (Akamai) and Metacritic 200 (Cloudflare) from `root@10.0.0.10` to a plain curl with an honest user agent. Nothing in RT's or MC's current responses needs JavaScript. Playwright only adds cost.
- **Caching.** RT sends `cache-control: max-age=120`; MC pages send `max-age=600` and the sitemaps `max-age=3600`. Neither page set an `ETag` that I relied on. Assume no cheap conditional GETs.

## 3. How the current crawlers work and where time is lost

Code: `goodwatch-flows/windmill/f/rotten_web/` and `f/metacritic_web/`. Live schedules (Windmill `/schedules/list`):
- `f/rotten_web/rotten_tomatoes_crawl_ratings` runs `14/20 * * * * *` (every 20 s).
- `f/metacritic_web/metacritic_crawl_ratings` runs `0 */2 * * * *` (every 2 min).
- `f/priority/crawl_all` runs every 20 s.
- Both init flows run daily.

Job history (`/jobs/completed/list`, 2,000 most recent `fetch` leaves per site):

| | RT `fetch` | MC `fetch` |
|---|---|---|
| Window | 2026-09-25 01:02–08:02 (7.0 h) | 2026-09-24 21:50 – 09-25 08:02 (10.2 h) |
| Success | 2,000 / 2,000 | 2,000 / 2,000 |
| Duration p5 / median / p95 / max | 6.0 / 9.8 / 12.2 / 16.4 s | 2.4 / 3.3 / 4.9 / 27.1 s |
| Throughput | ~290 titles/h (~6,900/day) | ~196 titles/h (~4,700/day) |
| Sample of 100: URL found / score found | 10 / 2 | 11 / 10 |
| Mean guessed URLs per title (from logs) | 1.9 | 1.9 |
| TV share of sample | 47% | 36% |

Where time goes:

1. **Crawling titles the site doesn't have.** About 90% of fetches find nothing. §1 shows the directory barely grows with better matching, so most of those titles are simply absent. Each miss still costs about 2 requests and a full job. There is no negative cache: `store_result` sets `updated_at`, and the title comes back on the next cycle (`f/data_source/common.py:159-215`, oldest `selected_at`).
2. **The queue is 84% movies and long-tail.** `completeness_queue` mixes 1.16M movie and 217k TV documents and orders by oldest `selected_at`. The sample's median popularity was 2.5. A full pass over 1.37M titles takes about 200 days for RT and 290 for MC, so a top-10k show gets refreshed roughly twice a year unless `crawl_all` demand picks it.
3. **Headless Chromium for server-rendered pages (RT).**
   - Each job launches Chromium (`fetch.py:257-273`), opens a new page for every guess and never closes it (`:112`).
   - The job takes about 9.5 s, versus about 0.5 s for the same page over plain HTTP.
   - The step `timeout` is 30 s (`crawl_all_by_id.flow/flow.yaml:40-42`), but `BROWSER_TIMEOUT` is 180 s (`fetch.py:20`). A slow page kills the job instead of failing cleanly.
4. **Stored URLs are never reused.** Both fetchers rebuild guesses from `title_variations` on every visit (RT `fetch.py:73-87`, MC `fetch.py:47-56`) even when `rotten_tomatoes_url` or `metacritic_url` is already known. `TODO.md:1862` already asks for this fix.
5. **One title per Windmill job, fixed schedules.**
   - MC is schedule-bound: 6 titles every 2 min is at most 180/h. The fetch itself is about 1 s of network per request; the rest is job startup, dependency resolution and Mongo init (3.3 s median).
   - RT flows run back to back (300 flows in 1 h 40 min).
   - This is not a request-rate limit. Neither site returned a 403 in any sampled job.
6. **Retries do not help and do not hurt much.** 404s are not retried (the loop just moves on). Retries (4× exponential, 2 s base, multiplier 6) fire only on 403 or on exceptions. There is no `Retry-After` or 429 handling and no shared backoff across workers. The MC `requests.get` has no timeout (`fetch.py:65`).
7. **Wrong or legacy URLs.** The crawler stores the guessed URL, not the canonical one. For MC, the page's `imdbId` is never compared with TMDB's `external_ids.imdb_id`, so a same-titled wrong show can be stored.

## 4. Crawl-time estimates for the top 10k shows' seasons

Inputs:
- Top 10k TV shows by popularity (≥10.86) have **52,967 seasons** (`season_number > 0`).
- Shows known to be on RT (stored URL ∪ Wikidata): 4,366 with 22,570 seasons.
- On Metacritic: 2,970 with 15,739 seasons. These are TMDB season counts, so this is an upper bound for MC.
- Polite pace: **one request every 2 s per site (0.5 req/s), single-threaded**, stopping on 403, 429 or a challenge.

### Without improvements (today's design extended to seasons, dedicated to TV)

| Step | RT | MC |
|---|---|---|
| Show discovery: 10k titles by guessing, 1 job each | 10k ÷ ~290/h ≈ **34 h** | 10k ÷ ~190/h ≈ **52 h** |
| Season pages, 1 Playwright or `requests` job per season, derived from found show URLs (~21.6k / ~15k) | 21.6k ÷ 540/h (3 per 20 s flow) ≈ **40 h** | 15k ÷ 180/h (schedule cap) ≈ **83 h** |
| **Total** | **~3 days** | **~5.6 days** |
| Real-world today (shared 1.37M-title queue) | full pass ≈ **200 days** | ≈ **290 days** |

Guessing season URLs for the other ~5.6k (RT) or ~7k (MC) shows would add about 30k wasted 404s on top of that.

### With the recommended design

| Step | Requests to RT | Requests to MC | Time at 0.5 req/s |
|---|---|---|---|
| Resolve IDs: 1 SPARQL query + sitemaps | 5 sitemap files | 10 sitemap files | minutes |
| Show page per known show (all season critic scores) | 4,366 | 2,970 (composer JSON) | RT **2.4 h**, MC **1.7 h** |
| Season page per listed season (audience/user score + counts) | ≤ 22,570 | ≤ 15,739 | RT **12.5 h**, MC **8.7 h** |
| **Full initial crawl** | ~27k | ~18.7k | RT **~15 h**, MC **~10.4 h** (both sites in parallel: ~15 h) |
| Weekly refresh: airing shows only, e.g. ~1.5k shows × (show page + current season) | ~3k | ~3k | ~1.7 h each |

At 1 req/s the times halve. At a 1 s pace a page fetch (0.3–1.2 s) still leaves idle time, so a single worker per site is enough.

## 5. Recommended design

1. **`f/external_ids/resolve_rt_mc` (new, weekly)**
   - Run the single SPARQL export (§1.1) and download the RT `tv-series_*`/`tv-seasons_*` and MC `tvshows/N.xml` sitemaps.
   - Upsert into the existing Mongo docs:
     - `rotten_tomatoes_tv_rating.rotten_tomatoes_url` and `metacritic_tv_rating.metacritic_url`;
     - `url_source` (`wikidata` | `sitemap_title` | `legacy_guess`), `url_verified_at`;
     - `in_directory: bool`, meaning the slug is in the sitemap or Wikidata.
   - Join Wikidata to shows on `tmdb_id` (P4983), then on `external_ids.wikidata_id` / `imdb_id`.
   - Accept a sitemap title match only if it is unique and the year fits.
2. **Stop guessing by default.**
   - Crawl only titles with a known URL or `in_directory`.
   - Allow guessing only as a capped fallback (≤2 URLs) for top-N shows with no directory hit, with a `not_found_until` negative cache (e.g. 90 days).
   - This removes about 90% of today's requests.
3. **Plain HTTP fetcher, no Playwright.**
   - `requests` with `timeout=15`, gzip, and the TV Tropes-style honest UA and `paced_goto` spacing (`f/tvtropes_web/tv_tropes_crawl_tags/fetch.py:25-41`).
   - Follow redirects and store the **canonical** URL.
   - RT: parse `media-scorecard-json`, JSON-LD and `tile-season`.
   - MC: parse the composer JSON, with the page's `__NUXT_DATA__`/JSON-LD as fallback. **Reject the match if the MC `imdbId` ≠ TMDB `imdb_id`.**
4. **One long-running job per site per batch, not one job per title.**
   - Lease about 100 shows, fetch in-process under a token bucket (0.5–1 req/s).
   - Share an upstream deadline in Mongo, as in `f/tmdb_web/country_state.py:120-160`. On 403, 429 or `cf-mitigated: challenge`, stop, record the deadline and honour `Retry-After`. Never retry through a block.
   - Windmill overhead then drops from seconds per title to seconds per batch.
5. **A TV-first queue, separate from movies.**
   - Priority is popularity plus `crawl_priority` demand.
   - Refresh airing shows (TMDB `in_production`, or `last_episode_to_air` in the last 60 days) weekly, and ended shows every 90 days.
   - Movies keep their own slower loop.
6. **Two-tier season crawl.**
   - Tier 1: the show page gives every season's critic score in one request.
   - Tier 2: fetch season pages only for seasons listed on the show page, and only when a critic score or audience data is likely (RT: a tile with a score or a Popcornmeter; MC: `criticScoreSummary.reviewCount > 0`, or a recent season).
   - Store results per `(tmdb_id, season_number)` for the `season` table columns proposed in [existing-data.md](existing-data.md).
7. **Quick fixes worth doing even before the redesign:**
   - reuse stored URLs;
   - add a timeout to MC `requests.get`;
   - close RT pages, or better drop Playwright;
   - align the RT step timeout;
   - store canonical URLs;
   - run the `imdbId` check.

**Terms caveat (unchanged from [external-sources.md](external-sources.md) §5–6).** RT's Terms of Use forbid automated collection. I could not read Metacritic's (Fandom's) terms page (403). The design above sharply *reduces* request volume compared with today, but it does not change that exposure.
