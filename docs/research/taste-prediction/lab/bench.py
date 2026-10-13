"""Benchmark: predict one member's actual rating of a title from everything else they rated. Local, plus one read of source scores."""
import json, pickle, warnings
import numpy as np
from scipy.stats import spearmanr
from sklearn.cluster import AgglomerativeClustering, KMeans
from sklearn.decomposition import NMF
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge, RidgeCV
from sklearn.model_selection import StratifiedKFold
from sklearn.tree import DecisionTreeRegressor
from gw import sql
warnings.filterwarnings('ignore')

cat = np.load('catalog.npz'); IDS = cat['ids']; RAW = cat['raw'].astype(np.float32)
m = pickle.load(open('meta.pkl', 'rb')); ORDER = m['order']; META = m['meta']
user = pickle.load(open('user.pkl', 'rb'))
INDEX = {int(i): k for k, i in enumerate(IDS)}
pid = lambda mt, t: (1_000_000_000_000 if mt == 'movie' else 2_000_000_000_000) + int(t)
VOTES = np.array([x[7] for x in META])
CRAFT = {'direction', 'acting', 'cinematography', 'editing', 'music_composition', 'dialogue_quality', 'narrative_structure', 'rewatchability'}
KEEP = np.array([k not in CRAFT for k in ORDER])
unit = lambda X: X / np.maximum(np.linalg.norm(X, axis=-1, keepdims=True), 1e-9)
POOL = np.where(VOTES >= 1000)[0]
rated = [(INDEX[pid(r['media_type'], r['tmdb_id'])], r['score']) for r in user['ratings'] if pid(r['media_type'], r['tmdb_id']) in INDEX]
RI = np.array([i for i, _ in rated]); y = np.array([s for _, s in rated], dtype=float); n = len(y)
Zall = ((RAW - RAW[POOL].mean(0)) / RAW[POOL].std(0))[RI]      # all 74, standardized against the well-known catalog
Z = Zall[:, KEEP]; ZU = unit(Z); NORM = unit(RAW[RI])           # craft left out; raw unit (today's space)
CR = Zall[:, ~KEEP]

# facts about each title: everyone's score, source scores, year, type, language, genres
facts = {}
for table, mt in (('movie', 'movie'), ('show', 'show')):
    ids = [META[i][1] for i in RI if META[i][0] == mt]
    for r in sql(f"""select tmdb_id, imdb_user_score_normalized_percent i, metacritic_meta_score_normalized_percent mc,
        rotten_tomatoes_tomato_score_normalized_percent rt, rotten_tomatoes_audience_score_normalized_percent ra,
        tmdb_user_score_normalized_percent t, popularity p from {table} where tmdb_id = any(?) limit 5000""", [ids]):
        facts[(mt, r['tmdb_id'])] = r
GW = np.array([META[i][8] for i in RI], dtype=float)
nan = lambda v: np.nan if v is None else float(v)
SRC = np.array([[nan(facts.get((META[i][0], META[i][1]), {}).get(k)) for k in ('i', 'mc', 'rt', 'ra', 't')] for i in RI])
genres = sorted({g for i in RI for g in META[i][4]})
G = np.array([[g in META[i][4] for g in genres] for i in RI], dtype=float)
MISC = np.array([[nan(META[i][3]), META[i][0] == 'show', META[i][5] == 'en', META[i][5] == 'ja', np.log10(max(VOTES[i], 1))] for i in RI], dtype=float)
FACTS = np.hstack([GW[:, None], SRC, G, MISC])
print('titles', n, 'usual', round(y.mean(), 2), 'bands', {b: int(((y >= lo) & (y <= hi)).sum()) for b, (lo, hi) in {'1-5': (1, 5), '6-7': (6, 7), '8-10': (8, 10)}.items()})

# ---- helpers ---------------------------------------------------------------------------------------------------
def calibrated(scorer):
    """Turn a match score into a rating: a line fitted on match scores the training titles got without their own rating."""
    def predict(tr, te):
        oof = np.zeros(len(tr))
        for a, b in StratifiedKFold(5, shuffle=True, random_state=1).split(tr, y[tr]):
            oof[b] = scorer(tr[a], tr[b])
        s = scorer(tr, te); A = np.c_[np.ones(len(tr)), oof]
        w = np.linalg.lstsq(A, y[tr], rcond=None)[0]
        return w[0] + w[1] * s
    return predict
