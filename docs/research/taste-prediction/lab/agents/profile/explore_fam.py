"""Step 2: marginal candidates of every statement family on the residual after quality + six kinds, half A vs half B."""
import sys, pickle, warnings, numpy as np
warnings.filterwarnings('ignore')
import feats
from harness import Data
from explore_kinds import quality, eb
D = Data(); F = feats.get(D); K6 = feats.kinds(D, 6)[0]
FAM = {'sequel': F['sequel'][:, None], 'facts': F['facts'], 'genres': F['genres'], 'dials': F['dials'], 'themes': F['themes']}
def slopes(X, r):
    Xc = X - X.mean(0); v = (Xc ** 2).sum(0); b = Xc.T @ (r - r.mean()) / np.maximum(v, 1e-9); se = r.std() / np.sqrt(np.maximum(v, 1e-9)); return b, se, v
if __name__ == '__main__':
    R = int(sys.argv[1]); rows = []; qrows = []; rs = np.random.RandomState(1)
    for u in [D.owner] + D.users():
        idx, y = D.of(u)
        for rep in range(R):
            p = rs.permutation(len(y)); a, h = idx[p[:len(y) // 2]], idx[p[len(y) // 2:]]; ya, yh = y[p[:len(y) // 2]], y[p[len(y) // 2:]]
            # quality coefficients in both halves
            cf = []
            for i_, y_ in ((a, ya), (h, yh)):
                X = np.c_[np.ones(len(i_)), F['qm'][i_], F['gap'][i_]]; b = np.linalg.lstsq(X, y_, rcond=None)[0]; s2 = np.sum((y_ - X @ b) ** 2) / (len(y_) - 3)
                cf.append((b[1:], np.sqrt(s2 * np.diag(np.linalg.inv(X.T @ X))[1:])))
            qrows.append((u[:8], len(y), *cf[0][0], *cf[0][1], *cf[1][0], *cf[1][1]))
            q = quality(a, ya); ra = ya - q(a); rh = yh - q(h)
            d = eb(K6[a], ra, 6)[3]; ra = ra - d[K6[a]]; rh = rh - d[K6[h]]
            for fam, X in FAM.items():
                b, se, v = slopes(X[a], ra); bh, seh, vh = slopes(X[h], rh)
                for j in range(X.shape[1]):
                    na = min((X[a, j] > 0).sum(), (X[a, j] <= 0).sum()) if fam in ('sequel', 'facts', 'genres') else len(a)
                    nh = min((X[h, j] > 0).sum(), (X[h, j] <= 0).sum()) if fam in ('sequel', 'facts', 'genres') else len(h)
                    if na >= 4 and nh >= 4: rows.append((fam, u[:8], u == D.owner, len(y), rep, j, na, b[j], se[j], nh, bh[j], seh[j]))
        print(u[:8], flush=True)
    pickle.dump({'rows': rows, 'q': qrows}, open('explore_fam.pkl', 'wb'))
