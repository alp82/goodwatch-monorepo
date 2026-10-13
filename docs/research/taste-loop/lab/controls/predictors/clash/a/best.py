"""Name-clash control, file one of two named best.py: every target gets a score of 1."""
import numpy as np


def predict(view):
    n = len(view['targets']['title'])
    return {'rank': np.zeros(n), 'score': np.full(n, 1.0), 'p_low': None}
