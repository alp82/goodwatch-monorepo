"""Prepared zero-pin placement/lifecycle gate. Default performs no inspection."""
import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import sys
import time
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
import production
import runtime
from production_journal import Journal

REASONS=production.PRODUCTION_REASONS|{'zero_source_contract_changed','zero_contract_invalid','zero_source_changed',
    'zero_child_not_unlocked','zero_child_reply_invalid','zero_child_deadline','zero_limit_event','zero_registration_unproven',
    'zero_placement_failed','zero_child_parent_changed','zero_source_rpc_timeout','zero_command_invalid','zero_code_changed'}


def reason(error):
    value=str(error)
    return value if type(error)in(RuntimeError,ValueError) and value in REASONS else 'guard_or_runtime_failure'


def code_hash():
    value=hashlib.sha256()
    for name in ('pin.py','runtime.py','production.py','production_journal.py','zero_placement.py'):
        value.update(name.encode()+b'\0'+(Path(__file__).parent/name).read_bytes()+b'\0')
    return value.hexdigest()


def contract(path,digest):
    with Path(path).open('rb')as stream:raw=stream.read(16385)
    if len(raw)>16384 or not re.fullmatch('[a-f0-9]{64}',digest or '') or hashlib.sha256(raw).hexdigest()!=digest:raise ValueError('zero_source_contract_changed')
    source=json.loads(raw)
    keys={'store','image','mounts','memoryBytes','swapBytes','cpuNanos','memoryMax','memoryHigh','cpuMax'}
    if type(source)is not dict or set(source)!=keys:raise ValueError('zero_contract_invalid')
    store=Path(source['store'])
    if not store.is_absolute() or store.resolve()!=store or not store.is_dir() or not re.fullmatch('sha256:[a-f0-9]{64}',source['image']):raise ValueError('zero_contract_invalid')
    mounts=source['mounts']
    if type(mounts)is not list or not 1<=len(mounts)<=8:raise ValueError('zero_contract_invalid')
    for row in mounts:
        if type(row)is not list or len(row)!=4 or any(type(x)is not str or not x.startswith('/')for x in row[:2]) or row[2]not in('bind','volume') or type(row[3])is not bool:raise ValueError('zero_contract_invalid')
    frozen=frozenset(tuple(row)for row in mounts)
    if len(frozen)!=len(mounts) or not any(row[0]==str(store) and row[1]=='/qdrant/storage' and row[3]for row in frozen):raise ValueError('zero_contract_invalid')
    if any(type(source[key])is not int or source[key]!=0 for key in('memoryBytes','swapBytes','cpuNanos')) or (source['memoryMax'],source['memoryHigh'],source['cpuMax'])!=('max','max','max 100000'):raise ValueError('zero_contract_invalid')
    return {'source':source},runtime.Spec('production','qdrant-main',source['image'],store,frozen,0,0,0)


def vm_locked(pid):
    rows=(Path('/proc')/str(pid)/'status').read_text().splitlines()
    values=[int(row.split()[1])*1024 for row in rows if row.startswith('VmLck:')]
    if values!=[0]:raise RuntimeError('zero_child_not_unlocked')
    return 0


def child(connection,spec,expected_hash,lease=60,rpc=15):
    try:
        if code_hash()!=expected_hash:raise RuntimeError('zero_code_changed')
        parent=os.getppid()
        if parent<=1 or ctypes.CDLL(None,use_errno=True).prctl(1,signal.SIGTERM,0,0,0)!=0 or os.getppid()!=parent:raise RuntimeError('zero_child_parent_changed')
        signal.signal(signal.SIGTERM,signal.SIG_DFL);signal.pthread_sigmask(signal.SIG_UNBLOCK,{signal.SIGTERM})
        connection.send({'ready':True})
        if not connection.poll(lease):return
        if connection.recv()!='join':raise RuntimeError('zero_command_invalid')
        vm_locked(os.getpid())
        def source_check(requested):
            if requested!=spec:raise RuntimeError('zero_source_changed')
            connection.send({'request':'source'})
            if not connection.poll(rpc):raise RuntimeError('zero_source_rpc_timeout')
            reply=connection.recv()
            if type(reply)is not dict or set(reply)!={'source'} or reply['source'].spec!=spec:raise RuntimeError('zero_source_changed')
            return runtime.validate_source_locally(reply['source'])
        source=source_check(spec)
        runtime.prepare_self(source,0,source_check=source_check)
        if production.own_group()!=source.cgroup_relative:raise RuntimeError('zero_placement_failed')
        vm_locked(os.getpid())
        connection.send({'joined':True,'vmLockedBytes':0})
        if connection.poll(lease) and connection.recv()=='close':connection.send({'closed':True})
    except BaseException as error:
        try:connection.send({'failed':reason(error)})
        except BaseException:pass
        raise SystemExit(1)
    finally:connection.close()


