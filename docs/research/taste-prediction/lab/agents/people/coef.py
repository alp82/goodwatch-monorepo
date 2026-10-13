import lab, best, pf, numpy as np
from sklearn.linear_model import Ridge
from sklearn.model_selection import KFold
D = lab.data(); C = best._static(D); X = C['X']
def coefs(u):
    idx, y = D.of(u); oof = np.zeros(len(idx))
    for a, b in KFold(4, shuffle=True, random_state=0).split(idx): oof[b] = best._fit(C, X[idx[a]], y[a]).predict(X[idx[b]])
    r = y - oof; w = np.sqrt(30.0)
    A = np.c_[C['seq'][idx], w * best._series_effect(C['series'], idx, r, idx, r)]
    m = Ridge(alpha=30.0).fit(A, r); return m.coef_ * [1, 1, w], r, C['seq'][idx]
c, r, s = coefs(D.owner)
print('owner stage-2: sequel keyword %+.2f, per 10 years after the first film %+.2f, own franchise effect weight %+.2f' % tuple(c))
kw = s[:, 0] == 1; late = s[:, 1] >= 1.0
print('owner tree error on sequel-keyword titles: mean %+.2f (n=%d, se %.2f); 10+ years after first film: %+.2f (n=%d, se %.2f)' % (r[kw].mean(), kw.sum(), r[kw].std() / np.sqrt(kw.sum()), r[late].mean(), late.sum(), r[late].std() / np.sqrt(late.sum())))
cs = np.array([coefs(u)[0] for u in D.users()])
print('others: median coefs', np.median(cs, 0).round(2), 'share with positive franchise weight', (cs[:, 2] > 0).mean().round(2), 'share with negative sequel-keyword', (cs[:, 0] < 0).mean().round(2))
