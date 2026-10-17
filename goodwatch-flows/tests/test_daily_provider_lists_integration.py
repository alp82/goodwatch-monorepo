"""Opt-in real SQL at the daily entrypoint; localhost-only disposable Crate."""
from datetime import datetime
import os
import unittest
from uuid import uuid4

import mongomock
from test_availability_history_integration import LocalCrate
from test_daily_provider_lists import TMDB
from f.sync.init.cratedb import create_table_sql
from f.sync.models.crate_schemas import SCHEMAS
from f.tmdb_api.daily_list_storage import ListStorage
from f.tmdb_api.daily_provider_lists import run_daily_lists


@unittest.skipUnless(os.environ.get('TEST_CRATE_URL'), 'Set TEST_CRATE_URL to disposable localhost Crate')
class DailyListSQLTests(unittest.TestCase):
    def test_real_schema_baseline_exact_changes_and_return_use_only_history(self):
        crate = LocalCrate(os.environ['TEST_CRATE_URL'], 'daily682_' + uuid4().hex[:10] + '_')
        crate.run(create_table_sql('availability_history', SCHEMAS['availability_history'] | {'shards': 1, 'replicas': '0'}))
        try:
            store = ListStorage(db=mongomock.MongoClient().db, connector=crate, dry_run=False)
            api = TMDB()
            for day, ids in [(13, [41]), (14, [41, 42]), (15, []), (16, [42])]:
                api.ids = ids
                api.results = {'US': {'flatrate': [{'provider_id': 8}]}} if ids else {}
                report = run_daily_lists(api, store, countries=['US'], provider_ids=[8], media_types=['show'],
                                         dry_run=False, now=datetime(2026, 10, day, 20))
                self.assertEqual(report['lists_failed'], 0, report)
            rows = list(crate.history.values())
            self.assertEqual(len(rows), 3)
            first = next(row for row in rows if row['media_tmdb_id'] == 41)
            self.assertEqual(first['appeared_precision'], 'unknown')
            self.assertEqual(first['dropped_precision'], 'exact')
            returns = [row for row in rows if row['media_tmdb_id'] == 42]
            self.assertEqual({row['appeared_precision'] for row in returns}, {'exact'})
            self.assertEqual({row['appeared_source'] for row in rows}, {'title'})
            # Only the history table exists: any attempt to write offers fails.
        finally:
            crate.run('DROP TABLE availability_history')
            crate.disconnect()
