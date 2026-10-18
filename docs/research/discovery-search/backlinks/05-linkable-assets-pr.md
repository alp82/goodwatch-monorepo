# Linkable assets and digital PR for GoodWatch

Research date: 2026-10-18. Research only: nothing was posted, submitted or signed up for. Claims I could not check against a primary source are marked "(not verified)". Traffic expectations are qualitative because no source gives numbers that would transfer to GoodWatch.

## Licensing limits that shape every asset

These limits apply to every data study, widget and tool below, so they come first.

| Source | What the terms say | What it means for a public study or widget |
|---|---|---|
| IMDb non-commercial datasets | "Subsets of IMDb data are available for access to customers for personal and non-commercial use" ([data.imdb.com/non-commercial-datasets](https://data.imdb.com/non-commercial-datasets/), read 2026-10-18). The licensing help page requires the line "Information courtesy of IMDb (https://www.imdb.com). Used with permission." and says the data "must not be altered/republished/resold/repurposed to create any kind of online/offline database of movie information" ([IMDb help](https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX), read 2026-10-18). | The owner already accepted the datasets for the episode grid (GoodWatch stays non-commercial). For studies: publish findings, charts and short ranked lists with the IMDb line. Do not offer a downloadable CSV of IMDb episode or season ratings: that is the clearest case of republishing a database. Any sponsorship, affiliate link or ad on the study page would weaken the non-commercial footing. |
| TMDB API | Logo required, less prominent than GoodWatch's own; notice "uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB"; no commercial use without a separate agreement; no caching "for longer than 6 months" ([TMDB API terms](https://www.themoviedb.org/api-terms-of-use), last updated 2023-10-20). | Credit TMDB on every study page and widget. Whether a derived availability history (appeared and dropped days) counts as "cached information" under the 6-month rule is unclear (not verified). Studies on availability history should report aggregates, not ship the raw records. |
| JustWatch via TMDB watch providers | "In order to use this data you must attribute the source of the data as JustWatch" ([TMDB watch providers reference](https://developer.themoviedb.org/reference/movie-watch-providers), read 2026-10-18). | Every "where to stream" widget and every catalogue study needs a visible JustWatch credit. GoodWatch already shows the JustWatch logo (`goodwatch-webapp/app/ui/streaming/Streaming.tsx`, `ui/about/AboutParts.tsx`). |
| Rotten Tomatoes and Metacritic | GoodWatch crawls public pages politely and stops on 403 or 429 (`docs/critic-scores.md`). I could not read either site's terms in this session (not verified). Journalists routinely quote these scores in lists (for example ScreenCrush, 2026-09-11, below). | Quote scores as facts with the source named, publish aggregates and short lists, never a bulk download of their scores. A study that goes viral on their scores draws attention to the `GoodWatchBot` user agent; if either site blocks it, the crawler stops by design and the scores go stale. Treat that as a real cost. |

## 1. Data studies

### Examples from 2023 to 2026 that earned coverage

| Study | Publisher and date | Who picked it up | Format that worked |
|---|---|---|---|
| "Which streaming service is the best value for money?" Apple TV has the highest average IMDb score for the fifth year | Self Financial, a credit-builder company, annual; 2026 edition covered 57,220 titles, compiled March 2026 ([self.inc](https://www.self.inc/info/which-tv-streaming-service-best-value-for-money/)) | MacTech, 2026-08-06, links to the study twice ([mactech.com](https://www.mactech.com/2026/08/06/apple-tv-has-the-highest-average-imdb-score-for-its-streaming-library/)); AppleWorld Today; MacTech also covered the 2024 edition ([mactech.com, 2024-03-26](https://www.mactech.com/2024/03/26/a-new-report-says-apple-tv-has-the-highest-rated-content-of-any-streaming-service/amp/)) | "Key statistics" list at the top, tables per service, a value-per-dollar metric, year-on-year tables, a methodology section with dates and exclusions. No dataset download, no embed code. The repeat each year is what keeps earning links: every edition gives outlets a new "for the Nth year" headline. |
| JustWatch quarterly SVOD market share (US and other countries) | JustWatch, quarterly; Q3 2026 based on more than 45 million interactions | MacTech 2026-10-06, which links the charts page and passes on JustWatch's request to credit and link it ([mactech.com](https://www.mactech.com/2026/10/06/justwatch-hulu-climbs-to-13-market-share-as-apple-tv-posts-strongest-annual-growth-justwatch-reports/)); TelecomLead, AppleWorld Today for Q2 2026 | One chart, one headline number per service, a plain methodology line, and an explicit "credit JustWatch and link to this page" request. The charts page says "You can use this data for your own website, product or research" ([justwatch.com/us/streaming-charts](https://www.justwatch.com/us/streaming-charts)). |
| "Which shows got their finale right?" and "How many episodes should you watch before quitting a TV show?" | Stat Significant, a free weekly data newsletter, using IMDb user ratings | GIGAZINE 2024-02-03, with a link ([gigazine.net](https://gigazine.net/gsc_news/en/20240203-series-finale)); Slashdot 2025-03-03 ([slashdot.org](https://tech.slashdot.org/story/25/03/03/1424248/)) | One question in the headline, "A statistical analysis" as the subtitle, a few charts, a plain method. A solo writer with no PR budget. This is the closest model for GoodWatch. |
| "Theatrical windows now averaging 32 days" | Dark Horizons, a small film news site, 2025-12-09; 182 US releases hand-collected ([darkhorizons.com](https://www.darkhorizons.com/?p=188497)) | Film Stories cited Dark Horizons (with Flat Panels HD) in its windows story, 2025-05-12 ([filmstories.co.uk](https://filmstories.co.uk/news/films-are-heading-to-streaming-services-quicker-concludes-new-report/)); that citation was for an earlier Dark Horizons piece on Omdia data (not verified which one) | Prose, a distribution of days, clear exclusions. Shows that a small site's own count gets cited next to analyst firms. |
| What's on Netflix "Library by the numbers" (year end) | What's on Netflix, 2024 and 2025 editions ([2025](https://www.whats-on-netflix.com/news/netflix-library-by-the-numbers-2025-597-new-originals-released-and-library-swells-to-almost-8000-titles)) | TheBestVPN restates its per-country counts, updated 2026-03-06 ([thebestvpn.com](https://thebestvpn.com/statistics/netflix-library-size-by-country/)) | A yearly snapshot with per-country counts. VPN and statistics sites cite such numbers as their source. |
| Reelgood "Unspooled 2025", catalogue size tracker, "Streaming iceberg" | Reelgood's data site ([data.reelgood.com](https://data.reelgood.com/data-reelgood-unspooled-2025/)) | Statista credits Reelgood for catalogue growth (2023, not verified for later years). I found no independent coverage of the 2025 reports in this session. | B2B report aimed at industry buyers. Less useful as a model for a consumer site. |
| Critics vs audiences gap lists | ScreenCrush, 2026-09-11, "2026 movies with the biggest difference in Rotten Tomatoes critics and audience scores", hand-compiled ([screencrush.com](https://screencrush.com/2026-movies-with-the-biggest-difference-in-rotten-tomatoes-critics-and-audience-scores/)); Stacker, IMDb users vs Metascore lists ([stacker.com](https://stacker.com/stories/movies/most-overrated-movies-audiences), date not verified) | ScreenCrush links only its own tag page, not a source | Shows demand for the topic and that writers compile it by hand today. A maintained, citable "gap" page would save them the work. Older format references: Flixed's 2020 Apple TV+ gap chart ([loopinsight.com, 2020-03-05](https://loopinsight.com/2020/03/05/apple-tv-has-the-widest-gap-between-audience-and-critic-scores-on-rotten-tomatoes/)) and Streaming Observer's 2018 Netflix originals study ([qz.com](https://qz.com/1382874/reviews-for-netflix-original-series-trail-amazon-and-hulu)), both before 2023. |

Whip Media is no longer a model: its TV Time app shut down on 2026-07-15 after a 2025 acquisition, and I found no current public chart reports ([neowin.net](https://www.neowin.net/amp/tv-time-is-shutting-down-in-a-couple-of-weeks/), not verified beyond secondary coverage). I found no 2023 to 2026 data study by Flixed or Cord Cutters News in this session.

### What the working examples share

- One headline finding that fits in a news headline ("Apple TV has the highest rated library for the 5th year").
- A short "key findings" list before any chart.
- A methodology section with the collection date, the number of titles, the score sources and exclusions.
- A repeatable edition: the same study each year or quarter, with year-on-year change.
- A clear credit request (JustWatch asks for a credit and a link). Self Financial offers no embed or dataset and still gets links.
- Per-country cuts where the data has them, so local outlets have their own angle (not verified as a driver; inferred from What's on Netflix per-country citations).

### Five GoodWatch data study ideas, ranked by link potential against effort

All tables are Crate tables defined in `goodwatch-flows/windmill/f/sync/models/crate_schemas.py`. Row counts with real scores per source were not checked in this session (not verified); the Mongo rating collections hold about 1.16 million RT movie and about 650,000 IMDb movie documents as of 2026-09-25 (`docs/research/season-episode-scores/existing-data.md`), but not every document has a score.

| Rank | Study | GoodWatch data it needs | Where it lives | Link potential | Effort | Licensing note |
|---|---|---|---|---|---|---|
| 1 | **Where critics and audiences disagree most, 2026.** Gap between Tomatometer and audience score, and between Metascore and Metacritic user score, by year, genre, and the service that streams it. Headline candidates: "the most audience-loved films critics panned", "the streaming service whose originals split critics and fans most". Four scores per title is the angle no single-site list has. | `rotten_tomatoes_tomato_score_*`, `rotten_tomatoes_audience_score_*`, `metacritic_meta_score_*`, `metacritic_user_score_*` with their review and rating counts; `genres`, `release_year`; `streaming_service_ids`, `streaming_country_codes`; `network_ids` for show originals | `movie`, `show`, `streaming_availability`, `network` | High: an evergreen topic writers compile by hand (ScreenCrush 2026-09-11) | Low to medium: SQL plus a page; minimum review and rating counts needed to avoid noise | Third-party scores: aggregates and top-20 lists only, no download. Watch the crawler block risk above. |
| 2 | **The best-rated streaming catalogue in every country.** Average score and count of titles above a threshold per service and country, for subscription, free and ad offers. Self Financial does this for the US with IMDb only; GoodWatch can do it for every country it tracks and with a combined score. Each country is its own press angle (Germany, UK, India and so on). | `streaming_availability` (`country_code`, `streaming_service_id`, `streaming_type`), joined to `goodwatch_overall_score_normalized_percent` or per-source scores; `streaming_service.name` | `streaming_availability`, `movie`, `show`, `streaming_service` | High: a proven annual format, plus local angles | Medium: the per-country pages and charts are the work; a repeat edition each year | JustWatch and TMDB credit required. IMDb-based averages are fine as findings; no dataset. |
| 3 | **When TV shows peak, and which final seasons let fans down.** Season curves for shows with three or more seasons, the season where the score drops, best and worst final seasons, and whether critics (RT and Metacritic season scores) agree with IMDb voters. Stat Significant's IMDb-only versions got covered; the critic-season angle is new. | `imdb_season` (vote-weighted season mean, rated episode count), `imdb_episode`; `rotten_tomatoes_season`, `metacritic_season`; `show.number_of_seasons`, `in_production` | `imdb_season`, `imdb_episode`, `rotten_tomatoes_season`, `metacritic_season`, `show`; pipeline in `f/imdb_datasets/ingest` and `f/critic_sites/crawl` | Medium to high: proven by Stat Significant coverage; ties to finales in the news | Medium: method choices (vote thresholds, season numbering alignment, see `docs/research/season-episode-scores/episode-alignment-method-limits.md`) | IMDb non-commercial: charts and short lists with the IMDb line; never a CSV. Each show's episode grid on GoodWatch is the natural deep link target. |
| 4 | **Cinema to streaming in 2026: how long, by studio and country.** Days from theatrical release to digital release, and from release to first subscription offer. Dark Horizons counted 182 US films by hand; GoodWatch can count every country TMDB lists. From early 2027 the availability history adds exact arrival days. | `release_event` (`release_type`: TMDB uses 3 for theatrical and 4 for digital, not verified against TMDB docs in this session; `country_code`, `release_date`); `movie.production_company_ids`; later `availability_history.appeared_on` with `appeared_precision = 'exact'` | `release_event`, `movie`, `production_company`; `availability_history` (built 2026-10-17, commit c60c5e98; `f/sync/availability_history.py`) | Medium to high: windows are a recurring trade story | Medium now, low later: TMDB release dates are community-entered, so quality checks are needed; exact arrival days exist only from 2026-10-17 onward | TMDB and JustWatch credit. Report aggregates; the 6-month cache question above applies to history records. |
| 5 | **The comfort-watch index.** Which service in which country carries the most comfort watches, date-night films, background-friendly shows, family picks, from the title analysis. Data nobody else has, and an easy consumer headline. | `context_is_comfort_watch`, `context_is_background_friendly`, `context_is_binge_friendly`, `suitability_date_night`, `suitability_family`, `fingerprint_scores`, `essence_tags` joined with `streaming_availability` | `movie`, `show`, `streaming_availability` | Medium: novel, but journalists will ask how an LLM labelled the titles | Low: the columns exist | GoodWatch's own data. Needs a plain methodology section saying the labels come from the title analysis (an LLM), with a sample check. Say "title analysis", not "DNA". |

Not in the top five: member taste data. The member base is small (one recent feature counted 8,312 ratings from 11 members), so any finding would be anecdotal and raises privacy questions. "Hot on socials" could become a monthly "what social media pushed onto watchlists" note once its history is long enough (not verified how much history it keeps).

### Do and don't for data studies

- Do put the study on a stable GoodWatch URL (for example `/studies/critics-vs-audiences-2026`), in the sitemap, with a "key findings" list, charts as images with alt text, a dated methodology section and a "how to cite" line.
- Do link from the study to the GoodWatch title pages it mentions; those are the pages that need discovery.
- Do repeat the same study each year with the same URL pattern.
- Do send the finished study to a short list of relevant writers one by one, with the single finding that fits their beat. No mass mailing.
- Don't offer raw IMDb, RT or Metacritic data for download.
- Don't put ads, affiliate links or sponsorship on study pages (IMDb and TMDB non-commercial terms).
- Don't buy distribution (Stacker's model is paid by brands: [Simon Owens on Stacker](https://simonowens.substack.com/p/how-stacker-distributes-sponsored)).

## 2. Embeddable widgets and badges

### What Google says

- Link spam includes "Keyword-rich, hidden, or low-quality links embedded in widgets that are distributed across various sites" and "Widely distributed links in the footers or templates of various sites" ([Google spam policies, link spam](https://developers.google.com/search/docs/essentials/spam-policies#link-spam), last updated 2026-08-28).
- Google's 2016 reminder: widget links that the webmaster did not editorially place, with anchor text the webmaster does not control, "are considered a violation"; the fix is to "add a `rel="nofollow"` attribute on the widget links or remove the links entirely" ([Search Central blog, 2016-09-08](https://developers.google.com/search/blog/2016/09/a-reminder-about-widget-links)).
- `rel="sponsored"` for paid placements, `ugc` for user content, `nofollow` otherwise ([Qualify outbound links](https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links), last updated 2025-12-10).

### Widget options for GoodWatch

| Widget | What it is | Value | Risk |
|---|---|---|---|
| Ratings card for a title | An image or iframe showing IMDb, RT, Metacritic and GoodWatch scores, with "Ratings via GoodWatch" | Blogs and reviewers might embed it; referral clicks | IMDb and RT data inside someone else's page is closer to redistribution; JustWatch and IMDb credits must travel with it. Medium licensing risk. |
| "Where to stream" box | Per country streaming offers for a title | Useful to bloggers | JustWatch attribution required. JustWatch and Reelgood already offer such widgets (not verified current). Low differentiation. |
| Episode ratings grid image | The existing grid as an image card | Fans and Reddit posts share these | IMDb data in an image: ask for credit, keep the IMDb line in the image. |
| Study chart embed | Charts from section 1 with a credit line | The most natural editorial link | Low, if the credit is a visible request rather than hidden code |
| "Featured on GoodWatch" badge | For creators or services GoodWatch lists | Few natural candidates; GoodWatch lists titles, not businesses | Badge links in templates match the "widely distributed links" pattern |
| Shared top-5 list cards and OG images | Already shipped (`/og/<path>.png`, share-list PNG) | Social referral traffic, brand recall | Low |

### How to do it safely

- Opt-in only: the person copies the snippet themselves.
- The link inside any embed snippet uses a brand anchor ("GoodWatch") and `rel="nofollow"`. Expect referral traffic and brand discovery from widgets, not ranking credit.
- Never hide links, never put keywords in the anchor ("best movies to stream"), never tie the widget to a set of target pages.
- For study charts, ask for a credit with a link in plain text, as JustWatch does. A writer who links by choice is an editorial link.
- Keep the IMDb, TMDB and JustWatch credits inside the embedded image or frame.

Effort: medium (an embed route plus a copy-snippet UI). Link value: low for ranking by design. Expected traffic: low (not verified). Fit: medium; the share cards GoodWatch already has cover most of this.

## 3. Free tools

| Tool idea | Existing competitors | Does GoodWatch already have it? | Link potential |
|---|---|---|---|
| Episode ratings graph or heatmap | Graph TV, covered widely in 2014 ([FlowingData](https://flowingdata.com/2014/03/24/graph-tv-shows-ratings-by-episode/)), current status not verified; Series Graph (seriesgraph.com, launched 2025-12 per Product Hunt, iOS app, paid tier) and Watch Peak (Product Hunt 2026-06-19) ([producthunt.com](https://www.producthunt.com/products/series-graph-2/launches)) | Yes: every show page has the episode grid with season popovers that show RT and Metacritic season scores next to IMDb (`goodwatch-webapp/app/ui/details/episode-grid/`, `routes/api.episode-grid.ts`) | Medium. The critic season scores are the differentiator. A focused landing page ("Episode ratings for any show") that searches straight into the grid would make it a recognisable tool. |
| "Is it streaming in my country?" / "Where is it streaming worldwide?" | uNoGS (Netflix only), What's on Netflix, JustWatch, Reelgood; VPN sites target this query (not verified) | Partly: title pages have a country selector (`ui/streaming/Streaming.tsx`), `api.streaming-countries.ts` | Low to medium: a crowded query with VPN affiliate competition |
| "What to watch tonight on <service>" | JustWatch, Reelgood, many listicles | Partly: tonight's pick (`routes/api.tonight.ts`), `/watch-next`, Discover filters by service and country | Low for links, medium for direct traffic; tools like this rarely get editorial links (not verified) |
| Critics vs audience gap finder | None found as a maintained tool in this session | No, but the data is in `movie` and `show` | Medium to high, as the living version of study 1 |
| Rewatchability or comfort-watch picker | None found | The labels exist (`context_is_comfort_watch` and others) | Medium; pairs with study 5 |
| Use GoodWatch from an AI assistant (MCP) | Many MCP servers; few for movies (not verified) | Yes: `/mcp`, `/use-with-ai` | Medium in AI and developer circles; see section 5 |

Prerequisites: a clear, indexable landing page per tool, fast on mobile, no sign-up wall for the main function. Risk: low. Don't build thin pages per keyword ("is X on Netflix in Y" for every pair); that is scaled content of little value.

## 4. Journalist sourcing platforms

| Platform | Status, 2026-10 | Free for sources? | How it works | Typical link | Effort | Fit for a streaming and movie data expert |
|---|---|---|---|---|---|---|
| HARO (Help a Reporter Out) | Cision rebranded it Connectively and closed that on 2024-12-09 ([cision.com](https://www.cision.com/connectively-has-been-discontinued/)). Featured.com bought the HARO brand and relaunched it, announced 2025-04-16 ([newswire.ca](https://www.newswire.ca/news-releases/featured-com-acquires-help-a-reporter-out-haro-from-cision-823809336.html)). One PR site still says HARO "no longer exists" (edited 2026-09-14, [everything-pr.com](https://everything-pr.com/haro-business-media)). Current running status not verified; helpareporter.com returned HTTP 429 to my request. | Yes, per the 2025 release ("free for journalists and sources", ad-funded) | Daily email digests of queries; reply by email | Often a mention, sometimes a followed link; outlets vary (not verified) | Medium: daily scanning, fast replies | Medium: entertainment queries are a small share (not verified) |
| Featured.com | Active; Terkel renamed itself Featured in July 2023 ([Arizona Tech Council](https://www.aztechcouncil.org/terkel-announces-rebrand-to-featured/)) | Free tier plus paid plans, details not verified | Experts answer publisher questions; answers are compiled into Q&A articles | Usually a link in an expert round-up; quality varies (not verified) | Low per answer | Low to medium: many round-ups are marketing blogs, which carry little value |
| Qwoted | Active | Basic plan free: "2 pitches/month", "2 hour pitch delivery delay"; Pro listed at 1,188 USD a year ([app.qwoted.com/pricing_plans](https://app.qwoted.com/pricing_plans), read 2026-10-18) | Journalists post requests; sources pitch inside the platform | Higher-authority business and finance outlets (per [stork.ai](https://www.stork.ai/blog/haro-alternatives-2026), 2026-08-01, not verified) | Low, since only 2 pitches a month | Medium: use the 2 pitches on streaming-cost or cord-cutting stories |
| Source of Sources (SOS) | Active; site footer reads 2026; founded in 2024 by HARO's original founder | Yes: "This list doesn't cost a dime"; asks for a charity donation instead ([sourceofsources.com](https://www.sourceofsources.com/)) | Up to three emails a day; reply to the journalist only if on topic; off-topic replies get you removed | Mentions or links, depending on the outlet | Medium | Medium |
| Help a B2B Writer | The domain now redirects to MentionMatch, which says "We're launching soon" ([mentionmatch.com](https://mentionmatch.com/), read 2026-10-18) | Not stated | Writers post requests, matched sources get an email | B2B blogs | Low | Low: B2B topics (SaaS, marketing) |
| Terkel | Now Featured (see above) | | | | | |
| Connectively | Closed 2024-12-09 | | | | | |
| #journorequest on X and Bluesky | Active. A study of 1,775 requests from 2025 found medical, psychology, interior design, wellness and fitness topped the list, with no entertainment category reported ([SEO Works, 2026-03-27](https://www.seoworks.co.uk/journalist-request-study-uncovering-trends/)). | Yes | Search the hashtag, reply fast | UK lifestyle and national outlets, mostly | Medium: needs a daily check | Low to medium: streaming-cost and "what to watch" stories appear but are rare (not verified) |
| ResponseSource | Active, UK, paid with a free trial; prices not shown on the pages I could read ([responsesource.com](https://www.responsesource.com/)) | No (trial only) | Enquiries by email per category | UK national and trade press | | Excluded: paid |
| SourceBottle | Listed as active and free in a 2026 round-up ([stork.ai](https://www.stork.ai/blog/haro-alternatives-2026)); not verified on its own site | Yes (not verified) | Email call-outs, Australia and UK heavy | | | Low to medium |

Do: answer only where GoodWatch's data adds something only it has (a per-country catalogue number, a season-score finding), give a number with its date, and offer the study URL. Write each reply yourself: SOS removes off-topic repliers, and the relaunched HARO says it screens pitches with AI-text detection (per a 2025 interview with the new owner, [BuzzStream](https://buzzstream.com/blog/haro-is-back-podcast/), not verified on HARO's own site). Don't: pitch every query, or use these for product placement ("best apps" round-ups on low-quality blogs).

## 5. Newsletters

| Newsletter | Audience | How to get in | Free to submit? |
|---|---|---|---|
| Cord Cutters News | US cord cutters | Reader tips through the site's Contact Us button ([cordcuttersnews.com](https://cordcuttersnews.com/have-a-news-tip-let-us-know-you-could-win-a-cord-cutters-news-coffee-mug/), post date not verified) | Yes |
| The Streamable | Streaming news and deals | No tips page found; general contact only (not verified) | Unknown |
| Lowpass | Streaming and TV tech business, weekly ([InboxReads listing](https://inboxreads.co/n/lowpass)) | No submission process found; pitch only a data finding that fits its industry beat (not verified) | Unknown |
| Stat Significant | Data and pop culture essays | Not a submission outlet, but a peer whose readers like this kind of data; a data tip with a clear finding could be welcome (not verified) | Unknown |
| Film newsletters generally | Cinephiles | I found no film newsletter with a public tool-submission process; InboxReads lists cinema newsletters to research ([inboxreads.co](https://inboxreads.co/new-movies-newsletters)) | Pitch per editor |
| TLDR | Tech workers | Only a paid sponsorship route is documented ([advertise.tldr.tech](https://advertise.tldr.tech/agencies/)); editorial picks have no public form (not verified) | No free route found |
| Console.dev | Developers | Picks 2 to 3 dev tools a week; developers must be the primary users; submit by email ([console.dev selection criteria](https://console.dev/selection-criteria)) | Free, but GoodWatch is not a dev tool: no fit unless the MCP server is presented as one |
| Hacker Newsletter | Hacker News readers | Hand-picked from Hacker News each week, no submission process ([hackernewsletter.com](https://hackernewsletter.com/)) | The route is a Show HN post that does well |
| Ben's Bites and other AI newsletters | AI builders | No submission process found ([bensbites.com](https://www.bensbites.com/)) | Unknown |
| PulseMCP | MCP directory with a newsletter | Submissions are paused; it points to the Official MCP Registry and will pick listings up from there ([pulsemcp.com/submit](https://www.pulsemcp.com/submit), read 2026-10-18) | Listing via the official registry is free (not verified) |
| Official MCP Registry | MCP clients and directories | Publish `server.json` with the `mcp-publisher` CLI; remote Streamable HTTP endpoints are accepted; still a preview service ([modelcontextprotocol.info](https://modelcontextprotocol.info/tools/registry/publishing/), not the official domain, so not verified) | Yes (not verified) |
| Tiny Startups | Indie makers | Hand-approved listings; deals and tool listings cost 69 GBP; the price of a plain startup submission is not stated ([tinystartups.com](https://www.tinystartups.com/)) | Unclear |
| Indie Hackers newsletter | Indie founders | No featuring process found; it draws on community posts (not verified) | The route is a useful Indie Hackers post |

Effort: low per pitch. Link value: a newsletter link is usually in email only; the web archive copy may carry a link (varies, not verified). Expected traffic: short spikes. Fit: highest for Cord Cutters News (with a study finding) and for MCP channels (registry, directories) because few movie MCP servers exist (not verified).

## 6. Podcasts and guest posts

- Google is fine with articles on other sites that "inform users", but not "when the main intent is to build links in a large-scale way back to the author's site" ([Search Central blog, 2017-05-25](https://developers.google.com/search/blog/2017/05/a-reminder-about-links-in-large-scale)). The spam policy lists "links with optimized anchor text in articles, guest posts, or press releases distributed on other sites" as link spam ([spam policies](https://developers.google.com/search/docs/essentials/spam-policies#link-spam)). Google staff said in 2017 and 2020 that links in guest posts should be nofollow or sponsored ([Search Engine Journal](https://www.searchenginejournal.com/guest-post-manual-actions/351692/), secondary source).
- Podcasts: indie maker, data-viz and streaming podcasts sometimes host solo builders. A show-notes link is a natural, editorial link. Effort: an hour per show plus prep. No list was researched in this session.
- Guest posts: one or two pieces where GoodWatch has something to teach (how the episode grid aligns IMDb and critic seasons, how availability days are proven exact) on a relevant engineering or data blog. Brand or URL anchor, accept nofollow, no paid placements, no keyword anchors.

## Summary table

| Tactic | Effort | Risk | Link value | Expected traffic | Prerequisites | Fit |
|---|---|---|---|---|---|---|
| Annual data study: critics vs audiences | Low to medium | Medium (RT and Metacritic exposure) | High | Medium spikes, long tail from citations (not verified) | Study page template, methodology, charts | High |
| Annual data study: best-rated catalogue by country | Medium | Low | High | Medium, spread across countries (not verified) | Per-country pages, JustWatch and TMDB credits | High |
| Study: when shows peak / final seasons | Medium | Medium (IMDb terms: findings only) | Medium to high | Medium around finales | Season alignment checks, IMDb line | High |
| Study: cinema-to-streaming windows | Medium now, low from 2027 | Low | Medium to high | Low to medium | `release_event` quality checks; months of `availability_history` | Medium |
| Study: comfort-watch index | Low | Low to medium (LLM labels questioned) | Medium | Low to medium | Clear method note on the title analysis | Medium |
| Embeddable widgets and badges | Medium | Medium if links are followed, low with nofollow | Low by design | Low | Embed route, credits in the embed | Low to medium |
| Free tool landing pages (episode grid, gap finder) | Low to medium | Low | Medium | Medium, steady | Indexable landing page, fast mobile | High for the episode grid |
| HARO, SOS, Qwoted, #journorequest | Medium, ongoing | Low | Medium per hit, rare hits | Low | Studies to point to, daily time | Medium |
| Featured.com round-ups | Low | Low to medium (low-quality blogs) | Low | Low | None | Low |
| Streaming newsletters (Cord Cutters News and similar) | Low | Low | Medium | Short spikes | A newsworthy finding | Medium |
| MCP registry and AI channels | Low | Low | Low to medium | Low to medium, relevant users | Published `server.json` | Medium to high |
| Podcasts and occasional guest posts | Medium | Low if nofollow is accepted, high at scale | Low to medium | Low | A story to tell | Medium |

## Recommended top 4 moves from this family

1. **Publish "Where critics and audiences disagree most, 2026"** as GoodWatch's first study page, with key findings, charts, a dated methodology, the source credits and links to the title pages it names. Then send it to a handful of writers who already cover the topic (ScreenCrush-type lists, Mac and streaming sites), one by one. Plan a 2027 edition at the same URL pattern.
2. **Publish "The best-rated streaming catalogue in every country"** as the annual flagship, modelled on Self Financial's format but per country and with a combined score. Pitch each country's finding to that country's tech or streaming press, and use SOS, Qwoted's two free pitches and #journorequest replies to point to it when streaming-cost stories come up.
3. **Turn the episode grid into a named tool**: one landing page that searches straight into any show's grid, highlighting the RT and Metacritic season scores competitors lack, then run the "when shows peak and which final seasons failed" study on top of it (findings only, IMDb line, no dataset).
4. **Make every study chart embeddable with a visible credit request and publish the MCP server to the Official MCP Registry.** The chart credit earns editorial links without widget-link risk; the registry listing is free and feeds directories such as PulseMCP once it reopens. Skip "Featured on GoodWatch" badges and keyword-anchored widgets.
