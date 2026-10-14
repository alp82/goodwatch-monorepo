# Item 005 report

Experimenter: Sol 6.1 (gpt-6.1-sol, high effort) through codex exec, workspace-write. Saved by the orchestrator from its final message.

No candidate qualifies for registration. Loved-title first-50 shares for others were C1 **0.004637**, C2 **0.013579**, and C3 **0.075369**, all below B3’s required **0.089997**. PREREG.md is absent; the reason is recorded in [NO-PREREG.md](../../items/005-fix-the-top/NO-PREREG.md).

Delivered [C1](../../lab/candidates/005/c1_rated.py), [C2](../../lab/candidates/005/c2_clipped.py), [C3](../../lab/candidates/005/c3_average.py), and [tests](../../lab/candidates/005/test_candidates.py). All three tests passed: synthetic T1 C1/B5 Spearman **ρ=1.000**; C2 obeys rated percentile bounds; C3 returns the specified average and C1 score.

Differences below are candidate minus reference, with 95% intervals. T1 measures error (lower better); T2a separation and T2b percentile are higher better. SDE means smallest detectable effect. Owner T1/T2a intervals are franchise checks; T2b intervals resample sittings.

| Candidate/task | ΔB2, others | SDE | ΔB2, owner | ΔB1, others |
|---|---|---|---|---|
| C1/T1 | −.107 [−.192,−.023] | .120 | −.228 [−.281,−.175] | −.120 [−.178,−.060] |
| C1/T2a | +.090 [.048,.130] | .061 | +.233 [.177,.291] | +.139 [.093,.184] |
| C1/T2b sitting | +.271 [.148,.371] | .183 | +.157 [.099,.217] | +.029 [−.033,.144] |
| C1/T2b order | +.112 [.063,.174] | .085 | +.173 [.118,.229] | −.023 [−.067,.044] |
| C2/T1 | −.101 [−.183,−.020] | .116 | −.230 [−.283,−.177] | −.114 [−.173,−.054] |
| C2/T2a | +.089 [.047,.129] | .060 | +.228 [.172,.287] | +.137 [.092,.183] |
| C2/T2b sitting | +.248 [.158,.369] | .177 | +.161 [.103,.220] | +.006 [−.026,.067] |
| C2/T2b order | +.117 [.073,.174] | .079 | +.181 [.127,.236] | −.018 [−.059,.048] |
| C3/T1 | −.107 [−.192,−.023] | .120 | −.228 [−.281,−.175] | −.120 [−.178,−.060] |
| C3/T2a | +.049 [.012,.083] | .052 | +.232 [.180,.286] | +.098 [.051,.145] |
| C3/T2b sitting | +.291 [.183,.400] | .175 | +.200 [.148,.252] | +.050 [.001,.144] |
| C3/T2b order | +.138 [.078,.211] | .101 | +.208 [.161,.255] | +.003 [−.062,.078] |

| T2a separation vs B5 | Others | Owner, franchise check |
|---|---|---|
| C1 | −.043 [−.065,−.021] | +.003 [−.014,.020] |
| C2 | −.044 [−.067,−.022] | −.002 [−.020,.017] |
| C3 | −.084 [−.112,−.055] | +.001 [−.030,.031] |

| T2a first-50 guards | Loved share | Disliked share | Shows | Animation | Max franchise | Votes |
|---|---|---|---|---|---|---|
| C1 others | .005 [.002,.008] | .002 [.000,.005] | .123 [.098,.149] | .209 [.165,.255] | 2.20 [2.01,2.40] | 9,855 [5,219,18,040] |
| C1 owner | .002 | .000 | .039 | .195 | 3.86 | 4,275 |
| C2 others | .014 [.007,.021] | .002 [.000,.005] | .258 [.219,.299] | .248 [.194,.305] | 1.91 [1.74,2.09] | 16,164 [10,744,24,327] |
| C2 owner | .010 | .000 | .159 | .204 | 1.00 | 10,637 |
| C3 others | .075 [.058,.094] | .008 [.001,.018] | .304 [.264,.343] | .454 [.390,.515] | 2.15 [1.93,2.37] | 58,387 [45,792,72,079] |
| C3 owner | .045 | .000 | .446 | .429 | 1.00 | 22,798 |

| T2b first-50 guards, others / owner | Target share | Shows | Animation | Max franchise | Votes |
|---|---|---|---|---|---|
| C1 sitting | 0 / 0 | .327 / .180 | .260 / .180 | 2.00 / 2.00 | 14,936 / 11,946 |
| C1 order | 0 / 0 | .276 / .440 | .269 / .160 | 1.78 / 1.00 | 8,843 / 11,574 |
| C2 sitting | 0 / 0 | .313 / .260 | .347 / .180 | 2.67 / 1.00 | 128,442 / 11,419 |
| C2 order | 0 / 0 | .209 / .120 | .287 / .120 | 1.89 / 1.00 | 56,412 / 18,168 |
| C3 sitting | .0101 / .0375 | .333 / .480 | .393 / .420 | 1.33 / 1.00 | 17,786 / 29,948 |
| C3 order | .0026 / .0230 | .329 / .540 | .289 / .420 | 1.78 / 1.00 | 36,016 / 29,948 |

All T2b touched-title counts were zero. T2b has only 3 other members for sitting and 9 for order. T1 compares candidate scores with calibrated B2.

C3 improves loved-title first-50 share over B2 by +.056 [.041,.072], but increases animation by +.252 [.204,.300] and franchise repeats by +.672 [.465,.881]. All three lose B5’s separation for others.

**12 explore runs completed, all `ok`; none failed outright.** [RESULTS.md](../../items/005-fix-the-top/RESULTS.md) contains absolute metrics, complete guard intervals, comparisons, hashes, and all run IDs. The [ledger](../../ledger.jsonl) only grew. Candidates stayed fixed; no registered runs, gate looks, or commits were made.