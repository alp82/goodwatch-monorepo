# Relevance recovery — 2026-10-15

The deterministic relevance judge now keeps substantive title-focused craft discussions and trailer audience reactions separately from the trailer announcement. It also recognizes German title compounds and ordinary punctuation around body subjects. No inference, paid service, new crawler, schema change or YouTube playability change is involved. Writes remain restricted to `doc.social_relevance` through the existing re-judge writer.

## Reproduction and causes

The baseline evaluation reproduced all 75 relevant links lost from the frozen 632-association audit. A failing test at `judge_links` reproduced P196 and P394 as `peripheral_title`, and P424 as `duplicate_of` the trailer representative. The test uses the existing captured Narnia inputs, catalog aliases and frozen observation time, with the evaluation's explicit offline playability assumption.

Three specific mechanisms explain the Narnia failures:

- P394: the shared matcher's reference heuristic treats `Narnia Fans` like a peripheral credit. A direct audience response to this title's trailer is substantive coverage. The relevance gate now recognizes that relationship while retaining the exclusion for unrelated fan/cast news.
- P196: `zum neuen Narnia-Film` was neither a recognized body-subject prefix nor an extracted standalone title mention. The body check now accepts the explicit film/series compound, with an editorial cue in the same sentence. A `Narnia-Fan` mention supplies no such evidence.
- P424: duplicate classification considered the trailer headline but missed the lead's explicit filmmaker Q&A. Interview evidence in the first 500 characters now protects the independent interview angle. Trailer reactions have their own event group, separate from trailer-release reports. Same-URL copies and repeated reaction reports still collapse.

Across the audit, reference-only checks also lost cast discussions of cut scenes, finales and performances; the body-subject regex wrongly required a word boundary after punctuation; and the editorial vocabulary missed confirmation reports, role explainers, timelines and German criticism. The new exceptions require concrete evidence. Credits, comparisons, old-title sequels, unrelated career announcements, routine availability, reach/substance thresholds and publication windows retain their exclusions.

Every baseline false drop is classified below. Groups are mutually exclusive combinations of actual decision reasons; the evidence JSON records all 75 links, their audit reasons, before/after decisions and every transition.

| Baseline reason combination | Lost relevant links |
|---|---:|
| Peripheral title | 39 |
| No editorial angle | 11 |
| Outside publication window | 6 |
| Duplicate | 5 |
| No substantive video format | 4 |
| No editorial angle + peripheral title | 2 |
| Routine or personal news | 2 |
| Archive without current hook + no substantive video format | 1 |
| Fewer than 12 own words | 1 |
| Fewer than 12 own words + peripheral title | 1 |
| No concrete official announcement | 1 |
| No editorial angle + peripheral title + routine or personal news | 1 |
| Outside publication window + peripheral title | 1 |
| **Total** | **75** |

The overlapping marginal counts are 44 peripheral, 14 no-angle, seven expired, five video-format, five duplicate, three routine/personal, two short-social, one archive-hook and one official-announcement failure. These counts must not be added together.

## Before and after evaluation

Precision is relevant among kept associations; recall is kept relevant among all relevant associations. The frozen audit measures editorial relevance. Its harness assumes video availability explicitly; production uses real playability evidence. These are regression results on the development corpus, not an independent holdout.

| Scope | Before keep/drop | After keep/drop | Precision before → after | Recall before → after | Relevant recovered |
|---|---:|---:|---:|---:|---:|
| Overall | 272 / 360 | 287 / 345 | 92.65% → 93.38% | 77.06% → 81.96% | 16 |
| RSS | 238 / 179 | 253 / 164 | 91.60% → 92.49% | 76.22% → 81.82% | 16 |
| YouTube | 30 / 49 | 30 / 49 | 100% → 100% | 85.71% → 85.71% | 0 |
| Bluesky | 4 / 132 | 4 / 132 | 100% → 100% | 66.67% → 66.67% | 0 |
| Mastodon | 0 / 0 | 0 / 0 | Unmeasured | Unmeasured | 0 |
| Top 20 | 41 / 44 | 47 / 38 | 97.56% → 97.87% | 75.47% → 86.79% | 6 |

