# collab: signals from other people

Verdict: other people's signals add almost nothing for the owner on top of the baseline, and a small amount for the
other members. The one variant that moves the numbers gets most of its gain from blending the boosted trees with a
linear model, which needs no other people at all. No variant lowers the owner's `macro_mae`.

## 1. Scored through the harness (owner 10-fold, others 5-fold, in `ledger.jsonl`)

| name | owner mae | macro_mae | rho | mae_bad | auc_bad | others skill | others rho |
|---|---|---|---|---|---|---|---|
| baseline gbm_facts (reference) | 0.818 | 1.045 | 0.550 | 1.65 | 0.852 | 0.096 | 0.395 |
| collab: gbm + own ridge + other-member taste axes (`best.py`) | 0.813 | 1.057 | 0.563 | 1.70 | 0.856 | 0.128 | 0.431 |
| collab: gbm + other-member taste axes (`gbm_axes.py`) | 0.814 | 1.057 | 0.564 | 1.70 | 0.855 | 0.126 | 0.427 |
| collab: control gbm + own ridge, no collab (`ctl_own_ridge.py`) | 0.816 | 1.053 | 0.557 | 1.68 | 0.856 | 0.121 | 0.420 |
| collab: gbm + correction from other members' ratings of the title (`stack_ost.py`) | 0.818 | 1.041 | 0.550 | 1.63 | 0.854 | 0.102 | 0.406 |
| collab: gbm + all direct collab columns (`gbm_allcollab.py`) | 0.820 | 1.062 | 0.554 | 1.71 | 0.839 | 0.099 | 0.390 |
| collab: gbm + source disagreement columns (`gbm_dis.py`) | 0.824 | 1.062 | 0.557 | 1.70 | 0.844 | 0.097 | 0.405 |

Unledgered variants (mean of 3 CV seeds for the owner, `ev.py`; baseline there is mae 0.821, macro 1.051, rho 0.545,
others 0.096 / 0.395). "Gain" is the paired drop in owner mae vs the baseline with a 90% bootstrap interval.

| variant | owner mae | macro | rho | others skill | others rho | owner gain |
|---|---|---|---|---|---|---|
| gbm + others' wishlist/skipped/favorite counts | 0.821 | 1.053 | 0.542 | 0.094 | 0.395 | 0 |
| gbm + others' rating stats of the title | 0.824 | 1.056 | 0.541 | 0.098 | 0.401 | 0 |
| gbm + graph spectral embedding (12 dims) | 0.821 | 1.057 | 0.545 | 0.088 | 0.387 | 0 |
| gbm + user-user / item-item neighbour columns | 0.820 | 1.054 | 0.543 | 0.097 | 0.398 | 0 |
| ridge correction: graph-neighbour residuals | 0.824 | 1.055 | 0.539 | 0.095 | 0.390 | -0.003 [-0.005, -0.002] |
| ridge correction: user-user neighbours | 0.821 | 1.051 | 0.545 | 0.099 | 0.397 | 0 |
| gbm + pooled other-member model prediction as a column | 0.816 | 1.045 | 0.545 | 0.101 | 0.405 | +0.005 [-0.003, +0.013] |
| gbm + agreement-weighted member models ("kindred") | 0.816 | 1.042 | 0.550 | 0.091 | 0.390 | +0.005 [-0.005, +0.015] |
| gbm + audience columns (gw_user, meta_user, imdb votes) | 0.818 | 1.049 | 0.552 | 0.098 | 0.398 | +0.003 [-0.006, +0.010] |
| ridge on consensus + 4 taste axes alone (5 numbers) | 0.841 | 1.103 | 0.528 | 0.097 | 0.378 | -0.020 |
| gbm + taste axes as columns | 0.829 | 1.061 | 0.541 | 0.100 | 0.402 | -0.008 |
| 0.75 gbm + 0.25 axes ridge | 0.814 | 1.053 | 0.559 | 0.120 | 0.418 | +0.007 [+0.002, +0.013] |
| 0.6 gbm + 0.4 ridge on the public score only | 0.820 | 1.079 | 0.551 | 0.110 | 0.400 | +0.001 |

## 2. Files

- Best predictor: `agents/collab/best.py` (runs through the harness as is; about 260 s with `--others` on the loaded
  machine, most of it fitting the taste axes once per member). Needs `lib.py` beside it.
- `lib.py` (all feature builders), `stack.py` (ridge correction on inner out-of-fold residuals), `ev.py` (3-seed paired
  evaluation), `diag.py` (per-feature signal check), `exp1.py`..`exp7.py` (experiments).
- No cached feature files on disk. Everything fitted on ratings is fitted inside `predict` from `D.others(user)` and
  `tr_idx`/`tr_y`, cached in process memory only. The predicted member's own wishlist/skipped/favorite rows are excluded.

