"""In-process evaluation with the harness's own fold scheme, several seeds, to tell signal from noise."""
import sys, os, numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from harness import Data, metrics, cv
_D = None
def data():
    global _D
    if _D is None: _D = Data()
    return _D
def ev(predict, name, seeds=(0, 1, 2), others=True, folds=10):
    D = data(); ms = []
    for s in seeds:
        p, y = cv(D, predict, D.owner, folds, seed=s); ms.append(metrics(p, y))
    a = lambda k: np.mean([m[k] for m in ms])
    line = f"{name:38s} mae {a('mae'):.3f} macro {a('macro_mae'):.3f} rho {a('rho'):.3f} bad {a('mae_bad'):.2f} auc {a('auc_bad'):.3f}"
    if others:
        sk, rh = [], []
        for u in D.users():
            pu, yu = cv(D, predict, u, 5); mu = metrics(pu, yu)
            sk.append(1 - mu['mae'] / np.abs(yu - yu.mean()).mean()); rh.append(mu['rho'])
        line += f" || others skill {np.mean(sk):.3f} rho {np.mean(rh):.3f}"
    print(line, flush=True)
    return ms
