"""Rank-scale control: rung B2 with a constant added to every rank of a view, the number of ratings the view shows.
The order inside each view is B2's; the scale differs from view to view. The harness must not let this pass as a
second B2 with another error: it fails the contract check (rank outside 0..1 without a score).

Everything between the two markers is copied from ladder/b2_taste_today.py; a test requires it to be identical.
"""
import numpy as np

STANDARDIZE = False

# ---- copied from b2_taste_today.py ----
MIN_LIKED = 5
LIKED_FROM = 6
WANT_TO_SEE_WEIGHT = 0.5
MISSING = 255
NO_ORDER = 0.5
POOL_CHUNK = 4096


_POOL = {}


def pool_statistics(titles):
    """Mean and standard deviation of each attribute over the reference pool, missing scores left out."""
    if not _POOL:
        pool = titles['fingerprint'][titles['in_pool'] & titles['has_fingerprint']]
        seen = pool != MISSING
        known = np.where(seen, pool, 0)
        count = np.maximum(seen.sum(0), 1)
        mean = known.sum(0, dtype=np.int64) / count
        squares = (known.astype(np.uint16) ** 2).sum(0, dtype=np.int64) / count
        sd = np.sqrt(np.maximum(squares - mean ** 2, 0))
        _POOL['mean'], _POOL['sd'] = mean, np.where(sd > 0, sd, 1.0)
    return _POOL['mean'], _POOL['sd']


def vectors(view, rows):
    """The fingerprints of the given title rows as the formula sees them, and which of them are usable."""
    titles = view['titles']
    fp = titles['fingerprint'][rows]
    known = fp != MISSING
    v = np.where(known, fp, 0).astype(np.float64)
    if STANDARDIZE:
        mean, sd = pool_statistics(titles)
        v = np.where(known, (v - mean) / sd, 0.0)
    squares = (v * v).sum(1)
    return v, squares, titles['has_fingerprint'][rows] & (squares > 0)


def taste_vector(view):
    """The unit-length taste as float32, or None below MIN_LIKED liked titles."""
    ratings = view['me']['ratings']
    want = view['me']['want_to_see']['title']
    rows = np.concatenate([ratings['title'], want])
    v, squares, usable = vectors(view, rows)
    k = v.shape[1]
    positive, negative = np.zeros(k), np.zeros(k)
    positive_weight = negative_weight = 0.0
    liked = 0
    rated = set(ratings['title'].tolist())
    for i, score in enumerate(ratings['score'].tolist()):
        if not usable[i]:
            continue
        if score >= LIKED_FROM:
            weight = score - 5
            positive += weight / np.sqrt(squares[i]) * v[i]
            positive_weight += weight
            liked += 1
        else:
            weight = 6 - score
            negative += weight / np.sqrt(squares[i]) * v[i]
            negative_weight += weight
    for j, row in enumerate(want.tolist()):
        i = len(ratings['title']) + j
        if row in rated or not usable[i]:
            continue
        positive += WANT_TO_SEE_WEIGHT / np.sqrt(squares[i]) * v[i]
        positive_weight += WANT_TO_SEE_WEIGHT
    if liked < MIN_LIKED:
        return None
    taste = 2 * positive / positive_weight - negative / negative_weight if negative_weight > 0 \
        else positive / positive_weight
    norm = np.sqrt((taste * taste).sum())
    if norm == 0:
        return None
    return (taste / norm).astype(np.float32)


def cosines(view, rows, taste):
    """poolCosines: the dot product in double precision times the single-precision inverse norm, kept as float32."""
    v, squares, usable = vectors(view, rows)
    inverse = np.zeros(len(rows), np.float32)
    inverse[usable] = (1 / np.sqrt(squares[usable])).astype(np.float32)
    return ((v @ taste.astype(np.float64)) * inverse.astype(np.float64)).astype(np.float32), usable


def pool_percentile(view, cosine, taste):
    """Where a cosine stands among the cosines of the reference pool (in the pool and with a usable fingerprint)
    with the same taste: the share of the pool below it, a tie counting a half. 0..1."""
    titles = view['titles']
    rows = np.flatnonzero(titles['in_pool'] & titles['has_fingerprint'])
    parts = []
    for a in range(0, len(rows), POOL_CHUNK):          # in chunks: the same numbers, less memory at once
        part, usable = cosines(view, rows[a:a + POOL_CHUNK], taste)
        parts.append(part[usable].astype(np.float64))
    pool = np.sort(np.concatenate(parts)) if parts else np.zeros(0)
    if len(pool) == 0:
        return np.full(len(cosine), NO_ORDER)
    below, upto = np.searchsorted(pool, cosine, 'left'), np.searchsorted(pool, cosine, 'right')
    return (below + upto) / (2.0 * len(pool))


def predict(view):
    rows = view['targets']['title']
    taste = taste_vector(view)
    if taste is None:
        return {'rank': np.full(len(rows), NO_ORDER), 'score': None, 'p_low': None}
    cosine, usable = cosines(view, rows, taste)
    rank = pool_percentile(view, cosine.astype(np.float64), taste)
# ---- end of the copy ----
    rank[~usable] = np.median(rank[usable]) if usable.any() else NO_ORDER
    return {'rank': rank + len(view['me']['ratings']['score']), 'score': None, 'p_low': None}
