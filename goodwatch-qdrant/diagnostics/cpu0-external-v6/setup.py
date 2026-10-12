"""Prepared CPU0 setup seams. Root-owned execution packet supplies frozen gates.

No command-line execution is implemented until the closed source and external
manifests are reviewed. Config/HostConfig, including Env, remain in memory.
"""
import copy
import hashlib
import http.client
import json
import os
from pathlib import Path
import socket
import sys
import time
import fcntl
import stat
import subprocess
import select

sys.dont_write_bytecode = True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from packet import (canonical, directory, hash_value, load_first_lifecycle,
                    load_first_guards, load_staged_modules, read_owned, sha,
                    stage_absent, verify_source)
import admission as setup_admission
import census
import types


def write_root_absent(path, raw):
    """Durable receipt publication, never overwrite a previous stop proof."""
    path=Path(path)
    if path.parent!=ROOT or path.name not in ('cpu0-old-clean-receipt-v1.json','cpu0-lifecycle-handoff-v1.json') or not isinstance(raw,bytes) or len(raw)>32768:
        raise RuntimeError('setup_receipt_scope')
    directory(ROOT)
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_CLOEXEC,0o600)
    info=os.fstat(fd)
    try:
        with os.fdopen(fd,'wb') as output:
            output.write(raw);output.flush();os.fsync(output.fileno())
        dfd=os.open(ROOT,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC)
        try:os.fsync(dfd)
        finally:os.close(dfd)
        return sha(raw)
    except BaseException as original:
        # A partially/durably published receipt is evidence, never removed or
        # interpreted as a clean success after an fsync/publication failure.
        original.receiptFailureEvidence={'receiptRetained':os.path.lexists(path),
                                        'device':info.st_dev,'inode':info.st_ino}
        raise


def acquire_control(lifecycle):
    directory(ROOT)
    path=ROOT/'control.lock'
    before=path.lstat()
    if not stat.S_ISREG(before.st_mode) or before.st_uid!=0 or before.st_nlink!=1 or stat.S_IMODE(before.st_mode)!=0o600:
        raise RuntimeError('setup_control_lock_changed')
    fd=os.open(path,os.O_RDWR|os.O_NOFOLLOW|os.O_CLOEXEC)
    try:
        opened=os.fstat(fd)
        if (before.st_dev,before.st_ino)!=(opened.st_dev,opened.st_ino):
            raise RuntimeError('setup_control_lock_changed')
        fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
        lifecycle.require_lock(fd)
        return fd
    except BaseException:
        os.close(fd);raise


def clean_old(lifecycle,docker,lock_fd,protected_pids,old,stop_admission):
    """The only first-stop path; refusal cannot lead to create or start."""
    lifecycle.require_lock(lock_fd)
    if old.get('State',{}).get('Running') is True:
        if os.path.lexists(ROOT/'cpu0-old-clean-receipt-v1.json'):
            raise RuntimeError('setup_old_receipt_already_exists')
        # Exact shared floors/host CPU admission run BEFORE stop. The lifecycle
        # owns its separate 20-second remaining-deadline inspect client scope.
        admission=stop_admission()
        if not isinstance(admission,dict) or admission.get('schema')!='cpu0-old-stop-admission.v6' or not isinstance(admission.get('source'),dict):
            raise RuntimeError('setup_old_admission_invalid')
        expected=admission['source']
        if expected.get('state')!=lifecycle.state_snapshot(old) or lifecycle.attest(OLD,docker)!=expected:
            raise RuntimeError('setup_old_admission_changed')
        receipt=lifecycle.graceful_stop(OLD,docker,lock_fd,
                                       protected_pids=protected_pids,expected=expected)
        try:
            raw=canonical(receipt)+b'\n'
            receipt_sha=write_root_absent(ROOT/'cpu0-old-clean-receipt-v1.json',raw)
            current=lifecycle.container(OLD,docker)
            lifecycle.require_clean_receipt(lifecycle.state_snapshot(current),receipt)
            return current,receipt_sha
        except BaseException as original:
            # Successful action evidence survives publication/current-state
            # refusal. It cannot grant continuation without the durable proof.
            original.setupCompletedStopReceipt=receipt
            raise
    if old.get('State',{}).get('Running') is not False:
        raise RuntimeError('setup_old_state_unknown')
    receipt,receipt_sha,_=lifecycle.secure_json(ROOT/'cpu0-old-clean-receipt-v1.json')
    lifecycle.require_clean_receipt(lifecycle.state_snapshot(old),receipt)
    return old,receipt_sha

