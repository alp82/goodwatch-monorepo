# Why Google crawls GoodWatch but does not index its pages

## Most likely causes

Checked **2026-10-27**, using read-only URL Inspection, live HTTP requests and the existing research. The evidence supports two problems: **very little discovery or retained URL information for most pages, and exclusion after successful crawling for the pages Google does fetch**. There is no demonstrated single technical switch that fixes both. The start page being indexed proves neither that every route works nor that Google wants the rest of the catalog.

| Rank | Likely cause | Evidence and confidence | Test that confirms or weakens it |
| --- | --- | --- | --- |
| 1 | Low crawl demand for the site's inner pages, potentially reinforced by limited independent recognition | Strong evidence for low activity; moderate confidence about why. The October 11 export found about 1.4 Smartphone/Desktop page requests a day, host problems in the past, and mostly refreshes. Most requested movie URLs remain unknown despite working HTML and sitemap membership. Several show URLs were successfully crawled but excluded. Three referring domains were verified publicly; Google also reports historical external referrers. The total and strength of independent coverage are unknown. | Export current Crawl Stats and inspect verified Googlebot document requests for October 10–27. If healthy responses dominate but discovery remains rare, demand becomes the leading explanation. If 5xx, robots failures or connection failures dominate, reliability moves to first place. Record organic citations and subsequent deep-page crawls; do not infer a required backlink count. |
| 2 | Google sees insufficient additional value in the fetched catalog and list pages | Plausible, not a proven quality verdict. The requested shows and several hubs/categories remain unindexed after successful mobile crawls with matching Google and user canonicals. Shared TMDB facts face strong competitors. However, current pages already contain substantial GoodWatch analysis; they are not empty TMDB copies. | On five existing pages that Google has actually crawled, improve verifiable recommendation reasons, data provenance and answer accuracy. Leave five comparable fetched pages unchanged. After recrawls, compare indexing and impressions over 4–6 weeks. No recrawl means the experiment has not tested quality. An unexplained indexing change is not proof of causation. |
| 3 | Historical or intermittent availability problems suppress crawling | Historical evidence and a reproducible failure mechanism exist; this live sample did not reproduce failures. October 11 Crawl Stats reported 1.2% server errors, host problems, and a 15.8 s daily average on October 1. The current 3 s dependency deadline returns 503. A separate October 26 local restart investigation reproduced title 503s. | Correlate verified Googlebot requests with 503/429 rates, dependency timeouts, deploy/restart windows, and host availability. Run owner-side passive monitoring for at least a week. Repeated warm successful requests from this workstation cannot rule out cold or restart failures. Keep genuine temporary failures as 503; solve their cause rather than return an empty 200. |
| 4 | Discovery is diluted across a much larger graph than the preferred cohort | Directly measured, but its effect on Google's choices is unproven. The live sitemap has 1,435 URLs, including 300 new country/service pages. The original 1,000 title cap remains intact. Links extracted from 22 representative requests expose 1,449 distinct internal URLs, including 424 title URLs and 204 person URLs outside all current sitemaps. | Compare verified Googlebot crawl shares for preferred titles, noncohort titles/people, new country pages, and parameter URLs. Confirm that all 1,000 preferred titles have visible links from the best lists; that check passes here. If most crawling already targets the preferred cohort, dilution is a weaker explanation. |
| 5 | Recent repairs have not received enough fresh crawls | A contributing timing issue, not an explanation for the long history. The October 20 title requests are only seven days old. Some hubs were last crawled October 11; the current output has since changed. Google briefly showed about 1,100 titles in December 2025 before dropping them, according to #347. | Continue the fixed weekly record through the existing November 7 gate and compare each inspection's crawl timestamp with actual deployment dates. Distinguish “never fetched,” “old version fetched,” and “current version fetched then excluded.” Do not declare permanent rejection or delete pages after one request. |

**Lower-probability explanations tested:** a sitewide robots/noindex block, canonical consolidation into the start page, universal JavaScript-only content, current blanket 503s, old URL soft redirects, and missing h1s do not fit the live samples. A fresh manual action, security issue, or temporary removal cannot be excluded through the API; the owner screens below close that gap. Country-dependent offers exist, but the tested variants preserve the page identity and core English content.

