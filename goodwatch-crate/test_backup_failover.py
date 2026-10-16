"""Snapshot writes must not be repeated after a lost acknowledgement."""
import contextlib
import io
import socket
import unittest
from unittest import mock
import backup
from test_backup import SqlServer


class FailoverTests(unittest.TestCase):
    def test_real_refused_connection_fails_over_with_auth(self):
        server = SqlServer()
        self.addCleanup(server.close)
        sock = socket.socket()
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
        sock.close()
        with mock.patch.object(backup, 'SQL_URLS', [f'http://127.0.0.1:{port}/_sql', server.url]), \
             mock.patch.object(backup, 'AUTH', ('fixture', 'fixture')), \
             contextlib.redirect_stdout(io.StringIO()):
            self.assertIsNotNone(backup.run_sql('CREATE SNAPSHOT "r"."s" ALL', timeout=2))
        self.assertEqual(len(server.authorization), 1)
        self.assertIsNotNone(server.authorization[0])

    def test_ambiguous_writes_are_never_repeated(self):
        for verb in ('CREATE', 'DROP'):
            for error in (backup.requests.ReadTimeout('secret fixture'),
                          backup.requests.ConnectionError('connection reset')):
                with mock.patch.object(backup.requests, 'post', side_effect=error) as post, \
                     contextlib.redirect_stdout(io.StringIO()) as logs:
                    self.assertIsNone(backup.run_sql(f'{verb} SNAPSHOT "r"."s"'))
                self.assertEqual(post.call_count, 1)
                self.assertNotIn('secret fixture', logs.getvalue())

    def test_read_can_fail_over_after_reset(self):
        response = mock.Mock()
        response.json.return_value = {'rows': []}
        with mock.patch.object(backup.requests, 'post', side_effect=[
            backup.requests.ConnectionError('reset'), response,
        ]) as post, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(backup.run_sql('SELECT name FROM sys.snapshots'), {'rows': []})
        self.assertEqual(post.call_count, 2)

    def test_privilege_denial_is_not_retried(self):
        response = mock.Mock(status_code=401, headers={'Content-Type': 'application/json'})
        with mock.patch.object(backup.requests, 'post', side_effect=backup.requests.HTTPError(response=response)) as post, \
             contextlib.redirect_stdout(io.StringIO()):
            self.assertIsNone(backup.run_sql('CREATE SNAPSHOT "r"."s" ALL'))
        self.assertEqual(post.call_count, 1)

    def test_hba_refusal_can_retry_an_unsent_write(self):
        denied = mock.Mock(status_code=401, headers={'Content-Type': 'text/plain'})
        ok = mock.Mock()
        ok.json.return_value = {'rowcount': 1}
        with mock.patch.object(backup.requests, 'post', side_effect=[
            backup.requests.HTTPError(response=denied), ok,
        ]) as post, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(backup.run_sql('CREATE SNAPSHOT "r"."s" ALL'), {'rowcount': 1})
        self.assertEqual(post.call_count, 2)
