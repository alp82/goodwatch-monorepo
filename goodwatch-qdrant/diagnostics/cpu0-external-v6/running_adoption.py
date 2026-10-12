"""Distinct one-shot running-clone adoption; no default host execution.

Local operation, not yet wired into a reviewed execution closure. Historical
observations grant no current authority. No default or command-line execution.
"""
import os
from pathlib import Path

from packet import (canonical, closed_json, directory, metadata, read_owned, sha,
                    hash_value, verify_source_v2, load_first_lifecycle_v2,
                    stage_absent_once)
import running_adoption_proofs as proofs
import setup
import census
import census_v2
import stager
import types

MODE = 'adopt-running-owned-clone.cpu0-fixed.v2'
ROOT = Path('/root/goodwatch-qdrant-cold-406-20261011')
ADMISSION = ROOT/'cpu0-admission-20261012-100-v2'
STAGE = ROOT/'pin-control-20261012-100-cpu0-v2'
LEGACY_ADMISSION = ROOT/'cpu0-admission-20261012-100-v1'
HANDOFF = ROOT/'cpu0-lifecycle-handoff-v2.json'
INTENT = ROOT/'cpu0-running-adoption-intent-v2.json'
SUCCESS = ROOT/'cpu0-running-adoption-success-v2.json'
ATTEMPT = ROOT/'cpu0-never-started-recovery-attempt-v1.json'
LEGACY_SOURCE_SHA = '00e523226e42ce10bca605f403c4e314f2e49fc55273b683a08e926c4a445108'

# Derived from the exact previously reviewed execution packet, SHA
# baef942d1cf0b1ffb4c71db15306877a6d6baa47cf8e7e2be08afe208e5c3e3e.
# These are immutable old observations, never a successor recipe.
LEGACY_FILES = {
    'CPU0.md': '5944095933163cac2906f47e414a0f7325460f6e7cd16a1fe6796d0c0f6d8d2c',
    'controller-config.json': 'c581c9d75c70b655409304d69d661aae8a064d6852338b198d23cd6d054120e6',
    'controller_cpu0.py': '4b375f64b6a76b192420ed4fd8f1370227a550079af4bc6c415be5f8e2bc09b2',
    'cpu0-source-freeze.json': LEGACY_SOURCE_SHA,
    'cpu0_guards.py': '4b3b6b13790a83b414914f546e5a0ee136504bcb29a08f3fb5dcf58af402a565',
    'cpu0_preflight.py': '9da066ad265b19907478d9aa46757b21e4d1d1fd2d132e808e36bee8736d7c3a',
    'daemon_cpu0.py': 'a1fc2f17782f5000fb4552567f01a49c5d0459b0337ecfd4d964c6147467286e',
    'helper-config.json': '88289117a20e93e143f655d734a6690d7c5e37a7bbda130a0419a1660ab39b98',
    'lifecycle_cpu0.py': '6208ee00361a7481b22198797060c0729094dd782c94f383170d7afe1dfc9611',
    'pin_cpu0.py': 'e2ccfba845f7ad8295630b94a83ca18f11b7d97fcd4414352d36b5b91b3eae80',
    'prepared-control-policy-cpu0.json': '4e0621c921989180e9134566cae5a4fc47286a3c15ad01ff167c07af22b760da',
    'prepared-helper-policy-cpu0.json': '88289117a20e93e143f655d734a6690d7c5e37a7bbda130a0419a1660ab39b98',
    'runtime_cpu0.py': 'a270f55e5c85f097329cec66c090a9fa796258bcf857886f6c84c7c3c80af5a3',
    'test_cpu0_controller.py': '524b9a70b8c5c54337b1f9d2120e9245b25785fa66ad58245cb157619a8d07ee',
    'test_cpu0_guards.py': 'efeac799c6a618874e89f2b3472b5fbbd98db392b38da96c3e875b67397a77d8',
    'test_lifecycle_cpu0.py': '8dfc772b38540df4a3ed16a9732fbd468ec4c05126c20a1f622a142127e835ff',
    'turnover_gate_cpu0.py': '3a610ffc55a22b30e92d1c57dddf98c30a6f3c39289ac9a6cecc110dfab6bd04',
}


