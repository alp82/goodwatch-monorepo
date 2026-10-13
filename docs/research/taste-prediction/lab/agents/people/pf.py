"""people agent: static (rating-free) features and entity groups, plus fold-safe target encoding."""
import re, numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import KFold

_S = {}
CERT_US = {'G': 0, 'TV-Y': 0, 'TV-G': 0, 'TV-Y7': 1, 'PG': 1, 'TV-PG': 1, 'PG-13': 2, 'TV-14': 2, 'R': 3, 'TV-MA': 3, 'NC-17': 4}
CERT_DE = {'0': 0, '6': 1, '12': 2, '16': 3, '18': 4}
STOP = {'the', 'a', 'an', 'of', 'and', 'in', 'to', 'part', 'chapter', 'episode', 'vol', 'volume', 'ii', 'iii', 'iv', 'v', 'vi', 'movie', 'film'}

def name_family(title):
    """Title-name family keys: text before a colon/dash, and the title without trailing numbers."""
    t = title.lower()
    out = set()
    head = re.split(r'\s*[:\-–—]\s+', t)[0]
    head = re.sub(r"[^a-z0-9' ]", ' ', head)
    head = re.sub(r'\b(\d+|ii|iii|iv|v|vi|vii|viii|part \w+|chapter \w+|returns|reloaded|revolutions|resurrections)\b', ' ', head)
    head = ' '.join(w for w in head.split() if w not in ('the', 'a', 'an'))
    if len(head) >= 3: out.add('h:' + head)
    ws = [w for w in re.sub(r"[^a-z0-9' ]", ' ', t).split() if w not in STOP and not w.isdigit()]
    if len(ws) >= 2: out.add('b:' + ' '.join(ws[:2]))
    return out

