"""Closed successor byte boundaries before imports; local public fixtures only."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

import packet
import stager


class SuccessorPacketTests(unittest.TestCase):
    def test_closed_json_rejects_duplicate_and_nonfinite_recipes(self):
        files,_,raw=self.source()
        changed=raw.rstrip()[:-1]+b',"preparedOnly":true}\n'
        with self.assertRaisesRegex(RuntimeError,'^source_freeze_invalid$'):
            packet.verify_source_v2(changed,packet.sha(changed),files)
        for raw in (b'{"count":NaN}',b'{"nested":{"role":1,"role":2}}'):
            with self.subTest(raw=raw):
                with self.assertRaises(ValueError):packet.closed_json(raw)

    def test_once_staging_partial_write_retains_scope_and_second_attempt_refuses(self):
        with tempfile.TemporaryDirectory() as tmp:
            parent=Path(tmp);parent.chmod(0o700);stage=parent/'new-stage'
            with mock.patch.object(packet.os,'fsync',side_effect=OSError('fixture fsync')):
                with self.assertRaises(OSError) as caught:
                    packet.stage_absent_once(stage,{'first.py':b'first\n','second.py':b'second\n'},uid=os.getuid())
            self.assertEqual((stage/'first.py').read_bytes(),b'first\n')
            self.assertFalse((stage/'second.py').exists())
            proof=caught.exception.stageFailureEvidence
            self.assertIs(proof['directoryRetained'],True)
            self.assertIs(proof['automaticRollback'],False)
            self.assertEqual((proof['filesCreated'],proof['filesCompleted']),(1,0))
            with self.assertRaises(FileExistsError):
                packet.stage_absent_once(stage,{'first.py':b'retry\n'},uid=os.getuid())
            self.assertEqual((stage/'first.py').read_bytes(),b'first\n')

    def test_once_staging_success_keeps_closed_files_and_modes(self):
        with tempfile.TemporaryDirectory() as tmp:
            parent=Path(tmp);parent.chmod(0o700);stage=parent/'new-stage'
            result=packet.stage_absent_once(stage,{'public.py':b'public\n'},uid=os.getuid())
            self.assertEqual(result['filesCompleted'],1)
            self.assertIs(result['automaticRollback'],False)
            self.assertEqual((stage/'public.py').stat().st_mode&0o777,0o600)
            self.assertEqual(stage.stat().st_mode&0o777,0o700)

    def test_once_staging_directory_attestation_failure_retains_creation_fact(self):
        with tempfile.TemporaryDirectory() as tmp:
            parent=Path(tmp);parent.chmod(0o700);stage=parent/'new-stage'
            with mock.patch.object(packet,'directory',side_effect=[(1,2),RuntimeError('fixture-directory')]):
                with self.assertRaisesRegex(RuntimeError,'^fixture-directory$') as caught:
                    packet.stage_absent_once(stage,{'public.py':b'public\n'},uid=os.getuid())
            self.assertIs(caught.exception.stageFailureEvidence['directoryCreated'],True)
            self.assertIs(caught.exception.stageFailureEvidence['directoryRetained'],True)
            self.assertEqual(caught.exception.stageFailureEvidence['filesCreated'],0)

    def source(self):
        files={name:b'# public fixture\n' for name in packet.SOURCE_NAMES}
        files['lifecycle_cpu0.py']=b'observed_fixture=17\n'
        manifest={'schema':'search.clone-cpu0-fixed-source-freeze.v2',
                  'variant':'cpu0-fixed-capacity.v2','preparedOnly':True,
                  'files':{name:packet.sha(raw) for name,raw in files.items()}}
        raw=packet.canonical(manifest)+b'\n'
        return files,manifest,raw

    def test_v2_loader_authenticates_complete_closure_before_lifecycle_exec(self):
        files,manifest,raw=self.source()
        accepted=packet.load_first_lifecycle_v2(raw,packet.sha(raw),files)
        self.assertEqual(accepted.observed_fixture,17)
        self.assertEqual(accepted._AUTHENTICATED_SOURCE_SHA256,manifest['files']['lifecycle_cpu0.py'])
        files['lifecycle_cpu0.py']=b'raise AssertionError("must never execute")\n'
        manifest['files']['lifecycle_cpu0.py']=packet.sha(files['lifecycle_cpu0.py'])
        raw=packet.canonical(manifest)+b'\n'
        files['CPU0.md']+=b'changed\n'
        with self.assertRaisesRegex(RuntimeError,'^source_file_changed$'):
            packet.load_first_lifecycle_v2(raw,packet.sha(raw),files)

    def test_v1_and_v2_recipes_are_not_interchangeable(self):
        files,manifest,raw=self.source()
        with self.assertRaisesRegex(RuntimeError,'^source_freeze_invalid$'):
            packet.verify_source(raw,packet.sha(raw),files)
        manifest.update(schema='search.clone-cpu0-owned-source-freeze.v1',variant='cpu0-owned-lifecycle.v1')
        raw=packet.canonical(manifest)+b'\n'
        packet.verify_source(raw,packet.sha(raw),files)
        with self.assertRaisesRegex(RuntimeError,'^source_freeze_invalid$'):
            packet.verify_source_v2(raw,packet.sha(raw),files)

    def test_v2_schema_is_closed_and_still_requires_all_fourteen_files(self):
        files,manifest,raw=self.source()
        manifest['admitted']=True;raw=packet.canonical(manifest)+b'\n'
        with self.assertRaisesRegex(RuntimeError,'^source_freeze_invalid$'):
            packet.verify_source_v2(raw,packet.sha(raw),files)
        manifest.pop('admitted');files.pop('cpu0_guards.py')
        raw=packet.canonical(manifest)+b'\n'
        with self.assertRaisesRegex(RuntimeError,'^source_closure_incomplete$'):
            packet.verify_source_v2(raw,packet.sha(raw),files)

    def full(self):
        files,_,source_raw=self.source()
        full={**files,'cpu0-source-freeze.json':source_raw,
              'helper-config.json':files['prepared-helper-policy-cpu0.json'],
              'controller-config.json':files['prepared-control-policy-cpu0.json']}
        for name in stager.FULL_NAMES-set(full):full[name]=b'// public fixture\n'
        full['prepare_clone_reclaim.py']=(Path(__file__).resolve().parents[1]/'clone-preparation/prepare_clone_reclaim.py').read_bytes()
        source_sha=packet.sha(source_raw)
        manifest={'schema':'cpu0-full-public-packet.v7','variant':'cpu0-fixed-capacity.v2',
                  'sourceFreezeSha256':source_sha,'files':{name:packet.sha(raw) for name,raw in full.items()}}
        return full,manifest,source_sha

    def test_v2_full_manifest_requires_exact_recipe_and_alias_bytes(self):
        full,manifest,source_sha=self.full()
        raw=packet.canonical(manifest)+b'\n'
        stager.verify_full_v2(raw,packet.sha(raw),full,source_sha)
        with self.assertRaisesRegex(RuntimeError,'^external_manifest_invalid$'):
            stager.verify_full(raw,packet.sha(raw),full,source_sha)
        full['controller-config.json']+=b'changed\n'
        manifest['files']['controller-config.json']=packet.sha(full['controller-config.json'])
        raw=packet.canonical(manifest)+b'\n'
        with self.assertRaisesRegex(RuntimeError,'^external_policy_alias_changed$'):
            stager.verify_full_v2(raw,packet.sha(raw),full,source_sha)

    def test_v2_full_manifest_rejects_mixed_source_recipe(self):
        full,manifest,source_sha=self.full()
        source=json.loads(full['cpu0-source-freeze.json'])
        source.update(schema='search.clone-cpu0-owned-source-freeze.v1',variant='cpu0-owned-lifecycle.v1')
        full['cpu0-source-freeze.json']=packet.canonical(source)+b'\n'
        source_sha=packet.sha(full['cpu0-source-freeze.json'])
        manifest['sourceFreezeSha256']=source_sha
        manifest['files']['cpu0-source-freeze.json']=source_sha
        raw=packet.canonical(manifest)+b'\n'
        with self.assertRaisesRegex(RuntimeError,'^source_freeze_invalid$'):
            stager.verify_full_v2(raw,packet.sha(raw),full,source_sha)


if __name__=='__main__':unittest.main()
