"""Load every fingerprinted title and one member's signals from production Crate (read only) into local files."""
import re, json, pickle, time
import numpy as np
from gw import sql, pid
src = open('/home/alper/projects/goodwatch-monorepo/goodwatch-webapp/app/server/utils/fingerprint.ts').read()
block = src.split('VALID_FINGERPRINT_KEYS')[1].split(']')[1] if False else src[src.index('VALID_FINGERPRINT_KEYS: readonly'):]
block = block[block.index('= [')+3:block.index(']', block.index('= ['))]
ORDER = re.findall(r'"([a-z_]+)"', block)
print(len(ORDER), 'keys')
ids, raw, meta = [], [], []
t0 = time.time()
for table, mt, votes_min in (('movie', 'movie', 0), ('show', 'show', 0)):
    last = -1
    while True:
        rows = sql(f"""SELECT tmdb_id, title, release_year, genres, fingerprint_scores, original_language_code l,
                origin_country_codes oc, goodwatch_overall_score_voting_count v,
                goodwatch_overall_score_normalized_percent s, poster_path
            FROM {table} WHERE fingerprint_scores IS NOT NULL AND tmdb_id > ? ORDER BY tmdb_id LIMIT 10000""", [last])
        if not rows: break
        for r in rows:
            fs = r['fingerprint_scores']
            if not fs or any(fs.get(k) is None for k in ORDER): continue
            ids.append(pid(mt, r['tmdb_id'])); raw.append([fs[k] for k in ORDER])
            meta.append((mt, r['tmdb_id'], r['title'], r['release_year'], r['genres'] or [], r['l'], r['oc'] or [], r['v'] or 0, r['s'] or 0, r['poster_path']))
        last = rows[-1]['tmdb_id']
        print(table, len(ids), round(time.time()-t0), flush=True)
np.savez_compressed('catalog.npz', ids=np.array(ids, dtype=np.int64), raw=np.array(raw, dtype=np.uint8))
pickle.dump({'order': ORDER, 'meta': meta}, open('meta.pkl', 'wb'))
U = '3a8e67d6-627b-47c3-a54f-9b873079e4a4'
user = {
 'ratings': sql("select tmdb_id, media_type, score, updated_at from user_score where user_id=? limit 10000", [U]),
 'wishlist': sql("select tmdb_id, media_type from user_wishlist where user_id=? limit 10000", [U]),
 'skipped': sql("select tmdb_id, media_type from user_skipped where user_id=? limit 10000", [U]),
 'not_interested': sql("select tmdb_id, media_type from user_not_interested where user_id=? limit 10000", [U]),
 'watch_state': sql("select tmdb_id, media_type, state from user_watch_state where user_id=? limit 10000", [U]),
}
print({k: len(v) for k, v in user.items()})
pickle.dump(user, open('user.pkl', 'wb'))
