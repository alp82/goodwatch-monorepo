"""Opt-in SQL/created_at checks on disposable localhost Crate only."""
import os
import re
import sys
import unittest
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4
from unittest.mock import patch

from crate import client
sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from f.db.cratedb import CrateConnector
from f.sync.models.crate_schemas import SCHEMAS
from f.sync.init.cratedb import create_table_sql
from f.sync.copy import tmdb_streaming
from f.sync.availability_history import Stay
from backfill_availability_history import backfill
import test_availability_history as fixtures
from test_availability_history import day

URL = os.environ.get('TEST_CRATE_URL')


class LocalCrate(CrateConnector):
    def __init__(self, url, prefix):
        if urlparse(url).hostname not in ('localhost', '127.0.0.1'):
            raise ValueError('History integration tests require disposable localhost Crate')
        self.con = client.connect(url)
        self.cur = self.con.cursor()
        self.tables = {name: prefix + name for name in
                       ('availability_history', 'streaming_availability', 'streaming_evidence', 'streaming_service', 'show', 'movie')}

    def sql(self, sql):
        return re.sub(r'\b(FROM|INTO|TABLE|UPDATE|JOIN) (\w+)\b',
                      lambda m: m[1] + ' ' + self.tables.get(m[2], m[2]), sql)

    def run(self, sql, params=None):
        self.cur.execute(self.sql(sql), params)

    def run_many(self, sql, params, **kwargs):
        return super().run_many(self.sql(sql), params, **kwargs)

    def _bulk(self, table, sql, data):
        return super()._bulk(table, self.sql(sql), data)

    @property
    def history(self):
        self.run('REFRESH TABLE availability_history')
        return {tuple(row[k] for k in SCHEMAS['availability_history']['primary_key']): row
                for row in self.select('SELECT * FROM availability_history')}


@unittest.skipUnless(URL, 'Set TEST_CRATE_URL to disposable localhost Crate')
class HistorySQLTests(unittest.TestCase):
    def setUp(self):
        import mongomock
        self.db = mongomock.MongoClient().db
        self.crate = LocalCrate(URL, 'history_test_' + uuid4().hex[:10] + '_')
        for name in self.crate.tables:
            spec = SCHEMAS[name] | {'shards': 1, 'replicas': '0'}
            self.crate.run(create_table_sql(name, spec))
        self.crate.run("INSERT INTO streaming_service (tmdb_id, media_type, name) VALUES (8, 'show', 'Netflix')")
        self.crate.run('REFRESH TABLE streaming_service')

    def tearDown(self):
        for table in reversed(self.crate.tables):
            self.crate.run('DROP TABLE ' + table)
        self.crate.disconnect()

    observe = fixtures.HistoryTests.observe
    publish = fixtures.HistoryTests.publish

    def test_schema_writer_returns_and_created_at_preservation(self):
        self.observe('2026-10-15T12:00:00')
        self.publish()
        self.crate.run('REFRESH TABLE streaming_availability')
        created = self.crate.select('SELECT created_at FROM streaming_availability')[0]['created_at']
        self.observe('2026-10-15T13:00:00')
        document = self.db.tmdb_tv_details.find_one({'tmdb_id': 42})
        payload = document['watch_providers']
        payload['results']['US']['flatrate'][0]['display_priority'] = 10
        self.db.tmdb_tv_details.update_one({'tmdb_id': 42}, {'$set': {
            'watch_providers': payload, 'watch_providers_check.payload_hash': fixtures.snapshot_id(payload)}})
        self.publish()
        self.crate.run('REFRESH TABLE streaming_availability')
        self.assertEqual(self.crate.select('SELECT created_at FROM streaming_availability')[0]['created_at'], created)
        self.observe('2026-10-15T14:00:00', ())
        self.publish()
        self.observe('2026-10-15T15:00:00')
        self.publish()
        self.assertEqual(len(self.crate.history), 2)
        self.assertEqual(sum(row['dropped_on'] is None for row in self.crate.history.values()), 1)

    def test_backfill_sql_is_unknown_idempotent_and_read_only_in_dry_run(self):
        self.crate.run("""INSERT INTO streaming_availability
            (media_tmdb_id, media_type, country_code, streaming_service_id, streaming_type, created_at)
            VALUES (42, 'show', 'US', 8, 'flatrate', ?)""", (day('2026-09-01'),))
        self.crate.run('REFRESH TABLE streaming_availability')
        backfill(self.crate)
        self.assertEqual(len(self.crate.history), 0)
        backfill(self.crate, dry_run=False)
        backfill(self.crate, dry_run=False)
        self.assertEqual(len(self.crate.history), 1)
        stay = next(iter(self.crate.history.values()))
        self.assertEqual((stay['appeared_on'], stay['appeared_precision']), (day('2026-09-01'), 'unknown'))
        self.assertIsNone(stay['last_seen_on'])

    def test_consecutive_days_sql(self):
        fixtures.HistoryTests.test_consecutive_fresh_title_reads_make_arrival_and_drop_exact(self)
