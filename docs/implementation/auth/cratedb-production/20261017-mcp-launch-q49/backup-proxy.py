import datetime,hashlib,json,os,pathlib,shutil,sys
name=sys.argv[1]
assert name in ['goodwatch-search.yaml','goodwatch-search-instance.yaml']
source=pathlib.Path('/data/coolify/proxy/dynamic')/name
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
folder=pathlib.Path('/root/.config/goodwatch/mcp-launch-proxy-'+stamp)
folder.mkdir(mode=0o700)
backup=folder/name
shutil.copy2(source,backup)
os.chown(backup,0,0);os.chmod(backup,0o600)
assert source.read_bytes()==backup.read_bytes()
print(json.dumps({'source':str(source),'rollback_copy':str(backup),'owner_uid':backup.stat().st_uid,'file_mode':oct(backup.stat().st_mode&0o777),'directory_mode':oct(folder.stat().st_mode&0o777),'sha256':hashlib.sha256(backup.read_bytes()).hexdigest()}))
