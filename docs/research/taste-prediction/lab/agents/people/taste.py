import lab, pf, pf2, numpy as np, pickle, collections
D = lab.data(); S = pf.static(D); S2 = pf2.static2(D)
idx, y = D.of(D.owner); G = S['G']; mu = y.mean()
g = S['base'][idx, 74]; A = np.c_[np.ones(len(g)), g]; w = np.linalg.lstsq(A, y, rcond=None)[0]; rl = y - A @ w   # vs public score
print(f'owner mean {mu:.2f}, n {len(y)}; rating = {w[0]:.2f} + {w[1]:.3f} * public score')
series_name = {}
for i, x in enumerate(D.info):
    s = x.get('movie_series_id')
    if s is not None: series_name.setdefault(s, []).append((x.get('release_year') or 9999, x['title']))
def nm(gname, e):
    if gname in ('cast', 'director', 'writer', 'producer', 'composer', 'dop', 'lead'): return D.person_names.get(e, str(e))
    if gname == 'series': return sorted(series_name[e])[0][1] + ' series'
    return str(e)
def table(gname, k=2.0, minn=3, top=10, weightless=True):
    s = collections.defaultdict(lambda: [0.0, 0.0, 0]); 
    for a, i in enumerate(idx):
        for e, _ in G[gname][i]: s[e][0] += y[a] - mu; s[e][1] += rl[a]; s[e][2] += 1
    rows = [(nm(gname, e), v[2], mu + v[0] / v[2], v[0] / (v[2] + k), v[1] / (v[2] + k)) for e, v in s.items() if v[2] >= minn]
    rows.sort(key=lambda t: -t[3])
    f = lambda t: f"{t[0]} (n={t[1]}, avg {t[2]:.1f}, shrunk {t[3]:+.2f}, vs public {t[4]:+.2f})"
    print(f'\n## {gname}: {len(rows)} with n>={minn}'); print('  UP:   ' + '; '.join(f(t) for t in rows[:top])); print('  DOWN: ' + '; '.join(f(t) for t in rows[::-1][:top]))
for gname, mn, top in [('director', 3, 12), ('cast', 4, 15), ('writer', 3, 8), ('composer', 4, 8), ('producer', 4, 8), ('dop', 4, 6), ('series', 3, 10), ('company', 8, 10), ('lang', 3, 6), ('country', 3, 5), ('era', 5, 8), ('genre', 8, 8), ('genre_era', 10, 10), ('method_genre', 8, 8), ('highlight', 10, 10), ('flag_genre', 15, 8), ('cert_genre', 12, 8)]:
    table(gname, minn=mn, top=top)
# simple facts
E = S['extra']; EN = S['extra_names']
print('\n## flags / facts: mean rating with vs without (n with), and vs-public residual')
rows = []
for j, n_ in enumerate(EN):
    x = E[idx, j]
    if set(np.unique(x[~np.isnan(x)])) <= {0.0, 1.0} and 10 <= x.sum() <= len(x) - 10: rows.append((n_, int(x.sum()), y[x == 1].mean(), y[x == 0].mean(), rl[x == 1].mean()))
for t in sorted(rows, key=lambda t: t[3] - t[2]): print(f'  {t[0]:34s} n={t[1]:3d} with {t[2]:.2f} without {t[3]:.2f}  vs public {t[4]:+.2f}')
for nm_, col, bins in [('runtime', E[idx, 0], [0, 90, 100, 110, 125, 150, 400]), ('year', S['base'][idx, 80], [1900, 1980, 1990, 2000, 2010, 2020, 2030]), ('cert_us', E[idx, 7], [-1, 0.5, 1.5, 2.5, 5]), ('series_pos', S2['fr'][idx, 0], [-1, 0.5, 1.5, 2.5, 20]), ('log_pop', E[idx, 1], [-3, 0.6, 0.9, 1.2, 5])]:
    print(f'  {nm_}: ' + '; '.join(f'{bins[b]}-{bins[b+1]}: n={((col > bins[b]) & (col <= bins[b+1])).sum()} avg {y[(col > bins[b]) & (col <= bins[b+1])].mean():.2f} vs public {rl[(col > bins[b]) & (col <= bins[b+1])].mean():+.2f}' for b in range(len(bins) - 1)))
ins = S2['fr'][idx, 1] > 0; kw = E[idx, 16] == 1
print('  sequel keyword: n', kw.sum(), 'avg', y[kw].mean().round(2), 'vs public', rl[kw].mean().round(2), '| share rated <=5:', (y[kw] <= 5).mean().round(2), 'vs', (y[~kw] <= 5).mean().round(2))
show = S['base'][idx, 81] == 1; print('  shows n', show.sum(), 'avg', y[show].mean().round(2), 'vs public', rl[show].mean().round(2), '| movies', y[~show].mean().round(2), rl[~show].mean().round(2))
