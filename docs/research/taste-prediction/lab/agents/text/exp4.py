from exp3 import *
import rig
Zs = rig.XG.copy(); Zs = np.where(np.isnan(Zs), np.nanmean(Zs, 0), Zs); Zs = (Zs - Zs.mean(0)) / (Zs.std(0) + 1e-9)
X['Z'] = D.Z / np.sqrt(D.Z.shape[1]); X['facts'] = Zs / np.sqrt(Zs.shape[1])
# RBF kernels on embeddings
def rbf(n, gam):
    A = X[n][rated]; d2 = 2 - 2 * (A @ A.T); return np.exp(-gam * np.asarray(d2, dtype=np.float64))
for g in (1, 3): G[f'rbf_en_{g}'] = rbf('en', g)
if __name__ == '__main__':
    for comps in [['Z'], ['facts'], ['facts', 'en'], ['facts', 'en', 'tagsvd'], ['rbf_en_1'], ['rbf_en_3'], ['facts', 'en', 'multi', 'tagsvd', 'tropes', 'misc', 'tfidf_ess']]:
        f = stack(comps); evaluate(f, f'stack {comps}'); print('   w', np.round(np.mean(f.w[:10], 0), 2), np.round(np.mean(f.w[10:], 0), 2))
