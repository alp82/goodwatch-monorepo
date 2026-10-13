import rig, numpy as np, scipy.sparse as sp, sys
from rig import D, F, evaluate
from sklearn.linear_model import RidgeCV, Ridge
from sklearn.preprocessing import normalize
AL = np.logspace(-1, 4, 16)
def rnorm(M): return normalize(M.tocsr(), norm='l2', axis=1)
X = {'en': F['emb_text_en_v1'], 'multi': F['emb_text_multi_v1'], 'pca_en': F['pca_text_en_v1'], 'tfsvd': F['tfidf_svd'], 'tagsvd': F['tags_svd'],
     'tfidf': F['tfidf'][0], 'tfidf_ess': F['tfidf_ess'][0],
     'tropes': rnorm(F['tropes'][0]), 'keywords': rnorm(F['keywords'][0]), 'etags': rnorm(F['essence_tags'][0]), 'ewords': rnorm(F['essence_words'][0]), 'misc': rnorm(F['misc'][0])}
X['alltags'] = sp.hstack([X[k] for k in ('tropes', 'keywords', 'ewords', 'misc')]).tocsr()
X['en+multi'] = np.hstack([X['en'], X['multi']])
def kridge(K_tr, t, K_te, alphas=AL):
    # dual ridge with LOO alpha selection via eigendecomposition; intercept by centering t
    m = t.mean(); t = t - m; w, V = np.linalg.eigh(K_tr); Vt = V.T @ t; best = None
    for a in alphas:
        d = 1 / (w + a); c = V @ (d * Vt); G = (V * d) @ V.T; loo = c / np.diag(G); e = (loo ** 2).mean()
        if best is None or e < best[0]: best = (e, c, a)
    return K_te @ best[1] + m, best[2]
def lin(name):
    M = X[name]
    def f(tr, t, te):
        A, B = M[tr], M[te]; K = A @ A.T; Kt = B @ A.T
        if sp.issparse(K): K, Kt = K.toarray(), Kt.toarray()
        return kridge(np.asarray(K, dtype=np.float64), t, np.asarray(Kt, dtype=np.float64))[0]
    return f
if __name__ == '__main__':
    evaluate(lambda u, a, b, c, d: d['pte'], 'gbm')
    for n in X:
        f = lin(n)
        evaluate(lambda u, a, b, c, d: f(a, b, c), 'alone ' + n)
        evaluate(lambda u, a, b, c, d: d['pte'] + f(a, b - d['oof'], c), 'gbm + resid ' + n)
