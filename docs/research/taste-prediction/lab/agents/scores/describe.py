"""How the owner uses public scores, in numbers (all development ratings; descriptive, intervals by bootstrap over titles)."""
import os, sys, warnings, numpy as np
warnings.filterwarnings('ignore')
HERE = os.path.dirname(os.path.abspath(__file__)); LAB = os.path.dirname(os.path.dirname(HERE)); sys.path.insert(0, LAB); sys.path.insert(0, HERE)
import harness, sfeats
D = harness.Data(); r = sfeats.raw(D); B = sfeats.blocks(D); idx, y = D.of(D.owner); rs = np.random.RandomState(0)
T = lambda i: f"{D.info[i]['title']} ({D.info[i]['release_year']})"
def ols(A, t): return np.linalg.lstsq(np.c_[np.ones(len(t)), A], t, rcond=None)[0][1:]
def boot(A, t, n=1000):
    c = ols(A, t); bs = np.array([ols(A[k], t[k]) for k in (rs.randint(0, len(t), len(t)) for _ in range(n))]); return c, np.percentile(bs, 2.5, 0), np.percentile(bs, 97.5, 0)

print('== 1. rating points per +10 points of each source, all six together (owner; titles having all six)')
S = np.c_[[r['S'][s] for s in sfeats.SRC]].T; ok = ~np.isnan(S[idx]).any(1); print('titles with all six:', ok.sum(), 'of', len(idx))
c, lo, hi = boot(S[idx][ok] / 10, y[ok])
for s, a, b_, d in zip(sfeats.SRC, c, lo, hi): print(f'  {s:5s} {a:+.2f}  [{b_:+.2f}, {d:+.2f}]')
print('   same regression, all other members pooled (ratings centred per member):')
ou, oi, oy = D.others(D.owner); uu, inv = np.unique(ou, return_inverse=True); oc = oy - (np.bincount(inv, oy) / np.bincount(inv))[inv]; ok2 = ~np.isnan(S[oi]).any(1)
for s, a in zip(sfeats.SRC, ols(S[oi][ok2] / 10, oc[ok2])): print(f'  {s:5s} {a:+.2f}')

print('== 2. audience composite and critic composite (per 1 sd of each), titles with critics')
hc = r['has_crit'][idx]; A = np.c_[r['aud'][idx], np.nan_to_num(r['crit'][idx])][hc]; c, lo, hi = boot(A, y[hc])
print(f'  owner: audience {c[0]:+.2f} [{lo[0]:+.2f}, {hi[0]:+.2f}]   critics {c[1]:+.2f} [{lo[1]:+.2f}, {hi[1]:+.2f}]  (n={hc.sum()})')
rows = []
for v, u in enumerate(uu):
    m = (inv == v) & r['has_crit'][oi]
    if m.sum() >= 60: cc = ols(np.c_[r['aud'][oi[m]], np.nan_to_num(r['crit'][oi[m]])], oy[m]); rows.append((cc[0], cc[1], m.sum()))
rows = np.array(rows); print(f'  other members with 60+ such ratings ({len(rows)}): audience median {np.median(rows[:, 0]):+.2f} (range {rows[:, 0].min():+.2f} to {rows[:, 0].max():+.2f}), critics median {np.median(rows[:, 1]):+.2f} (range {rows[:, 1].min():+.2f} to {rows[:, 1].max():+.2f})')
print(f'  members whose critic weight exceeds their audience weight: {(rows[:, 1] > rows[:, 0]).sum()} of {len(rows)}; owner audience share {c[0] / (c[0] + c[1]):.2f}, others median {np.median(rows[:, 0] / (rows[:, 0] + rows[:, 1])):.2f}')

print('== 3. curved response: owner mean rating by IMDb score')
im = r['S']['imdb'][idx]
for a, b_ in ((0, 60), (60, 65), (65, 70), (70, 75), (75, 80), (80, 85), (85, 101)):
    m = (im >= a) & (im < b_); print(f'  IMDb {a/10:.1f}-{b_/10:.1f}: n={m.sum():3d} mean {y[m].mean():.2f}  share rated 5 or less {np.mean(y[m] <= 5):.2f}  share 8+ {np.mean(y[m] >= 8):.2f}')

