# Movie and TV discovery: paid-feature landscape beyond the major trackers

Research/access date: **2026-10-19**. Prepared for Goodwatch's later consolidated competitor comparison and build sequencing. This is research, not a Goodwatch implementation audit or approved marketing copy.

## Scope, evidence and reading rules

This bounded survey covers **50 distinct product families: all 26 seeds and 24 additional discoveries**. It includes general movie/TV apps, regional and anime overlap, personal collection software, and three self-hosted trackers. IMDb, JustWatch, Trakt, SIMKL, Letterboxd, TV Time, Serializd and Criticker are excluded as comparison subjects; references to their integrations or import formats remain necessary. Another research thread owns those products.

The inventory has **42 active public presences, seven uncertain leads, and one explicitly discontinued service** under the definitions below. There is current first-party payment evidence for **29 families**, including partially documented purchases and cosmetic/supporter offerings; this count excludes Watcht's voluntary contributions and AniList's historically documented donation tiers. It is not a count of 29 fully verified price/feature matrices. Plex is included in that count, with its discovery overlap separated from media-server functions. Data API products are variants within their respective families, not additional consumer competitors.

- **Active public presence (A):** A current official product, documentation, repository, or publisher store listing is accessible. This establishes availability of public material, not a successful signup, purchase, sync or notification delivery.
- **Uncertain (U):** A listing or lead exists, but current operation, maintenance or product identity could not be established strongly enough. A blocked fetch does not establish shutdown.
- **Discontinued (D):** An explicit first-party closure notice exists.
- **Documented:** Stated by the publisher. Product performance, recommendation quality and migration fidelity were not tested.
- **Unknown:** Not established by reviewed public material. It does not mean absent, free, paid or unlimited.

Sources are official product/pricing/help pages, publisher-authored store descriptions, official repositories and publisher announcements. Store reviews and third-party price aggregators were discovery leads only. Identified publishers' Reddit posts are first-party testimony, dated and qualified below; the detailed Sofa Time post is also linked from its official press kit. Competitor-written comparisons were not used as evidence about the compared competitor.

All cited material was accessed on **2026-10-19**, including direct HTTP reads where the browsing tool failed or omitted collapsed content. Source publication/update dates are reported separately where visible; otherwise they are **undated**. Search-engine crawl dates are not publisher update dates. Search-indexed first-party text is identified where live retrieval failed. Public JavaScript and unauthenticated pricing configuration were inspected where necessary; no accounts, purchases or paywall bypasses were used. No commercial data licenses were evaluated for Goodwatch.

Prices are literal offers, not converted currencies. **Monthly means a monthly charge; annual means the full annual charge**, not an annualized monthly figure. An App Store country is a storefront, not proof of the user's billing residence. `$` is identified as USD only when the storefront or source establishes that; country-ambiguous web prices retain that qualification. Duplicate store SKUs can be legacy, introductory or segmented offers: listing them does not establish that every visitor can buy them. An annual/lifetime label is not inferred merely from a higher price.

The research does not establish every website in existence. Additional app-store products and regional services remain outside this finite search. The scope favors paid functions a discovery/tracking product could meaningfully match, while retaining free benchmarks and adjacent collection products that change the competitive context.

## Normalized paid-feature families

Use these names in a later consolidated comparison; compare individual capabilities beneath them rather than declaring whole-family parity.

| Family | Capabilities to compare |
| --- | --- |
| Library & lists | Title/list counts; list-item caps; manual/smart lists; tags; physical ownership; lending; bulk edits |
| Tracking & history | Episodes/seasons; repeat watches; dated logs; backdating; skipped/hidden items; diary |
| Statistics | Time watched/remaining; breakdowns; historical windows; recaps; exportable/shareable charts |
| Discovery & filters | Recommendations; similarity; saved filters; providers/countries; runtime/genre/rating filters; AI quotas |
| Calendars & alerts | Calendar horizon; iCal/RSS; episode, premiere, availability and people alerts; timing controls |
| Sync & scrobbling | Cross-device state; external tracker sync; automatic playback logging; sync direction and cadence |
| Portability & backup | Import/export formats and fields; backup/restore; frequency caps; access after expiry |
| Integrations & automation | Read/write API; widgets; shortcuts; webhooks; provider deep links; media-server connections |
| Appearance & profile | Artwork; themes/icons; layouts; profile/badge/privacy options; rich text/notes |
| Ads & privacy | Ad removal and its exceptions; tracking claims; private-account behavior |
| Device & offline | Supported clients; account/iCloud dependency; offline read/write; device limits |
| Household & social | Family purchase sharing; collaborative lists; shared progress; separate users; parental controls |

**Default for every product:** Any family, numeric cap, household entitlement or free/paid boundary not explicitly established below remains unknown. A feature advertised generally in a store description is not automatically free. In particular, none of these tables equates cloud sync with export, import with continuous sync, purchase sharing with shared lists, or library ownership with viewing history.

## Inventory: the 26 seeds

Each row links to first-party identity/status evidence. Detailed paid evidence follows; the model column intentionally distinguishes a consumer app from its data business.

