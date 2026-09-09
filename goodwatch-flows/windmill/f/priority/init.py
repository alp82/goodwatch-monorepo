"""Create only the new priority table before the queue cutover."""

from f.db.cratedb import CrateConnector
from f.sync.models.crate_schemas import SCHEMAS


def main():
    spec = SCHEMAS["crawl_priority"]
    columns = spec["columns"] | {"created_at": "TIMESTAMP", "updated_at": "TIMESTAMP"}
    definitions = [f"{name} {data_type}" for name, data_type in columns.items()]
    definitions.append(f"PRIMARY KEY ({', '.join(spec['primary_key'])})")
    db = CrateConnector()
    try:
        db.run(
            f"CREATE TABLE IF NOT EXISTS crawl_priority ({', '.join(definitions)}) "
            f"CLUSTERED INTO {spec['shards']} SHARDS"
        )
        existing = db.get_existing_columns("crawl_priority")
        if set(columns) - set(existing):
            raise RuntimeError("Existing crawl_priority schema is incomplete; inspect before importing")
        return {"table": "crawl_priority", "columns": sorted(existing)}
    finally:
        db.disconnect()
