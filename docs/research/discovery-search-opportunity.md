# Discovery search: is it a traffic opportunity, and what stands in the way

Date: 2026-10-06. Picks up the question of the closed ticket [Assess discovery-search demand and GoodWatch visibility](https://github.com/alp82/goodwatch-monorepo/issues/80), under the [growth decision of 2026-09-16](https://github.com/alp82/goodwatch-monorepo/issues/62#issuecomment-5688789045). Draft tickets for a focused map are in [discovery-search-ticket-drafts.md](discovery-search-ticket-drafts.md). Nothing was changed in code, configuration or production, and no issue was created.

"Discovery search" means two kinds of search: titles like a reference title ("movies like Interstellar", "Filme wie Inception"), and titles by theme, mood or characteristic ("feel-good movies", "slow burn horror", "movies with unreliable narrators").

Claims are marked **[measured]** (observed on the stated date, with the source), **[public proxy]** (indicates demand, is not a volume), **[third-party estimate]** (a number I could not confirm at its source) or **[inferred]** (reasoning from measurements).

## Answer: narrow

Pursue discovery search only as a small, measured test, and only after a bounded set of GoodWatch pages is shown to stay in Google's index. Don't build a "like X" page per title, and don't start an editorial program yet.

Why not "pursue":

- **Google shows one GoodWatch page.** Since April 2026 the start page is the only URL earning impressions, apart from four sitelinks under it. Of 60 URLs inspected through the Search Console API on 2026-10-06, only the start page is reported as indexed. **[measured]**
- **Google has already tried the title pages and dropped them.** About 1,100 title pages were shown in search from 2025-12-04 and nearly all disappeared on 2025-12-16, with no change on the site. **[measured]** Whether Google will keep the site's templated pages at any scale is unproven, and every later step depends on it.
- **GoodWatch has never been found for a discovery search.** One genuine "like" query impression in 16 months, at position 55. **[measured]**
- **The pages that would answer these searches are not good answers yet.** The title page never says "like" or "similar" and gives no reason per result. The mood pages sort by popularity, so the live mind-bending page lists The Shawshank Redemption and 12 Angry Men. **[measured]**

Why not "reconsider":

- **People search this way.** Google's autocomplete for "movies like", "shows like", "filme wie" and "serien wie" is rich and follows new releases. **[public proxy]** No volume was measured, and none should be quoted.
- **A page of GoodWatch's kind can rank.** bestsimilar.com, a purely algorithmic similarity site, appeared in 5 of 6 sampled English movie "like X" result sets. **[measured, in a non-Google index]** Third parties put it at 3 to 6 million visits a month, mostly from search. **[third-party estimate]**
- **There is a gap GoodWatch's data fits.** Editorial lists give a reason per title but rarely say where to stream. Algorithmic lists give neither. Only JustWatch's guides give both, for selected titles. **[measured, 15 pages read]** GoodWatch has fingerprints for 95% of the 20,000 most-voted movies and streaming data in 67 countries per title on average. **[measured]**
- **The first step is cheap and decides the rest.** The owner can read the Search Console reports that the API does not expose, and resubmit the sitemap, in under an hour.

What would change the verdict:

- **To "pursue the prototype now":** Search Console's Crawl stats show Googlebot fetching title pages in volume with 200 responses, and the Page indexing report shows pages indexed or queued. Then the December episode was a normal trial, and the pages rebuilt on 2026-09-24/25 deserve a fresh one.
- **To "reconsider":** a manual action exists, or a bounded set of resubmitted pages is still not indexed four to six weeks after Google has read the new sitemap. Then search is closed to this site for now, and sharing and community are the better use of the effort.

## The indexing problem: cause and fix

The ticket [Share lists: later-phase ideas](https://github.com/alp82/goodwatch-monorepo/issues/163) refers to a "site-wide indexing problem". Its only written definition is in `docs/verification/235-living-room-seo.md:31`: the owner's report that only the homepage was indexed. That report is now confirmed as far as the API can show. **[measured]**

### What is measured

- **Nothing blocks indexing today.** In 107 live requests on 2026-10-06, robots.txt allowed the pages, every indexable route answered 200 with `index, follow` and a canonical pointing to itself, missing titles answered 404, the HTML was server-rendered, and a Googlebot user agent received the same document as a browser. The canonical did not change with `?country=`, `Accept-Language`, a trailing slash or a wrong slug. **[measured]** A request from a real Googlebot address could be treated differently by something in front of the proxy; the code has no address check.
- **Google's records, through the API:** the start page is "Submitted and indexed" (crawled 2026-10-04). 58 other URLs are "URL is unknown to Google": 20 title pages, 5 person pages, 5 category pages, `/discover`, `/explorer`, `/movies`, `/shows` and old URL shapes. No URL is reported as crawled or discovered but not indexed, duplicate, blocked, soft 404 or failing. A second pass with trailing-slash, `www` and slug-less variants gave the same answer. **[measured]** Table: [gsc-url-inspection-2026-10-06.csv](discovery-search/gsc-url-inspection-2026-10-06.csv).
- **"Unknown" is not proof of absence.** `/movies`, `/shows`, `/discover` and `/taste` collected sitelink impressions until 2026-09-14 and still inspect as unknown. **[measured]** So the true index may hold a few more URLs than one. It is small either way: no title, person or category page has earned an impression since 2026-04-01.
- **The sitemap has been broken as a route for 19 months.**
  - `sitemap.xml` was submitted once, on 2025-03-01, and Google last downloaded it on 2026-09-22. **[measured, `sitemaps.list`]**
  - From 2025-03-01 (`eafe8c2c`) to 2026-09-28 (`424c3a2c`) it was a sitemap index that listed two other index files. **[measured, git]** Google's help lists "Nested sitemap indexes" as a sitemap error, and says to remove the entries that point to sitemap index files and resubmit. ([Sitemaps report help](https://support.google.com/webmasters/answer/7451001?hl=en))
  - Its content was frozen from 2025-10-24 to 2026-09-25, with every `lastmod` at 2025-10-24, and about 5% of its slugs were not the canonical ones (`cd3549a3` message). **[measured]**
  - Google read 4 of the 25 old movie files and reports 0 of 1,000 URLs indexed for each. 19 are still pending. The show, static and category files are not known to Search Console. **[measured, `sitemaps.get`]**
  - Google has not yet downloaded the index as rewritten on 2026-09-25 and flattened on 2026-09-28. **[inferred from the download date]**
- **Links are a weak route too.** The start page's server HTML links to no title or person page, and seven hub links sit in a visually hidden block (`app/ui/living-room/TvScreens.tsx:132`). Before 2026-09-25 title pages linked to no other titles or people in their server HTML (`e95ab448` message). **[measured]**
- **The title pages Google saw in December 2025 were weak documents.** One meta description template for every title, no links to other titles, an empty "where to watch" section for a visitor without a cookie, a third-party `aggregateRating`, NUL bytes in the HTML, and a 500 for missing titles. All were fixed on 2026-09-24/25 (`2b1b8e60`, `05e32ae9`, `9ba9fc82`, `81a3e937`, `cd3549a3`). **[measured, git]**
- **The site has a history of very large sitemaps.** 1,004,912 movie and about 186,600 show URLs in October 2024, about 57,800 title URLs from March 2025, 26,355 from October 2025, 1,000 since 2026-09-25. **[measured, git]**

### What the December 2025 episode shows

From 2025-12-04 Google showed about 1,100 GoodWatch URLs in search, 1,021 of them title pages. The property held about 550 to 720 impressions a day from 2025-12-09 to 2025-12-15, fell to 59 on 2025-12-16 and 21 on 2025-12-17, and title pages left a trickle of 1 to 13 impressions a day until 2026-04-01. **[measured]**

- **The site did not change.** The only commit between 2025-11-29 and 2025-12-30 is a database init script on 2025-12-04. **[measured, git]**
- **Google knew these URLs from older sitemaps, so nesting did not fully block it.** 853 of the 1,021 title pages were in the March 2025 sitemap, 394 in the sitemap current at the time, and 137 in neither. **[measured, Search Console page data against git]**
- **The start page was unaffected**, which fits pages being tried and removed more than an action against the whole site. **[inferred]**
- **The drop fell five days into Google's December 2025 core update** (2025-12-11 to 2025-12-29, from Google's [Search Status Dashboard](https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history)). **[measured]** This is weak evidence: update windows cover about 30% of the days from December 2025 to September 2026.

### Cause

There is no single live defect. Two readings fit the measurements, and the API cannot separate them:

1. **Google has assessed the site's title pages and does not keep them.** It knew tens of thousands of URLs from the old sitemaps, tried about 1,100 in December 2025 when they were thin template pages, dropped them within two weeks, and has given the site little crawl attention since (19 of 25 sitemap files still pending). I think this is the larger part. **[inferred]**
2. **Google has had no working route to the pages.** The sitemap index was nested, stale and never resubmitted, the start page links to no titles, and title pages did not link to each other. This is certainly true and certainly fixable, but the December episode shows it was not a complete block. **[inferred]**

The code lane's summary, "fixed, awaiting recrawl", does not hold as stated: the page fixes shipped, but Google has not read the new sitemap, and nothing shows the pages are queued.

### Fix

In this order, because the first step tells which reading is right:

1. **Owner, in the Search Console UI** (not available through the API):
   - Security and Manual actions: confirm there is none.
   - Page indexing report: export the counts and reasons.
   - Crawl stats: requests per day, response codes, host status, especially around 2026-10-03.
   - Sitemaps: resubmit `https://goodwatch.app/sitemaps/sitemap.xml` and confirm the four children are read without the nested-index error.
   - URL Inspection with "Test live URL" on one title page, and request indexing for about ten sample pages.
2. **Regenerate the sitemap before or right after resubmitting.** The live files predate the generator's freshness rule (`fcde8190`, 2026-10-04). `lastmod` hides the rebuild of 2026-09-24/25: only 57 of 700 movies carry a September 2026 date. Use the rebuild date as a floor, and schedule the generator. Keep it at 1,000 titles until those are indexed.
3. **Stop sending crawlers to hubs.** Unknown one- and two-segment paths, `/tv-shows/*`, and the deleted sitemap files answer 302 to `/` or a hub. `/explore/*` answers 301 to a hub. Answer 404 for unknown paths and a path-preserving 301 for the old shapes.
4. **Give the start page crawlable links** to titles and visible links to the hubs.
5. **Small items:** 301 instead of 302 for `http` and `www`; `Disallow: /discover/*?` in robots.txt, because title pages link to `/discover/<type>?...` URLs that redirect into disallowed ones; a canonical for `?page=2` on category pages; no empty `{}` JSON-LD on hubs.
6. **Watch a fixed sample.** Inspect the same 50 URLs through the API every week and record the states. Decide after four to six weeks from the date Google downloads the new sitemap.

## Visibility: what the decline was

Source: Search Console API, property `sc-domain:goodwatch.app`, `searchAnalytics.query`, web search, 2025-06-13 to 2026-10-05, run on 2026-10-06. Data for 2026-10-04 and 2026-10-05 is provisional. Daily series: [gsc-daily-web-2025-06-13-to-2026-10-05.csv](discovery-search/gsc-daily-web-2025-06-13-to-2026-10-05.csv). All figures in this section are **[measured]** unless marked.

- **The total is not a level that was lost.** 2025-06-13 is the start of Search Console's 16-month retention, not of the site. The baseline is about 60 to 130 impressions and 2 to 7 clicks a week. Three episodes sit on top of it:

  | Episode | Dates | What it was |
  | --- | --- | --- |
  | Title pages | 2025-12-04 to 2025-12-16 | About 1,100 URLs, 5,069 impressions, 65 clicks, average position about 35 |
  | First brand wave | 2026-03-16 to 2026-05-31 | 132 and 154 clicks in April and May, USA mobile, on "goodwatch" and "goodwatch app" |
  | Second brand wave | 2026-06-29 to 2026-08-19 | 158 clicks in July, same queries and segment |

- **The first reading matches.** 19 clicks and 375 impressions is the window 2026-09-06 to 2026-10-05. The 814 clicks and 15,182 impressions are the final-data total to 2026-10-03.
- **The 2026 decline is the start page losing rank for its own name in the USA.**

  | Date | Change |
  | --- | --- |
  | 2026-07-18 | "goodwatch app" leaves position 1.0 |
  | 2026-07-30 to 2026-08-01 | "goodwatch app" falls to position 3 to 4; daily clicks step down from 9 to 2 |
  | 2026-08-04 to 2026-08-08 | Impressions slide from 112 to 21 a day |
  | 2026-08-20 | "goodwatch" falls from position 6 to 8 to position 14 to 30 and stays there |

  In the 90 days to 2026-07-31 the start page had 98.6% of page impressions and all clicks, and the two queries carried 305 of 307 attributed clicks. Per 30 days, clicks went from 110 to 20 and impressions from 957 to 405. In the USA "goodwatch" averaged position 2.9 in April and 33 in September; in India it moved only from about 2 to about 6.
- **No deploy caused it.** No commit exists on any branch between 2026-04-17 and 2026-09-02. The sitemap rewrite (2026-09-25) and the living room start page (2026-09-28) came five weeks after the last step, and weekly impressions since then (75, 106, 131) show no effect in either direction. Commit dates only approximate deploy dates, and a host or proxy change that left no commit is not ruled out.
- **Possible causes, none confirmed:**
  - Other products share the name: goodwatch.movie, good-watch.app, an App Store app "GoodWatch - Original Shows" and a Google Play app "GoodWatch: Movies & TV Tracker". **[measured, web search 2026-10-06]** In July 2026 brand impressions doubled while position fell, which fits other people's searchers and other results rising. Their launch dates could not be established.
  - The 2026-08-20 step falls inside Google's August 2026 spam update (2026-08-18 to 2026-08-21). The July steps fall inside no announced update.
- **Other search types:** image search has 71 impressions; video, news and Discover have none.
- **Query attribution gap:** 19% of clicks and 22% of impressions carry no query.
- **Discovery intent:** four queries matched the classification rule, and one is genuine: "indori ishq like web series", 1 impression, position 55, 2025-12-09. No mood, genre or Explorer URL has had more than 7 impressions. In December 2025 the title pages drew title lookups and "X cast" queries, with long-tail titles on pages 1 to 3 and well-known titles far down (The Godfather at position 72).

PostHog access was restored on 2026-10-10. The [search landing baseline](discovery-search-posthog-baseline.md) records 1,009 captured sessions from recognized search referrers since March 1, their landing routes, and interaction signals. It cannot attribute individual sessions to search keywords or establish whether visitors wanted a same-name product.

## Demand and what ranks now

Source: 28 queries fixed before searching, run on 2026-10-06 through the agent web search tool. 15 "like X" (12 English, 3 German) and 13 theme or mood (10 English, 3 German); reference titles were taken from Google autocomplete.

**Limits of the tool, which bound every claim here:** it is US-only and is not a Google results page. It returned 8 to 10 links per query from an unnamed index, could not be set to a country, cannot return Reddit, and shows no AI Overviews or other page features. German queries were sent from the US locale. Order is the tool's order, not Google rank.

<details>
<summary>The 28 queries</summary>

| # | Query | Language |
| --- | --- | --- |
| 1 | movies like Interstellar | en |
| 2 | movies like Shutter Island | en |
| 3 | movies like Gone Girl | en |
| 4 | movies like Coraline | en |
| 5 | shows like Severance | en |
| 6 | shows like Game of Thrones | en |
| 7 | shows like From | en |
| 8 | shows like Silo | en |
| 9 | movies like Obsession | en |
| 10 | shows like Off Campus | en |
| 11 | shows like Widow's Bay | en |
| 12 | movies like Interstellar but not space | en |
| 13 | Filme wie Interstellar | de |
| 14 | Filme wie Shutter Island | de |
| 15 | Serien wie Bridgerton | de |
| 16 | feel good movies | en |
| 17 | mind bending movies | en |
| 18 | movies with plot twists | en |
| 19 | dark comedy shows | en |
| 20 | feel good movies on netflix | en |
| 21 | slow burn horror movies | en |
| 22 | movies with unreliable narrators | en |
| 23 | cozy shows to watch when sick | en |
| 24 | slow burn romance movies | en |
| 25 | movies about grief that aren't depressing | en |
| 26 | Filme zum Nachdenken | de |
| 27 | Filme zum Weinen Netflix | de |
| 28 | Filme mit unerwartetem Ende | de |

</details>

### What ranks

All **[measured]** within that index:

- **goodwatch.app:** in none of the 28 result sets.
- **English "like X" is held by editorial publishers:** looper.com in 11 of 28 sets, tomsguide.com in 8, slashfilm.com in 7, tvline.com in 4 of the 6 English show queries. They publish within weeks of a release: Slashfilm's "movies like Obsession" is dated 2026-05-23.
- **Algorithmic pages surface, narrowly:** bestsimilar.com in 5 of the 6 English movie "like X" sets and none of the show sets; moviepilot.de's "ähnliche" page for "Filme wie Interstellar"; a horrorsight.com mood page for "slow burn horror movies". TasteDive, Movie-Map, Likewise and Letterboxd lists never appeared.
- **JustWatch guides:** in 6 of 28 sets.
- **Constraint queries get unconstrained answers.** For "but not space", "when sick" and "not depressing", the returned pages answer the query without the constraint, or come from off-topic sites (a funeral notices site, a library blog).
- **German "Filme wie X" is thinner but not empty.** For Interstellar and Shutter Island, 2 to 4 of 9 results were recommendation lists; the rest were news and title pages. The review's spot-check of "Filme wie Inception" found two template-driven competitors, filmstarts.de "Ähnliche Filme" and suchefilme.com. "Least contested" would overstate it.

### How well the top pages answer

15 pages read on 2026-10-06. **[measured, through a summarizing fetch tool]**

| Page type | Example | Reason per title | Where to stream | Current |
| --- | --- | --- | --- | --- |
| Editorial list | Slashfilm, "movies like Interstellar", 20 titles | Yes, 100 to 200 words | No | 2025-11 |
| Editorial list | Looper, "movies with unreliable narrators", 15 titles | Yes | No | 2022-05 |
| Algorithmic | bestsimilar.com, Interstellar, 23 titles | No, one template sentence | No | Undated |
| Algorithmic | moviepilot.de, "ähnliche", 20 per page | No | Links | Undated |
| Guide on a streaming database | JustWatch, "movies like Obsession", 5 titles | Yes, a paragraph | Yes, with prices | 2026-06 |
| Niche mood page | horrorsight.com, slow burn isolation horror, 14 titles | Tags only | Indicator | Undated |

### Demand evidence

- **Autocomplete [public proxy, measured 2026-10-06, `suggestqueries.google.com`]:**
  - "movies like" and "shows like" complete with a mix of evergreen titles (Interstellar, Shutter Island, Gone Girl, Game of Thrones) and 2026 releases (Obsession, Off Campus, Widow's Bay). "filme wie" and "serien wie" do the same in German.
  - Four modifiers recur on a reference title: a streaming provider, a second title ("and Inception"), "reddit", and a year.
  - Mood prefixes complete too: "shows to watch when" (bored, depressed, sick, anxious), "horror movies that are not" (that scary, gory), "filme zum" (weinen, lachen, nachdenken). German completions add public broadcasters' Mediatheken as providers.
  - "movies with" completes only with actor names, so "movies with <characteristic>" is not the common form.
- **Community size [third-party estimate, GummySearch, 2026-10-01]:** r/MovieSuggestions 1.9 million members, r/televisionsuggestions 515,000. Reddit itself could not be reached.
- **Similarity-site traffic [third-party estimate, search snippets only]:** bestsimilar.com at about 5.8 to 6.5 million visits a month in 2025 (Semrush) and 3.4 million in May 2026 (Similarweb), most of it from search. TasteDive at about 0.73 million (Semrush, 2025).
- **Publisher behaviour [public proxy]:** large publishers and JustWatch keep producing "like X" pages, and a bedding retailer's blog has one for "shows like Off Campus". The format pays for someone, and it is crowded.
- **AI answers:** not observable with the tool. Marketing-blog trackers from 2026 put entertainment queries at an AI Overview rate of roughly 31 to 37%, with clicks falling 34 to 61% when one shows. **[third-party estimate, not specific to "movies like X"]**

No search volume was found, and this document gives none.

## Supply: what GoodWatch could show today

Sources: current code at `76eaa86c`, read-only SQL on production CrateDB, the related-titles query reproduced against production Qdrant, and 10 live page requests, all on 2026-10-06. All **[measured]** unless marked.

### Surfaces

| Surface | URL | Indexable | Fit to "like X" | Fit to theme or mood |
| --- | --- | --- | --- | --- |
| Title page, related section | `/movie/{id}-{slug}`, `/show/{id}-{slug}` | Yes | The data answers it; the words don't | None |
| Mood pages | `/movies/moods/{slug}`, `/shows/moods/{slug}`, 20 each | Yes, in the sitemap | None | Closest match; the lists are poor |
| Genre and streaming pages | `/movies/genres/{slug}` and similar, 41 pages | Yes | None | Genre only |
| Explorer | `/explorer?grouping=...` | One canonical for all groupings | None | Right vocabulary (Cozy, Slow burn, Trippy, Nonlinear, True stories, Binge), no URL per island |
| Discover | `/discover?moods=...`, `?similar=...` | No: canonical `/discover`, disallowed in robots.txt | `similar=` is a filter sorted by popularity, not a ranking | A filter |
| Share lists, profiles | `/u/...` | `noindex, nofollow` by design | None | None |

- **The title page is the only indexable answer to "movies like X".** It server-renders 32 movies and 32 shows as links. Its title is `Interstellar (2014): Where to Stream and Ratings | GoodWatch`, its H1 `Interstellar`, the section heading `Related Movies and Shows` (`app/ui/details/DetailsRelated.tsx:52`). "Like" and "similar" appear nowhere, and none of the 11 FAQ templates asks the question (`app/ui/details/titleQuestions.ts:228-243`). The only explanation is the caption "Overall: Similar vibe." Cards show poster, title, year and score, with no availability.
- **The old `/explore/...` URLs** from the growth decision's time are now only a redirect to `/movies` or `/shows`.
- **Page text is English only.** Titles are the English TMDB titles, and no page is translated.

### Coverage

| Tier, by votes | Fingerprint | Tropes | Streaming data |
| --- | --- | --- | --- |
| Movies, top 1,000 | 99.3% | 96.3% | 99.6% |
| Movies, top 20,000 | 95.3% | 59.3% | 96.6% |
| Shows, top 1,000 | 99.1% | 84.6% | 98.4% |
| Shows, top 20,000 | 94.0% | 36.9% | 83.1% |

- **Catalog:** 1,256,286 movies and 233,583 shows; 564,339 and 98,176 are presentable; 156,710 and 83,228 have a fingerprint.
- **Streaming:** 97% of well-known titles (10,000 votes or more, score 60 or more) have data, for 67 countries on average. About a fifth of them were last refreshed more than 30 days ago, which CONTEXT.md defines as unknown availability.
- **Age of analyses:** none was written between March and August 2026. 48% of the 1,000 most-voted movies were last updated more than a year ago.
- **New releases:** 97% of 2026 movies with popularity of 5 or more have a fingerprint; of 2026 movies with 1,000 votes or more, 59 to 73% by quarter.
- **The analysis sees only title, year, type and synopsis** (`goodwatch-flows/windmill/f/dna/generate/fetch.py:547`). A film released on 2026-09-28 already scores acting 9 and direction 8.

### Similarity quality

13 reference titles, the same query the title page runs, top 100 each. The verdicts are one reviewer's reading, checked on four references by the review. **[inferred]**

- **Strong or good (6):** Interstellar, Severance, Project Hail Mary, Penguin Bloom, Dark, Train to Busan. Interstellar returns Ad Astra, Project Hail Mary, Contact, Arrival; Severance returns Pluribus, Homecoming, Black Mirror, Mr. Robot.
- **Mixed (5):** Inception, Parasite, Sinners, Spirited Away, Free Solo. **Weak (1):** The Bear. **Franchise clutter (1):** Avengers: Endgame.
- **It matches on feel, not facts.** Country, language, director, setting and plot device are not among the 74 attributes. Parasite returns The Menu, Fargo and Three Billboards and no Korean film. Inception's top 100 has Dark City, Looper and Open Your Eyes but not Shutter Island, Memento or The Prestige. The Bear returns no kitchen.
- **Scores are packed.** Cosine similarity spans 0.02 to 0.03 across the 32 shown, so obscure titles sit beside classics.
- **No junk.** Results need 10,000 votes and a score of 60, which leaves 8,310 movies and 2,618 shows as possible results.

### Theme and mood

- **Tone and pace map directly onto attributes:** feel-good, slow burn (1,377 movies at 8 or more), dark comedy (325), true story, visually stunning.
- **Craft attributes can't select:** acting at 8 or more covers 62% of well-known movies, direction 45%.
- **Plot devices are not in the fingerprint.** Unreliable narrator, twist ending, heist, time loop and found family exist only as TV Tropes entries and TMDB keywords, under TV Tropes' names ("The Caper", "Family of Choice"). No page uses either, trope crawling is off in production, and tropes cover 59% of the top 20,000 movies.
- **The mood pages' lists are poor because they sort by TMDB popularity.**
  - Live `/movies/moods/mind-bending` begins The Odyssey, The Shawshank Redemption, Blade Runner 2049, The Matrix, Oppenheimer, and includes The Green Mile and 12 Angry Men.
  - Live `/movies/moods/feel-good` includes Top Gun: Maverick and The Mandalorian and Grogu.
  - The same slow burn horror set sorted by votes is recognisable: The Shining, Alien, Get Out, Jaws, The Thing.
- **Pages overlap and vary wildly in size.** Feel-good and funny share 20 of their first 40 titles. Motivational shows has 3 titles; suspense matches 36% of popular titles.
- **Three rule sets define the same mood words:** the mood pages (`app/ui/explore/category/moods.ts`), the Moods of Discover and the living room (`app/domain/moods.ts`), and the Explorer's islands.
- **The mood pages' declared context and suitability filters are never applied** to the query; only the Open Graph image code reads them.
- **Presentation:** mood pages have no H1 and carry an emoji in the meta description.

The closed tickets [#71](https://github.com/alp82/goodwatch-monorepo/issues/71) and [#81](https://github.com/alp82/goodwatch-monorepo/issues/81) hold no findings: both were closed as not planned before any work.

## What the refutation changed

A separate reviewer was asked to refute the main claims from primary sources. What it changed:

| Claim before | After |
| --- | --- |
| "Google's index holds one URL" | The API reports one indexed URL. Title pages kept a trickle of impressions until 2026-04-01 and sitelinks until 2026-09-14, so "unknown" is not proof of absence. The index is small; its exact size needs the UI report. |
| "Fixed, awaiting recrawl" | Not justified. Google has not read the new sitemap and nothing is shown as queued. |
| "The nested sitemap index is the cause" | Partly. It is a documented error, but 853 of the 1,021 December title pages came from an older sitemap, so it was not a complete block. A quality verdict on the pages is at least as likely. (I ran this check after the review.) |
| "The drops fall inside Google updates" | Dates confirmed on Google's dashboard, but the windows cover about 30% of days and the July steps fall in none. Weak evidence. |
| "German 'Filme wie X' is least contested" | Overstated: at least two template-driven competitors rank. |
| "bestsimilar draws about 6 million visits" | 3 to 6 million, from two third-party estimates a year apart. |
| "Similarity is credible for about half the sample" | Fair for Parasite, somewhat harsh for Inception, whose top results resemble an editorial list. |

What it confirmed: the 16-month framing, the brand-rank steps and their dates, the commit gap, the related section's wording, and the popularity sort.

What it could not test is the highest-value check: whether real Googlebot is fetching title pages. The permission system refused its read of the production hosts, and I did not run it in its place.

## Not verified

| Open point | What would settle it |
| --- | --- |
| Whether a manual action exists | Search Console UI, Security and Manual actions. Check this first: it would explain "start page only" by itself. |
| How many URLs are indexed, and Google's reasons for the rest | Search Console UI, Page indexing report |
| Whether Googlebot crawls title pages, how many a day, and with which responses | Search Console UI, Crawl stats; or proxy access logs filtered to verified Googlebot addresses. The log read was refused for the reviewer. |
| What Googlebot received during the crawler flood of 2026-10-03/04, when 32% of requests closed without a response (`90aa853c`) | The same two sources |
| Why sitelink URLs inspect as unknown | URL Inspection in the UI for `/movies` |
| Whether the April to July brand clicks were people who wanted this site | [PostHog baseline](discovery-search-posthog-baseline.md): 120 of 333 April–July USA mobile Google sessions had autocapture, but session-level keywords and wrong-product intent remain unobservable. Landing pages and referrers are now measured. |
| Who outranks goodwatch.app for its own name in the USA, and when the same-name products launched | A manual US search; the stores' release histories |
| Host or proxy events from April to September 2026 that left no commit | Uptime monitor history, host logs, Coolify deploy history |
| Search volumes | Google Keyword Planner (free with an Ads account) |
| True Google rank, AI Overview share, Reddit presence, and German results as seen from Germany | The 28 queries run by hand in a clean browser in Germany, or a results API with location control |
| Google Trends, Reddit thread frequency, the traffic estimates at their source | A browser session; all were blocked for the agent |
| Bing visibility | Bing Webmaster Tools |
| Time from release to fingerprint; which model produced each analysis | Windmill run history; Mongo read access |
| Rendered output | Server HTML only was read. URL Inspection's rendered HTML, or a headless browser. |
| A live public share list | Verified from code only (`noindex, nofollow`) |

## Method

- **Lanes:** four subagents worked in parallel on indexability, demand, visibility and supply, each with a self-contained brief and the instruction to separate measurements from inferences. A fifth, on a different model, tried to refute the main claims. I resolved its points against git, the saved Search Console data and Google's documentation.
- **Requests to goodwatch.app:** 117 in total (107 indexability, 10 supply), one at a time, at least 2 seconds apart, with a user agent containing `goodwatch-research-4e0091b1`, while the load test of [#237](https://github.com/alp82/goodwatch-monorepo/issues/237) was running.
- **Production reads:** about 45 `SELECT` statements on CrateDB and 26 Qdrant reads. One grouped scan of `doc.trope` ran for 73 seconds during the load test; no further scans of that table were run.
- **Search Console:** read-only API, 66 URL inspections.
- **Data kept beside this document:** the daily series and the inspection table in [discovery-search/](discovery-search/). Query and page breakdowns were not committed.
