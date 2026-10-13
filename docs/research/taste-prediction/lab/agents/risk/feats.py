"""risk agent: the short, pre-specified list of rating-free inputs for the rating DISTRIBUTION (spread and low tail).
Every column is a property of the title only; nothing here has seen a rating. Cached in feats.npz."""
import os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); LAB = os.path.dirname(os.path.dirname(HERE))
AUD = ['imdb_user_score', 'tmdb_user_score', 'rotten_tomatoes_audience_score', 'metacritic_user_score']
CRI = ['metacritic_meta_score', 'rotten_tomatoes_tomato_score']
NAMES = ['aud_crit', 'abs_aud_crit', 'spread', 'imdb_rest', 'abs_imdb_rest', 'logvotes', 'n_missing', 'hype', 'season_decline',
         'sequel', 'kind_spectacle', 'kind_sitcom', 'crit_over', 'aud_over', 'is_show', 'aud_mean', 'crit_mean', 'mc_user', 'imdb_under70']
_c = {}
def get(D):
    if 'X' in _c: return _c['X']
    p = os.path.join(HERE, 'feats.npz')
    if os.path.exists(p):
        z = np.load(p)
        if len(z['X']) == D.n and list(z['names']) == NAMES: _c['X'] = z['X']; return _c['X']
    f = lambda v: np.nan if v is None else float(v)
    S = np.array([[f(x.get(c + '_normalized_percent')) for c in AUD + CRI] for x in D.info]) / 10.0   # 0..10
    aud = np.nanmean(S[:, :4], 1); nc = (~np.isnan(S[:, 4:])).sum(1)
    cri = np.where(nc > 0, np.nansum(S[:, 4:], 1) / np.maximum(nc, 1), np.nan)
    gap = np.where(nc > 0, aud - cri, 0.0)                                   # audience above critics (+) ; no critic score: 0
    navail = (~np.isnan(S)).sum(1)
    spread = np.where(navail >= 3, np.nanstd(S, 1), np.nan); spread = np.where(np.isnan(spread), np.nanmedian(spread), spread)
    rest = np.nanmean(S[:, 1:], 1); ir = np.where(np.isnan(S[:, 0]) | np.isnan(rest), 0.0, S[:, 0] - rest)
    lv = np.log10(np.array([max(x.get('imdb_user_score_rating_count') or 1, 1) for x in D.info], float))
    zl = (lv - lv.mean()) / lv.std(); im = np.where(np.isnan(S[:, 0]), np.nanmean(S[:, 0]), S[:, 0]); zs = (im - im.mean()) / im.std()
    nmiss = np.isnan(S[:, 2:]).sum(1).astype(float)                          # of RT audience, Metacritic user, Metacritic critics, RT critics
    hype = np.maximum(zl, 0) * np.maximum(-zs, 0)                            # much voted on AND below-average score
    dec = np.zeros(D.n)
    for i, x in enumerate(D.info):                                           # shows: IMDb score of the later seasons minus the first season
        ss = [(s['season_number'], s['imdb_user_score_original']) for s in (x.get('seasons') or [])
              if s.get('season_number', 0) >= 1 and s.get('imdb_user_score_original') and (s.get('imdb_user_score_rating_count') or 0) >= 50]
        if len(ss) >= 2:
            ss.sort(); dec[i] = np.mean([v for _, v in ss[1:]]) - ss[0][1]
    z = np.load(os.path.join(LAB, 'agents', 'text', 'text_feats.npz')); fl = z['flags']
    first = {}
    for x in D.info:
        s = x.get('movie_series_id')
        if s is not None: first[s] = min(first.get(s, 9999), x.get('release_year') or 9999)
    later = np.array([x.get('movie_series_id') is not None and (x.get('release_year') or 9999) > first[x['movie_series_id']] for x in D.info], float)
    sequel = np.maximum(fl[:, 0], later)                                     # TMDB keyword "sequel" or a later entry of a movie series
    k = np.load(os.path.join(LAB, 'agents', 'profile', 'kinds6.npz'))['lab']
    t = {x['title']: i for i, x in enumerate(D.info)}
    ks, kc = k[t['The Avengers']], k[t['Meet the Parents']]
    std = lambda v: (v - v.mean()) / v.std()
    X = np.c_[gap, np.abs(gap), spread, ir, np.abs(ir), zl, nmiss, hype, dec, sequel, k == ks, k == kc,
              np.maximum(-gap, 0), np.maximum(gap, 0), [x['media_type'] == 'show' for x in D.info],
              np.where(np.isnan(aud), np.nanmean(aud), aud), np.where(np.isnan(cri), np.nanmean(cri), cri), np.where(np.isnan(S[:, 3]), np.nanmean(S[:, 3]), S[:, 3]), np.maximum(7.0 - im, 0)].astype(float)
    np.savez(p, X=X, names=np.array(NAMES)); _c['X'] = X; return X
if __name__ == '__main__':
    import sys; sys.path.insert(0, LAB); import harness
    D = harness.Data(); X = get(D); idx, y = D.of(D.owner); bad = y <= 5
    print('catalog n', D.n, 'owner n', len(y), 'bad', bad.sum())
    for j, nm in enumerate(NAMES):
        v = X[idx, j]; q = np.quantile(v, [.25, .75]); hi = v > q[1] if q[1] > q[0] else v > v.min(); 
        print(f'{nm:15s} catalog mean {X[:, j].mean():6.2f} sd {X[:, j].std():5.2f} | owner: nonzero {np.mean(v != 0):.2f}  bad share top group {bad[hi].mean():.3f} (n {hi.sum()}) rest {bad[~hi].mean():.3f}  sd(y) top {y[hi].std():.2f} rest {y[~hi].std():.2f}')
