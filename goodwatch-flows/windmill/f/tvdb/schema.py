# extra_requirements:
# crate
# pydantic
# wmill

"""Create only the two additive TVDB enrichment tables."""

from f.sync.init.cratedb import create_table_sql
from f.sync.models.crate_schemas import SCHEMAS

TABLES = ("tvdb_character", "tvdb_nomination")


def main(dry_run: bool = True):
    from f.db.cratedb import CrateConnector

    connector = CrateConnector()
    try:
        existing = {
            r["table_name"]
            for r in connector.select(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'doc'"
            )
        }
        missing = [name for name in TABLES if name not in existing]
        if not dry_run:
            for name in missing:
                connector.run(create_table_sql(name, SCHEMAS[name]))
        return {"dry_run": dry_run, "missing_tables": missing}
    finally:
        connector.disconnect()
