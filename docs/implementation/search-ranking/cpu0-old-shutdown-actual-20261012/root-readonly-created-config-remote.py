import hashlib,json,subprocess,time
from pathlib import Path
H=lambda value:hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
child=subprocess.run(['/usr/bin/docker','inspect','gw-qdrant-cold-406-20261011','gw-qdrant-cpu0-100-20261012'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=10,env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8','DOCKER_HOST':'unix:///var/run/docker.sock'})
if child.returncode!=0 or len(child.stdout)>2*1024**2:raise RuntimeError('readonly_inspect_refused')
old,new=json.loads(child.stdout);ih=lambda value:hashlib.sha256(value.encode()).hexdigest()
if ih(old['Id'])!='30aca59a60c971e246894f614f767930190046ce3138c89e6c9ce5d64e069ff7' or ih(new['Id'])!='c67d813c0e32872228fdc13a515e49c45b3ae68166f19531ee83bcfdf69548ea':raise RuntimeError('readonly_target_changed')
a=dict(old['HostConfig']);b=dict(new['HostConfig'])
for key in ('NanoCpus','CpuQuota','CpuPeriod'):a.pop(key,None);b.pop(key,None)
diffs=[]
for key in sorted(set(a)|set(b)):
    if a.get(key)!=b.get(key) or (key in a)!=(key in b):
        x=a.get(key);y=b.get(key)
        row={'field':key,'oldPresent':key in a,'newPresent':key in b,'oldType':type(x).__name__,'newType':type(y).__name__,'oldHash':H(x),'newHash':H(y),'oldEmpty':x in (None,[],{},''),'newEmpty':y in (None,[],{},'')}
        if type(x) in (int,bool):row['oldScalar']=x
        if type(y) in (int,bool):row['newScalar']=y
        diffs.append(row)
mem={}
for line in Path('/proc/meminfo').read_text().splitlines():
    key,rest=line.split(':',1)
    if key in ('MemAvailable','MemTotal','SwapTotal'):mem[key]=int(rest.split()[0])*1024
print(json.dumps({'schema':'cpu0-readonly-created-config-difference.v1','atUnix':time.time(),'oldState':{'running':old['State']['Running'],'pid':old['State']['Pid'],'exitCode':old['State']['ExitCode'],'OOMKilled':old['State']['OOMKilled']},'newState':{'running':new['State']['Running'],'pid':new['State']['Pid'],'exitCode':new['State']['ExitCode'],'OOMKilled':new['State']['OOMKilled'],'startedAt':new['State']['StartedAt']},'configEqual':old['Config']==new['Config'],'oldNonCpuHostConfigHash':H(a),'newNonCpuHostConfigHash':H(b),'nonCpuHostConfigDifferences':diffs,'mem':mem,'sourceWrites':0,'signals':0,'ordinarySearches':0,'productionAcceptance':False},sort_keys=True))
