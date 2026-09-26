"""Match percentage calibration on a typical Discover page. Local only."""
import json, pickle
import numpy as np
from common import *

cache = pickle.load(open('users.pkl', 'rb'))
REF = np.nonzero((VOTES >= 1000) & POSTER)[0]                      # reference pool, ~58k titles
DISCOVER = REF[np.argsort(-POP[REF])][:120]                        # first three Discover pages of 40, by popularity
SCHEME, WISH = 'qform_w_wish', 0.5
QS = np.linspace(0, 100, 101)
rng = np.random.default_rng(3)


def buckets(x, edges):
    h = np.histogram(x, bins=edges)[0]
    return [int(v) for v in h]


out = {'discover_titles': int(len(DISCOVER)), 'reference_pool': int(len(REF)), 'users': {}}
summary_rows = []
heldout_pct = {'liked': [], 'disliked': [], 'loved': []}
for uid, (ratings, wishlist, _, _) in cache.items():
    t = taste_vector(ratings, wishlist, SCHEME, wish_w=WISH)
    ref = cos_scores(t, REF)
    quant = np.percentile(ref, QS)                                  # 101-point table stored with the vector
    d = cos_scores(t, DISCOVER)
    pct = np.interp(d, quant, QS)
    z = (d - ref.mean()) / ref.std()
    zmap = np.clip(50 + 20 * z, 1, 99)
    row = {'user': uid[:8], 'ratings': len(ratings),
           'ref_cos_p5_p50_p95': [round(float(x), 3) for x in np.percentile(ref, [5, 50, 95])],
           'discover_raw_display': [int(x) for x in np.percentile(np.minimum(np.round(d * 100), 99), [5, 25, 50, 75, 95])],
           'discover_percentile': [int(x) for x in np.percentile(pct, [5, 25, 50, 75, 95])],
           'discover_z': [int(x) for x in np.percentile(zmap, [5, 25, 50, 75, 95])],
           'discover_percentile_buckets_0_20_40_60_80_90_100': buckets(pct, [0, 20, 40, 60, 80, 90, 100.01]),
           'discover_raw_buckets_0_80_85_90_95_100': buckets(d * 100, [0, 80, 85, 90, 95, 100.01])}
    out['users'][uid[:8]] = row
    summary_rows.append(row)
    # Held-out check: build from 80 % of ratings, map the other 20 % through the same percentile table.
    rs = [r for r in ratings if pid(r['media_type'], r['tmdb_id']) in INDEX]
    mask = rng.random(len(rs)) < 0.8
    train = [r for r, m in zip(rs, mask) if m]
    test = [r for r, m in zip(rs, mask) if not m]
    t2 = taste_vector(train, wishlist, SCHEME, wish_w=WISH)
    q2 = np.percentile(cos_scores(t2, REF), QS)
    for r in test:
        p = float(np.interp(cos_scores(t2, [INDEX[pid(r['media_type'], r['tmdb_id'])]])[0], q2, QS))
        heldout_pct['liked' if r['score'] >= 6 else 'disliked'].append(p)
        if r['score'] >= 9:
            heldout_pct['loved'].append(p)
out['heldout_percentile'] = {k: {'n': len(v), 'p25': round(float(np.percentile(v, 25))), 'median': round(float(np.median(v))),
                                 'p75': round(float(np.percentile(v, 75))), 'share_at_or_above_80': round(float(np.mean(np.array(v) >= 80)), 2),
                                 'share_below_40': round(float(np.mean(np.array(v) < 40)), 2)}
                             for k, v in heldout_pct.items()}
# Pooled raw cosine on the Discover page across all users.
allraw = np.concatenate([cos_scores(taste_vector(r, w, SCHEME, wish_w=WISH), DISCOVER) for r, w, _, _ in cache.values()])
out['pooled_discover_raw_cos'] = [round(float(x), 3) for x in np.percentile(allraw, [1, 5, 25, 50, 75, 95, 99])]
json.dump(out, open('calibration.json', 'w'), indent=1)
for r in summary_rows:
    print(r['user'], r['ratings'], 'ref', r['ref_cos_p5_p50_p95'], 'raw', r['discover_raw_display'], 'pct', r['discover_percentile'],
          'z', r['discover_z'], 'pbk', r['discover_percentile_buckets_0_20_40_60_80_90_100'])
print(json.dumps(out['heldout_percentile']))
print('pooled raw', out['pooled_discover_raw_cos'])

# Proposed display mapping: 50 + 0.49 * percentile, pooled over users on the Discover page.
disp = []
for uid, (ratings, wishlist, _, _) in cache.items():
    t = taste_vector(ratings, wishlist, SCHEME, wish_w=WISH)
    quant = np.percentile(cos_scores(t, REF), QS)
    disp.append(np.round(50 + 0.49 * np.interp(cos_scores(t, DISCOVER), quant, QS)))
disp = np.concatenate(disp)
tiers = {'90_99': float(np.mean(disp >= 90)), '75_89': float(np.mean((disp >= 75) & (disp < 90))),
         '60_74': float(np.mean((disp >= 60) & (disp < 75))), '50_59': float(np.mean(disp < 60))}
print('display tiers', {k: round(v, 2) for k, v in tiers.items()}, 'quantiles', np.percentile(disp, [5, 25, 50, 75, 95]))
for k, v in heldout_pct.items():
    v = np.array(v)
    print('heldout', k, 'display>=90', round(float(np.mean(v >= 81.7)), 2), 'display<60', round(float(np.mean(v < 20.5)), 2))
out['display_tiers_pooled'] = tiers
json.dump(out, open('calibration.json', 'w'), indent=1)
