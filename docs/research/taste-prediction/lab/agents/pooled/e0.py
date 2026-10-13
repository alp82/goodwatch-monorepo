import ev, pool, numpy as np, time
from ev import *
D = Data()
for kw in (dict(k=0), dict(k=5, als=0), dict(k=5, als=1), dict(k=5,als=4)):
    t=time.time(); F = pool.fit_pool(D, D.owner, **kw); print(kw, 'fit %.1fs'%(time.time()-t), 'mu', F['mu'].round(2), 's2 %.2f'%F['s2'], 'sd', np.sqrt(np.diag(F['Sig'])).round(2), flush=True)
