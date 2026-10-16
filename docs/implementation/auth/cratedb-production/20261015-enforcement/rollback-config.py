import pathlib,os,json,subprocess,stat
root=pathlib.Path('/root/goodwatch/goodwatch-monorepo/goodwatch-crate');node='crate-0'+str(host-10);os.chdir(root)
x=json.loads(subprocess.check_output(['docker','inspect',node]))[0];assert x['State']['Running'] and '-Cauth.host_based.enabled=true' in x['Config']['Cmd']
p=root/'.env';mode=stat.S_IMODE(p.stat().st_mode);lines=p.read_text().splitlines();assert lines.count('CRATE_HBA_ENABLED=true')==1
lines=[('CRATE_HBA_ENABLED=false' if x=='CRATE_HBA_ENABLED=true' else x) for x in lines]
tmp=root/'.env.562-rollback';tmp.write_text('\n'.join(lines)+'\n');os.chmod(tmp,mode);os.replace(tmp,p)
render=json.loads(subprocess.check_output(['docker','compose','-f','docker-compose.yml','-p','goodwatch-crate','config','--format','json']))
expected=[('-Cauth.host_based.enabled=false' if x=='-Cauth.host_based.enabled=true' else x) for x in x['Config']['Cmd']]
assert render['services']['cratedb']['command']==expected
r=subprocess.run(['docker','update','--restart=no',node],capture_output=True);assert r.returncode==0
print(json.dumps({'node':node,'hba_false_configured_for_rollback_restart':True,'restart_policy':'no'}))
