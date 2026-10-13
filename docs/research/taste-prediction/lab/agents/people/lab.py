"""Fast in-process evaluation with the harness's exact folds."""
import sys, os, time, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..', '..')); sys.path.insert(0, HERE)
import numpy as np
from harness import Data, cv, metrics
_D = None
def data():
    global _D
    if _D is None: _D = Data()
    return _D
def score(predict, name, others=True, folds=10, nusers=None):
    D = data(); t0 = time.time()
    p, y = cv(D, predict, D.owner, folds); o = metrics(p, y)
    s = f"{name:38s} mae {o['mae']:.3f} macro {o['macro_mae']:.3f} rho {o['rho']:.3f} bad {o['mae_bad']:.2f} auc {o['auc_bad']:.3f}"
    if others:
        sk = []; rh = []
        for u in D.users()[:nusers]:
            pu, yu = cv(D, predict, u, 5); mu = metrics(pu, yu)
            sk.append(1 - mu['mae'] / np.abs(yu - yu.mean()).mean()); rh.append(mu['rho'])
        s += f" || others skill {np.mean(sk):.3f} rho {np.mean(rh):.3f}"
    print(s + f" [{time.time()-t0:.0f}s]", flush=True)
    return p, y
def score3(predict, name, others=True, seeds=(0, 1, 2)):
    """Owner metrics averaged over several 10-fold splits (seed 0 is the harness split) to cut noise."""
    D = data(); t0 = time.time(); ms = []
    for sd in seeds:
        p, y = cv(D, predict, D.owner, 10, seed=sd); ms.append(metrics(p, y))
    a = lambda k: np.mean([m[k] for m in ms])
    s = f"{name:40s} mae {a('mae'):.3f} (s0 {ms[0]['mae']:.3f}) macro {a('macro_mae'):.3f} rho {a('rho'):.3f} bad {a('mae_bad'):.2f} auc {a('auc_bad'):.3f}"
    if others:
        sk = []; rh = []
        for u in D.users():
            pu, yu = cv(D, predict, u, 5); mu = metrics(pu, yu)
            sk.append(1 - mu['mae'] / np.abs(yu - yu.mean()).mean()); rh.append(mu['rho'])
        s += f" || others skill {np.mean(sk):.3f} rho {np.mean(rh):.3f}"
    print(s + f" [{time.time()-t0:.0f}s]", flush=True)
