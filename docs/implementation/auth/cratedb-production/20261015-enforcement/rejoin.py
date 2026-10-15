from ops import *
target=int(sys.argv[1]);observer=11 if target!=11 else 12;name='crate-0'+str(target-10);enabled=sys.argv[2] if len(sys.argv)>2 else 'true'
source='''import pathlib,subprocess,json,os
root=pathlib.Path('/root/goodwatch/goodwatch-monorepo/goodwatch-crate');os.chdir(root)
record=pathlib.Path('/root/cratedb-maintenance/562-enforce-20261015')
before=json.loads((record/'runtime.json').read_text())
x=json.loads(subprocess.check_output(['docker','inspect',node]))[0];assert not x['State']['Running'] and x['Name']=='/'+node
assert x['Config']['Labels']['com.docker.compose.project']=='goodwatch-crate'
assert any(m.get('Name')=='goodwatch-crate_crate_data' and m['Destination']=='/data' for m in x['Mounts'])
r=subprocess.run(['docker','compose','-f','docker-compose.yml','-p','goodwatch-crate','up','-d','--no-deps','--force-recreate','cratedb'],text=True,capture_output=True)
assert r.returncode==0,'compose start failed; details suppressed'
x=json.loads(subprocess.check_output(['docker','inspect',node]))[0]
assert x['State']['Running'] and x['HostConfig']['RestartPolicy']['Name']=='always'
for k in ('PortBindings','Memory','MemorySwap','LogConfig'):assert x['HostConfig'][k]==before['HostConfig'][k],k+' changed'
assert x['Image']==before['Image'] and sorted(x['Mounts'],key=lambda m:m['Destination'])==sorted(before['Mounts'],key=lambda m:m['Destination'])
assert sorted(x['Config']['Env'])==sorted(before['Config']['Env'])
render=json.loads(subprocess.check_output(['docker','compose','-f','docker-compose.yml','-p','goodwatch-crate','config','--format','json']))
assert x['Config']['Cmd']==render['services']['cratedb']['command']
assert '-Cauth.host_based.enabled='+enabled in x['Config']['Cmd'] and not any('#' in a for a in x['Config']['Cmd'])
print(json.dumps({'node':node,'phase':'started','hba':enabled,'container_id':x['Id'],'started_at':x['State']['StartedAt'],'image_mount_bindings_env_preserved':True}))
'''
print(remote(target,'node='+repr(name)+'\nenabled='+repr(enabled)+'\n'+source),end='',flush=True)
expected={11:'xlclgwGeSHe18p5J4WvfFA',12:'r0IgCe17SPOgudkQIGsRQA',13:'ch8EXZwrQVmCls79_T_vUg'}
deadline=time.monotonic()+240
while time.monotonic()<deadline:
 rows=sql(observer,"SELECT id,name,version['number'] FROM sys.nodes")['rows']
 if [expected[target],name,'5.10.16'] in rows:
  try:admin=sql(target,'SELECT current_user')['rows']
  except Exception:admin=[]
  if admin==[['crate']]:
   users=sql(target,'SELECT name FROM sys.users')['rows']
   if all([u] in users for u in ('admin','goodwatch_search','goodwatch_windmill','goodwatch_backup','goodwatch_monitoring','goodwatch_readonly')):
    emit(target=name,phase='original-id-rejoined',admin=admin,users_ready=True);break
 time.sleep(5)
else:raise SystemExit('STOP: rejoin timeout')