The older [October 11 report](search-console-reports-2026-10-11.md) concluded “no route.” That was a reasonable description of its evidence, not proof that Google was technically unable to reach every page. Today the preferred lists, breadcrumbs, canonical redirects and sitemap downloads establish working routes. Continued low demand and exclusion need their own tests. Google distinguishes crawl capacity from crawl demand and says that successful crawling does not guarantee indexing. [Google crawl-budget guidance](https://developers.google.com/crawling/docs/crawl-budget), [crawling troubleshooting](https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors).

## Tweet verdicts

These cover the tweet's Indexing section and the indexing and duplicate-page items in Low hanging fruit and Quick 5min SEO hacks. Effort estimates are engineering or owner time, not promises of results. Recommendations marked Applies are ordered by likely effect on useful indexing and visits; Bing work has a separate benefit from Google work.

| Priority | Tweet point | Verdict | GoodWatch action, effort and expected effect |
| --- | --- | --- | --- |
| 1 | Check Coverage / Pages and fix “Crawled – currently not indexed” | **Owner action — owner work.** Diagnosis requires fresh reports, not repeated submission. | Export Pages and Crawl Stats and check the five owner screens below, about 30–60 minutes. This distinguishes availability problems from low demand and fetched-page exclusion. Then address the measured cause. |
| 2 | Fix pages that should rank but remain excluded | **Applies — content work**, followed by scoped code work where needed. | Pilot accurate, sourced, title-specific discovery explanations on five already-fetched pages; use existing analysis and Q&A rather than add generic text. About 2–4 days plus observation. Potentially high effect for fetched pages if value is the problem; little immediate effect on pages Google has not fetched. This is a proposal within the existing gate, not authorization to start the deferred discovery-page program. |
| 3 | Do not waste crawl budget creating too many pages | **Applies — owner work and code work**, narrowly. | Reconcile the current 1,435 sitemap URLs with the preferred cohort and examine crawl allocation before expanding further. Audit overlapping new country/service pages; maintain strong cohort links. About half a day to measure, 1–2 days for any justified selection/canonical work. Potentially useful with this host's low activity. Folder depth itself is not a reason to remove useful pages. |
| 4 | Thin pages fighting for the same query: keep the stronger URL, merge or 301 | **Applies — content work and code work**, only after identifying equivalence. | Compare query intent, offer lists and actual traffic for overlapping streaming/category pages, including country pages. About 1 day for a small sample. Use 301 only when there is a true replacement; use 404/410 for removed content with none. Existing legacy mappings already handle sampled old shapes. No evidence supports deleting all unindexed titles. |
| 5 | Do the same for Bing and Yandex | **Applies — code work; owner work for their dashboards.** | Add free IndexNow notifications for substantive changes to eligible canonical URLs, a public verification file, bounded retries and submission logs. About half to one day. Check Bing Webmaster Tools first. This can improve Bing/Yandex discovery and freshness; it does not remedy Google's exclusions. |
| — | Add sitemap.xml to Search Console | **Already done.** | The index and five original children are submitted, with zero reported errors/warnings. The master currently references two more children; the new-arrivals child was read October 25. Owner checks current discovery counts in the UI; no need to resubmit the unchanged original files again. |
| — | robots.txt should allow public pages | **Already done for the tested canonical routes.** | `/robots.txt` allows public paths and advertises the master. It excludes API, browser-check, outbound redirects, filtered person URLs and Discover parameter URLs. Do not remove these bounds just to make a crawler report greener. |
| — | See whether all pages are indexed | **Already done as a measurement; the indexing goal is unmet.** | The fixed [weekly record](index-record.md) measures 50 URLs. This report inspects 38 current targets, including all 30 requested URLs. Sample totals are not a property-wide census. Preserve the fixed sample and add a separate request log rather than replace it. |
| — | If pages are not indexed, run indexrusher | **Doesn't apply.** | No evidence of benefit sufficient to justify payment. A crawl notification does not buy inclusion. The free tools cover the legitimate submission routes. See the paid-tools section. |
| — | Request indexing for new pages; automate it with indexrusher | **Already done manually; owner action after substantive fixes.** | The owner requested the three batches below. Request a small set after a meaningful change and successful live test, then wait days to weeks. There is no general Google indexing-submission API for movie pages. Do not automate the Search Console UI. |
| — | Request each known but unindexed page; delete it if that fails because Google will never index it | **Doesn't apply as written.** | Google explicitly allows future indexing and says another crawl request is unnecessary for this exclusion state. Keep useful pages while testing the cause. Remove or consolidate only on evidence of poor content, duplication or obsolete intent. |
| — | Paste URL into Inspection → Request indexing | **Owner action — owner work**, when justified. | Inspect the exact canonical, choose Test live URL, confirm successful fetch and indexability, inspect rendered HTML, then Request indexing once after a material improvement. About 2–5 minutes per pilot URL. Not a ranking or indexing guarantee. |
| — | Submit/resubmit sitemap.xml | **Already done; owner action only for a changed or unread file.** | Check Sitemaps after deployment and use the actual advertised URL, `https://goodwatch.app/sitemaps/sitemap.xml`. `/sitemap.xml` now redirects there. Repeatedly submitting identical files does not demonstrate a fix. |
| — | Search site:mydomain to see indexing and appearance | **Applies — owner work**, as a spot check. | Check Google and Bing `site:goodwatch.app`, plus exact title URLs, about 5 minutes. Use URL Inspection for Google status and Bing's authenticated Index card for Bing status. Search operators are incomplete and their result counts are not index totals. |
| — | Add internal links to the page you want to push | **Already done structurally; applies selectively — content work.** | Best-of lists link all 1,000 preferred titles across five pages. Add a few contextual deep links from relevant published material when it exists; do not repeat the completed hub/list/breadcrumb work or publish a noindex draft just to manufacture links. About 15–30 minutes per suitable article. |

Google's official guidance says requests can take days to weeks, have a quota, do not guarantee inclusion, and repeated requests for an unchanged URL do not speed crawling. The Page indexing report says crawled-but-unindexed pages may be indexed later and do not need another crawl submission. [Requesting a recrawl](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl), [Page indexing report](https://support.google.com/webmasters/answer/7440203?hl=en), [site: operator limitations](https://developers.google.com/search/docs/monitor-debug/search-operators/all-search-site).

## Search Console: all requested URLs

The following tables contain **indexed-version inspection data**, not a Test live URL result. They were fetched on October 27 using `sc-domain:goodwatch.app`, the existing read-only client and 38 URL Inspection calls, well below this task's 300-call ceiling. There were no indexing requests or account changes.

Request dates for the first two groups come from the comment log on [#353](https://github.com/alp82/goodwatch-monorepo/issues/353); the October 20 group comes from this task's owner record. Full paths disambiguate title versions: The Office is the US show, TMDB 2316.

`Unknown` means **URL is unknown to Google**. `Crawled, excluded` means **Crawled - currently not indexed**. All crawl times are UTC. `Self / self` means Google and user canonical both equal `https://goodwatch.app` plus the row's path. A dash means the API did not return that field, not that the live page lacks it. “None returned” in the sitemap column means the API omitted `sitemap`; it is not proof of missing sitemap membership. The current XML membership is checked separately. Google's own URL Inspection documentation describes missing sitemap associations. [URL Inspection help](https://support.google.com/webmasters/answer/9012289?hl=en).

### Requested October 16: hubs

| Path | State | Last crawl (UTC) | Google / user canonical | API referring sitemaps | Current XML |
| --- | --- | --- | --- | --- | --- |
| `/movies` | Unknown | — | — / — | None returned | `sitemap_static.xml` |
| `/shows` | Crawled, excluded | 2026-10-16 21:28:19 | Self / self | None returned | `sitemap_static.xml` |
| `/movies/genres` | Unknown | — | — / — | None returned | `sitemap_categories.xml` |
| `/movies/moods` | Unknown | — | — / — | None returned | `sitemap_categories.xml` |
| `/movies/streaming` | Unknown | — | — / — | None returned | `sitemap_categories.xml` |
| `/shows/genres` | Crawled, excluded | 2026-10-16 21:30:19 | Self / self | None returned | `sitemap_categories.xml` |
| `/shows/moods` | Crawled, excluded | 2026-10-16 21:32:20 | Self / self | None returned | `sitemap_categories.xml` |
| `/shows/streaming` | Unknown | — | — / — | None returned | `sitemap_categories.xml` |
| `/movies/streaming/netflix` | Unknown | — | — / — | None returned | `sitemap_categories.xml` |
| `/shows/streaming/netflix` | Unknown | — | — / — | None returned | `sitemap_categories.xml` |

### Requested October 18: categories

| Path | State | Last crawl (UTC) | Google / user canonical | API referring sitemaps | Current XML |
| --- | --- | --- | --- | --- | --- |
| `/movies/genres/horror` | Unknown | — | — / — | None returned | `sitemap_categories.xml` |
| `/movies/genres/comedy` | Unknown | — | — / — | None returned | `sitemap_categories.xml` |
| `/movies/genres/thriller` | Unknown | — | — / — | None returned | `sitemap_categories.xml` |
| `/movies/genres/science-fiction` | Unknown | — | — / — | None returned | `sitemap_categories.xml` |
| `/movies/moods/feel-good` | Unknown | — | — / — | None returned | `sitemap_categories.xml` |
| `/movies/moods/mind-bending` | Unknown | — | — / — | None returned | `sitemap_categories.xml` |
| `/movies/moods/scary` | Unknown | — | — / — | None returned | `sitemap_categories.xml` |
| `/shows/genres/crime` | Crawled, excluded | 2026-10-18 05:44:21 | Self / self | None returned | `sitemap_categories.xml` |
| `/shows/genres/comedy` | Crawled, excluded | 2026-10-18 05:46:21 | Self / self | None returned | `sitemap_categories.xml` |
| `/movies/streaming/amazon-prime` | Unknown | — | — / — | None returned | `sitemap_categories.xml` |

### Requested October 20: best lists and titles

| Path | State | Last crawl (UTC) | Google / user canonical | API referring sitemaps | Current XML |
| --- | --- | --- | --- | --- | --- |
| `/movies/best` | Unknown | — | — / — | None returned | `sitemap_static.xml` |
| `/shows/best` | Crawled, excluded | 2026-10-20 04:15:23 | Self / self | None returned | `sitemap_static.xml` |
| `/movie/157336-interstellar` | Unknown | — | — / — | None returned | `sitemap_movie_detail_0.xml` |
| `/movie/27205-inception` | Unknown | — | — / — | None returned | `sitemap_movie_detail_0.xml` |
| `/movie/155-the-dark-knight` | Unknown | — | — / — | None returned | `sitemap_movie_detail_0.xml` |
| `/movie/496243-parasite` | Unknown | — | — / — | None returned | `sitemap_movie_detail_0.xml` |
| `/show/2316-the-office` | Crawled, excluded | 2026-10-20 04:17:24 | Self / self | None returned | `sitemap_show_detail_0.xml` |
| `/show/456-the-simpsons` | Crawled, excluded | 2026-10-20 04:23:25 | Self / self | None returned | `sitemap_show_detail_0.xml` |
| `/show/108978-reacher` | Crawled, excluded | 2026-10-20 04:25:44 | Self / self | None returned | `sitemap_show_detail_0.xml` |
| `/show/1416-greys-anatomy` | Crawled, excluded | 2026-10-20 04:25:44 | Self / self | None returned | `sitemap_show_detail_0.xml` |

### Additional controls

| Path | State | Last crawl (UTC) | Google / user canonical | API referring sitemaps | Current XML |
| --- | --- | --- | --- | --- | --- |
| `/` | Indexed | 2026-10-26 23:57:35 | Self / self | None returned | `sitemap_static.xml` |
| `/discover` | Crawled, excluded | 2026-10-11 04:30:04 | Self / self | None returned | `sitemap_static.xml` |
| `/explorer` | Crawled, excluded | 2026-10-11 04:30:05 | Self / self | None returned | `sitemap_static.xml` |
| `/people` | Unknown | — | — / — | None returned | `sitemap_static.xml` |
| `/person/525-christopher-nolan` | Unknown | — | — / — | None returned | `Not listed` |
| `/support` | Unknown | — | — / — | None returned | `sitemap_static.xml` |
| `/use-with-ai` | Unknown | — | — / — | None returned | `sitemap_static.xml` |
| `/discord` | Unknown | — | — / — | None returned | `sitemap_static.xml` |

Of the 30 requested URLs, **0 are indexed, 10 are crawled and excluded, and 20 are unknown**. Across all 38 inspections, the start page is the only indexed URL; 12 are crawled and excluded and 25 unknown. Every crawled URL reports `SUCCESSFUL`, `ALLOWED`, `INDEXING_ALLOWED`, `MOBILE`, and matching self canonicals. All 38 omit the `sitemap` field, including the indexed start page. All 30 requested URLs are present in the live XML.

The requested shows and show-oriented categories account for all 10 fetched exclusions. All four requested movie titles and `/movies/best` remain unknown. That asymmetry is useful for checking the owner request log and crawler access logs, but it does not establish a movie-route bug: live movie responses work. A manually accepted request is not proof that a later indexing crawl occurred.

Inspection times: **2026-10-27 09:17:42–09:22:13 UTC**. `/shows` and `/shows/genres` were recrawled October 16; `/discover` and `/explorer` still show October 11. The October 20 show crawls give direct evidence that requesting indexing can lead to fetching without inclusion.

## What a Googlebot smartphone user agent gets now

The HTTP checks used GET, a smartphone Googlebot user agent, no authentication, no JavaScript, and initially no cookies or Accept-Language. Response sizes below are **decoded HTML bytes**, including embedded data and markup. Times are total request time in seconds from one workstation; they are neither Google's timing nor a load test. The user agent does not authenticate the request as a real Googlebot IP. HTTP results therefore complement, rather than replace, Search Console and verified bot logs.

| Path | Status | Decoded bytes | Total seconds | Main HTML evidence |
| --- | ---: | ---: | ---: | --- |
| `/` | 200 | 202,165 | 0.168 | h1: GoodWatch finds your next movie or show; 83 anchors. |
| `/movies` | 200 | 129,576 | 0.265 | h1: The best movies and where to stream them; 81 anchors. |
| `/shows` | 200 | 124,768 | 0.318 | h1: The best TV shows and where to stream them; 78 anchors. |
| `/movies/best` | 200 | 505,846 | 0.293 | h1: The best movies of all time; 288 anchors. |
| `/shows/best` | 200 | 501,129 | 0.716 | h1: The best TV shows of all time; 286 anchors. |
| `/movies/moods/scary` | 200 | 225,756 | 0.485 | h1: Scary movies; 75 anchors. |
| `/movies/genres/science-fiction` | 200 | 224,783 | 0.579 | h1: Best science fiction movies; 75 anchors. |
| `/movies/streaming/netflix` | 200 | 222,453 | 0.658 | h1: Movies on Netflix; 75 anchors. |
| `/movie/157336-interstellar` | 200 | 376,306 | 0.696 | h1: Interstellar; 158 anchors. |
| `/movie/27205-inception` | 200 | 364,380 | 0.965 | h1: Inception; 151 anchors. |
| `/movie/155-the-dark-knight` | 200 | 370,610 | 1.111 | h1: The Dark Knight; 167 anchors. |
| `/movie/496243-parasite` | 200 | 376,986 | 1.253 | h1: Parasite; 167 anchors. |
| `/show/108978-reacher` | 200 | 367,406 | 0.566 | h1: Reacher; 161 anchors. |
| `/show/456-the-simpsons` | 200 | 820,471 | 1.084 | h1: The Simpsons; 174 anchors. |
| `/show/1416-greys-anatomy` | 200 | 609,536 | 1.269 | h1: Grey's Anatomy; 168 anchors. |
| `/person/525-christopher-nolan` | 200 | 212,075 | 0.337 | h1: Christopher Nolan; 79 anchors. |
| `/people` | 200 | 134,755 | 0.298 | h1: Popular actors; 208 anchors. |

All successful canonical samples have one h1, a self canonical and `index, follow`. None returned X-Robots-Tag, a country redirect, a login gate, or hreflang. Headings, summaries, fingerprint text, Q&A and ordinary anchor links are present before JavaScript. The Interstellar page has 158 anchors; the Reacher page has 161. The title pages include links to related titles in HTML, rather than depending on the interactive map API.

The absence of hreflang is not a sitewide indexing block. These URLs present one canonical English identity with country-dependent availability, not a tested family of separately indexable language URLs. Do not add hreflang to parameter variations indiscriminately.

### Reliability and the 3 s deadline

The first probe batch made 35 GETs, including five repeat Reacher requests, country variants, expected 404s and redirects. No response returned 503 or 429. Reacher's five repeats were 0.183–0.635 s; the initial request was 0.566 s. These were small, mostly warm samples.

The deadline is real: [title-page-budget.ts](../../../goodwatch-webapp/app/server/title-page-budget.ts) caps the essential title dependency at 3,000 ms and throws 503 with `Retry-After: 5` and private/no-store caching. That is a dependency budget, not a guarantee that every full response completes within 3 s. A temporary 503 is preferable to misleading missing-title content, but repeated failures can reduce crawling.

The [October 26 local restart investigation](../../implementation/crate-title-deadline.md) reproduced 3 s failures with an initial database attempt that could outlast the page budget. It also found a separate cold-query latency concern. That is evidence of a mechanism, **not evidence that Googlebot hit it in production**. Do not raise the deadline, recalibrate the performance budget, or deploy the rejected retry patch as an SEO shortcut. The owner log correlation is the next test.

### Country, language, cookies and caching

- The no-cookie/no-language request showed US streaming offers and English content.
- `?country=US` and `?country=DE` both returned 200 and the clean title canonical. Offers and the age certificate changed; the title, overview and fingerprint identity remained English. Netflix category results changed by country as expected, also retaining their clean canonical.
- A Googlebot request with `Accept-Language: de-DE,de;q=0.9` showed German offers but still English title content. Browser and bot requests both received substantive pages.
- A valid guest localization cookie was tested separately using the actual `gw_loc` JSON format from [media-language.ts](../../../goodwatch-webapp/app/utils/media-language.ts). Both bot and browser requests showed Germany and retained the clean canonical; the bot kept English content while the browser advertised German media language. Both returned 200. No account cookie or saved user setting was used.
- The tested HTML responses carry `Cache-Control: private, max-age=0` and `Vary: Accept-Language, Accept-Encoding`. They do not advertise shared caching. Absence of `Vary: Cookie` is not by itself evidence that one visitor receives another's content under this policy. Cache correctness still needs testing whenever shared proxy caching changes.

Google usually crawls from US IPs without Accept-Language, though it can crawl from other locations. These requests do not simulate different network countries. No evidence here supports country adaptation as the main indexing cause, but alternate locale reach remains untested by a real bot. [Google locale-adaptive crawling](https://developers.google.com/search/docs/specialty/international/locale-adaptive-pages).

### Old shapes and soft 404s

| Requested path | Observed result |
| --- | --- |
| `/tv/108978-reacher` | One 301 to `/show/108978-reacher`, then substantive 200 with the final canonical. |
| `/explore/movies/moods/scary` | One 301 to `/movies/moods/scary`, then substantive 200. |
| `/explore/movies/plot/time-travel` | Real 404, not a hub redirect. |
| `/movie/157336-interstellar-wrong` | One 301 to the exact Interstellar path, then 200. |
| `/qwertyzzz` | Real 404 with “Page not found”; no canonical. |
| `/sitemap.xml` | One 301 to `/sitemaps/sitemap.xml`. |

The [October 11 report](search-console-reports-2026-10-11.md) explains that 82 of its 84 crawled-but-unindexed examples were legacy/parameter shapes or sitemap files. That historical count must not be presented as 84 rejected current title pages. Sampled legacy fixes still work; no current blanket soft-404 pattern was found. The current sitewide Soft 404 count requires the owner Pages export.

## Content value and duplication

A current title page is more than an overview, but substantial parts are shared facts, UI text or lists of names. Counting all words as original editorial content would overstate its value.

For five pages, parse raw HTML, remove script/style/svg/noscript, select `main`, and count whitespace-delimited text. The section counts include labels and controls, and related titles may have responsive/hidden duplicates. They measure **text emitted into the DOM**, not an exact visual word count, original-prose percentage or Google's quality score.

| Page | Main words | Fingerprint | Q&A | About | Cast/crew | Related list/map |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Interstellar | 1,287 | 349 | 248 | 65 | 85 | 398 |
| Inception | 1,315 | 367 | 258 | 79 | 95 | 373 |
| The Dark Knight | 1,342 | 364 | 259 | 99 | 81 | 377 |
| Parasite | 1,307 | 365 | 256 | 56 | 88 | 396 |
| Reacher | 1,223 | 318 | 166 | 65 | 93 | 344 |

Fingerprint and Q&A together account for about **40–48%** of main text in this small sample; they contain GoodWatch-specific interpretation mixed with shared facts and template wording. About plus cast/crew account for about **11–14%**, and related lists/map text about **28–31%**. These are section shares, not a claim that the remaining words are unique. For example, the Interstellar overview matches TMDB and Letterboxd, while its fingerprint and selected neighbors supply a different discovery tool. [TMDB's first-party synopsis](https://www.themoviedb.org/company/9996-syncopy/movie), [Letterboxd title page](https://letterboxd.com/film/interstellar/).

The older [Q&A proposal](title-qa-proposal.md) measured 14–16 questions. It must not be treated as the current output: the live pages now show selected questions, including sequel and box-office facts. Repeating that work is not the recommendation.

The remaining question is whether a stranger finds this analysis credible, useful and different enough from established alternatives. For the pilot:

1. Explain two or three specific recommendation choices in plain text, with the relevant shared traits and a meaningful difference. A list of 64 names alone does not explain a recommendation.
2. Make analysis provenance and limitations easy to find; distinguish inferred traits from sourced facts. Verify title-specific claims and availability before amplifying them. The Interstellar main narrative calls it an easy watch in one craft summary, while its attention summary/Q&A says it is demanding; review that ambiguity rather than add more words.
3. Tie the title's value to a concrete viewing decision: the kind of evening it fits, its attention demand, and why a specific alternative fits differently. Use the current fingerprint rather than paraphrase TMDB.
4. Preserve shared metadata that helps users. Google publishes no required unique-text percentage or minimum word count. Do not replace useful facts with filler.

These are proposed tests, not a claim that Google has assigned the site a thin-content penalty. [Google's helpful-content questions](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) focus on original analysis and additional value relative to other results.

### Competitors for the same title

Public search and first-party pages show the following distinctions. Visibility in this research search tool is not an authenticated Google index check, and these features do not prove why an engine indexes a competitor.

| Site | Additional value observed beyond common metadata | Lesson for GoodWatch |
| --- | --- | --- |
| [JustWatch](https://www.justwatch.com/us/movie/interstellar) | Country-specific offers and prices, a stated offer-check time, a free-option answer, original synopsis and daily streaming-chart movement. | Answer the viewing task precisely and make freshness/provenance visible. |
| [Letterboxd](https://letterboxd.com/film/interstellar/) | Original public reviews, audience activity and fans alongside the same familiar synopsis. | A shared synopsis can coexist with distinctive value; rewording it is not the main objective. |
| [TV Time](https://www.tvtime.com/movie/bc1542c4-e72f-4dd4-bb80-2d89bd6c6199) | Public community counts, including roughly 2.2 million adds and 2,269 comments in the checked view. | Community content can differentiate a catalog. The initial HTML of its comments was not verified. |
| [SIMKL](https://simkl.com/movies/250822/interstellar) | Its own votes/rank, watch/drop statistics and reviews alongside the same synopsis. | A smaller catalog competitor can add specific decision signals instead of only repeat source data. |
| [Reelgood](https://reelgood.com/movie/interstellar-2014) | Its first-party [Interstellar article](https://blog.reelgood.com/where-to-watch-interstellar) is publicly findable and explains streaming options. | The title fetch returned 403 and its current index status was not verified. Do not assume every established competitor's title is indexed; do not treat its older article's offers as current. |

## Site-level signals and history

The registry's public [RDAP record](https://pubapi.registry.google/rdap/domain/goodwatch.app) reports registration on **2023-11-22**, about 2 years 11 months before this check. The [Wayback CDX listing](https://web.archive.org/cdx/search/cdx?url=goodwatch.app%2F&output=json&filter=statuscode%3A200&collapse=timestamp%3A4&fl=timestamp%2Coriginal%2Cstatuscode&filter=mimetype%3Atext%2Fhtml&limit=20) includes a December 1, 2023 snapshot. That [snapshot](https://web.archive.org/web/20231201181414id_/https://goodwatch.app/) is already the GoodWatch movie/show discovery product. This weakens a “brand-new domain waiting to age” explanation. It does not prove an entirely clean domain history.

The Google history in [#347](https://github.com/alp82/goodwatch-monorepo/issues/347) records about 1,100 title pages shown in early December 2025, then a near-total drop on December 16. This is inconsistent with a domain Google has never been able to crawl. The dated Search Console exports establish the prolonged start-page-only pattern; they do not identify a specific algorithm update as its cause.

### Referring domains: measured lower bound, unknown total

Free checks were attempted. Ahrefs' [free backlink checker](https://ahrefs.com/backlink-checker/?input=goodwatch.app&mode=subdomains) returned its tool/marketing shell with no target-specific count in the fetched HTML. The attempted OpenLinkProfiler report URL returned 404. Public search was used to find candidate referrers, then their actual HTML anchors were checked.

**At least three distinct referring domains were directly verified**, which is a lower bound, not an Ahrefs/Bing total or a measure of earned editorial authority:

| Referring domain and public page | Observed destination and link attributes |
| --- | --- |
| [GitHub repository](https://github.com/alp82/goodwatch-monorepo) | Links to GoodWatch's start and product pages; `nofollow`. This is the project's own repository. |
| [INITE Atlas](https://inite.ai/en/atlas/goodwatch.app) | Start-page links with `noopener noreferrer`; an About link additionally has `nofollow`. |
| [Mybzz](https://mybzz.com/brands/goodwatch) | Links to `/use-with-ai` with `nofollow noopener`. |

The homepage inspection also returns historical referring URLs on `founder.page`, `reddit.com` and `dev-art.vercel.app`. These are positive evidence that Google has found outside routes to the site. Their current links were not live-verified, and the full paths are omitted. This evidence weakens any claim that GoodWatch has no external recognition; low crawl demand is measured, while its cause remains a hypothesis.

The [existing link event log](https://github.com/alp82/goodwatch-monorepo/issues/667) records directory submissions, not proof that all links are published or crawled. Continue that approved plan, favor relevant independent coverage and useful deep links, and verify publication before counting it. Do not restart submissions, buy links, add badges, or revive the parked study.

**Owner action:** run the free Ahrefs checker interactively for the domain and record total referring domains, followed referring domains, date and example pages. Also open Search Console → **Links → External links → Top linking sites → More → Export**. That report is partial too. Neither a small count nor a third-party DR score diagnoses a Google penalty, and Google publishes no minimum referring-domain requirement. [Google crawling/indexing FAQ](https://developers.google.com/search/help/crawling-index-faq).

### Exact owner screens to check

The owner checked the first two screens on October 11 and found nothing. Refresh them because the API cannot establish their current status.

1. **Search Console → sc-domain:goodwatch.app → Security & Manual Actions → Manual actions.** Record “No issues detected” or the exact issue, scope and date. If present, follow its remediation and review procedure.
2. **Security & Manual Actions → Security issues.** Record status, affected patterns and example URLs. An absent issue here is not the same as a manual-action result.
3. **Removals → Temporary removals.** Check for active requests matching `/`, `/movie/`, `/show/`, category prefixes or the whole host. Record scope and expiry; do not cancel anything during this research.
4. **Indexing → Pages**, for **All known pages** and **All submitted pages**. Export counts and examples for Crawled - currently not indexed, Discovered - currently not indexed, Server error (5xx), Soft 404, robots/noindex exclusions and canonical alternatives. Compare October 11 with today; separate legacy URLs, XML and parameter variants from clean pages.
5. **Settings → Crawling → Crawl stats → Open report.** Inspect host status and DNS/server/robots availability, responses 5xx/429, HTML, Smartphone/Desktop, discovery versus refresh, and examples around deployments. Export the longest range. Pair with **Indexing → Sitemaps** for child status, last-read times and discovered counts.

For two excluded shows and two unknown movies, also use **URL Inspection → Test live URL → View tested page → HTML / Screenshot / More info**. Check actual fetched HTML, response/resource failures and indexing allowed. Save the dates alongside indexed-version results. A successful live test is eligibility evidence, not a prediction of inclusion.

## Crawl scope: sitemap cohort versus discoverable URLs

The live master at [the advertised sitemap URL](https://goodwatch.app/sitemaps/sitemap.xml) now lists seven children, with **1,435 distinct page URLs**:

| Child | URLs |
| --- | ---: |
| `sitemap_movie_detail_0.xml` | 700 |
| `sitemap_show_detail_0.xml` | 300 |
| `sitemap_people.xml` | 30 |
| `sitemap_categories.xml` | 87 |
| `sitemap_static.xml` | 15 |
| `sitemap_profiles.xml` | 3 |
| `sitemap_new.xml` | 300 |

The last two children and four additional static entries explain the difference from the original 1,128-URL plan. This reports scope, not whether another approved thread added them. No individual profile paths are reproduced. Three additional live checks of `/new/us/netflix`, `/new/de/netflix` and `/new/ad/netflix` returned 200, `index, follow` and separate self canonicals. Their introductions reported 109, 90 and 109 titles respectively; the leading titles differed. Country pages are therefore additional indexable scope, not proven duplicates from this sample.

The October 27 Sitemaps API returned the following submitted records. All have zero errors and warnings. The API's `contents.indexed` field is deprecated and its zeros must **not** be interpreted as current index counts. [Sitemaps API field definitions](https://developers.google.com/webmaster-tools/v1/sitemaps).

| File under `/sitemaps/` | Last submitted (UTC) | Last downloaded (UTC) | Reported submitted URLs |
| --- | --- | --- | ---: |
| `sitemap.xml` | 2026-10-10 13:07:13.410 | 2026-10-10 13:07:14.552 | — |
| `sitemap_static.xml` | 2026-10-18 10:20:52.719 | 2026-10-18 10:20:53.792 | 11 |
| `sitemap_categories.xml` | 2026-10-18 10:20:59.889 | 2026-10-18 10:21:01.527 | 87 |
| `sitemap_movie_detail_0.xml` | 2026-10-18 10:21:06.224 | 2026-10-18 10:21:07.012 | 700 |
| `sitemap_show_detail_0.xml` | 2026-10-18 10:21:12.617 | 2026-10-18 10:21:13.228 | 300 |
| `sitemap_people.xml` | 2026-10-18 10:21:19.614 | 2026-10-23 17:45:03.767 | 30 |
| `sitemap_new.xml` | 2026-10-25 23:40:34.801 | 2026-10-25 23:40:36.229 | 300 |

The new-arrivals child was separately submitted and downloaded October 25. `sitemap_profiles.xml` is linked by the live master but has no separate row in this list; that absence does not prove Google failed to discover it through the master. The static child reports 11 URLs from its October 18 read, while it now serves 15. Check current child discovery counts and whether a genuinely changed file needs attention; do not describe all current sitemap content as read on October 18.

The 1,000 preferred titles remain bounded in XML, but XML is a discovery hint, not a whitelist. Normal links make other titles, cast members and paginated categories discoverable. The [completed internal-link audit](internal-links-proposal.md) had already measured 2,153 reachable URLs at depth two and 23,758 at depth three in its partial graph. Do not repeat that 1,500-request crawl or treat its older totals as today's exact graph size.

This check extracted links from 22 representative Googlebot requests, resolving relative links and removing fragments. The union contains **1,449 internal URLs**, including **1,062 title URLs and 234 person URLs**. Of these, **424 titles and 204 people are outside every current sitemap**. This is a lower bound from a biased sample, not a full-site count; it includes query URLs. URLs are deduplicated, while legacy paths can still resolve to an already-counted canonical destination. Discover parameter links are already restricted by robots.txt.

A separate check of all current best-list pages found **all 700 movie and 300 show cohort URLs** as plain links on `/movies/best` pages 1–3 and `/shows/best` pages 1–2. Later pages return 200 with a self canonical including `?page=N`. The completed lists resolve the main cohort-linking gap. Do not remove useful cast/related links indiscriminately; first measure what verified Googlebot actually spends time fetching.

The historical rate of 1.4 page requests/day would need roughly **714 days** merely to fetch 1,000 titles once, or **1,025 days** for 1,435 URLs, assuming no recrawls. This arithmetic illustrates how low the old rate was; it is not a forecast or a fixed crawl allocation. The old 21 total requests/day included many scripts and images and is not 21 new pages/day.

Google's advanced crawl-budget guidance mainly concerns very large or frequently changing sites, though low demand and availability trouble can affect small sites. GoodWatch does not need an enterprise crawl-budget program. It needs reliable document fetches, bounded useful expansion and enough demand for the preferred pages. There is no evidence that removing folders, changing slug depth or hiding all noncohort pages would by itself create that demand. [Google crawl-budget guidance](https://developers.google.com/crawling/docs/crawl-budget).

## Bing, Yandex, IndexNow and paid indexing services

### What is known about Bing

The literal public [Bing site search](https://www.bing.com/search?q=site%3Agoodwatch.app) was attempted, as were the quoted-domain query and RSS response. The returned result bodies contained unrelated domains despite the correct query title. Another web-fetch attempt could not open the search page. **These responses are unusable for deciding whether GoodWatch is in Bing's index.** There is no defensible positive or negative Bing index count from this run. The generic research search returned some GoodWatch product pages, but its provider cannot be assumed to be Google or Bing.

No public equivalent of the owner's Bing Webmaster Tools index status was found. A crawler's ability to fetch a page does not establish Bing indexing.

**Owner action:** open **Bing Webmaster Tools → goodwatch.app → URL Inspection → Index** for the start page, `/shows/best`, Interstellar and Reacher. Record discovery/crawl/index dates and any exclusion reason; use **Live URL** for fetch problems. Open **Site Explorer** for Indexed, Excluded, Warning and Error counts, and **Sitemaps** for read status. In Yandex Webmaster, inspect the corresponding site's **Indexing → Searchable pages** and sitemap diagnostics if the owner already uses it. Do not create or change accounts as part of this research. [Bing URL Inspection](https://www.bing.com/webmasters/help/URL-Inspection-55a30305), [Bing Site Explorer](https://www.bing.com/webmasters/help/site-explorer-c680da37), [Yandex indexing documentation](https://yandex.com/support/webmaster/en/service/searchable).

### Is IndexNow worth adding?

**Yes, as a small optional Bing/Yandex discovery improvement after the Google diagnosis.** IndexNow is free and its current participant list includes Bing and Yandex. Google is not listed. Sending to one participating endpoint shares notifications with participants; separate paid submissions are unnecessary. Acceptance of a notification does not force crawling, indexing or ranking. [IndexNow FAQ](https://www.indexnow.org/faq).

Proposed code work, about half to one day:

1. Host the protocol verification key file on the canonical host. It is a public ownership token, not a private API credential.
2. Send canonical eligible URLs on meaningful addition, update or deletion. Deduplicate and batch; the protocol permits up to 10,000 URLs per request. Start with the preferred cohort and explicitly approved new pages.
3. Exclude private/noindex pages and blocked filters; submit canonical URLs rather than redirect or tracking variants for new/updated content. Notify formerly canonical URLs when they move or are deleted: IndexNow also supports 301/302 and 404/410 changes. Retry transient failures with bounds and retain counts/statuses for checking.
4. Keep sitemaps and quality checks. Check Bing's inspection/index reports after notifications; do not resubmit unchanged pages daily.

No IndexNow notification was sent in this research. The proposal should not be sold as a Google fix. [Protocol](https://www.indexnow.org/), [Bing URL submission guidance](https://www.bing.com/webmasters/help/URL-Submission-62f2860b).

### Are paid index rushers worth it?

**No purchase recommended for GoodWatch.** The tweet offers a submission tool where the evidence calls for diagnosis. A vendor might make discovery easier, but no result here establishes that submission is the missing step: Google read the original sitemaps and crawled several requested pages without indexing them.

Google states that it does not accept payment to crawl more often or rank higher. Its public Indexing API supports pages with JobPosting or BroadcastEvent embedded in VideoObject; an ordinary movie/show catalog entry does not qualify just because it describes a video. Free Search Console, sitemaps and IndexNow cover the appropriate notification mechanisms. Require a vendor to distinguish a submitted URL, an accepted API request, a crawl and retained indexing before evaluating any claim. No vendor-specific trial or outcome audit was performed. [How Google Search works](https://developers.google.com/search/docs/fundamentals/how-search-works), [Indexing API scope](https://developers.google.com/search/apis/indexing-api/v3/using-api).

## Measurement and follow-up

Keep the existing fixed 50-URL weekly job and the approved gate in [#354](https://github.com/alp82/goodwatch-monorepo/issues/354). The original four-run observation dates lead through November 7; the new title cohort was published October 18 and later additions need their own exposure dates. Do not silently restart or pass the gate because a live fetch works.

For the separate 30-URL request cohort, record weekly state, last crawl, canonical pair, returned sitemap associations and current XML membership. Add fresh UI crawl/error exports and a dated meaningful-change log. Evaluate these groups independently:

- **Unknown:** improve/verify discovery and crawl demand; a content experiment has not yet been observed by Google.
- **Crawled with failure or wrong output:** repair availability, access or rendering and verify a fresh successful crawl.
- **Successfully crawled, self canonical, excluded:** investigate additional value and intent overlap; request indexing only after a material change.
- **Indexed:** measure impressions and actual visits, then whether indexing persists. Do not equate an isolated successful inspection with useful search traffic.

The smartphone user agent was `Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)`. Reproduce with `curl -L -A '<that user agent>' -D headers.txt https://goodwatch.app/<path>` and parse HTML without executing scripts. The existing `goodwatch-webapp/scripts/gsc.py inspect <full-url>` returns all inspection fields, including `sitemap` and `referringUrls`; do not run the weekly writer merely to obtain a read-only ad hoc result. Credentials were read through the existing client from the main checkout and were never printed or copied into the repository.

## Questions to route to the owner

- Can the owner provide current Pages/Crawl Stats exports and the dated status of Manual actions, Security issues and Temporary removals?
- Can verified Googlebot access-log summaries identify document 5xx/429, connection failures and discovery requests during October 10–27, especially deploy/restart windows?
- What do Bing's authenticated Index card and Site Explorer report for the four specified controls, and what target-specific referring-domain counts does the interactive free checker show?
- Should the preferred indexing experiment explicitly include the 300 new country/service pages and public profiles, or should further expansion wait for the existing gate?
- At the gate, which five already-crawled pages should receive the value/accuracy pilot, and which five should remain unchanged for comparison?

## Limits

This research did not change app code, account settings, indexing requests, DNS or infrastructure. No deploy, push, paid service or outreach was performed. It did not authenticate as real Googlebot, test from multiple network countries, load-test production, inspect private server logs, or refresh the owner-only reports. The API cannot explain Google's quality decision. Referring domains are a verified lower bound, and Bing's current index status remains unverified. The report preserves those gaps instead of substituting a search-result count or a successful HTTP request for index evidence.
