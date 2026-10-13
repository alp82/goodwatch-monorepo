"""Five ways to define a taste over the fingerprint, for one member. Local only."""
import json, pickle
import numpy as np
from sklearn.cluster import KMeans
from sklearn.ensemble import HistGradientBoostingRegressor

cat = np.load('catalog.npz'); IDS = cat['ids']; RAW = cat['raw'].astype(np.float32)
m = pickle.load(open('meta.pkl', 'rb')); ORDER = m['order']; META = m['meta']
user = pickle.load(open('user.pkl', 'rb'))
INDEX = {int(i): k for k, i in enumerate(IDS)}
pid = lambda mt, t: (1_000_000_000_000 if mt == 'movie' else 2_000_000_000_000) + int(t)
VOTES = np.array([x[7] for x in META]); SCORE = np.array([x[8] for x in META])
CRAFT = {'direction', 'acting', 'cinematography', 'editing', 'music_composition', 'dialogue_quality', 'narrative_structure', 'rewatchability'}
KEEP = np.array([k not in CRAFT for k in ORDER]); KEYS = [k for k in ORDER if k not in CRAFT]

unit = lambda X: X / np.maximum(np.linalg.norm(X, axis=-1, keepdims=True), 1e-9)
NORM = unit(RAW)
POOL = np.where(VOTES >= 1000)[0]                      # the reference pool
Z = (RAW[:, KEEP] - RAW[POOL][:, KEEP].mean(0)) / RAW[POOL][:, KEEP].std(0)   # standardized, craft left out
ZU = unit(Z)

rated = [(INDEX[pid(r['media_type'], r['tmdb_id'])], r['score']) for r in user['ratings'] if pid(r['media_type'], r['tmdb_id']) in INDEX]
RI = np.array([i for i, _ in rated]); RS = np.array([s for _, s in rated], dtype=float)
seen = set(RI.tolist())
for k in ('wishlist', 'skipped', 'not_interested', 'watch_state'):
    for r in user[k]:
        i = INDEX.get(pid(r['media_type'], r['tmdb_id']))
        if i is not None: seen.add(i)
WISH = np.array([INDEX[pid(r['media_type'], r['tmdb_id'])] for r in user['wishlist'] if pid(r['media_type'], r['tmdb_id']) in INDEX and INDEX[pid(r['media_type'], r['tmdb_id'])] not in set(RI.tolist())])
MU, SD = RS.mean(), RS.std()
LOVED_FROM = max(8, round(MU + 0.6 * SD))
CAND = np.array([i for i in np.where((VOTES >= 10000) & (SCORE >= 65))[0] if i not in seen])
print('rated', len(RI), 'mean', round(MU, 2), 'sd', round(SD, 2), 'loved from', LOVED_FROM, 'candidates', len(CAND))

# ---- the five definitions: fit(train idx, scores) -> score(idx) -> array -------------------------------------
def fit_A(ri, rs):  # today: raw unit fingerprints, all 74 keys, one vector 2P - N
    lk, dl = rs >= 6, rs < 6
    P = np.average(NORM[ri[lk]], axis=0, weights=rs[lk] - 5)
    t = 2 * P - np.average(NORM[ri[dl]], axis=0, weights=6 - rs[dl]) if dl.any() else P
    t = unit(t)
    return (lambda idx: NORM[idx] @ t), {'vector': t}

def fit_B(ri, rs):  # standardized space, craft left out, one vector around the member's usual rating
    w = rs - rs.mean()
    t = unit((w[:, None] * ZU[ri]).sum(0))
    return (lambda idx: ZU[idx] @ t), {'vector': t}

def sides_of(ri, rs, k=5):
    loved = ri[rs >= max(8, round(rs.mean() + 0.6 * rs.std()))]
    km = KMeans(n_clusters=k, n_init=10, random_state=3).fit(ZU[loved])
    return loved, km.labels_, unit(km.cluster_centers_)

def fit_C(ri, rs, k=5):  # sides: the best-fitting of k cluster centers of the loved titles, minus the dislike pull
    loved, labels, centers = sides_of(ri, rs, k)
    def score(idx):
        return (ZU[idx] @ centers.T).max(1)
    return score, {'loved': loved, 'labels': labels, 'centers': centers}

def fit_D(ri, rs, k=8):  # neighbors: how the member rated the rated titles most like this one
    w = rs - rs.mean()
    def score(idx, why=False):
        S = ZU[idx] @ ZU[ri].T
        S[S > 0.9999] = -1                              # never the title itself
        top = np.argsort(-S, axis=1)[:, :k]
        sims = np.take_along_axis(S, top, 1); sims = np.maximum(sims, 0) ** 2
        out = (sims * w[top]).sum(1) / (sims.sum(1) + 0.15)
        return (out, top) if why else out
    return score, {}

def fit_E(ri, rs):  # learned: boosted trees predict the member's rating from attribute combinations
    g = HistGradientBoostingRegressor(max_depth=3, max_iter=150, learning_rate=0.05, min_samples_leaf=8, l2_regularization=1.0, random_state=3).fit(Z[ri], rs)
    return (lambda idx: g.predict(Z[idx])), {'model': g}

