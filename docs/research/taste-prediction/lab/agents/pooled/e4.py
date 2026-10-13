import sys, ev, pool, numpy as np, warnings
warnings.filterwarnings('ignore')
from ev import *
D = Data()
P = {'k0 cf own300': pool.make(k=0, own=300., cf=True), 'k0 tree150 own300': pool.make(k=0, own=300., tree=150), 'k0 tree150': pool.make(k=0, tree=150)}
import time; t=time.time(); F = pool.fit_pool(D, D.owner, k=0, tree=150); print('fit %.1f'%(time.time()-t), F['mu'].round(2), np.sqrt(np.diag(F['Sig'])).round(2), F['s2'])
bench(D, P, do_small=False)
