"""Distinct fixed-capacity execution boundary; legacy dispatch is unchanged.

Operation dispatch exists, but the complete execution closure is not yet wired.
Every installed recipe authenticates before backend imports, including aliases.
"""
import base64
import os

from packet import (SOURCE_NAMES, canonical, closed_json, hash_value,
                    load_staged_modules_v2, read_owned, sha, verify_source_v2,
                    _v2_inventory, load_first_lifecycle_v2)
import running_adoption as adoption
import stager
import stager_v2
import setup
import census_v2
import executor as legacy_executor
from reason_codes_v2 import REASONS

OPERATIONS=frozenset(('adopt-running-clone','preflight','stage','turnover',
    'outer-admit','register-consumer','cleanup','producer-stream',
    'producer-confirm','producer-cleanup'))


def backend_packet(arguments):
    required={'sourceFreezeSha256','sourceFreeze','sourceFiles'}
    if (type(arguments)is not dict or not required.issubset(arguments)
            or type(arguments['sourceFiles'])is not dict
            or set(arguments['sourceFiles'])!=SOURCE_NAMES):
        raise RuntimeError('executor_source_packet_invalid')
    def decode(value):
        if type(value)is not str or len(value)>350000:
            raise RuntimeError('executor_source_packet_invalid')
        try:return base64.b64decode(value,validate=True)
        except (ValueError,UnicodeError):
            raise RuntimeError('executor_source_packet_invalid') from None
    files={name:decode(value) for name,value in arguments['sourceFiles'].items()}
    raw=decode(arguments['sourceFreeze'])
    verify_source_v2(raw,arguments['sourceFreezeSha256'],files)
    return raw,arguments['sourceFreezeSha256'],files


def installed_recipe(arguments,path):
    """Authenticate aliases and the full applicable recipe before any exec."""
    if path not in (adoption.ADMISSION,adoption.STAGE):
        raise RuntimeError('executor_staged_scope_changed')
    raw,source_sha,files=backend_packet(arguments)
    if path==adoption.ADMISSION:
        control=adoption.derivative_policy(files['prepared-control-policy-cpu0.json'],
                                           sha(files['prepared-control-policy-cpu0.json']))
        hash_value(arguments['derivativePolicySha256'])
        if sha(control)!=arguments['derivativePolicySha256']:
            raise RuntimeError('executor_derivative_changed')
        expected={**files,'cpu0-source-freeze.json':raw,
                  'helper-config.json':files['prepared-helper-policy-cpu0.json'],
                  'controller-config.json':control}
    else:
        full=arguments.get('fullFiles')
        if type(full)is not dict or set(full)!=stager.FULL_NAMES:
            raise RuntimeError('external_manifest_invalid')
        try:
            if any(type(value)is not str or len(value)>350000 for value in full.values()):
                raise ValueError()
            full={name:base64.b64decode(value,validate=True) for name,value in full.items()}
            encoded=arguments['fullManifest']
            if type(encoded)is not str or len(encoded)>350000:raise ValueError()
            manifest=base64.b64decode(encoded,validate=True)
        except (KeyError,ValueError,UnicodeError):
            raise RuntimeError('external_manifest_invalid') from None
        stager.verify_full_v2(manifest,arguments['externalManifestSha256'],full,source_sha)
        if any(full[name]!=content for name,content in files.items()):
            raise RuntimeError('executor_source_packet_changed')
        stager_v2.verify_staged(manifest,arguments['externalManifestSha256'],full,
                                source_sha,arguments['nodeReceiptSha256'])
        expected={**full,'cpu0-external-manifest.json':manifest}
    _v2_inventory(path)
    for name,content in expected.items():
        observed,_=read_owned(path/name)
        if observed!=content:raise RuntimeError('executor_staged_source_changed')
    # Closed inventory and aliases are rechecked before staged loader execution.
    _v2_inventory(path)
    return raw,source_sha,files


