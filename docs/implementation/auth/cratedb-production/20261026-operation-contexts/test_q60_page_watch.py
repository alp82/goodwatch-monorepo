"""Q60 rolling watcher policy; synthetic probes only, no network or production access."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('q60_watch', Path(__file__).with_name('q40-page-watch.py'))
watcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watcher)


class Q60Tests(unittest.TestCase):
    def test_third_failure_of_same_endpoint_aborts_despite_other_healthy_probes(self):
        policy = watcher.Q60Policy()
        for n in range(3):
            failures, _, alarm = policy.observe('/discover', 503, .2, 0, at=n * 10)
            self.assertEqual((failures, alarm), (n + 1, n == 2))
            policy.observe('/movie', 200, .2, 0, at=n * 10 + 1)

    def test_expected_response_resets_only_its_failure_streak(self):
        policy = watcher.Q60Policy()
        policy.observe('/discover', 503, .2, 0, at=0)
        self.assertEqual(policy.observe('/discover', 200, .2, 0, at=10), (0, 0, False))
        self.assertEqual(policy.observe('/discover', 503, .2, 0, at=20), (1, 0, False))

    def test_expected_mcp_401_is_healthy_and_unexpected_200_counts(self):
        policy = watcher.Q60Policy()
        self.assertEqual(policy.observe('/mcp', 401, .2, 0, expected=401, at=0), (0, 0, False))
        for n in range(3):
            self.assertEqual(policy.observe('/mcp', 200, .2, 0, expected=401, at=n + 1)[2], n == 2)

    def test_three_transport_failures_abort(self):
        policy = watcher.Q60Policy()
        for n in range(3):
            self.assertEqual(policy.observe('/discover', 0, 1, 7, at=n * 10)[2], n == 2)

    def test_slow_responses_across_endpoints_count_in_one_window(self):
        policy = watcher.Q60Policy()
        self.assertEqual(policy.observe('/movie', 200, 3.1, 0, at=0), (0, 1, False))
        self.assertEqual(policy.observe('/show', 200, 3.2, 0, at=20), (0, 2, False))
        self.assertEqual(policy.observe('/discover', 200, 3.3, 0, at=59), (0, 3, True))

    def test_fast_response_does_not_reset_slow_history(self):
        policy = watcher.Q60Policy()
        policy.observe('/movie', 200, 3.1, 0, at=0)
        self.assertEqual(policy.observe('/movie', 200, .1, 0, at=10), (0, 1, False))

    def test_slow_history_expires_at_sixty_seconds(self):
        policy = watcher.Q60Policy()
        policy.observe('/movie', 200, 3.1, 0, at=0)
        policy.observe('/show', 200, 3.1, 0, at=20)
        self.assertEqual(policy.observe('/discover', 200, 3.1, 0, at=60), (0, 2, False))

    def test_exactly_three_seconds_is_not_slow(self):
        self.assertEqual(watcher.Q60Policy().observe('/movie', 200, 3, 0, at=0), (0, 0, False))

    def test_q60_watch_logs_single_slow_events_and_marks_third(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)
            (p / 'phase').write_text('baseline')
            args = types.SimpleNamespace(phase_file=str(p / 'phase'), heartbeat=str(p / 'heartbeat'),
                                         stop_file=str(p / 'stop'), abort_file=str(p / 'abort'), policy='q60')
            calls = []
            def probe(path, expected):
                calls.append(path)
                if len(calls) == 3:
                    (p / 'stop').touch()
                return path, expected, 200, 3.1, 0, 'synthetic'
            output = io.StringIO()
            with patch.object(watcher, 'ENDPOINTS', (('/discover', 200),)), patch.object(watcher, 'probe', side_effect=probe), patch.object(watcher.time, 'sleep'), contextlib.redirect_stdout(output):
                watcher.watch(args)
            rows = [json.loads(line) for line in output.getvalue().splitlines()]
            self.assertEqual([r['alarm'] for r in rows], [False, False, True])
            self.assertEqual([r['slow_responses_60s'] for r in rows], [1, 2, 3])
            self.assertEqual(json.loads((p / 'abort').read_text())['policy'], 'q60')
            watcher.marker(p / 'abort', {'later': True})
            self.assertEqual(json.loads((p / 'abort').read_text())['slow_responses_60s'], 3)

    def test_cli_selects_opt_in_q60_policy(self):
        with patch.object(watcher, 'watch') as run, patch.object(watcher, 'marker'), patch('sys.argv', ['watcher', '--phase-file', 'phase', '--abort-file', 'abort', '--heartbeat', 'heartbeat', '--policy', 'q60']):
            watcher.main()
        self.assertEqual(run.call_args.args[0].policy, 'q60')

    def test_cli_preserves_historical_default(self):
        with patch.object(watcher, 'watch') as run, patch('sys.argv', ['watcher', '--phase-file', 'phase', '--abort-file', 'abort', '--heartbeat', 'heartbeat']):
            watcher.main()
        self.assertEqual(run.call_args.args[0].policy, 'q43')
