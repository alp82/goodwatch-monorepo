# Review of item 004 by Astra (gpt-6-astra, high effort, read-only), October 14, 2026

**Verdict: sound after fixes.**

Reviewed `3192bc33 → 5fa08c07`, read-only. No lab runs, controls or tests executed; gate directory untouched. Paths below are relative to `docs/research/taste-loop/`.

1. **Should fix — Resume identity is sound between runs, but source can change during a run.**  
   The cache key covers view, title, harness and answer digests; predictor bytes determine its filename ([run.py:750](../../lab/run.py:750)). Complete and partial caches check that identity, and completed candidate caches are discarded ([run.py:342](../../lab/run.py:342), [run.py:763](../../lab/run.py:763)). Changed options, packs or predictor bytes therefore cannot ordinarily reuse incompatible results.  
   However, the predictor is hashed once, then each batch reopens its live path ([run.py:332](../../lab/run.py:332), [sandbox.py:474](../../lab/sandbox.py:474)). An edit between batches can mix versions under the original hash and contaminate a later resume. There is no evidence this happened here.  
   **Fix:** execute a frozen, hash-checked source copy and keep harness code fixed throughout the run.

2. **Should fix — Matching is calculated correctly, but “both” changes the population being measured.**  
   The inclusive log-vote window uses factor **1.5**; “both” uses **±3 score points, factor 2, and at least 50 candidates**, with ties counting half ([score.py:403](../../lab/score.py:403)). This matches [PROTOCOL.md:268](../../PROTOCOL.md:268).  
   Dropping targets also triggers the five-title band minimum: T2a loses **1,506/4,788** other-member titles and separation falls from **26 to 20 members** ([ledger.jsonl:255](../../ledger.jsonl:255)). Selection is independent of the rung’s ranks, so paired comparisons remain fair on retained data. But the result describes titles with dense matching neighborhoods; it need not generalize to excluded titles.  
   **Fix:** show retained counts by band and member, including T2b’s omitted `both_under_min` counts. Compare plain, popularity-only and “both” results on the same retained sample before attributing changes solely to matching.

3. **Should fix — D1 overstates what popularity matching establishes.**  
   “B5’s separation is not popularity” is stronger than the evidence ([DECISIONS.md:49](../../DECISIONS.md:49)). Vote count alone still has popularity-matched separation **0.035 [0.019, 0.051]** ([ladder-T2a.md:85](../../items/004-want-to-see/ladder-T2a.md:85)). Finite matching bands reduce confounding; they do not remove it. The generated table repeats the same overclaim ([table.py:344](../../lab/table.py:344)).  
   B3’s **+0.035** concerns loved-title **mean percentile**, not popularity-matched first-50 performance. Its “both” separation interval crossing zero is inconclusive, not evidence the advantage disappeared.  
   **Fix:** say the gains survive these particular adjustments, name the metric, and retain the selection caveat from finding 2.

4. **Should fix — Present the owner’s T2b result as a point-estimate lead.**  
   B3 does have the highest raw percentile among taste scorers: **0.798**, versus B2 **0.602** and B1 **0.767** ([ladder-T2b.md:37](../../items/004-want-to-see/ladder-T2b.md:37)). But its paired advantage over B1 is **+0.031 [−0.017, +0.075]** over sittings; popularity-matched, **+0.027 [−0.027, +0.077]** ([ledger.jsonl:229](../../ledger.jsonl:229)).  
   **Fix:** qualify “highest” as the point estimate. Replace “keeps most” with “the gain over B2 falls from **0.196 to 0.110**.” Preserve the disclosed worsening on later skips. Label BP’s **+0.284** explicitly as the entry-order result: B1 has the highest primary sitting-split estimate.

5. **Should fix — D1’s control interpretation and summary table need updating.**  
   “No figure lies outside” ±0.015 is inaccurate for point estimates: the report gives **−0.021, +0.067 and −0.074** ([REPORT.md:55](../../items/004-want-to-see/REPORT.md:55)). No interval lies **wholly** outside. Inconclusive controls also do not establish D1’s blanket **0.02** readability threshold ([DECISIONS.md:57](../../DECISIONS.md:57)).  
   The main table retains old figures: B3 median votes **142,136** instead of **120,513**, and BP disliked-title first-50 share **0.264** instead of **0.314** ([DECISIONS.md:16](../../DECISIONS.md:16), [ladder-T2a.md:59](../../items/004-want-to-see/ladder-T2a.md:59), [ladder-T2a.md:108](../../items/004-want-to-see/ladder-T2a.md:108)).  
   **Fix:** refresh the table, correct the interval wording, and use each comparison’s uncertainty and detectable effect. Keeping today’s scorer remains supported.

6. **Note — T2b’s cutoff and candidate exclusions are correct for the recorded interaction tables.**  
   Member ratings require both creation and update before cutoff; side rows require creation before cutoff ([views.py:630](../../lab/views.py:630)). With `--others before`, the same rules apply to other members ([views.py:296](../../lab/views.py:296)). No inspected route passes a later interaction row.  
   Previously rated, added, skipped or Not interested titles are removed from both selected targets and candidates ([views.py:617](../../lab/views.py:617)). All targets are excluded from comparison sets through the shared scorer ([score.py:388](../../lab/score.py:388), [score.py:653](../../lab/score.py:653)).  
   **Fix:** none needed. Describe this as “untouched before cutoff”; it does not prove never watched, since watch tables are deliberately excluded.

7. **Note — The side-list fix and extended canary are real tests of the shortcut.**  
   Listed candidates are excluded before computing percentiles, matched figures and first-50 guards ([score.py:393](../../lab/score.py:393)). The canary explicitly ranks listed titles at zero and unlisted titles at 0.5 ([leak_canary.py:216](../../lab/controls/predictors/leak_canary.py:216)); the control requires every hidden percentile to remain exactly 0.5 ([leak.py:37](../../lab/controls/leak.py:37)).  
   **Fix:** preserve this check and its old-rule comparison. It tests this shortcut, not every possible leak.

8. **Note — The shuffled rule and owner minimum were implemented correctly.**  
   Three seeds and interval containment within **±0.015** are explicit ([shuffled.py:45](../../lab/controls/shuffled.py:45)). Owner band means, separations and paired matched differences require five finite titles ([score.py:600](../../lab/score.py:600), [stats.py:110](../../lab/stats.py:110)).  
   **Fix:** retain these implementations and the **inconclusive** control verdicts.

9. **Should fix — The fold check is implemented, but its displayed comparison mixes cohorts.**  
   It selects nonowners below 60 ratings and caps folds at five, as specified ([views.py:507](../../lab/views.py:507)). However, the table compares its **10** separation-eligible members with the main result over **26** ([ladder-T2a.md:39](../../items/004-want-to-see/ladder-T2a.md:39)). The report supplies the better comparison on the same ten members ([REPORT.md:60](../../items/004-want-to-see/REPORT.md:60)).  
   **Fix:** put that same-member comparison in the table. Keep calling this a fold sensitivity check; it does not establish equivalence to hiding one title.