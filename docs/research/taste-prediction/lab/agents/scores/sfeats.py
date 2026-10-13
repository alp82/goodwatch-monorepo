"""scores agent: rating-free score features, in pre-specified blocks. Nothing here looks at a member's rating.

Sources. Audience: IMDb, TMDB, RT audience, Metacritic user. Critics: Metacritic meta, RT tomato.
Each block is a small set of columns with one reason (see BLOCKS at the bottom). `register(D, name, blocks)` appends the
standardized block columns to the pooled model's 160 columns and makes them available as pool.feats(D, name).
"""
import os, sys, importlib.util, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); LAB = os.path.dirname(os.path.dirname(HERE))

def load(path, name):
    if name in sys.modules: return sys.modules[name]
    d = os.path.dirname(path)
    if d not in sys.path: sys.path.insert(0, d)
    s = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(s); sys.modules[name] = m; s.loader.exec_module(m); return m

sys.path.insert(0, os.path.join(LAB, 'baselines'))
pool = load(os.path.join(LAB, 'agents', 'pooled', 'pool.py'), 'pool')          # pooled's own files import it as `pool`: share the one module

SRC = {  # name: (score column, count column, audience?, k = count at which the score is trusted half)
    'imdb': ('imdb_user_score_normalized_percent', 'imdb_user_score_rating_count', True, 100.),
    'tmdb': ('tmdb_user_score_normalized_percent', 'tmdb_user_score_rating_count', True, 30.),
    'rta': ('rotten_tomatoes_audience_score_normalized_percent', 'rotten_tomatoes_audience_score_rating_count', True, 100.),
    'mcu': ('metacritic_user_score_normalized_percent', 'metacritic_user_score_rating_count', True, 20.),
    'mc': ('metacritic_meta_score_normalized_percent', 'metacritic_meta_score_review_count', False, 5.),
    'rt': ('rotten_tomatoes_tomato_score_normalized_percent', 'rotten_tomatoes_tomato_score_review_count', False, 10.)}
AUD = [s for s in SRC if SRC[s][2]]; CRIT = [s for s in SRC if not SRC[s][2]]
KINDS = ['warm drama', 'irreverent comedy', 'tense crime/thriller', 'strange/stylized', 'spectacle adventure', 'light comedy']
_B = {}

def _pct(v, groups, least=20):
    """Percentile (0..1) of v within its group; groups under `least` titles fall back to the whole catalog."""
    from scipy.stats import rankdata
    out = (rankdata(v) - 0.5) / len(v)
    for g in np.unique(groups):
        m = groups == g
        if m.sum() >= least: out[m] = (rankdata(v[m]) - 0.5) / m.sum()
    return out

def raw(D):
    """Dict of the raw material: scores S, counts C, shrunk z-scores Z, reliabilities R, composites."""
    if 'raw' in _B: return _B['raw']
    f = lambda v: np.nan if v is None else float(v)
    S = {s: np.array([f(x[SRC[s][0]]) for x in D.info]) for s in SRC}
    C = {s: np.array([f(x[SRC[s][1]]) for x in D.info]) for s in SRC}
    Z, Zraw, R = {}, {}, {}
    for s in SRC:
        m, sd = np.nanmean(S[s]), np.nanstd(S[s]); c = np.where(np.isnan(C[s]), 0., C[s]); r = c / (c + SRC[s][3])
        R[s] = np.where(np.isnan(S[s]), 0., r)
        Zraw[s] = (S[s] - m) / sd
        Z[s] = r * Zraw[s]                                   # shrunk toward the source mean by its count; NaN where missing
    comp = lambda names: np.where(sum(R[s] for s in names) > 0, sum(np.nan_to_num(Z[s]) for s in names) / np.maximum(sum((R[s] > 0) * 1. for s in names), 1), np.nan)
    wcomp = lambda names: np.where(sum(R[s] for s in names) > 0, sum(R[s] * np.nan_to_num(Zraw[s]) for s in names) / np.maximum(sum(R[s] for s in names), 1e-9), np.nan)
    aud = wcomp(AUD); crit = wcomp(CRIT)                      # reliability-weighted means of the standardized sources
    aud = (aud - np.nanmean(aud)) / np.nanstd(aud); crit = (crit - np.nanmean(crit)) / np.nanstd(crit)
    aud = np.nan_to_num(aud)                                  # 5 titles without any audience score: the average
    out = dict(S=S, C=C, Z=Z, Zraw=Zraw, R=R, aud=aud, crit=crit, has_crit=~np.isnan(crit),
               show=np.array([x['media_type'] == 'show' for x in D.info]), year=np.array([f(x['release_year']) for x in D.info]))
    out['year'] = np.where(np.isnan(out['year']), np.nanmedian(out['year']), out['year'])
    k = np.load(os.path.join(LAB, 'agents', 'profile', 'kinds6.npz')); out['kind'] = k['lab']; out['G'] = k['G'].astype(float)
    _B['raw'] = out; return out

def _seasons(D):
    """Per show: how the seasons scored on IMDb relative to each other. Zero for movies and shows with under 2 scored seasons."""
    F = np.zeros((D.n, 6))
    for i, x in enumerate(D.info):
        ss = [s for s in (x['seasons'] or []) if s.get('season_number', 0) > 0]
        if not ss: continue
        F[i, 5] = np.log2(len(ss))
        sc = sorted([(s['season_number'], s['imdb_user_score_original'], s.get('ep_sd') or 0., s.get('imdb_user_score_rating_count') or 0)
                     for s in ss if s.get('imdb_user_score_original') and (s.get('imdb_user_score_rating_count') or 0) >= 20])
        if len(sc) < 2: continue
        v = np.array([a[1] for a in sc]); t = np.arange(len(v), dtype=float)
        F[i, 0] = 1.
        F[i, 1] = v[0] - v[1:].mean()                         # first season against the later ones
        F[i, 2] = np.polyfit(t, v, 1)[0] * (len(v) - 1)       # fitted change from first to last season (decline is negative)
        F[i, 3] = v[-1] - v[:-1].mean()                       # how the last season scored against the earlier ones
        F[i, 4] = np.mean([a[2] for a in sc])                 # episode score spread within a season
    return F, ['seas_has', 'seas_first_vs_later', 'seas_trend', 'seas_last_vs_earlier', 'seas_ep_spread', 'seas_log_n']

