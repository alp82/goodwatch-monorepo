"""Real isolated v2 imports and pre-import authentication boundaries; no hosts."""
import base64
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

import bootstrap_v2
import build_packet_v2
import local_entry_v2
import executor_v2
import reason_codes_v2
from packet import SOURCE_NAMES,canonical,sha,verify_source_v2
import census
import running_adoption
import stager


class LocalClosureTests(unittest.TestCase):
    def test_builder_closes_actual_external_recipe_and_explicit_review_digests(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);source=root/'source';consumer=root/'consumer'
            source.mkdir();consumer.mkdir()
            files={name:b'# source fixture\n' for name in SOURCE_NAMES}
            files['prepared-control-policy-cpu0.json']=canonical({
                'schema':'clone-pin-control.cpu0-fixed.v2',
                'helperConfig':str(running_adoption.STAGE/'helper-config.json'),
                'lifecycle':{'modulePath':str(running_adoption.STAGE/'lifecycle_cpu0.py'),
                             'handoffPath':str(running_adoption.HANDOFF)}})
            raw_source=canonical({'schema':'search.clone-cpu0-fixed-source-freeze.v2',
                'variant':'cpu0-fixed-capacity.v2','preparedOnly':True,
                'files':{name:sha(raw) for name,raw in files.items()}})+b'\n'
            for name,raw in {**files,'cpu0-source-freeze.json':raw_source}.items():
                (source/name).write_bytes(raw);(source/name).chmod(0o600)
            for name in build_packet_v2.JS_NAMES:
                (consumer/name).write_bytes(b'// consumer fixture\n');(consumer/name).chmod(0o600)
            manifest=canonical({'schema':'cpu0-consumer-source-closure.v2',
                'files':{name:sha((consumer/name).read_bytes()) for name in build_packet_v2.JS_NAMES}})
            prior=[{'stage':name,'files':{'fixture.py':'a'*64},
                'helperSha256':stager.RECLAIM_SHA if i==5 else None,
                'maxReceipts':18 if i>=4 else 14} for i,name in enumerate(census.PRIOR_STAGES,1)]
            external=Path(local_entry_v2.__file__).parent
            reclaim=external.parent/'clone-preparation'/'prepare_clone_reclaim.py'
            kwargs=dict(source_sha=sha(raw_source),consumer_manifest=manifest,
                consumer_manifest_sha=sha(manifest),failed_recovery=b'failure fixture',
                memory_observation=b'memory fixture')
            # Pure historical-proof semantics have their own authenticated-byte
            # fixtures. This test checks packet composition, with no host code.
            with mock.patch.object(running_adoption.proofs,'observations',return_value={}):
                raw,local_raw=build_packet_v2.build(source,consumer,reclaim,external,prior,**kwargs)
                value=json.loads(raw)
                decode=lambda mapping:{name:base64.b64decode(body,validate=True) for name,body in mapping.items()}
                backend=decode(value['sourceFiles']);full=decode(value['fullFiles'])
                verify_source_v2(base64.b64decode(value['sourceFreeze']),sha(raw_source),backend)
                stager.verify_full_v2(base64.b64decode(value['fullManifest']),value['externalManifestSha256'],full,sha(raw_source))
                self.assertEqual(set(decode(value['closureFiles'])),bootstrap_v2.NAMES)
                self.assertEqual(set(json.loads(local_raw)['files']),local_entry_v2.NAMES)
                self.assertEqual(value['localExecutionClosureSha256'],sha(local_raw))
                self.assertEqual(value['initialMode'],running_adoption.MODE)
                self.assertNotIn('recoveryProof',value)
                kwargs['source_sha']='0'*64
                with self.assertRaisesRegex(RuntimeError,'source_freeze_changed'):
                    build_packet_v2.build(source,consumer,reclaim,external,prior,**kwargs)

    def test_fixed_v2_refusals_survive_projection_without_arbitrary_text(self):
        reasons=('fixed_capacity_policy_changed','host_memory_unproven',
            'consumer_registry_unproven','overhead_growth_exceeded',
            'overhead_identity_changed','overhead_measurement_unproven',
            'overhead_placement_unproven','overhead_unregistered_child',
            'running_unheld_scope_unproven','working_set_inventory_unproven',
            'preflight_loader_unproven','preflight_source_unproven',
            'preflight_stdin_unproven','preflight_argv_unproven')
        for reason in reasons:
            with self.subTest(reason=reason):
                self.assertIn(reason,reason_codes_v2.REASONS)
                self.assertEqual(executor_v2.fixed_cause(RuntimeError(reason)),reason)
        self.assertEqual(executor_v2.fixed_cause(RuntimeError('private arbitrary detail')),
                         'executor_guard_or_runtime_failure')

    def fixture(self,root):
        files={name:b'# authenticated fixture\n' for name in local_entry_v2.NAMES}
        for name,raw in files.items():
            (root/name).write_bytes(raw);(root/name).chmod(0o600)
        raw=canonical({'schema':'cpu0-local-execution-closure.v7',
            'files':{name:sha(value) for name,value in files.items()}})+b'\n'
        return raw

    def test_changed_dependency_and_symlink_refuse_before_import(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);raw=self.fixture(root)
            (root/'rpc.py').write_bytes(b'changed')
            with self.assertRaisesRegex(RuntimeError,'local_entry_source_changed'):
                local_entry_v2.authenticate(root,raw,sha(raw))
            target=root/'other';target.write_bytes(b'# authenticated fixture\n')
            (root/'rpc.py').unlink();(root/'rpc.py').symlink_to(target)
            with self.assertRaisesRegex(RuntimeError,'local_entry_source_changed'):
                local_entry_v2.authenticate(root,raw,sha(raw))
            with self.assertRaisesRegex(RuntimeError,'local_entry_source_changed'):
                build_packet_v2.read(root/'rpc.py')

    def test_duplicate_manifest_key_is_not_authority(self):
        with tempfile.TemporaryDirectory() as folder:
            raw=self.fixture(Path(folder))
            duplicate=raw.replace(b'{',b'{"schema":"ignored",',1)
            with self.assertRaisesRegex(RuntimeError,'local_entry_freeze_invalid'):
                local_entry_v2.authenticate(Path(folder),duplicate,sha(duplicate))

    def test_closed_consumer_manifest_cannot_self_authenticate_drift(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            for name in build_packet_v2.JS_NAMES:
                (root/name).write_bytes(b'// fixture\n');(root/name).chmod(0o600)
            raw=canonical({'schema':'cpu0-consumer-source-closure.v2',
                'files':{name:sha(b'// fixture\n') for name in build_packet_v2.JS_NAMES}})
            build_packet_v2.consumer_files(root,raw,sha(raw))
            (root/'consumer_cpu0.mjs').write_bytes(b'// drift\n')
            with self.assertRaisesRegex(RuntimeError,'consumer_source_changed'):
                build_packet_v2.consumer_files(root,raw,sha(raw))
            with self.assertRaisesRegex(RuntimeError,'consumer_freeze_changed'):
                build_packet_v2.consumer_files(root,raw,'0'*64)

    def test_real_closed_modules_load_in_isolated_absent_namespace(self):
        # Executes actual dependency bytes; dispatch and outer main are never
        # called. Any missing dependency tries the absent namespace and fails.
        folder=Path(local_entry_v2.__file__).parent
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            for name in local_entry_v2.NAMES:
                (root/name).write_bytes((folder/name).read_bytes());(root/name).chmod(0o600)
            (root/'subprocess.py').write_text("raise RuntimeError('undeclared shadow')")
            raw=canonical({'schema':'cpu0-local-execution-closure.v7',
                'files':{name:sha((root/name).read_bytes()) for name in local_entry_v2.NAMES}})
            (root/'closure.json').write_bytes(raw)
            code='''import sys,types,hashlib
from pathlib import Path
sys.path.insert(0,sys.argv[1])
import local_entry_v2 as entry
sys.path.pop(0)
folder=Path(sys.argv[1])
raw=(folder/'closure.json').read_bytes()
files=entry.authenticate(folder,raw,hashlib.sha256(raw).hexdigest())
for name in entry.MODULES:
 module=types.ModuleType(name);module.__file__='/absent-authenticated-local-v2/'+name+'.py';module.__package__=''
 sys.modules[name]=module
 exec(compile(files[name+'.py'],module.__file__,'exec'),module.__dict__)
assert sys.modules['rpc_v2'].MODULES==sys.modules['bootstrap_v2'].MODULES
assert callable(sys.modules['executor_v2'].dispatch)
assert callable(sys.modules['outer_local_v2'].run)
print('closed-imports')
'''
            result=subprocess.run([sys.executable,'-I','-B','-c',code,str(root)],
                stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=10)
            self.assertEqual(result.returncode,0,result.stderr.decode())
            self.assertEqual(result.stdout,b'closed-imports\n')
        self.assertTrue(bootstrap_v2.NAMES <= local_entry_v2.NAMES)


if __name__=='__main__':unittest.main()
