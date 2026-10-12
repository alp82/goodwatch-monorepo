"""Prepared complete per-file metadata baseline; all paths remain private."""
import hashlib,json,os,stat,time
from pathlib import Path
MAX_ENTRIES=100000
MAX_SECONDS=30
MAX_BYTES=16*1024*1024
FLAGS=os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC
class Incomplete(RuntimeError):pass

def identity(s):return (s.st_dev,s.st_ino)
def metadata(s):return [s.st_dev,s.st_ino,s.st_size,s.st_blocks*512,s.st_mtime_ns,s.st_ctime_ns]
def digest(x):return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def open_relative(rootfd,parts):
    fd=os.dup(rootfd)
    try:
        for part in parts:
            if not part or part in ('.','..') or '/'in part:raise Incomplete('path_invalid')
            new=os.open(part,FLAGS,dir_fd=fd);os.close(fd);fd=new
        return fd
    except BaseException:
        os.close(fd);raise

def scan(store,clock=time.monotonic,max_entries=MAX_ENTRIES,max_seconds=MAX_SECONDS):
    started=clock();deadline=started+max_seconds;count=0;dirs={};files={};aliases=0
    rootfd=os.open(store,FLAGS)
    def check():
        nonlocal count
        if clock()>=deadline:raise Incomplete('scan_time_bound')
        if count>=max_entries:raise Incomplete('scan_entry_bound')
    def listdir(fd):
        nonlocal count,aliases
        rows=[]
        with os.scandir(fd)as entries:
            for e in entries:
                check();count+=1;s=e.stat(follow_symlinks=False)
                if stat.S_ISLNK(s.st_mode):aliases+=1;raise Incomplete('alias_excluded')
                rows.append((e.name,s))
        return rows
    def child(parent,name,before):
        fd=os.open(name,FLAGS,dir_fd=parent)
        if identity(os.fstat(fd))!=identity(before):os.close(fd);raise Incomplete('directory_changed')
        return fd
    def walk(parts,before):
        check()
        if len(parts)>24:raise Incomplete('scan_depth_bound')
        fd=open_relative(rootfd,parts)
        try:
            if identity(os.fstat(fd))!=identity(before):raise Incomplete('directory_changed')
            dirs['/'.join(parts)]=metadata(os.fstat(fd))
            for name,s in listdir(fd):
                key='/'.join((*parts,name))
                if stat.S_ISDIR(s.st_mode):walk((*parts,name),s)
                elif stat.S_ISREG(s.st_mode):files[key]=metadata(s)
                else:raise Incomplete('nonregular_excluded')
        finally:os.close(fd)
    cohorts=[]
    try:
        for collection in ('media_fingerprint_v1','search_reference_profiles'):
            collection_cohorts_before=len(cohorts);collection_files_before=len(files)
            parts=('collections',collection);cfd=open_relative(rootfd,parts)
            try:
                shards=[(n,s)for n,s in listdir(cfd)if n.isdigit()and stat.S_ISDIR(s.st_mode)]
                for name,ss in shards:
                    sfd=child(cfd,name,ss)
                    try:
                        bases=[]
                        for n,s in listdir(sfd):
                            if n=='segments'and stat.S_ISDIR(s.st_mode):bases.append(((*parts,name,n),s))
                            elif n.isdigit()and stat.S_ISDIR(s.st_mode):
                                rfd=child(sfd,n,s)
                                try:
                                    for rn,rs in listdir(rfd):
                                        if rn=='segments'and stat.S_ISDIR(rs.st_mode):bases.append(((*parts,name,n,rn),rs))
                                finally:os.close(rfd)
                        for bp,bs in bases:
                            bfd=open_relative(rootfd,bp)
                            try:
                                if identity(os.fstat(bfd))!=identity(bs):raise Incomplete('directory_changed')
                                for seg,info in listdir(bfd):
                                    if stat.S_ISDIR(info.st_mode):cohorts.append((*bp,seg));walk((*bp,seg),info)
                            finally:os.close(bfd)
                    finally:os.close(sfd)
            finally:os.close(cfd)
            if len(cohorts)==collection_cohorts_before or len(files)==collection_files_before:raise Incomplete('empty_collection_cohort')
        if not cohorts or not files:raise Incomplete('empty_cohort')
        # Reopen directories beneath the same root without following aliases.
        for key,before in dirs.items():
            check();fd=open_relative(rootfd,tuple(key.split('/')))
            try:
                if metadata(os.fstat(fd))!=before:raise Incomplete('directory_changed')
            finally:os.close(fd)
        if identity(os.fstat(rootfd))!=identity(os.stat(store,follow_symlinks=False)):raise Incomplete('store_changed')
        data={'schema':'private-qdrant-file-baseline.v1','files':files,'directories':dirs,'cohort':cohorts}
        encoded=json.dumps(data,separators=(',',':')).encode()
        if len(encoded)>MAX_BYTES:raise Incomplete('output_bound')
        # Stat allocation deduplicates true local hardlinks, not synthetic SSHFS identities.
        unique={tuple(v[:2]):v for v in files.values()}
        summary={'complete':True,'entries':count,'files':len(files),'segmentDirectories':len(cohorts),'scannedDirectories':len(dirs),'aliases':aliases,'apparentBytes':sum(v[2]for v in files.values()),'allocatedStatBytes':sum(v[3]for v in unique.values()),'metadataHash':hashlib.sha256(encoded).hexdigest(),'durationSeconds':clock()-started,'contentRead':False,'atomicSnapshot':False,'futureCeilingEstablished':False}
        return data,summary
    finally:os.close(rootfd)

def growth(before,after):
    # Different identities at the same name count as a full new file. Shrink never cancels growth.
    positive_size=positive_blocks=new_files=retired_files=0
    for key,new in after['files'].items():
        old=before['files'].get(key)
        if old is None or old[:2]!=new[:2]:new_files+=1;positive_size+=new[2];positive_blocks+=new[3]
        else:positive_size+=max(0,new[2]-old[2]);positive_blocks+=max(0,new[3]-old[3])
    for key,old in before['files'].items():
        new=after['files'].get(key)
        if new is None or old[:2]!=new[:2]:retired_files+=1
    return {'positiveApparentGrowthBytes':positive_size,'positiveAllocatedStatGrowthBytes':positive_blocks,'newFileIdentities':new_files,'retiredFileIdentities':retired_files,'contentChangesExcluded':False,'snapshotAttributionProven':False}

def capture(contract,helpers):
    source=helpers.source(contract);jobs=helpers.backup_paths();job=helpers.backup_running(jobs)
    if not job['complete']or job['running']:raise Incomplete('backup_active_or_unknown')
    started=helpers.stamp();p0=helpers.pressure(source);data,summary=scan(source['store']);helpers.sample_source_fence(contract,source)
    job=helpers.backup_running(jobs)
    if not job['complete']or job['running']:raise Incomplete('backup_active_or_unknown')
    p1=helpers.pressure(source);helpers.sample_source_fence(contract,source)
    summary.update(schema='complete-file-metadata-baseline.v1',startedAt=started,endedAt=helpers.stamp(),sourceIdentityHash=helpers.digest(source['identity']),availableBytesBefore=p0['host']['MemAvailable'],availableBytesAfter=p1['host']['MemAvailable'],sourcePid=source['pid'],sourceStartTicks=source['ticks'],queries=0,cacheControls=0,remoteHostFilesCreated=0)
    return {'public':summary,'private':data}
