"""combine: one model, two operating points, and a full rating distribution per title.

    predict(D, user, tr_idx, tr_y, te_idx)            balanced operating point (alpha 0.5)          <- this file through the harness
    predict(..., alpha=0.75)                          "owner" operating point (owner.py)
    distribution(D, user, tr_idx, tr_y, te_idx)       n x 10 array, P(rating = 1..10) per title
    risk(D, user, tr_idx, tr_y, te_idx, at_most=5)    P(rating <= at_most): the "risk of disappointment"
    score(D, user, tr_idx, tr_y, te_idx)              the continuous score before the output shape (mean-like, best for ranking)

What is inside (each piece kept because it paid in repeated cross-validation, see REPORT.md):
  1. Boosted trees on the baseline's 112 columns + the text agent's 51 text columns; the six public scores may only raise the
     prediction (monotone) and each split sees half the columns (people agent's regularisation).
  2. Three linear models of the member (public scores then fingerprint on the residual; full English text embedding; tag space),
     stacked with the trees by non-negative weights on out-of-fold predictions; the stack gets weight 300 / (n + 300).
  3. A franchise stage on what is left: sequel keyword, years since the first film, and the member's own shrunk franchise effect.
  4. Output shape: P(rating <= k | score) from one small logistic model per threshold, fitted on the out-of-fold scores from
     steps 1 to 3 (no extra tree fits: the same inner folds serve the stack, the franchise stage and the distribution).
     The answer is the band-weighted median (alpha: how much the rare bands count), ties broken by the continuous score.
Only tr_idx / tr_y are used for the member. No other member's ratings are used. Needs agents/text/text_feats.npz and baselines/gbm_facts.py.
"""
import os, sys, numpy as np
from scipy.optimize import nnls
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import RidgeCV, Ridge, LogisticRegression
from sklearn.model_selection import KFold
HERE = os.path.dirname(os.path.abspath(__file__)); LAB = os.path.dirname(os.path.dirname(HERE))
sys.path.append(os.path.join(LAB, 'baselines'))
ALPHA_BALANCED, ALPHA_OWNER = 0.5, 0.75
EPS = 0.03            # share of the member's own rating histogram mixed into every distribution (no zero probabilities)
C0, FR_ALPHA, LAM, CAP = 300.0, 30.0, 0.15, 8.0
KS = np.arange(1, 11); AL = np.logspace(-1, 4, 16)
SCORES = ['goodwatch_overall_score_normalized_percent', 'imdb_user_score_normalized_percent', 'metacritic_meta_score_normalized_percent',
          'rotten_tomatoes_tomato_score_normalized_percent', 'rotten_tomatoes_audience_score_normalized_percent', 'tmdb_user_score_normalized_percent']
_S = {}; _last = {}

def _static(D):
    if not _S:
        import gbm_facts
        z = np.load(os.path.join(LAB, 'agents', 'text', 'text_feats.npz'))
        X = np.c_[gbm_facts.features(D), z['flags'], z['pca_en'], z['tags_svd'][:, :16], z['tfidf_svd']].astype(float)
        mono = np.zeros(X.shape[1], int); mono[74:80] = 1
        f = lambda v: np.nan if v is None else float(v)
        S = np.array([[f(x[c]) for c in SCORES] for x in D.info]); S = np.where(np.isnan(S), np.nanmedian(S, 0), S); S = (S - S.mean(0)) / S.std(0)
        first = {}
        for x in D.info:
            s = x.get('movie_series_id')
            if s is not None: first[s] = min(first.get(s, 9999), x.get('release_year') or 9999)
        seq = np.array([[float('sequel' in (x.get('keywords') or [])),
                         ((x.get('release_year') or 9999) - first[x['movie_series_id']]) / 10.0 if x.get('movie_series_id') is not None else 0.0] for x in D.info])
        _S.update(X=X, mono=mono, S=S, Z=D.Z, en=z['en'].astype(float), tags=z['tags_svd'].astype(float), seq=seq,
                  series=[x.get('movie_series_id') for x in D.info])
    return _S

def _trees(S, Xa, y, Xb):
    keep = ~np.isnan(Xa).all(0)       # sklearn's binning fails on columns with no observed value
    return HistGradientBoostingRegressor(max_depth=3, max_iter=200, learning_rate=0.05, min_samples_leaf=8, l2_regularization=1.0, max_features=0.5,
                                         monotonic_cst=S['mono'][keep], random_state=3).fit(Xa[:, keep], y).predict(Xb[:, keep])
def _quality_taste(S, tr, y, te):
    """public scores first, the 74 attributes on what the scores leave unexplained (structure agent)"""
    m1 = RidgeCV(alphas=AL).fit(S['S'][tr], y); m2 = RidgeCV(alphas=AL).fit(S['Z'][tr], y - m1.predict(S['S'][tr]))
    return m1.predict(S['S'][te]) + m2.predict(S['Z'][te])
def _ridge_loo(A, t, B):
    """dual ridge, penalty chosen by leave-one-out error: (test predictions, leave-one-out train predictions) (text agent)"""
    m = t.mean(); t = t - m; w, V = np.linalg.eigh(A @ A.T); Vt = V.T @ t; V2 = V ** 2; best = None
    for a in AL:
        d = 1 / (np.maximum(w, 0) + a); c = V @ (d * Vt); loo = c / (V2 @ d); e = (loo ** 2).mean()
        if best is None or e < best[0]: best = (e, c, loo)
    return (B @ A.T) @ best[1] + m, t - best[2] + m
