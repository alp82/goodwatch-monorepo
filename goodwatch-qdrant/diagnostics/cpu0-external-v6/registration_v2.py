"""V2 independent consumer confirmation and birth-safe owned cleanup.

Preliminary enrolment is authoritative only after authenticating its fixed file,
installed recipe and actual processes. A caller's admission projection is an
additional equality check, never a process roster. No executable default.
"""
import json
import os
from pathlib import Path
import re
import select
import signal
import stat
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from packet import SOURCE_NAMES, canonical, directory, hash_value, sha
from setup import ROOT, NEW, acquire_control
from stager import NODE_BYTES, NODE_SHA, NODE_RECEIPT_SHA, FULL_NAMES

VARIANT = 'cpu0-fixed-capacity.v2'
STAGE = ROOT/'pin-control-20261012-100-cpu0-v2'
ENROLMENT = ROOT/'cpu0-consumer-enrolment-v2.json'
RECORD = ROOT/'cpu0-consumer-registration-v2.json'
SAFE_INTEGER = 2**53-1
BIRTH_KEYS = frozenset(('pid', 'startTicks', 'parentPid', 'exeIdentityHash',
                        'groupHash', 'VmLckBytes', 'outsideSourceCgroup'))
ENROLMENT_KEYS = frozenset(('schema', 'variant', 'sourceFreezeSha256',
    'externalManifestSha256', 'helperCodeSha256', 'helperPolicySha256',
    'controllerPolicySha256', 'adoptionIntentSha256', 'consumerPredecessorSha256',
    'source', 'consumer', 'transportParent', 'preflight', 'consumerArgvHash',
    'raiseOwnNofile', 'nodeProvenanceSha256', 'nodeIdentity',
    'sharedControlIdentity', 'registeredBeforeEntrySample', 'productionAcceptance'))
REGISTRATION_KEYS = frozenset(('schema', 'variant', 'consumerEnrolmentSha256',
    'sourceFreezeSha256', 'externalManifestSha256', 'predecessorSha256',
    'consumerPredecessorSha256', 'adoptionIntentSha256', 'raiseOwnNofile',
    'consumerArgvHash', 'consumerBirth', 'transportParentBirth', 'preflightBirth',
    'preflightExit', 'source', 'nodeProvenanceSha256', 'nodeIdentity',
    'sharedControlIdentity', 'registeredBeforeCapture'))
NODE_RECEIPT_KEYS = frozenset(('schema', 'nodeSha256', 'nodeBytes',
    'sourceReceiptSha256', 'targetDevice', 'targetInode', 'targetMode',
    'sourceStable', 'sourceHostWrites', 'cloneFilesCreated',
    'targetMtimeNs', 'targetCtimeNs'))


def require(condition, reason='consumer_enrolment_invalid'):
    if condition is not True:
        raise RuntimeError(reason)


def number(value, positive=False):
    require(type(value) is int and (1 if positive else 0) <= value <= SAFE_INTEGER)
    return value


def signature(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns,
            info.st_ctime_ns, info.st_mode, info.st_uid, info.st_nlink)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result)
        result[key] = value
    return result


def decoded(raw):
    try:
        return json.loads(raw, object_pairs_hook=unique_object,
            parse_constant=lambda value: (_ for _ in ()).throw(ValueError()))
    except (ValueError, UnicodeError, TypeError, RecursionError):
        raise RuntimeError('consumer_enrolment_invalid') from None


def read_public(path, limit=65536):
    """Stable root-owned NOFOLLOW read including ctime; public fixed paths only."""
    path = Path(path)
    require(path.resolve(strict=True) == path, 'consumer_registration_changed')
    before = path.lstat()
    require(stat.S_ISREG(before.st_mode) and before.st_uid == 0 and
            stat.S_IMODE(before.st_mode) == 0o600 and before.st_nlink == 1 and
            0 < before.st_size <= limit, 'consumer_registration_changed')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        require(signature(os.fstat(fd)) == signature(before), 'consumer_registration_changed')
        raw = bytearray()
        while len(raw) <= limit:
            part = os.read(fd, min(65536, limit+1-len(raw)))
            if not part:
                break
            raw.extend(part)
        require(len(raw) == before.st_size and signature(os.fstat(fd)) == signature(before)
                and signature(path.lstat()) == signature(before), 'consumer_registration_changed')
        return bytes(raw), signature(before)
    finally:
        os.close(fd)


def identity(value):
    require(type(value) is dict and set(value) == BIRTH_KEYS)
    for name in ('pid', 'startTicks', 'parentPid'):
        number(value[name], True)
    for name in ('exeIdentityHash', 'groupHash'):
        hash_value(value[name])
    require(type(value['VmLckBytes']) is int and value['VmLckBytes'] == 0
            and value['outsideSourceCgroup'] is True)
    return value


def process_row(value):
    require(type(value) is dict and set(value) == {'identity', 'metrics'})
    identity(value['identity'])
    require(type(value['metrics']) is dict and set(value['metrics']) == {'RssAnonBytes', 'VmPTEBytes'})
    for count in value['metrics'].values():
        number(count)
    return value


def node_fields(value):
    require(type(value) is dict and set(value) == {'device', 'inode', 'size', 'mtimeNs', 'ctimeNs'})
    for name in ('device', 'inode', 'size'):
        number(value[name], name != 'device')
    for name in ('mtimeNs', 'ctimeNs'):
        require(type(value[name]) is str and re.fullmatch(r'0|[1-9][0-9]{0,19}', value[name]) is not None)
    return value


