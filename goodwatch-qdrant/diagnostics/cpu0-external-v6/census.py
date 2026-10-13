"""Metadata-only prior-stage census. Unknown ownership never means gone."""
import os
from pathlib import Path
import stat
import time
import fcntl

from packet import directory, hash_value, read_owned, sha

ROOT=Path('/root/goodwatch-qdrant-cold-406-20261011')
PRIOR_STAGES=tuple('pin-control-20261012-406-v'+str(i) for i in range(1,6))
NEW_STAGE='pin-control-20261012-100-cpu0-v1'


def validate_prior_policy(policy):
    if not isinstance(policy,list) or len(policy)!=5 or [p.get('stage') if isinstance(p,dict) else None for p in policy]!=list(PRIOR_STAGES):
        raise RuntimeError('prior_stage_policy_invalid')
    for i,value in enumerate(policy,1):
        if set(value)!={'stage','files','helperSha256','maxReceipts'} or not isinstance(value['files'],dict) or not value['files'] or type(value['maxReceipts']) is not int or value['maxReceipts']!=(18 if i>=4 else 14):
            raise RuntimeError('prior_stage_policy_invalid')
        for name,digest in value['files'].items():
            if not isinstance(name,str) or Path(name).name!=name or name in ('.','..','node'):
                raise RuntimeError('prior_stage_policy_invalid')
            hash_value(digest)
        if value['helperSha256'] is not None:hash_value(value['helperSha256'])
        if i==5 and value['helperSha256']!='f831f00f75d4b54dce3ba493a4a078b23969222507576505052291ed0147f7c5':
            raise RuntimeError('prior_stage_policy_invalid')
    return policy


def immutable_prior_files(policy, uid=0):
    """Frozen code remains untouched; only declared dynamic receipts/locks coexist."""
    validate_prior_policy(policy)
    for value in policy:
        folder=ROOT/value['stage'];directory(folder,uid)
        for name,expected in value['files'].items():
            raw,_=read_owned(folder/name,uid=uid)
            if sha(raw)!=expected:raise RuntimeError('prior_stage_source_changed')
        # Node is separately bound to the original fixed provenance/copy path.
        allowed=set(value['files'])|{'node','control.lock','pin-instance.lock'}
        entries=list(folder.iterdir())
        if len(entries)>len(allowed)+29:raise RuntimeError('prior_receipt_bound')
        for entry in entries:
            if entry.name in allowed:continue
            if not entry.name.startswith('reclaim-writer-') or not entry.name.endswith('.json'):
                raise RuntimeError('prior_stage_extra_entry')
            # The helper validates exact ownership/birth schema; syntax alone
            # never authorizes receipt cleanup or permits an unknown writer.


def prior_writers(policy, helper, protected_pids):
    validate_prior_policy(policy)
    if not isinstance(protected_pids,set) or not protected_pids or any(type(p)is not int or p<=0 for p in protected_pids):
        raise RuntimeError('protected_source_identity_missing')
    results=[]
    for value in policy:
        folder=ROOT/value['stage']
        if value['helperSha256'] is None:
            if any(folder.glob('reclaim-writer-*.json')):
                raise RuntimeError('prior_writer_evidence_unknown')
            results.append({'stage':value['stage'],'recordedWritersGone':True,'recordCount':0})
            continue
        result=helper.inspect_prior_receipts(folder,value['helperSha256'],protected_pids,max_records=value['maxReceipts'])
        if not isinstance(result,dict) or result.get('recordedWritersGone') is not True:
            error=RuntimeError('prior_writer_evidence_unknown');error.priorWriterEvidence=result;raise error
        results.append({'stage':value['stage'],'recordedWritersGone':True,'recordCount':result.get('receiptCount')})
    return {'recordedWritersGone':True,'stages':results,
            'unregisteredChildrenAbsenceProven':False}


