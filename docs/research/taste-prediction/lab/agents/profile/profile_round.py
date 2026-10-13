"""The readable profile, answered as a whole number (same output convention as the rounded baselines)."""
import numpy as np, lib
def predict(D, user, tr_idx, tr_y, te_idx): return np.round(lib.fit(D, tr_idx, tr_y).predict(te_idx))
