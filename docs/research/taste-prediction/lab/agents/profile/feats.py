"""Rating-free title features for the taste profile. Nothing here reads ratings. Cached in memory."""
import os, sys, re, collections, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); LAB = os.path.join(HERE, '..', '..')
for p in (LAB, os.path.join(HERE, '..', 'structure')):
    if p not in sys.path: sys.path.append(p)
import common as SC   # structure agent, read-only

AUD = ['imdb_user_score_normalized_percent', 'tmdb_user_score_normalized_percent', 'rotten_tomatoes_audience_score_normalized_percent']
CRIT = ['metacritic_meta_score_normalized_percent', 'rotten_tomatoes_tomato_score_normalized_percent']
GENRE_MERGE = {'Sci-Fi & Fantasy': ['Science Fiction', 'Fantasy'], 'Action & Adventure': ['Action', 'Adventure'], 'War & Politics': ['War'], 'Kids': ['Family']}
NUM = re.compile(r'(\b[2-9]\b|\bII+\b|\bIV\b|\bPart \w+)')
_c = {}

def get(D):
    if _c: return _c
    I = D.info; n = D.n; f = lambda v: np.nan if v is None else float(v)
    A = np.array([[f(x[c]) for c in AUD] for x in I]); C = np.array([[f(x[c]) for c in CRIT] for x in I])
    with np.errstate(all='ignore'):
        aud = np.nanmean(A, 1); crit = np.nanmean(C, 1)
    aud = np.where(np.isnan(aud), np.nanmean(aud), aud)
    ok = ~np.isnan(crit); co = np.polyfit(aud[ok], crit[ok], 1); crit = np.where(ok, crit, np.polyval(co, aud))   # no critic score: assume the typical gap
    _c['aud'] = aud; _c['crit'] = crit; _c['has_crit'] = ok
    _c['qm'] = ((aud + crit) / 2 - np.mean((aud + crit) / 2)) / 10          # per 10 points of public score
    _c['gap'] = ((aud - crit) - np.mean(aud - crit)) / 10                   # audiences above critics, per 10 points
    # ---- shared kinds: k-means over the whole catalog on the 66 non-craft attributes (structure's recipe)
    _c['TA'] = SC.cols(D)[1]
    # ---- sequel
    by = collections.defaultdict(list)
    for i, x in enumerate(I):
        if x.get('movie_series_id') is not None: by[x['movie_series_id']].append((x.get('release_year') or 9999, i))
    pos = np.zeros(n)
    for s, v in by.items():
        for k, (_, i) in enumerate(sorted(v)): pos[i] = k
    kw = np.array(['sequel' in [str(k).lower() for k in (x['keywords'] or [])] for x in I])
    numt = np.array([bool(NUM.search(x['title'] or '')) and x['media_type'] == 'movie' for x in I])
    _c['sequel'] = (kw | (pos > 0) | numt).astype(float)
    # ---- title facts (flags)
    yr = np.array([f(x.get('release_year')) for x in I]); yr = np.where(np.isnan(yr), np.nanmedian(yr), yr)
    facts = collections.OrderedDict()
    facts['a series (not a movie)'] = np.array([x['media_type'] == 'show' for x in I])
    facts['animated'] = np.array([x.get('production_method') == 'Animation' for x in I])
    facts['anime'] = np.array([bool(x.get('is_anime')) for x in I])
    facts['not in English'] = np.array([x['original_language_code'] != 'en' for x in I])
    facts['made before 1990'] = yr < 1990
    facts['made since 2015'] = yr >= 2015
    for k, nm in (('context_is_thought_provoking', 'thought-provoking'), ('context_is_pure_escapism', 'pure escapism'), ('context_is_comfort_watch', 'a comfort watch'),
                  ('context_is_background_friendly', 'fine in the background'), ('context_is_binge_friendly', 'made for bingeing'), ('suitability_kids', 'suitable for kids')):
        facts[nm] = np.array([bool(x.get(k)) for x in I])
    _c['facts'] = np.array(list(facts.values()), dtype=float).T; _c['fact_names'] = list(facts)
    gs = collections.OrderedDict()
    for i, x in enumerate(I):
        for g in (x['genres'] or []):
            for h in GENRE_MERGE.get(g, [g]): gs.setdefault(h, np.zeros(n))[i] = 1
    keep = [g for g in gs if gs[g].sum() >= 40]
    _c['genres'] = np.array([gs[g] for g in keep]).T; _c['genre_names'] = keep
    # ---- dials: the 74 attributes, standardized against the well-known catalog, clipped
    _c['dials'] = np.clip(D.Z, -2.5, 2.5); _c['dial_names'] = list(D.fp_keys)
    # ---- themes from text (text agent's rating-free cache)
    z = np.load(os.path.join(HERE, '..', 'text', 'text_feats.npz'), allow_pickle=True)
    T = np.hstack([z['tfidf_svd'][:, :16], z['tags_svd'][:, :16], z['pca_en'][:, :16]]); T = (T - T.mean(0)) / T.std(0)
    _c['themes'] = np.clip(T, -2.5, 2.5); _c['theme_names'] = [f'txt{i}' for i in range(16)] + [f'tag{i}' for i in range(16)] + [f'emb{i}' for i in range(16)]
    return _c

def kinds(D, k):
    """Hard shared kinds: index of the nearest of k catalog regions. The six-kind set is frozen in kinds6.npz (k-means is not
    reproducible across thread counts, and the kinds carry names)."""
    if ('K', k) not in _c:
        p = os.path.join(HERE, f'kinds{k}.npz')
        if k == 6 and os.path.exists(p):
            z = np.load(p); _c[('K', k)] = (z['lab'], z['centers']); _c[('G', k)] = z['G']
        else:
            G, km = SC.regions(D, k); _c[('K', k)] = (G.argmax(1), km.cluster_centers_); _c[('G', k)] = G
            if k == 6: np.savez(p, lab=G.argmax(1), centers=km.cluster_centers_, G=G)
    return _c[('K', k)]
def soft(D, k=6):
    kinds(D, k); return _c[('G', k)]

def hilo(X):
    """Gap in column units between the mean of the catalog's top third and bottom third (to express a slope as 'strong vs weak')."""
    lo, hi = np.quantile(X, [1 / 3, 2 / 3], axis=0)
    return np.array([X[X[:, j] >= hi[j], j].mean() - X[X[:, j] <= lo[j], j].mean() for j in range(X.shape[1])])
