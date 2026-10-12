"""Concrete dispatch inside the authenticated SSH stdin closure.

Every operation uses fixed paths/targets and explicit source/handoff hashes.
Failure projections retain completed stop and observed endpoints independently.
"""
import base64
import json
import os
import sys
import types
from pathlib import Path

sys.dont_write_bytecode=True
from packet import SOURCE_NAMES,canonical,hash_value,read_owned,sha,verify_source,load_staged_modules,load_first_lifecycle
import setup
import census
import stager
import registration
import producer
from reason_codes import REASONS

OPERATIONS=frozenset(('setup','preflight','stage','turnover','outer-admit','register-consumer','cleanup','producer-stream','producer-confirm','producer-cleanup'))


def backend_packet(arguments):
    required={'sourceFreezeSha256','sourceFreeze','sourceFiles'}
    if not required.issubset(arguments) or not isinstance(arguments['sourceFiles'],dict) or set(arguments['sourceFiles'])!=SOURCE_NAMES:raise RuntimeError('executor_source_packet_invalid')
    files={}
    for name,encoded in arguments['sourceFiles'].items():
        if not isinstance(encoded,str) or len(encoded)>350000:raise RuntimeError('executor_source_packet_invalid')
        files[name]=base64.b64decode(encoded,validate=True)
    raw=base64.b64decode(arguments['sourceFreeze'],validate=True)
    verify_source(raw,arguments['sourceFreezeSha256'],files)
    return raw,arguments['sourceFreezeSha256'],files


def staged_modules(arguments,path):
    raw,source_sha,files=backend_packet(arguments)
    for name,content in {**files,'cpu0-source-freeze.json':raw}.items():
        observed,_=read_owned(path/name)
        if observed!=content:raise RuntimeError('executor_staged_source_changed')
    return load_staged_modules(path,raw,source_sha,files),raw,source_sha,files


def context(arguments,path):
    modules,raw,source_sha,files=staged_modules(arguments,path)
    control_raw,_=read_owned(path/'controller-config.json');helper_raw,_=read_owned(path/'helper-config.json')
    if path==setup.ADMISSION:
        expected=setup.derivative_admission_policy(files['prepared-control-policy-cpu0.json'],sha(files['prepared-control-policy-cpu0.json']))
        if sha(expected)!=arguments['derivativePolicySha256']:raise RuntimeError('executor_derivative_changed')
    else:expected=files['prepared-control-policy-cpu0.json']
    if control_raw!=expected or helper_raw!=files['prepared-helper-policy-cpu0.json']:raise RuntimeError('executor_policy_changed')
    config=json.loads(control_raw);daemon=modules['daemon_cpu0'];control=modules['controller_cpu0']
    _,spec,policy=daemon.load_config(str(path/'helper-config.json'),config['helperPolicySha256'],config['helperCodeSha256'])
    control.CPU_POLICY=config['cpuIsolation']
    return modules,config,spec,policy,raw,source_sha,files


def prior(arguments,lifecycle,docker):
    policy=arguments['priorPolicy']
    if sha(canonical(policy))!=arguments['priorPolicySha256']:raise RuntimeError('prior_stage_policy_changed')
    census.immutable_prior_files(policy)
    source=lifecycle.attest(setup.NEW,docker)
    blocked={os.getpid(),os.getppid(),source['wrapper']['pid'],source['wrapper']['parentPid'],source['qdrant']['pid'],source['qdrant']['parentPid']}
    raw,_=read_owned(setup.ROOT/census.PRIOR_STAGES[-1]/'prepare_clone_reclaim.py')
    if sha(raw)!=stager.RECLAIM_SHA:raise RuntimeError('prior_receipt_helper_changed')
    helper=types.ModuleType('authenticated_cpu0_external_prior_helper');helper.__file__=str(setup.ROOT/census.PRIOR_STAGES[-1]/'prepare_clone_reclaim.py')
    exec(compile(raw,helper.__file__,'exec'),helper.__dict__)
    old_writers=census.prior_writers(policy,helper,blocked)
    current=None
    if os.path.lexists(stager.STAGE):
        actual,_=read_owned(stager.STAGE/'prepare_clone_reclaim.py')
        if sha(actual)!=stager.RECLAIM_SHA:raise RuntimeError('current_receipt_helper_changed')
        current=helper.inspect_prior_receipts(stager.STAGE,stager.RECLAIM_SHA,blocked,max_records=18)
        if current.get('recordedWritersGone') is not True:
            error=RuntimeError('current_writer_evidence_unknown');error.currentWriterEvidence=current;raise error
    return {'writers':old_writers,'currentWriters':current,'controls':census.proc_controls()}