def context(arguments,path):
    raw,source_sha,files=installed_recipe(arguments,path)
    control_raw,_=read_owned(path/'controller-config.json')
    helper_raw,_=read_owned(path/'helper-config.json')
    expected=(adoption.derivative_policy(files['prepared-control-policy-cpu0.json'],
                                        sha(files['prepared-control-policy-cpu0.json']))
              if path==adoption.ADMISSION else files['prepared-control-policy-cpu0.json'])
    if control_raw!=expected or helper_raw!=files['prepared-helper-policy-cpu0.json']:
        raise RuntimeError('executor_policy_changed')
    config=closed_json(control_raw)
    if type(config)is not dict or config.get('schema')!='clone-pin-control.cpu0-fixed.v2':
        raise RuntimeError('executor_policy_changed')
    modules=load_staged_modules_v2(path,raw,source_sha,files)
    daemon=modules['daemon_cpu0'];control=modules['controller_cpu0']
    _,spec,policy=daemon.load_config(str(path/'helper-config.json'),
                                   config['helperPolicySha256'],config['helperCodeSha256'])
    control.CPU_POLICY=config['cpuIsolation']
    # Keep derivative bytes exact: canonicalisation is a check, never a rewrite.
    if canonical(config)+b'\n'!=control_raw:
        raise RuntimeError('executor_policy_changed')
    return modules,config,spec,policy,raw,source_sha,files


def prior(arguments,lifecycle,docker):
    target=lifecycle.attest(setup.NEW,docker)
    observed=adoption.prior_census(arguments['priorPolicy'],
                                   arguments['priorPolicySha256'],target)
    current=None
    if os.path.lexists(adoption.STAGE):
        raw,_=read_owned(adoption.STAGE/'prepare_clone_reclaim.py')
        if sha(raw)!=stager.RECLAIM_SHA:raise RuntimeError('current_receipt_helper_changed')
        import types
        helper=types.ModuleType('authenticated_cpu0_v2_current_writer_helper')
        helper.__file__=str(adoption.STAGE/'prepare_clone_reclaim.py')
        exec(compile(raw,helper.__file__,'exec'),helper.__dict__)
        protected={os.getpid(),os.getppid(),target['wrapper']['pid'],
                   target['wrapper']['parentPid'],target['qdrant']['pid'],
                   target['qdrant']['parentPid']}
        current=helper.inspect_prior_receipts(adoption.STAGE,stager.RECLAIM_SHA,
                                             protected,max_records=18)
        if type(current)is not dict or current.get('recordedWritersGone')is not True:
            error=RuntimeError('current_writer_evidence_unknown')
            error.currentWriterEvidence=current;raise error
    return {**observed,'currentWriters':current}


def control_operation(lifecycle, operation, action):
    """Own descriptor cleanup never masks refusal or a completed public receipt."""
    fd=setup.acquire_control(lifecycle);primary=None;result=None
    try:
        result=action(fd)
        return result
    except BaseException as error:
        primary=error
        raise
    finally:
        try:os.close(fd)
        except BaseException:
            failure={'reason':'setup_lock_close_failed','descriptorCloseObserved':False}
            if primary is not None:
                primary.executorControlCleanupFailure=failure
            else:
                error=RuntimeError('setup_lock_close_failed')
                error.executorControlCleanupFailure=failure
                error.executorCompletedOperationReceipt={'operation':operation,'receipt':result,
                    'continuationAllowed':False}
                raise error from None


