"""Real proc-shaped metadata for both fixed scopes; no signals or hosts."""
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

import census_v2


class ScopeCensusTests(unittest.TestCase):
    def fixture(self,root):
        owned=root/'owned';owned.mkdir(mode=0o700)
        proc=root/'proc';proc.mkdir()
        own=os.getpid();other=own+100000
        for pid in (own,other):
            entry=proc/str(pid);entry.mkdir();(entry/'fd').mkdir()
            fields=['S','1']+['0']*17+['123']+['0']*4
            (entry/'stat').write_text(str(pid)+' (fixture) '+' '.join(fields))
            (entry/'cmdline').write_bytes(b'fixture\0')
        return owned,proc,proc/str(other)

    def test_consumed_and_new_control_commands_each_refuse(self):
        for stage in census_v2.CONTROL_STAGES:
            with self.subTest(stage=stage),tempfile.TemporaryDirectory() as temp:
                owned,proc,other=self.fixture(Path(temp))
                (other/'cmdline').write_bytes(b'python3\0'+str(owned/stage/'controller_cpu0.py').encode()+b'\0')
                with mock.patch.object(census_v2,'ROOT',owned):
                    with self.assertRaisesRegex(RuntimeError,'^existing_control_present$'):
                        census_v2.proc_controls(proc,uid=os.getuid())

    def test_both_instance_lock_scopes_refuse_alias_and_deleted_fd(self):
        for stage in census_v2.CONTROL_STAGES[-2:]:
            for deleted in (False,True):
                with self.subTest(stage=stage,deleted=deleted),tempfile.TemporaryDirectory() as temp:
                    owned,proc,other=self.fixture(Path(temp))
                    folder=owned/stage;folder.mkdir(mode=0o700)
                    lock=folder/'pin-instance.lock';lock.write_bytes(b'');lock.chmod(0o600)
                    target=other/'fd'/'7'
                    if deleted:target.symlink_to(str(lock)+' (deleted)')
                    else:
                        alias=Path(temp)/'alias';alias.symlink_to(lock);target.symlink_to(alias)
                    with mock.patch.object(census_v2,'ROOT',owned):
                        with self.assertRaisesRegex(RuntimeError,'^existing_holder_present$'):
                            census_v2.proc_controls(proc,uid=os.getuid())

    def test_empty_fixed_scopes_never_claim_unknown_children_absent(self):
        with tempfile.TemporaryDirectory() as temp:
            owned,proc,_=self.fixture(Path(temp))
            with mock.patch.object(census_v2,'ROOT',owned):
                proof=census_v2.proc_controls(proc,uid=os.getuid())
            self.assertEqual(proof['processesChecked'],2)
            self.assertEqual(proof['schema'],'cpu0-prior-control-census.v7')
            self.assertIs(proof['unregisteredChildrenAbsenceProven'],False)


if __name__=='__main__':unittest.main()
