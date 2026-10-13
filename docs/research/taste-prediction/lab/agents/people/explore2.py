import sys; sys.path.insert(0,'.')
from harness import Data
import numpy as np, collections
D=Data()
idx,y=D.of(D.owner)
C=collections.Counter
print(C(j for x in D.info for j,_ in (x['crew'] or [])).most_common(40))
for k in ['production_method','animation_style','original_language_code','media_type','is_anime']:
    print(k, C(D.info[i][k] for i in idx).most_common(12))
print(C(c for i in idx for c in (D.info[i]['origin_country_codes'] or [])).most_common(10))
print(C(c for i in idx for c in (D.info[i]['age_certifications'] or []) if c.startswith(('US_','DE_'))).most_common(30))
def cover(get):
    c=C(e for i in idx for e in set(get(D.info[i])))
    share=sum(1 for i in idx if any(c[e]>=2 for e in set(get(D.info[i]))))
    return len(c), sum(1 for v in c.values() if v>=2), sum(1 for v in c.values() if v>=4), share
print('cast',cover(lambda x:x['cast'] or []))
for job in ['Director','Writer','Screenplay','Creator','Producer','Executive Producer','Original Music Composer','Director of Photography']:
    print(job,cover(lambda x:[p for j,p in (x['crew'] or []) if j==job]))
print('series',cover(lambda x:[x['movie_series_id']] if x['movie_series_id'] else []))
print('company',cover(lambda x:x['production_company_ids'] or []))
print('hl',cover(lambda x:x['fingerprint_highlight_keys'] or []))
key2row={k:i for i,k in enumerate(D.keys)}
rated=set(idx)
n=0;deg=[]
for i in idx:
    x=D.info[i]; nb={key2row.get((x['media_type'],t)) for t in (x['tmdb_recommendation_ids'] or [])+(x['tmdb_similar_ids'] or [])}
    d=len((nb&rated)-{i}); deg.append(d)
print('rec nb rated deg', np.mean(deg), np.mean(np.array(deg)>0))
print([ (D.info[i]['title'],D.info[i]['media_type'],D.info[i]['runtime']) for i in idx[:1]])
print('shows', sum(D.info[i]['media_type']=='show' for i in idx), 'crew missing by type', C((D.info[i]['media_type'], bool(D.info[i]['crew'])) for i in idx))
print(D.info[idx[0]]['crew'])
# other users sizes
print(sorted(len(D.of(u)[0]) for u in D.users()))