def lock_fields(value):
    require(type(value) is dict and set(value) == {'device', 'inode'})
    number(value['device']); number(value['inode'], True)
    return value


SOURCE_KEYS = frozenset(('state', 'wrapper', 'qdrant', 'scriptSha256',
    'wrapperArgvHash', 'RecoveryAllowed', 'activeServiceConnections',
    'connectionCensusComplete', 'liveMountIdentityHash',
    'readerOutsideSourceSubtree', 'readerVmLckBytes'))
STATE_KEYS = frozenset(('containerIdHash', 'running', 'startedAt', 'finishedAt',
    'restartCount', 'exitCode', 'OOMKilled', 'configurationHash'))
SOURCE_PROCESS_KEYS = BIRTH_KEYS-{'outsideSourceCgroup'}


def historical_source(value):
    """Closed historical entry observation; it never attests a current birth."""
    require(type(value) is dict and set(value) == SOURCE_KEYS, 'consumer_historical_source_invalid')
    state = value['state']
    require(type(state) is dict and set(state) == STATE_KEYS, 'consumer_historical_source_invalid')
    for key in ('containerIdHash', 'configurationHash'):
        hash_value(state[key])
    require(type(state['running']) is bool and state['running'] is True
            and type(state['OOMKilled']) is bool, 'consumer_historical_source_invalid')
    for key in ('startedAt', 'finishedAt'):
        require(type(state[key]) is str and 0 < len(state[key]) <= 64,
                'consumer_historical_source_invalid')
    for key in ('restartCount', 'exitCode'):
        number(state[key])
    for role in ('wrapper', 'qdrant'):
        process = value[role]
        require(type(process) is dict and set(process) == SOURCE_PROCESS_KEYS,
                'consumer_historical_source_invalid')
        for key in ('pid', 'startTicks', 'parentPid'):
            number(process[key], True)
        for key in ('exeIdentityHash', 'groupHash'):
            hash_value(process[key])
        number(process['VmLckBytes'])
    require(value['qdrant']['parentPid'] == value['wrapper']['pid']
            and value['qdrant']['pid'] != value['wrapper']['pid']
            and value['qdrant']['groupHash'] == value['wrapper']['groupHash'],
            'consumer_historical_source_invalid')
    for key in ('scriptSha256', 'wrapperArgvHash', 'liveMountIdentityHash'):
        hash_value(value[key])
    require(value['RecoveryAllowed'] is False and value['connectionCensusComplete'] is True
            and value['readerOutsideSourceSubtree'] is True,
            'consumer_historical_source_invalid')
    number(value['activeServiceConnections']); number(value['readerVmLckBytes'])
    require(value['readerVmLckBytes'] == 0, 'consumer_historical_source_invalid')
    return value


def validate_enrolment(value):
    require(type(value) is dict and set(value) == ENROLMENT_KEYS)
    require(value['schema'] == 'cpu0-consumer-enrolment.v2' and value['variant'] == VARIANT)
    for name in ('sourceFreezeSha256', 'externalManifestSha256', 'helperCodeSha256',
                 'helperPolicySha256', 'controllerPolicySha256', 'adoptionIntentSha256',
                 'consumerPredecessorSha256', 'consumerArgvHash', 'nodeProvenanceSha256'):
        hash_value(value[name])
    require(type(value['raiseOwnNofile']) is bool and value['registeredBeforeEntrySample'] is True
            and value['productionAcceptance'] is False and type(value['source']) is dict)
    for role in ('consumer', 'transportParent', 'preflight'):
        process_row(value[role])
    consumer = value['consumer']['identity']; parent = value['transportParent']['identity']
    child = value['preflight']['identity']
    require(child['parentPid'] == consumer['pid'] and consumer['parentPid'] == parent['pid']
            and len({consumer['pid'], parent['pid'], child['pid']}) == 3)
    node_fields(value['nodeIdentity']); lock_fields(value['sharedControlIdentity'])
    historical_source(value['source'])
    return value


def preflight_exit(value):
    require(type(value) is dict and set(value) == {'observed', 'exitCode', 'signal', 'birthGone'},
            'consumer_preflight_exit_unproven')
    require(value['observed'] is True and type(value['exitCode']) is int and
            value['exitCode'] == 0 and value['signal'] is None and value['birthGone'] is True,
            'consumer_preflight_exit_unproven')
    return value


def expected_argv(source_sha, external_sha, consumer_predecessor, raise_own_nofile):
    for value in (source_sha, external_sha, consumer_predecessor):
        hash_value(value)
    require(type(raise_own_nofile) is bool, 'consumer_argv_invalid')
    result = [str(STAGE/'node'), str(STAGE/'consumer_cpu0.mjs'), '--execute-reviewed-fixed-capacity-v2',
        '--handoff-sha256', consumer_predecessor, '--cpu0-source-freeze-sha256', source_sha,
        '--external-manifest-sha256', external_sha]
    if raise_own_nofile:
        result.append('--raise-own-nofile')
    return result


