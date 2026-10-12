"""Fixed-scope local refusal fixtures; no hosts or execution closure."""
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

import packet
import running_adoption as adoption


class RunningAdoptionHelperTests(unittest.TestCase):
    def setUp(self):
        self.root=Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.root.chmod(0o700)
        self.enterContext(mock.patch.object(adoption,'ROOT',self.root))
        for name in ('ADMISSION','STAGE','LEGACY_ADMISSION','HANDOFF','INTENT','SUCCESS','ATTEMPT'):
            original=getattr(adoption,name)
            self.enterContext(mock.patch.object(adoption,name,self.root/original.name))
        # Local fixtures use their real non-root owner. Production calls retain
        # the packet boundary's fixed root owner and mode requirements.
        self.enterContext(mock.patch.object(adoption,'directory',side_effect=lambda path:packet.directory(path,uid=os.getuid())))
        self.enterContext(mock.patch.object(adoption,'read_owned',side_effect=lambda path,**kwargs:packet.read_owned(path,uid=os.getuid(),**kwargs)))

    def legacy_fixture(self):
        adoption.LEGACY_ADMISSION.mkdir(mode=0o700)
        expected={}
        for name in adoption.LEGACY_FILES:
            raw=('public-fixture:'+name).encode()
            path=adoption.LEGACY_ADMISSION/name;path.write_bytes(raw);path.chmod(0o600)
            expected[name]=packet.sha(raw)
        self.enterContext(mock.patch.object(adoption,'LEGACY_FILES',expected))

    def test_legacy_scope_binds_all_seventeen_files_and_rejects_changes(self):
        self.legacy_fixture()
        before=adoption.legacy_files()
        self.assertEqual(len(before['files']),17)
        self.assertEqual(adoption.legacy_files(),before)
        changed=adoption.LEGACY_ADMISSION/'controller-config.json'
        changed.write_bytes(b'changed')
        with self.assertRaisesRegex(RuntimeError,'^running_adoption_legacy_changed$'):
            adoption.legacy_files()

    def test_legacy_extra_entry_is_not_a_reusable_scope(self):
        self.legacy_fixture()
        (adoption.LEGACY_ADMISSION/'extra').write_bytes(b'foreign')
        with self.assertRaisesRegex(RuntimeError,'^running_adoption_legacy_changed$'):
            adoption.legacy_files()

    def test_observed_read_detects_replacement_after_authenticated_read(self):
        path=self.root/'proof';path.write_bytes(b'public');path.chmod(0o600)
        replacement=self.root/'replacement';replacement.write_bytes(b'public');replacement.chmod(0o600)
        def changed(path,**kwargs):
            result=packet.read_owned(path,uid=os.getuid(),**kwargs)
            os.replace(replacement,path)
            return result
        with mock.patch.object(adoption,'read_owned',side_effect=changed):
            with self.assertRaisesRegex(RuntimeError,'^running_adoption_observation_changed$'):
                adoption.observed_read(path)

    def test_attempt_is_pinned_and_start_flag_is_type_exact(self):
        value={'schema':'cpu0-never-started-recovery-attempt.v1',
               'mode':'recover-created-never-started.v1',
               'sourceFreezeSha256':adoption.LEGACY_SOURCE_SHA,'startIssued':False}
        raw=packet.canonical(value)+b'\n'
        adoption.ATTEMPT.write_bytes(raw);adoption.ATTEMPT.chmod(0o600)
        with mock.patch.object(adoption.proofs,'ATTEMPT_SHA',packet.sha(raw)):
            first=adoption.spent_recovery_attempt()
            self.assertEqual(adoption.spent_recovery_attempt(),first)
            adoption.ATTEMPT.write_bytes(raw+b' ')
            with self.assertRaisesRegex(RuntimeError,'^running_adoption_attempt_changed$'):
                adoption.spent_recovery_attempt()
        value['startIssued']=0;raw=packet.canonical(value)+b'\n';adoption.ATTEMPT.write_bytes(raw)
        with mock.patch.object(adoption.proofs,'ATTEMPT_SHA',packet.sha(raw)):
            with self.assertRaisesRegex(RuntimeError,'^running_adoption_attempt_changed$'):
                adoption.spent_recovery_attempt()

    def test_every_new_scope_and_old_handoff_blocks_before_staging(self):
        paths=(adoption.ADMISSION,adoption.STAGE,adoption.HANDOFF,adoption.INTENT,adoption.SUCCESS,
               self.root/'cpu0-lifecycle-handoff-v1.json',self.root/'cpu0-consumer-enrolment-v2.json')
        adoption.require_absent_scope()
        for path in paths:
            with self.subTest(path=path.name):
                path.write_bytes(b'consumed')
                with self.assertRaisesRegex(RuntimeError,'^running_adoption_scope_changed$'):
                    adoption.require_absent_scope()
                self.assertEqual(path.read_bytes(),b'consumed')
                path.unlink()  # local independent fixture, never a runtime retry

    def test_inspection_interface_rejects_all_mutation_or_foreign_dispatch(self):
        with mock.patch.object(adoption.setup,'Docker') as docker:
            client=adoption.InspectOnly()
            for args in (('start',adoption.setup.NEW),('stop',adoption.setup.NEW),
                         ('create',),('remove',adoption.setup.NEW),('update',adoption.setup.NEW),
                         ('inspect','foreign'),('inspect',adoption.setup.IMAGE)):
                with self.subTest(args=args):
                    with self.assertRaisesRegex(RuntimeError,'^running_adoption_inspect_only$'):client(*args)
            docker.assert_not_called()
            docker.return_value.return_value='[]'
            self.assertEqual(client('inspect',adoption.setup.NEW),'[]')
            docker.return_value.assert_called_once_with('inspect',adoption.setup.NEW)

    def test_derivative_changes_only_two_fixed_aliases(self):
        value={'schema':'clone-pin-control.cpu0-fixed.v2',
               'helperConfig':str(adoption.STAGE/'helper-config.json'),
               'lifecycle':{'modulePath':str(adoption.STAGE/'lifecycle_cpu0.py'),
                            'handoffPath':str(adoption.HANDOFF)},'untouched':{'reserveBytes':2*1024**3}}
        raw=packet.canonical(value)+b'\n'
        changed=packet.closed_json(adoption.derivative_policy(raw,packet.sha(raw)))
        self.assertEqual(changed['helperConfig'],str(adoption.ADMISSION/'helper-config.json'))
        self.assertEqual(changed['lifecycle']['modulePath'],str(adoption.ADMISSION/'lifecycle_cpu0.py'))
        changed['helperConfig']=value['helperConfig'];changed['lifecycle']['modulePath']=value['lifecycle']['modulePath']
        self.assertEqual(changed,value)
        value['schema']='clone-pin-control.cpu0-owned.v1';raw=packet.canonical(value)+b'\n'
        with self.assertRaisesRegex(RuntimeError,'^admission_derivative_source_changed$'):
            adoption.derivative_policy(raw,packet.sha(raw))

    def test_publication_retains_partial_intent_and_blocks_replacement(self):
        life=mock.Mock();value={'schema':'public-fixture','intent':True}
        with mock.patch.object(adoption.os,'fsync',side_effect=OSError('fixture fsync')):
            with self.assertRaises(OSError) as caught:
                adoption.publish(adoption.INTENT,value,life,71)
        proof=caught.exception.runningAdoptionPublicationEvidence
        self.assertIs(proof['fileCreated'],True)
        self.assertIs(proof['writeCompleted'],True)
        self.assertIs(proof['fileFsyncCompleted'],False)
        self.assertIs(proof['readbackVerified'],False)
        self.assertIsNone(proof['observedSha256'])
        self.assertIs(proof['fileRetained'],True)
        original=adoption.INTENT.read_bytes()
        with self.assertRaises(FileExistsError):adoption.publish(adoption.INTENT,{'changed':True},life,71)
        self.assertEqual(adoption.INTENT.read_bytes(),original)

    def test_publication_exact_readback_and_separate_post_lock_refusal(self):
        life=mock.Mock();value={'schema':'public-fixture','intent':True}
        life.require_lock.side_effect=[None,RuntimeError('fixture-lock-drift')]
        with self.assertRaisesRegex(RuntimeError,'^fixture-lock-drift$') as caught:
            adoption.publish(adoption.HANDOFF,value,life,71)
        proof=caught.exception.runningAdoptionPublicationEvidence
        self.assertIs(proof['directoryFsyncCompleted'],True)
        self.assertIs(proof['readbackVerified'],True)
        self.assertEqual(proof['observedSha256'],packet.sha(adoption.HANDOFF.read_bytes()))
        self.assertIs(proof['continuationAllowed'],False)

    def test_fdopen_failure_keeps_original_cause_when_close_also_fails(self):
        original=OSError('fixture fdopen failed')
        real_close=os.close
        def close_then_fail(fd):
            real_close(fd)
            raise OSError('fixture close failed')
        with mock.patch.object(adoption.os,'fdopen',side_effect=original), \
                mock.patch.object(adoption.os,'close',side_effect=close_then_fail):
            with self.assertRaises(OSError) as caught:
                adoption.publish(adoption.INTENT,{'public':True},mock.Mock(),71)
        self.assertIs(caught.exception,original)
        proof=caught.exception.runningAdoptionPublicationEvidence
        self.assertIs(proof['fileCreated'],True)
        self.assertIs(proof['descriptorCloseFailed'],True)
        self.assertIs(proof['writeCompleted'],False)
        self.assertIs(proof['fileRetained'],True)

    def test_publication_foreign_path_and_handoff_size_refuse_before_create(self):
        life=mock.Mock();foreign=self.root/'foreign.json'
        with self.assertRaisesRegex(RuntimeError,'^running_adoption_publication_scope$'):
            adoption.publish(foreign,{},life,71)
        self.assertFalse(foreign.exists())
        with self.assertRaisesRegex(RuntimeError,'^running_adoption_publication_bound$'):
            adoption.publish(adoption.HANDOFF,{'oversized':'x'*32768},life,71)
        self.assertFalse(adoption.HANDOFF.exists())

    def test_same_byte_replacement_during_readback_is_not_created_inode(self):
        original=adoption.observed_read
        def replaced(path,**kwargs):
            raw=path.read_bytes()
            replacement=self.root/'replacement';replacement.write_bytes(raw);replacement.chmod(0o600)
            os.replace(replacement,path)
            return original(path,**kwargs)
        with mock.patch.object(adoption,'observed_read',side_effect=replaced):
            with self.assertRaisesRegex(RuntimeError,'^running_adoption_publication_failed$') as caught:
                adoption.publish(adoption.INTENT,{'public':True},mock.Mock(),71)
        proof=caught.exception.runningAdoptionPublicationEvidence
        self.assertIs(proof['fileCreated'],True)
        self.assertIs(proof['readbackVerified'],False)
        self.assertIs(proof['continuationAllowed'],False)


if __name__=='__main__':unittest.main()
