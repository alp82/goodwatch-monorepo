"""Closed v2 transport tables/bytes; no SSH or source process execution."""
import base64
import json
import unittest

import bootstrap_v2
import packet
from rpc_v2 import RpcV2,HOSTS
import executor_v2
import private_pipe_v2


class TransportBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.files={name+'.py':b'# public transport fixture\n' for name in bootstrap_v2.MODULES}
        self.manifest={'schema':'cpu0-ssh-closure.v7',
                       'files':{name:packet.sha(raw) for name,raw in self.files.items()}}
        self.closure_sha=packet.sha(packet.canonical(self.manifest)+b'\n')
        self.rpc=RpcV2(b'# public bootstrap fixture',packet.sha(b'# public bootstrap fixture'),
                        self.files,self.closure_sha)

    def test_exact_operation_tables_and_fixed_host_routes_match(self):
        self.assertEqual(set(HOSTS),set(executor_v2.OPERATIONS))
        for operation in HOSTS:
            raw=self.rpc.envelope(operation,{})
            value,files=bootstrap_v2.decode(raw,self.closure_sha)
            self.assertEqual(files,self.files)
            self.assertEqual(value['operation'],operation)
            command=self.rpc.command(operation)
            expected='root@10.0.0.21' if operation.startswith('producer-') else 'root@10.0.0.32'
            self.assertEqual(command[-2],expected)
            self.assertIn('/usr/bin/python3 -I -B',command[-1])

    def test_old_modes_and_mutation_operations_are_not_dispatchable(self):
        for operation in ('setup','setup-recover-never-started','start','stop','remove','foreign'):
            with self.subTest(operation=operation):
                with self.assertRaisesRegex(RuntimeError,'^rpc_operation_invalid$'):
                    self.rpc.command(operation)
                value=json.loads(self.rpc.envelope('adopt-running-clone',{}));value['operation']=operation
                with self.assertRaisesRegex(RuntimeError,'^bootstrap_operation_invalid$'):
                    bootstrap_v2.decode(packet.canonical(value),self.closure_sha)

    def test_foreign_module_bytes_refuse_before_execution(self):
        value=json.loads(self.rpc.envelope('adopt-running-clone',{}))
        value['files']['running_adoption.py']=base64.b64encode(b'raise RuntimeError("foreign")').decode()
        with self.assertRaisesRegex(RuntimeError,'^bootstrap_file_changed$'):
            bootstrap_v2.decode(packet.canonical(value),self.closure_sha)

    def test_duplicate_operation_and_legacy_recipe_are_rejected(self):
        raw=self.rpc.envelope('adopt-running-clone',{})
        duplicate=raw[:-1]+b',"operation":"adopt-running-clone"}'
        with self.assertRaisesRegex(RuntimeError,'^bootstrap_input_invalid$'):
            bootstrap_v2.decode(duplicate,self.closure_sha)
        value=json.loads(raw);value['manifest']['schema']='cpu0-ssh-closure.v6'
        with self.assertRaisesRegex(RuntimeError,'^bootstrap_closure_invalid$'):
            bootstrap_v2.decode(packet.canonical(value),self.closure_sha)

    def test_fixed_consumer_uses_distinct_selector_and_preserves_hash_order(self):
        command=private_pipe_v2.fixed_consumer_command('a'*64,'b'*64,'c'*64,
                                                      raise_own_nofile=True)
        self.assertEqual(command[-2],'root@10.0.0.32')
        self.assertIn('/pin-control-20261012-100-cpu0-v2/node',command[-1])
        self.assertIn('--execute-reviewed-fixed-capacity-v2 --handoff-sha256 '+ 'c'*64,
                      command[-1])
        self.assertTrue(command[-1].endswith('--raise-own-nofile'))


if __name__=='__main__':unittest.main()
