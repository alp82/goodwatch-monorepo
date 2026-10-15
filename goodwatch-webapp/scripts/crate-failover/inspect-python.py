"""Read-only client assessment: local HTTP fixtures, no real database or Windmill.

Run in a disposable venv with crate==2.2.1 and urllib3==2.7.0, matching the
Windmill lockfile. The write scenario changes an in-memory fixture counter only.
"""

import json
import socket
import sys
from contextlib import ExitStack
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib.metadata import version
from pathlib import Path
from threading import Thread

from crate import client
from crate.client.exceptions import ProgrammingError
from urllib3 import Timeout


def scenario(write: bool, node_loss: bool = False) -> dict:
    requests = [0, 0, 0]
    effects = 0
    servers = []

    def handler(index):
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def respond(self, payload, status=200):
                body = json.dumps(payload).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self):
                self.respond({"name": f"node{index}", "version": {"number": "5.10.16"}})

            def do_POST(self):
                nonlocal effects
                data = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                assert data["stmt"].startswith("UPDATE" if write else "SELECT")
                requests[index] += 1
                if write:
                    effects += 1
                if index == 0:
                    if node_loss:
                        self.respond({"error": {"code": 5000, "message": "NodeNotConnectedException[Node not connected]"}}, 500)
                        return
                    self.connection.shutdown(socket.SHUT_RDWR)
                    self.connection.close()
                    return
                self.respond({"cols": ["n"], "col_types": [9], "rows": [[1]], "rowcount": 1, "duration": 1})

        return Handler

    with ExitStack() as cleanup:
        for i in range(3):
            server = ThreadingHTTPServer(("127.0.0.1", 0), handler(i))
            cleanup.callback(server.server_close)
            cleanup.callback(server.shutdown)
            Thread(target=server.serve_forever, daemon=True).start()
            servers.append(f"http://127.0.0.1:{server.server_port}")
        connection = client.connect(servers, timeout=Timeout(connect=1, read=1))
        cleanup.callback(connection.close)
        cursor = connection.cursor()
        if node_loss:
            try:
                cursor.execute("SELECT 1 AS n")
            except ProgrammingError as error:
                assert requests == [1, 0, 0]
                return {"fixtureOnly": True, "error": str(error), "requestsPerHost": requests,
                        "activeHosts": len(connection.client.active_servers), "retried": False}
            raise AssertionError("Node-loss SQL error should propagate on the unchanged Python client")
        cursor.execute("UPDATE fixture SET n = n + 1" if write else "SELECT 1 AS n")
        result = cursor.fetchall()
        active = connection.client.active_servers
        if not write:
            for _ in range(4):
                cursor.execute("SELECT 1 AS n")
        assert result == [[1]]
        assert servers[0] not in active
        assert requests[0] == 1
        if write:
            assert effects == 2, "Native driver replayed a POST after an applied response was lost"
        return {"fixtureOnly": True, "write": write, "requestsPerHost": requests,
                "activeHosts": len(active), "droppedHostExcluded": servers[0] not in active,
                "appliedEffects": effects, "result": result}


report = {"packages": {name: version(name) for name in ["crate", "urllib3", "orjson", "verlib2"]},
          "readFailover": scenario(False), "lostWriteResponse": scenario(True), "nodeLossSql": scenario(False, node_loss=True)}
Path(sys.argv[1]).write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
