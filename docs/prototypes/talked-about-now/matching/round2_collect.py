#!/usr/bin/env python3
"""Bounded last-2.5-day corpus, publisher RSS pages and dated public Bluesky search."""
from round2_matcher import *
import xml.etree.ElementTree as ET
from urllib.parse import urlencode
import random

START=datetime(2026,10,12,tzinfo=timezone.utc)
END=datetime.now(timezone.utc)
NS={'a':'http://www.w3.org/2005/Atom','yt':'http://www.youtube.com/xml/schemas/2015','m':'http://search.yahoo.com/mrss/'}
ADDED={'Netflix':'UCWOA1ZGywLbqmigxE4Qlvuw','Netflix Brasil':'UCc1l5mTmAv2GC_PXrBpqyKQ','Netflix India':'UCZSNzBgFub_WWil6TOTYwAg'}
ALL_CHANNELS=CHANNELS|ADDED

def stamp(s):return datetime.fromisoformat(s.replace('Z','+00:00'))
def item_id(source,key):return source[0].upper()+'2-'+hashlib.sha256(key.encode()).hexdigest()[:12]
def collect():
 audit=[];items={};tasks=[]
 for name,c in ALL_CHANNELS.items():tasks.append(('youtube',name,'https://www.youtube.com/feeds/videos.xml?channel_id='+c,c))
 # WordPress pagination extends the timestamp window without guessing article bodies.
 for url in FEEDS:
  pages=18 if any(d in url for d in ['variety.com','deadline.com','hollywoodreporter.com','indiewire.com','slashfilm.com']) else 1
  for p in range(1,pages+1):tasks.append(('rss',url.split('/')[2],url+('' if p==1 else ('&' if '?' in url else '?')+'paged='+str(p)),None))
 def task(spec):
  source,name,url,c=spec;r=requests.get(url,headers=UA,timeout=35);record={'source':source,'publisher':name,'url':url,'status':r.status_code,'fetched_at':datetime.now(timezone.utc).isoformat()};out=[]
  try:
   r.raise_for_status();root=ET.fromstring(r.content)
   if source=='youtube':
    for e in root.findall('a:entry',NS):
     date=e.findtext('a:published',namespaces=NS)
     if not START<=stamp(date)<=END:continue
     vid=e.findtext('yt:videoId',namespaces=NS);u='https://www.youtube.com/watch?v='+vid
     out.append({'id':item_id(source,u),'source':source,'source_id':vid,'url':u,'author':name,'channel_id':c,'published_at':date,'text':e.findtext('a:title',namespaces=NS),'context':plain(e.findtext('m:group/m:description',default='',namespaces=NS))[:3000],'discovery':['official_channel_rss']})
   else:
    for e in root.findall('.//item'):
     raw=e.findtext('pubDate');dt=feed_date(raw)
     if dt.tzinfo is None:dt=dt.replace(tzinfo=timezone.utc)
     if not START<=dt<=END:continue
     u=e.findtext('link');creator=e.findtext('{http://purl.org/dc/elements/1.1/}creator') or name
     out.append({'id':item_id(source,u),'source':source,'source_id':u,'url':u,'author':creator,'publisher':name,'published_at':dt.isoformat(),'timestamp_precision':'timestamp' if ':' in raw else 'day','text':plain(e.findtext('title')),'context':plain(e.findtext('description'))[:1600],'discovery':['publisher_rss']})
   record['eligible_items']=len(out)
  except Exception as exc:record['error']=type(exc).__name__
  return out,record
 with ThreadPoolExecutor(max_workers=5) as pool:
  for out,record in pool.map(task,tasks):
   audit.append(record)
   for x in out:items[x['url']]=x
 save('feeds-audit.json',audit);save('feed-corpus.json',list(items.values()))
 print('Feed corpus:',{s:sum(x['source']==s for x in items.values()) for s in ['youtube','rss']},flush=True)

 # Fixed general queries sample both content and noise; additional buzz-targeted searches
 # supply title-page examples but are tracked separately from general-discovery counts.
 buzz=read('buzz-top-titles.json');general=['movie','film','trailer','TV show','series','episode','netflix','cinema']
 queries=[('general',q) for q in general]+[('buzz_targeted',r['title']) for r in buzz['titles']]
 searches=[]
 for day in [datetime(2026,10,12,tzinfo=timezone.utc),datetime(2026,10,13,tzinfo=timezone.utc),datetime(2026,10,14,tzinfo=timezone.utc)]:
  stop=min(day+timedelta(days=1),END)
  for mode,q in queries:searches.append((mode,q,day,stop))
 posts={};baudit=[]
 def search(spec):
  mode,q,start,stop=spec;limit=80 if mode=='general' else 20
  params={'q':q,'sort':'latest','limit':limit,'since':start.isoformat(),'until':stop.isoformat()}
  url='https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?'+urlencode(params)
  r=requests.get(url,headers=UA,timeout=40);a={'query':q,'mode':mode,'since':params['since'],'until':params['until'],'status':r.status_code,'url':url,'fetched_at':datetime.now(timezone.utc).isoformat()};out=[]
  try:
   r.raise_for_status();body=r.json();a['returned']=len(body.get('posts',[]));a['cursor_returned']=bool(body.get('cursor'))
   for p in body.get('posts',[]):
    rec=p['record'];date=rec['createdAt']
    if not START<=stamp(date)<=END:continue
    if any(l.get('val')=='!no-unauthenticated' for l in p.get('labels',[])):continue
    uri=p['uri'];did=p['author']['did'];rkey=uri.rsplit('/',1)[1];u='https://bsky.app/profile/'+p['author']['handle']+'/post/'+rkey
    embed=rec.get('embed') or {};ext=embed.get('external') or {}
    out.append({'id':item_id('bluesky',uri),'source':'bluesky','source_id':uri,'url':u,'author':p['author']['handle'],'author_did':did,'published_at':date,'text':rec.get('text',''),'context':plain(ext.get('title','')+' '+ext.get('description',''))[:1200],'discovery':[mode+':'+q],'langs':rec.get('langs',[])})
  except Exception as exc:a['error']=type(exc).__name__
  return out,a
 with ThreadPoolExecutor(max_workers=4) as pool:
  for out,a in pool.map(search,searches):
   baudit.append(a)
   for x in out:
    if x['source_id'] in posts:posts[x['source_id']]['discovery']=sorted(set(posts[x['source_id']]['discovery']+x['discovery']))
    else:posts[x['source_id']]=x
   save('bluesky-corpus.json',list(posts.values()));save('bluesky-search-audit.json',baudit)
   if len(baudit)%20==0:print('Bluesky searches',len(baudit),'/',len(searches),'unique posts',len(posts),flush=True)
 save('corpus.json',list(items.values())+list(posts.values()))
 save('collection-audit.json',{'start':START.isoformat(),'end':END.isoformat(),'sources':{s:sum(x['source']==s for x in list(items.values())+list(posts.values())) for s in ['youtube','rss','bluesky']},'channels':ALL_CHANNELS,'rss_scope':'Working discovery feeds; paginated WordPress trade feeds, rolling inventory elsewhere','bluesky_scope':'Anonymous dated first-page search by fixed general and buzz-title queries; not Jetstream or a complete platform census','pagination':'Bluesky cursors not followed; RSS fetched at most 18 pages per supported publisher feed','buzz_variants':list(buzz['rankings'])})

