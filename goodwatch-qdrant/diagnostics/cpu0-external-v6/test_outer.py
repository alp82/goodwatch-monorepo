"""Local orchestration fixtures: fake RPC/metadata, real owned pipe clients.

This proves ordering and refusal composition, not production admission/cleanup.
"""
import copy
import base64
import importlib.util
from contextlib import ExitStack, nullcontext
from pathlib import Path
from types import SimpleNamespace
import json
import subprocess
import sys
import unittest
from unittest import mock
import outer_local
import packet
import private_pipe


def chained(owner, previous=None):
    value={'schema':'clone-lifecycle-handoff.cpu0.v1','owner':owner,'previousSha256':previous,'snapshot':{'fixture':'public-pair'}}
    return {**value,'sha256':packet.sha(packet.canonical(value)+b'\n')}


def actual_turnover_frames(previous, successor):
    """Run the real immutable backend emitter with explicit local OS seams.

    Shape comes from turnover_gate_cpu0.stage, not a rewritten fake frame. The
    source/Qdrant/child boundaries are fake; no actual lifecycle action occurs.
    """
    source_dir=Path(__file__).resolve().parent.parent/'pinning-prototype'
    old_path=list(sys.path)
    try:
        sys.path.insert(0,str(source_dir))
        spec=importlib.util.spec_from_file_location('outer_fixture_real_turnover',source_dir/'turnover_gate_cpu0.py')
        gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)
    finally:
        sys.path[:]=old_path
    control=gate.control
    old=SimpleNamespace(pid=101,identity=('id','image',101,99),cgroup_relative='/clone')
    fresh=SimpleNamespace(pid=102,identity=('id','image',102,100),cgroup_relative='/clone')
    child=mock.Mock()
    child.joined.return_value={'joined':True,'lockedBytes':0,'childPidPositive':True}
    child.gone.return_value={'childGone':True,'survivedGracePeriod':False,'exitCode':0,'queries':0,'lockedBytes':0}
    life=mock.Mock()
    life.helper_fork_scope.side_effect=lambda *args:nullcontext()
    life.graceful_stop.return_value={'clean':True,'fixture':True}
    life.commit_handoff.return_value=successor
    frames=[]
    with ExitStack() as stack:
        patches=(mock.patch.object(control,'owned_store_files'),mock.patch.object(control,'owned_total_budget'),
          mock.patch.object(control,'host_available'),mock.patch.object(control.cpu0_guards,'host_cpu'),
          mock.patch.object(control,'self_cgroup',return_value='/reader'),
          mock.patch.object(control,'inspect_stopped_or_running',side_effect=[{'State':{'Running':True}},{'State':{'Running':False}},{'State':{'Running':False}}]),
          mock.patch.object(control,'inspect_source',side_effect=[old,old,fresh]),
          mock.patch.object(control,'load_lifecycle',return_value=life),
          mock.patch.object(control,'birth_admission',return_value={'target':{'fixture':True}}),
          mock.patch.object(control,'frozen_helper'),mock.patch.object(control,'limits',return_value={}),
          mock.patch.object(control,'at',return_value='2026-10-12T00:00:00Z'),
          mock.patch.object(control.runtime,'accounting',return_value={}),
          mock.patch.object(control,'clone_command'),mock.patch.object(gate,'ZeroChild',return_value=child),
          mock.patch.object(gate,'ready',return_value=fresh))
        for patch in patches:stack.enter_context(patch)
        gate.stage({},SimpleNamespace(store=None,container='fixed-fixture'),
          SimpleNamespace(emergency_bytes=1,reserve_bytes=1,cap_reserve_bytes=1),frames.append,12,previous)
    life.commit_handoff.assert_called_once_with(control.runtime.docker,previous,'turnover')
    return frames