ROOT = Path('/root/goodwatch-qdrant-cold-406-20261011')
ADMISSION = ROOT/'cpu0-admission-20261012-100-v1'
OLD = 'gw-qdrant-cold-406-20261011'
NEW = 'gw-qdrant-cpu0-100-20261012'
IMAGE = 'sha256:dd57172b0bbebb29b0a96a37c1f378a317449730c36cdfe68feabe36e740a92b'
CPU_FIELDS = frozenset(('NanoCpus', 'CpuQuota', 'CpuPeriod'))
MAX_ENGINE_BODY = 2*1024**2


class Docker:
    """Private bounded inspect/start client, outside the source cgroup.

    The lifecycle owns its distinct remaining-deadline inspector during TERM.
    This client never has a stop/kill/remove or arbitrary-target operation.
    """
    def __init__(self, configured_image=None):
        if configured_image is not None and (not isinstance(configured_image,str) or not configured_image or configured_image.startswith('-') or len(configured_image)>512 or any(ord(c)<33 for c in configured_image)):
            raise RuntimeError('setup_configured_image_invalid')
        self.configured_image=configured_image

    def __call__(self,*args):
        allowed=len(args)==2 and all(isinstance(x,str) for x in args) and ((args[0]=='inspect' and args[1] in (OLD,NEW,IMAGE,self.configured_image)) or args==('start',NEW))
        if not allowed:raise RuntimeError('setup_docker_operation_refused')
        child=None;primary=None;started=time.monotonic()
        try:
            child=subprocess.Popen(['/usr/bin/docker',*args],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,close_fds=True,
                                   env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8',
                                        'DOCKER_HOST':'unix:///var/run/docker.sock'})
            chunks=[];size=0
            while True:
                remaining=15-(time.monotonic()-started)
                if remaining<=0:raise RuntimeError('setup_docker_timeout')
                readable,_,_=select.select([child.stdout],[],[],remaining)
                if not readable:raise RuntimeError('setup_docker_timeout')
                part=os.read(child.stdout.fileno(),min(65536,MAX_ENGINE_BODY+1-size))
                if not part:break
                chunks.append(part);size+=len(part)
                if size>MAX_ENGINE_BODY:raise RuntimeError('setup_docker_body_bound')
            remaining=15-(time.monotonic()-started)
            if remaining<=0:raise RuntimeError('setup_docker_timeout')
            if child.wait(timeout=remaining)!=0:raise RuntimeError('setup_docker_unavailable')
            return b''.join(chunks).decode('utf-8')
        except (OSError,UnicodeError,subprocess.TimeoutExpired):
            primary=RuntimeError('setup_docker_unavailable');raise primary from None
        except BaseException as error:
            primary=error;raise
        finally:
            if child is not None:
                try:
                    if child.poll() is None:
                        child.terminate()
                        try:child.wait(timeout=1)
                        except subprocess.TimeoutExpired:child.kill();child.wait(timeout=1)
                    child.stdout.close()
                except BaseException:
                    evidence={'clientGone':child.poll() is not None,'exitCode':child.returncode}
                    if primary is None:
                        error=RuntimeError('setup_docker_cleanup_failed');error.setupDockerCleanupEvidence=evidence;raise error
                    primary.setupDockerCleanupEvidence=evidence


