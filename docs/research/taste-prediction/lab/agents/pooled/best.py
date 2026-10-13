"""pooled agent's best predictor.

1. Pooled part (pool.py), learned from every OTHER member's ratings (D.others(user)), cached in memory per predicted member:
   - a members' consensus score per title: ridge of member-centred, member-scaled ratings on 160 title columns
     (74 attributes, public scores, facts, genres, the text agent's 51 columns), plus a second consensus from boosted
     trees on the same rows (cross-fitted over titles so the population spread is estimated honestly);
   - the population distribution of (offset, slope on each consensus) across members, by EM.
2. Member part, from tr_idx/tr_y only: posterior mean of the member's offset and slopes (works from 1 rating), then
   personal weights on all 160 columns for what is left, shrunk to zero (ridge penalty 300): a hierarchical ridge.
3. From 20 ratings on, blended with per-member boosted trees (baseline columns + text columns), weight 0.5 * n / (n + 100).
Output is continuous. h_shape.py / h_round.py give the whole-number conventions for comparison with badscores.
"""
import h_text
predict = h_text.predict
