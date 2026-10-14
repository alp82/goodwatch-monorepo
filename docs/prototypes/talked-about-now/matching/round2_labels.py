#!/usr/bin/env python3
"""Resolve manually authored references independently of model decisions."""
from round2_matcher import *

def prepare():
 intents=read('label-intents.json')['items'];con=db();names={str(t[0]) for x in intents for t in x['targets']};rows={}
 for n in names:
  for r in find_titles(con,n):rows[r['key']]=r
 # Latest exact title/original-title rows and alternative titles, SELECT only.
 lower=[n.lower() for n in names]
 aliases=crate('SELECT media_type,media_tmdb_id,title FROM alternative_title WHERE lower(title)=ANY(?) LIMIT 20000',[lower])
 current={}
 for kind,table in [('movie','movie'),('tv','show')]:
  for r in crate(f'SELECT tmdb_id,title,original_title,release_year,popularity,substr(synopsis,1,1000) AS synopsis FROM {table} WHERE lower(title)=ANY(?) OR lower(original_title)=ANY(?) LIMIT 20000',[lower,lower]):
   r['key']=kind+':'+str(r['tmdb_id']);r['media_type']=kind;rows[r['key']]=r
  extra={int(k.split(':')[1]) for x in intents for k in x.get('gold_override',[]) if k.startswith(kind+':')}
  extra|={a['media_tmdb_id'] for a in aliases if ('tv' if a['media_type'] in ['show','tv'] else 'movie')==kind}
  for r in crate(f'SELECT tmdb_id,title,original_title,release_year,popularity,substr(synopsis,1,1000) AS synopsis FROM {table} WHERE tmdb_id=ANY(?)',[sorted(extra)]):
   r['key']=kind+':'+str(r['tmdb_id']);r['media_type']=kind;rows[r['key']]=r
 for r in rows.values():r['alternative_titles']=[a['title'] for a in aliases if a['media_tmdb_id']==r['tmdb_id'] and ('tv' if a['media_type'] in ['show','tv'] else 'movie')==r['media_type']]
 save('reference-catalog.json',list(rows.values()));save('reference-aliases.json',aliases)
 print('Reference rows',len(rows),flush=True)
 for x in intents:
  choices=[]
  for name,year,kind in x['targets']:
   candidates=[r for r in rows.values() if r['media_type']==kind and (year is None or r['release_year']==year) and norm(name) in {norm(s) for s in [r['title'],r.get('original_title')]+r['alternative_titles'] if s}]
   choices.append({'target':[name,year,kind],'candidates':[{'key':r['key'],'title':r['title'],'year':r['release_year'],'synopsis':r.get('synopsis')} for r in candidates]})
  if any(len(c['candidates'])!=1 for c in choices) and not x.get('ambiguous') and 'gold_override' not in x:
   print(x['review_id'],x['id'],json.dumps(choices,ensure_ascii=False),flush=True)

def resolve():
 rows=read('reference-catalog.json');labels=[]
 for x in read('label-intents.json')['items']:
  keys=[];misses=[]
  for name,year,kind in x['targets']:
   candidates={r['key']:r for r in rows if r['media_type']==kind and (year is None or r['release_year']==year) and norm(name) in {norm(s) for s in [r['title'],r.get('original_title')]+r.get('alternative_titles',[]) if s}}
   if len(candidates)==1:keys+=list(candidates)
   elif len(candidates)>1 and 'gold_override' not in x and not x.get('ambiguous'):raise ValueError('Manual identity unresolved: '+x['review_id'])
   else:misses.append({'title':name,'expected_type':kind,'expected_year':year,'candidate_keys':list(candidates)})
  labels.append(x|{'gold':x.get('gold_override',keys),'catalog_misses_or_collisions':misses,'reference_label':'unsure' if x.get('ambiguous') else 'identified' if x.get('targets') else 'none'})
 save('labels.json',labels);assert len(labels)==200
 print('Resolved',len(labels),'references;',sum(bool(x.get('ambiguous')) for x in labels),'unsure',flush=True)

if __name__=='__main__':
 import sys
 globals()[sys.argv[1]]()
