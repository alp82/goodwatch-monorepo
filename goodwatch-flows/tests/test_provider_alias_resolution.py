"""Retired movie identities and crash-safe demand accounting."""
import re
from datetime import datetime
import sys
import unittest
import mongomock
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from provider_alias_resolution import retired_validator, transfer_demand
from f.data_source.title_identity import RETIRED_MOVIE_IDS, canonical_title_id


class MemoryCrate:
    def __init__(self, row=None):
        self.row = row
        self.cur = SimpleNamespace(rowcount=0)
        self.race = False
        self.lose_response = False

    def select(self, sql, args):
        return [dict(self.row)]

    def run(self, sql, args):
        if sql.lstrip().startswith('INSERT'):
            if self.row is None:
                self.row = dict(demand=0, acknowledged_demand=0,
                                alias_demand_transfers=None, _seq_no=0, _primary_term=1)
            return
        delta, ledger, canonical, seq, term = args
        if self.race:
            self.race = False
            self.row['demand'] += 3
            self.row['_seq_no'] += 1
        self.cur.rowcount = int(seq == self.row['_seq_no'] and term == self.row['_primary_term'])
        if self.cur.rowcount:
            self.row['demand'] += delta
            self.row['alias_demand_transfers'] = dict(ledger)
            self.row['_seq_no'] += 1
            if self.lose_response:
                self.lose_response = False
                raise TimeoutError('committed update response lost')


class AliasResolutionTests(unittest.TestCase):
    def test_resolved_tombstone_blocks_both_initializers_without_unresolved_metric(self):
        from f.tmdb_web.country_state import initialize_countries
        from f.tmdb_web.tmdb_init_providers.main import initialize_batch
        from f.monitoring.backlog_collection import collect_identity_repairs
        db = mongomock.MongoClient().goodwatch
        db.provider_identity_unresolved.insert_one({
            '_id': 'movie:162483', 'tmdb_id': 162483, 'media': 'movie',
            'status': 'resolved_alias', 'canonical_tmdb_id': 10679,
        })
        providers = {'DE': {'link': 'https://www.themoviedb.org/movie/162483/watch?locale=DE'}}
        with self.assertRaises(ValueError):
            initialize_countries(db.tmdb_movie_providers, 162483, providers, 'movie')
        initialize_batch(db.tmdb_movie_providers, [
            {'tmdb_id': 162483, 'watch_providers': {'results': providers}},
        ], 'movie')
        self.assertEqual(db.tmdb_movie_providers.count_documents({}), 0)
        self.assertEqual(collect_identity_repairs(db, datetime.utcnow())['unresolved_quarantines'], [])

    def test_movie_aliases_leave_tv_and_canonical_ids_unchanged(self):
        for old, canonical in RETIRED_MOVIE_IDS.items():
            self.assertEqual(canonical_title_id('movie', old), canonical)
            self.assertEqual(canonical_title_id('movie', canonical), canonical)
            self.assertEqual(canonical_title_id('tv', old), old)
            self.assertEqual(canonical_title_id('show', old), old)

    def test_shared_registry_parity(self):
        source = (ROOT.parent / 'goodwatch-webapp/app/utils/title-identity.ts').read_text()
        self.assertEqual({int(a): int(b) for a, b in re.findall(r'^\s*(\d+): (\d+),', source, re.M)}, RETIRED_MOVIE_IDS)

    def test_validator_preserves_constraints_and_is_idempotent(self):
        old = {'$jsonSchema': {'required': ['country_code']}}
        combined = retired_validator(old)
        self.assertEqual(combined['$and'][0], old)
        self.assertEqual(retired_validator(combined), combined)
        self.assertEqual(old, {'$jsonSchema': {'required': ['country_code']}})

    def test_transfer_missing_row_and_restart(self):
        db = MemoryCrate()
        transfer_demand(db, 5338654, 4)
        transfer_demand(db, 5338654, 4)
        self.assertEqual(db.row['demand'], 4)
        self.assertEqual(db.row['alias_demand_transfers'], {'5338654': 4})

    def test_transfer_preserves_concurrent_enqueue_and_acknowledgment(self):
        db = MemoryCrate(dict(demand=10, acknowledged_demand=7, alias_demand_transfers=None,
                             _seq_no=0, _primary_term=1))
        db.race = True
        transfer_demand(db, 162483, 52)
        self.assertEqual(db.row['demand'], 65)
        self.assertEqual(db.row['acknowledged_demand'], 7)

    def test_lost_response_then_resume_does_not_double_transfer(self):
        db = MemoryCrate()
        db.lose_response = True
        with self.assertRaises(TimeoutError):
            transfer_demand(db, 162483, 52)
        transfer_demand(db, 162483, 52)
        self.assertEqual(db.row['demand'], 52)
        # If a late old enqueue arrives, transfer only the newly observed delta.
        transfer_demand(db, 162483, 55)
        self.assertEqual(db.row['demand'], 55)
        with self.assertRaises(RuntimeError):
            transfer_demand(db, 162483, 52)

    def test_zero_demand_has_durable_receipt(self):
        db = MemoryCrate()
        transfer_demand(db, 3635601, 0)
        self.assertEqual(db.row['alias_demand_transfers'], {'3635601': 0})
        self.assertEqual(db.row['demand'], 0)


if __name__ == '__main__':
    unittest.main()
