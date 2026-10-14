# Review of item 003 by Sol 6.1 (gpt-6.1-sol, high effort, read-only), October 14, 2026

**Verdict: sound after fixes.**

Evidence below refers to **commit `8f7dc226`**, not the newer working files. Paths are relative to `docs/research/taste-loop/`.

1. **Blocking — Decision 4 leaks which candidates cannot be hidden.**  
   **Evidence:** `lab/views.py:450–455` removes hidden titles from Want to See, Skip and Not interested, while retaining unrated titles from those lists as targets. A listed candidate is therefore certainly not hidden, as `items/003-hidden-title/REPORT.md:80–81` acknowledges. This narrows the hidden set; it does not reveal every hidden title or its rating. B2/B3 also use Want to See fingerprints, so these ordinary candidates can help build the taste that ranks them (`lab/ladder/b2_taste_today.py:60–88`).  
   **Fix:** Exclude visible side-list titles from targets and comparison candidates, document the changed candidate set, and rerun. Extend the canary: it currently changes ranks only after recovering actual ratings (`lab/controls/predictors/leak_canary.py:193–198`), so its pass does not cover this shortcut.

2. **Blocking — D1’s “win” wording overlooks guards that fail.**  
   **Evidence:** `PLAN.md:224–226` requires no significantly worse guard. D1 calls B3 a “win at the top” and B5 a “win at ordering the whole list” (`DECISIONS.md:16–18`). But:
   - B3 increases disliked-title first-50 share by **0.02355 [0.00770, 0.04288]**, and first-200 share by **0.06400 [0.03595, 0.09762]** (`ledger.jsonl:97`). These paired comparisons are missing from the displayed table.
   - Franchise repeats increase for B3 by **0.510 [0.355, 0.666]** and B5 by **0.820 [0.552, 1.083]** (`items/003-hidden-title/ladder-T2a.md:79–81`).
   - B5 further reduces the already underrepresented show share (`items/003-hidden-title/ladder-T2a.md:73,81`).  
   **Fix:** Call these exploratory gains on particular measures, explicitly state that both fail the full win rule, and display the paired low-rating guards. Keeping today’s scorer is supported. Formal “null” wording also needs care: the plan defines it after a registered run, while these runs are exploratory (`PLAN.md:230`; `DECISIONS.md:4–5`).

3. **Should fix — The shuffled control can pass a meaningful bias.**  
   **Evidence:** `lab/controls/shuffled.py:40–56` passes whenever the two-sided p-value is at least 0.001. A synthetic figure of **0.03**, standard error **0.01**, over 26 members gives approximately **p = 0.006**, so passes despite reaching the win floor. The report itself passes owner B5 at **+0.053, p = 0.14** (`items/003-hidden-title/REPORT.md:65`). Accounting for 24 tests reduces false alarms; it does not establish negligible bias.  
   **Fix:** Set a tolerable residual bias beforehand and require uncertainty bounds to fit within it. Otherwise report “inconclusive.” Use additional independent shuffles to measure sensitivity.

4. **Should fix — Separation and public-score matching do not remove popularity bias.**  
   **Evidence:** `DECISIONS.md:49–51` says they remove it. Yet nonpersonal BP has separation **0.020 [0.005, 0.040]**, including **0.013 [0.001, 0.028]** after matching. B1 retains matched separation **0.043 [0.023, 0.062]** (`items/003-hidden-title/ladder-T2a.md:22,56,61`). A ±3-point window still allows public-quality differences and does not match vote counts.  
   **Fix:** Say these measures reduce particular confounds. Beating the baselines is evidence beyond those baselines, not proof that the remaining signal is entirely personal.

5. **Should fix — The owner bypasses the five-title band minimum.**  
   **Evidence:** Others correctly require five finite observations per band (`lab/score.py:454–470`). The owner instead calls cluster statistics directly (`lab/score.py:548–555`), whose separation check requires only one high and one low title (`lab/stats.py:113–114`). That contradicts `PROTOCOL.md:243–245`. The current owner has 94 low titles, so this does not change the present plain figures (`items/003-hidden-title/ladder-T2a.md:96`).  
   **Fix:** Apply the same minimum to owner band figures, separations and paired comparisons, including matched figures.

6. **Should fix — Folds can penalize learned rungs differently from public baselines.**  
   **Evidence:** SHA order is label-independent and the folds are shared across rungs (`lab/views.py:417–427`), but hiding several titles is not equivalent to hiding one, despite `PLAN.md:103–106`. With six usable liked titles, a fold hiding two leaves four: B2/B3 return no taste below five (`lab/ladder/b2_taste_today.py:89–90,125–127`). Leaving one out would preserve taste. Vote ordering and public-score ordering avoid that threshold. Sparse members lose roughly a fifth of their history; the owner loses roughly 2%.  
   **Fix:** Describe this as a fold test and check smaller-fold sensitivity before treating differences as leave-one-out results. Also correct “at most a fifth”: 21 titles produce a five-title fold, or 23.8% (`lab/views.py:422–426`).

7. **Note — The main metric arithmetic matches the protocol.**  
   **Evidence:** `lab/score.py:375–395` excludes all hidden titles from the comparator, counts ties as halves, and uses inclusive ±3-point public-score bounds. `lab/score.py:468–470` uses fewer than 50/200 effective candidates above the title and computes high-minus-low separation. These match `PROTOCOL.md:236–252`; there is no off-by-one under that stated convention.  
   **Fix:** Keep these formulas. Explain that first-50 membership uses the tie’s middle position; it is not fractional credit across tied list positions.

8. **Note — Paired intervals and franchise resampling are correctly formed.**  
   **Evidence:** Member intervals bootstrap per-member candidate-minus-reference differences (`lab/stats.py:49–65`). Owner comparisons first subtract per title, then resample whole franchises, preserving pairing and recalculating each band mean (`lab/score.py:565–567`; `lab/stats.py:115–129`). The sitting interval is correctly withheld for the dominant sitting (`items/003-hidden-title/ladder-T2a.md:96–105`).  
   **Fix:** Preserve the distinction: franchise ranges are a conditional robustness check, not a substitute for uncertainty about future owner ratings (`PROTOCOL.md:418–421`).

9. **Note — No further direct hidden-title marker was found in the inspected routes.**  
   **Evidence:** Other-member ratings and side rows exclude the predicted member (`lab/views.py:281–297`); title export omits `touched` (`lab/views.py:77–90`); targets are shuffled (`lab/views.py:453–455`). Original rating positions reveal missing slots, but provide no mapping from those slots to candidate titles. Other members’ ratings of a target are legitimate inputs under the protocol (`PROTOCOL.md:230–231`).  
   **Fix:** Narrow the assurance to the routes actually checked, and test candidate-membership shortcuts explicitly before claiming hidden status is indistinguishable.