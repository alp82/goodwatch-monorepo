# Film and TV communities, databases and media outlets as "what's hot right now" sources for GoodWatch

Status: researched 2026-10-14. **Method caveat:** the research sandbox could not reach wikidata.org, query.wikidata.org, developer.themoviedb.org or any publisher or API host directly (DNS and proxy blocks). So I could not check live feeds, endpoints or property pages, and findings come from web-search results. Items marked **[UNVERIFIED, from prior knowledge]** come from the researcher's background knowledge (cutoff mid-2026) and were not confirmed by a source fetched in this session. Check them before building on them. An engineer with network access should run the verification checklist in the Gaps of Q2.

---

## Q1. Which sources offer the strongest freely accessible "discussed now" signal plus displayable content?

### Takeaway
The strongest free, low-legal-risk combination is:
- **Trending signals:** Wikipedia pageviews, AniList trending (anime), Netflix's official Top 10 files, and Trakt trending. Trakt access is now gated behind VIP for new API apps.
- **Displayable content:** headline-plus-link news cards from publisher RSS feeds (no long snippets or images for EU users), podcast embeds (Spotify, Apple), and YouTube embeds.

Letterboxd, IMDb, Rotten Tomatoes and Metacritic have the richest buzz content (reviews, popularity charts). None offers a free, open, licensed API, so a non-commercial app can only deep-link to them.

### Cited findings

#### Film and TV social apps

