"""No network/Crate/model calls. Native unittest production seam contracts."""
import json
from decimal import Decimal
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.media_language.episode_translations import Bounds, ingest_titles, publish_rows, translation_rows
from f.media_language.prose_jobs import Budget, revision, run_jobs, validate


def payload(identifier, **fields):
    return {'id': identifier, 'translations': [{'iso_639_1': 'de', 'iso_3166_1': 'DE', 'data': fields}]}


class TranslationIngestionTest(unittest.TestCase):
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
        self.assertEqual(SCHEMAS['prose_translation']['primary_key'], ['source_id', 'source_revision', 'language'])
        self.assertNotIn('DELETE', sql)


class ProseJobTest(unittest.TestCase):
    def test_revision_is_sha256_utf8_contract(self):
        self.assertEqual(revision('Hello'), '185f8db32271fe25f561a6fc938b2e264306ec304eda518007d1764826381969')

    def test_validation_preserves_numbers_placeholders_and_language(self):
        self.assertEqual(validate('Score {title}: 8/100.', 'Wertung {title}: 8/100.', 'de', lambda _: 'de'), 'Wertung {title}: 8/100.')
        for text, detect in [('Wertung: 8/100.', 'de'), ('Wertung {title}: 9/100.', 'de'), ('Rating {title}: 8/100.', 'en')]:
            with self.assertRaises(ValueError): validate('Score {title}: 8/100.', text, 'de', lambda _: detect)
        with self.assertRaises(ValueError): validate('Some long sentence here.', 'x', 'de', lambda _: 'de')
        with self.assertRaises(ValueError): validate('A Chinese sentence.', '這是一段繁體中文的文字。', 'zh-Hant', lambda _: 'zh-Hans')

    def test_default_is_dry_and_zero_cost(self):
        result = run_jobs([{'source_id': 'movie:603:essence_text', 'text': 'An atmospheric journey.'}], ['de'],
                          read=lambda *key: None, publish=lambda record: self.fail('write'),
                          request=lambda payload: self.fail('paid call'))
        self.assertEqual(result[0]['status'], 'dry-run')
        self.assertEqual(result[0]['cost_usd'], 0)

    def test_zero_budget_fails_before_request(self):
        with self.assertRaises(ValueError):
            run_jobs([{'source_id': 'x', 'text': 'Hello'}], ['de'], read=lambda *key: None,
                     publish=lambda _: None, request=lambda _: self.fail('paid'), detect=lambda _: 'de', budget=Budget(), dry_run=False)

    def test_retry_charges_validation_failures_and_publishes_exact_revision(self):
        calls, published, ledger = [], [], []
        def request(payload):
            calls.append(payload)
            text = 'English text' if len(calls) == 1 else 'Eine schöne Reise.'
            return {'choices': [{'message': {'content': json.dumps({'text': text})}}],
                    'usage': {'cost': 0.001, 'prompt_tokens': 20, 'completion_tokens': 10}}
        source = 'A beautiful journey.'
        budget = Budget(Decimal('0.1'), persist=ledger.append)
        result = run_jobs([{'source_id': 'x', 'text': source}], ['de'], read=lambda *key: None,
                          publish=published.append, request=request, detect=lambda text: 'en' if text == 'English text' else 'de',
                          budget=budget, dry_run=False, sleep=lambda _: None)
        self.assertEqual(result[0]['attempts'], 2)
        self.assertEqual(result[0]['cost_usd'], 0.002)
        self.assertEqual(budget.used, Decimal('0.002'))
        self.assertEqual(published[-1]['source_revision'], revision(source))
        self.assertEqual([r['status'] for r in published], ['failed', 'valid'])
        self.assertEqual(calls[0]['model'], 'qwen/qwen3.8-flash')
        self.assertFalse(calls[0]['provider']['allow_fallbacks'])
        self.assertEqual(len(ledger), 4)

    def test_timeout_reservation_survives_and_blocks_retry(self):
        calls = []
        def request(payload): calls.append(payload); raise TimeoutError()
        budget = Budget(Decimal('0.003'))
        with self.assertRaises(ValueError):
            run_jobs([{'source_id': 'x', 'text': 'A beautiful journey.'}], ['de'], read=lambda *key: None,
                     publish=lambda _: None, request=request, detect=lambda _: 'de', budget=budget, dry_run=False, sleep=lambda _: None)
        self.assertEqual(len(calls), 1)
        self.assertGreater(budget.used, 0)

    def test_durable_ledger_and_provider_cost_errors_stop_before_another_call(self):
        from f.media_language.prose_jobs import SpendContractError
        budget = Budget(Decimal('1'))
        reserved = Decimal('0.01')
        budget.reserve(reserved)
        with self.assertRaises(SpendContractError): budget.settle(reserved, 1)
        with self.assertRaises(SpendContractError): budget.settle(reserved, 'not-a-cost')
        with self.assertRaises(ValueError): Budget(Decimal('1'), Decimal('-1')).reserve(reserved)

    def test_fixed_templates_cannot_enter_paid_translation(self):
        with self.assertRaises(ValueError):
            run_jobs([{'source_id': 'template:hash', 'text': 'Template text', 'kind': 'template'}], ['de'],
                     read=lambda *key: None, publish=lambda _: None, request=lambda _: self.fail('paid'),
                     detect=lambda _: 'de', budget=Budget(Decimal('1')), dry_run=False)

    def test_failed_attempt_costs_are_retained_across_resume(self):
        def request(_):
            return {'choices': [{'message': {'content': '{"text":"Eine schöne Reise."}'}}],
                    'usage': {'cost': 0.001, 'prompt_tokens': 20, 'completion_tokens': 10}}
        result = run_jobs([{'source_id': 'x', 'text': 'A beautiful journey.'}], ['de'],
                          read=lambda *key: {'status': 'failed', 'attempts': 2, 'cost_usd': 0.005, 'prompt_tokens': 40},
                          publish=lambda _: None, request=request, detect=lambda _: 'de',
                          budget=Budget(Decimal('1')), dry_run=False)
        self.assertEqual(result[0]['attempts'], 3)
        self.assertEqual(result[0]['cost_usd'], 0.006)
        self.assertEqual(result[0]['prompt_tokens'], 60)

    def test_same_revision_skips_but_new_revision_does_not(self):
        read = lambda source, rev, lang: {'status': 'valid', 'validation_revision': 'prose-v1'} if rev == revision('Old source') else None
        results = run_jobs([{'source_id': 'x', 'text': 'Old source'}, {'source_id': 'x', 'text': 'New source'}], ['de'],
                           read=read, publish=lambda _: self.fail('write'))
        self.assertEqual([r['status'] for r in results], ['existing', 'dry-run'])


if __name__ == '__main__': unittest.main()
