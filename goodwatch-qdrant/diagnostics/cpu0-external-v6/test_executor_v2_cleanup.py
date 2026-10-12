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