**Letterboxd**
- The API is invite-only. Applicants email api@letterboxd.com with their intended use, and Letterboxd says it is "unable to individually reply, or to guarantee access." — [Letterboxd API beta page](https://letterboxd.com/api-beta/)
- Letterboxd's help article (updated June 2026) calls it "a private API that we selectively offer to partners"; you may "apply for beta access." — [Letterboxd help: mobile apps or an API?](https://letterboxd.zendesk.com/hc/en-us/articles/15269070369551-Do-you-have-mobile-apps-or-an-API)
- Third-party profiles describe the API:
  - OAuth2: Client Credentials for public data, Authorization Code for member-specific data.
  - Docs at api-docs.letterboxd.com; base URL api.letterboxd.com/api/v0.
  - Endpoints cover film metadata, reviews, lists, activity, log entries and festival coverage.
  - These details were not verified against the official docs. — [api-evangelist/letterboxd](https://github.com/api-evangelist/letterboxd); [erunion/letterboxd-client](https://github.com/erunion/letterboxd-client)
- An unofficial Letterboxd API client (erunion/letterboxd-client) was archived by its owner on 2025-11-24. — [GitHub](https://github.com/erunion/letterboxd-client) (archive date reported by search summary)
- A blog post shows how to pull the mobile app's API tokens with mitmproxy. This is a terms-of-service-hostile workaround, not a viable option. — [Vox Silva blog](https://blog.alexbeals.com/posts/extracting-letterboxd-tokens-with-mitmproxy)
- Paid third-party scrapers resell Letterboxd data ("immediate access … without an approval process"). These carry Letterboxd terms-of-service risk. — [parse.bot listing](https://parse.bot/marketplace/9229cdd2-dc02-439b-a767-fdf366879365/letterboxd-com-api); [Apify Letterboxd scraper](https://apify.com/masked_hacker/letterboxd-scraper.md)
- **Ownership history ("Tiny sale"):**
  - Tiny Ltd. (Victoria, BC) bought a 60% controlling stake. The deal completed on 2023-09-29.
  - Tiny's valuation was US$50–60M; the price was not disclosed. The founders (Matthew Buchanan, Karl von Randow) kept their stake and continued to lead the company.
  - Letterboxd had about 10M members at the time and passed 29M registered users in Q1 2026, per Tiny.
  - [BusinessWire](https://www.businesswire.com/news/home/20230929276535/en/Tiny-Announces-Majority-Acquisition-of-Letterboxd); [Daily Hive](https://dailyhive.com/canada/letterboxd-acquired-canadian-investor); [tiny.com](https://tiny.com/companies/letterboxd)
- In 2026, Tiny was reported to be "looking to sell" Letterboxd. Letterboxd said it had "no news to share." — [BetaKit](https://betakit.com/letterboxds-canadian-owner-reportedly-looking-to-sell/)
- I found no evidence that the Tiny deal itself changed the API terms. The API was already a closed beta before and after the sale. Treat any claim of an "API terms change due to the Tiny sale" as unsupported.
- **[UNVERIFIED, from prior knowledge]:**
  - Each member profile has an RSS feed of diary entries and reviews at `letterboxd.com/<username>/rss/`. There is no per-film or "popular" RSS feed.
  - The popular-this-week page is at `letterboxd.com/films/popular/this/week/`, and each film page shows "Popular reviews."
  - Letterboxd has no official embed widget for reviews.
  - Its robots.txt and terms forbid automated scraping.

**Trakt**
- Trakt's public API has trending, popular, anticipated, most-watched and comments endpoints (per-title comments and replies). Trakt IDs cross-reference IMDb, TMDB and TVDB in every object. **[UNVERIFIED, from prior knowledge: endpoint names such as `/movies/trending`, `/shows/anticipated`, `/movies/{id}/comments`; the `ids` object holds trakt, slug, imdb, tmdb, tvdb]**
- **Changes in 2025:**
  - On 2025-01-21 (announced; covered in February 2025), Trakt introduced strict free-tier limits: 2 personal lists of 100 items each, and 100 items in the watchlist and collection.
  - VIP doubled in price, from $30 to $60 per year.
  - [DuckieTV issue #1447](https://github.com/SchizoDuckie/DuckieTV/issues/1447); [AlternativeTo](https://alternativeto.net/news/2025/2/trakt-tv-has-set-stricter-limits-for-free-users-and-raised-vip-subscription-prices-by-100-/)
- **Changes in 2026:**
  - On 2026-02-27, Trakt's forum post raised the free-tier limits (watchlist and personal lists to 250 items; 5 free personal lists against 100 for VIP). — [Trakt Forums](https://forums.trakt.tv/t/updating-trakt-limits-for-2026/101592)
  - Free accounts are reportedly limited to one connected third-party app at a time. Only a secondary source reports this. — [TROYPOINT](https://troypoint.com/trakt-limits-users-to-one-connection/)
  - From about 2026-07-31, Trakt reportedly began disabling developer API apps owned by free accounts. Creating a new API app now requires an active VIP membership.
  - A Trakt staff member reportedly called this a "temporary anti-abuse measure." The reported price is $4.99/month (not confirmed).
  - [tuliprox issue #853](https://github.com/euzu/tuliprox/issues/853); [ETTAYEB blog](https://ettayeb.fr/en/selfhosted/trakt-api-paywall-selfhosted-media/)
  - **Implication:** GoodWatch's maintainer would need a VIP account to keep a Trakt API app. Check this against the official trakt/trakt-api GitHub discussions before relying on it.

**TV Time**
- TV Time (Whip Media) shut down on 2026-07-15. The app was pulled from the stores, tvtime.com went offline, and user data was deleted. Whip Media cited the cost of running a free app and a pivot toward AI. — [TechCrunch, 2026-07-02](https://techcrunch.com/2026/07/02/popular-tv-tracking-app-tv-time-is-shutting-down-as-company-focuses-on-ai); [Moviebase](https://moviebase.app/resources/tv-time-shutting-down)
- TheTVDB, which Whip/TV Time acquired in 2019, is a separate service. Its API has required a paid license (developer or end-user) since 2020. — [Wikipedia: TheTVDB](https://en.wikipedia.org/wiki/TheTVDB)
- **Answer to "API shut?":** yes. TV Time as a whole is gone as of July 2026. It never had a public developer API that I could find.

**Other social apps: Serializd, Simkl, Taste.io, Mubi**
- **[UNVERIFIED, from prior knowledge]:**
  - **Simkl** has a free public API (client ID required). It has trending endpoints and cross-references IMDb, TMDB, TVDB and MAL IDs.
  - **Serializd** (TV-only, Letterboxd-style) has no public API.
  - **Taste.io** has no public API.
  - **Mubi**: its public API was closed years ago; no open API now. Its film pages show user ratings and reviews.
- I did not find sources for these in this session.

#### Rating sites and databases

**IMDb**
- The official IMDb API is a GraphQL API sold through AWS Data Exchange. — [IMDb developer release notes](https://developer.imdb.com/documentation/release-notes)
  - IMDb's release notes say full paid plans went live in 2025, including Ratings, Essential Metadata and Box Office Mojo products.
  - Evaluation access is requested at imdb-licensing-support@imdb.com.
- One AWS Marketplace listing shows a 12-month contract at **$150,000**, plus overage. — [AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-nzspap6vaousm)
- A "Complete Dataset Free Trial (API)" listing exists, but it is limited to documentation data and the latest revision. — [AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-3n67c76ppu2yy); [api.market guide 2026](https://api.market/blog/sleeyax/entertainment/best-movie-apis)
- Under IMDb's terms, its free datasets are for personal and non-commercial use only. Second-hand source; I did not fetch the primary licence text. — [Zuplo](https://zuplo.com/learning-center/best-movie-api-imdb-vs-omdb-vs-tmdb)
- **[UNVERIFIED, from prior knowledge]:**
  - The free non-commercial bulk TSVs at datasets.imdbws.com contain basics and ratings. They have no MOVIEmeter, reviews or news.
  - MOVIEmeter and STARmeter popularity charts (`imdb.com/chart/moviemeter/`) are web-only.
  - The public site runs on an internal GraphQL endpoint (`caching.graphql.imdb.com`). Scrapers use it, but it is unofficial and prohibited by IMDb's Conditions of Use ("no data mining, robots, screen scraping").
  - IMDb's trailer embed iframes were removed years ago.

**Rotten Tomatoes**
- On 2024-08-21, RT replaced the "Audience Score" label with the **Popcornmeter** ("Hot" or "Stale") and launched a **"Verified Hot"** badge:
  - A film earns the badge with a Verified Audience Score of 90% or higher.
  - It reportedly keeps the badge until the score drops below 80% (single source).
  - "Verified" means RT confirmed a ticket purchase on Fandango, its sister company.
  - [THR](https://www.hollywoodreporter.com/business/business-news/new-rotten-tomatoes-score-badge-verified-hot-1235974680/); [RT press release (Versant)](https://pressroom.versantmedia.com/rotten-tomatoes/press-releases/rotten-tomatoes-unveils-new-rotten-tomatoes-verified-hot-audience); [AV Club](https://avclub.com/rotten-tomatoes-verified-hot-badge)
- Ownership trail: the press release is hosted on Versant's press room, Versant being Comcast's cable-network spin-off. Fandango and RT ownership is described in [Spyglass](https://spyglass.org/the-arbiter-of-movie-quality-comcast.md). I did not verify the exact 2025–26 corporate structure.
- No public RT API was found. **[UNVERIFIED, from prior knowledge]** RT's developer API was closed to new applicants around 2014–2016 and is licensed only to partners.

**Metacritic**
- **[UNVERIFIED, from prior knowledge]** Metacritic has no public API; Fandom has owned it since 2022. It has a Wikidata ID (see Q2). Use deep links only.

#### Anime

**AniList**
- AniList's GraphQL API needs no key for public queries; trending sort is public.
- Its docs say the API is "currently in a degraded state," limited to **30 requests per minute** (normally 90). Increases are not being granted, and the rate-limit headers don't reflect the reduced limit. — [AniList docs: rate limiting](https://docs.anilist.co/guide/rate-limiting); [considerations](https://docs.anilist.co/guide/considerations)
- **[UNVERIFIED]** The `Media` object exposes `idMal` (a crosswalk to MyAnimeList), and the `trending` sort plus `trends` give daily trending scores.

**MyAnimeList and Jikan**
- **[UNVERIFIED, from prior knowledge]:**
  - The official MAL API v2 needs an `X-MAL-CLIENT-ID` header. It has `/anime/ranking?ranking_type=airing|upcoming|bypopularity` and `/anime/season/{year}/{season}`.
  - Jikan (api.jikan.moe/v4) is an unofficial, open-source, free scraper API with no key. It is limited to about 3 requests per second and 60 per minute. It includes `/top/anime?filter=airing`, `/seasons/now`, reviews and forum topics.
- Community mapping projects link MAL, AniList, Kitsu, AniDB, TMDB, TVDB, IMDb and Trakt IDs for anime. — [Fribb/anime-lists](https://github.com/Fribb/anime-lists); [Otaku-Mappings](https://github.com/Goldenfreddy0703/Otaku-Mappings)

**Kitsu**
- **[UNVERIFIED]** Kitsu's free JSON:API has `/api/edge/trending/anime`.

#### International

- **[UNVERIFIED, from prior knowledge; no sources were fetched this session]**
  - **Douban**: its official API was closed to new developers around 2018–2019. Scraping is aggressively blocked.
  - **Kinopoisk** (Yandex) has no official public API. Community APIs exist: kinopoiskapiunofficial.tech (free key, daily quota) and kinopoisk.dev, a paid tier with a free key. Both wrap scraped data and expose IMDb IDs.
  - **Filmarks** (Japan): no API.
  - **Watcha/Watcha Pedia** (Korea): no public API.
  - **FilmAffinity** (Spain): no API.
- None of these offers sanctioned access. They are useful only as deep links via Wikidata IDs (Q2).

#### Wikis and memes

**Fandom**
- **[UNVERIFIED]** Each Fandom wiki exposes the standard MediaWiki Action API (`https://<wiki>.fandom.com/api.php`). Text is CC BY-SA 3.0 (attribution required; share-alike). Images often carry other licences.

**Know Your Meme**
- Wikidata has a "Know Your Meme slug" property, P13484. — [Wikidata P13484](https://www.wikidata.org/wiki/Property:P13484)
- KYM has entries for many shows and films, but no public API **[UNVERIFIED]**.

**Tenor**
- Google ended the third-party Tenor API:
  - From 2026-01-13, no new API keys or integrations.
  - On 2026-06-30, API and Ads Distribution Agreements were terminated.
  - Tenor survives only inside Google's own products.
  - [HN thread](https://news.ycombinator.com/item?id=46603473); [Techgenyz](https://techgenyz.com/google-shut-down-tenor-api-gif-pickers/); [AgentDeals migration guide](https://agentdeals.dev/tenor-alternatives)
- An earlier step, the shutdown of the Tenor API v1 in favour of v2 (around 2023), is **[UNVERIFIED]**. It is now moot.

**Giphy: correction to the brief**
- Giphy was sold to Shutterstock in **2023**, not 2025. Reported price: about $53M.
- History: Meta bought Giphy in 2020; the UK CMA ordered its sale in 2022.
- [Frame & Focal (secondary)](https://frameandfocal.com/photography-glossary/shutterstock-to-acquire-giphy-from-meta-for-53m); [Filmit](https://filmit.io/resources/tenor-api/)
- A related 2026 development: Getty Images reportedly moved in July 2026 to terminate its planned $3.7B merger with Shutterstock, after the CMA demanded an editorial divestiture. Single source. — [Wikipedia: Getty Images](https://en.wikipedia.org/wiki/Getty_Images)
- One site claims Giphy's public API v1 shut on 2024-09-01, replaced by a "Creative API v3." This is uncorroborated and probably unreliable. — [frameandfocal.com](https://frameandfocal.com/photography-glossary/shutterstock-to-acquire-giphy-from-meta-for-53m)
- **[UNVERIFIED, from prior knowledge]:**
  - The Giphy API (api.giphy.com/v1/gifs/search) uses a beta key, then upgrades to a production key after review.
  - It requires "Powered by GIPHY" attribution.
  - Searching a show's title returns studio and network-uploaded GIFs from verified channels.

**Wikipedia and Wikidata**
- **[UNVERIFIED]** The Wikimedia REST API is free and needs no key. It has `/metrics/pageviews/per-article/...` and `/metrics/pageviews/top/...`. This is the most robust free signal for "attention right now," and it is keyed via Wikidata sitelinks.

#### Podcasts and newsletters
- **[UNVERIFIED, from prior knowledge; not verified this session]:**
  - **Spotify** episode embeds use iframes (`open.spotify.com/embed/episode/{id}`). Search needs a Spotify Web API app.
  - **Apple Podcasts** has embeds (`embed.podcasts.apple.com`) and the free iTunes Search API.
  - **Podcast Index API** is free and open, but needs a key and HMAC auth.
  - **Listen Notes** has a free tier with limited quota and requires attribution.
  - **Substack** has a per-publication RSS feed at `/feed` and post embeds.
  - **YouTube Data API v3** has a quota of 10,000 units per day by default; a search costs 100 units.

#### News and trade press
- **EU press publishers' right (Art. 15 of the Digital Single Market directive):**
  - It covers online uses of press publications by information-society providers.
  - It does **not** cover private non-commercial use by individuals (Art. 15(1)(ii)), hyperlinking (Art. 15(1)(iii)), or "individual words or very short extracts" (Art. 15(1)(iv)).
  - Recital 58 explains the carve-out: such use "may not undermine the investments" of publishers.
  - National implementations differ. Three member states set fixed length limits on extracts. France says the carve-out fails when an extract "replaces the press publication itself."
  - [Kluwer Copyright Blog pt 1](https://legalblogs.wolterskluwer.com/copyright-blog/taking-freedom-of-information-seriously-the-very-short-extracts-limitation-in-article-15-cdsm-directive-and-how-not-to-implement-it-part-1/); [pt 2](https://legalblogs.wolterskluwer.com/copyright-blog/taking-freedom-of-information-seriously-the-very-short-extracts-limitation-in-article-15-cdsm-directive-and-how-not-to-implement-it-part-2/); [Communia](https://communia.notion.site/Article-15-Protection-of-press-publications-concerning-online-uses-b52804451f3e4f56b8aa66013b28aa95)
  - Italy implemented the right through D.Lgs. 177/2021 (Arts. 43-bis and 43-ter LdA). — [dandi.media](https://dandi.media/en/new-ancillary-right/)
- **Germany:** **[UNVERIFIED]**
  - §§ 87f–87k UrhG (2021) implement Art. 15.
  - Corint Media collects for many publishers and has pursued Google.
  - GoodWatch is German-operated, so this is the most relevant regime: Filmstarts and Moviepilot are German publishers.
  - **Conservative pattern:** show the headline (title), source name, date and a link. Show no teaser text and no thumbnail images, unless the publisher's RSS terms grant them.
  - "Non-commercial" status of the app does not clearly exempt it. Art. 15 targets information-society service providers, not just commercial ones.
- **Google News RSS:**
  - Designed for non-commercial use.
  - Required attribution: to Google News, to each item's provider, and a link back to the Google News cluster.
  - Feed images are often licensed agency photos.
  - One advocacy piece calls commercial republication illegal.
  - [SEJ (via search result)](https://searchenginejournal.com/index.php?p=2022); [Ben Metcalfe](https://benmetcalfe.com/?p=209); [FullPress](https://www.fullpress.it/en/rss-feed-google-news-illegal-commercial-republication/)
- **Publisher RSS feed URLs** **[UNVERIFIED; I could not test them from the sandbox]:**
  - **WordPress VIP and Penske titles** follow the `/feed/` convention: `variety.com/feed/`, `deadline.com/feed/`, `hollywoodreporter.com/feed/`, `indiewire.com/feed/`.
  - **Valnet titles** also use `/feed/`: `collider.com/feed/`, `screenrant.com/feed/`.
  - **Others:**
    - `slashfilm.com/feed/`
    - `denofgeek.com/feed/`
    - Vox Media titles: `polygon.com/rss/index.xml`, `theringer.com/rss/index.xml`
    - Vulture: `vulture.com/rss/index.xml`, or `feeds.feedburner.com/nymag/vulture`
    - IGN: `feeds.ign.com/ign/all`
    - Empire: unclear
    - German outlets: Filmstarts publishes RSS under `filmstarts.de/rss/…`; Moviepilot under `moviepilot.de/…`. Exact paths unknown.
  - All must be tested.
- **GDELT DOC 2.0 API and Event Registry (newsapi.ai):**
  - **[UNVERIFIED]** GDELT is free with no key. It returns article URL, title, domain and social image, and supports keyword and phrase search. That makes it usable as a "news volume about title X" signal.
  - **[UNVERIFIED]** Event Registry has a limited free tier.
  - No sources were found this session.

#### Box office and charts
- **Netflix Top 10:**
  - Netflix publishes weekly global Top 10s (film and TV, English and non-English) every Tuesday.
  - Views are rounded to the nearest 10,000.
  - Historical TSVs (`all-weeks-global`, `all-weeks-countries`, since 2021) are published on Tudum and pulled by third-party tools and Kaggle mirrors.
  - [top10.netflix.com](https://top10.netflix.com/films/2022-02-27); [Apify scraper description](https://apify.com/jungle_synthesizer/netflix-tudum-top10-scraper?fpr=97nrp4); [Kaggle mirror via Baselight](https://baselight.app/u/kaggle/dataset/dhruvildave_netflix_top_10_tv_shows_and_films)
  - Exact official download URL **[UNVERIFIED]**: probably `https://www.netflix.com/tudum/top10/data/all-weeks-global.tsv` (top10.netflix.com redirects to Tudum).
  - The TSVs have titles but **no IMDb or TMDB IDs**, so titles must be matched by name and season.
- **Box Office Mojo** (IMDb, Amazon) has no free API. Data is sold inside the IMDb AWS product (see the IMDb release notes above).
- **[UNVERIFIED, from prior knowledge]:**
  - **The Numbers** has no free API; its data is licensed via OpusData.
  - **FlixPatrol** has a paid API. Its site terms forbid scraping, and it has been criticised for opaque methodology.
  - **Nielsen** publishes a free weekly streaming Top 10 as a press release, with about a 4-week lag.
  - **JustWatch** "streaming charts" are web-only. Its API is partner-only, and it requires attribution.
  - **Reelgood**: no public API; it pivoted to B2B data.
  - **Samba TV**: press-release viewership figures only.

### Inferences
- **Best free "now" signals:**
  1. Wikimedia pageviews (free, keyed by Wikidata QID, global).
  2. Netflix Top 10 TSV (official, free; needs title matching).
  3. AniList trending, for anime (free, 30 req/min).
  4. Trakt trending and anticipated (best ID crosswalk; access is now VIP-gated for new apps).
  5. GDELT news volume.
- **Best displayable content:**
  - Publisher RSS headlines as link cards.
  - YouTube, Spotify and Apple Podcasts embeds, which the platforms explicitly allow.
  - Trakt comments, if the API terms allow display.
  - Fandom excerpts under CC BY-SA, with attribution.
- Letterboxd, IMDb, RT, Metacritic and the international sites should be **outbound deep links only**, built from Wikidata IDs.
- The GIF-search idea is weak after the Tenor shutdown. Giphy is the only realistic option, and its terms and attribution requirements would need review.

### Gaps
- Could not fetch Trakt's official API terms or confirm the 2026 VIP-only rule from a primary Trakt source.
- Could not test any publisher RSS URL, or confirm the Netflix TSV path.
- No primary sources this session for Simkl, Serializd, Taste.io, Mubi, Douban, Kinopoisk, Filmarks, Watcha, FilmAffinity, Kitsu, Jikan, MAL v2, Podcast Index, Listen Notes, Spotify, Apple, GDELT, Event Registry, Nielsen, JustWatch, Reelgood, Samba TV, Box Office Mojo, The Numbers or FlixPatrol. Those statements are marked unverified.
- German Art. 15 implementation (§ 87g UrhG length rules) and Corint Media's stance on small apps: not verified.
- Current Giphy API terms after the Shutterstock sale: not verified.

---

## Q2. Which have ID crosswalks to IMDb, TMDB or Wikidata? (Wikidata property numbers)

### Takeaway
Wikidata is the hub. GoodWatch already has Wikidata links, so one SPARQL or entity fetch per title can yield IDs for most sites in this brief. Confirmed this session:
- P6127 (Letterboxd film)
- P4086 (MAL anime)
- P8731 (AniList manga)
- P11495 (Kitsu anime)
- P13484 (Know Your Meme slug)

The other numbers below are from prior knowledge and must be checked.

### Cited findings
- **Letterboxd film ID = P6127**: "identifier for a film on the website Letterboxd." Related: Letterboxd actor ID = P6119. — [P6127 mirror](https://citygraph.abudhabi.nyu.edu/wiki/Property:P6127); [Wikidata P6119](https://www.wikidata.org/wiki/Property:P6119)
- **MyAnimeList anime ID = P4086** — [Wikidata P4086](https://www.wikidata.org/wiki/Property:P4086)
- **AniList anime ID = P8729** (mentioned only on talk pages); **AniList manga ID = P8731** — [Wikidata P8731](https://www.wikidata.org/wiki/Property:P8731); [WikiProject Anime talk](https://www.wikidata.org/wiki/Wikidata_talk:WikiProject_Anime_and_Manga)
- **Kitsu anime ID = P11495** — [Wikidata P11495](https://www.wikidata.org/wiki/Property:P11495)
- Other anime IDs: AniDB anime ID = P5646; aniSearch anime ID = P12477. — [P5646](https://www.wikidata.org/wiki/Property:P5646); [P12477](https://www.wikidata.org/wiki/Property:P12477)
- **Know Your Meme slug = P13484** — [Wikidata P13484](https://www.wikidata.org/wiki/Property:P13484)
- **From prior knowledge [UNVERIFIED; check each at wikidata.org/wiki/Property:Pxxxx]:**
  | Site | Property (unverified) |
  |---|---|
  | IMDb ID | P345 (high confidence) |
  | TMDB movie ID / TV series ID | P4947 / P4983 (high confidence) |
  | TheTVDB series ID | P4835 |
  | Trakt.tv ID | P8013 (not found by search; confirm) |
  | Kinopoisk film ID | P2603 |
  | Douban film ID | P4529 |
  | Metacritic ID | P1712 |
  | Rotten Tomatoes ID | P1258 |
  | Box Office Mojo film ID | P1237 (formerly; may be deprecated) |
  | The Numbers movie ID | P3808 |
  | FilmAffinity ID | P480 |
  | AlloCiné film / series ID | P1265 / P1267 |
  | Filmweb.pl ID | P5032 |
  | Netflix ID | P1874 |
  | MUBI film ID | P7299 |
  | Fandom article ID / Fandom wiki ID | P6262 / P4073 |
  | Know Your Meme ID (older) | P6760 (may coexist with P13484 slug) |
  | Subreddit | P3984 |
  | Tumblr username | P3943 |
  | Hashtag | P2572 |
  | X (Twitter) username | P2002 |
  | Instagram username | P2003 |
  | Facebook username | P2013 |
  | TikTok username | P7085 |
  | YouTube channel ID | P2397 |
  | Filmarks / Watcha / Moviepilot.de / Filmstarts / JustWatch / Simkl / Serializd | properties likely exist for some (JustWatch ID, Moviepilot.de) — numbers unknown |
- Trakt objects themselves contain imdb, tmdb and tvdb IDs, a direct crosswalk without Wikidata. **[UNVERIFIED, from prior knowledge]**
- A tool extracts Trakt, IMDb and TMDB IDs from Wikidata, implying a Trakt property exists. — [wikidata-identifier-extractor](https://awesome.ecosyste.ms/projects/github.com%2Fwa8eem%2Fwikidata-identifier-extractor)
- Anime crosswalk files map MAL, AniList, Kitsu, AniDB, TMDB, IMDb and TVDB IDs. — [Fribb/anime-lists](https://github.com/Fribb/anime-lists)

### Inferences
- Implementation: one SPARQL query against the title's QID can return every external ID above. Properties have formatter URLs (P1630), so deep links can be built generically.
- Coverage varies:
  - Letterboxd, IMDb, TMDB, RT and Metacritic coverage is high for films.
  - Kinopoisk and Douban coverage is decent for popular titles.
  - Filmarks and Watcha coverage is likely sparse.

### Gaps
- Wikidata was unreachable from the sandbox, so every number in the table above needs confirming.
- Suggested query:
  ```sparql
  SELECT ?p ?pLabel ?f WHERE {
    ?p wikibase:propertyType wikibase:ExternalId; wdt:P1630 ?f .
    FILTER(REGEX(STR(?f), "letterboxd|trakt|kinopoisk|douban|metacritic|rottentomatoes|fandom|knowyourmeme|tumblr|reddit|filmarks|watcha|filmaffinity|moviepilot|filmstarts|mubi|simkl|serializd|justwatch|boxofficemojo|the-numbers"))
  }
  ```

---

## Q3. Per-title subreddit, hashtag or official social links via Wikidata or TMDB external_ids

### Takeaway
TMDB's movie and TV external_ids include social IDs alongside imdb_id and wikidata_id. Official docs group them as media databases (IMDb, Wikidata) and social (Facebook, Instagram, Twitter). The search snippet did not confirm tiktok_id and youtube_id on movie and TV objects. TikTok and YouTube are confirmed for **person** records. Wikidata adds subreddit (P3984), hashtag (P2572) and the social usernames; those numbers are unverified this session.

### Cited findings
- TMDB **movie** external IDs, per the docs: media databases (IMDb, Wikidata) and social IDs (Facebook, Instagram, Twitter). — [TMDB movie external IDs](https://developer.themoviedb.org/reference/movie-external-ids)
- TMDB **person** external IDs list IMDb, TikTok, Wikidata and YouTube, among others. — [TMDB person external IDs](https://developer.themoviedb.org/reference/person-external-ids)
- An older TV external_ids wrapper lists imdb, freebase, tvdb and tvrage. This reflects an older schema. — [R TMDb package](https://search.r-project.org/CRAN/refmans/TMDb/html/tv_external_ids.html)
- TMDB's `/find/{external_id}` resolves IMDb and other IDs to TMDB objects. — [TMDB finding data](https://developer.themoviedb.org/docs/finding-data)
- **[UNVERIFIED, from prior knowledge]** Current field lists:
  - Movie: `imdb_id, wikidata_id, facebook_id, instagram_id, twitter_id`.
  - TV: `imdb_id, freebase_mid, freebase_id, tvdb_id, tvrage_id, wikidata_id, facebook_id, instagram_id, twitter_id`.
  - Person: also `tiktok_id, youtube_id`.
  - So the brief's claim that title external_ids include tiktok_id and youtube_id is **not confirmed**. It may apply to persons only. Test with `GET /3/movie/550/external_ids` and `/3/tv/1399/external_ids`.

### Inferences
- **Official social accounts:** use TMDB first (facebook, instagram, twitter handles for titles), then fill in from Wikidata (P2002, P2003, P2013, P7085 TikTok, P2397 YouTube).
- **Community and discussion links:** only Wikidata provides subreddit (P3984) and hashtag (P2572); TMDB has neither.
- **Fandom:** P6262 / P4073 give the title's wiki for lore and CC BY-SA excerpts.
- **Embeds:** none of these IDs gives a free embed of current posts. X, Instagram and TikTok embeds are per-post oEmbed and need a known post URL. These links therefore work best as "join the conversation" outbound buttons.

### Gaps
- Exact TMDB movie and TV field names (especially whether `tiktok_id` and `youtube_id` exist on titles) need a live API call.
- Wikidata coverage rates of P3984 and P2572 on film and TV items are unknown.