def blocks(D):
    """name -> (columns n x c, column names, reason)."""
    if 'blocks' in _B: return _B['blocks']
    r = raw(D); S, C, Z, Zr, R = r['S'], r['C'], r['Z'], r['Zraw'], r['R']; aud, crit, hc = r['aud'], r['crit'], r['has_crit']
    n = D.n; B = {}
    B['mcu'] = (np.c_[S['mcu']], ['mcu'], 'Metacritic user score: the fourth audience source, absent from the 160 columns')
    B['miss'] = (np.c_[~hc, np.isnan(S['rta']), np.isnan(S['mcu'])] * 1., ['no_critics', 'no_rt_audience', 'no_mc_user'], 'a missing source is information (obscure, foreign, old TV)')
    B['shr'] = (np.c_[[np.nan_to_num(Z[s]) for s in SRC]].T, ['shr_' + s for s in SRC], 'each source shrunk to its mean by vote count (missing = the mean)')
    B['relw'] = (np.c_[aud, np.nan_to_num(crit)], ['aud_rel', 'crit_rel'], 'reliability-weighted audience and critic composites')
    B['logc'] = (np.c_[[np.log10(1 + np.nan_to_num(C[s])) for s in SRC]].T, ['logn_' + s for s in SRC], 'plain log vote counts per source (the simple alternative to shrinking)')
    gap = np.where(hc, aud - np.nan_to_num(crit), 0.)
    zs = np.c_[[Zr[s] for s in SRC]].T; spread = np.array([np.std(z[~np.isnan(z)]) if (~np.isnan(z)).sum() > 1 else 0. for z in zs])
    zo = np.c_[[Zr[s] for s in ('tmdb', 'rta', 'mcu')]].T; oth = np.nansum(zo, 1) / np.maximum((~np.isnan(zo)).sum(1), 1)
    B['gap'] = (np.c_[gap, spread, np.nan_to_num(Zr['imdb'] - oth)], ['aud_minus_crit', 'source_spread', 'imdb_minus_other_aud'], 'disagreement: audience over critics, spread across sources, IMDb against the rest')
    dec = np.clip(r['year'] // 10 * 10, 1960, 2020); g0 = np.array([(x['genres'] or ['none'])[0] for x in D.info]); lang = np.array([x['original_language_code'] if x['original_language_code'] in ('en', 'ja') else 'xx' for x in D.info])
    code = lambda *a: np.unique(np.array(['|'.join(map(str, t)) for t in zip(*a)]), return_inverse=True)[1]
    B['peer'] = (np.c_[_pct(aud, r['kind']), _pct(aud, code(r['show'], dec)), _pct(aud, code(r['show'], g0)), _pct(aud, code(r['show'], lang))],
                 ['pct_in_kind', 'pct_in_era', 'pct_in_genre', 'pct_in_language'], 'audience score percentile among the title\'s peers ("good for a horror film")')
    B['curve'] = (np.c_[aud ** 2, np.maximum(aud, 0)], ['aud_sq', 'aud_above_avg'], 'curved response to the audience score')
    A = np.c_[np.ones(n), aud, r['year'] - 2000, r['show']]; lv = np.log10(1 + np.nan_to_num(C['imdb'])); over = lv - A @ np.linalg.lstsq(A, lv, rcond=None)[0]
    B['pop'] = (np.c_[over, over * aud], ['overexposed', 'overexposed_x_aud'], 'more (or fewer) votes than the score, year and media type predict: overexposed against hidden gem')
    F, nm = _seasons(D); B['seas'] = (F, nm, 'shows: first season against later, trend, last season, episode spread')
    Gc = r['G'] - r['G'].mean(0)
    B['leanx'] = (gap[:, None] * Gc, ['gap_x_' + k for k in KINDS], 'does the audience-over-critic lean depend on the kind of title')
    B['audx'] = (aud[:, None] * Gc, ['aud_x_' + k for k in KINDS], 'does the weight of the audience score depend on the kind of title')
    _B['blocks'] = B; return B

def matrix(D, names):
    """Standardized columns of the named blocks (NaN = column mean)."""
    B = blocks(D); X = np.hstack([B[b][0] for b in names]); cols = [c for b in names for c in B[b][1]]
    X = np.where(np.isnan(X), np.nanmean(X, 0), X); X = (X - X.mean(0)) / (X.std(0) + 1e-9)
    return X, cols

def register(D, names, base='all', scale=None):
    """Make pool.feats(D, kind) return the pooled columns plus the named blocks. Returns the kind name.
    scale: {column name: factor}: a column multiplied by f is penalised f^2 less (in the consensus and in the personal weights)."""
    kind = base + '+' + '+'.join(names) + ('' if not scale else '*' + ','.join(f'{k}{v}' for k, v in sorted(scale.items())))
    if kind not in pool._C:
        X0, n0 = pool.feats(D, base); X0 = X0.copy(); n0 = list(n0)
        if names: X1, n1 = matrix(D, list(names)); X0 = np.c_[X0, X1]; n0 = n0 + n1
        for k, v in (scale or {}).items(): X0[:, n0.index(k)] *= v
        pool._C[kind] = (X0, n0)
    return kind
