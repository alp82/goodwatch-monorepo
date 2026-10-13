"""B1: the GoodWatch score plus the member's offset, shrunk toward the population's. The calibrated public score.

g       the title's GoodWatch score on the 1 to 10 scale (goodwatch_overall_score_normalized_percent / 10)
offset  (sum over the member's ratings of (rating - g) + 3 * population offset) / (ratings + 3)
        population offset: the mean of (rating - g) over every other member's ratings
        3 is the pseudo-count pool.py uses for a member's offset; it was not tuned here
score   g + offset; for a title without a GoodWatch score, the member's median (rung B0)
rank    the score
"""
import numpy as np

PSEUDO = 3.0


def predict(view):
    g = view['titles']['num']['goodwatch_overall_score_normalized_percent'] / 10.0
    mine, others = view['me']['ratings'], view['others']['ratings']
    d = others['score'] - g[others['title']]
    population = float(np.nanmean(d)) if np.isfinite(d).any() else 0.0
    d = mine['score'] - g[mine['title']]
    ok = np.isfinite(d)
    offset = (d[ok].sum() + PSEUDO * population) / (ok.sum() + PSEUDO)
    median = float(np.median(mine['score'])) if len(mine['score']) else 7.0
    score = g[view['targets']['title']] + offset
    score = np.where(np.isfinite(score), score, median)
    return {'rank': score, 'score': score, 'p_low': None}
