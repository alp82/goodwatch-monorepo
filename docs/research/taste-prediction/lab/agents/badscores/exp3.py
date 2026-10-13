from lib import *
from sklearn.model_selection import KFold, StratifiedKFold
from sklearn.linear_model import LogisticRegression
from sklearn.isotonic import IsotonicRegression
from scipy.optimize import minimize
D = Data(); X = features(D); idx, y = D.of(D.owner); KS = np.arange(1, 11)
def band(y): return np.where(y <= 5, 0, np.where(y <= 7, 1, 2))
def bw(y, a=1.0):
    b = band(y); c = np.bincount(b, minlength=3).astype(float); w = (len(y) / (3 * np.maximum(c, 1))) ** a; return w[b] / w[b].mean()
def wk_of(ty, a):
    b = band(ty); c = np.bincount(b, minlength=3).astype(float); w = (len(ty) / (3 * np.maximum(c, 1))) ** a; return w[band(KS)]
def decide(Pd, wk, lam=0.15):
    cost = (Pd * wk)[:, :, None] * np.abs(KS[None, None, :] - KS[None, :, None]); med = KS[cost.sum(1).argmin(1)]
    W = Pd * wk; return (1 - lam) * med + lam * (W @ KS) / W.sum(1)
run = lambda name, f: show(name, multi(D, f, D.owner)[0], y)
base = lambda tr, ty, te: gbm().fit(X[tr], ty).predict(X[te])
def inner_oof(tr, ty, k=5, fit=base):
    o = np.zeros(len(ty))
    for a, b in StratifiedKFold(k, shuffle=True, random_state=0).split(tr, band(ty)): o[b] = fit(tr[a], ty[a], tr[b])
    return o
# ---- post-hoc shapes on a point predictor (inner out-of-fold), cached per fold
_c = {}
def pieces(tr, ty, te):
    key = (tr.tobytes(), te.tobytes())
    if key not in _c: _c[key] = (inner_oof(tr, ty), base(tr, ty, te))
    return _c[key]
def post(kind, a=1.0):
    def f(D, u, tr, ty, te):
        o, p = pieces(tr, ty, te); w = bw(ty, a)
        if kind == 'var': return ty.mean() + (p - o.mean()) * ty.std() / o.std()
        if kind == 'lin':
            r = minimize(lambda z: (w * np.abs(z[0] + z[1] * (o - 7) - ty)).mean(), [7, 1], method='Nelder-Mead'); return r.x[0] + r.x[1] * (p - 7)
        if kind == 'iso': return IsotonicRegression(out_of_bounds='clip').fit(o, ty, sample_weight=w).predict(p)
        if kind == 'qmap': return np.interp(p, np.sort(o), np.sort(ty))
        if kind == 'ord1d':   # cumulative logits on the point prediction alone -> distribution -> weighted median
            C = np.zeros((len(p), 11)); C[:, 10] = 1; prev = np.zeros(len(p))
            for k in range(1, 10):
                t = ty <= k
                if 5 <= t.sum() <= len(t) - 5: prev = np.maximum(prev, LogisticRegression(C=10).fit(o[:, None], t).predict_proba(p[:, None])[:, 1])
                else: prev = np.maximum(prev, t.mean() * 1.0)
                C[:, k] = prev
            return decide(np.diff(C, axis=1), wk_of(ty, a))
    return f
run('base', lambda D,u,tr,ty,te: pieces(tr, ty, te)[1])
run('post: variance match', post('var'))
run('post: quantile map', post('qmap'))
for a in (0.5, 1.0):
    run('post: linear, wMAE a=%.1f' % a, post('lin', a)); run('post: isotonic a=%.1f' % a, post('iso', a)); run('post: ord1d wmedian a=%.1f' % a, post('ord1d', a))
