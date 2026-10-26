"""Actual frontend SQL, migration and metadata leases on disposable CrateDB.

Run with TEST_CRATE_URL=http://127.0.0.1:<port>. Only loopback is accepted;
every test owns a randomly named table and removes it afterward.
"""
from concurrent.futures import ThreadPoolExecutor
import importlib.util
import json
import os
from pathlib import Path
import subprocess
from types import SimpleNamespace
import unittest
from urllib.parse import urlsplit
from uuid import uuid4

from test_priority_queue_integration import HttpCrate, queue, schemas
from f.tmdb_web.availability_selector import recent_open_ids

ROOT = Path(__file__).resolve().parents[2]
URL = os.environ.get('TEST_CRATE_URL')


def statement(items):
    source = "import {priorityStatement} from './goodwatch-webapp/app/server/utils/priority-statement.ts'; "
    source += 'process.stdout.write(JSON.stringify(priorityStatement(JSON.parse(process.argv[1]))));'
    return json.loads(subprocess.check_output(
        ['node', '--input-type=module', '-e', source, json.dumps(items)], cwd=ROOT, text=True))


@unittest.skipUnless(URL, 'disposable loopback CrateDB required')
class OpenedDemandCrateTests(unittest.TestCase):
    def setUp(self):
        parsed = urlsplit(URL)
        if parsed.scheme != 'http' or parsed.hostname not in ('127.0.0.1', 'localhost', '::1'):
            raise ValueError('Only a disposable loopback CrateDB is allowed')
        self.table = 'opened_test_' + uuid4().hex
        self.db = HttpCrate(self.table)
        columns = schemas.SCHEMAS['crawl_priority']['columns'] | {
            'created_at': 'TIMESTAMP', 'updated_at': 'TIMESTAMP'}
        # Start from the existing production schema, before this migration.
        definitions = [f'{name} {kind}' for name, kind in columns.items() if name != 'last_opened_at']
        definitions.append('PRIMARY KEY (media_type, tmdb_id)')
        self.db.run(f"CREATE TABLE {self.table} ({', '.join(definitions)}) "
                    'CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = 0)')
        spec = importlib.util.spec_from_file_location(
            'opened_real_migration', ROOT / 'goodwatch-flows/scripts/migrate_opened_demand.py')
        self.migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.migration)

    def tearDown(self):
        self.db.run(f'DROP TABLE {self.table}')

    def migrate(self):
        self.migration.migrate(SimpleNamespace(
            execute=self.db.run,
            fetchone=lambda: self.db.result['rows'][0] if self.db.result['rows'] else None))

    def row(self):
        return self.db.select('SELECT *, CAST(last_opened_at AS BIGINT) AS opened_ms '
                              "FROM crawl_priority WHERE media_type = 'movie' AND tmdb_id = 10679")[0]

    def upsert(self, items):
        sql = statement(items)
        self.db.run(sql['sql'], sql['args'])

    def test_existing_row_migration_and_poster_preserve_opened_and_claim_fields(self):
        self.db.run("INSERT INTO crawl_priority (media_type,tmdb_id,demand,acknowledged_demand,"
                    "claimed_demand,lease_token,lease_expires_at) VALUES ('movie',10679,10,3,7,'owner',4102444800000)")
        self.migrate()
        self.migrate()
        self.assertIsNone(self.row()['opened_ms'])
        self.upsert([dict(media_type='movie', tmdb_id=162483, source_kind='opened'),
                     dict(media_type='movie', tmdb_id=10679, source_kind='poster')])
        opened = self.row()
        self.assertIsInstance(opened['opened_ms'], int)
        self.assertEqual(opened['demand'], 12)
        self.assertEqual((opened['acknowledged_demand'], opened['claimed_demand'], opened['lease_token']),
                         (3, 7, 'owner'))
        self.upsert([dict(media_type='movie', tmdb_id=10679)])
        self.assertEqual(self.row()['opened_ms'], opened['opened_ms'])

    def test_concurrent_sources_increment_demand_without_losing_newer_open(self):
        self.migrate()
        opened = statement([dict(media_type='movie', tmdb_id=10679, source_kind='opened')])
        poster = statement([dict(media_type='movie', tmdb_id=10679)])
        self.db.run(opened['sql'], opened['args'])
        first = self.row()['opened_ms']

        def write(index):
            sql = opened if index % 2 else poster
            HttpCrate(self.table).run(sql['sql'], sql['args'])

        with ThreadPoolExecutor(max_workers=4) as executor:
            list(executor.map(write, range(12)))
        row = self.row()
        self.assertEqual(row['demand'], 13)
        self.assertGreaterEqual(row['opened_ms'], first)

    def test_open_during_metadata_claim_survives_ack_and_remains_available_to_selector(self):
        from datetime import datetime
        self.migrate()
        self.upsert([dict(media_type='movie', tmdb_id=10679)])
        lease = queue.claim(self.db, 'movie', 10679)
        self.assertIsNotNone(lease)
        self.upsert([dict(media_type='movie', tmdb_id=10679, source_kind='opened')])
        opened = self.row()['opened_ms']
        queue.acknowledge(self.db, lease)
        self.assertEqual(self.row()['opened_ms'], opened)
        self.assertEqual(self.row()['demand'] - self.row()['acknowledged_demand'], 1)
        self.assertIsNone(queue.claim(self.db, 'movie', 10679))
        self.db.run('REFRESH TABLE crawl_priority')
        self.assertEqual(recent_open_ids(self.db, 'movie', datetime.utcnow()), [10679])


if __name__ == '__main__':
    unittest.main()