FITS = {'A': fit_A, 'B': fit_B, 'C': fit_C, 'D': fit_D, 'E': fit_E}

# ---- holdout: five folds, repeated over three splits ----------------------------------------------------------
def auc(pos, neg):
    pos, neg = np.array(pos), np.array(neg)
    return float((pos[:, None] > neg[None, :]).mean() + 0.5 * (pos[:, None] == neg[None, :]).mean())
AUC = {}
for name, fit in FITS.items():
    a_like, a_love = [], []
    for seed in range(3):
        fold = np.random.default_rng(seed).integers(0, 5, len(RI)); pred = np.zeros(len(RI))
        for f in range(5):
            score, _ = fit(RI[fold != f], RS[fold != f]); pred[fold == f] = score(RI[fold == f])
        a_like.append(auc(pred[RS >= 6], pred[RS < 6])); a_love.append(auc(pred[RS >= LOVED_FROM], pred[RS < LOVED_FROM]))
    AUC[name] = (round(np.mean(a_like), 3), round(np.mean(a_love), 3), round(float(np.corrcoef(pred, RS)[0, 1]), 3))
    print(name, 'AUC liked vs disliked', AUC[name][0], ' loved vs rest', AUC[name][1], ' r', AUC[name][2], flush=True)

# ---- full fits and what each one shows ------------------------------------------------------------------------
T = lambda i: {'t': META[i][2], 'y': META[i][3], 'k': META[i][0], 'g': META[i][4][:2], 's': int(META[i][8]), 'id': META[i][1], 'p': META[i][9]}
out = {'member': {'rated': len(RI), 'mean': round(MU, 2), 'loved_from': int(LOVED_FROM), 'loved': int((RS >= LOVED_FROM).sum()), 'candidates': len(CAND)}, 'auc': AUC, 'v': {}}
pool_mean_z = 0
def attrs(vec, n=6, keys=KEYS):
    o = np.argsort(-vec); return [keys[i] for i in o[:n]], [keys[i] for i in o[::-1][:4]]
def picks(score, n=24, low=8):
    s = score(CAND); o = np.argsort(-s)
    return o, s
rank_of = {}
for name, fit in FITS.items():
    score, info = fit(RI, RS)
    o, s = picks(score); rank_of[name] = {int(CAND[i]): r for r, i in enumerate(o)}
    v = {'top': [T(CAND[i]) for i in o[:24]], 'low': [T(CAND[i]) for i in o[::-1][:8]], 'topidx': [int(CAND[i]) for i in o[:50]]}
    if name == 'A':
        lean = (info['vector'] - NORM[POOL].mean(0)) / NORM[POOL].std(0)
        v['loves'], v['avoids'] = attrs(np.where(KEEP, lean, 0), keys=ORDER)
    if name == 'B':
        v['loves'], v['avoids'] = attrs(info['vector'])
    if name == 'C':
        loved, labels, centers = info['loved'], info['labels'], info['centers']
        lm = ZU[loved].mean(0); sc = ZU[CAND] @ centers.T; best = sc.argmax(1); sides = []
        for c in np.argsort(-np.bincount(labels)):
            mem = loved[labels == c]; mo = np.argsort(-(ZU[mem] @ centers[c]))
            co = [i for i in np.argsort(-sc[:, c]) if best[i] == c][:10]
            sides.append({'share': round(100 * len(mem) / len(loved)), 'n': len(mem), 'attrs': attrs(centers[c] - 0.5 * lm, 4)[0],
                          'yours': [T(mem[i]) for i in mo[:8]], 'picks': [T(CAND[i]) for i in co]})
        v['sides'] = sides
    if name == 'D':
        sc, top = score(CAND[o[:24]], why=True)
        for row, t in zip(v['top'], top):
            row['why'] = [f"{META[RI[j]][2]} ({int(RS[j])})" for j in t[:3]]
    if name == 'E':
        from sklearn.inspection import permutation_importance
        imp = permutation_importance(info['model'], Z[RI], RS, n_repeats=5, random_state=3).importances_mean
        corr = np.array([np.corrcoef(Z[RI][:, j], RS)[0, 1] for j in range(Z.shape[1])])
        top = np.argsort(-imp)[:10]
        v['drivers'] = [{'k': KEYS[j], 'dir': 'up' if corr[j] > 0 else 'down'} for j in top]
    out['v'][name] = v
names = list(FITS)
out['overlap'] = {a: {b: len(set(out['v'][a]['topidx']) & set(out['v'][b]['topidx'])) for b in names} for a in names}
json.dump(out, open('out.json', 'w'))
for name in names:
    v = out['v'][name]; print('\n==', name, v.get('loves'), v.get('avoids'), v.get('drivers'))
    print('  TOP:', '; '.join(f"{x['t']} ({x['y']})" for x in v['top'][:24]))
    print('  LOW:', '; '.join(f"{x['t']} ({x['y']})" for x in v['low']))
    for sd in v.get('sides', []):
        print('  SIDE', sd['share'], sd['attrs'], '| yours:', ', '.join(x['t'] for x in sd['yours'][:6]), '| picks:', ', '.join(x['t'] for x in sd['picks'][:8]))
print(out['overlap'])