def _franchise(S, tr_idx, r, rows, own, k=1.0):
    """the member's shrunk mean leftover on their other rated titles of the same franchise (a title never sees its own rating)"""
    s = {}
    for i, ri in zip(tr_idx, r):
        e = S['series'][i]
        if e is not None: a = s.setdefault(e, [0.0, 0]); a[0] += ri; a[1] += 1
    out = np.zeros(len(rows))
    for a, i in enumerate(rows):
        v = s.get(S['series'][i])
        if v is None: continue
        sr, n = v
        if own is not None: sr -= own[a]; n -= 1
        if n > 0: out[a] = sr / (n + k)
    return out

def _fit(D, user, tr_idx, tr_y, te_idx):
    """(out-of-fold score on the visible ratings, score for the titles to predict)"""
    tr_idx = np.asarray(tr_idx); te_idx = np.asarray(te_idx); y = np.asarray(tr_y, dtype=float)
    key = (user, tr_idx.tobytes(), y.tobytes(), te_idx.tobytes())
    if _last.get('key') == key: return _last['val']
    S = _static(D); X = S['X']; n = len(y); m = y.mean()
    o = np.zeros(n); ol = np.zeros(n)
    for a, b in KFold(5, shuffle=True, random_state=1).split(tr_idx):
        o[b] = _trees(S, X[tr_idx[a]], y[a], X[tr_idx[b]]); ol[b] = _quality_taste(S, tr_idx[a], y[a], tr_idx[b])
    p = _trees(S, X[tr_idx], y, X[te_idx])
    O, P = [o - m, ol - m], [p - m, _quality_taste(S, tr_idx, y, te_idx) - m]
    for M in (S['en'], S['tags']):
        pt, loo = _ridge_loo(M[tr_idx], y, M[te_idx]); O.append(loo - m); P.append(pt - m)
    O = np.array(O).T; P = np.array(P).T; w = nnls(O, y - m)[0]; l = n / (n + C0)
    o = l * o + (1 - l) * (m + O @ w); p = l * p + (1 - l) * (m + P @ w)
    r = y - o; g = np.sqrt(FR_ALPHA)      # the franchise effect is already shrunk: light penalty; the two sequel facts get FR_ALPHA
    A = np.c_[S['seq'][tr_idx], g * _franchise(S, tr_idx, r, tr_idx, r)]; B = np.c_[S['seq'][te_idx], g * _franchise(S, tr_idx, r, te_idx, None)]
    f = Ridge(alpha=FR_ALPHA).fit(A, r)
    _last['key'] = key; _last['val'] = (np.clip(o + f.predict(A), 1, 10), np.clip(p + f.predict(B), 1, 10), y)
    return _last['val']

def score(D, user, tr_idx, tr_y, te_idx): return _fit(D, user, tr_idx, tr_y, te_idx)[1]

def distribution(D, user, tr_idx, tr_y, te_idx):
    """P(rating = 1..10) per title, n x 10, rows sum to 1."""
    o, p, y = _fit(D, user, tr_idx, tr_y, te_idx); n = len(p)
    C = np.zeros((n, 11)); C[:, 10] = 1; prev = np.zeros(n)
    for k in range(1, 10):
        t = y <= k; c = np.full(n, t.mean())                       # thresholds too rare to learn: the member's base rate
        if 5 <= t.sum() <= len(t) - 5:
            mdl = LogisticRegression(C=10).fit(o[:, None], t)
            if mdl.coef_[0, 0] < 0: c = mdl.predict_proba(p[:, None])[:, 1]   # a higher score must never raise P(rating <= k)
        prev = np.maximum(prev, c); C[:, k] = prev
    prior = (np.bincount(y.astype(int), minlength=11)[1:] + 0.5); prior = prior / prior.sum()
    return (1 - EPS) * np.diff(C, axis=1) + EPS * prior

def risk(D, user, tr_idx, tr_y, te_idx, at_most=5):
    """P(rating <= at_most) per title: the risk of disappointment to show beside the score."""
    return distribution(D, user, tr_idx, tr_y, te_idx)[:, :at_most].sum(1)

def decide(Pd, tr_y, alpha, tie):
    """the rating that minimises expected absolute error when bad (1-5), middle (6-7), high (8-10) count (1 / band share)^alpha (badscores agent)"""
    y = np.asarray(tr_y); band = lambda v: np.where(v <= 5, 0, np.where(v <= 7, 1, 2))
    c = np.bincount(band(y), minlength=3).astype(float); wk = (np.minimum(len(y) / (3 * np.maximum(c, 1)), CAP) ** alpha)[band(KS)]
    W = Pd * wk; med = KS[(W[:, :, None] * np.abs(KS[None, None, :] - KS[None, :, None])).sum(1).argmin(1)]
    return (1 - LAM) * med + LAM * tie

def predict(D, user, tr_idx, tr_y, te_idx, alpha=ALPHA_BALANCED):
    return decide(distribution(D, user, tr_idx, tr_y, te_idx), tr_y, alpha, score(D, user, tr_idx, tr_y, te_idx))
