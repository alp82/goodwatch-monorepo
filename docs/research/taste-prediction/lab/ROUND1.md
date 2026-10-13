# Round 1 results (read after README.md)

Five agents each took one direction. Development numbers are cross-validated (owner / 22 others); "locked" is a quarter of
every member's ratings that no agent saw (owner: 249 ratings, 24 bad, so owner locked mae has a standard error near 0.04:
it can confirm large effects only; the others' skill over 22 members is steadier).

| predictor | dev owner mae | dev macro | dev rho | dev others skill | locked owner mae | locked macro | locked rho | locked auc_bad | locked others skill |
|---|---|---|---|---|---|---|---|---|---|
| baselines/gbm_facts.py | 0.818 | 1.045 | 0.550 | 0.096 | 0.868 | 1.182 | 0.554 | 0.825 | 0.092 |
| agents/structure/best.py | 0.811 | 1.043 | 0.561 | 0.124 | 0.865 | 1.180 | 0.572 | 0.839 | 0.112 |
| agents/badscores/round_reg.py (baseline rounded) | 0.770 | 1.004 | 0.562 | 0.117 | 0.854 | 1.155 | 0.545 | 0.825 | 0.104 |
| agents/badscores/shape_a05.py | 0.780 | 0.963 | 0.562 | 0.125 | 0.843 | 1.109 | 0.572 | 0.844 | 0.144 |
| agents/badscores/shape_a075.py | 0.817 | 0.941 | 0.563 | 0.060 | 0.862 | 1.080 | 0.569 | 0.846 | 0.092 |
| agents/people/best.py | 0.819 | 1.033 | 0.563 | 0.119 | 0.887 | 1.220 | 0.546 | 0.800 | 0.133 |
| agents/collab/best.py | 0.813 | 1.057 | 0.563 | 0.128 | 0.866 | 1.208 | 0.576 | 0.841 | 0.125 |
| agents/text/best.py | 0.788 | 1.004 | 0.595 | 0.128 | 0.870 | 1.175 | 0.586 | 0.850 | 0.118 |

## What held up

- **Output shape (badscores).** Ratings are whole numbers scored by absolute error, so the right answer is a median, not a
  mean: merely rounding the regressor gains about 0.04 mae. Better: predict P(rating = 1..10) with one classifier per
  threshold, answer with the band-weighted median (`alpha` = how much rare bands count; 0.5 recommended). Held on locked
  for owner and others. Reuse (agents/badscores/shape.py):
  `shape.shape_predict(Xm, tr_idx, tr_y, te_idx, alpha=0.5, mono=None, fit_predict=None)` for a feature matrix,
  `shape.shape_point(fit_predict, tr_idx, tr_y, te_idx, alpha=0.5)` for any point predictor,
  `shape.decide(P, tr_y, alpha=0.5)` for a ready distribution. It is slow (about 300 s with --others).
  **Compare predictors on the same output convention**: a whole-number output beats a continuous one on mae for free.
- **Trees blended with a linear model** (found independently by structure, collab, text): lifts the others' skill from
  about 0.096 to about 0.12; nothing for the owner. Structure's version: public scores first, fingerprint on the residual
  with its own penalty (agents/structure/two_stage.py), blended with the trees.
- **Text features in the trees (text).** 51 rating-free columns (3 sequel flags, 16 PCA of the English embedding, 16 SVD of
  tags, 16 SVD of essence_text+synopsis TF-IDF) in agents/text/text_feats.npz. Dev owner mae 0.818 to 0.788 and rho 0.550
  to 0.595; on locked the rank gain held (rho 0.586, auc_bad 0.850) but mae did not move (0.870): treat the mae gain as unproven.
- **Monotone public scores + column sampling + franchise stage (people)**: others' skill 0.096 to 0.119 (locked 0.133), owner
  unchanged or slightly worse on locked. Code in agents/people/pf.py, pf2.py, best.py.

## What did not

- Structure in the fingerprint beyond linear (mixtures of experts, interactions, curves, several taste directions, clusters
  of loved titles): nothing. Craft attributes and "taste" attributes are mostly the same signal as public scores.
- Person effects (cast, directors, writers, studios) for the owner: under 1% of error variance once scores and attributes
  are known. Other members show a little (corr 0.15 to 0.21) but too few ratings to pin down per member.
- Other members' ratings, item-item, user-user, title graph, wishlist/skipped counts: nothing for the owner (only 23% of
  the owner's titles have 5+ other raters). Five "taste axes" learned from other members match the trees for small members.
- Skipped/wishlist as weak labels; stretching predictions; band-weighted losses; hard band classifiers.
- A member's own favorite/wishlist membership of a test title leaks the label: never use it.

## What the owner's taste looks like (from all five)

- Quality first: audience scores (IMDb, TMDB, RT audience) count, critic scores hardly; about 28% of rating variance is
  "well made", about 3% is fingerprint taste beyond that, the rest unexplained.
- Offsets on top of quality: + strange and stylized, + irreverent comedy/satire, + warm human drama (weak);
  - spectacle adventure, - tense crime and thriller (weak), - light sitcom (weak).
- Sequel fatigue: sequels rated 0.5 below the public; 25% of sequels rated 5 or less against 7% elsewhere.
- Formulaic action/crime rated below expectation; strange and unsettling above; anime, philosophical, non-linear up.
- A predicted high score is trustworthy (no bad titles in the top three deciles); a predicted 6 means "risky".

Reports with details: agents/people/REPORT.md, agents/collab/REPORT.md, agents/text/REPORT.md. Every scored run is in ledger.jsonl.