run('post: ord1d wmedian a=0.0', post('ord1d', 0.0))
# ---- band classifier + regressor within band
def bandreg(hard, a):
    def f(D, u, tr, ty, te):
        b = band(ty); pr = gbc(max_iter=100).fit(X[tr], b, sample_weight=bw(ty, a)).predict_proba(X[te])
        loc = np.zeros((len(te), 3))
        for k in range(3):
            m = b == k; loc[:, k] = gbm(max_iter=60, max_depth=2).fit(X[tr[m]], ty[m]).predict(X[te]) if m.sum() >= 30 else ty[m].mean()
        return loc[np.arange(len(te)), pr.argmax(1)] if hard else (pr * loc).sum(1)
    return f
for a in (0.0, 0.5, 1.0):
    run('band clf x regressor soft a=%.1f' % a, bandreg(False, a)); run('band clf -> regressor hard a=%.1f' % a, bandreg(True, a))
# ---- quantile models
def quant(a):
    def f(D, u, tr, ty, te):
        qs = np.arange(0.05, 1, 0.1); Q = np.sort(np.array([gbm(loss='quantile', quantile=q, max_iter=100).fit(X[tr], ty).predict(X[te]) for q in qs]), 0)
        # each quantile is one sample of the predictive distribution; weighted median with band weights
        w = wk_of(ty, a)[np.clip(np.round(Q), 1, 10).astype(int) - 1]; order = np.cumsum(w, 0) / w.sum(0)
        i = (order >= 0.5).argmax(0); return Q[i, np.arange(len(te))]
    return f
for a in (0.0, 1.0): run('quantile models wmedian a=%.1f' % a, quant(a))
run('quantile q=0.35 single', lambda D,u,tr,ty,te: gbm(loss='quantile', quantile=0.35).fit(X[tr], ty).predict(X[te]))
# ---- bagging and monotone on the plain regressor
def bag(D, u, tr, ty, te, n=8):
    rng = np.random.default_rng(0); acc = 0
    for b in range(n): s = rng.integers(0, len(tr), len(tr)); acc = acc + gbm().fit(X[tr[s]], ty[s]).predict(X[te])
    return acc / n
run('bagged x8 regressor', bag)
mono = [0]*74 + [1]*6 + [0]*(X.shape[1]-80)
run('monotone scores regressor', lambda D,u,tr,ty,te: gbm(monotonic_cst=mono).fit(X[tr], ty).predict(X[te]))
# ---- selection signals as weak examples (regressor)
own = set(idx)
sk = np.array([t for u, t in D.signals['skipped'] if u == D.owner and t not in own]); wl = np.array([t for u, t in D.signals['wishlist'] if u == D.owner and t not in own])
def sig(vs, vw, w):
    def f(D, u, tr, ty, te):
        parts = [(tr, ty, np.ones(len(tr)))]
        if vs is not None: parts.append((sk, np.full(len(sk), vs), np.full(len(sk), w)))
        if vw is not None: parts.append((wl, np.full(len(wl), vw), np.full(len(wl), w)))
        I = np.concatenate([q[0] for q in parts]); return gbm().fit(X[I], np.concatenate([q[1] for q in parts]), sample_weight=np.concatenate([q[2] for q in parts])).predict(X[te])
    return f
for vs, vw, w in ((5, None, .25), (5, None, .5), (4, None, .5), (5, None, 1.0), (None, 8, .25), (None, 8, .5), (5, 8, .25), (5, 8, .5), (3, None, .5)):
    run('signals: skipped=%s wishlist=%s w=%.2f' % (vs, vw, w), sig(vs, vw, w))
# skipped-vs-rated propensity as a feature
def prop(D, u, tr, ty, te):
    I = np.concatenate([tr, sk]); t = np.r_[np.zeros(len(tr)), np.ones(len(sk))]
    o = np.zeros(len(I))
    for a, b in StratifiedKFold(5, shuffle=True, random_state=0).split(I, t): o[b] = gbc(max_iter=60).fit(X[I[a]], t[a]).predict_proba(X[I[b]])[:, 1]
    pte = gbc(max_iter=60).fit(X[I], t).predict_proba(X[te])[:, 1]
    return gbm().fit(np.c_[X[tr], o[:len(tr)]], ty).predict(np.c_[X[te], pte])
run('signals: P(skipped) as feature', prop)
