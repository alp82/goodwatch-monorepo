"""One-shot start of the exact previously created, never-started owned clone.

No default execution, create/remove/stop, or generic retry exists. Complete
external bytes and backend source authenticate before this module executes.
Private Docker configuration and raw container IDs never enter public evidence.
"""
import copy
import http.client
import json
import os
from pathlib import Path
import re
import socket
import stat
import time
import types

from packet import canonical, directory, read_owned, sha, verify_source
import setup
import admission
import census
from reason_codes import REASONS

MODE = 'recover-created-never-started.v1'
OUTPUT_SHA = 'ad0b490d3d39d2259d86290d4883038a33461e85fe00f1842761fb214d39a84c'
CONFIG_SHA = '27b99d3853e0048c38ce84cda33fabd7ca4e270c23e21b84f1cc8279c4df1edd'
OLD_ID_SHA = '30aca59a60c971e246894f614f767930190046ce3138c89e6c9ce5d64e069ff7'
NEW_ID_SHA = 'c67d813c0e32872228fdc13a515e49c45b3ae68166f19531ee83bcfdf69548ea'
OLD_RECEIPT_SHA = 'ca4366c7673afae5f7a1680e25183ffd378f9f7888c92f5d79b855b5b4a69cc3'
OLD_HOST_SHA = 'd538f05de305362096286b0fbd6611d3e9171d305f4db59b291fa9754567798d'
NEW_HOST_SHA = 'a05ad0714e9c0227ac80097a86376ddcc192983499cf66c0d7098ad0aa0ee9c5'
RULE = 'oom-kill-disable-null-to-false.moby28.v1'
YEAR_ONE = '0001-01-01T00:00:00Z'
ATTEMPT_NAME = 'cpu0-never-started-recovery-attempt-v1.json'
SUCCESS_NAME = 'cpu0-never-started-recovery-success-v1.json'
STAGE_NAME = 'pin-control-20261012-100-cpu0-v1'
MAX_PROOF = 65536


def fail(reason):
    raise RuntimeError(reason)


def proofs(output_raw, config_raw):
    """Only the two immutable actual public observations are accepted."""
    for raw, expected, reason in ((output_raw, OUTPUT_SHA, 'recovery_original_failure_changed'),
                                  (config_raw, CONFIG_SHA, 'recovery_config_proof_changed')):
        if not isinstance(raw, bytes) or len(raw) > MAX_PROOF or sha(raw) != expected:
            fail(reason)
    try:
        output = json.loads(output_raw)
        config = json.loads(config_raw)
        receipt = output['receipt']
        failure = receipt['remoteFailureEvidence']
        endpoints = failure['setupEndpointEvidence']
        if (output['kind'] != 'external-completion' or receipt['schema'] != 'cpu0-external-completion.v6'
                or failure['operation'] != 'setup' or failure['reason'] != 'setup_hostconfig_drift'
                or failure['continuationAllowed'] is not False or receipt['frames'] != []
                or receipt['transport'] is not None
                or failure['setupFailureEvidence'] != {'newCreated': True, 'createdContainerIdHash': NEW_ID_SHA,
                                                       'automaticRemoval': False, 'automaticRecovery': False}
                or failure['setupDurableStopEvidence'] != {'receiptObservedDurable': True,
                                                          'receiptSha256': OLD_RECEIPT_SHA,
                                                          'continuationAllowed': False}
                or endpoints['old']['observed'] is not True or endpoints['new']['observed'] is not True
                or endpoints['old']['state']['containerIdHash'] != OLD_ID_SHA
                or endpoints['new']['state']['containerIdHash'] != NEW_ID_SHA
                or config['schema'] != 'cpu0-readonly-created-config-difference.v1'
                or config['oldNonCpuHostConfigHash'] != OLD_HOST_SHA
                or config['newNonCpuHostConfigHash'] != NEW_HOST_SHA):
            fail('recovery_proof_invalid')
        return endpoints
    except (KeyError, TypeError, ValueError, UnicodeError):
        fail('recovery_proof_invalid')


def raw_id(value, expected):
    identity = value.get('Id')
    if not isinstance(identity, str) or re.fullmatch('[0-9a-f]{64}', identity) is None or sha(identity.encode()) != expected:
        fail('recovery_target_changed')
    return identity


