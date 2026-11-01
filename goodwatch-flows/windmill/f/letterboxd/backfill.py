# extra_requirements:
# requests
# pymongo
# mongoengine
# crate
# pydantic
# wmill

"""Keep the shared request slots busy on the popularity queue, without extra request workers."""
import time
from datetime import datetime, timedelta

from f.letterboxd.crawl import run
from f.letterboxd.http import Client
from f.letterboxd.seed import ensure_indexes


def backfill(db, client, max_hours, batch_size, publish, clock=datetime.utcnow, sleep=time.sleep):
    if not 0 < max_hours <= 24 or not 1 <= batch_size <= 100:
        raise ValueError("max_hours must be 0..24 and batch_size 1..100")
    started = clock()
    deadline = started + timedelta(hours=max_hours)
    total = {"titles": 0, "ok": 0, "unrated": 0, "not_found": 0, "rejected": 0,
             "unavailable": 0, "error": 0, "requests": 0, "published": 0, "segments": 0, "blocked": None}
    while clock() < deadline:
        remaining = (deadline - clock()).total_seconds()
        if remaining <= 0:
            break
        # The ordinary due queue also retries errors and refreshes recent releases.
        # Sharing it prevents a long cold backfill from starving those movies.
        part = run(db, client, max_seconds=min(1500, remaining), batch_size=batch_size,
                   clock=clock, publish=publish)
        for key in total:
            if isinstance(total[key], int):
                total[key] += part.get(key, 0)
        if part.get("blocked"):
            total["blocked"] = part["blocked"]
            break
        if part.get("stopped") == "another crawler holds the lease":
            sleep(min(15, max(0, (deadline - clock()).total_seconds())))
            continue
        total["segments"] += 1
        if part.get("stopped") == "nothing due":
            total["stopped"] = "no movies due"
            break
    total["seconds"] = round((clock() - started).total_seconds(), 1)
    return total


def main(max_hours: float = 0.98, batch_size: int = 100):
    from mongoengine import get_db
    from f.db.mongodb import init_mongodb, close_mongodb
    from f.db.cratedb import CrateConnector
    from f.sync.copy.all_ratings import copy_media

    init_mongodb()
    connector = None
    try:
        db = get_db()
        ensure_indexes(db)
        connector = CrateConnector()
        return backfill(db, Client(db), max_hours, batch_size,
                        publish=lambda ids: copy_media(connector, {"tmdb_id": {"$in": ids}},
                                                       "movie", recent_only=False))
    finally:
        if connector:
            connector.disconnect()
        close_mongodb()
