"""One read-only pull of everything predictors may use, for every title any member rated. Splits off a locked test set."""
import pickle, requests, numpy as np
from collections import defaultdict
from sklearn.model_selection import train_test_split
from gw import sql, ENV, pid
cat = np.load('catalog.npz'); IDS = cat['ids']; RAW = cat['raw']
m = pickle.load(open('meta.pkl', 'rb')); ORDER = m['order']; META = m['meta']
CI = {int(i): k for k, i in enumerate(IDS)}
OWNER = '3a8e67d6-627b-47c3-a54f-9b873079e4a4'
def table(t, cols='tmdb_id, media_type'):
    return sql(f"select user_id, {cols} from {t} limit 100000")
scores = table('user_score', 'tmdb_id, media_type, score, updated_at')
sig = {k: table(t) for k, t in (('wishlist', 'user_wishlist'), ('skipped', 'user_skipped'), ('favorite', 'user_favorite'))}
keys = {(r['media_type'], r['tmdb_id']) for r in scores} | {(r['media_type'], r['tmdb_id']) for v in sig.values() for r in v}
keys = sorted(k for k in keys if k[0] in ('movie', 'show') and pid(*k) in CI)
TI = {k: i for i, k in enumerate(keys)}; N = len(keys); print('titles', N)
info = [None] * N
COLS = """tmdb_id, title, release_year, genres, keywords, tropes, essence_tags, essence_text, synopsis, popularity, original_language_code,
 origin_country_codes, production_company_ids, tmdb_recommendation_ids, tmdb_similar_ids, is_anime, production_method, animation_style,
 imdb_user_score_normalized_percent, imdb_user_score_rating_count, metacritic_meta_score_normalized_percent, metacritic_user_score_normalized_percent,
 rotten_tomatoes_tomato_score_normalized_percent, rotten_tomatoes_audience_score_normalized_percent, tmdb_user_score_normalized_percent,
 goodwatch_overall_score_normalized_percent, goodwatch_overall_score_voting_count, goodwatch_user_score_normalized_percent, goodwatch_official_score_normalized_percent,
 suitability_solo_watch, suitability_date_night, suitability_group_party, suitability_family, suitability_partner, suitability_friends, suitability_kids,
 suitability_teens, suitability_adults, suitability_intergenerational, suitability_public_viewing_safe, context_is_thought_provoking, context_is_pure_escapism,
 context_is_background_friendly, context_is_comfort_watch, context_is_binge_friendly, context_is_drop_in_friendly, fingerprint_highlight_keys, age_certifications"""
people = defaultdict(lambda: {'cast': [], 'crew': []})
for mt, extra in (('movie', ', runtime, movie_series_id'), ('show', '')):
    ids = [t for k, t in keys if k == mt]
    for a in range(0, len(ids), 400):
        chunk = ids[a:a + 400]
        for r in sql(f"select {COLS}{extra} from {mt} where tmdb_id = any(?) limit 1000", [chunk]):
            r['media_type'] = mt; info[TI[(mt, r['tmdb_id'])]] = r
        for r in sql("select media_tmdb_id t, person_tmdb_id p, order_default o from person_appeared_in where media_type=? and media_tmdb_id = any(?) and order_default < 10 limit 20000", [mt, chunk]):
            people[(mt, r['t'])]['cast'].append((r['o'], r['p']))
        for r in sql("select media_tmdb_id t, person_tmdb_id p, job, department d from person_worked_on where media_type=? and media_tmdb_id = any(?) and department in ('Directing','Writing','Creator','Production','Sound','Camera') and job in ('Director','Writer','Screenplay','Creator','Executive Producer','Producer','Original Music Composer','Director of Photography','Novel','Story','Series Director') limit 40000", [mt, chunk]):
            people[(mt, r['t'])]['crew'].append((r['job'], r['p']))
    print(mt, len(ids), flush=True)
for k, i in TI.items():
    info[i]['cast'] = [p for _, p in sorted(people[k]['cast'])]; info[i]['crew'] = people[k]['crew']
names = {}
pids = sorted({p for x in info for p in x['cast']} | {p for x in info for _, p in x['crew']})
try:
    for a in range(0, len(pids), 2000):
        for r in sql("select tmdb_id, name from person where tmdb_id = any(?) limit 3000", [pids[a:a + 2000]]): names[r['tmdb_id']] = r['name']
except Exception as e: print('person names skipped', repr(e)[:200])
# text embeddings from Qdrant (read only)
q = ENV['QDRANT_URL'].replace(':6334', ':6333'); h = {'api-key': ENV.get('QDRANT_API_KEY', '')}
emb = {'text_en_v1': np.zeros((N, 768), np.float32), 'text_multi_v1': np.zeros((N, 384), np.float32)}; have = np.zeros(N, bool)
P = [pid(*k) for k in keys]
for a in range(0, N, 200):
    r = requests.post(q + '/collections/media_fingerprint_v1/points', headers=h, json={'ids': P[a:a + 200], 'with_vector': list(emb), 'with_payload': False}, timeout=60)
    r.raise_for_status()
    for pt in r.json()['result']:
        i = a + P[a:a + 200].index(pt['id'])
        for v in emb:
            if pt['vector'].get(v): emb[v][i] = pt['vector'][v]; have[i] = True
print('embeddings for', int(have.sum()))
fp = np.array([RAW[CI[pid(*k)]] for k in keys], dtype=np.float32)
votes = np.array([x[7] for x in META]); pool = votes >= 1000
# ratings, with a quarter of every member's ratings locked away
rows = [(r['user_id'], TI[(r['media_type'], r['tmdb_id'])], int(r['score']), r['updated_at']) for r in scores if (r['media_type'], r['tmdb_id']) in TI]
by = defaultdict(list)
for r in rows: by[r[0]].append(r)
dev, locked = [], []
for u, rs in by.items():
    if len(rs) < 40: dev += rs; continue
    band = [0 if r[2] <= 5 else 1 if r[2] <= 7 else 2 for r in rs]
    strat = band if min(np.bincount(band, minlength=3)[np.unique(band)]) >= 4 else None
    a, b = train_test_split(rs, test_size=0.25, random_state=11, stratify=strat); dev += a; locked += b
print('ratings dev', len(dev), 'locked', len(locked), 'owner dev', sum(r[0] == OWNER for r in dev))
pack = {'owner': OWNER, 'keys': keys, 'info': info, 'person_names': names, 'fingerprint_keys': ORDER, 'fingerprint': fp,
        'pool_mean': RAW[pool].astype(np.float32).mean(0), 'pool_std': RAW[pool].astype(np.float32).std(0), 'emb': emb, 'emb_have': have,
        'ratings': dev, 'signals': {k: [(r['user_id'], TI[(r['media_type'], r['tmdb_id'])]) for r in v if (r['media_type'], r['tmdb_id']) in TI] for k, v in sig.items()}}
pickle.dump(pack, open('../lab/pack.pkl', 'wb')); pickle.dump(locked, open('locked.pkl', 'wb'))
