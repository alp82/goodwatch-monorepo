import rig, numpy as np, scipy.sparse as sp, sys, time
from rig import D, F, evaluate
from sklearn.preprocessing import normalize
AL = np.logspace(-1, 4, 16)
rated = np.array(sorted({r[1] for r in D.ratings})); pos = np.full(D.n, -1); pos[rated] = np.arange(len(rated))
def rnorm(M): return normalize(M.tocsr(), norm='l2', axis=1)
X = {'en': F['emb_text_en_v1'], 'multi': F['emb_text_multi_v1'], 'tagsvd': F['tags_svd'],
     'tfidf': F['tfidf'][0], 'tfidf_ess': F['tfidf_ess'][0],
     'tropes': rnorm(F['tropes'][0]), 'keywords': rnorm(F['keywords'][0]), 'etags': rnorm(F['essence_tags'][0]), 'ewords': rnorm(F['essence_words'][0]), 'misc': rnorm(F['misc'][0])}
X['alltags'] = sp.hstack([X[k] for k in ('tropes', 'keywords', 'ewords', 'misc')]).tocsr()
G = {}
def gram(n):
    if n not in G:
        A = X[n][rated]; K = A @ A.T; G[n] = np.asarray(K.toarray() if sp.issparse(K) else K, dtype=np.float64)
    return G[n]
def kridge(K_tr, t, K_te, alphas=AL):
    m = t.mean(); t = t - m; w, V = np.linalg.eigh(K_tr); Vt = V.T @ t; V2 = V ** 2; best = None
    for a in alphas:
        d = 1 / (w + a); c = V @ (d * Vt); loo = c / (V2 @ d); e = (loo ** 2).mean()
        if best is None or e < best[0]: best = (e, c, a)
    return K_te @ best[1] + m
def lin(names, alphas=AL):
    names = names if isinstance(names, (list, tuple)) else [names]
    def f(tr, t, te):
        a, b = pos[tr], pos[te]; K = sum(gram(n) for n in names)
        return kridge(K[np.ix_(a, a)], t, K[np.ix_(b, a)], alphas)
    return f
if __name__ == '__main__':
    for n in list(X) + [('en', 'alltags'), ('en', 'tfidf', 'alltags')]:
        f = lin(n); t = time.time()
        evaluate(lambda u, a, b, c, d: f(a, b, c), f'alone {n}')
        evaluate(lambda u, a, b, c, d: d['pte'] + f(a, b - d['oof'], c), f'gbm + resid {n}')
        evaluate(lambda u, a, b, c, d: 0.7 * d['pte'] + 0.3 * f(a, b, c), f'0.7 gbm + 0.3 {n}')
