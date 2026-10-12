"""Read-only catalog audit. Run from repo root with python audit.py catalog|sample|live.
Credentials stay in goodwatch-webapp/.env; outputs contain only public catalog data.
"""
import argparse, collections, concurrent.futures, csv, json, time, threading, unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
import requests
from dotenv import dotenv_values

OUT = Path(__file__).resolve().parent
TMP = Path('/tmp/gw-episode-alignment-audit'); TMP.mkdir(exist_ok=True)
CFG = dotenv_values('goodwatch-webapp/.env')
HOST = CFG['CRATE_HOSTS'].split(',')[0].strip()
HOST = HOST if '://' in HOST else 'http://' + HOST
if urlsplit(HOST).port is None: HOST += ':' + CFG.get('CRATE_PORT', '4200')

def sql(stmt, args=None):
    assert stmt.lstrip().upper().startswith('SELECT ')
    r = requests.post(HOST + '/_sql', auth=(CFG.get('CRATE_USER','crate'), CFG.get('CRATE_PASS','')),
                      json={'stmt':stmt,'args':args or []}, timeout=60)
    if not r.ok:
        raise RuntimeError('Crate query failed HTTP '+str(r.status_code)+': '+r.json().get('error',{}).get('message','')[:160])
    data = r.json()
    return [dict(zip(data['cols'], row)) for row in data['rows']]

def save(name, data, root=OUT):
    (root/name).write_text(json.dumps(data, ensure_ascii=False, indent=2))

def load(name, root=OUT): return json.loads((root/name).read_text())
def norm(name): return ''.join(c for c in (name or '').lower() if c.isalnum())

def catalog():
    started=datetime.now(timezone.utc).isoformat()
    shows=sql('SELECT tmdb_id,title,imdb_id,genres,imdb_user_score_rating_count AS votes,episodes_updated_at FROM show LIMIT 500000')
    print('Read show metadata',len(shows),flush=True)
    tmdb=sql('SELECT show_id,season_number,count(*) AS n,count(DISTINCT episode_number) AS positions,min(episode_number) AS lo,max(episode_number) AS hi FROM episode WHERE removed_at IS NULL AND season_number > 0 GROUP BY show_id,season_number LIMIT 500000')
    print('Read TMDB catalog season aggregates',len(tmdb),flush=True)
    imdb=sql('SELECT show_id,season_number,count(*) AS n,count(DISTINCT episode_number) AS positions,min(episode_number) AS lo,max(episode_number) AS hi FROM imdb_episode WHERE season_number > 0 GROUP BY show_id,season_number LIMIT 500000')
    print('Read IMDb episode season aggregates',len(imdb),flush=True)
    assert len(shows)<500000 and len(tmdb)<500000 and len(imdb)<500000, 'Query limit reached'
    t=collections.defaultdict(dict);i=collections.defaultdict(dict)
    for r in tmdb:t[r['show_id']][r['season_number']]=r
    for r in imdb:i[r['show_id']][r['season_number']]=r
    meta={r['tmdb_id']:r for r in shows};counts=collections.Counter();items=[]
    for show_id in sorted(t.keys() & i.keys()):
        ts={s:r['n'] for s,r in t[show_id].items()};ins={s:r['n'] for s,r in i[show_id].items()}
        nt,ni=sum(ts.values()),sum(ins.values())
        if ts==ins:kind='equal_season_counts'
        elif set(ts)!=set(ins) and nt==ni:kind='different_seasons_equal_total'
        elif set(ts)!=set(ins):kind='different_seasons_different_total'
        elif nt==ni:kind='same_seasons_redistributed_counts'
        else:kind='same_seasons_different_total'
        counts[kind]+=1
        m=meta.get(show_id,{})
        items.append({'show_id':show_id,'title':m.get('title'),'votes':m.get('votes') or 0,'genres':m.get('genres'),
                      'kind':kind,'tmdb':ts,'imdb':ins,'tmdb_total':nt,'imdb_total':ni,
                      'tmdb_episodes_updated_at':m.get('episodes_updated_at'),
                      'position_anomaly':any(r['n']!=r['positions'] or r['lo']!=1 or r['hi']!=r['n'] for r in list(t[show_id].values())+list(i[show_id].values()))})
    items.sort(key=lambda r:(-r['votes'],r['show_id']))
    save('catalog-overlap.json',items,TMP)
    summary={'started_at':started,'completed_at':datetime.now(timezone.utc).isoformat(),'shows_in_serving_table':len(shows),
             'shows_with_regular_tmdb_catalog':len(t),'shows_with_regular_imdb_episodes':len(i),'overlap_shows':len(items),
             'tmdb_regular_episodes':sum(r['n'] for r in tmdb),'imdb_regular_episodes':sum(r['n'] for r in imdb),
             'classification_counts':dict(counts),'shape_mismatch_shows':sum(v for k,v in counts.items() if k!='equal_season_counts'),
             'warning':'Season row counts are a screening signal, not proof of wrong identity or ordering; future entries and source coverage can differ.'}
    save('catalog-summary.json',summary)
    mismatches=[r for r in items if r['kind']!='equal_season_counts']
    save('ranked-mismatches.json',mismatches[:1000])
    selected=[];seen=set()
    def take(rows,n,reason):
        for r in rows:
            if r['show_id'] in seen:continue
            seen.add(r['show_id']);selected.append({**r,'selection_reason':reason})
            n-=1
            if n==0:break
    take(mismatches,40,'most_voted_shape_mismatches')
    for kind in ['different_seasons_equal_total','same_seasons_redistributed_counts','different_seasons_different_total','same_seasons_different_total']:
        take([r for r in mismatches if r['kind']==kind],8,'varied_shape:'+kind)
    take([r for r in mismatches if 'Animation' in (r['genres'] or [])],10,'animation_mismatches')
    take([r for r in mismatches if 'Animation' not in (r['genres'] or [])],10,'other_genre_mismatches')
    take([r for r in items if r['kind']=='equal_season_counts'],20,'most_voted_equal_count_controls')
    take([r for r in items if r['show_id']==154526],1,'reported_case')
    save('selected-shows.json',selected)
    print(json.dumps(summary),flush=True)
    print('Selected shows',len(selected),flush=True)
    for r in selected:print(r['show_id'],r['title'],r['kind'],r['tmdb'],r['imdb'],flush=True)

