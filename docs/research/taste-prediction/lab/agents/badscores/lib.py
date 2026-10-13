import sys, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); LAB = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, LAB); sys.path.insert(0, os.path.join(LAB, 'baselines'))
from harness import Data, metrics, cv
from gbm_facts import features
from sklearn.ensemble import HistGradientBoostingRegressor as HGR, HistGradientBoostingClassifier as HGC
def gbm(**k):
    d = dict(max_depth=3, max_iter=150, learning_rate=0.05, min_samples_leaf=8, l2_regularization=1.0, random_state=3); d.update(k); return HGR(**d)
def gbc(**k):
    d = dict(max_depth=3, max_iter=150, learning_rate=0.05, min_samples_leaf=8, l2_regularization=1.0, random_state=3); d.update(k); return HGC(**d)
def multi(D, predict, user, seeds=(0, 1, 2), folds=10):
    P = [];
    for s in seeds:
        p, y = cv(D, predict, user, folds, seed=s); P.append(p)
    return P, y
def show(name, P, y):
    ms = [metrics(p, y) for p in P]; g = lambda k: np.mean([m[k] for m in ms])
    print(f"{name:34s} mae {g('mae'):.3f} macro {g('macro_mae'):.3f} rho {g('rho'):.3f} | bad {g('mae_bad'):.2f} mid {g('mae_mid'):.2f} hi {g('mae_hi'):.2f} | pbad {g('pred_bad'):.2f} phi {g('pred_hi'):.2f} auc {g('auc_bad'):.3f} sd {np.mean([p.std() for p in P]):.2f}", flush=True)