def static(D):
    if 'X' in _S: return _S
    info = D.info; n = D.n
    f = lambda v: np.nan if v is None else float(v)
    cols = ['goodwatch_overall_score_normalized_percent', 'imdb_user_score_normalized_percent', 'metacritic_meta_score_normalized_percent',
            'rotten_tomatoes_tomato_score_normalized_percent', 'rotten_tomatoes_audience_score_normalized_percent', 'tmdb_user_score_normalized_percent', 'release_year']
    genres = sorted({g for x in info for g in (x['genres'] or [])})
    F = np.array([[f(x[c]) for c in cols] + [x['media_type'] == 'show', x['original_language_code'] == 'en', x['original_language_code'] == 'ja',
                  np.log10(max(x['goodwatch_overall_score_voting_count'] or 1, 1))] + [g in (x['genres'] or []) for g in genres] for x in info], dtype=float)
    base = np.hstack([D.Z, F])                       # identical to baselines/gbm_facts.py
    flags = sorted(k for k in info[0] if k.startswith(('suitability_', 'context_is_')))
    def cert(x, pre, m):
        v = [m[c[len(pre):]] for c in (x.get('age_certifications') or []) if c.startswith(pre) and c[len(pre):] in m]
        return max(v) if v else np.nan
    E = []
    for x in info:
        gw_u, gw_o = f(x.get('goodwatch_user_score_normalized_percent')), f(x.get('goodwatch_official_score_normalized_percent'))
        E.append([f(x.get('runtime')), np.log10(max(x.get('popularity') or 0.01, 0.01)), np.log10(max(x.get('imdb_user_score_rating_count') or 1, 1)),
                  gw_u, gw_o, gw_u - gw_o, f(x.get('metacritic_user_score_normalized_percent')),
                  cert(x, 'US_', CERT_US), cert(x, 'DE_', CERT_DE), float(bool(x.get('is_anime'))),
                  float(x.get('production_method') == 'Animation'), float(x.get('production_method') == 'Mixed-Media'),
                  float(x.get('animation_style') == '3D CGI'), float(x.get('animation_style') == '2D Traditional'),
                  float(x.get('movie_series_id') is not None), len(x.get('production_company_ids') or []),
                  float('sequel' in (x.get('keywords') or [])), float(x['original_language_code'] not in ('en',))]
                 + [float(bool(x.get(k))) for k in flags])
    E = np.array(E, dtype=float)
    _S['base'] = base; _S['extra'] = E
    _S['extra_names'] = ['runtime', 'log_pop', 'log_imdb_n', 'gw_user', 'gw_official', 'user_minus_official', 'mc_user', 'cert_us', 'cert_de', 'anime',
                         'animation', 'mixed', 'cgi', '2d', 'in_series', 'n_companies', 'kw_sequel', 'non_english'] + flags
    # ---- entity groups: per title a list of (entity key, weight)
    G = {}
    def crew(x, jobs): return [p for j, p in (x.get('crew') or []) if j in jobs]
    G['cast'] = [[(p, 1.0 / (1 + 0.25 * k)) for k, p in enumerate(x.get('cast') or [])] for x in info]
    G['lead'] = [[(p, 1.0) for p in (x.get('cast') or [])[:3]] for x in info]
    G['director'] = [[(p, 1.0) for p in set(crew(x, ('Director', 'Series Director')))] for x in info]
    G['writer'] = [[(p, 1.0) for p in set(crew(x, ('Writer', 'Screenplay', 'Story', 'Novel')))] for x in info]
    G['producer'] = [[(p, 1.0) for p in set(crew(x, ('Producer', 'Executive Producer')))] for x in info]
    G['composer'] = [[(p, 1.0) for p in set(crew(x, ('Original Music Composer',)))] for x in info]
    G['dop'] = [[(p, 1.0) for p in set(crew(x, ('Director of Photography',)))] for x in info]
    G['anyperson'] = [[(p, 1.0) for p in set(list(x.get('cast') or []) + [p for _, p in (x.get('crew') or [])])] for x in info]
    G['series'] = [[(x['movie_series_id'], 1.0)] if x.get('movie_series_id') is not None else [] for x in info]
    G['family'] = [[(k, 1.0) for k in name_family(x['title'] or '')] for x in info]
    G['company'] = [[(c, 1.0) for c in (x.get('production_company_ids') or [])] for x in info]
    key2row = {k: i for i, k in enumerate(D.keys)}
    nb = [set() for _ in range(n)]
    for i, x in enumerate(info):
        for t in (x.get('tmdb_recommendation_ids') or []):
            j = key2row.get((x['media_type'], t))
            if j is not None and j != i: nb[i].add(j); nb[j].add(i)
    G['recs'] = [[(('t', j), 1.0) for j in s] for s in nb]         # entity = a neighbouring title; its "members" are its neighbours
    nb2 = [set() for _ in range(n)]
    for i, x in enumerate(info):
        for t in (x.get('tmdb_similar_ids') or []):
            j = key2row.get((x['media_type'], t))
            if j is not None and j != i: nb2[i].add(j); nb2[j].add(i)
    G['similar'] = [[(('t', j), 1.0) for j in s] for s in nb2]
    dec = lambda x: None if x.get('release_year') is None else int(x['release_year']) // 10 * 10
    half = lambda x: None if x.get('release_year') is None else int(x['release_year']) // 5 * 5
    G['lang'] = [[(x['original_language_code'], 1.0)] for x in info]
    G['era'] = [[(half(x), 1.0)] if half(x) is not None else [] for x in info]
    G['highlight'] = [[(k, 1.0) for k in (x.get('fingerprint_highlight_keys') or [])] for x in info]
    G['genre'] = [[(g, 1.0) for g in (x['genres'] or [])] for x in info]
    G['genre2'] = [[((a, b), 1.0) for a in sorted(x['genres'] or []) for b in sorted(x['genres'] or []) if a < b] for x in info]
    G['genre_era'] = [[((g, dec(x)), 1.0) for g in (x['genres'] or [])] if dec(x) is not None else [] for x in info]
    meth = lambda x: (x.get('production_method'), x.get('animation_style'))
    G['method_genre'] = [[((meth(x), g), 1.0) for g in (x['genres'] or [])] for x in info]
    G['type_genre'] = [[((x['media_type'], g), 1.0) for g in (x['genres'] or [])] for x in info]
    G['cert_genre'] = [[((e[7] if e[7] == e[7] else e[8], g), 1.0) for g in (x['genres'] or [])] for x, e in zip(info, E)]
    G['flag_genre'] = [[((k, g), 1.0) for k in flags if x.get(k) for g in (x['genres'] or [])] for x in info]
    G['hl_genre'] = [[((k, g), 1.0) for k in (x.get('fingerprint_highlight_keys') or []) for g in (x['genres'] or [])] for x in info]
    G['hl2'] = [[((a, b), 1.0) for a in sorted(x.get('fingerprint_highlight_keys') or []) for b in sorted(x.get('fingerprint_highlight_keys') or []) if a < b] for x in info]
    G['country'] = [[(c, 1.0) for c in (x.get('origin_country_codes') or [])] for x in info]
    _S['G'] = G
    return _S

