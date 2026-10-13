"""BP: vote count. Ranking only: no score, so the harness calibrates one from the member's history.

rank    log10 of the title's GoodWatch vote count; a title without a count ranks below every title with one
"""
import numpy as np


def predict(view):
    votes = view['titles']['num']['goodwatch_overall_score_voting_count'][view['targets']['title']]
    return {'rank': np.where(votes > 0, np.log10(np.maximum(votes, 1)), -1.0), 'score': None, 'p_low': None}
