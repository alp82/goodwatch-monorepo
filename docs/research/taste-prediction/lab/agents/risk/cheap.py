"""For the pooled prior: every member's cheap out-of-fold score from their OWN ratings only (ridge on title columns + boosted trees),
so that using member v as an 'other' never touches the predicted member's hidden ratings."""
import os, sys, pickle, numpy as np
import common, harness
from sklearn.linear_model import RidgeCV
from sklearn.model_selection import KFold
def build(D, least=40):
    p = os.path.join(common.HERE, 'cache', 'cheap.pkl')
    if os.path.exists(p): return pickle.load(open(p, 'rb'))
    common.point_parts(); pool = sys.modules['pool']; ht = sys.modules['pooled_h_text']
    X = pool.feats(D, 'all')[0]; out = {}
    for u in [D.owner] + [v for v in D._by if len(D._by[v]) >= least and v != D.owner]:
        idx, y = D.of(u); n = len(y); ol = np.zeros(n); ot = np.zeros(n)
        for a, b in KFold(5, shuffle=True, random_state=1).split(idx):
            ol[b] = RidgeCV(alphas=np.logspace(1, 4.5, 15)).fit(X[idx[a]], y[a]).predict(X[idx[b]])
            ot[b] = ht._trees(D, u, idx[a], y[a], idx[b])
        out[u] = dict(idx=idx, y=y, ol=np.clip(ol, 1, 10), ot=np.clip(ot, 1, 10)); print(u[:8], n, flush=True)
    pickle.dump(out, open(p, 'wb')); return out
if __name__ == '__main__':
    D = harness.Data(); c = build(D); print(len(c))
    for u, v in c.items():
        s = common.blend(v['ol'], v['ot'], len(v['y'])); print(u[:8], len(v['y']), 'mae', round(np.abs(s - v['y']).mean(), 3), 'const', round(np.abs(v['y'] - v['y'].mean()).mean(), 3), 'bad', int((v['y'] <= 5).sum()))
