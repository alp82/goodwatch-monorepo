import numpy as np
KS = np.arange(1, 11)
def q(P, y):
    n = len(y); ll = -np.log(np.maximum(P[np.arange(n), y.astype(int) - 1], 1e-6)).mean(); C = np.cumsum(P, 1)
    return np.array([ll, ((C - (KS[None, :] >= y[:, None])) ** 2).sum(1).mean(), ((C[:, 4] - (y <= 5)) ** 2).mean()])
