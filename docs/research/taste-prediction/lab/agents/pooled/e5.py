import sys, ev, pool, numpy as np, warnings
warnings.filterwarnings('ignore')
from ev import *
D = Data()
P = {'k0 own300': pool.make(k=0, own=300.), 'std own300': pool.make(k=0, own=300., std=True), 'std own150': pool.make(k=0, own=150., std=True), 'std own600': pool.make(k=0, own=600., std=True), 'std cal': pool.make(k=0, std=True)}
F = pool.fit_pool(D, D.owner, k=0, std=True); print(F['mu'].round(2), np.sqrt(np.diag(F['Sig'])).round(2), F['s2'])
bench(D, P, sizes=(5, 10, 40))
