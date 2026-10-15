"""No network/Crate/model calls. Native unittest production seam contracts."""
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.media_language.episode_translations import Bounds, ingest_titles, publish_rows, translation_rows


def payload(identifier, **fields):
    return {'id': identifier, 'translations': [{'iso_639_1': 'de', 'iso_3166_1': 'DE', 'data': fields}]}


class TranslationIngestionTest(unittest.TestCase):
    def test_windmill_lock_pins_the_runtime_http_adapter(self):
        lock = (Path(__file__).parents[1] / 'windmill/f/media_language/ingest_episode_translations.script.lock').read_text().splitlines()
        packages = {line.split('==')[0] for line in lock if '==' in line}
        self.assertTrue({'requests', 'charset-normalizer', 'certifi', 'idna', 'urllib3'}.issubset(packages))
        reference = (Path(__file__).parents[1] / 'windmill/f/sync/populate/tmdb_genres.script.lock').read_text().splitlines()
        self.assertEqual(next(line for line in lock if line.startswith('requests==')),
                         next(line for line in reference if line.startswith('requests==')))

    def test_only_nonblank_owned_fields_and_supported_locales(self):
        rows = translation_rows(1396, 42, payload(42, name=' Name ', overview=' '))
        self.assertEqual(rows, [{'show_id': 1396, 'tmdb_id': 42, 'language_code': 'de', 'country_code': 'DE', 'name': 'Name'}])
        rows = translation_rows(1396, 42, {'id': 42, 'translations': [
            {'iso_639_1': language, 'iso_3166_1': country, 'data': {'name': 'N'}}
            for language, country in [('pt', 'BR'), ('pt', 'PT'), ('pt', 'AO'), ('zh', 'TW'), ('zh', 'CN'), ('zh', 'US'), ('xx', 'US')]]})
        self.assertEqual([(r['language_code'], r['country_code']) for r in rows], [('pt', 'BR'), ('pt', 'PT'), ('zh', 'TW'), ('zh', 'CN')])

    def test_identity_and_partial_response_fail_closed(self):
        for value in ({'id': 7, 'translations': []}, {'id': 42}, {'id': 42, 'translations': None}):
            with self.assertRaises(ValueError): translation_rows(1396, 42, value)

    def test_publish_has_no_delete_and_does_not_overwrite_missing_fields(self):
        class Connector:
            def __init__(self): self.calls = []
            def run_many(self, sql, values): self.calls.append((sql, values))
        connector = Connector()
        publish_rows(connector, 'episode_translation', translation_rows(1396, 42, payload(42, name='Neu')))
        sql = connector.calls[0][0]
        self.assertNotIn('DELETE', sql)
        self.assertNotIn('overview', sql)
        self.assertNotIn('episode_number', sql)
        self.assertIn('name = excluded.name', sql)
        publish_rows(connector, 'episode_translation', [])
        self.assertEqual(len(connector.calls), 1)

    def test_preserve_existing_renders_crate_conflict_sql_and_bound_values(self):
        class Connector:
            def __init__(self): self.calls = []
            def run_many(self, sql, values): self.calls.append((sql, values))
        rows = translation_rows(1396, 42, payload(42, name='Neu', overview='Beschreibung'))
        for table in ('season_translation', 'episode_translation'):
            with self.subTest(table=table):
                connector = Connector()
                publish_rows(connector, table, rows, preserve_existing=True)
                self.assertEqual(connector.calls, [(
                    f'INSERT INTO {table} (show_id, tmdb_id, language_code, country_code, name, overview) '
                    'VALUES (?, ?, ?, ?, ?, ?) '
                    'ON CONFLICT (show_id, tmdb_id, language_code, country_code) DO UPDATE SET '
                    "name = CASE WHEN name IS NULL OR name = '' THEN excluded.name ELSE name END, "
                    "overview = CASE WHEN overview IS NULL OR overview = '' THEN excluded.overview ELSE overview END",
                    [(1396, 42, 'de', 'DE', 'Neu', 'Beschreibung')],
                )])

    def catalog(self, title):
        return {f'tv/{title}': {'id': title, 'seasons': [{'id': title*10, 'season_number': 1}]},
                f'tv/{title}/season/1': {'id': title*10, 'season_number': 1, 'episodes': [
                    {'id': title*100, 'show_id': title, 'season_number': 1, 'episode_number': 1}]},
                f'tv/{title}/season/1/translations': payload(title*10, name='Staffel'),
                f'tv/{title}/season/1/episode/1/translations': payload(title*100, overview='Folge')}

    def test_two_title_mock_dry_run_is_bounded_and_rate_limited(self):
        fixture = self.catalog(1396) | self.catalog(1399)
        sleeps, paths = [], []
        def get(path): paths.append(path); return fixture[path]
        result = ingest_titles([1396, 1399], get, sleep=sleeps.append)
        self.assertEqual(result['requests'], 8)
        self.assertEqual(result['rows'], 4)
        self.assertEqual(result['episodes'], 2)
        self.assertEqual(sleeps, [0.5]*7)
        self.assertEqual(result['failures'], [])
        self.assertTrue(result['dry_run'])

    def test_partial_fetch_keeps_successes_without_deleting(self):
        fixture = self.catalog(1396)
        class Connector:
            def __init__(self): self.calls = []
            def run_many(self, sql, values): self.calls.append(sql)
        connector = Connector()
        def get(path):
            if '/episode/' in path: raise TimeoutError()
            return fixture[path]
        result = ingest_titles([1396], get, connector, dry_run=False, sleep=lambda _: None)
        self.assertEqual(result['rows'], 1)
        self.assertEqual(len(result['failures']), 1)
        self.assertEqual(len(connector.calls), 1)
        self.assertNotIn('DELETE', connector.calls[0])
        self.assertIn('CASE WHEN name IS NULL', connector.calls[0])
        self.assertIn('ELSE name END', connector.calls[0])

    def test_request_cap_and_input_limits(self):
        fixture = self.catalog(1396)
        result = ingest_titles([1396], fixture.__getitem__, bounds=Bounds(requests=2), sleep=lambda _: None)
        self.assertTrue(result['truncated'])
        self.assertEqual(result['requests'], 2)
        with self.assertRaises(ValueError): ingest_titles([1,2,3], lambda _: None)
        with self.assertRaises(ValueError): Bounds(requests_per_second=6).validate()

    def long_show(self, title, seasons=3, episodes=3):
        """A show with `seasons` seasons of `episodes` episodes, each with German text."""
        fixture = {f'tv/{title}': {'id': title, 'seasons': [
            {'id': title*10 + n, 'season_number': n} for n in range(1, seasons + 1)]}}
        for n in range(1, seasons + 1):
            path = f'tv/{title}/season/{n}'
            fixture[path] = {'id': title*10 + n, 'season_number': n, 'episodes': [
                {'id': title*1000 + n*100 + e, 'show_id': title, 'season_number': n, 'episode_number': e}
                for e in range(1, episodes + 1)]}
            fixture[path + '/translations'] = payload(title*10 + n, name=f'Staffel {n}')
            for e in range(1, episodes + 1):
                fixture[path + f'/episode/{e}/translations'] = payload(title*1000 + n*100 + e, name=f'Folge {e}')
        return fixture

    def run_paths(self, fixture, ids, **kwargs):
        paths = []
        def get(path): paths.append(path); return fixture[path]
        return ingest_titles(ids, get, sleep=lambda _: None, **kwargs), paths

    def test_per_title_caps_cut_one_title_and_move_on(self):
        fixture = self.long_show(1396) | self.long_show(1399)
        bounds = Bounds(seasons=100, episodes=1000, seasons_per_title=2, episodes_per_title=4)
        result, paths = self.run_paths(fixture, [1396, 1399], bounds=bounds)
        self.assertEqual(result['seasons'], 4)
        self.assertEqual(result['episodes'], 8)
        self.assertTrue(result['truncated'])
        self.assertEqual(result['continuation'], [
            {'tmdb_id': 1396, 'season_number': 2, 'episode_number': 2},
            {'tmdb_id': 1399, 'season_number': 2, 'episode_number': 2}])
        self.assertEqual(result['unstarted'], [])
        self.assertNotIn('tv/1396/season/3', paths)
        with self.assertRaises(ValueError): Bounds(seasons=10, seasons_per_title=11).validate()
        with self.assertRaises(ValueError): Bounds(episodes_per_title=0).validate()

    def test_season_cap_cursor_resumes_at_the_next_season(self):
        fixture = self.long_show(1396)
        first, _ = self.run_paths(fixture, [1396], bounds=Bounds(seasons_per_title=1))
        self.assertEqual(first['continuation'], [{'tmdb_id': 1396, 'season_number': 2, 'episode_number': None}])
        second, paths = self.run_paths(fixture, [1396], resume=first['continuation'])
        self.assertNotIn('tv/1396/season/1', paths)
        self.assertIn('tv/1396/season/2/translations', paths)
        self.assertEqual((second['seasons'], second['episodes'], second['continuation']), (2, 6, []))
        self.assertFalse(second['truncated'])

    def test_mid_season_resume_skips_fetched_text_and_covers_everything_once(self):
        fixture = self.long_show(1396)
        fetched, resume = [], None
        for runs in range(1, 10):
            result, paths = self.run_paths(fixture, [1396], bounds=Bounds(episodes_per_title=2), resume=resume)
            fetched += [p for p in paths if p.endswith('/translations')]
            if not result['continuation']:
                break
            resume = result['continuation']
        self.assertEqual(runs, 5)
        # Every season and episode text is fetched exactly once across the runs.
        expected = [p for p in fixture if p.endswith('/translations')]
        self.assertEqual(sorted(fetched), sorted(expected))

    def test_request_cap_reports_cursor_and_unstarted_titles(self):
        fixture = self.long_show(1396) | self.long_show(1399)
        # Show, season 1, its text and two episode texts: the third episode text is refused.
        result, _ = self.run_paths(fixture, [1396, 1399], bounds=Bounds(requests=5))
        self.assertEqual(result['continuation'], [{'tmdb_id': 1396, 'season_number': 1, 'episode_number': 3}])
        self.assertEqual(result['unstarted'], [1399])
        resumed, paths = self.run_paths(fixture, [1396], resume=result['continuation'])
        self.assertEqual(paths[:3], ['tv/1396', 'tv/1396/season/1', 'tv/1396/season/1/episode/3/translations'])
        self.assertEqual(resumed['episodes'], 7)

    def test_run_wide_cap_lists_later_titles_as_unstarted(self):
        fixture = self.long_show(1396, seasons=1) | self.long_show(1399, seasons=1)
        result, paths = self.run_paths(fixture, [1396, 1399], bounds=Bounds(episodes=3))
        self.assertEqual(result['episodes'], 3)
        self.assertEqual(result['unstarted'], [1399])
        self.assertTrue(result['truncated'])
        self.assertNotIn('tv/1399', paths)

    def test_resume_rejects_bad_cursors_and_reports_a_vanished_season(self):
        fixture = self.long_show(1396)
        for cursor in ({'tmdb_id': 1399, 'season_number': 1}, {'tmdb_id': 1396, 'season_number': -1},
                       {'tmdb_id': 1396, 'season_number': 1, 'episode_number': 0}):
            with self.assertRaises(ValueError):
                ingest_titles([1396], fixture.__getitem__, resume=[cursor])
        result, _ = self.run_paths(fixture, [1396], resume=[{'tmdb_id': 1396, 'season_number': 9}])
        self.assertEqual(result['failures'], [{'path': 'tv/1396', 'error': 'LookupError'}])
        self.assertEqual(result['rows'], 0)

    def test_a_resumed_title_cut_before_its_show_request_keeps_its_cursor(self):
        fixture = self.long_show(1399, seasons=1, episodes=1) | self.long_show(1396)
        cursor = {'tmdb_id': 1396, 'season_number': 2, 'episode_number': 3}
        # 1399 takes all four requests, so 1396 is refused at its show request.
        result, _ = self.run_paths(fixture, [1399, 1396], bounds=Bounds(requests=4), resume=[cursor])
        self.assertEqual(result['continuation'], [cursor])
        self.assertEqual(result['unstarted'], [])

    def test_schema_registry_and_migration_match_stable_locale_keys(self):
        from f.sync.models.crate_schemas import SCHEMAS
        sql = (Path(__file__).parents[2] / 'docs/implementation/media-language-text-schema.sql').read_text()
        for table in ('season_translation', 'episode_translation'):
            self.assertEqual(SCHEMAS[table]['primary_key'], ['show_id', 'tmdb_id', 'language_code', 'country_code'])
            self.assertEqual(SCHEMAS[table]['clustered_by'], 'show_id')
            self.assertIn(f'CREATE TABLE IF NOT EXISTS doc.{table}', sql)
        self.assertNotIn('prose_translation', SCHEMAS)
        self.assertNotIn('prose_translation', sql)
        self.assertNotIn('DELETE', sql)


if __name__ == '__main__': unittest.main()
