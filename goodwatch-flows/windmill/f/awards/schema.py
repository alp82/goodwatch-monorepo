# extra_requirements:
# crate
# pydantic
# wmill

"""Add neutral award read models; publish complete generations through one pointer."""

from f.sync.init.cratedb import add_missing_columns, create_table_sql
from f.sync.models.crate_schemas import SCHEMAS

TABLES = ("award_publication", "award_title_result", "award_person_result")
TITLE_VIEW = """CREATE OR REPLACE VIEW award_title_display AS
SELECT r.* FROM award_title_result r JOIN award_publication p ON r.generation = p.generation WHERE p.name = 'active'"""
PERSON_VIEW = """CREATE OR REPLACE VIEW award_person_display AS
SELECT r.* FROM award_person_result r JOIN award_publication p ON r.generation = p.generation WHERE p.name = 'active'"""


def main(dry_run: bool = True):
    from f.db.cratedb import CrateConnector

    c = CrateConnector()
    try:
        existing = {
            r["table_name"]
            for r in c.select(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'doc'"
            )
        }
        missing = [name for name in TABLES if name not in existing]
        if not dry_run:
            for name in missing:
                c.run(create_table_sql(name, SCHEMAS[name]))
            for name in TABLES:
                if name in existing:
                    add_missing_columns(
                        name, SCHEMAS[name], c.get_existing_columns(name), c.run
                    )
            c.run(TITLE_VIEW)
            c.run(PERSON_VIEW)
        return {"dry_run": dry_run, "missing_tables": missing}
    finally:
        c.disconnect()
