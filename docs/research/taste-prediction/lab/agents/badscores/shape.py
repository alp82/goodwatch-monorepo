"""badscores: make the same features produce real scores (rating distribution + band-weighted median).

Reuse from any agent's predictor (sys.path.insert(0, '<lab>/agents/badscores'); import shape):

    # A. you have a title feature matrix Xm (rows = D title rows, NaN allowed) and optionally a point predictor
    #    fit_predict(tr_idx, tr_y, te_idx) -> scores   (any model, may use D.others etc.):
    pred = shape.shape_predict(Xm, tr_idx, tr_y, te_idx, alpha=0.5, mono=None, fit_predict=None)
    # B. you only have a point predictor (no feature matrix):
    pred = shape.shape_point(fit_predict, tr_idx, tr_y, te_idx, alpha=0.5)
    # C. you already have a distribution Pd (n x 10, P(rating = 1..10)):
    pred = shape.decide(Pd, tr_y, alpha=0.5)

How it works
  1. Distribution. One classifier per threshold k answers "will the rating be k or lower?" (cumulative / ordinal model).
     Three such estimators are averaged: boosted trees on the features, a strongly regularised logistic model on the
     features, and a logistic model on the out-of-fold score of a point predictor. Result: P(rating = 1..10) per title.
  2. Decision. The prediction is the rating that minimises the expected absolute error when bad (1-5), middle (6-7) and
     high (8-10) titles count (1 / band share)^alpha. alpha=0 is the plain median (best plain mae), alpha=1 optimises
     macro_mae directly. 15% of the weighted mean is mixed in to break ties, so ranking stays as fine as a regressor's.
"""
import os, sys, numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold
KS = np.arange(1, 11)
ALPHA = float(os.environ.get('SHAPE_ALPHA', 0.5))     # operating point, see REPORT.md
LAM, CAP = 0.15, 8.0

def band(y): return np.where(y <= 5, 0, np.where(y <= 7, 1, 2))

def band_weights(tr_y, alpha):
    """weight of each rating value 1..10: (1 / share of its band)^alpha, capped so a nearly empty band cannot dominate"""
    c = np.bincount(band(tr_y), minlength=3).astype(float)
    w = np.minimum(len(tr_y) / (3 * np.maximum(c, 1)), CAP) ** alpha
    return w[band(KS)]

def _to_dist(cum, tr_y, n):
    C = np.zeros((n, 11)); C[:, 10] = 1; prev = np.zeros(n)
    for k in range(1, 10):
        prev = np.maximum(prev, cum[k] if k in cum else float((tr_y <= k).mean()))   # thresholds too rare to learn: base rate
        C[:, k] = prev
    return np.diff(C, axis=1)                                 # P(rating = k), k = 1..10

def _cum(make, Xm, tr_idx, tr_y, te_idx, least):
    cum = {}
    for k in range(1, 10):
        t = tr_y <= k
        if least <= t.sum() <= len(t) - least: cum[k] = make().fit(Xm[tr_idx], t).predict_proba(Xm[te_idx])[:, 1]
    return _to_dist(cum, tr_y, len(te_idx))

def tree_dist(Xm, tr_idx, tr_y, te_idx, mono=None):
    """mono: per column +1 (higher value cannot lower the rating), -1, or 0."""
    make = lambda: HistGradientBoostingClassifier(max_depth=3, max_iter=50, learning_rate=0.1, min_samples_leaf=8, l2_regularization=1.0,
                                                  monotonic_cst=None if mono is None else [-c for c in mono], random_state=3)
    return _cum(make, Xm, tr_idx, tr_y, te_idx, 8)

_std = {}
def logit_dist(Xm, tr_idx, tr_y, te_idx):
    if id(Xm) not in _std:                                    # standardise once over the catalog: no ratings involved
        med = np.nanmedian(Xm, 0); Xf = np.where(np.isnan(Xm), med, Xm); _std[id(Xm)] = (Xm, (Xf - Xf.mean(0)) / (Xf.std(0) + 1e-9))
    return _cum(lambda: LogisticRegression(C=0.02, max_iter=300), _std[id(Xm)][1], tr_idx, tr_y, te_idx, 8)

def point_dist(fit_predict, tr_idx, tr_y, te_idx, folds=3):
    """P(rating | point score): out-of-fold scores inside the training set, then cumulative logits on the score alone."""
    o = np.zeros(len(tr_y)); b = band(tr_y)
    if np.bincount(b, minlength=3)[np.unique(b)].min() < folds: b = np.zeros(len(tr_y), int)
    for a, c in StratifiedKFold(folds, shuffle=True, random_state=0).split(tr_idx, b): o[c] = fit_predict(tr_idx[a], tr_y[a], tr_idx[c])
    p = np.asarray(fit_predict(tr_idx, tr_y, te_idx), dtype=float); cum = {}
    for k in range(1, 10):
        t = tr_y <= k
        if 5 <= t.sum() <= len(t) - 5: cum[k] = LogisticRegression(C=10).fit(o[:, None], t).predict_proba(p[:, None])[:, 1]
    return _to_dist(cum, tr_y, len(p))

def decide(Pd, tr_y, alpha=ALPHA, lam=LAM):
    wk = band_weights(tr_y, alpha); W = Pd * wk
    cost = W[:, :, None] * np.abs(KS[None, None, :] - KS[None, :, None])
    med = KS[cost.sum(1).argmin(1)]                           # band-weighted median rating
    return (1 - lam) * med + lam * (W @ KS) / W.sum(1)        # + a little weighted mean to break ties

def shape_dist(Xm, tr_idx, tr_y, te_idx, mono=None, fit_predict=None):
    parts = [tree_dist(Xm, tr_idx, tr_y, te_idx, mono), logit_dist(Xm, tr_idx, tr_y, te_idx)]
    if fit_predict is not None: parts.append(point_dist(fit_predict, tr_idx, tr_y, te_idx))
    return sum(parts) / len(parts)

def shape_predict(Xm, tr_idx, tr_y, te_idx, alpha=ALPHA, mono=None, fit_predict=None):
    return decide(shape_dist(Xm, tr_idx, tr_y, te_idx, mono, fit_predict), tr_y, alpha)

def shape_point(fit_predict, tr_idx, tr_y, te_idx, alpha=ALPHA, folds=3):
    return decide(point_dist(fit_predict, tr_idx, tr_y, te_idx, folds), tr_y, alpha)

# ---- the predictor: gbm_facts features; critic and audience scores constrained to never lower the rating
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'baselines'))
def predict(D, user, tr_idx, tr_y, te_idx, alpha=None):
    from gbm_facts import features
    X = features(D); mono = [0] * 74 + [1] * 6 + [0] * (X.shape[1] - 80)
    reg = lambda tr, ty, te: HistGradientBoostingRegressor(max_depth=3, max_iter=150, learning_rate=0.05, min_samples_leaf=8, l2_regularization=1.0,
                                                           monotonic_cst=mono, random_state=3).fit(X[tr], ty).predict(X[te])
    return shape_predict(X, tr_idx, tr_y, te_idx, ALPHA if alpha is None else alpha, mono, reg)
