# Matching round two: foreground, context and a rejection gate

This report supplies evidence for the owner’s review; it does not choose or ship an approach. Data/backend only, on `prototype/talked-about-now-matching`, for [#544](https://github.com/alp82/goodwatch-monorepo/issues/544). The original [round-one report](results.md) and fixtures remain intact.

## Fresh benchmark

Collection window: **2026-10-12T00:00:00+00:00 → 2026-10-14T13:40:33.128736+00:00**, spanning October 12, 13 and 14 (about 2.5 days). Captured **47 YouTube uploads, 670 RSS entries and 3266 Bluesky posts**; deduplicated by video/item URL or AT URI.

The fresh, date-stratified holdout contains **200 posts: 31 YouTube, 84 RSS, 85 Bluesky**. Each source spans all three UTC dates. Old sample overlap is **zero by canonical URL and source ID**. General-query Bluesky posts enter the benchmark; buzz-targeted-only results are display evidence, not benchmark items. Seed is `5442026`. All 200 references were manually authored from raw text/headlines/excerpts, then checked against title/year/alternate-title/plot/cast metadata. The coding agent is the sole annotator; images, parent threads and videos were not viewed.

The seven original channels had no unseen in-window uploads after round one. Three Netflix channels were added to obtain a disjoint YouTube holdout: Netflix, Netflix Brasil, Netflix India. [Netflix’s own Tudum article](https://www.netflix.com/tudum/drop01) explicitly links these official channels; live canonical channel IDs/titles were verified and saved. **The fresh YouTube benchmark is Netflix-only**, while the full display run includes all ten channels. This source distribution limits comparisons with the earlier studio-heavy sample.

Matcher prompts, thresholds and preprocessing were committed before holdout selection/annotation (`c484dbd2`; `round2/frozen-rules.json`). All 200 resolved manual references were committed before the final gate ran (`52b96813`). No old labels or fresh gold are read by extraction, retrieval or gating. Subsequent fixes handle API batch-ID validation/retries, Crate’s `show`/`order_default` schema, preservation of creator job roles, catalog freshness, model year-string parsing, and enrichment of only retained candidates through bounded relation/person SELECTs; they do not adjust prompts, cutoffs or confidence thresholds. No performance-based tuning pass was made.

## What changed

- Strip subscription links, social/legal footers and studio boilerplate while preserving foreground descriptions/title prefixes.
- Extract up to three explicitly primary works using the frozen extraction prompt; incidental credits, general industry news, games, unnamed replies and everyday phrases are rejected.
- Retrieve original/English and production alternate titles; use fuzzy title candidates at ≥88, and keep explicit type/year signals. Refresh extracted-name entries from current production SELECTs.
- Supply synopsis, directors, creators, writers and top cast separately so the gate can distinguish remakes/new versions. Publication date is not a release-year substitute.
- Use Qdrant only for candidate retrieval when lexical candidates are missing. No semantic neighbor is accepted directly.
- Exact unique `official=true` YouTube video-ID crosswalks from verified channels are the clean lane. Other links require grounded foreground evidence, extraction confidence ≥0.90, gate confidence ≥0.97, a valid candidate ID and explicit context disambiguation for exact-name collisions. Confidence is a rule score/model self-report, **not a calibrated probability**.

## Precision and recall by source

Precision is **link-level**: correct emitted title IDs / emitted title IDs. Recall is **item-level**: catalog-linkable primary-work posts with at least one correct link / all catalog-linkable primary-work posts. Entity recall also counts every reference title in multi-title posts. Ambiguous references are excluded and stay `unsure` in the renderer data. Named-but-missing catalog works are included in the end-to-end recall column. Thus round-one single-link figures are not a directly comparable controlled ablation.

| Source | Scored / unsure | Correct / wrong links | Precision | Item recall | Entity recall | End-to-end item recall | Precision 95% Wilson interval |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| youtube | 29 / 2 | 20 / 2 | 90.9% | 80.0% (20/25) | 80.0% | 74.1% | 72.2%–97.5% |
| rss | 78 / 6 | 32 / 9 | 78.0% | 80.0% (32/40) | 76.2% | 72.7% | 63.3%–88.0% |
| bluesky | 78 / 7 | 28 / 1 | 96.6% | 73.3% (22/30) | 70.0% | 71.0% | 82.8%–99.4% |
| all | 185 / 15 | 80 / 12 | 87.0% | 77.9% (74/95) | 74.8% | 72.5% | 78.6%–92.4% |

## Precision and recall by lane

Lane recall is the contribution of that lane’s correct IDs to **all reference entities** in its source, rather than recall inside a model-selected cohort. A dash means the lane emitted no scored links. All non-clean lanes pass the same context rejection gate.

| Source | Lane | Correct / wrong | Precision | Recall contribution (entities) |
| --- | --- | ---: | ---: | ---: |
| youtube | official_video_id | 1 / 0 | 100.0% | 4.0% |
| youtube | foreground_exact | 14 / 2 | 87.5% | 56.0% |
| youtube | alt_title_context | 0 / 0 | — | 0.0% |
| youtube | foreground_fuzzy | 3 / 0 | 100.0% | 12.0% |
| youtube | vector_context | 2 / 0 | 100.0% | 8.0% |
| rss | official_video_id | 0 / 0 | — | 0.0% |
| rss | foreground_exact | 30 / 9 | 76.9% | 71.4% |
| rss | alt_title_context | 2 / 0 | 100.0% | 4.8% |
| rss | foreground_fuzzy | 0 / 0 | — | 0.0% |
| rss | vector_context | 0 / 0 | — | 0.0% |
| bluesky | official_video_id | 0 / 0 | — | 0.0% |
| bluesky | foreground_exact | 26 / 1 | 96.3% | 65.0% |
| bluesky | alt_title_context | 2 / 0 | 100.0% | 5.0% |
| bluesky | foreground_fuzzy | 0 / 0 | — | 0.0% |
| bluesky | vector_context | 0 / 0 | — | 0.0% |
| all | official_video_id | 1 / 0 | 100.0% | 0.9% |
| all | foreground_exact | 70 / 12 | 85.4% | 65.4% |
| all | alt_title_context | 4 / 0 | 100.0% | 3.7% |
| all | foreground_fuzzy | 3 / 0 | 100.0% | 2.8% |
| all | vector_context | 2 / 0 | 100.0% | 1.9% |

## Interpretation for the owner

The improved chain still does **not establish that broad automatic linking is safe to ship**. YouTube emitted 2 wrong links out of 22: an older Christmas namesake and the wrong Riot work. RSS emitted 9 wrong links out of 41, largely incidental filmography/predecessor/comparator titles despite the foreground prompts. Bluesky has the strongest observed precision (28/29), but its 95% interval is 82.8%–99.4%, its item recall is 22/30, and this is selective dated search rather than an independent firehose benchmark. All 12 errors came through `foreground_exact`; exact title text alone still fails to establish primary-work identity.

Recommendation for review: the unique official catalog video-ID lane is the cleanest limited pilot candidate, but this fresh holdout contains only **one** such link (1/1), so it cannot establish broad reliability by itself. Keep text/context links review-required, especially RSS and YouTube remakes. Treat Bluesky’s result as promising evidence for a larger, independently checked, general-query holdout before automatic publication. The 100% figures for alternative-title, fuzzy and vector lanes have denominators 4, 3 and 2 respectively; they do not justify enabling those lanes unconditionally. No source or lane was deployed and the owner has not selected an approach.


## Recorded inference cost

OpenRouter’s returned usage journal records **$2.0452**, or **$0.513 per 1,000 corpus inputs** (extraction $0.7028; identity gate $1.3424). This is a **lower bound**, not fully reconciled billing: some interrupted extraction requests predate journal logging, and non-returned/time-out request charges are unknown. Retries that returned after logging are included. Local embeddings/production reads carry no measured per-item API charge; compute and operating costs are excluded.


## Twenty fresh examples, including failures

The complete 200-item decision/reference comparison is in `round2/holdout-example-review.json`; this selection deliberately shows mistakes and missed links first. Hand labels were frozen before these decisions.

| Item | Source / result | Post | Expected | Emitted |
| --- | --- | --- | --- | --- |
| B016 | bluesky / wrong link | [I sound designed "The Widower" on Netflix, which just came out! This case was already covered on Dateline - the reporter that broke the story is the central figure in the doc, and we go through his personal journey on how he got so close to the (legally guilty) murderer.  youtu.be/2Xn881UkR3s](https://bsky.app/profile/kevinsenzaki.bsky.social/post/3mxponkbcps2v) | The Widower: 'Til Death Do Us Part (2026, movie:1758536) | The Widower (2014, tv:60750) |
| R002 | rss / wrong link | [Monarch Media To Produce First-Time Feature Scribe Jonathan Yu’s Coming-Of-Age Dramedy ‘Goldfish’](https://deadline.com/2026/10/monarch-media-producing-goldfish-jonathan-yu-1237154943/) | Goldfish (?, movie:1795668) | Goldfish (2024, movie:1601063) |
| R004 | rss / wrong link | [Locarno Title ‘Rapture’ Director Dominic Sangma Confronts Unregulated Stone Mining in Busan Asian Project Market Drama ‘Veil of Dust’](https://variety.com/2026/film/markets-festivals/stone-mining-drama-veil-dust-busan-asian-project-market-1236908610/) | Veil of Dust (?, movie:1750125) | Rapture (2024, movie:1147759) |
| R017 | rss / wrong link | [Milania Giudice, Daughter of ‘Real Housewives of New Jersey’ Star Teresa Guidice, Shares Bipolar Disorder Diagnosis](https://www.hollywoodreporter.com/news/general-news/milania-giudice-bipolar-disorder-mental-health-1236727917/) | none | The Real Housewives of New Jersey (2009, tv:18204) |
| R020 | rss / wrong link | [BBC Blurs Trans Rights T-Shirt on ‘Strictly Come Dancing’ but Says It’s ‘Standard Practice’ to Cut ‘Overt Branding or Slogans’](https://variety.com/2026/tv/news/bbc-blurs-trans-rights-t-shirt-strictly-come-dancing-1236909064/) | Strictly Come Dancing (2004, tv:1711) | Strictly Come Dancing (2004, tv:1711); House of the Dragon (2022, tv:94997) |
| R025 | rss / wrong link | [‘VisionQuest’ Review: Paul Bettany and James Spader Elevate Disney+’s Sometimes Moving, Sometimes Exhausting Marvel Spinoff](https://www.hollywoodreporter.com/tv/tv-reviews/visionquest-review-paul-bettany-james-spader-disney-marvel-1236727897/) | VisionQuest (2026, tv:213375) | VisionQuest (2026, tv:213375); WandaVision (2021, tv:85271) |
| R027 | rss / wrong link | [Ynon Kreiz,  the Intense, Kite Surfing CEO Who Thrives When His Back Is Against the Wall](https://www.hollywoodreporter.com/business/business-news/ynon-kreiz-the-skydance-ceo-1236726494/) | none | Barbie (2023, movie:346698) |
| R038 | rss / wrong link | [Rosé to Perform at LACMA’s Art+Film Gala](https://variety.com/2026/music/columns/rose-lacmas-art-film-gala-2026-1236909498/) | none | Dune (2021, movie:438631) |
| R049 | rss / wrong link | [Vancouver Film Festival Audience Award Winners: ’I Play Rocky,’ ‘Ceremony’ Among Big Wins](https://variety.com/2026/film/global/vancouver-fest-audience-awards-i-play-rocky-ceremony-1236910509/) | I Play Rocky (2026, movie:1286656); Ceremony (2026, movie:1572287) | I Play Rocky (2026, movie:1286656); Rocky (1976, movie:1366) |
| R059 | rss / wrong link | [Joanna Hogg to Preside Over El Gouna Film Festival Jury](https://variety.com/2026/film/festivals/joanna-hogg-el-gouna-film-festival-jury-president-1236911025/) | none | The Eternal Daughter (2022, movie:790867) |
| Y013 | youtube / wrong link | [The Christmas Switch \| Sneak Peek \| Netflix](https://www.youtube.com/watch?v=dBxrOZsMsrI) | The Christmas Switch (?, movie:1757174) | The Christmas Switch (2014, movie:313093) |
| Y025 | youtube / wrong link | [The Riot \| Official Teaser \| Netflix](https://www.youtube.com/watch?v=oaHq9DQIxfI) | none | The Riot (2022, movie:713174) |
| Y002 | youtube / missed link | [O Natal Perfeito de um Cachorro \| Trailer oficial \| Netflix](https://www.youtube.com/watch?v=5l-5favSmfQ) | A Dog’s Perfect Christmas (2026, movie:1570488) | none |
| R005 | rss / missed link | [Catherine Laga’aia & Deacon Phillippe To Lead Disney+ Pilot ‘Spaceship Earth’](https://deadline.com/2026/10/catherine-lagaaia-deacon-phillippe-spaceship-earth-disney-1237154902/) | Spaceship Earth (?, tv:338280) | none |
| B006 | bluesky / missed link | [#Quirk welcomes US #antiquesroadshow friends gathering here on Bluesky ahead of the live watch party for a new Vintage episode at 8 pm EST. Want to watch the episode with us? This link tells you how: www.pbs.org/wgbh/roadsho...](https://bsky.app/profile/sgswritereditor.bsky.social/post/3mxppl7yako2n) | Antiques Roadshow (1997, tv:33739) | none |
| Y001 | youtube / right link | [The Mosquito Bowl \| Trailer oficial \| Netflix](https://www.youtube.com/watch?v=rFMyHeRy3i4) | The Mosquito Bowl (2026, movie:1458300) | The Mosquito Bowl (2026, movie:1458300) |
| R007 | rss / right link | [CoComelon Is Ready to Grow Up](https://www.hollywoodreporter.com/business/business-news/cocomelon-grows-up-movie-disney-streaming-1236726556/) | Cocomelon (2020, tv:114718) | Cocomelon (2020, tv:114718) |
| B004 | bluesky / right link | [horror classic House on Haunted Hill provides a mesmerizing walk down “people actually used to find this SCARY?!?” lane - 2025 riff on the 1959 classic by the rifftrax crew of Bill Corbett, Kevin Murphy and Michael J. Nelson, horror with comedy commentary, next watch. On tubi](https://bsky.app/profile/lostcitymagic.bsky.social/post/3mxppazyc7s2i) | House on Haunted Hill (1959, movie:15856) | House on Haunted Hill (1959, movie:15856) |
| Y010 | youtube / unsure | [The Body \| Official Trailer \| Netflix](https://www.youtube.com/watch?v=wl7uj7n7DoY) | The Body (2026, tv:291507) | The Body (2024, movie:1198877) |
| Y003 | youtube / missed link | [MTV ROADIES REBIRTH : The Auditions 🔥 \| Rannvijay S, Fukra Insaan, Baseer & More \| Netflix](https://www.youtube.com/watch?v=Ueh6xe_r1TI) | MTV Roadies (2003, tv:8426) | none |

## Owner/Opus data handover

[`matches.json`](matches.json) contains **50 titles and 668 title–post links**, including the 25 titles with the most accepted posts plus all 32 titles in the union of the latest buzz lists. Additional diagnostic titles contain **every wrong link from the fresh holdout**, so the owner can see failures in the title-page prototype; `selection.diagnostic_wrong_link` marks them. The primary buzz list is the buzz prototype’s recommended **`floor_lift`**, with `regularized_z` and `pageviews_tmdb` retained as named supplementary ranks. Date is **2026-10-13**. No hindsight-trending variant was used. Buzz titles with no accepted posts remain visible with empty arrays; no unrelated posts are forced onto them.

Schema: top-level `schema_version`, `window`, `matcher`, `selection`, `coverage`, `evaluation`, `titles[]`. Each title has `key`, numeric `tmdb_id`, `type: movie|tv`, `title`, nullable `year`, counts, selection ranks, and `posts[]`. Each post has source/URL/author/timestamp/text or headline, lane/stage/confidence/reason, discovery provenance, and `hand_label: right|wrong|unsure|null` with label set/note. `round1_display_only` labels decorate old overlapping display posts but never enter the fresh benchmark. See [schema](matches.schema.json).

Post counts are counts in this bounded corpus, not platform-wide volume or a buzz score. Publisher feed inventories can omit older items; WordPress feeds were read up to 18 pages, other feeds are rolling. Bluesky uses anonymous dated first-page searches, with distinct general versus buzz-title queries; cursors are not followed. Search-targeted exposure and syndicated/bot posts can change the observed order. The full source requests/statuses/dates and corpus are retained.

## Ambiguous references

- **Y010** (`Y2-ce4a28be98e4`): The Body has TV/movie catalog entries with the same initiation plot; supplied trailer excerpt does not establish format.
- **Y031** (`Y2-730591b343d5`): Same The Body plot appears in both movie and TV catalog entries; source excerpt does not prove format.
- **R015** (`R2-b449d22aa7c5`): Four-film project discussed collectively; individual work titles/IDs are not established by excerpt.
- **R040** (`R2-8d55ba3656ed`): Croatian series is being developed; catalog work title/year not established, original UK series is context.
- **R051** (`R2-4538ed800d6c`): New English-language Assassins placeholder tv:338430 has no synopsis, credits, country or network metadata; cannot independently prove Peacock/Johansson identity. Older tv:115089 is Italian 2020.
- **R060** (`R2-3eb8054669f6`): New MCU work is unidentified in headline/excerpt.
- **R070** (`R2-cb6c9754bcd8`): Main movie not identifiable from excerpt.
- **R079** (`R2-27112f07d9c2`): Cannot infer title from current streaming occasion alone.
- **B007** (`B2-e7f7537eaa35`): Likely Stay Tuned, but casting allusion does not establish exact work from supplied text.
- **B015** (`B2-9d730a40003f`): Hints suggest Below but no explicit title; exact show cannot be verified from text alone.
- **B023** (`B2-6a1a6afe39a5`): Likely The Thin Red Line, but versions/year not specified and literal title is altered.
- **B035** (`B2-439dc5a318f8`): Exact movie unverified from character/political allusion.
- **B044** (`B2-83e507d7d07e`): Giant-mech hints suggest a project but its title/identity is missing.
- **B065** (`B2-2dafb80133ba`): Comic arc does not establish exact movie/part; reply/video context absent.
- **B076** (`B2-3a928c25dae3`): Likely Korean Shinbi Apartment but exact version/format unverified from supplied context.

## Verification and remaining limits

Production access used only Crate SELECTs and Qdrant point queries. No production store/cache writes, app server, frontend or review page was created. All 3,983 inputs were processed with the frozen matcher. Offline source/lane metric arithmetic, holdout disjointness/date coverage, renderer schema/ID/URL/confidence/hand-label invariants, exact top-25 selection and complete buzz inclusion were checked. Python compilation and git diff checks passed.

This remains a single-agent, text/excerpt-only benchmark with a Netflix-only fresh YouTube cohort and selective historical discovery. Grounding/name normalization inherits the ASCII-based first-round normalizer, which can discard non-Latin title evidence; multilingual coverage is not established. Multi-day publication history is real; continuous multi-day ingestion/reliability, independent annotation adjudication, confidence calibration, deletion synchronization and deployment were not tested. Keep accepted links and their wrong/unsure badges in the data for the owner to judge; do not silently filter them out.

## Reproduce

`MATCHING_ENV_FILE=/path/to/existing/.env python round2_collect.py collect`; select a **new** disjoint holdout and annotate it before viewing decisions. Run `round2_matcher.py extract`, `candidates`, `vector_fallback`, `run` sequentially. `round2_labels.py prepare`/`resolve` checks manually authored identities separately. `round2_publish.py metrics` is offline; `export` hydrates selected title metadata with SELECTs; `report` is offline. Committed snapshots under `round2/` reproduce the measured result. The original catalog index and pinned embedding files remain local/ignored.
