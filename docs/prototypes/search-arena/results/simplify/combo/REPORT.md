# Round 3 report: combined module

The combined module `harness/simp_combo.py` is built and scored. The recommended variant, `combo`, gets S down from 394 to 198, under the 236 target. Before grading it still fails two criteria: holdout4 is −0.032 on plain ndcg10, and dev-sty `own10` is 6.25. The holdout4 loss comes mostly from ungraded titles; its condensed score is +0.050 over r6. Everything below comes from one `evalsimp.py score simp_combo:FINAL` run with r6 in the same run.

## What's in simp_combo.py
The module has 1,229 lines against 1,592 for simp.py, and one ranking function for all queries. Each area's change is ported on top of simp.py; r6's replaced code is deleted, not left behind switches.

- **Entity:** one name index and ambiguity test for people and studios. Two credit classes (main credit or other). Intent comes from the nearest example phrase.
- **Reference:** a "like X" title, a person and a studio are one reference. Own titles are bounded in the top 10 after the blend. "Own" now simply means a main credit, so the `own_w` threshold and ref's `seeds` switch are gone.
- **Text:** marker-word negation, a decade/year filter only, facets and coverage from Jev's `searchedPhrases`, one-edit spell correction.
- **Fusion:** one shared weight of 0.1 for every secondary signal, two candidate depths, main BM25 on the body fields, strict title match on the whole title, the simpler fuzzy-title and cut rules. The discovery list is 50 long: 50 and 100 gave identical metrics, so that switch is gone.
- **Round-1 safe drops:** all removed (fold-before-slots, era recent/old prior, "both" head, "less X", `ref_facet`, `ref_mix`, the agreement term, body-only BM25). Cut folding stays in fusion's simpler form.

**Early/late career conflict (text vs ref):** I cut the dependency on the era prior. `combo-safe` keeps early/late as its own small rule (`career_w` · z(year)), and the other variants drop it. The cost is dev −0.001; "early spielberg" goes from 0.801 to 0.722.

**Interaction choices, each tested:**
- Facets stay on person and studio queries (no extra rule; holdout4 +0.014).
- Name mentions are kept in `combo`: holdout3 0.880 → 0.892, holdout4 +0.007, bad5 −1.
- The agreement term is dropped (it cost holdout3 and holdout4).
- Tried and rejected: only counting real creator credits (not fallbacks) as main (holdout4 −0.037), own boost 0.5, a separate coverage weight of 0.3 (holdout2 −0.011).

**Switches that remain** only select between the four variants: `secondary` as one number or a dict, `facet_min_n`, `w_mention`, `w_agree`, `w_peer`, `career_w`, `style_suffix`, `collocations`, `kind`, `body`, `bounds`. Once one variant is picked, they collapse to constants.

## Scores
Each cell is ndcg10 plain, then condensed and unjudged titles in brackets, then the change against r6. Grades are `grades.json` only.

| | dev | dsty | ho | ho2 | ho3 | ho4 | bad5 | unj | own10 dsty/h3sty/ho4 | title@1 | p50/p95 ms, run 1 (reps 3) | p50/p95 ms, run 2 (reps 5) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| r6 | .836 | .812 | .761 | .728 | .893 | .837 | 40 | 0 | 6.00/6.00/6.00 | 6/7 | 44.2/114.0 | 44.0/116.8 |
| combo-safe | .833 (c.847 u12) −.003 | .821 | .764 (c.766) +.003 | .747 (c.760) +.019 | .887 (c.918) −.006 | .800 (c.886 u21) **−.037** | 31 | 58 | **6.25**/6.00/5.33 | 6/7 | 39.7/84.5 | 40.9/83.3 |
| **combo** | .831 (c.843 u10) −.005 | .814 | .763 (c.774) +.002 | .754 (c.777) +.026 | .892 (c.922) −.001 | .805 (c.887 u22) **−.032** | 32 | 64 | **6.25**/6.00/5.33 | 6/7 | 44.1/90.4 | 43.6/84.2 |
| combo-lean | .824 (c.840) **−.012** | .748 (c.778) | .759 (c.772) −.002 | .755 +.027 | .861 (c.905) **−.032** | .782 (c.883) **−.055** | 35 | 76 | 6/6/5.33 | 6/7 | **45.3**/88.1 | **47.2**/87.6 |
| combo-lean-peers | .827 (c.844) −.009 | .791 (c.813) | .759 −.002 | .752 +.024 | .864 (c.902) **−.029** | .777 (c.887) **−.060** | 34 | 80 | 6/6/5.33 | 6/7 | **47.2**/91.8 | **45.5**/83.2 |

