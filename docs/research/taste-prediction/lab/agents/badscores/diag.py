from lib import *
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold
D = Data(); X = features(D); idx, y = D.of(D.owner)
print('y mean %.2f sd %.2f' % (y.mean(), y.std()))
base = lambda D,u,tr,ty,te: gbm().fit(X[tr], ty).predict(X[te])
P, _ = multi(D, base, D.owner); show('gbm base', P, y)
p = np.mean(P, 0)
# calibration: slope of y on pred, mean y per pred decile
sl = np.polyfit(p, y, 1); print('slope y~pred %.3f icpt %.2f ; pred sd %.2f ; rho*sd(y) %.2f' % (sl[0], sl[1], p.std(), np.corrcoef(p,y)[0,1]*y.std()))
q = np.quantile(p, np.linspace(0,1,11)); b = np.clip(np.searchsorted(q, p, side='right')-1, 0, 9)
for k in range(10):
    m = b==k; print('decile %d pred %.2f  y mean %.2f sd %.2f  share<=5 %.2f share>=8 %.2f' % (k, p[m].mean(), y[m].mean(), y[m].std(), (y[m]<=5).mean(), (y[m]>=8).mean()))
r = y - p; print('residual sd %.2f ; resid by band: bad %.2f mid %.2f hi %.2f' % (r.std(), r[y<=5].mean(), r[(y>5)&(y<8)].mean(), r[y>=8].mean()))
# what would an oracle of this noise level look like? simulate: y = latent + noise, perfectly calibrated E[y|x]=p
rng = np.random.default_rng(0); 
# classifiers
for nm, t in (('bad<=5', y<=5), ('low<=6', y<=6), ('hi>=8', y>=8), ('top>=9', y>=9)):
    A = []
    for s in range(3):
        o = np.zeros(len(y))
        for tr, te in StratifiedKFold(10, shuffle=True, random_state=s).split(idx, t):
            o[te] = gbc().fit(X[idx[tr]], t[tr]).predict_proba(X[idx[te]])[:,1]
        A.append(roc_auc_score(t, o))
    sgn = 1 if nm[0] in 'ht' else -1
    print('classifier %s auc %.3f | regressor used as ranker auc %.3f | prevalence %.2f' % (nm, np.mean(A), roc_auc_score(t, sgn*p), t.mean()))
    if nm == 'bad<=5':
        for th in (0.2, 0.3, 0.5):
            m = o > th; print('   p>%.1f: flagged %d, precision %.2f, recall %.2f' % (th, m.sum(), t[m].mean() if m.any() else 0, m[t].mean()))
# simplest expansions (in-sample scale, optimistic but 1-2 params)
for a in (1.0, 1.25, 1.5, 1.75, 2.0, 2.5):
    show('expand x%.2f around mean' % a, [y.mean() + a*(pp - pp.mean()) for pp in P], y)
# rank-based best case: assign sorted y to rank of p (quantile map in-sample)
show('quantile map (in-sample)', [np.sort(y)[np.argsort(np.argsort(pp))] for pp in P], y)
