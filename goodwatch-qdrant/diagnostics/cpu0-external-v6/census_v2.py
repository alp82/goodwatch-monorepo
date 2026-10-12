"""Fixed v2 control scope, including the consumed legacy scope; no signals.

The original v1 census remains unchanged. This successor scans both the v1 and
v2 control paths in the same original 10-second bounded metadata operation.
"""
import os
from pathlib import Path
import stat
import time
import fcntl

from census import ROOT, PRIOR_STAGES
CONTROL_STAGES=PRIOR_STAGES+('pin-control-20261012-100-cpu0-v1',
                            'pin-control-20261012-100-cpu0-v2')


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
    folders=tuple(ROOT/name for name in CONTROL_STAGES)
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
    return {'schema':'cpu0-prior-control-census.v7','processesChecked':checked,
            'activeReviewedControls':0,'activeInstanceLockFds':0,
            'elapsedSeconds':time.monotonic()-started,
            'unregisteredChildrenAbsenceProven':False}
