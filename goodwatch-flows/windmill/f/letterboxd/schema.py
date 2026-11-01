# extra_requirements:
# crate
# pydantic
# wmill

"""Add only Letterboxd movie columns. No unrelated schema reconciliation."""
from f.db.cratedb import CrateConnector

COLUMNS = {
    "letterboxd_url": "TEXT",
    "letterboxd_id": "TEXT",
    "letterboxd_user_score_original": "DOUBLE",
    "letterboxd_user_score_normalized_percent": "DOUBLE",
    "letterboxd_user_score_rating_count": "BIGINT",
    "letterboxd_ratings_created_at": "TIMESTAMP",
    "letterboxd_ratings_updated_at": "TIMESTAMP",
}


def main(dry_run: bool = True):
    connector = CrateConnector()
    try:
        existing = connector.get_existing_columns("movie")
        missing = {key: value for key, value in COLUMNS.items() if key not in existing}
        if not dry_run:
            for key, value in missing.items():
                connector.run(f"ALTER TABLE movie ADD COLUMN {key} {value}")
        return {"dry_run": dry_run, "columns_added" if not dry_run else "missing_columns": list(missing)}
    finally:
        connector.disconnect()
