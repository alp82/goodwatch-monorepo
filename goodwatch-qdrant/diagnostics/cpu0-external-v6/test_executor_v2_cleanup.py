"""Cleanup dispatch composition with explicit injected process/census seams."""
import os
from pathlib import Path
import sys
import types
import unittest
from unittest import mock

import executor_v2 as executor
import running_adoption as adoption
import test_executor_v2 as recipe_fixture


class EarlyCleanupTests(unittest.TestCase):
    def setUp(self):
        recipe_fixture.RecipeBoundaryTests.setUp(self)
        root=self.path.parent
        self.enterContext(mock.patch.object(adoption,'STAGE',root/adoption.STAGE.name))
        self.enterContext(mock.patch.object(adoption,'HANDOFF',root/adoption.HANDOFF.name))
        self.life=mock.Mock();self.control=mock.Mock()
        self.enterContext(mock.patch.object(executor,'load_first_lifecycle_v2',return_value=self.life))
        self.ctx=self.enterContext(mock.patch.object(executor,'context',return_value=(
            {'lifecycle_cpu0':self.life,'controller_cpu0':self.control},None,None,None,None,None,None)))
        self.prior=self.enterContext(mock.patch.object(executor,'prior',return_value={'writers':'injected verified census'}))
        self.controls=self.enterContext(mock.patch.object(executor.census_v2,'proc_controls',return_value={'activeReviewedControls':0}))
        self.acquire=self.enterContext(mock.patch.object(executor.setup,'acquire_control'))
        self.registration=types.ModuleType('registration_v2')
        self.registration.ENROLMENT=root/'cpu0-consumer-enrolment-v2.json'
        self.registration.cleanup_from_receipts=mock.Mock()
        self.enterContext(mock.patch.dict(sys.modules,{'registration_v2':self.registration}))

    def late_cleanup(self):
        adoption.HANDOFF.write_bytes(b'authenticated handoff stand-in')
        self.life.secure_json.return_value=({'fixture':True},'a'*64,None)
        committed={'sha256':'b'*64,'fixture':'new committed handoff'}
        self.life.commit_handoff.return_value=committed
        fd=os.open(self.path.parent/'owned-control',os.O_RDWR|os.O_CREAT,0o600)
        self.acquire.return_value=fd
        original_close=os.close
        def failed_close(value):
            if value!=fd:return original_close(value)
            original_close(value)
            raise OSError('fixture close observation failure')
        return committed,failed_close

    def test_cleanup_completed_handoff_survives_failed_close(self):
        committed,close=self.late_cleanup()
        with mock.patch.object(executor.os,'close',side_effect=close):
            with self.assertRaisesRegex(RuntimeError,'^setup_lock_close_failed$') as caught:
                executor.cleanup(self.arguments)
        failure=caught.exception
        self.assertEqual(failure.executorCompletedOperationReceipt['operation'],'cleanup')
        self.assertEqual(failure.executorCompletedOperationReceipt['receipt'],committed)
        self.assertIs(failure.executorCompletedOperationReceipt['continuationAllowed'],False)
        self.assertEqual(failure.cleanupObservedHandoff['observedCommittedHandoffSha256'],'b'*64)
        self.assertIs(failure.executorControlCleanupFailure['descriptorCloseObserved'],False)
        self.prior.assert_called_once();self.controls.assert_called_once()
        self.life.pair_snapshot.assert_called_once()

    def test_cleanup_primary_numeric_refusal_survives_failed_close(self):
        _,close=self.late_cleanup()
        primary=RuntimeError('host_memory_unproven')
        primary.admissionFailureEvidence={'hostMemAvailableBytes':123,'requiredBytes':456}
        self.life.read_handoff.side_effect=primary
        with mock.patch.object(executor.os,'close',side_effect=close):
            with self.assertRaises(RuntimeError) as caught:executor.cleanup(self.arguments)
        self.assertIs(caught.exception,primary)
        self.assertEqual(primary.admissionFailureEvidence,{'hostMemAvailableBytes':123,'requiredBytes':456})
        self.assertIs(primary.executorControlCleanupFailure['descriptorCloseObserved'],False)
        self.assertFalse(hasattr(primary,'executorCompletedOperationReceipt'))
        self.assertEqual(primary.cleanupObservedHandoff['observedCommittedHandoffSha256'],'a'*64)
        self.life.commit_handoff.assert_not_called()
        self.prior.assert_called_once();self.controls.assert_called_once()
        self.life.pair_snapshot.assert_called_once()

    def test_no_full_stage_or_handoff_still_reaches_metadata_cleanup(self):
        result=executor.cleanup(self.arguments)
        self.assertEqual(result['schema'],'cpu0-external-cleanup.v7')
        self.assertIs(result['consumer']['enrolmentObserved'],False)
        self.assertIs(result['consumer']['registeredBirthAbsenceProven'],False)
        self.assertIsNone(result['handoff'])
        self.assertIs(result['rootLockAvailable'],False)
        self.ctx.assert_called_once_with(self.arguments,adoption.ADMISSION)
        self.prior.assert_called_once();self.controls.assert_called_once()
        self.life.pair_snapshot.assert_called_once()
        self.acquire.assert_not_called()

    def test_consumer_refusal_cannot_suppress_independent_censuses(self):
        self.registration.ENROLMENT.write_bytes(b'injected record')
        failure=RuntimeError('consumer_registration_changed')
        failure.consumerCleanupEvidence={'signalSent':False,'unknownRetained':True}
        self.registration.cleanup_from_receipts.side_effect=failure
        self.arguments['externalManifestSha256']='a'*64
        with self.assertRaises(RuntimeError) as caught:executor.cleanup(self.arguments)
        self.assertIs(caught.exception,failure)
        evidence=failure.cleanupIndependentEvidence
        self.assertIs(evidence['consumer']['stateUnknown'],True)
        self.assertEqual(evidence['consumerCleanupEvidence'],failure.consumerCleanupEvidence)
        self.assertIs(evidence['controls']['observed'],True)
        self.assertIs(evidence['prior']['observed'],True)
        self.assertIs(evidence['pair']['observed'],True)
        self.prior.assert_called_once();self.controls.assert_called_once()
        self.acquire.assert_not_called()

    def test_partial_full_stage_refuses_but_all_metadata_censuses_are_attempted(self):
        adoption.STAGE.mkdir(mode=0o700)
        with self.assertRaises(FileNotFoundError) as caught:executor.cleanup(self.arguments)
        evidence=caught.exception.cleanupIndependentEvidence
        self.assertIs(evidence['recipe']['stateUnknown'],True)
        self.assertIs(evidence['controls']['observed'],True)
        self.assertIs(evidence['prior']['observed'],True)
        self.assertIs(evidence['pair']['observed'],True)
        self.prior.assert_called_once();self.controls.assert_called_once()
        self.acquire.assert_not_called()


if __name__=='__main__':unittest.main()
