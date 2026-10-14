# Production evidence for #555

Collected on 2026-10-14 from production Crate and live public signals. All mutations were limited to the five new buzz tables. No application server or Valkey access was used. Table design was posted before building: [design comment](https://github.com/alp82/goodwatch-monorepo/issues/555#issuecomment-6172741942).

## Store and backfill

| Table | Rows |
| --- | ---: |
| `doc.buzz_title` | 616 |
| `doc.buzz_pageview` | 30,097 |
| `doc.buzz_trending` | 190 |
| `doc.buzz_score` | 15,842 |
| `doc.buzz_snapshot` | 33 |

Pool: 302 movies and 314 shows; 509 unambiguous enwiki mappings, 105 without enwiki and two ambiguous. Stored observations cover 2026-08-15 through 2026-10-13. The first run took 742.99 seconds; the finalized repeat took 28.59 seconds and reused complete observations. There are 485 complete 60-day series and 504 scorable titles on the latest UTC day.

The initial 60-day capture produced 32 dated snapshots (September 12 through October 13), plus `current`. Dated snapshots remain unchanged on retry. The current TMDB snapshot has 190 entries after the complete-capture marker was added; it is a real October 14 snapshot, never a fabricated historical list.

## Checks

- Fifteen offline unittest behavior tests passed; all new Python files compiled and `git diff --check` passed.
- Independent arithmetic from raw production observations passed for all 15,842 stored scores: prior-28-day means, population SDs, diagnostic z, lift and volume gates. All 32 daily eligible rankings were contiguous and deterministically ordered. Three sampled published top-20 lists matched the stored ranks.
- Source-delay and unknown-day tests preserve the last published day. Article remapping does not mix old and new series. Publication tests cover first-write history, crash repair, monotonic dates and concurrent newer writes. Partial trending captures are detected and recollected in full.
- Windmill schemas, dependency locks and hashes were generated using CLI 1.803.0. Existing Crate and TMDB variable paths were verified present without printing their values. The deployed Windmill flow itself has not run yet.

## Read latency

Query: `SELECT day, generated_at, payload FROM doc.buzz_snapshot WHERE snapshot_key = 'current'`. Payload: 25,109 UTF-8 bytes.

From the production webapp host `10.0.0.21` (`abusive`), 50 sequential HTTP reads **including payload JSON decoding**: first 11.09 ms, median 7.40 ms, p95 11.16 ms, maximum 14.23 ms. Every read was below 50 ms. Median Crate execution: 3.18 ms.

From the laptop over its production network route, the 30-read median was 73.28 ms (p95 133.09 ms), while Crate execution was 2.85 ms median. The application-host result is the relevant start-page path; the laptop result is retained rather than hidden.

## Top 20 samples

October 13 is the score day of the first real production run (executed October 14). October 12 and October 11 are explicitly **historical backfills over the currently collected candidate pool**, not earlier prospective daily runs. Event metadata was fetched now; its dated hints do not establish historical publication vintage. These three tables cannot satisfy the ticket’s three-day operation requirement.

### 2026-10-13

| Rank | Title | Kind / TMDB id | Lift | Views | Prior 28-day mean |
| ---: | --- | --- | ---: | ---: | ---: |
| 1 | Narnia: The Magician's Nephew | `movie:1147572` | 9.743× | 55,235 | 5,668.93 |
| 2 | Breaking Bad | `tv:1396` | 7.826× | 66,283 | 8,469.82 |
| 3 | Time | `tv:126116` | 5.936× | 25,846 | 4,353.96 |
| 4 | Hexed | `movie:1538497` | 5.865× | 23,051 | 3,930.39 |
| 5 | Dragon Ball Super: Beerus | `tv:312359` | 5.653× | 14,606 | 2,583.75 |
| 6 | 100 Days of Deception | `tv:293607` | 4.757× | 9,725 | 2,044.32 |
| 7 | Take Charge of My Heart | `tv:289423` | 4.682× | 11,572 | 2,471.39 |
| 8 | VisionQuest | `tv:213375` | 4.204× | 40,384 | 9,606.64 |
| 9 | Below | `tv:285322` | 3.918× | 104,201 | 26,596.00 |
| 10 | Treasure Island | `tv:333101` | 3.850× | 6,083 | 1,579.82 |
| 11 | Animals | `movie:1236045` | 3.642× | 63,810 | 17,521.64 |
| 12 | The Florist | `movie:1476746` | 3.529× | 1,545 | 437.75 |
| 13 | Crystal Lake | `tv:213562` | 3.475× | 17,679 | 5,086.86 |
| 14 | Carrie | `tv:288673` | 3.425× | 147,042 | 42,927.29 |
| 15 | Street Fighter | `movie:1153576` | 3.136× | 44,170 | 14,085.11 |
| 16 | Avatar: Seven Havens | `tv:284833` | 2.875× | 36,181 | 12,584.71 |
| 17 | The Lowdown | `tv:273247` | 2.811× | 4,676 | 1,663.68 |
| 18 | Wild Horse Nine | `movie:891621` | 2.395× | 10,416 | 4,348.32 |
| 19 | Wicker | `movie:1195803` | 2.357× | 16,906 | 7,171.32 |
| 20 | Clayface | `movie:1400940` | 2.243× | 32,547 | 14,507.25 |

### 2026-10-12

| Rank | Title | Kind / TMDB id | Lift | Views | Prior 28-day mean |
| ---: | --- | --- | ---: | ---: | ---: |
| 1 | Time | `tv:126116` | 12.818× | 38,405 | 2,996.07 |
| 2 | Dragon Ball Super: Beerus | `tv:312359` | 11.366× | 20,996 | 1,847.32 |
| 3 | 100 Days of Deception | `tv:293607` | 9.434× | 14,531 | 1,540.32 |
| 4 | Treasure Island | `tv:333101` | 7.525× | 9,414 | 1,251.11 |
| 5 | Take Charge of My Heart | `tv:289423` | 7.061× | 13,966 | 1,977.89 |
| 6 | Below | `tv:285322` | 6.271× | 137,034 | 21,852.68 |
| 7 | Animals | `movie:1236045` | 6.257× | 89,895 | 14,368.11 |
| 8 | Hexed | `movie:1538497` | 5.479× | 18,466 | 3,370.21 |
| 9 | Cupertino | `tv:303630` | 5.357× | 14,539 | 2,713.86 |
| 10 | Carrie | `tv:288673` | 5.227× | 189,885 | 36,326.32 |
| 11 | The Florist | `movie:1476746` | 4.400× | 1,685 | 382.93 |
| 12 | Breaking Bad | `tv:1396` | 4.174× | 31,734 | 7,602.39 |
| 13 | Avatar: Seven Havens | `tv:284833` | 3.735× | 42,083 | 11,267.11 |
| 14 | Disclosure Day | `movie:1275779` | 3.221× | 36,866 | 11,446.39 |
| 15 | Toy Story 3 | `movie:10193` | 3.115× | 12,057 | 3,870.46 |
| 16 | Wildwood | `movie:791523` | 3.098× | 24,197 | 7,811.71 |
| 17 | Matchbox the Movie | `movie:1148365` | 3.049× | 20,304 | 6,658.25 |
| 18 | Khalifa: The Ruler | `movie:1036081` | 3.043× | 18,915 | 6,215.21 |
| 19 | Wicker | `movie:1195803` | 2.666× | 17,824 | 6,686.89 |
| 20 | VisionQuest | `tv:213375` | 2.557× | 22,822 | 8,926.50 |

### 2026-10-11

| Rank | Title | Kind / TMDB id | Lift | Views | Prior 28-day mean |
| ---: | --- | --- | ---: | ---: | ---: |
| 1 | Toy Story 3 | `movie:10193` | 28.795× | 55,860 | 1,939.93 |
| 2 | 100 Days of Deception | `tv:293607` | 19.071× | 17,614 | 923.61 |
| 3 | Dragon Ball Super: Beerus | `tv:312359` | 19.002× | 21,054 | 1,108.00 |
| 4 | Time | `tv:126116` | 12.526× | 26,076 | 2,081.75 |
| 5 | Take Charge of My Heart | `tv:289423` | 11.824× | 16,493 | 1,394.86 |
| 6 | Animals | `movie:1236045` | 11.446× | 117,242 | 10,243.14 |
| 7 | Below | `tv:285322` | 9.607× | 157,798 | 16,425.89 |
| 8 | Treasure Island | `tv:333101` | 9.353× | 8,837 | 944.79 |
| 9 | The Florist | `movie:1476746` | 6.797× | 2,120 | 311.89 |
| 10 | Carrie | `tv:288673` | 6.770× | 199,079 | 29,408.21 |
| 11 | Khalifa: The Ruler | `movie:1036081` | 5.783× | 30,513 | 5,276.11 |
| 12 | Avatar: Seven Havens | `tv:284833` | 5.576× | 53,480 | 9,591.18 |
| 13 | Cupertino | `tv:303630` | 5.290× | 12,194 | 2,305.00 |
| 14 | Matchbox the Movie | `movie:1148365` | 5.261× | 29,732 | 5,651.75 |
| 15 | Disclosure Day | `movie:1275779` | 3.686× | 38,510 | 10,447.50 |
| 16 | Other Mommy | `movie:1400837` | 3.647× | 101,815 | 27,920.54 |
| 17 | Ice Age: Continental Drift | `movie:57800` | 3.243× | 2,908 | 896.71 |
| 18 | Doing Life | `movie:1458857` | 3.208× | 6,357 | 1,981.46 |
| 19 | The Housemaid | `movie:1368166` | 3.103× | 28,781 | 9,274.96 |
| 20 | The Social Reckoning | `movie:1281331` | 3.054× | 63,415 | 20,762.64 |

## Remaining after merge

Deploy through the normal main-branch sync, validate the real Windmill run, then enable the flow schedule at 08:00 UTC with delayed retries. Reuse existing `u/Alp/CRATE_HOSTS`, `CRATE_USER`, `CRATE_PASS` and `TMDB_API_KEY`; no new vendor secrets are needed. Follow [the runbook](buzz-score.md). Keep #555 open until two more calendar-day production runs succeed and their actual top 20 are posted. No owner decision is blocking this branch.

## Artifacts

- [First run](first-run.json) and [finalized repeat](rerun.json).
- [Counts, all-score audit and three complete payloads](production-evidence.json).
- [Production webapp-host read benchmark](webapp-read-benchmark.json); reproduce with `ssh root@10.0.0.21 python3 - < goodwatch-flows/tools/bench_buzz.py`.
