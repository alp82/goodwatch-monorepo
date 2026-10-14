# Item 009: distance from the member’s own mix, registered comparison

The registered run `20261014T150814-e864bd47-58d5` keeps no predictor outputs. This report reads them from the exploratory run below, made afterwards under the same harness for this purpose; the script asserts that both runs have identical views, harness hash and measures.

T2a run `20261014T152137-e864bd47-c7f9`; tier A members other than the owner; `others: all`.

For each view, take `abs(top_share − own_share)`, then average the distances over the member’s views; members have equal weight. Shares are fractions. The cached `top` values use the harness’s first 50 non-hidden, non-side-list candidates, with ties in view order. `own` is the member’s rated universe mix, including hidden ratings, from `score.t2a_table`. Intervals are paired member bootstrap 95% percentile intervals from `stats.paired`, 10,000 draws, seed 20261013. Negative differences mean G1 is closer.

| Mix | G1 mean distance | B2 mean distance | G1 − B2 [95% CI] | n | G1 closer | B2 closer | Tied |
| --- | --- | --- | --- | --- | --- | --- | --- |
| shows | 0.079071 | 0.236328 | -0.157257 [-0.199733, -0.117625] | 61 | 50 | 10 | 1 |
| animation | 0.083296 | 0.158731 | -0.075434 [-0.109887, -0.043376] | 61 | 38 | 22 | 1 |

Signed paired check: top_shows_vs_own +0.175071; top_animation_vs_own -0.014557. Both equal `RESULTS.md` and the registered run's ledger line to six decimals.

**Cache used; no predictors rerun.** Cache directory: `~/goodwatch-research/taste/work/cache/21072cb213e5ea94ee2b70238c506bb3/`. Both predictor hashes and cache metadata match. Rebuilt views without writing files; verified the views, title-array and answer-key digests, pack/title file hashes, and original harness hash `4c4d528eca67164370deb2f346399ab6d86fba5d4e9879d59318f71591996056`. Harness: the current `lab/`, the registered run's.

Reproduce from the worktree root: `python3 -B docs/research/taste-loop/items/009-composition/distance.py registered`. The script uses at most two numerical threads and writes only this aggregate report. No per-member rows are saved.
