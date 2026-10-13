"""Readable shared basis: consensus weights and k taste axes over the 74 attributes, with example titles; stability across member halves."""
import sys, numpy as np, ev, pool
from ev import *
D = Data(); K = int(sys.argv[1]) if len(sys.argv) > 1 else 5
votes = np.array([x['goodwatch_overall_score_voting_count'] or 0 for x in D.info]); known = votes >= 20000
rated = np.zeros(D.n, bool); rated[[r[1] for r in D.ratings]] = True
class Sub:
    def __init__(s, D, keep): s.__dict__.update(D.__dict__); s.keep = keep; s.D = D
    def others(s, user):
        rs = [r for r in s.D.ratings if r[0] in s.keep]; return np.array([r[0] for r in rs]), np.array([r[1] for r in rs]), np.array([r[2] for r in rs], dtype=float)
us = sorted(D._by); rs = np.random.RandomState(1); perm = rs.permutation(len(us))
print('== stability: cosines between the axis subspaces learned from two disjoint halves of the members (1 = same, chance for k of 74 dims ~ sqrt(k/74))')
for k in (2, 3, 5, 8):
    Us = []
    for h in range(2):
        keep = {us[i] for i in perm[h::2]}; F = pool.fit_pool(Sub(D, keep), 'half%d' % h, k=k, kind='fp', als=1); Us.append(F['U'])
    print(k, 'principal cosines', np.linalg.svd(Us[0].T @ Us[1], compute_uv=False).round(2), 'chance ~%.2f' % np.sqrt(k / 74))
F = pool.fit_pool(D, D.owner, k=K, kind='fp', als=1); U = F['U']; X = F['X']; names = F['names']; T = F['T']
print('== population (other members): mu', F['mu'].round(2), 'sd of member coefficients', np.sqrt(np.diag(F['Sig'])).round(2), 'noise sd %.2f' % np.sqrt(F['s2']))
w0 = F['w0']; o = np.argsort(w0)
print('consensus (what members here reward beyond their own average): +', ', '.join(f"{names[j]} {w0[j]:+.3f}" for j in o[::-1][:10]))
print('                                                               -', ', '.join(f"{names[j]} {w0[j]:+.3f}" for j in o[:10]))
idx, y = D.of(D.owner); c, S = pool.posterior(T[idx], y, F['mu'], F['Sig'], F['s2'])
print('owner coefficients', c.round(2), '+-', np.sqrt(np.diag(S)).round(2))
pool_ok = np.where(known)[0]
for a in range(K):
    u = U[:, a]; sc = T[:, 2 + a]; o = np.argsort(u)
    print(f"\n-- axis {a + 1}: member sd {np.sqrt(F['Sig'][2 + a, 2 + a]):.2f}, owner {c[2 + a]:+.2f}")
    print('   high:', ', '.join(f"{names[j]} {u[j]:+.2f}" for j in o[::-1][:8]))
    print('   low :', ', '.join(f"{names[j]} {u[j]:+.2f}" for j in o[:8]))
    oo = pool_ok[np.argsort(sc[pool_ok])]
    print('   high titles:', '; '.join(D.info[i]['title'] for i in oo[::-1][:10]))
    print('   low titles :', '; '.join(D.info[i]['title'] for i in oo[:10]))
