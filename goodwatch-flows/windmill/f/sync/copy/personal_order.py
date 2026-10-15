"""Offline Personal order components for selected eligible members; request composition is pure.

Only main() opens connectors. run() publishes gzip JSON to personal-order:v1:<member>, with an expiry.
Predictor math below has only the documented label substitutions; clear their pool cache for each new title dataset.
"""
# extra_requirements:
# numpy==2.5.3
# redis==5.2.1

# Source and reversible label mapping: docs/research/personal-order-source-mapping.json
# Source SHA-256: e864bd47ced025f9641fdbfe041e3b7bd5717dac77f8d8d67cf26c9705feebd1
MODEL_HASH = "e864bd47ced025f9641fdbfe041e3b7bd5717dac77f8d8d67cf26c9705feebd1"

# Cap BLAS before the copied code first imports numpy.
import os
for _thread_env in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
    os.environ[_thread_env] = "2"

# BEGIN COPIED POOLED RATING
"""Pooled rating predictor: the pooled predictor. The frozen leader of the first loop.

A port of `pool.pooled_predict` from docs/research/taste-prediction/lab/agents/pooled/pool.py as the first loop's
`preds.pooled` called it: k=0 (no taste axes), personal weights on (own=300), no trees. It is pooled consensus plus one step: what
the consensus, the member's offset and the member's slope leave unexplained is fitted by the member's own weights
on every title column, shrunk to zero (ridge penalty 300), from 3 ratings on. Logic unchanged; see the research consensus source
for the model, the columns and the declared differences. tests/test_ladder.py runs the original and this file on
the same data and requires the same numbers.

Fallback, declared: when no other member has rated anything in the view (with `--others before`, every block of
the first member to rate), or when the others are too few for the fit to give finite numbers, the answer is rung
public score with member offset's: the GoodWatch score plus the member's shrunk offset.

score   the prediction clipped to 1..10, as the original returns it
rank    the prediction before clipping
"""
import numpy as np

OWN = 300.0

# ---- the lines below are the same in the research consensus source and the research pooled rating predictor ----
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
    """Rung public score with member offset's behaviour, for a view in which the others hold nothing to learn from: the GoodWatch score plus the
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


def pooled_rating_predict(view):
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

# END COPIED POOLED RATING

# BEGIN COPIED OWN TASTE
"""Standardized own taste: today's taste on fingerprints standardized against the reference pool. The first challenger.

