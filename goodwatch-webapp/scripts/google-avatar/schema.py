"""Set up the production table definitions on our disposable Crate node."""
import json
import sys
import time
from urllib.request import Request, urlopen

from f.sync.models.crate_schemas import SCHEMAS

origin = f"http://127.0.0.1:{int(sys.argv[1])}"
deadline = time.monotonic() + 60
while True:
    try:
        with urlopen(origin, timeout=1) as response:
            cluster = json.load(response)["cluster_name"]
        break
    except OSError:
        if time.monotonic() >= deadline:
            raise
        time.sleep(0.25)

if cluster != "avatar-regression-isolated":
    raise RuntimeError("Expected the disposable avatar regression cluster")
for name in ("user_setting", "user_profile", "user_avatar", "user_provider_avatar"):
    schema = SCHEMAS[name]
    columns = [f"{key} {kind}" for key, kind in schema["columns"].items()]
    columns.append(f"PRIMARY KEY ({', '.join(schema['primary_key'])})")
    ddl = f"CREATE TABLE doc.{name} ({', '.join(columns)}) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas=0)"
    data = json.dumps({"stmt": ddl}).encode()
    with urlopen(Request(origin + "/_sql", data=data, headers={"Content-Type": "application/json"})) as response:
        json.load(response)
