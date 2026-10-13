import numpy as np
from sklearn.linear_model import RidgeCV
def predict(D, user, tr_idx, tr_y, te_idx):
    return RidgeCV(alphas=np.logspace(0, 4, 13)).fit(D.Z[tr_idx], tr_y).predict(D.Z[te_idx])
