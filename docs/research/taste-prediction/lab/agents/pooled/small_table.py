"""Members who really have few ratings: 5-fold CV inside each member, bucketed by how many ratings they have."""
import ev, numpy as np
from ev import *
import preds as P
D = Data()
fs = {n: (P.ridge_fp.predict if n == 'ridge_fp' else getattr(P, n)) for n in ['const', 'everyone_raw', 'everyone_fit', 'ridge_fp', 'gbm', 'pooled_cal', 'pooled']}
for lo, hi in [(5, 9), (10, 19), (20, 39), (40, 59)]:
    nu = sum(lo <= len(rs) <= hi for rs in D._by.values()); nr = sum(len(rs) for rs in D._by.values() if lo <= len(rs) <= hi)
    print(f"-- members with {lo}-{hi} ratings: {nu} members, {nr} ratings (skill vs the mean of the visible ratings; rho only for 20+)")
    for nm, f in fs.items():
        s = small(D, f, lo, hi); print(f"   {nm:16s} skill {s[0]:+.3f} mae {s[2]:.3f} rho {s[1]:.3f}", flush=True)
