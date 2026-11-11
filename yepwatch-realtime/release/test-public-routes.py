"""Exercise the actual public Caddy allowlist against an isolated loopback API."""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import socket
import subprocess
import tempfile
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4

release = Path(__file__).resolve().parent
image = re.search(r"ARG CADDY_IMAGE=(\S+)", (release / "Dockerfile.repository").read_text())[1]


class API(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps({"method": self.command, "path": self.path}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    do_POST = do_GET

    def log_message(self, *_):
        pass


api = ThreadingHTTPServer(("127.0.0.1", 0), API)
threading.Thread(target=api.serve_forever, daemon=True).start()
with socket.socket() as reservation:
    reservation.bind(("127.0.0.1", 0))
    port = reservation.getsockname()[1]
name = "yepwatch-route-check-" + uuid4().hex[:12]
prefix = "/api/yepwatch/v1/proposal"


def request(method, path):
    req = Request(f"http://127.0.0.1:{port}{prefix}{path}", method=method)
    try:
        with urlopen(req, timeout=2) as response:
            return response.status, response.read()
    except HTTPError as error:
        return error.code, error.read()


try:
    with tempfile.TemporaryDirectory() as temporary:
        config = (release / "Caddyfile").read_text().replace(":8080 {", f":{port} {{\n  bind 127.0.0.1")
        config = config.replace("api:3000", f"127.0.0.1:{api.server_port}")
        path = Path(temporary) / "Caddyfile"
        path.write_text(config)
        subprocess.run([
            "docker", "run", "--detach", "--name", name,
            "--network", "host", "--read-only", "--cap-drop", "ALL",
            "--cap-add", "NET_BIND_SERVICE",
            "--security-opt", "no-new-privileges", "--user", "65534:65534",
            "--mount", f"type=bind,src={path},dst=/etc/caddy/Caddyfile,readonly",
            image, "caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile",
        ], check=True, capture_output=True, text=True)
        for attempt in range(60):
            try:
                if request("GET", "/health/live")[0] == 200:
                    break
            except (URLError, TimeoutError):
                pass
            time.sleep(0.1)
        else:
            logs = subprocess.run(["docker", "logs", name], capture_output=True, text=True)
            print(logs.stdout, logs.stderr)
            raise AssertionError("Isolated Caddy did not start")

        room = "a" * 32
        public = [
            ("GET", "/account"), ("GET", "/account/home"),
            ("GET", "/account/deletion"), ("POST", "/account/deletion"),
            ("POST", "/account/restore"),
            ("POST", "/account/start"), ("POST", "/account/exchange"),
            ("POST", "/account/logout"), ("GET", "/member/callback"),
            ("POST", f"/rooms/{room}/resume"), ("POST", f"/rooms/{room}/archive"),
            ("GET", f"/rooms/{room}"), ("GET", f"/rooms/{room}/member/progress"),
            ("POST", f"/rooms/{room}/commands"), ("POST", f"/rooms/{room}/member/link"),
            ("POST", f"/rooms/{room}/deletion"), ("POST", f"/rooms/{room}/restore"),
            ("GET", "/invites/ABC234/card.png"),
        ]
        for method, route in public:
            status, body = request(method, route)
            assert status == 200, f"Public {method} {route} returned {status}"
            assert json.loads(body) == {"method": method, "path": prefix + route}

        for method, route in [
            ("POST", "/realtime/internal/attach"), ("GET", "/realtime/health"),
            ("GET", "/account/private"), ("POST", "/account/home"),
            ("GET", "/account/restore"), ("GET", f"/rooms/{room}/deletion"),
            ("GET", f"/rooms/{room}/resume"), ("GET", f"/rooms/{room}/archive"),
            ("POST", "/invites/ABC234/card.png"), ("GET", "/invites/a/b/card.png"),
        ]:
            assert request(method, route)[0] == 404, f"Unexpected public route: {method} {route}"
        print("PASS: public account and room routes reach API; internal, unknown and wrong-method routes stay blocked")
finally:
    subprocess.run(["docker", "stop", "--time", "1", name], capture_output=True)
    subprocess.run(["docker", "rm", name], capture_output=True)
    api.shutdown()
    api.server_close()
