"""Prepared passive metadata observer. Default performs no host inspection."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import time

START=None
END='2026-10-12T07:29:00+00:00'
IMAGE='sha256:dd57172b0bbebb29b0a96a37c1f378a317449730c36cdfe68feabe36e740a92b'
COLLECTIONS=(('media','media_fingerprint_v1'),('reference','search_reference_profiles'))
RECLAIM_PREFIXES=('pgscan_','pgsteal_','allocstall','workingset_refault','workingset_activate')
SAFE={'source_changed','source_limits_changed','private_contract_invalid','metadata_unavailable','backup_schedule_unavailable','sampling_window_closed','observer_runtime_failure'}

def stamp():return dt.datetime.now(dt.timezone.utc).isoformat()
def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def numeric(path):
    return {a.rstrip(':'):int(b)for a,b,*_ in (line.split()for line in Path(path).read_text().splitlines())}
def docker(*args,timeout=3):
    return subprocess.check_output(['/usr/bin/docker',*args],stderr=subprocess.DEVNULL,timeout=timeout)
def source(contract):
    expected={'store','image','mounts','memoryBytes','swapBytes','cpuNanos','memoryMax','memoryHigh','cpuMax'}
    if set(contract)!=expected or contract['image']!=IMAGE or contract['memoryBytes']!=0 or contract['swapBytes']!=0 or contract['cpuNanos']!=0:
        raise RuntimeError('private_contract_invalid')
    x=json.loads(docker('inspect','qdrant-main'))[0]
    tuples=sorted([[m['Source'],m['Destination'],m['Type'],m['RW']] for m in x['Mounts']])
    if not x['State']['Running'] or x['Image']!=IMAGE or tuples!=sorted(contract['mounts']):raise RuntimeError('source_changed')
    h=x['HostConfig']
    if (h['Memory'],h['MemorySwap'],h['NanoCpus'])!=(0,0,0):raise RuntimeError('source_limits_changed')
    store=Path(contract['store'])
    if store.resolve()!=store or not any(m[0]==str(store) and m[1]=='/qdrant/storage' and m[3] for m in tuples):raise RuntimeError('source_changed')
    snapshots=[Path(m[0]) for m in tuples if m[1]=='/qdrant/snapshots']
    if len(snapshots)!=1:raise RuntimeError('private_contract_invalid')
    rows=docker('top','qdrant-main','-eo','pid,comm').decode().splitlines()[1:]
    ids=[int(r.split()[0])for r in rows if r.split()[1]=='qdrant']
    if len(ids)!=1:raise RuntimeError('source_changed')
    pid=ids[0];proc=Path('/proc')/str(pid)
    if (proc/'exe').readlink().name!='qdrant':raise RuntimeError('source_changed')
    raw=(proc/'stat').read_text();ticks=int(raw[raw.rfind(')')+2:].split()[19]);rel=(proc/'cgroup').read_text().strip().split(':',2)[2]
    if not rel.endswith('/docker-'+x['Id']+'.scope'):raise RuntimeError('source_changed')
    cg=Path('/sys/fs/cgroup')/rel.lstrip('/')
    limits={k:(cg/file).read_text().strip()for k,file in [('memoryMax','memory.max'),('memoryHigh','memory.high'),('cpuMax','cpu.max')]}
    if limits!={k:contract[k]for k in limits}:raise RuntimeError('source_limits_changed')
    return {'identity':(x['Id'],pid,ticks),'pid':pid,'ticks':ticks,'proc':proc,'cg':cg,'store':store,'snapshots':snapshots[0],'limits':limits}

def sample_source_fence(contract, expected):
    try:
        after = source(contract)
        if after['identity'] != expected['identity'] or after['limits'] != expected['limits']:
            raise RuntimeError('source_changed')
    except Exception:
        raise RuntimeError('source_changed') from None


def metadata_tree(path,maximum=2048,budget_seconds=.35,depth=8):
    result={'exists':False,'entries':0,'regularFiles':0,'directories':0,'symlinks':0,'apparentBytes':0,'allocatedBytes':0,'largestFileBytes':0,'truncated':False,'phaseBytes':{'sourceArchive':0,'shardStaging':0,'other':0}}
    try:info=path.lstat()
    except FileNotFoundError:return result
    result['exists']=True
    if not stat.S_ISDIR(info.st_mode):result['symlinks']=int(stat.S_ISLNK(info.st_mode));return result
    pending=[(path,0,'other')];seen=set();deadline=time.monotonic()+budget_seconds
    while pending:
        base,level,phase=pending.pop()
        try:
            with os.scandir(base) as entries:
                for entry in entries:
                    if result['entries']>=maximum or time.monotonic()>deadline:result['truncated']=True;return result
                    result['entries']+=1
                    try:s=entry.stat(follow_symlinks=False)
                    except FileNotFoundError:continue
                    if stat.S_ISLNK(s.st_mode):result['symlinks']+=1
                    elif stat.S_ISDIR(s.st_mode):
                        result['directories']+=1
                        if level<depth:pending.append((Path(entry.path),level+1,'shardStaging' if level==0 and '.snapshot-temp-' in entry.name else phase))
                        else:result['truncated']=True
                    elif stat.S_ISREG(s.st_mode):
                        result['regularFiles']+=1;result['phaseBytes']['sourceArchive' if level==0 and '.snapshot-arc-' in entry.name else phase]+=s.st_size;result['apparentBytes']+=s.st_size;result['largestFileBytes']=max(result['largestFileBytes'],s.st_size)
                        key=(s.st_dev,s.st_ino)
                        if key not in seen:result['allocatedBytes']+=s.st_blocks*512;seen.add(key)
        except FileNotFoundError:continue
    return result

def archive_metadata(path):
    out={tag:{'publishedCount':0,'publishedLargestBytes':0,'latestPublishedBytes':None,'latestPublishedMtimeNs':None,'targetTmpCount':0,'targetTmpBytes':0,'checksumTmpCount':0}for tag,_ in COLLECTIONS};examined=0;deadline=time.monotonic()+.35;truncated=False
    for tag,name in COLLECTIONS:
        directory=path/name
        try:
            with os.scandir(directory) as entries:
                for e in entries:
                    if examined>=256 or time.monotonic()>deadline:truncated=True;break
                    examined+=1
                    try:s=e.stat(follow_symlinks=False)
                    except FileNotFoundError:continue
                    if not stat.S_ISREG(s.st_mode):continue
                    v=out[tag]
                    if e.name.endswith('.snapshot'):
                        v['publishedCount']+=1;v['publishedLargestBytes']=max(v['publishedLargestBytes'],s.st_size)
                        if v['latestPublishedMtimeNs'] is None or s.st_mtime_ns>v['latestPublishedMtimeNs']:v['latestPublishedBytes']=s.st_size;v['latestPublishedMtimeNs']=s.st_mtime_ns
                    elif e.name.endswith('.tmp'):
                        # Qdrant replaces .snapshot with .tmp; checksum temp files are distinct.
                        if '.checksum' in e.name:v['checksumTmpCount']+=1
                        else:v['targetTmpCount']+=1;v['targetTmpBytes']+=s.st_size
        except FileNotFoundError:continue
    return {'classes':out,'examined':examined,'truncated':truncated}

def segments(store):
    out={};examined=0;deadline=time.monotonic()+.25;truncated=False
    for tag,name in COLLECTIONS:
        collection=store/'collections'/name
        if collection.is_symlink():truncated=True;continue
        if not collection.is_dir():continue
        for shard in collection.iterdir():
            if not shard.name.isdigit() or shard.is_symlink() or not shard.is_dir():continue
            # Actual mapped paths have segments directly under the shard. Older
            # replica-numeric layouts are supported independently, without links.
            bases=[shard/'segments']
            for replica in shard.iterdir():
                if replica.name.isdigit() and not replica.is_symlink() and replica.is_dir():bases.append(replica/'segments')
            for base in bases:
                if base.is_symlink():truncated=True;continue
                if not base.is_dir():continue
                with os.scandir(base) as entries:
                    for e in entries:
                        if examined>=256 or time.monotonic()>deadline:truncated=True;return out,truncated
                        examined+=1
                        try:s=e.stat(follow_symlinks=False)
                        except FileNotFoundError:continue
                        if stat.S_ISDIR(s.st_mode):out[(s.st_dev,s.st_ino)]=(tag,Path(e.path))
    return out,truncated


def existing_segment_metadata(current, baseline, maximum=80000, budget_seconds=1):
    """Bounded full existing-directory cohort metadata; no file reads.

    Directory identities are a coarse fence only. Files/ranges/content can turn
    over inside a retained directory, and growth has no snapshot attribution.
    """
    aggregate={'baselineDirectories':len(baseline),'retainedDirectories':0,'retiredDirectories':0,
               'apparentBytes':0,'allocatedStatBytes':0,'regularFiles':0,'entries':0,'truncated':not bool(baseline),'emptyBaselineCohort':not bool(baseline),
               'sameDirectoryCohort':set(current)==set(baseline),'snapshotStagingAttributionProven':False}
    deadline=time.monotonic()+budget_seconds;remaining=maximum
    for key,(_tag,path) in baseline.items():
        if key not in current:aggregate['retiredDirectories']+=1;continue
        aggregate['retainedDirectories']+=1
        if remaining<=0 or time.monotonic()>=deadline:aggregate['truncated']=True;continue
        tree=metadata_tree(current[key][1],maximum=remaining,budget_seconds=max(.001,deadline-time.monotonic()),depth=12)
        remaining-=tree['entries'];aggregate['entries']+=tree['entries'];aggregate['regularFiles']+=tree['regularFiles'];aggregate['apparentBytes']+=tree['apparentBytes'];aggregate['allocatedStatBytes']+=tree['allocatedBytes'];aggregate['truncated']|=tree['truncated']
    return aggregate


def segment_growth(current, baseline):
    comparable=(baseline['baselineDirectories']>0 and not current['truncated'] and not baseline['truncated'] and current['retainedDirectories']==baseline['retainedDirectories'] and current['retiredDirectories']==0)
    return {'baselineDirectoryCohortComparable':comparable,'apparentByteDelta':current['apparentBytes']-baseline['apparentBytes'],
            'allocatedStatByteDelta':current['allocatedStatBytes']-baseline['allocatedStatBytes'],
            'regularFileDelta':current['regularFiles']-baseline['regularFiles'],
            'deltaIsComplete':comparable,'snapshotStagingAttributionProven':False,
            'fileIdentitiesAndContentFrozen':False}


def backup_paths():
    paths=set()
    for cron in Path('/var/spool/cron/crontabs').glob('*'):
        if cron.stat().st_size>65536:raise RuntimeError('backup_schedule_unavailable')
        for line in cron.read_text().splitlines():
            if line.lstrip().startswith('#') or not ('qdrant' in line.lower() and 'backup' in line.lower()):continue
            paths.update(v.encode()for v in re.findall(r'(?:/[A-Za-z0-9_.-]+)+',line)if v.endswith('/backup.py'))
    if len(paths)!=1:raise RuntimeError('backup_schedule_unavailable')
    return paths

def backup_running(paths):
    found=[];deadline=time.monotonic()+.2;complete=True
    for p in Path('/proc').glob('[0-9]*'):
        if time.monotonic()>deadline:complete=False;break
        try:
            args=(p/'cmdline').read_bytes().split(b'\0')
            if any(v in args for v in paths):
                raw=(p/'stat').read_text();found.append((int(p.name),int(raw[raw.rfind(')')+2:].split()[19])))
        except (FileNotFoundError,PermissionError,ProcessLookupError):pass
    return {'running':bool(found),'count':len(found),'processIdentityHash':digest(sorted(found)),'complete':complete}

def pressure(s):
    mem=numeric('/proc/meminfo');vm=numeric('/proc/vmstat');ms=numeric(s['cg']/'memory.stat');raw=(s['proc']/'stat').read_text();f=raw[raw.rfind(')')+2:].split();io=numeric(s['proc']/'io')
    psi={}
    for row in Path('/proc/pressure/memory').read_text().splitlines():
        parts=row.split();psi[parts[0]]={a:float(b)if a!='total' else int(b)for a,b in(v.split('=')for v in parts[1:])}
    return {'qdrantPid':s['pid'],'sourceStartTicks':s['ticks'],'qdrantMinorFaults':int(f[7]),'qdrantMajorFaults':int(f[9]),'qdrantReadBytes':io['read_bytes'],'currentBytes':int((s['cg']/'memory.current').read_text()),'memory':{k:ms[k]for k in ('anon','file','kernel','file_dirty','file_writeback','unevictable')},'host':{k:mem[k]*1024 for k in ('MemAvailable','Cached','Dirty','Writeback','SwapTotal','SwapFree')},'psi':psi,'reclaim':{k:v for k,v in vm.items()if k.startswith(RECLAIM_PREFIXES)or k in ('pswpin','pswpout')},'limits':s['limits'],'memoryOomGroup':int((s['cg']/'memory.oom.group').read_text()),'memoryEvents':numeric(s['cg']/'memory.events'),'cpuLimitCounters':{k:v for k,v in numeric(s['cg']/'cpu.stat').items()if k in ('nr_throttled','throttled_usec')}}

def run(contract,emit,start=START,end=END):
    begin=time.time() if start is None else dt.datetime.fromisoformat(start).timestamp();finish=dt.datetime.fromisoformat(end).timestamp()
    start=dt.datetime.fromtimestamp(begin,dt.timezone.utc).isoformat()
    if not 0<finish-begin<=1200:raise RuntimeError('sampling_window_closed')
    if time.time()>=finish:raise RuntimeError('sampling_window_closed')
    while time.time()<begin:time.sleep(min(1,begin-time.time()))
    monotonic_stop=time.monotonic()+min(1200,max(0,finish-time.time()));baseline=source(contract);known,truncated=segments(baseline['store']);initial_existing=existing_segment_metadata(known,known);jobs=backup_paths()
    emit({'event':'backup-metadata-start','at':stamp(),'expectedStart':start,'expectedEnd':end,'sourceIdentityHash':digest(baseline['identity']),'baselineSegmentDirectoryCount':len(known),'baselineSegmentCensusTruncated':truncated,'baselineExistingSegmentMetadata':initial_existing,'intervalSeconds':2,'maximumSeconds':1200,'queries':0,'dataContentsRead':0,'cacheControls':0})
    samples=0;incomplete=truncated or initial_existing['truncated'];peaks={'tempApparentBytes':0,'targetTmpBytes':0,'newSegmentCandidateBytes':0,'existingSegmentApparentGrowthBytes':0,'existingSegmentAllocatedStatGrowthBytes':0};least_available=None;first_at=None;last_at=None
    while time.monotonic()<monotonic_stop and time.time()<finish:
        iteration=time.monotonic();current=source(contract)
        if current['identity']!=baseline['identity']:raise RuntimeError('source_changed')
        temp=metadata_tree(current['store']/'tmp');archives=archive_metadata(current['snapshots']);now,segment_truncated=segments(current['store']);new={k:v for k,v in now.items()if k not in known};new_bytes=0;new_allocated=0;new_files=0;new_truncated=False
        # All candidate trees share one per-sample metadata allowance, not a bound per new segment.
        deadline=time.monotonic()+.35;remaining=2048
        for tag,path in new.values():
            if remaining<=0 or time.monotonic()>=deadline:new_truncated=True;break
            tree=metadata_tree(path,maximum=remaining,budget_seconds=max(.001,deadline-time.monotonic()));remaining-=tree['entries'];new_bytes+=tree['apparentBytes'];new_allocated+=tree['allocatedBytes'];new_files+=tree['regularFiles'];new_truncated|=tree['truncated']
        existing=existing_segment_metadata(now,known);growth=segment_growth(existing,initial_existing);stats=pressure(current);job=backup_running(jobs);sample_source_fence(contract,current);at=stamp();record={'event':'backup-metadata-sample','at':at,'sample':samples,'sourceIdentityHash':digest(current['identity']),'pressure':stats,'backup':job,'sourceTemp':temp,'snapshotTargets':archives,'segmentDirectories':{'count':len(now),'baselineIdentityHash':digest(sorted(known)),'currentIdentityHash':digest(sorted(now)),'newCandidates':len(new),'newCandidateApparentBytes':new_bytes,'newCandidateAllocatedBytes':new_allocated,'newCandidateFiles':new_files,'truncated':segment_truncated or new_truncated,'snapshotProxyAttributionProven':False},'existingSegmentMetadata':existing,'existingSegmentGrowth':growth,'sampleDurationMs':round((time.monotonic()-iteration)*1000,1)}
        if time.monotonic()>=monotonic_stop or time.time()>=finish:break
        emit(record);samples+=1;first_at=first_at or at;last_at=at;incomplete|=temp['truncated']or archives['truncated']or segment_truncated or new_truncated or not job['complete'] or existing['truncated'] or existing['retiredDirectories']>0;peaks['tempApparentBytes']=max(peaks['tempApparentBytes'],temp['apparentBytes']);peaks['targetTmpBytes']=max(peaks['targetTmpBytes'],sum(v['targetTmpBytes']for v in archives['classes'].values()));peaks['newSegmentCandidateBytes']=max(peaks['newSegmentCandidateBytes'],new_bytes);peaks['existingSegmentApparentGrowthBytes']=max(peaks['existingSegmentApparentGrowthBytes'],growth['apparentByteDelta']);peaks['existingSegmentAllocatedStatGrowthBytes']=max(peaks['existingSegmentAllocatedStatGrowthBytes'],growth['allocatedStatByteDelta']);least_available=stats['host']['MemAvailable']if least_available is None else min(least_available,stats['host']['MemAvailable']);time.sleep(max(0,min(2-(time.monotonic()-iteration),monotonic_stop-time.monotonic(),finish-time.time())))
    emit({'event':'backup-metadata-summary','at':stamp(),'samples':samples,'firstSampleAt':first_at,'lastSampleAt':last_at,'expectedStart':start,'expectedEnd':end,'metadataIncomplete':bool(incomplete),'observedPeaks':peaks,'leastAvailableBytes':least_available,'peaksAreFutureBounds':False,'proxyStagingAttributionProven':False,'noContentsQueriesOrCacheControls':True})

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--observe',action='store_true');parser.add_argument('--source-json');args=parser.parse_args()
    if not args.observe:print(json.dumps({'stage':'prepared-only','inspection':False}));return
    try:
        contract=json.loads(Path(args.source_json).read_text());run(contract,lambda row:print(json.dumps(row,sort_keys=True),flush=True))
    except Exception as error:
        reason=str(error)if str(error)in SAFE else 'observer_runtime_failure';print(json.dumps({'event':'backup-metadata-failed','at':stamp(),'reason':reason}),flush=True);raise SystemExit(1)
if __name__=='__main__':main()
