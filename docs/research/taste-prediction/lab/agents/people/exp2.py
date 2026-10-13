import lab, pf, stage, numpy as np, sys
from sklearn.linear_model import Ridge
D = lab.data(); S = pf.static(D)
XE = np.hstack([S['base'], S['extra']])
def loo_feats(g, tr_idx, r, te_idx, k):
    G = S['G'][g]; neigh = g in pf.NEIGH
    s = pf.te_fit(G, tr_idx, r, neigh)
    def one(i, ri):   # ri = own residual to remove (None for test rows)
        num = 0.0; den = 0.0; best = 0.0; cnt = 0.0
        for e, w in G[i]:
            v = s.get(e)
            if v is None: continue
            sr, n = v
            if ri is not None and not neigh: sr -= w * ri; n -= w
            if n < 1e-9: continue
            eff = sr / (n + k); num += w * eff; den += w; cnt += n
            if abs(eff) > abs(best): best = eff
        return [num / den if den else 0.0, best, num]
    return np.array([one(i, ri) for i, ri in zip(tr_idx, r)]), np.array([one(i, None) for i in te_idx])
def mk(groups, k=2.0, alpha=30.0, cols=(0,), positive=False, extra=True, tag=None, ret_coef=None):
    def predict(D, user, tr_idx, tr_y, te_idx):
        X = XE if extra else S['base']
        oof, pte = stage.stage1(tag or ('E' if extra else 'B'), X, tr_idx, tr_y, te_idx)
        if not groups: return pte
        r = tr_y - oof
        A = []; B = []
        for g in groups:
            a, b = loo_feats(g, tr_idx, r, te_idx, k); A.append(a[:, cols]); B.append(b[:, cols])
        A = np.hstack(A); B = np.hstack(B)
        m = Ridge(alpha=alpha, fit_intercept=False, positive=positive).fit(A, r)
        if ret_coef is not None: ret_coef.append(m.coef_)
        return pte + m.predict(B)
    return predict
if __name__ == '__main__':
    lab.score(mk(()), 'E stage1 only')
    stage.save('E')
    P = ['cast','lead','director','writer','producer','composer','dop','series','family','company','recs','similar']
    for g in P:
        for k in (1.0, 3.0):
            c = []; lab.score(mk((g,), k=k, alpha=1.0, ret_coef=c), f'E + {g} k={k}'); print('   coef', np.mean(c[:10], 0).round(2), np.mean(c[10:], 0).round(2))
