"""Cache predictive distributions for owner (3 seeds x 10 folds) and others (seed 0, 5 folds); sweep the operating point offline."""
from lib import *
import pickle, time, shape
from sklearn.model_selection import StratifiedKFold
D = Data(); X = features(D); mono = [0]*74 + [1]*6 + [0]*(X.shape[1]-80)
reg = lambda tr, ty, te: gbm(monotonic_cst=mono).fit(X[tr], ty).predict(X[te])
def bagreg(tr, ty, te, n=4):
    rng = np.random.default_rng(0); acc = 0
    for b in range(n): s = rng.integers(0, len(tr), len(tr)); acc = acc + gbm(monotonic_cst=mono).fit(X[tr[s]], ty[s]).predict(X[te])
    return acc / n
kinds = {'full': lambda tr, ty, te: (shape.ordinal_dist(X, tr, ty, te, mono), None),
         'point': lambda tr, ty, te: (shape.point_dist(reg, tr, ty, te), reg(tr, ty, te))}
def collect(user, folds, seed):
    idx, y = D.of(user); band = np.where(y <= 5, 0, np.where(y <= 7, 1, 2))
    if np.bincount(band, minlength=3)[np.unique(band)].min() < folds: band = np.zeros(len(y), int)
    out = {k: np.zeros((len(y), 10)) for k in kinds}; out['reg'] = np.zeros(len(y)); out['trs'] = []
    for tr, te in StratifiedKFold(folds, shuffle=True, random_state=seed).split(idx, band):
        for k, f in kinds.items():
            Pd, p = f(idx[tr], y[tr], idx[te]); out[k][te] = Pd
            if p is not None: out['reg'][te] = p
        out['trs'].append((te, y[tr]))
    out['y'] = y; return out
t0 = time.time(); R = {'owner': [collect(D.owner, 10, s) for s in range(3)]}; print('owner %.0fs' % (time.time() - t0), flush=True)
R['others'] = {u: collect(u, 5, 0) for u in D.users()}; print('others %.0fs' % (time.time() - t0), flush=True)
with open('exp4.pkl', 'wb') as f: pickle.dump(R, f)