class InspectOnly:
    """Closed fixed-container inspection interface, with no mutation dispatch."""
    def __call__(self, *arguments):
        if arguments not in (('inspect', setup.OLD), ('inspect', setup.NEW)):
            raise RuntimeError('running_adoption_inspect_only')
        return setup.Docker()(*arguments)


def require_absent_scope():
    paths=(ROOT/'cpu0-lifecycle-handoff-v1.json', ROOT/'pin-control-20261012-100-cpu0-v1',
           ROOT/'cpu0-consumer-registration-v1.json', ROOT/'cpu0-never-started-recovery-success-v1.json',
           ADMISSION, STAGE, HANDOFF, INTENT, SUCCESS,
           ROOT/'cpu0-consumer-enrolment-v2.json', ROOT/'cpu0-consumer-registration-v2.json')
    if any(os.path.lexists(path) for path in paths):
        raise RuntimeError('running_adoption_scope_changed')


def legacy_files():
    directory(LEGACY_ADMISSION)
    before=LEGACY_ADMISSION.lstat()
    if len(LEGACY_FILES)!=17 or set(path.name for path in LEGACY_ADMISSION.iterdir())!=set(LEGACY_FILES):
        raise RuntimeError('running_adoption_legacy_changed')
    identities={}
    for name,expected in LEGACY_FILES.items():
        raw,identity=observed_read(LEGACY_ADMISSION/name)
        if sha(raw)!=expected:raise RuntimeError('running_adoption_legacy_changed')
        identities[name]=identity
    after=LEGACY_ADMISSION.lstat()
    if signature(before)!=signature(after) or set(path.name for path in LEGACY_ADMISSION.iterdir())!=set(LEGACY_FILES):
        raise RuntimeError('running_adoption_legacy_changed')
    return {'directoryIdentity':signature(after),'files':identities}


def signature(info):
    return (*metadata(info),info.st_ctime_ns)


def observed_read(path, *, limit=262144):
    before=path.lstat()
    raw,identity=read_owned(path,limit=limit)
    after=path.lstat()
    if identity!=(before.st_dev,before.st_ino) or signature(before)!=signature(after):
        raise RuntimeError('running_adoption_observation_changed')
    return raw,signature(after)


def spent_recovery_attempt():
    raw,identity=observed_read(ATTEMPT,limit=65536)
    if sha(raw)!=proofs.ATTEMPT_SHA:raise RuntimeError('running_adoption_attempt_changed')
    try:
        value=closed_json(raw)
        if (value['schema']!='cpu0-never-started-recovery-attempt.v1'
                or value['mode']!='recover-created-never-started.v1'
                or value['sourceFreezeSha256']!=LEGACY_SOURCE_SHA
                or value['startIssued'] is not False):
            raise ValueError()
    except (ValueError,KeyError,TypeError,UnicodeError):
        raise RuntimeError('running_adoption_attempt_changed') from None
    return identity


def derivative_policy(original_raw, expected_sha):
    if sha(original_raw)!=expected_sha:raise RuntimeError('admission_derivative_source_changed')
    try:
        value=closed_json(original_raw)
        if (value['schema']!='clone-pin-control.cpu0-fixed.v2'
                or value['helperConfig']!=str(STAGE/'helper-config.json')
                or value['lifecycle']['modulePath']!=str(STAGE/'lifecycle_cpu0.py')
                or value['lifecycle']['handoffPath']!=str(HANDOFF)):
            raise ValueError()
    except (ValueError,KeyError,TypeError,UnicodeError):
        raise RuntimeError('admission_derivative_source_changed') from None
    value['helperConfig']=str(ADMISSION/'helper-config.json')
    value['lifecycle']['modulePath']=str(ADMISSION/'lifecycle_cpu0.py')
    return canonical(value)+b'\n'


