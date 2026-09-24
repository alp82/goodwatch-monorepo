# Search arena

Goal: find the best natural-language search ranking that stays fast and cheap.
Earlier experiments: `proto/ranking-lab` (recall tiers, Jev judge) and
`proto/search-ranking-exploration` (tournament, semantic-core re-rank).

## Raw data lives on the archive branch

`main` holds the code, the docs and the summary results. The raw data stays on the branch `proto/search-simplify`,
where the arena was developed:
- `data/captures/`: production search responses and Jev readings for every query. Regenerating them costs money.
- `results/grading/`: the assessors' per-part grading files. `grades.json` and the human calibration grades are
  on `main`.
- A few result pools over 200 KB.

To run the harness, check out that branch. The catalog and embedding files are gitignored on both branches, so they
have to be rebuilt or copied from a machine that has them.

## Hard constraints (from the user, 2026-09-23)

- Experiment spend: under $5 in total, across Jev, OpenRouter, and any API.
- Production cost: the current Jev reading is the accepted baseline. Anything
  added on top must be close to free (target: 1,000 searches add well under
  $1 beyond the reading).
- Local embedding models (catalog embedded offline, query embedded on the app
  server CPU) are approved.
- Latency: results in under 1 s end to end, preferably much faster.
- No LLM calls at query time beyond what exists today (Jev reading).
- Production stores (Qdrant, CrateDB, Redis) are writable with the webapp
  `.env`. Experiments only read from them. Nothing writes to production
  collections or tables.

## Layout

- `queries.json`: the evaluation set, with `split` (`dev` or `holdout`).
- `evaluation-contract.md`: frozen grading rules and win criteria.
- `data/`: local catalog snapshot, embeddings, and captured readings
  (large files are gitignored).
- `rankers/`: one file per ranking branch.
- `results/`: per-round metrics, latency, and cost.
