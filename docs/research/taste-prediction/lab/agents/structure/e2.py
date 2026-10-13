import numpy as np, sys
from lab import ev, data
from sklearn.linear_model import RidgeCV, Ridge
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from sklearn.kernel_ridge import KernelRidge
from sklearn.model_selection import GridSearchCV
D = data(); K = D.fp_keys; Z = D.Z
AL = np.logspace(0, 4, 13)
def blocks(Xs, scales):  # ridge with per-block penalty via scaling
    return np.hstack([x * s for x, s in zip(Xs, scales)])
def fitpred(X, tr, y, te, al=AL): return RidgeCV(alphas=al).fit(X[tr], y).predict(X[te])
# additive: quadratic
Zc = np.clip(Z, -3, 3)
def quad(s):
    X = blocks([Zc, Zc**2 - 1], [1, s]); return lambda D, u, tr, y, te: fitpred(X, tr, y, te)
# additive: hinges at -0.7, 0, 0.7
def hinge(s):
    X = blocks([Zc] + [np.maximum(Zc - k, 0) for k in (-0.7, 0.0, 0.7)], [1, s, s, s]); return lambda D, u, tr, y, te: fitpred(X, tr, y, te)
# low-rank interactions: products of PCA components
def pcaint(k, s):
    P = PCA(k, random_state=0).fit_transform(Z); P /= P.std(0)
    iu = np.triu_indices(k, 0); Q = (P[:, :, None] * P[:, None, :])[:, iu[0], iu[1]]; Q = (Q - Q.mean(0)) / Q.std(0)
    X = blocks([Z, Q], [1, s]); return lambda D, u, tr, y, te: fitpred(X, tr, y, te)
# mixture of experts with unsupervised soft gate
def moe(k, T, so, ss):
    km = KMeans(k, n_init=5, random_state=0).fit(Z); d = km.transform(Z) ** 2
    G = np.exp(-(d - d.min(1, keepdims=True)) / (T * 74)); G /= G.sum(1, keepdims=True)
    Gc = G - G.mean(0)
    X = blocks([Z, Gc] + [G[:, [j]] * Z for j in range(k)], [1, so] + [ss] * k); return lambda D, u, tr, y, te: fitpred(X, tr, y, te)
# metric learning: RBF kernel on ridge-weighted attributes + linear part
def metric(gam, lam, pw=1.0):
    def f(D, u, tr, y, te):
        m = RidgeCV(alphas=AL).fit(Z[tr], y); w = np.abs(m.coef_) ** pw; w = w / np.sqrt((w**2).sum())
        r = y - m.predict(Z[tr]); A, B = Z[tr] * w, Z[te] * w
        kr = KernelRidge(kernel='rbf', gamma=gam, alpha=lam).fit(A, r)
        return m.predict(Z[te]) + kr.predict(B)
    return f
def krr(gam, lam):
    def f(D, u, tr, y, te):
        mu = y.mean(); return mu + KernelRidge(kernel='rbf', gamma=gam / 74, alpha=lam).fit(Z[tr], y - mu).predict(Z[te])
    return f
which = sys.argv[1]
if which == 'add':
    for s in (0.1, 0.3, 1): ev(quad(s), f'quad s={s}')
    for s in (0.1, 0.3, 1): ev(hinge(s), f'hinge s={s}')
if which == 'int':
    for k in (5, 10, 15):
        for s in (0.1, 0.3): ev(pcaint(k, s), f'pcaint k={k} s={s}')
if which == 'moe':
    for k in (2, 3, 5):
        for T in (0.2, 1.0):
            for so, ss in ((1, 0.1), (1, 0.3), (3, 0)): ev(moe(k, T, so, ss), f'moe k={k} T={T} off={so} slope={ss}')
if which == 'ker':
    for g in (0.3, 1, 3):
        for l in (1, 3, 10): ev(krr(g, l), f'krr g={g} l={l}')
    for g in (0.3, 1, 3):
        for l in (3, 10, 30): ev(metric(g, l), f'metric g={g} l={l}')
