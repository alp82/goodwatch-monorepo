from lib import *
D = Data(); X = features(D); idx, y = D.of(D.owner)
r = dict(zip(idx, y)); allrated = {}
for u, t, s, _ in D.ratings: allrated.setdefault(u, {})[t] = s
for k in ('wishlist', 'skipped', 'favorite'):
    ts = [t for u, t in D.signals[k] if u == D.owner]; ov = [r[t] for t in ts if t in r]
    print(k, len(ts), 'overlap with rated', len(ov), 'mean rating of overlap', np.mean(ov) if ov else None, np.bincount(np.array(ov, int), minlength=11) if ov else '')
# other members: do they rate skipped/wishlist titles, and how?
for k in ('wishlist', 'skipped'):
    v = [allrated[u][t] - np.mean(list(allrated[u].values())) for u, t in D.signals[k] if u != D.owner and u in allrated and t in allrated[u] and len(allrated[u]) >= 60]
    print(k, 'others: rated overlaps', len(v), 'mean rating minus member mean %.2f' % (np.mean(v) if v else 0))
us = D.users(); print('members with 60+ ratings having skipped:', sum(1 for u in us if any(a == u for a, _ in D.signals['skipped'])), 'wishlist:', sum(1 for u in us if any(a == u for a, _ in D.signals['wishlist'])))
# how does the base model score the owner's skipped/wishlist titles (trained on all owner dev ratings)?
m = gbm().fit(X[idx], y)
for k in ('wishlist', 'skipped'):
    ts = np.array([t for u, t in D.signals[k] if u == D.owner and t not in r]); p = m.predict(X[ts])
    print(k, 'unrated n', len(ts), 'model pred mean %.2f sd %.2f; everyone score mean %.1f' % (p.mean(), p.std(), np.nanmean(X[ts, 74])))
print('rated: everyone score mean %.1f ; catalog %.1f' % (np.nanmean(X[idx, 74]), np.nanmean(X[:, 74])))