def stopped_pair(lifecycle, docker, endpoints):
    old = lifecycle.container(setup.OLD, docker)
    new = lifecycle.container(setup.NEW, docker)
    raw_id(old, OLD_ID_SHA); raw_id(new, NEW_ID_SHA)
    for tag, value in (('old', old), ('new', new)):
        state = value['State']
        if (state['Running'] is not False or type(state['Pid']) is not int or state['Pid'] != 0
                or state['OOMKilled'] is not False or type(state['ExitCode']) is not int
                or state['ExitCode'] != 0 or type(value['RestartCount']) is not int or value['RestartCount'] != 0
                or any(state.get(key) is not False for key in ('Dead', 'Paused', 'Restarting'))
                or canonical(lifecycle.state_snapshot(value)) != canonical(endpoints[tag]['state'])):
            fail('recovery_state_changed')
    if (new['State']['Status'] != 'created' or new['State']['StartedAt'] != YEAR_ONE
            or new['State']['FinishedAt'] != YEAR_ONE):
        fail('recovery_state_changed')
    raw, identity = read_owned(setup.ROOT/'cpu0-old-clean-receipt-v1.json')
    if sha(raw) != OLD_RECEIPT_SHA:
        fail('recovery_old_receipt_changed')
    lifecycle.require_clean_receipt(lifecycle.state_snapshot(old), json.loads(raw))
    return old, new, identity


def non_cpu(value):
    return {key: item for key, item in value['HostConfig'].items() if key not in setup.CPU_FIELDS}


def configuration(old, new, *, poststart=False, prestart=None):
    """Byte-exact JSON types; only the observed OomKillDisable rule differs."""
    before = non_cpu(old); after = non_cpu(new)
    if ('OomKillDisable' not in before or before['OomKillDisable'] is not None
            or 'OomKillDisable' not in after
            or (after['OomKillDisable'] is not False and not (poststart and after['OomKillDisable'] is None))):
        fail('recovery_normalization_refused')
    normalized = copy.deepcopy(before)
    normalized['OomKillDisable'] = after['OomKillDisable']
    if canonical(old['Config']) != canonical(new['Config']) or canonical(normalized) != canonical(after):
        fail('recovery_parity_changed')
    if not poststart and (sha(canonical(before)) != OLD_HOST_SHA or sha(canonical(after)) != NEW_HOST_SHA):
        fail('recovery_config_proof_changed')
    if poststart:
        if prestart is None or canonical(prestart['Config']) != canonical(new['Config']):
            fail('recovery_parity_changed')
        prior = non_cpu(prestart); prior['OomKillDisable'] = after['OomKillDisable']
        if canonical(prior) != canonical(after):
            fail('recovery_parity_changed')
    # Reuse ALL configured CPU/mount/restart checks after strict byte parity.
    left = copy.deepcopy(old); left['HostConfig']['OomKillDisable'] = after['OomKillDisable']
    setup.configured_pair(left, new)
    return {'schema': 'cpu0-recovery-semantic-parity.v1', 'rule': RULE,
            'configEqual': True, 'normalizedNonCpuHostConfigEqual': True,
            'rawNonCpuHostConfigEqual': canonical(before) == canonical(after),
            'oldRawNonCpuHostConfigSha256': sha(canonical(before)),
            'newRawNonCpuHostConfigSha256': sha(canonical(after)),
            'normalizedNonCpuHostConfigSha256': sha(canonical(normalized)),
            'newValue': 'null' if after['OomKillDisable'] is None else 'false',
            'poststart': poststart, 'creationPerformed': False, 'writableLayerParity': False}


def admitted_files(raw_source, source_files, derivative):
    expected = {**source_files, 'cpu0-source-freeze.json': raw_source,
                'helper-config.json': source_files['prepared-helper-policy-cpu0.json'],
                'controller-config.json': derivative}
    directory(setup.ADMISSION)
    before = setup.ADMISSION.lstat()
    if set(path.name for path in setup.ADMISSION.iterdir()) != set(expected):
        fail('recovery_stage_changed')
    identities = {}
    for name, content in expected.items():
        observed, identity = read_owned(setup.ADMISSION/name)
        if observed != content:
            fail('recovery_stage_changed')
        identities[name] = identity
    after = setup.ADMISSION.lstat()
    if (before.st_dev, before.st_ino) != (after.st_dev, after.st_ino) or len(expected) != 17:
        fail('recovery_stage_changed')
    return identities