def sample():
    selected=load('selected-shows.json');ids=[r['show_id'] for r in selected]
    placeholders=','.join('?' for _ in ids)
    tmdb=sql(f'SELECT show_id,tmdb_id,season_number,episode_number,name,air_date,imdb_id FROM episode WHERE removed_at IS NULL AND show_id IN ({placeholders}) ORDER BY show_id,season_number,episode_number LIMIT 200000',ids)
    imdb=sql(f'SELECT show_id,imdb_episode_id,season_number,episode_number,name,imdb_user_score_original AS score,imdb_user_score_rating_count AS votes FROM imdb_episode WHERE show_id IN ({placeholders}) ORDER BY show_id,season_number,episode_number LIMIT 200000',ids)
    assert len(tmdb)<200000 and len(imdb)<200000
    save('sample-episodes.json',{'tmdb':tmdb,'imdb':imdb},TMP)
    t=collections.defaultdict(list);i=collections.defaultdict(list)
    for e in tmdb:t[e['show_id']].append(e)
    for e in imdb:i[e['show_id']].append(e)
    result=[]
    for r in selected:
        sid=r['show_id'];te=[e for e in t[sid] if e['season_number']>0];ie=[e for e in i[sid] if e['season_number'] is not None and e['season_number']>0]
        tc=collections.Counter(norm(e['name']) for e in te);ic=collections.Counter(norm(e['name']) for e in ie)
        bytitle={norm(e['name']):e for e in ie if norm(e['name']) and ic[norm(e['name'])]==1}
        pairs=[(e,bytitle[norm(e['name'])]) for e in te if norm(e['name']) and tc[norm(e['name'])]==1 and norm(e['name']) in bytitle]
        cross=[(a,b) for a,b in pairs if a['season_number']!=b['season_number']]
        shifted=[(a,b) for a,b in pairs if (a['season_number'],a['episode_number'])!=(b['season_number'],b['episode_number'])]
        ordered=sorted(pairs,key=lambda p:(p[0]['season_number'],p[0]['episode_number'] or -1))
        previous=None;inversions=[]
        for a,b in ordered:
            key=(b['season_number'],b['episode_number'] or -1)
            if previous and key<previous[0]:inversions.append({'previous':previous[1],'next':a['name']})
            previous=(key,a['name'])
        q={**r,'unique_title_pairs':len(pairs),'cross_season_title_pairs':len(cross),'shifted_title_pairs':len(shifted),'order_inversions':len(inversions),
           'tmdb_specials':len(t[sid])-len(te),'imdb_nonregular':len(i[sid])-len(ie),'rated_imdb_regular':sum(1 for e in ie if e['score'] and e['score']>0),
           'cross_season_examples':[{'name':a['name'],'tmdb_id':a['tmdb_id'],'tmdb':[a['season_number'],a['episode_number']],'imdb_id':b['imdb_episode_id'],'imdb':[b['season_number'],b['episode_number']]} for a,b in cross[:5]],
           'shifted_examples':[{'name':a['name'],'tmdb_id':a['tmdb_id'],'tmdb':[a['season_number'],a['episode_number']],'imdb_id':b['imdb_episode_id'],'imdb':[b['season_number'],b['episode_number']]} for a,b in shifted[:5]],
           'inversion_examples':inversions[:3]}
        result.append(q)
    save('sample-analysis.json',result)
    print('Sample rows',len(tmdb),len(imdb),'shows',len(result),flush=True)
    for r in result:print(r['title'],'paired',r['unique_title_pairs'],'cross season',r['cross_season_title_pairs'],'shifted',r['shifted_title_pairs'],'inversions',r['order_inversions'],flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('stage',choices=['catalog','sample']);args=p.parse_args()
    {'catalog':catalog,'sample':sample}[args.stage]()
