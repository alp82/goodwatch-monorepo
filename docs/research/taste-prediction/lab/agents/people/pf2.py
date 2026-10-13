"""Rating-free franchise-position and people-prior features; member-specific franchise history features."""
import re, collections, numpy as np
import pf
_S = {}
NUM = re.compile(r'(\b(\d|ii|iii|iv|vi|vii|viii)\b(?!\d))|(\bpart\b)|(\bchapter\b)|(\bepisode\b)')
def static2(D):
    if _S: return _S
    S = pf.static(D); info = D.info; n = D.n
    gw = S['base'][:, 74]; lv = S['base'][:, 74 + 10]; yr = S['base'][:, 74 + 6]
    # ---- franchise position (order by year among catalog titles of the same series)
    by = collections.defaultdict(list)
    for i, x in enumerate(info):
        if x.get('movie_series_id') is not None: by[x['movie_series_id']].append((x.get('release_year') or 9999, i))
    Fr = np.full((n, 9), np.nan); prev = {}; first = {}; members = {}
    for i, x in enumerate(info):
        t = (x['title'] or '').lower()
        Fr[i, 7] = float(bool(NUM.search(t))); Fr[i, 8] = float(':' in t or ' - ' in t)
    Fr[:, 0] = 0; Fr[:, 1] = 1
    for s, v in by.items():
        v = sorted(v); rows = [i for _, i in v]; y0 = v[0][0]
        for k, (y, i) in enumerate(v):
            members[i] = rows; first[i] = rows[0]; prev[i] = rows[k - 1] if k else None
            Fr[i, 0] = k; Fr[i, 1] = len(v); Fr[i, 2] = y - y0
            if len(v) > 1:
                Fr[i, 3] = gw[i] - gw[rows[0]]; Fr[i, 4] = gw[i] - np.mean([gw[j] for j in rows if j != i])
                Fr[i, 5] = gw[rows[k - 1]] if k else np.nan; Fr[i, 6] = lv[i] - lv[rows[0]]
    _S['fr'] = Fr; _S['fr_names'] = ['series_pos', 'series_size', 'years_since_first', 'score_minus_first', 'score_minus_siblings', 'prev_entry_score', 'logvotes_minus_first', 'title_has_number', 'title_has_subtitle']
    _S['prev'] = prev; _S['first'] = first; _S['members'] = members
    # ---- people / studio priors from the catalog (no ratings): leave-one-out mean public score and catalog count of the people on a title
    P = []; names = []
    gmean = np.nanmean(gw)
    for g, k in (('director', 2.0), ('writer', 2.0), ('cast', 3.0), ('lead', 3.0), ('producer', 3.0), ('company', 5.0), ('composer', 3.0)):
        G = S['G'][g]; s = collections.defaultdict(lambda: [0.0, 0.0])
        for i in range(n):
            if gw[i] == gw[i]:
                for e, w in G[i]: s[e][0] += gw[i] - gmean; s[e][1] += 1
        col = np.full((n, 3), np.nan)
        for i in range(n):
            eff = []; cnt = []; ws = []
            for e, w in G[i]:
                a, c = s[e]
                if gw[i] == gw[i]: a -= gw[i] - gmean; c -= 1
                eff.append(a / (c + k)); cnt.append(c); ws.append(w)
            if eff: col[i] = [np.average(eff, weights=ws), np.log1p(max(cnt)), np.log1p(np.mean(cnt))]
        P.append(col); names += [f'{g}_prior_score', f'{g}_max_credits', f'{g}_mean_credits']
    _S['pp'] = np.hstack(P); _S['pp_names'] = names
    return _S

def franchise_history(D, tr_idx, tr_y, rows, base=None):
    """Member-specific, own rating never used for its own row: rating of the previous entry, of the first entry, mean of the other rated entries, their count."""
    S2 = static2(D); rated = {int(i): v for i, v in zip(tr_idx, tr_y)}
    out = np.full((len(rows), 4), np.nan)
    for a, i in enumerate(rows):
        i = int(i); m = S2['members'].get(i)
        if not m: out[a, 3] = 0; continue
        oth = [rated[j] for j in m if j != i and j in rated]
        p = S2['prev'][i]; f = S2['first'][i]
        out[a] = [rated.get(p, np.nan) if p is not None else np.nan, rated.get(f, np.nan) if f != i else np.nan, np.mean(oth) if oth else np.nan, len(oth)]
    return out
