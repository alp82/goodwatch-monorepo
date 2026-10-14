# Does the buzz score find what was actually talked about?

Throwaway logic/data prototype for [#543](https://github.com/alp82/goodwatch-monorepo/issues/543), collected and reviewed **2026-10-14**. Branch: `prototype/talked-about-now-buzz-score`, based on `origin/main` at `4003c90d`. Open **[review.html](review.html)** directly from disk: every daily top-20 table and its evidence is embedded, with no server, installation, runtime request or publication.

## Verdict and recommended formula

**Yes, z-score finds abrupt attention events. For “talked about now” over a release week, volume-gated lift is the better starting ranking in this sample.** Z-score is best retained as a burst diagnostic. Both find deaths, anniversaries and attention to related works, so neither establishes that a title is a worthwhile suggestion or that its own release caused the attention.

For title `i` on the latest complete UTC day `d`, calculate the arithmetic mean `μ28` and population standard deviation `σ28` over **exactly d−28 through d−1**, excluding `d`. Require all 29 observations; missing article coverage is unknown, never zero.

```text
eligible = views[d] >= 1,000 AND views[d] - μ28 >= 500
rank_score = views[d] / max(μ28, 1)       # volume-gated lift; descending
burst_z = (views[d] - μ28) / σ28          # missing when σ28 = 0

# Optional, provisional “hot” eligibility: rank_score >= 2.
# Do not force twenty results if insufficient eligible titles remain.
```

The 1,000-view and 500-extra-view thresholds are **prototype choices**, not calibrated production thresholds. A denominator floor for z-score also helps very stable/flat series, but does not fix the main issue: a release enters the rolling baseline and inflates its variance, depressing z while attention is still several times normal. Do not blend current TMDB trending into past days. Keep TMDB/Netflix as explicitly dated corroboration until prospective trending snapshots can validate their contribution.

This is an editorial judgment on a biased candidate sample, **not a precision/recall benchmark**. Event annotations are incomplete and some were researched after seeing the ranks. Unknown annotations must not be counted as false positives. The evidence confirms events and coincidence, not the cause of each pageview.

## Inputs, coverage and clocks

| Input | What was collected | Important qualification |
|---|---|---|
| GoodWatch catalog | Top **500 combined** movies/shows by stored TMDB popularity: **67 movies / 433 shows**, cutoff popularity **76.6613** | SELECT-only production Crate; current fixed cohort, no presentability/adult filter; show-heavy selection and survivorship bias. Never started the application or connected to a cache. |
| Wikidata | P4947 movie/P4983 show TMDB IDs → English Wikipedia sitelinks; **431 unambiguous articles** | No title-name Wikipedia search. All candidates retained in `data/titles.json`; multiple article matches excluded. No shared article URLs among accepted identities. |
| Wikipedia | **60 daily days, August 15–October 13**, for all 431 accepted articles; **425 complete 60-day histories** | Six histories have missing dates; no zero imputation. Exact Wikimedia `all-access/user` request URLs, status and fetch time retained. |
| TMDB popularity | **120 HTTP-200 exports**: 60 movie + 60 show files, selected cohort rows and compressed-response hashes; **495 titles have some history, 493 all 60 snapshots** | Five adult movies are absent from the ordinary export set; adult exports were not collected. Popularity history is **not trending history**, nor a daily count. These exports are retained by TMDB for three months. Each same-date morning snapshot is earlier than that day’s final Wikipedia count. |
| TMDB trending | October 14 authenticated first five pages of day/week movie/show trending using the existing project key | Each capture has 100 rows but duplicates: daily lists contain **98 movie / 91 show distinct IDs**. Use first observed rank, preserve duplicate rows for audit. No historical trending ranks available. Only a deliberately labeled hindsight sensitivity variant uses them on past days. Credentials and authenticated URLs are not retained. |
| Netflix | Entire **11,000-row** global TSV, **July 4, 2021–October 4, 2026** | Latest file week is stale relative to this review. Only 5 cohort titles match recent history; latest week matches The Gentlemen and Raw. |

The existing research said popularity needed locally retained snapshots; this spike additionally verified that [TMDB daily ID exports](https://developer.themoviedb.org/docs/daily-id-exports) contain popularity and are available for three months. [TMDB distinguishes popularity from trending](https://developer.themoviedb.org/docs/popularity-and-trending); they must not be interchangeable labels.

Wikipedia requests used `GoodWatchResearch/1.0 (https://goodwatch.app; hello@goodwatch.app) issue-543-buzz-prototype`, sequentially, with a **0.5-second pause after each response**, below 120 requests/minute before accounting for response latency. Requests honor 429/Retry-After. Wikidata exports were sequential with a 60-second processing-budget pause. See [Wikimedia access policy](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/access-policy.html) and [WDQS manual](https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual).

Netflix is replayed using the **latest week present in the downloaded file** whose assumed publication Tuesday (week-ending Sunday + 2 days) is no later than the scored day. Week labels are not assigned backwards to their viewing days. Exact normalized title/original-title plus movie/show category matching is unique only within the cohort; all matches are explicitly provisional in `data/netflix-matches.json`. Season rows are retained and the best category/season rank is used. Absence means absent from Top 10, not zero viewing. The Tuesday timing follows [Netflix’s methodology](https://www.netflix.com/tudum/top10); there are no archived TSV publication vintages, so this is a publication-lag approximation, not an exact historical availability replay.

## Scoring experiment

Scores are calculated for **21 days, September 23–October 13**. The six consecutive recent review days are **October 8–13**. Every variant has its own daily top 20 in the HTML, with title identity, views, baseline mean/SD, z/lift, TMDB value/contribution, Netflix rank/window and event evidence. All 21 days of title metrics and ranks remain in `scores.json`.

Let `p = clip(article_z, 0, 10)`, `t = clip(tmdb_z, 0, 10)`, and `n = 11 − best Netflix rank` when matched, otherwise 0. TMDB z uses `(popularity − μ28) / max(σ28, 0.05μ28, 0.1)`, avoiding a nearly-flat-score explosion. These simple blend weights are sensitivity hypotheses, not fitted weights.

| Variant | Rule | What it tests |
|---|---|---|
| Pageviews alone | Raw article z-score | Own-baseline sudden attention |
| Pageviews + TMDB history | `0.75p + 0.25t` | Historical **popularity proxy**, not actual trending |
| + Netflix weekly | `0.75p + 0.25t + 0.10n` | Dated chart bonus; holds the other contributions fixed to isolate Netflix’s effect |
| + current trending, hindsight only | `0.80p + 0.20 × 10(101−rank)/100` | Effect of current top-100 ordering; **future information, excluded from verdict** |
| Lift | `views / max(μ28,1)` | Sustained proportional attention |
| Z + volume floor | Raw z, views ≥1,000 and extra views ≥500 | Remove tiny-count noise |
| Lift + volume floor | Same floor, raw lift | **Recommended starting ranking** |
| Regularized z + floor | `(views−μ28)/max(σ28,√μ28,100,0.1μ28)` | Stable-baseline denominator noise |

Missing complete TMDB baselines exclude a title from the historical blends, rather than silently filling popularity with zero. Missing/flat article z excludes it from z-based variants; lift and regularized z remain defined with their explicit denominator floors. Comparisons are therefore not perfectly equal coverage; the row counts remain visible.

## Comparison and judgment

Each row below summarizes **120 ranked slots** (20 titles × six days), including repeated titles across days. There are **101 distinct titles** across all variants. “Direct event” means an annotated event for that work; context includes anticipated releases, related-work news and explicitly inferred spillover. This is **annotation coverage**, not measured precision, and unknown rows are not automatically errors.

| Variant | Direct event | Death | Anniversary | Context / inferred | No dated event verified | Under 1,000 views |
|---|---:|---:|---:|---:|---:|---:|
| Pageviews z | 39 | 2 | 1 | 25 | 53 | 20 |
| + TMDB popularity history | 53 | 2 | 1 | 21 | 43 | 19 |
| + Netflix weekly | 53 | 2 | 1 | 21 | 43 | 19 |
| + current trending, **hindsight only** | 64 | 2 | 1 | 24 | 29 | 11 |
| Lift | 59 | 2 | 0 | 16 | 43 | 19 |
| Z + volume floor | 52 | 2 | 3 | 29 | 34 | 0 |
| **Lift + volume floor** | **64** | 2 | 1 | 22 | **31** | **0** |
| Regularized z + floor | 53 | 2 | 2 | 28 | 35 | 0 |

**Gated lift is the most convincing usable ranking here:** it keeps release-week attention near the top and removes tiny-count entries, with no cross-source weight to tune. It has more documented direct-event slots than the raw z or historical blends. The remaining 31 unverified slots mean it is not an explanation engine. The highest slots on October 13 still include death-related attention and inferred reboot spillover.

**Historical TMDB popularity helps, but does not replace the volume floor:** direct-event annotations rise from 39 to 53, yet **19** slots remain below 1,000 article views. For example, Anderson Cooper 360° reaches the October 13 blend’s top eight with **91** views. Current TMDB trending appears to corroborate releases strongly in the hindsight table, but that uses future information and cannot validate a live blend.

**Netflix changes neither top-20 membership nor order on any of the six days.** The additive bonus holds the other contributions fixed; this null result is attributable to its sparse/stale matches in this cohort, not a reweighting of pageviews versus TMDB. It does not demonstrate Netflix is unhelpful in a broader candidate pool.

The z-score floor sensitivity in `evaluation.json` yields **39 / 52 / 52 / 56** direct-event slots at **0 / 500 / 1,000 / 2,500** daily views respectively (nonzero floors also require 500 extra views). A 2,500 floor discards Naruto’s real NYCC-related 1,466-view October 11 rise. Since annotations favor English-language releases, maximizing this count is not a defensible calibration rule. A 1,000 floor is a provisional compromise. Regularizing z changes comparatively few ranks and still suffers the release-in-baseline decay.

## Six-day reality check

| UTC day | Leading gated-lift titles | What was happening |
|---|---|---|
| October 8 | Below, Carrie, Other Mommy | [Below released October 8](https://www.netflix.com/tudum/articles/new-on-netflix); [Carrie released October 7](https://www.aboutamazon.com/news/entertainment/carrie-stephen-king-mike-flanagan-prime-video); [Other Mommy opened October 9](https://www.nbcuniversal.com/article/universal-pictures-other-mommy-releases-october-9), so October 8 is anticipation/preview context. |
| October 9 | Below, Take Charge of My Heart, Animals | [Netflix’s October 9 releases](https://www.netflix.com/tudum/articles/new-on-netflix), [Avatar: Seven Havens’ first episodes](https://www.paramountplus.com/shows/avatar-seven-havens/), and [Matchbox’s Apple TV debut](https://www.apple.com/tv-pr/news/2026/10/apple-original-films-celebrates-the-world-premiere-of-matchbox-the-movie/) align with the high ranks. |
| October 10 | Take Charge of My Heart, Animals, Below | Release-week attention persists; [Disclosure Day arrived on Peacock October 9](https://www.space.com/entertainment/space-movies-shows/how-to-watch-disclosure-day-online). Z also elevates older titles with no verified event, while lift keeps the new releases near the top. |
| October 11 | Take Charge of My Heart, Animals, Below | [Naruto’s NYCC announcement](https://naruto-official.com/en/news/01_2695) is franchise news, not new original-series episodes; [30 Rock’s 20th-anniversary reunion](https://www.msg.com/events-tickets/tina-fey-radio-city-music-hall-october-2026/3C0065138E82128F) is old-title rediscovery. |
| October 12 | Take Charge of My Heart, Below, Animals | [RJ Mitte’s death was reported](https://www.upi.com/Entertainment_News/2026/10/12/Breaking-Bad-RJ-Mitte-dies/5241791842396/), giving Breaking Bad the largest z-score; [The Rookie’s NYCC trailer/news](https://www.tvinsider.com/1251609/the-rookie-season-9-cast-premiere-date-trailer-details/) and [Miami Vice ’85 first-look images](https://medianewsjournal.com/2026/10/miami-vice-85-first-look-michael-b-jordan-austin-butler-as-tubbs-and-crockett) explain additional attention. |
| October 13 | Breaking Bad, Take Charge of My Heart, Miami Vice | Death-related attention remains largest; original Miami Vice rise is inferred reboot spillover. [ABC’s High Potential promo and Super Bowl-slot announcement](https://www.detpress.com/abc/pressrelease/high-potential-to-follow-super-bowl-lxi-on-abc-and-disney/) is news, not a current episode premiere. |

An instructive trajectory: **Below** has **91,539 views / 3,495 baseline mean / z 38.16 / lift 26.19×** on October 8. On October 13 it still has **104,201 views / 26,596 mean / z 1.49 / lift 3.92×**. A strict z≥2 badge would stop calling it hot even though reading attention remains nearly four times baseline. **Animals** similarly falls from z **26.12** on release day to **1.38** on October 13, while its lift remains **3.64×**. These are calculations from the retained public pageview responses, not claims about measured social discussion.

## Failure modes and what they imply

- **Tiny English articles:** Law of the Jungle reaches z **7.78** on October 8 on just **121** views (baseline about 47). Sítio do Picapau Amarelo reaches z **4.48** on October 13 on **39** views. A volume floor addresses this numerical problem, but also disadvantages real non-English audience attention.
- **Deaths:** Breaking Bad reaches z **29.91** on October 12 and **12.71** on October 13. This is a correct attention detection with a very different meaning from “a new show to watch.” The related Better Call Saul lift is an inference, not its own release.
- **Anniversaries:** Smallville’s NYCC reunion coincides with attention before its October 16 25th anniversary; 30 Rock’s October 11 reunion is a real current event about an old title. [Panel reporting](https://www.amny.com/entertainment/smallville-tom-welling-michael-rosenbaum-reflect-superhero-series/) and the [Radio City listing](https://www.msg.com/events-tickets/tina-fey-radio-city-music-hall-october-2026/3C0065138E82128F) support the context.
- **Sequels/reboots lift old works:** Miami Vice, Naruto, Dragon Ball Z, Keeping Up with the Kardashians and Avatar Aang need distinct-work identity and explicit inferred relationship labels. [The Kardashians’ October 8 season premiere](https://abc.com/news/2a2d0782-a437-429c-93d9-a42edd6e85a2/category/3722338) does not mean the older Keeping Up series returned.
- **Stale evidence can falsely “confirm” a rank:** Old pages still list October 9 for Avatar Aang, but [Paramount’s July release notices](https://www.paramountpressexpress.com/paramount-plus/shows/avatar-aang-the-last-airbender/releases) establish July 25. Its October rise belongs in franchise context alongside Seven Havens, not in the list of new movies. Publication dates and event dates must be checked separately.
- **Baseline absorbs a release:** z finds the first burst but fades quickly; lift better represents sustained elevated attention for this release week. Both eventually normalize after weeks of elevated traffic. A 28-day mean is not a clean “pre-event baseline” forever.
- **Catalog candidate bias:** 433/500 are shows, many long-running soaps/news/talk programs. East of Eden is absent from this cohort despite [its October 1 Netflix release](https://www.netflix.com/tudum/articles/east-of-eden-release-date-photos). A production candidate pool should include current movie/show trending, releases and chart entries, with quotas evaluated separately. This spike did not alter the requested cohort.
- **Sparse Netflix coverage and lag:** Latest captured ranks cannot corroborate the October 8–9 releases; the oldest week is replayed honestly, not forward-filled as daily buzz. Equal-title/season matching can conflate remakes outside this cohort and needs stronger identity confirmation before production.
- **Unexplained ranks remain:** Without a Trace, Boston Legal, The Last of Us and other older titles sometimes rise without a dated event established in this investigation. Generic nostalgia, puzzles, availability, actor news or random variation are possible, not verified explanations. No event was invented to fill their evidence cells.
- **No direct conversation measurement:** English Wikipedia reads, TMDB activity and Netflix viewing are different kinds of attention. They do not quantify social mentions, sentiment, or what people said. Do not describe the score as a measured social volume.

## Reproduce and inspect

The scripts require Python 3.10+ and `requests` (the collection machine used 2.34.2). From this directory:

```bash
# Offline: reproduce all scores and the self-contained review from committed captures.
python score.py
python review.py

# Live capture: existing files are reused; move data/ aside for a fresh independent run.
# The end date is the last COMPLETE UTC day, not the current partial day.
python collect.py --env /path/to/goodwatch-webapp/.env --end 2026-10-13
python tmdb_history.py --end 2026-10-13
```

`collect.py` permits only single SELECT statements against production Crate. It never imports the application, reads a cache, or issues database mutations. The env file is read only to obtain the existing TMDB key; its contents are never printed or saved. `tmdb_history.py` downloads whole dated public exports with at most four simultaneous CDN requests, retains only the 500-title selection and provenance hashes, and discards the large full-catalog buffers. `score.py` and `review.py` operate entirely on local files.

Artifacts: `data/catalog.json`, `data/titles.json`, raw article responses in `data/pageviews/`, selected dated exports in `data/tmdb-history/`, current trending snapshot, full Netflix TSV plus digest, matching decisions, the 500-row `coverage.csv`, `evidence.json`, `scores.json`, `summary.json`, `evaluation.json` and `review.html`. The historical export hash is of the complete compressed response; selected rows alone cannot regenerate that hash. TMDB export availability expires; committed selections preserve this experiment.

The HTML contains all tables statically. External source links are citations, not dependencies for rendering. It was not deployed, published, or added to any application route. No production store or cache was written.

## Verification performed

Both collectors completed against real sources. Offline scoring and report generation completed against the frozen captures. An independent one-off calculation checked **8,976 title/day arithmetic means, population SDs and z-scores** directly from the raw article responses using `math.fsum`, and checked score ordering, unique top-20 identities, floor eligibility and Netflix publication lag. All **48 ranking tables / 960 review slots** contain 20 entries. The 500-row coverage export, all **562 capture JSON files**, and all **120 successful TMDB exports** parsed successfully; the full Netflix TSV matched its recorded SHA-256.

The final HTML was opened as a local file in **headless Chromium**, its rendered screenshot inspected, and its structure checked for **zero broken internal anchors and zero external rendering dependencies**. All Python scripts compiled. The existing TMDB secret was checked against every deliverable and was absent. The full check record is in `verification.json`. No production app test, deployment, or cache write was needed for this standalone spike. Prospective ranking accuracy, true historical trending, publication-vintage fidelity and comprehensive causal explanations remain unverified.

## References for the signal interfaces

- [Verified signal research input](https://github.com/alp82/goodwatch-monorepo/blob/research/talked-about-now-signals/docs/research/talked-about-now/signals.md), read with `git show` as requested.
- [Wikimedia pageview reference](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/reference/page-views.html) and [troubleshooting/missing-day caveats](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/troubleshooting.html).
- [TMDB daily exports](https://developer.themoviedb.org/docs/daily-id-exports), [popularity/trending distinction](https://developer.themoviedb.org/docs/popularity-and-trending), and [staff clarification that trending history is not public](https://www.themoviedb.org/talk/5f05af8093db9200344502fd?language=af-ZA).
- [Netflix global source TSV](https://www.netflix.com/tudum/top10/data/all-weeks-global.tsv) and [weekly methodology](https://www.netflix.com/tudum/top10).

The complete dated event index, including direct/inferred relationship, event date, source publication and check date, is in `evidence.json` and embedded in the review page. All news assertions above have linked evidence; the ranking verdict and cross-title causal interpretations are explicitly inferences.
