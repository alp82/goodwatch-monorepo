import contextlib,io,json,os,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import launch_complete_baseline as launch

class LaunchTests(unittest.TestCase):
 def test_default_never_reads_contract_or_calls_ssh(self):
  with patch('sys.argv',['launch']),patch.object(Path,'read_bytes',side_effect=AssertionError('private-read')),patch.object(launch.subprocess,'run',side_effect=AssertionError('ssh')),contextlib.redirect_stdout(io.StringIO())as out:launch.main()
  self.assertFalse(json.loads(out.getvalue())['ssh'])
 def test_ssh_success_without_reader_exit_is_unknown(self):
  with tempfile.TemporaryDirectory()as d:
   p=Path(d)/'out';p.write_text('{"event":"not-exit"}\n');self.assertTrue(launch.reader_exit_proof(p)['remoteStateUnknown'])
 def test_alive_reader_cannot_be_claimed_gone(self):
  with tempfile.TemporaryDirectory()as d:
   p=Path(d)/'out';p.write_text(json.dumps({'event':'backup-metadata-reader-exit','at':'2026-10-12T07:50:00+00:00','readerPid':42,'readerGone':False,'exitCode':None,'termSent':True,'killSent':True,'deadlineStop':True,'hostFilesCreated':0})+'\n')
   self.assertFalse(launch.reader_exit_proof(p)['readerExitProven'])
 def test_unknown_private_receipt_fields_are_never_printed(self):
  with tempfile.TemporaryDirectory()as d:
   p=Path(d)/'out';p.write_text(json.dumps({'event':'private-complete-file-baseline','public':{'private-owner-path':'do-not-emit'},'private':{'paths':'secret'}})+'\n')
   out=json.dumps(launch.public_receipt(p));self.assertNotIn('do-not-emit',out);self.assertNotIn('secret',out);self.assertFalse(launch.public_receipt(p)['baselineComplete'])
 def test_remote_payload_compiles_without_executing_host_inspection(self):
  code=launch.payload('def capture(c,h): return {}',{},'');compile(code,'prepared','exec');self.assertNotIn('drop_caches',code);self.assertNotIn('mlock(',code)
if __name__=='__main__':unittest.main()
