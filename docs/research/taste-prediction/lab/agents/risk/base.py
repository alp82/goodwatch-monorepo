"""Cache, per member / split seed / outer fold: inner out-of-fold scores (linear and tree parts of pooled/best.py) and the test scores."""
import sys, os, pickle, time, numpy as np
import common, harness
D = harness.Data(); part, nparts = int(sys.argv[1]), int(sys.argv[2])
users = [D.owner] + D.users(); SEEDS = 4
for ui, u in enumerate(users):
    if ui % nparts != part: continue
    p = os.path.join(common.HERE, 'cache', f'base_{u[:8]}.pkl')
    if os.path.exists(p): continue
    idx, y = D.of(u); out = {'idx': idx, 'y': y, 'folds': {}}; t = time.time()
    for seed in range(SEEDS):
        for f, (tr, te) in enumerate(common.splits(y, 5, seed)):
            ol, ot, pl, pt = common.inner_parts(D, u, idx[tr], y[tr], idx[te])
            out['folds'][(seed, f)] = dict(tr=tr, te=te, ol=ol, ot=ot, pl=pl, pt=pt)
    pickle.dump(out, open(p, 'wb')); print(u[:8], len(y), round(time.time() - t), flush=True)
