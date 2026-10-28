#!/usr/bin/env python3
"""Local-only #782 lab. Never imports application modules, env files, SSH or production clients."""
import argparse, concurrent.futures, datetime, hashlib, ipaddress, json, os
from pathlib import Path
import shutil, subprocess, threading, time, urllib.request, urllib.error

ROOT = Path.home() / '.cache/gw-work/782-lab'
HERE = Path(__file__).resolve().parent
NET = 'gw782-isolated-20261028'
LABEL = 'goodwatch.issue782=true'
NAMES = [f'gw782-crate-{i}' for i in (1, 2, 3)]
IMAGES = {
 '5.10.16': 'crate:5.10.16@sha256:5d7cd92eb84d56d538e2222a436e432164b853fdf186aebb17c446787f23a307',
 '6.4.6': 'crate:6.4.6@sha256:8d3e8778378236192724776877d2ea4546d5b5586362c8d174e6aa46177bb0fb',
}
SHOWS, EPISODES, SEASONS = 2491, 195382, 11212
STALE_EP, STALE_SEASON = 133, 20
FULL_EP, FULL_SEASON = 825015, 77256
TABLES = ['imdb_episode', 'imdb_season', 'crawl_priority']
PASSWORD = 'disposable-local-782'
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  raise RuntimeError('Lab SQL redirects are forbidden')

OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())


def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def event(**x):
 x = {'utc': now(), **x}
 with (ROOT / 'events.jsonl').open('a') as f: f.write(json.dumps(x) + '\n')
 print(json.dumps(x), flush=True)
def save(name, obj): (ROOT / name).write_text(json.dumps(obj, indent=2) + '\n')
def docker(*args, timeout=180):
 r = subprocess.run(['docker', *args], capture_output=True, text=True, timeout=timeout)
 if r.returncode: raise RuntimeError(r.stderr[-2000:])
 return r.stdout.strip()
def state(): return json.loads((ROOT / 'state.json').read_text())
def sql(stmt, args=None, node=0, timeout=180, bulk_args=None):
 s = state(); host = s['ips'][node]
 assert ipaddress.ip_address(host) in ipaddress.ip_network(s['subnet'])
 assert not ipaddress.ip_address(host) in ipaddress.ip_network('10.0.0.0/8')
 req = urllib.request.Request('http://' + host + ':4200/_sql', data=json.dumps({'stmt':stmt,**({'bulk_args':bulk_args}if bulk_args is not None else {'args':args or []})}).encode(), headers={'Content-Type': 'application/json'})
 try:
  with OPENER.open(req, timeout=timeout) as f: result = json.load(f)
 except urllib.error.HTTPError as e: raise RuntimeError(e.read().decode()[:2500]) from e
 if 'error' in result: raise RuntimeError(result['error'])
 return result

def topology():
 net = json.loads(docker('network', 'inspect', NET))[0]
 assert net['Internal'] and net['Labels'].get('goodwatch.issue782') == 'true'
 subnet = net['IPAM']['Config'][0]['Subnet']; ips = []
 for name in NAMES:
  d = json.loads(docker('inspect', name))[0]
  assert d['Config']['Labels'].get('goodwatch.issue782') == 'true'
  assert set(d['NetworkSettings']['Networks']) == {NET} and not d['HostConfig']['PortBindings']
  assert d['HostConfig']['Memory'] == 4 * 1024**3
  ips.append(d['NetworkSettings']['Networks'][NET]['IPAddress'])
 return {'subnet': subnet, 'ips': ips, 'internal': True, 'published_ports': False}

