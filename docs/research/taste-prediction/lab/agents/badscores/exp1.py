from lib import *
from sklearn.model_selection import StratifiedKFold, KFold
from sklearn.isotonic import IsotonicRegression
D = Data(); X = features(D); idx, y = D.of(D.owner)
def band(y): return np.where(y <= 5, 0, np.where(y <= 7, 1, 2))
def bw(y, alpha=1.0):
    b = band(y); c = np.bincount(b, minlength=3).astype(float); w = (len(y) / (3 * np.maximum(c, 1))) ** alpha
    return w[b] / w[b].mean()
R = {}
def run(name, f):
    P, _ = multi(D, f, D.owner); show(name, P, y); R[name] = P
run('base', lambda D,u,tr,ty,te: gbm().fit(X[tr], ty).predict(X[te]))
# A. sample weights, squared loss
for a in (0.5, 1.0, 1.5):
    run('sq, band weight^%.1f' % a, lambda D,u,tr,ty,te,a=a: gbm().fit(X[tr], ty, sample_weight=bw(ty, a)).predict(X[te]))
# B. absolute loss
run('abs loss', lambda D,u,tr,ty,te: gbm(loss='absolute_error').fit(X[tr], ty).predict(X[te]))
for a in (0.5, 1.0):
    run('abs loss, band weight^%.1f' % a, lambda D,u,tr,ty,te,a=a: gbm(loss='absolute_error').fit(X[tr], ty, sample_weight=bw(ty, a)).predict(X[te]))
# C. ordinal cumulative thresholds -> distribution -> decision
def ordinal_dist(tr, ty, te, w=None):
    ks = [k for k in range(2, 10) if 8 <= (ty <= k).sum() <= len(ty) - 8]
    C = np.zeros((len(te), 11)); C[:, 10] = 1
    prev = np.zeros(len(te)); last = 0
    cum = {}
    for k in ks: cum[k] = gbc(max_iter=100).fit(X[tr], ty <= k, sample_weight=w).predict_proba(X[te])[:, 1]
    for k in range(1, 10):
        if k in cum: prev = np.maximum(prev, cum[k])
        elif k > max(ks): prev = np.maximum(prev, 1.0 * (k >= ty.max()))
        C[:, k] = prev
    return np.diff(C, axis=1)   # P(y=k), k=1..10
G = np.arange(1, 10.01, 0.1); KS = np.arange(1, 11)
def decide(Pd, wk):   # weighted median: argmin_c sum_k P(k) w_k |c-k|
    cost = (Pd * wk)[:, :, None] * np.abs(G[None, None, :] - KS[None, :, None]); return G[cost.sum(1).argmin(1)]
def wk_of(ty, a):
    b = band(ty); c = np.bincount(b, minlength=3).astype(float); w = (len(ty) / (3 * np.maximum(c, 1))) ** a; return w[band(KS)]
_cache = {}
def ord_pred(D,u,tr,ty,te,mode='mean',a=0.0):
    key = (tr.tobytes(), te.tobytes())
    if key not in _cache: _cache[key] = ordinal_dist(tr, ty, te)
    Pd = _cache[key]
    return Pd @ KS if mode == 'mean' else decide(Pd, wk_of(ty, a))
run('ordinal, mean', lambda *a: ord_pred(*a))
for a in (0.0, 0.5, 1.0):
    run('ordinal, wmedian a=%.1f' % a, lambda *z, a=a: ord_pred(*z, mode='med', a=a))
import pickle; pickle.dump((R, y), open('exp1.pkl', 'wb'))
