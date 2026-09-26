# Rotten Tomatoes and Metacritic crawls

Issue [#152](https://github.com/alp82/goodwatch-monorepo/issues/152). `f/critic_sites/crawl` collects Rotten Tomatoes
and Metacritic scores for shows, their seasons and movies. It replaced the `f/rotten_web` and `f/metacritic_web`
guessing crawlers on 2026-09-25. Owner decision on the issue: collecting season critic scores at a polite pace is
approved; stop on 403 or 429; never solve or work around a bot challenge; no proxy rotation.

## How a site is crawled

| | |
|---|---|
| Transport | Plain HTTP (`requests`), `timeout=15`, gzip, User-Agent `GoodWatchBot/0.1 (+https://goodwatch.app; hello@goodwatch.app) critic-scores`. No browser. |
| Pace | One request every 2 s per site, shared by every worker through `critic_site_state.next_request_at` (one document per site). |
| Blocks | A 403, a 429, `cf-mitigated: challenge`, a 202 with an empty body or a challenge page title stops the site: `critic_site_state.blocked_until` is set (429: `Retry-After`, at least 1 h, at most 7 days; otherwise 24 h) and the event is logged in `critic_site_blocks`. Three pages in a row without the expected data count as a possible challenge and stop the site for 6 h. Nothing is retried through a block; unfinished titles wait until the deadline. |
| URLs | Only known URLs, never guessed: Wikidata's (`wikidata_url`, from `f/external_ids/wikidata_backfill`) first, then the stored one, then a sitemap match. The canonical URL after redirects is stored, without a trailing slash. Metacritic is requested with the trailing slash to skip its redirect. |
| Verification | See [Verification](#verification) below. |
| Shared URLs | A URL several titles hold stays with the title the page matches best (score: IMDb id 4, Wikidata agreement 2, title 1, year 1 near the premiere or 0.5 elsewhere in the run; then popularity). One request settles the whole group; the others are rejected with reason `duplicate`. When no title in the group matches, each gets its own reason (`title_mismatch`, `year_mismatch`, `imdb_mismatch`). |
| Negative cache | A 404 (or a redirect away from title pages) sets `not_found_url` and `not_found_until` (+90 days); a rejected match sets `rejected_url`, `rejected_until` (+90 days), `rejected_reason` and `rejected_page` (the page's `title`, `year` and `imdb_id`, so a rule change can re-evaluate the rejection without a request). Both clear the URL, `url_source` and the scores, and those URLs are not requested again until the date. Titles with no URL from any source are never requested. |
| Backups | Before a URL changes or is cleared, or scores disappear, the previous values go to `_backup_<YYYYMMDD>_critic_urls` (`collection`, `doc_id`, `tmdb_id`, `previous`, `reason`, `run_at`). |

### Verification

A page belongs to the title when:

| Evidence | Rule |
|---|---|
| IMDb id (Metacritic) | The page's IMDb id equals the title's effective IMDb id (`f/external_ids/imdb_ids.effective_imdb_id`): accepted, `imdb_id_verified: true`. A different id rejects (`imdb_mismatch`) only when the title's Wikidata URL is another page, or the id is the TMDB IMDb id of another title of the same kind in the catalog. Otherwise the title and year below decide, and the page must give a year, and `imdb_id_verified` is false: Metacritic sometimes gives a show the id of its pilot film (The Six Million Dollar Man) or English dub. |
| Wikidata URL | The page is the title's Wikidata URL: accepted without a title or year check, unless the IMDb id differs. |
| Title | Otherwise the normalized page title (letters and digits of any script, so Japanese or Korean titles count) must equal, or reach 0.8 similarity with, one of the title's names: TMDB title and original title, the rating document's title variations, TMDB alternative titles and translated titles. A subtitle on either side also matches: "Sword Art Online: Alicization" matches "Sword Art Online", and "Monster" matches the alternative title "Monster: The Jeffrey Dahmer Story" (the part before `: ` or ` - `, at least 3 characters). |
| Year | Movies: at most one year from the release year. Shows: anywhere in the run, from a year before the first air date to a year after the last air date (this year while the show airs). Rotten Tomatoes dates a show page by the first season it tracks or its US or dubbed premiere (Doraemon 2014, Coronation Street 2000). |

These rules replaced a stricter set on 2026-09-26 after the [URL verification audit](research/critic-url-verification-audit.md)
found about 30% of Rotten Tomatoes and 8% of Metacritic rejections wrong. Known cases the rules still reject: a
page dated before the show's premiere (Tony Awards: RT 1947, TMDB 1956; Monster: The Lizzie Borden Story: Metacritic
dates the anthology 2022, TMDB the season 2026), and a page whose IMDb id is a separate TMDB entry of the same show
(Sailor Moon: Metacritic uses the 1995 English dub's id, which TMDB lists as its own show, 295779).

### Queue

Each rating collection is its own queue: `next_crawl_at` on `rotten_tomatoes_{tv,movie}_rating` and
`metacritic_{tv,movie}_rating`, read in popularity order through the partial index `critic_crawl_queue`. A run leases
25 titles at a time (2 h) and takes shows first, movies only when no show is due.

| Title | Next crawl |
|---|---|
| Airing show (TMDB `in_production`, a next episode, or a last episode in the past 60 days) | 7 days |
| Other show | 90 days |
| Movie released in the past 180 days | 14 days |
| Other movie | 90 days |
| Error (HTTP 5xx, timeout, unexpected page) | 1 day |
| Not found or rejected | 90 days |

`f/priority/crawl_all` still crawls single titles on demand through `f/rotten_web/crawl_all_by_id` and
`f/metacritic_web/crawl_all_by_id`, whose fetch scripts now call the same crawl (`crawl.crawl_by_id`). They skip a title
without a usable URL and a title crawled in the past day.

### Seasons

The show page lists every season with its critic score: RT's `<tile-season>` Tomatometer, Metacritic's
`__NUXT_DATA__` Metascore and review count. A season page is fetched only for a season with critic reviews, and again
only after 80 days or when it is the latest season of an airing show. It adds RT's review count and Popcornmeter and
Metacritic's user score. RT's part seasons (`s37.2`) are specials inside a season and are skipped; Metacritic's
season 0 is specials and is skipped. Season numbers are the site's own; for the shows checked they match TMDB and
IMDb.

## Storage

| Where | What |
|---|---|
| Mongo `rotten_tomatoes_tv_season_rating` | One document per `(tmdb_id, season_number)`: `url`, `tomato_score_original`, `tomato_score_normalized_percent`, `tomato_score_vote_count` (reviews), `audience_score_original`, `audience_score_normalized_percent`, `audience_score_vote_count`, `show_page_at`, `season_page_at`, `created_at`, `updated_at`. |
| Mongo `metacritic_tv_season_rating` | The same with `meta_score_*` and `user_score_*` (user score 0-10, normalized ×10). |
| Crate `rotten_tomatoes_season` | Key `(show_id, season_number)`, clustered by `show_id` like `imdb_season`: `rotten_tomatoes_url`, `rotten_tomatoes_tomato_score_original`, `rotten_tomatoes_tomato_score_review_count`, `rotten_tomatoes_audience_score_original`, `rotten_tomatoes_audience_score_rating_count`. |
| Crate `metacritic_season` | Key `(show_id, season_number)`: `metacritic_url`, `metacritic_meta_score_original`, `metacritic_meta_score_review_count`, `metacritic_user_score_original` (0-10), `metacritic_user_score_rating_count`. |
| Show and movie scores | Unchanged fields on the rating documents, published by `f/sync/copy/all_ratings` to the `show` and `movie` columns. That copy now clears the RT and Metacritic columns when the crawler removed the values. |

A season the site lists without a critic score has a row with NULL scores. The crawl rewrites a show's Crate rows
after each batch and deletes rows of seasons the site no longer lists. `f/critic_sites/publish` republishes given
shows, or every show with `all_shows`.

The season rows live in their own tables, next to `imdb_season`, rather than in columns on Crate `season`: that table
is keyed by the TMDB season id and rewritten by the details copy, and the sites' numbering does not always have a TMDB
season to attach to. The episode grid (#153) reads one show's rows from each table by `show_id`.

## Jobs and schedules

Windmill schedules are not in the repository. These were created through the API on 2026-09-25 (Europe/Berlin):

| Schedule | Script | Cron | Arguments |
|---|---|---|---|
| `f/critic_sites/crawl_rotten_tomatoes` | `f/critic_sites/crawl` | `0 5/30 * * * *` | `site: rotten_tomatoes`, `max_minutes: 25`, `batch_size: 25`, `kinds: [tv, movie]` |
| `f/critic_sites/crawl_metacritic` | `f/critic_sites/crawl` | `0 10/30 * * * *` | `site: metacritic`, same |
| `f/critic_sites/directory_rotten_tomatoes` | `f/critic_sites/directory` | `0 0 5 * * SUN` | `site: rotten_tomatoes`, `top: 20000`, `dry_run: false` |
| `f/critic_sites/directory_metacritic` | `f/critic_sites/directory` | `0 15 5 * * SUN` | `site: metacritic`, same |

All four have `no_flow_overlap`. The old schedules `f/rotten_web/rotten_tomatoes_crawl_ratings` (every 20 s) and
`f/metacritic_web/metacritic_crawl_ratings` (every 2 min) were deleted with their flows and `next` scripts. The
daily `*_init_ratings` flows still create the rating documents and refresh popularity.

`f/critic_sites/directory` downloads the series sitemaps (RT `tv-series_*.xml`, 3 requests; Metacritic
`tvshows/N.xml`, 10 requests) and gives the 20k most popular shows that have no stored, Wikidata or negatively cached
URL their unique slug match (`url_source: "sitemap"`). It then schedules every title with a URL but no
`next_crawl_at`. It runs after the Wikidata backfill (Sundays 03:30), which fills URLs the crawl then verifies.

`f/critic_sites/repair_urls` was a one-off (`dry_run` defaults to true). Windmill passes `null` for omitted arguments,
so the entry points apply their defaults themselves.

## First run, 2026-09-25

URL repair without fetching (a group keeps its URL on the Wikidata holder, or on the one holder whose release year
is in the slug):

| | RT shows | RT movies | MC shows | MC movies |
|---|---:|---:|---:|---:|
| URLs held by more than one title | 3,028 | 34,266 | 1,331 | 10,025 |
| Titles holding them | 8,299 | 146,873 | 3,925 | 67,094 |
| Cleared | 1,895 | 28,541 | 1,708 | 37,434 |
| Left for the crawl to settle | 5,327 | 109,166 | 1,314 | 23,376 |

Sitemaps: RT lists 25,245 series and Metacritic 8,889 shows. Of the 20k most popular shows, 84 got an RT URL and
54 a Metacritic URL from them. Scheduled on the first run: RT 29,564 shows and 281,075 movies, Metacritic 9,242
shows and 49,086 movies.

Throughput of the first 15-minute runs over the most popular shows, both sites in parallel:

| | RT | Metacritic |
|---|---:|---:|
| Requests | 417 in 918 s (2.2 s each) | 378 in 901 s (2.4 s each) |
| Shows | 90 (76 ok, 13 rejected, 1 not found) | 90 (86 ok, 4 rejected) |
| Requests per show | 4.6 | 4.2 |
| Seasons listed / with a critic score | 943 / 336 | 1,191 / 161 |
| 403, 429 or challenge | none | none |

A scheduled 25-minute run then crawled 223 RT shows (708 requests, 2.1 s each) and 196 Metacritic shows (631
requests, 2.4 s each). Three Metacritic pages timed out after 15 s and are retried after a day. No 403, 429 or
challenge was seen on either site; `critic_site_blocks` is empty.

Coverage of the 10k most popular shows (TMDB popularity in Mongo), before the first run and at 14:08 UTC, about
1.5 h of crawling in:

| | Before | 2026-09-25 14:08 UTC |
|---|---:|---:|
| RT: shows with a URL | 4,504 | 4,451 (rejected shared URLs removed) |
| RT: shows crawled (ok / rejected / not found) | 0 | 390 / 140 / 1 |
| RT: shows with a season critic score | 0 | 296 |
| RT: seasons with a critic score (with review count, with Popcornmeter) | 0 | 1,327 (1,325, 1,286) |
| RT: shows still due | | 4,056 |
| Metacritic: shows with a URL | 3,067 | 3,024 |
| Metacritic: shows crawled (ok / rejected / not found / error) | 0 | 389 / 121 / 3 / 3 |
| Metacritic: shows with a season Metascore | 0 | 283 |
| Metacritic: seasons with a Metascore (with a user score) | 0 | 650 (1,089) |
| Metacritic: shows still due | | 2,632 |
| Crate `rotten_tomatoes_season` / `metacritic_season` rows | table did not exist | 3,374 / 3,764 |

At about 450 RT and 390 Metacritic shows an hour, the remaining top-10k shows take about 9 h (RT) and 7 h
(Metacritic): done around 23:00 and 21:00 UTC on 2026-09-25. The rest of the shows with a URL follow, then movies.
Many popular shows have no season critic score on either site (daily dramas, anime, talk shows); RT lists a critic
score for about a third of the seasons it lists.

Spot checks against the live pages, 2026-09-25:

| Show | Site | Stored |
|---|---|---|
| Breaking Bad | RT | series 96% / 250 reviews; seasons 86, 97, 100, 100, 97; S1 43 reviews, Popcornmeter 95 |
| Breaking Bad | Metacritic | 87 / 98 reviews, user 9.4; seasons 73, 84, 89, 96, 99; IMDb id verified |
| The Bear | RT | seasons 100, 99, 89, 84, 96; S4 88 reviews, Popcornmeter 69 from 1,290 |
| The Bear | Metacritic | seasons 88, 92, 80, 72, 83; S3 45 reviews, user 6.3 from 148 |
| The Simpsons | RT | 38 seasons listed, 21 with a Tomatometer; S24 33% from 6 reviews, Popcornmeter 67 from 145 |
| The Simpsons | Metacritic | 41 seasons listed, Metascores for S1 (80) and S2 (92) only |
