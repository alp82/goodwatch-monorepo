import pathlib,subprocess,json,os,hashlib,shlex,datetime
root=pathlib.Path('/root/goodwatch/goodwatch-monorepo/goodwatch-crate');os.chdir(root)
node='crate-0'+str(host-10)
record=pathlib.Path('/root/cratedb-maintenance/562-enforce-20261015')
record.mkdir(mode=0o700,parents=True,exist_ok=False)
for name in ('.env','docker-compose.yml'):
 src=root/name;dst=record/name;dst.write_bytes(src.read_bytes());os.chmod(dst,0o600)
runtime=json.loads(subprocess.check_output(['docker','inspect',node]))[0]
(record/'runtime.json').write_text(json.dumps(runtime));os.chmod(record/'runtime.json',0o600)
assert runtime['State']['Running'] and runtime['HostConfig']['RestartPolicy']['Name']=='always'
assert runtime['Config'].get('StopSignal','SIGTERM') in ('','SIGTERM','15')
assert runtime['Config']['Image']=='crate:5.10.16@sha256:5d7cd92eb84d56d538e2222a436e432164b853fdf186aebb17c446787f23a307'
reviewed=record/'docker-compose.yml.reviewed';reviewed.write_text(compose_source);os.chmod(reviewed,0o600)
def render(path,enabled=None):
 env=os.environ.copy()
 if enabled is not None:env['CRATE_HBA_ENABLED']=enabled
 p=subprocess.run(['docker','compose','--env-file',str(root/'.env'),'-f',str(path),'-p','goodwatch-crate','config','--format','json'],env=env,text=True,capture_output=True)
 assert p.returncode==0,'render failed'
 return json.loads(p.stdout)
a=render(root/'docker-compose.yml');b=render(reviewed,'true')
sa=a['services']['cratedb'];sb=b['services']['cratedb']
ca=sa.pop('command');cb=sb.pop('command')
assert sa==sb,'STOP: non-command compose configuration changed'
assert a==b,'STOP: non-service compose configuration changed'
assert ca==runtime['Config']['Cmd'],'STOP: baseline compose command differs from runtime'
cut=ca.index('#');assert ca[:cut]==cb[:cut],'STOP: pre-HBA argv changed'
assert cb[cut:]==['-Cauth.host_based.enabled=true','-Cauth.host_based.config.0.user=crate','-Cauth.host_based.config.0.address=127.0.0.1','-Cauth.host_based.config.0.method=trust','-Cauth.host_based.config.1.method=password']
assert all(x['HostIp']=='10.0.0.'+str(host) for entries in runtime['HostConfig']['PortBindings'].values() for x in entries)
assert any(x['Destination']=='/data' and x['Type']=='volume' for x in runtime['Mounts'])
assert any(x['Destination']=='/snapshots' and x['Source']=='/mnt/backup-cratedb/snapshots' for x in runtime['Mounts'])
assert subprocess.run(['mountpoint','-q','/mnt/backup-cratedb']).returncode==0
print(json.dumps({'host':host,'node':node,'record':str(record),'compose_sha256':hashlib.sha256(compose_source.encode()).hexdigest(),'only_hba_argv_changes':True,'runtime_image_volume_bindings_preserved':True,'stop_signal':runtime['Config'].get('StopSignal') or 'SIGTERM default','started_at':runtime['State']['StartedAt'],'container_id':runtime['Id'],'snapshot_mount_present':True}),flush=True)
