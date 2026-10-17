"""Rehearse exactly the eight allowed MCP table grants on the disposable loopback cluster."""
import base64
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, build_opener, ProxyHandler
http = build_opener(ProxyHandler({}))

def sql(stmt, scoped=False):
    headers = {'Content-Type': 'application/json'}
    if scoped:
        headers['Authorization'] = 'Basic ' + base64.b64encode(b'goodwatch_search:local-mcp-test-only').decode()
    try:
        with http.open(Request('http://127.0.0.1:15767/_sql', json.dumps({'stmt': stmt}).encode(), headers), timeout=30) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        return error.code, json.load(error)

assert sql('SELECT name FROM sys.cluster')[1]['rows'] == [['gw-mcp-567']], 'Wrong cluster'
if not sql("SELECT name FROM sys.users WHERE name='goodwatch_search'")[1]['rows']:
    assert sql("CREATE USER goodwatch_search WITH (password='local-mcp-test-only')")[0] == 200
assert sql('GRANT DQL ON SCHEMA doc TO goodwatch_search')[0] == 200
for filename in ['mcp-write-tools-grants.sql', 'mcp-features-grants.sql']:
    source = Path(__file__).resolve().parents[3] / 'docs/implementation' / filename
    statement = '\n'.join(line for line in source.read_text().splitlines() if not line.startswith('--')).strip().rstrip(';')
    assert sql(statement)[0] == 200
expected = {'doc.' + name for name in ['user_mcp_action','user_wishlist','user_score','user_not_interested','user_watch_log','user_watch_state','user_setting','user_list']}
actual = sql("SELECT ident FROM sys.privileges WHERE grantee='goodwatch_search' AND type='DML' AND state='GRANT'")[1]['rows']
assert {row[0] for row in actual} == expected
for table in ['movie', 'user_favorite', 'user_profile', 'user_handle']:
    assert sql(f'DELETE FROM {table} WHERE false', True)[0] == 401
assert sql('CREATE TABLE mcp_forbidden (id int)', True)[0] == 401
assert sql('UPDATE user_list SET updated_at = CURRENT_TIMESTAMP WHERE false', True)[0] == 200
print('PASS: exactly eight table DML grants; profile, handle, catalog, Favorite mutations and DDL remain denied')