def stage(arguments):
    modules,config,spec,policy,raw,source_sha,source_files=context(arguments,setup.ADMISSION)
    lifecycle=modules['lifecycle_cpu0'];control=modules['controller_cpu0'];docker=setup.Docker()
    fd=setup.acquire_control(lifecycle)
    try:
        expected=arguments['predecessorSha256'];lifecycle.read_handoff(docker,expected)
        full_files={name:base64.b64decode(value,validate=True) for name,value in arguments['fullFiles'].items()}
        full_manifest=base64.b64decode(arguments['fullManifest'],validate=True)
        def current_prior():
            result=prior(arguments,lifecycle,docker)
            return {'recordedWritersGone':result['writers']['recordedWritersGone'],'scope':result}
        return stager.stage_public(full_manifest,arguments['externalManifestSha256'],full_files,source_sha,lifecycle,docker,fd,expected,
                                  lambda:control.birth_admission(config,spec,policy),current_prior)
    finally:os.close(fd)


def outer_admit(arguments):
    modules,config,spec,policy,raw,source_sha,source_files=context(arguments,stager.STAGE)
    lifecycle=modules['lifecycle_cpu0'];control=modules['controller_cpu0'];docker=setup.Docker()
    fd=setup.acquire_control(lifecycle)
    try:
        previous=arguments['predecessorSha256'];lifecycle.read_handoff(docker,previous)
        full={name:base64.b64decode(value,validate=True) for name,value in arguments['fullFiles'].items()}
        source_proof=stager.verify_staged(base64.b64decode(arguments['fullManifest'],validate=True),arguments['externalManifestSha256'],full,source_sha,arguments['nodeReceiptSha256'])
        observed=prior(arguments,lifecycle,docker)
        birth=control.birth_admission(config,spec,policy)
        handoff=lifecycle.commit_handoff(docker,previous,'outer')
        return {'schema':'cpu0-outer-admission.v6','variant':'cpu0-owned-lifecycle.v1',
                'sourceFreezeSha256':source_sha,'externalManifestSha256':arguments['externalManifestSha256'],
                'initialAdmission':birth,'priorEvidence':observed,'handoff':handoff,
                'stagedSourceProof':source_proof,
                'queries':0,'modelsRead':0,'handoffWrites':1}
    finally:os.close(fd)


def fixed_cause(error):
    value=error.args[0] if type(error) is RuntimeError and len(error.args)==1 else None
    return value if isinstance(value,str) and value in REASONS else 'executor_guard_or_runtime_failure'


