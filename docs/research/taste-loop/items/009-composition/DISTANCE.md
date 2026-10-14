# Item 009: distance from the member’s own mix

T2a run `20261014T113107-e864bd47-b08d`; tier A members other than the owner; `others: all`.

For each view, take `abs(top_share − own_share)`, then average the distances over the member’s views; members have equal weight. Shares are fractions. The cached `top` values use the harness’s first 50 non-hidden, non-side-list candidates, with ties in view order. `own` is the member’s rated universe mix, including hidden ratings, from `score.t2a_table`. Intervals are paired member bootstrap 95% percentile intervals from `stats.paired`, 10,000 draws, seed 20261013. Negative differences mean G1 is closer.

| Mix | G1 mean distance | B2 mean distance | G1 − B2 [95% CI] | n | G1 closer | B2 closer | Tied |
| --- | --- | --- | --- | --- | --- | --- | --- |
| shows | 0.079071 | 0.236328 | -0.157257 [-0.199733, -0.117625] | 61 | 50 | 10 | 1 |
| animation | 0.083296 | 0.158731 | -0.075434 [-0.109887, -0.043376] | 61 | 38 | 22 | 1 |

Signed paired check: top_shows_vs_own +0.175071; top_animation_vs_own -0.014557. Both equal `RESULTS.md` and the original ledger to six decimals.

**Cache used; no predictors rerun.** Cache directory: `~/goodwatch-research/taste/work/cache/808332db822ed0feaa6c700ce0db872b/`. Both predictor hashes and cache metadata match. Rebuilt views without writing files; verified the views, title-array and answer-key digests, pack/title file hashes, and original harness hash `4560b41019627a29c12431582c4e7ee9bb66269d2bf1cc39f0bffed2c0f25ae1`. The retained harness snapshot is `~/goodwatch-research/taste/work/runs/20261014T104820-3321997e-abdc/harness/`; the current harness differs from the original run.

Reproduce from the worktree root: `python3 -B docs/research/taste-loop/items/009-composition/distance.py`. The script uses at most two numerical threads and writes only this aggregate report. No per-member rows are saved.
