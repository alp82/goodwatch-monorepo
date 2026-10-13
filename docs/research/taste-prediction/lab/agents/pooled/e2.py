import sys, ev, pool, numpy as np, warnings
warnings.filterwarnings('ignore')
from ev import *
D = Data(); part = sys.argv[1]
if part == 'a':
    P = {'k5': pool.make(k=5, als=0), 'k5 own1000': pool.make(k=5, als=0, own=1000.),
         'k5 own300': pool.make(k=5, als=0, own=300.), 'k5 pca': pool.make(k=5, basis='pca'), 'k0': pool.make(k=0), 'k0 own300': pool.make(k=0, own=300.)}
else:
    P = {'k3': pool.make(k=3, als=0), 'k12': pool.make(k=12, als=0), 'k8 own1000': pool.make(k=8, als=0, own=1000.), 'k5 noscale': pool.make(k=5, als=0, scale=False),
         'k5 lam0=1000': pool.make(k=5, als=0, lam0=1000.), 'k5 fp': pool.make(k=5, als=0, kind='fp'), 'k5 base': pool.make(k=5, als=0, kind='base')}
bench(D, P)
