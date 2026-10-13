import numpy as np, sys
from lab import ev, data
from sklearn.linear_model import RidgeCV, Ridge
D = data(); K = D.fp_keys
CR = [K.index(k) for k in ['direction','acting','cinematography','editing','music_composition','dialogue_quality','narrative_structure','rewatchability']]
TA = [i for i in range(74) if i not in CR]
AL = np.logspace(0, 4, 13)
def ridge(cols):
    def f(D, u, tr, y, te): return RidgeCV(alphas=AL).fit(D.Z[tr][:, cols], y).predict(D.Z[te][:, cols])
    return f
def qmean(D, u, tr, y, te):
    q = D.Z[:, CR].mean(1)[:, None]; return RidgeCV(alphas=AL).fit(q[tr], y).predict(q[te])
def two_stage(D, u, tr, y, te):  # craft first, then taste on residual
    m1 = RidgeCV(alphas=AL).fit(D.Z[tr][:, CR], y); r = y - m1.predict(D.Z[tr][:, CR])
    m2 = RidgeCV(alphas=AL).fit(D.Z[tr][:, TA], r); return m1.predict(D.Z[te][:, CR]) + m2.predict(D.Z[te][:, TA])
ev(ridge(list(range(74))), 'ridge all 74')
ev(ridge(CR), 'ridge craft 8')
ev(qmean, 'craft mean only')
ev(ridge(TA), 'ridge taste 66')
ev(two_stage, 'craft then taste residual')