def limits(source):
    result=runtime.accounting(source)
    return {'memory':{key:result['memoryEvents'][key]for key in('oom','oom_kill','max')},
            'cpu':{key:result['cpu'][key]for key in('nr_throttled','throttled_usec')}}


def same_limits(before,after):
    if before!=after:raise RuntimeError('zero_limit_event')


def run(config,spec,register,emit,worker_factory=production.Holder,seconds=30,poll=.1,check_source=production.check_source,expected_hash=None):
    expected_hash=expected_hash or code_hash()
    if code_hash()!=expected_hash:raise RuntimeError('zero_code_changed')
    original=production.own_group();anchor=check_source(config,spec,original);start_limits=limits(anchor)
    source_hash=hashlib.sha256(repr(anchor.identity).encode()).hexdigest()
    source_proof={'qdrantPid':anchor.pid,'sourceStartTicks':anchor.identity[3],'sourceIdentitySha256':source_hash,
                  'imageSha256':spec.image.removeprefix('sha256:'),
                  'mountsSha256':hashlib.sha256(repr(sorted(spec.mounts)).encode()).hexdigest(),
                  'dockerMemoryBytes':0,'dockerSwapBytes':0,'dockerCpuNanos':0,'cgroupMemoryMaxUnlimited':True,
                  'cgroupMemoryHighUnlimited':True,'cgroupCpuUnlimited':True,'oomGroup':0}
    emit({'phase':'source_before',**source_proof})
    for mode in ('close','term','kill'):
        worker=None;cleanup=None
        try:
            if code_hash()!=expected_hash:raise RuntimeError('zero_code_changed')
            fresh=check_source(config,spec,original)
            if fresh.identity!=anchor.identity:raise RuntimeError('zero_source_changed')
            same_limits(start_limits,limits(fresh))
            worker=worker_factory(child,(spec,expected_hash))
            birth=production.holder_birth(worker)
            if register(birth)is not True:raise RuntimeError('zero_registration_unproven')
            # No source placement command is sent until fsync acknowledgement.
            worker.connection.send('join');deadline=time.monotonic()+seconds;requests=0;ready=False
            while time.monotonic()<deadline:
                if not worker.connection.poll(min(poll,max(0,deadline-time.monotonic()))):continue
                reply=worker.connection.recv()
                if reply=={'ready':True}:
                    if ready:raise RuntimeError('zero_child_reply_invalid')
                    ready=True;continue
                if reply=={'request':'source'}:
                    requests+=1
                    if requests>8:raise RuntimeError('source_rpc_budget')
                    fresh=check_source(config,spec,original)
                    if fresh.identity!=anchor.identity:raise RuntimeError('zero_source_changed')
                    same_limits(start_limits,limits(fresh));worker.connection.send({'source':fresh});continue
                if type(reply)is dict and set(reply)=={'failed'}:
                    if reply['failed']not in REASONS:raise RuntimeError('zero_child_reply_invalid')
                    raise RuntimeError(reply['failed'])
                if not ready or reply!={'joined':True,'vmLockedBytes':0}:raise RuntimeError('zero_child_reply_invalid')
                break
            else:raise RuntimeError('zero_child_deadline')
            fresh=check_source(config,spec,original)
            if fresh.identity!=anchor.identity or production.own_group()!=original:raise RuntimeError('zero_source_changed')
            proof=production.verify_holder(worker,fresh,{'qdrantPid':fresh.pid,'sourceStartTicks':fresh.identity[3],'lockedBytes':0},type('ZeroPolicy',(),{'max_locked_bytes':0})())
            if proof['holderStartTicks']!=birth['holderStartTicks']:raise RuntimeError('zero_source_changed')
            vm_locked(worker.process.pid);same_limits(start_limits,limits(fresh))
            emit({'phase':'joined','mode':mode,'vmLockedBytes':0,'parentOutsideSourceCgroup':True,'holderPlacementVerified':True,
                  'qdrantPid':anchor.pid,'sourceStartTicks':anchor.identity[3],'sourceIdentitySha256':source_hash,'holderPid':birth['holderPid'],'holderStartTicks':birth['holderStartTicks'],'sourceRpcCount':requests})
            if mode!='close':
                worker.signal_owned(signal.SIGTERM if mode=='term'else signal.SIGKILL);worker.process.join(5)
            cleanup=worker.close()
            if cleanup['released']is not True or mode=='close' and cleanup['gracefulReleaseAcknowledged']is not True or mode=='term' and cleanup['exitCode']!=-signal.SIGTERM or mode=='kill' and cleanup['exitCode']!=-signal.SIGKILL:raise RuntimeError('holder_exit_unproven')
            fresh=check_source(config,spec,original)
            if fresh.identity!=anchor.identity or production.own_group()!=original:raise RuntimeError('zero_source_changed')
            same_limits(start_limits,limits(fresh))
            if code_hash()!=expected_hash:raise RuntimeError('zero_code_changed')
            emit({'phase':'exited','mode':mode,**cleanup,'vmLockedBytes':0})
        finally:
            if worker is not None and (cleanup is None or cleanup['released']is not True):
                cleanup=worker.close(emergency=True)
                emit({'phase':'cleanup','mode':mode,**cleanup,'vmLockedBytes':0})
                if cleanup['released']is not True:raise RuntimeError('holder_exit_unproven')
    emit({'phase':'source_after',**source_proof,'allocationUnchanged':True})
    emit({'phase':'complete','children':3,'queries':0,'inventoryReads':0,'archiveReads':0,'modelReads':0,'lockedBytes':0,
          'qdrantPid':anchor.pid,'sourceStartTicks':anchor.identity[3],'sourceIdentitySha256':source_hash})


