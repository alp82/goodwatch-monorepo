"""Concrete numeric setup admission; no waits, retry, pin or cache operation."""
import json
import os
from pathlib import Path
import shutil
import stat
import sys
import hashlib
import http.client

sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from packet import directory

ROOT=Path('/root/goodwatch-qdrant-cold-406-20261011')
GIB=1024**3


def memory(path=Path('/proc/meminfo')):
    with path.open('rb') as stream:raw=stream.read(65537)
    if len(raw)>65536:raise RuntimeError('setup_host_memory_unavailable')
    selected={}
    try:
        for row in raw.decode('ascii').splitlines():
            key,rest=row.split(':',1)
            if key not in ('MemAvailable','SwapTotal'):continue
            pieces=rest.split()
            if key in selected or len(pieces)!=2 or pieces[1]!='kB' or not pieces[0].isdigit():
                raise ValueError()
            selected[key]=int(pieces[0])*1024
        if set(selected)!={'MemAvailable','SwapTotal'}:raise ValueError()
    except (ValueError,UnicodeError):
        raise RuntimeError('setup_host_memory_unavailable') from None
    return selected


def allocated(root=ROOT):
    directory(root);seen=set();total=0;count=0
    for base,dirs,names in os.walk(root,followlinks=False):
        for name in dirs+names:
            path=Path(base)/name;info=path.lstat();count+=1
            if count>100000 or info.st_uid!=0 or stat.S_ISLNK(info.st_mode) or not (stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode)):
                raise RuntimeError('setup_owned_storage_unknown')
            identity=(info.st_dev,info.st_ino)
            # Same regular-file, deduplicated-inode scope as the frozen
            # controller. Directory metadata is checked but not added to bytes.
            if stat.S_ISREG(info.st_mode) and identity not in seen:
                total+=info.st_blocks*512;seen.add(identity)
    return total


def host(guards):
    """Use the authenticated CPU source's exact host thresholds; no averages."""
    cpu=guards.host_cpu()
    mem=memory();used=allocated();free=shutil.disk_usage(ROOT).free
    evidence={'schema':'cpu0-setup-host-admission.v6','cpu':cpu,
              'MemAvailable':mem['MemAvailable'],'SwapTotal':mem['SwapTotal'],
              'ownedAllocatedBytes':used,'diskFreeBytes':free,
              'availableFloorBytes':5*GIB,'diskFloorBytes':3*GIB,
              'ownedAllocatedCeilingBytes':11*GIB}
    if mem['SwapTotal']!=0 or mem['MemAvailable']<=5*GIB or free<=3*GIB or used>=11*GIB:
        error=RuntimeError('setup_host_admission_failed');error.setupHostEvidence=evidence;raise error
    return evidence


def old_shutdown_host(guards):
    """OLD-only graceful shutdown margin; never admits creation/start or pinning.

    Two GiB is a declared engineering margin for bounded inspectors and shutdown,
    not a kernel capacity guarantee. The full host() admission stays unchanged.
    """
    cpu=guards.host_cpu()
    mem=memory();used=allocated();free=shutil.disk_usage(ROOT).free
    evidence={'schema':'cpu0-old-shutdown-host-admission.v1',
              'target':'old-owned-shutdown','diagnosticComparisonAdmission':False,
              'cpu':cpu,'MemAvailable':mem['MemAvailable'],'SwapTotal':mem['SwapTotal'],
              'ownedAllocatedBytes':used,'diskFreeBytes':free,
              'availableFloorBytes':2*GIB,'diskFloorBytes':3*GIB,
              'ownedAllocatedCeilingBytes':11*GIB}
    if mem['SwapTotal']!=0 or mem['MemAvailable']<=2*GIB or free<=3*GIB or used>=11*GIB:
        error=RuntimeError('setup_host_admission_failed');error.setupHostEvidence=evidence;raise error
    return evidence