def publish(path, value, lifecycle, lock_fd):
    """Publish only the three successor records; preserve every partial fact."""
    kinds={INTENT:'intent',HANDOFF:'handoff',SUCCESS:'success'}
    if path not in kinds or path.parent!=ROOT or type(value)is not dict:
        raise RuntimeError('running_adoption_publication_scope')
    lifecycle.require_lock(lock_fd)
    directory(ROOT)
    raw=canonical(value)+b'\n'
    if len(raw)>(32768 if path==HANDOFF else 65536):
        raise RuntimeError('running_adoption_publication_bound')
    state={'schema':'cpu0-running-adoption-publication.v2','kind':kinds[path],
           'fileCreated':False,'writeCompleted':False,'fileFsyncCompleted':False,
           'directoryFsyncCompleted':False,'readbackVerified':False,
           'expectedSha256':sha(raw),'observedSha256':None,'continuationAllowed':False}
    fd=None
    failure=None
    created_identity=None
    try:
        fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_CLOEXEC,0o600)
        state['fileCreated']=True
        info=os.fstat(fd)
        created_identity=(info.st_dev,info.st_ino)
        with os.fdopen(fd,'wb') as output:
            fd=None
            written=output.write(raw)
            if written!=len(raw):raise RuntimeError('running_adoption_publication_failed')
            output.flush();state['writeCompleted']=True
            os.fsync(output.fileno());state['fileFsyncCompleted']=True
        dfd=os.open(ROOT,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC)
        try:
            os.fsync(dfd);state['directoryFsyncCompleted']=True
        finally:os.close(dfd)
        observed,identity=observed_read(path,limit=32768 if path==HANDOFF else 65536)
        state['observedSha256']=sha(observed)
        if observed!=raw or identity[:2]!=created_identity:
            raise RuntimeError('running_adoption_publication_failed')
        state['readbackVerified']=True
        lifecycle.require_lock(lock_fd)
        return sha(raw)
    except BaseException as error:
        failure=error
        state['fileRetained']=os.path.lexists(path)
        error.runningAdoptionPublicationEvidence=state.copy()
        raise
    finally:
        if fd is not None:
            try:os.close(fd)
            except BaseException as error:
                state['descriptorCloseFailed']=True
                if failure is not None:
                    failure.runningAdoptionPublicationEvidence=state.copy()
                else:
                    error.runningAdoptionPublicationEvidence=state.copy()
                    raise


def pair_observation(lifecycle,docker,historical):
    """Fresh physical attest first; predecessor values can only refuse drift."""
    pair=lifecycle.pair_snapshot(docker)
    old=pair['oldStopped'];new=pair['newRunning']
    if (pair['variant']!='cpu0-fixed-capacity.v2'
            or old!=historical['oldState'] or new['state']!=historical['newState']
            or pair['oldCleanReceiptSha256']!=proofs.OLD_RECEIPT_SHA
            or new['wrapper']['pid']!=historical['wrapperPid']
            or new['qdrant']['pid']!=historical['qdrantPid']
            or new['qdrant']['startTicks']!=historical['qdrantStartTicks']):
        raise RuntimeError('running_adoption_target_changed')
    raw,identity=observed_read(ROOT/'cpu0-old-clean-receipt-v1.json',limit=32768)
    if sha(raw)!=proofs.OLD_RECEIPT_SHA:
        raise RuntimeError('running_adoption_old_receipt_changed')
    return pair,identity


def prior_census(policy,expected_sha,target):
    if sha(canonical(policy))!=expected_sha:
        raise RuntimeError('prior_stage_policy_changed')
    census.immutable_prior_files(policy)
    raw,_=read_owned(ROOT/census.PRIOR_STAGES[-1]/'prepare_clone_reclaim.py')
    if sha(raw)!=stager.RECLAIM_SHA:raise RuntimeError('prior_receipt_helper_changed')
    helper=types.ModuleType('authenticated_cpu0_running_adoption_prior_helper')
    helper.__file__=str(ROOT/census.PRIOR_STAGES[-1]/'prepare_clone_reclaim.py')
    exec(compile(raw,helper.__file__,'exec'),helper.__dict__)
    protected={os.getpid(),os.getppid(),target['wrapper']['pid'],
               target['wrapper']['parentPid'],target['qdrant']['pid'],
               target['qdrant']['parentPid']}
    return {'writers':census.prior_writers(policy,helper,protected),
            'controls':census_v2.proc_controls()}


