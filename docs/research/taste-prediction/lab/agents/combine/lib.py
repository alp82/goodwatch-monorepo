"""combine: shared rating-free features and the per-fold component cache used by the experiments."""
import os, sys, pickle, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); LAB = os.path.dirname(os.path.dirname(HERE))
for p in (LAB, os.path.join(LAB, 'baselines'), os.path.join(LAB, 'agents', 'badscores'), os.path.join(LAB, 'agents', 'people'),
          os.path.join(LAB, 'agents', 'structure')):
    if p not in sys.path: sys.path.append(p)
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import StratifiedKFold, KFold
_F = {}
def feats(D):
    """base = baselines/gbm_facts (112 cols), facts = people's extra structured facts (35), text = text agent's 51 columns."""
    if not _F:
        import pf, pf2, common
        S = pf.static(D); S2 = pf2.static2(D); EN = S['extra_names']; E = S['extra']
        z = np.load(os.path.join(LAB, 'agents', 'text', 'text_feats.npz'))
        text = np.c_[z['flags'], z['pca_en'], z['tags_svd'][:, :16], z['tfidf_svd']].astype(float)
        B = S['base']; Bs = np.where(np.isnan(B), np.nanmean(B, 0), B); Bs = (Bs - Bs.mean(0)) / (Bs.std(0) + 1e-9)
        _F.update(base=B, facts=E, text=text, facts_mono=[EN.index(k) for k in ('gw_user', 'gw_official', 'mc_user')],
                  seq=np.c_[E[:, EN.index('kw_sequel')], np.nan_to_num(S2['fr'][:, 2]) / 10.0], series=S['G']['series'],
                  scores=common.scores(D), Z=D.Z, lin_facts=Bs / np.sqrt(Bs.shape[1]), en=z['en'].astype(float), tags=z['tags_svd'].astype(float))
    return _F
def matrix(D, facts=False, text=False):
    F = feats(D); key = ('X', facts, text)
    if key not in _F:
        parts = [F['base']] + ([F['facts']] if facts else []) + ([F['text']] if text else [])
        mono = np.zeros(sum(p.shape[1] for p in parts), int); mono[74:80] = 1
        if facts: mono[[112 + i for i in F['facts_mono']]] = 1
        _F[key] = (np.hstack(parts), mono)
    return _F[key]
class G(HistGradientBoostingRegressor):
    """columns with no observed value in the training rows are dropped (sklearn's binning fails on them)"""
    def fit(self, X, y):
        self.keep_ = ~np.isnan(X).all(0)
        if self.monotonic_cst is not None: self.monotonic_cst = np.asarray(self.monotonic_cst)[self.keep_]
        return super().fit(X[:, self.keep_], y)
    def predict(self, X): return super().predict(X[:, self.keep_])
def gbm(mono=None, cs=False, **kw):
    p = dict(max_depth=3, max_iter=200 if cs else 150, learning_rate=0.05, min_samples_leaf=8, l2_regularization=1.0, random_state=3)
    if cs: p['max_features'] = 0.5
    p.update(kw); return G(monotonic_cst=mono, **p)
ALPHAS = np.logspace(-1, 4, 16)
def ridge_loo(A, t, Bm):
    """Dual ridge, penalty by leave-one-out error: (test predictions, leave-one-out train predictions). From agents/text/best.py."""
    m = t.mean(); t = t - m; w, V = np.linalg.eigh(A @ A.T); Vt = V.T @ t; V2 = V ** 2; best = None
    for a in ALPHAS:
        d = 1 / (np.maximum(w, 0) + a); c = V @ (d * Vt); loo = c / (V2 @ d); e = (loo ** 2).mean()
        if best is None or e < best[0]: best = (e, c, loo)
    return (Bm @ A.T) @ best[1] + m, t - best[2] + m
def splits(D, user, seed, folds=None):
    idx, y = D.of(user); folds = folds or (10 if user == D.owner else 5)
    band = np.where(y <= 5, 0, np.where(y <= 7, 1, 2))
    if np.bincount(band, minlength=3)[np.unique(band)].min() < folds: band = np.zeros(len(y), int)
    return idx, y, list(StratifiedKFold(folds, shuffle=True, random_state=seed).split(idx, band))
def inner(tr_idx, k=5): return list(KFold(k, shuffle=True, random_state=1).split(tr_idx))
def series_effect(Gs, tr_idx, r, rows, own, k=1.0):
    """member's shrunk mean residual on the other rated films of the same franchise (leave-one-out when own is given)"""
    s = {}
    for i, ri in zip(tr_idx, r):
        for e, w in Gs[i]:
            a = s.setdefault(e, [0.0, 0.0]); a[0] += ri; a[1] += 1
    out = np.zeros(len(rows))
    for a, i in enumerate(rows):
        for e, w in Gs[i]:
            v = s.get(e)
            if v is None: continue
            sr, n = v
            if own is not None: sr -= own[a]; n -= 1
            if n > 0: out[a] = sr / (n + k)
    return out
