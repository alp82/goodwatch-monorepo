import ev, numpy as np
from ev import *
from calib_q import q
FP = dict(v='Tm', lin='L2+Ren+Rtags', fr=True); y = D.of(OWN)[1]
for eps in (.03, .1, -10, -20, -40):
    o = np.mean([q(run(OWN, s, eps=eps, out='dist', parts='p', strict=True, **FP), y) for s in range(4)], 0)
    ot = np.mean([np.mean([q(run(u, s, eps=eps, out='dist', parts='p', strict=True, **FP), D.of(u)[1]) for s in range(2)], 0) for u in USERS], 0)
    print(f'eps {eps} owner', o.round(4), 'others', ot.round(4), flush=True)
    for a in (.5, .75): print(line(f'   shape a={a}', preds(out='shape', parts='p', strict=True, tie=True, eps=eps, alpha=a, **FP)), flush=True)
