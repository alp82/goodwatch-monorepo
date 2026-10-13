"""Baseline trees + extra structured facts, nothing else."""
import numpy as np, pf
def predict(D, user, tr_idx, tr_y, te_idx):
    S = pf.static(D); X = np.hstack([S['base'], S['extra']])
    return pf.gbm().fit(X[tr_idx], tr_y).predict(X[te_idx])
