import datetime,hashlib,json,os,pathlib,re,shutil,subprocess,tempfile
base=pathlib.Path('/root/goodwatch/goodwatch-monorepo/goodwatch-search')
os.chdir(base)
def inspect(name):return json.loads(subprocess.check_output(['docker','inspect',name]))[0]
def config():
 p=subprocess.run(['docker','compose','config','--format','json'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 assert p.returncode==0,'Compose validation failed; details suppressed'
 return json.loads(p.stdout)
pages=subprocess.check_output(['docker','ps','--filter','name=^gk4owk8-','--format','{{.Names}}'],text=True).splitlines()
assert len(pages)==1
page=inspect(pages[0]);assert page['State']['Health']['Status']=='healthy'
target=page['Config']['Image'];repository,tag=target.rsplit(':',1)
assert re.fullmatch('[a-f0-9]{40}',tag)
assert tag=='f8e37568ffb3f870be0016915beccb5334554d73','Page commit changed; recheck ancestry before upgrading'
target_image=json.loads(subprocess.check_output(['docker','image','inspect',target]))[0]
assert target_image['Id']==page['Image']
before=config();assert all(s['image'].rsplit(':',1)[0]==repository for s in before['services'].values())
env_file=base/'.env';original=env_file.read_bytes()
assert env_file.stat().st_uid==0 and env_file.stat().st_mode&0o777==0o600
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
folder=pathlib.Path('/root/.config/goodwatch/mcp-image-upgrade-'+stamp);folder.mkdir(mode=0o700)
backup=folder/'search.env.before';shutil.copy2(env_file,backup);os.chmod(backup,0o600)
assert backup.read_bytes()==original
updated,count=re.subn(rb'^SEARCH_COMMIT=.*$',b'SEARCH_COMMIT='+tag.encode(),original,flags=re.M)
assert count==1
assert re.sub(rb'^SEARCH_COMMIT=.*$',b'SEARCH_COMMIT=<tag>',original,flags=re.M)==re.sub(rb'^SEARCH_COMMIT=.*$',b'SEARCH_COMMIT=<tag>',updated,flags=re.M)
fd,temp=tempfile.mkstemp(prefix='.env.image-',dir=base)
try:
 os.fchmod(fd,0o600)
 with os.fdopen(fd,'wb') as f:f.write(updated);f.flush();os.fsync(f.fileno())
 os.replace(temp,env_file)
 after=config()
 for name in ['search-a','search-b']:
  assert after['services'][name]['image']==target
  old=before['services'][name]['environment'];new=after['services'][name]['environment']
  assert all(new.get(k)==v for k,v in old.items() if k not in ['SEARCH_COMMIT','SOURCE_COMMIT'])
  assert new['SEARCH_COMMIT']==new['SOURCE_COMMIT']==tag
except BaseException:
 shutil.copy2(backup,env_file)
 if os.path.exists(temp):os.unlink(temp)
 raise
print(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_page':pages[0],'target_image':target,'target_image_id':target_image['Id'],'repo_digests':target_image.get('RepoDigests'),'old_image':before['services']['search-a']['image'],'backup':str(backup),'backup_mode':oct(backup.stat().st_mode&0o777),'backup_dir_mode':oct(folder.stat().st_mode&0o777),'env_mode':oct(env_file.stat().st_mode&0o777),'only_env_file_change':'SEARCH_COMMIT','compose_resolves_both_roles_to_target':True,'all_other_resolved_environment_preserved':True,'pulled_image':False}),flush=True)
