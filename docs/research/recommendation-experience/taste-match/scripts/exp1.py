"""Compare stored taste vector rankings against the production recommend call (one Qdrant call per user)."""
import json, pickle
import numpy as np
from scipy.stats import spearmanr
from gw import qpost
from common import *

uids = full_user_ids()
SCHEMES = [('qdrant_avg', 1.0), ('qform', 1.0), ('qform_w', 1.0), ('qform_w_wish', 0.5), ('mean_diff', 1.0), ('weighted', 1.0), ('weighted_wish', 1.0), ('weighted_wish_centered', 1.0)]
pool_base = (VOTES >= 50000) & (SCORE >= 60) & POSTER & BACKDROP
out = []
cache = {}
for uid in uids:
    ratings, wishlist, skipped, watched = user_data(uid)
    cache[uid] = (ratings, wishlist, skipped, watched)
    excl_tmdb = {r['tmdb_id'] for r in ratings + wishlist + skipped + watched}
    pos = sorted([r for r in ratings if r['score'] >= 6], key=lambda r: (-r['score'], -(r['updated_at'] or 0)))[:50]
    neg = sorted([r for r in ratings if r['score'] <= 5], key=lambda r: (r['score'], -(r['updated_at'] or 0)))[:50]
    pos_ids = [pid(r['media_type'], r['tmdb_id']) for r in pos]
    neg_ids = [pid(r['media_type'], r['tmdb_id']) for r in neg]
    pv = [NORM[INDEX[i]].tolist() for i in pos_ids if i in INDEX]
    nv = [NORM[INDEX[i]].tolist() for i in neg_ids if i in INDEX]
    must_not = [{'is_empty': {'key': 'poster_path'}}, {'is_empty': {'key': 'backdrop_path'}},
                {'has_id': list(set(pos_ids + neg_ids))}] + [{'key': 'tmdb_id', 'match': {'value': t}} for t in excl_tmdb]
    body = {'positive': pv, 'negative': nv, 'using': 'fingerprint_v1', 'strategy': 'average_vector',
            'filter': {'must': [{'key': 'goodwatch_overall_score_voting_count', 'range': {'gte': 50000}},
                                {'key': 'goodwatch_overall_score_normalized_percent', 'range': {'gte': 60}}],
                       'must_not': must_not},
            'limit': 50, 'params': {'hnsw_ef': 128, 'exact': False}, 'with_payload': False}
    prod = qpost('/collections/media_fingerprint_v1/points/recommend', body, sleep=1.0)
    prod_ids = [p['id'] for p in prod]
    prod_scores = [p['score'] for p in prod]
    pool = pool_base & ~np.isin(TMDB, list(excl_tmdb))
    idx = np.nonzero(pool)[0]
    row = {'user': uid[:8], 'ratings': len(ratings), 'liked': sum(r['score'] >= 6 for r in ratings),
           'disliked': sum(r['score'] <= 5 for r in ratings), 'wishlist': len(wishlist), 'pool': len(idx),
           'prod_n': len(prod_ids), 'prod_missing_local': sum(i not in INDEX for i in prod_ids)}
    row['prod_ids'] = prod_ids
    row['prod_scores'] = prod_scores
    for s, w in SCHEMES:
        t = taste_vector(ratings, wishlist, s, wish_w=w)
        sc = cos_scores(t, idx, centered=s.endswith('_centered'))
        order = np.argsort(-sc)
        top = [int(IDS[idx[k]]) for k in order[:50]]
        rank = {int(IDS[idx[k]]): r for r, k in enumerate(order)}
        row[f'{s}_overlap50'] = len(set(top) & set(prod_ids)) / max(len(prod_ids), 1)
        rks = [rank.get(i, len(order)) for i in prod_ids]
        row[f'{s}_spearman'] = float(spearmanr(range(len(prod_ids)), rks).statistic) if len(prod_ids) > 2 else None
        row[f'{s}_median_rank_of_prod'] = float(np.median(rks))
        if s == 'qdrant_avg':
            # Score agreement: local cosine for the prod ids against Qdrant's returned scores.
            local = {int(IDS[idx[k]]): float(sc[k]) for k in range(len(idx))}
            diffs = [abs(local[i] - s2) for i, s2 in zip(prod_ids, prod_scores) if i in local]
            row['qdrant_avg_max_score_diff'] = max(diffs) if diffs else None
    out.append(row)
    print({k: (round(v, 3) if isinstance(v, float) else v) for k, v in row.items() if 'overlap' in k or k == 'user'})
pickle.dump(cache, open('users.pkl', 'wb'))
json.dump(out, open('exp1.json', 'w'), indent=1)
