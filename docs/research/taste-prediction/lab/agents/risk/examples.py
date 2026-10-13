import pickle, numpy as np, ev
g = ev.G(); D = g['D']; r = pickle.load(open(ev.HERE + '/cache/res_po.pkl', 'rb'))[D.owner]; y = r['y']; idx = r['idx']
risk = r['P'][:, :, :5].sum(2).mean(0); sc = r['score'].mean(0); pred = r['pred'].mean(0); X = ev.FE.get(D); N = ev.FE.NAMES
def row(i):
    x = D.info[idx[i]]; f = lambda k: '--' if x.get(k) is None else f'{x[k]:.0f}'
    tags = [n for n in ('sequel', 'kind_spectacle', 'kind_sitcom') if X[idx[i], N.index(n)] > 0]
    return f"{x['title'][:38]:38s} {x['release_year']} rated {y[i]:.0f} | risk {risk[i]:.2f} score {sc[i]:.1f} pred {pred[i]:.1f} | imdb {f('imdb_user_score_normalized_percent')} tmdb {f('tmdb_user_score_normalized_percent')} rtA {f('rotten_tomatoes_audience_score_normalized_percent')} mcU {f('metacritic_user_score_normalized_percent')} | mc {f('metacritic_meta_score_normalized_percent')} rt {f('rotten_tomatoes_tomato_score_normalized_percent')} | {' '.join(tags)}"
o = np.argsort(-risk)
print('== 25 riskiest titles (cross-validated)'); [print(row(i)) for i in o[:25]]
bad = np.where(y <= 5)[0]; b = bad[np.argsort(risk[bad])]
print('== 15 bad titles the model did not see coming (lowest risk among rated <= 5)'); [print(row(i)) for i in b[:15]]
print('== 10 high-risk titles the owner liked (rated 8+)'); h = np.where(y >= 8)[0]; [print(row(i)) for i in h[np.argsort(-risk[h])][:10]]
# what the risk is made of
f = lambda k: np.array([np.nan if D.info[i].get(k) is None else D.info[i][k] for i in idx], float)
print('== rank correlation of risk with title facts (owner titles)')
from scipy.stats import spearmanr
for k in ['imdb_user_score_normalized_percent', 'tmdb_user_score_normalized_percent', 'rotten_tomatoes_audience_score_normalized_percent', 'metacritic_user_score_normalized_percent', 'metacritic_meta_score_normalized_percent', 'rotten_tomatoes_tomato_score_normalized_percent']:
    v = f(k); m = ~np.isnan(v); print(f'   {k:52s} rho {spearmanr(v[m], risk[m])[0]:+.2f}   with bad (0/1): {spearmanr(v[m], (y <= 5)[m])[0]:+.2f}')
for n in ['sequel', 'kind_spectacle', 'kind_sitcom', 'hype', 'aud_crit', 'spread', 'is_show']:
    v = X[idx, N.index(n)]; print(f'   {n:52s} rho {spearmanr(v, risk)[0]:+.2f}   with bad (0/1): {spearmanr(v, y <= 5)[0]:+.2f}')
print('== bad share by audience score band (IMDb) x sequel')
im = f('imdb_user_score_normalized_percent'); sq = X[idx, N.index('sequel')] > 0
for a, bnd in zip([0, 60, 65, 70, 75, 80], [60, 65, 70, 75, 80, 101]):
    m = (im >= a) & (im < bnd); print(f'   imdb {a}-{bnd}: n {m.sum():3d} bad {np.mean((y <= 5)[m]):.2f} mean risk {risk[m].mean():.2f} | sequels n {(m & sq).sum():3d} bad {np.mean((y <= 5)[m & sq]) if (m & sq).sum() else float("nan"):.2f} risk {risk[m & sq].mean() if (m & sq).sum() else float("nan"):.2f}')
