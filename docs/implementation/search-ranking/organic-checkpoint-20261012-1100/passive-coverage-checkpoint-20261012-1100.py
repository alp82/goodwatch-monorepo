import json,sys,re,subprocess,hashlib,os
from pathlib import Path
from datetime import datetime,timezone
from collections import Counter
host=sys.argv[1];start='2026-10-12T08:44:00Z';end='2026-10-12T11:00:00Z'
def ts(s):
 if not isinstance(s,str):raise ValueError('timestamp_type')
 if not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)',s):raise ValueError('timestamp_shape')
 normalized=re.sub(r'\.(\d{6})\d{1,3}(?=Z|[+-])',r'.\1',s)
 return datetime.fromisoformat(normalized.replace('Z','+00:00')).astimezone(timezone.utc)
lo,hi=ts(start),ts(end)
def read(p):
 raw=open(p).read()
 if raw and not raw.endswith('\n'):raise ValueError('partial_journal')
 return [json.loads(x) for x in raw.splitlines()]
def cohort(rows):return [r for r in rows if isinstance(r.get('at'),str) and lo<=ts(r['at'])<hi]
def coverage(rows,core=False):
 hb=[r for r in rows if r['type']=='collector.heartbeat'];within=cohort(hb)
 before=[r for r in hb if ts(r['at'])<=lo];after=[r for r in hb if ts(r['at'])>=hi]
 fence=bool(before and after);timeline=(([before[-1]] if before else [])+within+([after[0]] if after else []))
 gaps=[(ts(b['at'])-ts(a['at'])).total_seconds() for a,b in zip(timeline,timeline[1:])]
 valid=lambda r:set(x.get('role')for x in r.get('roles',[]))=={'a','b'} and all(x.get('running') for x in r.get('roles',[])) if core else bool(r.get('sources')) and all(x.get('running') and x.get('accessLoggingReady') for x in r['sources'])
 recent=cohort(rows)
 out={'heartbeatCount':len(within),'lastHeartbeat':hb[-1]['at'] if hb else None,'fencesComplete':fence,'maxHeartbeatGapSeconds':max(gaps,default=None),'gapsOver45Seconds':sum(x>45 for x in gaps),'unavailableHeartbeatCount':sum(not valid(r) for r in within),'collectorRestarts':sum(r['type']=='collector.started' for r in recent),'collectorProblems':dict(Counter(r['kind'] for r in recent if r['type']=='collector.problem'))}
 if core:
  out['roleSourceCohorts']={role:dict(Counter(x['commit'] for r in within for x in r['roles'] if x['role']==role)) for role in ('a','b')}
  out['lastRoles']=[{'role':x['role'],'running':x['running'],'commit':x['commit']} for x in hb[-1]['roles']]
 else:out['lastProxySources']=[{'running':x['running'],'accessLoggingReady':x['accessLoggingReady'],'imageSha':x['imageId']} for x in hb[-1]['sources']]
 return out
out={'host':host,'at':datetime.now(timezone.utc).isoformat(),'windowStart':start,'windowEnd':end,'applicationAcceptance':False}
ing=read('/var/lib/goodwatch-search-ingress/events.ndjson');out['ingressCoverage']=coverage(ing)
responses=[r['data'] for r in ing if r['type']=='ingress' and lo<=ts(r['data']['at'])<hi]
out['ingressResponses']={'count':len(responses),'statuses':dict(Counter(str(d['status']) for d in responses)),'fiveXx':sum(d['status']>=500 for d in responses),'fractionalTimestampDigitsObserved':sorted(set(len(d['at'].split('.')[1].split('Z')[0]) if '.' in d['at'] else 0 for d in [r['data'] for r in ing if r['type']=='ingress']))}
if host=='vector1':
 rows=read('/var/lib/goodwatch-search-acceptance/events.ndjson');out['coreCoverage']=coverage(rows,True)
 data=[r['data'] for r in rows if r['type']=='telemetry' and lo<=ts(r['data']['at'])<hi]
 accepted=[d for d in data if d['event']=='search.lifecycle.v1' and d['phase']=='accepted'];finished=[d for d in data if d['event']=='search.lifecycle.v1' and d['phase']=='finished']
 out['lifecycle']={'accepted':len(accepted),'finished':len(finished),'eventCounts':dict(Counter(d['event'] for d in data)),'firstUsableP95Ms':None if not accepted else 'requires_full_verifier','organicAttributionProven':False}
