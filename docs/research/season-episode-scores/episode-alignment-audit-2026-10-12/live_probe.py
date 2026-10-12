"""Bounded, read-only TMDB probes for the stratified sample; run after audit.py sample."""
import collections, concurrent.futures, json, threading, time
from datetime import datetime, timezone
from pathlib import Path
import audit

lock=threading.Lock();requests_made=0;status_counts=collections.Counter();logs=[];MAX_REQUESTS=1200
cache=audit.TMP/'api';cache.mkdir(exist_ok=True)

def api(path, **extra):
    global requests_made
    key=path.replace('/','_')+('_external' if extra else '')
    cached=cache/key
    if cached.exists():return json.loads(cached.read_text())
    for attempt in range(3):
        with lock:
            if requests_made>=MAX_REQUESTS:return {'_error':'request budget exhausted'}
            requests_made+=1
        time.sleep(.10)
        try:
            r=audit.requests.get('https://api.themoviedb.org/3'+path,params={'api_key':audit.CFG['TMDB_API_KEY'],**extra},timeout=20)
            with lock:status_counts[str(r.status_code)]+=1;logs.append({'path':path,'status':r.status_code})
            if r.status_code==429:
                time.sleep(min(5,float(r.headers.get('Retry-After','1'))));continue
            if not r.ok:return {'_error':'HTTP '+str(r.status_code)}
            data=r.json();cached.write_text(json.dumps(data));return data
        except audit.requests.RequestException:
            with lock:status_counts['transport_error']+=1;logs.append({'path':path,'status':'transport_error'})
            if attempt==2:return {'_error':'transport_error'}
    return {'_error':'retry limit'}

def pool(fn, jobs, workers=4):
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:return list(ex.map(fn,jobs))

samples=audit.load('sample-analysis.json');data=audit.load('sample-episodes.json',audit.TMP)
t=collections.defaultdict(list);i=collections.defaultdict(list)
for e in data['tmdb']:t[e['show_id']].append(e)
for e in data['imdb']:i[e['show_id']].append(e)
started=datetime.now(timezone.utc).isoformat()

def metadata(row):
    sid=row['show_id'];details=api(f'/tv/{sid}',append_to_response='external_ids');groups=api(f'/tv/{sid}/episode_groups')
    seasons={str(s['season_number']):s['episode_count'] for s in details.get('seasons',[]) if s['season_number']>0}
    return {'show_id':sid,'title':row['title'],'live_seasons':seasons,'catalog_seasons':row['tmdb'],'imdb_seasons':row['imdb'],
            'live_catalog_counts_agree':seasons==row['tmdb'],'live_imdb_show_id':details.get('external_ids',{}).get('imdb_id'),
            'groups':groups.get('results',[]),'detail_error':details.get('_error'),'groups_error':groups.get('_error')}

live=pool(metadata,samples);audit.save('live-shows.json',live)
print('Live metadata',len(live),'requests',requests_made,'shows with groups',sum(bool(r['groups']) for r in live),flush=True)

jobs=[]
for r in live:
    if r['catalog_seasons']==r['imdb_seasons']:continue
    target=sum(r['imdb_seasons'].values());target_seasons=len(r['imdb_seasons'])
    groups=sorted(r['groups'],key=lambda g:('imdb' not in g['name'].lower(),abs(g['episode_count']-target),min(abs(g['group_count']-target_seasons),abs(g['group_count']-target_seasons-1))))
    for g in groups[:3]:jobs.append((r,g))

def group_probe(job):
    r,g=job;d=api('/tv/episode_group/'+g['id']);current={e['tmdb_id']:e for e in t[r['show_id']] if e['season_number']>0}
    regular_groups=[];positions=[];all_ids=[];special_ids=[];unknown=[]
    for part in sorted(d.get('groups',[]),key=lambda x:x['order']):
        regular=[]
        for e in sorted(part['episodes'],key=lambda x:x['order']):
            all_ids.append(e['id'])
            if e['id'] in current:
                regular.append(e['id']);c=current[e['id']];positions.append((c['season_number'],c['episode_number'] or -1))
            elif e.get('season_number')==0:special_ids.append(e['id'])
            else:unknown.append(e['id'])
        if regular:regular_groups.append(len(regular))
    ordered_signature=[v for k,v in sorted(r['imdb_seasons'].items(),key=lambda p:int(p[0]))]
    present=set(all_ids)&current.keys()
    return {'show_id':r['show_id'],'title':r['title'],'group_id':g['id'],'group_name':g['name'],'type':g['type'],
            'regular_group_sizes':regular_groups,'imdb_group_sizes':ordered_signature,'regular_id_coverage':len(present),
            'catalog_regular_count':len(current),'unknown_regular_ids':len(unknown),'duplicate_ids':len(all_ids)-len(set(all_ids)),
            'special_ids':len(special_ids),'preserves_canonical_order':positions==sorted(positions),
            'same_group_sizes_as_imdb':regular_groups==ordered_signature,'covers_catalog_regular_ids':present==current.keys(),
            'error':d.get('_error')}

