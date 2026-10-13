"""B5: the pooled predictor. The frozen leader of the first loop.

A port of `pool.pooled_predict` from docs/research/taste-prediction/lab/agents/pooled/pool.py as the first loop's
`preds.pooled` called it: k=0 (no taste axes), personal weights on (own=300), no trees. It is B4 plus one step: what
the consensus, the member's offset and the member's slope leave unexplained is fitted by the member's own weights
on every title column, shrunk to zero (ridge penalty 300), from 3 ratings on. Logic unchanged; see b4_consensus.py
for the model, the columns and the declared differences. tests/test_ladder.py runs the original and this file on
the same data and requires the same numbers.

Fallback, declared: when no other member has rated anything in the view (with `--others before`, every block of
the first member to rate), or when the others are too few for the fit to give finite numbers, the answer is rung
B1's: the GoodWatch score plus the member's shrunk offset.

score   the prediction clipped to 1..10, as the original returns it
rank    the prediction before clipping
"""
import numpy as np

OWN = 300.0

# ---- the lines below are the same in b4_consensus.py and b5_pooled.py ----
FACTS = ('goodwatch_overall_score_normalized_percent', 'imdb_user_score_normalized_percent',
         'metacritic_meta_score_normalized_percent', 'rotten_tomatoes_tomato_score_normalized_percent',
         'rotten_tomatoes_audience_score_normalized_percent', 'tmdb_user_score_normalized_percent', 'release_year')
MISSING = 255
LAM0 = 300.0


def universe(view):
    """The title rows the model lives on: every title a row of the view names, sorted."""
    rows = [view['targets']['title']]
    for who in ('me', 'others'):
        for table in ('ratings', 'want_to_see', 'skip', 'not_interested'):
            rows.append(view[who][table]['title'])
    return np.unique(np.concatenate(rows))


def features(view, rows):
    """gbm_facts.features followed by pool.feats: the columns, missing values as column means, standardized."""
    titles = view['titles']
    num = titles['num']
    pool = titles['fingerprint'][titles['in_pool'] & titles['has_fingerprint']]
    seen = pool != MISSING
    known = np.where(seen, pool, 0)
    count = np.maximum(seen.sum(0), 1)
    mean = known.sum(0, dtype=np.int64) / count
    sd = np.sqrt(np.maximum((known.astype(np.uint16) ** 2).sum(0, dtype=np.int64) / count - mean ** 2, 0))
    sd = np.where(sd > 0, sd, 1.0)
    fp = titles['fingerprint'][rows]
    z = np.where((fp != MISSING) & titles['has_fingerprint'][rows][:, None], (fp - mean) / sd, np.nan)
    facts = []
    for c in FACTS:
        v = num[c][rows].astype(float)
        facts.append(np.where(v < 0, np.nan, v) if num[c].dtype.kind == 'i' else v)
    language = titles['language'][rows]
    names = titles['language_names']
    code = {name: (names.index(name) if name in names else -2) for name in ('en', 'ja')}
    votes = num['goodwatch_overall_score_voting_count'][rows]
    genres = titles['genres'][rows]
    genres = genres[:, genres.any(0)]
    x = np.column_stack([z] + facts + [titles['media_type'][rows] == 1, language == code['en'], language == code['ja'],
                                       np.log10(np.maximum(votes, 1)), genres]).astype(np.float64)
    x = np.where(np.isnan(x), np.nanmean(x, 0), x)
    return (x - x.mean(0)) / (x.std(0) + 1e-9)


def em(groups, q, iters=30):
    """Random-coefficient model y_v = T_v c_v + e, c_v ~ N(mu, Sigma), e ~ N(0, s2). groups: list of (T_v, y_v)."""
    mu = np.zeros(q)
    mu[0] = np.mean(np.concatenate([y for _, y in groups]))
    sig = np.eye(q)
    s2 = 2.0
    n = sum(len(y) for _, y in groups)
    tt = np.array([t.T @ t for t, _ in groups])
    ty = np.array([t.T @ y for t, y in groups])
    yy = sum(y @ y for _, y in groups)
    for _ in range(iters):
        si = np.linalg.inv(sig)
        s = np.linalg.inv(si[None] + tt / s2)
        m = np.einsum('vij,vj->vi', s, (si @ mu)[None] + ty / s2)
        rss = yy - 2 * (m * ty).sum() + np.einsum('vi,vij,vj->', m, tt, m) + np.einsum('vij,vji->', tt, s)
        mu = m.mean(0)
        d = m - mu
        sig = (d.T @ d + s.sum(0)) / len(groups)
        sig += 1e-6 * np.eye(q)
        s2 = rss / n
    return mu, sig, s2