# Inspect only page-role metadata in memory; never emit environments/container identities.
ids=subprocess.check_output(['/usr/bin/docker','ps','-q'],stderr=subprocess.DEVNULL).decode().split()
pages=[]
if ids:
 for x in json.loads(subprocess.check_output(['/usr/bin/docker','inspect',*ids],stderr=subprocess.DEVNULL)):
  env=dict(v.split('=',1) for v in x['Config'].get('Env',[]) if '=' in v)
  if env.get('WEBAPP_ROLE')=='page':
   c=env.get('SOURCE_COMMIT');pages.append({'commit':c if isinstance(c,str) and re.fullmatch('[a-f0-9]{40}',c) else 'unavailable','imageSha':x['Image'],'running':x['State']['Running']})
out['currentPageSources']=pages
def proc_ticks(pid):
 raw=Path('/proc',str(pid),'stat').read_text();return int(raw[raw.rfind(')')+2:].split()[19])
def service_state(name):
 try:
  raw=subprocess.check_output(['systemctl','show',name,'--property=ActiveState,SubState,MainPID'],stderr=subprocess.DEVNULL,timeout=10).decode()
  values=dict(row.split('=',1)for row in raw.splitlines()if '='in row);pid=int(values['MainPID'])
  entry=None
  if pid:
   argv=Path('/proc',str(pid),'cmdline').read_bytes().decode().split('\0')
   entries=[Path(arg)for arg in argv if arg.startswith('/')and arg.endswith('.mjs')]
   if len(entries)==1:entry=hashlib.sha256(entries[0].read_bytes()).hexdigest()
  return {'active':values['ActiveState']=='active','running':values['SubState']=='running','pid':pid,'startTicks':proc_ticks(pid)if pid else None,'entryCodeSha256':entry}
 except Exception:return {'metadataInspectionFailed':True}
out['collectorServices']={'ingress':service_state('goodwatch-search-ingress.service')}
if host=='vector1':
 out['collectorServices']['core']=service_state('goodwatch-search-acceptance.service')
 last=[r for r in rows if r['type']=='collector.heartbeat'][-1];current=[]
 for role in last['roles']:
  x=json.loads(subprocess.check_output(['/usr/bin/docker','inspect',role['containerId']],stderr=subprocess.DEVNULL,timeout=5))[0]
  env=dict(v.split('=',1)for v in x['Config'].get('Env',[])if '='in v)
  pid=x['State']['Pid'];top=subprocess.check_output(['/usr/bin/docker','top',x['Id'],'-eo','pid,comm'],stderr=subprocess.DEVNULL,timeout=5).decode().splitlines()[1:]
  nodes=[int(r.split()[0])for r in top if r.split()[1]=='node']
  current.append({'role':role['role'],'running':x['State']['Running'],'commit':env.get('SOURCE_COMMIT'),'imageSha256':x['Image'],'containerIdentitySha256':hashlib.sha256(x['Id'].encode()).hexdigest(),'containerStartedAt':x['State']['StartedAt'],'containerPid':pid,'containerStartTicks':proc_ticks(pid),'nodeProcesses':[{'pid':n,'startTicks':proc_ticks(n)}for n in nodes],'collectorContainerMatchesCurrent':x['Id']==role['containerId'],'collectorCommitMatchesCurrent':env.get('SOURCE_COMMIT')==role['commit']})
 out['currentSearchSources']=current
 # No new authorized ordinary probes occurred inside this interval. Anonymous
 # telemetry alone still cannot prove that a request was organic.
 out['lifecycle'].update({'firstUsableN':0,'firstUsableP95Ms':None,'fullComputationN':0,'fullComputationP95Ms':None,'censoredAborts':0,'failed':0,'missingFinished':0,'historyRecorded':0,'historyFailed':0,'rankerFallbackRows':0,'lookupWarningRows':0,'candidateTrafficAttribution':'unproven'})
 if out['lifecycle']['accepted']or out['lifecycle']['finished'] or any(out['lifecycle']['eventCounts'].values()):
  out['lifecycle']['requiresDetailedNumericVerification']=True
out['limits']=['Closed partial window with no new ordinary probes from this session; anonymous traffic attribution remains unproven.','No searches or collector/service/source modifications were performed.','No traffic means p95 cannot be measured, not zero latency or seven-day acceptance.','Heartbeat continuity does not prove absence of failures before fixed router ingestion, silent Docker sink loss, or correct UI delivery.','Container identities are hashed; process/source metadata and code hashes alone do not prove latency acceptance.']
print(json.dumps(out,sort_keys=True))