def current_node(expected_receipt_sha):
    hash_value(expected_receipt_sha)
    raw, _ = read_public(STAGE/'node-provenance.json')
    require(sha(raw) == expected_receipt_sha, 'node_provenance_changed')
    receipt = decoded(raw)
    require(type(receipt) is dict and set(receipt) == NODE_RECEIPT_KEYS, 'node_provenance_changed')
    require(receipt['schema'] == 'clone-node-copy-receipt.v2' and receipt['nodeSha256'] == NODE_SHA
        and type(receipt['nodeBytes']) is int and receipt['nodeBytes'] == NODE_BYTES
        and receipt['sourceReceiptSha256'] == NODE_RECEIPT_SHA and receipt['sourceStable'] is True
        and type(receipt['sourceHostWrites']) is int and receipt['sourceHostWrites'] == 0
        and type(receipt['cloneFilesCreated']) is int and receipt['cloneFilesCreated'] == 2
        and type(receipt['targetMode']) is int and receipt['targetMode'] == 0o700,
        'node_provenance_changed')
    node = STAGE/'node'
    require(node.resolve(strict=True) == node, 'consumer_executable_changed')
    before = node.lstat()
    require(stat.S_ISREG(before.st_mode) and before.st_uid == 0 and before.st_nlink == 1
            and stat.S_IMODE(before.st_mode) == 0o700 and before.st_size == NODE_BYTES,
            'consumer_executable_changed')
    for key, actual in (('targetDevice', before.st_dev), ('targetInode', before.st_ino),
                        ('targetMtimeNs', before.st_mtime_ns), ('targetCtimeNs', before.st_ctime_ns)):
        require(type(receipt[key]) is int and receipt[key] >= 0 and receipt[key] == actual,
                'consumer_executable_changed')
    fd = os.open(node, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        require(signature(os.fstat(fd)) == signature(before) and signature(node.lstat()) == signature(before),
                'consumer_executable_changed')
        result = {'device': before.st_dev, 'inode': before.st_ino, 'size': before.st_size,
                  'mtimeNs': str(before.st_mtime_ns), 'ctimeNs': str(before.st_ctime_ns)}
        node_fields(result)
        return result
    finally:
        os.close(fd)


def installed(enrolment, *, initial):
    directory(STAGE)
    names = set(os.listdir(STAGE)); base = FULL_NAMES | {'cpu0-external-manifest.json', 'node', 'node-provenance.json'}
    runtime = names-base
    require((not runtime if initial else all(name == 'pin-instance.lock' or
            re.fullmatch(r'reclaim-writer-[A-Za-z0-9_.-]+\.json', name) is not None for name in runtime))
            and sum(name.startswith('reclaim-writer-') for name in runtime) <= 18,
            'staged_extra_entry')
    require(base <= names, 'staged_source_changed')
    raw, _ = read_public(STAGE/'cpu0-external-manifest.json', 262144)
    require(sha(raw) == enrolment['externalManifestSha256'], 'external_manifest_changed')
    full = decoded(raw)
    require(type(full) is dict and set(full) == {'schema', 'variant', 'sourceFreezeSha256', 'files'}
            and full['schema'] == 'cpu0-full-public-packet.v7' and full['variant'] == VARIANT
            and full['sourceFreezeSha256'] == enrolment['sourceFreezeSha256']
            and type(full['files']) is dict and set(full['files']) == FULL_NAMES, 'external_manifest_changed')
    observed = {}
    for name in sorted(FULL_NAMES):
        hash_value(full['files'][name]); content, _ = read_public(STAGE/name, 262144)
        require(sha(content) == full['files'][name], 'staged_source_changed'); observed[name] = content
    require(sum(map(len, observed.values())) <= 2*1024**2, 'external_packet_bound')
    source_raw = observed['cpu0-source-freeze.json']; source = decoded(source_raw)
    require(sha(source_raw) == enrolment['sourceFreezeSha256'] and type(source) is dict
            and set(source) == {'schema', 'variant', 'preparedOnly', 'files'}
            and source['schema'] == 'search.clone-cpu0-fixed-source-freeze.v2'
            and source['variant'] == VARIANT and source['preparedOnly'] is True
            and type(source['files']) is dict and set(source['files']) == SOURCE_NAMES,
            'source_freeze_changed')
    for name in SOURCE_NAMES:
        hash_value(source['files'][name]); require(sha(observed[name]) == source['files'][name], 'source_file_changed')
    require(observed['helper-config.json'] == observed['prepared-helper-policy-cpu0.json']
            and observed['controller-config.json'] == observed['prepared-control-policy-cpu0.json'],
            'external_policy_alias_changed')
    control = decoded(observed['controller-config.json'])
    require(type(control) is dict and control.get('helperCodeSha256') == enrolment['helperCodeSha256']
            and control.get('helperPolicySha256') == enrolment['helperPolicySha256']
            and sha(observed['helper-config.json']) == enrolment['helperPolicySha256']
            and sha(observed['controller-config.json']) == enrolment['controllerPolicySha256'],
            'external_policy_alias_changed')
    require(current_node(enrolment['nodeProvenanceSha256']) == enrolment['nodeIdentity'], 'consumer_executable_changed')
    return source['files']['lifecycle_cpu0.py']


def source_fence(lifecycle, source, proc):
    for role in ('wrapper', 'qdrant'):
        observed = lifecycle.process(source[role]['pid'], proc)
        require(lifecycle.public_process(observed) == source[role], 'consumer_registration_source_changed')
    return lifecycle.process(source['qdrant']['pid'], proc)['group']


def confirm_process(lifecycle, birth, source, *, proc=Path('/proc'), allow_reparent=False):
    identity(birth)
    group = source_fence(lifecycle, source, proc)
    observed = lifecycle.process(birth['pid'], proc)
    require(observed['group'] != group and not observed['group'].startswith(group.rstrip('/')+'/'),
            'consumer_inside_source_subtree')
    actual = {**lifecycle.public_process(observed), 'outsideSourceCgroup': True}
    expected = birth
    if allow_reparent:
        actual = {key: value for key, value in actual.items() if key != 'parentPid'}
        expected = {key: value for key, value in expected.items() if key != 'parentPid'}
    require(actual == expected, 'consumer_birth_changed')
    return observed


def confirm_birth(lifecycle, birth, source, argv, *, proc=Path('/proc'), allow_reparent=False,
                  node_identity=None):
    observed = confirm_process(lifecycle, birth, source, proc=proc, allow_reparent=allow_reparent)
    require(observed['exeBasename'] == 'node' and observed['comm'] == 'node', 'consumer_birth_changed')
    expected_node = node_identity
    require(type(expected_node) is dict, 'consumer_executable_changed')
    info = (proc/str(birth['pid'])/'exe').stat()
    require((info.st_dev, info.st_ino, info.st_size) ==
            (expected_node['device'], expected_node['inode'], expected_node['size']), 'consumer_executable_changed')
    raw = lifecycle.bounded(proc/str(birth['pid'])/'cmdline', 65536)
    require(raw == b'\0'.join(value.encode() for value in argv)+b'\0', 'consumer_argv_changed')
    # Re-read identity after the executable and argv observations.
    after = confirm_process(lifecycle, birth, source, proc=proc, allow_reparent=allow_reparent)
    require(after == observed, 'consumer_birth_changed')
    return observed


def protected(lifecycle, docker):
    source = lifecycle.attest(NEW, docker)
    return source, {os.getpid(), os.getppid(), source['wrapper']['pid'],
        source['wrapper']['parentPid'], source['qdrant']['pid'], source['qdrant']['parentPid']}


def control_identity(fd):
    info = os.fstat(fd); path = (ROOT/'control.lock').lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o600
            and info.st_nlink == 1 and signature(info) == signature(path), 'invalid_control_lock')
    value = {'device': info.st_dev, 'inode': info.st_ino}; lock_fields(value)
    return value


