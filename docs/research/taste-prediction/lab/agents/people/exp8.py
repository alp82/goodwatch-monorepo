import lab, pf, pf2, exp7, numpy as np
D = lab.data(); S = pf.static(D); S2 = pf2.static2(D)
XE = exp7.XE; mc = exp7.mc; P = S2['pp']; PN = S2['pp_names']
def mk(X, m, **kw):
    def predict(D, user, tr_idx, tr_y, te_idx): return pf.gbm(monotonic_cst=m, **kw).fit(X[tr_idx], tr_y).predict(X[te_idx])
    return predict
z = lambda k: np.zeros(k, int)
pri = [i for i, n in enumerate(PN) if n.endswith('prior_score')]; dw = [PN.index(n) for n in ('director_prior_score', 'writer_prior_score', 'cast_prior_score', 'producer_prior_score')]
for nm, X, m, kw in [('M+P all', np.hstack([XE, P]), np.r_[mc, z(P.shape[1])], dict(max_features=0.5, max_iter=200)),
                     ('M+P prior scores', np.hstack([XE, P[:, pri]]), np.r_[mc, z(len(pri))], dict(max_features=0.5, max_iter=200)),
                     ('M+P dir/writer/cast/prod prior', np.hstack([XE, P[:, dw]]), np.r_[mc, z(4)], dict(max_features=0.5, max_iter=200)),
                     ('M colsample .3 300', XE, mc, dict(max_features=0.3, max_iter=300)),
                     ('M colsample .5 200 leaf 12', XE, mc, dict(max_features=0.5, max_iter=200, min_samples_leaf=12))]:
    lab.score3(mk(X, m, **kw), nm)
