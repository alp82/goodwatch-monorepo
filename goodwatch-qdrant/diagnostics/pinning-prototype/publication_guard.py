"""Prepared owned-helper absence gate; no process signalling or service writes."""
import fcntl
import json
import os
from pathlib import Path
import stat
import time

RUNTIME=Path('/run/goodwatch-qdrant-pin')
CODE_ROOT=Path('/opt/goodwatch-qdrant-pin')
MAX_PROCESSES=65536
MAX_JOURNAL_BYTES=512*1024**2


def proc_ticks(proc):
    try:
        with (proc/'stat').open() as stream: raw=stream.read(8193)
        if len(raw)>8192:raise ValueError('bounded_process_identity_failed')
    except FileNotFoundError:return None
    return int(raw.rsplit(')',1)[1].split()[19])


def owned_directory(path):
    if path.resolve()!=path:raise ValueError('owned_guard_directory_required')
    info=path.stat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid!=os.geteuid() or info.st_mode&0o077:raise ValueError('owned_guard_directory_required')


def journal_holders(path):
    if path is None:raise ValueError('retained_holder_journal_required')
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        info=os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid!=os.geteuid() or info.st_nlink!=1 or info.st_mode&0o077 or info.st_size>MAX_JOURNAL_BYTES:raise ValueError('owned_holder_journal_required')
        holders=set();known={};started=False;sequence=None;consumed=0
        with os.fdopen(fd,'rb',closefd=False) as stream:
            while True:
                line=stream.readline(32769)
                if not line:break
                consumed+=len(line)
                if len(line)>32768 or not line.endswith(b'\n') or consumed>MAX_JOURNAL_BYTES:raise ValueError('complete_holder_journal_required')
                row=json.loads(line)
                if row.get('schema')!='qdrant.helper-journal.v1' or row.get('kind') not in ('helper.collector-started','helper.collector-problem','helper.event'):raise ValueError('complete_holder_journal_required')
                number=row.get('sequence')
                if type(number)is not int or number<1:raise ValueError('complete_holder_journal_required')
                if row.get('kind')=='helper.collector-started':
                    if number!=1:raise ValueError('complete_holder_journal_required')
                    started=True
                elif not started or number!=sequence+1:raise ValueError('complete_holder_journal_required')
                sequence=number
                if row.get('kind')!='helper.event':continue
                data=row.get('data',{})
                if type(data)is not dict or data.get('phase') not in ('prepared','holder_started','inventory_retry_claimed','locked','heartbeat','released','failed'):raise ValueError('complete_holder_journal_required')
                pid=data.get('holderPid');ticks=data.get('holderStartTicks')
                if data.get('phase')=='holder_started':
                    if type(pid)is not int or pid<2 or type(ticks)is not int or ticks<1 or data.get('pidfdOwned') is not True:raise ValueError('holder_identity_evidence_required')
                    holders.add((pid,ticks));known[pid]=ticks
                elif data.get('phase')=='locked':
                    if type(pid)is not int or type(ticks)is not int or known.get(pid)!=ticks:raise ValueError('holder_birth_registration_required')
                elif data.get('phase') in ('heartbeat','inventory_retry_claimed','released') and pid is not None and (type(pid)is not int or pid not in known):raise ValueError('holder_identity_evidence_required')
        if not started or consumed!=info.st_size:raise ValueError('complete_holder_journal_required')
        after=os.fstat(fd)
        if (after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns)!=(info.st_dev,info.st_ino,info.st_size,info.st_mtime_ns):raise ValueError('holder_journal_changed')
        return holders
    finally:os.close(fd)


class ReleaseGuard:
    """Holds both owned lock inodes until all publication/rollback writes end."""
    def __init__(self,targets,unit_inactive,journal=None,runtime=RUNTIME,code_root=CODE_ROOT,proc_root=Path('/proc'),seconds=5):
        self.targets=targets;self.unit_inactive=unit_inactive;self.journal=journal
        self.runtime=Path(runtime);self.code_root=Path(code_root);self.proc_root=Path(proc_root);self.seconds=seconds;self.locks=[];self.installed=None

    def census(self):
        deadline=time.monotonic()+self.seconds;count=0
        for entry in self.proc_root.iterdir():
            if not entry.name.isdigit():continue
            count+=1
            if count>MAX_PROCESSES or time.monotonic()>deadline:raise RuntimeError('bounded_process_census_failed')
            try:
                with (entry/'cmdline').open('rb') as stream: raw=stream.read(8193)
                if len(raw)>8192:raise RuntimeError('bounded_process_census_failed')
                tokens=raw.split(b'\0');root=os.fsencode(self.code_root)
                if any(token==root or token.startswith(root+b'/') for token in tokens):raise RuntimeError('owned_helper_process_still_live')
                # Resolve executable identity too, without retaining paths or argv.
                exe=os.readlink(entry/'exe')
                if exe==str(self.code_root) or exe.startswith(str(self.code_root)+'/'):raise RuntimeError('owned_helper_process_still_live')
            except FileNotFoundError:continue
            except PermissionError:raise RuntimeError('bounded_process_census_failed') from None
        return count

    def check(self):
        self.unit_inactive()
        for path,fd,identity in self.locks:
            current=path.lstat();opened=os.fstat(fd)
            if (current.st_dev,current.st_ino)!=(opened.st_dev,opened.st_ino) or (opened.st_dev,opened.st_ino)!=identity or opened.st_nlink!=1:raise RuntimeError('owned_lock_inode_changed')
        if self.installed:
            for pid,ticks in journal_holders(self.journal):
                if proc_ticks(self.proc_root/str(pid))==ticks:raise RuntimeError('retained_holder_still_live')
        else:
            if self.journal is not None and Path(self.journal).exists():
                for pid,ticks in journal_holders(self.journal):
                    if proc_ticks(self.proc_root/str(pid))==ticks:raise RuntimeError('retained_holder_still_live')
        self.census();self.unit_inactive()

    def __enter__(self):
        owned_directory(self.runtime)
        self.installed=any(Path(target).exists() or Path(target).is_symlink() for target,_mode in self.targets.values())
        if not self.installed and self.code_root.exists() and any(self.code_root.iterdir()):raise RuntimeError('unknown_existing_helper_files')
        if not self.installed and any(p.name not in ('supervisor.lock','holder.lock') for p in self.runtime.iterdir()):raise RuntimeError('unknown_existing_runtime_files')
        try:
            for name in ('supervisor.lock','holder.lock'):
                path=self.runtime/name;fd=os.open(path,os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600)
                self.locks.append((path,fd,None));info=os.fstat(fd)
                if not stat.S_ISREG(info.st_mode) or info.st_uid!=os.geteuid() or info.st_nlink!=1 or info.st_mode&0o077:raise ValueError('owned_guard_lock_required')
                fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
                self.locks[-1]=(path,fd,(info.st_dev,info.st_ino))
            self.check();return self
        except BaseException:
            self.__exit__(None,None,None);raise

    def __exit__(self,*_args):
        for _path,fd,_identity in reversed(self.locks):os.close(fd)
        self.locks=[]
