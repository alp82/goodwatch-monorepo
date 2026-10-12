"""Actual three executor wrappers with explicit injected backend/FD seams."""
import base64
import types
import unittest
from unittest import mock

import executor_v2 as executor
import running_adoption as adoption


class OperationCloseTests(unittest.TestCase):
    def run_wrapper(self,operation,*,body_error=None):
        life=mock.Mock();control=mock.Mock();gate=mock.Mock()
        receipt={'handoff':{'public':'already-committed'}}
        life.commit_handoff.return_value=receipt['handoff']
        control.birth_admission.return_value={'public':'admitted'}
        stage=mock.Mock(return_value=receipt,side_effect=body_error)
        if operation=='outer-admit':control.birth_admission.side_effect=body_error
        if operation=='turnover':
            def emit(config,spec,policy,output,fd,previous):
                if body_error:raise body_error
                output({'stage':'complete','handoff':receipt['handoff']})
            gate.stage.side_effect=emit
        args={'fullFiles':{'fixture':base64.b64encode(b'public').decode()},
              'fullManifest':base64.b64encode(b'{}').decode(),
              'externalManifestSha256':'a'*64,'predecessorSha256':'b'*64,
              'nodeReceiptSha256':'c'*64}
        modules={'lifecycle_cpu0':life,'controller_cpu0':control,'turnover_gate_cpu0':gate}
        with mock.patch.object(executor,'context',return_value=(modules,{},None,None,None,'d'*64,None)), \
             mock.patch.object(executor,'prior',return_value={'writers':{'recordedWritersGone':True}}), \
             mock.patch.object(executor.stager_v2,'stage_public',stage), \
             mock.patch.object(executor.setup,'acquire_control',return_value=55), \
             mock.patch.object(executor.os,'close',side_effect=OSError('injected descriptor close')), \
             mock.patch.object(executor,'backend_packet',return_value=(b'{}','d'*64,{})), \
             mock.patch.object(executor,'load_first_lifecycle_v2',return_value=life):
            with self.assertRaises(RuntimeError) as caught:
                executor.dispatch(operation,args)
        return caught.exception

    def test_all_three_refused_operations_preserve_original_cause_and_numeric_proof(self):
        for operation in ('stage','outer-admit','turnover'):
            with self.subTest(operation=operation):
                original=RuntimeError('host_emergency_floor')
                original.admissionPassedSampleBeforeRefence={'actualAvailableBytes':5*1024**3}
                original.sourceLimitFailureEvidence={'memoryMaxBytes':6*1024**3,'memorySwapMaxBytes':0}
                original.pressureMemoryFailureEvidence={'publicNumericFixture':1}
                original.consumerEnrolmentCleanupFailure='consumer_enrolment_close_failed'
                original.admissionFailureEvidence={'actualAvailableBytes':4*1024**3,'strictFloorBytes':4*1024**3}
                error=self.run_wrapper(operation,body_error=original)
                self.assertIs(error,original)
                self.assertEqual(error.publicFailure['reason'],'host_emergency_floor')
                self.assertEqual(error.publicFailure['admissionFailureEvidence'],original.admissionFailureEvidence)
                self.assertEqual(error.publicFailure['executorControlCleanupFailure']['reason'],'setup_lock_close_failed')
                for field in ('admissionPassedSampleBeforeRefence','sourceLimitFailureEvidence','pressureMemoryFailureEvidence'):
                    self.assertEqual(error.publicFailure[field],getattr(original,field))
                self.assertEqual(error.publicFailure['consumerEnrolmentCleanupFailure'],'consumer_enrolment_close_failed')
                self.assertFalse(error.publicFailure['continuationAllowed'])

    def test_all_three_completed_receipts_survive_close_refusal_without_success(self):
        for operation in ('stage','outer-admit','turnover'):
            with self.subTest(operation=operation):
                error=self.run_wrapper(operation)
                self.assertEqual(error.args,('setup_lock_close_failed',))
                retained=error.publicFailure['executorCompletedOperationReceipt']
                self.assertEqual(retained['operation'],operation)
                self.assertFalse(retained['continuationAllowed'])
                if operation=='turnover':
                    self.assertEqual(retained['receipt']['frames'][0]['stage'],'complete')
                else:self.assertEqual(retained['receipt']['handoff'],{'public':'already-committed'})
                self.assertFalse(error.publicFailure['executorControlCleanupFailure']['descriptorCloseObserved'])


if __name__=='__main__':unittest.main()
