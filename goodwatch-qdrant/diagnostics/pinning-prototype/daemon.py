"""Uninstalled local clone prototype. Default does no inspection, pinning or queries."""
import sys
sys.dont_write_bytecode = True
import argparse
import hashlib
import json
import signal
import time
from pathlib import Path

# Isolated interpreter mode omits sibling directory; add only this reviewed directory.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import pin
import runtime

ROOT = Path('/root/goodwatch-qdrant-cold-406-20261011')
IMAGE = 'sha256:dd57172b0bbebb29b0a96a37c1f378a317449730c36cdfe68feabe36e740a92b'
KINDS = ('vector', 'graph', 'sparse', 'payload', 'other')


def code_hash(directory=None):
    directory = directory or Path(__file__).parent
    digest = hashlib.sha256()
    for name in ('pin.py', 'runtime.py', 'daemon.py'):
        digest.update(name.encode() + b'\0' + (directory / name).read_bytes() + b'\0')
    return digest.hexdigest()


def integer(value, low=0, high=None):
    if type(value) is not int or value < low or high is not None and value > high:
        raise ValueError('invalid_numeric_policy')
    return value


def load_config(path, expected_policy, expected_code):
    if not isinstance(expected_policy, str) or not isinstance(expected_code, str) or any(len(x) != 64 or any(c not in '0123456789abcdef' for c in x) for x in (expected_policy, expected_code)):
        raise ValueError('frozen_digests_required')
    raw = Path(path).read_bytes()
    if len(raw) > 16384 or hashlib.sha256(raw).hexdigest() != expected_policy or code_hash() != expected_code:
        raise ValueError('frozen_input_changed')
    config = json.loads(raw)
    if set(config) != {'schema', 'source', 'policy', 'intervalSeconds', 'lifetimeSeconds', 'actions'} or config['schema'] != 'mapped-data-pin-config.v1':
        raise ValueError('explicit_frozen_config_required')
    s = config['source']
    if set(s) != {'mode', 'container', 'image', 'store', 'mounts', 'memoryBytes', 'swapBytes', 'cpuNanos'}:
        raise ValueError('explicit_source_required')
    mounts = frozenset(tuple(m) for m in s['mounts'])
    wanted = frozenset(((str(ROOT/'store'), '/qdrant/storage', 'bind', True),
                        (str(ROOT/'runtime-snapshots'), '/qdrant/snapshots', 'bind', True),
                        (str(ROOT/'rename-proof/media-20261011T041503Z.snapshot'), '/qdrant/snapshots/fixture.snapshot', 'bind', False)))
    if s['mode'] != 'clone' or s['container'] != 'gw-qdrant-cold-406-20261011' or s['image'] != IMAGE or s['store'] != str(ROOT/'store') or mounts != wanted or len(s['mounts']) != 3:
        raise ValueError('fixed_clone_source_required')
    if s['memoryBytes'] != 6*pin.GIB or s['cpuNanos'] != 2_000_000_000 or type(s['swapBytes']) is not int or s['swapBytes'] != 6*pin.GIB:
        raise ValueError('fixed_clone_resources_required')
    p = config['policy']
    if set(p) != {'maxLockedBytes', 'archiveBytes', 'reserveBytes', 'emergencyBytes', 'includePayload', 'capReserveBytes', 'mappingReserveCount'} or p['includePayload'] is not False:
        raise ValueError('four_class_policy_required')
    budget = integer(p['maxLockedBytes'], 1, 2*pin.GIB)
    archive = integer(p['archiveBytes'], 4428863488, 4428863488)
    reserve = integer(p['reserveBytes'], 2*pin.GIB)
    emergency = integer(p['emergencyBytes'], 3*pin.GIB//2)
    integer(config['intervalSeconds'], 2, 60); integer(config['lifetimeSeconds'], 1, 3600)
    if not isinstance(config['actions'], list) or not config['actions'] or len(config['actions']) != len(set(config['actions'])) or set(config['actions']) - {'measure', 'pin'}:
        raise ValueError('explicit_actions_required')
    spec = runtime.Spec('clone', s['container'], s['image'], ROOT/'store', mounts, s['memoryBytes'], s['swapBytes'], s['cpuNanos'])
    policy = pin.Policy('clone', budget, archive, reserve, emergency, cap_reserve_bytes=integer(p['capReserveBytes'],1,pin.GIB), mapping_reserve_count=integer(p['mappingReserveCount'],1,16384))
    return config, spec, policy


def account(value):
    out = {}
    for name in ('availableBytes', 'anonBytes', 'fileBytes', 'kernelBytes', 'unevictableBytes', 'currentBytes'):
        out[name] = integer(value[name])
    cap = value['cgroupMaxBytes']; out['cgroupMaxBytes'] = None if cap is None else integer(cap)
    out['memoryEvents'] = {k: integer(value['memoryEvents'][k]) for k in ('oom', 'oom_kill', 'max')}
    out['cpu'] = {k: integer(value['cpu'][k]) for k in ('nr_throttled', 'throttled_usec')}
    return out


def public_state(value):
    if value['event'] != 'mapped-data-pin-state.v1' or value['mode'] != 'clone' or value['queries'] != 0 or value['storageWrites'] != 0:
        raise ValueError('invalid_runtime_state')
    digest = value['selectionHash']
    if not isinstance(digest, str) or len(digest) != 64 or any(c not in '0123456789abcdef' for c in digest):
        raise ValueError('invalid_selection_digest')
    out = {'event': value['event'], 'mode': 'clone', 'lockedBytes': integer(value['lockedBytes']), 'newLockBytes': integer(value['newLockBytes']),
           'selectionHash': digest, 'extentRangesHashed': value['extentRangesHashed'] is True, 'contentFixed': False, 'queries': 0, 'storageWrites': 0,
           'qdrantPid': integer(value['qdrantPid'], 1), 'sourceStartTicks': integer(value['sourceStartTicks'], 1)}
    if not out['extentRangesHashed']:
        raise ValueError('range_identity_missing')
    out['classesMeasured'] = {kind: {k: integer(value['classesMeasured'][kind][k]) for k in ('files', 'dataLockBytes', 'dataPages', 'rawExtentCount', 'dataRangeCount')} for kind in KINDS}
    out['accountingBefore'] = account(value['accountingBefore']); out['accountingAfter'] = account(value['accountingAfter'])
    # Strip all unrecognized keys, paths, exception messages and raw file/process metadata.
    out['lockedResidency'] = {kind: {k: integer(value['lockedResidency'][kind][k]) for k in ('lockedDataPages', 'residentLockedDataPages')} for kind in ('vector', 'graph', 'sparse', 'other')}
    for values in out['lockedResidency'].values():
        if values['lockedDataPages'] < 1 or values['residentLockedDataPages'] != values['lockedDataPages']:
            raise ValueError('locked_residency_incomplete')
    out['deletedMappingsExcluded'] = integer(value['deletedMappingsExcluded'])
    out['memoryEventDelta'] = {k: integer(value['memoryEventDelta'][k]) for k in ('oom', 'oom_kill', 'max')}
    out['cpuLimitDelta'] = {k: integer(value['cpuLimitDelta'][k]) for k in ('nr_throttled', 'throttled_usec')}
    out['clonePressureMaxAllowed'] = value['clonePressureMaxAllowed'] is True
    out['mappingBounds'] = {k: integer(value['mappingBounds'][k]) for k in ('currentVmas','maxMapCount','projectedAdditionalVmas','reservedVmas','projectedTotalVmas')}
    out['nonresidentSelectedBytes'] = integer(value['nonresidentSelectedBytes'])
    out['projectedCurrentBytes'] = integer(value['projectedCurrentBytes'])
    out['capReserveBytes'] = integer(value['capReserveBytes'])
    if type(value['capHeadroomRequired']) is not bool: raise ValueError('invalid_runtime_state')
    out['capHeadroomRequired'] = value['capHeadroomRequired']
    out['pageBytes'] = integer(value['pageBytes'], 1)
    out['rangesChanged'] = value['rangesChanged'] is True
    out['allExistingPageChargesInsideTargetCgroupProven'] = False
    return out


def public_measure(value):
    if value['event'] != 'mapped-data-measure-state.v1' or value['mode'] != 'clone' or value['extentRangesHashed'] is not True or value['lockedBytes'] != 0 or value['queries'] != 0 or value['storageWrites'] != 0:
        raise ValueError('invalid_measure_state')
    digest = value['selectionHash']
    if not isinstance(digest, str) or len(digest) != 64 or any(c not in '0123456789abcdef' for c in digest):
        raise ValueError('invalid_selection_digest')
    return {'event': value['event'], 'mode': 'clone', 'lockedBytes': 0, 'selectionHash': digest,
            'classesMeasured': {kind: {k: integer(value['classesMeasured'][kind][k]) for k in ('files', 'dataPages', 'residentDataPages', 'rawExtentCount', 'dataRangeCount')} for kind in KINDS},
            'accounting': account(value['accounting']), 'qdrantPid': integer(value['qdrantPid'], 1),
            'sourceStartTicks': integer(value['sourceStartTicks'], 1), 'pageBytes': integer(value['pageBytes'], 1),
            'helperVmas': integer(value['helperVmas']), 'maxMapCount': integer(value['maxMapCount'],1),
            'queries': 0, 'storageWrites': 0}


def run(config, spec, policy, action, emit, raise_own_memlock=False, clock=time.monotonic, wait=time.sleep):
    if action == 'measure' and raise_own_memlock:
        raise ValueError('measure_cannot_raise_limits')
    if action not in config['actions']:
        raise ValueError('action_not_in_frozen_policy')
    stop = False
    def stopping(_signal, _frame):
        nonlocal stop
        stop = True
    previous = {}
    try:
        for signum in (signal.SIGINT, signal.SIGTERM):
            previous[signum] = signal.signal(signum, stopping)
        if action == 'pin':
            raise RuntimeError('outside_source_inspector_required')
        deadline = clock() + config['lifetimeSeconds']
        while not stop and clock() < deadline:
            state = public_measure(runtime.measure_source(spec))
            emit({**state, 'at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'action': action})
            remaining = deadline - clock()
            if remaining > 0 and not stop: wait(min(config['intervalSeconds'], remaining))
        emit({'event': 'mapped-data-pin-stopping.v1', 'reason': 'signal' if stop else 'lifetime', 'queries': 0, 'storageWrites': 0})
    finally:
        for signum, handler in previous.items(): signal.signal(signum, handler)


class SafeParser(argparse.ArgumentParser):
    def error(self, message):
        raise ValueError('invalid_cli_arguments')


def main(argv=None):
    parser = SafeParser(description=__doc__)
    parser.add_argument('--config'); parser.add_argument('--policy-sha256'); parser.add_argument('--code-sha256')
    parser.add_argument('--action', choices=('measure', 'pin'), default='measure')
    parser.add_argument('--raise-own-memlock', action='store_true')
    emit = lambda value: print(json.dumps(value, sort_keys=True), flush=True)
    try:
        args = parser.parse_args(argv)
    except ValueError:
        emit({'event': 'mapped-data-pin-failed.v1', 'reason': 'invalid_cli_arguments', 'queries': 0, 'storageWrites': 0}); return 1
    if args.config is None:
        emit({'event': 'mapped-data-pin-prepared.v1', 'inspection': False, 'pinning': False, 'queries': 0, 'storageWrites': 0}); return 0
    try:
        config, spec, policy = load_config(args.config, args.policy_sha256, args.code_sha256)
        run(config, spec, policy, args.action, lambda state: emit({**state, 'codeSha256': args.code_sha256, 'policySha256': args.policy_sha256}), args.raise_own_memlock)
        return 0
    except BaseException as error:
        # Do not print paths, arguments, source data, provider errors or exception messages.
        emit({'event': 'mapped-data-pin-failed.v1', 'reason': pin.safe_reason(error), 'released': True, 'queries': 0, 'storageWrites': 0})
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
