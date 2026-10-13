"""Structure on top of: public scores (quality) then fingerprint (taste) on the residual."""
import numpy as np, sys
from lab import ev, data
from e3 import S, F, gw, Z, CR, TA, AL, K
from sklearn.linear_model import RidgeCV
from sklearn.kernel_ridge import KernelRidge
from sklearn.cluster import KMeans
from sklearn.ensemble import HistGradientBoostingRegressor
D = data()
Zc = np.clip(Z, -3, 3)
def chain(*Ms):
    """Each block is a ridge fitted on the residual of the blocks before it."""
    def f(D, u, tr, y, te):
        r = y.copy(); p = np.zeros(len(te))
        for M in Ms:
            m = RidgeCV(alphas=AL).fit(M[tr], r); r = r - m.predict(M[tr]); p += m.predict(M[te])
        return p
    return f
Sh = np.hstack([S] + [np.maximum(S - k, 0) for k in (-1.0, 0.0)] + [S[:, [0]] ** 2])
gs = S.mean(1, keepdims=True)
def kern(g, l):
    def f(D, u, tr, y, te):
        m1 = RidgeCV(alphas=AL).fit(S[tr], y); r = y - m1.predict(S[tr])
        m2 = RidgeCV(alphas=AL).fit(Z[tr], r); r2 = r - m2.predict(Z[tr])
        w = np.abs(m2.coef_); w /= np.sqrt((w ** 2).sum())
        kr = KernelRidge(kernel='rbf', gamma=g, alpha=l).fit(Z[tr] * w, r2)
        return m1.predict(S[te]) + m2.predict(Z[te]) + kr.predict(Z[te] * w)
    return f
def moe(k, T=0.2):
    km = KMeans(k, n_init=5, random_state=0).fit(Z); d = km.transform(Z) ** 2
    G = np.exp(-(d - d.min(1, keepdims=True)) / (T * 74)); G /= G.sum(1, keepdims=True)
    return G
def gbres(depth, it):
    def f(D, u, tr, y, te):
        m1 = RidgeCV(alphas=AL).fit(S[tr], y); r = y - m1.predict(S[tr])
        m2 = RidgeCV(alphas=AL).fit(Z[tr], r); r2 = r - m2.predict(Z[tr])
        X = np.hstack([S, Z]); g = HistGradientBoostingRegressor(max_depth=depth, max_iter=it, learning_rate=0.03, min_samples_leaf=15, l2_regularization=3.0, random_state=0).fit(X[tr], r2)
        return m1.predict(S[te]) + m2.predict(Z[te]) + g.predict(X[te])
    return f
if __name__ == '__main__':
    w = sys.argv[1]; o = '--others' in sys.argv
    if w == 'a':
        ev(chain(S, Z), 'scores > fp', others=o)
        ev(chain(Sh, Z), 'score curves > fp', others=o)
        ev(chain(S, Z, gs * Z), 'scores > fp > score x fp', others=o)
        ev(chain(S, Z, Zc ** 2 - 1), 'scores > fp > fp squared', others=o)
        for k in (3, 5):
            G = moe(k); ev(chain(S, Z, np.hstack([G - G.mean(0)] + [G[:, [j]] * Z * 0.3 for j in range(k)])), f'scores > fp > moe k={k}', others=o)
        ev(chain(S, Z, F[:, 6:]), 'scores > fp > other facts', others=o)
        ev(chain(S, F[:, 6:], Z), 'scores > other facts > fp', others=o)
    if w == 'k':
        for g, l in ((1, 3), (1, 10), (3, 3), (3, 10)): ev(kern(g, l), f'scores > fp > metric kernel g={g} l={l}', others=o)
        for dpt, it in ((2, 40), (3, 60)): ev(gbres(dpt, it), f'scores > fp > gbm d={dpt} it={it}', others=o)
