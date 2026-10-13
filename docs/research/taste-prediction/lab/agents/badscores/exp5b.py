from lib import *
import pickle, shape, warnings; warnings.filterwarnings('ignore')
R4 = pickle.load(open('exp4.pkl', 'rb')); R5 = pickle.load(open('exp5.pkl', 'rb'))
def merged(a, b): d = dict(a); d.update({k: v for k, v in b.items() if k not in ('trs', 'y')}); return d
R = {'owner': [merged(a, b) for a, b in zip(R4['owner'], R5['owner'])], 'others': {u: merged(R4['others'][u], R5['others'][u]) for u in R4['others']}}
def preds(o, ks, a, tb=None):
    Pd = sum(o[k] for k in ks) / len(ks); p = np.zeros(len(o['y']))
    for te, ty in o['trs']: p[te] = shape.decide(Pd[te], ty, a)
    return p
def line(ks, a):
    y = R['owner'][0]['y']; ms = [metrics(preds(o, ks, a), y) for o in R['owner']]; g = lambda k: np.mean([m[k] for m in ms])
    sk, mk, rh = [], [], []
    for u, o in R['others'].items():
        yu = o['y']; m = metrics(preds(o, ks, a), yu); c = metrics(np.full(len(yu), yu.mean()), yu)
        sk.append(1 - m['mae'] / np.abs(yu - yu.mean()).mean()); mk.append(1 - m['macro_mae'] / c['macro_mae']); rh.append(m['rho'])
    print(f"{'+'.join(ks):22s} a={a:.2f} OWNER mae {g('mae'):.3f} macro {g('macro_mae'):.3f} rho {g('rho'):.3f} bad {g('mae_bad'):.2f} mid {g('mae_mid'):.2f} hi {g('mae_hi'):.2f} auc {g('auc_bad'):.3f} | OTHERS skill {np.mean(sk):.3f} macroskill {np.mean(mk):.3f} rho {np.mean(rh):.3f}")
for ks in (('full', 'point'), ('fast', 'point3'), ('logit', 'point3'), ('fast', 'logit'), ('fast', 'logit', 'point3'), ('full', 'logit', 'point'), ('fast',), ('point3',), ('logit',)):
    for a in (0, .5, 1.0): line(ks, a)
print('--- curve for fast+logit+point3')
K = ('fast', 'logit', 'point3')
for a in (0, .25, .5, .75, 1.0): line(K, a)
# paired bootstrap vs the plain regressor (owner, seed 0 folds), and per-member wins
rng = np.random.default_rng(0); o = R['owner'][0]; y = o['y']; base = o['reg']
def mm(p, y, i): m = metrics(p[i], y[i]); return np.array([m['mae'], m['macro_mae'], m['mae_bad'], m['mae_mid'], m['mae_hi']])
for a in (0, .5, 1.0):
    p = preds(o, K, a); d = np.array([mm(p, y, i) - mm(base, y, i) for i in (rng.integers(0, len(y), len(y)) for _ in range(1000))])
    print('a=%.1f minus regressor [mae, macro, bad, mid, hi]: mean' % a, d.mean(0).round(3), '5%', np.quantile(d, .05, 0).round(3), '95%', np.quantile(d, .95, 0).round(3), 'P(better): mae %.2f macro %.2f' % ((d[:, 0] < 0).mean(), (d[:, 1] < 0).mean()))
for a in (0, .5, 1.0):
    w = wm = n = 0
    for u, ou in R['others'].items():
        yu = ou['y']; m = metrics(preds(ou, K, a), yu); b = metrics(ou['reg'], yu); n += 1; w += m['mae'] < b['mae']; wm += m['macro_mae'] < b['macro_mae']
    print('a=%.1f others: lower mae than regressor for %d/%d members, lower macro for %d/%d' % (a, w, n, wm, n))
# what share of the plain-mae gain is just integer answers? round the regressor
ms = [metrics(np.round(oo['reg']), y) for oo in R['owner']]; print('rounded regressor: owner mae %.3f macro %.3f' % (np.mean([m['mae'] for m in ms]), np.mean([m['macro_mae'] for m in ms])))
sk = [1 - metrics(np.round(ou['reg']), ou['y'])['mae'] / np.abs(ou['y'] - ou['y'].mean()).mean() for ou in R['others'].values()]; print('rounded regressor: others skill %.3f' % np.mean(sk))
# distribution of predictions
p = preds(o, K, 1.0); print('a=1 predicted rounded counts 1..10', np.bincount(np.round(p).astype(int), minlength=11)[1:], 'actual', np.bincount(y.astype(int), minlength=11)[1:])
m = np.round(p) <= 5; print('a=1: predicted <=5: %d titles, of which truly <=5: %d, 6-7: %d, >=8: %d ; recall of bad %.2f' % (m.sum(), (y[m] <= 5).sum(), ((y[m] > 5) & (y[m] < 8)).sum(), (y[m] >= 8).sum(), m[y <= 5].mean()))
p = preds(o, K, 0.5); m = np.round(p) <= 5; print('a=.5: predicted <=5: %d titles, truly <=5: %d, 6-7: %d, >=8: %d ; recall %.2f' % (m.sum(), (y[m] <= 5).sum(), ((y[m] > 5) & (y[m] < 8)).sum(), (y[m] >= 8).sum(), m[y <= 5].mean()))
m = np.round(base) <= 5; print('regressor: predicted <=5: %d titles, truly <=5: %d ; recall %.2f' % (m.sum(), (y[m] <= 5).sum(), m[y <= 5].mean()))