def stage(arguments):
    modules,config,spec,policy,_,source_sha,_=context(arguments,adoption.ADMISSION)
    lifecycle=modules['lifecycle_cpu0'];control=modules['controller_cpu0']
    def action(fd):
        full={name:base64.b64decode(value,validate=True) for name,value in arguments['fullFiles'].items()}
        manifest=base64.b64decode(arguments['fullManifest'],validate=True)
        docker=adoption.InspectOnly()
        def current_prior():
            value=prior(arguments,lifecycle,docker)
            return {'recordedWritersGone':value['writers']['recordedWritersGone'],'scope':value}
        return stager_v2.stage_public(manifest,arguments['externalManifestSha256'],full,
            source_sha,lifecycle,docker,fd,arguments['predecessorSha256'],
            lambda:control.birth_admission(config,spec,policy),current_prior)
    return control_operation(lifecycle,'stage',action)


def outer_admit(arguments):
    modules,config,spec,policy,_,source_sha,_=context(arguments,adoption.STAGE)
    lifecycle=modules['lifecycle_cpu0'];control=modules['controller_cpu0']
    docker=adoption.InspectOnly()
    def action(fd):
        previous=arguments['predecessorSha256'];lifecycle.read_handoff(docker,previous)
        observed=prior(arguments,lifecycle,docker)
        birth=control.birth_admission(config,spec,policy)
        handoff=lifecycle.commit_handoff(docker,previous,'outer')
        return {'schema':'cpu0-outer-admission.v7','variant':'cpu0-fixed-capacity.v2',
                'sourceFreezeSha256':source_sha,'externalManifestSha256':arguments['externalManifestSha256'],
                'initialAdmission':birth,'priorEvidence':observed,'handoff':handoff,
                'nodeReceiptSha256':arguments['nodeReceiptSha256'],
                'queries':0,'modelsRead':0,'handoffWrites':1}
    return control_operation(lifecycle,'outer-admit',action)


def fixed_cause(error):
    value=error.args[0] if type(error)is RuntimeError and len(error.args)==1 else None
    return value if type(value)is str and value in REASONS else 'executor_guard_or_runtime_failure'


