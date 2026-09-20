# TV Tropes coverage gaps for well-known titles

Research for [#110](https://github.com/alp82/goodwatch-monorepo/issues/110), a child of the map [#100](https://github.com/alp82/goodwatch-monorepo/issues/100). Measured on 2026-09-20.

## Question

Why do well-known titles lack tropes that TV Tropes has for them, and what closes the gap?

## Short answer

- The crawl ran for every title. No popular title is missing because the crawl never reached it.
- In a hand-checked sample of 30 famous titles without tropes, TV Tropes has a full trope page for 29. The 30th has a page in another namespace that the sample didn't verify. No page is really missing.
- Seven URL and parsing faults explain the sample: disambiguation pages (12 of 30), titles that start with a digit (7), dropped `&` (3), other slug mismatches (3), dropped accents (2), sub-pages without a heading (2), and a year that differs from TMDB (1).
- Every fault sits in two places: `to_pascal_case` and the URL loop in `fetch.py`. None needs a new crawler.
- The Matrix lacks "Cool Shades" as a trope row because the trope is a top-level entry only on the franchise page. The crawler never reads franchise pages. The film page mentions it inside the "Evil Is Angular" passage, so the `content` column already holds the words.
- The `trope` table has no exact duplicates. It has case variants (about 0.1% of rows), and the `movie.tropes` array repeats names. A join on `media_tmdb_id` without `media_type` duplicates rows, because movie and show IDs overlap.

## Sources

| Source | Use |
| --- | --- |
| `goodwatch-flows/windmill/f/tvtropes_web/tv_tropes_crawl_tags/fetch.py` | Crawler behavior |
| `goodwatch-flows/windmill/f/tvtropes_web/tvtropes_init_tags/main.py` | Title variations and release year |
| `goodwatch-flows/windmill/f/utils/string.py` | `to_pascal_case` slug helper |
| `goodwatch-flows/windmill/f/sync/copy/tvtropes.py` and `sync/models/crate_schemas.py` | Sync to Crate, primary key |
| Crate tables `movie`, `show`, `trope` | Read-only counts |
| Mongo collections `tv_tropes_movie_tags`, `tv_tropes_tv_tags` | Read-only crawl state: `tvtropes_url`, `title_variations`, `updated_at`, `failed_at` |
| tvtropes.org | 40 page fetches with 4 s pauses |

## How the crawler works

Verified by reading the code.

1. **Slug.** The init flow builds `title_variations` from the TMDB title and the US alternative titles of type "English title", "Short Title", or "modern title". `to_pascal_case` removes every character outside `a-zA-Z0-9` and whitespace, then capitalizes each word. "Amélie" becomes `Amlie`. "Fast & Furious 6" becomes `FastFurious6`. "12 Angry Men" becomes `12AngryMen`. A title with no Latin letters becomes an empty slug.
2. **URL guess.** The crawler tries `Film/<slug>` for movies and `Series/<slug>` for shows, one variation after the other. It accepts the first HTTP 200 and stops. It doesn't check whether the page holds tropes.
3. **Namespaces.** On a 404, it looks for a link that starts with `WesternAnimation/`, `Anime/`, or `Animation/` on the "inexact title" page and follows it. It follows no other namespace.
4. **Missing `break`.** After it follows such a link, the loop doesn't stop. With two or more title variations, the next variation overwrites the good response. The follow only works reliably when the title has one variation.
5. **Year suffix.** The crawler tries `<slug><year>` first only when `is_ambiguous_title` returns true. That function compares `type == "m"`, but the callers pass `"Film"` or `"Series"`. So movies are always checked against the show collection. A movie gets a year suffix only when two or more shows share its `original_title`. Shows are checked correctly, but only against other shows with the same TMDB `original_title`.
6. **Sub-pages.** `crawl_page` follows links whose text matches `Tropes [A-Z] to [A-Z]`. It reads tropes with the selector `h2 ~ ul > li, h3 ~ ul > li, .folder > ul > li`. It doesn't check the HTTP status of a sub-page, so a rate-limited sub-page yields zero tropes without an error.
7. **Franchise pages.** The crawler never reads `Franchise/` pages.
8. **Stored state.** `tvtropes_url` holds the final URL after redirects. An empty result doesn't overwrite stored tropes. A rate limit sets `failed_at` and leaves `updated_at` alone.
9. **Sync.** The sync copies only documents with tropes. So in Crate, `tvtropes_tags_updated_at` is null exactly when `tropes` is empty. Crate alone can't tell "never crawled" from "crawled, nothing found". Mongo can.

## Coverage numbers

### Popular titles without tropes (Crate)

"Popular" means `goodwatch_overall_score_voting_count >= 20000`.

| Set | Titles | Without tropes | Share |
| --- | --- | --- | --- |
| Movies, votes >= 20,000 | 28,638 | 16,277 | 56.8% |
| Shows, votes >= 20,000 | 6,045 | 2,882 | 47.7% |
| Movies, votes >= 200,000 | 1,373 | 166 | 12.1% |
| Shows, votes >= 200,000 | 133 | 20 | 15.0% |

By decade, votes >= 20,000:

| Decade | Movies | Without tropes | Share | Shows | Without tropes | Share |
| --- | --- | --- | --- | --- | --- | --- |
| Before 1950 | 1,182 | 434 | 36.7% | 7 | 1 | 14.3% |
| 1950s | 780 | 325 | 41.7% | 29 | 3 | 10.3% |
| 1960s | 1,071 | 427 | 39.9% | 85 | 14 | 16.5% |
| 1970s | 1,366 | 614 | 44.9% | 133 | 38 | 28.6% |
| 1980s | 2,006 | 814 | 40.6% | 250 | 61 | 24.4% |
| 1990s | 2,999 | 1,330 | 44.3% | 436 | 106 | 24.3% |
| 2000s | 5,621 | 3,163 | 56.3% | 891 | 288 | 32.3% |
| 2010s | 8,837 | 5,751 | 65.1% | 2,134 | 983 | 46.1% |
| 2020s | 4,559 | 3,246 | 71.2% | 1,955 | 1,279 | 65.4% |
| No year | 217 | 173 | 79.7% | 125 | 109 | 87.2% |

The gap grows with recency. The 20,000-vote bar is low: it admits many titles that TV Tropes doesn't cover. The 200,000-vote set is the better proxy for "well-known".

### Crawl state (Mongo)

| Collection | Documents | Crawled (`updated_at` set) | With tropes | URL found, no tropes | No URL found |
| --- | --- | --- | --- | --- | --- |
| `tv_tropes_movie_tags` | 1,111,882 | 1,111,882 | 58,087 | 8,189 | 1,045,606 |
| `tv_tropes_tv_tags` | 206,190 | 206,190 | 14,183 | 923 | 191,084 |

- Every document has been crawled. Every popular title without tropes has a Mongo document. "Crawl never ran" explains 0% of the gap.
- The newest `updated_at` is 2026-05-26. `failed_at` values reach 2026-09-10 with "Rate Limit reached". The crawl still runs, but recent runs hit the rate limit. 139,328 movie and 21,059 show documents carry a `failed_at`.
- Crate holds 1,343,056 movies and 246,579 shows, more than Mongo has crawl documents. The difference has no popular titles in it.

### Causes by share, from the stored crawl state

The classes come from `tvtropes_url` and the first title variation. They need no page fetch.

| Class | Movies >= 200k (166) | Shows >= 200k (20) | Movies >= 20k (16,277) | Shows >= 20k (2,882) |
| --- | --- | --- | --- | --- |
| A work page was found, but zero tropes were stored | 41 (24.7%) | 5 (25%) | 752 (4.6%) | 152 (5.3%) |
| The URL redirected to a `Main/` disambiguation page | 24 (14.5%) | 2 (10%) | 250 (1.5%) | 20 (0.7%) |
| No URL: slug starts with a digit | 29 (17.5%) | 2 (10%) | 393 (2.4%) | 70 (2.4%) |
| No URL: `&` dropped | 18 (10.8%) | 1 (5%) | 322 (2.0%) | 102 (3.5%) |
| No URL: accented or other non-ASCII letters dropped | 7 (4.2%) | 2 (10%) | 333 (2.0%) | 92 (3.2%) |
| No URL: empty slug, non-Latin title | 1 (0.6%) | 1 (5%) | 13 (0.1%) | 14 (0.5%) |
| No URL: other | 46 (27.7%) | 7 (35%) | 14,214 (87.3%) | 2,432 (84.4%) |

- For well-known movies, the first five classes are mechanical faults and cover 72%.
- "No URL: other" mixes three things that the stored state can't separate: subtitle and prefix mismatches ("Kill Bill: Vol. 1", "Dr. Strangelove or: ...", "Marvel's ..."), a needed year suffix when the plain URL is a 404, and pages that don't exist. At 20,000 votes, most of this class is likely titles without a TV Tropes page. This document didn't measure that split.
- The final namespaces among found URLs for movies >= 20k: Film 723, Main 250, WesternAnimation 24, five others 1 each.

## Hand-checked sample of 30 famous titles

All 30 have zero tropes in Crate and an `updated_at` in Mongo. The "working URL" column was fetched and returned HTTP 200 with the number of top-level tropes shown, unless marked.

| Title (TMDB ID) | Crawler slug and result | Working URL | Cause |
| --- | --- | --- | --- |
| The Italian Job (9654) | `TheItalianJob` redirects to `Main/TheItalianJob` | `Film/TheItalianJob2003` (100) | Disambiguation, year suffix needed |
| Casino Royale (36557) | redirects to `Main/CasinoRoyale` | `Film/CasinoRoyale2006` (301) | Disambiguation, year suffix needed |
| Scarface (111) | redirects to `Main/Scarface` | `Film/Scarface1983` (313) | Disambiguation, year suffix needed |
| Frozen (109445) | redirects to `Main/Frozen` | Not fetched | Disambiguation |
| Back to the Future (105) | `Film/BackToTheFuture`, 0 tropes | Page links to `Film/BackToTheFuture1985` | Disambiguation inside `Film/`, year suffix needed |
| Dune (438631) | `Film/Dune`, 0 tropes | Page links to `Film/Dune2021` | Same |
| Parasite (496243) | `Film/Parasite`, 0 tropes | Page links to `Film/Parasite2019` | Same |
| The Batman (414906) | `Film/TheBatman` redirects to `Film/Batman`, 0 tropes | `Film/TheBatman2022` (282) | Same |
| The Lion King (8587) | `WesternAnimation/TheLionKing`, 0 tropes | Page links to `WesternAnimation/TheLionKing1994` | Same, in the animation namespace |
| The Witcher (71912) | `Series/TheWitcher`, 0 tropes | Page links to `Series/TheWitcher2019` | Same |
| The Office (2316) | `Series/TheOffice`, 0 tropes | Page links to `Series/TheOfficeUS` | Disambiguation, a year doesn't help |
| Spider-Man (557) | `Film/SpiderMan`, 0 tropes | `Film/SpiderMan1` (349) | Disambiguation, a year doesn't help |
| 12 Angry Men (389) | `12AngryMen`, 404 | `Film/TwelveAngryMen` (119) | Leading digit |
| 300 (1271) | `300`, 404 | `Film/ThreeHundred` (293) | Leading digit |
| 2001: A Space Odyssey (62) | `2001ASpaceOdyssey`, 404 | `Film/TwoThousandOneASpaceOdyssey` (301) | Leading digit |
| (500) Days of Summer (19913) | `500DaysOfSummer`, 404 | `Film/FiveHundredDaysOfSummer` (126) | Leading digit |
| 12 Years a Slave (76203) | `12YearsASlave`, 404 | `Film/TwelveYearsASlave` (105) | Leading digit |
| 24 (1973) | `24`, 404 | `Series/TwentyFour` (454) | Leading digit |
| 30 Rock (4608) | `30Rock`, 404 | `Series/ThirtyRock` (558) | Leading digit |
| Mr. & Mrs. Smith (787) | `MrMrsSmith`, 404 | `Film/MrAndMrsSmith2005` (139) | `&` dropped, plus year suffix |
| Fast & Furious 6 (82992) | `FastFurious6`, 404 | `Film/FastAndFurious6` (100) | `&` dropped |
| Love, Death & Robots (86831) | `LoveDeathRobots`, 404 | `Series/LoveDeathAndRobots` is a 404. The page is expected under `WesternAnimation/`. Not fetched. | `&` dropped, plus namespace |
| Léon: The Professional (101) | `LonTheProfessional`, 404 | `Film/LeonTheProfessional` redirects to `Film/TheProfessional` (200) | Accent dropped |
| Amélie (194) | `Amlie`, 404 | `Film/Amelie` (161) | Accent dropped |
| Kill Bill: Vol. 1 (24) | `KillBillVol1`, 404 | `Film/KillBill` (328) | Subtitle: one page covers both volumes |
| Dr. Strangelove or: ... (935) | full long slug, 404 | `Film/DrStrangelove` (265) | Subtitle: the page uses the short title |
| Marvel's Agents of S.H.I.E.L.D. (1403) | `MarvelsAgentsOfShield`, 404 | `Series/AgentsOfSHIELD` (sub-pages) | Prefix: the page drops "Marvel's" |
| Battlestar Galactica (1972) | `BattlestarGalactica`, no URL | `Series/BattlestarGalactica2003` (sub-pages) | Year suffix needed, and TMDB says 2004 while TV Tropes says 2003 |
| Citizen Kane (15) | `Film/CitizenKane`, 0 tropes | Same page, tropes on 3 sub-pages, 66 on the first | Sub-page selector misses |
| Downton Abbey (33907) | `Series/DowntonAbbey`, 0 tropes | Same page, tropes on 7 sub-pages, 85 on the first | Sub-page selector misses |

Sample shares:

| Cause | Titles | Share |
| --- | --- | --- |
| Disambiguation page accepted as the result | 12 | 40% |
| Slug starts with a digit | 7 | 23% |
| `&` dropped instead of written as "And" | 3 | 10% |
| Subtitle or prefix differs from the TV Tropes page name | 3 | 10% |
| Accented letters dropped instead of transliterated | 2 | 7% |
| Sub-page without a heading or folder | 2 | 7% |
| Year on TV Tropes differs from TMDB | 1 | 3% |
| Wrong namespace as the only cause | 0 | 0% |
| Page really missing | 0 | 0% |
| Crawl never ran | 0 | 0% |

The ticket's examples fit. The Italian Job, Casino Royale, and The Batman are disambiguation cases. Fast & Furious 6 is the `&` case. Gone in Sixty Seconds stores `Film/GoneIn60Seconds` with zero tropes, which is the disambiguation-inside-`Film/` pattern. Drive (64690) has 93 tropes in Mongo from `Film/Drive2011`, so that one is fixed at the source already.

### Why the sub-page selector misses

The selector needs a list that follows an `h2` or `h3`, or a list inside `.folder`.

- The Matrix sub-pages wrap tropes in folders, so `.folder > ul > li` matches. The 481 stored tropes equal the 487 top-level entries on `TheMatrixFilm/TropesAToF`, `TropesGToO`, and `TropesPToZ`.
- The Citizen Kane and Downton Abbey sub-pages hold a plain `<ul>` after an `<hr>`. No article heading precedes it and no folder wraps it. The selector matches nothing, and the crawler stores zero tropes.
- A sub-page that returns 403 also yields zero tropes without an error, because `crawl_page` doesn't check the status.

## Titles that have tropes but miss an obvious one

The Matrix (603) has 483 `trope` rows and no "Cool Shades".

- `Film/TheMatrix1999` lists tropes on three sub-pages. The crawler reached them.
- On those sub-pages, "Cool Shades" isn't a top-level entry. It appears inside the passage of "Evil Is Angular": "All the major characters wear Cool Shades while inside the Matrix". That row exists in Crate, so a full-text search over `trope.content` finds the words.
- "Cool Shades" is a top-level entry on `TheMatrix/TropesAToG`, a sub-page of `Franchise/TheMatrix`. The film page links to the franchise page. The crawler never follows it.
- The franchise page has about 112 top-level tropes on its first sub-page alone. Franchise tropes apply to every film in the series, so copying them to each member title is reasonable.
- This document didn't size how many titles have a franchise page. One stored URL in the popular set points at `Franchise/`.

## Duplicate rows

Sample: movies with `media_tmdb_id < 2000`, which is 106,458 `trope` rows for 986 titles.

| Check | Result |
| --- | --- |
| Exact duplicates of (`media_tmdb_id`, `media_type`, `name`) | 0. The primary key prevents them. |
| Duplicates after `lower(trim(name))` | 54 pairs, 108 rows, about 0.1% of rows. Example: "MacGuffin" and "Macguffin" for movie 340. |
| IDs below 2,000 that have tropes as both a movie and a show | 467 |
| `movie.tropes` arrays with repeated names | 93 of 986 titles, 372 repeated entries of 104,433 (0.36%) |

- The duplicates that the prototype saw most likely come from a join on `media_tmdb_id` without `media_type`. TMDB movie and show IDs overlap, so such a join mixes two titles.
- TV Tropes pages list some tropes twice with different casing, or once per folder. The sync dedupes the `trope` rows by exact name. It doesn't dedupe the `tropes` array. The Matrix has 481 array entries and 483 rows, so the array and the table also drift apart.

## Smallest fix for each cause

| Cause | Share of sample | Smallest change |
| --- | --- | --- |
| Disambiguation page accepted | 40% | In `fetch.py`, treat a 200 page with zero tropes and zero sub-page links as a miss. Treat a final URL under `Main/` the same way. Then try `<slug><year>`, and then follow the link on the page whose target ends in the release year. Also fix `is_ambiguous_title` to compare `"Film"`, or drop it and always try the year suffix after a miss. |
| Leading digit | 23% | In `get_title_variations`, add a variation that spells out a leading number: "12" to "Twelve", "300" to "ThreeHundred", "2001" to "TwoThousandOne". A small number-to-words helper covers it. |
| `&` dropped | 10% | In `to_pascal_case`, replace `&` with " And " before the character filter. Replace `+` with " Plus " in the same step. |
| Subtitle or prefix | 10% | Add variations: the text before the first `:` or " or:", and the title without a leading "Marvel's", "DC's", or "Tom Clancy's". The first-200 rule then needs the zero-trope check above so that a short slug can't lock in a disambiguation page. |
| Accents dropped | 7% | Transliterate with `unicodedata.normalize("NFKD", ...)` and drop combining marks before the filter. "Amélie" becomes `Amelie`. |
| Sub-page without heading | 7% | On a sub-page, add `#main-article > ul > li` to the selector. Check the sub-page status and raise on 403 so that the run retries instead of storing a partial list. |
| Year differs from TMDB | 3% | After the zero-trope check, follow the disambiguation link whose year is within one of the release year. |
| Missing `break` after a namespace follow | Not in sample | Add `break` when the followed page returns 200. |
| Other namespaces | Not in sample as a sole cause | Extend the 404 link follow to any work namespace whose link text ends in the slug. Do it after the fixes above, and measure again. |
| Franchise tropes | Separate | When the work page links to `Franchise/<name>`, crawl it once and store its tropes with a `source` marker. It needs a schema decision, so it's a separate ticket. |
| Duplicates | Separate | In the sync, dedupe by `lower(trim(name))` and build the `tropes` array from the deduped set. In every query, join on `media_type` as well as `media_tmdb_id`. |

A re-crawl must follow the slug fixes. The init flow rewrites `title_variations` on each run, so the cheapest path is: deploy the fixes, run the init flow, then re-select only the documents with no tropes and a vote count above a threshold. That set is about 19,000 documents at 20,000 votes, or 186 at 200,000 votes. The rate limit decides how fast that goes.

## Limits of this research

- The 30-title sample is hand-picked from the top of the vote ranking. It shows which causes exist and their rough order. It isn't a random sample.
- "No URL: other" holds 87% of the popular movies without tropes at the 20,000-vote bar. This research didn't measure how many of those have a TV Tropes page.
- The Love, Death & Robots and Frozen target pages weren't fetched, because the request budget of 40 was spent.
- No production data was written. The crawler code wasn't changed.
