import pickle
from collections import defaultdict
from gw import sql
p = pickle.load(open('../lab/pack.pkl', 'rb')); keys = p['keys']; info = p['info']
TI = {k: i for i, k in enumerate(keys)}
C = ['tmdb_user_score_rating_count', 'metacritic_user_score_rating_count', 'metacritic_meta_score_review_count', 'rotten_tomatoes_audience_score_rating_count',
     'rotten_tomatoes_tomato_score_review_count', 'goodwatch_user_score_rating_count', 'goodwatch_official_score_review_count']
n = 0
for mt in ('movie', 'show'):
    ids = [t for k, t in keys if k == mt]
    for a in range(0, len(ids), 500):
        for r in sql(f"select tmdb_id, {', '.join(C)} from {mt} where tmdb_id = any(?) limit 1000", [ids[a:a + 500]]):
            info[TI[(mt, r.pop('tmdb_id'))]].update(r); n += 1
shows = [t for k, t in keys if k == 'show']; seasons = defaultdict(dict)
def add(rows, names):
    for r in rows:
        if r['season_number'] is None: continue
        s = seasons[r['show_id']].setdefault(r['season_number'], {})
        for k in names:
            if r.get(k) is not None: s[k] = r[k]
Q = [("imdb_season", "imdb_user_score_original, imdb_user_score_rating_count, imdb_rated_episode_count", ""),
     ("metacritic_season", "metacritic_meta_score_original, metacritic_meta_score_review_count, metacritic_user_score_original, metacritic_user_score_rating_count", ""),
     ("rotten_tomatoes_season", "rotten_tomatoes_tomato_score_original, rotten_tomatoes_tomato_score_review_count, rotten_tomatoes_audience_score_original, rotten_tomatoes_audience_score_rating_count", ""),
     ("season", "air_date, episode_count, vote_average", "")]
for a in range(0, len(shows), 500):
    ch = shows[a:a + 500]
    for t, cols, _ in Q:
        add(sql(f"select show_id, season_number, {cols} from {t} where show_id = any(?) limit 30000", [ch]), [c.strip() for c in cols.split(',')])
    add(sql("select show_id, season_number, avg(imdb_user_score_original) ep_mean, min(imdb_user_score_original) ep_min, max(imdb_user_score_original) ep_max, stddev(imdb_user_score_original) ep_sd, count(*) ep_n from imdb_episode where show_id = any(?) and imdb_user_score_original is not null group by show_id, season_number limit 30000", [ch]), ['ep_mean', 'ep_min', 'ep_max', 'ep_sd', 'ep_n'])
have = 0
for k, i in TI.items():
    info[i]['seasons'] = [dict(season_number=s, **v) for s, v in sorted(seasons.get(k[1], {}).items())] if k[0] == 'show' else None
    have += bool(info[i]['seasons'])
print('titles updated', n, 'shows with season data', have, 'of', len(shows)); print(info[TI[('show', 1396)]]['seasons'][:2])
import numpy as np
for c in C + ['imdb_user_score_normalized_percent', 'metacritic_meta_score_normalized_percent', 'rotten_tomatoes_tomato_score_normalized_percent', 'rotten_tomatoes_audience_score_normalized_percent', 'metacritic_user_score_normalized_percent']:
    print(c, 'present for', round(100 * np.mean([x.get(c) is not None for x in info])), '%')
pickle.dump(p, open('../lab/pack.pkl', 'wb'))
