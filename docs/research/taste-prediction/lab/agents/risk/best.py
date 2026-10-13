"""risk agent's best predictor: the pooled point prediction, a ten-way rating distribution, and the alpha 0.5 decision.

    predict(D, user, tr_idx, tr_y, te_idx)            whole-number-like prediction (band-weighted median, alpha 0.5)   <- harness entry
    distribution(D, user, tr_idx, tr_y, te_idx)       n x 10, P(rating = 1..10) per title, rows sum to 1
    risk(D, user, tr_idx, tr_y, te_idx, at_most=5)    P(rating <= at_most): the risk of disappointment
    score(D, user, tr_idx, tr_y, te_idx)              the continuous point prediction (agents/pooled/best.py), best for ranking

How the distribution is built
  1. Point score: agents/pooled/best.py (hierarchical ridge across members + per-member boosted trees), unchanged.
  2. The same score out-of-fold on the member's visible ratings (5 inner folds).
  3. A proportional-odds model on that one number: P(rating <= k) = sigmoid(theta_k - a * score); nine thresholds theta_k (how the
     member uses the scale) and one sharpness a. Ten numbers per member instead of the eighteen of nine separate logistic fits.
  4. 3% of the member's own rating histogram is mixed in, so no rating has probability zero.
  5. Decision: the rating that minimises expected absolute error when bad (1-5), middle (6-7) and high (8-10) titles count
     (1 / band share)^0.5 (badscores agent), ties broken with 15% of the continuous score.
Nothing but the score enters the distribution, on purpose: 13 pre-specified inputs (source disagreement, audience minus critics,
vote counts, missing sources, hype, season decline, sequel, kinds, linear-vs-trees disagreement) were each tested as a shift, a spread
and a low-tail effect on the owner and 22 other members; none improved log loss or Brier (REPORT.md). INPUTS below is the hook to
add one if a later, better input passes that test.
Only tr_idx / tr_y are used for the member; other members enter through the pooled point score only.
"""
import os, sys, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path: sys.path.insert(0, HERE)
import common, om
ALPHA, EPS, LAM, CAP = 0.5, 0.03, 0.15, 8.0
KS = np.arange(1, 11)
_last = {}

def _fit(D, user, tr_idx, tr_y, te_idx):
    tr_idx = np.asarray(tr_idx); te_idx = np.asarray(te_idx); y = np.asarray(tr_y, dtype=float)
    key = (user, tr_idx.tobytes(), y.tobytes(), te_idx.tobytes())
    if _last.get('key') != key:
        n = len(y); ol, ot, pl, pt = common.inner_parts(D, user, tr_idx, y, te_idx)
        o = common.blend(ol, ot, int(n * 0.8)); p = common.blend(pl, pt, n)       # same blend rule as pooled/best.py
        _last['key'] = key; _last['val'] = (np.clip(o, 1, 10), np.clip(p, 1, 10), y)
    return _last['val']

def score(D, user, tr_idx, tr_y, te_idx): return _fit(D, user, tr_idx, tr_y, te_idx)[1]

def distribution(D, user, tr_idx, tr_y, te_idx):
    """P(rating = 1..10) per title, n x 10, rows sum to 1."""
    o, p, y = _fit(D, user, tr_idx, tr_y, te_idx)
    prior = np.bincount(y.astype(int), minlength=11)[1:] + 0.5; prior = prior / prior.sum()
    if len(y) < 15 or np.std(y) == 0: return np.tile(prior, (len(p), 1))            # too few ratings for thresholds: the member's histogram
    m = om.fit(o, y, use_c=False)
    return (1 - EPS) * om.dist(m, p, np.zeros((len(p), 0)), np.zeros((len(p), 0)), np.zeros((len(p), 0))) + EPS * prior

def risk(D, user, tr_idx, tr_y, te_idx, at_most=5):
    """P(rating <= at_most) per title."""
    return distribution(D, user, tr_idx, tr_y, te_idx)[:, :at_most].sum(1)

def decide(Pd, tr_y, alpha, tie):
    y = np.asarray(tr_y); band = lambda v: np.where(v <= 5, 0, np.where(v <= 7, 1, 2))
    c = np.bincount(band(y), minlength=3).astype(float); wk = (np.minimum(len(y) / (3 * np.maximum(c, 1)), CAP) ** alpha)[band(KS)]
    W = Pd * wk; med = KS[(W[:, :, None] * np.abs(KS[None, None, :] - KS[None, :, None])).sum(1).argmin(1)]
    return (1 - LAM) * med + LAM * tie

def predict(D, user, tr_idx, tr_y, te_idx, alpha=ALPHA):
    return decide(distribution(D, user, tr_idx, tr_y, te_idx), tr_y, alpha, score(D, user, tr_idx, tr_y, te_idx))