- **With the re-grade overlay** (`--overlay`, 472 pairs; the graders were still writing it at 23:28): r6 scores dev .801, ho .729, bad5 51. `combo` scores dev .793, ho .733, ho2 .759, ho3 .892, ho4 .805, bad5 44. The splits hold the same way.
- **own10 6.25 on dev-sty** is a definition mismatch. The metric uses r6's credit weights. On "tarantino vibes", Sin City (graded 3, Tarantino only a guest director) counts as own under the metric but not under the combo's main-credit rule. Under the combo's own definition every style query stays within 3–6.
- **Latency:** `combo` ties r6 on p50 (−0.1 and −0.4 ms under load averages of 4 to 37) and is 20–30 ms lower on p95. `combo-safe` is 3–4 ms faster, because it computes fewer facet embeddings and no mentions. The lean variants are 1–3 ms above r6 on p50 in both runs.
- No new paid calls. Intent needs one extra local me5s encode per person or studio query (about 7 ms, not visible in the cached benchmark).

## Simplicity score by mechanism (r6 → safe / combo / lean / lean-peers)

| ID | r6 | safe | combo | lean | lean-peers | what's left |
|---|---|---|---|---|---|---|
| M01 pool + fusion | 8 | 12 | 7 | 7 | 7 | emb, a, b, k_main, one secondary weight (safe: 6 separate weights) |
| M02 BM25 | 18 | 14 | 14 | 10 | 10 | k_part; K1, B, 4 field weights (lean: all 1), token length |
| M03 prior | 3 | 1 | 1 | 1 | 1 | missing score → mean |
| M04 spell | 11 | 7 | 7 | 7 | 7 | |
| M05 non-English | 18 | 13 | 13 | 13 | 13 | |
| M06 negation | 16 | 6 | 6 | 6 | 6 | 2 word lists, 4 rules |
| M07 "less X" | 4 | 0 | 0 | 0 | 0 | merged into negation |
| M08 era | 19 | 3 | 3 | 3 | 3 | 1 regex, filter + fallback |
| M09 facets | 16 | 6 | 5 | 5 | 5 | |
| M10 coverage | 19 | 15 | 15 | 13 | 13 | |
| M11 "like X" | 28 | 14 | 14 | 14 | 14 | word-list detection, franchise, whole-query dense |
| M12 production blend | 19 | 19 | 19 | 19 | 19 | untouched (production parity) |
| M13 strict title | 3 | 2 | 2 | 2 | 2 | |
| M14 title-word bonus | 8 | 2 | 2 | 0 | 0 | |
| M15 fuzzy title | 9 | 3 | 3 | 3 | 3 | |
| M16 entity detection | 104 | 35 | 30 | 30 | 30 | 7 config values, intent model, 21 rules, 1 regex (safe: + suffix stems 3, era words 2) |
| M17 filmography | 19 | 7 | 5 | 5 | 5 | lead_boost, residual rules (safe: + career 2) |
| M18 style/profile | 62 | 47 | 45 | 29 | 40 | 19 config values, 5 literals, 20 rules, 1 path (lean: −mentions 3, −peers 11, both = style −2) |
| M19 cuts | 10 | 7 | 7 | 7 | 7 | |
| **S** | **394** | **213** | **198** | **174** | **185** | target ≤ 236 |

