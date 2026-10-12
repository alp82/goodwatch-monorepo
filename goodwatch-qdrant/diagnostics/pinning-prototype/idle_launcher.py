"""Inactive idle API integration; CLI never executes a trial."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import select
import stat
import sys
import threading

sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
import idle_journal
import idle_lease
import idle_trial
import production
import zero_placement

CODE_FILES=('pin.py','runtime.py','production.py','production_journal.py','zero_placement.py',
    'idle_trial.py','idle_journal.py','idle_lease.py','idle_launcher.py')


LAUNCHER_REASONS=frozenset({'idle_launcher_code_changed','idle_launcher_owned_context_required','idle_launcher_source_changed','idle_launcher_timer_conflict','idle_launcher_birth_invalid','zero_source_contract_changed','zero_contract_invalid'})

def reason(error):
    value=str(error)
    return value if type(error)in(RuntimeError,ValueError)and value in LAUNCHER_REASONS else idle_trial.reason(error)


def packet_hash(rows):
    return hashlib.sha256(json.dumps(rows,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def _verify_code(root,rows,owner_uid):
    """Owner parameter is a private local-fixture seam; public verify is root-only."""
    if type(rows)is not dict or set(rows)!=set(CODE_FILES) or root.resolve()!=root:raise RuntimeError('idle_launcher_code_changed')
    parent=root.stat()
    if parent.st_uid!=owner_uid or parent.st_mode&0o077 or set(os.listdir(root))!=set(CODE_FILES):raise RuntimeError('idle_launcher_code_changed')
    for ancestor in root.parents if owner_uid==0 else ():
        info=ancestor.stat()
        if info.st_uid!=owner_uid or info.st_mode&0o022:raise RuntimeError('idle_launcher_code_changed')
    identities=set()
    for name in CODE_FILES:
        expected=rows[name]
        if type(expected)is not dict or set(expected)!={'bytes','sha256'}or type(expected['bytes'])is not int or not 0<expected['bytes']<=262144 or type(expected['sha256'])is not str or not idle_journal.HASH.fullmatch(expected['sha256']):raise RuntimeError('idle_launcher_code_changed')
        descriptor=os.open(root/name,os.O_RDONLY|os.O_NOFOLLOW)
        try:
            before=os.fstat(descriptor)
            if not stat.S_ISREG(before.st_mode)or before.st_uid!=owner_uid or stat.S_IMODE(before.st_mode)!=0o400 or before.st_nlink!=1 or (before.st_dev,before.st_ino)in identities:raise RuntimeError('idle_launcher_code_changed')
            raw=os.read(descriptor,262145);after=os.fstat(descriptor)
            identity=lambda info:(info.st_dev,info.st_ino,info.st_mode,info.st_uid,info.st_nlink,info.st_size,info.st_mtime_ns,info.st_ctime_ns)
            if identity(before)!=identity(after) or len(raw)!=expected['bytes'] or hashlib.sha256(raw).hexdigest()!=expected['sha256']:raise RuntimeError('idle_launcher_code_changed')
            identities.add((before.st_dev,before.st_ino))
        finally:os.close(descriptor)
    return packet_hash(rows)


def verify_code(rows):return _verify_code(Path(__file__).resolve().parent,rows,0)


class OwnedBirths:
    """Retain PID-fd ownership before durable birth ACK, never signal the source."""
    def __init__(self,source_pid):self.source_pid=source_pid;self.held=[]

    def register(self,birth,journal):
        row=idle_journal.birth(dict(birth));pid=row['holderPid']
        if pid in (os.getpid(),self.source_pid):raise RuntimeError('idle_launcher_birth_invalid')
        def identity():
            fields=(Path('/proc')/str(pid)/'stat').read_text().rsplit(')',1)[1].split()
            return int(fields[1]),int(fields[19])
        expected=(os.getpid(),row['holderStartTicks'])
        if identity()!=expected:raise RuntimeError('idle_launcher_birth_invalid')
        descriptor=os.pidfd_open(pid)
        try:
            if identity()!=expected or select.select([descriptor],[],[],0)[0]:raise RuntimeError('idle_launcher_birth_invalid')
        except BaseException:os.close(descriptor);raise
        self.held.append(descriptor)
        return journal.register(row)

    def release(self):
        gone=True;remaining=[]
        for descriptor in self.held:
            if not select.select([descriptor],[],[],0)[0]:
                try:signal.pidfd_send_signal(descriptor,signal.SIGKILL)
                except ProcessLookupError:pass
            if select.select([descriptor],[],[],1)[0]:os.close(descriptor)
            else:remaining.append(descriptor);gone=False
        self.held=remaining
        return gone


def result_reason(row):
    if row is None:return None
    if row.get('cleanupReason')=='holder_exit_unproven':return 'holder_exit_unproven'
    value=next((row.get(key)for key in ('safetyReason','mainReason','firstReason','postReleaseReason','cleanupReason','observerShutdownReason','drainReason','completionReason')if row.get(key)is not None),None)
    return 'idle_guard_failure'if value=='idle_hold_complete'and row.get('outcome')!='pass'else value


def _invoke(config,spec,policy_path,policy_hash,lease,code_hash,journal_path,source_pid=0,binding=None,preflight=None):
    """Private fixture seam; production calls only public idle_trial.run."""
    journal=idle_journal.Journal(journal_path,code_hash,policy_hash)
    owned=OwnedBirths(source_pid)
    outcome='evidence_failure';proof=None;holders_gone=False;failure=None
    try:
        if binding is not None:journal.bind(binding)
        if preflight is not None:preflight()
        outcome=idle_trial.run(config,spec,lambda birth:owned.register(birth,journal),journal.emit,lease,code_hash,policy_path,policy_hash,raise_memlock=True,raise_nofile=True)
    except BaseException as error:
        failure=idle_trial.reason(error);outcome='evidence_failure'
        if preflight is not None and journal.last_event is None:
            try:
                from datetime import datetime,timezone
                journal.emit({'event':'qdrant.idle-lock-trial.v1','policyBasis':'idle-2g-floor-6g-transient.v1','codeSha256':code_hash,'policySha256':policy_hash,'scheduleSha256':None,'at':datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),'queries':0,'storageWrites':0,'phase':'complete','outcome':'refused','firstReason':failure});outcome='refused'
            except BaseException:outcome='evidence_failure'
    finally:
        try:holders_gone=owned.release()
        except BaseException:failure='idle_guard_failure'
        finally:
            try:proof=journal.close()
            except BaseException:proof={'released':False,'gracefulReleaseAcknowledged':False,'exitCode':None};failure='idle_guard_failure'
    if not proof['released']or not holders_gone:
        outcome='release_unproven';failure='holder_exit_unproven'if not holders_gone else'idle_journal_release_unproven'
    if not proof['gracefulReleaseAcknowledged']or proof['exitCode']!=0:
        if outcome=='pass':outcome='evidence_failure';failure='idle_journal_nongraceful_exit'
    return {'event':'qdrant.idle-launcher.v1','phase':'complete','outcome':outcome,
        'reason':failure if failure is not None else result_reason(journal.last_event),'packetSha256':None if binding is None else binding['packetSha256'],
        'sourceContractSha256':None if binding is None else binding['sourceContractSha256'],
        'terminalReceipt':None if journal.last_receipt is None else dict(journal.last_receipt),
        'writerReleased':proof['released'],'writerGraceful':proof['gracefulReleaseAcknowledged'],
        'writerExitCode':proof['exitCode'],'registeredHoldersExited':holders_gone,'queries':0,'storageWrites':0}


def run_reviewed(contract_path,contract_hash,policy_path,policy_hash,schedule_config,code_rows,journal_path,source_pid,source_ticks,source_identity_hash):
    """Preparation API: private inputs are hash-bound, CLI remains refused."""
    try:
        if os.geteuid()!=0 or threading.current_thread()is not threading.main_thread()or not sys.flags.dont_write_bytecode:raise RuntimeError('idle_launcher_owned_context_required')
        packet=verify_code(code_rows)
        config,spec=zero_placement.contract(contract_path,contract_hash)
        # The writer must inherit a verified outside-source parent cgroup.
        original=production.own_group();initial_source=production.check_source(config,spec,original)
        if original==initial_source.cgroup_relative or original.startswith(initial_source.cgroup_relative.rstrip('/')+'/'):raise RuntimeError('supervisor_placement_changed')
        if signal.getsignal(signal.SIGALRM)!=signal.SIG_DFL or signal.getitimer(signal.ITIMER_REAL)!=(0.0,0.0):raise RuntimeError('idle_launcher_timer_conflict')
    except BaseException as error:
        return {'event':'qdrant.idle-launcher.v1','phase':'refused','outcome':'refused','reason':reason(error),'journalCreated':False,'queries':0,'storageWrites':0}
    def preflight():
        idle_trial.load_policy(policy_path,policy_hash);idle_lease.validate_config(schedule_config)
        original=production.own_group();source=production.check_source(config,spec,original)
        if any(type(value)is not int or value<=1 for value in (source_pid,source_ticks))or type(source_identity_hash)is not str or not idle_journal.HASH.fullmatch(source_identity_hash)or (source.pid,source.identity[3])!=(source_pid,source_ticks)or hashlib.sha256(repr(source.identity).encode()).hexdigest()!=source_identity_hash:raise RuntimeError('idle_launcher_source_changed')
        if zero_placement.vm_locked(os.getpid())!=0:raise RuntimeError('idle_launcher_source_changed')
        idle_trial.sample(source)
        if (source.cgroup/'memory.swap.current').read_text().strip()!='0':raise RuntimeError('idle_launcher_source_changed')
        lease()
    # Schedule validation executes inside the journaled preflight, not here.
    def lease():
        if not hasattr(lease,'checked'):
            idle_lease.validate_config(schedule_config)
            schedule_hash=hashlib.sha256(json.dumps(schedule_config,sort_keys=True,separators=(',',':')).encode()).hexdigest()
            lease.checked=idle_lease.Lease({'schema':'qdrant.idle-schedule-proof.v1','minute':schedule_config['minute'],'scheduleSha256':schedule_hash},checker=lambda:idle_lease.inspect_known(schedule_config))
        return lease.checked()
    previous_mask=signal.pthread_sigmask(signal.SIG_UNBLOCK,{signal.SIGALRM});signal.setitimer(signal.ITIMER_REAL,400)
    try:
        result=_invoke(config,spec,policy_path,policy_hash,lease,idle_trial.code_hash(),journal_path,source_pid=source_pid,
            binding={'packetSha256':packet,'sourceContractSha256':contract_hash},preflight=preflight)
    except BaseException as error:
        return {'event':'qdrant.idle-launcher.v1','phase':'refused','outcome':'release_unproven','reason':reason(error),'journalCreationUnknown':True,'queries':0,'storageWrites':0}
    if result['registeredHoldersExited']and result['writerReleased']:
        signal.setitimer(signal.ITIMER_REAL,0);signal.pthread_sigmask(signal.SIG_SETMASK,previous_mask)
    return result


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--execute-reviewed',action='store_true');args=parser.parse_args(argv)
    print(json.dumps({'event':'qdrant.idle-launcher.v1','phase':'refused'if args.execute_reviewed else'prepared',
        'execution':False,'reason':'idle_launcher_not_reviewed','queries':0,'storageWrites':0}))
    return 1 if args.execute_reviewed else 0


if __name__=='__main__':raise SystemExit(main())