def cleanup(arguments):
    """First-source cleanup is reachable before the full stage exists.

    Each independent census is attempted even if recipe or consumer cleanup
    refuses. No missing receipt, SSH exit or partial stage proves child absence.
    """
    raw,source_sha,files=backend_packet(arguments)
    lifecycle=load_first_lifecycle_v2(raw,source_sha,files)
    controller=None;primary=None;consumer=None;actual_sha=None;handoff=None
    snapshot=None;observed=None;evidence={};docker=adoption.InspectOnly()
    values=dict(arguments)
    try:
        if os.path.lexists(adoption.STAGE):
            if values.get('nodeReceiptSha256')is None:
                receipt,_=read_owned(adoption.STAGE/'node-provenance.json')
                values['nodeReceiptSha256']=sha(receipt)
            modules,_,_,_,_,_,_=context(values,adoption.STAGE)
            lifecycle=modules['lifecycle_cpu0'];controller=modules['controller_cpu0']
        elif os.path.lexists(adoption.ADMISSION):
            modules,_,_,_,_,_,_=context(values,adoption.ADMISSION)
            lifecycle=modules['lifecycle_cpu0'];controller=modules['controller_cpu0']
        evidence['recipe']={'observed':True,'fullStagePresent':os.path.lexists(adoption.STAGE)}
    except BaseException as error:
        primary=error;evidence['recipe']={'observed':False,'reason':fixed_cause(error),'stateUnknown':True}
    try:
        import registration_v2
        if os.path.lexists(registration_v2.ENROLMENT):
            consumer=registration_v2.cleanup_from_receipts(lifecycle,docker,
                expected_source_sha=source_sha,
                expected_external_sha=arguments['externalManifestSha256'],
                expected_node_receipt_sha=values.get('nodeReceiptSha256'),
                registration_sha=arguments.get('consumerRegistrationSha256'),controller=controller)
        else:
            consumer={'enrolmentObserved':False,'registeredBirthAbsenceProven':False,
                      'unknownUnregisteredChildrenAbsentProven':False}
    except BaseException as error:
        evidence['consumer']={'observed':False,'reason':fixed_cause(error),'stateUnknown':True}
        for name in FAILURE_FIELDS:
            value=getattr(error,name,None)
            if value is not None:evidence[name]=value
        if primary is None:primary=error
    for name,action in (
        ('handoff',lambda:lifecycle.secure_json(adoption.HANDOFF)
            if os.path.lexists(adoption.HANDOFF) else None),
        ('prior',lambda:prior(arguments,lifecycle,docker)),
        ('controls',lambda:census_v2.proc_controls()),
        ('pair',lambda:lifecycle.pair_snapshot(docker))):
        try:
            value=action()
            if name=='handoff':
                if value is None:evidence[name]={'observed':False,'recordAbsentAtRead':True,'absenceGrantsNoAuthority':True}
                else:_,actual_sha,_=value;evidence[name]={'observed':True,'sha256':actual_sha}
            elif name=='prior':observed=value;evidence[name]={'observed':True,'scope':value}
            elif name=='pair':snapshot=value;evidence[name]={'observed':True,'snapshot':value}
            else:evidence[name]={'observed':True,'scope':value}
        except BaseException as error:
            evidence[name]={'observed':False,'reason':fixed_cause(error),'stateUnknown':True}
            if primary is None:primary=error
    control_closed=False
    if primary is None and actual_sha is not None:
        def commit_cleanup(fd):
            nonlocal handoff
            lifecycle.read_handoff(docker,actual_sha)
            handoff=lifecycle.commit_handoff(docker,actual_sha,'outer')
            return handoff
        try:
            control_operation(lifecycle,'cleanup',commit_cleanup)
            control_closed=True
        except BaseException as error:
            primary=error
            close_failure=getattr(error,'executorControlCleanupFailure',None)
            if close_failure is not None:evidence['controlClose']={'observed':False,**close_failure}
    if primary is not None:
        primary.cleanupIndependentEvidence=evidence
        primary.cleanupObservedHandoff={'observedCommittedHandoffSha256':handoff['sha256'] if handoff is not None else actual_sha,
            'observedPredecessorSha256':actual_sha,'continuationAllowed':False}
        primary.cleanupPairSnapshot=snapshot if snapshot is not None else {'observed':False}
        raise primary
    return {'schema':'cpu0-external-cleanup.v7','variant':'cpu0-fixed-capacity.v2',
            'consumer':consumer,'priorEvidence':observed,'pairSnapshot':snapshot,
            'handoff':handoff,'observedCommittedHandoffSha256':actual_sha,
            'independentEvidence':evidence,'rootLockAvailable':control_closed,
            'unknownUnregisteredChildrenAbsentProven':False}


