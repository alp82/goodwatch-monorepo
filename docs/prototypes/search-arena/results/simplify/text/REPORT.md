# Round 2 report: text

Final variants for pooling: **text-safe, text-cons, text-agg** (`simp_text:FINAL`). All three stay within 0.01 of r6 on every split and are faster, and text-cons cuts this area's score from 103 to 51. REPORT.md was not written: the harness refused to let a subagent create a report file, so the findings are below.

**Changes shared by all three, in `harness/simp_text.py`:**
- **Spell:** one edit (a transposition counts as one), using the shared word tokenizer.
- **Negation:** one marker-word list plus one clause-end list, no regexes. "than", "less" and "fewer" are markers with the single `neg` weight, so "less X" no longer has its own mechanism.
- **Era:** one regex for a decade or an exact year, used as a filter only. The recent/old prior is gone.
- **Facets and coverage:** both use Jev's `searchedPhrases`, with no probability floor or caps. The facet term is the mean only, facets share the coverage candidate count, and the filmography path has no facets.
- **Non-English:** coverage and reference detection are no longer skipped (no list changed), and chip prefixes are stripped without regexes.

The three differ only here: text-safe needs 2 or more facet phrases, text-cons fires from 1, and text-agg is text-cons without collocation merging.

**Scores vs r6 in the same run** (ndcg10, plain / condensed):

| variant | dev | dsty | ho | ho2 | ho3, ho4 | bad5 (r6 40) | unjudged | p50 / p95 ms (r6 48.5 / 116.3) |
|---|---|---|---|---|---|---|---|---|
| text-safe | −0.005 / +0.002 | −0.006 | −0.007 / −0.002 | +0.021 / +0.022 | 0 | 37 | 15 | 39.3 / 95.5 |
| text-cons | −0.003 / +0.003 | −0.006 | −0.006 / +0.007 | +0.015 / +0.024 | 0 | 36 | 23 | 42.4 / 92.5 |
| text-agg | −0.005 / +0.003 | −0.006 | −0.010 / +0.005 | +0.015 / +0.024 | 0 | 36 | 27 | 44.7 / 91.1 |

- title@1 stays 6/7 and own10 stays 6.00 on every style group. No new paid calls: the new inputs are fields of the Jev reading already in ctx.
- The dsty loss is one graded query: "like david lynch but less weird" now uses weight 0.1 instead of 0.3.
- The ho plain loss comes mostly from ungraded titles, such as *Saltburn* and *Curb Your Enthusiasm* for "rich people being awful". Condensed ho is above r6 for text-cons, so it may recover after grading; I did not tune toward it.
- The biggest graded ho2 gains are "war film about snipers" (+0.225) and "comedy set in a prison" (+0.075). "slow burn space horror" in dev gains +0.273.

**Score S by mechanism (before → safe / cons / agg):**

| mechanism | before | safe | cons | agg |
|---|---|---|---|---|
| M04 spell | 11 | 7 | 7 | 7 |
| M05 non-English | 18 | 13 | 13 | 13 |
| M06 negation | 16 | 7 | 7 | 7 |
| M07 "less X" | 4 | 0 | 0 | 0 |
| M08 era | 19 | 3 | 3 | 3 |
| M09 facets | 16 | 6 | 4 | 4 |
| M10 coverage | 19 | 17 | 17 | 14 |
| **area total** | **103** | **53** | **51** | **48** |

On the whole ranker that is S 344 / 342 / 339 against r6's 394. This area alone cannot reach the 236 target; it has to be combined with the other areas. The complexity proxy is 277 for flat r6 (simp.py) against 251 / 251 / 250. Regex sites drop from 35 to 21, and function lines from 1,458 to 1,368 / 1,368 / 1,359.

**Tried and rejected:**
- Language from production's flag only: ho −0.033. The flag misses one German and one French query, so the fix belongs in production's language step.
- Jev's avoid chips as a penalty for every language (hypothesis 3): ho −0.018. Their avoid dimensions already reach the fingerprint score.
- BM25 for non-English queries: dev −0.015.
- Coverage over Jev's concrete words, or facets folded into coverage: plain ho −0.016 to −0.050 with 32 to 58 unjudged titles. Results got too literal ("western with samurai" returned only samurai films).
- Dropping the generic-word list, dropping the coverage length gate, or allowing coverage from one unit: each lost 0.012 to 0.022 plain on dev or ho.

**Still open:** "space opera without aliens" moved only from 0.080 to 0.087. "deth" is still uncorrected: it appears 3 times in the vocabulary so it counts as known, and "depth" would beat "death" on frequency anyway.

**Recommendation:** take text-cons. text-safe is the fallback if grading goes against one-phrase facets. Take text-agg only if grading confirms its condensed ho, since it sits exactly at the ho limit.

Files are in `results/simplify/text/`:
- `build_clean.py` rebuilds `harness/simp_text.py` from `simp.py`.
- `simp_text_explore.py` is the exploration module with every switch, including the r6 behaviour.
- `final-score.txt`, `explore-table.md` and `compare-r6-text-*.txt` hold the score table, the exploration rows and the per-query diffs.
- `complexity-*.json` are the complexity outputs.

Lists are in `results/simplify/lists/text-*.json`.