def start(version):
 assert version in IMAGES
 assert not docker('ps', '-aq', '--filter', 'label=' + LABEL), 'Owned cluster already exists'
 if not docker('network', 'ls', '-q', '--filter', 'name=^' + NET + '$'):
  docker('network', 'create', '--internal', '--label', LABEL, NET)
 repo = ROOT / 'repository'; repo.mkdir(exist_ok=True); repo.chmod(0o777)
 for name in NAMES:
  data = ROOT / ('data-' + version) / name; data.mkdir(parents=True, exist_ok=True); data.chmod(0o777)
  image = json.loads(docker('image', 'inspect', IMAGES[version]))[0]
  assert image['Architecture'] == 'amd64'
  docker('run', '-d', '--name', name, '--label', LABEL, '--network', NET,
   '--memory', '4g', '--cpus', '4', '--ulimit', 'nofile=65536:65536',
   '-e', 'CRATE_HEAP_SIZE=2g', '-e', 'JAVA_TOOL_OPTIONS=-XX:ActiveProcessorCount=16',
   '--mount', f'type=bind,src={data},dst=/data', '--mount', f'type=bind,src={repo},dst=/snapshots',
   IMAGES[version], '-Ccluster.name=gw782-lab', '-Cnode.name=' + name,
   '-Cnetwork.host=0.0.0.0', '-Cpath.data=/data', '-Cpath.repo=/snapshots',
   '-Cdiscovery.seed_hosts=' + ','.join(NAMES), '-Ccluster.initial_master_nodes=' + ','.join(NAMES),
   '-Cgateway.expected_data_nodes=3', '-Cgateway.recover_after_data_nodes=2', '-Cudc.enabled=false')
 s = {'version': version, **topology()}; save('state.json', s)
 until = time.monotonic() + 240
 while time.monotonic() < until:
  try:
   if sql('SELECT count(*) FROM sys.nodes', timeout=5)['rows'] == [[3]]: break
  except Exception: pass
  time.sleep(1)
 else: raise TimeoutError('Local cluster failed to form')
 if not sql("SELECT name FROM sys.users WHERE name='lab782'")['rows']:
  sql("CREATE USER lab782 WITH (password='" + PASSWORD + "')")
 sql('GRANT ALL TO lab782')
 save('topology-' + version + '.json', {'utc': now(), 'isolation': s, 'nodes': sql("SELECT name,version['number'],os_info,thread_pools FROM sys.nodes ORDER BY name"), 'containers': [json.loads(docker('inspect', n))[0]['HostConfig']['PortBindings'] for n in NAMES]})
 event(action='started', version=version, ips=s['ips'], image=IMAGES[version])

def health():
 until = time.monotonic() + 240
 while time.monotonic() < until:
  h = sql('SELECT health,count(*),sum(missing_shards),sum(underreplicated_shards) FROM sys.health GROUP BY health')['rows']
  if h == [['GREEN', 3, 0, 0]]:
   rows = sql('SELECT state,routing_state,count(*) FROM sys.shards GROUP BY state,routing_state')['rows']
   if all(r[:2] == ['STARTED','STARTED'] for r in rows): return
  time.sleep(1)
 raise TimeoutError('Lab did not reach GREEN')

def seed():
 assert state()['version'] == '5.10.16'
 schemas = json.loads((HERE / 'schemas.json').read_text())
 for t in TABLES: sql(schemas[t])
 # Changed subset: exact retained rows; other shows model the real whole-table scan domain.
 def episodes(n, shows, offset, prefix):
  g = 'generate_series'; show = f'(({g}-1)%{shows}+{offset})::integer'; ep = f'floor(({g}-1)/{shows}.0)::integer+1'
  return sql(f"INSERT INTO imdb_episode (show_id,imdb_episode_id,imdb_show_id,season_number,episode_number,name,imdb_user_score_original,imdb_user_score_rating_count) SELECT {show},'{prefix}'||{g}::text,'ttshow'||({show})::text,CASE WHEN ({ep})%23=0 THEN NULL ELSE (({ep})/18)::integer+1 END,{ep},'Synthetic episode '||{g}::text,7.5,1000 FROM generate_series(1,{n})", timeout=600)
 def seasons(n, shows, offset):
  return sql(f"INSERT INTO imdb_season (show_id,season_number,imdb_show_id,imdb_user_score_original,imdb_user_score_rating_count,imdb_rated_episode_count,max_episode_number) SELECT ((generate_series-1)%{shows}+{offset})::integer,floor((generate_series-1)/{shows}.0)::integer+1,'ttshow'||((generate_series-1)%{shows}+{offset})::text,7.5,10000,18,18 FROM generate_series(1,{n})", timeout=600)
 event(action='seed-changed', episode=episodes(EPISODES, SHOWS, 1, 'tte'), season=seasons(SEASONS, SHOWS, 1))
 event(action='seed-background', episode=episodes(FULL_EP-EPISODES-STALE_EP, 20000, SHOWS+1, 'ttbackground'), season=seasons(FULL_SEASON-SEASONS-STALE_SEASON, 20000, SHOWS+1))
 sql(f"INSERT INTO imdb_episode (show_id,imdb_episode_id,imdb_show_id,name) SELECT ((generate_series-1)*17%2491+1)::integer,'stale'||generate_series::text,'ttstale','Delete me' FROM generate_series(1,{STALE_EP})")
 sql(f"INSERT INTO imdb_season (show_id,season_number,imdb_show_id) SELECT ((generate_series-1)*113%2491+1)::integer,99,'ttstale' FROM generate_series(1,{STALE_SEASON})")
 # Real priority schema, two media types and enough rows for meaningful ranking/paging.
 sql("INSERT INTO crawl_priority (media_type,tmdb_id,demand,acknowledged_demand) SELECT 'movie',generate_series::integer,(generate_series%1000+1)::bigint,0 FROM generate_series(1,100000)", timeout=600)
 sql("INSERT INTO crawl_priority (media_type,tmdb_id,demand,acknowledged_demand) SELECT 'show',generate_series::integer,(generate_series%1000+1)::bigint,0 FROM generate_series(1,60000)", timeout=600)
 sql('REFRESH TABLE imdb_episode,imdb_season,crawl_priority'); health()
 sql('OPTIMIZE TABLE imdb_episode,imdb_season,crawl_priority WITH (max_num_segments=1)', timeout=600)
 sql('ANALYZE', timeout=600)
 counts = {t: sql('SELECT count(*) FROM ' + t)['rows'][0][0] for t in TABLES}
 assert counts == {'imdb_episode': FULL_EP, 'imdb_season': FULL_SEASON, 'crawl_priority': 160000}, counts
 sql("CREATE REPOSITORY lab782 TYPE fs WITH (location='/snapshots')")
 sql('CREATE SNAPSHOT lab782.baseline ALL WITH (wait_for_completion=true)', timeout=600)
 save('seed.json', {'utc': now(), 'counts': counts, 'changed_shows': SHOWS, 'kept_episodes': EPISODES, 'kept_seasons': SEASONS, 'stale': [STALE_EP, STALE_SEASON], 'snapshot': sql('SELECT name,state,total_shards,failures FROM sys.snapshots')})
 event(action='seed-complete', counts=counts)

