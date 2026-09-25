# /// script
# dependencies = ["google-auth", "requests", "python-dotenv"]
# ///
"""Read-only Google Search Console client for goodwatch.app.

Needs GSC_KEY_FILE (in scripts/.env or the environment) pointing to the
service account JSON key. Keep the key outside the repo.

Usage:
    uv run gsc.py sites
    uv run gsc.py sitemaps
    uv run gsc.py query '{"startDate":"2026-01-01","endDate":"2026-09-01","dimensions":["page"]}'
    uv run gsc.py inspect https://goodwatch.app/movie/238-the-godfather

Page indexing, crawl stats, manual actions, removals and messages are not
available through the API.
"""
import json
import os
import sys
import urllib.parse

import google.auth.transport.requests
from dotenv import load_dotenv
from google.oauth2 import service_account

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

SITE = "sc-domain:goodwatch.app"
SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]
BASE = "https://www.googleapis.com/webmasters/v3"
INSPECT = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect"


def session():
    key_file = os.getenv("GSC_KEY_FILE")
    if not key_file:
        raise SystemExit("GSC_KEY_FILE is not set, add it to scripts/.env")
    creds = service_account.Credentials.from_service_account_file(key_file, scopes=SCOPES)
    return google.auth.transport.requests.AuthorizedSession(creds)


def request(method, url, body=None):
    response = session().request(method, url, json=body)
    if not response.ok:
        print(response.status_code, response.text, file=sys.stderr)
    response.raise_for_status()
    return response.json()


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    cmd, *args = sys.argv[1:]
    site = urllib.parse.quote(SITE, safe="")
    if cmd == "sites":
        out = request("GET", f"{BASE}/sites")
    elif cmd == "sitemaps":
        out = request("GET", f"{BASE}/sites/{site}/sitemaps")
    elif cmd == "query":
        out = request("POST", f"{BASE}/sites/{site}/searchAnalytics/query", json.loads(args[0]))
    elif cmd == "inspect":
        out = request("POST", INSPECT, {"inspectionUrl": args[0], "siteUrl": SITE})
    else:
        raise SystemExit(f"Unknown command {cmd}\n{__doc__}")
    print(json.dumps(out, indent=1))


main()