print('== 4. audience over critics gap: rating left over after the audience composite, by gap third, per kind')
res = y - np.c_[np.ones(len(y)), r['aud'][idx]] @ np.linalg.lstsq(np.c_[np.ones(len(y)), r['aud'][idx]], y, rcond=None)[0]
gap = B['gap'][0][idx, 0]; kind = r['kind'][idx]; q = np.quantile(gap[hc], [1 / 3, 2 / 3])
def line(m, lab):
    m = m & hc; lo_, hi_ = m & (gap <= q[0]), m & (gap >= q[1]); c = np.polyfit(gap[m], res[m], 1)[0]
    bs = [np.polyfit(gap[m][k], res[m][k], 1)[0] for k in (rs.randint(0, m.sum(), m.sum()) for _ in range(500))]
    print(f'  {lab:24s} n={m.sum():3d}  critics like it more: {res[lo_].mean():+.2f} (n={lo_.sum()})  audiences like it more: {res[hi_].mean():+.2f} (n={hi_.sum()})  slope per sd of gap {c:+.2f} [{np.percentile(bs, 2.5):+.2f}, {np.percentile(bs, 97.5):+.2f}]')
line(np.ones(len(y), bool), 'all titles')
for k in range(6): line(kind == k, sfeats.KINDS[k])
line(r['show'][idx], 'shows'); line(~r['show'][idx], 'movies')
for g in ('Comedy', 'Action', 'Animation', 'Horror', 'Drama', 'Science Fiction'): line(np.array([g in (D.info[i]['genres'] or []) for i in idx]), 'genre ' + g)

print('== 5. reliability: rating left over after the audience composite, by IMDb vote count')
cn = r['C']['imdb'][idx]
for a, b_ in ((0, 1e4), (1e4, 5e4), (5e4, 2e5), (2e5, 5e5), (5e5, 1e9)):
    m = (cn >= a) & (cn < b_); print(f'  {int(a):>7d}-{int(b_):<10d} n={m.sum():3d} left over {res[m].mean():+.2f}  rating {y[m].mean():.2f}  share bad {np.mean(y[m] <= 5):.2f}')
print('   missing sources: ', {n: (int(B["miss"][0][idx, j].sum()), round(float(res[B["miss"][0][idx, j] > 0].mean()), 2)) for j, n in enumerate(B['miss'][1])})
sp = B['gap'][0][idx, 1]; qs = np.quantile(sp, [.25, .75]); print(f'   source spread: calm quarter share bad {np.mean(y[sp <= qs[0]] <= 5):.2f}, most disputed quarter {np.mean(y[sp >= qs[1]] <= 5):.2f}')

print('== 6. shows: season features against the rating left over (owner shows with 2+ scored seasons)')
F = B['seas'][0][idx]; m = F[:, 0] > 0; print('  shows:', int(r['show'][idx].sum()), 'with 2+ scored seasons:', int(m.sum()))
for j, n in enumerate(B['seas'][1][1:], 1):
    from scipy.stats import spearmanr
    c, p = spearmanr(F[m, j], res[m]); print(f'  {n:22s} rank correlation {c:+.2f} (p={p:.2f})')

print('== 7. examples')
g = gap.copy(); g[~hc] = 0
o = np.argsort(-g)[:60]; pick = [i for i in o if y[i] >= 8][:6]; print('  audiences far above critics, owner rated high:', '; '.join(f"{T(idx[i])} owner {y[i]:.0f}, IMDb {r['S']['imdb'][idx[i]]/10:.1f}, RT critics {r['S']['rt'][idx[i]]:.0f}" for i in pick))
pick = [i for i in o if y[i] <= 5][:5]; print('  audiences far above critics, owner rated low:', '; '.join(f"{T(idx[i])} owner {y[i]:.0f}, IMDb {r['S']['imdb'][idx[i]]/10:.1f}, RT critics {r['S']['rt'][idx[i]]:.0f}" for i in pick))
o = np.argsort(g)[:60]; pick = [i for i in o if y[i] <= 6][:6]; print('  critics far above audiences, owner rated low:', '; '.join(f"{T(idx[i])} owner {y[i]:.0f}, IMDb {r['S']['imdb'][idx[i]]/10:.1f}, RT critics {r['S']['rt'][idx[i]]:.0f}" for i in pick))
pick = [i for i in o if y[i] >= 8][:5]; print('  critics far above audiences, owner rated high:', '; '.join(f"{T(idx[i])} owner {y[i]:.0f}, IMDb {r['S']['imdb'][idx[i]]/10:.1f}, RT critics {r['S']['rt'][idx[i]]:.0f}" for i in pick))
print(f'  top 60 audience-over-critic titles: owner mean {y[np.argsort(-g)[:60]].mean():.2f}; top 60 critic-over-audience: {y[np.argsort(g)[:60]].mean():.2f}; left over {res[np.argsort(-g)[:60]].mean():+.2f} vs {res[np.argsort(g)[:60]].mean():+.2f}')
