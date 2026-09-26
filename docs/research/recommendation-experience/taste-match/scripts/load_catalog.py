"""Load every fingerprinted title from Crate into a local npz (read-only, paged by tmdb_id)."""
import ast, time
import numpy as np
from gw import sql, pid

ORDER = ast.literal_eval(open('order.txt').read().splitlines()[1])
ids, raw, pop, votes, score, poster, backdrop = [], [], [], [], [], [], []
t0 = time.time()
queries = 0
for table, mt in (('movie', 'movie'), ('show', 'show')):
    last = -1
    while True:
        rows = sql(f"""SELECT tmdb_id, fingerprint_scores, popularity, goodwatch_overall_score_voting_count v,
                goodwatch_overall_score_normalized_percent s, poster_path IS NOT NULL p, backdrop_path IS NOT NULL b
            FROM {table} WHERE fingerprint_scores IS NOT NULL AND tmdb_id > ? ORDER BY tmdb_id LIMIT 20000""", [last])
        queries += 1
        if not rows:
            break
        for r in rows:
            fs = r['fingerprint_scores']
            if not fs or any(fs.get(k) is None for k in ORDER):
                continue
            ids.append(pid(mt, r['tmdb_id']))
            raw.append([fs[k] for k in ORDER])
            pop.append(r['popularity'] or 0)
            votes.append(r['v'] or 0)
            score.append(r['s'] or 0)
            poster.append(bool(r['p']))
            backdrop.append(bool(r['b']))
        last = rows[-1]['tmdb_id']
elapsed = time.time() - t0
raw = np.array(raw, dtype=np.uint8)
print('rows', len(ids), 'queries', queries, 'seconds', round(elapsed, 1), 'max raw', raw.max())
np.savez_compressed('catalog.npz', ids=np.array(ids, dtype=np.int64), raw=raw, pop=np.array(pop, dtype=np.float32),
                    votes=np.array(votes, dtype=np.int64), score=np.array(score, dtype=np.float32),
                    poster=np.array(poster), backdrop=np.array(backdrop))
