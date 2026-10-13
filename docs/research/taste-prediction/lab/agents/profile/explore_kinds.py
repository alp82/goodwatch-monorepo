"""Step 1: which definition of 'kinds of titles' replicates and predicts? Repeated half splits per member.
For every variant: offsets (mean rating minus quality prediction, per kind) are measured on one half and re-measured on the other half."""
import sys, pickle, warnings, numpy as np
warnings.filterwarnings('ignore')
import feats
from harness import Data
from sklearn.cluster import KMeans
from sklearn.linear_model import RidgeCV
D = Data(); F = feats.get(D); TA = F['TA']; A = D.Z[:, TA]
R = int(sys.argv[1]) if len(sys.argv) > 1 else 20

def quality(tr, y):
    X = np.c_[np.ones(len(tr)), F['qm'][tr], F['gap'][tr]]; b = np.linalg.lstsq(X, y, rcond=None)[0]
    return lambda rows: np.c_[np.ones(len(rows)), F['qm'][rows], F['gap'][rows]] @ b

def eb(lab, r, k):
    """Per-kind mean residual, its standard error, count, and the shrunk offset."""
    n = np.bincount(lab, minlength=k).astype(float); s = np.bincount(lab, weights=r, minlength=k); m = s / np.maximum(n, 1)
    s2 = r.var(); ok = n >= 3; se2 = s2 / np.maximum(n, 1)
    tau2 = max(np.sum((m[ok] ** 2 - se2[ok]) * n[ok]) / max(n[ok].sum(), 1), 0.0)
    sh = tau2 / (tau2 + se2); return m, np.sqrt(se2), n, m * sh, np.sqrt(se2 * sh), tau2

def variants(tr, y):
    out = {}
    for k in (6, 8, 12, 16, 20): out[f'shared{k}'] = (feats.kinds(D, k)[0], k)
    k = int(np.clip(len(tr) // 25, 2, 6)); km = KMeans(k, n_init=5, random_state=0).fit(A[tr]); out['own'] = (km.predict(A), k)
    lv = tr[y >= np.quantile(y, 0.7)]
    if len(lv) >= 12:
        k2 = int(np.clip(len(lv) // 8, 2, 4)); km = KMeans(k2, n_init=5, random_state=0).fit(A[lv]); d = km.transform(A); lab = d.argmin(1)
        rad = np.quantile(d[lv].min(1), 0.75); lab = np.where(d.min(1) <= rad, lab, k2); out['loved'] = (lab, k2 + 1)
    # genres as a partition: a title's rarest genre
    G = F['genres']; rar = np.where(G > 0, G.sum(0)[None, :], 1e9); lab = np.where(G.sum(1) > 0, rar.argmin(1), G.shape[1]); out['genre1'] = (lab, G.shape[1] + 1)
    return out

rows = []; pred = []
rs = np.random.RandomState(0)
for u in [D.owner] + D.users():
    idx, y = D.of(u)
    for rep in range(R):
        p = rs.permutation(len(y)); a, h = p[:len(y) // 2], p[len(y) // 2:]
        q = quality(idx[a], y[a]); ra = y[a] - q(idx[a]); rh = y[h] - q(idx[h])
        base = np.mean(rh ** 2); e = {'u': u[:8], 'rep': rep, 'n': len(y), 'const': np.mean((y[h] - y[a].mean()) ** 2), 'quality': base,
                                      'mae_const': np.mean(np.abs(y[h] - y[a].mean())), 'mae_quality': np.mean(np.abs(rh))}
        m2 = RidgeCV(alphas=np.logspace(-1, 4, 16)).fit(D.Z[idx[a]], ra); e['ridge74'] = np.mean((rh - m2.predict(D.Z[idx[h]])) ** 2); e['mae_ridge74'] = np.mean(np.abs(rh - m2.predict(D.Z[idx[h]])))
        for nm, (lab, k) in variants(idx[a], y[a]).items():
            m, se, n, d, psd, tau2 = eb(lab[idx[a]], ra, k); mh, seh, nh, *_ = eb(lab[idx[h]], rh, k)
            e[nm] = np.mean((rh - d[lab[idx[h]]]) ** 2); e['mae_' + nm] = np.mean(np.abs(rh - d[lab[idx[h]]]))
            for j in range(k):
                if nm == 'loved' and j == k - 1: continue
                if n[j] >= 5 and nh[j] >= 5: rows.append((nm, u[:8], u == D.owner, len(y), j, n[j], m[j], se[j], d[j], psd[j], nh[j], mh[j], seh[j]))
        pred.append(e)
    print(u[:8], len(y), flush=True)
pickle.dump({'rows': rows, 'pred': pred}, open('explore_kinds.pkl', 'wb'))
