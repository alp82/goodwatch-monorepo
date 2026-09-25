"""Sweep CrateDB for rows of titles that are missing from Mongo (see sweep_orphaned_titles).

The details copy never reads these titles, so nothing else removes their rows. The sweep
scans every title table, so it runs on its own schedule instead of inside the copy.
"""

from mongoengine import get_db

from f.db.cratedb import CrateConnector
from f.db.mongodb import close_mongodb, init_mongodb
from f.sync.copy.deleted_titles import sweep_orphaned_titles


def main(dry_run: bool = False):
    init_mongodb()
    connector = CrateConnector()
    mongo_db = get_db()
    try:
        return {
            media_type: sweep_orphaned_titles(
                connector, media_type, details_collection, mongo_db.tmdb_daily_dump_data, dry_run=dry_run)
            for media_type, details_collection in (
                ("movie", mongo_db.tmdb_movie_details),
                ("show", mongo_db.tmdb_tv_details),
            )
        }
    finally:
        connector.disconnect()
        close_mongodb()