group_results=pool(group_probe,jobs);audit.save('group-probes.json',group_results)
print('Group probes',len(group_results),'requests',requests_made,flush=True)

full_ids={154526,95479,127532,73021,79242,85937,71446}
focus_ids={37854,31910,46260,46298,1433,65942,60572,764,160,4459,96677,387,32726,30984,31132,1877,1437,19885,57243,33907,1429,1668,2316,615,1920,61374,84773,1396,1399,87108}
byrow={r['show_id']:r for r in samples};idjobs=[]
for sid in full_ids|focus_ids:
    if sid not in byrow:continue
    rows=t[sid]
    if sid in full_ids:chosen=rows
    else:
        ie={e['imdb_episode_id']:e for e in i[sid]};tn=collections.Counter(audit.norm(e['name']) for e in rows)
        titled={audit.norm(e['name']) for e in i[sid]}
        candidates=[]
        examples=byrow[sid]['cross_season_examples']+byrow[sid]['shifted_examples']
        ids=[e['tmdb_id'] for e in examples]
        candidates.extend(e for e in rows if e['tmdb_id'] in ids)
        candidates.extend(e for e in rows if audit.norm(e['name']) not in titled)
        candidates.extend(e for e in rows if e['season_number']==0)
        candidates.extend(rows[::max(1,len(rows)//5)])
        # Keep probes spread across unmatched episodes, specials and confirmed shifts.
        chosen=[];seen=set()
        for category in [candidates[:5],[e for e in rows if audit.norm(e['name']) not in titled][:4],[e for e in rows if e['season_number']==0][:3],rows[::max(1,len(rows)//4)][:4]]:
            for e in category:
                if e['tmdb_id'] not in seen:chosen.append(e);seen.add(e['tmdb_id'])
        chosen=chosen[:15]
    idjobs.extend((byrow[sid],e) for e in chosen)

def id_probe(job):
    row,e=job;d=api(f"/tv/{row['show_id']}/season/{e['season_number']}/episode/{e['episode_number']}/external_ids")
    external=d.get('imdb_id');matches=[x for x in i[row['show_id']] if x['imdb_episode_id']==external] if external else []
    out={'show_id':row['show_id'],'title':row['title'],'tmdb_id':e['tmdb_id'],'tmdb_position':[e['season_number'],e['episode_number']],
         'tmdb_name':e['name'],'external_imdb_id':external,'imdb_matches_in_show':[{k:x[k] for k in ['imdb_episode_id','season_number','episode_number','name','score','votes']} for x in matches],
         'error':d.get('_error')}
    return out

probes=pool(id_probe,idjobs);audit.save('external-id-probes.json',probes)
# Resolve external IDs absent from their current show's IMDb episode dataset across the serving table.
missing=sorted({p['external_imdb_id'] for p in probes if p['external_imdb_id'] and not p['imdb_matches_in_show']})
lookup=[]
if missing:
    slots=','.join('?' for _ in missing)
    lookup=audit.sql(f'SELECT show_id,imdb_episode_id,imdb_show_id,season_number,episode_number,name FROM imdb_episode WHERE imdb_episode_id IN ({slots}) LIMIT 10000',missing)
    audit.save('cross-show-id-lookup.json',lookup)
summary={'started_at':started,'completed_at':datetime.now(timezone.utc).isoformat(),'requests_made':requests_made,'max_requests':MAX_REQUESTS,'statuses':dict(status_counts),
         'live_shows':len(live),'shows_with_groups':sum(bool(r['groups']) for r in live),'group_probes':len(group_results),'external_id_probes':len(probes),
         'full_catalog_id_probe_shows':sorted(full_ids),'external_ids_present':sum(bool(p['external_imdb_id']) for p in probes),
         'external_ids_found_in_same_show':sum(bool(p['imdb_matches_in_show']) for p in probes),'external_ids_not_in_same_show':len(missing),
         'catalog_live_counts_disagree':sum(not r['live_catalog_counts_agree'] for r in live)}
audit.save('live-summary.json',summary);audit.save('api-request-log.json',logs)
print(json.dumps(summary),flush=True)
for sid in sorted(full_ids|focus_ids):
    ps=[p for p in probes if p['show_id']==sid];gs=[g for g in group_results if g['show_id']==sid]
    if not ps:continue
    ids=[p['external_imdb_id'] for p in ps if p['external_imdb_id']]
    good=[g for g in gs if g['same_group_sizes_as_imdb'] and g['covers_catalog_regular_ids'] and g['preserves_canonical_order'] and not g['duplicate_ids'] and not g['unknown_regular_ids']]
    print(byrow[sid]['title'],'ID probes',len(ps),'present',len(ids),'matched same show',sum(bool(p['imdb_matches_in_show']) for p in ps),'reused IDs',len(ids)-len(set(ids)),'matching group candidates',len(good),flush=True)
