"""Create the member tables (user_*) on the disposable account-deletion cluster, from the repository's schemas."""
import importlib.util
import json
import re
import sys
from pathlib import Path
from urllib.request import ProxyHandler, Request, build_opener

url = 'http://127.0.0.1:16248/_sql'
http = build_opener(ProxyHandler({}))


def sql(stmt, args=None):
    with http.open(Request(url, data=json.dumps({'stmt': stmt, 'args': args or []}).encode(), headers={'Content-Type': 'application/json'}), timeout=60) as response:
        return json.load(response)


assert sql('SELECT name FROM sys.cluster')['rows'] == [['goodwatch-local-auth-548']], 'Wrong local cluster; refusing to create tables'
source = Path(__file__).resolve().parents[3] / 'goodwatch-flows/windmill/f/sync/models/crate_schemas.py'
# The schema module imports the social schemas through the Windmill workspace's top-level f package.
sys.path.insert(0, str(source.parents[3]))
spec = importlib.util.spec_from_file_location('schemas', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
created = []
for name, schema in module.SCHEMAS.items():
    if not name.startswith('user_'):
        continue
    columns = schema['columns'].copy()
    if schema.get('timestamps') is not False:
        columns |= {'created_at': 'TIMESTAMP', 'updated_at': 'TIMESTAMP'}
    definitions = [f'"{key}" {kind}' for key, kind in columns.items()]
    definitions += [f"PRIMARY KEY ({','.join(schema['primary_key'])})"]
    routing = f"BY ({schema['clustered_by']}) " if schema.get('clustered_by') else ''
    sql(f"CREATE TABLE IF NOT EXISTS {name} ({','.join(definitions)}) CLUSTERED {routing}INTO 1 SHARDS WITH (number_of_replicas=0)")
    created.append(name)
# The MCP receipt table is created by hand at the cut-over (step 1.4), so it isn't in SCHEMAS.
receipts = (Path(__file__).resolve().parents[3] / 'docs/implementation/mcp-write-tools-schema.sql').read_text()
receipts = '\n'.join(line for line in receipts.splitlines() if not line.startswith('--')).strip().rstrip(';')
receipts = re.sub(r'INTO \d+ SHARDS$', 'INTO 1 SHARDS WITH (number_of_replicas=0)', receipts.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS ', 1))
sql(receipts)
created.append('user_mcp_action')
print(f'Created {len(created)} member tables: {", ".join(created)}')