def model(make, X):
    return lambda tr, te: make().fit(X[tr], y[tr]).predict(X[te])
gbm = lambda: HistGradientBoostingRegressor(max_depth=3, max_iter=150, learning_rate=0.05, min_samples_leaf=8, l2_regularization=1.0, random_state=3)
ridge = lambda: RidgeCV(alphas=np.logspace(0, 4, 13))

def s_today(tr, te):
    lk, dl = y[tr] >= 6, y[tr] < 6
    P = np.average(NORM[tr][lk], axis=0, weights=y[tr][lk] - 5)
    return NORM[te] @ unit(2 * P - np.average(NORM[tr][dl], axis=0, weights=6 - y[tr][dl]))
def s_vec(S):
    return lambda tr, te: S[te] @ unit(((y[tr] - y[tr].mean())[:, None] * S[tr]).sum(0))
def s_sides(k, how):
    def f(tr, te):
        L = tr[y[tr] >= 8]
        lab = KMeans(k, n_init=5, random_state=3).fit_predict(ZU[L]) if how == 'kmeans' else AgglomerativeClustering(k, linkage='ward').fit_predict(ZU[L])
        C = unit(np.array([ZU[L][lab == c].mean(0) for c in range(k)]))
        return (ZU[te] @ C.T).max(1)
    return f
