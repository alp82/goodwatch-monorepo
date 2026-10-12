import copy
import importlib.util
from pathlib import Path
import unittest

def load(name):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(name+'.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
m=load('audit_transport_window_v1');f=load('test_launch_and_audit')

def fixture():
    rows,receipt=f.fixture();born={'event':'resource-window.reader-born.v1','pid':receipt['pid'],'startTicks':receipt['startTicks'],'sourceSha256':receipt['sourceSha256']};return[born,*rows,receipt]

class Tests(unittest.TestCase):
    def test_complete_ordered_lifecycle(self):self.assertEqual(m.audit(fixture())['coverage'],'complete')
    def test_birth_mismatch_is_unknown(self):
        rows=fixture();rows[0]['startTicks']+=1;self.assertIn('transport_birth_mismatch',m.audit(rows)['problems'])
    def test_missing_receipt_and_unknown_frame_are_unknown(self):
        self.assertEqual(m.audit(fixture()[:-1])['coverage'],'UNKNOWN')
        rows=fixture();rows.insert(1,{'event':'unreviewed'});self.assertIn('unknown_transport_event',m.audit(rows)['problems'])
    def test_exit_before_numeric_terminal_is_unknown(self):
        rows=fixture();rows[-1],rows[-2]=rows[-2],rows[-1];self.assertIn('transport_lifecycle_order',m.audit(rows)['problems'])

if __name__=='__main__':unittest.main()
