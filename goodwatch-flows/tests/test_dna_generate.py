"""Generation contract tests; HTTP, MongoDB, secrets and time are external seams."""
import io
import json
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import mongomock
import fakeredis
import requests
from mongoengine import connect, disconnect

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.dna.generate import fetch
from f.dna.models import DnaMovie, DnaTv
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails

PRIMARY = 'qwen/qwen3.8-flash'
FALLBACK = 'qwen/qwen3.7-flash'


def response(content, status=200, headers=None):
    result = requests.Response()
    result.status_code = status
    result.headers.update(headers or {})
    result._content = json.dumps(content).encode()
    return result


class OpenRouterGenerationTest(unittest.TestCase):
    def setUp(self):
        disconnect()
        connect('dna_test', mongo_client_class=mongomock.MongoClient, uuidRepresentation='standard')
        self.addCleanup(disconnect)
        self.dna = json.loads((Path(__file__).parent / 'fixtures/dna.json').read_text())
        self.post = self.start_patch('requests.post')
        self.start_patch('f.db.redis.RedisCluster', return_value=fakeredis.FakeRedis())
        self.start_patch('wmill.get_variable', side_effect=lambda name:
            '6379' if name == 'u/Alp/REDIS_PORT' else 'test-key')
        self.output = self.start_patch('sys.stdout', new_callable=io.StringIO)

    def start_patch(self, target, **kwargs):
        patcher = patch(target, **kwargs)
        result = patcher.start()
        self.addCleanup(patcher.stop)
        return result

    def title(self, cls=DnaMovie, **kwargs):
        return cls(tmdb_id=kwargs.pop('tmdb_id', 603), original_title='The Matrix',
                   release_year=1999, overview='A programmer discovers a simulated world.',
                   popularity=kwargs.pop('popularity', 1.0), **kwargs).save()

    def success(self):
        return response({'choices': [{'message': {'content': json.dumps(self.dna)}}],
                         'usage': {'cost': 0.001}})

    def test_premium_title_uses_pinned_primary_and_saves_valid_dna_and_provenance(self):
        movie = self.title()
        self.post.return_value = self.success()
        result = fetch.generate_dna([movie])
        self.assertEqual(result, [{'id': str(movie.id), 'dna': self.dna}])
        self.assertEqual(movie.dna, self.dna)
        self.assertEqual(movie.llm_model_name, 'openrouter:qwen/qwen3.8-flash@alibaba')
        payload = self.post.call_args.kwargs['json']
        self.assertEqual(payload['model'], PRIMARY)
        self.assertEqual(payload['provider'], {'only': ['alibaba'], 'allow_fallbacks': False, 'require_parameters': True})
        self.assertEqual(payload['reasoning'], {'enabled': False})
        self.assertEqual(payload['max_tokens'], 8192)
        self.assertEqual(payload['response_format']['type'], 'json_schema')
        self.assertTrue(payload['response_format']['json_schema']['strict'])
        self.assertIn('0.001', self.output.getvalue())

    def test_economy_title_uses_json_object_fallback(self):
        movie = self.title(popularity=0.99)
        self.post.return_value = self.success()
        fetch.generate_dna([movie])
        payload = self.post.call_args.kwargs['json']
        self.assertEqual(payload['model'], FALLBACK)
        self.assertEqual(payload['response_format'], {'type': 'json_object'})
        self.assertEqual(movie.llm_model_name, 'openrouter:qwen/qwen3.7-flash@alibaba')

    def test_recent_release_routes_to_premium_using_exact_movie_and_tv_dates(self):
        with patch.object(fetch, 'datetime', wraps=datetime) as clock:
            clock.now.return_value = datetime(2026, 9, 14)
            for cls, details_cls, field in [(DnaMovie, TmdbMovieDetails, 'release_date'),
                                             (DnaTv, TmdbTvDetails, 'first_air_date')]:
                for index, (released, expected) in enumerate([
                    ('2025-09-14', PRIMARY), ('2025-09-13', FALLBACK),
                    ('2026-09-14', PRIMARY), ('2026-09-15', FALLBACK),
                ]):
                    with self.subTest(cls=cls, released=released):
                        title = self.title(cls, tmdb_id=index, popularity=0.5)
                        details_cls(tmdb_id=index, **{field: released}).save()
                        self.post.return_value = self.success()
                        fetch.generate_dna([title])
                        self.assertEqual(self.post.call_args.kwargs['json']['model'], expected)

    def test_invalid_dna_gets_one_full_response_repair(self):
        movie = self.title()
        self.post.side_effect = [response({'choices': [{'message': {'content': '{"unknown": true}'}}], 'usage': {'cost': 0.002}}), self.success()]
        self.assertEqual(fetch.generate_dna([movie]), [{'id': str(movie.id), 'dna': self.dna}])
        payloads = [call.kwargs['json'] for call in self.post.call_args_list]
        self.assertEqual([p['model'] for p in payloads], [PRIMARY, PRIMARY])
        self.assertIn('{"unknown": true}', json.dumps(payloads[1]['messages']).replace('\\"', '"'))
        self.assertIn('0.002', self.output.getvalue())

    def test_unknown_highlight_keys_are_repaired_before_persistence(self):
        for popularity in [1.0, 0.5]:
            for invalid_key in ['action_core_scores_placeholder_check', 'erotica']:
                with self.subTest(popularity=popularity, invalid_key=invalid_key):
                    self.post.reset_mock()
                    movie = self.title(popularity=popularity, dna=self.dna)
                    invalid = json.loads(json.dumps(self.dna))
                    invalid['fingerprint']['highlight_keys'][0] = invalid_key
                    bad_response = response({'choices': [{'message': {'content': json.dumps(invalid)}}]})

                    def respond(*args, **kwargs):
                        self.assertEqual(movie.reload().dna, self.dna)
                        if self.post.call_count == 1:
                            return bad_response
                        self.assertIn(invalid_key, kwargs['json']['messages'][-1]['content'])
                        return self.success()

                    self.post.side_effect = respond
                    self.assertEqual(fetch.generate_dna([movie]), [{'id': str(movie.id), 'dna': self.dna}])
                    expected_model = PRIMARY if popularity == 1.0 else FALLBACK
                    self.assertEqual([c.kwargs['json']['model'] for c in self.post.call_args_list],
                                     [expected_model, expected_model])
                    self.assertEqual(movie.reload().dna, self.dna)

    def test_unknown_highlights_use_bounded_repairs_and_preserve_prior_dna_on_failure(self):
        for popularity, models in [(1.0, [PRIMARY, PRIMARY, FALLBACK, FALLBACK]),
                                   (0.5, [FALLBACK, FALLBACK, PRIMARY, PRIMARY])]:
            for recovers in [True, False]:
                with self.subTest(popularity=popularity, recovers=recovers):
                    self.post.reset_mock()
                    movie = self.title(popularity=popularity, dna=self.dna, is_selected=True)
                    invalid = json.loads(json.dumps(self.dna))
                    invalid['fingerprint']['highlight_keys'][0] = 'erotica'
                    bad_response = response({'choices': [{'message': {'content': json.dumps(invalid)}}]})
                    self.post.side_effect = ([bad_response, bad_response, self.success()]
                                             if recovers else [bad_response] * 4)
                    result = fetch.generate_dna([movie])
                    movie.reload()
                    self.assertEqual(movie.dna, self.dna)
                    if recovers:
                        self.assertEqual(result, [{'id': str(movie.id), 'dna': self.dna}])
                        self.assertEqual(movie.llm_model_name, f'openrouter:{models[2]}@alibaba')
                    else:
                        self.assertEqual(result, [])
                        self.assertIsNotNone(movie.failed_at)
                        self.assertIn('erotica', movie.error_message)
                        self.assertFalse(movie.is_selected)
                    self.assertEqual([c.kwargs['json']['model'] for c in self.post.call_args_list],
                                     models[:3] if recovers else models)

    def test_exhausted_repairs_switch_models_in_both_directions(self):
        for popularity, expected in [(1.0, [PRIMARY, PRIMARY, FALLBACK]),
                                      (0.5, [FALLBACK, FALLBACK, PRIMARY])]:
            with self.subTest(popularity=popularity):
                self.post.reset_mock()
                movie = self.title(popularity=popularity)
                invalid = response({'choices': [{'message': {'content': '{}'}}]})
                self.post.side_effect = [invalid, invalid, self.success()]
                self.assertEqual(fetch.generate_dna([movie]), [{'id': str(movie.id), 'dna': self.dna}])
                self.assertEqual([c.kwargs['json']['model'] for c in self.post.call_args_list], expected)
                self.assertEqual(movie.llm_model_name, f'openrouter:{expected[-1]}@alibaba')

    def test_transport_failures_retry_twice_then_fall_back_honoring_retry_after(self):
        for status in [429, 502, 503]:
            with self.subTest(status=status), patch('time.sleep') as sleep:
                self.post.reset_mock()
                movie = self.title()
                error = response({'error': {'code': status}}, status, {'Retry-After': '7'})
                self.post.side_effect = [error, error, error, self.success()]
                self.assertEqual(fetch.generate_dna([movie]), [{'id': str(movie.id), 'dna': self.dna}])
                self.assertEqual([c.kwargs['json']['model'] for c in self.post.call_args_list], [PRIMARY]*3+[FALLBACK])
                self.assertEqual([c.args[0] for c in sleep.call_args_list], [7, 7])

    def test_six_request_cap_marks_failure_and_continues_next_title(self):
        failed = self.title(is_selected=True)
        next_title = self.title(tmdb_id=550)
        invalid = response({'choices': [{'message': {'content': '{}'}}]})
        unavailable = response({}, 503)
        self.post.side_effect = [unavailable, unavailable, invalid, invalid,
                                 unavailable, invalid, self.success()]
        with patch('time.sleep'):
            self.assertEqual(fetch.generate_dna([failed, next_title]), [{'id': str(next_title.id), 'dna': self.dna}])
        self.assertEqual(self.post.call_count, 7)
        self.assertIsNotNone(failed.failed_at)
        self.assertTrue(failed.error_message)
        self.assertFalse(failed.is_selected)
        self.assertEqual(failed.dna, {})
        self.assertEqual(next_title.dna, self.dna)

    def test_out_of_range_or_non_integer_scores_are_repaired(self):
        for score in [11, -1, 3.5, '5', True]:
            with self.subTest(score=score):
                movie = self.title()
                bad = json.loads(json.dumps(self.dna))
                bad['fingerprint']['scores']['adrenaline'] = score
                self.post.side_effect = [response({'choices': [{'message': {'content': json.dumps(bad)}}]}), self.success()]
                self.assertEqual(fetch.generate_dna([movie]), [{'id': str(movie.id), 'dna': self.dna}])

    def test_malformed_provider_responses_are_bounded_and_do_not_abort_batch(self):
        for payload in [{}, {'choices': []}, {'choices': [{'message': {'content': None}}]},
                        {'choices': [{'message': {'content': 'not json'}}]},
                        {'error': {'code': 502, 'message': 'provider failed'}}]:
            with self.subTest(payload=payload), patch('time.sleep'):
                self.post.side_effect = None
                self.post.return_value = response(payload)
                movie = self.title()
                self.assertEqual(fetch.generate_dna([movie]), [])
                self.assertIsNotNone(movie.failed_at)
                self.assertTrue(movie.error_message)

    def test_authorization_errors_propagate_without_title_failure_or_fallback(self):
        for status in [401, 403]:
            for embedded in [False, True]:
                with self.subTest(status=status, embedded=embedded):
                    self.post.reset_mock()
                    movie = self.title()
                    self.post.return_value = response({'error': {'code': status}}, 200 if embedded else status)
                    with self.assertRaises(requests.HTTPError) as caught:
                        fetch.generate_dna([movie])
                    self.assertEqual(caught.exception.response.status_code, status)
                    self.assertIsNone(movie.failed_at)
                    self.assertEqual(self.post.call_count, 1)

    def test_request_prompt_and_schema_describe_a_single_object(self):
        self.post.return_value = self.success()
        fetch.generate_dna([self.title()])
        payload = self.post.call_args.kwargs['json']
        schema = payload['response_format']['json_schema']['schema']
        self.assertEqual(schema['type'], 'object')
        for node in [schema, *schema['$defs'].values()]:
            if node.get('type') == 'object':
                self.assertFalse(node['additionalProperties'])
                self.assertEqual(set(node['required']), set(node['properties']))
        prompt = payload['messages'][0]['content']
        example = prompt.split('```json\n', 1)[1].split('```', 1)[0]
        self.assertIsInstance(json.loads(example), dict)

    def test_successes_carry_identity_when_an_earlier_title_fails(self):
        failed = self.title()
        success = self.title(tmdb_id=550)
        invalid = response({'choices': [{'message': {'content': '{}'}}]})
        self.post.side_effect = [invalid] * 4 + [self.success()]
        self.assertEqual(fetch.generate_dna([failed, success]),
                         [{'id': str(success.id), 'dna': self.dna}])

    def test_logs_usage_cost_even_when_http_response_is_an_error(self):
        self.post.side_effect = [response({'usage': {'cost': 0.0042}}, 502), self.success()]
        with patch('time.sleep'):
            fetch.generate_dna([self.title()])
        self.assertIn('usage.cost=0.0042', self.output.getvalue())
