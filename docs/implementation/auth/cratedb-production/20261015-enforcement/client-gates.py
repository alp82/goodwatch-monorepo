from ops import *
def gate_remote(host,source):
 r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@10.0.0.'+str(host),'python3','-'],input=source,text=True,capture_output=True)
 if r.returncode:
  # Only gate scripts emit sanitized records; the secret-fetch path still uses remote().
  print(r.stdout,end='',flush=True)
  raise SystemExit('STOP: client enforcement gate failed on host '+str(host)+'; details suppressed')
 return r.stdout
target=int(sys.argv[1]);endpoint='10.0.0.'+str(target)
# Actual page/search containers, retaining runtime credentials; output contains only status/identity.
verifier=pathlib.Path('docs/implementation/auth/verify_crate_endpoints.mjs').read_text()
for host in (21,20):
 src='''import subprocess,json
names=subprocess.check_output(['docker','ps','--format','{{.Names}}'],text=True).splitlines()
chosen=[n for n in names if n.startswith('gk4owk8-') or (host==20 and n in ('goodwatch-search-a','goodwatch-search-b'))]
assert any(n.startswith('gk4owk8-') for n in chosen)
if host==20:assert all(n in chosen for n in ('goodwatch-search-a','goodwatch-search-b'))
for name in chosen:
 r=subprocess.run(['docker','exec','-i','-e','CRATE_VERIFY_HOSTS='+endpoint,'-e','CRATE_VERIFY_MODE=enforcement',name,'node','--input-type=module'],input=verifier,text=True,capture_output=True)
 for line in r.stdout.splitlines():
  d=json.loads(line);d['container']=name;d['source_host']=host;print(json.dumps(d),flush=True)
 if r.returncode:raise SystemExit('STOP: app client enforcement failed for '+name)
'''
 print(gate_remote(host,'host='+str(host)+'\nendpoint='+repr(endpoint)+'\nverifier='+repr(verifier)+'\n'+src),end='',flush=True)
# Stored Windmill variable fetched through its API; never written to a local file.
values=json.loads(remote(10,pathlib.Path('/tmp/gw-562-resume/get-windmill-values.py').read_text()))
probe=(ROOT/'http-auth.py').read_text()
source='endpoint='+repr(endpoint)+'\nclient="windmill-worker"\nuser='+repr(values['USER'])+'\npassword='+repr(values['PASS'])+'\n'+probe
src='''import subprocess
r=subprocess.run(['docker','exec','-i','windmill-default_worker-1','python3','-'],input=source,text=True,capture_output=True)
print(r.stdout,end='')
if r.returncode:raise SystemExit('STOP: worker enforcement failed')
'''
print(gate_remote(10,'source='+repr(source)+'\n'+src),end='',flush=True)
# Actual installed backup credential and helper, restricted to only the target.
src='''import sys
sys.path.insert(0,'/root/goodwatch/goodwatch-monorepo/goodwatch-crate');import backup
backup.configure_auth({'CRATE_BACKUP_USER':'goodwatch_backup','CRATE_BACKUP_PASSWORD_FILE':'/root/.config/goodwatch/crate-backup-password'})
user,password=[v.decode() for v in backup.AUTH];client='backup'
exec(probe)
backup.SQL_URLS=['http://'+endpoint+':4200/_sql']
d=backup.run_sql('SELECT name,state FROM sys.snapshots ORDER BY started DESC LIMIT 1',timeout=300)
assert d and 'rows' in d
print(json.dumps({'endpoint':endpoint,'client':'backup','snapshot_read':True}),flush=True)
'''
# uv ensures the same requests dependency as the installed backup script.
r=subprocess.run(['ssh','root@10.0.0.11','/root/.local/bin/uv','run','--with','requests','python','-'],input='endpoint='+repr(endpoint)+'\nprobe='+repr(probe)+'\n'+src,text=True,capture_output=True)
print(r.stdout,end='',flush=True)
if r.returncode:raise SystemExit('STOP: backup enforcement failed')
# Actual Kuma stored monitor fields, read-only SQLite connection.
src='''import sqlite3,pathlib
p=pathlib.Path('/var/lib/docker/volumes/goodwatch-monitoring_uptime-kuma-data/_data/kuma.db')
c=sqlite3.connect(p.as_uri()+'?mode=ro',uri=True)
for monitor in (16,17,18):
 user,password=c.execute('SELECT basic_auth_user,basic_auth_pass FROM monitor WHERE id=?',(monitor,)).fetchone()
 assert user=='goodwatch_monitoring';client='kuma-'+str(monitor)
 exec(probe)
'''
print(gate_remote(10,'endpoint='+repr(endpoint)+'\nmonitor='+str(target+5)+'\nprobe='+repr(probe)+'\n'+src),end='',flush=True)
# Real root-only script profiles on abio and vector1.
for host in (21,20):
 src='''import pathlib,shlex
vals={}
for line in pathlib.Path('/root/.config/goodwatch/crate-readonly.env').read_text().splitlines():
 if line and not line.startswith('#'):
  k,v=line.split('=',1);vals[k]=shlex.split(v)[0] if v else ''
user=vals['CRATE_USER'];password=vals['CRATE_PASS'];client='readonly-scripts'
assert user=='goodwatch_readonly';exec(probe)
'''
 print(gate_remote(host,'endpoint='+repr(endpoint)+'\nprobe='+repr(probe)+'\n'+src),end='',flush=True)
# Canonical dedicated roles, including optional webapp, to cover every newly provisioned secret.
src='''import pathlib
for user in ('goodwatch_webapp','goodwatch_search','goodwatch_windmill','goodwatch_backup','goodwatch_monitoring','goodwatch_readonly'):
 password=pathlib.Path('/root/.config/goodwatch/crate-credentials',user).read_text().rstrip('\\n');client='canonical-'+user;exec(probe)
'''
print(gate_remote(11,'endpoint='+repr(endpoint)+'\nprobe='+repr(probe)+'\n'+src),end='',flush=True)
emit(first_node_client_gate_passed=True,target=endpoint)
