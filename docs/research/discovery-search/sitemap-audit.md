# GoodWatch sitemap audit

Audit date: 2026-10-18. Read-only assessment; recommendations below are not implemented.

## Recommendation

Keep **1,000 titles as the current ceiling**, retain the **87 category pages and 11 static pages**, and improve which titles occupy those slots before increasing the count. Use a stable, vote-led core with at most 10% current-popularity selections. Correct misleading `lastmod` dates, indexable guest shells and oversized episode-grid responses that exceed Googlebot's documented fetch limit. Keep search, personal pages, public share lists, duplicate views and redirects out. Person pages deserve a small, separately measured experiment only if the owner reverses the October 6 scope decision.

**There is no missing static-page emergency:** `/support` and `/use-with-ai` are already in the generator, the committed XML, and the live sitemap. The live total is **1,098**, not the older 1,096. The master index is already flat and working; it does not currently nest indexes.

## Scope, evidence and reproducibility

- Source inspected: fetched `origin/main` at `7e017f9d378d31ddd81813547dcf43997de895fd`, not the worktree's checked-out source. All source findings below refer to that revision. Later changes to main are outside this snapshot.
- Read [sitemap operations](../../sitemap.md), [the map, issue 347](https://github.com/alp82/goodwatch-monorepo/issues/347), [issue 351 and its resolution](https://github.com/alp82/goodwatch-monorepo/issues/351), and [the index record](index-record.md), including the actual CSVs. The October 16 map comment and current operations document supersede the older “manual only” scheduling note. No Windmill settings or job history were inspected or changed.
- HTTP evidence: fresh unauthenticated GETs, with the desktop Googlebot user-agent, no Cookie header or cookie jar, no redirect following, inspecting server HTML, canonical links, robots meta and `X-Robots-Tag`. A Googlebot user-agent simulation is **not** Google's verified crawler or its JavaScript rendering service. “Guest content” below means substantive content in the HTML body after removing scripts/styles, not merely serialized loader data. Initial-request response evidence is reported separately from redirect destinations.
- Parsed all seven live XML files, checked all seven XML files against main, and inspected every human-facing route family. Every one of the 87 sitemap category URLs was requested; title checks are representative, not a repeat of the 1,000-title publication check. Specific user identities, concrete profile/list URLs and raw response bodies are deliberately omitted from this public report.
- Catalog evidence: read-only `SELECT` queries against movie/show data and a minimal public-only list/profile lookup. Queried 20,789 movies and 4,867 shows satisfying the existing quality predicates; all also satisfied the 30-day details freshness predicate at audit time. All 1,000 live title IDs matched catalog rows. No database, generator, sitemap, application, scheduler or production configuration was changed.
- Historical membership comes from committed XML, not a reconstruction using today's popularity. Counterfactual membership uses the audit-time catalog joined to the exact live sitemap IDs; it is a one-time selection comparison, not a backtest of traffic.

### What Google evidence actually says

Issue 347 records the owner-read Search Console figures of roughly 120 known URLs and 1.4 page fetches/day. Those are historical baseline observations, not a newly measured current rate. The committed CSV is more current than its prose summary:

| Run | Indexed | Crawled, currently not indexed | Unknown | Sample size |
| --- | ---: | ---: | ---: | ---: |
| October 10 | 1 | 0 | 49 | 50 |
| October 15 | 1 | 3 | 46 | 50 |
| October 17 | 1 | 4 | 45 | 50 |

On October 17, the indexed page is `/`; the four crawled pages are `/shows`, `/discover`, `/explorer` and `/shows/genres`. All 25 sampled titles and all five sampled people remain unknown. In the seven-day traffic window ending October 14, only `/` received impressions: 179 impressions and four clicks. The submitted master sitemap had zero recorded errors/warnings, and `lastDownloaded` was still October 10, despite subsequent file updates. See [coverage CSV](index-record.csv), [traffic CSV](index-record-traffic.csv), and [sitemap CSV](index-record-sitemaps.csv).

The record does **not** inspect every sitemap URL, so it cannot establish that all 1,096 historical entries, or all 1,098 current entries, are unknown. It supports “sampled titles are still undiscovered,” with a few hubs now crawled. It does not yet provide a quality verdict on the title inventory.

## 1. Completeness and guest indexability

Notation: **Self** means one canonical exactly equal to the tested URL; **Base** names a different preferred URL; **—** means no canonical/robots meta in that response. `I/F` = `index, follow`; `N/F` = `noindex, follow`; `N/N` = `noindex, nofollow`. No tested page carried an `X-Robots-Tag` restriction except the retired browser-check endpoint. Missing robots meta is not a `noindex` instruction. The two public-list observations below refer to a real existing public sample, not a fabricated missing identifier.

### Existing public landing pages

| Type / live specimen | HTTP | Canonical | Robots | Real guest HTML | In sitemap? / Recommendation |
| --- | --- | --- | --- | --- | --- |
| `/` | 200 | Self | I/F | Product explanation, 16 start-title links, hubs | Yes / Keep; discovery entry point |
| `/movies`, `/shows` | 200 each | Self each | I/F | Heading, introduction, category links | Yes / Keep both |
| `/discover` | 200 | Self | I/F | Heading and 40 initial title cards | Yes / Keep bare hub |
| `/explorer` | 200 | Self | I/F | Extensive island descriptions and title links | Yes / Keep bare hub |
| `/how-it-works` | 200 | Self | I/F | Public product explanation | Yes / Keep |
| `/about` | 200 | Self | I/F | Short but real product explanation | Yes / Keep |
| `/support` | 200 | Self | I/F | Contact, account and AI integration help | Yes / Keep; already added October 17 |
| `/use-with-ai` | 200 | Self | I/F | Public AI-app setup and usage instructions | Yes / Keep; already added October 17 |
| `/privacy` | 200 | Self | I/F | Detailed policy | Yes / Keep; trust/legal utility, little expected acquisition traffic |
| `/disclaimer` | 200 | Self | I/F | Ratings/data attribution and disclaimer | Yes / Keep; limited acquisition priority |
| `/movies/{moods,genres,streaming}` | 200 all three | Self each | I/F | Category introductions and links | Yes / Keep |
| `/shows/{moods,genres,streaming}` | 200 all three | Self each | I/F | Category introductions and links | Yes / Keep |
| Configured movie category leaves, e.g. `/movies/moods/scary`, `/movies/genres/drama`, `/movies/streaming/netflix` | 200 in every tested leaf | Self each | I/F | Distinct introduction and initial title results | Yes / Keep configured leaves; see complete category check below |
| Configured show category leaves, e.g. `/shows/moods/scary`, `/shows/genres/drama`, `/shows/streaming/netflix` | 200 in every tested leaf | Self each | I/F | Distinct introduction and initial title results | Yes / Keep configured leaves |
| Accidental cross-media category leaves: `/movies/genres/talk`, `/shows/genres/action` | 200 each | Self each | I/F | Copy and FAQ, but **no results** and mismatched media wording | No / Keep out; reject media-inapplicable leaves with 404 rather than adding them |
| Category pagination: `/movies/genres/drama?page=2` | 200 | Self including `?page=2` | I/F | Distinct subsequent title results | No / Keep out for now; crawlable pagination supplies access without expanding submitted inventory |
| Movie detail: `/movie/157336-interstellar` | 200 | Self | I/F | Ratings, fingerprint, streaming, cast, related titles and Q&A | Selected 700 / Keep selected canonical titles |
| Show detail: `/show/1396-breaking-bad` | 200 | Self | I/F | Same core content plus episode grid | Selected 300 / Keep selected canonical titles |
| Person: `/person/287-brad-pitt` | 200 | Self | I/F | Career statistics, fingerprint characteristics, collaborators and substantial filmography | No / Technically suitable; consider selected pilot, not blanket inclusion |

The person's roughly 6,400 characters of main-content text are substantive; the case against automatic inclusion is **experiment scope and uncertain demand**, not a login wall or an empty page. Both an established movie and show proposed for restoration were checked live: *The Silence of the Lambs*, *Jurassic Park*, *Sherlock* and *Chernobyl* all return 200, self canonical, I/F, with substantive guest content. Do not infer that every counterfactual candidate has received a live health check.

Relevant source: [static generation](../../../goodwatch-webapp/scripts/create_sitemaps.py), category route files in [routes](../../../goodwatch-webapp/app/routes), [category address rules](../../../goodwatch-webapp/app/ui/explore/address.ts), [metadata helpers](../../../goodwatch-webapp/app/utils/meta.ts), and [title metadata](../../../goodwatch-webapp/app/utils/detailsMeta.ts). The generator has no person-query branch.

The six intended category families are covered correctly, but route validation accepts cross-media combinations absent from the sitemap. Both `/movies/genres/talk` and `/shows/genres/action` returned empty result sets with self canonicals and `index, follow`; the former even says “Best talk shows movies.” The [address validator](../../../goodwatch-webapp/app/ui/explore/address.ts) validates type and leaf independently without enforcing the leaf's media applicability. Fix that validation; these are accidental indexable thin pages, not sitemap omissions.

### New, personal, interactive and transactional routes

| Type / live specimen | HTTP | Canonical | Robots | Real guest HTML | In sitemap? / Recommendation |
| --- | --- | --- | --- | --- | --- |
| `/taste` | 200 | Self | I/F | Only three tab labels, about 31 characters; guest view is a skeleton | No / Do not add; use `noindex` for personal view or build a useful public landing page first |
| `/taste/fingerprint` | 200 | Self | I/F | Same tab labels/skeleton | No / Do not add; personal/browser-dependent content |
| `/taste/everyone` | 200 | Self | I/F | Same tab labels/skeleton | No / Do not add; currently not a meaningful standalone guest comparison |
| `/taste/quiz` | 200 | Self | I/F | Import invitation plus “Finding titles for you…”; about 81 characters | No / Hold; potentially useful acquisition page after meaningful initial quiz/instructions render for guests |
| `/watch-next` | 200 | — | N/F | Heading only; guest state lives in browser | No / Keep out; personal empty state |
| `/my-movies` | 302 to `/watch-next` | — | — | No body on redirect | No / Keep out; personal utility |
| `/my-shows` | 200 | — | N/F | Guest sign-up prompt | No / Keep out; no guest collection |
| `/my-library` | 200 | — | N/F | Guest sign-up prompt | No / Keep out; no guest collection |
| `/wishlist` | 301 to `/watch-next` for guest | — | — | No body on redirect | No / Keep out; legacy/personal destination |
| `/lists/mine` | 302 to `/lists/new` for guest | — | — | No body on redirect | No / Keep out; account-dependent utility |
| `/lists/new` | 200 | Self | N/N | New-list controls and sign-in invitation | No / Keep out; transactional form |
| Public profile in `/u/` family; concrete URL withheld | 200 | — | N/N | Real public lists and titles | No / Keep out; deliberate indexing policy |
| Public list-index alias; concrete URL withheld | 301 to public profile | — | — | No body on redirect | No / Keep out |
| Existing public share-list detail; concrete URL withheld | 200 | Self | N/N | Real five-title list and streaming information | No / Keep out while explicitly `noindex`; UGC/privacy decision precedes indexing |
| Share-list editing; concrete URL withheld | 302 to sign-in for guest | — | — | No body on redirect | No / Keep out; owner-only editing |
| `/sign-in`, `/sign-up` | 200 each | Self each | I/F | Authentication forms, no discovery content | No / Keep out; consider `noindex` consistent with transactional purpose |
| `/forgot-password` | 200 | Self | I/F | Recovery form | No / Keep out; recommend `noindex` |
| `/reset-password` without token | 200 | Self | I/F | Expired/invalid-link message | No / Keep out; recommend `noindex` |
| `/verify-email` without context | 200 | — | N/N | Confirmation help | No / Keep out |
| `/settings` | 200 | Self | Both I/F and N/N | “Loading…” | No / Keep out; restrictive `noindex` applies; remove conflicting directives for clarity |
| `/settings/account` | 200 | — | — | “Loading…” | No / Keep out; missing `noindex` confirmed live |
| `/settings/{profile,connected-apps,hidden,imports,language,where-you-watch}` | 200 each | — each | N/N each | “Loading…” | No / Keep out; private settings |
| `/settings/{country,streaming}` | 301 each to `/settings/where-you-watch` | — | — | No body on redirect | No / Keep out |
| `/auth/mcp/consent` without required request parameters | 400 | — | — | Invalid authorization-request message | No / Keep out; valid flow source has `noindex`, but no valid consent transaction was exercised |

The Taste loaders do **not** currently redirect anonymous visitors to the quiz, despite an outdated generator comment. They return a null guest view, then fetch from browser state. The quiz loader serializes up to 300 candidate titles, but its initial visible HTML is still a loading state. JavaScript may produce a useful tool after hydration; this audit did not test that rendering. A sitemap is not a cure for the current guest shells. See [Taste guest loader](../../../goodwatch-webapp/app/server/taste-portrait/page.server.ts), [Taste frame](../../../goodwatch-webapp/app/ui/taste/tabs/TasteTabFrame.tsx), and [quiz route](../../../goodwatch-webapp/app/routes/taste.quiz.tsx).

Public availability and permission to index are different. Public and unlisted share lists are intentionally `noindex,nofollow`; this audit requested a public list only. Do not generate an inventory of member profiles or unlisted links. If public-list indexing is desired later, define explicit owner opt-in, moderation/spam controls, deletion handling and minimum distinct public content first; then align robots/canonicals and sitemap policy. Five titles alone do not establish search value. The lack of a profile canonical is not a reason to submit a currently noindexed profile.

### Search, duplicates, legacy shapes and development surfaces

| Type / live specimen | HTTP | Canonical | Robots | Real guest HTML | In sitemap? / Recommendation |
| --- | --- | --- | --- | --- | --- |
| `/search` | 301 to `/discover` | — | — | No body | No / Keep out; destination already listed |
| `/search?q=Interstellar` | 301 to `/discover?q=Interstellar` | — | — | No body | No / Keep out; search alias |
| `/discover?q=Interstellar` | 200 | — | N/F | Search controls and “Reading your search…” / loading | No / Keep out; internal search, no stable result landing page |
| `/discover/{movie,show,movies,shows}` | 301 each | — | — | No body | No / Keep out; normalized query/hub destinations |
| `/discover?type=movie`, `/discover?type=show` | 200 each | Base `/discover` | I/F | Real title results | No / Keep only preferred hub; variants duplicate its purpose |
| Home TV state: `/?tv=discover&mood=funny` | 200 | Base `/` | I/F | Same public home content | No / Keep only canonical home page |
| `/explorer?group=moods` | 200 | Base `/explorer` | I/F | Same complete island content as hub | No / Keep only preferred hub |
| Movie country view: `/movie/157336-interstellar?country=US` | 200 | Base movie URL | I/F | Real title content | No / Keep only unparameterized title |
| Person country view | 301 to base person URL | — | — | No body | No / Keep only unfiltered person if pilot approved |
| Show `?season=1` and `?season=1&episode=1` | 200 each | Base show URL | I/F | Same show content as base, including episode grid | No / Duplicate views, not distinct indexable episodes |
| Show `/season/1` and `/season/1/episode/1` suffixes | 404 each | — | — | Not-found page | No / These are not production routes |
| `/living-room` | 301 to `/` | — | — | No body | No / Correctly excluded; home already listed |
| `/tv-shows` | 301 to `/shows` | — | — | No body | No / Correctly excluded |
| `/tv-shows/genres` | 301 to `/shows/genres` | — | — | No body | No / Correctly excluded |
| `/tv-shows/genres/drama` | 301 to `/shows/genres/drama` | — | — | No body | No / Correctly excluded |
| `/explore/movies/genres/drama` | 301 to `/movies/genres/drama` | — | — | No body | No / Correctly excluded; unrecognized legacy categories can 404 |
| `/tv/1396-breaking-bad` | 301 to `/show/1396-breaking-bad` | — | — | No body | No / Correctly excluded |
| `/pmwiki/Main/HomePage` | 404 | — | — | Not-found page | No / Keep out; the source redirect is not active for this live specimen |
| `/browser-check` | 410 | — | Header `noindex` | Retired gate, no useful page | No / Correctly excluded |
| `/prototype/rec-home` | 404 | — | — | Not-found page | No / Excluded from production; representative of most prototype families |
| `/dev/title-cards` | 404 | — | — | Not-found page | No / Production guard works for sampled dev route |
| `/prototype/jev-search`, `/prototype/jev-vector` | 200 each | — each | — each | Public throwaway experiment/search forms | No / Keep out; add `noindex` or exclude from production builds |
| Unknown route specimen | 404 | — | — | Not-found page | No / Correct behavior |

There are **no dedicated production season or episode route modules** on this revision. The show route contains the grid, summaries and interactions. Creating new independent pages would require distinct useful content and consistent metadata; adding guessed paths would submit 404s or duplicates. The two query specimens had identical main-text lengths to the base show (9,801 characters).

Most prototype route files are omitted by the production build; their presence under `app/routes` alone does not make them live landing pages. The two Jev routes are confirmed exceptions. API routes, MCP and OAuth discovery resources, OG images and sitemap XML are machine/image resources, not missing human-facing search landing pages. Settings/auth/operational routes above are included in the inventory because several still technically allow indexing, even though they should not enter the sitemap. Sources: [production route exclusions](../../../goodwatch-webapp/vite.config.js), [legacy redirects](../../../goodwatch-webapp/app/routes), and [metadata helpers](../../../goodwatch-webapp/app/utils/meta.ts).

## 2. Selection: popularity is a weak proxy for durable search opportunity

The current [selection query](../../../goodwatch-webapp/scripts/sitemap_query.py) requires aggregated GoodWatch voting count `> 5000`, normalized overall score `> 30`, a release year, a poster and TMDB details fetched in the previous 30 days. It then takes 700 movies and 300 shows by `popularity DESC, tmdb_id ASC`. It does not require a past release date, released status, synopsis, fingerprint, or a particular show type.

One terminology correction matters: TMDB popularity is **not strictly its daily Trending signal**. TMDB calls popularity a lifetime composite influenced by daily votes/views/favourites/watchlist additions, cumulative votes, its previous score, and release or episode air dates. Trending is a separate daily/weekly ranking. Neither is measured Google search volume. A vote-led rule is therefore an evidence-based hypothesis about established audience recognition, not a claim to know which titles will earn search traffic. [TMDB's own signal definitions](https://developer.themoviedb.org/docs/popularity-and-trending).

### What is actually in the live 700/300

| Measure, joined to audit-time catalog | Movies | Shows |
| --- | ---: | ---: |
| Rows matched by exact sitemap ID | 700/700 | 300/300 |
| Future release/first-air date | 0 | 0 |
| Unreleased status: planned, production, post-production or pilot | 0 | 0 |
| Overall score below 60 | 144 (20.6%) | 23 (7.7%) |
| TMDB vote count below 500, despite aggregated count above 5,000 | 33 (4.7%) | 67 (22.3%) |
| Release year 2025–2026 | 146 (20.9%) | 7 (2.3%) |
| Release year before 2000 | 104 (14.9%) | 78 (26.0%) |

All listed movies currently have catalog status `Released`; shows are 189 `Ended`, 98 `Returning Series` and 13 `Canceled`. **Upcoming titles are not an observed problem today**, even though the existing query does not guard against them. This is a catalog-based classification, not an independent verification of every country's release schedule. A future season of an already-aired show would not make the whole show unreleased.

The television mix does expose an allocation problem:

| Catalog genre / reproducible proxy | Listed shows | Share of 300 | Examples |
| --- | ---: | ---: | --- |
| Talk | 16 | 5.3% | Fallon, Seth Meyers, Colbert, Letterman |
| News | 5 | 1.7% | The Daily Show, The Colbert Report, Saturday Night Live |
| Soap | 9 | 3.0% | Coronation Street, EastEnders, Home and Away |
| Talk OR News OR Soap, deduplicated | 28 | 9.3% | Genre rows overlap |
| Reality | 10 | 3.3% | Raw, Jeopardy!, The Voice |
| Kids | 13 | 4.3% | Doraemon, PAW Patrol, Peppa Pig |
| Kids AND at least 300 catalog episodes | 8 | 2.7% | Two distinct Doraemon series, Sesame Street, PAW Patrol, Rugrats, Peppa Pig, The Loud House, Curious George |

These categories are **not proof of thin content**. Kids and animation are not synonymous with filler, and episode count alone cannot identify a daily schedule: long-running weekly fiction also exceeds 500 episodes. The queried table has no reliable explicit daily-airing/type field, so the daily-show classification is qualitative, using familiar named talk/news/soap formats rather than an invented precise share.

Live spot checks of Fallon, Coronation Street, PAW Patrol and Saturday Night Live all return 200, self canonical, I/F, with real guest content. The concern is opportunity cost and page weight, not a technical indexing ban. Coronation Street's response was about **7.66 MB of uncompressed HTML** and Fallon's about **3.35 MB**; the checked missing evergreen titles were about 0.34–0.38 MB. Google currently documents a **2 MB uncompressed fetch limit for Search Googlebot**, so these are concrete truncation risks, not just bandwidth concerns. Inspecting a local 2 MB prefix of each saved response found no movie/show/person links (versus 89 and 96 unique such links in the full pages). Only the streaming, fingerprint and episode-grid headings had appeared; About, cast, related titles and Q&A were later. The main closing tag and Remix initialization data begin beyond 3.1 MB for Fallon and 7.5 MB for Coronation Street. Those later bytes exceed the documented limit; this is not a verified Google fetch or a claim that the whole page must be rejected. Recommend bounding the initial episode-grid HTML and putting useful cast/related links before it. Search-relevant content must fit within the fetched portion. [Current Googlebot fetch limits](https://developers.google.com/search/docs/crawling-indexing/googlebot), [Google's 2026 explanation of partial fetching and rendering](https://developers.google.com/search/blog/2026/03/crawler-blog-post).

The first three movie entries in the published file are *Spider-Man: Brand New Day*, *Insidious: Out of the Further*, and *Matchbox the Movie*. The first three shows are *Law & Order: Special Victims Unit*, Fallon and *The Simpsons*. Popularity is selecting current attention and very high episode-volume franchises, while the sitemap omits *The Silence of the Lambs*, *Jurassic Park*, *Taxi Driver*, *Blade Runner*, *Sherlock*, *Chernobyl*, *Band of Brothers*, *Dark* and *Avatar: The Last Airbender*. Missing titles can still be discovered through internal links; absence from this sitemap is not absence from the site.

### Churn in committed sitemaps

Membership comparisons use exact URL sets; the October 10–17 title IDs show the same membership counts, so this week's result is not a slug-renaming artifact. “Replaced” means entries leaving and an equal number entering, not twice that number.

| Earlier → later committed snapshot | Movies replaced | Shows replaced | Total replaced |
| --- | ---: | ---: | ---: |
| September 25 (`cd3549a3`) → October 8 (`13e153db`) | 166/700 (23.7%) | 88/300 (29.3%) | 254/1,000 (25.4%); 13 days |
| October 8 (`13e153db`) → October 10 (`599c5d83`) | 59/700 (8.4%) | 17/300 (5.7%) | 76/1,000 (7.6%); two days |
| October 10 (`599c5d83`) → October 17 (`089c7805`) | 171/700 (24.4%) | 45/300 (15.0%) | **216/1,000 (21.6%); one week** |

Only 784 titles persisted across the last week; the union has 1,216 titles (64.5% Jaccard overlap). All 216 removed IDs still satisfy the old quality and freshness rules in the audit-time catalog. That supports a ranking/churn explanation rather than persistent deletion; historical database values were not available to isolate popularity from freshness/score changes **at the exact generation times**. Two earlier intervals are not a long-term average.

In that last week, 292 retained movies and 152 retained shows also changed `lastmod`. A weekly pipeline that refreshes validity is useful; a weekly wholesale rotation of the discovery cohort is not. At the baseline 1.4 page fetches/day, roughly ten fetches per week is tiny relative to 216 replaced submissions. This comparison illustrates instability; it does not assign individual fetches to sitemap URLs or prove Google was about to fetch the removed titles.

### Proposed reproducible rule

Keep the 700/300 allocation for the initial experiment. Per media type:

1. Retain the current `>5000` aggregate-vote, poster, release-year and 30-day details-freshness checks. Require a nonempty synopsis, a non-null release/first-air date no later than the selection timestamp, adult flag not true, and overall normalized score **at least 60**. Movies must have status `Released`. A freshness failure is a health recheck signal, not proof of low search value; refresh and validate an established core title before replacing it solely for age.
2. For shows, exclude catalog genres **Talk, News, Soap and Reality** from the automatic pool. Also exclude **Kids with at least 300 episodes** from that automatic pool. Keep ordinary animation, kids and family titles eligible. This broad initial policy is intentionally reviewable: it catches valuable exceptions such as Saturday Night Live, Top Gear and Sesame Street. The owner should approve exceptions or reject a class exclusion rather than assume every member is filler. No claim is made that Google penalizes those genres.
3. Fill **630 movie + 270 show core slots** by aggregate GoodWatch voting count descending, with TMDB ID ascending as tie-breaker. This reuses the existing cross-source recognition measure; it is not a count of unique people, because sources can share voters. A rating floor is a quality preference, not a Google rule, and can exclude heavily searched badly reviewed titles.
4. Fill the remaining **70 movie + 30 show attention slots** from eligible titles not in the core, by current TMDB popularity descending, then ID ascending. This is a capped popularity allocation, not TMDB Trending. Compute each media type separately; the two popularity scales need not be comparable.
5. After the initial approved reselection, hold the core for at least four weekly observations, replacing immediately only deleted/redirected/noindexed/broken or otherwise newly ineligible pages. Review core membership monthly; limit discretionary changes to at most 5% of the total weekly. Rotate the attention allocation on a monthly review with the same overall cap. Keep the existing weekly live-health check and unchanged fixed index sample; record a second fixed, stratified title cohort for the revised selection. Do not rewrite the baseline sample when titles leave the sitemap.

Steps 1–4 were computed against the catalog snapshot. Step 5 is the proposed future stabilization policy; the reported counterfactual is its **initial population**, not a simulation of retention or churn. The floor is not tuned against search results, because there are no title impressions to optimize yet. The recommendation can later replace proxy scores with observed nonbrand impressions and useful search landings.

| Computed effect at unchanged 700/300 limits | Movies | Shows | Total |
| --- | ---: | ---: | ---: |
| Eligible catalog pool under proposed filters | 12,906 | 4,069 | 16,975 |
| Current entries kept | 375 | 158 | 533 |
| Entries added / entries removed | 325 / 325 | 142 / 142 | **467 / 467** |
| Current entries failing proposed filters | 144 | 54 | 198 |
| Median aggregate votes: current → proposed | 344,148.5 → 584,905.5 | 100,399.5 → 210,032.5 | — |
| Pre-2000 titles: current → proposed | 104 → 155 | 78 → 30 | 182 → 185 |
| 2025–2026 titles: current → proposed | 146 → 57 | 7 → 8 | 153 → 65 |

The core's lowest aggregate vote counts are 381,399 for movies and 134,132 for shows. Notice that old-show count falls: replacing old soaps/talk shows with established scripted series is not simply “choose older.” The four live-checked restored classics pass status, canonical and robots checks. The remainder still need the normal full candidate validation before any publication.

### Concrete top-30 additions and removals

Each column below is its **own ordered list**, not a one-for-one pairing. Additions are the first 30 absent-from-live entries in proposed core-then-attention order; removals are the first 30 entries in current published sitemap order absent from the proposed set. IDs disambiguate remakes. Votes are the aggregate count used by the proposed core. “Rank” means it passes proposed eligibility but loses a slot under the core/attention allocation; “Score” means below 60; “Format” means excluded Talk/News/Soap/Reality; “Kids” means Kids with at least 300 episodes.

#### Movies

| # | Add (TMDB ID) | Aggregate votes | Remove (TMDB ID) | Reason |
| ---: | --- | ---: | --- | --- |
| 1 | The Silence of the Lambs (274) | 1,863,093 | Insidious: Out of the Further (1291595) | Score |
| 2 | V for Vendetta (752) | 1,432,090 | Matchbox the Movie (1148365) | Score |
| 3 | American Beauty (14) | 1,409,196 | Animals (1236045) | Score |
| 4 | Eternal Sunshine of the Spotless Mind (38) | 1,379,577 | Fall 2: Deadpoint (1101412) | Score |
| 5 | The Usual Suspects (629) | 1,365,313 | Resident Evil: Welcome to Raccoon City (460458) | Score |
| 6 | Return of the Jedi (1892) | 1,350,319 | Practical Magic 2 (1302904) | Score |
| 7 | 300 (1271) | 1,315,124 | Other Mommy (1400837) | Score |
| 8 | Jurassic Park (329) | 1,313,564 | Onslaught (1284046) | Score |
| 9 | One Flew Over the Cuckoo's Nest (510) | 1,245,570 | Mutiny (1288445) | Score |
| 10 | Transformers (1858) | 1,231,043 | The Uprising (977942) | Score |
| 11 | Scarface (111) | 1,149,468 | Moana (1108427) | Score |
| 12 | Captain America: The Winter Soldier (100402) | 1,135,417 | Scary Movie (1273221) | Score |
| 13 | Taxi Driver (103) | 1,123,214 | Verity (1283515) | Score |
| 14 | Captain America: The First Avenger (1771) | 1,117,605 | Supergirl (1081003) | Score |
| 15 | Requiem for a Dream (641) | 1,097,167 | Pirates of the Caribbean: At World's End (285) | Score |
| 16 | The Intouchables (77338) | 1,082,218 | Ice Age: Dawn of the Dinosaurs (8355) | Score |
| 17 | Donnie Darko (141) | 1,080,883 | My Fault (1010581) | Score |
| 18 | A Clockwork Orange (185) | 1,070,432 | Ice Cream Man (1477712) | Score |
| 19 | Gravity (49047) | 1,051,236 | The Super Mario Galaxy Movie (1226863) | Score |
| 20 | Taken (8681) | 1,027,639 | Before I Go to Sleep (204922) | Score |
| 21 | Slumdog Millionaire (12405) | 1,017,262 | Ice Age: Continental Drift (57800) | Score |
| 22 | Kill Bill: Vol. 2 (393) | 1,012,058 | The Last Sunrise (1516698) | Score |
| 23 | Rise of the Planet of the Apes (61791) | 1,006,405 | Drawn Together (1440098) | Score |
| 24 | Amélie (194) | 996,578 | Venom: Let There Be Carnage (580489) | Score |
| 25 | Blade Runner (78) | 994,455 | White Chicks (12153) | Score |
| 26 | Sin City (187) | 962,843 | Jackpot! (1094138) | Score |
| 27 | Gran Torino (13223) | 961,994 | Jurassic World Rebirth (1234821) | Score |
| 28 | City of God (598) | 954,867 | Shell (787747) | Score |
| 29 | Skyfall (37724) | 954,250 | The Lorax (73723) | Score |
| 30 | Indiana Jones and the Last Crusade (89) | 954,201 | A Minecraft Movie (950387) | Score |

#### Shows

| # | Add (TMDB ID) | Aggregate votes | Remove (TMDB ID) | Reason |
| ---: | --- | ---: | --- | --- |
| 1 | Sherlock (19885) | 1,121,653 | The Tonight Show Starring Jimmy Fallon (59941) | Format |
| 2 | Chernobyl (87108) | 1,079,113 | Late Night with Seth Meyers (61818) | Score, Format |
| 3 | Attack on Titan (1429) | 759,224 | The Late Show with Stephen Colbert (63770) | Format |
| 4 | The Queen's Gambit (87739) | 688,521 | The Daily Show (2224) | Format |
| 5 | The Witcher (71912) | 666,830 | Doraemon (65733) | Kids |
| 6 | Money Heist (71446) | 645,190 | Late Show with David Letterman (498) | Format |
| 7 | Band of Brothers (4613) | 612,111 | Raw (4656) | Format |
| 8 | Dark (70523) | 582,488 | Coronation Street (291) | Score, Format |
| 9 | Marvel's Daredevil (61889) | 562,530 | Conan (32415) | Format |
| 10 | Narcos (63351) | 544,327 | Sesame Street (502) | Kids |
| 11 | Death Note (13916) | 506,818 | Saturday Night Live (1667) | Format |
| 12 | Arcane (94605) | 476,618 | The Colbert Report (4385) | Format |
| 13 | Avatar: The Last Airbender (246) | 465,437 | The View (2221) | Score, Format |
| 14 | WandaVision (85271) | 449,707 | The Graham Norton Show (1220) | Format |
| 15 | Fallout (106379) | 419,676 | The Late Late Show with James Corden (62223) | Score, Format |
| 16 | Sex Education (81356) | 418,676 | The Late Late Show with Craig Ferguson (14981) | Format |
| 17 | Severance (95396) | 417,381 | EastEnders (1871) | Score, Format |
| 18 | MINDHUNTER (67744) | 415,776 | Jimmy Kimmel Live! (1489) | Score, Format |
| 19 | Ozark (69740) | 408,981 | S.W.A.T. (71790) | Score |
| 20 | You (78191) | 386,170 | Below (285322) | Rank |
| 21 | Succession (76331) | 376,514 | Jeopardy! (2912) | Format |
| 22 | The Haunting of Hill House (72844) | 342,822 | Real Time with Bill Maher (4419) | Score, Format |
| 23 | The White Lotus (111803) | 342,675 | The Apothecary Diaries (220542) | Rank |
| 24 | The Umbrella Academy (75006) | 339,669 | The Voice (37678) | Format |
| 25 | Moon Knight (92749) | 329,558 | Teen Titans Go! (45140) | Score |
| 26 | Parks and Recreation (8592) | 328,449 | Charmed (1981) | Rank |
| 27 | Hannibal (40008) | 325,003 | Survivor (14658) | Format |
| 28 | Marvel's The Punisher (67178) | 324,756 | PAW Patrol (57532) | Kids |
| 29 | Adolescence (249042) | 322,203 | The Good Wife (1435) | Rank |
| 30 | Aspirants (124411) | 320,058 | Diagnosis: Murder (2625) | Score |

## 3. Count: retain the ceiling, earn expansion

**Recommend 1,000 titles now, plus the existing 98 non-title pages, for 1,098 submitted URLs. Do not increase the title cap yet.** This retains the owner's bounded experiment while improving its allocation. A smaller 100–300-title pilot is defensible as a management choice, but the available evidence does not establish that deleting otherwise good sitemap entries would accelerate Google's crawl or indexing. Keep useful reachable title pages linked regardless of selection.

The bottleneck is observed discovery/crawl demand, not the XML capacity limit. Google's standard limit is 50,000 URLs or 50 MB per sitemap, far above this inventory. At the historical rate, `1,098 / 1.4 ≈ 784 days` is a backlog ratio, **not a crawl completion forecast**: the rate changes, revisits consume requests, and Google may never choose every URL. Sitemap size does not assign a crawl budget. Google's dedicated crawl-budget guidance primarily addresses much larger/faster-changing sites and emphasizes crawl demand, uniqueness and popularity; it does not prescribe a 1,000-title threshold for GoodWatch. [Sitemap limits and submission semantics](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [Google crawl-budget guidance](https://developers.google.com/crawling/docs/crawl-budget).

Proposed expansion gate, requiring owner approval because issue 347 did not set numeric thresholds:

1. Observe Google download the revised sitemap; then collect **at least four weekly runs** against a stable selection, retaining the original fixed sample as historical evidence.
2. See **at least 80% of the submitted title cohort indexed**, assessed through Search Console's current-sitemap view and corroborated by at least 80% indexed in the new fixed, stratified title sample, for **two consecutive weekly observations**. Neither 80% nor four weeks is a Google requirement; these are proposed experiment criteria. If the full cohort state cannot be established, do not present a sample estimate as a census.
3. Require healthy representative/full candidate checks, sustained discovery of new titles rather than only home-page revisits, and some title or category nonbrand impressions/landings. If crawled-but-unindexed titles accumulate instead, investigate content value and duplication before increasing volume.
4. Raise by **250 titles per stage**, preserving roughly the movie/show split and the 90/10 rule, then observe another four weeks before the next increase. Keep the number of new person pages separate from the title ceiling and report their results separately.

Do not wait indefinitely for the count gate to fix poor dates, accidental indexability or internal links. Conversely, do not treat more entries, sitemap reordering, or larger popularity lists as a substitute for links, useful landing pages and demonstrated discovery. Google says ordering within a sitemap does not matter and submission does not guarantee that it downloads or uses a sitemap. Removing a URL from the sitemap is also not a deindexing instruction. [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [Search Console sitemap report](https://support.google.com/webmasters/answer/7451001?hl=en).

## 4. The XML, dates, robots and publication checks

### Structure and discovery: mostly correct

| Live file | Kind | Entries | Uncompressed bytes | Result |
| --- | --- | ---: | ---: | --- |
| `sitemap.xml` | Index | 4 leaf files | 569 | 200; directly references static, categories, movie and show URL sets |
| `sitemap_static.xml` | URL set | 11 | 794 | 200; matches main |
| `sitemap_categories.xml` | URL set | 87 | 6,764 | 200; matches main |
| `sitemap_movie_detail_0.xml` | URL set | 700 | 82,470 | 200; matches main |
| `sitemap_show_detail_0.xml` | URL set | 300 | 34,086 | 200; matches main |
| `sitemap_index_movie_detail.xml` | Legacy index | 1 movie leaf | 254 | 200; not nested under master |
| `sitemap_index_show_detail.xml` | Legacy index | 1 show leaf | 253 | 200; not nested under master |

All seven parse as namespace-correct sitemap XML. The four leaf files contain **1,098 unique URLs**, with no duplicates, no query parameters, absolute HTTPS URLs, and no off-site entries. Static and category files omit dates rather than invent them. No `priority`, `changefreq` or misleading language alternates are present. Google ignores the first two fields anyway. [Google sitemap requirements](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

The old nested-index defect is fixed. Do not replace the master's direct leaf references with the legacy indexes. Google explicitly reports an index referencing another index as an incorrect format. The two legacy indexes are harmless compatibility files; the current Search Console record shows only the master submission, so their historical necessity was not confirmed. Keep their stable endpoints unless there is an explicit cleanup reason. [Google Search Console parsing-error guidance](https://support.google.com/webmasters/answer/7451001?hl=en#zippy=%2Csitemap-parsing-errors), [Google sitemap-index rules](https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps).

The index and all children are in `/sitemaps/`, which satisfies the same-directory/deeper-child rule. Google's general guidance scopes a sitemap to its parent-directory descendants unless submitted through Search Console. Here the master **is** submitted in the committed record, downloaded, and error-free, so the subdirectory is not evidence of a live scope failure. A root alias could remove that dependency if submission practice changes, but moving the existing submitted files is not a priority fix. [Build and submit](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

### `lastmod`: format valid, meaning needs correction

Current title dates span September 25–October 17 for movies and September 25–October 16 for shows; none is in the future or before the intended rebuild floor. The implementation is `max(tmdb_details_updated_at, dna_updated_at, 2026-09-25)`. The rebuild floor is reasonable **if it denotes a genuine significant rebuild**, not an arbitrary “fresh today” stamp. Static/category omission is valid.

There are two separate defects:

1. **Title refresh is being treated as significant content modification.** The active fetcher assigns `next_entry.updated_at = datetime.utcnow()` on every successful save without a significant-content equality check; the sync copies this value into `tmdb_details_updated_at`. Thus the timestamp proves a refresh, not a significant page change. It can also reflect minor popularity/metadata changes. Conversely, independently updated ratings, offers or episode data are not expressly represented in the generator's maximum. The date is therefore neither a reliable significant-change marker nor a complete summary of visible page changes. This audit cannot infer how many reported dates coincidentally correspond to real meaningful changes. Sources: [TMDB fetch/save](../../../goodwatch-flows/windmill/f/tmdb_api/tmdb_fetch_details_from_api/fetch.py), [catalog sync](../../../goodwatch-flows/windmill/f/sync/copy/tmdb_details.py), [date helper](../../../goodwatch-webapp/scripts/sitemap_lastmod.py).
2. **Index `lastmod` uses a page maximum, not the referenced XML file's modification date.** The generator supplies each leaf's maximum title date as its index date. In the October 17 generation, the show XML changed membership/content, but both the master and legacy show index say its `lastmod` is October 16. This is a concrete mismatch. Google defines an index date as the modification of the **referenced sitemap file**, a different concept from its pages. [Sitemap-index specification](https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps).

Recommended change: maintain a separate significant-public-content timestamp, ideally updated only when a normalized content hash changes (main text, meaningful ratings/availability/episode content, structured data or links). Separate it from fetch/freshness timestamps. Include meaningful shared-template changes with an evidenced deployment date. Until a trustworthy timestamp exists, **omit uncertain title dates** instead of claiming every refresh changed the page. Set an index's date from the actual changed leaf artifact, or omit it too; do not use maximum child-page dates. Do not bump the September 25 floor on every deployment. Google uses `lastmod` when consistently verifiable, and says it should describe significant updates, not boilerplate date changes. [Google's current `lastmod` guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [Google's explanation of accurate dates](https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping).

### Robots and indexing intent

The live root `robots.txt` returns 200 and advertises the correct absolute master sitemap URL. It permits the canonical public landing/category/title/person paths. It disallows API routes, browser-check, sign-in/up, person query variants, and Discover query variants. It matches the inspected main file. The sitemap declaration itself is valid. [Google robots.txt specification](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec).

The problem is inconsistent indexing intent elsewhere, not an accidental blanket block of sitemap pages:

- Taste tabs, the thin quiz initial response, `/settings/account`, recovery/reset pages and the two live prototypes are currently crawlable without an effective `noindex`. Keep these out of the sitemap; decide whether to improve their public content or noindex them. For personal tabs, account settings and experiments, `noindex` is the immediate recommendation.
- `/settings` emits both `index,follow` and `noindex,nofollow`; Google applies the restrictive rule, but one clear directive is preferable. [Robots-meta conflict handling](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag).
- Search results and public lists already have intentional `noindex`. Inserting them would contradict sitemap intent. Person/Discover query robots blocks also mean a real compliant crawler may not fetch the redirect or noindex that this direct audit request saw. A successful simulated Googlebot GET alone does not establish robots permission.
- If an unwanted URL must be removed from Google's index, blocking it in robots is insufficient: Google must be allowed to crawl and see `noindex` (or an appropriate removal status). Do not combine a newly desired `noindex` policy for sign-in/up with a robots block and assume it will be read. [Google's noindex requirements](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

A sitemap should list preferred canonical URLs. Google treats sitemap membership as a weaker canonical signal than redirects and explicit canonicals. Query aliases, legacy redirects and parent-canonical season/episode variants would add contradictory or redundant hints, rather than new useful landing pages. [Google canonicalization guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

### Improve the existing validator rather than replacing its safeguards

The current [URL checker](../../../goodwatch-webapp/scripts/check_sitemap_urls.py) rejects non-200 responses, redirects, missing canonicals and conflicting/mismatched canonicals. Keep that weekly publication gate and its conservative request pacing. Its custom user-agent differs from Googlebot, and it stops after the head; it does **not** check robots meta, `X-Robots-Tag`, robots.txt permission or useful guest body content. Consequently, a newly listed `noindex` page with a matching canonical can pass.

Recommend adding explicit exclusion checks for `noindex` and robots disallow, plus oversized-response detection and representative Googlebot/no-cookie SSR content checks for each landing-page family. Do not require a huge body-text threshold for every page: a short useful support page and a personal loading shell are different cases. A fresh candidate set, including the proposed new classics, still needs the complete 200/canonical/robots validation before publication. This report does not run the generator or publish a replacement set.

## Decisions for the owner

1. **Selection policy:** Approve or adjust the initial 90/10 vote/popularity allocation, score floor of 60, and type exclusions. The computed change replaces 467 titles; approve that initial reselection explicitly, then stabilize it. Decide exceptions for useful talk/news/reality or long-running children's titles rather than labelling entire genres thin.
2. **Count gate:** Keep 1,000 titles now; adopt or revise the proposed four-week / 80%-indexed expansion criteria and 250-title increments. The current map prohibits raising the cap; changing that decision belongs to the owner.
3. **Person experiment:** Reconsider the October 6 exclusion deliberately. If approved, start with **10 well-covered people** linked from the chosen title cohort, verify 200/self canonical/substantive guest content for each, and measure separately for at least four weeks. The sampled person page is technically suitable; search demand and incremental traffic remain unproven. Do not automatically expand to all people.
4. **Taste and UGC intent:** Decide whether Taste needs a public acquisition landing page/SSR quiz. Keep personal tabs noindexed meanwhile. Public-share indexing is a separate product/privacy/moderation decision; retain existing noindex until that is resolved. There is no recommendation to add public lists now.

## Verification and limits

- Verified main-source snapshot, issue bodies/comments, all seven live XML files, live robots.txt, all 98 non-title sitemap pages, representative title/person pages, each public page family and relevant legacy/duplicate/private routes. Compared committed historical memberships and computed the catalog-backed selection changes. The full session made 182 fresh GET requests without transport errors, including repeat/variant specimens; category summary below counts unique sitemap entries only.
- Verified a real existing public profile/list as a guest while withholding all identifying URLs, names and raw responses from this report. No unlisted list was requested. No forms, authenticated flows, mutations, database writes, scheduler actions, deployments, code changes or sitemap regeneration were performed.
- Not verified: today's actual Search Console crawl rate or the state of every sitemap URL; Google's rendered JavaScript result or verified Googlebot access; a valid email/consent/login transaction; signed-in behavior; regional release truth/availability in every country; per-title keyword demand; exact historical database inputs; future weekly churn under the proposal; Windmill execution or scheduling state; all 1,000 title responses or all 467 proposed replacements. Catalog existence is not a substitute for the publication check.
- This is a recommendation report, not a performance forecast. The roughly 120-known-URL/1.4-fetches baseline, current sampled discovery progress, and the recent crawl changes should be rechecked before interpreting the impact of any future selection change.

### Complete category coverage record

The parent and every listed leaf in each row were fetched separately. All 87 returned 200, one exact self canonical, `index, follow`, no `X-Robots-Tag`, and real guest text. This records the tested configuration rather than implying that arbitrary category slugs work.

| Parent | Listed leaves (all checked) | Total including parent |
| --- | --- | ---: |
| `/movies/moods` | `scary`, `feel-good`, `suspense`, `motivational`, `funny`, `psychological`, `nostalgic`, `melancholic`, `bittersweet`, `whimsical`, `peaceful`, `adrenaline`, `epic`, `romantic`, `gritty`, `mind-bending`, `morally-complex`, `atmospheric`, `visually-stunning`, `educational` | 21 |
| `/movies/streaming` | `netflix`, `amazon-prime`, `disney-plus` | 4 |
| `/movies/genres` | `action`, `adventure`, `animation`, `comedy`, `crime`, `documentary`, `drama`, `family`, `fantasy`, `history`, `horror`, `music`, `mystery`, `romance`, `science-fiction`, `thriller`, `tv-movie`, `war`, `western` | 20 |
| `/shows/moods` | `scary`, `feel-good`, `suspense`, `motivational`, `funny`, `psychological`, `nostalgic`, `melancholic`, `bittersweet`, `whimsical`, `peaceful`, `adrenaline`, `epic`, `romantic`, `gritty`, `mind-bending`, `morally-complex`, `atmospheric`, `visually-stunning`, `educational` | 21 |
| `/shows/streaming` | `netflix`, `amazon-prime`, `disney-plus` | 4 |
| `/shows/genres` | `action-and-adventure`, `animation`, `comedy`, `crime`, `documentary`, `drama`, `family`, `kids`, `mystery`, `news`, `reality`, `scifi-and-fantasy`, `soap`, `talk`, `war-and-politics`, `western` | 17 |