def own_stopped_placement(lifecycle, old, new, *, cgroups=Path('/sys/fs/cgroup')):
    """No invented live source. Exact-ID existing groups must be empty."""
    own = lifecycle.process(os.getpid())
    ids = (raw_id(old, OLD_ID_SHA), raw_id(new, NEW_ID_SHA))
    parts = own['group'].split('/')
    if any(part == identity or part == 'docker-'+identity+'.scope' for identity in ids for part in parts):
        fail('recovery_placement_unknown')
    found = []; target_roots=[]; checked = 0; started = time.monotonic()
    # Metadata only, no symlink following; bounded entire hierarchy traversal.
    for folder, dirs, _ in os.walk(cgroups, followlinks=False,onerror=lambda error:fail('recovery_placement_unknown')):
        checked += 1
        if checked > 4096 or time.monotonic()-started > 2:
            fail('recovery_placement_unknown')
        dirs[:] = [name for name in dirs if not (Path(folder)/name).is_symlink()]
        path=Path(folder)
        if path.name in ids or path.name in tuple('docker-'+i+'.scope' for i in ids):
            target_roots.append(path)
        if not any(path==root or root in path.parents for root in target_roots):continue
        raw = lifecycle.bounded(Path(folder)/'cgroup.procs', 512)
        if raw.strip():
            fail('recovery_placement_unknown')
        found.append({'groupHash': sha(str(Path(folder).relative_to(cgroups)).encode()), 'members': 0})
    if lifecycle.process(os.getpid()) != own:
        fail('recovery_placement_unknown')
    return {'preStartSourceProcessProof': False, 'ownProcess': lifecycle.public_process(own),
            'ownTargetSubtreeExcluded': True, 'existingExactIdGroups': sorted(found,key=lambda item:item['groupHash']),
            'missingGroupsDoNotProveHistoricalPlacement': True}


def require_unused_scope():
    for path in (setup.ROOT/'cpu0-lifecycle-handoff-v1.json', setup.ROOT/STAGE_NAME,
                 setup.ROOT/'cpu0-consumer-registration-v1.json', setup.ROOT/ATTEMPT_NAME, setup.ROOT/SUCCESS_NAME):
        if os.path.lexists(path):
            fail('recovery_attempt_exists' if path.name in (ATTEMPT_NAME, SUCCESS_NAME) else 'recovery_scope_changed')


def prior_census(prior_policy, prior_sha, protected_pids=None):
    if sha(canonical(prior_policy)) != prior_sha:
        fail('prior_stage_policy_changed')
    census.immutable_prior_files(prior_policy)
    raw, _ = read_owned(setup.ROOT/census.PRIOR_STAGES[-1]/'prepare_clone_reclaim.py')
    if sha(raw) != 'f831f00f75d4b54dce3ba493a4a078b23969222507576505052291ed0147f7c5':
        fail('prior_receipt_helper_changed')
    helper = types.ModuleType('authenticated_cpu0_recovery_prior_helper')
    helper.__file__ = str(setup.ROOT/census.PRIOR_STAGES[-1]/'prepare_clone_reclaim.py')
    exec(compile(raw, helper.__file__, 'exec'), helper.__dict__)
    return {'writers': census.prior_writers(prior_policy, helper, protected_pids or {os.getpid(), os.getppid()}),
            'controls': census.proc_controls()}


def port_closed(connection=socket.create_connection):
    try:
        client = connection(('127.0.0.1', 16333), timeout=1)
    except ConnectionRefusedError:
        return {'pointInTimeConnectionRefused': True, 'sharedStoreAbsenceProven': False}
    except OSError:
        fail('recovery_port_present')
    else:
        client.close()
        fail('recovery_port_present')


