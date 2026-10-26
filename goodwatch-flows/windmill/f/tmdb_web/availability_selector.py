"""Availability tiers derive from country evidence and accepted title opens.

No demand acknowledgement: full metadata freshness and leases are independent.
"""
from datetime import datetime, timedelta, timezone
from f.data_source.title_identity import canonical_title_id


def recent_open_ids(crate, media_type, now):
    media = "show" if media_type == "tv" else "movie"
    since = (now - timedelta(days=1)).replace(tzinfo=timezone.utc)
    rows = crate.select(
        """SELECT tmdb_id FROM crawl_priority WHERE media_type = ?
        AND last_opened_at >= ? ORDER BY last_opened_at DESC""",
        (media, int(since.timestamp() * 1000)),
    )
    return list(dict.fromkeys(canonical_title_id(media, row["tmdb_id"]) for row in rows))


def available(now):
    return {"$and": [
        {"country_identity_error": None}, {"tmdb_deleted": {"$ne": True}},
        {"provider_title_observed_at": {"$type": "date"}},
        {"country_code": {"$ne": "NE"}}, {"provider_verified_empty": {"$ne": True}},
        {"$or": [{"lease_expires_at": None}, {"lease_expires_at": {"$lte": now}}]},
        {"$or": [{"consecutive_failures": None}, {"consecutive_failures": 0},
                   {"next_fetch_at": {"$lte": now}}]},
    ]}


def due(tier, now, opened_ids=()):
    if tier == "opened":
        return {"tmdb_id": {"$in": list(opened_ids)}, "$or": [
            {"updated_at": None}, {"updated_at": {"$lte": now - timedelta(days=1)}}]}
    if tier == "changed":
        return {"$or": [{"provider_change_pending": True}, {"updated_at": None}]}
    return {"$and": [*([{ "popularity": {"$gte": 20}}] if tier == "popular" else []),
                     {"$or": [{"updated_at": None}, {"updated_at": {"$lte": now - timedelta(days=7)}}]}]}


def select(collection, now, limit=20, opened_ids=()):
    if not 1 <= limit <= 20:
        raise ValueError("At most 20 root pages per HTTP/2 batch")
    rows, seen = [], set()
    budget = collection.database.tmdb_streaming_upstream.find_one({"_id": "page_pairs:" + now.strftime("%Y-%m-%d")}) or {}
    # An explicit sweep slot plus admission's shared wire reservation protects
    # sweep progress across batches and tier storms; unused slots are borrowed.
    for tier, slots in (("sweep", max(1, limit // 10)), ("opened", limit),
                        ("changed", limit), ("popular", limit), ("sweep", limit)):
        if tier in {"opened", "changed"} and budget.get(tier, 0) >= {"opened": 20000, "changed": 30000}[tier]:
            continue
        remaining = min(slots, limit - len(rows))
        if not remaining:
            continue
        cursor = collection.find({"$and": [available(now), due(tier, now, opened_ids),
                                            {"_id": {"$nin": list(seen)}}]}).sort([
                                                ("updated_at", 1), ("has_streaming_links", 1), ("_id", 1)]).limit(remaining)
        for row in cursor:
            seen.add(row["_id"])
            rows.append({"id": str(row["_id"]), "tier": tier})
    return rows


def main():
    pass
