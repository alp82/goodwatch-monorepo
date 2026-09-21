#!/usr/bin/env python3
"""Read-only catalog evidence for the captured baseline; no new model calls."""
import json,urllib.request,urllib.parse,hashlib
from pathlib import Path
HERE = Path(__file__).resolve().parent
p=HERE/'baseline.json'
data=json.loads(p.read_text()); source=HERE.parents[2]/'goodwatch-webapp/app/routes/prototype.search-journey.tsx'; data['source_sha256']['goodwatch-webapp/app/routes/prototype.search-journey.tsx']=hashlib.sha256(source.read_bytes()).hexdigest(); ids=sorted({k for c in data['cases'] for k in c['top10_ids'] if k.startswith(('movie:','show:'))}|{'movie:132381'})
metadata={}
for start in range(0,len(ids),40):
    query=urllib.parse.urlencode({'metadata':','.join(ids[start:start+40]),'_data':'routes/prototype.search-journey'})
    with urllib.request.urlopen(data['environment']+'/prototype/search-journey?'+query,timeout=30) as response:
        for r in json.load(response)['titles']: metadata[f"{r['media_type']}:{r['tmdb_id']}"]=r
for c in data['cases']:
    c['catalog_metadata']={k:metadata.get(k) for k in c['top10_ids']}
    seen={}
    for k,r in c['catalog_metadata'].items():
        if not r:continue
        if r.get('adult') is True:c['violations'].append(k+': stored adult flag true without opt-in')
        if c['fixture']['kind']=='description' and (r.get('goodwatch_overall_score_voting_count') or 0)<2000:c['violations'].append(k+': below default discovery vote floor')
        imdb=r.get('imdb_id')
        if imdb and imdb in seen:c['violations'].append(k+': shared IMDb identity with '+seen[imdb])
        if imdb:seen[imdb]=k
    c['violations']=list(dict.fromkeys(c['violations']))
    if c['violations']:c['status']='fail'
data['hygiene_evidence']={'known_flagged_record':metadata.get('movie:132381'),'earlier_reported_adult_example':'Still unidentified; do not equate the known flagged record with the reported example.', 'pending_acceptance':['Adult opt-in and unknown classification','Discovery with no vote minimum','Identity collapse versus remakes and distinct series','Final blended UI eligibility across every source'], 'metadata_source':'Read-only prototype.search-journey metadata endpoint; collected after search, not a catalog snapshot.'}
p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print('Read metadata for',len(metadata),'titles')
