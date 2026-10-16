"""Run with: python3 -m unittest test_sitemap_crate (in this directory).

The live-driver case needs the crate package (uv run --with crate python -m unittest test_sitemap_crate) and is
skipped without it."""
import base64
import http.server
import json
import threading
import unittest

from sitemap_crate import connect_args


class ConnectArgsTest(unittest.TestCase):
    def test_without_a_user_no_credentials_are_passed(self):
        servers, kwargs = connect_args({"CRATE_HOSTS": "10.0.0.11,10.0.0.12"})
        self.assertEqual(servers, "http://10.0.0.11:4200")
        self.assertEqual(kwargs, {})

    def test_the_user_and_password_are_passed_apart_from_the_url(self):
        servers, kwargs = connect_args(
            {"CRATE_HOSTS": "10.0.0.11", "CRATE_PORT": "4201", "CRATE_USER": "goodwatch_readonly", "CRATE_PASS": "p@ss:w/rd #1"}
        )
        self.assertEqual(servers, "http://10.0.0.11:4201")
        self.assertEqual(kwargs, {"username": "goodwatch_readonly", "password": "p@ss:w/rd #1"})

    def test_missing_hosts_are_refused(self):
        for environ in ({}, {"CRATE_HOSTS": ""}):
            with self.assertRaises(ValueError):
                connect_args(environ)


class Crate(http.server.BaseHTTPRequestHandler):
    seen = []

    def reply(self, payload):
        body = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.reply({"name": "n", "cluster_name": "c", "version": {"number": "5.10.16"}})

    def do_POST(self):
        self.rfile.read(int(self.headers["Content-Length"]))
        Crate.seen.append(self.headers.get("Authorization"))
        self.reply({"cols": ["n"], "rows": [[1]], "rowcount": 1, "duration": 1})

    def log_message(self, *args):
        pass


class LiveDriverTest(unittest.TestCase):
    def test_the_driver_sends_a_password_with_url_characters_unchanged(self):
        try:
            from crate import client
        except ImportError:
            self.skipTest("crate is not installed")
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Crate)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        environ = {"CRATE_HOSTS": "127.0.0.1", "CRATE_PORT": str(server.server_address[1])}

        servers, kwargs = connect_args(environ | {"CRATE_USER": "goodwatch_readonly", "CRATE_PASS": "p@ss:w/rd #1"})
        client.connect(servers, **kwargs).cursor().execute("SELECT 1")
        servers, kwargs = connect_args(environ)
        client.connect(servers, **kwargs).cursor().execute("SELECT 1")

        expected = "Basic " + base64.b64encode(b"goodwatch_readonly:p@ss:w/rd #1").decode()
        self.assertEqual(Crate.seen, [expected, None])


if __name__ == "__main__":
    unittest.main()
