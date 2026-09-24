# Round 2 report: fusion

I couldn't write `results/simplify/fusion/REPORT.md`: the harness refused it ("Subagents should return findings as text"). The full report text is ready if it should be saved somewhere. **Recommendation: pool `fusion-shared`.** It cuts S by 36 (394 → 358), with every split within 0.01 of r6, lower latency and no new calls.

| candidate | dev | dsty | ho | ho2 | ho3 | ho4 | bad5 | unj | own10 | t@1 | p50/p95 ms | S |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| r6 | .836 | .812 | .761 | .728 | .893 | .837 | 40 | 0 | 6/6/6 | 6/7 | 104.8/237.5 | 394 |
| fusion-lite | .839 | .812 | .774 | .738 | .901 | .837 | 37 | 10 | 6/6/6 | 6/7 | 91.6/219.4 | 368 |
| fusion-shared | .841 | .803 | .767 | .745 | .903 | .835 | 39 | 11 | 6/6/6 | 6/7 | 91.2/204.1 | 358 |
| fusion-shared-gen | .842 | .812 | .767 | .745 | .901 | .837 | 39 | 12 | 6/6/6 | 6/7 | 89.2/200.3 | 361 |
| fusion-lean | .833 (c.839) | .794 (c.810) | .759 (c.769) | .752 | .903 | .833 (c.839) | 39 | 20 | 6/6/6 | 6/7 | 89.4/222.7 | 352 |

All from one run (`--reps=3`) under machine load 40–115. An earlier run ranked them the same way.

- **What changes:**
  - **Lite:** two shared candidate depths (500 dense, 300 BM25); bigram weight 1; the main BM25 query uses the body index, so creator/cast weights and the body-only rule go; strict title matching on the whole title only; simpler fuzzy-title and cut rules; the title-word bonus loses its creator and entity rules.
  - **Shared adds:** one weight of 0.1 for all 7 secondary signals, the same weights on the style path, and a discovery list of 50 (top 10 unchanged).
  - **Lean adds:** every BM25 field weight 1, and no title-word bonus.
- **Where S drops:**
  - In my area (59 at r6): lite 37, shared 34, lean 28 (M01 8→7, M02 18→13/9, M03 3→1, M13 3→2, M14 8→2/0, M15 9→3, M19 10→6).
  - In other areas: −11 for shared (M06, M09, M11 −1 each; M17 −1; M10 −2; M18 −5), −8 for shared-gen.
- **Weight fitting (5-fold by query, 95 general and filmography queries):**
  - Hand weights score 0.804. Nine free weights reach 0.809 cross-validated (0.815 in-sample); on the lite base, 0.810 → 0.818.
  - One weight for all secondary signals scores 0.805 cross-validated, about the same as hand-tuned. That is what `fusion-shared` uses.
  - Fitting on condensed NDCG pulls in ungraded titles (plain CV −0.026), so I fitted on plain.
  - `fusion-fitted` is in-sample only (dev .848, ho .788). It doesn't lower S.
- **Complexity script:** proxy 269 (lite, shared) and 272 (lean) against 277 for simp. LOC is 1,449/1,381 against 1,458/1,413. The proxy barely moves because the module keeps every r6 branch behind a switch.
- **Risks:**
  - `fusion-shared` loses −0.009 on dev-style, all from the style-path weight sharing ("miyazaki-like" −0.055).
  - Title-lookup queries lose franchise siblings at rank 2, such as "Code Geass: Rozé of the Recapture" (title@1 unchanged). Keeping that rule pushes bad5 to 41/43 and fails the guardrail.
  - `fusion-lean` misses dev-style on plain NDCG; its 20 unjudged titles need grading first: `evalsimp.py pool <tag> fusion-lean`.
  - Dropping cut folding entirely costs dev-style −0.024, so `fusion-lean-nocuts` is reference only.
- **Pooling:**
  - Weights stay at r6's scale, so other agents' weights combine unchanged.
  - If the style agent rewrites M18, use `fusion-shared-gen`.
  - A new secondary signal should join `SECONDARY` rather than get its own weight.

**Variant names for pooling:** `simp_fusion:FINAL/fusion-shared` (recommended), `simp_fusion:FINAL/fusion-shared-gen`, `simp_fusion:FINAL/fusion-lite`, `simp_fusion:FINAL/fusion-lean`. Reference only: `fusion-lean-nocuts`, `fusion-fitted`.

Files are in `/home/alp/dev/projects/goodwatch/goodwatch-monorepo/.claude/worktrees/search-simplify/docs/prototypes/search-arena`:
- `harness/simp_fusion.py`
- `results/simplify/fusion/fit.py` (fit logs in `fit-*.log`)
- `results/simplify/fusion/score-final.txt`
- `results/simplify/fusion/complexity-fusion-*.txt`
