# Age-rating filters in discovery, tracking and media-library tools

Research date: 2026-10-03. Scope: JustWatch, Letterboxd, IMDb, Trakt, TMDB, Reelgood, Plex, Jellyfin, Emby, Kodi, Simkl, Serializd, TV Time, Google TV, Apple TV app.

How to read this file:

- **"Source says"** = taken from the tool's own docs, source code, API, or a user's own forum post.
- **"Inference"** = my conclusion; always labelled.
- Quotes marked **(raw)** were read from the forum's raw text or API and are verbatim. Quotes marked **(via fetch)** came through a page-summarising fetch tool; wording is very likely right but was not checked character by character.
- Reddit could not be opened at all (see "Weak or unverifiable"). Nothing here rests on Reddit.

## Summary

1. **Two different jobs get called "age rating filter".** Discovery tools (JustWatch, TMDB, IMDb, Trakt) offer a *browse filter*: pick ratings, see matching titles. Library tools (Plex, Jellyfin, Emby, Kodi, Google TV, Apple TV) offer a *per-profile ceiling*: a parent sets a maximum and the child never sees more. Almost all loud user feedback is about the second job. GoodWatch is planning the first.
2. **The single most repeated failure is the unrated title.** Every tool had to pick: hide unrated titles (kids lose half the library, home videos vanish) or show them (horror slips into a child profile). Users complain loudly in both directions. Tools that ended up well-regarded made it an explicit, visible choice (Jellyfin and Emby's "block items with no or unrecognized rating" switch; Trakt's separate "Unrated" bucket).
3. **Unrated is not an edge case, it is a large share of the catalog.** Measured on JustWatch's public API today: in Germany only 64% of movies and 54% of shows carry an FSK value; in the US only 30% of movies carry an MPAA rating. An inclusion-style filter silently drops the rest.
4. **Country ladders break in predictable ways.** The local rating is missing so a US rating is shown instead; the local ladder has steps the preset buckets do not (UK 12/15, Australian M/MA15+, US TV-Y7, Italian VM14); TV and movies use different ladders, or the country has no TV ladder at all.
5. **Three control shapes exist in the wild**: (a) raw local ladder as multi-select (JustWatch, TMDB, IMDb), (b) a few named buckets mapped from US ratings (Trakt: All Ages / Parental Guidance / Teens / Mature / Unrated; Plex: Younger Kid / Older Kid / Teen), (c) a normalized age score with a "max" selector (Jellyfin, Emby). Buckets are simple but draw complaints about where borderline ratings land; raw ladders draw complaints when the local rating is missing.
6. **Who is asking: overwhelmingly parents** (and uncles, grandparents) of young children. A second, smaller group wants *content-specific* filtering (violence, nudity, profanity) because the official rating is too coarse, including people screening films for "kids, family, teenagers, religious groups". I found no first-hand requests from adults wanting to *exclude* kids' content via age rating in these sources.
7. **Parents do not trust the rating alone.** Repeated requests for per-title exceptions ("Parent-Approved" tag), genre combined with rating, and Common Sense Media / IMDb Parents Guide data.
8. **Letterboxd has no certification filter**, and its feedback board is sign-in gated, so demand there could not be measured.

## What exists today, per tool