def fit_pool(x, ou, oi, oy):
    """Everything learned from the other members: the design T (1, consensus) per title row, mu, Sigma, s2."""
    p = x.shape[1]
    uid, uinv = np.unique(ou, return_inverse=True)
    cnt = np.bincount(uinv).astype(float)
    gm = oy.mean()
    b = (np.bincount(uinv, oy) + 3 * gm) / (cnt + 3)         # member offset and scale, shrunk to the population
    gs = np.sqrt(np.mean((oy - b[uinv]) ** 2))
    s = np.sqrt((np.bincount(uinv, (oy - b[uinv]) ** 2) + 5 * gs ** 2) / (cnt + 5))
    s = s / np.average(s, weights=cnt)
    xo = x[oi]
    g0 = np.linalg.inv(sum(x[oi[uinv == v]].T @ x[oi[uinv == v]] for v in range(len(uid))) + LAM0 * np.eye(p))
    w0 = np.zeros(p)
    for _ in range(3):                                       # consensus weights and member offsets, alternating
        z = (oy - b[uinv]) / s[uinv]
        w0 = g0 @ (xo.T @ z)
        r = oy - s[uinv] * (xo @ w0)
        b = (np.bincount(uinv, r) + 3 * gm) / (cnt + 3)
    g = x @ w0
    g = g / g[oi].std()                                      # consensus score, unit spread over rated rows
    t = np.c_[np.ones(len(x)), g]
    trow = t[oi]
    groups = [(trow[uinv == v], oy[uinv == v]) for v in range(len(uid))]
    mu, sig, s2 = em(groups, 2)
    return t, mu, sig, s2


def public(view):
    """Rung B1's behaviour, for a view in which the others hold nothing to learn from: the GoodWatch score plus the
    member's offset shrunk toward the population's (3 pseudo-ratings), the member's median without such a score."""
    g = view['titles']['num']['goodwatch_overall_score_normalized_percent'] / 10.0
    mine, others = view['me']['ratings'], view['others']['ratings']
    d = others['score'] - g[others['title']]
    population = float(np.nanmean(d)) if np.isfinite(d).any() else 0.0
    d = mine['score'] - g[mine['title']]
    ok = np.isfinite(d)
    offset = (d[ok].sum() + 3.0 * population) / (ok.sum() + 3.0)
    median = float(np.median(mine['score'])) if len(mine['score']) else 7.0
    score = g[view['targets']['title']] + offset
    score = np.where(np.isfinite(score), score, median)
    return {'rank': score, 'score': score, 'p_low': None}


def predict(view):
    others, mine = view['others']['ratings'], view['me']['ratings']
    if len(others['score']) == 0:                            # no other member has rated yet (--others before)
        return public(view)
    rows = universe(view)
    x = features(view, rows)
    at = (lambda title: np.searchsorted(rows, title))
    try:
        with np.errstate(all='ignore'):
            t, mu, sig, s2 = fit_pool(x, others['member'], at(others['title']), others['score'].astype(float))
            tr, te = at(mine['title']), at(view['targets']['title'])
            y = mine['score'].astype(float)
            si = np.linalg.inv(sig)
            c = np.linalg.inv(si + t[tr].T @ t[tr] / s2) @ (si @ mu + t[tr].T @ y / s2)
            p = t[te] @ c
            if OWN > 0 and len(y) >= 3:                      # personal weights on every column, shrunk to zero
                r = y - t[tr] @ c
                a = x[tr]
                if len(y) < x.shape[1]:
                    p = p + x[te] @ (a.T @ np.linalg.solve(a @ a.T + OWN * np.eye(len(y)), r))
                else:
                    p = p + x[te] @ np.linalg.solve(a.T @ a + OWN * np.eye(x.shape[1]), a.T @ r)
    except np.linalg.LinAlgError:
        return public(view)
    if not np.isfinite(p).all():                             # too few others for the fit to exist
        return public(view)
    return {'rank': p, 'score': np.clip(p, 1, 10), 'p_low': None}
