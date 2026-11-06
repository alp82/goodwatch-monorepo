import datetime,hashlib,json,os,subprocess,sys,time
role=sys.argv[1];assert role in ['search-a','search-b']
verify_only=len(sys.argv)>2 and sys.argv[2]=='--verify-only'
name='goodwatch-'+role;other='goodwatch-'+('search-b' if role=='search-a' else 'search-a')
os.chdir('/root/goodwatch/goodwatch-monorepo/goodwatch-search')
def inspect(n):return json.loads(subprocess.check_output(['docker','inspect',n]))[0]
def ready(n):
 script="fetch('http://127.0.0.1:3000/health/ready',{signal:AbortSignal.timeout(5000)}).then(r=>{console.log(r.status);if(r.status!==200)process.exitCode=1}).catch(()=>{process.exitCode=1})"
 p=subprocess.run(['docker','exec',n,'node','-e',script],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 return p.returncode==0 and p.stdout.strip()==b'200'
def env(c):return dict(x.split('=',1) for x in c['Config']['Env'] if '=' in x)
required=['BETTER_AUTH_ENABLED','BETTER_AUTH_SECRET','BETTER_AUTH_URL','AUTH_CRATEDB_ORIGINS','AUTH_CRATEDB_USERNAME','AUTH_CRATEDB_PASSWORD','AUTH_CRATEDB_ENCRYPTION_SECRET','AUTH_CRATEDB_ENCRYPTION_KEYS','AUTH_TRUSTED_IP_HEADER','AUTH_GOOGLE_CLIENT_ID','AUTH_GOOGLE_CLIENT_SECRET','AUTH_SMTP_USER','AUTH_SMTP_PASSWORD','MCP_RESOURCE_URL','REC_CONNECTOR']
pages=subprocess.check_output(['docker','ps','--filter','name=^gk4owk8-','--format','{{.Names}}'],text=True).splitlines();assert len(pages)==1
page=inspect(pages[0]);target=page['Config']['Image'];target_id=page['Image']
assert target.endswith(':f8e37568ffb3f870be0016915beccb5334554d73')
old=inspect(name);peer=inspect(other)
assert old['State']['Health']['Status']=='healthy'
assert peer['State']['Health']['Status']=='healthy' and ready(other)
print(json.dumps({'event':'begin','role':role,'verify_only':verify_only,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'old_id':old['Id'],'peer_id':peer['Id'],'old_image_id':old['Image'],'target_image':target,'target_image_id':target_id,'peer_health_200':True}),flush=True)
if not verify_only:
 p=subprocess.run(['docker','compose','up','-d','--no-deps','--no-build','--pull','never',role],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 assert p.returncode==0,'Compose recreation failed; output suppressed'
deadline=time.monotonic()+300;samples=0
while time.monotonic()<deadline:
 current_peer=inspect(other)
 assert current_peer['Id']==peer['Id'] and current_peer['State']['Running'] and ready(other),'Peer failed serving check; stop rollout'
 samples+=1;new=inspect(name)
 assert new['Image']==target_id and new['Config']['Image']==target,'Unexpected image'
 assert new['State']['Running'] and new['RestartCount']==0,'New container stopped or restarted'
 logs=subprocess.run(['docker','logs',name],stdout=subprocess.PIPE,stderr=subprocess.PIPE).stdout
 if new['State'].get('Health',{}).get('Status')=='healthy' and b'Search ranking: query models ready' in logs and ready(name):
  assert verify_only or new['Id']!=old['Id']
  pe=env(inspect(pages[0]));ne=env(new)
  matches={k:bool(ne.get(k)) and hashlib.sha256(ne[k].encode()).digest()==hashlib.sha256(pe.get(k,'').encode()).digest() for k in required}
  assert all(matches.values()),'Auth environment mismatch'
  assert ne['SOURCE_COMMIT']==ne['SEARCH_COMMIT']==target.rsplit(':',1)[1]
  probe=r'''const http=require('http');const req=http.request({hostname:'127.0.0.1',port:3000,path:'/mcp',method:'POST',headers:{Host:'goodwatch.app','X-Forwarded-Proto':'https','Content-Type':'application/json'}},r=>{r.resume();r.on('end',()=>console.log(JSON.stringify({sent_host:req.getHeader('Host'),status:r.statusCode,www_authenticate:r.headers['www-authenticate']})))});req.on('error',()=>process.exitCode=1);req.setTimeout(10000,()=>req.destroy());req.end('{}');'''
  response=json.loads(subprocess.check_output(['docker','exec',name,'node','-e',probe],text=True))
  assert response['status']==401 and 'resource_metadata="https://goodwatch.app/.well-known/oauth-protected-resource/mcp"' in (response['www_authenticate'] or ''),'MCP discovery challenge failed; stop rollout'
  print(json.dumps({'event':'ready','role':role,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'new_id':new['Id'],'image':new['Config']['Image'],'image_id':new['Image'],'query_models_ready':True,'readiness_200':True,'environment_hash_matches_page':matches,'deployment_env_tag_matches_image':True,'anonymous_traefik_shaped_mcp':response,'peer_same_container_and_serving_200_samples':samples}),flush=True)
  break
 if samples%5==0:print(json.dumps({'event':'waiting','role':role,'health':new['State'].get('Health',{}).get('Status'),'peer_200_samples':samples}),flush=True)
 time.sleep(3)
else:raise SystemExit('Readiness deadline exceeded; peer not recreated')
