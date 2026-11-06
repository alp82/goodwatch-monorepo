# extra_requirements:
# requests
# pymongo
# mongoengine
# crate
# pydantic
# wmill

"""Discover every award category and retain complete, repeatable nomination snapshots."""

from datetime import timedelta
from time import monotonic

from f.sync.copy.sync_state import utc_now
from f.tvdb.api import ApiError, Deferred
from f.tvdb.ids import checked_id
from f.tvdb.links import title_target
from f.tvdb.store import (
    claim,
    enqueue,
    enqueue_many,
    exclusive,
    finish,
    record_run,
    runtime,
    safe_publish,
)


def discover(db, api, now):
    state = db.tvdb_state.find_one({"_id": "awards-index"}) or {}
    if state.get("due_at", now) > now:
        return 0
    awards = api.get("/awards")["data"]
    if not isinstance(awards, list):
        raise TypeError("Incomplete TVDB awards index")
    count = 0
    for award in awards:
        if not checked_id(award.get("id")):
            raise ValueError("Malformed TVDB award")
        data = api.get(f"/awards/{award['id']}/extended")["data"]
        if (
            not isinstance(data, dict)
            or data.get("id") != award["id"]
            or not isinstance(data.get("categories"), list)
        ):
            raise ValueError("Incomplete TVDB category index")
        db.tvdb_awards.update_one(
            {"_id": award["id"]},
            {
                "$set": {
                    "name": award["name"],
                    "updated_at": now,
                    "categories": data["categories"],
                }
            },
            upsert=True,
        )
        for category in data["categories"]:
            if not checked_id(category.get("id")):
                raise ValueError("Malformed TVDB category")
            enqueue(
                db.tvdb_categories,
                category["id"],
                {
                    "award_id": award["id"],
                    "award_name": award["name"],
                    "name": category["name"],
                },
            )
            count += 1
    # Failure anywhere leaves the index due, and already discovered categories are safe to replay.
    db.tvdb_state.update_one(
        {"_id": "awards-index"},
        {
            "$set": {
                "due_at": now + timedelta(days=1),
                "updated_at": now,
                "awards": len(awards),
                "categories": count,
            }
        },
        upsert=True,
    )
    return count


def fetch_category(db, api, doc):
    body = api.get(f"/awards/categories/{doc['_id']}/extended")
    data = body["data"]
    if (
        not isinstance(data, dict)
        or data.get("id") != doc["_id"]
        or not isinstance(data.get("nominees"), list)
    ):
        raise ValueError("Incomplete TVDB nomination snapshot")
    if (body.get("links") or {}).get("next"):
        raise ValueError("Unexpected nomination pagination; refuse partial snapshot")
    if (data.get("award") or {}).get("id") != doc["award_id"]:
        raise ValueError("TVDB award category mismatch")
    ids, entities = set(), []
    for n in data["nominees"]:
        if not checked_id(n.get("id")) or type(n.get("isWinner")) is not bool:
            raise ValueError("Malformed TVDB nomination")
        if n["id"] in ids:
            raise ValueError("Repeated nomination ID within category")
        ids.add(n["id"])
        kind, tvdb, error = title_target(n)
        if tvdb and not error:
            entities.append(
                (f"{kind}:{tvdb}", {"kind": kind, "tvdb_id": tvdb}, 1000000)
            )
        if n.get("character") and checked_id(n["character"].get("peopleId")):
            person = n["character"]["peopleId"]
            entities.append(
                (f"person:{person}", {"kind": "person", "tvdb_id": person}, 1000000)
            )
    enqueue_many(db.tvdb_entities, entities)
    return data["nominees"]


def run(db, api, max_seconds=240, max_categories=500, publish=None, timer=monotonic):
    if not 1 <= max_seconds <= 1500 or not 1 <= max_categories <= 2000:
        raise ValueError("Invalid TVDB awards bounds")
    start, initial = timer(), api.requests
    report = {"categories": 0, "nominees": 0, "errors": 0}
    try:
        report["discovered"] = discover(db, api, utc_now())
        while timer() - start < max_seconds and report["categories"] < max_categories:
            now = utc_now()
            doc = claim(db.tvdb_categories, now)
            if not doc:
                break
            try:
                nominees = fetch_category(db, api, doc)
                finish(
                    db.tvdb_categories,
                    doc,
                    {
                        "nominees": nominees,
                        "updated_at": utc_now(),
                        "fetched_at": now,
                        "due_at": now + timedelta(days=1),
                        "error": None,
                    },
                )
                report["categories"] += 1
                report["nominees"] += len(nominees)
            except Deferred:
                finish(db.tvdb_categories, doc, {"due_at": now + timedelta(minutes=5)})
                raise
            except (ValueError, TypeError, ApiError) as error:
                finish(
                    db.tvdb_categories,
                    doc,
                    {
                        "error": type(error).__name__,
                        "due_at": now + timedelta(hours=6),
                        "attempted_at": now,
                    },
                )
                if isinstance(error, ApiError) and error.status in (401, 403):
                    raise
                report["errors"] += 1
                # Failed categories move out of the due queue before the next iteration.
            if publish and report["categories"] and report["categories"] % 10 == 0:
                safe_publish(publish, report)
    except Deferred:
        report["deferred"] = True
    if publish:
        safe_publish(publish, report)
    report["requests"] = api.requests - initial
    report["elapsed_seconds"] = round(timer() - start, 2)
    return report


def main(max_minutes: float = 4, max_categories: int = 500):
    from f.db.cratedb import CrateConnector
    from f.db.mongodb import close_mongodb
    from f.tvdb.publish import publish

    db, api = runtime()
    connector = None
    try:
        with exclusive(db, "awards", 30):
            connector = CrateConnector()
            report = run(
                db,
                api,
                int(max_minutes * 60),
                max_categories,
                publish=lambda: publish(db, connector, limit=100),
            )
            return record_run(db, "awards", report)
    finally:
        if connector:
            connector.disconnect()
        close_mongodb()
