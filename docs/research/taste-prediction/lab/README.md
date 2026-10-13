# Taste lab

Goal: find much better ways to predict a member's rating (1 to 10) of a title they have not rated yet, and a better
description of their taste. The member who matters most is the owner (`D.owner`, 744 development ratings). The product is
GoodWatch, a movie and show recommendation site; every title has a "fingerprint" of 74 attribute scores (0 to 10).

## How to work

- Everything you need is in `pack.pkl`, loaded through `harness.py` (`Data`). Read `harness.py` first: its docstring is the
  predictor contract. `baselines/` holds four working predictors.
- Work only inside your own folder `agents/<your name>/`. Do not edit `harness.py`, `pack.pkl`, `baselines/`, or other
  agents' folders. Do not query any database or network service: the pack is the only data source. No paid APIs.
- Iterate with `python3 harness.py agents/<you>/x.py "name" --quick`, then score candidates with
  `python3 harness.py agents/<you>/x.py "<you>: name" --others` (appends to `ledger.jsonl`).
- The machine is shared: 8 cores shared by five agents, so at most 2 threads (`n_jobs<=2`, run with `OMP_NUM_THREADS=2`), keep one full run under about 5 minutes.
  Installed: numpy, scipy, sklearn only (no pandas, lightgbm, xgboost, torch); do not install packages. No GPU work.
- No leakage: for the member being predicted use only `tr_idx`/`tr_y`. Anything fitted on ratings must be fitted inside
  `predict` from `tr_idx`/`tr_y` (and `D.others(user)` if you want other members). Features that do not depend on
  ratings (text, people, embeddings) may be precomputed and cached in your folder.
- Do not overfit the benchmark. One member and 744 ratings is small: differences under about 0.02 in `mae` are noise.
  Prefer ideas that also raise the `OTHERS` skill (22 other members, 60 to 350 ratings each). A quarter of every
  member's ratings is locked away outside this folder and your best predictor will be re-scored on it.

## What counts

Reference results (development ratings, cross-validated):

| predictor | owner mae | owner macro_mae | owner rho | owner mae on bad titles | owner auc_bad | others skill | others rho |
|---|---|---|---|---|---|---|---|
| Your usual rating | 0.992 | 1.435 | 0 | 2.58 | 0.500 | 0.00 | 0 |
| Everyone's score alone | 0.875 | 1.168 | 0.482 | 1.95 | 0.790 | 0.054 | 0.227 |
| Weighted attributes (linear) | 0.874 | 1.165 | 0.489 | 1.93 | 0.820 | 0.077 | 0.350 |
| Boosted trees on attributes + title facts (best so far) | 0.818 | 1.045 | 0.550 | 1.65 | 0.852 | 0.096 | 0.395 |

- `mae`: average error in rating points. `rho`: rank agreement. `skill`: 1 - mae / mae of always guessing the member's mean.
- `macro_mae`: mean of the error on bad (1 to 5), middle (6 to 7) and high (8 to 10) titles. **This is the headline
  number**: every method so far predicts about 6.2 for titles the owner rated 5 or less (only 70 of 744), because it
  shrinks to the mean. The owner wants real scores predicted, "even bad ones". `auc_bad` is how well bad titles are
  ranked below the rest.
- A win is: clearly lower owner `macro_mae` and `mae`, higher `rho`, without lowering the others' skill.

## What to hand back

Your final message is read by the orchestrator, not a person. Make it a compact report:
1. A table of everything you scored (name, owner mae, macro_mae, rho, mae_bad, auc_bad, others skill, others rho).
2. The path of your best predictor file (must run through the harness as is) and of any cached feature files.
3. What worked and why you believe it is real and not noise; what failed (failures are useful: list them briefly).
4. What the idea says about the member's taste in plain terms, if it yields a readable description.
5. The two or three most promising next steps.
Also save the same report as `agents/<you>/REPORT.md`.
