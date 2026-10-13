import rig, numpy as np, scipy.sparse as sp, pickle
from rig import D, F
from sklearn.linear_model import RidgeCV
idx, y = D.of(D.owner); C = rig.base_cache(0)[D.owner]
g = np.zeros(len(y))
for c in C: g[c['te']] = c['pte']
gw = np.array([x['goodwatch_overall_score_normalized_percent'] or 60 for x in D.info], float)[idx]
ev = np.polyval(np.polyfit(gw, y, 1), gw)
T = {'raw': y - y.mean(), 'vs_public': y - ev, 'vs_gbm': y - g}
fams = ['misc', 'keywords', 'essence_words', 'essence_tags', 'tropes']
rng = np.random.default_rng(0)
def eff(M, t, k):
    n = np.asarray(M.sum(0)).ravel(); s = np.asarray(M.T @ t).ravel(); return n, s / (n + k)
out = {}
for tn, t in T.items():
    print('\n=====', tn, 'sd', t.std().round(3))
    for fam in fams:
        M = F[fam][0][idx].tocsc(); voc = np.array(F[fam][1]); n = np.asarray(M.sum(0)).ravel()
        # split-half reliability of raw tag means, for tags with >=4 in each half
        rs = []
        for rep in range(200):
            h = rng.permutation(len(y)) < len(y) // 2
            na, sa = eff(M[h], t[h], 0); nb, sb = eff(M[~h], t[~h], 0); ok = (na >= 4) & (nb >= 4)
            rs.append(np.corrcoef(sa[ok], sb[ok])[0, 1])
        # permutation null
        ns = []
        for rep in range(100):
            tp = rng.permutation(t); h = rng.permutation(len(y)) < len(y) // 2
            na, sa = eff(M[h], tp[h], 0); nb, sb = eff(M[~h], tp[~h], 0); ok = (na >= 4) & (nb >= 4); ns.append(np.corrcoef(sa[ok], sb[ok])[0, 1])
        # empirical Bayes k: var of tag means = tau2 + s2/n
        ok = n >= 5; mj = (np.asarray(M.T @ t).ravel() / np.maximum(n, 1))[ok]; s2 = t.var()
        tau2 = max(np.mean(mj ** 2 - s2 / n[ok]), 1e-4); k = s2 / tau2
        nn, e = eff(M, t, k); z = (np.asarray(M.T @ t).ravel() / np.maximum(n, 1)) / np.sqrt(s2 / np.maximum(n, 1))
        o = np.argsort(e); sel = [j for j in o if n[j] >= 5]
        print(f'\n-- {fam}: tags n>=5: {ok.sum()}, split-half r {np.mean(rs):.3f} (null {np.mean(ns):.3f} +- {np.std(ns):.3f}), tau {np.sqrt(tau2):.3f}, k {k:.1f}')
        print('  LOW : ' + '; '.join(f'{voc[j]} ({e[j]:+.2f}, n={int(n[j])}, z={z[j]:.1f})' for j in sel[:18]))
        print('  HIGH: ' + '; '.join(f'{voc[j]} ({e[j]:+.2f}, n={int(n[j])}, z={z[j]:.1f})' for j in sel[::-1][:18]))
        out[(tn, fam)] = [(voc[j], float(e[j]), int(n[j]), float(z[j])) for j in sel]
pickle.dump(out, open('tag_effects.pkl', 'wb'))
