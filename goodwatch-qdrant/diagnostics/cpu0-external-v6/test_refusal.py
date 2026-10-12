import json
import types
import unittest
from unittest import mock
import executor
import packet
import outer_local


class RefusalTests(unittest.TestCase):
    def test_original_producer_cleanup_and_attach_client_failure_survive_dispatch(self):
        original=RuntimeError('producer_image_changed')
        original.producerCleanupEvidence={'containerGone':True,'birthGone':None,'cleanupAttempted':False}
        original.producerClientCleanupFailure=True
        with mock.patch.object(executor.producer,'DockerBackend'),mock.patch.object(executor.producer,'execute',side_effect=original):
            with self.assertRaises(RuntimeError) as caught:executor.dispatch('producer-stream',{'remainingSeconds':10})
        self.assertIs(caught.exception,original)
        self.assertEqual(original.publicFailure['producerCleanupEvidence'],original.producerCleanupEvidence)
        self.assertTrue(original.publicFailure['producerClientCleanupFailure'])

    def test_consumer_cleanup_refusal_cannot_skip_handoff_pair_or_writer_census(self):
        original=RuntimeError('consumer_birth_changed');calls=[]
        record={'sourceFreezeSha256':'a'*64,'externalManifestSha256':'b'*64}
        life=types.SimpleNamespace(secure_json=lambda path:(calls.append('handoff') or {},'h'*64,None),pair_snapshot=lambda docker:calls.append('pair') or {'observed':'fixture'})
        with mock.patch.object(executor.os.path,'lexists',return_value=True),mock.patch.object(executor,'read_owned',return_value=(packet.canonical(record),None)),mock.patch.object(executor.registration,'cleanup',side_effect=original),mock.patch.object(executor,'prior',side_effect=lambda *args:calls.append('writers') or {'recordedWritersGone':False}),mock.patch.object(executor.setup,'acquire_control') as lock:
            with self.assertRaises(RuntimeError) as caught:executor.cleanup_phase({'externalManifestSha256':'b'*64},life,None,'a'*64)
        self.assertIs(caught.exception,original);self.assertEqual(calls,['handoff','writers','pair']);lock.assert_not_called()
        self.assertEqual(original.cleanupObservedHandoff['observedCommittedHandoffSha256'],'h'*64)
        self.assertTrue(original.cleanupIndependentEvidence['prior']['observed'])

    def test_unified_outer_fixed_reason_keeps_pipe_audit_and_bootstrap_literals(self):
        for reason in ('pipe_deadline','outer_consumer_audit_refused','bootstrap_guard_or_runtime_failure','control_freeze_changed','writer_birth_changed'):
            self.assertEqual(outer_local.fixed_reason(RuntimeError(reason)),reason)
        self.assertEqual(outer_local.fixed_reason(RuntimeError('arbitrary private error')),'outer_guard_or_runtime_failure')
        self.assertEqual(outer_local.fixed_reason(RuntimeError({'arbitrary':'private'})),'outer_guard_or_runtime_failure')


if __name__=='__main__':unittest.main()
