"""Quality, then linear taste, then a similarity term where "similar" is measured in the attributes that matter for this member."""
import numpy as np
from sklearn.kernel_ridge import KernelRidge
from common import scores, chain
def predict(D, user, tr_idx, tr_y, te_idx):
    p, ms, r = chain([scores(D), D.Z], tr_idx, tr_y, te_idx)
    w = np.abs(ms[1].coef_); w = w / (np.sqrt((w ** 2).sum()) + 1e-12)
    return p + KernelRidge(kernel='rbf', gamma=3.0, alpha=3.0).fit(D.Z[tr_idx] * w, r).predict(D.Z[te_idx] * w)
