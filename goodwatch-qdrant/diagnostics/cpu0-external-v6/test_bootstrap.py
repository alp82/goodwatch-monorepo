import base64
import io
import json
import os
from pathlib import Path
import tempfile
import subprocess
import sys
import unittest
from unittest import mock

import bootstrap
import local_entry
import packet
import private_pipe


def closure():
    files={name:b'# authenticated public fixture\n' for name in bootstrap.NAMES}
    files['executor.py']=b"def dispatch(operation,arguments):\n return {'producerPrivateStreamCompleted':True,'schema':'cpu0-producer-completion.v6'}\n"
    manifest={'schema':'cpu0-ssh-closure.v6','files':{name:packet.sha(raw) for name,raw in files.items()}}
    value={'manifest':manifest,'files':{name:base64.b64encode(raw).decode() for name,raw in files.items()},'operation':'producer-stream','arguments':{}}
    return packet.canonical(value),packet.sha(packet.canonical(manifest)+b'\n')


class BootstrapTests(unittest.TestCase):
    def test_external_closure_changed_before_any_exec(self):
        raw,digest=closure();value=json.loads(raw);value['files']['producer.py']=base64.b64encode(b'changed').decode()
        with mock.patch('builtins.exec') as execute:
            with self.assertRaisesRegex(RuntimeError,'bootstrap_file_changed'):bootstrap.execute(packet.canonical(value),digest)
            execute.assert_not_called()

    def test_actual_bootstrap_completion_is_demux_control_frame(self):
        raw,digest=closure();stdin=mock.Mock(buffer=io.BytesIO(raw));out=io.StringIO()
        # Real output branch, not a synthetic producer frame fixture.
        with mock.patch.object(bootstrap.sys,'argv',['bootstrap',digest]),mock.patch.object(bootstrap.sys,'stdin',stdin),mock.patch.object(bootstrap.sys,'stdout',out),mock.patch.object(bootstrap,'execute',return_value={'schema':'cpu0-producer-completion.v6','producerPrivateStreamCompleted':True}):
            self.assertEqual(bootstrap.main(),0)
        value=json.loads(out.getvalue());self.assertEqual(value['kind'],'private-producer-exit-proof');self.assertTrue(value['proof']['producerPrivateStreamCompleted'])

    def test_all_operation_tables_agree(self):
        import rpc,executor
        self.assertEqual(set(rpc.HOSTS),executor.OPERATIONS)
        for operation in rpc.HOSTS:
            raw,digest=closure();value=json.loads(raw);value['operation']=operation
            bootstrap.decode(packet.canonical(value),digest)

    def test_local_execution_dependency_changed_before_import(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);files={name:b'# public fixture\n' for name in local_entry.NAMES}
            for name,raw in files.items():(root/name).write_bytes(raw);(root/name).chmod(0o600)
            manifest={'schema':'cpu0-local-execution-closure.v6','files':{name:packet.sha(raw) for name,raw in files.items()}}
            raw=packet.canonical(manifest)+b'\n';(root/'private_pipe.py').write_bytes(b'changed')
            with self.assertRaisesRegex(RuntimeError,'local_entry_source_changed'):local_entry.authenticate(root,raw,packet.sha(raw))


    def test_isolated_authenticated_loader_does_not_import_sibling_stdlib_shadow(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);files={name:b'# public fixture\n' for name in local_entry.NAMES}
            files['outer_local.py']=b"import sys\nfrom pathlib import Path\nsys.path.insert(0,str(Path(__file__).resolve().parent))\nimport subprocess\ndef main():\n print('trusted-stdlib' if hasattr(subprocess,'Popen') else 'shadowed')\n return 0\n"
            for name,raw in files.items():(root/name).write_bytes(raw);(root/name).chmod(0o600)
            (root/'subprocess.py').write_text("raise RuntimeError('undeclared sibling loaded')")
            manifest={'schema':'cpu0-local-execution-closure.v6','files':{name:packet.sha(raw) for name,raw in files.items()}}
            raw=packet.canonical(manifest)+b'\n';(root/'closure.json').write_bytes(raw);(root/'closure.json').chmod(0o600)
            # Real isolated interpreter and authenticated loader. The entry path
            # is the fixture directory; no subprocess module is preloaded.
            entry=Path(local_entry.__file__).read_text()
            (root/'entry.py').write_text(entry)
            result=subprocess.run([sys.executable,'-I','-B',str(root/'entry.py'),'--execute-reviewed','--execution-closure',str(root/'closure.json'),'--execution-closure-sha256',packet.sha(raw)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=5)
            self.assertEqual(result.returncode,0,result.stderr.decode());self.assertEqual(result.stdout,b'trusted-stdlib\n')

    def test_existing_authenticated_namespace_refuses_before_exec(self):
        raw,digest=closure()
        with mock.patch.object(bootstrap.os.path,'lexists',return_value=True),mock.patch('builtins.exec') as execute:
            with self.assertRaisesRegex(RuntimeError,'authenticated_namespace_not_absent'):bootstrap.execute(raw,digest)
            execute.assert_not_called()


if __name__=='__main__':unittest.main()