def publish(name, value):
    """New fixed receipt scope; never expands legacy lifecycle allowlists."""
    if name not in (ATTEMPT_NAME, SUCCESS_NAME):
        fail('recovery_scope_changed')
    directory(setup.ROOT)
    raw = canonical(value)+b'\n'
    if len(raw) > MAX_PROOF:
        fail('recovery_attempt_publish_failed')
    fd = None
    try:
        fd = os.open(setup.ROOT/name, os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_CLOEXEC, 0o600)
        with os.fdopen(fd, 'wb') as stream:
            fd = None; stream.write(raw); stream.flush(); os.fsync(stream.fileno())
        dfd = os.open(setup.ROOT, os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC)
        try: os.fsync(dfd)
        finally: os.close(dfd)
        observed, _ = read_owned(setup.ROOT/name)
        if observed != raw:
            fail('recovery_attempt_publish_failed')
        return sha(raw)
    except FileExistsError:
        fail('recovery_attempt_exists')
    except OSError:
        # Existing partial bytes remain evidence; never delete them or retry.
        fail('recovery_attempt_publish_failed')
    finally:
        if fd is not None: os.close(fd)


class StartEngine:
    """One exact-ID start; HTTP acknowledgment is never CLI or birth proof."""
    def __init__(self, socket_factory=None):
        self.postIssued = False
        self.socket_factory = socket_factory or socket.socket

    def request(self, method, path, *, timeout=15):
        # No per-I/O timeout accumulation: each operation receives the current
        # absolute deadline remainder. No chunked/close-delimited body accepted.
        allowed = method=='GET' and path=='/version'
        if method=='POST':
            match=re.fullmatch(r'/v1\.51/containers/([0-9a-f]{64})/start',path)
            allowed=match is not None and sha(match[1].encode())==NEW_ID_SHA
        if not allowed or not isinstance(timeout,(int,float)) or isinstance(timeout,bool) or not 0<timeout<=15:
            fail('recovery_scope_changed')
        deadline = time.monotonic()+timeout
        client = self.socket_factory(socket.AF_UNIX, socket.SOCK_STREAM)
        def remaining():
            value = deadline-time.monotonic()
            if value <= 0: fail('recovery_start_unknown')
            client.settimeout(value)
        def receive():
            remaining()
            part = client.recv(4096)
            if not part: fail('recovery_start_unknown')
            return part
        try:
            remaining(); client.connect('/var/run/docker.sock')
            request = (method+' '+path+' HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\nContent-Length: 0\r\n\r\n').encode('ascii')
            remaining()
            if method=='POST':self.postIssued=True
            client.sendall(request)
            data = bytearray()
            while b'\r\n\r\n' not in data:
                data.extend(receive())
                if len(data)>16384: fail('recovery_start_unknown')
            head, body = bytes(data).split(b'\r\n\r\n',1)
            lines = head.split(b'\r\n')
            match = re.fullmatch(rb'HTTP/1\.[01] ([0-9]{3})(?: [^\r\n]*)?',lines[0])
            if match is None: fail('recovery_start_unknown')
            status = int(match[1]); headers = {}
            for row in lines[1:]:
                if b':' not in row: fail('recovery_start_unknown')
                key,value=row.split(b':',1);key=key.strip().lower();value=value.strip()
                if key in headers: fail('recovery_start_unknown')
                headers[key]=value
            if b'transfer-encoding' in headers: fail('recovery_start_unknown')
            raw_length=headers.get(b'content-length',b'0' if status==204 else b'')
            if not re.fullmatch(rb'[0-9]+',raw_length): fail('recovery_start_unknown')
            length=int(raw_length)
            if length>MAX_PROOF or len(body)>length: fail('recovery_start_unknown')
            while len(body)<length:
                body+=receive()
                if len(body)>length: fail('recovery_start_unknown')
            remaining()
            return status,body
        except OSError:
            fail('recovery_start_unknown')
        finally:
            client.close()

    def version(self):
        status, raw = self.request('GET', '/version')
        try: value = json.loads(raw)
        except (ValueError, UnicodeError): fail('recovery_normalization_refused')
        if status != 200 or not isinstance(value,dict) or value.get('Version') != '28.5.1' or value.get('ApiVersion') != '1.51':
            fail('recovery_normalization_refused')
        return {'daemonVersion': '28.5.1', 'apiVersion': '1.51', 'binaryAttestation': False}

    def start(self, identity):
        self.postIssued=False
        if not isinstance(identity, str) or re.fullmatch('[0-9a-f]{64}', identity) is None or sha(identity.encode()) != NEW_ID_SHA:
            fail('recovery_target_changed')
        status, raw = self.request('POST', '/v1.51/containers/'+identity+'/start')
        if status != 204 or raw != b'':
            error = RuntimeError('recovery_start_refused')
            error.recoveryHttpStatus = status
            raise error
        return {'httpStatus': 204, 'httpAcknowledged': True, 'cliExitCode': None, 'runningProven': False}


