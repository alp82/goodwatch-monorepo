# Linking posts to titles automatically — data spike

Measured 2026-10-14 for [issue 544](https://github.com/alp82/goodwatch-monorepo/issues/544). Throwaway branch: `prototype/talked-about-now-matching`; base `4003c90d` (`origin/main`).

## Answer

**The broad automatic waterfall is not ready to ship on any of the three sources.** Official YouTube video-ID crosswalks are the strongest narrow lane; source allowlisting alone is provenance, not title identity. Start with those as editorial suggestions, and keep RSS and Bluesky hand-picked until a new, independent evaluation passes a proposed ≥95% precision target. This threshold is a recommendation, not an established project requirement.

An LLM verification pass over early accepts helps, but does not repair missing candidates or supply enough remake context. Do not let fuzzy matches or semantic similarity bypass verification.

## Sample and reference answers

Collected 50 recent YouTube uploads from all seven verified channels (eight fetched per channel, then newest 50), 164 deduplicated publisher RSS items in the trailing 24-hour window, and 3,468 keyword-filtered Bluesky posts. Two Netflix newsroom items with publisher dates only are saved separately; the trade-press evaluation excludes them. epd Film had no items in the window. The initial Netflix parse failures and corrected supplementary reads are preserved in their audit files.

Bluesky requested window: **2026-10-14T09:16:29.960370Z → 2026-10-14T11:30:00+00:00**. Publication and replay event times are filtered. Bounded to a 2h13m replay window (~2h7m after gaps), satisfying the few-hours spike scope; source reconnects and bulk historical imports preclude a census. Pre-resume frame/byte totals unavailable.

Manually resumed one second past a bulk migrated repository block at event time 10:05:32.421830; all its observed post dates were outside sampling window. Window therefore has a 1-second event-time gap. Pre-resume raw frame/byte counts unavailable; archived filtered items retained. Also skipped one second at 10:29:20.459213 after more than 30000 out-of-window posts. Timestamp resumes inside the 10:29 bulk block did not advance reliably, so resumed at 10:35:00; excluded event interval 10:29:20.459213–10:35:00 (5m39.54s).

This is a bounded replay sample, not a complete firehose census. Reconnects are inclusive and deduplicated by AT URI. Old repository imports made replay progress unreliable; their gaps are disclosed rather than silently counted as coverage. Pre-resume raw byte/frame totals were not retained; the final audit totals describe only the final resumed segment. The full retained post dataset is committed.

**170 items hand-checked by the coding agent:** 50 YouTube, 60 RSS, 60 Bluesky. The source subsets are deterministic (`Random(544)`, sorted canonical URLs) and chosen before running matching on that source. Human annotations identify the main promoted/discussed work and version; equal-topic lists accept any explicitly discussed main work. Studio boilerplate, incidental filmography, generic business/person/news, sports broadcasts, music without a specific movie/show association, and unnamed works do not count as title links. Posts are labeled from the supplied text and bounded feed context; images, video, article bodies and reply parents were not read. Unknown identities are listed below.

Labels were manually authored separately from predictions, then resolved against the full local snapshot of **1,261,069 movies + 234,440 shows**. Difficult same-year namesakes were checked with production SELECTs for synopsis/director. The concert self-entry was reconciled during this catalog audit and retained as a policy ambiguity. No LLM output was used as a reference answer. This is one annotator, with no independent second review.

## Method and per-stage precision / recall

1. **Official identity:** the seven verified studio/streamer channel IDs identify their organization, not a movie/show. No per-title Bluesky handle or channel crosswalk was established. An additional exact YouTube `media_video.site_key` crosswalk, restricted to catalog `official=true`, is measured in this stage; it resolves nine uploads, one ambiguous concert case.
2. **Fuzzy title + year:** normalized English/original catalog titles, hashtag splitting, exact n-gram mentions, and bounded prefix retrieval with RapidFuzz for quoted/upload prefixes. Accept only a unique longest exact mention with at least two words/eight characters; explicit headline years add a release-year boost. Publication year is not substituted for release year. Alternative-title/translation tables are not indexed in this baseline.
3. **Qdrant:** production `media_fingerprint_v1`, named `text_multi_v1`, top 10. The query encoder is the webapp’s pinned fp32 multilingual-e5-small ONNX export, `query: ` prefix, masked mean pooling, 512-token truncation and L2 normalization. Direct acceptance requires cosine ≥0.90 and top-two margin ≥0.04. Thresholds were fixed before reading gold labels. Nearest semantic neighbors are candidate retrieval, not identity evidence.
4. **OpenRouter:** `openai/gpt-4.1-mini`, temperature 0, JSON catalog ID or `none`, one main title. Up to 30 lexical plus 10 vector candidates, deduplicated. Candidate metadata is title/original title/year/type; director/synopsis/availability are not supplied. The waterfall calls the model only on unresolved items. A diagnostic guarded variant uses the **same prompt and candidates** to verify early fuzzy/vector accepts, preserving exact official-video crosswalks and reusing fallback responses. Neither algorithm reads labels.

**Precision** = correct emitted IDs / emitted IDs. **Recall** = items correctly linked to at least one main work / items with at least one resolvable main work in our catalog. A wrong ID counts as both FP and FN on positive items. This is item recall, not all-entity recall for multi-title posts. Abstentions reduce recall; negative items never enlarge the recall denominator. Ambiguous items are excluded from primary metrics. End-to-end recall below also counts named works missing from the catalog.

| Source | Stage (cumulative) | Correct / wrong | Precision | Catalog-item recall |
| --- | --- | ---: | ---: | ---: |
| youtube | Official identity | 8 / 0 | 100.0% | 17.0% (8/47) |
| youtube | + fuzzy/year | 13 / 20 | 39.4% | 27.7% (13/47) |
| youtube | + Qdrant | 13 / 20 | 39.4% | 27.7% (13/47) |
| youtube | + LLM fallback | 25 / 24 | 51.0% | 53.2% (25/47) |
| youtube | LLM checks early accepts | 36 / 12 | 75.0% | 76.6% (36/47) |
| rss | Official identity | 0 / 0 | — | 0.0% (0/39) |
| rss | + fuzzy/year | 8 / 10 | 44.4% | 20.5% (8/39) |
| rss | + Qdrant | 8 / 10 | 44.4% | 20.5% (8/39) |
| rss | + LLM fallback | 26 / 16 | 61.9% | 66.7% (26/39) |
| rss | LLM checks early accepts | 30 / 8 | 78.9% | 76.9% (30/39) |
| bluesky | Official identity | 0 / 0 | — | 0.0% (0/29) |
| bluesky | + fuzzy/year | 11 / 12 | 47.8% | 37.9% (11/29) |
| bluesky | + Qdrant | 11 / 12 | 47.8% | 37.9% (11/29) |
| bluesky | + LLM fallback | 21 / 17 | 55.3% | 72.4% (21/29) |
| bluesky | LLM checks early accepts | 25 / 6 | 80.6% | 86.2% (25/29) |

Incremental stage decisions below score only items unresolved by the preceding stage. Stage recall uses the catalog-linkable positives **within that unresolved cohort**; it is not whole-source recall. Early wrong accepts are locked in by the waterfall and absent from later cohorts.

| Source | Stage alone | Scored unresolved cohort | Added correct / wrong | Stage precision | Cohort recall |
| --- | --- | ---: | ---: | ---: | ---: |
| youtube | Official identity | 49 | 8 / 0 | 100.0% | 17.0% |
| youtube | Fuzzy/year | 41 | 5 / 20 | 20.0% | 12.8% |
| youtube | Qdrant | 16 | 0 / 0 | — | 0.0% |
| youtube | LLM fallback | 16 | 12 / 4 | 75.0% | 80.0% |
| rss | Official identity | 54 | 0 / 0 | — | 0.0% |
| rss | Fuzzy/year | 54 | 8 / 10 | 44.4% | 20.5% |
| rss | Qdrant | 36 | 0 / 0 | — | 0.0% |
| rss | LLM fallback | 36 | 18 / 6 | 75.0% | 72.0% |
| bluesky | Official identity | 56 | 0 / 0 | — | 0.0% |
| bluesky | Fuzzy/year | 56 | 11 / 12 | 47.8% | 37.9% |
| bluesky | Qdrant | 33 | 0 / 0 | — | 0.0% |
| bluesky | LLM fallback | 33 | 10 / 5 | 66.7% | 76.9% |

| Source | Scored / ambiguous | Named main-work items | Catalog-linkable items | Final waterfall end-to-end recall | Guarded end-to-end recall | Guarded precision 95% Wilson interval |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| youtube | 49 / 1 | 47 | 47 | 53.2% | 76.6% | 61.2%–85.1% |
| rss | 54 / 6 | 42 | 39 | 61.9% | 71.4% | 63.6%–88.9% |
| bluesky | 56 / 4 | 29 | 29 | 72.4% | 86.2% | 63.7%–90.8% |

The exact official-video lane has eight unambiguous successes and no errors: **8/8 precision, 8/47 recall**, with a 95% Wilson precision interval of **67.6%–100%**. It is the best pilot lane, but eight examples do not certify ≥95% shipping precision. The concert boundary is explicitly excluded, not silently relabeled to make the crosswalk pass.

## Retrieval versus decision

| Source | Lexical candidate recall | Vector top-10 candidate recall | Combined candidate recall | Forced vector top-1 precision |
| --- | ---: | ---: | ---: | ---: |
| youtube | 63.8% | 44.7% | 83.0% | 22.4% |
| rss | 71.8% | 35.9% | 79.5% | 16.7% |
| bluesky | 72.4% | 75.9% | 89.7% | 23.2% |

The fixed Qdrant acceptance threshold adds no links in this run. Lowering it would convert theme similarity into wrong IDs. Candidate recall is a separate ceiling for a candidate-constrained LLM, except for exact official-video links that can bypass retrieval.

## Cost per 1,000 input items

| Source | Waterfall LLM cost | Guarded LLM cost |
| --- | ---: | ---: |
| youtube | $0.274 | $0.720 |
| rss | $0.583 | $0.827 |
| bluesky | $0.503 | $0.867 |

Observed waterfall: **93 LLM calls, 179,717 prompt tokens, 4,373 completion tokens, $0.078884**, or **$0.464/1,000 input items**. The guarded run adds 68 calls and $0.058810; the combined spend is $0.137694, or $0.810/1,000. These are observed OpenRouter `usage.cost` charges, including reported cache effects, not a price quote for future workloads. No web-search/tool charges or paid embeddings were used.

Official/feed reads, local fuzzy matching, and local embeddings incurred **$0 measured API charges**. Qdrant/Crate reads incurred no metered API charge. CPU, existing store load, bandwidth, storage and operational worker cost are **not priced here**; therefore the table is inference cost, not total operating cost. Diagnostic vector retrieval was executed on every labeled item to measure candidate recall, even when an early waterfall stage had already accepted.

## Twenty examples, including failures

| Item / source | Input (canonical URL) | Hand label | Waterfall output | Guarded output | Result / explanation |
| --- | --- | --- | --- | --- | --- |
| Y001 / youtube | [Death never sounded so good \| 🎬 Puss in Boots: The Last Wish (2022)](https://www.youtube.com/watch?v=prvcur6wQhE) | Puss in Boots: The Last Wish (2022) `movie:315162` | Puss in Boots: The Last Wish (2022) `movie:315162` | Puss in Boots: The Last Wish (2022) `movie:315162` | correct link. Explicit title and year. |
| Y002 / youtube | [Sie hört dich. Sie sieht dich. Und sie lauert im Wasser. 🐍 BEWARE BOIÚNA – Ab 12. November im Kino](https://www.youtube.com/watch?v=tMwpR1tvyuY) | Beware Boiúna (2026) `movie:1244523` | Es gibt kein zurück (2024) `movie:1386340` | Beware Boiúna (2026) `movie:1244523` | correct link. Upcoming German release; title stated. |
| Y005 / youtube | [Not many other burns as savage as "Jurassic fitness.”](https://www.youtube.com/watch?v=Mq5lpMmrNWM) | The Substance (2024) `movie:933260` | The Latest News (1904) `movie:526323` | The Substance (2024) `movie:933260` | correct link. Description names clip source. |
| Y006 / youtube | [Misty Green \| Official First Look \| A24](https://www.youtube.com/watch?v=mkJVHTBuv9Y) | Misty Green (2026) `movie:1381221` | Everything Everywhere All at Once (2022) `movie:545611` | Misty Green (2026) `movie:1381221` | correct link. Chris Rock feature; exclude A24 boilerplate. |
| Y009 / youtube | [River \| Official Trailer](https://www.youtube.com/watch?v=ox8lEnsxDag) | River (2026) `movie:1520592` | Devil in Disguise: John Wayne Gacy (2025) `tv:257534` | River Wild (2023) `movie:1000475` | wrong link. Joshua Giuliano/Jane Levy new film; not older Rivers. Production year is 2026; synopsis confirms identity despite January promotion. |
| Y020 / youtube | [Are you ready to face your fear? Get tickets now for #ClayfaceMovie](https://www.youtube.com/watch?v=gk_yGpCGrk4) | Clayface (2026) `movie:1400940` | Clayface (2026) `movie:1400940` | Clayface (2026) `movie:1400940` | correct link. Movie hashtag and October 23 theatrical promotion. |
| Y023 / youtube | [Get Out \| Chris Finally Escapes The Sunken Place and Armitage Family](https://www.youtube.com/watch?v=eDoCI0WWJfU) | Get Out (2017) `movie:419430` | Get Out (2017) `movie:419430` | Get Out (2017) `movie:419430` | correct link. Explicit clip title and recognizable plot. |
| Y031 / youtube | [SPIDER-MAN: BRAND NEW DAY - Extended Preview](https://www.youtube.com/watch?v=ITv7MbH9mTc) | Spider-Man: Brand New Day (2026) `movie:969681` | Spider-Man: Brand New Day (2026) `movie:969681` | Spider-Man: Brand New Day (2026) `movie:969681` | correct link. Explicit sequel title. |
| R003 / rss | [Heute Abend steamen: Einer der besten Fantasyfilme aller Zeiten – so habt ihr Robert De Niro noch nie ges](https://www.filmstarts.de/nachrichten/1000227079.html) | Stardust (2007) `movie:2270` | none | none | miss / abstention. Der Sternwanderer is German title, De Niro identifies 2007 film. |
| R010 / rss | [Er bescherte uns einen der grausamsten Filme der letzten Jahre – im Trailer zu seinem neuen Werk legt der](https://www.filmstarts.de/nachrichten/1000227298.html) | Confession (2026) `movie:1772726` | The Painted Bird (2019) `movie:477428` | Confession (2026) `movie:1772726` | correct link. New Vaclav Marhoul movie is main work; Painted Bird is creator credit. |
| R018 / rss | [Forget ‘John Wick,’ Denzel Washington’s $192M Action Hit Is Now on Netflix](https://collider.com/denzel-washington-the-equalizer-netflix-streaming-october-2026/) | The Equalizer (2014) `movie:156022` | The Equalizer (2014) `movie:156022` | The Equalizer (2014) `movie:156022` | correct link. Denzel $192m action blockbuster, not TV show. |
| R023 / rss | [Weiterer Castzuwachs für den neuen "Miami Vice"-Film: Dieser Star aus einer der besten Serien der Gegenwa](https://www.filmstarts.de/nachrichten/1000227277.html) | Miami Vice '85 (2028) `movie:1467853` | Top Gun: Maverick (2022) `movie:361743` | Miami Vice (2006) `movie:82` | wrong link. Joseph Kosinski upcoming reboot, not Michael Mann 2006 film. Catalog lists reboot as Miami Vice 85 (2028), distinct from 2006 movie. |
| R041 / rss | [‘La Bola Negra’, ‘Woman Unknown’, ‘NAZA’ & ‘Fjord’ Among 68 Films On Shortlist For 39th European Film Awa](https://deadline.com/2026/10/short-list-39th-european-film-awards-1237156545/) | La bola negra (2026) `movie:1422041`; Woman Unknown (2027) `movie:1511780`; NAZA (2026) `movie:1755291`; Fjord (2026) `movie:1401459` | European Film Awards (?) `tv:95762` | La bola negra (2026) `movie:1422041` | correct link. Awards shortlist discusses four equal headline works. Woman Unknown production release year is 2027, distinct identity from awards date. |
| R047 / rss | [Tallinn-Bound Indian Drama ‘Kidney’ Boarded by Shiladitya Bora’s Platoon One Films (EXCLUSIVE)](https://variety.com/2026/film/news/tallinn-indian-drama-kidney-platoon-one-films-1236909621/) | main work absent: Kidney | none | none | correct none. Aakarsh/Agrim Sansanwal second feature; requires director context to distinguish. Exact catalog namesake movie:1720905 is directed by Matteo Montresor, not the Sansanwals; target absent. |
| B004 / bluesky | [Pokemon - Season 2 Episode 5 - Fit to Be Tide! Frame 2403/2544 Caption: proof that you've won your match.](https://bsky.app/profile/did:plc:5olkd3vuiqu75rgyfjjovvbq/post/3mxtghtpips2h) | Pokémon (1997) `tv:60572` | Pokémon (1997) `tv:60572` | Pokémon (1997) `tv:60572` | correct link. Season 2 Fit to Be Tide belongs to original Pokemon anime, not a later spin-off. |
| B003 / bluesky | [Sommer, tutto in 24 ore: prima batte l'Inter, poi si separa dalla moglie L'annuncio del portiere è arriva](https://bsky.app/profile/did:plc:f4q4dz4a57oqqlpjr7n7ehxj/post/3mxtgjb7bpa2l) | none | Gossip (2026) `movie:1719646` | Gossip (2026) `movie:1719646` | wrong link. Italian footballer's separation/celebrity gossip; tv substring in URL, no work. |
| B001 / bluesky | [‘The Land’ Trailer: Christopher Meloni, Mandy Moore and William H. Macy Tackle Family Drama and Football ](https://bsky.app/profile/did:plc:s6twl7aidksjxcr723zpyx5d/post/3mxtdfct7jo2r) | The Land (?) `tv:274395` | Playing Field (2017) `movie:1638399` | none | miss / abstention. Fogelman Hulu football-family series; other shows/credits are incidental. |
| B002 / bluesky | [Lisandro Martínez fury at Jason Wilcox widely shared by Manchester United teammates  Defender voiced crit](https://bsky.app/profile/did:plc:vzmnljt7otfbbgrmachtefxh/post/3mxtct32lhy2a) | none | none | none | correct none. Manchester United football personnel news; director of football triggers keyword, no catalog work. |
| B005 / bluesky | [There's a bit in Moore's memoir MY WORD IS MY BOND about shooting THE PERSUADERS with Tony Curtis. Moore ](https://bsky.app/profile/did:plc:g7btawht655kvmzqpr6oaeov/post/3mxtbbtpquk2y) | The Persuaders! (1971) `tv:2543` | The Persuaders! (1971) `tv:2543` | The Persuaders! (1971) `tv:2543` | correct link. Moore and Curtis filming anecdotes explicitly identify series; memoir is context. |
| B006 / bluesky | [Last nights first watch #film was the British crime drama The Stranger Came Home (aka The Unholy Four) [1](https://bsky.app/profile/did:plc:pvaocaa3ze373bzdl67mbwzi/post/3mxt7qta5z22h) | The Unholy Four (1954) `movie:124557` | The Unholy Four (1954) `movie:124557` | The Unholy Four (1954) `movie:124557` | correct link. Title alias The Stranger Came Home plus year/director/cast distinguish 1954 movie. |

Every item, candidate list, model reason and charge is available in the committed JSON, including errors not selected for this table.

## Ambiguous items

- **Y040**: Concert performance has its own catalog movie and explicitly promotes the Primetime soundtrack; self-link versus promotional title depends on product policy.
- **R014**: Headline's central horror film is absent from excerpt; Carrie is creator credit, cannot identify primary work.
- **R035**: Cannot identify main work from supplied headline/description.
- **R037**: Excerpt does not identify the main work.
- **R045**: Insufficient explicit identity in excerpt; don't label from guesses.
- **R049**: Cannot identify sequel works from excerpt.
- **R054**: New remake's title/year unconfirmed; Tangled is cast credential, not main topic.
- **B022**: No show title; character names suggest Helluva Boss, but quoted/reply context was not inspected.
- **B053**: Film title absent and trailer not inspected; quote-based inference needs context/verification.
- **B057**: Fan edit may span John Wick franchise installments; no video inspected, so exact installment remains unclear.
- **B060**: Documentary is described but title/catalog identity absent from headline and excerpt.

## Recommendation and limits

- **YouTube:** make verified channels the discovery backbone, but promote only independently validated exact catalog video-ID links into the first automatic-link pilot. Use an editorial queue for other uploads. Extract the promoted title from upload title/hashtag/foreground description and strip A24/Disney boilerplate before retrieving candidates. The main-post title must outrank incidental cast credits and literal phrases in plot summaries.
- **RSS:** use as a curated headline/link feed today. For the next linker, extract primary work mentions, include translated/alternative catalog titles, retrieve newer remakes separately, and provide director/cast/synopsis/release context. Excerpt-only ambiguous stories require the article body or manual handling. Generic industry and merchandise news should abstain.
- **Bluesky:** keep hand-picking for title pages; keyword-filtered streaming is a discovery input, not a publishable title-linked feed. Require explicit title/version evidence and resolve quoted/reply context where permitted. Short conversational, book, podcast, political, non-English and generic recommendation posts are not identities. Semantic nearest-neighbor retrieval should never auto-link by itself.
- **Before broad automation:** build a foreground-first candidate generator and a rejection gate, then evaluate on a new independently labeled, multi-day sample. Do not reuse this sample to tune thresholds and claim a held-out shipping result. Check precision on accepted links, recall on both catalog-linkable and named-but-missing works, and error rates for remakes, same-name shorts, localized names, boilerplate, and each publisher/channel.

No production store or cache writes were performed. This branch contains scripts/local artifacts only; main was untouched. Real collection, Crate SELECTs, Qdrant queries, local embeddings and OpenRouter inference ran. Python compilation, mutation rejection guards, offline metric replay, sample/label/ID invariants and git diff checks were used for verification. No UI, production ingestion/deployment, multi-day operation, independent annotation review, publication rights/consent or all-entity recall was tested.

## Inputs and reproduction

- [Issue 544](https://github.com/alp82/goodwatch-monorepo/issues/544).
- [Discovery facts](https://github.com/alp82/goodwatch-monorepo/blob/research/talked-about-now-discovery/docs/research/talked-about-now/discovery.md), read with `git show origin/research/talked-about-now-discovery:docs/research/talked-about-now/discovery.md`.
- [Prior design](https://github.com/alp82/goodwatch-monorepo/blob/ccr-327ca25f-xd6xns/docs/research/reports/Social%20content%20embeds%20deep%20dive.md), read from `origin/ccr-327ca25f-xd6xns` (the local short branch was absent).
- [Primary Jetstream filtering/replay documentation](https://bsky.network/docs/jetstream/), checked 2026-10-14. Actual collection used the documented west v2 endpoint and `xrpc.v1.json` subprotocol.
- [OpenRouter model metadata](https://openrouter.ai/api/v1/models), checked 2026-10-14; charges use actual per-response usage.
- [Run instructions and artifact index](README.md). Run `python evaluate.py` and `python report.py` offline to regenerate numbers/report. Full catalog/model snapshots are local ignored files; sampled candidates and reference identities are committed.
