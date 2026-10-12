"""Prepared zero-pin clone cgroup-join/turnover gate; explicit review required."""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
HERE = Path(__file__).absolute().parent
if HERE.resolve() != HERE: raise SystemExit(1)
sys.path.insert(0, str(HERE))
import json
import fcntl
import stat
import multiprocessing
import os
import signal
import time
import urllib.request
import controller_cpu0 as control
import daemon_cpu0 as daemon
import runtime_cpu0 as runtime


def locked_bytes(pid):
    rows=(Path('/proc')/str(pid)/'status').read_text().splitlines()
    values=[int(row.split()[1])*1024 for row in rows if row.startswith('VmLck:')]
    if len(values)!=1: raise RuntimeError('zero_pin_proof_missing')
    return values[0]


def zero_child(connection, source, config):
    try:
        control.frozen_helper(config)
        def local_check(spec):
            if spec != source.spec: raise RuntimeError('source_spec_changed')
            return runtime.validate_source_locally(source)
        runtime.prepare_self(source,0,source_check=local_check)
        if locked_bytes(os.getpid())!=0: raise RuntimeError('zero_pin_proof_missing')
        connection.send({'stage':'joined','lockedBytes':0})
        if not connection.poll(120) or connection.recv()!='close': raise RuntimeError('zero_child_lease_failed')
        connection.send({'stage':'released','lockedBytes':locked_bytes(os.getpid())})
    except BaseException as error:
        try:connection.send({'stage':'failed','reason':control.safe_control_reason(error),**control.cpu0_guards.failure_evidence(error)})
        except (BrokenPipeError,EOFError,OSError):pass
        raise SystemExit(1)
    finally: connection.close()


class ZeroChild:
    def __init__(self,source,config):
        multiprocessing.set_executable('/usr/bin/python3')
        context=multiprocessing.get_context('spawn');self.connection,child=context.Pipe()
        self.process=context.Process(target=zero_child,args=(child,source,config));self.process.start();child.close()
    def joined(self,source):
        if not self.connection.poll(15):raise RuntimeError('zero_child_timeout')
        if self.connection.recv()!={'stage':'joined','lockedBytes':0}:raise RuntimeError('zero_join_failed')
        path=Path('/proc')/str(self.process.pid)
        if not self.process.is_alive() or locked_bytes(self.process.pid)!=0 or (path/'cgroup').read_text().strip().split(':',2)[2]!=source.cgroup_relative:
            raise RuntimeError('zero_join_proof_missing')
        return {'joined':True,'lockedBytes':0,'childPidPositive':self.process.pid>0}
    def gone(self,graceful=True):
        if graceful and self.process.is_alive():
            try:self.connection.send('close')
            except (BrokenPipeError,EOFError,OSError):pass
        self.process.join(5)
        survived=self.process.is_alive()
        if survived:self.process.terminate();self.process.join(5)
        if self.process.is_alive():self.process.kill();self.process.join(5)
        if self.process.is_alive() or (Path('/proc')/str(self.process.pid)).exists():raise RuntimeError('zero_child_exit_unproven')
        self.connection.close()
        return {'childGone':True,'survivedGracePeriod':survived,'exitCode':self.process.exitcode,'queries':0,'lockedBytes':0}


def ready(spec):
    deadline=time.monotonic()+90
    while time.monotonic()<deadline:
        control.inspect_stopped_or_running(spec)
        try:
            with urllib.request.urlopen('http://127.0.0.1:16333/collections/media_fingerprint_v1',timeout=2) as response: info=json.load(response)['result']
            if info['status']=='green' and info['optimizer_status']=='ok':
                if (info['points_count'],info['segments_count'],info['config']['params']['shard_number'])!=(244262,12,6):raise RuntimeError('turnover_shape_changed')
                source=control.inspect_source(spec);control.guard_shards(source);return source
        except OSError:pass
        time.sleep(1)
    raise RuntimeError('turnover_readiness_failed')


