# Movie discovery market baseline

Published with the [GoodWatch living roadmap](https://github.com/alp82/goodwatch-monorepo/issues/52): [GitHub evidence record](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686672946).

As of **2026-09-15**. Purpose: inform GoodWatch backlog analysis before choosing an onboarding approach or a reason for users to return.

## Scope and evidence limits

This is a bounded comparison of six relevant products using first-party public pages, support documentation, and official announcements.
It is a feature and positioning baseline, not a market-size study, ranking, or proof of product effectiveness.
No accounts were created, imports performed, authenticated onboarding completed, or notifications received.
“Observed” below means text or controls present on a publicly fetched page; it does not mean the complete interaction worked.
“Documented” means a first-party description of behavior; “advertised” means a product claim that was not independently tested.
The sources reviewed do not establish comparable onboarding conversion, repeat-use rates, or causal retention effects.
US availability examples must not be assumed to apply to GoodWatch's eventual target countries.

## Comparison at a glance

The detailed evidence and limitations for each row follow below. Return-use functions are opportunities to revisit a product, not demonstrated retention drivers.

| Product | Publicly described starting input | Discovery approach | Return-use functions described |
| --- | --- | --- | --- |
| Letterboxd | Mark watched, like/rate films; imports also supported | People, reviews, lists, liked-film discovery | Diary, activity, lists, stats, paid availability alerts |
| JustWatch | Browse a country catalog; select services and tracking state | Availability, filters, personalized suggestions | Saved lists, show progress, release notifications |
| Trakt | Account and viewing library; exact onboarding not verified | Recommendations plus viewing progress | Continue/Start Watching, history, lists, shared app data |
| SIMKL | Account; manual history, imports, automatic trackers | History-based recommendations and where-to-watch claims | Episode/release alerts, calendars, statistics |
| Taste | Rate titles and select streaming subscriptions | Similar-taste users and personalized suggestions | Saved titles, profile progression, daily-match entry point |
| MovieLens | Rate films to build a taste profile | Personalized recommendations, tags, adjustable similarity | Further rating and discovery; other return triggers unverified |

## Letterboxd

- **Documented start:** its welcome guide suggests marking popular films as watched, optionally liking/rating them. It also supports importing earlier activity, including IMDb exports. The guide does not prescribe a minimum rating count. [Welcome guide](https://letterboxd.com/welcome/)
- **Documented discovery:** recommendations include community activity and lists. Its FAQ describes discovery based on watched and liked films, specifically saying that this method uses likes rather than ratings; similar-film browsing also exposes themes and nanogenres. This distinction matters when comparing what a rating interaction actually powers. [Recommendation FAQ](https://letterboxd.zendesk.com/hc/en-us/articles/15178828078223-Can-Letterboxd-generate-recommendations-for-me)
- **Documented return functions:** a dated diary, following activity, and watchlists support continued use. Logging or marking a watchlisted film watched moves it out of the watchlist. [Welcome guide](https://letterboxd.com/welcome/)
- **Documented paid layer:** Pro includes statistics, favorite-service filters, and email/push alerts when watchlisted films arrive on those services. [Paid subscriptions](https://letterboxd.com/about/pro/)
- **Unverified:** actual onboarding completion effort, import reliability, recommendation quality, and whether social activity or alerts cause repeat visits.

## JustWatch

- **Observed entry:** the public US catalog exposes provider browsing and filters including release year, genre, rating, runtime, and price. A visitor can inspect this catalog without an account in this fetch; persistent preferences and the complete account flow were not tested. [US catalog](https://www.justwatch.com/us)
- **Advertised discovery:** the company describes personalized suggestions based on taste and selected providers, alongside its streaming-location service. It does not specify the minimum inputs or algorithm in this support page. [What is JustWatch?](https://support.justwatch.com/article/what-is-just-watch)
- **Documented return functions:** tracking begins by saving a show and optionally marking watched episodes/seasons. Separate views represent shows in progress, unstarted shows, and shows where the viewer is caught up. The app can notify about new episodes/seasons when device permission is enabled. [TV Show Tracking](https://support.justwatch.com/article/what-is-tv-show-tracking)
- **Documented saved context:** custom lists support provider filtering and sharing. [Custom lists](https://support.justwatch.com/article/what-are-custom-lists)
- **Unverified:** the first personalized-result flow, cross-device persistence before registration, offer accuracy in any target country, and notification effectiveness.

## Trakt

- **Documented product context:** the team's transition announcement describes a shared account, history, ratings, watchlists, and comments across web and apps, including third-party clients. It identifies different clients as different experiences over shared data. [Team announcement](https://forums.trakt.tv/t/new-trakt-default-web-experience/82458)
- **Documented discovery and return functions:** the current official changelog covers Continue Watching and Start Watching, history-based rating actions, list ordering, and show/episode progress. It also describes recommendation explanations and Smart Related controls as a **VIP preview**, so those should not be treated as universally available. [Official changelog](https://roadmap.trakt.tv/changelog)
- **Documented input portability:** that changelog also discusses TV Time imports and warns of differences in progress calculations, season structures, and source IDs. Import support alone therefore does not establish that users preserve equivalent state. [Official changelog](https://roadmap.trakt.tv/changelog)
- **Unverified:** the current signup sequence, initial rating requirements, recommendation inputs, and authenticated UI. The main site fetch timed out; this comparison relies on official written material.

## SIMKL

- **Observed entry and advertised value:** the homepage offers account creation and foregrounds automatic tracking, watch-history recommendations, episode notifications, calendars, stats, and finding where to watch. These are claims and visible entry points, not tested workflows. [Homepage](https://simkl.com/)
- **Observed import routes:** the import directory names IMDb, Letterboxd, Netflix, Trakt, and other services, alongside CSV/JSON and API options. This establishes discoverable import choices, not matching quality or equivalent data coverage across sources. [Import directory](https://simkl.com/apps/import/)
- **Documented return functions:** notification setup lists TV/anime episode alerts, planned-film release and digital-release alerts, and community interactions. [Notification setup](https://docs.simkl.org/how-to-use-simkl/getting-started-with-simkl/account-creation/notifications-setup)
- **Evidence caveat:** that same document includes a separate future-work list containing streaming-availability alerts. It also has overlapping FAQ language, so release notifications should not be generalized into verified alerts for a user's particular provider and region. [Notification setup](https://docs.simkl.org/how-to-use-simkl/getting-started-with-simkl/account-creation/notifications-setup)
- **Unverified:** recommendation access requirements and quality, first-session effort, automatic tracking reliability, and the retention contribution of any feature.

## Taste

- **Documented start:** the product describes rating watched movies/shows, adding streaming subscriptions, and then receiving personalized recommendations. Its profile grows through ratings, attributes, and reactions to reviews; no minimum rating threshold is established by the page. [About and FAQ](https://www.taste.io/about)
- **Advertised mechanism:** the homepage describes finding people with similar taste and recommending their favorites. This explains its positioning, but does not independently verify its algorithm or prediction accuracy. [Homepage](https://www.taste.io/)
- **Observed return entry points:** public navigation contains Saved and Match of The Day; the latter resolves to the homepage in this fetch. The documented profile percentage/levels are another progression mechanism. Their cadence and effect on behavior remain unverified. [Homepage](https://www.taste.io/), [About and FAQ](https://www.taste.io/about)
- **Documented dependencies:** Taste names TMDb and JustWatch as data sources. That is useful context for later questions about data dependencies, without implying identical licensing or coverage for GoodWatch. [About and FAQ](https://www.taste.io/about)
- **Unverified:** real signup effort, saved-list behavior, subscription filtering quality, daily-match behavior for members, and actual retention.

## MovieLens

- **Advertised start and discovery:** users rate films to form a taste profile and receive recommendations. The homepage also describes tags, search, similar-film discovery, and adjusting similarity with attributes. MovieLens is operated by the University of Minnesota's GroupLens research lab. [Homepage](https://movielens.org/)
- **Historical evidence, not a current requirement:** a 2014 GroupLens post says MovieLens then required 15 ratings before personalized recommendations and investigates recommendation behavior for new users. This is an example of a documented cold-start design, not evidence that today's flow still requires 15 ratings or that GoodWatch should copy that threshold. [GroupLens research post](https://grouplens.org/blog/recommending-for-new-users-is-surprisingly-difficult/)
- **Potential return activity:** further rating and discovery follow from the product's stated interaction model. No current notification, availability, or social return mechanism was verified in this bounded review. [Homepage](https://movielens.org/)
- **Unverified:** current onboarding gates, import options, streaming constraints, and repeat-use outcomes.

## Implications to investigate for GoodWatch

The following are research questions inferred from the comparison, not feature commitments or a priority ranking.

1. **Separate viewer starting situations.** How many visitors have existing rating/watchlist data, and how many arrive with nothing to import? The presence of both manual input and imports elsewhere does not decide which path should lead here.
2. **Separate intent from taste.** Is someone trying to locate a known title, choose among subscriptions, discover an unfamiliar film, or keep track of a show? These needs can require different first useful outcomes.
3. **Name each input's consequence.** What does a GoodWatch rating, watched mark, dislike, or saved title change today? Test whether people understand those distinctions before adding more controls or progress rewards.
4. **Treat availability as a separate success condition.** Does a suggestion fit taste, and can the person actually watch it in their country under their subscription/rental preferences?
5. **Keep return motivations open.** Discovery, finishing an ongoing show, checking availability, recording a viewing, following people, and revisiting saved plans are distinct hypotheses.
6. **Check preservation before importing more.** What should happen to watched status, dates, ratings, TV progress, duplicates, and failed matches? Measure successful usable history, not only uploaded files.
7. **Distinguish useful feedback from effort.** A growing taste profile or a rating count is a mechanism; whether it earns enough immediate value to justify the work is a usability question.

## Evidence needed before choosing a focused map

- A code-to-UI inventory of GoodWatch's real onboarding, recommendations, imports, lists, and available analytics events.
- An inventory of accessible aggregate usage data, its date range, identity/session rules, and gaps; repository event definitions alone do not establish observed user behavior.
- If usable data exists, compare first useful actions and later visits by starting situation, entry page, device, and country without inventing cohort sizes or targets.
- Observe people using both empty-history and imported-history journeys, including what they do when suggestions disappoint them.
- A later interactive competitor walkthrough can record account gates, inputs, error recovery, and effort consistently; this report is not that walkthrough.
- Decide what “useful recommendation” and “returning user” mean with evidence and the owner before ranking solutions or claiming retention improvements.

No development-time budget, deadline, target cohort, rating threshold, or preferred return mechanism is assumed here.
