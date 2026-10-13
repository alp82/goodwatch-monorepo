import numpy as np
from sklearn.linear_model import Ridge
from ev import ev; import lib, gbm_facts
from exp6 import own_ridge
def ridge_plus_axes(alpha=300.0, k=4, wa=3.0):
    """One linear model on the member's own columns plus the other-member axes (axes penalised less)."""
    def predict(D, user, tr_idx, tr_y, te_idx):
        X = gbm_facts.features(D); Xi = np.nan_to_num((X - np.nanmean(X, 0)) / (np.nanstd(X, 0) + 1e-9))
        T = lib.taste_axes(D, user, k=k); T = T / T.std(0) * wa
        Xa = np.hstack([Xi, T]); return Ridge(alpha=alpha).fit(Xa[tr_idx], tr_y).predict(Xa[te_idx])
    return predict
g = lib.make([]); ax = lib.make_axes_ridge(4); own = own_ridge(300.0)
three = lambda D, u, a, b, c: 0.5 * g(D, u, a, b, c) + 0.25 * own(D, u, a, b, c) + 0.25 * ax(D, u, a, b, c)
ev(g, 'base', setref='b')
ev(lib.blend(g, own, 0.6), '0.6 gbm + 0.4 own ridge', ref='b', setref='own')
ev(lib.blend(g, ax, 0.6), '0.6 gbm + 0.4 axes4', ref='own')
ev(three, '0.5 gbm + .25 own + .25 axes', ref='own')
ev(lib.blend(g, ridge_plus_axes(), 0.6), '0.6 gbm + 0.4 ridge(own+axes)', ref='own')
ev(lib.blend(g, ridge_plus_axes(), 0.5), '0.5 gbm + 0.5 ridge(own+axes)', ref='own')
