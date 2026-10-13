import numpy as np
def predict(D, user, tr_idx, tr_y, te_idx): return np.full(len(te_idx), tr_y.mean())
