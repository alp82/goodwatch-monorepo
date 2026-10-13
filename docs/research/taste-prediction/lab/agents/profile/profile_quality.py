"""Ablation: only the 'well made' statements."""
import lib
def predict(D, user, tr_idx, tr_y, te_idx): return lib.fit(D, tr_idx, tr_y, {'order': ()}).predict(te_idx)
