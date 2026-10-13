"""Stage-1 cache (base GBM test prediction + inner out-of-fold train predictions) so stage-2 ideas iterate in seconds."""
import lab, pf, numpy as np, pickle, os, hashlib
from sklearn.model_selection import KFold
D = lab.data(); S = pf.static(D)
_C = {}; _dirty = [False]
def load(tag):
    fn = f'cache_{tag}.pkl'
    if tag not in _C: _C[tag] = pickle.load(open(fn, 'rb')) if os.path.exists(fn) else {}
    return _C[tag]
def save(tag): pickle.dump(_C[tag], open(f'cache_{tag}.pkl', 'wb'))
def stage1(tag, X, tr_idx, tr_y, te_idx, inner=5, gkw={}, sw=None):
    C = load(tag); key = hashlib.md5(np.asarray(tr_idx).tobytes() + np.asarray(te_idx).tobytes()).hexdigest()
    if key not in C:
        oof = np.zeros(len(tr_idx))
        for a, b in KFold(inner, shuffle=True, random_state=0).split(tr_idx):
            oof[b] = pf.gbm(**gkw).fit(X[tr_idx[a]], tr_y[a]).predict(X[tr_idx[b]])
        C[key] = (oof, pf.gbm(**gkw).fit(X[tr_idx], tr_y).predict(X[te_idx]))
    return C[key]
