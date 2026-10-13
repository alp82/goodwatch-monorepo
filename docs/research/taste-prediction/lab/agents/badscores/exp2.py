from lib import *
import pickle, time
from sklearn.linear_model import LogisticRegression
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
D = Data(); X = features(D); idx, y = D.of(D.owner)
KS = np.arange(1, 11)
def band(y): return np.where(y <= 5, 0, np.where(y <= 7, 1, 2))
def cum_to_dist(cum, ty, n):
    ks = sorted(cum); C = np.zeros((n, 11)); C[:, 10] = 1; prev = np.zeros(n)
    for k in range(1, 10):
        if k in cum: prev = np.maximum(prev, cum[k])
        elif k > max(ks): prev = np.maximum(prev, 1.0 * (k >= ty.max()))
        C[:, k] = prev
    return np.diff(C, axis=1)
def ordinal_dist(tr, ty, te, make, Xm=X, bags=0, seed=0):
    ks = [k for k in range(2, 10) if 8 <= (ty <= k).sum() <= len(ty) - 8]
    if not ks: 
        return np.tile(np.bincount(ty.astype(int), minlength=11)[1:] / len(ty), (len(te), 1))
    cum = {}
    rng = np.random.default_rng(seed)
    for k in ks:
        if bags:
            acc = 0
            for b in range(bags):
                s = rng.integers(0, len(tr), len(tr))
                if (ty[s] <= k).min() == (ty[s] <= k).max(): acc = acc + (ty <= k).mean(); continue
                acc = acc + make().fit(Xm[tr[s]], ty[s] <= k).predict_proba(Xm[te])[:, 1]
            cum[k] = acc / bags
        else: cum[k] = make().fit(Xm[tr], ty <= k).predict_proba(Xm[te])[:, 1]
    return cum_to_dist(cum, ty, len(te))
def wk_of(ty, a):
    b = band(ty); c = np.bincount(b, minlength=3).astype(float); w = (len(ty) / (3 * np.maximum(c, 1))) ** a; return w[band(KS)]
def wmedian(Pd, wk, q=0.5):
    """continuous weighted quantile: rating k spread uniformly over [k-.5, k+.5]"""
    W = Pd * wk; W = W / W.sum(1, keepdims=True); C = np.cumsum(W, 1); out = np.zeros(len(W))
    for i in range(len(W)):
        k = int(np.searchsorted(C[i], q)); k = min(k, 9); lo = C[i, k - 1] if k else 0.0
        out[i] = (k + 1) - 0.5 + (q - lo) / max(W[i, k], 1e-12)
    return np.clip(out, 1, 10)
makers = {
 'hgc': lambda: gbc(max_iter=100),
 'hgc_small': lambda: gbc(max_iter=60, max_depth=2),
 'hgc_mono': lambda: gbc(max_iter=100, monotonic_cst=[0]*74 + [-1]*6 + [0]*(X.shape[1]-80)),
 'logit': lambda: make_pipeline(SimpleImputer(strategy='median'), StandardScaler(), LogisticRegression(C=0.02, max_iter=500)),
}
OUT = {}
for nm, bags in (('hgc', 0), ('hgc_small', 0), ('hgc_mono', 0), ('logit', 0), ('hgc', 5)):
    t0 = time.time(); key = nm + ('_bag%d' % bags if bags else '')
    store = []
    def f(D, u, tr, ty, te):
        Pd = ordinal_dist(tr, ty, te, makers[nm], bags=bags); store.append((te, Pd, ty)); return Pd @ KS
    P, _ = multi(D, f, D.owner); show(key + ' mean', P, y)
    # rebuild per-seed dist arrays aligned to y order
    pos = {t: i for i, t in enumerate(idx)}; dists = []; 
    for s in range(3):
        A = np.zeros((len(y), 10)); Wk = {}
        for te, Pd, ty in store[s*10:(s+1)*10]:
            ii = [pos[t] for t in te]; A[ii] = Pd
            for a in (0, .25, .5, .75, 1.0): Wk.setdefault(a, np.zeros((len(y), 10)))[ii] = wk_of(ty, a)
        dists.append((A, Wk))
    OUT[key] = dists
    for a in (0, .25, .5, .75, 1.0):
        show('%s wmedian a=%.2f' % (key, a), [wmedian(A, Wk[a]) for A, Wk in dists], y)
    print('   [%.0fs]' % (time.time() - t0), flush=True)
pickle.dump((OUT, y), open('exp2.pkl', 'wb'))
