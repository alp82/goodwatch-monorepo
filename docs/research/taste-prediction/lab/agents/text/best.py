"""text agent's best predictor: the gbm_facts baseline, plus what titles are ABOUT.

1. Boosted trees on the baseline features (74 attributes + title facts) PLUS 51 text features:
   3 sequel flags (TMDB keyword "sequel", numbered/subtitled title, part of a movie series) and the first 16 components each of
   the English text embedding (PCA), the tag space (tropes + keywords + essence-tag words + misc flags, TF-IDF then SVD) and
   the essence_text + synopsis TF-IDF (SVD). All of these are rating-independent and cached in text_feats.npz.
2. Three ridge models fitted on the member's ratings (title facts; full 768-d embedding; 96-d tag space), each with a
   closed-form leave-one-out prediction, stacked with the trees' inner 5-fold out-of-fold prediction by non-negative least squares.
3. Final = l * trees + (1 - l) * stack, l = n / (n + 300) for n visible ratings: members with few ratings lean on the
   stack (steadier), members with many lean on the trees (sharper).
   STACK=False returns the trees alone. TEXT_IN_TREES=False gives the trees only the baseline features.
Only tr_idx/tr_y are used for the member; no other member's ratings are used at all.
"""
import os, sys, re
import numpy as np
from scipy.optimize import nnls
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import KFold
HERE = os.path.dirname(os.path.abspath(__file__))
STACK = True
TEXT_IN_TREES = True
ALPHAS = np.logspace(-1, 4, 16)
_T = None

def _base_features(D):
    f = lambda v: np.nan if v is None else float(v)
    cols = ['goodwatch_overall_score_normalized_percent', 'imdb_user_score_normalized_percent', 'metacritic_meta_score_normalized_percent',
            'rotten_tomatoes_tomato_score_normalized_percent', 'rotten_tomatoes_audience_score_normalized_percent', 'tmdb_user_score_normalized_percent', 'release_year']
    genres = sorted({g for x in D.info for g in (x['genres'] or [])})
    Fm = np.array([[f(x[c]) for c in cols] + [x['media_type'] == 'show', x['original_language_code'] == 'en', x['original_language_code'] == 'ja',
                   np.log10(max(x['goodwatch_overall_score_voting_count'] or 1, 1))] + [g in (x['genres'] or []) for g in genres] for x in D.info], dtype=float)
    return np.hstack([D.Z, Fm])

def _text_feats(D):
    p = os.path.join(HERE, 'text_feats.npz')
    if os.path.exists(p):
        z = np.load(p)
        if len(z['en']) == D.n: return {k: z[k] for k in z.files}
    sys.path.insert(0, HERE); import feats
    Fx = feats.get(D); kw = Fx['keywords'][1].index('sequel')
    seq = np.asarray(Fx['keywords'][0][:, kw].todense()).ravel()
    numt = np.array([bool(re.search(r'(\b[2-9]\b|\bII+\b|\bIV\b|Part |: )', x['title'] or '')) for x in D.info], float)
    ser = np.array([x.get('movie_series_id') is not None for x in D.info], float)
    out = {'flags': np.c_[seq, numt, ser].astype(np.float32), 'en': Fx['emb_text_en_v1'], 'pca_en': Fx['pca_text_en_v1'][:, :16],
           'tags_svd': Fx['tags_svd'], 'tfidf_svd': Fx['tfidf_svd'][:, :16]}
    np.savez(p, **out); return out

def _setup(D):
    global _T
    if _T is None:
        B = _base_features(D); t = _text_feats(D)
        XP = np.c_[B, t['flags'], t['pca_en'], t['tags_svd'][:, :16], t['tfidf_svd']]
        Bs = np.where(np.isnan(B), np.nanmean(B, 0), B); Bs = (Bs - Bs.mean(0)) / (Bs.std(0) + 1e-9)
        _T = {'XP': XP, 'lin': [Bs / np.sqrt(Bs.shape[1]), t['en'].astype(np.float64), t['tags_svd'].astype(np.float64)]}
    return _T

def _gbm(Xa, y, Xb):
    return HistGradientBoostingRegressor(max_depth=3, max_iter=150, learning_rate=0.05, min_samples_leaf=8, l2_regularization=1.0, random_state=3).fit(Xa, y).predict(Xb)

def _ridge_loo(A, t, Bm):
    """Dual ridge, penalty chosen by leave-one-out error. Returns (test predictions, leave-one-out train predictions)."""
    m = t.mean(); t = t - m; w, V = np.linalg.eigh(A @ A.T); Vt = V.T @ t; V2 = V ** 2; best = None
    for a in ALPHAS:
        d = 1 / (np.maximum(w, 0) + a); c = V @ (d * Vt); loo = c / (V2 @ d); e = (loo ** 2).mean()
        if best is None or e < best[0]: best = (e, c, loo)
    return (Bm @ A.T) @ best[1] + m, t - best[2] + m

def predict(D, user, tr_idx, tr_y, te_idx):
    T = _setup(D); XP = T['XP'] if TEXT_IN_TREES else T['XP'][:, :-51]; y = np.asarray(tr_y, dtype=float); m = y.mean()
    p_full = _gbm(XP[tr_idx], y, XP[te_idx])
    if not STACK or len(y) < 20: return np.clip(p_full, 1, 10)
    oof = np.zeros(len(y))
    for a, b in KFold(5, shuffle=True, random_state=1).split(tr_idx): oof[b] = _gbm(XP[tr_idx[a]], y[a], XP[tr_idx[b]])
    P, O = [p_full - m], [oof - m]
    for X in T['lin']:
        p, o = _ridge_loo(X[tr_idx], y, X[te_idx]); P.append(p - m); O.append(o - m)
    w = nnls(np.array(O).T, y - m)[0]
    l = len(y) / (len(y) + 300.0)
    return np.clip(l * p_full + (1 - l) * (m + np.array(P).T @ w), 1, 10)
