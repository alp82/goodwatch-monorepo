"""Actual frozen backend14 and multiline policy through the full loader.

The file authority uses a real private temporary directory and current UID;
Node is a small explicitly substituted local fixture. No backend actions run.
"""
import base64
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

import executor_v2 as executor
import packet
import running_adoption as adoption
import stager
import stager_v2

BACKEND=Path('/home/alper/projects/search-100-evidence/cpu0-fixed-capacity-backend-review-v3-20261012/code')
SOURCE_SHA='f13494c945e5a4fe719f848fbe9bc5fe724508f0f699491fea55b69dba8a3cad'
ORIGINAL_PACKET=Path('/home/alper/projects/search-100-evidence/cpu0-fixed-capacity-integrated-review-v1-20261012/execution-packet.json')
MODULES=('pin_cpu0','runtime_cpu0','cpu0_guards','daemon_cpu0','lifecycle_cpu0','controller_cpu0','cpu0_preflight','turnover_gate_cpu0')


class FrozenStageContextTests(unittest.TestCase):
    def setUp(self):
        self.root=Path(self.enterContext(tempfile.TemporaryDirectory()));self.root.chmod(0o700)
        self.stage=self.root/adoption.STAGE.name;self.admission=self.root/adoption.ADMISSION.name
        self.stage.mkdir(mode=0o700);self.admission.mkdir(mode=0o700)
        raw=(BACKEND/'cpu0-source-freeze.json').read_bytes()
        self.assertEqual(packet.sha(raw),SOURCE_SHA)
        source_manifest=packet.closed_json(raw)
        self.source={name:(BACKEND/name).read_bytes() for name in packet.SOURCE_NAMES}
        self.assertTrue(all(packet.sha(content)==source_manifest['files'][name] for name,content in self.source.items()))
        original=json.loads(ORIGINAL_PACKET.read_bytes())
        full={name:base64.b64decode(value,validate=True) for name,value in original['fullFiles'].items()}
        full.update(self.source)
        full.update({'cpu0-source-freeze.json':raw,'helper-config.json':self.source['prepared-helper-policy-cpu0.json'],
                     'controller-config.json':self.source['prepared-control-policy-cpu0.json']})
        manifest=packet.canonical({'schema':'cpu0-full-public-packet.v7','variant':'cpu0-fixed-capacity.v2',
            'sourceFreezeSha256':SOURCE_SHA,'files':{name:packet.sha(value) for name,value in full.items()}})+b'\n'
        self.derivative=adoption.derivative_policy(full['controller-config.json'],packet.sha(full['controller-config.json']))
        self.enterContext(mock.patch.object(adoption,'STAGE',self.stage))
        self.enterContext(mock.patch.object(adoption,'ADMISSION',self.admission))
        original_derivative=adoption.derivative_policy
        fixed_stage=Path('/root/goodwatch-qdrant-cold-406-20261011/pin-control-20261012-100-cpu0-v2')
        fixed_admission=Path('/root/goodwatch-qdrant-cold-406-20261011/cpu0-admission-20261012-100-v2')
        def derivative(raw,digest):
            with mock.patch.object(adoption,'STAGE',fixed_stage),mock.patch.object(adoption,'ADMISSION',fixed_admission):
                return original_derivative(raw,digest)
        self.enterContext(mock.patch.object(adoption,'derivative_policy',side_effect=derivative))
        self.arguments={'sourceFreezeSha256':SOURCE_SHA,'sourceFreeze':base64.b64encode(raw).decode(),
            'sourceFiles':{name:base64.b64encode(value).decode() for name,value in self.source.items()},
            'fullFiles':{name:base64.b64encode(value).decode() for name,value in full.items()},
            'fullManifest':base64.b64encode(manifest).decode(),'externalManifestSha256':packet.sha(manifest),
            'derivativePolicySha256':packet.sha(self.derivative)}
        for folder,files in ((self.stage,{**full,'cpu0-external-manifest.json':manifest}),
             (self.admission,{**self.source,'cpu0-source-freeze.json':raw,
                 'helper-config.json':full['helper-config.json'],'controller-config.json':self.derivative})):
            for name,content in files.items():
                target=folder/name;target.write_bytes(content);target.chmod(0o600)
        node=self.stage/'node';node.write_bytes(b'local nonexecuting node fixture');node.chmod(0o700);info=node.stat()
        receipt=packet.canonical({'schema':'clone-node-copy-receipt.v2','nodeSha256':packet.sha(node.read_bytes()),
            'nodeBytes':info.st_size,'sourceReceiptSha256':stager.NODE_RECEIPT_SHA,'targetDevice':info.st_dev,
            'targetInode':info.st_ino,'targetMode':0o700,'sourceStable':True,'sourceHostWrites':0,
            'cloneFilesCreated':2,'targetMtimeNs':info.st_mtime_ns,'targetCtimeNs':info.st_ctime_ns})+b'\n'
        target=self.stage/'node-provenance.json';target.write_bytes(receipt);target.chmod(0o600)
        self.arguments['nodeReceiptSha256']=packet.sha(receipt)
        self.enterContext(mock.patch.object(stager,'NODE_SHA',packet.sha(node.read_bytes())))
        self.enterContext(mock.patch.object(stager,'NODE_BYTES',info.st_size))
        original_node=stager._verify_node_copy_v2
        self.enterContext(mock.patch.object(stager,'_verify_node_copy_v2',side_effect=lambda path,raw,identity,uid,digest,size:original_node(path,raw,identity,os.getuid(),digest,size)))
        read=packet.read_owned;directory=packet.directory
        for module in (packet,executor,stager_v2):
            self.enterContext(mock.patch.object(module,'read_owned',side_effect=lambda path,**kwargs:read(path,uid=os.getuid(),**{k:v for k,v in kwargs.items() if k!='uid'})))
        self.enterContext(mock.patch.object(packet,'directory',side_effect=lambda path,uid=0:directory(path,os.getuid())))
        inventory=packet._v2_inventory
        for module in (packet,executor,stager_v2):
            self.enterContext(mock.patch.object(module,'_v2_inventory',side_effect=lambda path:inventory(path,uid=os.getuid())))
        self.enterContext(mock.patch.dict(sys.modules))
        self.old_path=list(sys.path);self.addCleanup(lambda:sys.path.__setitem__(slice(None),self.old_path))
        for name in MODULES:sys.modules.pop(name,None)

    def test_actual_multiline_full_policy_loads_exactly_without_canonical_rewrite(self):
        original=self.source['prepared-control-policy-cpu0.json']
        self.assertNotEqual(packet.canonical(packet.closed_json(original))+b'\n',original)
        recipe=executor.installed_recipe(self.arguments,self.stage)
        self.assertEqual(recipe[2],self.source)
        modules,config,spec,policy,*_=executor.context(self.arguments,self.stage)
        self.assertEqual((self.stage/'controller-config.json').read_bytes(),original)
        self.assertIs(modules['runtime_cpu0'].Kernel,modules['pin_cpu0'].Kernel)
        for name in MODULES:
            self.assertEqual(modules[name]._AUTHENTICATED_SOURCE_SHA256,packet.sha(self.source[name+'.py']))
        self.assertEqual(config['helperCodeSha256'],modules['daemon_cpu0'].code_hash())
        self.assertEqual(policy.max_locked_bytes,2*1024**3)

    def test_actual_admission_derivative_loads_with_exact_canonical_check(self):
        modules,config,spec,policy,*_=executor.context(self.arguments,self.admission)
        self.assertEqual(packet.canonical(config)+b'\n',self.derivative)
        self.assertEqual(modules['daemon_cpu0'].code_hash(),config['helperCodeSha256'])

    def test_modified_stage_policy_refuses_before_backend_execution(self):
        target=self.stage/'controller-config.json';target.write_bytes(packet.canonical(packet.closed_json(target.read_bytes()))+b'\n')
        with mock.patch.object(executor,'load_staged_modules_v2') as loader:
            with self.assertRaisesRegex(RuntimeError,'^staged_source_changed$'):
                executor.context(self.arguments,self.stage)
            loader.assert_not_called()


if __name__=='__main__':unittest.main()