def main(argv=None):
    class Parser(argparse.ArgumentParser):
        def error(self,message):raise ValueError('invalid_cli_arguments')
    parser=Parser(description=__doc__);parser.add_argument('--execute-reviewed',action='store_true')
    parser.add_argument('--contract');parser.add_argument('--contract-sha256');parser.add_argument('--code-sha256');parser.add_argument('--journal')
    journal=None;result=1
    try:
        args=parser.parse_args(argv)
        if not args.execute_reviewed:print(json.dumps({'event':'qdrant.zero-placement.prepared.v1','execution':False}));return 0
        if args.code_sha256!=code_hash():raise RuntimeError('zero_code_changed')
        config,spec=contract(args.contract,args.contract_sha256)
        journal=Journal(args.journal,args.code_sha256,args.contract_sha256,args.code_sha256)
        def register(birth):
            row={'event':'qdrant.pin-helper.v1','at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
                 'codeSha256':args.code_sha256,'policySha256':args.contract_sha256,'queries':0,'storageWrites':0,**birth}
            journal.write(json.dumps(row)+'\n')
            return journal.holder_registration_committed(birth['holderPid'],birth['holderStartTicks'])
        def emit(row):
            event={'event':'qdrant.zero-placement.v1','at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),**row}
            journal.append('probe.zero-placement',event);print(json.dumps(event),flush=True)
        run(config,spec,register,emit,expected_hash=args.code_sha256);result=0
    except BaseException as error:
        print(json.dumps({'event':'qdrant.zero-placement.failed.v1','reason':reason(error),'lockedBytes':0}),flush=True);result=1
    finally:
        if journal is not None:
            try:journal.close()
            except BaseException:
                print(json.dumps({'event':'qdrant.zero-placement.failed.v1','reason':'guard_or_runtime_failure','lockedBytes':0}),flush=True);result=1
    return result


if __name__=='__main__':raise SystemExit(main())
