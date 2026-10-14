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
        self.assertIn('CASE WHEN season_translation.name IS NULL', connector.calls[0])
        self.assertIn('ELSE season_translation.name END', connector.calls[0])

    def test_request_cap_and_input_limits(self):
        fixture = self.catalog(1396)
        result = ingest_titles([1396], fixture.__getitem__, bounds=Bounds(requests=2), sleep=lambda _: None)
        self.assertTrue(result['truncated'])
        self.assertEqual(result['requests'], 2)
        with self.assertRaises(ValueError): ingest_titles([1,2,3], lambda _: None)
        with self.assertRaises(ValueError): Bounds(requests_per_second=6).validate()

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
