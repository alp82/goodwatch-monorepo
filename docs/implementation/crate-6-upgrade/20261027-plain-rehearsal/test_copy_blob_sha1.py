import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

p = Path(__file__).with_name('copy-blob-sha1.py')
spec = importlib.util.spec_from_file_location('q53_blob', p)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CopyBlobTests(unittest.TestCase):
    def test_deduplicates_copies_and_verifies_retry(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            src, dst = root / 'source', root / 'backup'
            key = hashlib.sha1(b'fixture').hexdigest()
            for shard in ('shard1', 'shard2'):
                p = src / shard / key
                p.parent.mkdir(parents=True)
                p.write_bytes(b'fixture')
            expected = [{'sha1': key, 'bytes': 7}]
            self.assertEqual(module.copy_objects(src, dst), expected)
            self.assertEqual(module.copy_objects(src, dst), expected)
            (dst / key).write_bytes(b'corrupt')
            with self.assertRaisesRegex(ValueError, 'destination mismatch'):
                module.copy_objects(src, dst)

    def test_rejects_bad_source_hash(self):
        with tempfile.TemporaryDirectory() as d:
            src = Path(d) / 'source'
            src.mkdir()
            (src / ('0' * 40)).write_bytes(b'wrong digest')
            with self.assertRaisesRegex(ValueError, 'Source SHA1 mismatch'):
                module.copy_objects(src, Path(d) / 'backup')

    def test_empty_node_is_valid_but_destination_inside_source_is_not(self):
        with tempfile.TemporaryDirectory() as d:
            src = Path(d) / 'source'
            src.mkdir()
            self.assertEqual(module.copy_objects(src, Path(d) / 'backup'), [])
            with self.assertRaisesRegex(ValueError, 'Invalid source/destination'):
                module.copy_objects(src, src / 'backup')

    def test_rejects_symlink_source(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            source = root / 'source'
            source.mkdir()
            other = root / 'other'
            other.write_bytes(b'fixture')
            (source / hashlib.sha1(b'fixture').hexdigest()).symlink_to(other)
            with self.assertRaisesRegex(ValueError, 'escapes inspected data path'):
                module.copy_objects(source, root / 'backup')