def write_registration(value):
    raw = canonical(value)+b'\n'; require(len(raw) <= 65536, 'consumer_registration_bound')
    directory(ROOT)
    fd = os.open(RECORD, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600)
    with os.fdopen(fd, 'wb') as target:
        target.write(raw); target.flush(); os.fsync(target.fileno())
    dfd = os.open(ROOT, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        os.fsync(dfd)
    finally:
        os.close(dfd)
    return sha(raw)


def handoff_enrolment(handoff, enrolment):
    require(type(handoff) is dict and set(handoff) == {'schema', 'owner', 'previousSha256',
            'snapshot', 'adoptionIntentSha256'} and handoff['schema'] == 'clone-lifecycle-handoff.cpu0.v2'
            and handoff['owner'] == 'preflight'
            and handoff['previousSha256'] == enrolment['consumerPredecessorSha256']
            and handoff['adoptionIntentSha256'] == enrolment['adoptionIntentSha256'],
            'consumer_registration_handoff_changed')


def register(lifecycle, docker, predecessor, birth, source_sha, external_sha,
             consumer_predecessor, raise_own_nofile, *, enrolment_sha,
             enrolment_projection, preflight_exit_evidence, node_receipt_sha):
    fd = acquire_control(lifecycle); pidfds = []; primary = None
    try:
        raw, enrolled_signature = read_public(ENROLMENT)
        require(sha(raw) == enrolment_sha, 'consumer_enrolment_changed')
        enrolled = validate_enrolment(decoded(raw))
        require(raw == canonical(enrolled)+b'\n', 'consumer_enrolment_changed')
        preflight_exit(preflight_exit_evidence)
        require(enrolment_projection == enrolled and birth == enrolled['consumer']['identity']
            and source_sha == enrolled['sourceFreezeSha256'] and external_sha == enrolled['externalManifestSha256']
            and consumer_predecessor == enrolled['consumerPredecessorSha256']
            and type(raise_own_nofile) is bool and raise_own_nofile == enrolled['raiseOwnNofile']
            and node_receipt_sha == enrolled['nodeProvenanceSha256'], 'consumer_enrolment_changed')
        lifecycle_sha = installed(enrolled, initial=True)
        require(getattr(lifecycle, '_AUTHENTICATED_SOURCE_SHA256', None) == lifecycle_sha, 'lifecycle_freeze_changed')
        handoff = lifecycle.read_handoff(docker, predecessor); handoff_enrolment(handoff, enrolled)
        before, blocked = protected(lifecycle, docker)
        require(before == enrolled['source'], 'consumer_registration_source_changed')
        require(birth['pid'] not in blocked, 'consumer_target_protected')
        require(control_identity(fd) == enrolled['sharedControlIdentity'], 'invalid_control_lock')
        argv = expected_argv(source_sha, external_sha, consumer_predecessor, raise_own_nofile)
        require(sha(canonical(argv)) == enrolled['consumerArgvHash'], 'consumer_argv_changed')
        for role in ('consumer', 'transportParent'):
            # Each pidfd precedes actual /proc re-confirmation, including parent.
            pidfds.append(os.pidfd_open(enrolled[role]['identity']['pid'], 0))
        consumer = confirm_birth(lifecycle, birth, before, argv, node_identity=enrolled['nodeIdentity'])
        parent = confirm_process(lifecycle, enrolled['transportParent']['identity'], before)
        require(consumer['parentPid'] == parent['pid'] and not select.select(pidfds, [], [], 0)[0], 'consumer_birth_gone')
        require(lifecycle.birth_gone(enrolled['preflight']['identity']['pid'],
                enrolled['preflight']['identity']['startTicks']) is True, 'consumer_preflight_exit_unproven')
        require(confirm_birth(lifecycle, birth, before, argv, node_identity=enrolled['nodeIdentity']) == consumer
                and confirm_process(lifecycle, enrolled['transportParent']['identity'], before) == parent,
                'consumer_birth_changed')
        require(lifecycle.attest(NEW, docker) == before, 'consumer_registration_source_changed')
        handoff_enrolment(lifecycle.read_handoff(docker, predecessor), enrolled)
        require(signature(ENROLMENT.lstat()) == enrolled_signature and
                control_identity(fd) == enrolled['sharedControlIdentity'], 'consumer_enrolment_changed')
        require(current_node(node_receipt_sha) == enrolled['nodeIdentity'], 'consumer_executable_changed')
        value = {'schema': 'cpu0-consumer-registration.v2', 'variant': VARIANT,
            'consumerEnrolmentSha256': enrolment_sha, 'sourceFreezeSha256': source_sha,
            'externalManifestSha256': external_sha, 'predecessorSha256': predecessor,
            'consumerPredecessorSha256': consumer_predecessor,
            'adoptionIntentSha256': enrolled['adoptionIntentSha256'],
            'raiseOwnNofile': raise_own_nofile, 'consumerArgvHash': enrolled['consumerArgvHash'],
            'consumerBirth': birth, 'transportParentBirth': enrolled['transportParent']['identity'],
            'preflightBirth': enrolled['preflight']['identity'], 'preflightExit': preflight_exit_evidence,
            'source': before, 'nodeProvenanceSha256': node_receipt_sha,
            'nodeIdentity': enrolled['nodeIdentity'], 'sharedControlIdentity': enrolled['sharedControlIdentity'],
            'registeredBeforeCapture': True}
        registration_sha = write_registration(value)
        return {**value, 'registrationSha256': registration_sha}
    except BaseException as error:
        primary = error
        raise
    finally:
        failures = []
        for own in (*pidfds, fd):
            try:
                os.close(own)
            except OSError:
                failures.append('consumer_registration_fd_close_failed')
        if failures:
            if primary is not None:
                primary.registrationCleanupFailure = failures
            else:
                raise RuntimeError('consumer_registration_fd_close_failed')


def validated_registration(value):
    require(type(value) is dict and set(value) == REGISTRATION_KEYS
            and value['schema'] == 'cpu0-consumer-registration.v2' and value['variant'] == VARIANT,
            'consumer_registration_changed')
    for name in ('consumerEnrolmentSha256', 'sourceFreezeSha256', 'externalManifestSha256',
                 'predecessorSha256', 'consumerPredecessorSha256', 'adoptionIntentSha256',
                 'consumerArgvHash', 'nodeProvenanceSha256'):
        hash_value(value[name])
    for name in ('consumerBirth', 'transportParentBirth', 'preflightBirth'):
        identity(value[name])
    require(value['consumerBirth']['parentPid'] == value['transportParentBirth']['pid'] and
            value['preflightBirth']['parentPid'] == value['consumerBirth']['pid'] and
            type(value['raiseOwnNofile']) is bool and value['registeredBeforeCapture'] is True
            and type(value['source']) is dict, 'consumer_registration_changed')
    node_fields(value['nodeIdentity']); lock_fields(value['sharedControlIdentity'])
    preflight_exit(value['preflightExit'])
    historical_source(value['source'])
    return value


def cleanup_context(lifecycle, controller, enrolled):
    """Derive the renewal spec from bound installed bytes, never RPC data."""
    lifecycle_sha = installed(enrolled, initial=False)
    raw, _ = read_public(STAGE/'cpu0-source-freeze.json', 262144)
    require(sha(raw) == enrolled['sourceFreezeSha256'], 'source_freeze_changed')
    source = decoded(raw)
    require(type(source) is dict and set(source) == {'schema', 'variant', 'preparedOnly', 'files'}
            and source['schema'] == 'search.clone-cpu0-fixed-source-freeze.v2'
            and source['variant'] == VARIANT and source['preparedOnly'] is True
            and type(source['files']) is dict and set(source['files']) == SOURCE_NAMES,
            'source_freeze_changed')
    for digest in source['files'].values():
        hash_value(digest)
    modules = {'lifecycle_cpu0.py': lifecycle, 'controller_cpu0.py': controller,
        'pin_cpu0.py': getattr(controller, 'pin', None),
        'runtime_cpu0.py': getattr(controller, 'runtime', None),
        'daemon_cpu0.py': getattr(controller, 'daemon', None),
        'cpu0_guards.py': getattr(controller, 'cpu0_guards', None)}
    require(source['files']['lifecycle_cpu0.py'] == lifecycle_sha, 'lifecycle_freeze_changed')
    for name, module in modules.items():
        require(module is not None and getattr(module, '_AUTHENTICATED_SOURCE_SHA256', None)
                == source['files'][name], 'cleanup_module_freeze_changed')
    control_raw, _ = read_public(STAGE/'controller-config.json', 16384)
    require(sha(control_raw) == enrolled['controllerPolicySha256'], 'external_policy_alias_changed')
    config = decoded(control_raw)
    require(type(config) is dict and config.get('helperCodeSha256') == enrolled['helperCodeSha256']
            and config.get('helperPolicySha256') == enrolled['helperPolicySha256'],
            'external_policy_alias_changed')
    _, spec, policy = controller.daemon.load_config(str(STAGE/'helper-config.json'),
        enrolled['helperPolicySha256'], enrolled['helperCodeSha256'])
    return config, spec, policy


def renewal_evidence(value, historical):
    """Validate closed renewal evidence; absolute events are never clean gates."""
    keys = {'schema', 'variant', 'historicalSource', 'currentSource', 'sourceIdentity',
            'sourceLimits', 'cpuHierarchy', 'sourceEvents', 'lifecycleLineage', 'cleanupOnly', 'admission'}
    require(type(value) is dict and set(value) == keys
            and value['schema'] == 'clone-cleanup-source-renewal.cpu0.v2'
            and value['variant'] == VARIANT and value['cleanupOnly'] is True
            and value['admission'] is False and value['historicalSource'] == historical,
            'cleanup_source_evidence_invalid')
    current = historical_source(value['currentSource'])
    require(all(current['state'][key] == historical['state'][key]
                for key in ('containerIdHash', 'configurationHash'))
            and all(current[key] == historical[key] for key in
                ('scriptSha256', 'wrapperArgvHash', 'liveMountIdentityHash', 'RecoveryAllowed')),
            'consumer_registration_source_changed')
    source_identity = value['sourceIdentity']
    require(type(source_identity) is list and len(source_identity) == 4,
            'cleanup_source_evidence_invalid')
    hash_value(source_identity[0])
    require(type(source_identity[1]) is str and re.fullmatch(r'sha256:[0-9a-f]{64}', source_identity[1]) is not None,
            'cleanup_source_evidence_invalid')
    number(source_identity[2], True); number(source_identity[3], True)
    require(source_identity[2:] == [current['qdrant']['pid'], current['qdrant']['startTicks']]
            and sha(source_identity[0].encode()) == current['state']['containerIdHash'],
            'cleanup_source_evidence_invalid')
    limits = value['sourceLimits']
    require(type(limits) is dict and set(limits) == {'memoryMaxBytes', 'memoryHighBytes', 'memorySwapMaxBytes'},
            'cleanup_source_evidence_invalid')
    number(limits['memoryMaxBytes']); number(limits['memorySwapMaxBytes'])
    if limits['memoryHighBytes'] is not None:
        number(limits['memoryHighBytes'])
    require(limits['memoryMaxBytes'] == 6*1024**3 and limits['memorySwapMaxBytes'] == 0,
            'cleanup_source_limits_changed')
    events = value['sourceEvents']
    require(type(events) is dict and set(events) == {'max', 'oom', 'oom_kill'},
            'cleanup_source_evidence_invalid')
    for count in events.values():
        number(count)
    lineage = value['lifecycleLineage']
    require(type(lineage) is dict and set(lineage) == {'sameContainer', 'sameConfiguration',
            'reviewedScript', 'sameMountIdentity', 'sameWrapperArgv', 'recoveryDisallowed'}
            and all(flag is True for flag in lineage.values()), 'cleanup_source_evidence_invalid')
    hierarchy_evidence(value['cpuHierarchy'])
    return value


def hierarchy_evidence(value):
    keys = {'schema', 'rows', 'weight', 'cpusetCpus', 'cpusetMems', 'identityUnchangedRequired'}
    require(type(value) is dict and set(value) == keys and
            value['schema'] == 'search.clone-cpu-hierarchy.v1' and
            value['identityUnchangedRequired'] is True, 'cleanup_source_evidence_invalid')
    number(value['weight'], True)
    require(value['weight'] == 100 and value['cpusetCpus'] == '' and value['cpusetMems'] == '',
            'cleanup_source_limits_changed')
    rows = value['rows']
    require(type(rows) is list and 2 <= len(rows) <= 33, 'cleanup_source_evidence_invalid')
    nonroot = {'quotaMicros', 'periodMicros', 'nrThrottled', 'throttledMicros', 'groupIdentitySha256', 'depth'}
    root = {'applicability', 'quotaMicros', 'periodMicros', 'nrThrottled', 'throttledMicros',
            'usageMicros', 'userMicros', 'systemMicros', 'groupIdentitySha256', 'depth'}
    seen = set()
    for depth, row in enumerate(rows):
        last = depth == len(rows)-1
        require(type(row) is dict and set(row) == (root if last else nonroot),
                'cleanup_source_evidence_invalid')
        number(row['depth']); hash_value(row['groupIdentitySha256'])
        require(row['depth'] == depth and row['groupIdentitySha256'] not in seen,
                'cleanup_source_evidence_invalid')
        seen.add(row['groupIdentitySha256'])
        require(row['quotaMicros'] is None, 'cleanup_source_limits_changed')
        if last:
            require(row['applicability'] == 'hierarchy-root-no-bandwidth-controller' and
                    all(row[key] is None for key in ('periodMicros', 'nrThrottled', 'throttledMicros')),
                    'cleanup_source_evidence_invalid')
            for key in ('usageMicros', 'userMicros', 'systemMicros'): number(row[key])
        else:
            number(row['periodMicros'], True)
            number(row['nrThrottled']); number(row['throttledMicros'])
            if depth == 0:
                require(row['periodMicros'] == 100000, 'cleanup_source_limits_changed')
    return value


def renewal_bracket(before, after):
    """Compare identity/caps only, not changing absolute counters or clients."""
    source_keys = ('wrapper', 'qdrant', 'scriptSha256', 'wrapperArgvHash',
                   'RecoveryAllowed', 'liveMountIdentityHash')
    a = before['currentSource']; b = after['currentSource']
    require(all(a['state'][key] == b['state'][key] for key in ('containerIdHash', 'configurationHash'))
            and all(a[key] == b[key] for key in source_keys)
            and before['sourceIdentity'] == after['sourceIdentity']
            and before['sourceLimits'] == after['sourceLimits'],
            'consumer_registration_source_changed')
    # The backend validates both hierarchy snapshots. Only fixed identities and
    # policy dimensions form this bracket; absolute throttle values are evidence.
    for key in ('weight', 'cpusetCpus', 'cpusetMems'):
        require(before['cpuHierarchy'].get(key) == after['cpuHierarchy'].get(key),
                'cleanup_source_limits_changed')
    def identities(hierarchy):
        rows = hierarchy.get('rows')
        require(type(rows) is list and 1 <= len(rows) <= 33, 'cleanup_source_evidence_invalid')
        return [{key:row.get(key) for key in ('depth', 'groupIdentitySha256', 'quotaMicros',
                    'periodMicros', 'applicability')} for row in rows]
    require(identities(before['cpuHierarchy']) == identities(after['cpuHierarchy']),
            'cleanup_source_limits_changed')


def cleanup_birth(lifecycle, docker, enrolled, *, scope, controller=None):
    """Observe Node first; current source renewal gates only a single TERM."""
    birth = enrolled['consumer']['identity']
    fd = None; primary = None
    result = {'schema': 'cpu0-consumer-cleanup.v2', 'scope': scope,
        'birthGone': None, 'exitObserved': None, 'pidfdOpenESRCH': False,
        'signalSent': False, 'signal': None, 'killFallback': False, 'unknownRetained': True,
        'registeredParentPid': birth['parentPid'], 'observedParentPid': None,
        'historicalSource': enrolled['source'], 'currentSource': None,
        'sourceBranch': 'unobserved', 'sourceBirthRelation': None,
        'restartProvenance': 'unproven', 'handoffRequired': False,
        'sourceRenewalBefore': None, 'sourceRenewalAfter': None}
    try:
        try:
            fd = os.pidfd_open(birth['pid'], 0)
        except ProcessLookupError:
            result['pidfdOpenESRCH'] = True
            result['birthGone'] = lifecycle.birth_gone(birth['pid'], birth['startTicks'])
            result['unknownRetained'] = result['birthGone'] is not True
            return result
        try:
            ticks = lifecycle.birth(birth['pid'])
        except (FileNotFoundError, ProcessLookupError):
            ticks = None
        result['exitObserved'] = bool(select.select([fd], [], [], 0)[0])
        result['birthGone'] = lifecycle.birth_gone(birth['pid'], birth['startTicks'])
        result['unknownRetained'] = result['birthGone'] is not True
        if ticks != birth['startTicks'] or result['exitObserved']:
            return result
        # No source observation has occurred before these independent Node facts.
        historical_source(enrolled['source'])
        blocked = {os.getpid(), os.getppid()}
        for role in ('wrapper', 'qdrant'):
            blocked.update((enrolled['source'][role]['pid'], enrolled['source'][role]['parentPid']))
        require(birth['pid'] not in blocked, 'consumer_target_protected')
        require(controller is not None, 'cleanup_module_freeze_changed')
        config, spec, policy = cleanup_context(lifecycle, controller, enrolled)
        result['sourceBranch'] = 'uncertain'
        first = renewal_evidence(controller.renew_cleanup(config, spec, policy, enrolled['source']), enrolled['source'])
        current = first['currentSource']
        result.update(sourceRenewalBefore=first, currentSource=current, sourceBranch='running-renewed',
            sourceBirthRelation='same' if all(current[role] == enrolled['source'][role]
                for role in ('wrapper', 'qdrant')) else 'successor')
        for role in ('wrapper', 'qdrant'):
            blocked.update((current[role]['pid'], current[role]['parentPid']))
        require(birth['pid'] not in blocked, 'consumer_target_protected')
        argv = expected_argv(enrolled['sourceFreezeSha256'], enrolled['externalManifestSha256'],
                            enrolled['consumerPredecessorSha256'], enrolled['raiseOwnNofile'])
        require(sha(canonical(argv)) == enrolled['consumerArgvHash'], 'consumer_argv_changed')
        observed = confirm_birth(lifecycle, birth, current, argv, allow_reparent=True,
                                 node_identity=enrolled['nodeIdentity'])
        result['observedParentPid'] = observed['parentPid']
        second = renewal_evidence(controller.renew_cleanup(config, spec, policy, enrolled['source']), enrolled['source'])
        result['sourceRenewalAfter'] = second
        renewal_bracket(first, second)
        require(confirm_birth(lifecycle, birth, current, argv, allow_reparent=True,
                node_identity=enrolled['nodeIdentity']) == observed, 'consumer_birth_changed')
        require(current_node(enrolled['nodeProvenanceSha256']) == enrolled['nodeIdentity'],
                'consumer_executable_changed')
        signal.pidfd_send_signal(fd, signal.SIGTERM, None, 0)
        result.update(signalSent=True, signal='SIGTERM')
        result['exitObserved'] = bool(select.select([fd], [], [], 10)[0])
        result['birthGone'] = lifecycle.birth_gone(birth['pid'], birth['startTicks'])
        result['unknownRetained'] = result['birthGone'] is not True
        return result
    except BaseException as error:
        primary = error
        if result['sourceBranch'] == 'running-renewed':
            result['sourceBranch'] = 'uncertain'
        # A generic fixed backend refusal cannot prove stopped/missing state.
        # Keep the observed Node facts and the current-source branch UNKNOWN.
        error.consumerCleanupEvidence = result
        raise
    finally:
        if fd is not None:
            try:
                os.close(fd)
            except OSError:
                if primary is not None:
                    primary.registrationCleanupFailure = ['consumer_registration_fd_close_failed']
                else:
                    error = RuntimeError('consumer_registration_fd_close_failed')
                    error.consumerCleanupEvidence = result
                    raise error


def cleanup_from_receipts(lifecycle, docker, *, expected_source_sha,
                          expected_external_sha, expected_node_receipt_sha,
                          registration_sha=None, controller=None):
    """Fixed preliminary census works even if its SHA was never emitted.

    Malformed/partial publication stays UNKNOWN; no arbitrary process is acted
    on. An orphan preflight is observed only and can never be signalled here.
    """
    require(os.path.lexists(ENROLMENT), 'consumer_enrolment_missing')
    raw, _ = read_public(ENROLMENT); enrolled = validate_enrolment(decoded(raw))
    require(raw == canonical(enrolled)+b'\n', 'consumer_enrolment_changed')
    enrolled_sha = sha(raw)
    require(enrolled['sourceFreezeSha256'] == expected_source_sha
            and enrolled['externalManifestSha256'] == expected_external_sha
            and enrolled['nodeProvenanceSha256'] == expected_node_receipt_sha,
            'consumer_enrolment_changed')
    scope = 'preliminary-enrolment'
    final_observed = False
    primary = None
    try:
        if os.path.lexists(RECORD):
            final_raw, _ = read_public(RECORD)
            if registration_sha is not None:
                require(sha(final_raw) == registration_sha, 'consumer_registration_changed')
            value = validated_registration(decoded(final_raw))
            require(value['consumerEnrolmentSha256'] == enrolled_sha and value['consumerBirth'] == enrolled['consumer']['identity']
                    and value['transportParentBirth'] == enrolled['transportParent']['identity']
                    and value['preflightBirth'] == enrolled['preflight']['identity']
                    and value['nodeIdentity'] == enrolled['nodeIdentity']
                    and all(value[name] == enrolled[name] for name in (
                        'consumerPredecessorSha256', 'adoptionIntentSha256', 'raiseOwnNofile',
                        'consumerArgvHash', 'source', 'sharedControlIdentity'))
                    and value['sourceFreezeSha256'] == expected_source_sha
                    and value['externalManifestSha256'] == expected_external_sha
                    and value['nodeProvenanceSha256'] == expected_node_receipt_sha,
                    'consumer_registration_changed')
            scope = 'final-registration'; final_observed = True
        elif registration_sha is not None:
            raise RuntimeError('consumer_registration_changed')
    except BaseException as error:
        # A bad final record cannot suppress the independently authenticated
        # preliminary Node scope. Its refusal still remains the primary result.
        primary = error
    # Always retain the separate preflight scope; absence/replacement is a birth
    # fact, never inferred from the consumer's close frame.
    preflight = enrolled['preflight']['identity']
    orphan_gone = None
    try:
        orphan_gone = lifecycle.birth_gone(preflight['pid'], preflight['startTicks'])
    except BaseException as error:
        if primary is None:
            primary = error
        else:
            primary.consumerPreflightCensusFailure = 'consumer_preflight_census_failed'
    try:
        result = cleanup_birth(lifecycle, docker, enrolled, scope=scope, controller=controller)
    except BaseException as cleanup_error:
        details = getattr(cleanup_error, 'consumerCleanupEvidence', None)
        if type(details) is dict:
            cleanup_error.consumerCleanupEvidence = {**details,
                'consumerEnrolmentSha256': enrolled_sha, 'finalRegistrationObserved': final_observed,
                'preflightBirthGone': orphan_gone, 'preflightSignalSent': False,
                'preflightCleanupPolicy': 'observe-only',
                'unknownUnregisteredChildrenAbsentProven': False,
                'unknownRetained': details.get('birthGone') is not True or orphan_gone is not True}
        if primary is None:
            raise
        primary.consumerCleanupFailure = 'consumer_cleanup_failed'
        if hasattr(cleanup_error, 'consumerCleanupEvidence'):
            primary.consumerCleanupEvidence = cleanup_error.consumerCleanupEvidence
        primary.registrationCleanupFailure = getattr(cleanup_error, 'registrationCleanupFailure', None)
        raise primary
    evidence = {**result, 'consumerEnrolmentSha256': enrolled_sha,
        'finalRegistrationObserved': final_observed,
        'preflightBirthGone': orphan_gone, 'preflightCleanupPolicy': 'observe-only',
        'preflightSignalSent': False, 'unknownUnregisteredChildrenAbsentProven': False,
        'unknownRetained': result.get('birthGone') is not True or orphan_gone is not True}
    if primary is not None:
        primary.consumerCleanupEvidence = evidence
        raise primary
    return evidence


if __name__ == '__main__':
    print(json.dumps({'schema': 'cpu0-consumer-registration.v2', 'status': 'prepared-only', 'hostOperations': 0}))