def cleanup_phase(arguments,lifecycle,docker,source_sha):
    """A consumer refusal cannot suppress independent census/handoff evidence."""
    primary=None;consumer=None;actual_sha=None;snapshot=None;observed=None;handoff=None
    evidence={}
    try:
        if os.path.lexists(registration.RECORD):
            registration_raw,_=read_owned(registration.RECORD);record=json.loads(registration_raw)
            if record.get('sourceFreezeSha256')!=source_sha or record.get('externalManifestSha256')!=arguments['externalManifestSha256']:raise RuntimeError('consumer_registration_changed')
            recorded_sha=sha(registration_raw);supplied=arguments.get('consumerRegistrationSha256')
            if supplied is not None and supplied!=recorded_sha:raise RuntimeError('consumer_registration_changed')
            consumer=registration.cleanup(lifecycle,docker,recorded_sha)
    except BaseException as error:
        primary=error;evidence['consumer']={'observed':False,'reason':fixed_cause(error),'stateUnknown':True}
    # Every independent read is attempted even if another one refuses. Neither
    # SSH exit nor a failed consumer signal is evidence of writer/source absence.
    for name,action in (
        ('handoff',lambda:lifecycle.secure_json(setup.ROOT/'cpu0-lifecycle-handoff-v1.json')),
        ('prior',lambda:prior(arguments,lifecycle,docker)),
        ('pair',lambda:lifecycle.pair_snapshot(docker))):
        try:
            value=action()
            if name=='handoff':_,actual_sha,_=value;evidence[name]={'observed':True,'sha256':actual_sha}
            elif name=='prior':observed=value;evidence[name]={'observed':True,'scope':value}
            else:snapshot=value;evidence[name]={'observed':True,'snapshot':value}
        except BaseException as error:
            evidence[name]={'observed':False,'reason':fixed_cause(error),'stateUnknown':True}
            if primary is None:primary=error
    fd=None
    if primary is None:
        try:
            fd=setup.acquire_control(lifecycle)
            lifecycle.read_handoff(docker,actual_sha)
            handoff=lifecycle.commit_handoff(docker,actual_sha,'outer')
        except BaseException as error:primary=error
        finally:
            if fd is not None:
                try:os.close(fd)
                except BaseException as error:
                    evidence['controlClose']={'observed':False,'reason':'setup_lock_close_failed'}
                    if primary is None:primary=error
    if primary is not None:
        primary.cleanupIndependentEvidence=evidence
        primary.cleanupObservedHandoff={'observedCommittedHandoffSha256':actual_sha,'continuationAllowed':False}
        primary.cleanupPairSnapshot=snapshot if snapshot is not None else {'observed':False}
        raise primary
    return {'schema':'cpu0-external-cleanup.v6','variant':'cpu0-owned-lifecycle.v1',
            'consumer':consumer,'priorEvidence':observed,'pairSnapshot':snapshot,
            'handoff':handoff,'observedCommittedHandoffSha256':actual_sha,'rootLockAvailable':True,
            'unknownUnregisteredChildrenAbsentProven':False}


