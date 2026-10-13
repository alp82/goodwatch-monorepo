"""Five ways to split one member's rated titles into named groups. Local only."""
import json, pickle, re
import numpy as np
from collections import Counter
from sklearn.cluster import AgglomerativeClustering, HDBSCAN
from sklearn.decomposition import NMF
from sklearn.metrics import silhouette_score
from sklearn.tree import DecisionTreeRegressor

cat = np.load('catalog.npz'); IDS = cat['ids']; RAW = cat['raw'].astype(np.float32)
m = pickle.load(open('meta.pkl', 'rb')); ORDER = m['order']; META = m['meta']
user = pickle.load(open('user.pkl', 'rb'))
INDEX = {int(i): k for k, i in enumerate(IDS)}
pid = lambda mt, t: (1_000_000_000_000 if mt == 'movie' else 2_000_000_000_000) + int(t)
VOTES = np.array([x[7] for x in META])
CRAFT = {'direction', 'acting', 'cinematography', 'editing', 'music_composition', 'dialogue_quality', 'narrative_structure', 'rewatchability'}
KEEP = np.array([k not in CRAFT for k in ORDER]); KEYS = [k for k in ORDER if k not in CRAFT]
W = {k: (a, n) for k, a, n in re.findall(r'(\w+):\s*\[\s*"([^"]+)",\s*"([^"]+)",\s*"[^"]+"', open('/home/alper/projects/goodwatch-monorepo/goodwatch-webapp/app/server/taste-portrait/words.server.ts').read())}
unit = lambda X: X / np.maximum(np.linalg.norm(X, axis=-1, keepdims=True), 1e-9)
POOL = np.where(VOTES >= 1000)[0]
PM, PS = RAW[POOL][:, KEEP].mean(0), RAW[POOL][:, KEEP].std(0)
Z = (RAW[:, KEEP] - PM) / PS; ZU = unit(Z)
rated = [(INDEX[pid(r['media_type'], r['tmdb_id'])], r['score']) for r in user['ratings'] if pid(r['media_type'], r['tmdb_id']) in INDEX]
RI = np.array([i for i, _ in rated]); RS = np.array([s for _, s in rated], dtype=float)
LV = RI[RS >= 8]; LS = RS[RS >= 8]; X = ZU[LV]; LM = Z[LV].mean(0)
print('loved', len(LV))

T = lambda i, s: {'t': META[i][2], 'y': META[i][3], 'k': META[i][0], 'r': int(s), 'p': META[i][9]}
used = set()
def group(idx, scores, base=LM, name=None, extra=None):
    """One group as shown: named by what sets its center apart, as Sides of you does."""
    idx, scores = np.asarray(idx), np.asarray(scores)
    c = Z[idx].mean(0); d = np.argsort(-(c - 0.5 * base)); keys = [KEYS[j] for j in d[:5]]
    if name is None:
        name = f"{W[keys[1]][0].capitalize()} {W[keys[0]][1]}"
        if name in used: name = f"{W[keys[2]][0].capitalize()} {W[keys[0]][1]}"
        used.add(name)
    S = ZU[idx] @ ZU[idx].T; n = len(idx)
    tight = float((S.sum() - n) / (n * (n - 1))) if n > 1 else 1.0
    order = sorted(range(n), key=lambda j: (-scores[j], -float(ZU[idx[j]] @ unit(c))))
    genres = [g for g, _ in Counter(g for i in idx for g in META[i][4]).most_common(3)]
    return {'name': name, 'n': n, 'avg': round(float(scores.mean()), 1), 'tight': round(tight, 2), 'attrs': keys[:4], 'genres': genres,
            'titles': [T(idx[j], scores[j]) for j in order], **(extra or {})}
def by_labels(labels, idx=LV, scores=LS):
    used.clear(); out = [group(idx[labels == c], scores[labels == c]) for c in sorted(set(labels)) if c >= 0]
    return sorted(out, key=lambda g: -g['n'])

R = {}
# A: Sides of you as built today: k-means by cosine, 4 groups, seeded farthest-first from the title closest to the taste.
def kmeans_prod(P, k, seed):
    cos = lambda A, c: unit(A) @ unit(c)
    centers = [P[np.argmax(cos(P, seed))]]
    while len(centers) < k:
        centers.append(P[np.argmin(np.max([cos(P, c) for c in centers], axis=0))])
    for _ in range(20):
        lab = np.argmax([cos(P, c) for c in centers], axis=0)
        centers = [P[lab == i].mean(0) if (lab == i).any() else centers[i] for i in range(k)]
    return lab
