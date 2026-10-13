"""Multi-seed evaluation (same CV as the harness) with paired comparison against a reference predictor."""
import sys, os, time, numpy as np, warnings; warnings.filterwarnings('ignore')
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', '..'))
from harness import Data, cv, metrics
_D = None; REF = {}
def data():
    global _D
    if _D is None: _D = Data()
    return _D
def ev(predict, name, seeds=(0, 1, 2), others=True, folds=10, ref=None, setref=None):
    D = data(); t = time.time(); ms = []; E = {}
    for s in seeds:
        p, y = cv(D, predict, D.owner, folds, seed=s); ms.append(metrics(p, y)); E[('o', s)] = (np.clip(p, 1, 10), y)
    a = lambda k: np.mean([m[k] for m in ms])
    line = f"{name:30s} mae {a('mae'):.3f} macro {a('macro_mae'):.3f} rho {a('rho'):.3f} bad {a('mae_bad'):.2f} auc {a('auc_bad'):.3f} hi {a('mae_hi'):.2f}"
    if others:
        sk, rh = [], []
        for u in D.users():
            pu, yu = cv(D, predict, u, 5, seed=0); m = metrics(pu, yu); E[u] = (np.clip(pu, 1, 10), yu)
            sk.append(1 - m['mae'] / np.abs(yu - yu.mean()).mean()); rh.append(m['rho'])
        line += f" || others skill {np.mean(sk):.3f} rho {np.mean(rh):.3f}"
    if setref: REF[setref] = E
    if ref and ref in REF:
        R = REF[ref]
        d = np.mean([np.abs(R[('o', s)][0] - R[('o', s)][1]) - np.abs(E[('o', s)][0] - E[('o', s)][1]) for s in seeds], axis=0)   # >0 = better than ref
        rng = np.random.default_rng(0); bs = [d[rng.integers(0, len(d), len(d))].mean() for _ in range(2000)]
        line += f" | owner gain {d.mean():+.3f} [{np.percentile(bs, 5):+.3f},{np.percentile(bs, 95):+.3f}]"
        if others:
            us = [u for u in E if not isinstance(u, tuple)]
            g = [np.mean(np.abs(R[u][0] - R[u][1]) - np.abs(E[u][0] - E[u][1])) for u in us]
            line += f" others gain {np.mean(g):+.3f} ({sum(x > 0 for x in g)}/{len(g)} members better)"
    print(line + f" [{time.time()-t:.0f}s]", flush=True)
