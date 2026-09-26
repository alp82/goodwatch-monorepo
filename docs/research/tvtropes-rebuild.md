# Rebuilding the TV Tropes crawler like the critic crawlers

Research for applying the design of [#152](https://github.com/alp82/goodwatch-monorepo/issues/152)
([critic-scores.md](../critic-scores.md)) to TV Tropes. Measured on 2026-09-25 between 14:00 and 14:40 UTC. No code,
schedule or data was changed.

Sources: `f/tvtropes_web/**`, `f/priority/crawl_all.flow`, `f/sync/copy/tvtropes.py`, `scripts/recover_tvtropes.py`,
[tvtropes-repair/](tvtropes-repair/README.md), [tvtropes-coverage-gaps.md](tvtropes-coverage-gaps.md), issues #110, #115,
#118, #119, #120 and #123. The Windmill API was used read-only; Mongo was read through one read-only preview job.

Owner decisions that bound this document: no permission email to TV Tropes; the schedule
`f/tvtropes_web/tvtropes_crawl_tags` stays off and production crawls only through `f/priority/crawl_all`; challenges are
never solved or evaded; proxies are never rotated.

## Summary

- The production crawler costs a lot and yields almost nothing. In 3.6 days it ran 6,590 fetch jobs for 1,387 titles.
  1,300 titles failed all 5 attempts on a Cloudflare challenge. Tropes came back for only 20 distinct titles, and one of
  them (show 44606) was crawled 17 times.
- The main waste: the crawler never uses the stored URL. Every run guesses slugs again in a headless browser, retries 4
  times through a block, and holds up `crawl_all` for about 7 minutes.
- Coverage of the 10k most popular titles: 62% of movies and 44% of shows have tropes. 86% of this data is from the
  October–November 2025 crawl.
- Wikidata's `P6839` (TV Tropes ID) is thin: 2,497 movies and 1,614 shows carry a TMDB id. That is 15% of the top-10k
  movies and 10% of the top-10k shows, and it adds only 183 URLs we don't already store. TV Tropes has no sitemap, no
  change feed that covers all pages, and no official dump.
- With known URLs only and no guessing, the top 10k movies and 10k shows need about 16,600 requests: about 9 h at 2 s
  per request, or 28 h at the 6 s local pace. Guessing needs about 52,000.
- **Recommendation: (a), improved local recovery on the new design.** Stop guessing and retrying in production at the
  same time.

## 1. Current design and where it wastes time

### How it works

| | Today |
|---|---|
| Transport | Playwright Chromium, a new browser for each title. User agent `GoodWatchBot/0.1 (+https://goodwatch.app; contact …)`. |
| URL discovery | Slug guessing only. `title_variations` builds CamelCase slugs from TMDB titles. `fetch.py` tries `Film/` or `Series/` + slug + year, then the bare slug, and follows disambiguation and year links. It stops after 60 candidates. **It ignores `tvtropes_url`, even when a verified URL is stored.** |
| Identity | `identifies_work`: the namespace, the title in the intro, the first dated sentence, the medium word and a shared-film-page check. It is strong and carefully reviewed in #129; it's the part worth keeping. |
| Subpages | Follows `Tropes[A-Z]…` subpages of the same work, up to 20 pages. |
| Pacing | 4 s between navigations, **per process only**. There is no shared pace between workers. |
| Blocks | 403, 429 or `cf-mitigated: challenge` returns `rate_limit_reached`. The script then **raises, and the flow retries the leaf 4 times** with exponential backoff (`crawl_all_by_id.flow`, `attempts: 4, multiplier: 6`). There is no site-wide stop and no block log. |
| Queue | `f/priority/crawl_all` claims one movie and one show per run, then runs `tvtropes_init_tags/update` and `crawl_all_by_id`. The old completeness queue (`next.py`, 8 per batch) belongs to the schedule that is off. There is no `next_crawl_at`, no refresh interval and no skip for a title crawled recently. |
| Storage | Mongo `tv_tropes_{movie,tv}_tags`: `tvtropes_url` and `tropes[] {name, url, html}`. `f/sync/copy/tvtropes.py` copies titles updated in the last 48 h to Crate `movie/show.tropes` and the `trope` rows. The copy only upserts, so stale rows are never removed. |
| Negative cache | None. A 404 or an unresolved title is guessed again on the next claim. |

### Measured waste (Windmill API, fetch leaves from 2026-09-22 00:00 to 2026-09-25 14:28 UTC)

| | |
|---|---|
| Fetch leaf jobs | 6,590 (90 successful). All came from `schedule-f-priority-crawl_all`, apart from 5 run by hand. |
| Titles claimed | 1,387. 1,300 ran 5 leaves each (1 try + 4 retries) and all 5 failed. 86 succeeded on the first leaf. |
| Error in the failed leaves | 80 of 80 sampled: `Rate limit reached for …, retrying.` (the Cloudflare challenge) |
| Successful leaves with tropes | 37, for **20 distinct titles**. Show 44606 (*Beauty and the Beast* 2012) accounts for 17 of them. |
| Successful leaves without a URL | 48, low-popularity titles where no candidate matched |
| Worker time in fetch leaves | 12.6 h. The mean leaf takes 6.9 s, mostly browser start-up. |
| Wall time per failing title | Median 213 s from the first leaf to the last, spent on retry backoff |
| Effect on `crawl_all` | In a sampled run of 459 s, the TV Tropes branch took 445 s. The next slowest branch (TMDB streaming) took 103 s. Publishing every prioritized title waits for TV Tropes. |
| Block rate | About 94% of claimed titles are blocked (1,300 of 1,387). The ~1 in 100 jobs that succeed are titles whose first candidate URL was right, or that needed no request at all. This fits the finding in #120: the first request from the datacenter IP passes, and follow-up requests are challenged. |
| Mongo `failed_at` in the past 7 days | 1,956 movies and 979 shows |

In short: guessing multiplies the requests per title, and the challenge hits every request after the first. Retrying
through a block adds 4 more attempts and about 3.5 minutes per title, and nothing prevents re-crawling a title that
just succeeded.

## 2. Coverage

Mongo, read through a read-only preview job on 2026-09-25 at about 14:30 UTC. "Top 10k" means the 10,000 non-deleted
`tmdb_*_details` titles with the highest TMDB popularity.

| | Movies | Shows |
|---|---:|---:|
| Documents | 1,158,684 | 217,365 |
| With tropes | 58,183 | 14,193 |
| With `tvtropes_url` | 66,320 | 15,112 |
| URL but no tropes | 8,137 | 919 |
| URL on a `Main/` or `Franchise/` page (not a work page) | 4,198 | 236 |
| Never selected | 46,802 | 11,175 |
| Updated in the past 7 days | 114 | 29 |
| **Top 1k: with tropes / with URL** | 737 / 753 | 617 / 633 |
| **Top 10k: with tropes / with URL** | 6,181 / 6,554 | 4,368 / 4,554 |
| Top 10k: without a release year (the identity check can't pass) | 462 | 264 |
| Top 10k: failed since 2026-09-01 | 343 | 884 |
| Top 10k: last update in Oct–Nov 2025 | 8,630 | 9,032 |

Local recovery and publishing (#120, closed 2026-09-21):

- 186-title cohort (at least 200k votes, no tropes): 671 local requests at a 6 s pace, zero 403, 429 or challenge
  responses.
- 99 titles recovered, reviewed and imported with `import_tvtropes_recovered.py`, which writes a manifest and a
  rollback file. Crate got about 16,600 trope rows at the 15:00 sync that day.
- The remaining 87: 33 catalog problems, 23 manual-override candidates, 16 without a page, 10 correct rejections, 3
  retry leftovers, and 2 wrong matches kept out.
- #119 decided not to expand to the 20k-vote cohort. A follow-up could cover titles with at least 100k votes, run
  locally at 6 s. No such batch has run since.
- #123, the audit of 45 suspicious existing matches, is still open.

## 3. Sources of URLs and data that need few page requests

### Wikidata `P6839` (TV Tropes ID)

`P6839`, "TV Tropes ID", holds values like `Film/PulpFiction` and `Series/BreakingBad`. One SPARQL export
(`?item wdt:P6839 ?tt`, with optional `P4947` and `P4983`) returned 22,307 rows in 5.6 s with no 429.

| | Movies (`P4947`) | Shows (`P4983`) |
|---|---:|---:|
| Items with a TV Tropes ID and a TMDB id | 2,497 | 1,614 |
| Namespaces | Film 1,809, WesternAnimation 487, Recap 66, Anime 56 | Series 963, WesternAnimation 389, Anime 140 |
| Top 10k with a Wikidata ID | 1,533 (15%) | 1,000 (10%) |
| Same as the stored URL | 1,291 | 805 |
| Different from the stored URL | 177 | 77 |
| Wikidata ID, no stored URL | 65 | 118 |
| Wikidata ID, stored URL but no tropes | 112 | 142 |

Most of the differences are naming. In 137 of the 177 movies, the year suffix differs (`Film/Oppenheimer2023` against
`Film/Oppenheimer`), usually because TV Tropes renamed the page. In 23, the stored URL is a `Main/` or `Franchise/` page
and Wikidata names the work page (`Main/IronMan` → `Film/IronMan1`, `Franchise/TheMummy` → `Film/TheMummy1999`).

Wikidata is sometimes wrong or stale:

- Kim Possible points to `Franchise/KimPossible`.
- The live-action *Pretty Guardian Sailor Moon* points to `Anime/SailorMoon`.
- *Harry Potter and the Philosopher's Stone* has `Film/HarryPotterAndThePhilosophersStone`, but the live canonical
  page is `…Stone2001`.

So a Wikidata ID is a URL candidate that must pass `identifies_work`, as in the critic design. It is cheap to add: one
more `OPTIONAL { ?item wdt:P6839 ?tt }` in the weekly export in `f/external_ids/wikidata.py`.

### Sitemaps, robots.txt and feeds

5 requests from the dev machine, 6 s apart, user agent `GoodWatchBot/0.1 (+https://goodwatch.app; hello@goodwatch.app)
tvtropes-research`. None was challenged.

| UTC | URL | Result |
|---|---|---|
| 14:35:04 | `/robots.txt` | 200, 2,497 bytes, last modified 2026-05-08. It has **no `Sitemap:` line**. `User-agent: *` gets `Content-Signal: search=yes,ai-train=no` and `Allow: /`, and a final `User-agent: *` gets an empty `Disallow:`. It fully disallows named AI and SEO bots, including `ClaudeBot`, `Claude*`, `anthropic-ai`, `GPTBot` and `CCBot`. There is no `Crawl-delay`. |
| 14:35:15 | `/sitemap.xml` | 404, an origin HTML page. There is no sitemap. |
| 14:35:31 | `/pmwiki/rss-feed.php?filter=updated_content` | 200, 28 items dated from 2023-10 to 2026-09. It is a curated sample, not a change log. |
| 14:35:50 | `/pmwiki/pmwiki.php/Series/BreakingBad` | 200, 57.8 KB brotli, edge cache HIT, 97 trope links, and 5 `Tropes*` subpages (6 requests for this show) |
| 14:36:04 | `/pmwiki/pmwiki.php/Film/HarryPotterAndThePhilosophersStone2001` | 200, edge cache HIT, `rel="canonical"` equals the requested URL |

No endpoint lighter than the work page turned up. The pages are server-rendered, and plain HTTP gets the whole trope
list, so no browser is needed. Popular pages are often served from Cloudflare's edge cache, which spares the origin but
still counts as a request in the bot rules.

The Terms of Service (updated 2025-05-01, read on 2026-09-21) have no clause on automated access. Staff in the forum
(2018–2019): "We hard-block anyone who tries to scrape the site without advance permission", and "absolutely not … a
public dump". Content is licensed CC BY-NC-SA 3.0.

`Claude*` is disallowed. Agents must never read TV Tropes pages with their own web tools. Only the GoodWatch runner,
under its own user agent, may fetch pages.

### Published datasets

None is official. The content license (CC BY-NC-SA 3.0) travels with the content, whatever label a dataset carries.

| Dataset | Content | Date | License label | Maps to | Use |
|---|---|---|---|---|---|
| [adorkin/tvtropes2imdb](https://huggingface.co/datasets/adorkin/tvtropes2imdb) | 9,262 `Film/` page names ↔ IMDb ids, checked by hand | 2023-02 | CC0 | IMDb → `effective_imdb_id` → TMDB | **A good URL source for movies** (a mapping of facts, no trope text) |
| [dhruvilgala/tvtropes](https://github.com/dhruvilgala/tvtropes) | 30k tropes, 1.9M examples, ~40k works (film, TV, literature), with `film_imdb_match` and `tv_imdb_match` tables; ~650 MB on Google Drive | crawled about 2020 (repo created 2020-10) | none | IMDb | A URL source for movies and shows; its tropes are 5 years old |
| [Figshare 25053926](https://figshare.com/articles/dataset/_/25053926) (tropescraper output) | Films and tropes with metadata, 1.6 MB bz2 | posted 2024-01, crawled 2020 | CC BY 4.0 (contradicts the source license) | titles and metadata | Offline evaluation only |
| [rhgarcia/tropescraper](https://github.com/rhgarcia/tropescraper) | 12,567 films | 2020-03 | LGPL code | none | Offline evaluation only |
| [RyokoExtra/TvTroper](https://huggingface.co/datasets/RyokoExtra/TvTroper) | Raw HTML of up to 651,522 pages, 20 GB | 2023-06 | Apache 2.0 for the author's part, "fair use" for the pages | none | Reject: an unauthorized full-site dump, which is what staff say they won't allow |
| DBTropes | Linked data | unmaintained since 2016 | — | — | Reject: too old |

Common Crawl has no TV Tropes pages (`CCBot` is disallowed). Wayback captures exist for popular pages but are
unreliable (see [access-options](tvtropes-repair/access-options-2026-09-21.md)).

## 4. What the critic-site design would gain

Assumptions:

- Movies need 1.15 requests per title: 5 of 101 recovered films had subpages, 2 to 4 each.
- Shows need about 2 requests per title. This is a guess: long-running shows split into subpages (Breaking Bad has 5),
  and the recovery cohort had too few shows to measure.
- Guessing needs 2.1 requests per resolved title and 3.2 per unresolved title, as measured in the recovery runs.

| Top 10k movies + 10k shows | Guessing (today's resolver) | Known URLs only (new design) |
|---|---:|---:|
| Titles requested | 20,000 | 11,291 (6,554 + 4,554 stored, + 183 from Wikidata). tvtropes2imdb and dhruvilgala could add a few hundred more. |
| Requests, first pass | ≈ 52,000 (11.2k × 2.1 + 8.8k × 3.2) | ≈ 16,600 (6,619 × 1.15 + 4,672 × 2) |
| Time at 2 s (critic pace) | ≈ 29 h | ≈ 9 h |
| Time at 6 s (local pace) | ≈ 87 h | ≈ 28 h |
| Requests for titles without a page | ≈ 28,000 | 0. Negative cache for 90 days after a 404 or a rejection. |
| Steady-state refresh | none (re-guessed on every claim) | ≈ 60–100 requests a day with the intervals below |

Proposed refresh intervals (trope pages change slowly and hold no scores):

| Title | Next crawl |
|---|---|
| Airing show | 60 days |
| Released in the past 180 days | 30 days |
| Other | 365 days |
| Error (5xx, timeout) | 1 day |
| 404, rejected match, or no tropes on the identified page | 90 days |

What carries over from `critic_sites` without changes:

- `polite_http` for a new site key `tvtropes`: `critic_site_state` pace and `blocked_until`, the `critic_site_blocks`
  log, and the `cf-mitigated` and challenge-title detection.
- The backup-before-change pattern.
- A lease queue on `next_crawl_at`.
- A "skip if crawled in the past day" rule in `crawl_by_id`, which ends the 17× re-crawl.

New work:

- Port `identifies_work` and `crawl_page` from Playwright locators to an HTML parser. The #129 fixtures can be reused
  as HTML input.
- Use the stored URL, then the Wikidata ID, then a dataset mapping, and verify each one.
- Clear `Main/` and `Franchise/` URLs to the negative cache.
- Let the Crate sync delete stale `trope` rows.

## 5. Options, given that production is challenged by IP

**(a) Improved local recovery on the new design.** The same bounded runner on the dev machine, rebuilt on:

- plain HTTP;
- known URLs only;
- negative cache;
- a stop on the first 403, 429 or challenge;
- a 6 s pace and a per-run request budget;
- output to a reviewed manifest, published with `import_tvtropes_recovered.py`.

Subagents start it, and a person reviews each batch before import.

- Pros: it works today, with 676 local requests and no block so far. It's roughly 3× cheaper than guessing. Every
  batch is reviewed and can be rolled back.
- Cons: it depends on the dev machine and a manual import step, and it is bounded on purpose (#119).
- Honesty note: this is the same act as (b), fetching from a residential IP because the datacenter IP is challenged.
  The owner accepted it because it is small, supervised, identified, and stops at the first sign of refusal.

**(b) A scheduled crawler worker on the dev machine.**

- Plainly: **yes, this is, and looks like, routing around an IP-based block.** Production is challenged by IP
  reputation. A standing, unattended job placed on an unchallenged residential IP *because* of that is the pattern the
  challenge exists to stop.
- Staff say they hard-block unpermitted scrapers.
- robots.txt allows `GoodWatchBot`, and the ToS have no clause on automated access. So it breaks no written rule, but
  the challenge is the operator's signal.
- The honest user agent keeps it blockable, but it doesn't make a permanent crawler legitimate.
- Not recommended.

**(c) A dataset dump plus local top-ups.**

- No dataset is current. The best content is from about 2020 and mostly films.
- License labels conflict with CC BY-NC-SA. One large dump (TvTroper) is exactly what the operator refuses to publish.
- Worth using only for **URL mappings** (tvtropes2imdb, the dhruvilgala IMDb match tables), which feed (a).
- Not a data source.

**(d) Slow on-demand crawling in production only.**

- With known URLs and no guessing, most movies need exactly 1 request, and the first request from the datacenter IP
  usually passes.
- But the correct block rule (stop the whole site for 24 h on a challenge) will stop it after the first follow-up
  request each day. Realistic yield: a few titles a day.
- Plain HTTP from production is untested; only Playwright was probed.
- Useful as the safe shape for the existing `crawl_all` branch, which then stops wasting 7 minutes and ~5 requests per
  title. It is not a way to reach coverage.

**Recommendation: (a).** Rebuild the local runner on the critic-site design:

- known URLs from stored URLs, Wikidata `P6839`, and the tvtropes2imdb and dhruvilgala mappings;
- a negative cache and a stop on the first block;
- reviewed imports.

Start with the top-10k titles that have a known URL but no tropes or stale tropes, in batches of a few thousand
requests.

At the same time, cut production down to (d)'s shape, with no guessing and no retries through a block. A Windmill flow
setting can't stop the 4 retries, because `fetch.py` raises on a block and the flow retries every failure the same
way. The fix belongs in `fetch.py`: record a block without raising, or stop the site through `critic_site_state`.
Alternatively, remove the TV Tropes branch from `crawl_all`. Both are owner decisions.

Open questions: the real subpage rate for shows; whether plain HTTP from the datacenter IP is challenged as often as
Playwright; and the licenses of the dhruvilgala data and of reusing mappings from `Main/` pages.
