import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).parents[1] / 'scripts/backfill_availability_history.py'


class BackfillTests(unittest.TestCase):
    def test_dry_run_reads_counts_and_estimates_size_without_writes(self):
        spec = importlib.util.spec_from_file_location('backfill_history', SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        class ReadOnlyCrate:
            def select(self, sql, params=None):
                if 'sys.shards' in sql:
                    return [{'rows': 200, 'bytes': 60000}]
                return [{'media_type': 'movie', 'streaming_type': 'flatrate', 'offers': 100,
                         'countries': 2, 'missing_created_at': 0}]
            def run(self, *args):
                raise AssertionError('A dry run must not write')
        report = module.backfill(ReadOnlyCrate())
        self.assertEqual(report['open_records'], 100)
        self.assertEqual(report['estimated_primary_bytes'], 24000)
        self.assertTrue(report['dry_run'])
