import numpy as np
from sklearn.linear_model import RidgeCV
def predict(D, user, tr_idx, tr_y, te_idx):
    g = np.array([x['goodwatch_overall_score_normalized_percent'] or 60 for x in D.info], dtype=float)[:, None]
    return RidgeCV().fit(g[tr_idx], tr_y).predict(g[te_idx])