def dispatch(operation,arguments):
    if operation not in OPERATIONS or not isinstance(arguments,dict):raise RuntimeError('executor_operation_invalid')
    try:
        if operation=='setup':
            raw,source_sha,files=backend_packet(arguments)
            return setup.run_setup(raw,source_sha,files,arguments['derivativePolicySha256'],arguments['priorPolicy'],arguments['priorPolicySha256'])
        if operation=='stage':return stage(arguments)
        if operation=='outer-admit':return outer_admit(arguments)
        if operation=='producer-stream':
            def private_bytes(raw):
                sys.stdout.buffer.write(raw);sys.stdout.buffer.flush()
            result=producer.execute(producer.DockerBackend(remaining_seconds=arguments['remainingSeconds']),private_bytes,
                                    lambda value:print(json.dumps(value,sort_keys=True,separators=(',',':')),flush=True),remaining_seconds=arguments['remainingSeconds'])
            return {**result,'producerPrivateStreamCompleted':True}
        if operation=='producer-cleanup':return producer.cleanup_from_receipts()
        if operation=='producer-confirm':
            observed=producer.confirm_registration(arguments['receiptSha256'])
            if observed.get('registration')!=arguments['registration']:raise RuntimeError('producer_registration_changed')
            return {**observed,'registeredBeforeForwarding':True}
        modules,config,spec,policy,raw,source_sha,files=context(arguments,stager.STAGE if operation!='preflight' else setup.ADMISSION)
        lifecycle=modules['lifecycle_cpu0'];docker=setup.Docker()
        if operation=='register-consumer':
            return registration.register(lifecycle,docker,arguments['predecessorSha256'],arguments['consumerBirth'],source_sha,arguments['externalManifestSha256'],arguments['consumerPredecessorSha256'],arguments['raiseOwnNofile'])
        if operation=='preflight':
            return modules['cpu0_preflight'].preflight(str(setup.ADMISSION/'helper-config.json'),config['helperPolicySha256'],config['helperCodeSha256'],str(setup.ADMISSION/'controller-config.json'),sha(canonical(config)+b'\n'),arguments['predecessorSha256'])
        if operation=='turnover':
            fd=setup.acquire_control(lifecycle);frames=[]
            try:modules['turnover_gate_cpu0'].stage(config,spec,policy,frames.append,fd,arguments['predecessorSha256'])
            finally:os.close(fd)
            return {'schema':'cpu0-turnover-result.v6','frames':frames}
        if operation=='cleanup':return cleanup_phase(arguments,lifecycle,docker,source_sha)
        raise RuntimeError('executor_operation_invalid')
    except BaseException as error:
        # The original cause survives; the fixed projection never includes raw
        # exception text, Docker configuration, Env or mapped filenames.
        reason=error.args[0] if type(error) is RuntimeError and len(error.args)==1 and isinstance(error.args[0],str) and error.args[0] in REASONS else 'executor_guard_or_runtime_failure'
        public={'schema':'cpu0-external-failure.v6','operation':operation,'reason':reason,'continuationAllowed':False}
        for attribute in FAILURE_FIELDS:
            value=getattr(error,attribute,None)
            if value is not None:public[attribute]=value
        if operation not in ('producer-stream','producer-confirm','producer-cleanup'):
            # Metadata-only fixed-target census remains possible even before
            # the admission/full directory exists. A missing/malformed create
            # reply is not proof that NEW was never created.
            try:
                raw,source_sha,source_files=backend_packet(arguments)
                safe_lifecycle=load_first_lifecycle(raw,source_sha,source_files)
                docker=setup.Docker();endpoints={}
                for name,tag in ((setup.OLD,'old'),(setup.NEW,'new')):
                    try:endpoints[tag]={'observed':True,'state':safe_lifecycle.state_snapshot(safe_lifecycle.container(name,docker))}
                    except BaseException:endpoints[tag]={'observed':False,'state':None,'absenceProven':False}
                public['refusalEndpointEvidence']=endpoints
                if os.path.lexists(setup.ROOT/'cpu0-lifecycle-handoff-v1.json'):
                    _,observed_sha,_=safe_lifecycle.secure_json(setup.ROOT/'cpu0-lifecycle-handoff-v1.json')
                    public['observedCommittedHandoffSha256']=observed_sha
                if os.path.lexists(setup.ROOT/'cpu0-old-clean-receipt-v1.json'):
                    receipt_raw,_=read_owned(setup.ROOT/'cpu0-old-clean-receipt-v1.json')
                    public['durableOldReceiptObservation']={'observed':True,'sha256':sha(receipt_raw),'cleanSemanticsNotInferredFromPresence':True}
            except BaseException:public['refusalEndpointEvidence']={'observed':False,'stateUnknown':True}
        error.publicFailure=public
        raise


FAILURE_FIELDS=('setupCompletedStopReceipt','setupDurableStopEvidence','setupEndpointEvidence',
                'setupFailureEvidence','receiptFailureEvidence','setupDockerCleanupEvidence',
                'setupCleanupFailure','lifecycleCompletedStopReceipt','lifecycleFailureEvidence',
                'lifecycleCleanupFailure','lifecycleDockerCleanupEvidence','fullStageFailureEvidence',
                'producerCleanupEvidence','producerClientCleanupFailure','producerPidfdCleanupFailure','cleanupIndependentEvidence',
                'stageCleanupEvidence','nodeCleanupEvidence','registrationCleanupFailure','cleanupObservedHandoff','cleanupPairSnapshot',
                'setupHostEvidence','setupOldCpuEvidence','metadataClientCleanupFailure','priorWriterEvidence','currentWriterEvidence',
                'resourceLimitEvidence','cpuHierarchyEvidence','hostCpuEvidence','pressureFinalizationFailure')
