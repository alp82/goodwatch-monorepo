import sys, ev, pool, meta, preds, numpy as np, warnings
warnings.filterwarnings('ignore')
from ev import *
D = Data()
mix = lambda a, b, w: (lambda *x: w * a(*x) + (1 - w) * b(*x))
P = {'meta gbm': meta.predict, 'pooled': preds.pooled, '0.5 meta + 0.5 pooled': mix(meta.predict, preds.pooled, 0.5), '0.3 meta + 0.7 pooled': mix(meta.predict, preds.pooled, 0.3)}
bench(D, P, sizes=(5, 10, 40), do_small=False)