def configured_pair(old, new):
    """Allow only three configured CPU changes; generated state is separate.

    This intentionally compares every Config/HostConfig key, including unknown
    keys. It does not dump raw config, Env, labels or Docker error messages.
    """
    if not isinstance(old, dict) or not isinstance(new, dict):
        raise RuntimeError('setup_configuration_invalid')
    if old.get('Name') != '/'+OLD or new.get('Name') != '/'+NEW or old.get('Image') != IMAGE or new.get('Image') != IMAGE:
        raise RuntimeError('setup_target_changed')
    for x in (old, new):
        if not isinstance(x.get('Config'), dict) or not isinstance(x.get('HostConfig'), dict):
            raise RuntimeError('setup_configuration_invalid')
        if x['HostConfig'].get('RestartPolicy') != {'Name':'no','MaximumRetryCount':0}:
            raise RuntimeError('setup_restart_policy_changed')
    if old['Config'] != new['Config']:
        raise RuntimeError('setup_config_drift')
    before = copy.deepcopy(old['HostConfig']); after = copy.deepcopy(new['HostConfig'])
    for key in CPU_FIELDS:
        if type(after.get(key)) is not int or after[key] != 0:
            raise RuntimeError('setup_cpu_not_unlimited')
        before.pop(key, None); after.pop(key, None)
    if before != after:
        raise RuntimeError('setup_hostconfig_drift')
    if type(old['HostConfig'].get('NanoCpus')) is not int or old['HostConfig']['NanoCpus'] != 2_000_000_000:
        raise RuntimeError('setup_old_cpu_changed')
    if old['HostConfig'].get('CpusetCpus') != '' or old['HostConfig'].get('CpusetMems') != '':
        raise RuntimeError('setup_cpuset_changed')
    # Mount identities are checked by lifecycle against live /proc namespace.
    mounts = lambda x: sorted((m['Source'], m['Destination'], m['Type'], m['RW']) for m in x['Mounts'])
    if len(old.get('Mounts', [])) != 3 or len(new.get('Mounts', [])) != 3 or mounts(old) != mounts(new):
        raise RuntimeError('setup_mount_drift')
    return {'schema':'cpu0-configured-parity.v6', 'configEqual':True,
            'nonCpuHostConfigEqual':True, 'cpuFieldsChanged':sorted(CPU_FIELDS),
            'configSha256':sha(canonical(old['Config'])),
            'nonCpuHostConfigSha256':sha(canonical(before)),
            'writableLayerParity':False}


def creation_body(old, image):
    """Engine JSON body, never -e/process argv. Unknown fields are preserved."""
    if old.get('Name') != '/'+OLD or old.get('Image') != IMAGE or not isinstance(image, dict) or image.get('Id') != IMAGE:
        raise RuntimeError('setup_target_changed')
    config = old.get('Config'); host = old.get('HostConfig')
    if not isinstance(config, dict) or not isinstance(host, dict):
        raise RuntimeError('setup_configuration_invalid')
    if host.get('RestartPolicy') != {'Name':'no','MaximumRetryCount':0}:
        raise RuntimeError('setup_restart_policy_changed')
    if type(host.get('NanoCpus')) is not int or host['NanoCpus'] != 2_000_000_000 or host.get('Memory') != 6*1024**3 or host.get('MemorySwap') != 6*1024**3 or host.get('CpusetCpus') != '' or host.get('CpusetMems') != '':
        raise RuntimeError('setup_old_limits_changed')
    mount_destinations = {m['Destination'] for m in old.get('Mounts', []) if m.get('Type') == 'bind'}
    volumes = image.get('Config', {}).get('Volumes')
    if volumes is not None and (not isinstance(volumes, dict) or not set(volumes).issubset(mount_destinations)):
        raise RuntimeError('setup_image_volume_unclassified')
    # Retain the original configured Image string; inspect its local resolution
    # separately before creation, then require actual created Image == IMAGE.
    if not isinstance(config.get('Image'), str) or not config['Image']:
        raise RuntimeError('setup_configured_image_missing')
    body = copy.deepcopy(config)
    body['HostConfig'] = copy.deepcopy(host)
    for key in CPU_FIELDS:
        body['HostConfig'][key] = 0
    # New network endpoints are derived by Docker from identical NetworkMode and
    # binding; no old endpoint IDs/IP addresses are supplied or broadly ignored.
    return body


