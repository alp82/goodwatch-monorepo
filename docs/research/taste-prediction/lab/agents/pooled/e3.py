import sys, ev, pool, numpy as np, warnings
warnings.filterwarnings('ignore')
from ev import *
D = Data(); part = sys.argv[1]
if part == 'a':
    P = {'k0 own100': pool.make(k=0, own=100.), 'k0 own300': pool.make(k=0, own=300.), 'k0 own300 cov.5': pool.make(k=0, own=300., prior='cov', rho=0.5),
         'k0 own300 cov.9': pool.make(k=0, own=300., prior='cov', rho=0.9), 'k0 own300 diag.9': pool.make(k=0, own=300., prior='diag', rho=0.9),
         'k0 own150 cov.9': pool.make(k=0, own=150., prior='cov', rho=0.9)}
else:
    P = {'pca5 own300': pool.make(k=5, basis='pca', own=300.), 'pca5 own150': pool.make(k=5, basis='pca', own=150.), 'pca10 own300': pool.make(k=10, basis='pca', own=300.),
         'k5 own150': pool.make(k=5, als=0, own=150.), 'pca5 own300 cov.9': pool.make(k=5, basis='pca', own=300., prior='cov', rho=0.9)}
bench(D, P)
