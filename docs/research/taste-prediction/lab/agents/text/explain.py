import sys, json, pickle, os, numpy as np
import rig
from rig import D, F
sys.path.insert(0, rig.HERE); import best
T = best._setup(D); XP = T['XP']; idx, y = D.of(D.owner)
names = ['flag:keyword sequel', 'flag:numbered/subtitled title', 'flag:in a movie series'] + [f'emb{i}' for i in range(16)] + [f'tag{i}' for i in range(16)] + [f'txt{i}' for i in range(16)]
# 1. paired comparison vs baseline, seeds 0 and 1
for seed in (0, 1):
    b = rig.base_cache(seed)[D.owner]; p = pickle.load(open(f'plus3_cache_{seed}.pkl', 'rb'))[D.owner]
    pb = np.zeros(len(y)); pp = np.zeros(len(y))
    for c in b: pb[c['te']] = c['pte']
    for c in p: pp[c['te']] = c['pte']
    d = np.abs(pb - y) - np.abs(pp - y); rng = np.random.default_rng(0)
    bs = [d[rng.integers(0, len(d), len(d))].mean() for _ in range(4000)]
    band = np.where(y <= 5, 'bad', np.where(y <= 7, 'mid', 'high'))
    print(f'seed {seed}: mean abs-error gain {d.mean():.4f}, bootstrap 95% [{np.quantile(bs, .025):.4f}, {np.quantile(bs, .975):.4f}], P(gain<=0) {np.mean(np.array(bs) <= 0):.3f}; by band ' + ', '.join(f'{k} {d[band == k].mean():+.3f}' for k in ('bad', 'mid', 'high')))
# 2. others per member from ledger
L = [json.loads(l) for l in open(os.path.join(rig.LAB, 'ledger.jsonl'))]
base = [l for l in L if 'others' in l and 'Learned' in l['name']][-1]; mine = [l for l in L if l['name'].startswith('text: trees+text feats blended')][-1]
sb = {r['user']: r for r in base['others']['per_user']}; sm = {r['user']: r for r in mine['others']['per_user']}
dd = np.array([sm[u]['skill'] - sb[u]['skill'] for u in sb]); print(f'others: best beats baseline skill for {(dd > 0).sum()} of {len(dd)} members, median gain {np.median(dd):.3f}, mean {dd.mean():.3f}; rho better for {sum(sm[u]["rho"] > sb[u]["rho"] for u in sb)}')
# 3. effect of each text feature in the owner's full model: prediction at the feature's 90th vs 10th percentile (others as observed)
m = best.HistGradientBoostingRegressor(max_depth=3, max_iter=150, learning_rate=0.05, min_samples_leaf=8, l2_regularization=1.0, random_state=3).fit(XP[idx], y)
X0 = XP[idx]; nb = XP.shape[1] - 51; eff = []
for j in range(51):
    c = nb + j; lo, hi = (0, 1) if j < 3 else np.quantile(X0[:, c], [.1, .9]); A = X0.copy(); B = X0.copy(); A[:, c] = lo; B[:, c] = hi
    eff.append(m.predict(B).mean() - m.predict(A).mean())
eff = np.array(eff)
EW, ev = F['essence_words']; ev = np.array(ev); EWc = EW.tocsc(); cnt = np.asarray(EW.sum(0)).ravel(); okw = cnt >= 40
pop = np.array([x['goodwatch_overall_score_voting_count'] or 0 for x in D.info])
def describe(v, k=10):
    z = (v - v.mean()) / v.std(); mw = np.asarray(EWc.T @ z).ravel() / np.maximum(cnt, 1) * np.sqrt(cnt); mw[~okw] = 0; o = np.argsort(mw)
    known = np.where(pop > 150000)[0]; ot = known[np.argsort(v[known])]
    return ', '.join(ev[o[::-1][:k]]), ', '.join(ev[o[:k]]), '; '.join(D.info[i]['title'] for i in ot[::-1][:5]), '; '.join(D.info[i]['title'] for i in ot[:5])
for j in np.argsort(-np.abs(eff))[:14]:
    print(f'\n{names[j]}: high-vs-low effect {eff[j]:+.2f} points')
    if j >= 3:
        hi, lo, th, tl = describe(XP[:, nb + j]); print('   high side words:', hi); print('   high side titles:', th); print('   low side words:', lo); print('   low side titles:', tl)
