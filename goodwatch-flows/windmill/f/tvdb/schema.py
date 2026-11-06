# extra_requirements:
# crate
# pydantic
# wmill

"""Create only the two additive TVDB enrichment tables."""

from f.sync.init.cratedb import create_table_sql
from f.sync.models.crate_schemas import SCHEMAS
from f.tvdb.award_quality import DISPLAY_VIEW_SQL

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
        # Photo ownership stays separate: the TMDB details copy continues to own profile_path.
        columns = connector.get_existing_columns("person")
        additions = {
            name: SCHEMAS["person"]["columns"][name]
            for name in ("tvdb_id", "tvdb_profile_url", "tvdb_profile_updated_at")
            if name not in columns
        }
        if not dry_run:
            for name, kind in additions.items():
                connector.run(f"ALTER TABLE person ADD COLUMN {name} {kind}")
        nomination_columns = (
            connector.get_existing_columns("tvdb_nomination")
            if "tvdb_nomination" in existing
            else SCHEMAS["tvdb_nomination"]["columns"]
        )
        nomination_additions = {
            name: kind
            for name, kind in SCHEMAS["tvdb_nomination"]["columns"].items()
            if name not in nomination_columns
        }
        if not dry_run:
            for name, kind in nomination_additions.items():
                connector.run(f"ALTER TABLE tvdb_nomination ADD COLUMN {name} {kind}")
        if not dry_run:
            connector.run(DISPLAY_VIEW_SQL)
        return {
            "dry_run": dry_run,
            "missing_tables": missing,
            "missing_person_columns": list(additions),
            "missing_nomination_columns": list(nomination_additions),
            "display_view": "tvdb_award_display",
        }
    finally:
        connector.disconnect()