| Tool | Age-rating filter? | Control shape | Adapts to user's country? | Unrated handling | Source |
|---|---|---|---|---|---|
| **JustWatch** | Yes, browse filter "Age rating" (label present in page markup; URL param `age_certifications`) | Multi-select inclusion list of the country's labels. API filter field is `ageCertifications: [..]` | Yes, per-country list. API returns for DE movies `0, 6, 12, 16, 18` (+ `FSK0`… duplicates); FR `U, 10, 12, 16, 18…`; GB `U, PG, 12A, 12, 15, 18, R18` followed by ~30 stray provider labels (`13+`, `Mature`, `Kids & Family`, `MA 15+`…) | Inclusion list, so unrated titles drop out once any value is picked. No "unrated" option in DE list; US list contains `UNRATED` | Own measurement against `apis.justwatch.com/graphql` (`ageCertifications(country, objectType)` and `popularTitles(filter)`), 2026-10-03; page markup of `justwatch.com/us/movies`. Which labels the UI actually shows was not visually verified. |
| **TMDB** (website discover) | Yes, "Certification" block in the filter panel | Multi-select chips of the local ladder, including an explicit `NR` chip | Yes, by request country. Fetched from a Danish IP: movie filter showed `NR, A, 7, 11, 15, F` with `certification_country: 'DK'`; the **TV** filter rendered the same heading with **zero options** | `NR` is selectable on movies | Own fetch of `themoviedb.org/movie` and `/tv`, 2026-10-03. API: `certification`, `certification.gte`, `certification.lte`, `certification_country` on [discover/movie](https://developer.themoviedb.org/reference/discover-movie) |
| **IMDb** (web advanced title search) | Yes, "US Certificates" | Checkboxes G / PG / PG-13 / R / NC-17, OR-ed | No in the UI (US only). The URL accepts other countries (`certificates=GB:…`, `!GB:U`) by hand-editing. Not available in the mobile app | Not offered | Staff reply (via fetch): "We do not currently have certificates as a search filter on the IMDb app" pointing to web "US Certificates": [thread](https://community-imdb.sprinklr.com/conversations/imdb-app-android-fire-devices/how-to-filter-by-mpaa-or-tv-rating/611c7994e7ad7876d438613f). Param description: [List of URL search parameters](https://community-imdb.sprinklr.com/conversations/imdbcom/list-of-url-search-parameters/63ea4a177b6e8854fbd45819). The search page itself returned 403/202 to me. |
| **Trakt** (new web app, since March 2026) | Yes, "Certification" filter, also usable in Smart Lists | Five named buckets mapped onto US ratings: All Ages = `g, tv-y, tv-y7, tv-g`; Parental Guidance = `pg, tv-pg`; Teens = `pg-13, tv-14`; Mature = `r, tv-ma`; Unrated = `nr`. Single-select in simple mode, multi-select in advanced. Plus advanced-only severity sliders (None/Mild/Moderate/Severe) for nudity, violence, profanity, alcohol, frightening | No. API docs: "US content certification", and "Only `us` certifications are currently returned" | Explicit "Unrated" bucket | Source code [`filters/_internal/constants.ts`](https://github.com/trakt/trakt-web/blob/main/projects/client/src/lib/features/filters/_internal/constants.ts) and `parentalGuideFilters.ts`; [PR #1958](https://github.com/trakt/trakt-web/pull/1958) (merged 2026-03-25, fixes issue #1934 "Add 'Age Rating' filtering"); Trakt API blueprint (`jsapi.apiary.io/apis/trakt.apib`) |
| **Letterboxd** | No filter found | n/a. FAQ lists no certification filter; a third-party extension (Letterboxd Extras, 94 GitHub stars) adds "MPA film ratings: Display the film's MPA rating" (display only) | n/a | n/a | [FAQ](https://letterboxd.com/about/faq/) (via fetch); [Letterboxd-Extras README](https://github.com/duncanlang/Letterboxd-Extras). `letterboxd.com/films/` and the API docs returned 403, so the absence is not confirmed from the browse UI itself. |
| **Plex** | Per-profile ceiling, plus a "Content Rating" library filter | Three preset buckets: "Younger Kid: allows TV-Y, G, TV-G, and other equivalent ratings / Older Kid: … TV-PG, PG … / Teen: … TV-14, PG-13". Picking "None" lets Plex Pass users choose individual ratings and labels | Partly. Library has a "Certification Country"; since March 2021 non-US ratings are stored with a prefix (`de/12`, `gb/12A`). Presets are defined in US terms plus "equivalent"; falls back to US rating when local one is missing | Under a preset profile, unrated library items are hidden; unrated *online* (Discover/VOD) items have leaked through | [Parental Controls doc](https://support.plex.tv/articles/parental-controls/) (raw); staff [Notice on Content Rating updates](https://forums.plex.tv/t/notice-on-content-rating-updates/698847) |
| **Jellyfin** | Per-user ceiling, plus a "Parental Ratings" library filter | "Maximum allowed parental rating" dropdown of normalized, merged steps (an entry is literally named "18+/TV-MA/R"); each country's labels map to an age score (`Users.MaxParentalRatingScore = 10`); separate checkbox "Block items with no or unrecognized rating information"; allow/block tags | Yes, per-country rating tables (`Localization/Ratings/it.json` etc.) keyed off the metadata country | Explicit switch | GitHub issues [#16325](https://github.com/jellyfin/jellyfin/issues/16325), [#17932](https://github.com/jellyfin/jellyfin/issues/17932); feature post [#2523](https://features.jellyfin.org/posts/2523) reply. The official docs page for parental controls returned 404. |
| **Emby** | Per-user ceiling | "Max parental rating"; country ratings map to a numeric scale (staff, via fetch: "FR-U,1 / FR-10,5 / FR-12,7 / FR-16,9 / FR-18,10"); per-item "Custom Rating"; allow/block tags | Yes, prefixed country ratings (`GB-15`, `FR-12`) | Doc: max rating "will not affect unrated content, but there are additional options to control that as well" | [Parental Controls doc](https://emby.media/support/articles/Parental-Controls.html) (via fetch); [staff reply](https://emby.media/community/topic/66413-parental-ratings-custom-ratings) |
| **Kodi** | No rating-based restriction; rating is a free-text field usable in smart playlists | Workaround: profiles with separate sources, or smart playlists on the MPAA string | Scraper setting "Preferred Certification Country", applied only at first scrape | n/a | Forum answers in [tid=333132](https://forum.kodi.tv/showthread.php?tid=333132), [tid=369970](https://forum.kodi.tv/showthread.php?tid=369970), [tid=339099](https://forum.kodi.tv/showthread.php?tid=339099) (raw) |
| **Google TV** | Per kids-profile ceiling | "ratings limits for Movies and TV" | Not stated | Not stated | [Google TV help](https://support.google.com/googletv/answer/10070481?hl=en) (via fetch). Applies to "Google's movie and show recommendations" and Family Library; does **not** apply to "Content recommendations directly provided by apps" or "Search results from apps" |
| **Apple TV app** | Per-device ceiling | "Ratings For: choose the country or region", then a movie ceiling and a separate TV ceiling ("one of the available ratings to restrict … to that rating and below") | Yes, user picks the country ladder | "Allow All / Don't Allow" extremes | Search-engine snippet of `support.apple.com/guide/tvapp-windows/atvae67c4f8c`; the page itself returned 404 to me, so treat as weakly verified |
| **Reelgood** | Unverified | 2019 review: "includes an age rating, you can't sort by it" | Unverified | Unverified | [TidBITS 2019](https://tidbits.com/2019/06/21/a-million-streams-and-nothing-to-watch-reelgood-and-justwatch-to-the-rescue/) (secondary, old). `reelgood.com` returned 403. |
| **Simkl** | No filter found | API returns a single `certification` string per title (`"TV-MA"`, `"PG"`, `null`) | No evidence | n/a | Simkl API blueprint; best-movies page has no certification/age filter markup |
| **Serializd, TV Time** | Unverified | Serializd returned 403; TV Time's site is a near-empty shell | | | Could not be opened |

### Measured: how much of the catalog has a rating (JustWatch public API, 2026-10-03)

| Country, type | Total titles | Titles matching the country's main ladder | Share |
|---|---|---|---|
| DE movies | 68,045 | 43,290 (`0/6/12/16/18` incl. `FSK*` spellings) | 64% |
| DE shows | 20,509 | 11,081 | 54% |
| US movies | 163,545 | 49,080 (`G, PG, PG-13, R, NC-17`) | 30% |
| US shows | 41,595 | 22,313 (`TV-Y … TV-MA`) | 54% |
| US shows with a *movie* label (`G … NC-17`) | 41,595 | 127 | 0.3% |

Notes: this is my own query, not a JustWatch statement. Titles carrying only stray provider labels (`18+`, `Mature`) are not counted, so "has some label" is somewhat higher than shown. The last row shows that movie and TV ladders are effectively disjoint: one ladder cannot filter both.

## What users ask for and complain about

### 1. Unrated titles: hidden or leaking, both are complaints

Leaking:

- Plex, uncle of a child (raw): "my nephew who had a younger child restriction was able to view mature content from the unrated 'Shirley: Visions of Reality'. Unrated content should NEVER be accessible to restricted profiles." [thread](https://forums.plex.tv/t/plex-movies-tv-bypassing-content-rating-restrictions-if-unrated/762671) (1 post, 100 views)
- Jellyfin feature post "Parental control should consider 'Unrated' etc higher than xxx" (5 votes, completed) (raw): "This protects against scraping missing a rating on something horrible for children showing up on childrens accounts." [post](https://features.jellyfin.org/posts/2523)
- Jellyfin forum (via fetch): "Items with a specific rating of 'Rated NR': Are being considered as like G rated / safest rated media when they shouldn't be" [thread](https://forum.jellyfin.org/t-solved-maximum-allowed-parental-rating-does-not-filter-rated-nr-content) (5 replies, 2025). Related request, anime owner (via fetch): "many anime series that the default rating is NR" [thread](https://forum.jellyfin.org/t-block-nr-content-once-parental-rating-selected)
- Jellyfin bug [#17932](https://github.com/jellyfin/jellyfin/issues/17932) (raw): Italian `VM14`/`VM18` are not in the rating table, so "The item is treated as **unrated** and therefore **bypasses parental controls entirely** — silently, with no indication in the UI."

Hidden:

- Plex (raw): "So the conclusion for me is, that if there is no rating for a tv-show or movie, it doesn't show up on a restricted profile at all." [thread](https://forums.plex.tv/t/tv-show-is-missing-in-kids-profile/712993) (7 posts)
- Plex, home videos (raw): "I have over 4000 videos - am i supposed to rate every single one of them?" and "Immediately rating unrated content as restricted, contradicts the meaning of it being unrated." [thread](https://forums.plex.tv/t/all-unrated-video-files-are-hidden-from-any-managed-user-with-a-restricted-profile/788207) (8 posts, 404 views)
- Plex (raw): "half of the movies I was sharing did not show on their profile because the collection had no rating." [thread](https://forums.plex.tv/t/a-collection-that-lacks-a-content-rating-should-still-show-if-any-of-its-movies-content-ratings-are-allowed/555441) (11 posts, 5 votes)
- Jellyfin "One for parents - Content Ratings" (38 votes, 10 comments, open since 2020) (raw): "I have a child account limited to 12 and below (UK), however, not all series/movies have the UK ratings associated with them (or any at all) so don't appear!" [post](https://features.jellyfin.org/posts/563)

Wanting to *see* which titles are unrated:

- Jellyfin (raw): the rating filter "does not allows to choose only the movies without any value" (3 votes) [post](https://features.jellyfin.org/posts/2754); forum, a parent (via fetch): "I want to make sure all media has ratings … so that my kids can watch shows they are supposed to be able to see." [thread](https://forum.jellyfin.org/t-filter-items-without-parental-ratings)
- Infuse (not in scope list, same pattern) (via fetch): "Should there not be a category called 'unknown' or the like for movies that have no certification?" [thread](https://community.firecore.com/t/add-filter-for-movies-with-unknown-missing-age-rating/32898)

### 2. Wrong-country ratings and the fallback to US

- Plex UK, 2015 (raw): "things like tv17 or NC-17 doesnt make mucg sense to us over in the UK"; reply: "if the cert for UK isn't listed then you get US." and "This of course makes little sense to a British parent used to British Board of Film Classification (BBFC) ratings". [thread](https://forums.plex.tv/t/add-age-film-rating-for-the-uk/106725) (5 posts, 457 views)
- Plex UK, 2020 (raw): "all the ratings for our tv and films seems to be mostly American Classifications. Is there any way to set plex to pull local BBFC classifications only." [thread](https://forums.plex.tv/t/bbfc-classification/659280)
- Plex, mixed ladders in one library (raw): "the content ratings are a complete and utter mess" (via fetch) [thread](https://forums.plex.tv/t/movies-getting-wrong-content-ratings/481833) (6 replies)
- Jellyfin grandparent (raw): "Parental Rating is already a nightmare where seeming equivalents do not overlap, TV-G is not G and not CA-G!" [post](https://features.jellyfin.org/posts/2754)
- Jellyfin [#16325](https://github.com/jellyfin/jellyfin/issues/16325): a show rated `CA-C` (Canadian children's rating) is hidden from a user whose ceiling is the highest step, because the Canadian label does not compare against the US-based ceiling. [#16387](https://github.com/jellyfin/jellyfin/issues/16387): ratings keep the old region after the region setting changes.
- Trakt, non-US user on the new Certification filter (raw): "'Certification' is meant to filter 'ok for kids' I guess ? But those are US ratings so the categories mean nothing anywhere else. And the US ratings are harder than in most countries, so they're not equivalent" [thread](https://forums.trakt.tv/t/use-of-smart-lists/122140) (3 posts, 151 views, Aug 2026)
- Trakt (raw): a thriller shows as G; reply: "it does have different ratings in different countries, but in the US it seems to be rated G...which is what I assume Trakt uses by default." [thread](https://forums.trakt.tv/t/change-certification/22919) (5 posts)
- IMDb, Australian user (via fetch): "what MPAA refer to a 'R', here it's most likely MA15+"; staff confirmed a localisation bug and fixed it. [thread](https://community-imdb.sprinklr.com/conversations/imdbcom/how-can-i-show-the-certification-for-another-country/6528ef07635a8c0f7c2c91ce)
- TMDB: a 34-reply staff thread of users asking for missing country ladders (Singapore, Nepal, Saudi Arabia; fixes for AU, NZ, IT, ES, JP…), opening with the error "Certification is not valid for the selected country". [thread](https://www.themoviedb.org/talk/63b7df66f44f2700a020d6f4?page=2) (via fetch). An older staff thread collects requests for TV ladders (Germany FSK, Netherlands Kijkwijzer, South Korea…). [thread](https://www.themoviedb.org/talk/534413860e0a263a0200229b)

### 3. Preset buckets do not fit the local ladder or the parent's judgement

- Plex UK (raw): "there is no distinction between a younger and older teen … a Teen in the UK who is 15 should be able to watch 15 rated movies" and "Simply put, for UK users with children, the current Teen categorisation doesn't work!" The poster bought Plex Pass only to get per-rating control and got no staff reply in 8 posts. [thread](https://forums.plex.tv/t/uk-parental-controls/818838)
- Plex UK (raw): "any film with a U rating will not be included by the content filter"; the poster suspects "a manager or developer has misconstrued 'U' as 'Unrated'". Staff could not reproduce. [thread](https://forums.plex.tv/t/uk-u-content-rating-not-recognised-in-content-restriction-filters/770001) (9 posts); same report in [661010](https://forums.plex.tv/t/content-rating-profile-matching-bug/661010) and [698619](https://forums.plex.tv/t/age-restriction-with-british-certification/698619)
- Plex, TV-Y7 falls between buckets (raw): "TV-Y7 is filtered out. All TV-Y7 content is hidden from the user's profile." A moderator answers the grouping "was intended to *reduce* complexity." [thread](https://forums.plex.tv/t/tv-y7-is-filtered-out-of-younger-kid-restriction-profile/871166); duplicates [793046](https://forums.plex.tv/t/add-tv-y7-rating-is-not-accounted-for-in-tv-show-ratings/793046), [855565](https://forums.plex.tv/t/allow-more-tv-ratings-in-managed-accounts/855565) ("Allowing half the ratings seems pretty bad design.")
- Plex, naming (raw): "The fact that Plex have labelled the the profile required as 'None' instead of 'Custom' makes absolutely no sense".
- Jellyfin Australia, after ratings were merged into age steps (raw): "Now my 10 year old can match MA15+ movies if i choose PG because its combined with 16+????" [post #563 comment](https://features.jellyfin.org/posts/563); forum (via fetch): "I would allow my kids to watch a PG rated movie; but not an M or MA rated one." [thread](https://forum.jellyfin.org/t-parental-controls-and-content-rating); bug [#11650](https://github.com/jellyfin/jellyfin/issues/11650)
- Jellyfin (raw): "TV does not have an equivalent rating to R and many shows that are equivalent to R get shoved into TV-MA which should not be equivalent to NC17" [post](https://features.jellyfin.org/posts/3821) (1 vote)
- Plex, German ratings sort as strings (`de/0, de/10, de/12 … de/6`); moderator reply (raw): "there's no common schema for content ratings … you'll need an international mapping table to specify the actual sequence (though not all ratings are part of an actual sequence)." [thread](https://forums.plex.tv/t/sort-by-age-rating-integer-not-string/757672)

### 4. The rating alone is not enough: exceptions, genre, content descriptors

- Jellyfin "Allowed Tags/Whitelist to Work in Conjunction with Maximum Parental Rating" (26 votes) (raw): "any parent would tell you that they don't explicitly follow age ratings. There's always exceptions. Especially when a kid ends up obsessed with a character from a PG-13 series" [post](https://features.jellyfin.org/posts/2732); "Allow Per-Item Exceptions to Parental Rating Restrictions" (7 votes) [post](https://features.jellyfin.org/posts/4030)
- Jellyfin "Improve Parental Control Granularity" (25 votes) (raw): "there are still some movies which are certified U or PG which aren't intended for children (for example, Apollo 13 is a PG certificate). I would like to further restrict my daughter's view of the library to genres like 'Family' or 'Kids'." [post](https://features.jellyfin.org/posts/2580)
- Emby (via fetch): *Jaws* (GB-PG) deemed unsuitable, *The Addams Family* at the same rating fine; request to combine genre and rating. [thread](https://emby.media/community/topic/88122-parental-control-improvements) (20+ replies)
- Plex "Age Appropriate Ratings from CommonSenseMedia.org" (61 posts, 14 votes, 36 likes; marked implemented) (raw): "these seem to be more accurate then PG-13, R, etc ratings we have now". [thread](https://forums.plex.tv/t/implemented-age-appropriate-ratings-from-commonsensemedia-org/97954)
- IMDb "Advanced search by parents guide categories" (status "under review") (via fetch): "I see movies with all kind of groups (kids, family, teenagers, religious groups etc.) it is very important not to show something disturbing, scandalous or unfitting." Others ask for filters by Violence / Sex & Nudity / Profanity / Frightening at None–Severe. [thread](https://community-imdb.sprinklr.com/conversations/imdbcom/advanced-search-by-parents-guide-categories/62cc8ba0ee0dfc016ae52463)
- Trakt shipped exactly that: severity sliders per category, requested in [issue #2023](https://github.com/trakt/trakt-web/issues/2023) (raw): "Is a movie rated R because of swearing, strong violence or explicit nudity?"

### 5. Plain "let me filter by rating" requests in discovery contexts

- IMDb app (via fetch): "I want to find only G or PG movies, which I would assume is one of the basic filters in Advanced Search. But I cannot find it." [thread](https://community-imdb.sprinklr.com/conversations/imdb-app-android-fire-devices/how-to-filter-by-mpaa-or-tv-rating/611c7994e7ad7876d438613f) (3 replies, 1.5K views)
- Plex watchlist (raw): a content-rating filter "would really help find movies and shows for family nights that are age appropriate." [thread](https://forums.plex.tv/t/watchlist-filter-by-content-rating/905756) (1 vote)
- Trakt (raw): "It would be nice to have that tag appear for movies and shows that are appropriate for kids (moreso than the 'family' tag)." [thread](https://forums.trakt.tv/t/genre-children/29600) (6 posts, 131 views)
- Kodi (raw): "is there a way to ask for a password for any movie with a rating higher than G or PG"; German parent ends up sorting files into "Movies/FSK 0", "Movies/FSK 6" folders by hand. [333132](https://forum.kodi.tv/showthread.php?tid=333132), [369970](https://forum.kodi.tv/showthread.php?tid=369970)

### 6. The filter is only as good as its weakest surface

The largest threads are not about the filter itself but about recommendation rows that ignore it.

- Plex "Adult Recommendations are not acceptable (NSFW)": 597 posts, 23,338 views, 798 likes. [thread](https://forums.plex.tv/t/adult-recommendations-are-not-acceptable-nsfw/787577)
- Plex "WARNING: Discover/Watchlist and children concern": 57 posts, 2,478 views, 81 likes (raw): "Yesterday I had my kid see the trailer of the horror movie Dawn of the Dead … clicked on his Noddy show, scroll down and sees recommandations". [thread](https://forums.plex.tv/t/warning-discover-watchlist-and-children-concern/786738); repeated in 2024: [874642](https://forums.plex.tv/t/managed-user-can-access-discover-through-watchlists/874642) (18 posts)
- Google's own doc concedes the same gap: restrictions do not apply to "Search results from apps".
- Jellyfin bugs of the same kind: "Recently Added show sections fail to apply Parental Control filters" (#16497), artwork (#12855), special features (#17014).

## Who is asking

Source says:

- Parents and other carers of young children are nearly every poster above (ages named: 3, 5, 9, 10; "my kids", "my daughter", "my nephew", "my gradeschool grandkids", "putting together a KODI box for my sister, who has two small children").
- One IMDb poster screens films for mixed groups including religious groups; this is the only religious motive I found.
- Non-US users (UK, Australia, Germany, Italy, Canada, France) are heavily over-represented among the complaints, because the US ladder is the default they are fighting.

Not found in these sources: adults asking to hide children's content via age rating, or adults avoiding R-rated content for themselves. That absence may reflect where I could look (library-tool forums skew to parental control) rather than real demand.

## Patterns in the better-received implementations (inference)

All points in this section are my inferences from the material above.

1. **Make "unrated" a visible, user-controlled state.** Jellyfin and Emby's explicit switch and Trakt's "Unrated" bucket draw no complaints about the concept; Plex's silent rule draws complaints from both sides. With 36–70% of the measured catalogs (DE and US, movies and shows) lacking a rating on the main local ladder, an inclusion-only filter will look broken.
2. **Use the viewer's local ladder for labels, and say when a title's rating is borrowed.** The fallback-to-US behaviour is the root of the UK/AU complaints. A normalized age behind the scenes (Jellyfin/Emby) is what makes cross-country comparison possible, but users want to see and pick their own labels (FSK 12, not "Teen").
3. **Do not merge adjacent local steps into coarse buckets.** Every bucket boundary complaint (UK 12 vs 15, AU PG vs M vs MA15+, TV-Y7) is about lost steps. Buckets were adopted "to reduce complexity" and are the thing Plex users pay to escape.
4. **Movies and TV need one control that maps both ladders**, not two. JustWatch's data shows the ladders do not overlap, and TMDB's empty TV certification box in Denmark shows what happens when a country has only one.
5. **A "max age" ceiling matches how people phrase the need** ("12 and below", "PG or below", "only G or PG"). Requests are for an upper bound, almost never for a min–max range or an exact match. A lower bound was not requested anywhere I looked.
6. **Rating plus something else.** Where a tool offers only the rating, parents ask for genre, per-title exceptions, or content descriptors. For a discovery filter the cheap version is letting age rating combine with genre; the richer version is Trakt-style descriptor sliders.
7. **Apply it everywhere or say where it does not apply.** Related-title rows and recommendations that ignore the filter generated the angriest and largest threads by an order of magnitude.

## Weak or unverifiable

- **Reddit: not opened at all.** `www.reddit.com` JSON returned 403, `old.reddit.com` redirected to a login wall, the search tool refuses the domain, and the Pullpush archive rejects automated use. r/JustWatch, r/Letterboxd, r/PleX, r/jellyfin, r/trakt, r/cordcutters are therefore **not covered**, and no search-engine snippets of Reddit were used. This is the biggest gap: Reddit is where JustWatch and Letterboxd users talk.
- **Letterboxd demand is unmeasured.** The official board (`feedback.letterboxd.com`, a Nolt board) requires sign-in and hides vote counts; `letterboxd.com/films/` and the API docs returned 403. "No certification filter" rests on the FAQ and on the existence of a display-only third-party extension.
- **JustWatch user feedback: none found.** No public feature board; app-store reviews were not readable. The table row describes the API and page markup, not the rendered control. Whether the UI shows the stray provider labels (`Mature`, `13+`) or only the canonical ladder is unknown.
- **JustWatch coverage numbers** are a single query run on one day against an undocumented API, counting only the canonical ladder.
- **IMDb**: the advanced search page could not be loaded; the US-only UI claim rests on IMDb staff replies and community posts. The "16.2K" figure on the parents-guide thread is unlabelled; I read it as views, not votes.
- **Apple TV app**: from a search snippet of Apple's guide; the page 404'd.
- **Reelgood, Serializd, TV Time**: no first-hand source reached. Reelgood's row is a 2019 secondary review.
- **Simkl**: "no filter" is based on one browse page and the API blueprint.
- **Emby**: doc and thread content came through the summarising fetch tool; the numeric scale quote is as relayed.
- **TMDB country adaptation** was observed from one IP (Denmark) only; I did not test a logged-in country preference.
- **Thread sizes are small** outside Plex's two recommendation threads. Most individual threads have 1–11 posts and single-digit votes. The findings are strong because the same complaint recurs independently across Plex, Jellyfin, Emby, Kodi, Trakt, IMDb and TMDB over 2015–2026, not because any one thread is large.
- **Selection bias**: library-server forums are where parental-control users gather, so "parents" dominating the voices is partly an artefact of where public forums exist.