def birth(entry):
    with (entry/'stat').open('rb') as stream:raw=stream.read(8193)
    if len(raw)>8192:raise RuntimeError('control_census_bound')
    try:
        fields=raw.decode('ascii')[raw.rfind(b')')+2:].split();ticks=int(fields[19])
        if ticks<=0:raise ValueError()
        return ticks
    except (ValueError,IndexError,UnicodeError):
        raise RuntimeError('control_census_unknown') from None


def instance_identities(folders,uid=0):
    identities={}
    for folder in folders:
        path=folder/'pin-instance.lock'
        try:info=path.lstat()
        except FileNotFoundError:continue
        if path.resolve(strict=True)!=path or not stat.S_ISREG(info.st_mode) or info.st_uid!=uid or info.st_nlink!=1 or stat.S_IMODE(info.st_mode)!=0o600:
            raise RuntimeError('instance_lock_identity_unknown')
        identities[path]=(info.st_dev,info.st_ino)
    return identities


def proc_controls(proc=Path('/proc'), seconds=10, uid=0):
    """Bounded cmdline/FD metadata; stopped/unknown processes are not signalled."""
    started=time.monotonic();checked=0
    folders=tuple(ROOT/name for name in PRIOR_STAGES+(NEW_STAGE,))
    commands={str(folder/name).encode() for folder in folders
              for name in ('controller.py','controller_cpu0.py','compare.mjs','consumer_cpu0.mjs')}
    locks={str(folder/'pin-instance.lock') for folder in folders}
    identities=instance_identities(folders,uid)
    inode_set=set(identities.values())
    own=proc/str(os.getpid());own_birth=birth(own)
    entries=[]
    for entry in proc.iterdir():
        if entry.name.isdigit():entries.append(entry)
        if len(entries)>8192:raise RuntimeError('control_census_bound')
    for entry in entries:
        if time.monotonic()-started>seconds:raise RuntimeError('control_census_bound')
        try:
            with (entry/'cmdline').open('rb') as stream:argv=stream.read(65537)
            if len(argv)>65536:raise RuntimeError('control_census_bound')
            # Exactly our proven birth may carry a future consumer path in argv.
            # Other births/parents are never broadly excluded.
            if entry!=own and any(value in commands for value in argv.split(b'\0')):
                raise RuntimeError('existing_control_present')
            count=0
            for fd in (entry/'fd').iterdir():
                count+=1
                if count>4096 or time.monotonic()-started>seconds:raise RuntimeError('control_census_bound')
                try:
                    target=os.readlink(fd)
                    if target in locks or target.endswith(' (deleted)') and target[:-10] in locks:
                        raise RuntimeError('existing_holder_present')
                    opened=fd.stat()
                    if (opened.st_dev,opened.st_ino) in inode_set:
                        raise RuntimeError('existing_holder_present')
                except FileNotFoundError:pass
            checked+=1
        except FileNotFoundError:
            # A disappeared process has no surviving fd; this is metadata census
            # only, never a claim that all unknown early children were registered.
            continue
    if birth(own)!=own_birth or instance_identities(folders,uid)!=identities:
        raise RuntimeError('control_census_unknown')
    # A retained open alias is caught above; independently prove no flock owner
    # on each unchanged registered instance inode without creating any lock.
    for path,identity in identities.items():
        fd=os.open(path,os.O_RDWR|os.O_NOFOLLOW|os.O_CLOEXEC)
        try:
            info=os.fstat(fd)
            if (info.st_dev,info.st_ino)!=identity:raise RuntimeError('instance_lock_identity_unknown')
            try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
            except BlockingIOError:raise RuntimeError('existing_holder_present') from None
        finally:os.close(fd)
    return {'schema':'cpu0-prior-control-census.v6','processesChecked':checked,
            'activeReviewedControls':0,'activeInstanceLockFds':0,
            'elapsedSeconds':time.monotonic()-started,
            'unregisteredChildrenAbsenceProven':False}
