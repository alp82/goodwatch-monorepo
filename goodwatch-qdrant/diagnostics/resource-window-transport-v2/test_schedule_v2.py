import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

def load(name):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(name+'.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
s=load('schedule_probe_v2');l=load('launch_schedule_diagnostic_v2')

class Tests(unittest.TestCase):
    def test_diagnostic_default_no_inspection(self):
        with patch.object(s,'probe',side_effect=AssertionError),patch('sys.argv',['schedule_probe_v2.py']),contextlib.redirect_stdout(io.StringIO()):self.assertEqual(s.main(),0)
        with patch.object(l.subprocess,'run',side_effect=AssertionError),patch('sys.argv',['launch_schedule_diagnostic_v2.py']),contextlib.redirect_stdout(io.StringIO()):self.assertEqual(l.main(),0)
    def test_missing_timezone_gets_fixed_phase_without_private_path(self):
        def fail():s.mark('timezone-files');raise FileNotFoundError('/private/secret')
        with patch.object(s,'probe',side_effect=fail),patch('sys.argv',['schedule_probe_v2.py','--inspect']),contextlib.redirect_stdout(io.StringIO())as out:self.assertEqual(s.main(),1)
        last=json.loads(out.getvalue().splitlines()[-1]);self.assertEqual(last['phase'],'timezone-files');self.assertEqual(last['reason'],'required_file_absent');self.assertNotIn('/private',out.getvalue())
    def test_multiple_actual_fixture_daemons_retained_before_rejection(self):
        with tempfile.TemporaryDirectory()as name:
            nodes=[]
            for pid,comm in ((42,'cron'),(43,'crond')):
                node=Path(name)/str(pid);node.mkdir();(node/'ns').mkdir();(node/'ns/mnt').touch();(node/'comm').write_text(comm);parts=['0']*22;parts[19]='123';(node/'stat').write_text('1 (cron) '+' '.join(parts));(node/'environ').write_bytes(b'SECRET=private\\0');(node/'exe').symlink_to('/usr/sbin/'+comm);(node/'cgroup').write_text('0::/private/container');nodes.append(node)
            original=s.read
            def read(path,limit=65536):return b'btime 100\n'if str(path)=='/proc/stat'else original(path,limit)
            with patch.object(s.Path,'glob',return_value=nodes),patch.object(s.Path,'stat',return_value=SimpleNamespace(st_ino=123)),patch.object(s,'read',side_effect=read),contextlib.redirect_stdout(io.StringIO())as out:
                with self.assertRaisesRegex(ValueError,'daemon_ambiguous'):s.probe()
            rows=[json.loads(line)for line in out.getvalue().splitlines()];selection=next(row for row in rows if row.get('phase')=='daemon-selection');self.assertEqual(selection['candidateCount'],2)
            self.assertEqual(len([r for r in rows if r['event']=='cron-diagnostic.candidate.v2']),2);self.assertNotIn('SECRET',out.getvalue());self.assertNotIn('/private',out.getvalue())
    def test_exact_source_and_transport_compile(self):
        code=l.script(l.SCHEDULE.read_bytes(),l.SCHEDULE_SHA,'--inspect','cron-diagnostic.identity.v2',48,('cron-diagnostic.phase.v2','cron-diagnostic.candidate.v2','cron-diagnostic.failed.v2'))
        compile(code,'<reviewed-diagnostic>','exec')
        with self.assertRaisesRegex(ValueError,'source_hash'):l.script(b'bad',l.SCHEDULE_SHA)
    def test_actual_transport_retains_failure_phase_and_proven_exit(self):
        source=b'import json;print(json.dumps({"event":"cron-diagnostic.phase.v2","phase":"timezone-files"}),flush=True);print(json.dumps({"event":"cron-diagnostic.failed.v2","phase":"timezone-files","reason":"required_file_absent"}),flush=True);raise SystemExit(1)'
        code=l.script(source,hashlib.sha256(source).hexdigest(),'--inspect','cron-diagnostic.identity.v2',48,('cron-diagnostic.phase.v2','cron-diagnostic.failed.v2'))
        result=subprocess.run(['/usr/bin/python3','-I','-B','-'],input=code.encode(),capture_output=True,timeout=12)
        self.assertEqual(result.returncode,1);self.assertEqual(result.stderr,b'');rows=[json.loads(line)for line in result.stdout.splitlines()];self.assertEqual(rows[-2]['phase'],'timezone-files');self.assertTrue(rows[-1]['readerGoneProven']);self.assertFalse(rows[-1]['clean'])

if __name__=='__main__':unittest.main()
