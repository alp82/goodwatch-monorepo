"""Learning curves: skill and rho by number of visible ratings, owner and the 22 other 60+ members."""
import sys, json, ev, numpy as np
from ev import *
import preds as P
D = Data(); which = sys.argv[1]
names = sys.argv[2].split(',') if len(sys.argv) > 2 else ['const', 'everyone_raw', 'everyone_shift', 'everyone_fit', 'ridge_fp', 'ridge_all', 'gbm', 'pooled_cal', 'pooled', 'pooled_gbm']
import best
fs = {n: (P.ridge_fp.predict if n == 'ridge_fp' else best.predict if n == 'best' else getattr(P, n)) for n in names}
if which == 'owner': sizes = (5, 10, 20, 40, 80, 160, 320, 640); rec = curve(D, fs, [D.owner], sizes=sizes, draws=12)
else: sizes = (5, 10, 20, 40, 80, 160); rec = curve(D, fs, D.users(), sizes=sizes, draws=6)
show_curve(rec, sizes, which)
tag = which + ('_' + sys.argv[3] if len(sys.argv) > 3 else '')
json.dump({nm: {str(n): [list(map(float, a)) for a in r[n]] for n in sizes} for nm, r in rec.items()}, open(f'curve_{tag}.json', 'w'))
