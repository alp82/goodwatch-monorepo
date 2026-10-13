"""Readable variants of the taste stage, plus a few last structure checks."""
import numpy as np, sys, warnings
warnings.filterwarnings('ignore')
from lab import ev, data
from e3 import S, F, gw, Z, CR, TA, AL, K
from e4 import chain, moe
from sklearn.linear_model import RidgeCV, LassoCV
from sklearn.cluster import AgglomerativeClustering, KMeans
from sklearn.neural_network import MLPRegressor
D = data()
def attr_groups(k):
    C = np.corrcoef(Z.T); lab = AgglomerativeClustering(k, metric='precomputed', linkage='average').fit_predict(1 - C)
    return [np.where(lab == j)[0] for j in range(k)]
def group_means(k):
    return np.column_stack([Z[:, g].mean(1) for g in attr_groups(k)])
def lasso_stage(D, u, tr, y, te):
    m1 = RidgeCV(alphas=AL).fit(S[tr], y); r = y - m1.predict(S[tr])
    m2 = LassoCV(cv=5, alphas=30, random_state=0).fit(Z[tr], r); return m1.predict(S[te]) + m2.predict(Z[te])
def topm(m):
    def f(D, u, tr, y, te):
        m1 = RidgeCV(alphas=AL).fit(S[tr], y); r = y - m1.predict(S[tr])
        c = np.abs([np.corrcoef(Z[tr][:, j], r)[0, 1] for j in range(74)]); sel = np.argsort(-c)[:m]
        m2 = RidgeCV(alphas=AL).fit(Z[tr][:, sel], r); return m1.predict(S[te]) + m2.predict(Z[te][:, sel])
    return f
def mlp(h, a):
    def f(D, u, tr, y, te):
        m1 = RidgeCV(alphas=AL).fit(S[tr], y); r = y - m1.predict(S[tr])
        m2 = RidgeCV(alphas=AL).fit(Z[tr], r); r2 = r - m2.predict(Z[tr]); p = 0
        for s in range(3): p = p + MLPRegressor(hidden_layer_sizes=(h,), alpha=a, max_iter=400, random_state=s, solver='lbfgs').fit(Z[tr], r2).predict(Z[te]) / 3
        return m1.predict(S[te]) + m2.predict(Z[te]) + p
    return f
def stretch(c, base=chain(S, Z)):
    def f(D, u, tr, y, te):
        p = base(D, u, tr, y, te); return y.mean() + c * (p - y.mean())
    return f
def sub(n, base=chain(S, Z)):
    def f(D, u, tr, y, te):
        rs = np.random.RandomState(len(te)); k = rs.permutation(len(tr))[:n]; return base(D, u, tr[k], y[k], te)
    return f
if __name__ == '__main__':
    w = sys.argv[1]; o = '--others' in sys.argv
    if w == 'r':
        pass
        for k in (): ev(chain(S, group_means(k)), f'scores > {k} attribute-group means', others=o)
        ev(lasso_stage, 'scores > lasso fp', others=o)
        for m in (6, 12, 20): ev(topm(m), f'scores > top {m} attrs', others=o)
        for k in (6, 12):
            G = moe(k); ev(chain(S, G - G.mean(0)), f'scores > {k} region offsets', others=o)
    if w == 'x':
        for h, a in ((2, 30), (4, 30), (4, 100)): ev(mlp(h, a), f'scores > fp > relu net h={h} a={a}', others=o)
        for c in (1.2, 1.4, 1.6): ev(stretch(c), f'scores > fp, stretched x{c}', others=o)
        for n in (150, 300, 450, 600): ev(sub(n), f'scores > fp, trained on {n}', others=o)
