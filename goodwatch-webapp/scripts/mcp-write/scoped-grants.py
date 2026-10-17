"""Rehearse the production MCP grants only on the disposable loopback cluster."""
import base64
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, build_opener, ProxyHandler

http = build_opener(ProxyHandler({}))
url = 'http://127.0.0.1:15767/_sql'

def sql(stmt, scoped=False):
    headers = {'Content-Type': 'application/json'}
    if scoped:
        headers['Authorization'] = 'Basic ' + base64.b64encode(b'goodwatch_search:local-mcp-test-only').decode()
    try:
        with http.open(Request(url, json.dumps({'stmt': stmt}).encode(), headers), timeout=30) as r:
            return r.status, json.load(r)
    except HTTPError as e:
        return e.code, json.load(e)

assert sql('SELECT name FROM sys.cluster')[1]['rows'] == [['gw-mcp-567']], 'Wrong cluster'
existing = sql("SELECT name FROM sys.users WHERE name = 'goodwatch_search'")[1]['rows']
if not existing:
    assert sql("CREATE USER goodwatch_search WITH (password = 'local-mcp-test-only')")[0] == 200
assert sql('GRANT DQL ON SCHEMA doc TO goodwatch_search')[0] == 200
assert sql('SELECT current_user', True)[1]['rows'] == [['goodwatch_search']]
# The same reviewed statement is used for production. No auth grants are included.
source = Path(__file__).resolve().parents[3] / 'docs/implementation/mcp-write-tools-grants.sql'
statement = '\n'.join(line for line in source.read_text().splitlines() if not line.startswith('--')).strip().rstrip(';')
assert sql(statement)[0] == 200
expected = {'doc.' + name for name in ['user_mcp_action', 'user_wishlist', 'user_score', 'user_not_interested', 'user_watch_log', 'user_watch_state', 'user_setting']}
privileges = sql("SELECT ident FROM sys.privileges WHERE grantee='goodwatch_search' AND type='DML' AND state='GRANT'")[1]['rows']
assert {row[0] for row in privileges} == expected
assert sql('DELETE FROM user_favorite WHERE false', True)[0] == 401
assert sql('DELETE FROM movie WHERE false', True)[0] == 401
assert sql('CREATE TABLE mcp_forbidden (id int)', True)[0] == 401
assert sql('REFRESH TABLE user_favorite, user_skipped', True)[0] == 200
print('PASS: scoped identity has exactly seven table DML grants; catalog/favorite writes and DDL denied; shared refreshes allowed')
