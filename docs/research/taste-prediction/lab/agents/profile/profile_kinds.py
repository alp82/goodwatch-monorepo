"""Ablation: 'well made' + kinds of titles."""
import lib
def predict(D, user, tr_idx, tr_y, te_idx): return lib.fit(D, tr_idx, tr_y, {'order': ('kinds',)}).predict(te_idx)
