# Round 2 report: reference

I couldn't write `results/simplify/reference/REPORT.md`: the harness refused it ("Subagents should return findings as text"), so the compact report is below. None of the three variants passes the plain NDCG rule yet. All three fail on ho3 and ho4, where the new top-10 titles are mostly ungraded; every split's condensed NDCG is within 0.005 of r6 or better. The raw table is in `final.txt`, `run2.txt`..`run7.txt`, `complexity-*.json` and `iter/`, all in `results/simplify/reference/`.

**Mechanism** (`harness/simp_ref.py`, entity detection unchanged): a "like X" title, a person and a studio all become one reference, a set of weighted titles.
- **Resolve:** one residual-query function (`residual`) serves all three. The title detector works on word tokens and word lists instead of 8 regexes.
- **Profile:** fingerprint and embedding centroids plus a term profile of the seed titles; mentions and peers are optional.
- **Rank:** one function (`rank_query`) replaces the general, filmography and style paths. It adds the profile (strength 0.15 for like/filmography, 1 for style/both) and a boost scaled by title weight (4 filmography, 1 otherwise). The intent only picks numbers, not code.
- **Own titles:** one step after the blend (`bound_own`) holds per-intent min/max own titles in the top 10. It replaces the own-title slots, the "both" head, fold-before-slots, the post-blend cap and franchise exclusion.
- **Human calibration:** a "like X" title may appear once, never at #1, and not at all when the query modifies it ("like X but Y"). Groundhog Day and Amélie now sit at #2.
- **Fincher:** the boost now scales with credit weight, and own titles are pulled up only from the discovery list. Love, Death & Robots and Voir drop out (sty-06 0.730→0.782), but Disenchantment is lost on sty-07 (−0.101, graded).
- **Early/late career:** now uses the existing old/recent era prior. It depends on M08b, so if another builder drops that prior this breaks.

**Variants** (area S was 109):

| variant | area S (ΔS) | dev | ho | ho2 | ho3 | ho4 | dsty |
|---|---|---|---|---|---|---|---|
| r6 | 109 | 0.836 | 0.761 | 0.728 | 0.893 | 0.837 | 0.812 |
| `ref-merge`: all profile signals, "both" kept | 77 (−32) | .829 (c.838 u7) | .756 | .733 (c.738) | .866 (c.892 u7) | .820 (c.841 u6) | .820 |
| `ref-slim`: no mentions, no agreement | 70 (−39) | .830 | .758 | .732 | .860 (c.892) | .803 (c.848 u10) | .831 |
| `ref-lean`: fp, emb, terms only; own-title seeds; "both" treated as style | 53 (−56) | .825 (c.834) | .758 | .725 (c.739) | .860 (c.890) | .809 (c.888 u19) | .784 (c.809) |

- **Other checks:** all three variants score the same:
  - bad5 38 (r6 40);
  - own10 6.00/6.00/5.78, inside 3-6;
  - title@1 6/7, unchanged;
  - no new paid calls.
- **Latency:** every variant is below r6 on p50 and p95 in the same run: 144–149 ms p50 against 156, 271–277 ms p95 against 295. The machine was heavily loaded; in a lighter run it was 51 against 53 ms p50.
- **S accounting:** my area is 77 / 70 / 53 against 109. Two more points go outside it (M09 facets rule, M19 fold-before-slots), so the whole ranker is about 360 / 353 / 336. The complexity proxy falls from 277 to 252 / 251 / 242, and LOC from 1458 to 1331 / 1329 / 1276.
- **Why ho3/ho4 fall:** the new top-10 titles are mostly ungraded. They are correct own titles at #9–10 (Sully, Heretic, Luca, Arrietty) and Duel and The Sugarland Express on "early spielberg". I did not tune toward graded titles; these need a grading pool before any verdict.
- **Graded losses that remain:**
  - sty-07 (Groening) −0.101;
  - new-07 (Matrix anime) −0.070;
  - new-08 (Breaking Bad comedy) −0.126, a reorder;
  - `ref-lean` only: peers mattered on style queries ("edgar wright" −0.151, "aardman humor" −0.091).

**Recommendation:** take `ref-merge` now and pool `ref-merge` and `ref-lean` for grading. Adopt `ref-lean` (−56) only if grading closes its style gap. A cleaner fix for both the Fincher and Groening cases is to give lower weight to creator credits whose source isn't "creator". That rule belongs to entity detection (M16), which is the other builder's area.

**Variant names for pooling:** `ref-merge`, `ref-slim`, `ref-lean` (spec `simp_ref:FINAL`). I moved my intermediate lists and scores out of the shared `results/simplify/lists/` and `scores/` into `results/simplify/reference/iter/`; only the three final variants are left there.