- `combo` breaks down as 39 config tunables, 35 magic numbers, 116 rules, 5 regexes and 3 query-type paths (general, non-English, reference). Intent now only picks numbers, not code.
- `complexity.py` proxy / lines in entered functions: safe 125 / 982, combo 124 / 981, lean 116 / 926, lean-peers 121 / 959. For comparison, simp is 277 / 1,458 and r6 is 306 / 1,752. Regex sites are 5–6, against 35 in r6.

## Graded losses left in `combo`
These are queries where the condensed score also drops, so the loss is on graded titles. Each is listed with the area it comes from.
- **Text:** "animated movie that is not for kids" −0.193 (a single facet phrase; `combo-safe` fixes it); "An ordinary guy…" −0.073; "Ich suche etwas Spannendes…" −0.064; "I want something tense…" −0.053; "Kafam çok yorgun…" −0.039; "good first anime…" −0.044; "like david lynch but less weird" −0.038.
- **Fusion (coverage weight 0.3 → 0.1):** "a hopeful space adventure without horror" −0.141, "fantasy with dragons" −0.080, "western with samurai" −0.051. `combo-safe` fixes all three. "Brain's fried…" −0.128 is in both.
- **Reference:** "like The Matrix but anime" −0.083, "like Breaking Bad but a comedy" −0.082, "tom hanks war movies" −0.069.
- **Entity credit classes:** "something darren aronofsky would direct" −0.146. r6 filled all 10 slots with Aronofsky's own films; the combo holds 6 and adds 4 similar films by others, which is the mix the style rubric asks for. Also "early spielberg" −0.174 (career rule dropped), "denis villeneuve atmosphere" −0.036.

The big plain holdout4 losses have high condensed scores and are driven by ungraded titles: "blumhouse-type horror" (Paranormal Activity 2, Sinister 2) and "jackie chan style stunts" (Police Story 3). The combined mechanism also fixed r6's Groening loss: "cartoons with matt groening humor" went from 0.542 to 0.781. Keeping peers matters for the lean variants: "edgar wright" 0.784 → 0.889 with peers, and dev-sty 0.748 → 0.791.

## Recommendation
Take `combo` (S 198) as the round-3 candidate and pool it together with `combo-safe` (S 213). Both pass dev, holdout, holdout2, holdout3, bad5, title@1 and cost. Both miss holdout4 on plain ndcg10 because of 21–22 unjudged titles in the top 10 while their condensed scores are well above r6, and both show 6.25 on dev-sty `own10` from the metric mismatch above.

`combo-safe` has fewer graded losses and a clear latency margin. If grading leaves holdout4 short for both, the next step is `combo` with `combo-safe`'s coverage weight 0.3 and facets from 2 phrases (about +2 S). `combo-lean` and `combo-lean-peers` fail holdout3 even condensed (on style queries), and their p50 is at or above r6. Pool them only as references; don't pick either.

Before any verdict, the ungraded titles in the top 10 of these variants need grading (`evalsimp.py pool <tag> combo combo-safe`).

**Variant names for pooling** (spec `simp_combo:FINAL`): `combo-safe`, `combo`, `combo-lean`, `combo-lean-peers`.

## Files
Nothing was committed. The shared `lists/` and `scores/` folders only hold the four final variants plus r6 (re-saved, unchanged).
- The module: `harness/simp_combo.py`
- The final variants' lists and scores: `results/simplify/lists/combo*.json` and `results/simplify/scores/combo*.json`
- Everything else is in `results/simplify/combo/`:
  - `final-score.txt`, `final-score-reps5.txt`, `final-score-overlay.txt`: the three scoring runs
  - `explore1.txt`, `explore2.txt`, `explore3.txt`: exploration runs; their lists and scores are in `iter/`
  - `complexity-combo*.txt` and `.json`: `complexity.py` output per variant
  - `matrix.py`: per-query comparison of saved lists across variants
  - `intent-emb-cache.json`: local intent-phrase embeddings, seeded from the entity builder's cache
