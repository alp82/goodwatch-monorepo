"""Independent registered consumer birth, with PID reuse-safe cleanup.

This module acts only inside the authenticated SSH stdin closure. It never
accepts arbitrary targets and cannot signal a source, its wrapper or parents.
"""
import json
import os
from pathlib import Path
import select
import signal
import stat
import sys
import time

sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from packet import canonical,metadata,read_owned,sha,directory
from setup import ROOT,NEW,acquire_control,Docker
from stager import STAGE,NODE_BYTES

RECORD=ROOT/'cpu0-consumer-registration-v1.json'
BIRTH_KEYS=frozenset(('pid','startTicks','parentPid','exeIdentityHash','groupHash','VmLckBytes','outsideSourceCgroup'))


def protected(lifecycle,docker):
    source=lifecycle.attest(NEW,docker)
    return source,{os.getpid(),os.getppid(),source['wrapper']['pid'],
                   source['wrapper']['parentPid'],source['qdrant']['pid'],
                   source['qdrant']['parentPid']}


def expected_argv(source_sha,external_sha,consumer_predecessor,raise_own_nofile):
    if type(raise_own_nofile) is not bool:raise RuntimeError('consumer_argv_invalid')
    argv=[str(STAGE/'node'),str(STAGE/'consumer_cpu0.mjs'),'--execute-reviewed',
          '--handoff-sha256',consumer_predecessor,'--cpu0-source-freeze-sha256',source_sha,
          '--external-manifest-sha256',external_sha]
    if raise_own_nofile:argv.append('--raise-own-nofile')
    return argv


def confirm_birth(lifecycle,birth,source,argv,*,proc=Path('/proc')):
    if not isinstance(birth,dict) or set(birth)!=BIRTH_KEYS or birth['outsideSourceCgroup'] is not True or type(birth['pid']) is not int or birth['pid']<=0:
        raise RuntimeError('consumer_birth_invalid')
    observed=lifecycle.process(birth['pid'],proc)
    source_process=lifecycle.process(source['qdrant']['pid'],proc)
    if lifecycle.public_process(source_process)!=source['qdrant']:
        raise RuntimeError('consumer_registration_source_changed')
    group=source_process['group'];own_group=observed['group']
    if own_group==group or own_group.startswith(group.rstrip('/')+'/'):
        raise RuntimeError('consumer_inside_source_subtree')
    if lifecycle.public_process(observed)!={k:v for k,v in birth.items() if k!='outsideSourceCgroup'} or observed['exeBasename']!='node' or observed['comm']!='node' or observed['groupHash']==source['qdrant']['groupHash'] or observed['groupHash']==source['wrapper']['groupHash']:
        raise RuntimeError('consumer_birth_changed')
    node=(STAGE/'node').lstat();exe=(proc/str(birth['pid'])/'exe').stat()
    if not stat.S_ISREG(node.st_mode) or node.st_uid!=0 or stat.S_IMODE(node.st_mode)!=0o700 or node.st_nlink!=1 or node.st_size!=NODE_BYTES or (node.st_dev,node.st_ino,node.st_size)!=(exe.st_dev,exe.st_ino,exe.st_size):
        raise RuntimeError('consumer_executable_changed')
    raw=lifecycle.bounded(proc/str(birth['pid'])/'cmdline',65536)
    if raw!=b'\0'.join(value.encode() for value in argv)+b'\0':
        raise RuntimeError('consumer_argv_changed')
    return observed


