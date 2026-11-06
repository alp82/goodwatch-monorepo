import datetime, hashlib, json, os, pathlib, re, shutil, subprocess, tempfile

base = pathlib.Path('/root/goodwatch/goodwatch-monorepo/goodwatch-search')
os.chdir(base)
required = ['BETTER_AUTH_ENABLED', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL',
 'AUTH_CRATEDB_ORIGINS', 'AUTH_CRATEDB_USERNAME', 'AUTH_CRATEDB_PASSWORD',
 'AUTH_CRATEDB_ENCRYPTION_SECRET', 'AUTH_CRATEDB_ENCRYPTION_KEYS',
 'AUTH_TRUSTED_IP_HEADER', 'AUTH_GOOGLE_CLIENT_ID', 'AUTH_GOOGLE_CLIENT_SECRET',
 'AUTH_SMTP_USER', 'AUTH_SMTP_PASSWORD', 'MCP_RESOURCE_URL']
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
rollback = pathlib.Path('/root/.config/goodwatch/mcp-launch-' + stamp)
rollback.mkdir(mode=0o700)
env_path = base / '.env'
original = env_path.read_bytes()
assert env_path.stat().st_uid == 0 and env_path.stat().st_mode & 0o777 == 0o600
backup = rollback / 'search.env.before'
shutil.copy2(env_path, backup)
os.chmod(backup, 0o600)
assert backup.read_bytes() == original
print(json.dumps({'backup':str(backup), 'owner_uid':backup.stat().st_uid, 'file_mode':'0600', 'directory_mode':'0700', 'backup_sha256':hashlib.sha256(original).hexdigest()}), flush=True)

pages = subprocess.check_output(['docker','ps','--filter','name=^gk4owk8-','--format','{{.Names}}'], text=True).splitlines()
assert len(pages) == 1
page = pages[0]
existing_names = set(re.findall(rb'^([A-Za-z_][A-Za-z0-9_]*)=', original, re.M))
assert not any(k.encode() in existing_names for k in required + ['REC_CONNECTOR']), 'Expected all new entries to be absent'

def config():
 p = subprocess.run(['docker','compose','config','--format','json'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
 assert p.returncode == 0, 'Compose config validation failed (output suppressed)'
 return json.loads(p.stdout)

before = config()
values = {}
for key in required:
 p = subprocess.run(['docker','exec',page,'printenv',key], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
 assert p.returncode == 0 and p.stdout.endswith(b'\n'), 'Source entry absent: '+key
 value = p.stdout[:-1].decode()
 assert value and '\n' not in value and '\r' not in value and "'" not in value, 'Unsupported source quoting: '+key
 values[key] = value
assert values['BETTER_AUTH_ENABLED'] == 'true'
assert values['MCP_RESOURCE_URL'] == 'https://goodwatch.app/mcp'
values['REC_CONNECTOR'] = 'on'
updated = original + (b'' if original.endswith(b'\n') else b'\n') + b'\n# Q49: shared Better Auth runtime for MCP on the search roles.\n'
for key,value in values.items():
 updated += (key + "='" + value + "'\n").encode()
assert updated.startswith(original)
fd, temp = tempfile.mkstemp(prefix='.env.mcp-', dir=base)
try:
 os.fchmod(fd, 0o600)
 with os.fdopen(fd,'wb') as f:
  f.write(updated); f.flush(); os.fsync(f.fileno())
 os.replace(temp,env_path)
 after = config()
 for role in ['search-a','search-b']:
  old = before['services'][role]['environment']
  new = after['services'][role]['environment']
  assert all(new.get(k) == v for k,v in old.items()), 'Existing resolved environment changed'
  assert all(new.get(k) == v for k,v in values.items()), 'New resolved environment mismatch'
  assert before['services'][role]['image'] == after['services'][role]['image']
 assert env_path.read_bytes().startswith(original)
except BaseException:
 shutil.copy2(backup,env_path)
 if os.path.exists(temp): os.unlink(temp)
 raise
print(json.dumps({'source_page':page,'added_names':list(values),'all_added_compose_values_hash_match':True,'every_existing_byte_and_resolved_entry_unchanged':True,'image_configuration_unchanged':True,'file_mode':oct(env_path.stat().st_mode & 0o777)}), flush=True)

# Restore only the missing local tag to the exact image already used by both roles.
roles = [json.loads(subprocess.check_output(['docker','inspect',name]))[0] for name in ['goodwatch-search-a','goodwatch-search-b']]
assert roles[0]['Image'] == roles[1]['Image']
tag = before['services']['search-a']['image']
assert all(r['Config']['Image'] == tag for r in roles)
found = subprocess.run(['docker','image','inspect',tag],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
if found.returncode:
 subprocess.run(['docker','image','tag',roles[0]['Image'],tag],check=True)
else:
 assert json.loads(found.stdout)[0]['Id'] == roles[0]['Image']
print(json.dumps({'local_tag':tag,'same_image_id':roles[0]['Image'],'pull_or_image_change':False}),flush=True)
