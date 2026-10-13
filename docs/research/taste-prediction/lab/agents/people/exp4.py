import lab, pf, pf2, stage, exp2, numpy as np
from sklearn.linear_model import Ridge
D = lab.data(); S = pf.static(D); S2 = pf2.static2(D)
Fr = S2['fr']; E = S['extra']
seq = np.c_[E[:, 16], (Fr[:, 0] > 0), np.nan_to_num(Fr[:, 2]) / 10.0, np.minimum(Fr[:, 0], 3), np.nan_to_num(Fr[:, 6])]
SETS = {'kw': [0], 'pos': [1], 'yrs': [2], 'kw+yrs': [0, 2], 'all': [0, 1, 2, 3, 4], 'kw+pos+yrs': [0, 1, 2]}
def mk(cols, groups=(), k=2.0, alpha=10.0, galpha=1.0):
    def predict(D, user, tr_idx, tr_y, te_idx):
        oof, pte = stage.stage1('E', exp2.XE, tr_idx, tr_y, te_idx); r = tr_y - oof
        A = [seq[tr_idx][:, cols]]; B = [seq[te_idx][:, cols]]
        for g in groups:
            a, b = exp2.loo_feats(g, tr_idx, r, te_idx, k); s = np.sqrt(alpha / galpha); A.append(a[:, :1] * s); B.append(b[:, :1] * s)
        A = np.hstack(A); B = np.hstack(B)
        m = Ridge(alpha=alpha, fit_intercept=True).fit(A, r)
        return pte + m.predict(B)
    return predict
if __name__ == '__main__':
    for nm, c in SETS.items():
        for a in (3.0, 30.0): lab.score(mk(c, alpha=a), f'E + seq[{nm}] a={a}')
    for g in [('series',), ('series', 'cast'), ('series', 'cast', 'writer', 'director'), ('cast','lead','writer','director')]:
        lab.score(mk([0, 2], groups=g, alpha=10.0), f'E + seq[kw+yrs] + {g}')
