"""Closed successor byte boundaries before imports; local public fixtures only."""
import json
import os
from pathlib import Path
import tempfile
import sys
import unittest
from unittest import mock

import packet
import stager


class SuccessorPacketTests(unittest.TestCase):
    def staged_fixture(self,parent):
        files,manifest,raw=self.source()
        stage=parent/'cpu0-admission-20261012-100-v2';stage.mkdir(mode=0o700)
        entries={**files,'cpu0-source-freeze.json':raw,'helper-config.json':b'fixture',
                 'controller-config.json':b'fixture'}
        for name,body in entries.items():
            path=stage/name;path.write_bytes(body);path.chmod(0o600)
        return stage,files,manifest,raw

    def local_owner_boundaries(self):
        from contextlib import ExitStack
        scope=ExitStack()
        original_directory=packet.directory;original_read=packet.read_owned;original_inventory=packet._v2_inventory
        scope.enter_context(mock.patch.object(packet,'directory',side_effect=lambda path,uid=0:original_directory(path,uid=os.getuid())))
        scope.enter_context(mock.patch.object(packet,'read_owned',side_effect=lambda path,**kwargs:original_read(path,uid=os.getuid(),**kwargs)))
        scope.enter_context(mock.patch.object(packet,'_v2_inventory',side_effect=lambda folder:original_inventory(folder,uid=os.getuid())))
        scope.enter_context(mock.patch.dict(sys.modules))
        scope.enter_context(mock.patch.object(sys,'path',list(sys.path)))
        for name in ('pin_cpu0','runtime_cpu0','cpu0_guards','daemon_cpu0','lifecycle_cpu0','controller_cpu0','cpu0_preflight','turnover_gate_cpu0'):
            sys.modules.pop(name,None)
        return scope

    def test_staged_v2_rejects_hostile_extra_and_pycache_before_exec(self):
        for name in ('shutil.py','__pycache__'):
            with self.subTest(name=name),tempfile.TemporaryDirectory() as tmp:
                parent=Path(tmp);parent.chmod(0o700)
                stage,files,_,raw=self.staged_fixture(parent)
                files['pin_cpu0.py']=b'import sys\nfrom pathlib import Path\nsys.path.insert(0,str(Path(__file__).parent))\nimport shutil\n'
                manifest=packet.closed_json(raw)
                manifest['files']['pin_cpu0.py']=packet.sha(files['pin_cpu0.py'])
                raw=packet.canonical(manifest)+b'\n'
                (stage/'pin_cpu0.py').write_bytes(files['pin_cpu0.py'])
                (stage/'cpu0-source-freeze.json').write_bytes(raw)
                sentinel=parent/'hostile-executed'
                if name.endswith('.py'):
                    extra=stage/name;extra.write_text(f'from pathlib import Path\nPath({str(sentinel)!r}).write_text("hostile")\n');extra.chmod(0o600)
                else:(stage/name).mkdir(mode=0o700)
                with self.local_owner_boundaries():
                    sys.modules.pop('shutil',None)
                    with self.assertRaisesRegex(RuntimeError,'^staged_source_inventory_invalid$'):
                        packet.load_staged_modules_v2(stage,raw,packet.sha(raw),files)
                self.assertFalse(sentinel.exists())

    def test_staged_v2_valid_closure_and_post_exec_inventory(self):
        with tempfile.TemporaryDirectory() as tmp:
            parent=Path(tmp);parent.chmod(0o700)
            stage,files,manifest,raw=self.staged_fixture(parent)
            with self.local_owner_boundaries():
                loaded=packet.load_staged_modules_v2(stage,raw,packet.sha(raw),files)
                self.assertEqual(loaded['lifecycle_cpu0'].observed_fixture,17)
            files['lifecycle_cpu0.py']=f'from pathlib import Path\nPath({str(stage/"undeclared.py")!r}).write_bytes(b"extra")\n'.encode()
            manifest['files']['lifecycle_cpu0.py']=packet.sha(files['lifecycle_cpu0.py'])
            raw=packet.canonical(manifest)+b'\n'
            (stage/'lifecycle_cpu0.py').write_bytes(files['lifecycle_cpu0.py'])
            (stage/'cpu0-source-freeze.json').write_bytes(raw)
            with self.local_owner_boundaries():
                with self.assertRaisesRegex(RuntimeError,'^staged_source_inventory_invalid$'):
                    packet.load_staged_modules_v2(stage,raw,packet.sha(raw),files)

    def test_guard_first_loader_and_shared_cached_v1_module_refusal(self):
        files,_,raw=self.source()
        guard=packet.load_first_guards_v2(raw,packet.sha(raw),files)
        self.assertEqual(guard._AUTHENTICATED_SOURCE_SHA256,packet.sha(files['cpu0_guards.py']))
        with tempfile.TemporaryDirectory() as tmp:
            parent=Path(tmp);parent.chmod(0o700)
            stage,files,_,raw=self.staged_fixture(parent)
            with self.local_owner_boundaries():
                sys.modules['pin_cpu0']=type(sys)('pin_cpu0')
                with self.assertRaisesRegex(RuntimeError,'^cached_source_untrusted$'):
                    packet.load_staged_modules_v2(stage,raw,packet.sha(raw),files)

    def test_full_inventory_names_match_and_nineteenth_writer_refuses(self):
        self.assertEqual(packet.V2_FULL_NAMES,stager.FULL_NAMES)
        with tempfile.TemporaryDirectory() as tmp:
            parent=Path(tmp);parent.chmod(0o700)
            stage=parent/'pin-control-20261012-100-cpu0-v2';stage.mkdir(mode=0o700)
            for name in packet.V2_FULL_NAMES|{'cpu0-external-manifest.json','node','node-provenance.json','pin-instance.lock'}:
                path=stage/name;path.write_bytes(b'fixture');path.chmod(0o700 if name=='node' else 0o600)
            for index in range(18):
                path=stage/f'reclaim-writer-{index}.json';path.write_bytes(b'{}');path.chmod(0o600)
            packet._v2_inventory(stage,uid=os.getuid())
            path=stage/'reclaim-writer-18.json';path.write_bytes(b'{}');path.chmod(0o600)
            with self.assertRaisesRegex(RuntimeError,'^staged_source_inventory_invalid$'):
                packet._v2_inventory(stage,uid=os.getuid())

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
            original_sync=os.fsync;calls=0
            def sync(fd):
                nonlocal calls
                calls+=1
                if calls==1:return original_sync(fd)
                raise OSError('fixture file fsync')
            with mock.patch.object(packet.os,'fsync',side_effect=sync):
                with self.assertRaises(OSError) as caught:
                    packet.stage_absent_once(stage,{'first.py':b'first\n','second.py':b'second\n'},uid=os.getuid())
            self.assertEqual((stage/'first.py').read_bytes(),b'first\n')
            self.assertFalse((stage/'second.py').exists())
            proof=caught.exception.stageFailureEvidence
            self.assertIs(proof['directoryRetained'],True)
            self.assertIs(proof['automaticRollback'],False)
            self.assertEqual((proof['filesCreated'],proof['filesCompleted']),(1,0))
            self.assertIs(proof['parentFsyncCompleted'],True)
            self.assertIs(proof['failureDurability']['directory']['fsyncCompleted'],False)
            self.assertIs(proof['failureDurability']['parent']['fsyncCompleted'],False)
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
            old_umask=os.umask(0o777)
            try:
                with self.assertRaisesRegex(RuntimeError,'^owned_directory_changed$') as caught:
                    packet.stage_absent_once(stage,{'public.py':b'public\n'},uid=os.getuid())
            finally:
                os.umask(old_umask)
                if stage.exists():stage.chmod(0o700)
            self.assertIs(caught.exception.stageFailureEvidence['directoryCreated'],True)
            self.assertIs(caught.exception.stageFailureEvidence['directoryRetained'],True)
            self.assertEqual(caught.exception.stageFailureEvidence['filesCreated'],0)

    def test_once_stage_parent_is_durable_before_first_file_open(self):
        with tempfile.TemporaryDirectory() as tmp:
            parent=Path(tmp);parent.chmod(0o700);stage=parent/'new-stage'
            original_sync=os.fsync;original_open=os.open;events=[]
            identity=(parent.stat().st_dev,parent.stat().st_ino)
            def sync(fd):
                info=os.fstat(fd)
                if (info.st_dev,info.st_ino)==identity:events.append('parent-fsync')
                return original_sync(fd)
            def opened(path,flags,*args,**kwargs):
                if Path(path)==stage/'public.py':events.append('file-open')
                return original_open(path,flags,*args,**kwargs)
            with mock.patch.object(packet.os,'fsync',side_effect=sync),mock.patch.object(packet.os,'open',side_effect=opened):
                packet.stage_absent_once(stage,{'public.py':b'public\n'},uid=os.getuid())
            self.assertLess(events.index('parent-fsync'),events.index('file-open'))

    def test_once_stage_parent_fsync_failure_records_failed_durability(self):
        with tempfile.TemporaryDirectory() as tmp:
            parent=Path(tmp);parent.chmod(0o700);stage=parent/'new-stage'
            with mock.patch.object(packet.os,'fsync',side_effect=OSError('fixture sync')):
                with self.assertRaises(OSError) as caught:
                    packet.stage_absent_once(stage,{'public.py':b'public\n'},uid=os.getuid())
            proof=caught.exception.stageFailureEvidence
            self.assertIs(proof['parentFsyncCompleted'],False)
            self.assertEqual(proof['filesCreated'],0)
            self.assertIs(proof['failureDurability']['parent']['fsyncCompleted'],False)
            self.assertTrue(stage.is_dir())

    def test_once_stage_fdopen_failure_closes_created_file_descriptor(self):
        with tempfile.TemporaryDirectory() as tmp:
            parent=Path(tmp);parent.chmod(0o700);stage=parent/'new-stage';observed=[]
            def fail(fd,*args,**kwargs):
                observed.append(fd);raise OSError('fixture fdopen')
            with mock.patch.object(packet.os,'fdopen',side_effect=fail):
                with self.assertRaises(OSError) as caught:
                    packet.stage_absent_once(stage,{'public.py':b'public\n'},uid=os.getuid())
            self.assertEqual(caught.exception.stageFailureEvidence['filesCreated'],1)
            self.assertEqual(caught.exception.stageFailureEvidence['fileDescriptorCloseFailures'],0)
            with self.assertRaises(OSError):os.fstat(observed[0])
            self.assertTrue((stage/'public.py').exists())

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

    def test_v2_prepared_flag_is_not_an_integer_truth(self):
        files,manifest,_=self.source();manifest['preparedOnly']=1
        raw=packet.canonical(manifest)+b'\n'
        with self.assertRaisesRegex(RuntimeError,'^source_freeze_invalid$'):
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

    def test_v2_full_manifest_rejects_unknown_keys_names_sizes_and_drift(self):
        for mode in ('unknown-key','duplicate-key','missing-file','extra-file','oversize','sha-drift'):
            full,manifest,source_sha=self.full()
            if mode=='unknown-key':manifest['accepted']=True
            elif mode=='missing-file':full.pop('parity.mjs');manifest['files'].pop('parity.mjs')
            elif mode=='extra-file':full['shutil.py']=b'foreign';manifest['files']['shutil.py']=packet.sha(b'foreign')
            elif mode=='oversize':
                full['parity.mjs']=b'x'*262145;manifest['files']['parity.mjs']=packet.sha(full['parity.mjs'])
            elif mode=='sha-drift':full['parity.mjs']+=b'changed'
            raw=packet.canonical(manifest)+b'\n'
            if mode=='duplicate-key':raw=raw.rstrip()[:-1]+b',"variant":"cpu0-fixed-capacity.v2"}\n'
            with self.subTest(mode=mode):
                with self.assertRaisesRegex(RuntimeError,'^external_(manifest_invalid|file_changed)$'):
                    stager.verify_full_v2(raw,packet.sha(raw),full,source_sha)


if __name__=='__main__':unittest.main()