def read_public_proof(path):
    """Local builder input: bounded before reading, exact bytes checked later."""
    raw, _ = read_owned(Path(path).absolute(), limit=MAX_PROOF, uid=os.geteuid())
    return raw


def close_control(fd):
    os.close(fd)


def new_failure_evidence():
    return {'schema': 'cpu0-never-started-recovery-failure.v1', 'originalOutputSha256': OUTPUT_SHA,
            'configProofSha256': CONFIG_SHA, 'oldCleanReceiptSha256': OLD_RECEIPT_SHA,
            'oldContainerIdHash': OLD_ID_SHA, 'newContainerIdHash': NEW_ID_SHA,
            'attemptObserved': None, 'attemptObservationKnown': False, 'attemptSha256': None,
            'actionState': 'not-issued', 'httpStatus': None, 'cliExitCode': None,
            'continuationAllowed': False}


def record_failure(error, evidence, lifecycle=None, docker=None):
    reason=error.args[0] if type(error) is RuntimeError and len(error.args)==1 else None
    evidence['primaryReason']=reason if isinstance(reason,str) and reason in REASONS else 'recovery_guard_or_runtime_failure'
    if lifecycle is not None:
        try:
            evidence['attemptObserved']=os.path.lexists(setup.ROOT/ATTEMPT_NAME)
            evidence['attemptObservationKnown']=True
        except BaseException:
            evidence['attemptObserved']=None;evidence['attemptObservationKnown']=False
    observed={}
    for name,tag in ((setup.OLD,'old'),(setup.NEW,'new')):
        try:
            if lifecycle is None:raise RuntimeError('recovery_guard_or_runtime_failure')
            observed[tag]={'observed':True,'state':lifecycle.state_snapshot(lifecycle.container(name,docker))}
        except BaseException:observed[tag]={'observed':False,'state':None,'absenceProven':False}
    evidence['endpoints']=observed
    error.recoveryFailureEvidence=copy.deepcopy(evidence)


def run_recovery(raw_source, source_sha, source_files, derivative_sha, prior_policy,
                 prior_sha, output_raw, config_raw, external_closure_sha):
    evidence=new_failure_evidence()
    try:
        # Only the authenticated remote bootstrap installs this marker after
        # verifying the complete ordered external closure. A caller hash alone
        # never attests executing module bytes; local imports cannot authorize it.
        if globals().get('_AUTHENTICATED_EXTERNAL_CLOSURE_SHA256')!=external_closure_sha or re.fullmatch('[0-9a-f]{64}',external_closure_sha or '') is None:
            fail('recovery_closure_unproven')
        return _run_recovery(raw_source,source_sha,source_files,derivative_sha,prior_policy,
                             prior_sha,output_raw,config_raw,external_closure_sha,evidence)
    except BaseException as error:
        if not hasattr(error,'recoveryFailureEvidence'):record_failure(error,evidence)
        raise