class Harness:
    def __init__(self):
        self.events=[];self.frames=[];self.calls=[];self.previous=None;self.admission=None;self.registration=None;self.fail=None;self.current_writers=True;self.audit_fail=False
        self.packet={'schema':outer_local.SCHEMA,'sourceFreezeSha256':'a'*64,'sourceFreeze':'fixture','sourceFiles':{},'externalManifestSha256':'b'*64,'derivativePolicySha256':'d'*64,'priorPolicy':[],'priorPolicySha256':'e'*64,'fullFiles':{},'fullManifest':'fixture'}
        self.producer={'containerId':'f'*64,'image':'fixture-image','pid':123,'startTicks':456}
    def call(self, operation, arguments, **limits):
        self.events.append(operation);self.calls.append((operation,copy.deepcopy(arguments),limits))
        if self.fail==operation:
            error=RuntimeError('rpc_remote_refused');error.remoteFailureEvidence={'continuationAllowed':False};raise error
        if operation in ('setup','preflight','stage','turnover','outer-admit'):
            if operation!='setup':assert arguments['predecessorSha256']==self.previous['sha256']
            self.previous=chained({'stage':'stager','outer-admit':'outer'}.get(operation,operation),self.previous['sha256'] if self.previous else None);result={'handoff':self.previous}
            if operation=='stage':result['nodeReceiptSha256']='9'*64
            if operation=='turnover':result={'frames':actual_turnover_frames(arguments['predecessorSha256'],self.previous)}
        elif operation=='register-consumer':
            assert arguments['predecessorSha256']==self.admission['handoff']['sha256'];assert arguments['consumerPredecessorSha256']==self.previous['sha256'];assert arguments['consumerBirth']==self.admission['consumerBirth']
            self.registration={'registrationSha256':'8'*64,'registeredBeforeCapture':True};result=self.registration
        elif operation=='producer-confirm':
            assert arguments['registration']==self.producer;result={'registration':self.producer,'registeredBeforeForwarding':True}
        elif operation=='producer-cleanup':result={'containerGone':True,'birthGone':True,'exitZeroProven':False}
        elif operation=='cleanup':
            assert arguments['consumerRegistrationSha256']==('8'*64 if self.registration else None)
            result={'consumer':{'birthGone':True,'exitObserved':True},'priorEvidence':{'writers':{'recordedWritersGone':True},'currentWriters':{'recordedWritersGone':self.current_writers,'receiptCount':18}},'rootLockAvailable':True,'observedCommittedHandoffSha256':'7'*64,'unknownUnregisteredChildrenAbsentProven':False}
        else:raise AssertionError(operation)
        return {'schema':'cpu0-public-rpc.v6','operation':operation,'result':result,'localClientExit':{'observed':True,'exitCode':0,'signal':None,'remoteStateNotInferredFromSsh':True}}
    def command(self,operation):return ['fixture-'+operation]
    def envelope(self,operation,arguments):return b'public-control-fixture'
    def validate(self,value,previous,*unused):
        self.events.append('pure-validate');assert previous==self.previous;assert value==self.admission
        return {'receipt':{'handoff':value['handoff']},'consumerBirth':value['consumerBirth']}
    def audit(self,frames,previous,given_packet,*,absolute_deadline=None):
        self.events.append('offline-audit')
        if absolute_deadline is not None:assert absolute_deadline==self.calls[0][2]['absolute_deadline']
        assert given_packet is self.packet;assert frames[0]==self.admission
        if self.audit_fail:
            error=RuntimeError('outer_consumer_audit_refused');error.consumerAuditEvidence={'consumerPass':False,'experimentPass':False};raise error
        return {'consumerPass':True,'experimentPass':False,'externalCleanupRequired':True,'productionAcceptance':False}
    def prepare_admission(self):
        self.admission={'kind':'consumer-admission','variant':'cpu0-owned-lifecycle.v1','sourceFreezeSha256':'a'*64,'externalManifestSha256':'b'*64,'handoff':chained('preflight',self.previous['sha256']),'consumerBirth':{'pid':777,'startTicks':888,'fixture':True}};return self.admission
    def producer_control(self):return {'kind':'private-producer-registration','schema':'cpu0-producer-control.v6','authentication':{},'registration':self.producer,'receiptSha256':'6'*64}
    def producer_exit(self):return {'schema':'cpu0-producer-completion.v6','producerPrivateStreamCompleted':True,'cliExitCode':0,'containerExitCode':0,'exitObserved':True,'birthGone':True,'privatePayloadPersisted':False,'registration':self.producer}
    def stream(self,consumer,producer,source,external,predecessor,emit,**callbacks):
        self.events.append('stream-start');assert predecessor==self.previous['sha256'];assert callbacks['absolute_deadline']==self.calls[0][2]['absolute_deadline'];value=self.prepare_admission();validated=callbacks['validate_admission'](value);registered=callbacks['register_consumer'](value,validated);assert registered['registeredBeforeCapture'] is True
        self.events.append('producer-capture');proof=callbacks['register_producer'](self.producer_control());assert proof['registeredBeforeForwarding'] is True;callbacks['validate_producer_exit'](self.producer_exit());emit(value);emit({'kind':'complete','fixture':True});return {'remoteCleanupRequired':True}
    def run(self,stream=None):
        with mock.patch.object(outer_local,'stream',stream or self.stream),mock.patch.object(outer_local,'validated_admission',self.validate),mock.patch.object(outer_local,'audit_consumer',self.audit):
            return outer_local.run(self.packet,self,self.frames.append,contract_dir='fixture',validator_path='fixture',raise_own_nofile=False)


