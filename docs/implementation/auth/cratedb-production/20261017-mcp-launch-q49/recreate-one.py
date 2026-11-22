import datetime,json,os,subprocess,sys,time
role=sys.argv[1]
assert role in ['search-a','search-b']
name='goodwatch-'+role
other='goodwatch-'+('search-b' if role=='search-a' else 'search-a')
os.chdir('/root/goodwatch/goodwatch-monorepo/goodwatch-search')
def inspect(n):return json.loads(subprocess.check_output(['docker','inspect',n]))[0]
def ready(n):
 script="fetch('http://127.0.0.1:3000/health/ready',{signal:AbortSignal.timeout(5000)}).then(r=>{console.log(r.status);if(r.status!==200)process.exitCode=1}).catch(()=>{process.exitCode=1})"
 p=subprocess.run(['docker','exec',n,'node','-e',script],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 return p.returncode==0 and p.stdout.strip()==b'200'
old=inspect(name); peer=inspect(other)
assert old['State']['Health']['Status']=='healthy'
assert peer['State']['Health']['Status']=='healthy' and ready(other)
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
print(json.dumps({'event':'begin','role':role,'at':start,'old_id':old['Id'],'peer_id':peer['Id'],'image_id':old['Image'],'peer_health_200':True}),flush=True)
p=subprocess.run(['docker','compose','up','-d','--no-deps','--no-build','--pull','never',role],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
assert p.returncode==0, 'Compose recreation failed; output suppressed'
deadline=time.monotonic()+300; samples=0
while time.monotonic()<deadline:
 current_peer=inspect(other)
 assert current_peer['Id']==peer['Id'] and current_peer['State']['Running'] and ready(other), 'Peer failed serving check; stop rollout'
 samples+=1
 new=inspect(name)
 assert new['Image']==old['Image'], 'Image changed unexpectedly'
 assert new['State']['Running'] and new['RestartCount']==0, 'New container stopped or restarted'
 logs=subprocess.run(['docker','logs',name],stdout=subprocess.PIPE,stderr=subprocess.PIPE).stdout
 if new['State'].get('Health',{}).get('Status')=='healthy' and b'Search ranking: query models ready' in logs and ready(name):
  assert new['Id']!=old['Id']
  print(json.dumps({'event':'ready','role':role,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'new_id':new['Id'],'image_id':new['Image'],'query_models_ready':True,'readiness_200':True,'peer_same_container_and_serving_200_samples':samples}),flush=True)
  break
 if samples%5==0:print(json.dumps({'event':'waiting','role':role,'health':new['State'].get('Health',{}).get('Status'),'peer_200_samples':samples}),flush=True)
 time.sleep(3)
else:raise SystemExit('Readiness deadline exceeded; peer not recreated')
