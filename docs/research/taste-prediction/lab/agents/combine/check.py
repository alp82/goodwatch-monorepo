import sys, time, numpy as np, ev, best
from ev import *
S = best._static(D); assert np.allclose(S['seq'], F['seq']), 'seq'
assert all((a is None and not g) or (g and g[0][0] == a) for a, g in zip(S['series'], F['series']))
Xl, mono = matrix(D, False, True); assert np.allclose(np.nan_to_num(S['X']), np.nan_to_num(Xl)) and (mono == S['mono']).all()
idx, y, sp = splits(D, OWN, 0); tr, te = sp[0]; t = time.time()
o, p, _ = best._fit(D, OWN, idx[tr], y[tr], idx[te]); print('fit s', time.time() - t)
c = load(OWN, 0)[0]; o2, p2 = point(c, idx[tr], y[tr], idx[te], v='Tm', lin='L2+Ren+Rtags', fr=True)
print('max diff oof/te vs cache', np.abs(o - np.clip(o2, 1, 10)).max(), np.abs(p - np.clip(p2, 1, 10)).max())
P = best.distribution(D, OWN, idx[tr], y[tr], idx[te]); print(P.sum(1)[:3], P.min(), best.predict(D, OWN, idx[tr], y[tr], idx[te])[:8], y[te][:8])
