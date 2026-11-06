# extra_requirements:
# pymongo
# mongoengine
# wmill

"""One-time, resumable award-link replay from saved snapshots; no external requests."""

from f.sync.copy.sync_state import utc_now
from f.tvdb.store import EPOCH, exclusive, indexes, record_run

VERSION = 2


def run(db, dry_run=True):
    query = {"nominees": {"$exists": True}, "award_links_version": {"$ne": VERSION}}
    count = db.tvdb_categories.count_documents(query)
    if not dry_run:
        db.tvdb_categories.update_many(
            query,
            {
                "$set": {
                    "updated_at": utc_now(),
                    "publish_pending": True,
                    "publish_retry_at": EPOCH,
                    "award_links_version": VERSION,
                }
            },
        )
    return {"dry_run": dry_run, "categories_requeued": count, "version": VERSION}


def main(dry_run: bool = True):
    from f.db.mongodb import close_mongodb, init_mongodb
    from mongoengine import get_db

    init_mongodb()
    try:
        db = get_db()
        indexes(db)
        with exclusive(db, "award-links", 30):
            return record_run(db, "award-links", run(db, dry_run))
    finally:
        close_mongodb()
