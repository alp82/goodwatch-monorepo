import sys, pickle, numpy as np, ev
g = ev.G(); o = g['D'].owner; ld = lambda n: pickle.load(open(ev.HERE + f'/cache/res_{n}.pkl', 'rb'))
base = ld(sys.argv[1]); print(f'paired differences against {sys.argv[1]} (x1000, negative = better), mean ± se; others: mean over 22 members ± se, members improved')
print(f'{"config":22s} | {"own logloss":>12s} {"own brier<=5":>12s} {"own brier>=8":>12s} | {"oth logloss":>16s} {"oth brier<=5":>16s} {"oth brier>=8":>16s} | own auc  prior(pool)')
for n in sys.argv[2:]:
    r = ld(n); c = ev.compare(r, base, o); s = ev.summary(r[o]); pr = r[o].get('prior')
    f = lambda v: f'{1000 * v[0]:+5.1f}±{1000 * v[1]:4.1f}'; h = lambda v: f'{1000 * v[2]:+5.1f}±{1000 * v[3]:4.1f} {v[4]:2d}/22'
    print(f"{n:22s} | {f(c['ll']):>12s} {f(c['b5']):>12s} {f(c['b8']):>12s} | {h(c['ll']):>16s} {h(c['b5']):>16s} {h(c['b8']):>16s} | {s['auc']:.3f}  {'' if pr is None else ' '.join(f'{x:+.2f}' for v in pr for x in v)}")