class OuterTests(unittest.TestCase):

    def test_real_backend_turnover_complete_frame_is_consumed_by_outer(self):
        h=Harness();result=h.run()
        self.assertEqual(result['status'],'completed')
        turnover=next(x['result'] for x in result['operationLedger'] if x['operation']=='turnover')
        self.assertEqual([x['stage'] for x in turnover['frames']],['first-join','old-child-gone','second-join','complete'])
        self.assertIn('handoff',turnover['frames'][-1])
        self.assertIn('outer-admit',h.events)

    def test_deadline_before_audit_refuses_without_audit_or_resume(self):
        h=Harness();now=[100.0];original=h.stream
        def expired(*args,**kwargs):
            result=original(*args,**kwargs);now[0]=7300.0;return result
        with mock.patch.object(outer_local.time,'monotonic',side_effect=lambda:now[0]):
            result=h.run(expired)
        self.assertEqual(result['status'],'failed-or-cleanup-unknown')
        self.assertEqual(result['failureReason'],'outer_deadline')
        self.assertNotIn('offline-audit',h.events)
        self.assertEqual(h.events[-2:],['producer-cleanup','cleanup'])

    def test_deadline_crossed_during_audit_vetoes_completion(self):
        h=Harness();now=[100.0];original=h.audit
        def expired(*args,**kwargs):
            result=original(*args,**kwargs);now[0]=7300.0;return result
        h.audit=expired
        with mock.patch.object(outer_local.time,'monotonic',side_effect=lambda:now[0]):result=h.run()
        self.assertIn('offline-audit',h.events)
        self.assertEqual(result['status'],'failed-or-cleanup-unknown')
        self.assertEqual(result['failureReason'],'outer_deadline')
        self.assertEqual(h.events[-2:],['producer-cleanup','cleanup'])

    def test_successful_cleanup_crossing_original_deadline_cannot_complete(self):
        h=Harness();now=[100.0];original=h.call
        def delayed_cleanup(operation,arguments,**limits):
            result=original(operation,arguments,**limits)
            if operation=='cleanup':now[0]=7300.0
            return result
        h.call=delayed_cleanup
        with mock.patch.object(outer_local.time,'monotonic',side_effect=lambda:now[0]):
            result=h.run()
        self.assertEqual(h.events[-2:],['producer-cleanup','cleanup'])
        self.assertTrue(result['allRegisteredLifecycleExitsProven'])
        self.assertEqual(result['status'],'failed-or-cleanup-unknown')
        self.assertEqual(result['failureReason'],'outer_deadline')
        self.assertEqual([x[2] for x in h.calls[-2:]],[{'timeout':60},{'timeout':60}])

    def test_audit_subprocess_timeout_is_capped_to_global_remainder(self):
        fake_packet={'fullManifest':base64.b64encode(b'{}').decode(),'fullFiles':{},
          'externalManifestSha256':'a'*64,'sourceFreezeSha256':'b'*64}
        child=SimpleNamespace(returncode=0,stdout=b'{"consumerPass":true}')
        with mock.patch('stager.verify_full'),mock.patch.object(outer_local.time,'monotonic',return_value=100.0),mock.patch.object(outer_local.subprocess,'run',return_value=child) as run:
            outer_local.audit_consumer([],{},fake_packet,absolute_deadline=105.0)
        self.assertGreater(run.call_args.kwargs['timeout'],0)
        self.assertLessEqual(run.call_args.kwargs['timeout'],5.0)

    def test_registration_before_capture_audit_before_cleanup(self):
        h=Harness();result=h.run();self.assertEqual(result['status'],'completed');self.assertEqual(h.events[:5],['setup','preflight','stage','turnover','outer-admit'])
        self.assertLess(h.events.index('pure-validate'),h.events.index('register-consumer'));self.assertLess(h.events.index('register-consumer'),h.events.index('producer-capture'));self.assertLess(h.events.index('offline-audit'),h.events.index('producer-cleanup'));self.assertEqual(h.events[-2:],['producer-cleanup','cleanup'])
        self.assertTrue(result['allRegisteredLifecycleExitsProven']);self.assertFalse(result['consumerAudit']['experimentPass']);self.assertFalse(result['unknownUnregisteredChildrenAbsentProven']);self.assertFalse(result['productionAcceptance'])
    def test_offline_audit_refusal_cannot_be_promoted_by_successful_cleanup(self):
        h=Harness();h.audit_fail=True;result=h.run();self.assertEqual(result['status'],'failed-or-cleanup-unknown');self.assertTrue(result['allRegisteredLifecycleExitsProven']);self.assertFalse(result['consumerAuditFailure']['consumerPass']);self.assertIsNone(result['consumerAudit']);self.assertEqual(h.events[-2:],['producer-cleanup','cleanup'])
    def test_old_writer_clearance_cannot_replace_current_cpu0_writer_clearance(self):
        h=Harness();h.current_writers=False;result=h.run();self.assertEqual(result['status'],'failed-or-cleanup-unknown');self.assertFalse(result['allRegisteredLifecycleExitsProven']);self.assertTrue(result['cleanup']['cleanup']['result']['priorEvidence']['writers']['recordedWritersGone'])
    def test_remote_refusal_no_resume_and_both_cleanup_sites(self):
        for failed in ('setup','preflight','stage','turnover','outer-admit','register-consumer','producer-confirm'):
            with self.subTest(failed=failed):
                h=Harness();h.fail=failed;result=h.run();self.assertEqual(result['status'],'failed-or-cleanup-unknown');self.assertEqual(h.events[-2:],['producer-cleanup','cleanup']);self.assertNotIn('offline-audit',h.events);self.assertEqual(h.events.count(failed),1)
                if failed!='producer-confirm':self.assertNotIn('producer-capture',h.events)
    def test_one_cleanup_site_refusal_cannot_skip_other_site_or_claim_release(self):
        for failed in ('producer-cleanup','cleanup'):
            with self.subTest(failed=failed):
                h=Harness();h.fail=failed;result=h.run();self.assertEqual(h.events[-2:],['producer-cleanup','cleanup']);self.assertEqual(result['status'],'failed-or-cleanup-unknown');self.assertFalse(result['allRegisteredLifecycleExitsProven']);self.assertFalse(result['cleanup'][failed]['observed']);self.assertTrue(result['cleanup'][failed]['stateUnknown'])
    def test_producer_zero_exit_and_registered_identity_required(self):
        for change in ({'containerExitCode':1},{'cliExitCode':1},{'birthGone':False},{'registration':{'foreign':True}}):
            with self.subTest(change=change):
                h=Harness()
                def bad(*args,**callbacks):
                    original=callbacks['validate_producer_exit']
                    return h.stream(*args,**{**callbacks,'validate_producer_exit':lambda value:original({**value,**change})})
                result=h.run(bad);self.assertEqual(result['status'],'failed-or-cleanup-unknown');self.assertEqual(result['failureReason'],'outer_producer_exit_refused');self.assertNotIn('offline-audit',h.events);self.assertEqual(h.events[-2:],['producer-cleanup','cleanup'])
    def test_absolute_deadline_expiry_never_resumes_and_cleanup_stays_bounded(self):
        h=Harness();now=[100.0];original=h.call
        def expire(operation,arguments,**limits):
            value=original(operation,arguments,**limits)
            if operation=='setup':now[0]=7300.0
            return value
        h.call=expire
        with mock.patch.object(outer_local.time,'monotonic',side_effect=lambda:now[0]):result=h.run()
        self.assertEqual(result['failureReason'],'outer_deadline');self.assertEqual(h.events,['setup','producer-cleanup','cleanup']);self.assertEqual(h.calls[0][2]['absolute_deadline'],7300.0);self.assertEqual([x[2] for x in h.calls[-2:]],[{'timeout':60},{'timeout':60}])
    def test_real_owned_pipe_composes_registration_demux_and_exit_marker(self):
        h=Harness();spawns=[]
        def real_stream(consumer,producer,source,external,predecessor,emit,**callbacks):
            frame=h.prepare_admission();consumer_code="import json,sys;print("+repr(json.dumps(frame))+",flush=True);rows=[json.loads(x) for x in sys.stdin.buffer.read().splitlines()];assert [x['kind'] for x in rows]==['private-batch','private-producer-complete'];print(json.dumps({'kind':'complete','fixture':True}),flush=True)"
            rows=[h.producer_control(),{'kind':'private-batch','fixture':'private-not-retained'},{'kind':'private-producer-exit-proof','proof':h.producer_exit()}];producer_code='\n'.join('print('+repr(json.dumps(x))+',flush=True)' for x in rows)
            def spawn(argv,**kwargs):
                spawns.append(argv)
                if len(spawns)==1:code=consumer_code
                else:self.assertIn('register-consumer',h.events);h.events.append('producer-capture');code=producer_code
                return subprocess.Popen([sys.executable,'-u','-c',code],**kwargs)
            return private_pipe.stream(consumer,producer,source,external,predecessor,emit,**{**callbacks,'producer_input':b'','spawn':spawn})
        result=h.run(real_stream);self.assertEqual(result['status'],'completed');self.assertEqual(len(spawns),2);self.assertEqual(result['transport']['exits']['producer']['exitCode'],0);self.assertTrue(result['transport']['producerExitZeroBeforeCompletionMarker']);self.assertNotIn('private-not-retained',json.dumps(h.frames));self.assertEqual([x['kind'] for x in result['frames']],['consumer-admission','producer-registration','complete'])


if __name__=='__main__':unittest.main()
