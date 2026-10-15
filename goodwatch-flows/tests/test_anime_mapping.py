"""Public snapshot builder and refresh entry point; only network/Crate are replaced."""
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = Path(__file__).parent / 'fixtures' / 'anime_mapping'
spec = importlib.util.spec_from_file_location('anime_refresh', ROOT / 'windmill/f/anime_mapping/refresh.py')
refresh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refresh)

class AnimeSnapshotTest(unittest.TestCase):
    def test_master_placement_and_fribb_tracker_ids_form_one_snapshot(self):
        snapshot = refresh.build_snapshot((FIXTURES / 'master.xml').read_bytes(), (FIXTURES / 'crosswalk.json').read_bytes())
        frieren = next(e for e in snapshot['entries'] if e['anidbId'] == 18886)
        self.assertEqual(frieren, {'anidbId': 18886, 'showId': 209867, 'season': 1, 'offset': 28, 'ranges': [], 'ids': {'myanimelist': [59978], 'anilist': [182255], 'kitsu': [49240]}})
        one_piece = next(e for e in snapshot['entries'] if e['anidbId'] == 69)
        self.assertEqual(one_piece['season'], 'a')
        self.assertEqual(one_piece['ranges'][1], {'start': 62, 'end': 77, 'season': 2, 'offset': -61})
        self.assertEqual(len(one_piece['ranges']), 22)  # TVDB ranges never enter this list.

    def test_explicit_episode_lists_are_retained_as_unusable_not_silently_offset(self):
        master = b'<anime-list><anime anidbid="377" tmdbtv="34163" tmdbseason="1"><mapping-list><mapping anidbseason="1" tmdbseason="1" offset="23">;1-1;1-2;</mapping></mapping-list></anime></anime-list>'
        snapshot = refresh.build_snapshot(master, b'[{"anidb_id":377,"mal_id":1293}]')
        self.assertIn('unsupportedReason', snapshot['entries'][0])

    def test_failed_or_shrunken_refresh_preserves_last_complete_snapshot(self):
        class Db:
            writes = []
            def select(self, sql, params=()):
                return [{'payload': json.dumps({'entries': [{}] * 100})}]
            def run(self, sql, params=()):
                self.writes.append((sql, params))
        db = Db()
        with self.assertRaises(ValueError):
            refresh.refresh_snapshot((FIXTURES / 'master.xml').read_bytes(), (FIXTURES / 'crosswalk.json').read_bytes(), db, dry_run=False)
        self.assertEqual(db.writes, [])

    def test_publication_replaces_the_whole_snapshot_and_dry_run_never_writes(self):
        class Db:
            def __init__(self):
                self.writes = []
            def select(self, sql, params=()):
                return []
            def run(self, sql, params=()):
                self.writes.append((sql, params))
        db = Db()
        master, crosswalk = (FIXTURES / 'master.xml').read_bytes(), (FIXTURES / 'crosswalk.json').read_bytes()
        report = refresh.refresh_snapshot(master, crosswalk, db)
        self.assertEqual(db.writes, [])
        self.assertEqual(report['entries'], 7)
        refresh.refresh_snapshot(master, crosswalk, db, dry_run=False)
        published = json.loads(db.writes[0][1][1])
        self.assertEqual(published['entries'], json.loads((FIXTURES / 'snapshot.json').read_text())['entries'])
        self.assertEqual(len(published['sources']['animeLists']), 64)
        self.assertEqual(len(db.writes), 2)  # One atomic upsert, then visibility refresh.
        self.assertIn('ON CONFLICT (id) DO UPDATE', db.writes[0][0])
        self.assertEqual(db.writes[1][0], 'REFRESH TABLE anime_mapping_snapshot')

    def test_malformed_or_empty_download_never_replaces_the_snapshot(self):
        class Db:
            def select(self, *args):
                self.fail('Invalid input reached the database')
            def run(self, *args):
                self.fail('Invalid input reached the database')
            fail = self.fail
        for master, crosswalk in [(b'<incomplete', b'[]'), (b'<anime-list/>', b'[]'), ((FIXTURES / 'master.xml').read_bytes(), b'invalid')]:
            with self.assertRaises((ValueError, refresh.ET.ParseError)):
                refresh.refresh_snapshot(master, crosswalk, Db(), dry_run=False)

    def test_crosswalk_shrink_and_ambiguous_identity_are_not_silently_discarded(self):
        master = (FIXTURES / 'master.xml').read_bytes()
        crosswalk = json.loads((FIXTURES / 'crosswalk.json').read_bytes())
        previous = refresh.build_snapshot(master, json.dumps(crosswalk).encode())
        class Db:
            def select(self, *args):
                return [{'payload': json.dumps(previous)}]
            def run(self, *args):
                raise AssertionError('Shrunken crosswalk published')
        with self.assertRaisesRegex(ValueError, 'crosswalk shrank'):
            refresh.refresh_snapshot(master, json.dumps([{'anidb_id': r['anidb_id']} for r in crosswalk]).encode(), Db(), dry_run=False)
        crosswalk.append({'anidb_id': 69, 'mal_id': 59978})
        snapshot = refresh.build_snapshot(master, json.dumps(crosswalk).encode())
        self.assertEqual(sum(59978 in e['ids']['myanimelist'] for e in snapshot['entries']), 2)

if __name__ == '__main__':
    unittest.main()