def _run_recovery(raw_source, source_sha, source_files, derivative_sha, prior_policy,
                  prior_sha, output_raw, config_raw, external_closure_sha, evidence):
    endpoints = proofs(output_raw, config_raw)
    manifest = verify_source(raw_source, source_sha, source_files)
    derivative = setup.derivative_admission_policy(source_files['prepared-control-policy-cpu0.json'],
                                                  manifest['files']['prepared-control-policy-cpu0.json'])
    if sha(derivative) != derivative_sha:
        fail('admission_derivative_changed')
    if re.fullmatch('[0-9a-f]{64}', external_closure_sha or '') is None:
        fail('recovery_proof_invalid')
    os.environ.clear(); os.environ.update({'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8',
                                          'DOCKER_HOST': 'unix:///var/run/docker.sock'})
    lifecycle = setup.load_first_lifecycle(raw_source, source_sha, source_files)
    guards = setup.load_first_guards(raw_source, source_sha, source_files)
    lifecycle.require_interpreter()
    fd = setup.acquire_control(lifecycle); primary = None; docker = setup.Docker()
    result = None

    try:
        require_unused_scope()
        identities = admitted_files(raw_source, source_files, derivative)
        old, new, old_receipt_identity = stopped_pair(lifecycle, docker, endpoints)
        parity = configuration(old, new)
        own = own_stopped_placement(lifecycle, old, new)
        prior = prior_census(prior_policy, prior_sha)
        port = port_closed()
        engine = StartEngine(); version = engine.version()
        host = admission.host(guards)
        # Renewal after all potentially slow inspectors and before the attempt.
        require_unused_scope()
        if admitted_files(raw_source, source_files, derivative) != identities:
            fail('recovery_stage_changed')
        old_again, new_again, receipt_again = stopped_pair(lifecycle, docker, endpoints)
        configuration(old_again, new_again)
        if receipt_again != old_receipt_identity or own_stopped_placement(lifecycle, old_again, new_again) != own:
            fail('recovery_placement_unknown')
        prior = prior_census(prior_policy, prior_sha)
        port_closed(); engine.version(); host = admission.host(guards)
        old_again,new_again,final_receipt_identity=stopped_pair(lifecycle,docker,endpoints)
        configuration(old_again,new_again)
        if final_receipt_identity!=old_receipt_identity or admitted_files(raw_source,source_files,derivative)!=identities:
            fail('recovery_stage_changed')
        if own_stopped_placement(lifecycle,old_again,new_again)!=own:
            fail('recovery_placement_unknown')
        lifecycle.require_lock(fd)
        attempt = {'schema': 'cpu0-never-started-recovery-attempt.v1', 'mode': MODE,
                   'sourceFreezeSha256': source_sha, 'externalClosureSha256': external_closure_sha,
                   'originalOutputSha256': OUTPUT_SHA, 'configProofSha256': CONFIG_SHA,
                   'oldCleanReceiptSha256': OLD_RECEIPT_SHA, 'old': lifecycle.state_snapshot(old_again),
                   'new': lifecycle.state_snapshot(new_again), 'startIssued': False,
                   'automaticRecoveryAllowed': False}
        attempt_sha = publish(ATTEMPT_NAME, attempt)
        evidence.update(attemptObserved=True, attemptObservationKnown=True, attemptSha256=attempt_sha)
        # Publication itself can take time. Never start from the earlier inspect.
        final_old,final_new,final_receipt=stopped_pair(lifecycle,docker,endpoints)
        configuration(final_old,final_new)
        if final_receipt!=old_receipt_identity or admitted_files(raw_source,source_files,derivative)!=identities:
            fail('recovery_stage_changed')
        lifecycle.require_lock(fd)
        identity=raw_id(final_new,NEW_ID_SHA)
        try:
            acknowledgment = engine.start(identity)
        except BaseException:
            evidence['actionState'] = 'issued-unknown' if engine.postIssued else 'not-issued'
            raise
        evidence.update(actionState='issued-acknowledged', httpStatus=204)
        shape_started = time.monotonic()
        while True:
            if time.monotonic()-shape_started>=90:fail('recovery_shape_unknown')
            current = lifecycle.container(setup.NEW, docker)
            raw_id(current, NEW_ID_SHA)
            configuration(old_again, current, poststart=True, prestart=new_again)
            if lifecycle.state_snapshot(lifecycle.container(setup.OLD, docker)) != endpoints['old']['state']:
                fail('recovery_state_changed')
            try:
                shape = admission.collection_shape()
                if time.monotonic()-shape_started>=90:fail('recovery_shape_unknown')
                break
            except RuntimeError as error:
                if str(error) not in ('setup_shape_unavailable', 'setup_shape_changed') or time.monotonic()-shape_started >= 90:
                    raise
                time.sleep(.2)
        if admitted_files(raw_source, source_files, derivative) != identities:
            fail('recovery_stage_changed')
        modules = setup.load_staged_modules(setup.ADMISSION, raw_source, source_sha, source_files)
        actual = modules['lifecycle_cpu0']; control = modules['controller_cpu0']; daemon = modules['daemon_cpu0']
        config = json.loads(derivative)
        _, spec, policy = daemon.load_config(str(setup.ADMISSION/'helper-config.json'),
                                            config['helperPolicySha256'], config['helperCodeSha256'])
        control.CPU_POLICY = config['cpuIsolation']
        birth = control.birth_admission(config, spec, policy)
        actual.require_lock(fd)
        current = actual.container(setup.NEW, docker); raw_id(current, NEW_ID_SHA)
        post_parity = configuration(old_again, current, poststart=True, prestart=new_again)
        receipt_raw, identity = read_owned(setup.ROOT/'cpu0-old-clean-receipt-v1.json')
        if sha(receipt_raw) != OLD_RECEIPT_SHA or identity != old_receipt_identity:
            fail('recovery_old_receipt_changed')
        actual.require_clean_receipt(actual.state_snapshot(actual.container(setup.OLD, docker)), json.loads(receipt_raw))
        live=actual.attest(setup.NEW,docker)
        protected={os.getpid(),os.getppid(),live['wrapper']['pid'],live['wrapper']['parentPid'],live['qdrant']['pid'],live['qdrant']['parentPid']}
        prior=prior_census(prior_policy,prior_sha,protected)
        if admitted_files(raw_source,source_files,derivative)!=identities or actual.attest(setup.NEW,docker)!=live:
            fail('recovery_birth_changed')
        # The final pair proves OLD receipt and actual current live NEW/own
        # placement after census and byte renewal, before the first handoff.
        actual.require_lock(fd)
        handoff_raw = setup.first_handoff(actual, docker)
        handoff_sha = setup.write_root_absent(setup.ROOT/'cpu0-lifecycle-handoff-v1.json', handoff_raw)
        actual.read_handoff(docker, handoff_sha)
        result = {'schema': 'cpu0-never-started-recovery.v1', 'mode': MODE,
                  'sourceFreezeSha256': source_sha, 'externalClosureSha256': external_closure_sha,
                  'derivativePolicySha256': derivative_sha, 'originalOutputSha256': OUTPUT_SHA,
                  'configProofSha256': CONFIG_SHA, 'oldCleanReceiptSha256': OLD_RECEIPT_SHA,
                  'attemptSha256': attempt_sha, 'startedExistingCreatedClone': True,
                  'creationPerformed': False, 'preStartPlacement': own, 'normalizationBefore': parity,
                  'normalizationAfter': post_parity, 'daemon': version, 'startAcknowledgment': acknowledgment,
                  'hostBeforeStart': host, 'portBeforeStart': port, 'initialAdmission': birth,
                  'collectionShape': shape, 'handoff': {**json.loads(handoff_raw), 'sha256': handoff_sha},
                  'priorEvidence': prior, 'admissionFilesCreated': 0, 'createCalls': 0, 'removeCalls': 0,
                  'stopCalls': 0, 'queries': 0, 'modelsRead': 0, 'normalStartupStorageWritesPossible': True}
        result['recoveryReceiptSha256'] = publish(SUCCESS_NAME, result)
        return result
    except BaseException as error:
        primary = error
        if type(error) is RuntimeError and error.args==('recovery_start_refused',) and evidence['attemptObserved']:
            evidence.update(actionState='issued-nonzero',httpStatus=getattr(error,'recoveryHttpStatus',None))
        record_failure(error,evidence,lifecycle,docker)
        raise
    finally:
        try: close_control(fd)
        except BaseException:
            if primary is None:
                error=RuntimeError('recovery_lock_close_failed')
                record_failure(error,evidence,lifecycle,docker)
                error.recoveryCleanupFailure='recovery_lock_close_failed'
                if result is not None:error.recoveryCompletedReceipt=result
                raise error from None
            primary.recoveryCleanupFailure = 'recovery_lock_close_failed'
