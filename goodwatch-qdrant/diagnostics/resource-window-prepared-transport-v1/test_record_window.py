import contextlib
import importlib.util
import io
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('recorder',Path(__file__).with_name('record_window_v1.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class Tests(unittest.TestCase):
    def test_default_does_not_create_or_execute(self):
        with patch.object(m,'exclusive_journal',side_effect=AssertionError),patch.object(m.subprocess,'run',side_effect=AssertionError),patch('sys.argv',['recorder']),contextlib.redirect_stdout(io.StringIO()):self.assertEqual(m.main(),0)
    def test_existing_file_never_overwritten(self):
        with tempfile.TemporaryDirectory()as name:
            parent=Path(name);parent.chmod(0o700);path=parent/'proof.jsonl';path.write_bytes(b'original')
            with self.assertRaises(FileExistsError):m.exclusive_journal(path)
            self.assertEqual(path.read_bytes(),b'original')
    def test_new_file_private_and_symlink_rejected(self):
        with tempfile.TemporaryDirectory()as name:
            parent=Path(name);parent.chmod(0o700);path=parent/'proof.jsonl';fd=m.exclusive_journal(path)
            self.assertEqual(stat.S_IMODE(os.fstat(fd).st_mode),0o600);os.close(fd)
            alias=parent/'alias';alias.symlink_to(path)
            with self.assertRaises(OSError):m.exclusive_journal(alias)
    def test_public_parent_is_rejected_before_create(self):
        with tempfile.TemporaryDirectory()as name:
            parent=Path(name);parent.chmod(0o755)
            with self.assertRaisesRegex(ValueError,'journal_scope'):m.exclusive_journal(parent/'proof')
            self.assertFalse((parent/'proof').exists())

if __name__=='__main__':unittest.main()
