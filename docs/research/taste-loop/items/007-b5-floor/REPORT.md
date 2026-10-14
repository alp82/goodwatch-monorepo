# Item 007 report

Experimenter: Astra (gpt-6-astra, high effort) through codex exec; the first attempt was stopped by the system for low memory and resumed. Saved by the orchestrator.

**No candidate qualifies for registration.** F1 and F2 exceed the 2.0 franchise limit; F3 misses the 0.090 loved-title threshold.

Candidates and tests remain unchanged; **3 tests passed**. Reused six completed runs and finished only F3’s three missing runs, resuming 256 T2a views. All nine runs succeeded.

T2a figures below are for other members. First-50 shares measure hidden loved/disliked titles reaching the top 50.

| Scorer | Separation | Loved first-50 | Disliked first-50 |
|---|---:|---:|---:|
| B2 | .134342 | 1.89% | 0.11% |
| B3 | .130792 | 9.00% | 2.47% |
| B5 | .267044 | 0.15% | 0.05% |
| F1 | .243514 | 9.41% | 2.56% |
| F2 | .150162 | 9.12% | 2.16% |
| F3 | .219993 | 8.53% | 2.51% |

Paired separation differences, with 95% intervals:

| Candidate | ΔB2 | ΔB3 | ΔB5 |
|---|---|---|---|
| F1 | +.109 [.073,.144] | +.113 [.086,.140] | −.024 [−.047,.001] |
| F2 | +.016 [−.019,.046] | +.019 [.005,.034] | −.117 [−.152,−.084] |
| F3 | +.086 [.049,.121] | +.089 [.062,.116] | −.047 [−.071,−.021] |

T2a first-50 composition guards:

| Candidate | Shows | Animation | Largest franchise count | Median votes |
|---|---:|---:|---:|---:|
| F1 | 44.0% | 36.7% | **2.010094** | 111,605 |
| F2 | 41.0% | 39.2% | **2.011351** | 94,889 |
| F3 | 45.6% | 36.3% | 1.000000 | 104,070 |

All three significantly increase disliked-title first-50/first-200 shares and animation excess over B2. F3 fixes franchise repetition. F1/F3 separation gains survive score-and-vote matching, but none reproduces B5’s dislike suppression.

Owner T2a separation is F1 .455, F2 .366, F3 .449; loved first-50 shares are 4.74%, 4.99%, 4.74%, with no disliked first-50 hits.

T2b percentile improvements over B2, with 95% intervals:

| Candidate | Others: sitting | Others: order | Owner: sitting | Owner: order |
|---|---|---|---|---|
| F1 | +.234 [.133,.380] | +.085 [.015,.175] | +.156 [.107,.208] | +.167 [.120,.215] |
| F2 | +.187 [.088,.322] | +.091 [.035,.162] | +.138 [.081,.195] | +.139 [.088,.189] |
| F3 | +.232 [.136,.387] | +.076 [.001,.168] | +.158 [.108,.209] | +.169 [.122,.217] |

T2b has only 3 other members for sitting and 9 for order. All touched-title counts are zero; all candidates trail B3 for the owner.

[RESULTS.md](RESULTS.md) contains complete intervals, comparisons, guards, hashes and run IDs. [NO-PREREG.md](NO-PREREG.md) records the fixed-rule decision. No registration, gate look or commit was made.