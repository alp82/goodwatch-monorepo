import numpy as np, sys, warnings
warnings.filterwarnings('ignore')
from lab import ev, data
from e3 import S, F, gw, Z, CR, TA, AL, K
from e4 import chain, kern
from e5 import topm, stretch
from sklearn.cluster import KMeans
import gbm_facts
D = data()
def regions(k, cols, T=0.2, seed=0):
    A = Z[:, cols]; km = KMeans(k, n_init=10, random_state=seed).fit(A); d = km.transform(A) ** 2
    G = np.exp(-(d - d.min(1, keepdims=True)) / (T * len(cols))); return G / G.sum(1, keepdims=True), km
def blend(a, b, w=0.5):
    return lambda D, u, tr, y, te: w * a(D, u, tr, y, te) + (1 - w) * b(D, u, tr, y, te)
if __name__ == '__main__':
    w = sys.argv[1]; o = '--others' in sys.argv
    if w == 'reg':
        for k in (4, 6, 8):
            for nm, cols in (('all', list(range(74))), ('taste', TA)):
                G, _ = regions(k, cols); ev(chain(S, G - G.mean(0)), f'scores > {k} regions ({nm})', others=o)
    if w == 'fin':
        ev(chain(S, Z), 'scores > fp', others=o)
        G, _ = regions(6, TA); ev(chain(S, G - G.mean(0)), 'scores > 6 regions (taste)', others=o)
        ev(topm(6), 'scores > top 6 attrs', others=o)
        ev(kern(3, 3), 'scores > fp > metric kernel', others=o)
        ev(blend(chain(S, Z), gbm_facts.predict), 'blend(scores > fp, gbm facts)', others=o)
        ev(blend(kern(3, 3), gbm_facts.predict), 'blend(metric kernel, gbm facts)', others=o)
