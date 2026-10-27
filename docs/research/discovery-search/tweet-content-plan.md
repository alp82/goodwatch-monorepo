# GoodWatch content and page plan

Research date: 2026-10-27. Scope: the tweet's Analytics and Blog sections, plus positions 8–20, low click-through rates, content refreshes and competing thin pages. This is a proposal, not an implementation or publication record.

## Recommendation

Improve five existing list URLs, then test two additional landing pages and five posts in stages: **12 content destinations, only seven new URLs**. Do not generate a genre × service × country catalogue. Use Search Console and the existing PostHog baseline; spend nothing on analytics subscriptions now. Publish one owner-edited post every two weeks at most, with one original data post per month at most.

The constraint is indexing. The 2026-10-24 fixed sample has **1 of 50 URLs indexed**, five crawled but not indexed and 44 unknown. That is a sample, not a census of the whole site. The traffic record has 230 impressions and nine clicks for October 15–21, all on the start page. More copy does not guarantee indexing. Preserve the [indexing gate, #354](https://github.com/alp82/goodwatch-monorepo/issues/354) and its four-to-six-week observation window; prepare briefs now, and release new discovery pages only after that review. [Index CSV](index-record.csv), [traffic CSV](index-record-traffic.csv), [map #347](https://github.com/alp82/goodwatch-monorepo/issues/347).

### Ranked actions

Rank reflects likely value for getting useful pages indexed and visited per owner hour, not a traffic forecast.

| Rank | Verdict | Action and work type | Effort | Expected effect |
| --- | --- | --- | --- | --- |
| 1 | Applies | Give existing hubs and lists separate query ownership; improve the science-fiction, Netflix and mind-bending lists instead of adding clones. **Content work + code work** | 1–2 days for the first three lists; mood selection may need the separate #357 work | Better answers and fewer interchangeable destinations; strongest immediate content experiment, with no URL growth |
| 2 | Applies | Run a weekly query × page review alongside the existing index record. **Owner work** | 20–30 minutes/week | Distinguishes brand visibility, sitelinks, genuine discovery queries and indexing failure before spending time on articles |
| 3 | Applies | Draft one original ratings explainer and one season-ratings article, with real examples, screenshots and methodology. **Content work + owner work** | 4–6 hours for the explainer; 1–2 days for the first data article | Adds information beyond generic catalogue summaries and gives useful internal links to title pages |
| 4 | Applies | Trial one country-specific Netflix science-fiction list and one honest JustWatch alternatives page after the gate. **Code work + content work** | 1–2 days shared list work, plus 5–7 hours for alternatives | Tests service/genre intent and app-selection intent without creating thousands of pages |
| 5 | Applies | Use a fortnightly Fable draft → owner edit routine; review outcomes before commissioning the next batch. **Content work + owner work** | 2–3 hours/week average; data weeks cost more | Makes publication sustainable and keeps evidence and voice under owner control |

## What already exists

Read against `origin/main` at `2acc43ba4`, including the discovery-search reports, their backlink channel files, the [listings kit](../../launch/listings-kit.md), and the bodies and comments of [#347–#359](https://github.com/alp82/goodwatch-monorepo/issues/347) and [#667](https://github.com/alp82/goodwatch-monorepo/issues/667). Older recommendations in those reports are not fresh work orders: #667's October 21 decision parks the streaming study; the current task authorizes a content proposal, not reversing that decision or the indexing gate.

- `/movies/best` and `/shows/best` already provide ranked lists. They use the sitemap cohort, not the complete catalogue: 700 movies and 300 shows, ordered by GoodWatch score with vote-count tie-breaks. Their primary role also includes linking the cohort. Do not create a second all-time list in the blog. [List rules](../../../goodwatch-webapp/app/domain/best-lists.ts), [route](../../../goodwatch-webapp/app/routes/$type.best.tsx).
- Genre, mood and streaming-service pages already exist. H1s and intros, breadcrumbs, thin-account-page noindex rules and the bounded sitemap are finished work. The old audit's invalid cross-media categories are fixed: both `/movies/genres/talk` and `/shows/genres/action` returned 404 in this check.
- There is **one blog entry**, not a separate general draft plus a separate study: `streaming-by-country-2026`, titled “Spirited Away has a better passport than you”. Its manifest has `draft: true`. The text covers Ghibli licensing, country library sizes, one-subscription coverage and Netflix's country differences, with an October 18 snapshot of 4,683 movies and 717 shows across 139 countries. None of the five proposed posts below repeats that subject. [Manifest](../../../goodwatch-webapp/app/content/blog/posts.json), [draft](../../../goodwatch-webapp/app/content/blog/streaming-by-country-2026/post.mdx), [draft sources](../../../goodwatch-webapp/app/content/blog/streaming-by-country-2026/sources.md).
- Live read-only checks confirmed `/blog` is `noindex, follow` and the parked draft is `noindex, nofollow`. Both return 200. A real public post must use the blog's published state; do not promote the parked draft as a prerequisite for this plan.
- The requested external house-voice example was absent at its supplied local path. The existing MDX draft illustrates the short paragraphs and sourced running joke. The stated rule remains authoritative: **Fable drafts in the house voice; the owner edits before publishing**. This report does not draft the posts or substitute another model for Fable.

The live checks were unauthenticated HTTP GETs with a Googlebot user-agent, not verified Googlebot fetches or rendered-browser inspections. The five existing list URLs in the ranked table returned 200 with one self canonical, one H1 and `index, follow`.

## Analytics

### Which tools are worth using

Prices are the vendors' public USD monthly prices checked on October 27, before tax. No account was connected, subscription started or external configuration changed.

| Tool | Verdict for GoodWatch | What it answers and what to do |
| --- | --- | --- |
| Search Console | **Already done** | Keep as the source for Google impressions, clicks, average position and index evidence. Existing read-only client and weekly fixed sample are enough for this experiment. Query data is about GoodWatch's exposure, not total market search volume. |
| Ahrefs Free / Webmaster Tools | **Applies, optional owner work** | Useful second view of backlinks and a bounded site audit. Verified sites get 5,000 crawl credits/month/project and up to 1,000 visible backlinks/keywords. It cannot tell why Google declined a page. If wanted, verify the property and audit only the cohort, rather than every filter URL. No setup performed. [Official limits](https://ahrefs.com/webmaster-tools). |
| Ahrefs Starter | **Doesn't apply now** | $29/month; Lite is $129. Competitor and keyword research can help later, but map #347 explicitly uses no paid services or rank trackers. Keep it out of this phase. Reconsider one predefined research month only if the owner changes that rule. [Starter details](https://help.ahrefs.com/en/articles/9419051-about-ahrefs-starter-plan). |
| SEOgets | **Doesn't apply as a paid tool now** | $49/month for one core site; free connected sites are available. Query clusters, decay and opportunity views save analysis time once enough pages have traffic. The $4/month Super Site add-on offers extended storage/index reports. Today's weekly API record already covers the decision. A GSC dashboard cannot establish orphan URLs from zero-impression pages alone; retain the existing link-graph work. Free interface is optional, not a required account connection. [Official pricing](https://seogets.com/pricing). |
| DataFast | **Doesn't apply now** | Starts at $9/month for 10,000 events; a 14-day trial is offered. Its strength is traffic-to-revenue attribution. It does not diagnose Google indexing and adds another client script while PostHog and search-landing queries already exist. Revisit only for a concrete conversion-attribution gap. [Official product and pricing](https://datafa.st/). |
| Existing PostHog | **Already done** | Use the saved baseline to see whether search visitors interact after landing; don't count impressions as successful discovery. No new query or configuration was needed here. [Baseline resolution, #348](https://github.com/alp82/goodwatch-monorepo/issues/348), [saved queries](posthog-baseline-queries.sql). |
| Google autocomplete and Trends | **Applies, free research** | Validate wording and seasonality before each brief. Autocomplete isn't a volume tool. Trends is a relative 0–100 index; no numeric Trends series was retrieved in this run. See demand evidence below. |
| Ahrefs free Keyword Generator | **Owner action, optional** | Enter the shortlisted exact phrases, choose United States and Google, and record the displayed estimate, date and country beside each brief. No estimate was retrieved from its interactive form, so none is invented here. This does not require buying Starter. [Tool](https://ahrefs.com/keyword-generator). |
| Bing Webmaster Tools | **Applies as an optional free alternative** | Keyword Research offers query volumes and related questions for Bing. Label them **Bing** volumes, not Google volumes. Use only if an existing owner login is convenient; do not add account setup to the critical path. [Official tool description](https://www.bing.com/webmasters/help/keyword-research-628070b6). |

### Three-month Search Console query report

Read-only Search Analytics requests used `sc-domain:goodwatch.app`, Web search, all countries/devices, `dataState: final`, **2026-07-24 through 2026-10-24 inclusive**, ending three days before the research date to allow reporting delay. This is a rolling three-calendar-month window, not July–September or a 90-day approximation. Dates in this API use Pacific Time.

The existing client loaded its credential from the main checkout; no secret values were printed or copied. Six Search Analytics calls retrieved query, query × page, date, page and page × date data plus a terminal-page check; **zero URL Inspection calls** were used. The primary request was:

```json
{
  "startDate": "2026-07-24",
  "endDate": "2026-10-24",
  "type": "web",
  "dataState": "final",
  "dimensions": ["query"],
  "rowLimit": 25000,
  "startRow": 0
}
```

All **39 returned query rows** appear below, ordered by impressions. A request starting at row 25,000 returned no rows. Position is the API's average position, rounded to two decimals, not a checked current rank. The API exposes top rows and omits anonymized queries: this is every query returned, **not every search made**. The daily/property series totals **2,896 impressions and 119 clicks**, versus **2,500 impressions and 99 clicks** represented by named queries. Do not assign the remaining 396 impressions or 20 clicks to keywords. [API reference](https://developers.google.com/webmaster-tools/v1/searchanalytics/query), [privacy and aggregation limits](https://developers.google.com/search/blog/2022/10/performance-data-deep-dive).

| Query | Impressions | Average position | Clicks | CTR |
| --- | ---: | ---: | ---: | ---: |
| `goodwatch` | 1,077 | 7.00 | 26 | 2.41% |
| `goodwatch app` | 988 | 5.03 | 67 | 6.78% |
| `good watch app` | 110 | 5.56 | 2 | 1.82% |
| `site:goodwatch.app` | 102 | 1.00 | 0 | 0.00% |
| `goodwatch tv` | 77 | 8.18 | 1 | 1.30% |
| `goodwatch streaming` | 31 | 4.77 | 2 | 6.45% |
| `watch good` | 27 | 62.30 | 0 | 0.00% |
| `goodwatch tv app` | 23 | 7.65 | 0 | 0.00% |
| `watchgood` | 13 | 65.23 | 0 | 0.00% |
| `agoodmovietowatch` | 8 | 53.75 | 0 | 0.00% |
| `go watch` | 6 | 65.83 | 0 | 0.00% |
| `dorawatch` | 3 | 54.67 | 0 | 0.00% |
| `good tv to watch` | 3 | 1.00 | 0 | 0.00% |
| `go to watch` | 2 | 93.00 | 0 | 0.00% |
| `good watch` | 2 | 1.00 | 0 | 0.00% |
| `goodwatch tv cost` | 2 | 6.00 | 0 | 0.00% |
| `goodwatch.com` | 2 | 49.00 | 0 | 0.00% |
| `watch for good` | 2 | 62.00 | 0 | 0.00% |
| `what is goodwatch` | 2 | 2.00 | 0 | 0.00% |
| `anything else` | 1 | 5.00 | 0 | 0.00% |
| `dorawacth` | 1 | 54.00 | 0 | 0.00% |
| `free and no sign up` | 1 | 9.00 | 0 | 0.00% |
| `free login to` | 1 | 1.00 | 0 | 0.00% |
| `free of accounts to use` | 1 | 1.00 | 0 | 0.00% |
| `good view watch` | 1 | 98.00 | 0 | 0.00% |
| `good watch tv` | 1 | 1.00 | 1 | 100.00% |
| `goodshows app` | 1 | 66.00 | 0 | 0.00% |
| `goodwatch kids` | 1 | 11.00 | 0 | 0.00% |
| `goodwatch login` | 1 | 21.00 | 0 | 0.00% |
| `goodwatch tv reviews` | 1 | 29.00 | 0 | 0.00% |
| `goodwatch tv subscription` | 1 | 1.00 | 0 | 0.00% |
| `gustwatch` | 1 | 92.00 | 0 | 0.00% |
| `ieskokit gudrucio` | 1 | 72.00 | 0 | 0.00% |
| `metacritic alternative` | 1 | 2.00 | 0 | 0.00% |
| `nice to watch` | 1 | 85.00 | 0 | 0.00% |
| `no account sign up` | 1 | 2.00 | 0 | 0.00% |
| `review` | 1 | 1.00 | 0 | 0.00% |
| `the good app` | 1 | 62.00 | 0 | 0.00% |
| `tv` | 1 | 6.00 | 0 | 0.00% |

### What the queries show

1. **Named-query clicks are entirely branded.** All 99 come from six GoodWatch name variants. The broader brand set, including brand modifiers, has 2,419 of the 2,500 named-query impressions. No visible query validates demand for a genre, streaming list or blog topic yet. “Metacritic alternative” has one impression at average position 2; it is a lead to investigate, not enough evidence to prioritize a page.
2. **There is one plausible position 8–20 lead:** `goodwatch tv`, 77 impressions, one click, average position 8.18. The other rows in that band are `free and no sign up` and `goodwatch kids`, with one impression each. All three map to `/`; these are not three underperforming articles. Check whether `goodwatch tv` refers to another product before changing the home page for it. Do not imply that GoodWatch plays free movies or sells a TV subscription.
3. **Low CTR mostly concerns the brand.** `goodwatch` has 1,077 impressions, 26 clicks and 2.41% CTR; `goodwatch app` has 988, 67 and 6.78%. `goodwatch tv app` has 23 impressions and no clicks. Clarify the existing start-page description only if a clean search check confirms wrong expectations. Don't insert every variant into H1s. The 102 `site:goodwatch.app` impressions are diagnostic searches, not a consumer content opportunity; their origin cannot be identified from GSC.
4. **Historical sitelinks are not present-day indexing success.** The page report has eight impressions each for `/discover`, `/movies`, `/shows` and `/taste`, all zero clicks. Their page × date rows are identical on eight dates from July 28 to September 14; query × page has one `goodwatch app` row for each. This matches the map's historical sitelink account. It is not evidence of independent current category rankings or keyword cannibalization. The start page has all 119 clicks and 2,895 page-level impressions. A www start-page row has one impression. Page sums differ from property totals because several links can appear in one result.
5. **There is no demonstrated article decay.** August 30–September 26 had 339 property impressions and 17 clicks; September 27–October 24 had 810 and 29. July 24–31 had 678 impressions and 48 clicks, August 1,090/26, September 396/18 and October 1–24 732/27. Partial months and brand mix prevent a content-quality conclusion. There are no blog query rows, and all clicks belong to `/`.

### Weekly review

Spend 20–30 minutes once a week. Use final data ending three days earlier. Compare the last 28 days with the previous 28 and retain the three-month view for context.

- Read the fixed index record first. If a URL is unknown or unindexed, treat that as the issue; rewriting its snippet cannot fix a CTR problem it does not yet have.
- Export query × page. Separate brand variants and `site:` queries from discovery queries. Review positions 8–20 and low CTR only for the correct intent, country and device. Use 50 impressions/28 days as a practical review threshold, not a statistical significance test; expand the window when fewer are available.
- For an eligible URL, inspect the current result format and make one useful change: a precise title/H1, a missing decision section, corrected availability or better selection. Preserve truthful wording. Record the deployment date; assess after another 28 days rather than reacting to one click.
- Review click declines only on pages with a real prior baseline. Refresh facts and screenshots when they changed. Do not change a date just to make an article look fresh.
- Check whether two URLs repeatedly serve the same query and intent. Inspect their content before merging. The current report provides no such measurable content-page pair.

## Demand and search-result evidence

The research uses English queries with a **US first-market assumption**. This is a proposal, not a decision to exclude Germany. German pages still belong to the separate [#358 review](https://github.com/alp82/goodwatch-monorepo/issues/358).

No reliable monthly Google search volumes were obtained. Direct Google autocomplete is the available free numeric evidence below. Each number is **the count of returned predictions, capped at ten**, never searches per month, and cannot be used to compare keyword popularity. “Broad”, “narrower” and the rankings below are editorial estimates from intent breadth and observed competing formats, not measured demand bands. Google Trends returned HTTP 429; no Trends score or zero-volume conclusion is reported. Free Keyword Generator's interactive form was not completed.

The first-party [Google explanation](https://support.google.com/trends/answer/4365533?hl=en) says autocomplete is filtered and Trends normalizes sampled interest to 0–100. Neither supplies absolute monthly demand. The source for each count is the linked read-only autocomplete response checked on October 27 with `client=firefox`, `hl=en`, `gl=us`. Results can change.

| ID | Seed / demand evidence | Returned predictions and wording observed |
| --- | --- | --- |
| A1 | [Best sci fi movies](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=best%20sci%20fi%20movies) | 10; exact seed, “of all time”, “streaming”, “on netflix” |
| A2 | [Best mind bending movies](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=best%20mind%20bending%20movies) | 10; exact seed, “streaming”, “on netflix” |
| A3 | [Best movies on Netflix](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=best%20movies%20on%20netflix) | 10; exact seed, “right now”, “with family” |
| A4 | [Best TV shows of all time](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=best%20tv%20shows%20of%20all%20time) | 10; exact seed, “ranked”, “imdb” |
| A5 | [Best sci fi movies on Netflix](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=best%20sci%20fi%20movies%20on%20netflix) | 10; exact seed, “now”, “rotten tomatoes”; no numeric US-only volume |
| A6 | [JustWatch alternatives](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=justwatch%20alternatives) | 3; exact seed and “reddit” |
| A7 | [IMDb vs Rotten Tomatoes vs Metacritic](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=imdb%20vs%20rotten%20tomatoes%20vs%20metacritic) | 7; exact seed; shorter “imdb vs rotten tomatoes” returns 10 |
| A8 | [Best TV show seasons](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=best%20tv%20show%20seasons) | 10; exact seed, “ranked”, “imdb”; “best tv shows by season rating” returns 8 related predictions, not the exact seed |
| A9 | [TV shows that get better](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=tv%20shows%20that%20get%20better) | 10; includes “each season” and “over time” |
| A10 | [How to track TV shows](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=how%20to%20track%20tv%20shows) | 10; exact seed and “watched”; exact “how to track shows across streaming services” returns 0 predictions, not proof of zero demand |
| A11 | [Movies like](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=movies%20like) | 10; title-specific queries include Interstellar and Shutter Island. This is indirect evidence only for a generic how-to |
| A12 | [Letterboxd vs GoodWatch](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=letterboxd%20vs%20goodwatch) | 0; demand unknown. “Letterboxd vs IMDb” returns 10 including the exact seed |
| A13 | [Best movies of all time](https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=best%20movies%20of%20all%20time) | 10; exact seed, “imdb”, “rotten tomatoes”, “to stream” |

### Map the four page types

These are pages surfaced by the public search tool on October 27, **not a location-controlled Google top-five export or exact ranking order**. Links point to the competing publishers themselves. Before writing each brief, repeat the exact query in a clean Google session for the intended country and record the first five organic results, format and obvious missing sections. Do not claim to have beaten five results that were not inspected.

| Type | Example keywords and rough demand | Who appears now / format | GoodWatch's evidence and advantage | Build decision |
| --- | --- | --- | --- | --- |
| Best X | “best sci-fi movies on Netflix”, “best sci fi movies”, “best mind bending movies”, “best TV show seasons” — autocomplete A1/A2/A5/A8; established wording, volume unknown. Broad Netflix terms are likely harder than the narrower intersections; this is inference. | [Netflix Tudum](https://www.netflix.com/tudum/articles/sci-fi-movies), [Netflix genre hub](https://www.netflix.com/browse/genre/1492), [BestNetflix](https://bestnetflix.com/streaming/netflix/science-fiction), [CompareTV Australia](https://www.comparetv.com.au/streaming-tv-guide/best-sci-fi-movies-netflix-australia/): descriptive shortlists, data rankings and country lists. General Netflix: [Rotten Tomatoes](https://editorial.rottentomatoes.com/guide/best-netflix-movies-to-watch-right-now/), [TV Guide](https://www.tvguide.com/news/best-movies-on-netflix/). Season lists: [Season-o-meter](https://seasonometer.com/lists/best-over-time/). | Multi-source scores + vote counts + title analysis + correct country/offer type in one decision table. Season/episode trajectories add more than a whole-show score. Availability and rating data are licensed/shared inputs, not exclusive GoodWatch observations; the selection, combination and explanations are its contribution. Competitors already sort by score. | Generate eligible rows, scores and availability; write selection rules and short reasons. Improve existing leaves first. One service/genre/country intersection later. Do not auto-write thousands of intros. |
| X vs Y | “Letterboxd vs GoodWatch” (A12 unknown); “Letterboxd vs IMDb” (10 predictions); “IMDb vs Rotten Tomatoes vs Metacritic” (A7). | No exact GoodWatch comparison surfaced. [Cinephile License](https://cinephilelicense.com/imdb-vs-letterboxd) has an interactive ratings study; [Achriom](https://www.achriom.com/blog/letterboxd-vs-imdb/) has a product comparison. Readers expect a table, meaningful differences, limitations and a recommendation by use case. | GoodWatch can demonstrate its own discovery, streaming and tracking flows; it has the four score sources used in its combined score. It has not established a public Letterboxd ratings dataset, so cannot promise a Letterboxd-score correlation study. | Write the ratings-source explainer first, illustrated by a few real GoodWatch titles. Defer the low-evidence GoodWatch-versus-brand page; do not manufacture a comparison for every competitor. |
| X alternatives | “JustWatch alternatives”, “apps like JustWatch” — A6 confirms the first wording; monthly volume unknown. | [AlternativeTo](https://alternativeto.net/software/justwatch/), [Product Hunt](https://www.producthunt.com/products/justwatch/alternatives), [Limelight](https://thelimelight.app/blog/justwatch-alternatives), [Filmatic](https://filmatic.io/alternatives/justwatch): directories and competitor-written shortlists with feature tables. | A real GoodWatch workflow combines discovery, scores, episodes and watchability. It cannot claim independent streaming coverage superiority when availability comes through the same upstream ecosystem. State that GoodWatch publishes the comparison. | Written shortlist of 4–6 actual alternatives, including where JustWatch remains preferable. Verify every competitor capability and screenshot at writing time; no generated landing-page family. |
| How to | “how to track TV shows”, “how to track shows across streaming services”, “how to find where a movie is streaming”, “how to find movies like a movie” — A10/A11 are indirect or broader evidence; exact long tails remain unmeasured. | [Debriefr guides](https://debriefr.tv/guides), [StreamingTracker guides](https://streamingtracker.org/guides), [StreamTracker](https://www.getstreamtracker.com/blog/how-to-stop-missing-new-tv-episodes), [Limelight](https://thelimelight.app/blog/where-to-watch-any-movie): practical setup steps; also interactive availability search tools. | Demonstrate one task on the actual site: country and services, Want to See, episode progress and Watch next; or search → fingerprint attributes → similar titles → availability. Owner screenshots and observed outcomes are the original material. | Written tested walkthroughs in the blog. Don't promise automatic viewing-history sync, email/push notifications or playback without verifying those features. No separate `/guides` duplicate of the same post. |

### Additional result samples for the shortlisted destinations

| Query / destination | Observed publishers and format | What the GoodWatch answer needs |
| --- | --- | --- |
| Best sci-fi movies / existing genre leaf | [Rotten Tomatoes](https://editorial.rottentomatoes.com/guide/essential-sci-fi-movies-of-all-time/) score-led numbered list; [Time Out](https://www.timeout.com/film/the-100-best-sci-fi-movies) editorial ranking; [iRankMovies](https://irankmovies.com/en/best-movies/science-fiction/) already combines four rating sources | More than score aggregation: explain subthemes, scope, eligibility and where to watch |
| Best mind-bending movies / existing mood leaf | [Slashfilm](https://www.slashfilm.com/1885071/best-mind-bending-movies-ever-ranked/) written ranked list; [CinePick](https://cinepick.media/best-mind-bending-movies) ranked list with several score sources | Defensible eligibility, spoiler-free reasons and useful ordering |
| Best movies of all time / existing best list | [Rotten Tomatoes](https://editorial.rottentomatoes.com/guide/best-movies-of-all-time/), [Time Out](https://www.timeout.com/film/best-movies-of-all-time), [JustWatch](https://guides.justwatch.com/us/50-best-movies-of-all-time): score/editorial lists with explanations and streaming links | Honest cohort scope and transparent score/selection rules |
| Best TV shows of all time / existing best list | [Time Out](https://www.timeout.com/film/best-tv-shows-of-all-time), [GamesRadar](https://www.gamesradar.com/best-tv-shows-all-time/): editorial top lists; [rate.house](https://www.rate.house/chart/tv): weighted chart | Link season/episode detail and state that the list covers the sitemap cohort |
| IMDb vs Rotten Tomatoes vs Metacritic / post 1 | [Limelight](https://thelimelight.app/blog/rotten-tomatoes-vs-imdb-vs-metacritic), [ReelsMasala](https://reelsmasala.com/blog/imdb-vs-rotten-tomatoes-vs-metacritic): method explainers and comparison tables | Official definitions, three real examples and limits of comparison; avoid untested “most reliable” claims |
| Best TV show seasons / post 2 | [IMDb member list](https://www.imdb.com/list/ls079318592/), [another member list](https://www.imdb.com/list/ls596430016/): user-created selections, not official IMDb season charts; [Season-o-meter](https://seasonometer.com/lists/best-over-time/): close-intent show ranking from season data | A reproducible cross-show season ranking with episode coverage, votes and readable heatmaps |
| TV shows that get better each season / post 3 | [Season-o-meter](https://seasonometer.com/lists/better-every-season/): data-generated season progression list | Disclosed monotonic-improvement rule, coverage, uncertainty and availability |
| How to find similar movies / post 5 | [MoviesLike](https://movieslike.com/), [Similarama](https://www.similarama.com/): interactive title search, explanations and short instructions | Recognize that searchers often want a tool immediately: give a short worked task and direct links to existing similar-title sections |

The public search tool also surfaced GoodWatch's `/shows/best`. Its backend was not established as Google, so this is not evidence of Google indexing; retain Search Console as the authority. These samples show that neither four-source rankings nor season trajectories are exclusive features. GoodWatch has to improve the useful combination and explanation, rather than claim uniqueness of the underlying data.

## First destinations, ranked

This is the complete initial nonblog shortlist: **seven destinations, five existing and two new**. The five posts in the next table make 12 destinations total. Rankings balance plausible demand, distinctive answers and effort; they are not a quantitative volume ordering. Keep `/`, hubs and `/blog` as navigation, outside this content shortlist.

Effort means focused implementation or editorial time, excluding waiting for Google. The first list-template improvement is shared work; per-page tuning does not require rebuilding the whole template. All paths for new pages are proposals.

| Rank | Page / status | Target query | Demand source | Format | Unique contribution | Generated or written | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `/movies/genres/science-fiction` — improve existing | Best sci fi movies; best science fiction movies | A1: 10 predictions; monthly volume unknown | Ranked 15–25-title shortlist above the browse grid; method, reasons, streaming links | Combined score, votes, science-fiction subthemes from title analysis, availability | Data rows + written selection and reasons | 3–5 hours after shared template |
| 2 | `/movies/moods/mind-bending` — repair existing | Best mind bending movies | A2: 10; monthly volume unknown | Curated ranked list with spoiler-free reasons | Explain why each qualifies; actual fingerprint attributes rather than popularity alone | Data-assisted selection + human review | 0.5–1 day; coordinate #357 |
| 3 | `/movies/streaming/netflix` — improve existing | Best movies on Netflix | A3: 10; broad/competitive, volume unmeasured | Current country-labelled list, subscription-only eligibility, scores and short reasons | Availability checked for displayed country + aggregate score and vote context | Generated list + written method; availability freshness visible | 3–5 hours after shared template |
| 4 | `/shows/best` — retain and refine existing | Best TV shows of all time | A4: 10 for exact seed; monthly volume unknown | Ranked cohort, clearly labelled scope, links to season detail | Four-source score and season/episode grids on linked titles | Already generated; improve method/scope copy | 1–2 hours |
| 5 | `/movies/best` — retain and refine existing | Best movies of all time | A13: 10 for exact seed; monthly volume unknown | Ranked cohort with source/method disclosure | Combined score, vote counts, direct title links | Already generated; scope copy and links | 1–2 hours |
| 6 | `/movies/streaming/netflix/us/science-fiction` — new, after gate | Best sci-fi movies on Netflix; Netflix US sci-fi movies | A5: 10; exact country long-tail volume unmeasured | 10–20 eligible picks, fixed US subscription availability, why-watch notes | Country + genre + score + analysed subthemes in a stable answer | Generated snapshot + written reasons and QA | 1–2 days including shared country-aware work |
| 7 | `/alternatives/justwatch` — new, after gate | JustWatch alternatives | A6: 3; volume unmeasured | 4–6-app table, best-for sections, honest limitations | Tested GoodWatch discovery/ratings/tracking workflow and screenshots | Written; verify competing products by hand | 5–7 hours |

The Netflix intersection is conditional: require enough genuinely available, qualifying titles to make a useful shortlist. If not, omit it and link to the existing Netflix browse page instead. Do not create empty pages or expand into every provider/country to fill a quota. On existing country-adaptive service pages, display the country explicitly. For the new fixed-US page, keep the same core answer for guests and bots; a country switch must not silently change the meaning of that URL. Deduplicate plans/channels, distinguish subscription from rent/buy, show verification dates, and treat availability 30+ days old as unknown under [CONTEXT.md](../../../CONTEXT.md).

## First five posts, ranked

This is a **directional combined ranking of expected search interest and GoodWatch's data advantage**, not a measured keyword-volume league table. The ratings explainer has an established comparison query; the two season articles have the clearest data fit; task guides have weaker exact demand evidence but can earn useful product visits. The same query belongs to only one destination. These are five briefs, not five additional sets of generated pages.

| Rank | Post / proposed page | Target query | Demand source | Format | Unique contribution | Generated or written | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **IMDb vs Rotten Tomatoes vs Metacritic: what each score means** — `/blog/imdb-vs-rotten-tomatoes-vs-metacritic` | IMDb vs Rotten Tomatoes vs Metacritic | A7: 7 predictions; shorter two-source seed 10; monthly volume unmeasured | Comparison table, three worked title examples, score-source explanation, GoodWatch screenshot | Show the same titles' source scores and how GoodWatch presents them; do not equate a positivity percentage with a mean rating | Written Fable draft + owner edit; examples extracted from data | 4–6 hours |
| 2 | **The best TV seasons by episode ratings** — `/blog/best-tv-seasons-by-episode-ratings` | Best TV show seasons; TV show ratings by season | A8: 10 predictions for broad seed; related rating wording observed; volume unmeasured | Ranked 10–15-season list with episode heatmaps, coverage, votes and method | Public episode scores and source-specific season scores, finale/consistency context, links to show pages | Generate analysis/charts; write interpretation and spoiler-free reasons | 1–2 days initially |
| 3 | **TV shows that get better each season** — `/blog/tv-shows-that-get-better-each-season` | TV shows that get better each season | A9: 10 predictions from shorter seed including this phrase; volume unmeasured | 8–12-show progression list, season charts and eligibility rules | Direction of season scores, gaps and uncertainty; distinguish consistent improvement from a single great season | Generate comparisons; write and review claims | 1–1.5 days; reuse post 2's analysis |
| 4 | **How to track TV shows across streaming services** — `/blog/how-to-track-tv-shows` | How to track TV shows | A10: 10 for broad seed; exact across-services seed 0 predictions; volume unknown | Short numbered walkthrough with real screenshots, guest/member differences and a completed example | GoodWatch country/services, Want to See, episode progress and Watch next working together | Written after owner tests the actual flow | 4–5 hours |
| 5 | **How to find movies like a favourite, beyond the genre** — `/blog/how-to-find-similar-movies` | How to find similar movies | A11: 10 title-specific predictions; indirect evidence only, exact guide demand unknown | Worked workflow using one familiar title; compare genre with mood/style attributes and check streaming | Fingerprint explanations and a real pair of matching titles; link to canonical title pages, not new “like X” URLs | Written, with data-backed examples and screenshots | 4–5 hours |

The ratings explainer is not the previously suggested critics-versus-audiences **study**: it explains definitions using three examples and makes no catalogue-wide claim. Avoid turning it into that unapproved study. [IMDb's weighting explanation](https://help.imdb.com/article/imdb/track-movies-tv/weighted-average-ratings/GWT2DSBYVT2F25SK), [Rotten Tomatoes definitions](https://www.rottentomatoes.com/about), [Metacritic's method](https://www.metacritic.com/about-us/).

For the season posts, establish eligible released seasons, matching episode identities, minimum vote counts and rating coverage **before** ranking. Show missing data as missing; exclude specials and incomplete current seasons where appropriate. Don't invent a “season rating” by treating a show score as the mean of episodes. GoodWatch already has public IMDb episode ratings, vote-weighted episode-derived season means and separate provider season scores; member season/episode scores are a different private feature and are not an available public dataset. [Episode-grid model](../../../goodwatch-webapp/app/server/episode-grid.server.ts), [episode matching](../../../goodwatch-webapp/app/domain/tracking/episode-ratings.ts).

An initial pilot should manually check three known shows against source pages. Set and document a minimum vote/coverage rule after seeing coverage, rather than reverse-engineering a threshold that gives a desired winner. Do not claim a list is complete until that analysis runs. The improvement post requires at least three complete seasons and a disclosed rule for what “better each season” means. A weighted mean can rise while some episodes fall. Credit source data and keep the existing attribution practices; this plan does not propose releasing bulk title-level data or licensing it anew.

### Cadence and AI drafting

Use **one post every two weeks**, with permission to slip to monthly when app work needs the time. One weekly post is unrealistic alongside research, testing screenshots, coding and owner edits. A practical recurring budget is 30 minutes for GSC, 30–60 minutes for evidence and examples, and 1–2 hours for edits/checks each week. A new data article needs a separate half-day or day; do not pretend it fits the same small budget without reusing analysis.

1. Prepare a brief with one query, country, observed result format, source links, actual data/examples and internal-link destinations.
2. Fable drafts in the house voice: short paragraphs, a sourced topical joke in almost every paragraph and one running bit. Treat this as the drafting direction; the owner can cut jokes that obscure the answer. Supply sources for topical references rather than asking the model to invent them.
3. The owner edits claims and voice, checks title/episode examples and competitor features, and captures the tested product flow. AI prose is not evidence of first-hand use.
4. Publish the original on GoodWatch only after review, with a truthful date and normal published robots state. Keep the parked study's draft state. Link relevant canonical title/list pages and one related post where it helps.
5. Refresh changed numbers and screenshots; update the visible date only for a substantive revision. Recheck availability-based lists more often than evergreen explanations.

**Do not add SEObot or unattended AI publication.** It adds output without proving demand or information value, and conflicts with the owner's Fable/edit workflow. Google permits useful AI assistance but warns against generating many pages without added value. It does not require waiting for low-quality articles to rank before making them useful. [Google's AI-content guidance](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content).

## Existing pages that may compete

There is no demonstrated traffic cannibalization between content pages in this report. The following are **content/intent overlaps**, supported by source and live HTML. A matching keyword in two titles alone is not enough reason to delete a useful navigational page.

| URLs / overlap | Evidence | Recommendation |
| --- | --- | --- |
| `/movies` vs `/movies/best`; `/shows` vs `/shows/best` | Hubs say “Best Movies [TV Shows] and Where to Stream Them”; lists say “The Best … of All Time, Ranked”. All four returned self canonicals and are distinct page formats. | Keep both. Make the hub title/H1 about browsing by genre, mood and service, and reserve “best … of all time” for `/best`. Link each clearly. No 301: hub navigation and ranking are different jobs. |
| Existing genre leaf vs a proposed “best sci-fi movies” blog post | `/movies/genres/science-fiction` already has H1 “Best science fiction movies”. | Put ranked editorial selection on the existing leaf. **Merge the proposed article into that URL before publication**; there is no live duplicate URL to redirect. |
| Existing Netflix leaf vs a proposed generic “best Netflix movies” article | `/movies/streaming/netflix` is already the provider list; the blog would repeat its selection. | Improve the leaf; do not launch a clone. The proposed US science-fiction intersection is narrower, requires distinct eligible results and links back to its parent. |
| `/movies/moods/feel-good` vs `/movies/moods/funny` | Fresh guest HTML contains 40 unique movie links on each, 20 shared: 50% overlap of either first page, Jaccard 0.33. Intent is related but not identical. | Repair selection under #357 and review reasons. Keep both if one answers warmth/uplift and the other comedy. Merge/301 only if review cannot give each a distinct useful answer; no automatic redirect from overlap alone. |
| `/movies/moods/mind-bending` and the new similar-movies guide | The live list starts with The Odyssey, Inception, The Dark Knight and The Shawshank Redemption. Popularity is not a sufficient explanation of “mind-bending”. The guide answers a process, not a list query. | Fix eligibility and order on the existing mood page; use the guide to explain a different task and link to title pages. Don't add a second “mind-bending movies” post. |
| `/shows/moods/motivational` | The earlier #357 observation had three results; today's HTML has 40. That old thin-count fact is stale. Quantity does not establish thematic quality. | Reassess the current list under #357; no redirect to a random mood or the hub. If there is no useful equivalent and no defensible page, exclusion/removal is a separate decision. |
| `/discover`, `/explorer`, media/category hubs | Discover's generic meta includes “best movies and tv shows”; these pages have different interactive/navigation jobs. | Keep distinct titles and intro promises: filter/search, map exploration, browse, ranked list. Don't canonicalize all of them to one hub. Reuse the internal-links proposal; no new link-graph audit here. |
| Old `/tv-shows` and `/explore/...` shapes | Existing source maps equivalent old shapes with 301 and returns 404 when no replacement exists; live `/tv-shows` follows to `/shows`. | **Already done.** Don't repeat the migration or funnel unrelated missing pages to hubs. [Address rules](../../../goodwatch-webapp/app/ui/explore/address.ts), [#350](https://github.com/alp82/goodwatch-monorepo/issues/350). |

If a real duplicate is later found, retain the existing useful, linked URL; merge unique content, 301 the redundant equivalent, update internal links and the sitemap, and verify the destination. Use canonical hints only for duplicate variants that must remain accessible. Distinct lists and real pagination need not collapse to page one. [Google canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

## Tweet verdicts

| Tweet point | Verdict | Application |
| --- | --- | --- |
| Use Google Search Console | Already done | Read-only reporting and weekly index sample exist; this report adds the full returned query table. |
| Buy a small Ahrefs plan | Doesn't apply | No paid tools in this phase; optional free owned-site tools cover the immediate audit/backlink use. |
| Add SEOgets and DataFast | Doesn't apply for paid plans | Convenience and revenue attribution don't address today's indexing bottleneck. Free SEOgets is optional owner choice. |
| Review impressions/few clicks weekly; place matching terms in headings | Applies | Use the weekly procedure above. Match intent and improve the answer; don't repeat every brand variant or force exact matches. |
| Refresh pages that lost clicks | Applies as a workflow; no article candidate now | Existing traffic is branded and start-page-only. Recheck 28-day comparisons after content pages earn a baseline. |
| Optimize pages in positions 8–20 | Applies narrowly | Only `goodwatch tv` has more than a singleton impression in that band; check its intent, then consider start-page clarity. No content-page queue exists yet. |
| Rewrite titles/metas for high impressions/few clicks | Applies selectively | Brand CTR is the current lead. A snippet change is not a remedy for unknown/unindexed URLs; avoid page-wide churn. |
| Refresh old pages before writing more | Applies | Improve five existing list destinations first. Correct selection, availability, explanations and scope; a new date alone adds no value. |
| Merge thin pages targeting the same query | Applies with evidence | Avoid generic best-of/blog duplicates. Separate hubs and rankings. Current mood overlap calls for content review before any redirects. |
| Write one good post every week | Applies with a smaller cadence | Fortnightly maximum initially; monthly is acceptable. No publication quota outweighs evidence and owner editing. |
| Focus on promising keywords where already ranking | Doesn't apply yet to discovery posts | Named clicks are all branded; one `metacritic alternative` impression is not a dependable ranking opportunity. Use the small demand-tested shortlist instead. |
| Use SEObot to publish more; improve winners later | Doesn't apply | Keep Fable drafting and owner review; no unattended publication or low-quality experimental backlog. |
| Search before writing, match format, answer better than five results | Applies | Public samples identify formats. Repeat a clean-country Google top-five review per brief; add a specific data or workflow contribution, not just more words. |
| Include screenshots, own numbers and things actually tried | Applies | Use genuine owner workflows and computed analyses with dates, scope and sources. Upstream scores are not GoodWatch user-study findings. |
| Refresh posts with impressions; change dates only for real changes | Applies | Preserve dates unless facts or guidance materially change. No published blog baseline exists yet. |
| Add best X, X vs Y, alternatives and how-to pages | Applies in a bounded experiment | Reuse five lists, trial two landing pages and five posts. Defer GoodWatch-branded comparisons with unknown demand. |
| Avoid wasting crawl budget with many pages | Applies | No permutations, new tag families, translated copies or year clones. This is about useful inventory and crawl demand, not proof of a server-capacity limit. Google distinguishes crawl capacity from crawl demand. [Google's crawl-budget guidance](https://developers.google.com/crawling/docs/crawl-budget). |

## Release sequence and review

1. **Now:** use the weekly analytics routine, prepare briefs and decide query ownership. The proposed hub/list copy and selection improvements are reviewable follow-ups, not changes made by this research. Coordinate mood work with [#357](https://github.com/alp82/goodwatch-monorepo/issues/357), similar-title guidance with [#355](https://github.com/alp82/goodwatch-monorepo/issues/355), and the existing [internal-links proposal](internal-links-proposal.md) and [title Q&A proposal](title-qa-proposal.md).
2. **At the indexing review:** #353/#354 expect four weekly observations after the October 10 sitemap download, with the next decision around November 7. Use the actual records, not the calendar alone; #354 still needs a numerical “stays indexed” definition. If Google still declines or doesn't discover the set, diagnose that before releasing more pages. This plan does not silently move the gate.
3. **If the owner proceeds:** improve the five existing list URLs, then release at most one new destination every two weeks. Start with the ratings explainer and season article; introduce the two landing pages only when their content and availability checks are ready. Five posts represent roughly ten weeks, not one launch batch. The remaining data article can wait if coverage isn't good enough.
4. **Measure:** keep the fixed sample unchanged. In a separate small content log, record each destination, publish/change date, intended query, Google canonical, index state, nonbrand impressions/clicks and search landings with an interaction. After four weeks, check discovery/indexing; after six to eight weeks indexed, compare traffic/engagement. Lack of indexing is not a failed keyword-demand test.
5. **Hold expansion:** as a proposed content-program threshold, require at least four of the first five published or materially improved destinations to remain indexed across two weekly checks, plus a genuine nonbrand impression on more than one destination, before approving another batch. This is a proposed decision aid, not Google's rule or a replacement for #354. Keep the separate existing 70%-of-title-cohort threshold before expanding the title sitemap.

## Decisions to carry to the owner

- Confirm or change the **US English** assumption for the single service/genre landing page. Existing German research remains separate.
- Accept a fortnightly maximum, monthly fallback, and the first two briefs; confirm that Fable receives the original voice reference when drafting starts.
- Set #354's numerical retention criterion at the indexing review. Decide whether to proceed with new content only after seeing that evidence.
- Decide whether free-tool setup or a manual free Keyword Generator check is worth the time. No paid subscription is recommended.

## Verification and limits

Completed: read the specified `origin/main` research and blog files, issue/comment history, relevant routes/models; queried Search Console with read-only scope; fetched 16 live paths; checked direct US/English autocomplete and public search-result formats; verified tool descriptions/prices against first-party pages. No app code, external account, issue, sitemap or Search Console state was changed.

Not completed: numeric monthly keyword-volume estimates; a usable Trends series; controlled Google top-five rankings; owner workflow screenshots; season-list calculations or selection validation; browser/rendering tests. These are explicit limits on the proposal, not verified claims. No app tests were run because only this research document changed. Sources/prices/search samples are dated observations and should be checked again when each brief is commissioned.
