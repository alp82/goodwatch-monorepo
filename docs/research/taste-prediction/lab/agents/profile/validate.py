"""Hold-out replication of every statement type. Repeated splits: the profile is written from one part of a member's ratings,
then every statement in it is re-measured on the part it did not see.
usage: validate.py <repeats> <tag> [json cfg] [train fraction]"""
import sys, json, pickle, warnings, numpy as np
warnings.filterwarnings('ignore')
from scipy.stats import norm
import feats, lib
from harness import Data
def run(D, cfg, R, frac=0.5, seed=0, sizes=None):
    rs = np.random.RandomState(seed); rows = []; prof = []
    for u in [D.owner] + D.users():
        idx, y = D.of(u)
        for rep in range(R):
            for N in (sizes or [None]):
                if N is not None and len(y) < N + 30: continue
                p = rs.permutation(len(y)); k = N or int(len(y) * frac); a, h = p[:k], p[k:]
                P = lib.fit(D, idx[a], y[a], cfg); ho = lib.holdout(P, idx[h], y[h]); ph = P.predict(idx[h])
                for t in ho: rows.append((u[:8], u == D.owner, N or 0, rep) + t)
                e = dict(u=u[:8], owner=u == D.owner, N=N or 0, ntr=k, mae=np.mean(np.abs(ph - y[h])), mae_const=np.mean(np.abs(y[a].mean() - y[h])), mse=np.mean((ph - y[h]) ** 2), mse_const=np.mean((y[a].mean() - y[h]) ** 2),
                         count={t: sum(1 for s in P.S if (s.type == t and getattr(s, 'shown', True))) for t in ('quality', 'kinds', 'facts', 'genres', 'dials', 'themes')})
                e['count']['sequel'] = sum(1 for s in P.S if s.key == 'a sequel'); e['count']['facts'] -= e['count']['sequel']
                e['count']['audiences over critics'] = sum(1 for s in P.S if s.key == 'audiences over critics'); e['count']['quality'] -= e['count']['audiences over critics']
                if P.trust: e['trust'] = (P.trust, P.bands(idx[h], y[h]))
                prof.append(e)
    return rows, prof
TYPES = ['quality', 'audiences over critics', 'kinds', 'sequel', 'facts', 'genres', 'dials', 'themes']
def table(rows, prof, N=0, out=print):
    out('| statement type | who | profiles showing it | shown per profile | same sign on held-out | expected if claims were exact | held-out size / claimed | within interval |'); out('|---|---|---|---|---|---|---|---|')
    for t in TYPES:
        for who in (True, False):
            a = np.array([r[6:] for r in rows if r[4] == t and r[1] == who and r[2] == N], float); pp = [e for e in prof if e['owner'] == who and e['N'] == N]
            if not pp: continue
            has = np.mean([e['count'][t] > 0 for e in pp]); per = np.mean([e['count'][t] for e in pp])
            if len(a) < 3: out(f"| {t} | {'owner' if who else 'others'} | {has:.0%} | {per:.2f} | - | - | - | - |"); continue
            c, sd, h, se = a[:, 0], a[:, 1], a[:, 2], a[:, 3]; tot = np.sqrt(se ** 2 + sd ** 2)
            out(f"| {t} | {'owner' if who else 'others'} | {has:.0%} | {per:.2f} | {np.mean(np.sign(c) == np.sign(h)):.0%} (n={len(a)}) | {np.mean(norm.cdf(np.abs(c) / tot)):.0%} | {(c * h).sum() / (c ** 2).sum():.2f} | {np.mean(np.abs(h - c) <= 1.645 * tot):.0%} |")
def trust(prof, N=0, out=print):
    for who in (True, False):
        pp = [e for e in prof if e['owner'] == who and e['N'] == N and 'trust' in e]
        if not pp: continue
        A = np.array([[[b[k] for k in ('mean', 'low', 'err')] for b in e['trust'][0]] for e in pp]); H = np.array([[[b[k] for k in ('mean', 'low', 'err')] for b in e['trust'][1]] for e in pp])
        ok = ~np.isnan(H).any((1, 2)); A, H = A[ok], H[ok]
        out(f"{'owner' if who else 'others'}: held-out mean rating top/mid/bottom third of predictions {H[:, 0, 0].mean():.2f}/{H[:, 1, 0].mean():.2f}/{H[:, 2, 0].mean():.2f} (claimed {np.nanmean(A[:, 0, 0]):.2f}/{np.nanmean(A[:, 1, 0]):.2f}/{np.nanmean(A[:, 2, 0]):.2f}); "
            f"share rated low {H[:, 0, 1].mean():.1%}/{H[:, 1, 1].mean():.1%}/{H[:, 2, 1].mean():.1%} (claimed {np.nanmean(A[:, 0, 1]):.1%}/{np.nanmean(A[:, 1, 1]):.1%}/{np.nanmean(A[:, 2, 1]):.1%}); "
            f"abs error {H[:, 0, 2].mean():.2f}/{H[:, 1, 2].mean():.2f}/{H[:, 2, 2].mean():.2f}; top third rated above bottom third on held-out in {np.mean(H[:, 0, 0] > H[:, 2, 0]):.0%} of profiles; fewer low in top than bottom in {np.mean(H[:, 0, 1] < H[:, 2, 1]):.0%} (ties {np.mean(H[:, 0, 1] == H[:, 2, 1]):.0%}); smaller error in top than bottom in {np.mean(H[:, 0, 2] < H[:, 2, 2]):.0%}")
def skill(prof, N=0):
    o = [e for e in prof if e['owner'] and e['N'] == N]; us = sorted({e['u'] for e in prof if not e['owner'] and e['N'] == N})
    sk = [1 - np.mean([e['mae'] for e in prof if e['u'] == u and e['N'] == N]) / np.mean([e['mae_const'] for e in prof if e['u'] == u and e['N'] == N]) for u in us]
    return (np.mean([e['mae'] for e in o]) if o else np.nan), (1 - np.mean([e['mae'] for e in o]) / np.mean([e['mae_const'] for e in o]) if o else np.nan), np.mean(sk), len(us)
if __name__ == '__main__':
    D = Data(); R = int(sys.argv[1]); tag = sys.argv[2]; cfg = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}; frac = float(sys.argv[4]) if len(sys.argv) > 4 else 0.5
    rows, prof = run(D, cfg, R, frac); pickle.dump((rows, prof), open(f'val_{tag}.pkl', 'wb'))
    print(tag, cfg, 'train fraction', frac); table(rows, prof); trust(prof); print('held-out: owner mae %.3f skill %.3f | others skill %.3f (%d)' % skill(prof))