def s_sides_dis(k):
    """Best-fitting loved side, minus the best-fitting side of what they rated 5 or less."""
    def f(tr, te):
        out = []
        for mask, kk in ((y[tr] >= 8, k), (y[tr] <= 5, max(2, k // 3))):
            P = ZU[tr[mask]]; lab = AgglomerativeClustering(kk, linkage='ward').fit_predict(P)
            C = unit(np.array([P[lab == c].mean(0) for c in range(kk)])); out.append((ZU[te] @ C.T).max(1))
        return out[0] - out[1]
    return f
def p_groups(k):
    """Group everything rated, loved or not; a new title gets the average rating of the group it falls in."""
    def f(tr, te):
        lab = AgglomerativeClustering(k, linkage='ward').fit_predict(ZU[tr])
        C = unit(np.array([ZU[tr][lab == c].mean(0) for c in range(k)])); mu = np.array([y[tr][lab == c].mean() for c in range(k)])
        return mu[(ZU[te] @ C.T).argmax(1)]
    return f
def p_knn(S, k, power=2, shrink=0.5):
    def f(tr, te):
        sim = S[te] @ S[tr].T; top = np.argsort(-sim, axis=1)[:, :k]
        w = np.maximum(np.take_along_axis(sim, top, 1), 0) ** power; m0 = y[tr].mean()
        return m0 + (w * (y[tr][top] - m0)).sum(1) / (w.sum(1) + shrink)
    return f
def p_local(k=200):
    """A separate small linear model per title, fitted on the rated titles most like it."""
    def f(tr, te):
        out = []
        for j in te:
            sim = ZU[tr] @ ZU[j]; nb = np.argsort(-sim)[:k]
            out.append(Ridge(alpha=30).fit(Z[tr][nb], y[tr][nb], sample_weight=np.maximum(sim[nb], 0.01)).predict(Z[[j]])[0])
        return np.array(out)
    return f
nmf = NMF(12, init='nndsvda', max_iter=600, random_state=3).fit(RAW[POOL][:, KEEP][::4]); BL = nmf.transform(RAW[RI][:, KEEP])
knn_feat = None
def p_stack(parts):
    """A blend: weights for several predictions, learned on predictions the training titles got without their own rating."""
    def f(tr, te):
        oof = np.zeros((len(tr), len(parts)))
        for a, b in StratifiedKFold(5, shuffle=True, random_state=2).split(tr, y[tr]):
            for c, p in enumerate(parts): oof[b, c] = p(tr[a], tr[b])
        lr = Ridge(alpha=1.0, positive=True).fit(oof, y[tr])
        return lr.predict(np.column_stack([p(tr, te) for p in parts]))
    return f
XF = np.hstack([Z, FACTS]); XA = np.hstack([Zall, FACTS])
knn = p_knn(ZU, 10)
M = {
 'Your usual rating, for everything': lambda tr, te: np.full(len(te), y[tr].mean()),
 "Everyone's score alone (GoodWatch score)": model(ridge, GW[:, None]),
 'Title facts alone: all source scores, genres, year, type, language': model(gbm, FACTS),
 "Today's taste: one vector, raw scores": calibrated(s_today),
 'One vector, standardized, with craft': calibrated(s_vec(unit(Zall))),
 'One vector, standardized, craft left out': calibrated(s_vec(ZU)),
 'Sides: best of 4 loved sides (as built today)': calibrated(s_sides(4, 'kmeans')),
 'Sides: best of 14 loved sides': calibrated(s_sides(14, 'ward')),
 'Sides: best loved side minus best disliked side': calibrated(s_sides_dis(14)),
 'Groups of everything rated: average of the group (14)': p_groups(14),
 'Groups of everything rated: average of the group (40)': p_groups(40),
 'Tree rules on attributes (9 groups)': model(lambda: DecisionTreeRegressor(max_leaf_nodes=9, min_samples_leaf=35, random_state=3), RAW[RI][:, KEEP]),
 'Neighbors: 10 most alike rated titles': knn,
 'Neighbors: 30 most alike rated titles': p_knn(ZU, 30),
 'Neighbors with craft: 10 most alike': p_knn(unit(Zall), 10),
 'Trait blends: 12 recurring attribute combinations, weighted': model(ridge, BL),
 'Weighted attributes (linear), craft left out': model(ridge, Z),
 'Weighted attributes (linear), with craft': model(ridge, Zall),
 'Craft attributes only (linear)': model(ridge, CR),
 'Local weighted attributes: own model per title': p_local(),
 'Learned combinations (boosted trees), craft left out': model(gbm, Z),
 'Learned combinations, with craft': model(gbm, Zall),
 'Random forest on attributes, with craft': model(lambda: RandomForestRegressor(300, min_samples_leaf=3, max_features=0.33, n_jobs=-1, random_state=3), Zall),
 "Weighted attributes + everyone's score": model(ridge, np.c_[Zall, (GW - GW.mean()) / GW.std()]),
 'Learned combinations + title facts': model(gbm, XA),
}
M['Blend: weighted attributes + neighbors + learned combinations'] = p_stack([M['Weighted attributes (linear), with craft'], knn, M['Learned combinations, with craft']])
M['Blend of the above + title facts'] = p_stack([M['Weighted attributes (linear), with craft'], knn, M['Learned combinations + title facts'], M["Everyone's score alone (GoodWatch score)"]])

folds = list(StratifiedKFold(20, shuffle=True, random_state=0).split(np.arange(n), y))
res, preds = [], {}
bad, mid, hi = y <= 5, (y >= 6) & (y <= 7), y >= 8
def auc(p, pos):
    a, b = p[pos], p[~pos]; return float((a[:, None] > b[None, :]).mean() + 0.5 * (a[:, None] == b[None, :]).mean())
for name, f in M.items():
    p = np.zeros(n)
    for tr, te in folds: p[te] = f(tr, te)
    p = np.clip(p, 1, 10); preds[name] = p; e = np.abs(p - y)
    row = {'name': name, 'mae': e.mean(), 'rmse': np.sqrt(((p - y) ** 2).mean()), 'rho': spearmanr(p, y)[0], 'within1': (np.abs(np.round(p) - y) <= 1).mean(),
           'mae_bad': e[bad].mean(), 'mae_mid': e[mid].mean(), 'mae_hi': e[hi].mean(), 'pred_bad': p[bad].mean(), 'pred_hi': p[hi].mean(), 'auc_bad': auc(-p, bad),
           'spread': p.std()}
    res.append(row)
    print(f"{name[:62]:62s} MAE {row['mae']:.3f} RMSE {row['rmse']:.3f} rho {row['rho']:.3f} ±1 {row['within1']:.2f} | MAE bad {row['mae_bad']:.2f} mid {row['mae_mid']:.2f} hi {row['mae_hi']:.2f} | pred bad {row['pred_bad']:.2f} hi {row['pred_hi']:.2f} | AUCbad {row['auc_bad']:.3f}", flush=True)
json.dump({'res': res, 'y': y.tolist(), 'preds': {k: v.round(2).tolist() for k, v in preds.items()}, 'titles': [[META[i][2], META[i][3], META[i][0]] for i in RI]}, open('bench.json', 'w'))
