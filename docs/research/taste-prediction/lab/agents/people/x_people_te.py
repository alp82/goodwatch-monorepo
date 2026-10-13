"""FAILED IDEA kept for the record: member-specific shrunk person effects (cast, director, writer, producer) as extra tree features, fold-safe."""
import numpy as np, pf
def predict(D, user, tr_idx, tr_y, te_idx):
    S = pf.static(D); X = np.hstack([S['base'], S['extra']])
    g = S['base'][tr_idx, 74]; A = np.c_[np.ones(len(g)), np.nan_to_num(g, nan=np.nanmean(g))]; r = tr_y - A @ np.linalg.lstsq(A, tr_y, rcond=None)[0]
    Ftr, Fte = pf.te_features(S, ('cast', 'director', 'writer', 'producer'), np.asarray(tr_idx), r, np.asarray(te_idx), k=2.0)
    return pf.gbm().fit(np.hstack([X[tr_idx], Ftr]), tr_y).predict(np.hstack([X[te_idx], Fte]))
