"""Local byte-boundary integration; no host operations or source approval."""
import base64
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

import executor_v2 as executor
import packet
import running_adoption as adoption


class RecipeBoundaryTests(unittest.TestCase):
    def setUp(self):
        root=Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.path=root/adoption.ADMISSION.name
        self.path.mkdir(mode=0o700)
        self.enterContext(mock.patch.object(adoption,'ADMISSION',self.path))
        self.enterContext(mock.patch.object(executor,'read_owned',
            side_effect=lambda path:packet.read_owned(path,uid=os.getuid())))
        self.enterContext(mock.patch.object(executor,'_v2_inventory',
            side_effect=lambda path:packet._v2_inventory(path,uid=os.getuid())))
        control={'schema':'clone-pin-control.cpu0-fixed.v2',
                 'helperConfig':str(adoption.STAGE/'helper-config.json'),
                 'lifecycle':{'modulePath':str(adoption.STAGE/'lifecycle_cpu0.py'),
                              'handoffPath':str(adoption.HANDOFF)}}
        self.files={name:('public fixture '+name).encode() for name in packet.SOURCE_NAMES}
        self.files['prepared-control-policy-cpu0.json']=packet.canonical(control)+b'\n'
        manifest={'schema':'search.clone-cpu0-fixed-source-freeze.v2',
                  'variant':'cpu0-fixed-capacity.v2','preparedOnly':True,
                  'files':{name:packet.sha(raw) for name,raw in self.files.items()}}
        self.source=packet.canonical(manifest)+b'\n'
        derivative=adoption.derivative_policy(self.files['prepared-control-policy-cpu0.json'],
                                              packet.sha(self.files['prepared-control-policy-cpu0.json']))
        self.arguments={'sourceFreezeSha256':packet.sha(self.source),
                        'sourceFreeze':base64.b64encode(self.source).decode(),
                        'sourceFiles':{name:base64.b64encode(raw).decode() for name,raw in self.files.items()},
                        'derivativePolicySha256':packet.sha(derivative)}
        for name,raw in {**self.files,'cpu0-source-freeze.json':self.source,
                         'helper-config.json':self.files['prepared-helper-policy-cpu0.json'],
                         'controller-config.json':derivative}.items():
            path=self.path/name;path.write_bytes(raw);path.chmod(0o600)

    def test_complete_admission_recipe_is_authenticated_without_execution(self):
        raw,digest,files=executor.installed_recipe(self.arguments,self.path)
        self.assertEqual((raw,digest,files),(self.source,packet.sha(self.source),self.files))

    def test_wrong_alias_refuses_before_backend_loader(self):
        (self.path/'helper-config.json').write_bytes(b'foreign alias')
        with mock.patch.object(executor,'load_staged_modules_v2') as loader:
            with self.assertRaisesRegex(RuntimeError,'^executor_staged_source_changed$'):
                executor.context(self.arguments,self.path)
            loader.assert_not_called()

    def test_hostile_undeclared_import_refuses_before_backend_loader(self):
        (self.path/'shutil.py').write_text('raise RuntimeError("foreign")')
        (self.path/'shutil.py').chmod(0o600)
        with mock.patch.object(executor,'load_staged_modules_v2') as loader:
            with self.assertRaisesRegex(RuntimeError,'^staged_source_inventory_invalid$'):
                executor.context(self.arguments,self.path)
            loader.assert_not_called()

    def test_old_recipe_cannot_be_loaded_through_successor(self):
        manifest=packet.closed_json(self.source)
        manifest.update(schema='search.clone-cpu0-owned-source-freeze.v1',
                        variant='cpu0-owned-lifecycle.v1')
        raw=packet.canonical(manifest)+b'\n'
        self.arguments.update(sourceFreezeSha256=packet.sha(raw),
                              sourceFreeze=base64.b64encode(raw).decode())
        with self.assertRaisesRegex(RuntimeError,'^source_freeze_invalid$'):
            executor.backend_packet(self.arguments)

    def test_invalid_base64_refuses_with_fixed_cause(self):
        for encoded in ('not!base64','\u2603'):
            with self.subTest(encoded=encoded):
                self.arguments['sourceFreeze']=encoded
                with self.assertRaisesRegex(RuntimeError,'^executor_source_packet_invalid$'):
                    executor.backend_packet(self.arguments)

    def test_derivative_binding_change_refuses_before_backend_loader(self):
        self.arguments['derivativePolicySha256']='0'*64
        with mock.patch.object(executor,'load_staged_modules_v2') as loader:
            with self.assertRaisesRegex(RuntimeError,'^executor_derivative_changed$'):
                executor.context(self.arguments,self.path)
            loader.assert_not_called()


if __name__=='__main__':unittest.main()