def dispatch(operation,arguments):
    if operation not in OPERATIONS or type(arguments)is not dict:
        raise RuntimeError('executor_operation_invalid')
    try:
        if operation=='adopt-running-clone':
            raw,source_sha,files=backend_packet(arguments)
            proof=arguments['adoptionProof']
            if (type(proof)is not dict or set(proof)!={'mode','failedRecovery','memoryObservation',
                    'failedRecoverySha256','memoryObservationSha256'} or proof['mode']!=adoption.MODE
                    or proof['failedRecoverySha256']!=adoption.proofs.FAILURE_SHA
                    or proof['memoryObservationSha256']!=adoption.proofs.MEMORY_SHA):
                raise RuntimeError('running_adoption_proof_invalid')
            decoded=[]
            for name in ('failedRecovery','memoryObservation'):
                encoded=proof[name]
                if type(encoded)is not str or len(encoded)>90000:
                    raise RuntimeError('running_adoption_proof_invalid')
                decoded.append(base64.b64decode(encoded,validate=True))
            return adoption.run(raw,source_sha,files,arguments['derivativePolicySha256'],
                arguments['priorPolicy'],arguments['priorPolicySha256'],*decoded,
                arguments['externalClosureSha256'])
        if operation in ('producer-stream','producer-confirm','producer-cleanup'):
            # The reviewed producer and its complete registration/exit grammar
            # are unchanged. Its failures retain their exact original evidence.
            return legacy_executor.dispatch(operation,arguments)
        if operation=='stage':return stage(arguments)
        if operation=='outer-admit':return outer_admit(arguments)
        if operation=='cleanup':return cleanup(arguments)
        modules,config,spec,policy,_,source_sha,_=context(arguments,
            adoption.ADMISSION if operation=='preflight' else adoption.STAGE)
        lifecycle=modules['lifecycle_cpu0'];docker=adoption.InspectOnly()
        if operation=='register-consumer':
            import registration_v2
            return registration_v2.register(lifecycle,docker,arguments['predecessorSha256'],
                arguments['consumerBirth'],source_sha,arguments['externalManifestSha256'],
                arguments['consumerPredecessorSha256'],arguments['raiseOwnNofile'],
                enrolment_sha=arguments['consumerEnrolmentSha256'],
                enrolment_projection=arguments['consumerEnrolment'],
                preflight_exit_evidence=arguments['preflightExit'],
                node_receipt_sha=arguments['nodeReceiptSha256'])
        if operation=='preflight':
            return modules['cpu0_preflight'].preflight(str(adoption.ADMISSION/'helper-config.json'),
                config['helperPolicySha256'],config['helperCodeSha256'],
                str(adoption.ADMISSION/'controller-config.json'),sha(canonical(config)+b'\n'),
                arguments['predecessorSha256'])
        if operation=='turnover':
            def action(fd):
                frames=[]
                modules['turnover_gate_cpu0'].stage(config,spec,policy,frames.append,fd,arguments['predecessorSha256'])
                return {'schema':'cpu0-turnover-result.v7','variant':'cpu0-fixed-capacity.v2','frames':frames}
            return control_operation(lifecycle,'turnover',action)
        raise RuntimeError('executor_operation_invalid')
    except BaseException as error:
        public={'schema':'cpu0-external-failure.v7','operation':operation,
                'reason':fixed_cause(error),'continuationAllowed':False}
        for name in FAILURE_FIELDS:
            value=getattr(error,name,None)
            if value is not None:public[name]=value
        if operation not in ('producer-stream','producer-confirm','producer-cleanup'):
            try:
                raw,source_sha,files=backend_packet(arguments)
                lifecycle=load_first_lifecycle_v2(raw,source_sha,files)
                docker=adoption.InspectOnly();endpoints={}
                for name,tag in ((setup.OLD,'old'),(setup.NEW,'new')):
                    try:endpoints[tag]={'observed':True,'state':lifecycle.state_snapshot(lifecycle.container(name,docker))}
                    except BaseException:endpoints[tag]={'observed':False,'state':None,'absenceProven':False}
                public['refusalEndpointEvidence']=endpoints
            except BaseException:public['refusalEndpointEvidence']={'observed':False,'stateUnknown':True}
        error.publicFailure=public
        raise


FAILURE_FIELDS=legacy_executor.FAILURE_FIELDS+('admissionFailureEvidence',
    'admissionPassedSampleBeforeRefence','sourceLimitFailureEvidence',
    'queryMemoryFailureEvidence','workingSetFailureEvidence','pressureMemoryFailureEvidence','overheadFailureEvidence',
    'stageFailureEvidence','nodeVerificationEvidence','nodeReceiptPublicationEvidence',
    'runningAdoptionFailureEvidence','runningAdoptionPublicationEvidence',
    'runningAdoptionCompletedPublication','runningAdoptionCleanupFailure',
    'consumerEnrolmentFailureEvidence','consumerEnrolmentCleanupFailure','consumerCleanupEvidence','consumerCleanupFailure',
    'consumerPreflightCensusFailure','executorControlCleanupFailure',
    'executorCompletedOperationReceipt')
