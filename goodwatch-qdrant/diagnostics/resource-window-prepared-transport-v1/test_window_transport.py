import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import time
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('window',Path(__file__).with_name('launch_window_v1.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.SOURCE=Path(__file__).parents[1]/'resource_window.py'

class Tests(unittest.TestCase):
    def test_default_does_not_connect(self):
        with patch.object(m.subprocess,'run',side_effect=AssertionError),patch('sys.argv',['launch_window_v1.py']),contextlib.redirect_stdout(io.StringIO()):self.assertEqual(m.main(),0)
    def test_real_local_transport_keeps_birth_exit_and_source_sha(self):
        source=b'import json;print(json.dumps({"event":"resource-window.complete.v1"}),flush=True)'
        sha=hashlib.sha256(source).hexdigest()
        with patch.object(m,'SOURCE_SHA',sha):code=m.script(source,['stub'],time.time()+2)
        result=subprocess.run(['/usr/bin/python3','-I','-B','-'],input=code.encode(),capture_output=True,timeout=12)
        self.assertEqual(result.returncode,0);self.assertEqual(result.stderr,b'')
        rows=[json.loads(line)for line in result.stdout.splitlines()];self.assertEqual(rows[0]['event'],'resource-window.reader-born.v1');self.assertEqual(rows[-1]['event'],'resource-window.reader-exit.v1');self.assertEqual(rows[-1]['sourceSha256'],sha);self.assertEqual(rows[0]['pid'],rows[-1]['pid']);self.assertEqual(rows[0]['startTicks'],rows[-1]['startTicks']);self.assertTrue(rows[-1]['readerGoneProven'])
    def test_unknown_output_cleans_reader_and_cannot_be_clean(self):
        source=b'import json,time;print(json.dumps({"event":"private-unreviewed"}),flush=True);time.sleep(60)';sha=hashlib.sha256(source).hexdigest()
        with patch.object(m,'SOURCE_SHA',sha):code=m.script(source,['stub'],time.time()+2)
        result=subprocess.run(['/usr/bin/python3','-I','-B','-'],input=code.encode(),capture_output=True,timeout=12)
        rows=[json.loads(line)for line in result.stdout.splitlines()];self.assertEqual(result.returncode,1);self.assertNotIn('private-unreviewed',result.stdout.decode());self.assertTrue(rows[-1]['readerGoneProven']);self.assertFalse(rows[-1]['clean'])
    def test_runtime_args_are_data_not_shell(self):
        code=m.script(m.SOURCE.read_bytes(),['resource_window.py','--execute','--backup-path-sha256','a'*64],time.time()+2)
        compile(code,'<window>','exec');self.assertNotIn('shell=True',code)

if __name__=='__main__':unittest.main()
