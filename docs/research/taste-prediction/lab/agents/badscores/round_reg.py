"""Reference: the plain regressor, answer rounded to a whole rating (85%) plus 15% of the raw score to keep the ranking."""
import numpy as np, shape
from sklearn.ensemble import HistGradientBoostingRegressor
def predict(D, user, tr_idx, tr_y, te_idx):
    from gbm_facts import features
    X = features(D); mono = [0] * 74 + [1] * 6 + [0] * (X.shape[1] - 80)
    p = HistGradientBoostingRegressor(max_depth=3, max_iter=150, learning_rate=0.05, min_samples_leaf=8, l2_regularization=1.0, monotonic_cst=mono, random_state=3).fit(X[tr_idx], tr_y).predict(X[te_idx])
    return 0.85 * np.round(p) + 0.15 * p