Each of the 74 attributes is standardized against its mean and standard deviation over the reference pool (titles
with a poster, a GoodWatch score, 1,000 or more votes and a fingerprint); a missing score counts as the pool mean.
Then the formula of unstandardized own taste, unchanged: unit-length vectors, P and N, 2P - N, at least 5 liked titles, the cosine, and as
rank the percentile of that cosine among the reference pool's (0..1, the same scale in every view of a member).
The same declared fallbacks as unstandardized own taste. No score: the harness calibrates one from the member's history.
"""
import numpy as np

STANDARDIZE = True

# ---- the lines below are the same in the research unstandardized taste model and the research standardized own taste model ----
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


def own_taste_predict(view):
    rows = view['targets']['title']
    taste = taste_vector(view)
    if taste is None:
        return {'rank': np.full(len(rows), NO_ORDER), 'score': None, 'p_low': None}
    cosine, usable = cosines(view, rows, taste)
    rank = pool_percentile(view, cosine.astype(np.float64), taste)
    rank[~usable] = np.median(rank[usable]) if usable.any() else NO_ORDER
    return {'rank': rank, 'score': None, 'p_low': None}

# END COPIED OWN TASTE


# ---- Product adapters (the copied calculations above stay unchanged) --------------

import gzip
import json
import time
from datetime import datetime, timezone

PAGE_SIZE = 2000
TTL_SECONDS = 48 * 3600
POOL_RULE = ("poster_path IS NOT NULL AND goodwatch_overall_score_normalized_percent IS NOT NULL"
             " AND goodwatch_overall_score_voting_count >= 1000")
TABLES = {"ratings": "user_score", "want_to_see": "user_wishlist",
          "skip": "user_skipped", "not_interested": "user_not_interested"}
FLOAT_COLUMNS = FACTS[:-1]
INT_COLUMNS = ("release_year", "goodwatch_overall_score_voting_count", "movie_series_id")


def build_titles(records, fingerprint_keys, touched_keys=()):
    """Pool plus touched titles, including placeholders for deleted touched titles.

    Records use the research pull's names and values, with has_poster from IS NOT NULL.
    Fingerprint conversion deliberately uses int(), as pull.py does, without rounding.
    Only columns read by Personal order are built, with the harness's dtypes and missing sentinels.
    """
    store = {int(r["key"]): r for r in records}
    keys = np.array(sorted(set(store) | set(touched_keys)), np.int64)
    info = [store.get(int(k), {}) for k in keys]
    fingerprint = np.array([
        [MISSING if r.get("fingerprint_scores", {}).get(k) is None
         else int(r["fingerprint_scores"][k]) for k in fingerprint_keys] for r in info
    ], np.uint8).reshape(len(keys), len(fingerprint_keys))
    num = {c: np.array([np.nan if r.get(c) is None else r[c] for r in info], np.float64)
           for c in FLOAT_COLUMNS}
    num.update({c: np.array([-1 if r.get(c) is None else r[c] for r in info], np.int64)
                for c in INT_COLUMNS})
    titles = {"key": keys, "media_type": (keys // 10**12 - 1).astype(np.uint8),
              "fingerprint": fingerprint, "fingerprint_keys": list(fingerprint_keys), "num": num,
              "has_fingerprint": (fingerprint != MISSING).any(1)}
    titles["in_pool"] = (np.array([bool(r.get("has_poster")) for r in info], bool)
                         & ~np.isnan(num["goodwatch_overall_score_normalized_percent"])
                         & (num["goodwatch_overall_score_voting_count"] >= 1000))
    names = sorted({g for r in info for g in r.get("genres") or ()})
    at = {g: j for j, g in enumerate(names)}
    genres = np.zeros((len(keys), len(names)), bool)
    for i, r in enumerate(info):
        for g in r.get("genres") or ():
            genres[i, at[g]] = True
    titles.update(genres=genres, genre_names=names)
    for column, name in (("original_language_code", "language"), ("production_method", "production_method")):
        vocab = sorted({r[column] for r in info if r.get(column)})
        at = {v: i for i, v in enumerate(vocab)}
        titles[name] = np.array([at[r[column]] if r.get(column) else -1 for r in info], np.int16)
        titles[name + "_names"] = vocab
    return titles


def build_view(titles, tables, member, candidates=None):
    """The arrays Personal order reads: every own rating visible, every unrated pool title a target.

    Tables are column arrays in entry order: member (int32), title_key (int64), and
    ratings.score (int8). Side rows naming no title are dropped as views._tables does.
    Optional candidates supplies the harness's shuffled target order for parity only.
    """
    view = {"titles": titles, "me": {}, "others": {}, "targets": {}}
    keys = titles["key"]
    for name in TABLES:
        table = tables[name]
        rows = np.searchsorted(keys, table["title_key"])
        inside = rows < len(keys)
        inside[inside] &= keys[rows[inside]] == table["title_key"][inside]
        if name == "ratings" and not inside.all():
            raise ValueError("A rated title is missing from the title universe")
        for who, mask in (("me", inside & (table["member"] == member)),
                          ("others", inside & (table["member"] != member))):
            data = {"title": rows[mask].astype(np.int32)}
            if name == "ratings":
                data["score"] = table["score"][mask].astype(np.int8)
            if who == "others":
                data["member"] = table["member"][mask].astype(np.int32)
            view[who][name] = data
    pool = titles["in_pool"] & titles["has_fingerprint"]
    unrated = pool.copy()
    unrated[view["me"]["ratings"]["title"]] = False
    rows = np.flatnonzero(unrated).astype(np.int32)
    if candidates is not None:
        candidates = np.asarray(candidates, np.int32)
        if not np.array_equal(np.sort(candidates), rows):
            raise ValueError("Candidates must be exactly the unrated reference pool")
        rows = candidates
    view["targets"]["title"] = rows
    return view


def components(view):
    """Own taste rank stored as float32; pooled rating top half uses the inclusive candidate median."""
    _POOL.clear()  # Research cache is dataset-global; a worker can load a new dataset.
    rows = view["targets"]["title"]
    own_taste_rank = own_taste_predict(view)["rank"].astype(np.float32)
    pooled_rating_rank = pooled_rating_predict(view)["rank"] if len(rows) else np.zeros(0)
    titles = view["titles"]
    names = titles["production_method_names"]
    animation = names.index("Animation") if "Animation" in names else -2
    facts = np.column_stack((titles["media_type"] == 1, titles["production_method"] == animation))
    rated = view["me"]["ratings"]["title"]
    own = facts[rated].mean(0).tolist() if len(rated) else None
    return {"pointIds": titles["key"][rows], "ownTasteRank": own_taste_rank,
            "pooledRatingTopHalf": pooled_rating_rank >= np.median(pooled_rating_rank) if len(rows) else np.zeros(0, bool),
            "movieSeriesId": titles["num"]["movie_series_id"][rows],
            "show": facts[rows, 0], "animation": facts[rows, 1], "ownShares": own}


def request_order(own_taste_rank, top_half, movie_series_id, show, animation, own_shares):
    """Pure franchise grouping and mix over a filtered list, preserving that list's order for ties.

    Returns indices into the input list, franchise groups aligned to it, and the number
    of prefix placements. The pooled rating predictor bits remain global; franchise picks are local.
    All columns must describe the same unique titles, in the caller's tie order.
    """
    own_taste_rank = np.asarray(own_taste_rank, np.float64)
    above = np.asarray(top_half, bool)
    series = np.asarray(movie_series_id, np.int64)
    kinds = np.column_stack((show, animation)).astype(np.int64)
    if any(len(c) != len(own_taste_rank) for c in (above, series, kinds)):
        raise ValueError("Component columns have different lengths")
    group = above.astype(np.int64)
    franchise = np.where(series > 0, series, -1 - np.arange(len(own_taste_rank)))
    seen = set()
    for i in np.argsort(-own_taste_rank, kind="stable"):
        if above[i] and franchise[i] not in seen:
            group[i] = 2
            seen.add(franchise[i])
    rank = 2.0 * group + own_taste_rank
    order = np.argsort(-rank, kind="stable")
    if own_shares is None or len(own_taste_rank) == 0:
        return {"order": order, "groups": group, "mixCount": 0}
    own = np.asarray(own_shares, np.float64)
    codes = 2 * kinds[:, 0] + kinds[:, 1]
    queues = [order[codes[order] == code] for code in range(4)]
    heads = [0] * 4
    counts = np.zeros(2, dtype=np.int64)
    placed = []
    for position in range(min(100, len(own_taste_rank))):
        eligible, available = [], []
        for code, queue in enumerate(queues):
            if heads[code] == len(queue):
                continue
            i = int(queue[heads[code]])
            available.append(i)
            proposed = counts + kinds[i]
            alternative = counts + (1 - kinds[i])
            distance = np.abs(proposed - own * (position + 1))
            other_distance = np.abs(alternative - own * (position + 1))
            within = distance <= 0.1 * (position + 1) + 1e-12
            closer = (position >= 10) & (distance < other_distance - 1e-12)
            if np.all(within | closer):
                eligible.append(i)
        i = min(eligible or available, key=lambda j: (-rank[j], j))
        heads[int(codes[i])] += 1
        placed.append(i)
        counts += kinds[i]
    used = np.zeros(len(own_taste_rank), dtype=bool)
    used[placed] = True
    final = np.concatenate((np.asarray(placed, dtype=np.int64), order[~used[order]]))
    return {"order": final, "groups": group, "mixCount": len(placed)}


def payload(view, snapshot_version, built_at):
    data = components(view)
    order = np.argsort(data["pointIds"], kind="stable")
    result = {name: values[order].tolist() for name, values in data.items() if name != "ownShares"}
    others = np.concatenate([view["others"][name]["member"] for name in TABLES])
    return {**result, "ownShares": data["ownShares"], "format": 1,
            "modelHash": MODEL_HASH, "snapshotVersion": snapshot_version,
            "othersCount": len(np.unique(others)), "othersRatingsCount": len(view["others"]["ratings"]["title"]),
            "builtAt": built_at.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")}


def read_members(select):
    """Read only the four Personal order member tables, paging by their primary key."""
    raw = {}
    for name, table in TABLES.items():
        records, last = [], None
        while True:
            where, args = "", []
            if last is not None:
                where = (" WHERE user_id > ? OR (user_id = ? AND tmdb_id > ?)"
                         " OR (user_id = ? AND tmdb_id = ? AND media_type > ?)")
                user, tmdb, media = last
                args = [user, user, tmdb, user, tmdb, media]
            cols = "user_id, tmdb_id, media_type, created_at, updated_at" + (", score" if name == "ratings" else "")
            page = select(f"SELECT {cols} FROM {table}{where} ORDER BY user_id, tmdb_id, media_type LIMIT {PAGE_SIZE}", args)
            records.extend(page)
            if len(page) < PAGE_SIZE:
                break
            last = page[-1][:3]
        raw[name] = records
    ids = sorted({r[0] for records in raw.values() for r in records})
    member_at = {member: i for i, member in enumerate(ids)}
    tables = {}
    for name, records in raw.items():
        def key(r):
            return ((1 if r[2] == "movie" else 2) * 10**12 + int(r[1])
                    if r[2] in ("movie", "show") and r[1] is not None else 0)
        records.sort(key=lambda r: (r[0], r[3] if r[3] is not None else -2**63,
                                   r[4] if r[4] is not None else -2**63, key(r)))
        data = {"member": np.array([member_at[r[0]] for r in records], np.int32),
                "title_key": np.array([key(r) for r in records], np.int64)}
        if name == "ratings":
            if any(key(r) == 0 or r[5] is None or not 1 <= r[5] <= 10 for r in records):
                raise ValueError("Invalid rating in user_score")
            data["score"] = np.array([r[5] for r in records], np.int8)
        tables[name] = data
    return tables, member_at


def read_titles(select, tables, fingerprint_keys):
    """Reference pool plus four-table touched titles, using narrow typed columns."""
    touched = set(int(k) for t in tables.values() for k in t["title_key"] if k > 0)
    records = []
    for media, base in (("movie", 10**12), ("show", 2 * 10**12)):
        columns = ["tmdb_id", "(poster_path IS NOT NULL) AS has_poster"]
        columns += [f"fingerprint_scores['{k}']" for k in fingerprint_keys]
        columns += list(FLOAT_COLUMNS) + list(INT_COLUMNS[:-1])
        columns += ["movie_series_id" if media == "movie" else "NULL AS movie_series_id",
                    "genres", "original_language_code", "production_method"]
        found = set()

        def keep(page):
            for row in page:
                key = base + int(row[0])
                found.add(key)
                n = len(fingerprint_keys)
                rest = list(FLOAT_COLUMNS) + list(INT_COLUMNS) + ["genres", "original_language_code", "production_method"]
                records.append({"key": key, "has_poster": row[1],
                                "fingerprint_scores": dict(zip(fingerprint_keys, row[2:2 + n])),
                                **dict(zip(rest, row[2 + n:]))})

        last = -1
        while True:
            page = select(f"SELECT {', '.join(columns)} FROM {media} WHERE {POOL_RULE}"
                          f" AND tmdb_id > ? ORDER BY tmdb_id LIMIT {PAGE_SIZE}", [last])
            keep(page)
            if len(page) < PAGE_SIZE:
                break
            last = page[-1][0]
        missing = sorted(k - base for k in touched - found if k // 10**12 == base // 10**12)
        for start in range(0, len(missing), 500):
            keep(select(f"SELECT {', '.join(columns)} FROM {media} WHERE tmdb_id = ANY(?) ORDER BY tmdb_id",
                        [missing[start:start + 500]]))
    return build_titles(records, fingerprint_keys, touched)


def main_defaults(ttl_seconds, dry_run):
    """A missing TTL takes the default; a missing dry_run means a dry run, never a publish."""
    return (TTL_SECONDS if ttl_seconds is None else ttl_seconds,
            True if dry_run is None else dry_run)


def validate_members(member_ids):
    from f.sync.copy.personal_order_trigger import validate_members as validate
    if member_ids != "all":
        validate(member_ids)


class SnapshotChanged(RuntimeError):
    pass


def run(redis, select, member_ids, fingerprint_keys, *, ttl_seconds=TTL_SECONDS,
        dry_run=True, dirty_only=False, now=None):
    from f.sync.copy.personal_order_trigger import DIRTY_KEY
    ttl_seconds, dry_run = main_defaults(ttl_seconds, dry_run)
    validate_members(member_ids)
    if not isinstance(ttl_seconds, int) or ttl_seconds <= 0:
        raise ValueError("TTL must be a positive number of seconds")
    started = time.monotonic()
    claimed = []
    try:
        selected = member_ids
        if dirty_only:
            # Retain the full raw claim so even decoding or excluded-member restoration can fail safely.
            count = redis.scard(DIRTY_KEY)
            claimed = (redis.smembers(DIRTY_KEY) if dry_run else redis.spop(DIRTY_KEY, count)) if count else []
            members = sorted(m.decode() if isinstance(m, bytes) else m for m in claimed)
            selected = members if member_ids == "all" else [m for m in members if m in member_ids]
            excluded = set(members) - set(selected)
            if excluded and not dry_run:
                redis.sadd(DIRTY_KEY, *sorted(excluded))
        if selected == []:
            return {"published": False, "members": [], "seconds": round(time.monotonic() - started, 3)}
        manifest = json.loads(redis.get("title-snapshot:current") or "null")
        if not manifest or not manifest.get("version"):
            raise ValueError("A current title snapshot is required")
        if manifest.get("keyOrder") != list(fingerprint_keys):
            raise ValueError("Snapshot fingerprint order differs from the Personal order input")
        tables, member_at = read_members(select)
        titles = read_titles(select, tables, fingerprint_keys)
        _POOL.clear()  # Eligibility must use statistics from this dataset, even in a reused worker.
        if selected == "all":
            # Include orphaned payloads after a member removes their last interaction.
            existing = [k.decode() if isinstance(k, bytes) else k
                        for k in redis.scan_iter(match="personal-order:v1:*")]
            selected = sorted(set(member_at) | {k.removeprefix("personal-order:v1:") for k in existing})
        summaries = []
        for member in selected:
            member_started = time.monotonic()
            summary = {"member": member}
            try:
                view = build_view(titles, tables, member_at.get(member, len(member_at)))
                eligible = taste_vector(view) is not None
                data = payload(view, manifest["version"], now() if now else datetime.now(timezone.utc)) if eligible else None
                current = json.loads(redis.get("title-snapshot:current") or "null")
                if not current or current.get("version") != manifest["version"]:
                    raise SnapshotChanged("Title snapshot changed during Personal order build; retry against its new version")
                if data is None:
                    if not dry_run:
                        redis.delete(f"personal-order:v1:{member}")
                    summary.update(status="ineligible", deleted=not dry_run, bytes=0)
                else:
                    encoded = gzip.compress(json.dumps(data, separators=(",", ":"), allow_nan=False).encode(), mtime=0)
                    if not dry_run:
                        redis.set(f"personal-order:v1:{member}", encoded, ex=ttl_seconds)
                    summary.update(status="built", candidates=len(data["pointIds"]), bytes=len(encoded),
                                   others_count=data["othersCount"], built_at=data["builtAt"])
            except SnapshotChanged:
                raise
            except Exception as error:
                summary.update(status="failed", error=str(error))
                if not dry_run:
                    redis.sadd(DIRTY_KEY, member)
            summary["seconds"] = round(time.monotonic() - member_started, 3)
            summaries.append(summary)
            print("Personal order member " + json.dumps(summary), flush=True)
        result = {"published": not dry_run, "members": summaries, "model_hash": MODEL_HASH,
                  "snapshot_version": manifest["version"], "seconds": round(time.monotonic() - started, 3)}
        print("Personal order summary " + json.dumps({"built": sum(s["status"] == "built" for s in summaries),
                                         "ineligible": sum(s["status"] == "ineligible" for s in summaries),
                                         "failed": sum(s["status"] == "failed" for s in summaries),
                                         "dry_run": dry_run, "seconds": result["seconds"]}), flush=True)
        return result
    except Exception:
        if claimed and not dry_run:
            redis.sadd(DIRTY_KEY, *claimed)
        raise


def main(member_ids: list[str] | str | None = None, ttl_seconds: int = TTL_SECONDS,
         dry_run: bool = True, dirty_only: bool = False):
    """Windmill only: the rollout variable authorizes all callers, including dry runs."""
    ttl_seconds, dry_run = main_defaults(ttl_seconds, dry_run)
    import wmill
    from f.sync.copy.personal_order_trigger import MEMBERS_VARIABLE, rollout_members
    configured = rollout_members(wmill.get_variable(MEMBERS_VARIABLE))
    member_ids = configured if member_ids is None else member_ids
    validate_members(member_ids)
    if configured != "all" and (member_ids == "all" or not set(member_ids).issubset(configured)):
        raise ValueError("Personal order members must belong to the configured rollout list")
    if member_ids == []:
        return {"published": False, "members": []}
    from f.db.cratedb import CrateConnector
    from f.db.redis import RedisConnector
    from f.dna.models import CoreScores

    crate = CrateConnector()
    redis = None
    try:
        redis = RedisConnector(decode_responses=False).get_redis()

        def select(sql, args):
            crate.cur.execute(sql, args)
            return crate.cur.fetchall()

        return run(redis, select, member_ids, list(CoreScores.model_fields),
                   ttl_seconds=ttl_seconds, dry_run=dry_run,
                   dirty_only=False if dirty_only is None else dirty_only)
    finally:
        crate.disconnect()
        if redis is not None:
            redis.close()
