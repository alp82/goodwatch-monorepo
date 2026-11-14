# GoodWatch living roadmap

Mirror of the canonical tracker: [issue #52](https://github.com/alp82/goodwatch-monorepo/issues/52) in alp82/goodwatch-monorepo. Planning status is maintained in GitHub; update this copy when the issue changes.

## Destination

Continuously help GoodWatch focus on the right work: bring order to the backlog, give direction to priorities, and reassess what deserves attention as goals, evidence, and circumstances change. Use research from time to time to inform and challenge that direction.

The product target can move. This map remains useful by explaining the current focus, why it matters now, and what could change it. Individual focused maps have bounded destinations and can finish.

## Priority shortlist — owner update, 2026-10-26

The owner put the following candidate efforts first, in this order. This is the current cross-backlog priority order for choosing focused work, not implementation approval, a schedule, or a claim that existing work has stopped. It supersedes older candidate ordering below. Earlier focus decisions remain history.

1. **User-focused experience:** explore comments, member activity, discovering and exploring other members, and taste neighbors. Aim for useful interactions and discovery through people. Public profiles and share lists already exist; determine what meaningful experience to add around them. These examples define a candidate direction, not approved requirements. Visibility, consent, moderation, interaction rules, and how taste neighbors are identified remain open decisions.
2. **Gamification:** explore badges, levels, achievements, and other ways to recognize participation and progress. Build on the retained [personal-milestones direction](https://github.com/alp82/goodwatch-monorepo/issues/70), with this broader owner-requested scope. Specific mechanics, rewards, eligibility, and measures of value remain undecided; retention benefit is unproven.
3. **GoodWatch inside streaming sites:** a browser extension showing GoodWatch scores and Fingerprint while browsing streaming services, with paths back into discovery. Choose the first service and useful interaction. [Broader-product direction](https://github.com/alp82/goodwatch-monorepo/issues/63).
4. **Streaming subscription savings:** help people choose subscriptions using their taste, saved titles, and availability. Decide whether the useful outcome is a current bundle, rotation, or another bounded experience. [Broader-product direction](https://github.com/alp82/goodwatch-monorepo/issues/63).
5. **Automatic watch-history updates from Plex/Jellyfin:** explore playback-driven progress updates beyond existing file imports. Choose the first server, data direction, and watch/progress semantics. [Integration direction](https://github.com/alp82/goodwatch-monorepo/issues/63).
6. **Bulk actions in My library:** identify repeated library operations worth making easier, particularly for large imported libraries; verify current controls before choosing changes. [Library backlog](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686674035).
7. **Community rankings from share lists:** explore discovery through rankings aggregated from public share lists. Establish participation, aggregation, and presentation before treating rankings as representative. Reuse [Share lists: later-phase ideas](https://github.com/alp82/goodwatch-monorepo/issues/163); search indexing remains subject to the site-wide indexing decision.
8. **Letterboxd as an additional score source:** assess sustainable access and the value of Letterboxd scores alongside existing sources, distinct from importing a member's personal ratings. [Letterboxd score-source reference](https://github.com/alp82/goodwatch-monorepo/issues/76).

9. **Favorite actors, directors, and writers:** explore following people as a personal route into discovery. Decide what following changes: browsing, recommendations, updates, or another bounded outcome. [Personal-library inventory](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686674035).
10. **Saved searches and matching-title alerts:** preserve specific discovery requests and identify useful new matches. Define novelty, source freshness, delivery, and frequency before implementation. [Personal-library inventory](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686674035).
11. **Leaving-soon information:** help members prioritize saved titles before access disappears. Establish a reliable source of announced departure dates; observed drops do not predict departures. [Offer-arrival follow-up](https://github.com/alp82/goodwatch-monorepo/issues/489).
12. **Custom personal lists:** explore collections beyond Want to See and the fixed five-title share format. Identify the organization need, list operations, and visibility before selecting a design. [Personal-library inventory](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686674035).
13. **Discovery from multiple reference titles:** explore combining shared or contrasting characteristics from several movies or shows. Distinguish this interaction from the current search and fingerprint benchmark; agree useful examples before choosing an algorithm. [Discovery direction](https://github.com/alp82/goodwatch-monorepo/issues/58).
14. **Awards and box-office context:** assess which information would help people understand and explore titles, together with sustainable source coverage and maintenance. [Title-detail inventory](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686674764).
15. **Soundtrack and music connections:** explore discovery through composers, scores, and soundtrack information. Choose the first useful experience and data source. [Title-detail inventory](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686674764).
16. **Donations / pay what you want:** explore contributions toward GoodWatch's operating costs. Decide the funding goal, contribution experience, and any recognition; no paid benefits or commercial model are selected. [Growth and sustainability inventory](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686675963).

17. **Geographic discovery:** explore movies and shows by production countries and story locations. Decide which geography matters to the browsing experience and verify data coverage. [Discovery inventory](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686674322).
18. **What selected titles have in common:** explain meaningful shared traits among chosen favorites to help members understand their taste. This is an explanatory comparison, distinct from generating recommendations from multiple reference titles. Require evidence-supported traits. [Discovery inventory](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686674322).
19. **Memorable quotes on title pages:** explore recognizable quotes and connections, with reliable sourcing and spoiler handling. [Title-detail inventory](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686674764).
20. **Telegram bot:** explore recommendations and title information in Telegram, reusing relevant Discord lessons. Establish the audience and useful first workflow before selecting scope. [Broader-product direction](https://github.com/alp82/goodwatch-monorepo/issues/63).

21. **Cast images from the actual role:** explore character-specific images that help people recognize cast members as they appeared in the title. Establish reliable sourcing, identity matching, coverage, and fallback to existing actor portraits. [Title-detail inventory](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686674764).
22. **Franchise and collection discovery:** help people navigate connected titles and choose what to watch next. Verify existing collection experiences and decide whether release order, story order, best entries, or several views provide the useful addition. [Discovery inventory](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686674322).

The two leading directions are new roadmap additions. The next six were promoted from the owner's first candidate selection. The following eight were promoted in a second selection on the same date, preserving the first eight positions. A third selection appends geographic discovery, shared-trait explanations, quotes, and a Telegram bot, preserving the first sixteen positions. A fourth selection appends cast images from the actual role and franchise/collection discovery, preserving the first twenty positions. Other candidates remain available below, behind this shortlist. When an effort is chosen to pursue, chart a bounded focused map; do not automatically reopen historical references or create implementation tickets from this ordering.

## Notes

- **Planning boundary:** This living roadmap is for broad exploration and prioritization across the backlog. Interest in an idea is not authorization to begin focused research, prototyping, detailed feature scoping, or implementation. When the user chooses to pursue an effort, chart a separate focused map with a bounded destination.
- **Area discussions:** Record candidate problems, motivations, available evidence, unknowns, and deferred ideas at enough detail to compare priorities. Concrete scenarios are illustrative, not approved requirements. Do not turn every promising candidate into investigation tickets or select an immediate work plan within an area discussion. Evidence gathering specifically chosen to inform roadmap priorities remains possible.
- **Active frontier:** Open child tickets are actionable roadmap decisions or explicitly selected evidence prerequisites. Deferred feature scopes, investigations, and prototypes are preserved as closed references under Out of scope, not as open planning candidates. Choosing an effort can lead to a separate focused map with fresh, appropriately scoped tickets.
- **Priority dependencies:** Block a priority decision only on evidence explicitly needed to make that decision. A useful possible investigation is not automatically a prerequisite. Do not require all backlog candidates to be investigated before choosing a focus.
- This map holds the backlog and an overview of current direction, evidence, and decisions.
- This roadmap's direction and scope evolve in place. A change in focus does not require replacing the roadmap. Bounded focused maps retain normal wayfinder scoping rules.
- No assumed weekly capacity, delivery dates, fixed planning horizon, or commitments. Priority order is not a schedule.
- The initial organization and evidence pass informs the ongoing broad exploration. Continue comparing candidate directions; detailed feature scopes belong in future focused maps once the user chooses to pursue the work.
- This map is the working backlog. The unchanged [original TODO dump](https://github.com/alp82/goodwatch-monorepo/blob/7cab71eb21bd80ee23fb986ad8ebc78fb1242034/TODO.md) is the import source; maintain planning status in GitHub. New unclassified ideas can go into the Inbox below.
- Notes in the inventory preserve original wording, examples, and links. They are not tickets, validated bug reports, approved features, or estimates. A source group may contain several ideas or reference links.
- GitHub is the canonical tracker. The complete grouped backlog and initial research are preserved in linked comments on this map.

## Decisions so far

- **2026-10-26 — fourth owner priority update:** append cast images from the actual role and franchise/collection discovery after the existing leading twenty, in that order. See the Priority shortlist above.

- **2026-10-26 — third owner priority update:** append geographic discovery, explanations of what selected titles have in common, memorable quotes, and a Telegram bot after the existing leading sixteen, in that order. See the Priority shortlist above.

- **2026-10-26 — second owner priority update:** append favorite creators, saved searches and alerts, leaving-soon information, custom personal lists, multi-reference discovery, awards/box-office context, soundtrack/music connections, and donations after the existing leading eight, in that order. See the Priority shortlist above.

- **2026-10-26 — owner priority update:** put user-focused experience and gamification first, followed by the streaming-site extension, subscription savings, Plex/Jellyfin playback integration, bulk library actions, community share-list rankings, and Letterboxd scores. See the Priority shortlist above for the candidate questions and references. This changes priority, not execution authorization.

- **Roadmap purpose:** ongoing prioritization and focus, with a moving product target and research revisited when useful.
- **Initial direction:** great onboarding and recommendation UX, plus strong reasons for recurring use. This is a starting direction to reassess, not a permanent destination or scope boundary.
- **Scheduling:** do whatever capacity permits; make no capacity or timing assumptions.
- **Evidence before product choices:** organize and analyze the backlog, explore the codebase and market, and examine usage evidence before deciding who onboarding leads with or what makes people return.

- [Reconcile backlog notes with existing work](https://github.com/alp82/goodwatch-monorepo/issues/53#issuecomment-5686883805): Accounted for all 242 source-note groups across 45 families, distinguishing scoped completions, partial work, retired targets, references, and unresolved checks.

- [Establish access to usable GoodWatch analytics](https://github.com/alp82/goodwatch-monorepo/issues/54#issuecomment-5687054567): Verified PostHog access to GoodWatch, Europe/Berlin timezone, retrievable June 2024–September 2026 events, and initial event inventory.

- [Understand first visits and returning use](https://github.com/alp82/goodwatch-monorepo/issues/55#issuecomment-5687417453): Established observed paths and returns, traffic-quality and navigation gaps, and limits on recommendation/save/watching outcomes.

- [Decide which onboarding and recommendation problems merit focus](https://github.com/alp82/goodwatch-monorepo/issues/56#issuecomment-5687713624): Chose a fast, continuous path to a worthwhile watchable suggestion for both starting situations, with external import scoped separately.

- [Explore reasons to return and the role of the personal library](https://github.com/alp82/goodwatch-monorepo/issues/57#issuecomment-5687944168): Selected next-watch discovery, a supporting library, a shareable taste card, relevant updates and personal milestones as candidate directions to investigate.

- [Choose worthwhile discovery and Fingerprint directions](https://github.com/alp82/goodwatch-monorepo/issues/58#issuecomment-5688122796): Chose equal investigation of watch selection and open-ended exploration, grounded in an assessment of the 74 attributes before interaction prototypes.

- [Separate trust problems from catalog expansion](https://github.com/alp82/goodwatch-monorepo/issues/59#issuecomment-5688265898): Prioritized encountered-title availability and score freshness, visible uncertainty and refresh requests; selected separate season/episode and Letterboxd investigations.

- [Identify the usability improvements with the strongest case](https://github.com/alp82/goodwatch-monorepo/issues/60#issuecomment-5688392704): Selected coherent cross-page discovery and embedded recommendations for equal desktop/mobile investigation, retaining a broader visual redesign for later.

- [Decide which operational burdens deserve priority](https://github.com/alp82/goodwatch-monorepo/issues/61#issuecomment-5688615361): Selected sustainable scraping capacity and smarter fetch priorities as connected investigations, with constrained spending.

- [Assess growth, community, and sustainability opportunities](https://github.com/alp82/goodwatch-monorepo/issues/62#issuecomment-5688789045): Selected discovery-led traffic growth through useful discovery pages and companion editorial content, with supporting community activity.

- [Explore which broader product ideas warrant discovery](https://github.com/alp82/goodwatch-monorepo/issues/63#issuecomment-5695095650): Retained native choosing-together apps, extensions, bots, streaming savings, and integrations as prioritization candidates; deferred API/MCP and other domains, with focused work reserved for future maps.

- [Choose the evidence needed to guide future priorities](https://github.com/alp82/goodwatch-monorepo/issues/64#issuecomment-5697620121): Prioritize evidence of quick delight, voluntary sharing, and reach for both everyday viewers and enthusiasts, using feedback, traffic, and proportionate research.

- **2026-09-16 — [Choose the next focus across the backlog](https://github.com/alp82/goodwatch-monorepo/issues/65#issuecomment-5701574173):** Selected the continuous recommendation journey; current scraping concerns do not preempt it.

- **2026-09-20:** [Deliver a continuous recommendation journey](https://github.com/alp82/goodwatch-monorepo/issues/82) closed. The focus selected on 2026-09-16 is delivered.

- **2026-09-20 to 2026-10-08:** six further efforts were chosen and charted as focused maps without a recorded roadmap decision. They are listed under Current focus. Four of them revive references that were closed under Out of scope: search and discovery pages, cross-page discovery, season and episode information, and external history.

- **2026-10-11:** chose shipping tracking and the Letterboxd and Trakt imports to every member as the next focus, with "Unmark season" as the one gap to close first. Details under Current focus.

- **2026-10-11:** tracking released to every member; the focus chosen the same day is delivered.

- **2026-10-12:** chose "newly available on your services" as the next focus, in the app only and sharing the new-episodes signal. Details under Current focus.

- **2026-10-12:** new episodes and "newly available on your services" released to every member, with daily rechecks of awaited titles.

## Current direction

The evidence direction remains [quick delight, voluntary sharing, and reach](https://github.com/alp82/goodwatch-monorepo/issues/64#issuecomment-5697620121) for both everyday viewers and enthusiasts.

## Current focus

**2026-10-26:** the owner selected the ordered candidate shortlist near the top of this map, led by user-focused experience and gamification. The shortlist governs the next priority discussion; no new focused build is selected by this update. The delivery and in-flight snapshot below is historical (October 11–12) and must be rechecked against the linked issues before relying on its status.

### Historical focus and delivery snapshot

**Delivered on 2026-10-12:** the new-episodes signal ([ticket](https://github.com/alp82/goodwatch-monorepo/issues/442)) and "newly available on your services" ([ticket](https://github.com/alp82/goodwatch-monorepo/issues/456)) are live for every member, and the offers of the 1,110 titles members wait for are rechecked daily ([ticket](https://github.com/alp82/goodwatch-monorepo/issues/457), open until its first scheduled runs are confirmed). No next focus is selected. What to watch: whether members who see a signal open the page and watch.

**Selected on 2026-10-12: tell a member when a title they wait for lands on one of their services.** Chosen by the owner from a list of 20 candidates. It is built as a second source of the new-episodes signal ([Build newly available on your services](https://github.com/alp82/goodwatch-monorepo/issues/456)), in the app only, with a short recheck cycle for the titles members wait for ([Recheck the offers of titles that members wait for on a short cycle](https://github.com/alp82/goodwatch-monorepo/issues/457)). Both tickets sit on the tracking map. Evidence from 2026-10-11: about 7 Want to See titles a week become watchable for their owner, 114 members can get the signal, about 15 members were active in 30 days, and nothing can reach a member outside a visit. An in-app signal is therefore small; it was chosen because the mechanism is shared with new episodes. Email would be the lever for absent members and was not chosen. Reconsider it when either signal shows that members act on it.

**Delivered on 2026-10-11: tracking is on for every member** (`REC_TRACKING=on`), with "Unmark season" added and the Letterboxd and Trakt imports open. No next focus is selected yet.

**Selected on 2026-10-11: ship tracking to every member.** The owner chose to finish [Map: episode tracking, show statuses, and imports](https://github.com/alp82/goodwatch-monorepo/issues/365) before starting anything new: it is the largest built work no member can see, and it is the reason to return this roadmap has named since September. The owner has clicked through it in preview and is satisfied. "Unmark season" is built first; the other known gaps ship as they are. The Letterboxd and Trakt imports go live in the same release. Search, title page speed and the indexing gate continue beside it and were not chosen as the focus.

**State on 2026-10-11.** The focus selected on 2026-09-16, a fast, continuous path to a worthwhile watchable suggestion, was delivered when [Deliver a continuous recommendation journey](https://github.com/alp82/goodwatch-monorepo/issues/82) closed on 2026-09-20. Its [priority decision](https://github.com/alp82/goodwatch-monorepo/issues/65#issuecomment-5701574173) stays as history.

Finished since then:

- [Recommendation experience redesign, executed in production](https://github.com/alp82/goodwatch-monorepo/issues/172): closed on 2026-10-03. Its open fog is the first visit with zero ratings and the accessibility of the Living room.
- [Serve a viral traffic spike](https://github.com/alp82/goodwatch-monorepo/issues/237): closed on 2026-10-10. Its fog holds a long list of unticketed operations follow-ups (Redis memory, crawler traffic, a Crate restore test, sitemap schedule).

In flight:

- [Free-text and title search with Jev, deployed in production](https://github.com/alp82/goodwatch-monorepo/issues/100): search is live. Two tasks remain: [Bring production search under the 1.5-second acceptance threshold](https://github.com/alp82/goodwatch-monorepo/issues/406), in progress, and the seven-day verification that follows it.
- [Map: episode tracking, show statuses, and imports](https://github.com/alp82/goodwatch-monorepo/issues/365): tracking and the Letterboxd and Trakt imports are live for every member since 2026-10-11. The map stays open for the remaining export files, matching without ids, the details refresh check and the later import sources.
- [Make title pages respond sooner after load](https://github.com/alp82/goodwatch-monorepo/issues/361): every ticket is closed and the related titles map is live on title pages. The budget and tap measurements with the map in production, and the lowered TBT lines, are still owed before the map can close.
- [Find out whether Google keeps GoodWatch's pages, then test discovery pages](https://github.com/alp82/goodwatch-monorepo/issues/347): the Search Console reports are read and the weekly index record has its baseline. The gate needs four weekly runs, so the page work behind it waits.

Loose open issues: [Remove the recommendation feature flags](https://github.com/alp82/goodwatch-monorepo/issues/343), [Overlapping DNA flows can store a fingerprint vector that doesn't match the scores](https://github.com/alp82/goodwatch-monorepo/issues/392), [Reduce the root route's JavaScript to meet the 2 s mobile LCP budget](https://github.com/alp82/goodwatch-monorepo/issues/236), [Label concrete content elements in enrichment so negated searches work](https://github.com/alp82/goodwatch-monorepo/issues/148), [Share lists: later-phase ideas](https://github.com/alp82/goodwatch-monorepo/issues/163), [Delete retained Postgres recovery artifacts after the retention deadline](https://github.com/alp82/goodwatch-monorepo/issues/14).

Deferred candidates nobody has started: a shareable taste card, relevant updates that bring people back (newly available on a member's services, alerts), personal milestones, understandable Fingerprint browsing and open-ended exploration, fresher availability and scores with refresh requests, scraping capacity and fetch priorities, and the broader product ideas (choosing together, bots, extensions). Their order is advisory.

## Existing evidence

- [Complete backlog inventory](https://github.com/alp82/goodwatch-monorepo/issues/52#complete-backlog-inventory): all 242 original source-note groups are preserved and grouped. Dispositions and evidence are recorded in [Reconcile backlog notes with existing work](https://github.com/alp82/goodwatch-monorepo/issues/53#issuecomment-5686883805).
- [Codebase baseline](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686672528): implemented and partial journeys, with runtime limits stated.
- [Market baseline](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686672946): six comparable products, with public claims distinguished from verified behavior and retention evidence.
- [Usage evidence plan](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686673299): instrumentation and analysis protocol; [analytics access and initial inventory are now verified](https://github.com/alp82/goodwatch-monorepo/issues/54#issuecomment-5687054567), with the [usage investigation now complete](https://github.com/alp82/goodwatch-monorepo/issues/55#issuecomment-5687417453).

- [First visits and returning use](https://github.com/alp82/goodwatch-monorepo/issues/55#issuecomment-5687417453): production aggregates, observed journey branches, mature return cohorts, traffic-quality caveats and measurement gaps, with reproducible queries in the linked research asset.

## How priorities will be proposed

For each candidate effort, record the problem or opportunity, expected value, available evidence and its limits, prerequisites, and the next decision needed. Explain why it deserves attention now relative to alternatives, including whether it supports the current direction or gives us reason to change it. Compare effort or scope only when supported; do not invent numeric impact scores or deadlines.

Product experience, growth, reliability, operating burden, and other areas can each become the focus when the case supports it. Competitor features and implementation convenience alone do not establish priority. Recommend a manageable focus and explain what is being deferred and why; the user's product decisions remain open until discussed with the evidence available.

## Reassessing direction and refreshing research

Revisit priorities when choosing the next effort, after meaningful results from an active effort, when new feedback or usage evidence arrives, or when goals, constraints, or the market change. Research can also be revisited when the current rationale feels weak or its evidence has become stale. No fixed review cadence is assumed.

- Review whether the current focus still earns its place against the rest of the backlog.
- Identify the uncertainty that could change the choice. Use a proportionate codebase exploration, usage analysis, market investigation, or other research where it would help; a fresh broad study is not required for every decision.
- Date research findings, record their scope and limitations, and check relevant claims again before relying on an older baseline for a new choice.
- Recommend continuing, narrowing, reordering, pausing, or changing direction based on the findings. Retaining the current focus is a valid outcome.
- Priority decisions should explain their rationale, supporting evidence, deferred alternatives, and what would prompt reconsideration. Preserve earlier reasoning as history and identify superseded decisions clearly.
- Update the current direction and frontier here. Chart a focused wayfinder map when a chosen effort needs its own bounded decision process.

## Inbox

No new unclassified notes since the initial import. Add future ideas here for grouping and reconciliation.

## Area summaries

This is an initial thematic index of the entire source dump, not a claim that every entry is still needed. Examples reported as bugs remain unverified reports. Repeated entries should be merged with their original details retained during reconciliation.

### Onboarding and recommendation UX

- Rating interaction: mobile drag behavior, easier-to-find rating controls, desktop scrolling freeze, automatic modal closing, sticky controls, search focus, duplicate skip controls, and clearer instructions.
- Title selection: long-title search, initial examples, adaptive order, and importing ratings/watchlists.
- Recommendations: clickable onboarding results, streaming-service constraints, combined genre preferences, a personalized For You experience, match predictions or badges, and clearer explanations.
- Taste input: rating scale, genre preselection, loved/hated Fingerprint aspects, and user notes.
- First-use presentation: useful previews, milestone feedback, landing-page examples, and the transition into the personalized home page.

### Recurring use and personal library

- Watch-next experience: watch-now versus unavailable saved titles, exclusion of already rated/watched titles, saved filters, and recommendations informed by ongoing ratings.
- Library usability: search/filter rated titles, favorites and watchlists; easier additions; batch actions; undo/audit history; and watching versus completed shows.
- New reasons to visit: newly available titles on selected services, availability notifications, saved-search alerts, upcoming releases, and changes in trending titles.
- Personal identity: shareable profiles, rating distributions and tiers, external profile links, favorite people, and taste matching.
- Participation: achievements, levels, community features, deciding together, watch parties, and live rating events. The recurring-use decision narrows candidate directions; the resolution linked above holds the agreed scope and deferred alternatives.

### Discovery and Fingerprint

- Search, Explore, Discover, Watch Next, and all-titles navigation: clarify their distinct purposes before adding more surfaces.
- Filters and ordering: score, similarity, controversy, popularity, release period, viewing status, people, age ratings, text, streaming, randomization, active-filter controls, and result previews.
- Fingerprint development: category/genre views, new themes and subgenres, ending dimensions, time/place, franchise, music, political undertones, and season progression.
- Similarity: multiple reference titles, thresholds and percentages, plot/trope combinations, and shared characteristics across selected titles.
- Exploration formats: guides, franchise/collection and cast/crew pages, category sliders, graphs, geographic maps, and international/indie selections.
- Model and data experiments: embeddings, clustering, RAG, batch recommendations, caption/subtitle analysis, and alternative engines. Tool links are research leads, not technology decisions.

### Trust, availability, and title details

- Ratings integrity: wrong external links, title/year identity, duplicate titles, score inconsistencies, null versus zero, missing/stale scores, vote counts, score weighting, and refresh times.
- Availability: missing links, stale offers, country/provider selection, language/localization, other-country availability, provider ranking, availability history, and release dates.
- Detail quality: incorrect descriptions/sequels/tropes, empty sections, invalid trailers, age certifications, and ways to report or request correction.
- Additional information: seasons/episodes and score matrices, recaps, awards, box office, images/videos, quotes, soundtrack, web links, and cast/character imagery.
- Explanation and control: score/streaming explanations, refresh requests, content advisories, and spoiler controls.
- Additional sources: Letterboxd, Filmstarts, AllMovie, IMDb text, TMDB people, reviews, adaptations, and other datasets. Coverage expansion is distinct from repairing existing coverage.

### Shared usability and presentation

- Mobile layout/navigation, overlapping names, card actions, drawers, trailer fullscreen behavior, and accessibility.
- Loading and responsiveness: layout shift, skeletons, slow-network behavior, login flicker, optimistic settings, error boundaries, and page speed.
- Navigation and state: URL/filter management, command palette, local storage, settings caching, translated titles, and consistent country selection.
- Visual references: buttons, cards, typography, animation, backgrounds, page transitions, light/dark mode, headers, footers, galleries, and illustrations.
- Promote individual improvements when they remove a specific obstacle in an active user journey; visual references alone do not establish urgency.

### Reliability and operating burden — reconcile before prioritizing

- Data pipelines: priority queue, retry behavior, streaming publication, stale-data policies, incremental updates, provider identity, type conversion, and invalid-record handling.
- Operations: stuck scripts, rate limits, memory use, zombie processes, workflow/backlog monitoring, and error reporting.
- Storage and deployment: Postgres retirement, old vector databases, DB redesign, connection pooling, backups, cache invalidation, cluster configuration, proxies, and container management.
- Engineering foundations: framework upgrades, obsolete code, linting, tests, documentation, secret handling, security reviews, and scripts kept in Git.
- Assess current necessity against repository evidence before treating any of these as new work. Reliability blockers can interrupt product work when supported by evidence.

### Growth, community, and sustainability — retained candidates

- SEO: metadata, structured data, canonical/indexing checks, sitemaps, internal links, useful keyword/Fingerprint pages, and dynamic sharing images.
- Acquisition: positioning, landing-page redesign, launch directories, outreach, Reddit, social channels, video, and lead generation.
- Community: feedback forms, Discord, feature voting, invitations, credits/thanks, and open-source events.
- Measurement: analytics events, searches, outbound clicks, referrers, UTM attribution, and catalog statistics.
- Sustainability: donations/pay-what-you-want, funding/investor leads, and operating-cost reporting.
- Content: blog ideas covering data architecture, Fingerprint, recommendations, hosting, caching, authentication, and infrastructure lessons.

### Future product possibilities — retained candidates

- Discord/Telegram bots, browser extensions, GoodWatch API/MCP integrations, native mobile apps, and offline support.
- Mini apps: recommendation quizzes, an opposite-movie experience, shared selection, and roulette.
- Streaming-bundle optimization, media-server integrations, and additional media domains such as games, books, music, and podcasts.
- External products, libraries, services, and design examples remain reference material attached to their relevant idea. Their presence does not mean they have been evaluated.

## Reconciliation

[Reconcile backlog notes with existing work](https://github.com/alp82/goodwatch-monorepo/issues/53#issuecomment-5686883805) holds the complete source-by-source dispositions, family index, evidence boundaries, overlaps, and existing work to reuse. Original examples remain linked to their unchanged source notes. Unresolved status is not a validated bug, feature commitment, or scope rejection.

## Not yet specified

- Which evidence gaps emerge while bounding the selected effort, and whether they change its scope or the next priority comparison.
- How priorities should change as feedback, usage evidence, operational circumstances, and results from chosen efforts arrive.
- Opportunities and constraints not yet visible in the current backlog or available evidence.

## Out of scope

Detailed feature scoping, solution investigations, interaction prototypes, implementation, and production changes belong to separately chosen efforts and their focused maps. This boundary does not reject any original backlog idea. Candidate value, motivation, and known uncertainty remain in the area summaries and linked area resolutions; internal design decisions of future efforts are not this roadmap's fog.

The following premature follow-ups were closed as not planned in this roadmap after the scope audit. They remain historical references, not completed decisions or prerequisites. When an effort is selected, use the relevant references to chart fresh tickets in its focused map; do not automatically revive the entire follow-up program.

- [Choose the scope of a continuous recommendation experience](https://github.com/alp82/goodwatch-monorepo/issues/66): Deferred to a future chosen effort; its detailed investigation, scope, or design is beyond this roadmap's cross-backlog prioritization purpose.
- [Decide how external history should enter the recommendation experience](https://github.com/alp82/goodwatch-monorepo/issues/67): Deferred to a future chosen effort; its detailed investigation, scope, or design is beyond this roadmap's cross-backlog prioritization purpose.
- [Choose the scope of a shareable taste card](https://github.com/alp82/goodwatch-monorepo/issues/68): Deferred to a future chosen effort; its detailed investigation, scope, or design is beyond this roadmap's cross-backlog prioritization purpose.
- [Decide which relevant updates should bring people back](https://github.com/alp82/goodwatch-monorepo/issues/69): Deferred to a future chosen effort; its detailed investigation, scope, or design is beyond this roadmap's cross-backlog prioritization purpose.
- [Decide whether personal milestones add recurring value](https://github.com/alp82/goodwatch-monorepo/issues/70): Deferred to a future chosen effort; its detailed investigation, scope, or design is beyond this roadmap's cross-backlog prioritization purpose.
- [Assess how Fingerprint attributes express discovery requests](https://github.com/alp82/goodwatch-monorepo/issues/71): Deferred to a future chosen effort; its detailed investigation, scope, or design is beyond this roadmap's cross-backlog prioritization purpose.
- [Prototype understandable attribute browsing and selective similarity](https://github.com/alp82/goodwatch-monorepo/issues/72): Deferred to a future chosen effort; its detailed investigation, scope, or design is beyond this roadmap's cross-backlog prioritization purpose.
- [Prototype open-ended discovery through Fingerprint](https://github.com/alp82/goodwatch-monorepo/issues/73): Deferred to a future chosen effort; its detailed investigation, scope, or design is beyond this roadmap's cross-backlog prioritization purpose.
- [Choose the scope of fresher availability, scores, and refresh requests](https://github.com/alp82/goodwatch-monorepo/issues/74): Deferred to a future chosen effort; its detailed investigation, scope, or design is beyond this roadmap's cross-backlog prioritization purpose.
- [Choose the scope of season and episode information](https://github.com/alp82/goodwatch-monorepo/issues/75): Deferred to a future chosen effort; its detailed investigation, scope, or design is beyond this roadmap's cross-backlog prioritization purpose.
- [Decide how Letterboxd ratings could add value to GoodWatch](https://github.com/alp82/goodwatch-monorepo/issues/76): Deferred to a future chosen effort; its detailed investigation, scope, or design is beyond this roadmap's cross-backlog prioritization purpose.
- [Choose how discovery and recommendations connect across the site](https://github.com/alp82/goodwatch-monorepo/issues/77): Deferred to a future chosen effort; its detailed investigation, scope, or design is beyond this roadmap's cross-backlog prioritization purpose.
- [Assess sustainable scraping capacity within $20/month](https://github.com/alp82/goodwatch-monorepo/issues/78): Deferred to a future chosen effort; its detailed investigation, scope, or design is beyond this roadmap's cross-backlog prioritization purpose.
- [Choose how fetch capacity serves refresh requests and catalog freshness](https://github.com/alp82/goodwatch-monorepo/issues/79): Deferred to a future chosen effort; its detailed investigation, scope, or design is beyond this roadmap's cross-backlog prioritization purpose.
- [Assess discovery-search demand and GoodWatch visibility](https://github.com/alp82/goodwatch-monorepo/issues/80): Deferred to a future chosen effort; its detailed investigation, scope, or design is beyond this roadmap's cross-backlog prioritization purpose.
- [Prototype discovery pages and companion editorial content](https://github.com/alp82/goodwatch-monorepo/issues/81): Deferred to a future chosen effort; its detailed investigation, scope, or design is beyond this roadmap's cross-backlog prioritization purpose.

## Related work already in GitHub

- [Optimize Windmill fingerprint quality and cost](https://github.com/alp82/goodwatch-monorepo/issues/27) and [Implement the Windmill fingerprinting strategy](https://github.com/alp82/goodwatch-monorepo/issues/35): closed maps; consult their decisions before proposing overlapping work.
- [Delete retained Postgres recovery artifacts after the retention deadline](https://github.com/alp82/goodwatch-monorepo/issues/14): open follow-up.
- [Verify provider refresh recovery and restore missing fingerprint vector for movie 658039](https://github.com/alp82/goodwatch-monorepo/issues/50) and [Audit the 45 suspicious TV Tropes work matches](https://github.com/alp82/goodwatch-monorepo/issues/123): closed.

## Complete backlog inventory


Imported 242 source-note groups across 9 areas. These are grouping counts, **not task counts or effort estimates**. All 1,953 source lines are accounted for; the original file is unchanged. Source SHA-256: `a70cb6da8eb7e7757ad639ca2900b60f7008d168181f74d7e3971d7407a96936`.

| Area | Source-note groups |
| --- | ---: |
| [Onboarding and recommendations](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686673676) | 13 |
| [Recurring use and personal library](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686674035) | 21 |
| [Discovery and Fingerprint](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686674322) | 42 |
| [Trust, availability, and title details](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686674764) | 40 |
| [Shared usability and presentation](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686675197) | 28 |
| [Reliability and operating burden](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686675553) | 43 |
| [Growth, community, and sustainability](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686675963) | 35 |
| [Future product possibilities](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686676290) | 11 |
| [Measurement, research, and planning](https://github.com/alp82/goodwatch-monorepo/issues/52#issuecomment-5686676544) | 9 |
