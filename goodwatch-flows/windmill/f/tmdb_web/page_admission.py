# requirements:
# mongoengine==0.29.3
# pymongo==4.18.1
# wmill==1.815.0
"""One shared wire clock/permit accounting layered on the existing upstream gate.

No reservations of future slots: a caller retries a CAS when the clock is due.
Expired permits are reclaimed; release tokens cannot release another request.
"""
from datetime import datetime, timedelta
from time import sleep
from uuid import uuid4
from f.tmdb_web import country_state

CAP = 1.3
PERMIT_LIFETIME = timedelta(seconds=45)


def rate(state, now):
    reopened = state.get("reopened_at")
    return min(CAP, .325 + .1 * int((now - reopened).total_seconds() // 600)) if reopened else CAP


def try_acquire(db, *, tier="sweep", sweep_pending=None, now=None, upstream_permit=None):
    now = now or datetime.utcnow()
    before = db.tmdb_streaming_upstream.find_one({"_id": "tmdb_watch"})
    if before is None:
        raise RuntimeError("Page admission state missing; initialize explicitly before enabling page workers")
    if before.get("next_wire_at", datetime.min) > now:
        return None
    gate = upstream_permit or country_state.acquire_upstream(db, now)
    if gate is None:
        return None
    if sweep_pending is None:
        from f.tmdb_web.availability_selector import available, due
        sweep_pending = any(db[f"tmdb_{media}_providers"].find_one(
            {"$and": [available(now), due("sweep", now)]}, {"_id": 1}) is not None
            for media in ("movie", "tv"))
    states = db.tmdb_streaming_upstream
    for _ in range(24):
        state = states.find_one({"_id": "tmdb_watch"})
        if state is None or state.get("generation") != gate["generation"]:
            return None
        if state.get("blocked_until") and state.get("probe_token") != gate["probe_token"]:
            return None
        if gate['probe_token'] and (state.get('probe_expires_at') is None or state['probe_expires_at'] <= now):
            return None
        permits = [p for p in state.get("wire_permits", []) if p["expires_at"] > now]
        if len(permits) >= 6 or state.get("next_wire_at", datetime.min) > now:
            return None
        # Protect one in ten wire slots while sweep work is known to be pending.
        count = state.get("fairness_count", 0)
        if sweep_pending and tier != "sweep" and count >= 9:
            return None
        token = uuid4().hex
        permits.append({"token": token, "expires_at": now + PERMIT_LIFETIME})
        selector = {"_id": "tmdb_watch", "generation": gate["generation"],
                    "wire_revision": state.get("wire_revision"),
                    "probe_token": gate["probe_token"]}
        if gate['probe_token']:
            selector['probe_expires_at'] = {'$gt': now}
        result = states.update_one(selector, {"$set": {
            "wire_permits": permits, "next_wire_at": now + timedelta(seconds=1 / rate(state, now)),
            # Extra sweep work never creates an unbounded credit that could
            # starve a later background backlog. At most nine other admissions
            # can pass while sweep work waits; idle allocations are borrowed.
            "fairness_count": 0 if sweep_pending and tier == "sweep" else count + int(sweep_pending),
        }, "$inc": {"wire_revision": 1, "wire_count": 1,
                    "sweep_wire_count": int(tier == "sweep"),
                    "fairness_sweep_count": int(sweep_pending and tier == "sweep")}})
        if result.matched_count:
            return {**gate, "wire_token": token}
    return None


def acquire(db, *, tier="sweep", sweep_pending=None, deadline=None, upstream_permit=None):
    deadline = deadline or datetime.utcnow() + timedelta(seconds=55)
    while datetime.utcnow() < deadline:
        permit = try_acquire(db, tier=tier, sweep_pending=sweep_pending, upstream_permit=upstream_permit)
        if permit:
            return permit
        if upstream_permit is None and country_state.upstream_deadline(db) is not None:
            return None
        sleep(.05)
    return None


def release(db, permit):
    db.tmdb_streaming_upstream.update_one({"_id": "tmdb_watch"}, {
        "$pull": {"wire_permits": {"token": permit["wire_token"]}},
        "$inc": {"wire_revision": 1}})


def charge_pair(db, tier, now=None):
    """Atomic UTC-day attempt caps shared by retries, workers and reruns."""
    now = now or datetime.utcnow()
    limits = {"opened": 20000, "changed": 30000}
    if tier not in limits:
        return True
    identity = "page_pairs:" + now.strftime("%Y-%m-%d")
    counters = db.tmdb_streaming_upstream
    counters.update_one({"_id": identity}, {"$setOnInsert": {"opened": 0, "changed": 0}}, upsert=True)
    return counters.update_one({"_id": identity, tier: {"$lt": limits[tier]}},
                               {"$inc": {tier: 1}}).matched_count == 1


def initialize(db):
    """Explicit rollout bootstrap; workers never reset missing safety state."""
    db.tmdb_streaming_upstream.update_one({"_id": "tmdb_watch"}, {"$setOnInsert": {
        "generation": 0, "consecutive_blocks": 0, "wire_revision": 0,
        "wire_permits": [], "wire_count": 0, "sweep_wire_count": 0,
    }}, upsert=True)


def main(dry_run: bool = True):
    from mongoengine import get_db
    from f.db.mongodb import init_mongodb, close_mongodb
    init_mongodb()
    try:
        db = get_db()
        present = db.tmdb_streaming_upstream.find_one({"_id": "tmdb_watch"}) is not None
        if not dry_run:
            initialize(db)
        return {"state_present": present, "dry_run": dry_run}
    finally:
        close_mongodb()
