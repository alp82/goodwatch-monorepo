"""Locked metadata admission with one owned handoff update; root executes."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import json
import hashlib
import os
import stat
import fcntl
import types
import re

# No sibling import is performed until the entire installed recipe is checked.
daemon=control=cpu0_guards=None
ROOT=Path('/root/goodwatch-qdrant-cold-406-20261011')
STAGE=ROOT/'pin-control-20261012-100-cpu0-v2'
ADMISSION=ROOT/'cpu0-admission-20261012-100-v2'
VARIANT='cpu0-fixed-capacity.v2'
ROOT_UID=0
SOURCE_NAMES=frozenset(('pin_cpu0.py','runtime_cpu0.py','daemon_cpu0.py','cpu0_guards.py','controller_cpu0.py','cpu0_preflight.py','turnover_gate_cpu0.py','lifecycle_cpu0.py','test_lifecycle_cpu0.py','test_cpu0_guards.py','test_cpu0_controller.py','prepared-helper-policy-cpu0.json','prepared-control-policy-cpu0.json','CPU0.md'))
FULL_NAMES=SOURCE_NAMES|frozenset(('cpu0-source-freeze.json','helper-config.json','controller-config.json','prepare_clone_reclaim.py','consumer_cpu0.mjs','compare-contract-cpu0.mjs','audit_cpu0.mjs','transport_cpu0.mjs','compare-contract.mjs','parity.mjs'))


def _read(path,limit=262144,mode=0o600):
    if path.resolve(strict=True)!=path:raise RuntimeError('preflight_source_unproven')
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC)
    try:
        a=os.fstat(fd)
        sig=lambda x:(x.st_dev,x.st_ino,x.st_size,x.st_mtime_ns,x.st_ctime_ns,x.st_mode,x.st_uid,x.st_nlink)
        if not stat.S_ISREG(a.st_mode) or a.st_uid!=ROOT_UID or a.st_nlink!=1 or stat.S_IMODE(a.st_mode)!=mode or a.st_size>limit:raise RuntimeError('preflight_source_unproven')
        raw=bytearray()
        while len(raw)<=limit:
            part=os.read(fd,min(65536,limit+1-len(raw)))
            if not part:break
            raw.extend(part)
        if len(raw)!=a.st_size or sig(a)!=sig(os.fstat(fd)) or sig(a)!=sig(path.lstat()):raise RuntimeError('preflight_source_unproven')
        return bytes(raw),a
    finally:os.close(fd)


def _json(raw):
    def unique(pairs):
        value={}
        for key,item in pairs:
            if key in value:raise ValueError()
            value[key]=item
        return value
    try:return json.loads(raw,object_pairs_hook=unique)
    except (ValueError,UnicodeError,TypeError):raise RuntimeError('preflight_source_unproven') from None


def _sha(value):
    if type(value)is not str or re.fullmatch('[a-f0-9]{64}',value)is None:raise RuntimeError('preflight_source_unproven')
    return value


def _directory(path):
    info=path.lstat()
    if path.resolve(strict=True)!=path or not stat.S_ISDIR(info.st_mode) or info.st_uid!=ROOT_UID or stat.S_IMODE(info.st_mode)!=0o700:raise RuntimeError('preflight_source_unproven')


def _authenticate(args,kind):
    """Stdlib-only whole closure authentication; no unverified code imports."""
    if len(args)!=6 or kind not in ('consumer','rpc'):raise RuntimeError('explicit_control_arguments_required')
    directory=STAGE if kind=='consumer' else ADMISSION
    if Path(__file__).absolute()!=directory/'cpu0_preflight.py':raise RuntimeError('preflight_source_unproven')
    if args[0]!=str(directory/'helper-config.json') or args[3]!=str(directory/'controller-config.json'):raise RuntimeError('preflight_source_unproven')
    for value in (args[1],args[2],args[4],args[5]):_sha(value)
    _directory(ROOT);_directory(directory)
    freeze_raw,_=_read(directory/'cpu0-source-freeze.json');freeze=_json(freeze_raw)
    if type(freeze)is not dict or set(freeze)!={'schema','variant','preparedOnly','files'} or freeze['schema']!='search.clone-cpu0-fixed-source-freeze.v2' or freeze['variant']!=VARIANT or freeze['preparedOnly']is not True or type(freeze['files'])is not dict or set(freeze['files'])!=SOURCE_NAMES:raise RuntimeError('preflight_source_unproven')
    sources={}
    for name in sorted(SOURCE_NAMES):
        limit=65536 if name=='lifecycle_cpu0.py' else 16384 if name.startswith('prepared-') else 262144
        raw,_=_read(directory/name,limit)
        if hashlib.sha256(raw).hexdigest()!=_sha(freeze['files'][name]):raise RuntimeError('preflight_source_unproven')
        sources[name]=raw
    for alias,original,expected in (('helper-config.json','prepared-helper-policy-cpu0.json',args[1]),('controller-config.json','prepared-control-policy-cpu0.json',args[4])):
        raw,_=_read(directory/alias,16384)
        approved=sources[original]
        if kind=='rpc' and alias=='controller-config.json':
            derivative=_json(approved)
            if derivative['schema']!='clone-pin-control.cpu0-fixed.v2' or derivative['helperConfig']!=str(STAGE/'helper-config.json') or derivative['lifecycle']['modulePath']!=str(STAGE/'lifecycle_cpu0.py'):raise RuntimeError('preflight_source_unproven')
            derivative['helperConfig']=str(ADMISSION/'helper-config.json');derivative['lifecycle']['modulePath']=str(ADMISSION/'lifecycle_cpu0.py')
            approved=json.dumps(derivative,sort_keys=True,separators=(',',':')).encode()+b'\n'
        if raw!=approved or hashlib.sha256(raw).hexdigest()!=expected:raise RuntimeError('preflight_source_unproven')
    core=hashlib.sha256()
    for name in ('pin_cpu0.py','runtime_cpu0.py','daemon_cpu0.py','cpu0_guards.py'):core.update(name.encode()+b'\0'+sources[name]+b'\0')
    if core.hexdigest()!=args[2]:raise RuntimeError('preflight_source_unproven')
    context={'directory':directory,'sources':sources,'sourceFreezeSha256':hashlib.sha256(freeze_raw).hexdigest()}
    if kind=='rpc':
        if globals().get('_AUTHENTICATED_SOURCE_SHA256')!=freeze['files']['cpu0_preflight.py']:raise RuntimeError('preflight_loader_unproven')
        if set(os.listdir(directory))!=SOURCE_NAMES|{'cpu0-source-freeze.json','helper-config.json','controller-config.json'}:raise RuntimeError('preflight_source_unproven')
    else:
        _require_null_stdin();_require_consumer_argv(args)
        if set(os.listdir(directory))!=FULL_NAMES|{'cpu0-external-manifest.json','node','node-provenance.json'}:raise RuntimeError('preflight_source_unproven')
        full_raw,_=_read(directory/'cpu0-external-manifest.json');full=_json(full_raw)
        if type(full)is not dict or set(full)!={'schema','variant','sourceFreezeSha256','files'} or full['schema']!='cpu0-full-public-packet.v7' or full['variant']!=VARIANT or full['sourceFreezeSha256']!=context['sourceFreezeSha256'] or type(full['files'])is not dict or set(full['files'])!=FULL_NAMES:raise RuntimeError('preflight_source_unproven')
        for name in sorted(FULL_NAMES):
            raw,_=_read(directory/name)
            if hashlib.sha256(raw).hexdigest()!=_sha(full['files'][name]):raise RuntimeError('preflight_source_unproven')
        context['externalManifestSha256']=hashlib.sha256(full_raw).hexdigest()
    return context


def _require_consumer_argv(args):
    """Authenticate this exact CLI process before any sibling source executes."""
    expected=['/usr/bin/python3','-I','-B',str(STAGE/'cpu0_preflight.py'),*args]
    path=Path('/proc')/str(os.getpid())
    with (path/'cmdline').open('rb') as stream:raw=stream.read(16385)
    if len(raw)>16384 or raw!=b'\0'.join(value.encode() for value in expected)+b'\0':raise RuntimeError('preflight_argv_unproven')
    actual=(path/'exe').stat();approved=Path('/usr/bin/python3').stat()
    if (actual.st_dev,actual.st_ino)!=(approved.st_dev,approved.st_ino):raise RuntimeError('preflight_argv_unproven')


def _require_null_stdin():
    actual=os.fstat(0);expected=Path('/dev/null').stat()
    if not stat.S_ISCHR(actual.st_mode) or actual.st_rdev!=expected.st_rdev:raise RuntimeError('preflight_stdin_unproven')


def _modules(context):
    global daemon,control,cpu0_guards
    directory=context['directory']
    for name in ('pin_cpu0','runtime_cpu0','daemon_cpu0','cpu0_guards','controller_cpu0'):
        path=directory/(name+'.py');raw=context['sources'][name+'.py'];sha=hashlib.sha256(raw).hexdigest()
        module=sys.modules.get(name)
        if module is not None:
            if Path(module.__file__).absolute()!=path or getattr(module,'_AUTHENTICATED_SOURCE_SHA256',None)!=sha:raise RuntimeError('preflight_source_unproven')
        else:
            module=types.ModuleType(name);module.__file__=str(path);sys.modules[name]=module
            try:exec(compile(raw,str(path),'exec'),module.__dict__);module._AUTHENTICATED_SOURCE_SHA256=sha
            except BaseException:sys.modules.pop(name,None);raise
    daemon=sys.modules['daemon_cpu0'];control=sys.modules['controller_cpu0'];cpu0_guards=sys.modules['cpu0_guards']


def _node(context,parent):
    raw,_=_read(STAGE/'node-provenance.json',65536);receipt=_json(raw)
    keys={'schema','nodeSha256','nodeBytes','sourceReceiptSha256','targetDevice','targetInode','targetMode','sourceStable','sourceHostWrites','cloneFilesCreated','targetMtimeNs','targetCtimeNs'}
    if type(receipt)is not dict or set(receipt)!=keys or receipt['schema']!='clone-node-copy-receipt.v2' or receipt['nodeSha256']!='7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c' or type(receipt['nodeBytes'])is not int or receipt['nodeBytes']!=126595440 or receipt['sourceStable']is not True or type(receipt['sourceHostWrites'])is not int or receipt['sourceHostWrites']!=0 or type(receipt['cloneFilesCreated'])is not int or receipt['cloneFilesCreated']!=2 or type(receipt['targetMode'])is not int or receipt['targetMode']!=0o700:raise RuntimeError('node_provenance_changed')
    if receipt['sourceReceiptSha256']!='db019f01b0b25d9d85062d65fecbe5d79a35c9bc7add1d972301b2cbb95973ef':raise RuntimeError('node_provenance_changed')
    path=STAGE/'node';info=path.lstat()
    if path.resolve(strict=True)!=path or not stat.S_ISREG(info.st_mode) or info.st_uid!=0 or info.st_nlink!=1 or stat.S_IMODE(info.st_mode)!=0o700 or info.st_size!=126595440:raise RuntimeError('consumer_executable_changed')
    for key,value in (('targetDevice',info.st_dev),('targetInode',info.st_ino),('targetMtimeNs',info.st_mtime_ns),('targetCtimeNs',info.st_ctime_ns)):
        if type(receipt[key])is not int or receipt[key]!=value:raise RuntimeError('consumer_executable_changed')
    actual=Path('/proc')/str(parent['pid'])/'exe';exe=actual.stat()
    if (exe.st_dev,exe.st_ino)!=(info.st_dev,info.st_ino) or os.readlink(actual)!=str(path):raise RuntimeError('consumer_executable_changed')
    result={'device':info.st_dev,'inode':info.st_ino,'size':info.st_size,'mtimeNs':str(info.st_mtime_ns),'ctimeNs':str(info.st_ctime_ns)}
    if any(type(result[key])is not int or not 0<=result[key]<=2**53-1 for key in ('device','inode','size')):raise RuntimeError('consumer_executable_changed')
    return result,hashlib.sha256(raw).hexdigest()


def _enrol_consumer(context,lifecycle,spec,args,predecessor,lock_fd):
    lifecycle.require_interpreter();lifecycle.require_lock(lock_fd)
    source=control.inspect_source(spec);target=lifecycle.attest(spec.container,control.runtime.docker)
    if target['qdrant']['pid']!=source.pid or target['qdrant']['startTicks']!=source.identity[3]:raise RuntimeError('lifecycle_process_changed')
    own=lifecycle.resource_process(os.getpid(),source.cgroup_relative)
    consumer=lifecycle.resource_process(own['identity']['parentPid'],source.cgroup_relative)
    parent=lifecycle.resource_process(consumer['identity']['parentPid'],source.cgroup_relative)
    node_identity,node_sha=_node(context,consumer['identity'])
    argv=lifecycle.bounded(Path('/proc')/str(consumer['identity']['pid'])/'cmdline',16384)
    if not argv.endswith(b'\0'):raise RuntimeError('consumer_argv_invalid')
    decoded=[value.decode('utf-8') for value in argv[:-1].split(b'\0')]
    expected=[str(STAGE/'node'),str(STAGE/'consumer_cpu0.mjs'),'--execute-reviewed-fixed-capacity-v2','--handoff-sha256',args[5],'--cpu0-source-freeze-sha256',context['sourceFreezeSha256'],'--external-manifest-sha256',context['externalManifestSha256']]
    raised=decoded==expected+['--raise-own-nofile']
    if decoded!=expected and not raised:raise RuntimeError('consumer_argv_invalid')
    for role in (own,consumer,parent):
        fresh=lifecycle.resource_process(role['identity']['pid'],source.cgroup_relative)
        if fresh['identity']!=role['identity']:raise RuntimeError('overhead_identity_changed')
    if lifecycle.attest(spec.container,control.runtime.docker)!=target:raise RuntimeError('lifecycle_process_changed')
    lock=os.fstat(lock_fd)
    record={'schema':'cpu0-consumer-enrolment.v2','variant':VARIANT,'sourceFreezeSha256':context['sourceFreezeSha256'],'externalManifestSha256':context['externalManifestSha256'],'helperCodeSha256':args[2],'helperPolicySha256':args[1],'controllerPolicySha256':args[4],'adoptionIntentSha256':predecessor['adoptionIntentSha256'],'consumerPredecessorSha256':args[5],'source':target,'consumer':consumer,'transportParent':parent,'preflight':own,'consumerArgvHash':hashlib.sha256(lifecycle.canonical(decoded)).hexdigest(),'raiseOwnNofile':raised,'nodeProvenanceSha256':node_sha,'nodeIdentity':node_identity,'sharedControlIdentity':{'device':lock.st_dev,'inode':lock.st_ino},'registeredBeforeEntrySample':True,'productionAcceptance':False}
    raw=lifecycle.canonical(record)+b'\n';path=ROOT/'cpu0-consumer-enrolment-v2.json'
    fd=None;issued=False;primary=None
    try:
        fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_CLOEXEC,0o600);issued=True
        view=memoryview(raw)
        while view:
            count=os.write(fd,view)
            if count<=0:raise RuntimeError('consumer_enrolment_write_failed')
            view=view[count:]
        os.fsync(fd)
        os.close(fd);fd=None
        directory=os.open(ROOT,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC)
        try:os.fsync(directory)
        finally:os.close(directory)
        actual,_=_read(path,65536)
        if actual!=raw:raise RuntimeError('consumer_enrolment_write_failed')
    except BaseException as error:
        primary=error
        error.consumerEnrolmentFailureEvidence={'schema':'cpu0-consumer-enrolment-failure.v2','publicationState':'issued-unknown' if issued else 'not-issued','expectedReceiptSha256':hashlib.sha256(raw).hexdigest(),'consumerEnrolment':record,'cleanupAddressableByFixedReceipt':True,'continuationAllowed':False}
        raise
    finally:
        if fd is not None:
            try:os.close(fd)
            except BaseException:
                if primary is not None:primary.consumerEnrolmentCleanupFailure='consumer_enrolment_close_failed'
                else:raise
    return record,hashlib.sha256(raw).hexdigest()


def preflight(helper_path, helper_policy_sha, helper_code_sha, control_path, control_policy_sha, handoff_sha):
    context=_authenticate((helper_path,helper_policy_sha,helper_code_sha,control_path,control_policy_sha,handoff_sha),'rpc');_modules(context)
    return _preflight(helper_path,helper_policy_sha,helper_code_sha,control_path,control_policy_sha,handoff_sha)


def _preflight(helper_path, helper_policy_sha, helper_code_sha, control_path, control_policy_sha, handoff_sha,*,consumer_context=None):
    raw=Path(control_path).read_bytes()
    if len(raw)>16384 or hashlib.sha256(raw).hexdigest()!=control_policy_sha:raise RuntimeError('control_freeze_changed')
    config=json.loads(raw)
    if config.get('schema')!='clone-pin-control.cpu0-fixed.v2' or config.get('helperCodeSha256')!=helper_code_sha or config.get('helperPolicySha256')!=helper_policy_sha:raise RuntimeError('control_freeze_changed')
    cpu0_guards.validate_policy(config['cpuIsolation'])
    _,spec,policy=daemon.load_config(helper_path,helper_policy_sha,helper_code_sha)
    control.CPU_POLICY=config['cpuIsolation']
    lock_fd=None;primary=None;enrolment=None
    try:
        if control.ROOT.resolve()!=control.ROOT:raise RuntimeError('owned_root_changed')
        lock_fd=os.open(control.ROOT/'control.lock',os.O_RDWR|os.O_NOFOLLOW)
        info=os.fstat(lock_fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid!=os.geteuid() or stat.S_IMODE(info.st_mode)!=0o600 or info.st_nlink!=1:raise RuntimeError('invalid_control_lock')
        fcntl.flock(lock_fd,fcntl.LOCK_EX|fcntl.LOCK_NB);os.set_inheritable(lock_fd,False)
        lifecycle=control.load_lifecycle(config);lifecycle.require_lock(lock_fd)
        predecessor=lifecycle.read_handoff(control.runtime.docker,handoff_sha)
        if consumer_context is not None:
            enrolment=_enrol_consumer(consumer_context,lifecycle,spec,(helper_path,helper_policy_sha,helper_code_sha,control_path,control_policy_sha,handoff_sha),predecessor,lock_fd)
        admission=control.birth_admission(config,spec,policy)
        if enrolment is not None:
            if admission['target']!=enrolment[0]['source']:raise RuntimeError('lifecycle_process_changed')
            source=control.inspect_source(spec)
            for role in ('consumer','transportParent','preflight'):
                recorded=enrolment[0][role]['identity']
                if lifecycle.resource_process(recorded['pid'],source.cgroup_relative)['identity']!=recorded:raise RuntimeError('overhead_identity_changed')
            _require_consumer_argv((helper_path,helper_policy_sha,helper_code_sha,control_path,control_policy_sha,handoff_sha))
            argv=lifecycle.bounded(Path('/proc')/str(enrolment[0]['consumer']['identity']['pid'])/'cmdline',16384)
            if not argv.endswith(b'\0') or hashlib.sha256(lifecycle.canonical([part.decode('utf-8') for part in argv[:-1].split(b'\0')])).hexdigest()!=enrolment[0]['consumerArgvHash']:raise RuntimeError('consumer_argv_invalid')
            node,node_sha=_node(consumer_context,enrolment[0]['consumer']['identity'])
            if node!=enrolment[0]['nodeIdentity'] or node_sha!=enrolment[0]['nodeProvenanceSha256']:raise RuntimeError('consumer_executable_changed')
        handoff=lifecycle.commit_handoff(control.runtime.docker,handoff_sha,'preflight')
        result={'schema':'search.clone-cpu0-preflight.v2','variant':'cpu0-fixed-capacity.v2','birthAdmission':admission,'handoff':handoff,
                'sourceIdentity':admission['sourceIdentity'],'queries':0,'resourceWrites':0,'handoffWrites':1,'modelsRead':0}
        if enrolment is not None:result.update(consumerEnrolment=enrolment[0],consumerEnrolmentSha256=enrolment[1])
        return result
    except BaseException as error:
        primary=error
        if enrolment is not None:error.consumerEnrolmentFailureEvidence={'schema':'cpu0-consumer-enrolment-failure.v2','publicationState':'published-verified','expectedReceiptSha256':enrolment[1],'consumerEnrolment':enrolment[0],'cleanupAddressableByFixedReceipt':True,'continuationAllowed':False}
        raise
    finally:
        if lock_fd is not None:
            try:os.close(lock_fd)
            except BaseException as cleanup:
                if primary is None:
                    cleanup.lifecycleCleanupFailure='lifecycle_lock_close_failed'
                    if enrolment is not None:cleanup.consumerEnrolmentFailureEvidence={'schema':'cpu0-consumer-enrolment-failure.v2','publicationState':'published-verified','expectedReceiptSha256':enrolment[1],'consumerEnrolment':enrolment[0],'cleanupAddressableByFixedReceipt':True,'continuationAllowed':False}
                    raise
                primary.lifecycleCleanupFailure='lifecycle_lock_close_failed'


def main(argv=None):
    args=sys.argv[1:] if argv is None else argv
    try:
        if len(args)!=6:raise RuntimeError('explicit_control_arguments_required')
        context=_authenticate(args,'consumer');_modules(context)
        print(json.dumps(_preflight(*args,consumer_context=context),sort_keys=True));return 0
    except BaseException as error:
        reason=str(error) if str(error) in ('preflight_source_unproven','preflight_loader_unproven','preflight_stdin_unproven','preflight_argv_unproven','explicit_control_arguments_required') else control.safe_control_reason(error) if control else 'guard_or_runtime_failure'
        print(json.dumps({'schema':'search.clone-cpu0-preflight.v2','stage':'failed','reason':reason,'consumerEnrolmentFailureEvidence':getattr(error,'consumerEnrolmentFailureEvidence',None),'consumerEnrolmentCleanupFailure':getattr(error,'consumerEnrolmentCleanupFailure',None),'lifecycleFailureEvidence':getattr(error,'lifecycleFailureEvidence',None),'lifecycleCleanupFailure':getattr(error,'lifecycleCleanupFailure',None),'lifecycleDockerCleanupEvidence':getattr(error,'lifecycleDockerCleanupEvidence',None),**(control.admission_failure(error) if control else {}),**(cpu0_guards.failure_evidence(error) if cpu0_guards else {}),'queries':0,'resourceWrites':0}));return 1


if __name__=='__main__':raise SystemExit(main())
