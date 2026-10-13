"""What the pooled model says about one member (default: the owner): offset, slope on the consensus, personal weights."""
import sys, numpy as np, ev, pool
from ev import *
D = Data(); u = D.owner
F = pool.fit_pool(D, u, k=0); X = F['X']; names = F['names']; T = F['T']; idx, y = D.of(u)
c, S = pool.posterior(T[idx], y, F['mu'], F['Sig'], F['s2'])
print('population: offset %.2f (sd %.2f across members), slope on consensus %.2f (sd %.2f), noise sd %.2f' % (F['mu'][0], np.sqrt(F['Sig'][0, 0]), F['mu'][1], np.sqrt(F['Sig'][1, 1]), np.sqrt(F['s2'])))
print('owner: offset %.2f +- %.2f, slope %.2f +- %.2f' % (c[0], np.sqrt(S[0, 0]), c[1], np.sqrt(S[1, 1])))
M = F['M']; print('share of members (5+ ratings) with slope below the owner: %.2f' % np.mean(M[F['cnt'] >= 5, 1] < c[1]))
r = y - T[idx] @ c; A = X[idx]; d = np.linalg.solve(A.T @ A + 300 * np.eye(X.shape[1]), A.T @ r)
print('variance of the owner ratings explained: consensus part %.3f, + personal weights %.3f (in sample)' % (1 - np.var(y - T[idx] @ c) / np.var(y), 1 - np.var(r - A @ d) / np.var(y)))
w0 = F['w0']; o = np.argsort(w0); named = [j for j in range(len(names)) if not names[j][:3] in ('emb', 'tag', 'txt')]
print('consensus weights, top +:', ', '.join(f"{names[j]} {w0[j]:+.3f}" for j in o[::-1] if j in named)[:900])
print('consensus weights, top -:', ', '.join(f"{names[j]} {w0[j]:+.3f}" for j in o if j in named)[:900])
o = np.argsort(d)
print('owner personal weights (rating points per sd), +:', ', '.join(f"{names[j]} {d[j]:+.3f}" for j in o[::-1] if j in named)[:700])
print('owner personal weights, -:', ', '.join(f"{names[j]} {d[j]:+.3f}" for j in o if j in named)[:700])
votes = np.array([x['goodwatch_overall_score_voting_count'] or 0 for x in D.info]); known = np.where(votes >= 50000)[0]
per = X @ d; oo = known[np.argsort(per[known])]
print('well-known titles the personal part lifts most:', '; '.join(f"{D.info[i]['title']} ({per[i]:+.1f})" for i in oo[::-1][:14]))
print('well-known titles the personal part lowers most:', '; '.join(f"{D.info[i]['title']} ({per[i]:+.1f})" for i in oo[:14]))
g = T[:, 1]; oo = known[np.argsort(g[known])]
print('consensus top:', '; '.join(D.info[i]['title'] for i in oo[::-1][:12])); print('consensus bottom:', '; '.join(D.info[i]['title'] for i in oo[:12]))
gw = np.array([x['goodwatch_overall_score_normalized_percent'] or np.nan for x in D.info]); ok = ~np.isnan(gw)
print('corr(consensus, public GoodWatch score) over the catalog: %.2f' % np.corrcoef(g[ok], gw[ok])[0, 1])
res = g - np.polyval(np.polyfit(gw[ok], g[ok], 1), np.where(ok, gw, np.nanmean(gw))); kk = known[ok[known]]; oo = kk[np.argsort(res[kk])]
print('members here like MORE than the public score says:', '; '.join(D.info[i]['title'] for i in oo[::-1][:14]))
print('members here like LESS than the public score says:', '; '.join(D.info[i]['title'] for i in oo[:14]))