sig = ((RS - RS.mean())[:, None] * ZU[RI]).sum(0)
R['A'] = {'groups': by_labels(kmeans_prod(Z[LV], 4, sig))}
# B: many small groups: bottom-up merging, with the number of groups picked by how cleanly they separate.
best = max(range(6, 15), key=lambda k: silhouette_score(X, AgglomerativeClustering(n_clusters=k, linkage='ward').fit_predict(X), metric='cosine'))
R['B'] = {'groups': by_labels(AgglomerativeClustering(n_clusters=best, linkage='ward').fit_predict(X)), 'note': f'{best} groups separated best, out of 6 to 14 tried.'}
# C: anchor titles: every group forms around one of your own titles that best stands for its neighbors.
from sklearn.cluster import AffinityPropagation
S = X @ X.T
ap = AffinityPropagation(affinity='precomputed', preference=float(np.quantile(S, 0.02)), damping=0.9, random_state=3, max_iter=1000).fit(S)
used.clear(); gs = []
for c, ex in enumerate(ap.cluster_centers_indices_):
    g = group(LV[ap.labels_ == c], LS[ap.labels_ == c]); g['anchor'] = T(LV[ex], LS[ex]); gs.append(g)
R['C'] = {'groups': sorted(gs, key=lambda g: -g['n'])}
dense = HDBSCAN(min_cluster_size=6, min_samples=3, metric='cosine', copy=True).fit_predict(X.astype(np.float64))
print('density check: groups', dense.max() + 1, 'largest', int(np.bincount(dense[dense >= 0]).max()), 'ungrouped', int((dense < 0).sum()))
# D: trait blends: each group is a recurring combination of attributes; a title can sit in more than one.
V = RAW[LV][:, KEEP] / PM                                   # how far above the catalog's usual level
nmf = NMF(n_components=7, init='nndsvda', max_iter=2000, random_state=3).fit(V); Wt = nmf.transform(V)
Wn = Wt / Wt.max(0); used.clear(); gs = []
for c in range(7):
    mem = np.where(Wn[:, c] >= np.maximum(0.45, 0.8 * Wn.max(1)))[0]
    if len(mem) >= 3: gs.append(group(LV[mem], LS[mem]))
multi = int(((Wn >= np.maximum(0.45, 0.8 * Wn.max(1, keepdims=True))).sum(1) > 1).sum()); none = int(((Wn >= np.maximum(0.45, 0.8 * Wn.max(1, keepdims=True))).sum(1) == 0).sum())
R['D'] = {'groups': sorted(gs, key=lambda g: -g['n']), 'note': f'{multi} loved titles sit in more than one group, {none} in none.'}
# E: rating rules: split everything you rated (not only the loved) by the attribute scores that best separate your ratings.
tree = DecisionTreeRegressor(max_leaf_nodes=9, min_samples_leaf=35, random_state=3).fit(RAW[RI][:, KEEP], RS)
leaf = tree.apply(RAW[RI][:, KEEP]); t = tree.tree_; rules = {}
def walk(n, path):
    if t.children_left[n] == -1: rules[n] = path; return
    k, th = KEYS[t.feature[n]].replace('_', ' '), int(np.ceil(t.threshold[n]))
    walk(t.children_left[n], path + [(k, 0, th - 1)]); walk(t.children_right[n], path + [(k, th, 10)])
walk(0, [])
def tidy(path):
    b = {}
    for k, lo, hi in path: b[k] = (max(lo, b.get(k, (0, 10))[0]), min(hi, b.get(k, (0, 10))[1]))
    return [f'{k} {lo} or more' if hi == 10 else f'{k} {hi} or less' if lo == 0 else f'{k} {lo} to {hi}' if lo != hi else f'{k} {lo}' for k, (lo, hi) in b.items()]
rules = {l: tidy(p) for l, p in rules.items()}
used.clear(); RM = Z[RI].mean(0)
R['E'] = {'groups': sorted([group(RI[leaf == l], RS[leaf == l], base=RM, extra={'rule': rules[l]}) for l in rules], key=lambda g: -g['avg']), 'usual': round(float(RS.mean()), 1)}
for k, v in R.items():
    print('\n==', k, v.get('note', ''), 'left', len(v.get('left', [])))
    for g in v['groups']:
        print(f"  {g.get('anchor',{}).get('t','')} :: {g['name']} | n={g['n']} avg={g['avg']} tight={g['tight']} | {g['attrs']} | {g['genres']} | {g.get('rule','')}\n      " + ', '.join(x['t'] for x in g['titles'][:9]))
json.dump({'loved': len(LV), 'rated': len(RI), 'v': R}, open('groups.json', 'w'))