| # | Product / canonical link | Overlap and scope relevance | Status evidence | Commercial model evidenced |
| --- | --- | --- | --- | --- |
| 1 | [Reelgood](https://reelgood.com/) | Direct: provider search, recommendations, watchlist, episode progress and alerts. Keep consumer and data-business offers separate. | **U:** Main site returned 403. Publisher [Android listing](https://play.google.com/store/apps/details?hl=en-US&id=com.reelgoodapp.reelgood) remains available, but last update shown is 2022-03-21; current service operation not tested. | Free-download consumer listing; current paid consumer tier not verified. [Reelgood for Business](https://data.reelgood.com/) is a separate data/business lead. |
| 2 | [Watchmode app](https://www.watchmode.com/app) | Direct: multi-service discovery, recommendations, smart watchlist, progress and availability alerts. | **A:** Official app page accessible/indexed; homepage intermittently 403; page undated. | Explicitly all app features free, no subscription. Separate [B2B API](https://api.watchmode.com/) has paid plans. |
| 3 | [Plex](https://www.plex.tv/plans/) | Direct overlap in discovery/watchlist/ratings; adjacent personal-media playback and household server management. | **A:** Live plans and [watchlist help](https://support.plex.tv/articles/universal-watchlist/); help modified 2025-07-09. | Free discovery layer; subscriptions and lifetime Plex Pass; Remote Watch Pass. Dynamic price retrieval incomplete. |
| 4 | [Queue](https://www.queue.co/) | Direct: tracking, recommendations, availability, ratings, calendar and collaborative lists. | **A:** Live site; publisher [US store listing](https://apps.apple.com/us/app/id1554132853) with current purchase options. | Free download plus Queue+ subscription SKUs and lifetime option. Feature gates incompletely public. |
| 5 | [Likewise / Pix Media](https://pix-media.com/mobile) | Direct: recommendations, lists, filters and social discovery across media. Treat Likewise app and Pix umbrella as one lineage. | **A:** likewise.com redirects to pix-media.com; official [FAQ](https://pix-media.com/faq) still identifies Likewise app. Terms effective 2025-11-12. | Optional Likewise Plus subscription; Pix editorial/newsletter premium is a separate offer, not tracker parity. |
| 6 | [Taste](https://www.taste.io/about) | Direct: personalized scores/recommendations, saved titles, provider preferences and couple matching. | **A:** Live site and publisher [store listing](https://apps.apple.com/us/app/taste-movie-tv-suggestions/id1361180197); latest listed iOS update 2025-03-05, so maintenance freshness is limited. | Free experience plus Premium subscriptions; exact current benefits not fully documented. |
| 7 | [MovieLens](https://movielens.org/) | Direct free benchmark for personalized recommendations, ratings, tags and expressive search; movie focus. | **A:** Live GroupLens/University of Minnesota service description; undated. | Non-commercial, ad-free research service; no consumer paid tier established. |
| 8 | [TMDB](https://www.themoviedb.org/) | Community catalog with ratings/lists/watchlists; also infrastructure used by many apps. | **A:** Official [developer documentation](https://developer.themoviedb.org/docs/faq) live; user-site fetch restricted in this run. | No user paid tier verified. API free for attributed non-commercial use; commercial licensing by sales contact. |
| 9 | [TVmaze](https://www.tvmaze.com/premium) | Direct TV progress, calendars, tags, stats; also a data API business. | **A:** Live Premium matrix and public payment pricing; undated. | Free + Bronze/Silver/Gold monthly or annual subscriptions. Business API plans separate. |
| 10 | [MyShows](https://en.myshows.me/pro/) | Direct regional/global movie/TV tracking, ratings, reviews, collections, calendar and scrobbling. | **A:** Live PRO page and detailed help; dated price change 2026-02-25. | PRO monthly, quarterly and annual; current web USD offers differ from RUB announcement. |
| 11 | [Next Episode](https://next-episode.net/premium) | Direct TV/movie progress, discovery, calendar, streaming availability and alerts. | **A:** Live pricing/matrix and administrator cap clarification dated 2026-07-03. | Website Premium annual; separate mobile Pro, Premium and voluntary patronage purchase entries. |
| 12 | [Showly](https://www.showlyapp.com/) | Direct app/client: progress, watchlist, lists, discovery, reminders and Trakt sync. | **A:** Current Apple/Google publisher listings; official repo now [trakt/showly](https://github.com/trakt/showly). | Free + Premium; Apple lifetime and monthly SKUs; Android Premium documented, prices not public in reviewed page. |
| 13 | [SeriesGuide](https://www.seriesgui.de/whypay) | Direct Android tracker, discovery, lists, calendar and external sync. | **A:** [Release 2026.4.3](https://github.com/UweTrottmann/SeriesGuide/releases/tag/v2026.4.3), published 2026-09-23; live help. | Free/open source + annual subscription choices. Legacy Pass unavailable to new buyers. Tips do not unlock features. |
| 14 | [Watcht for Trakt](https://apps.apple.com/us/app/watcht-for-trakt/id1396920723) | Direct Apple client benchmark: lists, tracking, ratings, calendar, reminders and IMDb import. | **A:** Current publisher listing identifies Trakt, Inc.; reachable listing is not a sync test. | Explicitly free and ad-free, optional contributions; backend entitlements remain separate. |
| 15 | [iShows TV → ShowPal TV](https://apps.apple.com/us/app/showpal-tv-powered-by-trakt-tv/id992387872) | Direct TV tracker/client; artwork, layouts, Trakt, ratings and discovery. Same app ID and iShows purchase label: one family. | **U:** ShowPal listing reachable but copyright/version history reflects older lineage; current operation untested. | Free download; “iShows Premium” currently listed at USD 0.00. No verified current paid upgrade. |
| 16 | [Sofa](https://www.sofahq.com/pricing) | Direct/adjacent cross-media lists, TV episode progress, calendar and stats; planner/podcast functions broader. | **A:** Live feature matrix; blog has 2026-10-14 release and 2026-08-26 pricing update. | Standard free + Super Sofa monthly/annual/lifetime; annual-subscriber lifetime upgrade. |
| 17 | [Sequel](https://www.getsequel.app/) | Direct/adjacent multi-media wishlist, episode tracking, ratings, collections, widgets and reminders. | **A:** Publisher store listing has current release history; terms updated 2026-04-17. | Free + Sequel+ individual/family subscriptions and lifetime variants. |
| 18 | [Marathon](https://marathontv.app/winding-down) | Former direct TV social tracker; useful portability/closure lesson, not active paid comparison. | **D:** Notice published 2025-03-03 says operation and data wound down 2025-03-31, 21:00 ET. | Historical donations and Marathon+ USD 1.99/month. No current purchasable offer. |
| 19 | [Cinexplore](https://play.google.com/store/apps/details?hl=en&gl=US&id=com.fidloo.cinexplore) | Direct Android discovery/tracking/client: lists, stats, filters, calendar and Trakt. | **A:** US Google Play publisher text updated 2026-09-19; localized indexed page showed 2026-07-29. | Contains ads and in-app purchases; Premium explicitly named in publisher release notes; current prices/gates incomplete. |
| 20 | [Must](https://apps.apple.com/us/app/must-for-movies-tv/id1071382493) | Direct social movie/TV ratings, watchlists, episode progress and personalized match score. | **U:** Free publisher listing and [official journal](https://journal.mustapp.com/) remain, but no strong current maintenance/operation proof. Do not infer closure from user reports. | Free listing, no paid tier verified; not proof every function is free. Must App/Must are one lineage. |
| 21 | [MovieBuddy](https://www.kimicoapps.com/moviebuddy) | Meaningful adjacent collection tracker: physical/digital inventory, watch status, personal ratings, lending and filters. | **A:** Current free and Pro publisher listings. | Free 50-movie version; one-time/lifetime Pro or separate paid Pro app. |
| 22 | [CLZ Movies](https://clz.com/movies) | Meaningful adjacent collection tracker with IMDb metadata, ratings, custom fields, ownership, wishlists and cloud. | **A:** Mobile update 11.2 in 2026-09; live product/shop pages. | Mobile and Web subscriptions/bundle. Movie Connect is the Web lineage; do not count separately. Legacy Collector desktop requires separate scrutiny. |
| 23 | [Flickmetrix](https://flickmetrix.com/) | Direct filter/search and watchlist benchmark with aggregated scores and saved states. | **U:** Live page exposes Browse, filters, watchlist/seen/liked/favorites/alerts navigation only; app behavior and current maintenance unverified. | Current paid model unknown; sparse public shell is not evidence of full free access. |
| 24 | [Movary](https://github.com/leepeuker/movary) | Direct self-hosted movie history, ratings, stats, import/export and playback scrobbling. | **A:** Official repository/docs available; README calls it experimental but usable. | Explicitly free/open source, no ads/tracking. Self-hosting cost and administration are separate. |
| 25 | [Yamtrack](https://github.com/FuzzyGrim/Yamtrack) | Direct self-hosted cross-media tracking, repeats, lists, shared lists, calendar and notifications. | **A:** Official repository and deployment/docs available. | AGPL self-hosted software, donations; no paid feature tier established. Hosting not included. |
| 26 | [Ryot](https://ryot.io/) | Direct self-hosted/hosted cross-media tracking, reviews, stats, alerts and integrations; fitness adjacent. | **A:** Live official docs/repo and unauthenticated pricing configuration. | Community free self-hosted; Pro self-hosted monthly/annual/lifetime; hosted Pro monthly/annual. |


## Inventory: additional discoveries

| # | Product / canonical link | Overlap and scope relevance | Status evidence | Commercial model evidenced |
| --- | --- | --- | --- | --- |
| 27 | [Moviebase](https://moviebase.app/) | Direct multi-platform discovery, tracking, lists, ratings, stats, community and Trakt sync. | **A:** Current store listing and terms effective 2026-09-10. | Optional Premium subscriptions/lifetime; stats and ad removal explicitly paid. |
| 28 | [CineTrak](https://play.google.com/store/apps/details?hl=en&gl=US&id=com.cinetrak.mobile) | Direct Android tracker/client: history, collections, stats, filters, calendar, offline saved data. | **A:** Publisher listing updated 2026-10-14; developer responses in September confirm continued work. | Ads + in-app purchases; precise current Premium matrix/prices not established. |
| 29 | [Hobi](https://hobiapp.com/help/what-hobi-premium-includes) | Direct movies/TV tracking, dated diary, reminders, calendar and Trakt sync. | **A:** Live 2026 help and publisher store listing. | Optional monthly/annual Premium; older lifetime leads not current US evidence. |
| 30 | [TV Forecast](https://tvforecastapp.com/) | Direct Apple tracker; shared progress, notifications, availability, iCloud and Trakt. | **A:** Current publisher store listing; press kit is explicitly July 2023. | Free cap + Premium monthly/annual/lifetime; current store prices differ from old press kit. |
| 31 | [FilmNoir](https://www.filmnoir.app/) | Direct Apple tracker/client: discovery, custom/smart lists, calendar, widgets and external sync. | **A:** Live tier page and publisher listing, with contradictory prices. | Free Viewer, Plus, Lifetime, Premier; tips also listed. |
| 32 | [Sofa Time, formerly TVSofa](https://www.sofatime.app/) | Direct full movie/TV tracker, availability, stats, lists and multi-service sync. Distinct from Sofa. | **A:** Terms updated 2026-10-08 and developer pricing change 2026-10-12. | Free + monthly/annual/lifetime Premium; older one-time-only press kit is stale. |
| 33 | [Listy](https://listy.is/) | Meaningful adjacent cross-media lists and TV progress, offline local data, tags and imports. | **A:** [Updates](https://listy.is/updates/) through 2026-10-05; current publisher store listing. | Free + Listy+ subscription/lifetime. Current complete gate matrix unavailable. |
| 34 | [My Movies by Binnerup](https://www.mymovies.dk/products/iphone-ipad.aspx) | Meaningful adjacent physical/digital catalog, watched episodes, ratings, filters, loans and parental controls. Not Blu-ray.com's similarly named app. | **A:** Live My Movies 6 iOS / My Movies 5 Android product pages. | Free 50-title tier; single/cross-platform subscriptions; iOS two-year non-renewing access; Android Pro purchase. |
| 35 | [MyAnimeList](https://myanimelist.net/membership) | Direct anime overlap: lists/progress/ratings, recommendations and social profile customization. | **A:** Official membership and FAQ retrieved by direct HTTP despite browser-tool failure; current [publisher app](https://apps.apple.com/us/app/myanimelist-official/id1469330778). | MAL Supporter monthly/annual and one-/three-month gifts; free core app. |
| 36 | [AniList / AniChart](https://anilist.co/forum/overview) | Direct anime overlap: progress, ratings, list/stat/profile ecosystem; useful customization benchmark. | **A:** Current official forum; main/donate pages blocked. Historical [donation announcement](https://anilist.co/forum/thread/2340) is not current price proof. | Free/ad-supported core; donation perks historically documented; present tiers/prices uncertain. |
| 37 | [Kitsu, formerly Hummingbird](https://kitsu.app/) | Direct anime/manga catalog and social tracking; regional/catalog-model benchmark. | **U:** Official site only yields JS shell; [official repository](https://github.com/hummingbird-me/kitsu-web) establishes identity, not current service health. | Open-source client; hosted-service paid model not verified. Not evidence that self-hosting the full service is supported. |
| 38 | [MyDramaList](https://mydramalist.com/) | Direct regional Asian-drama tracking, ratings and lists; potentially meaningful supporter offer. | **U:** Main/VIP pages blocked in this run; no dependable current matrix recovered. | VIP/supporter is an unverified lead here; no prices or entitlement claims adopted. |
| 39 | [BetaSeries](https://www.betaseries.com/en/) | Direct French/global TV/movie tracking, calendar, recommendations; API/business audience separate. | **A:** Live site calls app free; Club page only yielded shell. | Free-download consumer app; present paid Club/ad-removal terms unknown. [BetaSeries Pro](https://betaseries.pro/) is business research/media, outside consumer parity. |
| 40 | [SensCritique](https://www.senscritique.com/) | Direct French cross-media ratings, reviews, lists and discovery. | **A:** Live public site and catalogs; attempted subscription path did not establish an offer. | Consumer paid model not verified; do not infer “all free.” |
| 41 | [FilmAffinity](https://www.filmaffinity.com/en/main.html) | Direct Spanish/global ratings, recommendations and lists. | **U:** Official page returned 503; current paid/status details not independently established. | Unknown current consumer paid model in this audit. |
| 42 | [WATCHA PEDIA](https://pedia.watcha.com/en) | Direct Korean/global ratings, reviews, recommendations and collections. Distinct from WATCHA video subscription. | **A:** Live public ratings/catalog site. | No consumer paid PEDIA tier verified; WATCHA playback subscriptions excluded. |
| 43 | [Moviepilot](https://www.moviepilot.de/pages/faq) | Direct German rating predictions, watchlist and lists alongside editorial content. | **A:** Live FAQ and site. | FAQ describes free use; no current consumer feature subscription verified. |
| 44 | [TasteDive](https://tastedive.com/) | Direct/adjacent cross-media similarity, lists and social discovery. Separate from Taste. | **A:** Live official site/community navigation. | No paid consumer tier verified. [API](https://tastedive.com/read/api) is a separate developer concern. |
| 45 | [Watchworthy](https://watchworthy.app/) | Direct personalized recommendation and watchlist benchmark, operated by Ranker. | **A:** Official site and publisher stores reachable. | Explicitly free app; numeric caps and export not established. |
| 46 | [Refract](https://getrefract.app/) | Direct movies/TV/anime history, lists, ratings, AI discovery, stats and imports. | **A:** Live site/current publisher listings; books/games explicitly forthcoming. | Free tracker, no ads; optional Pro cosmetic supporter tiers. |
| 47 | [Bingers](https://bingers.app/) | Direct social tracking, recommendations, ratings/reactions, stats and alerts. Separate company/product from TV Time despite founder continuity. | **A:** Publisher listing release 0.2.5 shown “6d ago”; official imports page. | Free download with Hero/Legend/Icon purchase entries; current paid boundaries/periods incomplete. |
| 48 | [Suite TV](https://www.suitetv.app/en/about) | Direct tracker, ratings/reactions, lists, stats, calendar and community. | **A:** Official about page updated 2026-10-07; publisher listing current. | Free tracking + Gold cosmetics/ad removal; additional “Platinium” store entries not explained by website. |
| 49 | [BingeBoxd](https://apps.apple.com/us/app/id6749491360) | Direct episode/movie tracker, ratings/reviews, lists, calendar and friends. | **A:** Current publisher store/changelog; main website blocked. | Monthly/yearly IAPs; Plus artwork extra documented, full entitlement matrix missing. |
| 50 | [Movie Paradise](https://movieparadise.app/press) | Direct cross-platform tracker with stats, lists, discovery, imports and external sync. | **A:** Press fact sheet verified 2026-10-13; current stores/FAQ. | Free + monthly/annual/lifetime Premium. FAQ and newer announcement disagree on notes/settings gates. |

## Detailed paid offers and feature boundaries

### TVmaze

The public tier page uses dynamic Paddle pricing. Its six product IDs are visible in page source; the page's own [pricing JavaScript](https://static.tvmaze.com/js/premium.js?v=1723555952) calls Paddle's price lookup. The unauthenticated [US-country lookup](https://checkout.paddle.com/api/2.0/prices?product_ids=508109,508110,508111,508392,508393,508394&customer_country=US) returned the following on the access date. This is live payment-provider evidence, not the 2024 anniversary promotion.

| Consumer tier | USD monthly, US-country lookup | USD annually | Paid additions |
| --- | ---: | ---: | --- |
| Bronze | 4.00 | 36.00 | Ad/tracking removal; weekly/advanced calendar; personalized schedule; bulk marking; user API; alternate airdates; early access; achievement |
| Silver | 6.00 | 60.00 | Bronze + custom iCal, RSS, Silver badge/achievement |
| Gold | 11.00 | 120.00 | Silver + Gold badge/achievement, input into pending features/support |

The [live matrix](https://www.tvmaze.com/premium) establishes those gates. The broader [features page](https://www.tvmaze.com/features) advertises watchlist/progress, tags, countdown, ordinary calendar/schedule and watch statistics but mixes free/premium features: do not classify all calendars or feeds as free. The read/write user API can support account backup/automation. No list/library numeric cap, offline mode or household plan was documented. [Premium FAQ](https://www.tvmaze.com/faq/24/premium-faq) describes annual renewal, more expensive monthly options, VAT included and a 30-day trial; the inspected price response has `trial_days: 0`, so trial eligibility/activation is unresolved. No lifetime offer found.

### Next Episode

| Offer | Price/platform | Qualification |
| --- | --- | --- |
| Website Premium | **$24.95/year**, one-month trial | Web page does not spell out ISO currency/country; do not convert this into a universally available local price. No monthly/lifetime web offer documented. |
| Mobile Pro | **USD 4.99**, US Apple listing | Administrator identifies Pro as a separate one-time app upgrade. Exact current free/Pro matrix unavailable. |
| Mobile Premium | **USD 24.99**, US Apple listing | Store label omits period; do not assume identical billing/entitlement to web annual offer. |
| Optional Patronage | **USD 2.99/3 months; 5.99/6 months; 11.99/12 months** | Voluntary entries, not extra feature tiers established by the listing. |

Sources: [live web matrix](https://next-episode.net/premium), [US publisher listing](https://apps.apple.com/us/app/next-episode-track-tv-shows/id347009526), [administrator distinction](https://forum.next-episode.net/viewtopic.php?pid=183130). The latter's 2024 statement that availability was web-only is superseded as an app capability by the current store description; its current mobile pay gate remains unknown.

Web Premium adds ad removal/dark theme; site/email alerts for episodes, trailers, premieres, HD releases and cancellations; chart filters; following actors/creators/channels; country/provider availability; acquired status; watched/remaining-time stats; hidden specials/languages; iCal/RSS and custom tags. The [2026-07-03 administrator clarification](https://forum.next-episode.net/viewtopic.php?pid=190046) is more precise than “no series & movies limit”: free watchlists have **no show-count cap**, but Episodes displays episodes from **50 shows at once** and My Movies lists **25 movies**. Do not market a false 50-show total-library cap. Portable viewing-history export, offline and household entitlements are not established by calendar export or SharePlay support.

### MyShows

| PRO period | Live English web offer | Displayed crossed-out reference | Other first-party price evidence |
| --- | ---: | ---: | --- |
| Month | **$2.49** | $2.99 | RUB 139 from 2026-03-01 |
| Quarter | **$5.99** | $7.49 | RUB 299 / 3 months |
| Year | **$19.99** | $29.99 | RUB 959 / year |

Sources: [live English PRO page](https://en.myshows.me/pro/) and [2026-02-25 RUB change notice](https://en.myshows.me/news/12090/money-cant-buy/). Dollar symbol/site localization is explicit; USD/country selection was not confirmed at checkout. The ruble notice is regional/date evidence, not proof of the current Russian checkout. No lifetime/family offer documented.

| Family | Documented PRO versus ordinary account |
| --- | --- |
| Tracking & history | Backdate up to **3 days**; hide unwanted episodes/specials; repeat-watch counts; automatic marking from a player |
| Calendars & alerts | Google/Apple calendar via iCal |
| Library & lists | Own public/private curated collections; numeric list/item cap unspecified |
| Portability & backup | Download profile (ratings, bookmarks, friends, etc.) and notes as **XLSX** |
| Appearance & profile | Avatar, banner, profile block order, username changes and PRO badge controls |
| Household & social | Images/Markdown in comments; **10,000** characters versus **2,000** ordinary; reaction authors; discussion before release; reviews |
| Ads & privacy | Remove banners, retaining legal-streaming links; hide profile, social links, awards and friend list |

[Detailed help](https://en.myshows.me/about/pro/) specifies repeat marking up to **10 times** and a banner at least **2560×1440**, max **1.8 MB**, JPG. Review eligibility text requires watching over **50%** of released episodes. Help mixes a “following releases” qualifier with review availability; the PRO page advertises reviews now. Statistics are a base advertised tracking result; no blanket paid-statistics gate established. Sync services, player/scrobbler coverage, import formats, offline behavior and household licensing remain undocumented here.

### Showly

| Premium purchase | US Apple price | Billing certainty |
| --- | ---: | --- |
| Lifetime | USD 14.99 | Explicit lifetime label |
| Monthly | USD 1.99 and USD 5.99 | Both appear; active segmentation/eligibility not explained |
| Android Premium | Unknown | Publisher advertises upgrade; no public numeric price/complete current period list recovered |

[Official site](https://www.showlyapp.com/) and [US Apple listing](https://apps.apple.com/us/app/track-shows-movies-showly/id6739016219) establish the app, sync and purchases. [Google Play publisher text](https://play.google.com/store/apps/details?hl=en&id=com.michaldrabik.showly2) explicitly names paid news, light theme, custom images and quick rating. Official Android [Premium strings](https://github.com/trakt/showly/blob/master/ui-premium/src/main/res/values/strings.xml) also describe transparent widgets and compact/grid collection layouts, custom posters/fanart from a gallery or URL, and quick rating after watched marking. This is source-level Android evidence; do not assume iOS parity or shipped-version identity.

Tracking, custom lists, reminders/widgets and Trakt sync are advertised generally. Their numeric caps, ad-removal gate, export/backup coverage, offline access and family sharing are not established by that general description. The current repository/publisher belongs to Trakt; predecessor `michaldrabik/showly-2.0` is not another competitor. Paying Showly does not establish entitlement to backend paid capabilities.

### SeriesGuide

Current [subscription help](https://www.seriesgui.de/whypay) documents **multiple annual support choices with identical feature unlocks**, a **30-day trial**, and billing through Google Play/Amazon. It does not publish the current tier names, local amounts or a monthly option. Current prices are **unknown**; the 2021 USD/EUR 4.99 discussion is not used as current pricing. [Pass help](https://www.seriesgui.de/help/fix/x-pass) explicitly says the one-time Pass is **unavailable for new users**, while prior purchases can be restored. PayPal tips unlock nothing.

| Free / general documented use | Subscription additions |
| --- | --- |
| Independent open-source tracker, discovery, watched/collection state and Trakt integration; local file export/import and auto-backup are documented in the [help index](https://www.seriesgui.de/help) | SeriesGuide Cloud for shows/lists/movies; episode notifications; multiple watches per episode/movie; more list-widget contents/transparency; home-screen show shortcuts |

The [sync comparison](https://www.seriesgui.de/help/how-to/backup/sync) matters for migration: Cloud syncs shows, lists and movies. Trakt excludes favorite/hidden/skipped state; the Lists section does not sync and shows are not added automatically. Connecting Cloud and Trakt together disables downloading/check-in sync from Trakt, although outgoing actions still go there. This is not interchangeable full-cloud parity. No numeric library/list cap, household offer or universal offline guarantee established. Current [release](https://github.com/UweTrottmann/SeriesGuide/releases/tag/v2026.4.3) validates continued maintenance, not entitlement prices.

### Sofa / Super Sofa

| Plan | USD, in-app App Store; regional variation acknowledged |
| --- | --- |
| Standard | Free, no account/trial/ads |
| Super Sofa | **5.99/month; 49.99/year; 249.99 lifetime** |
| Lifetime Upgrade | **199.99** for current/former annual subscribers |

The current [pricing matrix](https://www.sofahq.com/pricing) explicitly includes family purchase sharing with **up to five family members**, including lifetime; each keeps a separate library. Older Personal/Family products are not separate current tiers.

| Free | Super Sofa |
| --- | --- |
| Unlimited lists/groups; custom categories; ordinary sorting/filtering; five tracking modes, episode tracking but **2 concurrent tracked items**; widgets; logbook/date edits; media calendar; iCloud sync; backups/import/export; Shortcuts | Unlimited concurrent tracking; episode reminders; smart/pinned lists/items; list covers/layouts; custom ratings/dates/tags; notes and editable custom items; stats/advanced logbook filters/location history; **100+ themes**, **70+ icons**; enhanced streaming/service links |

The pricing page also sells planner enhancements (trip map, budget, weather, attachments, reminders); these are adjacent, not core movie parity. Free podcast playback/offline downloads are audio features, not offline movie playback. [Blog](https://www.sofahq.com/blog) dates the new-customer price change **2026-08-26** and library CSV import/export improvements **2026-05-28**. Offline tracker behavior, export field fidelity and list collaboration entitlements require further verification.

### Sequel / Sequel+

| Offer visible in [US Apple listing](https://apps.apple.com/us/app/sequel-media-tracker/id1630746993) | USD price | What is established |
| --- | ---: | --- |
| Individual Sequel+ | 2.99; 19.99 (listed twice) | Subscription labels omit periods in public listing; monthly/annual mapping is plausible but **not verified** |
| Family Plan | 4.99; 34.99 | Same period ambiguity; family member count not established |
| Individual Lifetime | 99.99 | Explicit lifetime |
| Lifetime Family | 174.99 | Explicit family lifetime |

The [Croatian storefront](https://apps.apple.com/hr/app/sequel-media-tracker/id1630746993) instead lists EUR 2.99/19.99 individual, EUR 4.99/35.99 family, EUR 99.99 lifetime and EUR 184.99 lifetime family. These are country/platform observations, not interchangeable US prices. Terms updated **2026-04-17** describe auto-renewal but do not resolve each SKU period.

| Free | Sequel+ |
| --- | --- |
| Explicitly unlimited saved/tracked items, **5 collections**, ratings, search/basic metadata/filmographies/discovery, quick-access widget and iCloud sync | Trakt sync, where-to-watch, release reminders, Magic Lookup/AI web capture, unlimited collections, external-service links, Markdown notes, advanced countdown/Watch Next widgets and alternate icons; game completion-time data adjacent |

Current store changelog documents imports from TV Time/IMDb/Letterboxd/Simkl and in-app export (2026-08-23); it does not establish their plan gate. Import matching/order fixes and Trakt disconnect fixes show why a published import option is not proof of lossless migration. Current statistics, offline, export schema and group collaboration limits remain unknown.

### Cinexplore

[US Google Play](https://play.google.com/store/apps/details?hl=en&gl=US&id=com.fidloo.cinexplore), updated **2026-09-19**, establishes ads/in-app purchases and a rich overlapping app: rewatch history, ratings/reviews/notes, personal/community lists, stats, calendar and personalized notifications (including people), provider/genre/year/rating filters, local backup/restore, and Trakt sync for history/ratings/lists.

The [publisher's localized release notes](https://play.google.com/store/apps/details?hl=en_SG&id=com.fidloo.cinexplore), showing **2026-07-29**, explicitly reserve **reordering ratings and synopses on movie/show/season/episode screens** for Premium. The current description no longer supplies a complete free/Premium table. Monthly, annual and lifetime prices found in third-party articles are **not adopted as current verified offers**. Price, currency, country-specific billing periods, list caps, ads removal, statistics gate, automatic versus manual backup, offline and household terms remain **unknown**. Do not turn the generally advertised feature list into a free-feature list or claim all features are paid. This is a high-priority follow-up gap because its overlap is substantial.

### MovieBuddy

| Option | US Apple evidence |
| --- | --- |
| Free MovieBuddy | **50 movies**; publisher explicitly says all Pro features apart from capacity |
| Pro lifetime IAP | **USD 9.99 once** |
| Separate MovieBuddy Pro app | **USD 9.99 upfront**; same product family |

[Free listing](https://apps.apple.com/us/app/moviebuddy-movie-tracker/id965645508) establishes the cap and unlimited paid storage. [Pro listing](https://apps.apple.com/us/app/moviebuddy-pro-movie-tracker/id965644953) documents barcode/manual/CSV entry; owned/wanted/borrowed/previously owned categories; tags/notes/ratings; multi-criteria filters and multilevel sorting; lending; bulk edits; watched status/history; duplicate detection; grid/list views and Markdown notes.

**Portability & backup / Device & offline:** CSV/PDF/HTML export, cloud-file backups, iCloud/Dropbox multi-device sync; library stored locally; universal Apple-device purchase. Local storage is not a tested offline guarantee. **Household & social:** Lending and library sharing are meaningful; Apple purchase-family support does not establish a collaborative household database. No subscription, calendar/alerts or recommendation tier established. This is a capacity paywall with broad free functionality, not evidence that all catalog filters are individually premium.

### CLZ Movies

| Current shop offer | USD monthly | USD yearly | Evidence scope |
| --- | ---: | ---: | --- |
| Mobile, iOS/Android | 1.95 | 19.95 | [Official shop](https://shop.clz.com/movies?from=mobile) |
| Web | 3.95 | 39.95 | Same shop; editable cloud/web app, distinct from free cloud viewer |
| Mobile + Web bundle | Not shown | 49.90 | Versus USD 59.90 separate total |

The [US Apple app](https://apps.apple.com/us/app/id314588585) instead describes **USD 1.99/month or 19.99/year**: platform/store difference preserved. Browser product pages also rendered **EUR 19.95/year mobile, EUR 39.95/year Web**, but did not establish billing country. Both [mobile](https://clz.com/movies/mobile) and [Web](https://clz.com/movies/web) describe a seven-day trial. No permanent free editable tier or new lifetime purchase documented.

| Family | What the paid product documents |
| --- | --- |
| Library & lists | Physical/digital inventory, wishlists, multiple collections (including different people), barcode/title/IMDb lookup, personal location/owner/purchase fields and custom fields |
| Tracking & history / appearance | Watched/personal ratings, editable metadata, own front/back cover art, backdrop/trailers; multiple layouts, sorting/grouping and customizable columns |
| Sync & backup / devices | CLZ Cloud backup, cross-device sync and public sharing; shop permits as many mobile devices or Web clients as desired; Windows Collector described as one PC |
| Portability | [Staff instructions](https://club.clz.com/t/feature-request-add-links-to-export-options/1662) route mobile users through CLZ Cloud to CSV/TXT/PDF export; multi-value links do not fit flat CSV |

Shop says active subscription is needed for software/services but expired users retain access to their data; editing/lookup/export rights after expiry need confirmation. No documentary numeric title cap, calendar/alert tier, recommendation engine or group collaboration entitlement established. Legacy Movie Collector desktop is not assumed equivalent to current Mobile/Web pricing.

### Ryot

The page initially rendered “Loading pricing.” Its public client fetches **[/api/config](https://ryot.io/api/config)**; on access that returned the exact amounts below, and the [rendering component](https://ryot.io/assets/Pricing-BbstLzdP.js) labels the periods. Dollar denomination is displayed but ISO currency/country is **not stated** by this configuration, so treat USD as unconfirmed until checkout.

| Product | Free | Monthly | Annual | Lifetime |
| --- | --- | ---: | ---: | ---: |
| Self-hosted Community / Pro | Community edition | $4 | $35 | $120 |
| Hosted Pro Cloud | No permanent free cloud tier documented | $6, 7-day trial | $50, 14-day trial | None documented |

All paid variants advertise the same Pro features. The top signup copy also says 14-day trial generally; monthly configuration specifically says seven. [Pricing promise](https://ryot.io/pricing-promise/) protects an active subscriber's rate; lapsing and rejoining uses current price.

The [feature matrix](https://ryot.io/features/) marks Pro for custom collection placement/personalization, recommendations based on favorites/history, manually specified time spent, saved filter presets, sharing links, collection collaborators and music integrations. Ordinary tracking/repeats, public/private reviews, consolidated statistics, calendar, availability, reminders, release/actor notifications, imports (**16 sources**) and integrations (**13 services**) are advertised without a PRO marker. Promotional footer says “advanced analytics” is Pro while the itemized matrix leaves consolidated stats unmarked: preserve that ambiguity.

[Official repo](https://github.com/IgnisDa/ryot) names Plex/Jellyfin/Emby/Kodi tracking, imports and GraphQL API. [Installation docs](https://docs.ryot.io/) say an expired/invalid Pro key falls back to compatible Community edition. Self-hosted data remains the operator's responsibility; hosting, backups, maintenance, API keys and offline behavior must not be equated with a free hosted account. Fitness-only premium features are outside movie parity.

### Taste

| Purchase in [US publisher listing](https://apps.apple.com/us/app/taste-movie-tv-suggestions/id1361180197) | USD price |
| --- | ---: |
| Taste Premium Monthly | 2.99/month |
| Taste Premium Annual | 11.99/year and 19.99/year |
| Taste Premium, period unspecified | 11.99 |

No documented lifetime/family plan found. Duplicated annual offers are not one guaranteed public price. The listing's latest update is **2025-03-05**. Its description advertises personalized recommendations, learning from ratings/swipes, partner matching and streaming services; it **does not map those capabilities to Premium**. [Official FAQ](https://www.taste.io/about) explicitly discusses cancelling iTunes/Play/web Premium and removing a partner, despite describing a free recommendation/watchlist experience. That is evidence of paid accounts, not evidence of their exact current benefits.

Paid feature gates, swipe/recommendation quotas, list/library caps, statistics windows, filters, provider limits, alerts, imports/exports/backups, offline and group limits are **unknown**. The old market baseline is not used to fill those gaps. Taste must not be labeled wholly free or credited with a verified free equivalent of its own Premium offering without a fresh first-party matrix.

### Queue

| US Apple purchase label | USD amounts listed |
| --- | --- |
| Monthly Plan | 3.99/month |
| Annual Plan | 34.99/year, repeated entry |
| Queue+ Annual | 9.99, 19.99, 29.99/year; 29.99 repeated |
| Queue+ Weekly | 4.99 or 7.99/week |
| Lifetime | 100.00 once |

[Publisher listing](https://apps.apple.com/us/app/id1554132853) establishes these purchase entries, but not which are current checkout defaults. The same source advertises streaming-account history connection, text-list paste import, episode calendar, reminders, custom/collaborative lists, a friend widget, pair swiping, spinner and provider coverage in **100+ countries / 200+ services**. Those numbers are coverage claims, not list quotas.

An identified [publisher reply dated 2026-05-13](https://www.reddit.com/r/queueapp/comments/1tavyba/search_suggestions_more/) says Queue+ removes ads on iOS and was not then offered on Android. It is dated platform evidence, not proof Android is still excluded today. The current complete free/paid boundary, custom-list counts, history connection limits, stats, export/backup and family entitlements remain unknown. Apple “some purchases may be shared” does not verify a shared Queue+ household plan. Keep unrelated agency/event/clipboard apps named Queue out of the inventory.

### Likewise Plus / Pix

| Offer | Price / period / platform |
| --- | --- |
| Likewise Plus Monthly | **USD 2.00/month**, US Apple listing |
| Likewise Plus Yearly | **USD 20.00/year**, US Apple listing |

[Publisher listing](https://apps.apple.com/us/app/likewise-movie-tv-book-recs/id1264195462) documents lists, provider/genre filters, daily recommendations and community. The official [FAQ](https://pix-media.com/faq) answers were present in delivered Next.js page data despite the browser text extractor showing only headings. It states Plus adds more personalized recommendations, review summaries, instant AI Ask responses, an entertainment-style profile, a personalized newsletter and **no ads**. No numeric free/Plus AI allowance, list cap, stats/calendar/export or lifetime/family tier established. FAQ says the app is available only in **US and Canada**.

The [Pix mobile page](https://pix-media.com/mobile) still calls the download Likewise. Pix Plus premium editorial editions are a different offer; subscription amounts/complete terms were not recovered and are **unknown**, with low tracking-parity relevance. Do not count Pix, Likewise and the AI assistant as three independent tracking products.

### Plex: discovery overlap separated from server playback

**Overlapping capabilities:** The [Universal Watchlist help](https://support.plex.tv/articles/universal-watchlist/) describes a consolidated movie/show list, provider availability and a filterable grid. Individual seasons/episodes cannot be added as watchlist entries. **Plex Pass explicitly gates generating the user's/friends' watchlist RSS URLs.** Ordinary watched/ratings sync is an opt-in account function, described in [official Discover Together support](https://forums.plex.tv/t/discover-together-public-release/857227). Watching on an external streaming service does not automatically clear Plex watchlist entries; manual management is documented. Export formats beyond RSS and broad consumer import parity are not established.

| Personal-media plan | Current public price evidence | Scope qualification |
| --- | --- | --- |
| Free | No subscription for local-network personal-media playback | Separate from paid remote/server enhancements |
| Remote Watch Pass | Indexed official [plans page](https://www.plex.tv/en-gb/plans/?lang=en-gb) says **USD 2.99/month; 29.99/year**, 14-day trial | Remote playback, not paid discovery filtering |
| Plex Pass | Same indexed page says **USD 6.99/month; 69.99/year; 249.99/5 years; 749.99 lifetime** | **Provisional price evidence:** live page returned price errors/403 on subsequent reads |

The 2025 [price announcement](https://www.plex.tv/en-gb/blog/important-2025-plex-updates/) says lifetime **USD 249.99** after 2025-04-29, contradicting the more recent indexed plans text. Preserve the conflict; do not publish the announcement's lifetime figure as today's verified price. The apparent new five-year option needs live checkout-free confirmation. Regional page path does not mean GBP: returned text expressly said USD.

[Current plans](https://www.plex.tv/plans/) advertises Plex Pass downloads, intro/credit skip, hardware transcoding, DVR, editions, managed household/parental tools, server monitoring, themes and webhooks. These are meaningful adjacent paid functions, but they require personal media/server context. Neither Pass removes ads from Plex's free on-demand/live-TV service. No claim of Goodwatch equivalence to Plex streaming, downloads, DVR or media-server hosting is supported.

### Moviebase

| Premium US Apple entries | Price |
| --- | --- |
| Weekly | **USD 1.99 or 2.99/week** |
| Monthly | **USD 3.99/month**, repeated |
| Yearly | **USD 13.99/year**, repeated; additional generic Premium USD 13.99 entries have unspecified period |
| Lifetime | **USD 55.99**, repeated |

[Current US listing](https://apps.apple.com/us/app/id6795568303) explicitly permits unlimited movie/TV tracking free and describes optional ad removal/extras. The [publisher FAQ](https://moviebase.app/faq) and own [product comparison](https://moviebase.app/resources/moviebase-vs-watcht) identify **viewing statistics and ad removal** as Premium; that comparison is used only for Moviebase's own entitlements. The [Luxembourg store](https://apps.apple.com/lu/app/moviebase-movie-tv-tracker/id6795568303) had EUR weekly 0.99/1.99, monthly 2.99/3.99, yearly 10.99/12.99, lifetime 32.99/51.99. Platform/storefront/offer differences unresolved.

General documented functions include rewatch dates, calendar/reminders, public/unlisted/private lists, Trakt sync/check-ins, custom artwork/share cards, and imports from TV Time, Letterboxd, IMDb, Trakt, Simkl and SeriesGuide. Do not infer their gate or unlimited list count from unlimited tracking. Exact current matrix for stats windows, cloud backup, exports, offline, household, custom layouts and provider filters remains incomplete. [Terms](https://moviebase.app/terms), effective 2026-09-10, expressly say functionality varies by platform/version/subscription/connected service.

### CineTrak

[Current publisher listing](https://play.google.com/store/apps/details?hl=en&gl=US&id=com.cinetrak.mobile), updated **2026-10-14**, documents ads and in-app purchases. It lists custom/watchlists, watched episodes/ratings, owned media collections, runtime/genre/language filters, calendar/reminders, availability, social discovery, time/activity stats, achievements, themes/widgets and **offline browsing of saved data** alongside Trakt sync.

Current tier names, monthly/annual/one-time prices and exact free/Premium gates were **not publicly established**. The developer's 2026-09-14 store reply attributes a reported **100-item** limitation to Trakt; it is not evidence of a 100-film CineTrak watched-history cap. Another developer reply references changed Trakt limits/workarounds. Paying this client does not prove backend limits are removed. Export appears in customer testimony but was not verified in publisher documentation, so export format/availability remains unknown. Official website fetch failed; do not classify the app as abandoned when the store documents a current release.

### Hobi

| Premium offer | US Apple price |
| --- | --- |
| Premium Monthly | **USD 9.99/month** |
| Premium Yearly / Hobi Yearly Premium | **USD 19.99/year**, two named entries |

Source: [publisher listing](https://apps.apple.com/us/app/id1387915223). [Current Premium help](https://hobiapp.com/help/what-hobi-premium-includes) describes a **seven-day trial** and Apple/Google billing. Older localized lifetime listings are not proof that lifetime is currently offered to new US users; current Android prices are unknown.

| Free / generally documented | Premium |
| --- | --- |
| Tracking and community/basic experience; **no ads on any plan**; [free TV Time import](https://hobiapp.com/); base reminders and Trakt sync advertised | Unlimited movies beyond an **undocumented free movie cap**; home-screen widget; calendar sync; custom reminder timing; change watch date; advanced sorting and watchlist archive |

[Movie help](https://hobiapp.com/help/track-movies) confirms a free limit but supplies no number. Do not substitute an old “10 shows” cap from reviews. Current site advertises stats/diary and server-side two-way Trakt sync, but current paid cadence/complete library limits are not specified. Export/backup formats, offline write access, household and watch-statistics gates remain unknown. Older reviews describing paid statistics or ad removal conflict with current help's narrower premium list/no-ads statement; use current first-party help.

### TV Forecast

| Offer | Current US Apple listing | Older press kit, explicitly July 2023 |
| --- | --- | --- |
| Premium subscription entries | **USD 2.49 and 14.99**, periods omitted | $0.99/month; $9.99/year |
| Premium Lifetime | **USD 49.99** | $29.99/forever |

Sources: [US listing](https://apps.apple.com/us/app/id1454200438), [official press kit](https://tvforecastapp.com/press/). The higher subscription entry is likely annual but its current period is **unverified**; the old press kit cannot prove today's billing interval/price.

The press kit explicitly limits free use to **5 shows and 5 movies** and gates unlimited tracking and **Trakt sync** with Premium. Current listing advertises iCloud sync, movie/episode notifications, availability, duration sorting and **sharing a show with friends/family to sync progress**. Its current wording omits a full gate matrix; continuing validity of the 2023 cap and exact gating of group progress must be confirmed before external comparison. No current import/export schema, statistics tier, offline behavior or household purchase terms established. Store Family Sharing wording is generic and does not prove every purchase is shareable.

### FilmNoir

| Offer | Live official website, USD | US Apple purchase inventory |
| --- | --- | --- |
| Viewer | Free | Free download |
| Plus | **2.49/month; 12.99/year** | **3.99/month**, annual **12.99 or 19.99**, weekly **0.99 or 1.99** |
| Lifetime | **17.99 once** | **34.99 or 59.99** |
| Premier | **44.99/year** | Premier Supporter **44.99**, period not specified there |
| Tips | Not a feature tier | Small **0.99**, Medium **2.99** |

Sources: [live website](https://www.filmnoir.app/), [US publisher listing](https://apps.apple.com/us/app/id1528417240). **Do not silently select the cheapest SKU:** web/store disagreement is unresolved.

Free Viewer includes Trakt sync, watchlist, ratings, discovery and availability. Plus adds **smart/custom lists, TV calendar, premium widgets, history backfill, hidden shows/seasons and premium icons**. Premier adds early access/TestFlight betas. Both sources say no ads; ad removal is not the paid differentiator. Website says one purchase covers Apple clients and now supports SIMKL, while its repeated footer still says a free Trakt account is required. Treat this as an integration-copy contradiction, not proof that accountless tracking works. List/library numeric caps, export format and offline/group limits are undocumented. Cloud backup through a connected tracker is not a local restorable export.

### Sofa Time / Premium

| Purchase in current [US Apple listing](https://apps.apple.com/us/app/id1491037404) | USD amount |
| --- | --- |
| Premium Monthly / Monthly Offer | **2.29/month** |
| Premium Annual / Annual Offer | **14.99/year** |
| Premium Lifetime | **37.99**; offer **30.49** |
| Older lifetime SKUs still listed | **7.99 and 9.99**; eligibility unknown |

[Terms updated 2026-10-08](https://www.sofatime.app/terms.htm) confirm subscriptions plus lifetime and account-linked new plans. The developer's [2026-10-12 change notice](https://www.reddit.com/r/sofatimeapp/comments/1x416es/premium_pricing_changes_and_the_future_of_the_app/) says rollout is gradual and existing lifetime users retain access. The [August press kit](https://www.sofatime.app/press/) still says one-time-only: **stale monetization text**, not evidence against October subscriptions. Android amounts and cross-platform purchase carryover need confirmation.

The developer's [2026-08-05 full breakdown](https://www.reddit.com/r/TVTime/comments/1vgdhzq/sofa_time_full_feature_breakdown_tv_time_import/), linked by that press kit, establishes the following dated feature boundary. Its obsolete billing paragraph is superseded, while newer legal text does not supply a replacement full feature matrix.

| Free, dated developer matrix | Premium, dated developer matrix |
| --- | --- |
| Core movie/episode tracking, ratings/favorites, discovery, profiles/comments/replies/translation; TV Time import; Sofa Time Cloud; **1 external tracker**; **2 offline lists**; **1 saved filter**; current-week calendar; social alerts; basic stats; Up Next widget; **5 uses of each AI tool** | Detailed availability/deep links/availability alerts/showtimes; smart/automatic lists; advanced filters and bulk actions; rewatch tools/notes; calendar navigation/release alerts; advanced stats/widgets/Up Next/layouts/themes/icons; unlimited offline lists/saved filters/AI; multiple external services; backup restore/download/sharing |

Three optional AI tools are Search, Similar Titles and Recommender. Imports can preserve dates, title/episode ratings, reactions, characters and comments depending on source file; supported external services include Trakt, Simkl and MDBList. Do not interpret offline-list storage as full offline metadata/search. **No ads** is stated by current terms for the whole app. Household purchase entitlements are not established. The public feature boundary should be rechecked because it predates the new pricing rollout.

### Listy / Listy+

| US Apple purchase inventory | USD amounts |
| --- | --- |
| Weekly | 1.99/week |
| Monthly | 1.99 or 2.99; explicitly named Listy+ Monthly 4.99 |
| Yearly | 9.99 or 10.99; explicitly named Listy+ Yearly 24.99 |
| Lifetime | 39.99; “Lifetime 50%” 14.99; explicitly named Listy+ Lifetime 79.99 |

Source: [publisher listing](https://apps.apple.com/us/app/listy-watchlist-tracker/id1496035097). These are simultaneous SKU entries, not established offer eligibility. It explicitly advertises unlimited lists/folders, local private storage, **fully offline** use, iCloud sync and one-tap export, with no account required; it does not consistently assign every feature to free/Plus.

The [official release index](https://listy.is/updates/) records Listy+ adding item notes, biometric list locks, automatic iCloud Drive backup and custom list icons in 2022, lifetime in 2023, and Android Plus in 2024. Current free/paid allocation of these features and newer tags/public lists/episode progress is **not fully revalidated**. [Current export help](https://listy.is/help/) describes `.listy` files; release index also documents JSON/CSV export. Do not promise identical schemas or cross-platform sync from those statements. October 2026 episode progress is relevant; books, wine and task categories are adjacent. No collaborative household license or current statistics/alert tier established.

### My Movies by Binnerup

| Platform/offer | USD | EUR | GBP | Period |
| --- | ---: | ---: | ---: | --- |
| iOS 6 single platform | 19.99 | 22.99 | 19.99 | Annual |
| Cross-platform Premium | 49.99 | 59.99 | 49.99 | Annual |
| iOS non-renewing access | 39.99 | 45.99 | 39.99 | **24 months**, then read-only |
| Android 5 single platform | 19.99 | 22.99 | 19.99 | Annual |
| Android 5 Pro | 39.99 | 44.99 | 39.99 | App purchase; not promised lifetime upgrades |

Sources: current [iPhone/iPad](https://www.mymovies.dk/products/iphone-ipad.aspx) and [Android](https://www.mymovies.dk/products/android.aspx) pages. They say monthly single-platform subscriptions exist but omit current amounts. The [US iOS listing](https://apps.apple.com/us/app/id1565797040) includes USD 1.99 generic Unlimited entries without periods, so a current monthly price remains unconfirmed. Country-specific store equivalents are not established by publisher currency options.

Both platforms give **50 titles free**, syncing only the first 50 from a larger collection. Paid features share the same set; the difference is payment/platform coverage. Cataloging includes physical/digital movies/TV, barcode input, watched dates/episodes, loans, advanced filters/sorting, artwork, parental controls and online collection sharing. Cross-platform covers iOS, Android, Windows, macOS and Web; named upcoming TV clients are not counted as shipped. Import and PDF/email/online-list sharing are advertised, not verified machine-readable full-history export.

The [upgrade page](https://www.mymovies.dk/products/ios6/support/my-movies-6-upgrade-options.aspx) still offers discounts “until December 31” without a clear year: cross-platform USD 24.99/EUR 29.99/GBP 24.99 annual; iOS USD 12.99/EUR 14.99/GBP 12.99 annual; two-year USD 19.99/EUR 22.99/GBP 19.99. These are **eligibility/date-ambiguous upgrade offers**, not current standard prices. Two-year access is not lifetime. Windows point-based licenses and installer programs are separate professional/legacy products, outside a hosted-discovery parity promise.

### MyAnimeList / MAL Supporter

| Offer | Official membership page price |
| --- | --- |
| Monthly | **$2.99/month** |
| Annual | **$29.99/year** |
| Gift | **$2.99/1 month; $8.97/3 months** |

[Membership page](https://myanimelist.net/membership), retrieved by direct HTTP on access date, is undated and uses dollar pricing without an ISO currency code or country selector in the fetched text. Currency/billing country therefore remain unconfirmed; do not treat these as verified US-localized checkout prices. [FAQ](https://myanimelist.net/membership/faq) documents desktop/mobile benefits when signed in.

Supporter adds custom About Me font/colors/background; favorites **10 → 20 per category**; profile status-bar colors, optional badge and forum title; ignored forum users **30 → 60**; display-ad removal. Embedded video advertising and advertorials remain. No paid library-entry limit, rating/recommendation gate, diary export or statistics tier established. This is a useful **appearance/profile and capacity benchmark**, not proof anime progress itself requires subscription.

Portability/expiry caveat: FAQ says extra favorites are removed **14 days after Supporter ends**; restarting later does not automatically restore them. This is a specific destructive downgrade behavior worth avoiding in an alternative. Generic anime-list XML/API portability still requires source/field verification; no import/export was exercised here.

### Refract Pro

[Official FAQ](https://getrefract.app/) explicitly says all tracker functions are free, with Pro limited to **badges, profile frames and name styles**; no ads. Imports/full-library export and cross-device sync are advertised. Books/games are upcoming, not shipped evidence.

| US Apple cosmetic/support purchase label | USD prices listed |
| --- | --- |
| Supporter | 0.99; 8.99 |
| Spark | 2.99; 24.99 |
| Glow | 3.99; 44.99 |
| Beam | 8.99; 89.99 |
| Prism | 17.99; 179.00 |

[Publisher listing](https://apps.apple.com/us/app/refract-movies-tv-anime/id6760271872) does **not label the periods** for these paired amounts. Do not infer monthly/annual or lifetime from price pairs. Per-tier cosmetic differences, numeric list/library constraints and purchase sharing are undocumented. Its own competitor-comparison claims were not adopted as facts about excluded competitors.

### Bingers

| US Apple purchase label | USD prices listed |
| --- | --- |
| Hero | 1.99; 19.99 |
| Legend | 2.99; 29.99 |
| Icon | 4.99; 49.99 |

[Current publisher listing](https://apps.apple.com/us/app/bingers-tv-movie-tracker/id6792080029) establishes these names/amounts; **billing periods, per-tier benefits and lifetime availability are not public in that listing**. Core advertised overlap includes movie/episode tracking, ratings/emotions/character votes, recommendations, statistics and release alerts. Changelog documents custom posters, messaging, rewatches and multi-app importing, but does not identify which are paid. Caps, ads, export/backup and household entitlements remain unknown. [Official import guide](https://bingers.app/import) documents accepted exports; it is not proof of continuous external sync or reverse export. Founder continuity with TV Time is not product/account continuity.

### Suite TV Gold and unresolved Platinium entries

| Source / storefront | Gold monthly | Gold annual | Other |
| --- | ---: | ---: | --- |
| [Official about](https://www.suitetv.app/en/about), updated 2026-10-07, France | EUR 1.99 | EUR 17.99 | No lifetime documented |
| Same page, United States | USD 1.99 | USD 14.99 | Publisher's regional web claim |
| [US Apple listing](https://apps.apple.com/us/app/id6786914798), accessed 2026-10-19 | USD 2.99 | USD 19.99 | “Suite TV Platinium” **USD 5.99 and 49.99**, periods/benefits omitted |

Preserve web/store conflict and the unexplained extra tier; do not assume all customers receive website prices. The official about page says free includes tracking, imports, Up Next/upcoming/release notifications, device sync, ratings/reactions/comments/friends/shared lists, statistics and discovery. Gold adds themes/accent colors/icons/custom posters and profile customization (avatar ring, animated avatar, text colors/name font/stickers/badge), and removes ads. Free banners may appear on secondary screens, not library/episode lists. Data export includes library/comments/profile in one file, with no format supplied. Numeric list/library caps, offline and household purchase entitlements remain unknown.

### BingeBoxd

| Current [US Apple entries](https://apps.apple.com/us/app/id6749491360) | USD |
| --- | ---: |
| Monthly | 2.99/month |
| Yearly | 29.99/year |

The publisher description covers episodes/movies, calendar, ratings/reviews, lists and social activity. Current publisher release notes explicitly name **Plus: choose an episode image**; broader custom poster/backdrop functions are advertised but their gate is not fully documented. No complete current free/Plus comparison, free list/history cap, statistics plan, ads/offline behavior, export or family license verified. The main site returned 403; terms merely saying premium “may” be sold do not resolve these gaps. Imports from Trakt/TV Time are documented in release notes; imported field fidelity was not tested.

### Movie Paradise

| Premium option | US Apple price |
| --- | ---: |
| Monthly | **USD 1.99/month** |
| Annual | **USD 9.99/year** |
| Lifetime | **USD 29.99 once** |

Sources: [publisher listing](https://apps.apple.com/us/app/id6737476189), [October 2026 press facts](https://movieparadise.app/press). The public [FAQ](https://movieparadise.app/faq) only extracts as questions; its delivered [official FAQ JavaScript](https://movieparadise.app/_next/static/chunks/app/faq/page-05c7d4610bc93eda.js) contains answers, inspected without authentication.

| Free | Premium / Lifetime |
| --- | --- |
| Explicitly unlimited tracking; **9 custom lists**, **1 smart list**; calendar; imports; daily AI chat/advanced-discovery allowance (number unspecified) | Unlimited custom lists, **20 smart lists**; AI recommendations, advanced filters/timeline/detailed stats; release alerts; external sync; ad removal; FAQ also places notes here |

FAQ says smart lists can refresh every **12/24 hours, weekly or monthly**, Premium follows the same account across devices, and full offline support is under review. It advertises export ZIP containing JSON/CSV for history/reviews/lists/account. Press fact sheet verified **2026-10-13** clarifies **free imports and export up to once per 24 hours**, free reminder for the next-airing show versus Premium for all shows/movies, plus paid two-way Trakt/Simkl/MDBList sync.

**Contradictions:** The developer's [2026-10-08 update](https://www.reddit.com/r/MovieParadiseApp/comments/1x0rt5v/the_new_movie_paradise_web_is_live_and_610_is_out/) says notes are now free and settings sync between web/phone, while FAQ still places notes in Premium and settings sync in future work. Treat newer release claims as the current direction, retaining the unresolved matrix inconsistency. No account/purchase tested; do not promise quota-free AI or unlimited smart lists.

## Free, donation, uncertain and discontinued benchmarks

These have less price-detail priority because current overlapping paid gates were not verified. “No tier found” is deliberately weaker than “all free.”

| Product | Useful first-party benchmark / portability | Evidence limitation |
| --- | --- | --- |
| Watchmode consumer | [App page](https://www.watchmode.com/app) explicitly free/no subscription, including recommendations, progress/watchlist, provider/rating filters and alerts | Numeric caps, export, group/offline not established. Do not apply API credit limits to app users. |
| MovieLens | [Official service](https://movielens.org/): non-commercial/ad-free, ratings, tags, personalized/similarity-adjusted recommendations | Current export/import, lists, provider availability and numerical onboarding threshold not verified. Research datasets are not a user's personal export. |
| Watcht | [Publisher listing](https://apps.apple.com/us/app/watcht-for-trakt/id1396920723): free/ad-free; themes/icons, lists/calendar/reminders and some IMDb import. Voluntary USD **0.99/2.99/4.99/9.99** contributions | Contributions are not feature tiers. Trakt account required for updating/sync; backend paid rules separate. |
| TMDB | [API FAQ](https://developer.themoviedb.org/docs/faq): attributed non-commercial API free, commercial sales separate. [Account list API](https://developer.themoviedb.org/reference/account-lists) documents the list ecosystem | User-facing prices/export caps unverified. API licensing is not a paid consumer tier. |
| Movary | [Official README](https://github.com/leepeuker/movary): free/no ads, stats, customizable dashboard, import/export, Plex/Jellyfin/Emby/Kodi automatic plays/ratings; user accounts/privacy | Movie focus; self-hosted experimental software, potential breaking changes. Does not include managed hosting or operational backups. |
| Yamtrack | [Official README](https://github.com/FuzzyGrim/Yamtrack): repeats/dates/notes, collaborative lists, iCal calendar, Apprise alerts, media-server tracking, periodic imports from Trakt/Simkl/MAL/AniList/Kitsu, CSV export/reimport | Donation/self-host model; metadata provider credentials and deployment required. Not evidence of cloud/offline hosted app parity. |
| AniList | [Ten-year-old official announcement](https://anilist.co/forum/thread/2340): historical recurring/one-time donations with time-limited perks; $1/$3/$5/$10/$20 monthly levels, badges/ad removal/profile styling, animated avatars, stats cards **30→100**, refresh intervals **12/6/2 hours** | **Historical only:** live donate page blocked. Do not list these as current purchasable prices or assume lifetime. Current donation matrix and export/caps need revalidation. |
| iShows / ShowPal | [Current same-ID listing](https://apps.apple.com/us/app/showpal-tv-powered-by-trakt-tv/id992387872) retains customization/Trakt description and USD 0.00 Premium entry | Uncertain maintenance and purchase restoration; no verified current paid tier. Do not count old iShows/ShowPal as separate products. |
| Must | [Publisher listing](https://apps.apple.com/us/app/must-for-movies-tv/id1071382493) advertises ratings/reviews, watched/wanted lists, personalized matching and availability alerts; [official journal](https://journal.mustapp.com/) has import instructions | Current service health and exports uncertain. Old journal articles are not current price/feature proof. |
| Flickmetrix | [Public shell](https://flickmetrix.com/) exposes filtering and saved-state navigation | No verified current commercial model, usage caps, export or live account workflow. |
| Marathon | [Closure notice](https://marathontv.app/winding-down): historical USD 1.99/month Plus added custom posters, rich reviews, tags and annual recap; history/lists/reviews export offered March 3–31, 2025 | Closed **2025-03-31** with data wind-down. No current migration/export availability should be promised. |
| Kitsu | [Official web repo](https://github.com/hummingbird-me/kitsu-web) and JS site establish anime/manga tracking identity | Hosted model/paid perks/export/current operation unknown; Hummingbird is predecessor, not another service. |
| BetaSeries | [Live site](https://www.betaseries.com/en/) offers free app, recommendations, release calendar; API/business research separate | Club shell yielded no current prices; community speculation about premium not used as entitlement proof. |
| Moviepilot | [Official FAQ](https://www.moviepilot.de/pages/faq) calls use free and describes ratings-based forecasts, watchlist and personalized cinema/DVD/TV tips | Old app announcements do not establish current client support; current bulk portability not verified. |
| WATCHA PEDIA | [Live catalog](https://pedia.watcha.com/en) exposes ratings/reviews and collection search | No paid PEDIA tier verified; do not import WATCHA streaming subscription prices into tracker comparison. |
| SensCritique / FilmAffinity / MyDramaList | First-party links in inventory identify meaningful French/Spanish/Asian-drama overlap | Pricing/exports/paid gates not established; FilmAffinity and MyDramaList retrieval blocked. These are explicit follow-up leads, not proof of free parity. |
| TasteDive / Watchworthy | [TasteDive](https://tastedive.com/) similarity/lists; [Watchworthy](https://watchworthy.app/) free personalized watch selection | Limits, portability and family behavior not verified. TasteDive is not Taste, and Qloo/API business pricing is not consumer pricing. |

## Data APIs, professional products and media servers: scope boundaries

| Family / product | Current first-party paid evidence | Why it is separate |
| --- | --- | --- |
| [Watchmode API](https://api.watchmode.com/) | Developer free **2,500 credits/month**, non-commercial/attributed, **up to 3 countries**. Startup **$349/month, 40,000 credits**; Business **$599/month, 100,000**; Enterprise custom. Site does not explicitly give ISO currency/country in fetched plan text. Startup adds commercial use/no attribution, app/episode deep links, changes/releases, leaving calendar/awards; Business adds all-date sports/US TV guide/downloads; Enterprise bulk delivery/support | Credits are not consumer movie/library caps. This is data infrastructure; annual/lifetime offers not documented. [Terms](https://api.watchmode.com/tc) govern caching and deletion after cancellation. |
| [TVmaze business API](https://www.tvmaze.com/api/plans) | Startup **$250/month billed yearly**, Small Business **$500/month monthly/yearly**, Enterprise custom. Free **20 calls/10 sec/IP**, Startup **40/10 sec/key**, Small Business **80/10 sec/key**; licenses/SLA differ | Distinct from Bronze/Silver/Gold consumer user-API access. Currency displayed as `$`, billing-country unspecified. |
| [TMDB commercial API](https://developer.themoviedb.org/docs/faq) | Sales quote; public non-commercial developer API free with attribution | Not a paid consumer tracking plan. |
| [Reelgood for Business](https://data.reelgood.com/) / [BetaSeries Pro](https://betaseries.pro/) | Business data/insights leads; no current comparable public consumer tier prices adopted | Catalog intelligence, media research and professional audiences do not establish a consumer paywall. |
| [My Movies installer program](https://www.mymovies.dk/professional/introduction.aspx) | Professional install/licensing offer, with distinct licensing/branding/API capabilities | Not a household movie-discovery subscription. No claim that matching a personal watchlist replaces installation/server workflows. |
| Plex personal media | Paid functions detailed above | Playback, file conversion, downloads, DVR, server bandwidth and library sharing require a media server and personal content; exclude from hosted-discovery parity counts unless scope is explicitly widened. |

Other meaningful **next-search leads**, not counted in the 50-family research inventory: Rippple, Television Time, Movie Tracker, Callsheet, Cinopsys, Cronica, MUBI's community database, Anime-Planet, LiveChart, Bangumi/Douban, AlloCiné, Filmweb, Kinopoisk, SensaCine, My Movies by Blu-ray.com, and additional recent apps visible in publisher-store related listings. Their names are not verified current plan matrices. Rippple/Television Time merit the next paid-client pass; Callsheet/professional film databases and MUBI/streaming bundles require consumer-database versus playback/editorial separation. This list is a research queue, not evidence that all are active or independent successors.

## Migration and portability constraints to preserve in the consolidated audit

| Constraint | Evidence and practical implication |
| --- | --- |
| Export can itself be paid | MyShows PRO exports profile/notes to XLSX; Plex Pass generates RSS watchlist feed. Do not infer full history backup from either. Sources: [MyShows help](https://en.myshows.me/about/pro/), [Plex help](https://support.plex.tv/articles/universal-watchlist/). |
| A client purchase does not unlock the service behind it | SeriesGuide's official sync comparison identifies excluded list/skipped/hidden state; CineTrak/Showly/Watcht describe Trakt dependence. Preserve local state, API failures and backend entitlements as separate checks. [SeriesGuide comparison](https://www.seriesgui.de/help/how-to/backup/sync). |
| Account sync can be lossy relative to local state | SeriesGuide's lists and favorite/hidden/skipped state differ by provider. Sequel's current release notes describe matching/order/episode-progress and disconnect fixes. [Sequel changelog in listing](https://apps.apple.com/us/app/sequel-media-tracker/id1630746993). |
| Export formats differ substantially | MovieBuddy CSV/PDF/HTML; MyShows XLSX; Listy `.listy` plus documented JSON/CSV history; Yamtrack CSV; Movie Paradise JSON/CSV ZIP; Sofa CSV archive; Plex RSS. Human-readable PDF/HTML is not automatically a reversible import format. Sources in product sections. |
| A quota may apply to a screen, not stored data | Next Episode's **50-show Episodes view** differs from its no-show-count-limit watchlist and **25-movie** My Movies cap. [Administrator clarification](https://forum.next-episode.net/viewtopic.php?pid=190046). |
| Downgrade can remove customization data | MAL removes over-limit favorites after **14 days**; not automatically restored on late renewal. [Official FAQ](https://myanimelist.net/membership/faq). |
| A one-time purchase need not mean lifetime service | My Movies iOS purchase is **24 months**, then read-only. SeriesGuide no longer sells new Passes. [My Movies](https://www.mymovies.dk/products/iphone-ipad.aspx), [SeriesGuide](https://www.seriesgui.de/help/fix/x-pass). |
| Store/account/platform entitlements differ | Sofa Time's current terms require account linkage for new plans; old publisher text says stores handled purchases separately. Sequel/FilmNoir/Listy show differing country/SKU prices; Apple generic family text does not prove shared content. Sources in product sections. |
| User-operated hosting is a real constraint | Movary/Yamtrack/Ryot require deployment and operational backups. Their source availability does not provide a managed free account or validated recovery workflow. Official repos/docs cited above. |
| Export windows can close with the service | Marathon's export window ended with the March 2025 wind-down. [Closure notice](https://marathontv.app/winding-down). |

For later migration tests, compare source IDs, movie/show/season/episode identity, ratings scale, dates/time zones, multiple watches, unknown dates, skipped versus watched episodes, private notes/reviews, list ordering, reactions and failed matches. This checklist is an **inference from the documented mismatches**, not a claim that Goodwatch already preserves these fields.

## Evidence gaps, contradictions and source freshness

| Priority | Product / evidence date | Unresolved issue before any marketing claim |
| --- | --- | --- |
| High | Cinexplore, current US text 2026-09-19 | Current complete Premium matrix and all subscription/lifetime options/prices. Only one precise paid layout gate recovered. |
| High | Taste, latest listed iOS update 2025-03-05 | What Premium currently unlocks; duplicated annual SKUs; import/export/quotas. |
| High | SeriesGuide, release 2026-09-23 | Current annual support-tier names/prices by store/country. Legacy Pass explicitly not new-sale evidence. |
| High | Showly, current store/repo | Android pricing and current shipped free/Premium matrix; iOS USD 1.99 versus 5.99 monthly options. Source code may precede/follow installed release. |
| High | Plex, undated live/indexed plans | Repeated live failures and lifetime **749.99** / five-year **249.99** indexed text versus 2025 lifetime **249.99** announcement; current plan verification required. |
| High | Sofa Time, August matrix versus October terms/change notice | New plan rollout, old lifetime SKU eligibility, Android prices and current gates. Press kit one-time-only text is stale. |
| High | FilmNoir, undated live website versus current store | Web monthly/lifetime lower than US store; SIMKL support versus repeated Trakt-required wording. |
| High | Suite TV, about updated 2026-10-07 | Web US Gold **1.99/14.99** versus store **2.99/19.99**; unexplained Platinium tier. |
| High | Movie Paradise, press checked 2026-10-13 | FAQ paid notes/future settings sync versus October release's free notes/current sync; daily AI numbers not public. |
| Medium | Next Episode, current site/store | Mobile Premium USD 24.99 period and relation to web membership; complete app Pro gate matrix. Web caps clarified by 2026-07-03 staff. |
| Medium | Sequel, current store/terms 2026-04-17 | Subscription periods on SKU labels; family member count; import/export gates. Preserve EUR/US differences. |
| Medium | TV Forecast, July 2023 press kit | Current free caps and subscription periods; store prices supersede old values but omit periods. |
| Medium | MyShows, live undated page and 2026-02-25 notice | Current billing-currency/country selection, RUB offer versus dollar promotions, specific player integrations. |
| Medium | CLZ, current shop/product pages | Shop 1.95/19.95 versus Apple 1.99/19.99; expiry editing/export rights; current desktop pricing distinct from mobile/web. Dynamic bundle placeholders are not free offers. |
| Medium | Queue / Bingers / BingeBoxd / Listy / CineTrak | Complete current public tier/limit matrices missing. IAP presence proves payments, not the gate of every advertised feature. |
| Medium | Hobi, current help | Free movie cap number not stated; current Android amount; legacy lifetime eligibility. |
| Medium | AniList | Current donation tiers blocked; ten-year-old reward table explicitly historical only. |
| Medium | Reelgood / Must / Watcht / ShowPal | Listing availability does not prove successful current sign-in/sync; old update/copyright evidence must not imply maintained feature parity. |
| Medium | MyDramaList / FilmAffinity / Kitsu / Flickmetrix / BetaSeries Club | Blocked or minimal shells; current paid model, exports and service operation unresolved. |

Dates printed in sources can themselves be stale. No price was promoted from a dated old announcement where a better live product/store source was available. The important exceptions above are explicitly preserved as conflicts or historical benchmarks. Blocked pages were not bypassed; ordinary direct HTTP successfully recovered MAL membership, delivered FAQ data and public pricing where permitted.

## Recommendations and inferences for the next consolidated comparison

These are **research conclusions and proposed audit order**, not sourced product commitments or a Goodwatch implementation assessment.

1. **Audit portability and durable state first.** Free import/export, clear error reports, safe repeated imports and preservation of ratings/dates/lists address a concrete switching cost. Distinguish real recovery from a visually shareable list.
2. **Compare paid capacity precisely.** High-value examples are MovieBuddy's 50-title cap, Sequel's five collections, Sofa's two concurrent tracking items, Next Episode's screen/movie caps, and Movie Paradise's 9/1 versus unlimited/20 list structure. “Unlimited lists” and “unlimited items” are different promises.
3. **Then assess paid calendar/alert convenience.** Episode reminders, availability alerts, custom timing, iCal/RSS and calendar horizons recur across paid products. A release date is not proof that a title became available on a user's services in their country.
4. **Assess statistics and saved discovery controls as separate slices.** Date ranges, recap detail, filters, provider selection and AI quotas have distinct gates. MovieLens, Watchmode and the newer free-core trackers mean “recommendations for free” alone is not a defensible unique claim.
5. **Separate external sync/scrobbling from internal multi-device persistence.** Paid clients may still inherit backend caps or incomplete state mappings. Verify each integration, direction, cadence and failure mode before comparing it.
6. **Treat cosmetics and household uses explicitly.** Refract/Suite TV monetize cosmetics; Sofa/Sequel offer purchase-family arrangements; collaborative lists/shared progress are different capabilities. Compare the actual experience, not a generic “family” checkbox.
7. **Keep collection/media-server scope bounded.** MovieBuddy, CLZ and My Movies offer physical ownership/lending/custom fields. Plex playback/DVR/transcoding is a different build category. Decide separately whether those deserve Goodwatch scope; this dossier does not decide it.
8. **Build claim records only after the separate Goodwatch audit.** A future record should name competitor, platform, country, tier, date, exact gate/cap, Goodwatch workflow/test evidence and exceptions. The safe unit is a verified function, not “all paid features free.” Re-fetch high-volatility prices immediately before publishing comparisons.

## Validation and limits of verification

- Checked all **26 seed names**, **50 sequential inventory entries**, **42 A / 7 U / 1 D** status counts and **29 paid-offer sections**.
- Checked Markdown table column consistency, link syntax and absence of tool-only citation tokens/placeholders. The dossier contains **194 citation links to 138 distinct URLs**.
- Re-requested all 138 distinct cited URLs: **118 returned HTTP 200, 17 returned 403 and three returned 502**. Some repeat failures followed successful browser/indexed retrieval; those are not evidence of discontinuation. All responses were unauthenticated. HTTP 200 establishes reachability, not correctness or a successful product workflow.
- Did not create accounts, install/purchase upgrades, execute imports/exports, deliver notifications, measure recommendation quality or test cross-device/family entitlements. Published capabilities and limits remain documentary evidence.

No campaign, issue, implementation change, purchase or external publication was initiated. The dossier is ready for consolidation, with unresolved evidence explicitly retained rather than converted into feature absences.
