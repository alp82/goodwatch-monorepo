from exp4 import *
from sklearn.ensemble import HistGradientBoostingRegressor as HGB
import re
XGm = rig.XG
def hgb(Xa, y, Xb, **kw):
    p = dict(max_depth=3, max_iter=150, learning_rate=0.05, min_samples_leaf=8, l2_regularization=1.0, random_state=3); p.update(kw)
    return HGB(**p).fit(Xa, y).predict(Xb)
kwv = {k: i for i, k in enumerate(F['keywords'][1])}
seq = np.asarray(F['keywords'][0][:, kwv['sequel']].todense()).ravel()
numt = np.array([bool(re.search(r'(\b[2-9]\b|\bII+\b|\bIV\b|Part |: )', x['title'] or '')) for x in D.info], float)
ser = np.array([x.get('movie_series_id') is not None for x in D.info], float)
S = np.c_[seq, numt, ser]
def A(comps):
    fs = [lin2(c) for c in comps]
    def f(u, tr, y, te, c):
        P, O = zip(*[g(tr, y, te) for g in fs])
        return hgb(np.c_[XGm[tr], np.array(O).T], y, np.c_[XGm[te], np.array(P).T])
    return f
def B(extra):
    Xb = np.c_[XGm, extra]
    return lambda u, tr, y, te, c: hgb(Xb[tr], y, Xb[te])
def knn(n, k=15, lam=3.0, pw=4):
    def f(u, tr, y, te, c):
        r = y - c['oof']; Sm = gram(n)[np.ix_(pos[te], pos[tr])]; out = np.zeros(len(te))
        for i in range(len(te)):
            j = np.argsort(-Sm[i])[:k]; w = np.clip(Sm[i, j], 0, None) ** pw; out[i] = (w * r[j]).sum() / (w.sum() + lam * w.max() + 1e-9)
        return c['pte'] + out
    return f
if __name__ == '__main__':
    us = [D.owner] if 'owner' in sys.argv else None
    evaluate(B(S), 'gbm + sequel flags', users=us)
    evaluate(B(np.c_[F['pca_text_en_v1'][:, :16], F['tags_svd'][:, :16]]), 'gbm + pca16 en + tagsvd16', users=us)
    evaluate(A(['en', 'tagsvd']), 'gbm + LOO feats en,tagsvd', users=us)
    evaluate(A([('en', 'multi', 'tagsvd', 'tfidf_ess', 'alltags')]), 'gbm + LOO feat combined-text', users=us)
    for n in ('en', 'tagsvd', 'alltags'):
        for k, lam in ((10, 1.0), (30, 3.0)):
            evaluate(knn(n, k, lam), f'gbm + knn resid {n} k{k} lam{lam}', users=us)
