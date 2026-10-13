"""Calibration of the base risk (score only) inside groups of titles: does a group hold more bad titles than its scores say?
z = (observed - expected) / binomial sd. Owner, and the 22 other members pooled."""
import sys, pickle, numpy as np
import ev
g = ev.G(); D = g['D']; res = pickle.load(open(ev.HERE + '/cache/res_' + (sys.argv[1] if len(sys.argv) > 1 else 'po') + '.pkl', 'rb'))
X = ev.FE.get(D); names = ev.FE.NAMES
def rows(users):
    out = []
    for u in users:
        r = res[u]; risk = r['P'][:, :, :5].sum(2).mean(0); hi = r['P'][:, :, 7:].sum(2).mean(0); B = pickle.load(open(ev.HERE + f'/cache/base_{u[:8]}.pkl', 'rb'))
        dis = np.zeros(len(r['y']))
        for s in range(3):
            for f in range(5): c = B['folds'][(s, f)]; dis[c['te']] += (c['pl'] - c['pt']) / 3
        out.append((r['idx'], r['y'], risk, hi, dis, r['score'].mean(0)))
    return [np.concatenate([o[j] for o in out]) for j in range(6)]
def table(users, title):
    idx, y, risk, hi, dis, sc = rows(users); bad = y <= 5; top = y >= 8
    print(f'--- {title}: n {len(y)}, bad {bad.mean():.3f} (expected {risk.mean():.3f})')
    print(f'{"group":34s} {"n":>5s} {"bad obs":>8s} {"bad exp":>8s} {"z":>6s} | {"8+ obs":>7s} {"8+ exp":>7s} {"z":>6s} | resid sd in / out')
    G = {}
    for j, nm in enumerate(names):
        v = X[idx, j]
        if set(np.unique(X[:, j])) <= {0.0, 1.0}: G[nm] = v > 0
        else:
            lo, hi_ = np.quantile(X[:, j], [0.2, 0.8])
            if hi_ > np.median(X[:, j]): G[nm + ' top fifth of catalog'] = v >= hi_
            if lo < np.median(X[:, j]): G[nm + ' bottom fifth'] = v <= lo
    G['dis: linear well above trees'] = dis > np.quantile(dis, 0.8); G['dis: trees well above linear'] = dis < np.quantile(dis, 0.2)
    G['abs_dis top fifth'] = np.abs(dis) > np.quantile(np.abs(dis), 0.8)
    for nm, m in G.items():
        if m.sum() < 15: continue
        e = risk[m].sum(); sd = np.sqrt((risk[m] * (1 - risk[m])).sum()); e8 = hi[m].sum(); sd8 = np.sqrt((hi[m] * (1 - hi[m])).sum()); r = y - sc
        print(f'{nm:34s} {m.sum():5d} {bad[m].mean():8.3f} {risk[m].mean():8.3f} {(bad[m].sum() - e) / sd:+6.1f} | {top[m].mean():7.3f} {hi[m].mean():7.3f} {(top[m].sum() - e8) / sd8:+6.1f} | {r[m].std():.2f} / {r[~m].std():.2f}')
table([D.owner], 'OWNER'); table([u for u in res if u != D.owner], '22 OTHERS pooled')