def te_fit(group, rows, r, self_title=False):
    """entity -> [sum of weighted residuals, sum of weights] from the given rows. For title-neighbour groups the entity is the rated row itself."""
    s = {}
    if self_title:
        for i, ri in zip(rows, r): s[('t', int(i))] = [ri, 1.0]
        return s
    for i, ri in zip(rows, r):
        for e, w in group[i]:
            a = s.get(e)
            if a is None: s[e] = [w * ri, w]
            else: a[0] += w * ri; a[1] += w
    return s

def te_apply(group, rows, s, k):
    """Per title: [weighted mean of shrunk effects, strongest effect by magnitude, evidence = log1p(sum of counts), sum of shrunk effects]."""
    out = np.zeros((len(rows), 4))
    for a, i in enumerate(rows):
        effs = []; ws = []; cnt = 0.0
        for e, w in group[i]:
            v = s.get(e)
            if v is None: continue
            effs.append(v[0] / (v[1] + k)); ws.append(w); cnt += v[1]
        if effs:
            effs = np.array(effs); ws = np.array(ws)
            out[a] = [(effs * ws).sum() / ws.sum(), effs[np.abs(effs).argmax()], np.log1p(cnt), (effs * ws).sum()]
    return out

NEIGH = ('recs', 'similar')
def te_features(S, groups, tr_idx, r, te_idx, k=2.0, inner=5, seed=0, reps=1):
    """Fold-safe encodings: train rows get values computed without their own inner fold; test rows from all train rows."""
    G = S['G']; ntr = len(tr_idx)
    Ftr = np.zeros((ntr, 4 * len(groups))); Fte = np.zeros((len(te_idx), 4 * len(groups)))
    for rep in range(reps):
        for a, b in KFold(inner, shuffle=True, random_state=seed + rep).split(tr_idx):
            for gi, g in enumerate(groups):
                s = te_fit(G[g], tr_idx[a], r[a], g in NEIGH)
                Ftr[b, 4 * gi:4 * gi + 4] += te_apply(G[g], tr_idx[b], s, k) / reps
    for gi, g in enumerate(groups):
        s = te_fit(G[g], tr_idx, r, g in NEIGH)
        Fte[:, 4 * gi:4 * gi + 4] = te_apply(G[g], te_idx, s, k)
    return Ftr, Fte

def gbm(**kw):
    p = dict(max_depth=3, max_iter=150, learning_rate=0.05, min_samples_leaf=8, l2_regularization=1.0, random_state=3); p.update(kw)
    return _G(**p)

class _G(HistGradientBoostingRegressor):
    """Same model; columns with no observed value in the training rows are dropped (sklearn's binning fails on them)."""
    def fit(self, X, y, sample_weight=None):
        self.keep_ = ~np.isnan(X).all(0)
        if self.monotonic_cst is not None and len(self.monotonic_cst) == X.shape[1]: self.monotonic_cst = np.asarray(self.monotonic_cst)[self.keep_]
        return super().fit(X[:, self.keep_], y, sample_weight=sample_weight)
    def predict(self, X): return super().predict(X[:, self.keep_])
