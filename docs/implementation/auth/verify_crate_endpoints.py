#!/usr/bin/env python3
"""Checks that every CrateDB endpoint enforces passwords, from where this runs (#562). Standard library only.

Reads CRATE_HOSTS (comma-separated), CRATE_PORT (default 4200), CRATE_USER, and the password from CRATE_PASS or from
the file named by CRATE_PASSWORD_FILE. For each host it sends SELECT current_user four times:

    no credentials                -> must be refused (HTTP 401)
    crate with a wrong password   -> must be refused
    CRATE_USER, wrong password    -> must be refused
    CRATE_USER, its password      -> must answer CRATE_USER

Prints one JSON line per host and exits 0 only when every check passes. Never prints a password.

    docker exec -i <container> python3 - < verify_crate_endpoints.py          # env of the container
    CRATE_HOSTS=10.0.0.11,10.0.0.12,10.0.0.13 CRATE_USER=goodwatch_backup \\
      CRATE_PASSWORD_FILE=/root/.config/goodwatch/crate-backup-password python3 verify_crate_endpoints.py
"""
import base64
import json
import os
import secrets
import sys
import urllib.error
import urllib.request
from urllib.parse import urlsplit


def current_user(url, credentials):
    request = urllib.request.Request(url, data=json.dumps({"stmt": "SELECT current_user"}).encode(),
                                     headers={"Content-Type": "application/json"}, method="POST")
    if credentials is not None:
        token = base64.b64encode(f"{credentials[0]}:{credentials[1]}".encode()).decode()
        request.add_header("Authorization", f"Basic {token}")
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.loads(response.read())["rows"][0][0]
    except urllib.error.HTTPError as e:
        return f"HTTP {e.code}"
    except (urllib.error.URLError, OSError) as e:
        return f"unreachable: {type(e).__name__}"


def main(environ):
    hosts = [h.strip() for h in (environ.get("CRATE_VERIFY_HOSTS") or environ.get("CRATE_HOSTS", "")).split(",") if h.strip()]
    user = environ.get("CRATE_USER", "")
    password = environ.get("CRATE_PASS", "")
    if environ.get("CRATE_PASSWORD_FILE"):
        with open(environ["CRATE_PASSWORD_FILE"], encoding="utf-8") as file:
            password = file.read().removesuffix("\n")
    if not hosts or not user or not password:
        print("Set CRATE_HOSTS, CRATE_USER and CRATE_PASS or CRATE_PASSWORD_FILE.", file=sys.stderr)
        return 2
    wrong = "wrong-" + secrets.token_hex(8)
    passed = True
    for host in hosts:
        parsed = urlsplit(host if "://" in host else "http://" + host)
        if parsed.scheme != "http" or parsed.username or parsed.password or parsed.path not in ("", "/") or parsed.query or parsed.fragment:
            print("Invalid coordinator: use an HTTP host without credentials or a path.", file=sys.stderr)
            return 2
        url = f"http://{parsed.hostname}:{parsed.port or environ.get('CRATE_PORT') or '4200'}/_sql"
        answers = {
            "no credentials": current_user(url, None),
            "crate, wrong password": current_user(url, ("crate", wrong)),
            f"{user}, wrong password": current_user(url, (user, wrong)),
            f"{user}, its password": current_user(url, (user, password)),
        }
        ok = all(answer == "HTTP 401" for case, answer in answers.items() if "wrong" in case or "no " in case) \
            and answers[f"{user}, its password"] == user
        passed &= ok
        print(json.dumps({"host": host, "ok": ok, **answers}), flush=True)
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main(os.environ))