class UnixEngineConnection(http.client.HTTPConnection):
    def __init__(self, timeout):
        super().__init__('localhost', timeout=timeout)

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect('/var/run/docker.sock')


class Engine:
    """Bounded local socket calls; no stderr/message/response payload emitted."""
    def __init__(self, connection=UnixEngineConnection):
        self.connection = connection

    def request(self, method, path, value=None, timeout=15):
        allowed = (method == 'POST' and path == '/containers/create?name='+NEW)
        if not allowed:
            raise RuntimeError('setup_engine_operation_refused')
        raw = canonical(value)
        if len(raw) > MAX_ENGINE_BODY:
            raise RuntimeError('setup_engine_body_bound')
        connection = self.connection(timeout)
        try:
            connection.request(method, path, body=raw,
                               headers={'Content-Type':'application/json',
                                        'Content-Length':str(len(raw)),
                                        'Connection':'close'})
            response = connection.getresponse()
            data = response.read(MAX_ENGINE_BODY+1)
            if len(data) > MAX_ENGINE_BODY or response.status != 201:
                raise RuntimeError('setup_engine_create_failed')
            result = json.loads(data)
            if not isinstance(result, dict) or set(result) != {'Id','Warnings'} or not isinstance(result['Id'],str) or len(result['Id']) != 64 or any(c not in '0123456789abcdef' for c in result['Id']) or result['Warnings'] not in (None, []):
                raise RuntimeError('setup_engine_create_unclassified')
            return result['Id']
        except (OSError, ValueError, http.client.HTTPException):
            raise RuntimeError('setup_engine_transport_failed') from None
        finally:
            connection.close()

    def require_new_absent(self):
        connection=self.connection(15)
        try:
            connection.request('GET','/containers/'+NEW+'/json',headers={'Connection':'close'})
            response=connection.getresponse();raw=response.read(MAX_ENGINE_BODY+1)
            if len(raw)>MAX_ENGINE_BODY or response.status!=404:
                raise RuntimeError('setup_new_name_not_absent')
        except (OSError,http.client.HTTPException):
            raise RuntimeError('setup_engine_transport_failed') from None
        finally:connection.close()


def first_handoff(lifecycle, docker):
    record = {'schema':'clone-lifecycle-handoff.cpu0.v1', 'owner':'setup',
              'previousSha256':None, 'snapshot':lifecycle.pair_snapshot(docker)}
    return canonical(record)+b'\n'


def derivative_admission_policy(original_raw,expected_sha):
    """Only two sibling paths differ; root freezes resulting bytes separately."""
    if sha(original_raw)!=expected_sha:raise RuntimeError('admission_derivative_source_changed')
    value=json.loads(original_raw)
    if value['schema']!='clone-pin-control.cpu0-owned.v1' or value['helperConfig']!=str(ROOT/'pin-control-20261012-100-cpu0-v1/helper-config.json') or value['lifecycle']['modulePath']!=str(ROOT/'pin-control-20261012-100-cpu0-v1/lifecycle_cpu0.py'):
        raise RuntimeError('admission_derivative_source_changed')
    value['helperConfig']=str(ADMISSION/'helper-config.json')
    value['lifecycle']['modulePath']=str(ADMISSION/'lifecycle_cpu0.py')
    return canonical(value)+b'\n'


