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

    def test_apply_runs_six_groups_refreshes_and_verifies_counts(self):
        spec = importlib.util.spec_from_file_location('backfill_history', SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        class Crate:
            def __init__(self):
                self.calls = []
            def select(self, sql, params=None):
                self.calls.append((sql, params))
                if 'sys.shards' in sql:
                    return [{'rows': 6, 'bytes': 600}]
                if "appeared_source <>" in sql:
                    return [{'records': 0}]
                return [{'media_type': media, 'streaming_type': kind, 'offers': 1,
                         'countries': 1, 'missing_created_at': 0}
                        for media in ('movie', 'show') for kind in ('flatrate', 'free', 'ads')]
            def run(self, sql, params=None):
                self.calls.append((sql, params))
        crate = Crate()
        report = module.backfill(crate, dry_run=False)
        inserts = [(sql, params) for sql, params in crate.calls if sql.lstrip().startswith('INSERT')]
        self.assertEqual({tuple(params) for _, params in inserts},
                         {(media, kind) for media in ('movie', 'show') for kind in ('flatrate', 'free', 'ads')})
        self.assertEqual(len(inserts), 6)
        self.assertIn(('REFRESH TABLE availability_history', None), crate.calls)
        self.assertIn('FROM availability_history', crate.calls[-1][0])
        self.assertTrue(report['counts_match'])

    def test_reconcile_scopes_both_sides_of_each_join_to_the_requested_group(self):
        spec = importlib.util.spec_from_file_location('backfill_history', SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        class ReadOnlyCrate:
            def __init__(self):
                self.calls = []
            def select(self, sql, params=None):
                self.calls.append((sql, params))
                return [{'records': 0}]
            def run(self, *args):
                raise AssertionError('Reconcile preview must remain read-only')
        crate = ReadOnlyCrate()
        module.reconcile(crate)
        self.assertEqual(len(crate.calls), 12)
        for sql, params in crate.calls:
            joined = 'a' if 'LEFT JOIN streaming_availability a' in sql else 'h'
            on = sql.split(' ON ', 1)[1] if ' ON ' in sql else sql.split('ON ', 1)[1]
            on = on.split('WHERE', 1)[0]
            self.assertIn(f'{joined}.media_type = ?', on)
            self.assertIn(f'{joined}.streaming_type = ?', on)
            self.assertEqual(params[:2], params[2:])
            self.assertEqual(len(params), 4)