def old_hierarchy(lifecycle,guards,docker,root=Path('/sys/fs/cgroup')):
    """Explicit OLD CPU2-only admission. CPU0 runtime/guards are unchanged."""
    old=lifecycle.container(lifecycle.OLD,docker)
    h=old['HostConfig']
    if old['Name']!='/'+lifecycle.OLD or type(h['NanoCpus']) is not int or h['NanoCpus']!=2_000_000_000 or any(type(h[k]) is not int or h[k]!=0 for k in ('CpuQuota','CpuPeriod')) or h['CpusetCpus']!='' or h['CpusetMems']!='':
        raise RuntimeError('setup_old_cpu_policy_changed')
    w=lifecycle.process(old['State']['Pid'])
    cg=root/w['group'].lstrip('/')
    if root.resolve(strict=True)!=root or cg.resolve(strict=True)!=cg or root not in cg.parents:
        raise RuntimeError('setup_old_cpu_identity_changed')
    rows=[];current=cg
    while True:
        before=current.stat();row=guards.cpu_row(current,hierarchy_root=current==root);after=current.stat()
        if (before.st_dev,before.st_ino)!=(after.st_dev,after.st_ino):raise RuntimeError('setup_old_cpu_identity_changed')
        row['depth']=len(rows)
        row['groupIdentitySha256']=hashlib.sha256((str(current)+'\0'+str(after.st_dev)+'\0'+str(after.st_ino)).encode()).hexdigest()
        rows.append(row)
        if len(rows)==1:
            if row['quotaMicros']!=200000 or row['periodMicros']!=100000:
                raise RuntimeError('setup_old_cpu_policy_changed')
        elif row['quotaMicros'] is not None or row.get('nrThrottled') not in (None,0) or row.get('throttledMicros') not in (None,0):
            error=RuntimeError('setup_old_ancestor_refused');error.setupOldCpuEvidence={'rows':rows,'partial':True};raise error
        if current==root:break
        current=current.parent
        if len(rows)>32:raise RuntimeError('setup_old_cpu_identity_changed')
    weight=int(guards.bounded_text(cg/'cpu.weight').strip())
    cpus=guards.bounded_text(cg/'cpuset.cpus').strip();mems=guards.bounded_text(cg/'cpuset.mems').strip()
    if weight!=100 or cpus!='' or mems!='' or lifecycle.process(w['pid'])!=w or lifecycle.state_snapshot(lifecycle.container(lifecycle.OLD,docker))!=lifecycle.state_snapshot(old):
        raise RuntimeError('setup_old_cpu_identity_changed')
    return {'schema':'cpu0-setup-old-cpu2-hierarchy.v6','target':'old-owned-cpu2',
            'sourceFiniteQuotaException':True,'rows':rows,'weight':weight,
            'cpusetCpus':cpus,'cpusetMems':mems,'diagnosticComparisonAdmission':False}


def collection_shape(connection=http.client.HTTPConnection):
    """Fixed metadata GET, bounded and physically closed before stop proof."""
    client=connection('127.0.0.1',16333,timeout=5)
    try:
        client.request('GET','/collections/media_fingerprint_v1',headers={'Connection':'close'})
        response=client.getresponse();raw=response.read(1024**2+1)
        if response.status!=200 or len(raw)>1024**2:raise RuntimeError('setup_shape_unavailable')
        result=json.loads(raw)['result']
        if result['status']!='green' or result['optimizer_status']!='ok' or type(result['points_count']) is not int or result['points_count']!=244262 or type(result['segments_count']) is not int or result['segments_count']!=12 or type(result['config']['params']['shard_number']) is not int or result['config']['params']['shard_number']!=6:
            raise RuntimeError('setup_shape_changed')
        return {'status':'green','optimizerStatus':'ok','points':244262,'segments':12,'shards':6,'clientClosed':True}
    except (OSError,ValueError,KeyError,TypeError,http.client.HTTPException):
        raise RuntimeError('setup_shape_unavailable') from None
    finally:
        original=sys.exc_info()[1]
        try:
            client.close()
            if client.sock is not None:raise RuntimeError('setup_metadata_client_unclosed')
        except BaseException:
            if original is None:raise RuntimeError('setup_metadata_client_unclosed') from None
            original.metadataClientCleanupFailure='setup_metadata_client_unclosed'


def old_admission(lifecycle,guards,docker):
    before=lifecycle.attest(lifecycle.OLD,docker)
    host_evidence=old_shutdown_host(guards)
    cpu=old_hierarchy(lifecycle,guards,docker)
    shape=collection_shape()
    after=lifecycle.attest(lifecycle.OLD,docker)
    if after!=before:raise RuntimeError('setup_old_identity_changed')
    return {'schema':'cpu0-old-stop-admission.v6','source':before,
            'host':host_evidence,'cpuHierarchy':cpu,'collectionShape':shape}


if __name__=='__main__':
    print(json.dumps({'schema':'cpu0-setup-host-admission.v6','status':'prepared-only',
                      'hostOperations':0,'executionPacketReady':False}))