def register(lifecycle,docker,predecessor,birth,source_sha,external_sha,
             consumer_predecessor,raise_own_nofile):
    """Fresh control-lock admission plus independent actual /proc observation.

    The pure consumer contract must already have validated the complete frame;
    that validation is not substituted by this process metadata proof.
    """
    fd=acquire_control(lifecycle);pidfd=None;primary=None
    try:
        lifecycle.read_handoff(docker,predecessor)
        before,blocked=protected(lifecycle,docker)
        if birth.get('pid') in blocked:raise RuntimeError('consumer_target_protected')
        # PIDFD precedes re-reading birth and executable identity.
        pidfd=os.pidfd_open(birth['pid'],0)
        argv=expected_argv(source_sha,external_sha,consumer_predecessor,raise_own_nofile)
        first=confirm_birth(lifecycle,birth,before,argv)
        if select.select([pidfd],[],[],0)[0]:raise RuntimeError('consumer_birth_gone')
        second=confirm_birth(lifecycle,birth,before,argv)
        after=lifecycle.attest(NEW,docker)
        lifecycle.read_handoff(docker,predecessor)
        if before!=after or first!=second:raise RuntimeError('consumer_registration_source_changed')
        value={'schema':'cpu0-consumer-registration.v6','sourceFreezeSha256':source_sha,
               'externalManifestSha256':external_sha,'predecessorSha256':predecessor,
               'consumerPredecessorSha256':consumer_predecessor,
               'raiseOwnNofile':raise_own_nofile,'consumerArgvHash':sha(canonical(argv)),
               'consumerBirth':birth,'source':before,'registeredBeforeCapture':True}
        raw=canonical(value)+b'\n'
        directory(ROOT)
        out=os.open(RECORD,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_CLOEXEC,0o600)
        with os.fdopen(out,'wb') as target:
            target.write(raw);target.flush();os.fsync(target.fileno())
        dfd=os.open(ROOT,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC)
        try:os.fsync(dfd)
        finally:os.close(dfd)
        return {**value,'registrationSha256':sha(raw)}
    except BaseException as error:
        primary=error;raise
    finally:
        failures=[]
        for own in (pidfd,fd):
            if own is not None:
                try:os.close(own)
                except OSError:failures.append('consumer_registration_fd_close_failed')
        if failures:
            if primary is not None:primary.registrationCleanupFailure=failures
            else:raise RuntimeError('consumer_registration_fd_close_failed')


def cleanup(lifecycle,docker,registration_sha):
    """Recorded birth only; no process-group signals or PID replacement signal."""
    raw,_=read_owned(RECORD)
    if sha(raw)!=registration_sha:raise RuntimeError('consumer_registration_changed')
    value=json.loads(raw)
    if not isinstance(value,dict) or value.get('schema')!='cpu0-consumer-registration.v6':raise RuntimeError('consumer_registration_changed')
    birth=value['consumerBirth'];before,blocked=protected(lifecycle,docker)
    if birth['pid'] in blocked:raise RuntimeError('consumer_target_protected')
    fd=None;sent=False
    try:
        try:fd=os.pidfd_open(birth['pid'],0)
        except ProcessLookupError:
            return {'schema':'cpu0-consumer-cleanup.v6','birthGone':lifecycle.birth_gone(birth['pid'],birth['startTicks']),'exitObserved':True,'signalSent':False,'signal':None,'killFallback':False}
        try:now=lifecycle.birth(birth['pid'])
        except FileNotFoundError:now=None
        if now!=birth['startTicks'] or select.select([fd],[],[],0)[0]:
            return {'schema':'cpu0-consumer-cleanup.v6','birthGone':lifecycle.birth_gone(birth['pid'],birth['startTicks']),'exitObserved':now!=birth['startTicks'] or bool(select.select([fd],[],[],0)[0]),'signalSent':False,'signal':None,'killFallback':False}
        argv=expected_argv(value['sourceFreezeSha256'],value['externalManifestSha256'],
                           value['consumerPredecessorSha256'],value['raiseOwnNofile'])
        if value['consumerArgvHash']!=sha(canonical(argv)):raise RuntimeError('consumer_registration_changed')
        confirm_birth(lifecycle,birth,before,argv)
        # No cleanup lock: consumer/controller might still own it. Signals only
        # the explicitly registered, independently proved consumer birth.
        signal.pidfd_send_signal(fd,signal.SIGTERM,None,0);sent=True
        ready=bool(select.select([fd],[],[],10)[0])
        gone=lifecycle.birth_gone(birth['pid'],birth['startTicks'])
        return {'schema':'cpu0-consumer-cleanup.v6','birthGone':gone,'exitObserved':ready,
                'signalSent':sent,'signal':'SIGTERM' if sent else None,'killFallback':False,
                'unknownRetained':not gone}
    finally:
        if fd is not None:os.close(fd)


if __name__=='__main__':
    print(json.dumps({'schema':'cpu0-consumer-registration.v6','status':'prepared-only','hostOperations':0}))
