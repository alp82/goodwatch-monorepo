"""Publication/order composition with injected source authority, no hosts.

These fixtures use real local stage/intent/handoff files. Process attestation,
source caps, prior census and the admission sample are explicit injected seams;
their physical implementations are tested separately in the backend suite.
"""
import os
from unittest import mock
import unittest

import executor_v2
import packet
import running_adoption as adoption
import test_executor_v2 as recipe_fixture


class AdoptionCompositionTests(unittest.TestCase):
    def setUp(self):
        recipe_fixture.RecipeBoundaryTests.setUp(self)
        root=self.path.parent;root.chmod(0o700)
        self.enterContext(mock.patch.object(adoption,'ROOT',root))
        for name in ('INTENT','HANDOFF','SUCCESS','ATTEMPT','LEGACY_ADMISSION','STAGE'):
            self.enterContext(mock.patch.object(adoption,name,root/getattr(adoption,name).name))
        # The packet fixture is only a local recipe builder. Begin the operation
        # with a genuinely absent stage; no runtime consumed scope is removed.
        for path in self.path.iterdir():path.unlink()
        self.path.rmdir()
        # The stage path was relocated after fixture construction: rebuild the
        # frozen two alias paths to this isolated local recipe before execution.
        original=packet.closed_json(self.files['prepared-control-policy-cpu0.json'])
        original['helperConfig']=str(adoption.STAGE/'helper-config.json')
        original['lifecycle']['modulePath']=str(adoption.STAGE/'lifecycle_cpu0.py')
        original['lifecycle']['handoffPath']=str(adoption.HANDOFF)
        self.files['prepared-control-policy-cpu0.json']=packet.canonical(original)+b'\n'
        source=packet.closed_json(self.source)
        source['files']['prepared-control-policy-cpu0.json']=packet.sha(self.files['prepared-control-policy-cpu0.json'])
        self.source=packet.canonical(source)+b'\n'
        derivative=adoption.derivative_policy(self.files['prepared-control-policy-cpu0.json'],
                                              packet.sha(self.files['prepared-control-policy-cpu0.json']))
        self.derivative_sha=packet.sha(derivative)
        self.enterContext(mock.patch.dict(os.environ,clear=False))
        self.enterContext(mock.patch.dict(adoption.__dict__,
            {'_AUTHENTICATED_EXTERNAL_CLOSURE_SHA256':'f'*64}))
        self.enterContext(mock.patch.object(adoption,'directory',
            side_effect=lambda path:packet.directory(path,uid=os.getuid())))
        self.enterContext(mock.patch.object(adoption,'read_owned',
            side_effect=lambda path,**kw:packet.read_owned(path,uid=os.getuid(),**kw)))
        self.enterContext(mock.patch.object(adoption,'stage_absent_once',
            side_effect=lambda path,files:packet.stage_absent_once(path,files,uid=os.getuid())))
        self.life=mock.Mock()
        lock=root/'control.lock';lock.write_bytes(b'');lock.chmod(0o600)
        self.enterContext(mock.patch.object(adoption.setup,'acquire_control',
            side_effect=lambda _:os.open(lock,os.O_RDWR|os.O_CLOEXEC)))
        self.enterContext(mock.patch.object(adoption,'load_first_lifecycle_v2',return_value=self.life))
        self.enterContext(mock.patch.object(adoption.proofs,'observations',return_value={'public':'historical'}))
        self.enterContext(mock.patch.object(adoption,'legacy_files',return_value={'files':'unchanged'}))
        self.enterContext(mock.patch.object(adoption,'spent_recovery_attempt',return_value=(1,2)))
        self.target={'wrapper':{'pid':101},'qdrant':{'pid':102}}
        self.pair={'variant':'cpu0-fixed-capacity.v2','newRunning':self.target}
        self.enterContext(mock.patch.object(adoption,'pair_observation',return_value=(self.pair,(3,4))))
        self.enterContext(mock.patch.object(adoption,'prior_census',
            return_value={'writers':{'recordedWritersGone':True},'controls':{'activeReviewedControls':0}}))
        self.control=mock.Mock()
        self.entry={'schema':'clone-entry-identity.cpu0.v2','target':self.target}
        self.control.entry_identity.return_value=self.entry
        def sample(*args):
            self.assertTrue(adoption.INTENT.exists())
            self.assertEqual(packet.closed_json(adoption.INTENT.read_bytes())['admissionSampleTaken'],False)
            return {'target':self.target,'sample':'single injected admission'}
        self.control.running_entry_admission.side_effect=sample
        self.enterContext(mock.patch.object(executor_v2,'context',
            return_value=({'lifecycle_cpu0':self.life,'controller_cpu0':self.control},
                          original,object(),object(),self.source,packet.sha(self.source),self.files)))

    def run_operation(self):
        return adoption.run(self.source,packet.sha(self.source),self.files,
                            self.derivative_sha,[],packet.sha(packet.canonical([])),
                            b'injected historical failure',b'injected memory observation','f'*64)

    def test_complete_local_publication_has_one_intent_then_one_sample(self):
        result=self.run_operation()
        self.control.running_entry_admission.assert_called_once()
        self.assertEqual(result['admissionFilesCreated'],17)
        self.assertEqual(result['sourceActions'],0)
        self.assertIs(result['predecessorCleanupUnknownRetained'],True)
        handoff=packet.closed_json(adoption.HANDOFF.read_bytes())
        self.assertEqual(handoff['owner'],'adoption')
        self.assertIsNone(handoff['previousSha256'])
        self.assertEqual(handoff['adoptionIntentSha256'],packet.sha(adoption.INTENT.read_bytes()))
        self.assertEqual(result['successReceiptSha256'],packet.sha(adoption.SUCCESS.read_bytes()))

    def test_unauthenticated_operation_refuses_before_lock_or_scope(self):
        with mock.patch.dict(adoption.__dict__,{'_AUTHENTICATED_EXTERNAL_CLOSURE_SHA256':'0'*64}):
            with self.assertRaisesRegex(RuntimeError,'^running_adoption_closure_unproven$'):
                self.run_operation()
        adoption.setup.acquire_control.assert_not_called()
        self.assertFalse(adoption.ADMISSION.exists())
        self.assertFalse(adoption.INTENT.exists())

    def test_admission_refusal_keeps_spent_intent_and_has_no_handoff(self):
        failure=RuntimeError('host_emergency_floor')
        failure.admissionFailureEvidence={'actualAvailableBytes':4*1024**3,'strictFloorBytes':4*1024**3}
        self.control.running_entry_admission.side_effect=failure
        with self.assertRaises(RuntimeError) as caught:self.run_operation()
        self.assertIs(caught.exception,failure)
        self.assertTrue(adoption.INTENT.exists())
        self.assertTrue(adoption.ADMISSION.exists())
        self.assertFalse(adoption.HANDOFF.exists())
        self.assertFalse(adoption.SUCCESS.exists())
        self.control.running_entry_admission.assert_called_once()
        with self.assertRaisesRegex(RuntimeError,'^running_adoption_scope_changed$'):
            self.run_operation()
        self.control.running_entry_admission.assert_called_once()

    def test_post_sample_identity_change_cannot_publish_handoff(self):
        changed={**self.entry,'changed':'actual immutable fence drift'}
        self.control.entry_identity.side_effect=[self.entry,self.entry,changed]
        with self.assertRaisesRegex(RuntimeError,'^running_adoption_identity_changed$'):
            self.run_operation()
        self.control.running_entry_admission.assert_called_once()
        self.assertTrue(adoption.INTENT.exists())
        self.assertFalse(adoption.HANDOFF.exists())

    def test_staged_alias_change_after_sample_refuses_before_handoff(self):
        def sample(*args):
            (adoption.ADMISSION/'helper-config.json').write_bytes(b'changed alias')
            return {'target':self.target}
        self.control.running_entry_admission.side_effect=sample
        with self.assertRaisesRegex(RuntimeError,'^executor_staged_source_changed$'):
            self.run_operation()
        self.assertFalse(adoption.HANDOFF.exists())
        self.assertTrue(adoption.INTENT.exists())

    def test_same_bytes_replaced_intent_is_not_continuation_authority(self):
        def sample(*args):
            raw=adoption.INTENT.read_bytes()
            replacement=adoption.ROOT/'replacement';replacement.write_bytes(raw);replacement.chmod(0o600)
            os.replace(replacement,adoption.INTENT)
            return {'target':self.target}
        self.control.running_entry_admission.side_effect=sample
        with self.assertRaisesRegex(RuntimeError,'^running_adoption_identity_changed$'):
            self.run_operation()
        self.assertFalse(adoption.HANDOFF.exists())

    def test_final_close_refusal_retains_completed_success_and_handoff(self):
        lock_fd=None
        real_close=os.close
        def acquire(_):
            nonlocal lock_fd
            lock_fd=os.open(adoption.ROOT/'control.lock',os.O_RDWR|os.O_CLOEXEC)
            return lock_fd
        def close(fd):
            real_close(fd)
            if fd==lock_fd:raise OSError('injected control-close failure')
        with mock.patch.object(adoption.setup,'acquire_control',side_effect=acquire), \
                mock.patch.object(adoption.os,'close',side_effect=close):
            with self.assertRaisesRegex(RuntimeError,'^setup_lock_close_failed$') as caught:
                self.run_operation()
        proof=caught.exception.runningAdoptionCompletedPublication
        self.assertEqual(proof['successReceiptSha256'],packet.sha(adoption.SUCCESS.read_bytes()))
        self.assertEqual(proof['observedCommittedHandoffSha256'],packet.sha(adoption.HANDOFF.read_bytes()))
        self.assertIs(proof['continuationAllowed'],False)
        self.assertIs(proof['predecessorCleanupUnknownRetained'],True)


if __name__=='__main__':unittest.main()
