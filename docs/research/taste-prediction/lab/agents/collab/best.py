"""collab best: baseline boosted trees, blended with two linear models:
  - the member's own ridge on the same columns (no other people involved; the control), and
  - a ridge on 5 numbers per title learned from OTHER members' ratings: a members' consensus score and 4 "taste axes"
    along which members here disagree (low-rank model z[v,i] ~ x_i.w0 + a_v.(U'x_i), fitted on D.others(user) only).
The predicted member's own ratings are used only through tr_idx/tr_y."""
import numpy as np
from sklearn.linear_model import Ridge
import lib, gbm_facts
_g = lib.make([]); _ax = lib.make_axes_ridge(4)
def _own(D, user, tr_idx, tr_y, te_idx):
    X = gbm_facts.features(D); Xi = np.nan_to_num((X - np.nanmean(X, 0)) / (np.nanstd(X, 0) + 1e-9))
    return Ridge(alpha=300.0).fit(Xi[tr_idx], tr_y).predict(Xi[te_idx])
def predict(D, user, tr_idx, tr_y, te_idx):
    a = (D, user, tr_idx, tr_y, te_idx)
    return 0.5 * _g(*a) + 0.25 * _own(*a) + 0.25 * _ax(*a)
