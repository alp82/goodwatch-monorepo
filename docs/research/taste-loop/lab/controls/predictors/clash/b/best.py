"""Name-clash control, file two of two named best.py: every target gets a score of 10."""
import numpy as np


def predict(view):
    n = len(view['targets']['title'])
    return {'rank': np.zeros(n), 'score': np.full(n, 10.0), 'p_low': None}