Recall gains are **4.89 percentage points overall**, **5.59 points for RSS**, and **11.32 points for the top 20**. All 252 previously retained relevant links remain kept. No newly retained link is labelled irrelevant. False positives fall from 20 to 19: recovering the correct IDFA opening-premiere representative P486 suppresses the redundant P489 report.

Recovered audit IDs: P038, P116, P134, P139, P155, P159, P196, P264, P313, P359, P374, P375, P394, P424, P486 and P550. There are still **59 relevant audit links dropped**: 30 peripheral-only, six no-angle-only, seven with expired publication times, four alternate duplicate representatives, five video-format failures, two short social posts, three routine/personal headlines, and one official-announcement failure, with overlaps. One further link has both no-angle and peripheral reasons. These conservative losses are recorded in the evidence. This fix does not invent identity aliases or relax freshness, reach or video-format safeguards to recover every audit label. The five previously empty top-20 titles remain empty.

[Full comparison, all false-drop causes and per-platform/top-20 statistics](evidence/relevance-recovery-eval-2026-10-15.json).

## Verification

- The Narnia regression failed on all three reported articles before the fix and passes afterward. It also asserts repeated plain trailer reports and the low-reach social post remain dropped.
- Tests cover independent trailer/interview/reaction/analysis groups, repeated reaction reports, exact-URL copies, order independence, German body compounds, punctuation, concrete cast discussion, unrelated career news, comparators and sequels of old titles.
- Regression release bars use the exact baseline fractions, including 252/272 overall precision, 40/41 top-20 precision and 100% YouTube/Bluesky precision; retained relevant links must reach at least 268.
- Isolated localhost CrateDB 5.10.16 verifies persistence of all 632 decisions, typed reasons, BIGINT keys and stale-write protection. The social suite and unchanged playability suite pass: **76 tests passed, 12 skipped**. Skipped tests require mutations to other existing social tables and were not enabled.
- Python compilation and `git diff --check` pass. Windmill metadata was generated with deployment CLI 1.803.0.

Reproduce:

```sh
python goodwatch-flows/tools/social_relevance_eval.py --output /tmp/relevance-after.json
SOCIAL_RELEVANCE_TEST_URL=http://127.0.0.1:14202 /tmp/gw-relevance-venv/bin/python -m unittest discover -s goodwatch-flows/tests -p 'test_social*.py'
/tmp/gw-relevance-venv/bin/python -m unittest discover -s goodwatch-flows/tests -p 'test_youtube_playability.py'
```

The localhost URL and environment path above identify the isolated verification instance, not production.

## Production baseline and candidate preview

The owner independently added `u/Alp/YOUTUBE_API_KEY` and applied the existing playability code at 20:37 UTC. That key rollout is outside this change. A subsequent independent read-only baseline [job](https://windmill.goodwatch.app/api/w/goodwatch/jobs_u/completed/get_result/01a1414a-a4ad-215a-040d-dc7c81e5ac0f) confirms **666 eligible associations**, **30 YouTube + 262 RSS + 4 Bluesky keeps**, and **79 playable / three blocked / zero unknown videos**. There are 667 stored rows; one is outside the eligible corpus. All active links have current version/hash verdicts. Narnia initially has only the playable Netflix trailer, `gDJ-ini7fF0`.

The read-only candidate [preview](https://windmill.goodwatch.app/api/w/goodwatch/jobs_u/completed/get_result/01a1414b-6d82-a80b-3593-581e3cb6f32e) judges all 666 associations: YouTube 30 keep / 52 drop, RSS 277 / 170, Bluesky 4 / 133. It has zero hydration errors and unchanged 79 playable / three blocked / zero unknown observations. All three Narnia articles are kept beside the playable trailer. This preview loads only the candidate relevance module in memory and writes no database rows.

Merge, main Windmill sync, deployed-content verification, deployed preview → apply and independent read-back are recorded in the PR rollout report after completion. Neither preview counts nor offline evaluation are claims of a deployed production change.
