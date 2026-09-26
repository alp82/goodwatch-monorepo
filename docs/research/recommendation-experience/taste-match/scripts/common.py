import numpy as np
from gw import sql

cat = np.load('catalog.npz')
IDS = cat['ids']
RAW = cat['raw'].astype(np.float32)
NORM = RAW / np.maximum(np.linalg.norm(RAW, axis=1, keepdims=True), 1e-9)
INDEX = {int(i): k for k, i in enumerate(IDS)}
TMDB = IDS % 1_000_000_000_000
POP, VOTES, SCORE, POSTER, BACKDROP = cat['pop'], cat['votes'], cat['score'], cat['poster'], cat['backdrop']
MEAN = NORM.mean(axis=0)

USERS = ['3a8e67d6', 'fdf4a92a', '0765b834', 'a632ceed', 'bd2113e9', '04c96753', 'bef6a8e5', '0220a501',
         'f9d6f839', 'ee55b0fc', '2774c415', '4d220087', '79f97995', 'f753f88e', 'c427eb6f', '258a211d',
         'ed871d10', '68c64873', 'a0a7e235', '8473d80e']


def full_user_ids():
    rows = sql('select distinct user_id from user_score')
    out = {}
    for r in rows:
        for p in USERS:
            if r['user_id'].startswith(p):
                out[p] = r['user_id']
    return [out[p] for p in USERS]


def pid(mt, t):
    return (1_000_000_000_000 if mt == 'movie' else 2_000_000_000_000) + int(t)


def user_data(uid):
    """Ratings and wishlist, limited to titles with essence tags like production."""
    def q(table, extra=''):
        return sql(f"""
            SELECT u.tmdb_id, u.media_type{extra} FROM {table} u INNER JOIN movie m ON u.tmdb_id = m.tmdb_id
            WHERE u.user_id = ? AND u.media_type = 'movie' AND m.essence_tags IS NOT NULL
            UNION ALL
            SELECT u.tmdb_id, u.media_type{extra} FROM {table} u INNER JOIN show s ON u.tmdb_id = s.tmdb_id
            WHERE u.user_id = ? AND u.media_type = 'show' AND s.essence_tags IS NOT NULL
            LIMIT 10000""", [uid, uid])
    ratings = q('user_score', ', u.score, u.updated_at')
    wishlist = q('user_wishlist')
    skipped = q('user_skipped')
    watched = q('user_watch_history')
    return ratings, wishlist, skipped, watched


def taste_vector(ratings, wishlist, scheme, wish_w=1.0):
    """Return an unnormalized taste vector in the normalized fingerprint space, or None."""
    def vec(r):
        k = INDEX.get(pid(r['media_type'], r['tmdb_id']))
        return None if k is None else NORM[k]
    if scheme == 'qdrant_avg':
        pos = sorted([r for r in ratings if r['score'] >= 6], key=lambda r: (-r['score'], -(r['updated_at'] or 0)))[:50]
        neg = sorted([r for r in ratings if r['score'] <= 5], key=lambda r: (r['score'], -(r['updated_at'] or 0)))[:50]
        P = [v for v in map(vec, pos) if v is not None]
        N = [v for v in map(vec, neg) if v is not None]
        if not P:
            return None
        p = np.mean(P, axis=0)
        return p + (p - np.mean(N, axis=0)) if N else p
    if scheme.startswith('qform'):
        # Qdrant's average_vector form (2 * positive mean - negative mean) over all ratings,
        # optionally score weighted and with Want to See as a weak positive.
        weighted = '_w' in scheme
        P, PW, N, NW = [], [], [], []
        for r in ratings:
            v = vec(r)
            if v is None:
                continue
            if r['score'] >= 6:
                P.append(v); PW.append(r['score'] - 5 if weighted else 1.0)
            else:
                N.append(v); NW.append(6 - r['score'] if weighted else 1.0)
        if scheme.endswith('_wish'):
            for r in wishlist:
                v = vec(r)
                if v is not None:
                    P.append(v); PW.append(wish_w)
        if not P:
            return None
        p = np.average(P, axis=0, weights=PW)
        return p + (p - np.average(N, axis=0, weights=NW)) if N else p
    if scheme == 'mean_diff':
        P = [v for r in ratings if r['score'] >= 6 and (v := vec(r)) is not None]
        N = [v for r in ratings if r['score'] <= 5 and (v := vec(r)) is not None]
        if not P:
            return None
        return np.mean(P, axis=0) - (np.mean(N, axis=0) if N else 0)
    # score weighted, optionally with wishlist and optional centering
    acc = np.zeros(NORM.shape[1], dtype=np.float64)
    wsum = 0.0
    center = scheme.endswith('_centered')
    for r in ratings:
        v = vec(r)
        if v is None:
            continue
        w = r['score'] - 5.5
        acc += w * ((v - MEAN) if center else v)
        wsum += abs(w)
    if scheme.startswith('weighted_wish'):
        for r in wishlist:
            v = vec(r)
            if v is None:
                continue
            acc += wish_w * ((v - MEAN) if center else v)
            wsum += wish_w
    if wsum == 0:
        return None
    return acc / wsum


def cos_scores(t, idx, centered=False):
    X = NORM[idx]
    if centered:
        X = X - MEAN
        X = X / np.linalg.norm(X, axis=1, keepdims=True)
    return X @ (t / np.linalg.norm(t))
