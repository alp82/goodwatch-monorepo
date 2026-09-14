"""Spend-pause behavior through the Windmill entry points, with fake services."""
import json
import importlib
import importlib.util
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import fakeredis
import mongomock
import requests
import yaml
from freezegun import freeze_time
from mongoengine import connect, disconnect

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.dna.generate import fetch, next as next_batch, vectors
from f.dna.models import DnaMovie, DnaTv


PAUSE_KEY = 'dna:openrouter:spend_pause'
WINDMILL = Path(__file__).parents[1] / 'windmill'


def flow_value(expression, scope):
    """The DNA flows use only dotted lookups, not general JavaScript."""
    value = scope
    for key in expression.split('.'):
        value = value[key]
    return value


def run_flow(path, flow_input):
    """Exercise checked-in wiring locally; the real Windmill run is acceptance."""
    directory = WINDMILL / (path + '.flow')
    flow = yaml.safe_load((directory / 'flow.yaml').read_text())

    def run_modules(modules, inputs):
        results = {}
        for module in modules:
            value = module['value']
            if value.get('path') == 'f/dna/generate/fetch' and 'retry' in module:
                raise AssertionError('DNA fetch owns retries; its flow retry must be absent')
            scope = {'flow_input': inputs, 'results': results}
            arguments = {key: flow_value(transform['expr'], scope)
                         for key, transform in value.get('input_transforms', {}).items()}
            if value['type'] == 'script':
                result = importlib.import_module(value['path'].replace('/', '.')).main(**arguments)
            elif value['type'] == 'flow':
                result = run_flow(value['path'], arguments)
            elif value['type'] == 'forloopflow':
                result = [run_modules(value['modules'], {**inputs, 'iter': {'value': item}})
                          for item in flow_value(value['iterator']['expr'], scope)]
            elif value['type'] == 'rawscript':
                spec = importlib.util.spec_from_file_location(
                    'dna_flow_inline', directory / value['content'].removeprefix('!inline '))
                script = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(script)
                result = script.main(**arguments)
            else:
                raise AssertionError(f"Unsupported module type: {value['type']}")
            results[module['id']] = result
        return result

    return run_modules(flow['value']['modules'], flow_input)


def response(payload, status=200):
    result = requests.Response()
    result.status_code = status
    result._content = json.dumps(payload).encode()
    return result


