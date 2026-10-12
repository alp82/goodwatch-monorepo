"""Read-only admission before stage creation or private packet selection; root executes."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import json
import hashlib
import daemon_cpu0 as daemon
import controller_cpu0 as control
import cpu0_guards


def preflight(helper_path, helper_policy_sha, helper_code_sha, control_path, control_policy_sha):
    # Reviewed public input code/config can exist before the fresh control stage.
    raw=Path(control_path).read_bytes()
    if len(raw)>16384 or hashlib.sha256(raw).hexdigest()!=control_policy_sha:raise RuntimeError('control_freeze_changed')
    config=json.loads(raw)
    if config.get('schema')!='clone-pin-control.cpu0.v1' or config.get('helperCodeSha256')!=helper_code_sha or config.get('helperPolicySha256')!=helper_policy_sha:raise RuntimeError('control_freeze_changed')
    cpu0_guards.validate_policy(config['cpuIsolation'])
    _,spec,policy=daemon.load_config(helper_path,helper_policy_sha,helper_code_sha)
    control.CPU_POLICY=config['cpuIsolation']
    host=cpu0_guards.host_cpu()
    source=control.inspect_source(spec)
    hierarchy=cpu0_guards.inspect_cpu_source(source,config['cpuIsolation'],control.runtime.docker)
    control.runtime.accounting(source) # Required source memory/throttle metrics, never fabricated zeros.
    control.guard_shards(source)
    return {'schema':'search.clone-cpu0-preflight.v1','hostCpu':host,'cpuHierarchy':hierarchy,
            'sourceIdentity':list(source.identity),'queries':0,'resourceWrites':0,'modelsRead':0}


if __name__=='__main__':
    try:
        if len(sys.argv)!=6:raise RuntimeError('explicit_control_arguments_required')
        print(json.dumps(preflight(*sys.argv[1:]),sort_keys=True))
    except BaseException as error:
        print(json.dumps({'schema':'search.clone-cpu0-preflight.v1','stage':'failed','reason':control.safe_control_reason(error),'queries':0,'resourceWrites':0}))
        raise SystemExit(1)