def restore():
 for t in TABLES: sql('DROP TABLE IF EXISTS '+t)
 if not sql("SELECT name FROM sys.repositories WHERE name='lab782'")['rows']:
  sql("CREATE REPOSITORY lab782 TYPE fs WITH (location='/snapshots',readonly=true)")
 sql('RESTORE SNAPSHOT lab782.baseline TABLE doc.imdb_episode,doc.imdb_season,doc.crawl_priority WITH (wait_for_completion=true)', timeout=600)
 health();sql('ANALYZE', timeout=600)
 for t, expected in [('imdb_episode',FULL_EP),('imdb_season',FULL_SEASON),('crawl_priority',160000)]:
  assert sql('SELECT count(*) FROM '+t)['rows']==[[expected]],t
 event(action='restored',version=state()['version'])

def stop():
 for name in NAMES:
  if docker('ps','-aq','--filter','name=^'+name+'$'):
   d=json.loads(docker('inspect',name))[0];assert d['Config']['Labels'].get('goodwatch.issue782')=='true'
   docker('stop','--timeout=-1',name,timeout=180);docker('rm','-v',name)
 event(action='stopped-local-cluster')

def cleanup():
 stop()
 if docker('network','ls','-q','--filter','name=^'+NET+'$'):
  d=json.loads(docker('network','inspect',NET))[0];assert d['Internal']and d['Labels'].get('goodwatch.issue782')=='true';docker('network','rm',NET)
 # Only task-owned bind data and the local snapshot; keep JSON evidence and code.
 for p in ROOT.glob('data-*'):
  assert p.resolve().parent==ROOT.resolve();shutil.rmtree(p)
 shutil.rmtree(ROOT/'repository',ignore_errors=True)
 save('cleanup.json',{'utc':now(),'containers_remaining':docker('ps','-aq','--filter','label='+LABEL),'network_remaining':docker('network','ls','-q','--filter','name=^'+NET+'$'),'data_dirs_remaining':[str(p)for p in ROOT.glob('data-*')],'snapshot_data_remaining':(ROOT/'repository').exists()})

if __name__=='__main__':
 ROOT.mkdir(parents=True,exist_ok=True);os.environ['TMPDIR']=str(ROOT)
 p=argparse.ArgumentParser();p.add_argument('action',choices=['start','seed','restore','stop','cleanup']);p.add_argument('version',nargs='?');a=p.parse_args()
 {'start':lambda:start(a.version),'seed':seed,'restore':restore,'stop':stop,'cleanup':cleanup}[a.action]()
