"""Both operator verifiers check headers on a loopback fake, never production."""
import base64
import contextlib
import http.server
import json
import os
import pathlib
import subprocess
import sys
import threading
import unittest

HERE = pathlib.Path(__file__).resolve().parent

class VerifierTests(unittest.TestCase):
    def test_python_and_node_enforce_and_do_not_print_password(self):
        password = 'fixture:/#?%ä'
        wanted = 'Basic ' + base64.b64encode(('fixture:' + password).encode()).decode()
        seen = []
        class Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                seen.append(self.headers.get('Authorization'))
                self.rfile.read(int(self.headers['Content-Length']))
                ok = seen[-1] == wanted
                self.send_response(200 if ok else 401)
                self.end_headers()
                self.wfile.write(json.dumps({'rows': [['fixture']]}).encode() if ok else b'refused')
            def log_message(self, *args): pass
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        env = {k:v for k,v in os.environ.items() if not k.startswith('CRATE_')}
        env.update(CRATE_HOSTS=f'127.0.0.1:{server.server_port}', CRATE_USER='fixture', CRATE_PASS=password)
        for cmd in ([sys.executable, str(HERE/'verify_crate_endpoints.py')],
                    ['node', str(HERE/'verify_crate_endpoints.mjs')]):
            with self.subTest(cmd=cmd[0]):
                seen.clear()
                r = subprocess.run(cmd,env=env,text=True,capture_output=True,timeout=20)
                self.assertEqual(r.returncode,0,r.stdout+r.stderr)
                self.assertEqual(len(seen),4)
                self.assertEqual(seen[-1],wanted)
                self.assertNotIn(password,r.stdout+r.stderr)
                self.assertNotIn(wanted,r.stdout+r.stderr)
                bad = subprocess.run(cmd,env=env|{'CRATE_PASS':'wrong-fixture'},text=True,capture_output=True,timeout=20)
                self.assertEqual(bad.returncode,1)
