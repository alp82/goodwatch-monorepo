from ops import *
target=int(sys.argv[1]);observer=11 if target!=11 else 12;name='crate-0'+str(target-10)
health(observer)
source="""import subprocess,json
x=json.loads(subprocess.check_output(['docker','inspect',node]))[0]
assert x['Name']=='/'+node and x['HostConfig']['RestartPolicy']['Name']=='no','STOP: restart must be disabled before drain'
print(json.dumps({'node':node,'restart_policy_checked':'no'}))
"""
print(remote(target,'node='+repr(name)+'\n'+source),end='',flush=True)
nodes=sql(observer,'SELECT id,name FROM sys.nodes')['rows'];nodeid=next(r[0] for r in nodes if r[1]==name)
assert sql(observer,"SELECT settings['cluster']['graceful_stop']['force'] FROM sys.cluster")['rows']==[[False]]
emit(target=name,id=nodeid,phase='decommission-start')
d=sql(observer,'SET GLOBAL TRANSIENT "cluster.routing.allocation.enable" = \'primaries\'');emit(phase='allocation-primaries',result=d)
start=time.monotonic();d=sql(observer,"ALTER CLUSTER DECOMMISSION '"+nodeid+"'",timeout=7500)
emit(target=name,phase='decommission-ack',result=d,seconds=time.monotonic()-start)
assert d.get('rowcount',-1)>=0
# Recheck through surviving coordinator immediately before normal SIGTERM.
prim=sql(observer,"SELECT count(*) FROM sys.shards WHERE primary = true AND node['id'] = ?",[nodeid])['rows'];assert prim==[[0]]
missing=sql(observer,'SELECT sum(missing_shards) FROM sys.health')['rows'];assert missing==[[0]]
assert sql(observer,"SELECT settings['cluster']['graceful_stop']['force'] FROM sys.cluster")['rows']==[[False]]
inbound=sql(observer,"SELECT count(*) FROM sys.shards WHERE node['id']=? AND (state <> 'STARTED' OR routing_state <> 'STARTED')",[nodeid])['rows'];assert inbound==[[0]]
emit(target=name,phase='zero-primary-gate',primaries=prim,missing=missing,unsettled_target_copies=inbound)
# Start a host-managed CLI so an SSH disconnection cannot cancel the daemon wait.
source="""import subprocess,json,time,datetime
x=json.loads(subprocess.check_output(['docker','inspect',node]))[0]
assert x['Name']=='/'+node and x['Config'].get('StopSignal','SIGTERM') in ('','SIGTERM','15')
if x['State']['Running']:
 r=subprocess.run(['systemd-run','--unit='+unit,'--property=Type=exec','--property=TimeoutStopSec=infinity','--property=SendSIGKILL=no','/usr/bin/docker','stop','--timeout=-1',node],capture_output=True)
 assert r.returncode==0,'normal-stop unit did not start'
print(json.dumps({'node':node,'phase':'normal-stop-submitted','unit':unit,'unlimited_grace':True,'ssh_independent':True}))
"""
unit='gw-crate-stop-562-'+str(target)+'-'+datetime.datetime.now(datetime.timezone.utc).strftime('%H%M%S')
event_since=datetime.datetime.now(datetime.timezone.utc).isoformat()
print(remote(target,'node='+repr(name)+'\nunit='+repr(unit)+'\n'+source),end='',flush=True)
start=time.monotonic()
while time.monotonic()-start<900:
 source="""import subprocess,json
x=json.loads(subprocess.check_output(['docker','inspect',node]))[0]['State']
print(json.dumps({k:x[k] for k in ('Running','ExitCode','OOMKilled','FinishedAt')}))
"""
 state=json.loads(remote(target,'node='+repr(name)+'\n'+source))
 if state['Running']:
  status=remote(target,"import subprocess,json; print(subprocess.check_output(['systemctl','show',"+repr(unit)+",'-p','ActiveState','-p','Result'],text=True))")
  assert 'ActiveState=failed' not in status and 'Result=exit-code' not in status,'STOP: normal-stop unit failed'
 if not state['Running']:
  assert not state['OOMKilled'] and state['ExitCode'] in (0,143)
  emit(target=name,phase='normal-exit',seconds=time.monotonic()-start,state=state);break
 time.sleep(5)
else:raise SystemExit('STOP: no exit after 15 minutes; host-managed unlimited-grace stop LEFT RUNNING')

source="""import subprocess,json,datetime
end=datetime.datetime.now(datetime.timezone.utc).isoformat()
r=subprocess.run(['docker','events','--since',since,'--until',end,'--filter','container='+node,'--format','{{json .}}'],text=True,capture_output=True)
assert r.returncode==0
for line in r.stdout.splitlines():
 e=json.loads(line);a=e.get('Actor',{}).get('Attributes',{});action=e.get('Action')
 if action in ('kill','die','stop'):
  assert not(action=='kill' and a.get('signal')=='9'),'STOP: unexpected SIGKILL event'
  print(json.dumps({'node':node,'event':action,'signal':a.get('signal'),'exit_code':a.get('exitCode'),'time':e.get('time')}))
"""
print(remote(target,'node='+repr(name)+'\nsince='+repr(event_since)+'\n'+source),end='',flush=True)
