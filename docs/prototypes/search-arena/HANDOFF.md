# Handoff: simplify the search ranking

This file starts a new prototype loop. Its goal: **make the winning ranker
simpler while keeping or improving quality, without making it slower or more
expensive.** Read it fully before you touch code.

## How we got here

Three prototypes, in order. Each one is a git worktree you can read.

1. **Ranking lab** (`proto/ranking-lab`, worktree
   `.claude/worktrees/ranking-lab`, start with
   `docs/prototypes/ranking-lab/README.md` and `index.html`).
   Found that the candidate pool was the real problem (Game of Thrones at
   cosine rank 2,788 for "fantasy with dragons"). Added tier prefetches,
   keyword and trope evidence, and a cheap Jev judge. Judged by hand-picked
   watch titles, no aggregate metric.
2. **Ranking tournament** (`proto/search-ranking-exploration`, worktree
   `../goodwatch-ranking-exploration`, start with
   `docs/prototypes/ranking-lab/README.md`, `tournament.html` and
   `experiments/README.md`).
   Brought the method: a frozen contract, blind pooled grades, NDCG@10 and
   guardrails. Its winner (interpret, then judge with a model) reached NDCG
   0.93 on re-ranked pools, but needed per-query model calls and was never
   measured for cost or latency.
3. **Search arena** (this folder, branch `proto/search-arena`).
   Took the tournament's method and the lab's recall lessons, under the
   user's budget: no new paid calls at query time. Ran six rounds and four
   blind holdouts. `results/LOG.md` has every round.

## The baseline you start from

`r6` in `harness/run6.py` (`FINAL`), built in layers:
`rankers.py` → `rankers2.py` → `rankers3.py` → `rankers4.py` →
`rankers5.py` → `rankers6.py`, with `blend*.py`, `sparse.py`,
`entities.py` and `cuts.py`.

What it does per search, after the Jev reading:

- Dense: local `bge-base-en-v1.5` over each title's subject text (no title),
  `multilingual-e5-small` for non-English queries mixed with Jev's English
  chips.
- Fingerprint: production's weighted sum of Jev weights × 74 scores.
- BM25F: local index over tags, keywords, tropes, essence, creators, cast
  (replaces the Crate text pool).
- Fusion: z-scored weighted sum, a small votes and GoodWatch-score prior.
- Special handling, one piece of code each: negation, spell correction, era,
  facets, facet coverage, "like X" reference titles, strict and fuzzy title
  matching, title-word bonus by query kind, person and studio detection,
  filmography boosts, style neighbors (fingerprint centroid, term profile,
  similar directors, popularity damping), alternate-cut folding.

Quality (NDCG@10, pooled agent grades):

| split | queries | prod | r4-combo-fast | r6 |
|---|---|---|---|---|
| holdout2 (general) | 22 | 0.518 | 0.716 | 0.728 |
| holdout3 (person, studio) | 12 | 0.388 | 0.720 | 0.893 |
| holdout4 (style) | 12 | 0.379 | 0.704 | 0.837 |

The r4-combo-fast and r6 columns come from the round-6 tables (with the
re-graded style pairs and the alternate-cut rule); the prod column comes from
each holdout's own round. Numbers shift as grades are added; always recompute
in one table. Cost: $0 beyond the Jev reading. Latency: about 35-50 ms after the
reading (local benchmark, `results/holdout/latency-live.md`); the Jev reading
itself is about 380 ms.

Complexity today: about 2,600 non-comment lines in 13 harness modules, 22
compiled regular expressions, and more than 60 effective tunables (the `FINAL`
overrides plus inherited `DEFAULTS`). Measure the exact baseline yourself
before round 1.

## Constraints (from the user, unchanged)

- No new paid calls at query time. The Jev reading is the cost ceiling.
- Latency after the reading must not grow. Local CPU models are fine.
- Experiment spend under $5.
- Production CrateDB, Qdrant and Redis are writable with the webapp `.env`.
  Read only. `scripts/readonly_stores.py` refuses anything but SELECT.
