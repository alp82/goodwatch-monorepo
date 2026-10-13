"""Prints the owner's readable profile and the quality-vs-taste split. Fitted on all development ratings (description, not a score)."""
import numpy as np, warnings
warnings.filterwarnings('ignore')
from lab import data
from harness import cv
from common import scores, regions, cols, chain, AL, SCORES
from sklearn.linear_model import RidgeCV
D = data(); K = D.fp_keys; Z = D.Z; S = scores(D); CR, TA = cols(D)
idx, y = D.of(D.owner); T = lambda i: D.info[i]['title']
# ---- 1. how much each part explains (out-of-fold share of rating variance, 3 seeds)
def r2(blocks):
    v = []
    for s in (0, 1, 2):
        p, yy = cv(D, lambda D, u, tr, ty, te: chain(blocks, tr, ty, te)[0], D.owner, 10, seed=s); v.append(1 - ((p - yy) ** 2).sum() / ((yy - yy.mean()) ** 2).sum())
    return np.mean(v)
print('OUT-OF-FOLD SHARE OF RATING VARIANCE EXPLAINED')
for nm, b in [('craft 8', [Z[:, CR]]), ('taste 66', [Z[:, TA]]), ('craft + taste (all 74)', [Z]), ('public scores', [S]), ('public scores > craft 8', [S, Z[:, CR]]),
              ('public scores > taste 66', [S, Z[:, TA]]), ('public scores > all 74', [S, Z])]:
    print(f'  {nm:28s} {r2(b):.3f}')
# how much of the "taste" model is quality in disguise
mt = RidgeCV(alphas=AL).fit(Z[idx][:, TA], y); mc = RidgeCV(alphas=AL).fit(Z[idx][:, CR], y)
print('  correlation between the taste-only and craft-only predictions over the catalog: %.2f' % np.corrcoef(mt.predict(Z[:, TA]), mc.predict(Z[:, CR]))[0, 1])
print('  correlation of craft mean with goodwatch score over the catalog: %.2f' % np.corrcoef(Z[:, CR].mean(1), S[:, 0])[0, 1])
# ---- 2. quality stage
m1 = RidgeCV(alphas=AL).fit(S[idx], y); q = m1.predict(S); res = y - q[idx]
print('\nQUALITY STAGE: rating = %.2f + weights x public scores (per 1 sd of each score)' % m1.intercept_)
for c, w in zip(SCORES, m1.coef_): print(f'  {c[:-19]:38s} {w:+.2f}')
print('  spread of the quality prediction over rated titles: sd %.2f; of ratings: sd %.2f; of what is left: sd %.2f' % (q[idx].std(), y.std(), res.std()))
# ---- 3. regions
G, km = regions(D, 6); hard = G.argmax(1); rs = np.random.RandomState(0)
print('\nSIX REGIONS OF TITLE SPACE (k-means over the catalog, no ratings used), member offset after quality')
m2 = RidgeCV(alphas=AL).fit((G - G.mean(0))[idx], res)
order = np.argsort(-m2.coef_)
for j in order:
    mem = idx[hard[idx] == j]; rj = res[hard[idx] == j]; yj = y[hard[idx] == j]
    boot = [rj[rs.randint(0, len(rj), len(rj))].mean() for _ in range(2000)]
    c = km.cluster_centers_[j]; hi = [K[TA[i]] for i in np.argsort(-c)[:7]]; lo = [K[TA[i]] for i in np.argsort(c)[:4]]
    core = mem[np.argsort(-G[mem, j])][:max(12, len(mem) // 2)]; yc = dict(zip(idx, y))
    love = sorted(core, key=lambda i: -yc[i])[:5]; hate = sorted(core, key=lambda i: yc[i])[:4]
    print(f'\n region {j}: {len(mem)} rated ({(hard == j).mean() * 100:.0f}% of catalog), mean rating {yj.mean():.2f}, share rated 5 or less {np.mean(yj <= 5) * 100:.0f}%, share 9+ {np.mean(yj >= 9) * 100:.0f}%')
    print(f'   offset after quality {rj.mean():+.2f} (95% {np.percentile(boot, 2.5):+.2f} to {np.percentile(boot, 97.5):+.2f}); model weight {m2.coef_[j]:+.2f}; mean public goodwatch score {np.mean([float(D.info[i]["goodwatch_overall_score_normalized_percent"] or 60) for i in mem]):.0f}')
    print('   high in:', ', '.join(hi)); print('   low in :', ', '.join(lo))
    print('   liked  :', '; '.join(f'{T(i)} ({yc[i]:.0f})' for i in love)); print('   least  :', '; '.join(f'{T(i)} ({yc[i]:.0f})' for i in hate))
# ---- 4. dials: single attributes against the residual, with bootstrap sign stability
print('\nDIALS: attributes that move the rating beyond quality (ridge weight per 1 sd on the residual; share of 500 resamples with the same sign)')
m3 = RidgeCV(alphas=AL).fit(Z[idx], res); B = []
for b in range(500):
    k = rs.randint(0, len(idx), len(idx)); B.append(RidgeCV(alphas=[m3.alpha_]).fit(Z[idx][k], res[k]).coef_)
B = np.array(B); stab = (np.sign(B) == np.sign(m3.coef_)).mean(0)
for i in np.argsort(-np.abs(m3.coef_))[:18]:
    print(f'  {K[i]:26s} {m3.coef_[i]:+.3f}  stable {stab[i] * 100:.0f}%  corr with residual {np.corrcoef(Z[idx][:, i], res)[0, 1]:+.2f}{"  (craft)" if i in CR else ""}')
# ---- 5. curves: is liking monotone? mean residual by raw attribute band for the strongest dials
print('\nCURVES: mean rating-minus-quality by raw attribute score band (n)')
for i in np.argsort(-np.abs(m3.coef_))[:10]:
    v = D.fp[idx][:, i]; out = []
    for a, b in ((0, 2), (2, 4), (4, 6), (6, 8), (8, 10.01)):
        mk = (v >= a) & (v < b); out.append(f'{a}-{int(b)}: {res[mk].mean():+.2f} ({mk.sum()})' if mk.sum() >= 15 else f'{a}-{int(b)}: . ({mk.sum()})')
    print(f'  {K[i]:26s}', ' | '.join(out))
