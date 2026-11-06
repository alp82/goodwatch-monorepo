# extra_requirements:
# pymongo
# mongoengine
# wmill

"""Check independent source, normalization and publication progress."""

from datetime import timedelta

from f.awards.store import record_run
from f.sync.copy.sync_state import utc_now


def assess(db, now=None):
    now = now or utc_now()
    problems = []
    request = db.award_state.find_one({"_id": "reconcile"}) or {}
    if request.get("pending") and now - request.get("requested_at", now) > timedelta(
        minutes=30
    ):
        problems.append("Canonical award reconciliation is stalled")
    ready = db.award_state.find_one({"_id": "canonical"}) or {}
    generation = db.award_generations.find_one({"_id": ready.get("generation")}) or {}
    if (
        generation
        and not generation.get("published_at")
        and now - generation.get("created_at", now) > timedelta(minutes=30)
    ):
        problems.append("Canonical award publication is stalled")
    if db.award_wikidata_queue.find_one({"fetch_failures": {"$gte": 3}}, {"_id": 1}):
        problems.append("A Wikidata award scope failed at least three times")
    due = db.award_wikidata_queue.find_one({"due_at": {"$lte": now}}, {"_id": 1})
    last = db.award_state.find_one({"_id": "run:wikidata"}) or {}
    if due and last.get("at") and now - last["at"] > timedelta(hours=2):
        problems.append("Wikidata award ingestion has not advanced for two hours")
    last_tvdb = db.award_state.find_one({"_id": "run:tvdb"}) or {}
    if not last_tvdb.get("at") or now - last_tvdb["at"] > timedelta(hours=2):
        problems.append("TVDB award normalization has not completed for two hours")
    return {"healthy": not problems, "problems": problems, "checked_at": now}


def main():
    from f.db.mongodb import close_mongodb, init_mongodb
    from mongoengine import get_db

    init_mongodb()
    try:
        db = get_db()
        report = record_run(db, "health", assess(db))
        if report["problems"]:
            raise RuntimeError("; ".join(report["problems"]))
        return report
    finally:
        close_mongodb()