## 3. What worked, what did not

Coverage first. 49% of the owner's 744 titles have any other rater, 35% have two, 23% have five. Only 29% of the
owner's 70 bad titles have any other rater (11% have three). For the 22 other members coverage is 86% on average,
because the owner is by far the heaviest rater. Others' skipped signal covers 50% of the owner's titles, wishlist 27%,
favorite under 1%.

Worked, weakly:
- Blending the trees with a linear model: others' skill 0.096 to 0.121, owner rho 0.550 to 0.557. This uses no other
  people; it is in my table only as the control.
- Replacing or joining that linear model with 5 numbers learned from other members (a members' consensus score plus 4
  axes along which members disagree): others' skill 0.128, owner rho 0.563, owner mae 0.813. Paired against the control
  the extra is +0.004 owner mae [-0.001, +0.009] and +0.009 mean mae for others, 17 of 22 members better. That is the
  whole collaborative contribution: real in direction for the others, inside noise for the owner.
- A ridge on those 5 numbers alone matches the baseline trees for the other members (skill 0.097 vs 0.096), which says
  members with 60 to 350 ratings are mostly described by a few shared directions.

Cost: every blend raises owner `macro_mae` slightly (1.045 to 1.053-1.057) and `mae_bad` (1.65 to 1.70), because the
linear part shrinks harder to the mean. All inside the 0.02 noise band, but the sign is wrong for the headline number.

Failed (all within noise of the baseline or worse):
- Other members' ratings of the same title (mean, rater-centred mean, share of low ratings): for the owner rho 0.08
  with the baseline residual on the covered half. Where three or more members rated a title, their mean tracks the
  owner worse (rho 0.23) than the public score does on the same titles (0.39).
- User-user "members who agree with you" and item-item neighbours from co-ratings: residual rho 0.01 to 0.04 for the
  owner, 0.04 to 0.09 for others; no mae change.
- Title graph (`tmdb_recommendation_ids`, `tmdb_similar_ids`): 91% of the owner's titles have a rated neighbour, but the
  neighbours' ratings correlate only 0.13 with the owner's rating and slightly negatively with the baseline residual.
  Using them hurts (others' skill down to 0.087 at moderate regularisation). Graph spectral embedding: nothing.
- Others' wishlist/skipped/favorite counts: they track popularity (skip count correlates +0.32 with the owner's rating
  because popular titles are shown more), nothing left after the public scores.
- Source disagreement columns: owner rho +0.007, mae -0.006 worse; the trees already see the raw sources.
- Pooled other-member model or agreement-weighted member models as tree columns: +0.005 mae, interval spans zero.
- One early bug worth knowing: a two-hop graph feature leaked the title's own label through the path back to itself
  and made results much worse (0.89 mae); fixed by zeroing the return path.

## 4. What it says about the owner's taste

- Sides with audiences over critics. At a fixed overall score, a higher IMDb/TMDB/audience share goes with a higher
  rating (partial rho +0.24, +0.24, +0.16 to +0.19) and a higher critic share with a lower one (Metacritic -0.18,
  Rotten Tomatoes critics -0.16). The other members lean the same way but about half as strongly.
- Follows the crowd more than other members do: rho with the public score 0.48 against 0.26 on average.
- Titles the sources disagree on are riskier: the third with the widest spread across sources averages 6.74 with 17%
  bad, against 7.3 and 5 to 6% bad for the rest. Titles where audiences outscore critics by 5+ points average 6.85
  with 16% bad, so the audience lean is about relative weight, not a taste for critic-panned titles.
- No mainstream or niche lean once quality is accounted for (partial rho with vote count +0.01; others +0.10).
- On the shared axes: strongest weight on the members' consensus (+0.45 rating points per sd); +0.22 on "acclaimed,
  dialogue-led, rewatchable" against "adrenaline, spectacle, violence" (Amadeus, 12 Angry Men vs Transformers, Warcraft);
  -0.14 on "light, wholesome comedy" against "bleak, philosophical, ambiguous" (so mildly prefers the latter);
  about zero on the main axis members split on (dark and tense vs cosy and funny).

## 5. Next steps

1. Treat the linear-plus-trees blend as a baseline upgrade for small members, independent of this lane, and pair it
   with the bad-title work so the shrinkage it adds is undone.
2. Collaborative signals need volume: re-test user-user neighbours and others' ratings only once titles have 5+
   raters at scale. Today that is 23% of the owner's titles and 11% of the bad ones at 3+.
3. Use the taste axes for cold start: 5 numbers match the trees for members with 60 to 350 ratings, so they are the
   natural model for members with fewer than 60, which this benchmark does not measure.
