# Round 2 report: entity

REPORT.md was not written: the tool refuses report files from subagents, and I did not route around that. What follows is the compact version. The full numbers are in the files listed at the end.

**Result:** `entity-resolver` (S 394→315, ΔS −79) keeps dev and ho equal to r6 and is within 0.01 on ho2 and ho3, but fails the rule on ho4 before grading (−0.037 plain, +0.037 condensed, 16 unjudged). I recommend `entity-lean` (ΔS −90, S 304) if grading confirms. This is one run, `--reps=3`, interleaved with r6 on a loaded machine.

**What changed in `harness/simp_entity.py`** (the interface is the same: `detect` → `Detection(entities, intent, era, tokens)`, `title_weights`, `main_rows`, `entity_query`):
- **One name index** for people and studios. Person keys: full, original and last name. Studio keys: full name and first word, with studios sharing a key merged. One prior for every entity: the votes of its main-credit titles.
- **One ambiguity test:** a key resolves when its entity outweighs the next entity with that key 3× and outweighs 150k × (1 + the key's frequency as a word in the existing spell vocabulary). This replaces the common-word guards, surname dominance, the mononym and weak-alias rules and 3 word lists. People who share most of their main credits merge into a team (Coen, Russo, Wachowski).
- **Intent** is the nearest of 39 example phrases in the multilingual embedding, with the names replaced by "X". A query that is only names is "both", or "filmography" for a studio.
- **Credit weights** have two classes: main = 1, anything else = 0.5.

**ΔS by mechanism:**

| | M16 (was 104) | M17 (was 19) | side effects | S |
|---|---|---|---|---|
| `entity-resolver` | 33 | 14 | M18 −3 | 315 |
| `entity-lean` | 29 | 10 | M18 −3, M09 −3 | 304 |
| `entity-lean-nofuzzy` | 26 | 10 | M18 −3, M09 −3 | 301 |

The complexity.py proxy score falls from 277 (flat `simp`) to 222 / 216 / 216, and lines in entered functions from 1458 to about 1360.

**Quality** (`entity-resolver`; c = condensed, u = unjudged titles):

| split | r6 | entity-resolver |
|---|---|---|
| dev | 0.836 | 0.836 |
| dev-style | 0.812 | 0.802 (c0.814) |
| ho | 0.761 | 0.761 |
| ho2 | 0.728 | 0.721 (c0.728) |
| ho3 | 0.893 | 0.890 |
| ho4 | 0.837 | 0.800 (c0.874, u16) |

- **Guardrails:** bad5 40 = 40, own10 5.56–6, title@1 6/7 = 6/7.
- **Lean** is the same except dev 0.831; the loss is the "early spielberg" query.
- **Nofuzzy** also loses ho3 0.871 by missing the "leonardo dicapro" typo, so keep typo matching.
- **Why ho4 drops:** the two credit classes reshuffle the entity's own titles into unjudged ones (Police Story 3, Paranormal Activity 2 and 3). Intent accounts for only −0.012, on sty-09 and sty-10, where the new intent matches the gold label.

**Detection accuracy:**
- On the 127 queries, entities agree with r6 on every query.
- Intent differs on 2 queries, both toward gold: 32 of 36 match the gold intent label, against 30 for r6.
- On the tag probes: 10 false positives against 36 for r6, and 412 of 450 known names found against 385.
- Losses: the single words "disney", "ghibli" and "amazon", and the surnames "scott", "berg" and "levinson", no longer resolve. New false positives include "castle", "sherlock holmes" and "united kingdom".

**Latency:** p50/p95 is 70/173 ms against r6's 76/213 in the same run. That benchmark caches every embedding, so it hides one new small-model encode per English entity query for intent: about 7 ms on this CPU. It could run in parallel with the existing residual encode.

Pool these three names: `entity-resolver`, `entity-lean`, `entity-lean-nofuzzy`. `entity-resolver-allco` is a diagnostic only (worse on ho4).

Files are in /home/alp/dev/projects/goodwatch/goodwatch-monorepo/.claude/worktrees/search-simplify/docs/prototypes/search-arena:
- harness/simp_entity.py
- results/simplify/entity/ (runs `score3.txt` and `score-diag.txt`, probes `probe.py` and `cmp_det.py`, `complexity-*.txt`)
