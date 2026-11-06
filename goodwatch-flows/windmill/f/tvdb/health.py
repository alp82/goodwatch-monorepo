# extra_requirements:
# pymongo
# mongoengine
# wmill

"""Expose stalled publication and repeatedly quarantined scopes to schedule monitoring."""

from datetime import timedelta

from f.sync.copy.sync_state import utc_now


def assess(db, now=None):
    now = now or utc_now()
    problems = []
    for name in ["tvdb_titles", "tvdb_categories"]:
        col = db[name]
        oldest = next(
            iter(
                col.find({"publish_pending": True}, {"updated_at": 1})
                .sort("updated_at", 1)
                .limit(1)
            ),
            None,
        )
        state = db.tvdb_state.find_one({"_id": "publication-progress:" + name}) or {}
        advanced = state.get("at")
        if oldest and now - max(
            oldest.get("updated_at", now), advanced or oldest.get("updated_at", now)
        ) > timedelta(minutes=30):
            problems.append(f"{name}: publication stalled for over 30 minutes")
        if col.find_one(
            {"publish_pending": True, "publish_failures": {"$gte": 3}}, {"_id": 1}
        ):
            problems.append(f"{name}: a scope failed publication at least three times")
    return {"checked_at": now, "problems": problems, "healthy": not problems}


def main():
    from f.db.mongodb import close_mongodb, init_mongodb
    from f.tvdb.store import record_run
    from mongoengine import get_db

    init_mongodb()
    try:
        db = get_db()
        result = record_run(db, "health", assess(db))
        if result["problems"]:
            raise RuntimeError("TVDB health: " + "; ".join(result["problems"]))
        return result
    finally:
        close_mongodb()
