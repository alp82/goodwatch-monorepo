import pathlib,sys,unittest
from unittest import mock
R=pathlib.Path('/home/alper/projects/search-100-evidence/cpu0-never-started-recovery-root-review-20261012')
sys.dont_write_bytecode=True;sys.path.insert(0,str(R/'root-diagnostics/cpu0-external-v6'))
import recovery,setup,test_recovery
class Extra(unittest.TestCase):
 def fixture(self):
  tc=test_recovery.RecoveryTests();self.addCleanup(tc.doCleanups);return tc.composed_fixture()
 def test_real_proof_mutations_are_refused(self):
  o=pathlib.Path('/home/alper/projects/search-100-evidence/cpu0-old-shutdown-review-v1-20261012')
  output=(o/'root-execution-public.ndjson').read_bytes();config=(o/'root-readonly-created-config-public.json').read_bytes()
  recovery.proofs(output,config)
  for a,b,reason in [(output+b' ',config,'recovery_original_failure_changed'),(output,config+b' ','recovery_config_proof_changed')]:
   with self.subTest(reason=reason),self.assertRaisesRegex(RuntimeError,reason):recovery.proofs(a,b)
 def test_old_receipt_hash_mismatch_refuses_before_attempt(self):
  _,args,folder,engine,_,_,_=self.fixture()
  (folder/'cpu0-old-clean-receipt-v1.json').write_bytes(b'{}\n')
  with self.assertRaisesRegex(RuntimeError,'recovery_old_receipt_changed') as caught:recovery.run_recovery(*args)
  engine.start.assert_not_called();self.assertFalse((folder/recovery.ATTEMPT_NAME).exists())
  self.assertEqual(caught.exception.recoveryFailureEvidence['actionState'],'not-issued')
 def test_admission_symlink_and_replacement_inode_refuse(self):
  _,args,folder,engine,_,_,_=self.fixture()
  p=setup.ADMISSION/'pin_cpu0.py';original=p.read_bytes();backup=folder/'original.py';backup.write_bytes(original);backup.chmod(0o600)
  p.unlink();p.symlink_to(backup)
  with self.assertRaisesRegex(RuntimeError,'owned_file_scope_changed'):recovery.run_recovery(*args)
  engine.start.assert_not_called();self.assertFalse((folder/recovery.ATTEMPT_NAME).exists())
  p.unlink();p.write_bytes(original);p.chmod(0o600)
  real=recovery.admitted_files;calls=0
  def replace_on_renewal(*values):
   nonlocal calls
   calls+=1
   if calls==2:
    replacement=p.with_name('replacement.tmp');replacement.write_bytes(original);replacement.chmod(0o600);replacement.replace(p)
   return real(*values)
  with mock.patch.object(recovery,'admitted_files',side_effect=replace_on_renewal):
   with self.assertRaisesRegex(RuntimeError,'recovery_stage_changed'):recovery.run_recovery(*args)
  engine.start.assert_not_called();self.assertFalse((folder/recovery.ATTEMPT_NAME).exists())
 def test_inverse_and_non_null_old_normalization_refuse(self):
  tc=test_recovery.RecoveryTests();self.addCleanup(tc.doCleanups);_,old,new=tc.typed_fixture()
  for a,b in [(False,None),(False,False),(0,False),(True,False),('null',False)]:
   with self.subTest(old=a,new=b):
    old['HostConfig']['OomKillDisable']=a;new['HostConfig']['OomKillDisable']=b
    with self.assertRaisesRegex(RuntimeError,'recovery_normalization_refused'):recovery.configuration(old,new)
 def test_primary_failure_survives_close_failure(self):
  _,args,folder,engine,host,_,_=self.fixture();host.side_effect=RuntimeError('setup_host_admission_failed')
  with mock.patch.object(recovery,'close_control',side_effect=OSError('fixture cleanup')):
   with self.assertRaisesRegex(RuntimeError,'setup_host_admission_failed') as caught:recovery.run_recovery(*args)
  e=caught.exception
  self.assertEqual(e.recoveryFailureEvidence['primaryReason'],'setup_host_admission_failed')
  self.assertEqual(e.recoveryCleanupFailure,'recovery_lock_close_failed')
  self.assertEqual(e.recoveryFailureEvidence['actionState'],'not-issued');engine.start.assert_not_called()
  self.assertFalse((folder/recovery.ATTEMPT_NAME).exists())
if __name__=='__main__':unittest.main(verbosity=2)
