"""Locked metadata admission with one owned handoff update; root executes."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import json
import hashlib
import os
import stat
import fcntl
import daemon_cpu0 as daemon
import controller_cpu0 as control
import cpu0_guards


def preflight(helper_path, helper_policy_sha, helper_code_sha, control_path, control_policy_sha, handoff_sha):
    # Public admission closure and derivative policy are independently frozen before import.
    raw=Path(control_path).read_bytes()
    if len(raw)>16384 or hashlib.sha256(raw).hexdigest()!=control_policy_sha:raise RuntimeError('control_freeze_changed')
    config=json.loads(raw)
    if config.get('schema')!='clone-pin-control.cpu0-owned.v1' or config.get('helperCodeSha256')!=helper_code_sha or config.get('helperPolicySha256')!=helper_policy_sha:raise RuntimeError('control_freeze_changed')
    cpu0_guards.validate_policy(config['cpuIsolation'])
    _,spec,policy=daemon.load_config(helper_path,helper_policy_sha,helper_code_sha)
    control.CPU_POLICY=config['cpuIsolation']
    lock_fd=None;primary=None
    try:
        if control.ROOT.resolve()!=control.ROOT:raise RuntimeError('owned_root_changed')
        lock_fd=os.open(control.ROOT/'control.lock',os.O_RDWR|os.O_NOFOLLOW)
        info=os.fstat(lock_fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid!=os.geteuid() or stat.S_IMODE(info.st_mode)!=0o600 or info.st_nlink!=1:raise RuntimeError('invalid_control_lock')
        fcntl.flock(lock_fd,fcntl.LOCK_EX|fcntl.LOCK_NB);os.set_inheritable(lock_fd,False)
        lifecycle=control.load_lifecycle(config);lifecycle.require_lock(lock_fd)
        lifecycle.read_handoff(control.runtime.docker,handoff_sha)
        admission=control.birth_admission(config,spec,policy)
        handoff=lifecycle.commit_handoff(control.runtime.docker,handoff_sha,'preflight')
        return {'schema':'search.clone-cpu0-preflight.v1','variant':'cpu0-owned-lifecycle.v1','birthAdmission':admission,'handoff':handoff,
                'sourceIdentity':admission['sourceIdentity'],'queries':0,'resourceWrites':0,'handoffWrites':1,'modelsRead':0}
    except BaseException as error:
        primary=error;raise
    finally:
        if lock_fd is not None:
            try:os.close(lock_fd)
            except BaseException as cleanup:
                if primary is None:raise
                primary.lifecycleCleanupFailure='lifecycle_lock_close_failed'


def main(argv=None):
    args=sys.argv[1:] if argv is None else argv
    try:
        if len(args)!=6:raise RuntimeError('explicit_control_arguments_required')
        print(json.dumps(preflight(*args),sort_keys=True));return 0
    except BaseException as error:
        print(json.dumps({'schema':'search.clone-cpu0-preflight.v1','stage':'failed','reason':control.safe_control_reason(error),'lifecycleFailureEvidence':getattr(error,'lifecycleFailureEvidence',None),'lifecycleCleanupFailure':getattr(error,'lifecycleCleanupFailure',None),**cpu0_guards.failure_evidence(error),'queries':0,'resourceWrites':0}));return 1


if __name__=='__main__':raise SystemExit(main())
