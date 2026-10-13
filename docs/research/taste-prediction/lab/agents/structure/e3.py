import numpy as np, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'baselines'))
from lab import ev, data
from sklearn.linear_model import RidgeCV
from sklearn.cross_decomposition import PLSRegression
import gbm_facts
D = data(); K = D.fp_keys; Z = D.Z
CR = [K.index(k) for k in ['direction','acting','cinematography','editing','music_composition','dialogue_quality','narrative_structure','rewatchability']]
TA = [i for i in range(74) if i not in CR]
AL = np.logspace(-1, 4, 16)
X = gbm_facts.features(D); F = X[:, 74:].copy()
med = np.nanmedian(F, 0); F = np.where(np.isnan(F), med, F); F = (F - F.mean(0)) / (F.std(0) + 1e-9)
S = F[:, :6]  # public scores
gw = F[:, [0]]
def rg(M):
    return lambda D, u, tr, y, te: RidgeCV(alphas=AL).fit(M[tr], y).predict(M[te])
def stage(A, B):  # fit A, then B on the residual
    def f(D, u, tr, y, te):
        m1 = RidgeCV(alphas=AL).fit(A[tr], y); m2 = RidgeCV(alphas=AL).fit(B[tr], y - m1.predict(A[tr]))
        return m1.predict(A[te]) + m2.predict(B[te])
    return f
def pls(k):
    return lambda D, u, tr, y, te: PLSRegression(k, scale=False).fit(Z[tr], y).predict(Z[te]).ravel()
if __name__ == '__main__':
    w = sys.argv[1]
    if w == 'q':
        ev(rg(S), 'public scores (6)')
        ev(rg(np.hstack([gw, Z[:, CR]])), 'gw score + craft')
        ev(stage(gw, Z[:, TA]), 'gw score then taste66')
        ev(stage(S, Z[:, TA]), 'scores then taste66')
        ev(stage(S, Z), 'scores then all74')
        ev(rg(np.hstack([F, Z])), 'ridge facts + all74')
        ev(stage(F, Z), 'facts then all74')
    if w == 'pls':
        for k in (1, 2, 3, 4, 6): ev(pls(k), f'pls k={k}')
