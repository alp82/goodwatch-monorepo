"""Five-fold holdout per user: does each taste vector rank held-out liked titles above disliked ones? Local only."""
import json, pickle
import numpy as np
from common import *

cache = pickle.load(open('users.pkl', 'rb'))
SCHEMES = [('qdrant_avg', 1.0), ('qform', 1.0), ('qform_w', 1.0), ('qform_w_wish', 0.5), ('qform_w_wish', 1.0),
           ('qform_wish', 1.0), ('mean_diff', 1.0), ('weighted', 1.0), ('weighted_wish_centered', 1.0)]
rng = np.random.default_rng(7)


def auc(pos, neg):
    if not pos or not neg:
        return None
    pos, neg = np.array(pos), np.array(neg)
    return float(((pos[:, None] > neg[None, :]).mean() + 0.5 * (pos[:, None] == neg[None, :]).mean()))


res = {f'{s}@{w}': [] for s, w in SCHEMES}
for uid, (ratings, wishlist, _, _) in cache.items():
    ratings = [r for r in ratings if pid(r['media_type'], r['tmdb_id']) in INDEX]
    if sum(r['score'] <= 5 for r in ratings) < 5:
        continue
    fold = rng.integers(0, 5, len(ratings))
    for s, w in SCHEMES:
        pos_s, neg_s = [], []
        for f in range(5):
            train = [r for r, k in zip(ratings, fold) if k != f]
            test = [r for r, k in zip(ratings, fold) if k == f]
            t = taste_vector(train, wishlist, s, wish_w=w)
            if t is None:
                continue
            idx = [INDEX[pid(r['media_type'], r['tmdb_id'])] for r in test]
            sc = cos_scores(t, idx, centered=s.endswith('_centered'))
            for r, v in zip(test, sc):
                (pos_s if r['score'] >= 6 else neg_s).append(float(v))
        res[f'{s}@{w}'].append((uid[:8], auc(pos_s, neg_s)))
summary = {}
for k, v in res.items():
    a = [x for _, x in v if x is not None]
    summary[k] = {'users': len(a), 'mean_auc': round(float(np.mean(a)), 3), 'median_auc': round(float(np.median(a)), 3),
                  'per_user': {u: round(x, 3) for u, x in v}}
    print(k, summary[k]['users'], summary[k]['mean_auc'], summary[k]['median_auc'])
json.dump(summary, open('holdout.json', 'w'), indent=1)
