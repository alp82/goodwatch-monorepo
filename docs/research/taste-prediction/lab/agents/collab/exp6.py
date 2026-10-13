"""Controls: is the blend gain from the other-member axes, or from blending the GBM with any linear model?"""
import numpy as np
from sklearn.linear_model import Ridge
from ev import ev; import lib, gbm_facts
def own_ridge(alpha, cols=None):
    def predict(D, user, tr_idx, tr_y, te_idx):
        X = gbm_facts.features(D); Xi = np.nan_to_num((X - np.nanmean(X, 0)) / (np.nanstd(X, 0) + 1e-9))
        if cols is not None: Xi = Xi[:, cols]
        return Ridge(alpha=alpha).fit(Xi[tr_idx], tr_y).predict(Xi[te_idx])
    return predict
def consensus_only(D, user, tr_idx, tr_y, te_idx):
    T = lib.taste_axes(D, user, k=4)[:, :1]; return Ridge(alpha=3.0).fit(T[tr_idx], tr_y).predict(T[te_idx])
if __name__ == '__main__':
    g = lib.make([])
    ev(g, 'base', setref='b')
    ev(lib.blend(g, own_ridge(300.0), 0.6), '0.6 gbm + 0.4 own ridge a300', ref='b')
    ev(lib.blend(g, own_ridge(1000.0), 0.6), '0.6 gbm + 0.4 own ridge a1000', ref='b')
    ev(lib.blend(g, own_ridge(3.0, [74]), 0.6), '0.6 gbm + 0.4 gw score', ref='b')
    ev(lib.blend(g, consensus_only, 0.6), '0.6 gbm + 0.4 member consensus', ref='b')
    ev(lib.blend(g, lib.make_axes_ridge(4), 0.6), '0.6 gbm + 0.4 axes4', ref='b', setref='ax')
    ev(lib.blend(g, lib.make_axes_ridge(4), 0.5), '0.5 gbm + 0.5 axes4', ref='b')
    ev(lib.blend(g, lib.make_axes_ridge(4), 0.75), '0.75 gbm + 0.25 axes4', ref='b')
