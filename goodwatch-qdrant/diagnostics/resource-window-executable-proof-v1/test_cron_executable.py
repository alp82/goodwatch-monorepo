import contextlib
import hashlib
import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import patch

def load(name):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(name+'.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
s=load('cron_executable_probe_v1');l=load('launch_cron_executable_v1')

class Tests(unittest.TestCase):
    def test_defaults_no_inspection_or_transport(self):
        with patch.object(s,'probe',side_effect=AssertionError),patch('sys.argv',['probe']),contextlib.redirect_stdout(io.StringIO()):self.assertEqual(s.main(),0)
        with patch.object(l.subprocess,'run',side_effect=AssertionError),patch('sys.argv',['launch']),contextlib.redirect_stdout(io.StringIO()):self.assertEqual(l.main(),0)
    def test_known_flags_only_no_alternate_scheduler(self):
        result=s.flags(['/usr/sbin/cron','-f','-P','-L','15'])
        self.assertTrue(result['foreground']);self.assertTrue(result['preserveChildPath']);self.assertEqual(result['loggingLevel'],15);self.assertFalse(result['alternateScheduleConfigFlag'])
    def test_unknown_path_flags_and_immediate_mode_fail(self):
        for args in (['/private/cron'],['cron','-c','/private'],['cron','-L','secret'],['cron','-N'],['cron','-x','ext']):
            with self.assertRaises(ValueError):s.flags(args)
    def test_actual_retained_executable_proof_matches_frozen_binary(self):
        import json
        root=Path(__file__).parents[3]
        rows=[json.loads(line)for line in (root/'docs/implementation/search-ranking/production-cron-executable-proof-20261012-v1.jsonl').read_text().splitlines()]
        proof=next(row for row in rows if row['event']=='cron-executable-proof.v1')
        self.assertEqual(proof['binarySha256'],s.BINARY_SHA);self.assertEqual(proof['binaryBytes'],60080)
    def test_prepared_owned_transport_compiles(self):
        compile(l.script(l.SCHEDULE.read_bytes(),l.SCHEDULE_SHA,'--inspect','cron-executable-proof.v1'),'<cron-proof>','exec')

if __name__=='__main__':unittest.main()