def sample():
 corpus=read('corpus.json');old=json.loads((DATA/'sample.json').read_text());old_urls={x['url'] for x in old};old_ids={x['source_id'] for x in old}
 eligible=[x for x in corpus if x['url'] not in old_urls and x['source_id'] not in old_ids and x.get('timestamp_precision')!='day']
 # Only general-query Bluesky posts enter the benchmark: targeted searches are display-only.
 pools={s:[x for x in eligible if x['source']==s and (s!='bluesky' or any(d.startswith('general:') for d in x['discovery']))] for s in ['youtube','rss','bluesky']}
 y=min(40,len(pools['youtube']));r=(200-y)//2;b=200-y-r;counts={'youtube':y,'rss':r,'bluesky':b};out=[]
 for source,n in counts.items():
  pool=sorted(pools[source],key=lambda x:x['source_id']);byday={}
  for x in pool:byday.setdefault(x['published_at'][:10],[]).append(x)
  chosen=[];rng=random.Random(5442026)
  for day in sorted(byday):
   amount=min(len(byday[day]),n//len(byday));chosen+=rng.sample(byday[day],amount)
  remaining=[x for x in pool if x not in chosen];chosen+=rng.sample(remaining,n-len(chosen))
  out+=chosen
 save('fresh-sample.json',out)
 save('sample-audit.json',{'selected_at':datetime.now(timezone.utc).isoformat(),'items':len(out),'counts':counts,'old_url_overlap':0,'old_source_id_overlap':0,'seed':5442026,'dates':{s:sorted({x['published_at'][:10] for x in out if x['source']==s}) for s in counts},'rules_sha256':read('frozen-rules.json')['logic_sha256'],'corpus_sha256':fingerprint(corpus),'no_targeted_only_bluesky_items':True})
 print('Fresh sample:',counts,flush=True)

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('command',choices=['collect','sample']);globals()[p.parse_args().command]()
