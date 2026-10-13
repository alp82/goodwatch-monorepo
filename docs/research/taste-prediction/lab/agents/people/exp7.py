import lab, pf, pf2, stage, exp2, numpy as np
from sklearn.linear_model import Ridge
from harness import cv, metrics
D = lab.data(); S = pf.static(D); S2 = pf2.static2(D)
E = S['extra']; Fr = S2['fr']; EN = S['extra_names']; XE = exp2.XE; nb = S['base'].shape[1]
mc = np.zeros(XE.shape[1], int); mc[74:80] = 1
for k in ('gw_user', 'gw_official', 'mc_user'): mc[nb + EN.index(k)] = 1
GKW = dict(monotonic_cst=mc, max_features=0.5, max_iter=200)
seq = np.c_[E[:, 16], np.nan_to_num(Fr[:, 2]) / 10.0]
def mk(cols=(), groups=(), k=1.0, alpha=30.0, galpha=1.0, inner=4):
    def predict(D, user, tr_idx, tr_y, te_idx):
        oof, pte = stage.stage1(f'M{inner}', XE, tr_idx, tr_y, te_idx, inner=inner, gkw=GKW); r = tr_y - oof
        if not cols and not groups: return pte
        A = [seq[tr_idx][:, list(cols)]]; B = [seq[te_idx][:, list(cols)]]
        for g in groups:
            a, b = exp2.loo_feats(g, tr_idx, r, te_idx, k); s = np.sqrt(alpha / galpha); A.append(a[:, :1] * s); B.append(b[:, :1] * s)
        m = Ridge(alpha=alpha, fit_intercept=True).fit(np.hstack(A), r)
        return pte + m.predict(np.hstack(B))
    return predict
if __name__ == '__main__':
    lab.score3(mk(), 'M stage1 (E mono colsample)'); stage.save('M4')
    for nm, f in [('M + seq', mk((0, 1))), ('M + series', mk((), ('series',))), ('M + seq + series', mk((0, 1), ('series',))), ('M + seq + series + cast k3', mk((0, 1), ('series', 'cast'), k=3.0)), ('M + seq + series a=10', mk((0, 1), ('series',), alpha=10.0)), ('M + seq + series a=100', mk((0, 1), ('series',), alpha=100.0, galpha=1.0))]:
        lab.score3(f, nm)
    stage.save('M4')
