# Recommendation experience: competitive patterns

Research for [#173](https://github.com/alp82/goodwatch-monorepo/issues/173) on the [recommendation experience redesign map](https://github.com/alp82/goodwatch-monorepo/issues/172). As of **2026-09-26**.

This document shows how leading film and TV recommendation and tracking products design five things:

- Start pages.
- Taste building.
- "Seen it" capture.
- Streaming-service filtering.
- Watch queues.

It ends with a pattern catalog and ideas for GoodWatch. It feeds the start page, Taste, filter bar, and Watch next prototypes. It extends the earlier [movie discovery market baseline](../roadmap-market-baseline.md) from six products to more than twenty.

## Scope and evidence limits

- Sources are first-party help centers, product and engineering blogs, app store listings, and research papers, with reputable press for UX detail. Every claim links to its source.
- No accounts were created and no onboarding flows were completed. Where a page blocked fetching, the claim relies on a search excerpt or a review and is marked as partly verified.
- **Unverified** means no primary source was found. Treat those points as leads, not facts.
- Several products changed in 2025 and 2026. Dates are given where they matter:
  - TV Time shut down on July 15, 2026.
  - Max became HBO Max again in July 2025.
  - Trakt replaced its web and mobile apps in late 2025 and January 2026.
  - Likewise became Pix Media.

## GoodWatch context

Each idea below builds on these existing GoodWatch features:

- A 74-dimension fingerprint for each title, with attribute scores from 0 to 10.
- The GoodWatch score ring.
- Streaming availability per country.
- Ratings from 1 to 10.
- Want to See and Skip.
- Share lists of five titles.

For the terms, see [CONTEXT.md](../../../CONTEXT.md).

## At a glance

| Product | Cold start | Taste shown back | Negative signal | Service filter | Queue |
| --- | --- | --- | --- | --- | --- |
| Netflix | Pick a few titles, optional | Rows, "Because you watched", tile labels | Not for me / Like / Love | Single catalog | My List, auto-ordered |
| Hulu | Titles and genres, skippable | Personalized rows | Dislike hides everywhere | Single catalog | My Stuff |
| HBO Max | Genres, brands, titles | "Because you watched", Top 10 | Not for me / Like / Love (2025) | Single catalog | My List plus Continue Watching |
| Prime Video | Unverified | AI Topics, "Made for you" | Thumbs down, hide | Included / add-on / buy markers | Watchlist, sort A to Z or added |
| Disney+ | Genres and franchises, unverified | Rows | Remove from Continue Watching | Single catalog | Watchlist |
| Apple TV app | Play history only | Household "For All of You" rows | Remove from Continue Watching | Aggregates connected apps | Continue Watching plus Watchlist |
| Letterboxd | Mark popular films watched, imports | Favorite four, stats, Year in Review | None | Pro favorite services | Watchlist with Shuffle |
| Serializd | Imports | Show, season, episode ratings | Unverified | None found | Next-episode tracker |
| Mubi | Curated catalog | Ratings only | None | Own catalog | Watchlist, leaving-soon alerts |
| Kinorium | Imports | Expected rating per title | "Won't watch" status | Theaters / online / coming soon | Will watch, premiere alerts |
| Criticker | 10 ratings to start | Percentiles, TCI, PSI | None found | None found | None found |
| JustWatch | Services first | Thumbs and seen | Seen / disliked hide (Pro) | Five provider filters | Watchlist, show tracking |
| Reelgood | Services first | Reelgood Score, Cue | Show seen all / some / none | 100+ services | Watch Next from tracked shows |
| Plex | Services first | Watch totals, Rewind | None | Your services ranked first | Universal watchlist |
| Trakt | Import or scrobble | Deep stats (VIP) | Hide, not reversible | Not in new app yet | Continue / Start Watching |
| Simkl | Imports, scrobbling | Time watched, stats | Dropped | JustWatch data, 3 regions | Plan to Watch lifecycle |
| TV Time (closed) | Shows you watch | Time watched, Rewind | Swipe to mark seen | Network and service | Watch List, Upcoming |
| Taste.io | Rate a poster stream | Match % on every title | Haven't seen / Not interested inline | My Services on by default | Watchlist, Up Next |
| Likewise (Pix) | Interest categories | "Why it is recommended" | Unverified | Service filter | Lists |
| MovieLens | Group points, then ratings | Predicted stars, algorithm switch | Unverified | None | Wishlist, unverified |
| TasteDive | Type what you like | Similar lists across media | Like / Meh / Dislike | None | Saved items |

## Streaming services

### Netflix

- **Cold start.**
  - New profiles can "choose a few titles that you like", and the step is optional ([help](https://help.netflix.com/en/node/100639)). Skipping it gives a varied set of popular titles.
  - Sign-up draws its title set from an algorithm ([Gomez-Uribe and Hunt 2015](https://dl.acm.org/doi/10.1145/2843948)).
- **Taste shown back.**
  - Each row is personalized, and the strongest picks sit at its left ([help](https://help.netflix.com/en/node/100639)).
  - The homepage is assembled from "Because you watched" and genre rows ([TechBlog](https://netflixtechblog.com/learning-a-personalized-homepage-aa8ec670359a)).
  - Artwork is chosen per member, first with contextual bandits ([research](https://research.netflix.com/publication/Artwork%20Personalization%20at%20Netflix)) and since 2026 with LLM post-training ([research](https://research.netflix.com/publication/netflix-artwork-personalization-via-llm-post-training)).
  - Match percentages were reported as being phased out in January 2024 ([IndieWire](https://www.indiewire.com/news/business/match-percentages-netflix-going-away-1234944402/)).
- **Seen and not interested.**
  - Three buttons: "Not for me", "I like this", and "Love this!" ([help](https://help.netflix.com/en/node/9898)). "Love this!" arrived in April 2022 ([Netflix](https://about.netflix.com/en/news/two-thumbs-up-even-better-recommendations)).
  - "Remove from row" clears Continue Watching ([help](https://help.netflix.com/en/node/115312)).
  - There is no "mark as watched".
- **Availability.** A single catalog. Netflix stays out of the Apple TV app ([MacRumors](https://www.macrumors.com/2025/02/14/netflix-no-apple-tv-integration/)).
- **Queue.** My List ([help](https://help.netflix.com/en/node/10523)):
  - Holds up to 2,000 titles.
  - Ordered automatically, with new seasons and departing titles pushed up.
  - Mobile adds sorts (Suggested, Date Added, A to Z, Release Date) and filters (Haven't Started, Started).
- **Memorable.**
  - Research sets the time budget: members lose interest after 60 to 90 seconds and 10 to 20 titles ([Gomez-Uribe and Hunt 2015](https://dl.acm.org/doi/10.1145/2843948)).
  - The May 2025 TV redesign shows reason labels such as "#1 in TV Shows" and "New Season" on tiles. It also reacts within the session to trailers watched and searches ([Tudum](https://www.netflix.com/tudum/articles/netflix-new-tv-layout), [Variety](https://variety.com/2025/tv/news/netflix-redesigns-homepage-ai-chatbot-1236388858/)).
  - Netflix shut down its shuffle feature in January 2023 for low use ([Tom's Guide](https://www.tomsguide.com/news/netflix-just-killed-a-feature-that-seemed-like-a-great-idea)).

### Hulu

- **Cold start.** A skippable picker for shows, movies, and genres ([help](https://help.hulu.com/article/hulu-personalized-recommendations)).
- **Taste shown back.** A personalized Home and "You May Also Like" ([help](https://help.hulu.com/article/hulu-like-dislike)).
- **Seen and not interested.**
  - Dislike removes the title from Home, Up Next, and You May Also Like ([help](https://help.hulu.com/article/hulu-like-dislike)).
  - Like records taste "without cluttering up My Stuff", which separates liking a title from saving it.
- **Queue.** My Stuff shows new episodes, how many episodes are left, and what is expiring ([help](https://help.hulu.com/article/hulu-my-stuff)).
- **Memorable.**
  - The clearest one-tap "not interested" among the large streamers.
  - Hulu profiles have synced into Disney+ since May 2026 ([BGR](https://www.bgr.com/2177912/new-features-added-to-disney-plus-app-may/)).

### HBO Max

- **Cold start.** New adult profiles can pick favorite genres, brands, shows, and movies. They can skip the step and edit their picks later ([help](https://help.hbomax.com/us-en/answer/detail/000002565)).
- **Taste shown back.** "Recommended For You" and "Because You Watched" rows ([help](https://help.hbomax.com/us-en/answer/detail/000002559)).
- **Seen and not interested.** Love, Like, and Not For Me arrived in October 2025, on the details page and at the end of playback ([Variety](https://variety.com/2025/digital/news/hbo-max-user-content-feedback-ratings-like-netflix-1236559099/)).
- **Queue.** My List is newest first. Continue Watching includes the next episode and drops items after 90 days ([help](https://help.hbomax.com/us-en/answer/detail/000002505)).
- **Memorable.**
  - Brands such as HBO and DC appear as taste seeds.
  - The in-progress list cleans itself up.

### Prime Video

- **Cold start.** No primary source was found for a picker. Unverified.
- **Taste shown back.**
  - "Made for You" collections ([About Amazon](https://www.aboutamazon.com/news/entertainment/prime-video-updated-steaming-experience)).
  - AI Topics (December 2024) generates named personal themes such as "mind-bending sci-fi" ([About Amazon](https://www.aboutamazon.com/news/entertainment/prime-video-what-to-watch-artificial-intelligence-topics)).
- **Seen and not interested.**
  - Thumbs down stops a title from being recommended, and tapping again undoes it ([help](https://www.amazon.com/gp/help/customer/display.html?nodeId=Tgonhtd9758pRyTOIh)).
  - "Hide this video" clears Continue Watching.
- **Availability.**
  - The July 2024 navigation adds a "Prime" destination for included titles and lists your add-on subscriptions ([About Amazon](https://www.aboutamazon.com/news/entertainment/prime-video-updated-steaming-experience)).
  - Tiles show a check mark for included titles and a shopping bag for paid ones ([Engadget](https://www.engadget.com/amazon-prime-video-redesign-announced-204019411.html)).
- **Queue.** The Watchlist sorts by recently added or A to Z. Titles that leave Prime stay on it, marked unavailable ([Pocket-lint](https://www.pocket-lint.com/how-to-organize-prime-video-library/)).
- **Memorable.**
  - Every tile shows its entitlement status.
  - Filtering the watchlist to titles included with Prime is still a user request ([Amazon forum](https://amazonforum.my.site.com/s/question/0D56Q0000BLcBarSQF/filter-prime-video-watchlist-by-included-with-prime)).

### Disney+

- **Cold start.**
  - A content-onboarding step exists at `/profiles/setup/content-onboarding` ([URL](https://www.disneyplus.com/en-gb/profiles/setup/content-onboarding)).
  - A secondary source says it asks for genres, characters, and franchises ([Medium](https://medium.com/@donovanblake886/how-does-disney-handle-content-recommendations-and-personalization-2560000c77fb)). Unverified with Disney.
- **Seen and not interested.**
  - "Remove from Continue Watching" arrived in March 2025. It keeps progress ([Disney](https://thewaltdisneycompany.com/news/remove-from-continue-watching-disney-plus/), [help](https://help.disneyplus.com/article/disneyplus-remove-from-continue-watching)).
  - No thumbs rating is documented.
- **Queue.** A Watchlist ([help](https://help.disneyplus.com/article/disneyplus-managing-watchlist)). A to Z catalog browsing disappeared in May 2026 ([Collider](https://collider.com/disney-plus-removes-a-z-search-feature-streaming/)).
- **Memorable.** Brand hubs, and a merged app for Hulu and later ESPN.

### Apple TV app

- **Cold start.** No picker and no rating buttons. Taste comes from play history, which you can turn off or clear ([help](https://support.apple.com/guide/tvapp/adjust-privacy-settings-atvb2eb91635/web), [Apple Community](https://discussions.apple.com/thread/254644465)).
- **Taste shown back.**
  - "For All of You" and "For Both of You" blend the tastes of the selected household profiles ([help](https://support.apple.com/guide/tv/manage-recommendations-atvb0916ba14/tvos)).
  - Genius Browse (tvOS 26.4, March 2026) shows generated categories such as "Tense Psychological Thrillers" across connected apps ([MacRumors](https://www.macrumors.com/2026/03/18/tvos-26-4-genius-browse-mode/)).
- **Seen and not interested.** A long press removes an item from Continue Watching. The Mac library has "Mark as Watched" ([help](https://support.apple.com/guide/tvapp/watch-now-atvb05f2070b/web), [Mac help](https://support.apple.com/en-ke/guide/tvapp-mac/atvbe9ddc3f/mac)).
- **Availability.** One Continue Watching list across connected apps and Apple TV Channels ([help](https://support.apple.com/guide/tvapp/watch-now-atvb05f2070b/web)).
- **Queue.** iOS 18.1 split "Up Next" into Continue Watching and a separate Watchlist ([9to5Mac](https://9to5mac.com/2024/09/24/apple-tv-app-adds-separate-watchlist-in-ios-18-1-beta/)). Continue Watching is ordered by what you are "most likely to want to watch", with no manual order ([help](https://support.apple.com/en-ca/guide/iphone/iphbf1137ac0/ios)).
- **Memorable.** One "what's next" queue across services, and recommendations for a household.

## Film diaries and taste communities

### Letterboxd

- **Cold start.**
  - The welcome guide suggests marking popular films as watched ([welcome](https://letterboxd.com/welcome/)).
  - An importer reads Letterboxd and IMDb CSV files. It previews matches before you confirm and has no undo ([importing data](https://letterboxd.com/about/importing-data/)).
  - An IMDb import can create dated diary entries ([migrating from IMDb](https://letterboxd.com/about/migrating-from-imdb/)).
- **Taste shown back.**
  - Four favorite films on the profile ([FAQ](https://letterboxd.com/about/faq/)).
  - A free Year in Review once you log 10 films ([2025 FAQ](https://letterboxd.com/journal/2025-letterboxd-year-in-review-faq/)).
  - Pro has stats all year. Patron adds "films rated above or below the community average" ([Pro](https://letterboxd.com/about/pro/)).
- **Seen and not interested.**
  - One icon each for watched (eye), like (heart), and watchlist (clock). Marking watched is a one-tap back-fill with no date. "Log" records a dated diary entry ([FAQ](https://letterboxd.com/about/faq/), [help](https://letterboxd.zendesk.com/hc/en-us/articles/15178773269263-I-ve-been-marking-films-watched-instead-of-logging-them-to-my-Diary-How-can-I-fix-this)).
  - Watching, logging, or rating a film removes it from the watchlist.
  - There is no "not interested" state.
- **Availability.**
  - JustWatch data since 2019 ([journal](https://letterboxd.com/journal/justwatch-integration/)).
  - Filtering by favorite services is Pro only. So are alerts, at most daily, when a watchlisted film reaches one of those services ([help](https://letterboxd.zendesk.com/hc/en-us/articles/15178655699471-Can-I-get-notified-when-films-in-my-watchlist-are-ready-to-watch)).
- **Queue.**
  - The watchlist has a Shuffle sort ([journal](https://letterboxd.com/journal/sorting/)).
  - Letterboxd's own "what to watch tonight" guide is: filter the watchlist by your services, then sort by rating or by shortest runtime ([journal](https://letterboxd.com/journal/how-to-find-something-good-on-streaming-tonight/)).
- **Memorable.** The diary, the favorite four as identity, and the yearly recap ritual.

### Serializd

- **Cold start.** Imports from TV Time and Trakt, per reviews ([Achriom](https://www.achriom.com/blog/serializd-vs-tv-time/)).
- **Taste shown back.**
  - Ratings and reviews for every show, season, and episode.
  - A "personal TV graph" of watch time and genres ([App Store](https://apps.apple.com/us/app/serializd/id1581244120)).
- **Seen and not interested.** Marking a show watched cascades to all its seasons and episodes. A show can't be both watched and watchlisted ([FAQ](https://serializd.com/about?q=tracking), partly verified).
- **Queue.** A next-episode tracker ([App Store](https://apps.apple.com/us/app/serializd/id1581244120)).
- **Memorable.** "Letterboxd for TV", with criticism down to the season and episode.

### Mubi

- **Cold start.** Curation does the cold-start work. No taste picker is documented.
- **Availability.** Its own catalog only:
  - "Now Showing" adds one film a day and keeps each for 30 days ([VODzilla](https://vodzilla.co/blog/features/mubi-library-your-questions-answered/), [Now Showing](https://mubi.com/en/us/showing)). Whether this cadence still holds in 2026 is unverified.
  - MUBI GO gives one cinema ticket a week for a curated film ([help](https://help.mubi.com/article/157-how-does-mubi-go-work)).
- **Queue.** Films leaving within 14 days are labeled, and watchlisted films trigger a leaving-soon notice ([help](https://help.mubi.com/article/262-how-long-are-films-available-to-watch-on-mubi)).
- **Memorable.** Scarcity and human curation ([Film Stage](https://thefilmstage.com/mubi-introduces-full-library-featuring-a-treasure-trove-of-curated-films/)).

### Kinorium

- **Cold start.** Imports from IMDb, Letterboxd, KinoPoisk, and MyShows ([App Store](https://apps.apple.com/us/app/kinorium-all-movies-and-shows/id1093171715), [import page](https://ru.kinorium.com/insider/imdbkp/)).
- **Taste shown back.** An "expected rating, based on your previous ratings" on each title ([App Store](https://apps.apple.com/us/app/kinorium-all-movies-and-shows/id1093171715)).
- **Seen and not interested.**
  - Three intent states: will watch, watched, and won't watch.
  - Search filters can hide both watched and won't-watch titles. The URL parameters are `hide_status[]=done` and `hide_status[]=never` ([search URL](https://en.kinorium.com/R2D2/?type=R2D2&order=rating&hide_status%5B%5D=done&hide_status%5B%5D=never&kr_rating_min=7&imdb_rating_min=7), partly verified).
- **Availability.** Lists split into theaters, online, and coming soon ([App Store](https://apps.apple.com/us/app/kinorium-all-movies-and-shows/id1093171715)).
- **Queue.**
  - "Will watch" notifies you at the cinema premiere and again when the film reaches online platforms ([iPhones.ru](https://www.iphones.ru/iNotes/nashyol-luchshiy-sposob-sledit-za-lyubimymi-serialami-i-novymi-filmami-11-07-2019)).
  - Shaking the phone shuffles a list.
- **Memorable.** A first-class "won't watch" that feeds filters, and alerts that follow a film from cinema to streaming.

### Criticker

- **Cold start.** Matching needs at least 10 ratings. The site calls 50 "a good start" and says results really improve after 100 ([get started](https://www.criticker.com/get-started-with-criticker/), partly verified).
- **Taste shown back.**
  - Raw scores become personal percentiles in 10 tiers, so every user's scale is normalized automatically ([explain](https://www.criticker.com/explain/)).
  - TCI is the average rating difference between two users, and lower means more similar ([TCIs](https://www.criticker.com/tcis/)).
  - PSI predicts your score from your 10 closest TCI matches ([algorithm](https://www.criticker.com/critickers-algorithm-explained/)).
- **Seen, availability, and queue.** No documentation found.
- **Memorable.** Predictions you can explain, and a fix for "my 7 is not your 7".

## Availability guides and trackers

### JustWatch

- **Cold start.**
  - Pick your services from more than 4,500 ([App Store](https://apps.apple.com/us/app/justwatch-movies-tv-shows/id979227482)).
  - The watchlist works without logging in ([Google Play](https://play.google.com/store/apps/details?id=com.justwatch.justwatch&hl=en_US)).
  - A title quiz at sign-up is described only by a review ([Clark](https://clark.com/streaming-tv/justwatch-app-review/)).
- **Taste shown back.**
  - Thumbs up, thumbs down, and a seen tick ([womenlovetech](https://womenlovetech.com/plan-your-tv-watch-list-with-the-justwatch-website-and-app/)).
  - The recommender was rebuilt as a two-tower model that uses title metadata for cold start ([Enjins](https://enjins.com/case/justwatch/)).
  - No personal stats.
- **Seen and not interested.**
  - "Hide Seen/Disliked" can be turned on in Settings or per tab. It is Pro only ([support](https://support.justwatch.com/article/how-to-use-the-hide-seen-disliked-function-on-just-watch)).
  - The bookmark icon saves a title in one tap ([support](https://support.justwatch.com/article/is-there-a-way-to-add-movies-to-my-watchlist-with-one-click)).
- **Availability.**
  - Five provider filters: All, My Services, Subscriptions, Buy/Rent, and Free ([support](https://support.justwatch.com/article/understanding-provider-filters-in-the-just-watch-app)).
  - A daily price-drops feed.
  - "Leaving Soon" for your services is Pro only ([support](https://support.justwatch.com/article/what-do-i-get-with-just-watch-pro)).
- **Queue.** Show tracking ([support](https://support.justwatch.com/article/what-is-tv-show-tracking), [EMHAL](https://everymoviehasalesson.com/blog/2023/11/justwatch-adds-new-lists-feature-and-imports-your-imdb-lists)):
  - Buckets for Continue Watching, Haven't Started, and Caught Up.
  - With My Services on, the list shows only shows you can stream now.
- **Memorable.** Availability comes first. Trakt, Simkl, Letterboxd, and Taste.io all use JustWatch data.

### Reelgood

- **Cold start.** Pick your services, then set up profiles ([Cloudwards](https://www.cloudwards.net/how-to-use-reelgood/), [App Store](https://apps.apple.com/us/app/reelgood-streaming-guide/id1031391869)).
- **Taste shown back.**
  - A Reelgood Score out of 100, with no published formula.
  - Cue (June 2023) is an AI "Should you watch this?" button ([Reelgood](https://data.reelgood.com/introducing-cue/)).
- **Seen and not interested.** Adding a show asks whether you've seen all, some, or none of it. With "some", you pick the last episode you saw ([blog](https://blog.reelgood.com/managing-your-reelgood-watch-list-for-tv-shows)).
- **Availability.**
  - Covers more than 100 services.
  - Roulette picks a random title filtered by service, genre, and score ([Cloudwards](https://www.cloudwards.net/how-to-use-reelgood/)).
- **Queue.** Tracked shows feed a home "Watch Next" with two tabs, Episodes to See and All Caught Up ([blog](https://blog.reelgood.com/managing-your-reelgood-watch-list-for-tv-shows)).
- **Memorable.** Roulette, and group swiping that shows matches for friends ([Android Police](https://www.androidpolice.com/2021/01/16/swipe-with-friends-is-like-tinder-for-finding-movies-and-shows-to-watch/)).

### Plex Discover

- **Cold start.** Pick your subscriptions from more than 450 services. Search results then rank those services first ([TechCrunch](https://techcrunch.com/2022/04/05/huge-plex-update-adds-a-universal-watchlist-cross-service-search-and-new-discovery-features)).
- **Taste shown back.**
  - A profile "player card" with totals watched ([blog](https://www.plex.tv/blog/discover-together/)).
  - Plex Rewind each year, for Plex Pass members ([blog](https://www.plex.tv/blog/2025-plex-rewind/)).
- **Seen and not interested.**
  - Mark titles watched manually, including films seen in a theater. The activity feed merges a rating and a watch within 12 hours into one card and collapses binges ([support](https://support.plex.tv/articles/activity-feed/)).
  - There is no "not interested".
- **Availability and queue.** The universal watchlist ([support](https://support.plex.tv/articles/universal-watchlist/)):
  - Lists your own server first, then your services, then everything else.
  - Has an "Available From Your Watchlist" row.
  - After you play a title on another service, Plex asks on your return whether to add it to your watchlist.
- **Memorable.** One watchlist across your own media and every service, plus a social feed of what friends watch.

### Trakt

- **Cold start.**
  - VIP imports your full Netflix, Prime Video, Hulu, and Apple TV+ history, then syncs every 24 hours ([PR Newswire](https://www.prnewswire.com/news-releases/trakt-partners-with-younify-to-launch-its-streaming-scrobbler-302324174.html)).
  - Media-player scrobbling is the long-standing route.
- **Taste shown back.** VIP adds:
  - Year in Review with breakdowns by hour, weekday, genre, network, and country ([blog](https://trakt.medium.com/year-in-review-5c6ac98f0d3c)).
  - All-time stats ([blog](https://blog.trakt.tv/all-time-year-in-review-f6f931e4461d)).
  - A monthly email ([forum](https://forums.trakt.tv/t/month-in-review/43746)).
- **Seen and not interested.**
  - Check in, scrobble, or mark watched at a chosen date ([forum](https://forums.trakt.tv/t/trakt-product-roundup-november-2025/88722)).
  - "Hide" on a recommendation can't be undone without asking staff ([forum](https://forums.trakt.tv/t/clear-hidden-recommendations/24349)).
- **Availability.** JustWatch data, with favorite services pinned to the top. Staff confirmed in June 2026 that the new app can't yet filter by service ([forum](https://forums.trakt.tv/t/how-do-you-filter-by-streaming-service-on-this-new-version/112975)).
- **Queue.** In December 2025, Up Next became two smart lists ([forum](https://forums.trakt.tv/t/new-trakt-feature-spotlight-continue-watching-start-watching/89875)):
  - **Continue Watching**, the next episode ordered by recent activity.
  - **Start Watching**, watchlist items that just released.
- **Memorable.** The deepest stats, and a hub for third-party apps. The 2025 and 2026 redesigns dropped features and angered power users ([forum](https://forums.trakt.tv/t/a-new-chapter-for-trakt-on-mobile/95257)).

### Simkl

- **Cold start.** Imports from more than 20 services and auto-scrobbling from many players ([docs](https://docs.simkl.org/how-to-use-simkl/core-features/content-tracking/importing-watch-history)).
- **Taste shown back.** "My Stats" ([docs](https://docs.simkl.org/how-to-use-simkl/core-features/social-and-community/profile-statistics.md)):
  - Total time watched as days, hours, and minutes, with share buttons.
  - A breakdown by status.
  - A comparison with the community.
- **Seen and not interested.**
  - Mark a whole season in one click. Marking the latest episode offers to mark all earlier ones ([docs](https://docs.simkl.org/how-to-use-simkl/core-features/content-tracking/tracking-content/progress-tracking.md)).
  - "Watching Now" marks a title watched when its runtime ends ([docs](https://docs.simkl.org/how-to-use-simkl/core-features/content-tracking/tracking-content/watch-history/playback-progress-manager/watching-now.md)).
- **Availability.**
  - JustWatch data with up to three regions compared at once ([docs](https://docs.simkl.org/how-to-use-simkl/core-features/watch-now-streaming-services.md)).
  - Subscription tracking with cost and renewal dates ([docs](https://docs.simkl.org/how-to-use-simkl/core-features/watch-now-streaming-services/subscription-tracking.md)).
- **Queue.**
  - Items move automatically through Plan to Watch, Watching, Completed, On Hold, and Dropped ([docs](https://docs.simkl.org/how-to-use-simkl/core-features/watchlists-and-custom-lists/how-to-use-watchlists/the-simkl-watchlist-lifecycle.md)).
  - Recommendations leave out titles already watched or planned ([docs](https://docs.simkl.org/how-to-use-simkl/core-features/search-and-discovery/recommendations.md)).
- **Memorable.** Status states borrowed from anime trackers, and free PRO for using the app 20 days in a month ([docs](https://docs.simkl.org/how-to-use-simkl/about/what-is-simkl/is-simkl-free-to-use.md)).

### TV Time

- **Status.** Shut down on July 15, 2026, after 26.4 million installs ([TechCrunch](https://techcrunch.com/2026/07/02/popular-tv-tracking-app-tv-time-is-shutting-down-as-company-focuses-on-ai/)). A co-founder launched Bingers as a successor that imports TV Time exports ([TechCrunch](https://techcrunch.com/2026/08/04/tv-time-co-founder-launches-bingers-to-revive-the-beloved-tv-tracking-app/)).
- **Taste shown back.** Headline totals for time watched, and a yearly Rewind ([Whip Media](https://whipmedia.com/press_items/tv-time-unveils-tv-time-rewind-2022/)).
- **Seen and not interested.** Swipe right or tap to mark an episode watched. Marking it opened that episode's fan reactions ([TechCrunch 2018](https://techcrunch.com/2018/03/12/tv-time-the-tv-tracking-app-with-over-a-million-daily-users-can-now-find-your-next-binge)).
- **Queue.** The Watch List showed ([Wikipedia](https://en.wikipedia.org/wiki/TV_Time)):
  - What to watch next.
  - Shows you had not watched in a while.
  - A progress bar per show.
- **Memorable.** Marking an episode watched was itself a reward, because it opened the fan reaction feed.

## Taste-first recommenders

### Taste.io

- **Cold start.**
  - A stream of posters, each rated Awful, Meh, Good, or Amazing, with "Haven't Seen" and "Not Interested" in the same row ([TechTimes](https://www.techtimes.com/articles/263647/20210802/taste-new-movie-tv-review-app-gives-recommendations-minded-users.htm), [WPSD](https://www.wpsdlocal6.com/news/taste-the-app-that-makes-choosing-a-movie-simple/article_56b43988-4337-11ee-a437-f3c98c36266f.html)).
  - Suggestions start after "20 or so" ratings, with no hard gate.
- **Taste shown back.**
  - A Match % on every title, extended to 25,000 more titles in 2023 ([App Store](https://apps.apple.com/us/app/taste-movies-tv/id1361180197)).
  - A "Match of the Day" ([site](https://www.taste.io/)).
  - A profile completeness percentage with levels ([about](https://www.taste.io/about)).
  - Reviews can be filtered to "Users Like You".
- **Seen and not interested.** One tap or one swipe per title. Swiping left means not interested ([Google Play](https://play.google.com/store/apps/details?id=com.tasteio&hl=en_US)).
- **Availability.** Filters for My Services, Free Streaming, and Rent or Buy ([browse](https://www.taste.io/browse)). The service filter has been on by default since May 2023 ([App Store](https://apps.apple.com/us/app/taste-movies-tv/id1361180197)).
- **Queue.** A watchlist, an "Up Next" mark (restored in v2.5), and "Watch With [partner]" ([about](https://www.taste.io/about)).
- **Memorable.**
  - A four-word scale in place of stars.
  - A match score framed like a dating app.
  - Service filtering on by default. This is the closest analog to GoodWatch's planned defaults.

### Likewise (now Pix Media)

- **Status.**
  - Acquired in June 2025 ([PR Newswire](https://www.prnewswire.com/news-releases/likewise-announces-acquisition-by-watchlist-inc-betting-big-on-the-future-of-newsletters-and-personalized-entertainment-discovery-302473317.html)).
  - The website now redirects to a newsletter brand, while the app still ships ([Google Play](https://play.google.com/store/apps/details?id=com.Likewise.apps.Likewise&hl=en_US)).
- **Cold start.** Pick interest categories ([ViralTalky](https://viraltalky.com/likewise-app-review/), third-party). Exact screens unverified.
- **Taste shown back.**
  - Each recommendation shows tags, friends who rated the title, where to stream it, and "specifically why it is being recommended for you" ([PR Newswire 2024](https://www.prnewswire.com/news-releases/entertainment-discovery-platform-likewise-introduces-new-ai-powered-mobile-app-upgrades-to-its-content-recommendations-ecosystem-302087504.html)).
  - The Pix AI assistant answers natural-language requests ([GeekWire](https://www.geekwire.com/2023/bill-gates-backed-likewise-launches-ai-powered-pix-personal-entertainment-companion/)).
- **Seen and not interested.** Unverified.
- **Availability.** Filters by service ([Google Play](https://play.google.com/store/apps/details?id=com.Likewise.apps.Likewise&hl=en_US)).
- **Memorable.** A reason attached to every pick. Reviewers judged the recommendations themselves weak ([App Store](https://apps.apple.com/app/id1264195462)).

### MovieLens

- **Cold start.**
  - v3 required 15 ratings. v4 replaced this in 2014 with points spread across groups of movies ([Harper and Konstan 2015](https://files.grouplens.org/papers/harper-tiis2015.pdf)).
  - A later paper describes point allocation followed by rating well-known titles up to 15 ([Fan et al. 2023](https://arxiv.org/html/2307.09985v3)).
- **Taste shown back.**
  - A predicted star rating on every card, in the same widget you rate with.
  - A recommender switcher in the top bar.
  - Rankings blend 0.9 of predicted rating with 0.1 of popularity ([Ekstrand et al. 2015](https://md.ekstrandom.net/pubs/MultiRecs-Author.pdf)).
  - Movie Tuner lets you ask for "more" or "less" of a tag relative to a movie ([Vig et al. 2011](https://files.grouplens.org/papers/navigating-the-tag-genome.pdf)).
- **Seen and not interested.** The current controls sit behind a login. Unverified.
- **Availability.** None.
- **Memorable.** Visible algorithm choice, and critiquing a movie by its attributes. This is the closest analog to GoodWatch's fingerprint.

### TasteDive

- **Cold start.** No account needed. Type things you like across media types and get instant suggestions ([about](https://tastedive.com/read/about), [API](https://tastedive.com/read/api)).
- **Taste shown back.** Lists of similar titles across media, and "Tastebuds", other users with similar taste ([tastebuds](https://tastedive.com/tastebuds)).
- **Seen and not interested.** Like, Meh, or Dislike on every result ([Make Tech Easier](https://maketecheasier.com/tastedive-better-show-recommendations/)).
- **Availability.** None, which reviewers call a gap.
- **Memorable.** Value in the first second, with no sign-up.

## Taste UX outside film

### Spotify

- **Cold start.** New users choose five or more artists ([newsroom](https://newsroom.spotify.com/2018-08-27/5-things-free-users-need-to-be-taking-advantage-of-on-spotify/)). Onboarding picks go into the same user embedding as behavior, and the model gradually shifts weight to behavior ([research](https://research.atspotify.com/2025/9/generalized-user-representations-for-large-scale-recommendations)).
- **Discover Weekly.**
  - About 30 songs every Monday, replaced the next week.
  - It succeeds partly by including "one or two semi-familiar songs" to build trust ([engineering](https://engineering.atspotify.com/2015/11/what-made-discover-weekly-one-of-our-most-successful-feature-launches-to-date)).
  - In 2025 it gained genre buttons that regenerate the list in one tap ([newsroom](https://newsroom.spotify.com/2025-06-30/discover-weekly-turns-10-celebrating-100-billion-tracks-streamed-and-a-decade-of-personalized-discovery/)).
- **Daylist.** Named after your micro-genres and moods, and it changes through the day. Seventy percent of users return weekly, and it is the most-shared feature after Wrapped ([newsroom](https://newsroom.spotify.com/2024-09-04/daylist-new-languages-expanding-worldwide/)).
- **Wrapped.** Turns listening into shareable identity labels, such as the listening-style "Clubs" in 2025 ([newsroom](https://newsroom.spotify.com/2025-12-03/2025-wrapped-user-experience/)).
- **Negative feedback in levels.**
  - "Hide song" applies to one playlist ([support](https://support.spotify.com/us/article/hide-unhide-songs/)).
  - "Snooze" hides a track for 30 days ([newsroom](https://newsroom.spotify.com/2025-09-05/new-user-controls-personalize-listening/)).
  - "Exclude from your taste profile" works per playlist and, since October 2025, per track ([support](https://support.spotify.com/us/article/exclude-playlists-or-tracks-from-your-taste-profile/), [newsroom](https://newsroom.spotify.com/2025-10-01/exclude-tracks-taste-profile/)).
- **Taste Profile beta (2026).** Shows a written summary of your taste and lets you steer it with free-text notes ([newsroom](https://newsroom.spotify.com/2026-09-23/taste-profile-shape-home-feed/), [support](https://support.spotify.com/us/article/your-taste-profile/)).
- **Prompted Playlist.** Attaches a one-line reason to every song ([newsroom](https://newsroom.spotify.com/2026-02-23/prompted-playlist-prompts-to-try/)).

### Pinterest

- **Cold start.** "Follow 5 topics", localized per country, raised new-user return by 5 to 10 percent ([Pinterest Engineering](https://medium.com/pinterest-engineering/personalizing-pinterests-new-user-experience-abroad-60f8f55177ac), partly verified). A second topic-then-subtopic step added too much friction ([Appcues interview](https://medium.com/appcues/casey-winters-reveals-how-pinterest-perfected-user-onboarding-639fcc7486d7), partly verified).
- **Feed tuning.**
  - The Home Feed Tuner (2019) lists the boards, topics, and activity behind your feed, each with a toggle, and explains why each Pin appears ([newsroom](https://newsroom-archive.pinterest.com/new-ways-to-control-the-ideas-you-see-in-your-home-feed)).
  - The tuner now lives under "Refine your recommendations" ([help](https://help.pinterest.com/en/article/tune-your-home-feed)).
- **Boards as queues.** Every board has a "More ideas" tab seeded by its contents ([help](https://help.pinterest.com/en/article/boards)).
- **Interest lifecycle.** Pinterest models each interest as emerging, habitual, or decaying ([Pinterest Engineering, 2026](https://medium.com/pinterest-engineering/pinner-progression-better-use-case-representation-driving-weekly-active-user-growth-at-pinterest-bd2131ab238a)).

### Swipe onboarding and feed resets

- **Tinder.** The reference gesture: swipe right to like, left to pass ([Tinder](https://tinder.com/en-GB/feature/swipe/)). Undo (Rewind) is a paid feature ([help](https://www.help.tinder.com/hc/en-us/articles/115004493323-Rewind)).
- **Hinge Most Compatible.** One strong pick a day that expires in 24 hours ([help](https://help.hinge.co/hc/en-us/articles/360011233073-What-is-Most-Compatible), partly verified). Hinge also asks after a date whether it went well ([TechCrunch](https://techcrunch.com/2018/10/16/hinge-is-first-dating-app-to-actually-measure-real-world-success)).
- **Movie swipe apps.** Two couples apps show the pattern:
  - [Matched](https://www.matched-app.com/): each person first rates titles they've seen, then the couple swipes and sees where the matches stream.
  - Reelgood's Swipe With Friends: no account, filters by service ([Android Police](https://www.androidpolice.com/2021/01/16/swipe-with-friends-is-like-tinder-for-finding-movies-and-shows-to-watch/)).

  Swiping helps a group decide what to watch tonight more than it builds a lasting profile.
- **TikTok.**
  - Long press gives "Not interested" ([newsroom](https://newsroom.tiktok.com/how-tiktok-recommends-videos-for-you?lang=en)).
  - "Refresh your For You feed" starts over as if you had just signed up, and can't be undone ([support](https://support.tiktok.com/en/account-and-privacy/account-privacy-settings/refresh-your-for-you-feed)).
  - Manage Topics offers more or less of a topic, never a full block ([newsroom](https://newsroom.tiktok.com/ie-for-you-feed-controls?lang=en-IE)).
- **YouTube.** "Not interested" with a "Tell us why" follow-up, "Don't recommend channel", and reasons shown on recommendations ([blog](https://blog.youtube/news-and-events/giving-you-more-control-over-homepage/), [help](https://support.google.com/youtube/answer/6342839?hl=en)).

## Research on preference elicitation

- **Grouped picks beat individual ratings.** Choosing among groups of movies took less than half the time of rating 15 movies and left users more satisfied ([Chang, Harper, Terveen, CSCW 2015](https://dl.acm.org/doi/10.1145/2675133.2675210)). Choice-based elicitation also beat rating ([Graus and Willemsen, RecSys 2015](https://research.tue.nl/en/publications/improving-the-user-experience-during-cold-start-through-choice-ba/), [Loepp et al., CHI 2014](https://dl.acm.org/doi/10.1145/2556288.2557069)).
- **Show titles people have seen.** Popularity-based candidates reached 10 ratings in 1.9 pages on average, against 7.0 pages for random titles ([Rashid et al., IUI 2002](https://cs.fit.edu/~pkc/apweb/related/rashid-iui02.pdf)).
- **Letting users choose what to rate increases loyalty** ([McNee et al., UM 2003](https://www.researchgate.net/publication/221261145_Interfaces_for_Eliciting_New_User_Preferences_in_Recommender_Systems)).
- **Fewer recommendations can satisfy as much.** Twenty good items did not satisfy people more than five ([Bollen et al., RecSys 2010](https://dl.acm.org/doi/10.1145/1864708.1864724)). The effect of choice overload depends on context ([Chernev et al. 2015](https://chernev.com/wp-content/uploads/2017/02/ChoiceOverload_JCP_2015.pdf)).
- **Visible controls get used once, then left alone.**
  - 25 percent of MovieLens users tried the algorithm switcher, and 72 percent of those settled on a non-default algorithm ([Ekstrand et al. 2015](https://md.ekstrandom.net/pubs/MultiRecs-Author.pdf)).
  - 85 percent moved a popularity dial away from its default ([Harper et al., RecSys 2015](https://files.grouplens.org/papers/harper-recsys2015.pdf)).
  - Movie Tuner raised detail page views by 52 percent, and 89 percent of users liked it ([Vig et al. 2011](https://files.grouplens.org/papers/navigating-the-tag-genome.pdf)).
- **Early ratings need a simple baseline.** For the first few ratings, a simple baseline beats collaborative filtering ([Kluver and Konstan, RecSys 2014](https://dl.acm.org/doi/10.1145/2645710.2645742)).

## Pattern catalog

### Patterns to copy

1. **A short, skippable cold start built from choices, not ratings.**
   - Netflix, Hulu, and HBO Max ask for "a few" picks. Spotify and Pinterest ask for about five.
   - The research favors choosing among grouped, well-known titles.
   - Aim for three to five taps and useful results within 60 seconds.
2. **Seen, Not interested, and a rating in one row on the card.** Taste.io puts Haven't Seen and Not Interested right next to its four rating words. Letterboxd's eye makes seen a one-tap back-fill, kept separate from a dated log.
3. **Dislike means "stop showing me this" everywhere.** Hulu and Prime Video both define dislike this way. Pair it with an undo, not a support ticket (compare Trakt).
4. **Service filtering on by default, one tap to widen.** Taste.io does this, and Prime Video's included, add-on, and buy markers explain each tile.
5. **Split the queue into "continue" and "start".**
   - Trakt's Continue Watching and Start Watching, JustWatch's buckets, and Apple's split of Up Next all do this.
   - "Start" should surface what just became available on your services.
6. **A reason on every recommendation.** Netflix's tile labels, Likewise's "why it is recommended", and YouTube's reasons all do this. Spotify's Prompted Playlist gives one line per item.
7. **Tiered negative feedback.** Spotify has hide here, snooze, and exclude from taste. The last level fits a partner's or kids' movie night.
8. **Identity artifacts people want to share.** The favorite four, Wrapped labels, Daylist names, and year-in-review cards all turn taste into something shareable.
9. **Small queues that expire.** Discover Weekly, Hinge's daily pick, Mubi's 30-day window, and Mubi's leaving-soon labels create urgency that an endless list lacks.
10. **Controls that are visible but coarse.** MovieLens found that a few dials get used once and raise satisfaction. Pinterest shows every taste input with a toggle.

### Gaps nobody fills well

- **"Not seen yet" that includes ratings and imports.** Most products hide seen titles only in paid tiers (JustWatch Pro, Letterboxd Pro) or not at all. None clearly combines "watched or rated" as the definition of seen.
- **Explaining taste with attributes.** Streamers explain with rows and labels, and trackers with time totals. Only MovieLens's tag genome lets you steer by attributes, and it is a research site with no availability data.
- **A watch queue that knows your services.** Letterboxd's "filter by services, sort by length" recipe is a manual workaround behind Pro. Prime Video users still ask to filter the watchlist to titles included with Prime.
- **A reversible, explicit "not interested".** It is paid (JustWatch), permanent (Trakt), missing (Letterboxd, Plex, Mubi), or buried.
- **Free "leaving soon" and "new on your services" alerts tied to your queue.** These are paywalled at Letterboxd and JustWatch, and limited to one catalog at Mubi.
- **Deciding together.** Couples swipe apps exist, but they are separate products. Only Apple and Taste.io bring household or partner taste into the main recommendations.
- **Manual queue order.** It has almost disappeared from the major services.

## Ideas that would make GoodWatch unique

1. **Taste shown as your fingerprint.**
   - Average the fingerprints of the titles you rated highly and those you skipped.
   - Show the result as a radar or bar portrait of your strongest attributes, for example "high tension, low romance, loves ensemble casts".
   - Let people tap an attribute to steer it more or less, as with Movie Tuner and Spotify's Taste Profile.
   - No competitor can show this, because none has 74 named attributes per title.
2. **A "why" line from the fingerprint on every card.**
   - Replace "Because you watched X" with the two or three attributes that most drive the match, such as "Matches your taste for slow-burn mystery and dry humor".
   - It can be computed at no query-time cost from the stored taste vector and the title's fingerprint.
3. **Show taste match inside the score ring.** Pair the GoodWatch score, which says the title is good, with a taste match, which says it is good for you. Taste.io proves people like a match score. No one pairs it with a quality score in one glyph.
4. **Three chips on every surface: On my services, Not seen yet, taste match.**
   - "Not seen yet" covers both watched and rated titles, and it is free.
   - This fills the paywalled gap at JustWatch and Letterboxd.
   - The same three chips appear on the start page, Discover, Search, and Watch next.
5. **Watch next that sorts itself for tonight.**
   - Filter the Wishlist to your services and order it by taste match.
   - Offer "Continue", "Newly on your services", and "Leaving soon" strips.
   - Offer a "short tonight" sort, following Letterboxd's own recipe.
   - Manual pinning keeps one or two titles on top, filling the manual-order gap.
6. **A 60-second cold start from fingerprint contrasts.**
   - Show pairs or small groups of well-known titles that differ on a few attributes, for example "cozy or tense", and let the person pick.
   - This follows the choice-based research and fills the fingerprint quickly.
   - Seen and Skip in the same card also build "Not seen yet" from the first minute.
7. **Tiered Skip.** Offer three levels:
   - "Not for me", which hides the title and lowers its attributes in your taste.
   - "Seen it, no rating", a one-tap back-fill.
   - "Watched for someone else", which excludes the title from your taste like Spotify's exclude.

   Every level has an undo.
8. **A weekly five that expires.** Every Monday, publish five worthwhile suggestions available on your services, with one familiar anchor for trust. Present it as a share card, reusing the five-title share list format.
9. **Watching together.** Combine two people's taste vectors, filter to titles available on both people's services, and show the attributes they agree on. Apple and Taste.io do versions of this, but none explains the overlap with attributes.
10. **A taste recap you can share.** Give monthly or yearly archetype labels built from fingerprint clusters, for example "Midnight Slow-Burner". Render them on the existing share card and OG image pipeline. This echoes Wrapped and Daylist, which were Spotify's most-shared features.
