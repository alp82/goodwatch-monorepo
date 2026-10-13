"""Cheaper distribution estimators: timing and quality."""
from lib import *
import pickle, time, shape
from sklearn.model_selection import StratifiedKFold
from sklearn.linear_model import LogisticRegression
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
D = Data(); X = features(D); mono = [0]*74 + [1]*6 + [0]*(X.shape[1]-80)
Xs = StandardScaler().fit_transform(SimpleImputer(strategy='median').fit_transform(X))   # no ratings involved
reg = lambda tr, ty, te: gbm(monotonic_cst=mono).fit(X[tr], ty).predict(X[te])
def cumdist(make, Xm, tr, ty, te, least=8):
    cum = {}
    for k in range(1, 10):
        t = ty <= k
        if least <= t.sum() <= len(t) - least: cum[k] = make().fit(Xm[tr], t).predict_proba(Xm[te])[:, 1]
    return shape._to_dist(cum, ty, len(te))
kinds = {'fast': lambda tr, ty, te: cumdist(lambda: gbc(max_iter=50, learning_rate=0.1, monotonic_cst=[-c for c in mono]), X, tr, ty, te),
         'logit': lambda tr, ty, te: cumdist(lambda: LogisticRegression(C=0.02, max_iter=300), Xs, tr, ty, te),
         'point3': lambda tr, ty, te: shape.point_dist(reg, tr, ty, te, folds=3)}
T = {k: 0.0 for k in kinds}
def collect(user, folds, seed):
    idx, y = D.of(user); band = np.where(y <= 5, 0, np.where(y <= 7, 1, 2))
    if np.bincount(band, minlength=3)[np.unique(band)].min() < folds: band = np.zeros(len(y), int)
    out = {k: np.zeros((len(y), 10)) for k in kinds}; out['trs'] = []
    for tr, te in StratifiedKFold(folds, shuffle=True, random_state=seed).split(idx, band):
        for k, f in kinds.items():
            t0 = time.time(); out[k][te] = f(idx[tr], y[tr], idx[te]); T[k] += time.time() - t0
        out['trs'].append((te, y[tr]))
    out['y'] = y; return out
R = {'owner': [collect(D.owner, 10, s) for s in range(3)]}; print('owner/3 seeds', {k: round(v) for k, v in T.items()}, flush=True)
R['others'] = {u: collect(u, 5, 0) for u in D.users()}; print('total', {k: round(v) for k, v in T.items()}, flush=True)
with open('exp5.pkl', 'wb') as f: pickle.dump(R, f)
