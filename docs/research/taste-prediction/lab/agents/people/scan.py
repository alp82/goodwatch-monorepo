import lab, pf, pf2, numpy as np, pickle
from scipy.stats import spearmanr
D = lab.data(); S = pf.static(D); S2 = pf2.static2(D)
O = pickle.load(open('oof_base.pkl','rb'))
X = np.hstack([S['extra'], S2['fr'], S2['pp']]); names = S['extra_names'] + S2['fr_names'] + S2['pp_names']
idx, y, p = O[D.owner]; r = y - p
rows = []
for j, nm in enumerate(names):
    x = X[idx, j]; m = ~np.isnan(x)
    ro = spearmanr(x[m], r[m])[0] if m.sum() > 20 and x[m].std() > 0 else 0
    ry = spearmanr(x[m], y[m])[0] if m.sum() > 20 and x[m].std() > 0 else 0
    zs = []
    for u in D.users():
        iu, yu, pu = O[u]; xu = X[iu, j]; mu = ~np.isnan(xu)
        if mu.sum() > 20 and xu[mu].std() > 0: zs.append(spearmanr(xu[mu], (yu - pu)[mu])[0])
    zs = np.array(zs); rows.append((nm, m.mean(), ry, ro, zs.mean() if len(zs) else 0, (zs > 0).mean() if len(zs) else 0))
print(f"{'feature':28s} cover  rho(y) rho(resid) | others mean rho(resid), share positive")
for t in sorted(rows, key=lambda t: -abs(t[3])): print(f"{t[0]:28s} {t[1]:.2f}  {t[2]:+.3f}  {t[3]:+.3f}   | {t[4]:+.3f} {t[5]:.2f}")
