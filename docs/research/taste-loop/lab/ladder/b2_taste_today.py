"""B2: today's taste, ported from goodwatch-webapp/app/server/taste/formula.server.ts and pool.server.ts.

- Every title's fingerprint counts as a unit-length vector; a missing score (255) counts as 0.
- P is the weighted mean of the liked titles (rated 6 or more, weight score - 5) and the Want to See titles that are
  not rated (weight 0.5). N is the weighted mean of the disliked titles (rated 5 or less, weight 6 - score).
- The taste is 2P - N, or P without dislikes, at unit length, kept in single precision as the product keeps it.
- No taste below 5 liked titles with a fingerprint.
- rank is the cosine of the title's fingerprint with the taste, in single precision (poolCosines). The match the
  product shows is a rising function of that cosine, so the order is the same.

Declared fallbacks: without a taste every target gets rank 0 (no order). A target without a fingerprint gets the
median rank of the view's targets that have one (0 when none has).
No score: the harness calibrates one from the member's history.
"""
import numpy as np

STANDARDIZE = False

# ---- the lines below are the same in b2_taste_today.py and b3_taste_standardized.py ----
MIN_LIKED = 5
LIKED_FROM = 6
WANT_TO_SEE_WEIGHT = 0.5
MISSING = 255


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


def predict(view):
    rows = view['targets']['title']
    taste = taste_vector(view)
    if taste is None:
        return {'rank': np.zeros(len(rows)), 'score': None, 'p_low': None}
    cosine, usable = cosines(view, rows, taste)
    rank = cosine.astype(np.float64)
    rank[~usable] = np.median(rank[usable]) if usable.any() else 0.0
    return {'rank': rank, 'score': None, 'p_low': None}
