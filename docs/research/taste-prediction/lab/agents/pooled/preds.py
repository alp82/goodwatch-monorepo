"""Named predictors used in the learning curves and the harness runs."""
import os, sys, numpy as np, warnings
warnings.filterwarnings('ignore')
HERE = os.path.dirname(os.path.abspath(__file__)); LAB = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(LAB, 'baselines'))
import pool, gbm_facts, ridge_fp, everyone
from sklearn.linear_model import RidgeCV
_g = {}
def const(D, user, tr_idx, tr_y, te_idx): return np.full(len(te_idx), np.mean(tr_y))
def everyone_raw(D, user, tr_idx, tr_y, te_idx):
    """The public GoodWatch score as shown on the site, on the 1-10 scale. Uses nothing about the member."""
    if 'g' not in _g: _g['g'] = np.array([x['goodwatch_overall_score_normalized_percent'] or 60 for x in D.info], dtype=float) / 10
    return _g['g'][te_idx]
def everyone_shift(D, user, tr_idx, tr_y, te_idx):
    """Public score moved by the member's average distance from it (one personal number)."""
    everyone_raw(D, user, tr_idx, tr_y, te_idx[:0]); g = _g['g']; n = len(tr_y)
    return g[te_idx] + np.mean(tr_y - g[tr_idx])
def everyone_fit(D, user, tr_idx, tr_y, te_idx):
    return everyone.predict(D, user, tr_idx, tr_y, te_idx) if len(tr_y) >= 3 else const(D, user, tr_idx, tr_y, te_idx)
def ridge_all(D, user, tr_idx, tr_y, te_idx):
    """Plain per-member ridge on the same columns the pooled model sees (penalty by leave-one-out)."""
    X = pool.feats(D, 'all')[0]
    return RidgeCV(alphas=np.logspace(1, 4.5, 15)).fit(X[tr_idx], tr_y).predict(X[te_idx])
def gbm(D, user, tr_idx, tr_y, te_idx):
    try: return gbm_facts.predict(D, user, tr_idx, tr_y, te_idx)
    except ValueError: return const(D, user, tr_idx, tr_y, te_idx)   # sklearn fails when a column is missing in every visible title (tiny histories)
pooled = pool.make(k=0, own=300.)                     # hierarchical ridge: consensus + member offset/slope + shrunk personal weights
pooled_cal = pool.make(k=0)                           # consensus with the member's offset and slope only (2 personal numbers)
def blend(a, b, half=100.0, top=0.5):
    def f(D, user, tr_idx, tr_y, te_idx):
        l = top * len(tr_y) / (len(tr_y) + half)
        if len(tr_y) < 20: return a(D, user, tr_idx, tr_y, te_idx)
        return (1 - l) * a(D, user, tr_idx, tr_y, te_idx) + l * b(D, user, tr_idx, tr_y, te_idx)
    return f
pooled_gbm = blend(pooled, gbm)
