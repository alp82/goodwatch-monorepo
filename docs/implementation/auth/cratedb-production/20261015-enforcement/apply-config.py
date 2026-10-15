import pathlib,os,json,subprocess,stat
root=pathlib.Path('/root/goodwatch/goodwatch-monorepo/goodwatch-crate');record=pathlib.Path('/root/cratedb-maintenance/562-enforce-20261015');os.chdir(root)
node='crate-0'+str(host-10)
before=json.loads((record/'runtime.json').read_text());current=json.loads(subprocess.check_output(['docker','inspect',node]))[0]
assert current['Id']==before['Id'] and current['State']['Running']
assert (root/'.env').read_bytes()==(record/'.env').read_bytes()
assert (root/'docker-compose.yml').read_bytes()==(record/'docker-compose.yml').read_bytes()
p=root/'.env';mode=stat.S_IMODE(p.stat().st_mode);lines=p.read_text().splitlines();assert sum(x.startswith('CRATE_HBA_ENABLED=') for x in lines)<=1
lines=[x for x in lines if not x.startswith('CRATE_HBA_ENABLED=')]+['CRATE_HBA_ENABLED=true']
tmp=root/'.env.562-staged';tmp.write_text('\n'.join(lines)+'\n');os.chmod(tmp,mode);os.replace(tmp,p)
p=root/'docker-compose.yml';mode=stat.S_IMODE(p.stat().st_mode);tmp=root/'docker-compose.yml.562-staged';tmp.write_bytes((record/'docker-compose.yml.reviewed').read_bytes());os.chmod(tmp,mode);os.replace(tmp,p)
r=subprocess.run(['docker','compose','-f','docker-compose.yml','-p','goodwatch-crate','config','--format','json'],text=True,capture_output=True);assert r.returncode==0
render=json.loads(r.stdout);assert '-Cauth.host_based.enabled=true' in render['services']['cratedb']['command']
(record/'rendered-enforcing.json').write_text(r.stdout);os.chmod(record/'rendered-enforcing.json',0o600)
r=subprocess.run(['docker','update','--restart=no',node],capture_output=True);assert r.returncode==0
print(json.dumps({'node':node,'config_staged_for_restart':True,'hba_runtime_still_off':True,'restart_policy':'no'}),flush=True)