class SpendPauseTest(unittest.TestCase):
    def setUp(self):
        disconnect()
        connect('dna_pause_test', mongo_client_class=mongomock.MongoClient,
                uuidRepresentation='standard')
        self.addCleanup(disconnect)
        self.redis = fakeredis.FakeRedis(decode_responses=True)
        self.start_patch('f.db.redis.RedisCluster', return_value=self.redis)
        self.start_patch('f.db.mongodb.connect')
        self.start_patch('f.db.mongodb.disconnect')
        self.secret = self.start_patch('wmill.get_variable', return_value='test-secret')
        self.post = self.start_patch('requests.post')
        self.dna = json.loads((Path(__file__).parent / 'fixtures/dna.json').read_text())

    def start_patch(self, target, **kwargs):
        patcher = patch(target, **kwargs)
        result = patcher.start()
        self.addCleanup(patcher.stop)
        return result

    def title(self, tmdb_id, cls=DnaMovie):
        return cls(tmdb_id=tmdb_id, original_title='Test title', release_year=1999,
                   popularity=2.0, is_selected=True,
                   selected_at=datetime(2026, 9, 14, 10)).save()

    def ids(self, *entries):
        return [{'id': str(entry.id), 'tmdb_id': entry.tmdb_id,
                 'type': 'movie' if isinstance(entry, DnaMovie) else 'tv'}
                for entry in entries]

    def success(self):
        return response({'choices': [{'message': {'content': json.dumps(self.dna)}}]})

    @freeze_time('2026-09-14 12:00:00')
    def test_payment_required_returns_partial_results_and_releases_only_unprocessed_titles(self):
        done, stopped, pending = self.title(1), self.title(2), self.title(3, DnaTv)
        self.post.side_effect = [self.success(), response({'error': {'code': 402}}, 402)]

        result = fetch.main(self.ids(done, stopped, pending))

        self.assertEqual(result, [{'id': str(done.id), 'dna': self.dna}])
        self.assertEqual(self.post.call_count, 2)
        self.assertEqual(self.redis.ttl(PAUSE_KEY), 43200)
        for entry in [stopped, pending]:
            entry.reload()
            self.assertFalse(entry.is_selected)
            self.assertIsNone(entry.selected_at)
            self.assertIsNone(entry.failed_at)
        done.reload()
        self.assertTrue(done.is_selected)  # Fingerprint persistence still needs to finish.
        self.assertEqual(done.selected_at, datetime(2026, 9, 14, 10))
        self.assertEqual(done.dna, self.dna)

    def test_paused_selection_returns_empty_batch_without_touching_mongodb(self):
        self.redis.set(PAUSE_KEY, 'daily', ex=60)
        with patch('f.db.mongodb.connect') as mongodb:
            result = next_batch.main()
        mongodb.assert_not_called()
        self.assertEqual(result, {'ids': {'movie_ids': [], 'tv_ids': []},
                                  'tmdb_ids': {'movie_ids': [], 'tv_ids': []}})
        self.post.assert_not_called()

    @freeze_time('2026-09-14 12:00:00')
    def test_monthly_budget_rejection_pauses_until_next_month_including_embedded_errors(self):
        for status in [200, 403]:
            with self.subTest(status=status):
                self.redis.flushall()
                title = self.title(status)
                self.post.return_value = response({'error': {
                    'code': 403,
                    'message': 'API key budget limit exceeded (monthly limit). Contact your org admin.',
                }}, status)
                self.assertEqual(fetch.main(self.ids(title)), [])
                self.assertEqual(self.redis.ttl(PAUSE_KEY), 1425600)
                title.reload()
                self.assertFalse(title.is_selected)
                self.assertIsNone(title.selected_at)

    @freeze_time('2026-09-14 12:00:00')
    def test_in_flight_daily_rejection_cannot_shorten_another_workers_monthly_pause(self):
        title = self.title(1)

        def other_worker_pauses(*args, **kwargs):
            self.redis.set(PAUSE_KEY, 'monthly', ex=1425600)
            return response({'error': {'code': 402}}, 402)

        self.post.side_effect = other_worker_pauses
        self.assertEqual(fetch.main(self.ids(title)), [])
        self.assertEqual(self.redis.ttl(PAUSE_KEY), 1425600)

    def test_already_paused_fetch_releases_its_batch_without_requesting_an_api_key(self):
        title = self.title(1)
        self.redis.set(PAUSE_KEY, 'monthly', ex=600)
        self.assertEqual(fetch.main(self.ids(title)), [])
        self.post.assert_not_called()
        self.assertNotIn('u/Alp/OPENROUTER_API_KEY', [c.args[0] for c in self.secret.call_args_list])
        title.reload()
        self.assertFalse(title.is_selected)
        self.assertIsNone(title.selected_at)

    def test_another_workers_pause_stops_next_title_retry_repair_and_fallback_requests(self):
        for kind in ['success', 'retry', 'repair', 'fallback']:
            with self.subTest(kind=kind), patch('time.sleep'):
                self.redis.flushall()
                self.post.reset_mock()
                first, pending = self.title(1), self.title(2, DnaTv)

                def other_worker_pauses(*args, **kwargs):
                    self.redis.set(PAUSE_KEY, 'daily', ex=600)
                    return {'success': self.success(), 'retry': response({}, 429),
                            'repair': response({'choices': [{'message': {'content': '{}'}}]}),
                            'fallback': response({}, 400)}[kind]

                self.post.side_effect = other_worker_pauses
                expected = [{'id': str(first.id), 'dna': self.dna}] if kind == 'success' else []
                self.assertEqual(fetch.main(self.ids(first, pending)), expected)
                self.assertEqual(self.post.call_count, 1)
                pending.reload()
                self.assertFalse(pending.is_selected)
                self.assertIsNone(pending.selected_at)
                first.reload()
                self.assertIsNone(first.failed_at)

    def test_empty_fingerprints_returns_zero_without_api_key_or_database_calls(self):
        with patch('f.db.mongodb.connect') as mongodb:
            self.assertEqual(vectors.main({'movie_ids': [], 'tv_ids': []}, []),
                             {'fingerprints_count': 0})
        mongodb.assert_not_called()
        self.secret.assert_not_called()

    def test_generate_dna_flow_passes_paused_batch_through_without_inference_or_mongodb(self):
        self.redis.set(PAUSE_KEY, 'daily', ex=60)
        with patch('f.db.mongodb.connect') as mongodb:
            self.assertEqual(run_flow('f/dna/generate_dna', {}), {'fingerprints_count': 0})
        self.post.assert_not_called()
        mongodb.assert_not_called()

    @freeze_time('2026-09-14 12:00:00')
    def test_generate_dna_flow_persists_completed_fingerprint_after_budget_rejection_without_flow_retry(self):
        done, stopped, pending = self.title(1), self.title(2), self.title(3, DnaTv)
        for entry in [done, stopped, pending]:
            entry.update(set__selected_at=None, set__is_selected=False)
        done.update(set__popularity=3.0)
        self.post.side_effect = [self.success(), response({'error': {'code': 402}}, 402)]
        self.assertEqual(run_flow('f/dna/generate_dna', {}), {'fingerprints_count': 1})
        self.assertEqual(self.post.call_count, 2)
        self.assertNotIn('u/Alp/GEMINI_API_KEY', [c.args[0] for c in self.secret.call_args_list])
        done.reload()
        self.assertEqual(done.dna['essence_text'], self.dna['essence_text'])
        self.assertEqual(len(done.vector_fingerprint), 74)
        self.assertFalse(done.is_selected)
        for entry in [stopped, pending]:
            entry.reload()
            self.assertIsNone(entry.selected_at)
            self.assertFalse(entry.is_selected)

    def test_daily_pause_expires_at_midnight_and_selection_resumes(self):
        with freeze_time('2026-09-14 23:59:59.500') as clock:
            title = self.title(1)
            self.post.return_value = response({'error': {'code': 402}}, 200)
            self.assertEqual(fetch.main(self.ids(title)), [])
            self.assertEqual(self.redis.pttl(PAUSE_KEY), 500)
            self.assertEqual(next_batch.main()['ids']['movie_ids'], [])
            # This fakeredis version retains keys at exactly zero TTL.
            clock.tick(0.501)
            self.assertEqual(next_batch.main()['ids']['movie_ids'], [str(title.id)])

    def test_monthly_pause_handles_year_rollover_and_leap_february(self):
        for now, reset, ttl in [('2026-12-15 00:00:00', '2027-01-01', 1468800),
                                 ('2028-02-01 00:00:00', '2028-03-01', 2505600)]:
            with self.subTest(now=now), freeze_time(now) as clock:
                self.redis.flushall()
                DnaMovie.drop_collection()
                title = self.title(1)
                self.post.return_value = response({'error': {
                    'code': 403, 'message': 'Budget limit exceeded (monthly limit).',
                }}, 403)
                self.assertEqual(fetch.main(self.ids(title)), [])
                self.assertEqual(self.redis.ttl(PAUSE_KEY), ttl)
                clock.move_to(reset)
                clock.tick(0.001)
                self.assertEqual(next_batch.main()['ids']['movie_ids'], [str(title.id)])

    def test_unrecognized_forbidden_responses_stay_visible_and_do_not_start_a_pause(self):
        for error in [{'message': 'Model not allowed by monthly budget guardrail'},
                      {'message': 'Request blocked: prompt injection patterns detected'},
                      {'message': 'Budget limit exceeded (weekly limit)'},
                      {'message': 'Forbidden'}, {'message': None}, None, []]:
            with self.subTest(error=error):
                title = self.title(1)
                self.post.reset_mock()
                self.post.return_value = response({'error': error}, 403)
                with self.assertRaises(requests.HTTPError):
                    fetch.main(self.ids(title))
                self.assertEqual(self.post.call_count, 1)
                self.assertFalse(self.redis.exists(PAUSE_KEY))
                title.reload()
                self.assertIsNone(title.failed_at)

    def test_releasing_unprocessed_title_preserves_previous_dna_and_failure_metadata(self):
        title = self.title(1)
        title.update(set__dna=self.dna, set__error_message='Previous failed generation',
                     set__failed_at=datetime(2026, 9, 1))
        self.post.return_value = response({}, 402)
        self.assertEqual(fetch.main(self.ids(title)), [])
        title.reload()
        self.assertEqual(title.dna, self.dna)
        self.assertEqual(title.error_message, 'Previous failed generation')
        self.assertEqual(title.failed_at, datetime(2026, 9, 1))
        self.assertIsNone(title.selected_at)