def run_setup(raw_source,source_sha,source_files,derivative_sha,
              prior_policy,prior_policy_sha):
    """Concrete first-stop/create/admission flow; caller authenticates this packet.

    It is not reachable from the prepared-only CLI. The future reviewed SSH
    stdin bootstrap must authenticate the whole external closure before calling.
    No boolean callbacks, recovery, extra restart or source cap update exists.
    """
    manifest=verify_source(raw_source,source_sha,source_files)
    hash_value(derivative_sha);hash_value(prior_policy_sha)
    if sha(canonical(prior_policy))!=prior_policy_sha:raise RuntimeError('prior_stage_policy_changed')
    derivative=derivative_admission_policy(source_files['prepared-control-policy-cpu0.json'],manifest['files']['prepared-control-policy-cpu0.json'])
    if sha(derivative)!=derivative_sha:raise RuntimeError('admission_derivative_changed')
    # The source's internal inspectors inherit this exact local socket target;
    # arbitrary context/host/TLS/proxy variables never reach child clients.
    os.environ.clear();os.environ.update({'PATH':'/usr/bin:/bin','LANG':'C.UTF-8',
                                        'DOCKER_HOST':'unix:///var/run/docker.sock'})
    lifecycle=load_first_lifecycle(raw_source,source_sha,source_files)
    guards=load_first_guards(raw_source,source_sha,source_files)
    lifecycle.require_interpreter()
    lock_fd=acquire_control(lifecycle);primary=None;old_receipt_sha=None
    try:
        for path in (ADMISSION,ROOT/'cpu0-lifecycle-handoff-v1.json'):
            if os.path.lexists(path):raise RuntimeError('setup_fresh_public_scope_required')
        docker=Docker();engine=Engine();engine.require_new_absent()
        old=lifecycle.container(OLD,docker)
        protected={os.getpid(),os.getppid()}
        if old['State']['Running'] is True:
            initial=lifecycle.attest(OLD,docker)
            protected.update((initial['wrapper']['pid'],initial['wrapper']['parentPid'],initial['qdrant']['pid']))
        census.immutable_prior_files(prior_policy)
        helper_raw,_=read_owned(ROOT/census.PRIOR_STAGES[-1]/'prepare_clone_reclaim.py')
        if sha(helper_raw)!='f831f00f75d4b54dce3ba493a4a078b23969222507576505052291ed0147f7c5':
            raise RuntimeError('prior_receipt_helper_changed')
        helper=types.ModuleType('authenticated_cpu0_prior_receipt_helper')
        helper.__file__=str(ROOT/census.PRIOR_STAGES[-1]/'prepare_clone_reclaim.py')
        exec(compile(helper_raw,helper.__file__,'exec'),helper.__dict__)
        prior=census.prior_writers(prior_policy,helper,protected)
        controls=census.proc_controls()
        stop_protected=set(protected)
        if old['State']['Running'] is True:
            # Explicit sole OLD Qdrant child exception, after its complete
            # initial identity fence. Parent/wrapper/other sources stay protected.
            stop_protected.remove(initial['qdrant']['pid'])
        old,old_receipt_sha=clean_old(lifecycle,docker,lock_fd,stop_protected,old,
                                     lambda:setup_admission.old_admission(lifecycle,guards,docker))
        staged_files={**source_files,'cpu0-source-freeze.json':raw_source,
                      'helper-config.json':source_files['prepared-helper-policy-cpu0.json'],
                      'controller-config.json':derivative}
        staged=stage_absent(ADMISSION,staged_files)
        modules=load_staged_modules(ADMISSION,raw_source,source_sha,source_files)
        actual_lifecycle=modules['lifecycle_cpu0'];control=modules['controller_cpu0'];daemon=modules['daemon_cpu0']
        original_config_image=old['Config']['Image'];docker=Docker(original_config_image)
        image=json.loads(docker('inspect',IMAGE))[0]
        resolved=json.loads(docker('inspect',original_config_image))[0]
        creation=create_owned_clone(old,actual_lifecycle,docker,engine,lock_fd,image,resolved,
                                     lambda:setup_admission.host(guards),
                                     lambda:setup_admission.host(guards))
        started=time.monotonic()
        while True:
            try:
                shape=setup_admission.collection_shape();break
            except RuntimeError as error:
                if str(error) not in ('setup_shape_unavailable','setup_shape_changed') or time.monotonic()-started>=90:raise
                time.sleep(.2)
        config=json.loads(derivative)
        _,spec,policy=daemon.load_config(str(ADMISSION/'helper-config.json'),config['helperPolicySha256'],config['helperCodeSha256'])
        control.CPU_POLICY=config['cpuIsolation']
        actual_lifecycle.require_lock(lock_fd)
        birth=control.birth_admission(config,spec,policy)
        handoff_raw=first_handoff(actual_lifecycle,docker)
        handoff_sha=write_root_absent(ROOT/'cpu0-lifecycle-handoff-v1.json',handoff_raw)
        actual_lifecycle.read_handoff(docker,handoff_sha)
        return {'schema':'cpu0-external-setup-result.v6','variant':'cpu0-owned-lifecycle.v1',
                'sourceFreezeSha256':source_sha,'derivativePolicySha256':derivative_sha,
                'oldCleanReceiptSha256':old_receipt_sha,'creation':creation,
                'initialAdmission':birth,'collectionShape':shape,
                'handoff':{**json.loads(handoff_raw),'sha256':handoff_sha},
                'priorWriterEvidence':prior,'controlCensus':controls,
                'admissionFilesCreated':staged['filesCreated'],
                'normalStartupStorageWritesPossible':True,'storeDeleted':False,
                'modelsRead':0,'queries':0}
    except BaseException as error:
        primary=error
        # A later create/start/admission error never erases a durable stop.
        error.setupDurableStopEvidence={'receiptObservedDurable':old_receipt_sha is not None,
                                       'receiptSha256':old_receipt_sha,
                                       'continuationAllowed':False}
        endpoints={}
        for name,tag in ((OLD,'old'),(NEW,'new')):
            try:
                endpoints[tag]={'observed':True,'state':lifecycle.state_snapshot(lifecycle.container(name,docker))}
            except BaseException:
                # A failed create response can leave NEW behind. Unknown is
                # never promoted to absent and no automatic removal follows.
                endpoints[tag]={'observed':False,'state':None,'absenceProven':False}
        error.setupEndpointEvidence=endpoints
        raise
    finally:
        try:os.close(lock_fd)
        except BaseException:
            if primary is None:raise RuntimeError('setup_lock_close_failed') from None
            primary.setupCleanupFailure='setup_lock_close_failed'


