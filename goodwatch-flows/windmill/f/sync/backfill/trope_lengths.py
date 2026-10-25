"""Prepare profile trope snapshots and backfill excerpt lengths without a full-table update.

Run once before deploying the profile performance change. Dry run is the default.
The existing copy/tvtropes job maintains content_length for subsequent imports.
"""
from f.db.cratedb import CrateConnector
from f.sync.init.cratedb import create_table_sql
from f.sync.models.crate_schemas import SCHEMAS


def prepare(connector, *, dry_run=True, batch_size=100):
    if not 1 <= batch_size <= 500:
        raise ValueError("batch_size must be between 1 and 500")
    table = "profile_tropes_snapshot"
    statements = []
    if not connector.table_exists(table):
        statements.append(create_table_sql(table, SCHEMAS[table]))
    if "content_length" not in connector.get_existing_columns("trope"):
        statements.append("ALTER TABLE trope ADD COLUMN content_length INTEGER")
    for sql in statements:
        print(f"{'Would run' if dry_run else 'Running'}: {sql}", flush=True)
        if not dry_run:
            connector.run(sql)
    if dry_run and statements:
        return {"dry_run": True, "schema_changes": len(statements), "titles": 0}
    titles = 0
    for media_type in ("movie", "show"):
        after = 0
        while True:
            rows = connector.select(
                "SELECT media_tmdb_id FROM trope WHERE media_type = ? "
                "AND media_tmdb_id > ? AND content_length IS NULL "
                f"GROUP BY media_tmdb_id ORDER BY media_tmdb_id LIMIT {batch_size}",
                (media_type, after),
            )
            if not rows:
                break
            ids = [row["media_tmdb_id"] for row in rows]
            after = ids[-1]
            titles += len(ids)
            if not dry_run:
                placeholders = ",".join("?" for _ in ids)
                connector.run(
                    "UPDATE trope SET content_length = "
                    "char_length(regexp_replace(coalesce(content, ''), '<[^>]*>', '', 'g')) "
                    f"WHERE media_type = ? AND media_tmdb_id IN ({placeholders}) AND content_length IS NULL",
                    (media_type, *ids),
                )
            print(f"{'Would backfill' if dry_run else 'Backfilled'} {len(ids)} {media_type} titles; through {after}", flush=True)
    return {"dry_run": dry_run, "schema_changes": len(statements), "titles": titles}


def main(dry_run: bool = True, batch_size: int = 100):
    connector = CrateConnector()
    try:
        return prepare(connector, dry_run=dry_run, batch_size=batch_size)
    finally:
        connector.disconnect()