- People and studios are boosts, never filters. Style queries want a mix of
  the entity's own titles and similar titles by others.
- No prototype names (r4, arena, d4) may survive into production code.

## Goal and win criteria for this loop

Add a dated note to `evaluation-contract.md` before round 1 with:

1. A **simplicity score**: count of tunables, hand-written rules and regular
   expressions, and separate query-type code paths. Report lines of code too.
2. **Win:** at least 40% lower simplicity score than `r6`, `ndcg10` within
   0.01 of `r6` on every existing split (or better), `bad5` not higher, same
   or lower latency, same cost.
3. **Confirmation** on a fresh `holdout5`, written blind. Prefer about 30 real
   queries sampled read-only from production search history
   (`recordSearchHistory` writes to Crate). Real queries also check the bias
   of our agent-written sets.

## Starting hypotheses

1. **Ablate first.** Remove each rule of `r6` alone and measure it. Anything
   worth under about 0.005 goes. Known near-zero: the facet term (+0.004),
   `agree`, `reweight`.
2. **One reference mechanism.** "Like X", person style and studio style are
   the same idea: resolve an entity (title, person or studio), build a
   centroid from its titles, mix it into the query. Merge the three paths.
3. **One negation mechanism.** Jev's avoid dimensions plus one embedding
   penalty, instead of per-language regular expressions.
4. **Learned fusion weights.** Fit the 5-8 signal weights on the graded
   pairs with cross-validation instead of hand tuning.
5. **Intent from embeddings.** A few example phrases per intent (filmography,
   style, era, negation, like X), matched with the query embedding we already
   compute. Works across languages at no extra cost.

## Findings to apply

- **Human calibration** (`results/grading/human-calibration-grades.json`):
  the user graded 11 pairs; 7 exact, 10 within one grade of the agents,
  agents slightly more lenient. Two concrete findings:
  - "like groundhog day": the user graded Groundhog Day itself 3. Round 4
    excludes the reference title. Let it appear, for example once and not at
    rank 1.
  - "something short to watch after work": The Yogi Bear Show got 0 from
    the user and 3 from both agents. Agents read vague queries too
    literally. Tighten `results/grading/GRADER.md` for vague and mood
    queries, and re-grade affected pairs before relying on them.
- **Open failures** in `r6`: negated concrete nouns ("space opera without
  aliens"), generic facet units ("set", "war"), spell vocabulary ("deth"),
  franchise X in "X but Y" ("star trek but in ancient times" puts Stargate at
  #8), producer-only credits boosted as own titles ("fincher vibes but a
  series").
- **Jev 529s** fall back to basic search in production (0 retries). Note it
  for the port; not part of this loop.

## How to run things

From this folder, with the venv (`.venv/bin/python`):

- Grades: `results/grades.json` (add only). Grader instructions:
  `results/grading/GRADER.md`. Two sonnet graders (A shuffled, B reversed),
  a third blind assessor for gaps of 2 or more.
- Metrics: `harness/metrics.py` (`graded_query6`, `own10`).
- Baseline lists and metrics: `harness/run6.py final` and `report`.
- Captures for new queries: in `goodwatch-webapp`,
  `ARENA_CAPTURE_FETCH=1 npx vite-node --config scripts/arena-vite.config.mjs scripts/arena-capture.ts --only <ids>`
  (read only, readings stored locally, about $0.0003 each).
- Playground: `.venv/bin/python playground/serve.py`, then
  http://localhost:8765. Add the new ranker as a column.
- Local data (gitignored, rebuild with `scripts/` if missing): catalog
  snapshot, embeddings, `people.jsonl.gz`, `credits.jsonl.gz`,
  `persons.json.gz`, `companies.jsonl.gz`.

## Working style the user expects

- Breadth first, then iterate in rounds. Log each round in `results/LOG.md`.
- Use subagents for building and grading to keep context clean.
- Freeze a candidate in the log before scoring any holdout.
- Stop only for decisions only the user can make.
