# Round 2 results and the brief for round 3 (read after README.md and ROUND1.md)

## Where the race stands, on locked ratings (owner 249 ratings, 24 bad; 22 other members)

| predictor | dev owner mae | dev macro | dev rho | dev others skill | locked owner mae | locked macro | locked mae_bad | locked rho | locked auc_bad | locked others skill |
|---|---|---|---|---|---|---|---|---|---|---|
| baselines/gbm_facts.py | 0.818 | 1.045 | 0.550 | 0.096 | 0.868 | 1.182 | 2.03 | 0.554 | 0.825 | 0.092 |
| agents/badscores/shape_a05.py | 0.780 | 0.963 | 0.562 | 0.125 | 0.843 | 1.109 | 1.83 | 0.572 | 0.844 | 0.144 |
| agents/combine/best.py (everything stacked) | 0.757 | 0.921 | 0.591 | 0.166 | 0.899 | 1.173 | 1.92 | 0.567 | 0.841 | 0.142 |
| agents/pooled/h_pooled.py (hierarchical ridge, no trees) | 0.825 | 1.048 | 0.556 | 0.122 | 0.855 | 1.177 | 2.05 | 0.592 | 0.867 | 0.110 |
| agents/pooled/best.py (+ trees, continuous) | 0.789 | 1.006 | 0.590 | 0.137 | 0.852 | 1.163 | 2.01 | 0.606 | 0.867 | 0.124 |
| **agents/pooled/h_shape.py (pooled + shape alpha 0.5): the leader** | 0.774 | 0.931 | 0.590 | 0.123 | 0.851 | 1.090 | 1.75 | 0.606 | 0.867 | 0.140 |
| agents/profile/profile_pred.py (readable profile only) | 0.819 | 1.070 | 0.551 | 0.084 | 0.900 | 1.244 | 2.17 | 0.553 | 0.835 | 0.083 |

Lessons:
- **Development gains for the owner do not transfer unless they are large and simple.** combine/best.py stacked every round-1
  ingredient, showed owner mae 0.757 in development and 0.899 on locked ratings (worse than the baseline). Stacking and
  per-ingredient selection on 744 ratings fits noise. The simple, pooled model transferred best.
- What transferred: the shape wrapper (median of a rating distribution), pooling across members (consensus weights from
  other members, the member's weights shrunk to them: agents/pooled/pool.py), better ranking (rho, auc_bad).
- Still in the race: pooled/pool.py + preds.py (hierarchical ridge), pooled/best.py (adds trees with text columns),
  badscores/shape.py (output shape), the profile's statement types (agents/profile/lib.py).
- Module names clash between agents' folders (`lib.py`, `best.py` exist in several). If you import another agent's
  code, load it by file path under a unique module name (importlib) instead of `import lib`.

## New in the pack for round 3: more score data

`D.info[i]` now also has, per title: `tmdb_user_score_rating_count`, `metacritic_user_score_rating_count`,
`metacritic_meta_score_review_count`, `rotten_tomatoes_audience_score_rating_count`,
`rotten_tomatoes_tomato_score_review_count`, `goodwatch_user_score_rating_count`, `goodwatch_official_score_review_count`
(already there: every `*_normalized_percent` score, `imdb_user_score_rating_count`, `goodwatch_*`).
Coverage: IMDb and TMDB 100%; RT audience 78%, Metacritic user 75%, RT critics 67%, Metacritic critics 64%.
For shows, `D.info[i]['seasons']` is a list of per-season dicts (season_number, air_date, episode_count, and where known:
IMDb season score and count, Metacritic critic and user score, RT critic and audience score, and IMDb episode score
statistics ep_mean, ep_min, ep_max, ep_sd, ep_n). Movies have `seasons = None`.

Audience sources: IMDb, TMDB, RT audience, Metacritic user. Critic sources: Metacritic meta, RT tomato.
Known about the owner: follows audiences over critics (+0.2 rating points per 10 points of audience-over-critic gap;
IMDb and TMDB carry the weight, RT critics none); titles whose sources disagree most are riskier (17% bad against 5 to 6%).
