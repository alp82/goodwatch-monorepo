"""Experiment rig: mirrors harness.cv splits, caches GBM fold predictions + inner OOF so residual models iterate fast."""
import sys, os, pickle, time
HERE = os.path.dirname(os.path.abspath(__file__)); LAB = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, LAB); sys.path.insert(0, os.path.join(LAB, 'baselines')); sys.path.insert(0, HERE)
import numpy as np
from sklearn.model_selection import StratifiedKFold, KFold
from harness import Data, metrics
import gbm_facts, feats
D = Data(); F = feats.get(D); XG = gbm_facts.features(D)
def splits(user, folds=None, seed=0):
    idx, y = D.of(user); folds = folds or (10 if user == D.owner else 5)
    band = np.where(y <= 5, 0, np.where(y <= 7, 1, 2))
    if np.bincount(band, minlength=3)[np.unique(band)].min() < folds: band = np.zeros(len(y), int)
    return idx, y, list(StratifiedKFold(folds, shuffle=True, random_state=seed).split(idx, band))
def inner_oof(fn, tr_idx, tr_y, k=5, seed=1):
    o = np.zeros(len(tr_y))
    for a, b in KFold(k, shuffle=True, random_state=seed).split(tr_idx): o[b] = fn(tr_idx[a], tr_y[a], tr_idx[b])
    return o
def gbm(tr_idx, tr_y, te_idx): return gbm_facts.predict(D, None, tr_idx, tr_y, te_idx)
def base_cache(seed=0):
    p = os.path.join(HERE, f'base_cache_{seed}.pkl')
    if os.path.exists(p): return pickle.load(open(p, 'rb'))
    C = {}
    for u in [D.owner] + D.users():
        idx, y, sp = splits(u, seed=seed); C[u] = []
        for tr, te in sp:
            C[u].append({'tr': tr, 'te': te, 'oof': inner_oof(gbm, idx[tr], y[tr]), 'pte': gbm(idx[tr], y[tr], idx[te])})
    pickle.dump(C, open(p, 'wb')); return C
def evaluate(fn, name, seed=0, users=None, verbose=True):
    """fn(u, idx_tr, y_tr, idx_te, c) -> preds, c = cached dict(oof=inner GBM oof on train, pte=GBM test pred)."""
    C = base_cache(seed); res = {}
    for u in (users or [D.owner] + D.users()):
        idx, y, _ = splits(u, seed=seed); p = np.zeros(len(y))
        for c in C[u]: p[c['te']] = fn(u, idx[c['tr']], y[c['tr']], idx[c['te']], c)
        m = metrics(p, y); m['skill'] = 1 - m['mae'] / np.abs(y - y.mean()).mean(); res[u] = m
    o = res[D.owner]; oth = [res[u] for u in res if u != D.owner]
    if verbose: print(f"{name:42s} OWNER mae {o['mae']:.3f} macro {o['macro_mae']:.3f} rho {o['rho']:.3f} bad {o['mae_bad']:.2f} auc {o['auc_bad']:.3f}"
          + (f" | OTH skill {np.mean([r['skill'] for r in oth]):.3f} rho {np.mean([r['rho'] for r in oth]):.3f}" if oth else ''), flush=True)
    return res