def stage(config,spec,policy,emit):
    # Metadata and self placement only: no cache advice, archive read, mapping or lock.
    if control.ROOT.resolve()!=control.ROOT:raise RuntimeError('owned_root_changed')
    control.owned_store_files(spec.store);control.owned_total_budget();control.host_available(max(policy.emergency_bytes,policy.reserve_bytes+policy.cap_reserve_bytes))
    control.cpu0_guards.host_cpu()
    parent=control.self_cgroup();control.inspect_stopped_or_running(spec);source=control.inspect_source(spec)
    if parent==source.cgroup_relative:raise RuntimeError('parent_already_clone_cgroup')
    control.frozen_helper(config);before=runtime.accounting(source);child=ZeroChild(source,config)
    try:
        joined=child.joined(source)
        if control.inspect_source(spec).identity!=source.identity or control.self_cgroup()!=parent:raise RuntimeError('join_source_changed')
        emit({'stage':'first-join','at':control.at(),**joined,'parentUnchanged':True,'joinLimits':control.limits(before,runtime.accounting(source))})
        control.inspect_stopped_or_running(spec);control.clone_command('stop','--time','20',spec.container)
        if control.inspect_stopped_or_running(spec)['State']['Running']:raise RuntimeError('clone_not_stopped')
        # Docker may kill a foreign root child in its cgroup. Record, never assume.
        outcome=child.gone(graceful=False);child=None
        emit({'stage':'old-child-gone','at':control.at(),**outcome})
        if control.self_cgroup()!=parent:raise RuntimeError('parent_cgroup_changed')
        control.owned_total_budget();control.host_available(max(policy.emergency_bytes,5*1024**3));control.frozen_helper(config)
        control.cpu0_guards.host_cpu()
        control.inspect_stopped_or_running(spec);control.clone_command('start',spec.container)
        fresh=ready(spec)
        if fresh.pid==source.pid or fresh.identity[3]==source.identity[3] or fresh.identity==source.identity:raise RuntimeError('turnover_not_fresh')
        before=runtime.accounting(fresh);child=ZeroChild(fresh,config);joined=child.joined(fresh)
        if control.inspect_source(spec).identity!=fresh.identity or control.self_cgroup()!=parent:raise RuntimeError('join_source_changed')
        emit({'stage':'second-join','at':control.at(),**joined,'qdrantPidChanged':True,'qdrantStartTicksChanged':True,'parentUnchanged':True,'joinLimits':control.limits(before,runtime.accounting(fresh))})
        outcome=child.gone();child=None
        if outcome['exitCode']!=0:raise RuntimeError('zero_child_cleanup_failed')
        if control.self_cgroup()!=parent:raise RuntimeError('parent_cgroup_changed')
        emit({'stage':'complete','at':control.at(),**outcome,'parentUnchanged':True,'cacheControls':0,'archiveBytesRead':0,'storageContentWrites':0})
    except BaseException as error:
        emit({'stage':'phase-failed','at':control.at(),'reason':control.safe_control_reason(error),**control.cpu0_guards.failure_evidence(error)})
        raise
    finally:
        original_error=sys.exc_info()[1];cleanup_error=None
        if child is not None:
            try:outcome=child.gone()
            except BaseException as error:
                cleanup_error=error;outcome={'childGone':False,'reason':control.safe_control_reason(error),**control.cpu0_guards.failure_evidence(error)}
            emit({'stage':'cleanup-observed','at':control.at(),**outcome})
        if original_error is not None or cleanup_error is not None:
            try:running=bool(control.inspect_stopped_or_running(spec)['State']['Running'])
            except BaseException:running=None
            emit({'stage':'recovery-required','at':control.at(),'cloneRunning':running,'cloneLeftStopped':running is False,'runningStateVerified':running is not None,'automaticRecoveryAttempted':False,'parentUnchanged':control.self_cgroup()==parent})
        if cleanup_error is not None and original_error is None:raise cleanup_error


def main(argv=None):
    parser=daemon.SafeParser(description=__doc__)
    for name in ('config','policy-sha256','controller-code-sha256','gate-code-sha256'):parser.add_argument('--'+name)
    parser.add_argument('--execute-reviewed',action='store_true')
    emit=lambda event:print(json.dumps({'schema':'search.clone-zero-pin-turnover.v1',**event},sort_keys=True),flush=True)
    try:
        args=parser.parse_args(argv)
        if not args.execute_reviewed:emit({'stage':'prepared-only','execution':False,'queries':0,'lockedBytes':0});return 0
        if not args.config or control.digest(__file__)!=args.gate_code_sha256:raise RuntimeError('gate_freeze_changed')
        config,spec,policy=control.load_control(args.config,args.policy_sha256,args.controller_code_sha256)
        def interrupted(number,frame):raise RuntimeError('gate_interrupted')
        signal.signal(signal.SIGTERM,interrupted);signal.signal(signal.SIGINT,interrupted)
        def frozen_emit(event):emit({**event,'helperCodeSha256':config['helperCodeSha256'],'helperPolicySha256':config['helperPolicySha256'],'controllerPolicySha256':args.policy_sha256,'controllerCodeSha256':args.controller_code_sha256,'gateCodeSha256':args.gate_code_sha256})
        if control.ROOT.resolve()!=control.ROOT:raise RuntimeError('owned_root_changed')
        fd=os.open(control.ROOT/'control.lock',os.O_CREAT|os.O_RDWR|os.O_NOFOLLOW,0o600)
        try:
            status=os.fstat(fd)
            if not stat.S_ISREG(status.st_mode) or status.st_uid!=os.geteuid() or status.st_nlink!=1:raise RuntimeError('invalid_control_lock')
            fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
            stage(config,spec,policy,frozen_emit)
        finally:os.close(fd)
        return 0
    except BaseException as error:
        emit({'stage':'failed','reason':control.safe_control_reason(error),**control.cpu0_guards.failure_evidence(error),'queries':0});return 1


if __name__=='__main__':raise SystemExit(main())
