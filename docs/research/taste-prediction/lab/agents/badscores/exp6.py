import sys; sys.argv = sys.argv[:1]
import io, contextlib
with contextlib.redirect_stdout(io.StringIO()): exec(open('exp5b.py').read().split("print('--- curve")[0])
def rline(name, f):
    y = R['owner'][0]['y']; ms = [metrics(f(o), y) for o in R['owner']]; g = lambda k: np.mean([m[k] for m in ms])
    sk, mk, rh = [], [], []
    for u, o in R['others'].items():
        yu = o['y']; m = metrics(f(o), yu); c = metrics(np.full(len(yu), yu.mean()), yu)
        sk.append(1 - m['mae'] / np.abs(yu - yu.mean()).mean()); mk.append(1 - m['macro_mae'] / c['macro_mae']); rh.append(m['rho'])
    print(f"{name:34s} OWNER mae {g('mae'):.3f} macro {g('macro_mae'):.3f} rho {g('rho'):.3f} bad {g('mae_bad'):.2f} mid {g('mae_mid'):.2f} hi {g('mae_hi'):.2f} auc {g('auc_bad'):.3f} | OTHERS skill {np.mean(sk):.3f} macroskill {np.mean(mk):.3f} rho {np.mean(rh):.3f}")
def stretch(o, s, lam=0.15, shift=0.0):
    p = np.zeros(len(o['y']))
    for te, ty in o['trs']: q = ty.mean() + shift + s * (o['reg'][te] - ty.mean()); p[te] = (1 - lam) * np.round(q) + lam * q
    return p
rline('regressor', lambda o: o['reg'])
rline('round(regressor), no tiebreak', lambda o: np.round(o['reg']))
for s in (1.0, 1.25, 1.5, 1.75, 2.0): rline('round(stretch x%.2f)+.15 tiebreak' % s, lambda o, s=s: stretch(o, s))
for sh in (-0.25, 0.25): rline('round(stretch x1.5 shift %+.2f)' % sh, lambda o, sh=sh: stretch(o, 1.5, shift=sh))
K = ('fast', 'logit', 'point3')
for a in (0, .25, .5, .75, 1.0): rline('ordinal dists a=%.2f' % a, lambda o, a=a: preds(o, K, a))
# decision on the averaged dist: rounded weighted mean instead of weighted median
def wmean_round(o, a, lam=0.15):
    Pd = sum(o[k] for k in K) / 3; p = np.zeros(len(o['y']))
    for te, ty in o['trs']:
        W = Pd[te] * shape.band_weights(ty, a); q = (W @ shape.KS) / W.sum(1); p[te] = (1 - lam) * np.round(q) + lam * q
    return p
for a in (0, .5, 1.0): rline('ordinal dists, round(wmean) a=%.1f' % a, lambda o, a=a: wmean_round(o, a))
