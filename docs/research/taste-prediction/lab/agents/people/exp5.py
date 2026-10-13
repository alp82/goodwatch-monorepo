import lab, pf, pf2, numpy as np, sys
D = lab.data(); S = pf.static(D); S2 = pf2.static2(D)
E = S['extra']; Fr = S2['fr']; EN = S['extra_names']
seq = np.c_[E[:, 16], np.minimum(Fr[:, 0], 3), np.nan_to_num(Fr[:, 2])]
XB = S['base']; XE = np.hstack([XB, E]); XS = np.hstack([XE, seq[:, 1:]])
compact = [EN.index(k) for k in ('gw_user', 'mc_user', 'log_imdb_n', 'kw_sequel', 'runtime', 'log_pop', 'cert_us')]
XC = np.hstack([XB, E[:, compact], seq[:, 1:]])
def mono(X, n_extra_scores=()):
    m = np.zeros(X.shape[1], int); m[74:80] = 1
    for j in n_extra_scores: m[j] = 1
    return m
def mk(X, mc=None, **gkw):
    def predict(D, user, tr_idx, tr_y, te_idx):
        kw = dict(gkw)
        if mc is not None: kw['monotonic_cst'] = mc
        return pf.gbm(**kw).fit(X[tr_idx], tr_y).predict(X[te_idx])
    return predict
if __name__ == '__main__':
    nb = XB.shape[1]; eu = [nb + EN.index('gw_user'), nb + EN.index('gw_official'), nb + EN.index('mc_user')]
    R = [('base', mk(XB)), ('base mono', mk(XB, mono(XB))), ('E', mk(XE)), ('E mono', mk(XE, mono(XE, eu))), ('E+seq', mk(XS)), ('E+seq mono', mk(XS, mono(XS, eu))),
         ('compact+seq', mk(XC)), ('compact+seq mono', mk(XC, mono(XC, [nb, nb + 1]))),
         ('E+seq mono d2 300', mk(XS, mono(XS, eu), max_depth=2, max_iter=300)), ('E+seq mono lr.03 300 leaf12', mk(XS, mono(XS, eu), learning_rate=0.03, max_iter=300, min_samples_leaf=12)),
         ('E+seq mono 100', mk(XS, mono(XS, eu), max_iter=100)), ('E+seq mono colsample.5', mk(XS, mono(XS, eu), max_features=0.5, max_iter=200))]
    for nm, f in R: lab.score3(f, nm)
