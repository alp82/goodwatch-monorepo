import subprocess,json,sys,time,datetime,pathlib
ROOT=pathlib.Path('/tmp/gw-562-enforce')
def emit(**d):print(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),**d}),flush=True)
def remote(host,source):
 r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=20','root@10.0.0.'+str(host),'python3','-'],input=source,text=True,capture_output=True)
 if r.returncode:raise RuntimeError('Remote operation failed on '+str(host)+': '+r.stderr[-500:])
 return r.stdout
SQL='''import subprocess,json
r=subprocess.run(['docker','exec','-i',node,'curl','-fsS','--max-time',str(timeout),'-H','Content-Type:application/json','--data-binary','@-','http://127.0.0.1:4200/_sql'],input=json.dumps({'stmt':stmt,'args':args}),text=True,capture_output=True)
if r.returncode:raise SystemExit('SQL HTTP failed; body suppressed')
d=json.loads(r.stdout)
if 'error' in d:raise SystemExit('SQL returned error; body suppressed')
print(json.dumps(d))
'''
def sql(host,stmt,args=(),timeout=300):
 return json.loads(remote(host,'node='+repr('crate-0'+str(host-10))+'\nstmt='+repr(stmt)+'\nargs='+repr(list(args))+'\ntimeout='+str(timeout)+'\n'+SQL))
def health(host):
 qs={'admin':'SELECT current_user','nodes':"SELECT id,name,version['number'] FROM sys.nodes ORDER BY name",'health':"SELECT health,count(*),sum(missing_shards),sum(underreplicated_shards) FROM sys.health GROUP BY health",'shards':"SELECT state,routing_state,count(*) FROM sys.shards GROUP BY state,routing_state",'checks':"SELECT count(*),sum(CASE WHEN passed THEN 0 ELSE 1 END) FROM sys.node_checks",'cluster':"SELECT settings['cluster']['routing']['allocation']['enable'],settings['cluster']['graceful_stop'] FROM sys.cluster"}
 d={k:sql(host,q)['rows'] for k,q in qs.items()};emit(host=host,gate=d)
 assert d['admin']==[['crate']] and len(d['nodes'])==3
 assert all(r[2]=='5.10.16' for r in d['nodes'])
 assert all(r[0]=='GREEN' and r[2:]==[0,0] for r in d['health'])
 assert all(r[:2]==['STARTED','STARTED'] for r in d['shards'])
 assert d['checks']==[[21,0]] and d['cluster'][0][0]=='all' and d['cluster'][0][1]['force'] is False
if __name__=='__main__':
 if sys.argv[1]=='health':
  for host in (11,12,13):health(host)
 elif sys.argv[1]=='sql':emit(host=int(sys.argv[2]),result=sql(int(sys.argv[2]),sys.argv[3],timeout=int(sys.argv[4]) if len(sys.argv)>4 else 300))