def create_owned_clone(old, lifecycle, docker, engine, lock_fd, image,
                       configured_image, before_create, before_start):
    """Called only after authenticated first stop and public admission staging.

    Gate callables are concrete frozen admission functions, not boolean protocol
    claims. No recovery/removal/old restart is attempted on any uncertain error.
    """
    lifecycle.require_lock(lock_fd)
    if configured_image.get('Id') != IMAGE:
        raise RuntimeError('setup_configured_image_resolution_changed')
    if old['State']['Running'] is not False:
        raise RuntimeError('setup_old_running')
    lifecycle.container(OLD, docker)
    # Require clean receipt before creation, not State.ExitCode alone.
    receipt, _, _ = lifecycle.secure_json(ROOT/'cpu0-old-clean-receipt-v1.json')
    lifecycle.require_clean_receipt(lifecycle.state_snapshot(old), receipt)
    before_create()
    body = creation_body(old, image)
    created_id = engine.request('POST', '/containers/create?name='+NEW, body)
    try:
        new = lifecycle.container(NEW, docker)
        if new['Id'] != created_id or new['State']['Running'] is not False or new['State']['Pid'] != 0 or new['State']['OOMKilled'] is not False:
            raise RuntimeError('setup_creation_identity_changed')
        parity = configured_pair(old, new)
        creation = {'schema':'cpu0-never-started-creation.v6',
                    'containerIdHash':sha(created_id.encode()),
                    'state':lifecycle.state_snapshot(new), 'configurationParity':parity,
                    'historicalCleanStopClaimed':False}
        # Revalidate old exact snapshot immediately before the reviewed start.
        if lifecycle.state_snapshot(lifecycle.container(OLD,docker)) != lifecycle.state_snapshot(old):
            raise RuntimeError('setup_old_state_changed')
        before_start()
        docker('start', NEW)
        return creation
    except BaseException as original:
        original.setupFailureEvidence = {'newCreated':True,
                                        'createdContainerIdHash':sha(created_id.encode()),
                                        'automaticRemoval':False,
                                        'automaticRecovery':False}
        raise


if __name__ == '__main__':
    print(json.dumps({'schema':'cpu0-external-setup.v6','status':'prepared-only',
                      'hostOperations':0,'executionPacketReady':False}))