def run(raw_source,source_sha,source_files,derivative_sha,prior_policy,
        prior_sha,failure_raw,memory_raw,external_closure_sha):
    """One distinct running adoption; no source/container action and no retry.

    The whole caller closure authenticates before this function is dispatched.
    Source staging is spent once, followed by an identity-only intent before the
    sole admission sample. Historical failures remain failures throughout.
    """
    verify_source_v2(raw_source,source_sha,source_files)
    for value in (derivative_sha,prior_sha,external_closure_sha):hash_value(value)
    if globals().get('_AUTHENTICATED_EXTERNAL_CLOSURE_SHA256')!=external_closure_sha:
        raise RuntimeError('running_adoption_closure_unproven')
    historical=proofs.observations(failure_raw,memory_raw)
    derivative=derivative_policy(source_files['prepared-control-policy-cpu0.json'],
                                  sha(source_files['prepared-control-policy-cpu0.json']))
    if sha(derivative)!=derivative_sha:
        raise RuntimeError('admission_derivative_changed')
    if sha(canonical(prior_policy))!=prior_sha:
        raise RuntimeError('prior_stage_policy_changed')
    os.environ.clear();os.environ.update({'PATH':'/usr/bin:/bin','LANG':'C.UTF-8',
                                         'DOCKER_HOST':'unix:///var/run/docker.sock'})
    first=load_first_lifecycle_v2(raw_source,source_sha,source_files)
    first.require_interpreter()
    lock_fd=setup.acquire_control(first)
    primary=None;stage_evidence=None;intent_sha=None;handoff_sha=None;result=None;success_sha=None
    try:
        require_absent_scope()
        legacy=legacy_files();attempt=spent_recovery_attempt()
        docker=InspectOnly()
        original_pair,old_receipt_identity=pair_observation(first,docker,historical)
        prior_before=prior_census(prior_policy,prior_sha,original_pair['newRunning'])
        stage_evidence=stage_absent_once(ADMISSION,{**source_files,
            'cpu0-source-freeze.json':raw_source,
            'helper-config.json':source_files['prepared-helper-policy-cpu0.json'],
            'controller-config.json':derivative})
        # Import the fixed v2 context only after its entire external closure has
        # executed; installed aliases authenticate before any backend exec.
        import executor_v2
        import base64
        arguments={'sourceFreezeSha256':source_sha,
                   'sourceFreeze':base64.b64encode(raw_source).decode('ascii'),
                   'sourceFiles':{name:base64.b64encode(raw).decode('ascii') for name,raw in source_files.items()},
                   'derivativePolicySha256':derivative_sha}
        modules,config,spec,policy,_,_,_=executor_v2.context(arguments,ADMISSION)
        lifecycle=modules['lifecycle_cpu0'];control=modules['controller_cpu0']
        lifecycle.require_lock(lock_fd)
        entry=control.entry_identity(config,spec,policy)
        if entry['target']!=original_pair['newRunning']:
            raise RuntimeError('running_adoption_target_changed')
        intent={'schema':'cpu0-running-adoption-intent.v2','mode':MODE,
                'variant':'cpu0-fixed-capacity.v2','sourceFreezeSha256':source_sha,
                'externalClosureSha256':external_closure_sha,
                'derivativePolicySha256':derivative_sha,
                'failedRecoverySha256':proofs.FAILURE_SHA,'memoryObservationSha256':proofs.MEMORY_SHA,
                'consumedRecoveryAttemptSha256':proofs.ATTEMPT_SHA,
                'oldCleanReceiptSha256':proofs.OLD_RECEIPT_SHA,
                'entryIdentity':entry,'admissionSampleTaken':False,
                'sourceActions':0,'containerActions':0,'queries':0,'modelsRead':0,
                'predecessorCleanupUnknownRetained':True,'continuationAllowed':False}
        intent_sha=publish(INTENT,intent,lifecycle,lock_fd)
        intent_raw,intent_identity=observed_read(INTENT,limit=65536)
        if intent_raw!=canonical(intent)+b'\n':
            raise RuntimeError('running_adoption_identity_changed')
        if control.entry_identity(config,spec,policy)!=entry:
            raise RuntimeError('running_adoption_identity_changed')
        # There is exactly one running-entry admission call and no exception
        # retry. Refusal leaves the intent and admission scope consumed.
        birth=control.running_entry_admission(config,spec,policy)
        if birth['target']!=entry['target'] or control.entry_identity(config,spec,policy)!=entry:
            raise RuntimeError('running_adoption_identity_changed')
        current_pair,current_receipt_identity=pair_observation(lifecycle,docker,historical)
        after=prior_census(prior_policy,prior_sha,current_pair['newRunning'])
        if (current_pair!=original_pair or current_receipt_identity!=old_receipt_identity
                or legacy_files()!=legacy or spent_recovery_attempt()!=attempt
                or after['writers']!=prior_before['writers']):
            raise RuntimeError('running_adoption_scope_changed')
        if observed_read(INTENT,limit=65536)!=(intent_raw,intent_identity):
            raise RuntimeError('running_adoption_identity_changed')
        executor_v2.installed_recipe(arguments,ADMISSION)
        lifecycle.require_lock(lock_fd)
        record={'schema':'clone-lifecycle-handoff.cpu0.v2','owner':'adoption',
                'previousSha256':None,'snapshot':current_pair,'adoptionIntentSha256':intent_sha}
        lifecycle.validate_handoff_record(record)
        handoff_sha=publish(HANDOFF,record,lifecycle,lock_fd)
        lifecycle.read_handoff(docker,handoff_sha)
        result={'schema':'cpu0-running-adoption-result.v2','variant':'cpu0-fixed-capacity.v2',
                'mode':MODE,'sourceFreezeSha256':source_sha,'externalClosureSha256':external_closure_sha,
                'derivativePolicySha256':derivative_sha,'adoptionIntentSha256':intent_sha,
                'initialAdmission':birth,'handoff':{**record,'sha256':handoff_sha},
                'priorEvidenceBefore':prior_before,'priorEvidenceAfter':after,
                'admissionFilesCreated':stage_evidence['filesCreated'],'intentWrites':1,
                'handoffWrites':1,'successWrites':1,'sourceActions':0,'containerActions':0,
                'queries':0,'modelsRead':0,'predecessorCleanupUnknownRetained':True,
                'productionAcceptance':False}
        success_sha=publish(SUCCESS,result,lifecycle,lock_fd)
        return {**result,'successReceiptSha256':success_sha}
    except BaseException as error:
        primary=error
        error.runningAdoptionFailureEvidence={'mode':MODE,'admissionStage':stage_evidence,
            'intentSha256':intent_sha,'observedCommittedHandoffSha256':handoff_sha,
            'sourceActions':0,'containerActions':0,'queries':0,'modelsRead':0,
            'automaticRetry':False,'automaticRollback':False,
            'predecessorCleanupUnknownRetained':True,'continuationAllowed':False}
        raise
    finally:
        try:os.close(lock_fd)
        except BaseException:
            if primary is None:
                error=RuntimeError('setup_lock_close_failed')
                error.runningAdoptionCleanupFailure='setup_lock_close_failed'
                error.runningAdoptionCompletedPublication={'result':result,
                    'successReceiptSha256':success_sha,'observedCommittedHandoffSha256':handoff_sha,
                    'continuationAllowed':False,'predecessorCleanupUnknownRetained':True}
                raise error from None
            primary.runningAdoptionCleanupFailure='setup_lock_close_failed'
