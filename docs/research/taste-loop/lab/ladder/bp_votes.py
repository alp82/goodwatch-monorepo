"""BP: vote count. Ranking only: no score, so the harness calibrates one from the member's history.

rank    the percentile of the title's GoodWatch vote count among the vote counts of the reference pool (the share
        of pool titles with fewer votes, a tie counting a half; 0..1, the same scale in every view). A title
        without a count gets 0 and so ranks below every title with one.
"""
import numpy as np


def predict(view):
    titles = view['titles']
    votes = titles['num']['goodwatch_overall_score_voting_count']
    pool = np.sort(votes[titles['in_pool'] & (votes > 0)])
    mine = votes[view['targets']['title']]
    if len(pool) == 0:
        return {'rank': np.where(mine > 0, 0.5, 0.0), 'score': None, 'p_low': None}
    rank = (np.searchsorted(pool, mine, 'left') + np.searchsorted(pool, mine, 'right')) / (2.0 * len(pool))
    return {'rank': np.where(mine > 0, rank, 0.0), 'score': None, 'p_low': None}
