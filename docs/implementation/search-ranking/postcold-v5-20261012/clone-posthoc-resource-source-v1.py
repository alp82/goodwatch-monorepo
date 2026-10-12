import json,hashlib,subprocess,os,datetime
from pathlib import Path
i=json.loads(subprocess.check_output(['/usr/bin/docker','inspect','gw-qdrant-cold-406-20261011'],stderr=subprocess.DEVNULL,timeout=10))[0]
assert i['State']['Running'] is True and i['State']['Pid']==3753493 and i['Image']=='sha256:dd57172b0bbebb29b0a96a37c1f378a317449730c36cdfe68feabe36e740a92b'
p=Path('/proc/3753493')
def ticks():return int((p/'stat').read_text().rsplit(')',1)[1].split()[19])
assert ticks()==3064508046
lines=(p/'cgroup').read_text().splitlines();groups=[v.split(':',2)[2] for v in lines if v.startswith('0::')];assert len(groups)==1 and groups[0].startswith('/') and '..' not in groups[0].split('/')
g=Path('/sys/fs/cgroup')/groups[0].lstrip('/');assert g.resolve()==g
def nums(name):return {a:int(b) for a,b in (v.split() for v in (g/name).read_text().splitlines())}
mem=nums('memory.events');cpu=nums('cpu.stat');current=int((g/'memory.current').read_text());assert ticks()==3064508046
print(json.dumps({'event':'clone.posthoc-resource.v1','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourcePid':3753493,'sourceStartTicks':3064508046,'posthocOnly':True,'exactFailedIntervalEstablished':False,'memoryEvents':{k:mem[k] for k in ('max','oom','oom_kill')},'cpuEvents':{k:cpu[k] for k in ('nr_throttled','throttled_usec')},'memoryCurrentBytes':current,'memoryMaxBytes':int((g/'memory.max').read_text()),'cpuMax':(g/'cpu.max').read_text().strip(),'sourceMemberCount':len((g/'cgroup.procs').read_text().split()),'hostWrites':0,'queries':0}))
