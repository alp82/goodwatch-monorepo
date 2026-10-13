"""B0: the median of the member's ratings so far. The one skill reference.

score   the median of the visible ratings (the harness rounds a half up)
rank    the same for every target: B0 says nothing about order
p_low   the member's own share of ratings of 5 or less so far
Without any rating (never the case in T1): 7 and 0.
"""
import numpy as np


def predict(view):
    y = view['me']['ratings']['score']
    n = len(view['targets']['title'])
    median = float(np.median(y)) if len(y) else 7.0
    low = float((y <= 5).mean()) if len(y) else 0.0
    return {'rank': np.zeros(n), 'score': np.full(n, median), 'p_low': np.full(n, low)}
