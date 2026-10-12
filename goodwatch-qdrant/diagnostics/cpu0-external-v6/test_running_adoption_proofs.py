"""Local immutable predecessor checks; no host operations or action authority."""
import copy
import hashlib
import json
from pathlib import Path
import unittest
from unittest import mock

import running_adoption_proofs as proofs


class RunningAdoptionProofTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        evidence = Path(__file__).resolve().parents[3] / 'docs/implementation/search-ranking/cpu0-never-started-recovery-actual-20261012'
        cls.failure_raw = (evidence / 'root-execution-public.ndjson').read_bytes()
        cls.memory_raw = (evidence / 'root-recovery-readonly-memory-public.json').read_bytes()

    def test_published_observations_never_authorize_current_admission(self):
        value = proofs.observations(self.failure_raw, self.memory_raw)
        self.assertEqual(value['qdrantStartTicks'], 3066626708)
        self.assertEqual(value['newState']['startedAt'], proofs.NEW_STARTED_AT)
        for key in ('currentBirthAttested', 'currentAdmissionPassed', 'continuationAllowed'):
            self.assertIs(value[key], False)
        self.assertIs(value['predecessorCleanupUnknownRetained'], True)

    def test_hash_boundary_rejects_byte_drift_and_wrong_raw_type(self):
        for raw in (self.failure_raw + b' ', b'', self.failure_raw.decode(), bytearray(self.failure_raw)):
            with self.subTest(raw_type=type(raw).__name__):
                with self.assertRaisesRegex(RuntimeError, '^running_adoption_proof_invalid$'):
                    proofs.observations(raw, self.memory_raw)
        with self.assertRaisesRegex(RuntimeError, '^running_adoption_proof_invalid$'):
            proofs.observations(self.failure_raw, self.memory_raw + b' ')

    def test_authenticated_json_rejects_duplicate_keys_and_non_objects(self):
        for raw in (b'{"state":0,"state":1}', b'[]', b'null', b'{"state":'):
            with self.subTest(raw=raw):
                with self.assertRaisesRegex(RuntimeError, '^running_adoption_proof_invalid$'):
                    proofs.authenticated_json(raw, hashlib.sha256(raw).hexdigest())

    def test_semantic_binding_rejects_changed_birth_and_cleanup_claims(self):
        # Exercise semantic checks independently after the byte-authentication
        # boundary; production never bypasses that boundary.
        mutations = (
            ('receipt', 'allRegisteredLifecycleExitsProven', True),
            ('receipt', 'historyWrites', False),
            ('receipt', 'ordinarySearches', True),
            ('receipt', 'frames', [{}]),
            ('remote', 'continuationAllowed', True),
            ('recovery', 'attemptSha256', '0' * 64),
            ('recovery', 'httpStatus', True),
            ('new', 'startedAt', '2026-10-12T20:00:00Z'),
            ('new', 'running', False),
            ('new', 'restartCount', False),
            ('old', 'running', True),
            ('memory', 'signals', False),
            ('state', 'Pid', 3833293),
            ('qdrant', 'startTicks', 3066626709),
            ('qdrant', 'lockedBytes', 4096),
        )
        for owner, key, value in mutations:
            frame, memory = json.loads(self.failure_raw), json.loads(self.memory_raw)
            receipt = frame['receipt']
            remote = receipt['remoteFailureEvidence']
            recovery = remote['recoveryFailureEvidence']
            owners = {'receipt': receipt, 'remote': remote, 'recovery': recovery,
                      'new': recovery['endpoints']['new']['state'],
                      'old': recovery['endpoints']['old']['state'],
                      'memory': memory, 'state': memory['newCloneState'],
                      'qdrant': next(row for row in memory['largestRss'] if row['comm'] == 'qdrant')}
            owners[owner][key] = value
            with self.subTest(owner=owner, key=key):
                with mock.patch.object(proofs, 'authenticated_json', side_effect=[frame, memory]):
                    with self.assertRaisesRegex(RuntimeError, '^running_adoption_proof_invalid$'):
                        proofs.observations(self.failure_raw, self.memory_raw)

    def test_missing_or_ambiguous_qdrant_observation_refuses(self):
        for mode in ('missing', 'duplicate'):
            frame, memory = json.loads(self.failure_raw), json.loads(self.memory_raw)
            qdrant = next(row for row in memory['largestRss'] if row['comm'] == 'qdrant')
            if mode == 'missing':
                memory['largestRss'].remove(qdrant)
            else:
                memory['largestRss'].append(copy.deepcopy(qdrant))
            with self.subTest(mode=mode):
                with mock.patch.object(proofs, 'authenticated_json', side_effect=[frame, memory]):
                    with self.assertRaisesRegex(RuntimeError, '^running_adoption_proof_invalid$'):
                        proofs.observations(self.failure_raw, self.memory_raw)


if __name__ == '__main__':
    unittest.main()
