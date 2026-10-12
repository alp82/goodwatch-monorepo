import json,os,subprocess,time
from pathlib import Path
root=Path('/root/goodwatch-qdrant-cold-406-20261011')
def mem():
    allowed={'MemTotal','MemFree','MemAvailable','Buffers','Cached','SwapCached','Active','Inactive','Active(anon)','Inactive(anon)','Active(file)','Inactive(file)','Unevictable','Mlocked','SwapTotal','SwapFree','AnonPages','Mapped','Shmem','Slab','SReclaimable','SUnreclaim','PageTables','Committed_AS'}
    return {k:int(v.split()[0])*1024 for k,v in (line.split(':',1) for line in Path('/proc/meminfo').read_text().splitlines()) if k in allowed}
start=mem();rows=[];unknown=0
for p in Path('/proc').iterdir():
    if not p.name.isdigit():continue
    try:
        status={k:v.strip() for k,v in (line.split(':',1) for line in (p/'status').read_text().splitlines())}
        st=(p/'stat').read_text();tail=st[st.rfind(')')+2:].split()
        rows.append({'pid':int(p.name),'startTicks':int(tail[19]),'comm':(p/'comm').read_text().strip(),'rssBytes':int(status.get('VmRSS','0 kB').split()[0])*1024,'lockedBytes':int(status.get('VmLck','0 kB').split()[0])*1024})
    except (OSError,ValueError,IndexError):unknown+=1
child=subprocess.run(['/usr/bin/docker','inspect','--format','{{json .State}}','gw-qdrant-cold-406-20261011'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=10,env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8','DOCKER_HOST':'unix:///var/run/docker.sock'})
state=json.loads(child.stdout) if child.returncode==0 else None
cg=None
if state and state.get('Pid'):
    cgr=Path('/proc')/str(state['Pid'])/'cgroup'
    lines=cgr.read_text().splitlines();path=next(line.split(':',2)[2] for line in lines if line.startswith('0::'))
    d=Path('/sys/fs/cgroup')/path.lstrip('/')
    cg={n:(d/n).read_text() for n in ['memory.current','memory.max','memory.high','memory.swap.current','memory.events','memory.stat']}
print(json.dumps({'schema':'cpu0-readonly-memory-snapshot.v1','atUnix':time.time(),'memBefore':start,'memAfter':mem(),'largestRss':sorted(rows,key=lambda x:x['rssBytes'],reverse=True)[:15],'totalLockedBytesObserved':sum(x['lockedBytes'] for x in rows),'processReadUnknown':unknown,'oldCloneState':state,'oldCloneCgroupMemory':cg,'sourceWrites':0,'signals':0,'ordinarySearches':0,'productionAcceptance':False},sort_keys=True))
