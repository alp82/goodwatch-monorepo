from lib import *
import pickle, shape, sys
R = pickle.load(open('exp4.pkl', 'rb'))
def preds(o, kind, a, lam=0.15, cap=8.0):
    shape.CAP = cap
    if kind == 'reg': return o['reg']
    Pd = (o['full'] + o['point']) / 2 if kind == 'avg' else o[kind]; p = np.zeros(len(o['y']))
    for te, ty in o['trs']: p[te] = shape.decide(Pd[te], ty, a, lam)
    return p
def others(kind, a, lam=0.15, cap=8.0):
    sk, ms, rh, eb, nb = [], [], [], [], []
    for u, o in R['others'].items():
        y = o['y']; m = metrics(preds(o, kind, a, lam, cap), y); c = metrics(np.full(len(y), y.mean()), y)
        sk.append(1 - m['mae'] / np.abs(y - y.mean()).mean()); ms.append(1 - m['macro_mae'] / c['macro_mae']); rh.append(m['rho'])
        if m['mae_bad'] is not None: eb.append(m['mae_bad'] * m['n_bad']); nb.append(m['n_bad'])
    return np.mean(sk), np.mean(ms), np.mean(rh), np.sum(eb) / np.sum(nb), sum(s > 0 for s in sk)
def line(name, kind, a, lam=0.15, cap=8.0):
    P = [preds(o, kind, a, lam, cap) for o in R['owner']]; y = R['owner'][0]['y']; ms = [metrics(p, y) for p in P]; g = lambda k: np.mean([m[k] for m in ms])
    s = others(kind, a, lam, cap)
    print(f"{name:26s} OWNER mae {g('mae'):.3f} macro {g('macro_mae'):.3f} rho {g('rho'):.3f} bad {g('mae_bad'):.2f} mid {g('mae_mid'):.2f} hi {g('mae_hi'):.2f} pbad {g('pred_bad'):.2f} phi {g('pred_hi'):.2f} auc {g('auc_bad'):.3f} | OTHERS skill {s[0]:.3f} macroskill {s[1]:.3f} rho {s[2]:.3f} mae_bad {s[3]:.2f} pos {s[4]}/22")
line('regressor (mono gbm)', 'reg', 0)
for kind in ('full', 'point', 'avg'):
    for a in (0, .25, .5, .75, 1.0): line('%s a=%.2f' % (kind, a), kind, a)
for lam in (0, .3): line('point a=0.5 lam=%.2f' % lam, 'point', .5, lam)
for cap in (3, 20): line('point a=1 cap=%d' % cap, 'point', 1.0, .15, cap)
