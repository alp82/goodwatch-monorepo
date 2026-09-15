"""Bounded read-only aggregates; source payloads never enter monitoring state."""
from datetime import datetime, timedelta, timezone
from time import monotonic
from typing import Any

from f.monitoring.backlog_health import COUNTRY_GRACE_SECONDS
from f.tmdb_web.country_state import FRESHNESS, eligibility


def iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        value = datetime.fromtimestamp(value / 1000, timezone.utc)
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def collect_countries(db: Any, now: datetime, *, budget_seconds: float = 60) -> dict:
    deadline = monotonic() + budget_seconds
    upstream = db.tmdb_streaming_upstream.find_one(
        {"_id": "tmdb_watch"}, {"blocked_until": 1}) or {}
    blocked = iso(upstream.get("blocked_until"))
    result = {"complete": True, "overdue_country_count": 0,
              "overdue_title_count": 0, "oldest_due_at": None,
              "last_success_at": None, "upstream_blocked_until": blocked,
              "excluded": {}, "count_relation": "exact", "collection_errors": []}
    if blocked and datetime.fromisoformat(blocked) > now:
        return result
    cutoff = now - timedelta(seconds=COUNTRY_GRACE_SECONDS)
    legacy_cutoff = cutoff - FRESHNESS
    selector = {"$and": [eligibility(now), {"$or": [
        {"next_fetch_at": {"$lte": cutoff}},
        {"next_fetch_at": None, "updated_at": {"$lte": legacy_cutoff}},
        {"next_fetch_at": None, "updated_at": None},
    ]}]}
    due = {"$ifNull": ["$next_fetch_at", {"$ifNull": [
        {"$add": ["$updated_at", int(FRESHNESS.total_seconds() * 1000)]},
        datetime(1970, 1, 1, tzinfo=timezone.utc)]}]}
    partitions = []
    for media in ("movie", "tv"):
        partition = {"complete": True, "media_type": media,
                     "overdue_country_count": 0, "overdue_title_count": 0,
                     "oldest_due_at": None, "last_success_at": None,
                     "count_relation": "exact", "excluded": {}}
        collection = db[f"tmdb_{media}_providers"]
        remaining = deadline - monotonic()
        try:
            if remaining <= 0:
                raise TimeoutError("Country collection budget exhausted")
            stats = list(collection.aggregate([
                {"$match": selector},
                {"$group": {"_id": "$tmdb_id", "countries": {"$sum": 1},
                            "oldest": {"$min": due}}},
                {"$group": {"_id": None, "titles": {"$sum": 1},
                            "countries": {"$sum": "$countries"},
                            "oldest": {"$min": "$oldest"}}},
            ], maxTimeMS=max(1, int(min(40, remaining) * 1000)), allowDiskUse=False))
            if stats:
                stat = stats[0]
                partition.update(overdue_country_count=stat["countries"],
                                 overdue_title_count=stat["titles"],
                                 oldest_due_at=iso(stat.get("oldest")))
            remaining = deadline - monotonic()
            if remaining <= 0:
                raise TimeoutError("Country collection budget exhausted")
            latest = collection.find_one({"updated_at": {"$ne": None}},
                                         {"updated_at": 1}, sort=[("updated_at", -1)],
                                         max_time_ms=max(1, int(remaining * 1000)))
            partition["last_success_at"] = iso(latest.get("updated_at")) if latest else None
        except Exception:
            partition.update(complete=False, count_relation="lower_bound",
                             collection_error="country_query_unavailable")
        partitions.append(partition)
        result["overdue_country_count"] += partition["overdue_country_count"]
        result["overdue_title_count"] += partition["overdue_title_count"]
        for field, use_min in [("oldest_due_at", True), ("last_success_at", False)]:
            value = partition[field]
            if value and (not result[field] or (value < result[field] if use_min else value > result[field])):
                result[field] = value
        if not partition["complete"]:
            result["complete"] = False
            result["collection_errors"].append("country_query_unavailable")
    result["partitions"] = partitions
    if not result["complete"]:
        result["count_relation"] = "lower_bound"
    return result


def main() -> None:
    pass


def collect_identity_repairs(db: Any, now: datetime, *, budget_seconds: float = 10) -> dict:
    """Report all pending repairs, even when ordinary backlog excludes backoff."""
    deadline = monotonic() + budget_seconds
    result = {"complete": True, "observed_at": iso(now), "partitions": []}
    try:
        result["maintenance_active"] = bool(db.provider_identity_maintenance.find_one(
            {"_id": "repair", "active": True}, {"_id": 1}))
        unresolved = list(db.provider_identity_unresolved.find({"status": "unresolved"}, {
            "_id": 0, "media": 1, "tmdb_id": 1, "source_document_count": 1,
        }))
        result["unresolved_quarantines"] = unresolved
        for media in ("movie", "tv"):
            collection = db[f"tmdb_{media}_providers"]
            indexes = collection.index_information()
            if "pending_identity_refresh" not in indexes:
                raise RuntimeError("Pending repair index missing")
            remaining = deadline - monotonic()
            if remaining <= 0:
                raise TimeoutError("Repair monitoring budget exhausted")
            stats = list(collection.aggregate([
                {"$match": {"identity_repair_pending": {"$exists": True}}},
                {"$group": {"_id": None, "pending_count": {"$sum": 1},
                    "pending_failed_count": {"$sum": {"$cond": [
                        {"$gt": [{"$ifNull": ["$consecutive_failures", 0]}, 0]}, 1, 0]}},
                    "pending_backoff_count": {"$sum": {"$cond": [
                        {"$gt": ["$next_fetch_at", now]}, 1, 0]}},
                    "pending_leased_count": {"$sum": {"$cond": [
                        {"$gt": ["$lease_expires_at", now]}, 1, 0]}},
                    "oldest_next_fetch_at": {"$min": "$next_fetch_at"},
                }},
            ], hint="pending_identity_refresh", maxTimeMS=max(1, int(remaining * 1000))))
            partition = stats[0] if stats else {"pending_count": 0, "pending_failed_count": 0,
                "pending_backoff_count": 0, "pending_leased_count": 0}
            partition.pop("_id", None)
            partition["oldest_next_fetch_at"] = iso(partition.get("oldest_next_fetch_at"))
            index = indexes.get("country_identity", {})
            partition.update(media_type=media, full_unique_identity=bool(index.get("unique")
                and index.get("key") == [("tmdb_id", 1), ("country_code", 1)]
                and not index.get("partialFilterExpression") and not index.get("sparse")))
            result["partitions"].append(partition)
    except Exception:
        result.update(complete=False, collection_error="identity_repair_metrics_unavailable")
    return result


def collect_publication(db: Any, jobs: list[dict], now: datetime) -> dict:
    from f.monitoring.backlog_health import PUBLICATION_GRACE_SECONDS
    from f.priority.queue import COOLDOWN_MS

    stamp = int(now.timestamp() * 1000)
    cutoff = stamp - PUBLICATION_GRACE_SECONDS * 1000
    eligible = """demand > acknowledged_demand
        AND (last_success_at IS NULL OR CAST(last_success_at AS BIGINT) < ?)
        AND (lease_expires_at IS NULL OR CAST(lease_expires_at AS BIGINT) <= ?)
        AND CAST(updated_at AS BIGINT) <= ?"""
    rows = db.select(f"""SELECT COUNT(*) AS titles,
        COALESCE(SUM(demand - acknowledged_demand), 0) AS outstanding,
        MIN(CAST(updated_at AS BIGINT)) AS oldest
        FROM crawl_priority WHERE {eligible}""",
        (stamp - COOLDOWN_MS, stamp, cutoff))
    ack = db.select("""SELECT MAX(CAST(last_success_at AS BIGINT)) AS latest,
        COALESCE(SUM(CASE WHEN demand > acknowledged_demand AND
            (last_success_at IS NULL OR CAST(last_success_at AS BIGINT) < ?)
            THEN 1 ELSE 0 END), 0) AS pending_titles,
        COALESCE(SUM(CASE WHEN demand > acknowledged_demand AND
            (last_success_at IS NULL OR CAST(last_success_at AS BIGINT) < ?)
            THEN demand - acknowledged_demand ELSE 0 END), 0) AS pending_demand
        FROM crawl_priority""", (stamp - COOLDOWN_MS, stamp - COOLDOWN_MS))
    result = {"complete": True, "overdue_title_count": rows[0]["titles"],
              "outstanding_demand": ack[0]["pending_demand"],
              "overdue_demand": rows[0]["outstanding"],
              "oldest_unacknowledged_at": iso(rows[0]["oldest"]),
              "last_acknowledged_at": iso(ack[0]["latest"]),
              "unacknowledged_title_count": ack[0]["pending_titles"],
              "age_basis": "last_queue_update_lower_bound", "excluded": {},
              "failure_unacknowledged": False}
    failures = [job["publication_failure"] for job in jobs
                if isinstance(job.get("publication_failure"), dict)]
    failures.sort(key=lambda failure: failure.get("completed_at") or "", reverse=True)
    target_reads = 0
    for failure in failures:
        pending = False
        if len(failure.get("targets", [])) >= 100:
            result["complete"] = False
            result["correlation_incomplete"] = True
        for target in failure.get("targets", [])[:100]:
            if target_reads >= 100:
                result["complete"] = False
                result["correlation_incomplete"] = True
                break
            claimed = target.get("claimed_demand")
            if not isinstance(claimed, int) or isinstance(claimed, bool) or claimed <= 0:
                continue
            target_reads += 1
            current = db.select("""SELECT acknowledged_demand FROM crawl_priority
                WHERE media_type = ? AND tmdb_id = ?""",
                (target["media_type"], target["tmdb_id"]))
            if current and current[0]["acknowledged_demand"] < claimed:
                pending = True
                break
        if pending or "last_failure_classification" not in result:
            result.update(last_failure_classification=failure.get("classification"),
                          last_failure_at=failure.get("completed_at"),
                          latest_job_id=failure.get("job_id"),
                          failure_unacknowledged=pending,
                          publication_attempt_count=failure.get("attempts"),
                          publication_retry_count=failure.get("retries"),
                          source_success_at=failure.get("source_success_at"))
        if pending:
            break
    return result


def collect_backlogs(store: Any, jobs: list[dict], now: datetime,
                     remaining_seconds: float) -> dict:
    import wmill
    from pymongo import MongoClient

    start = monotonic()
    country: dict[str, Any] = {"complete": False}
    publication: dict[str, Any] = {"complete": False}
    if remaining_seconds <= 0:
        return {"country": country, "publication": publication}
    try:
        publication = collect_publication(store.db, jobs, now)
    except Exception:
        publication["collection_errors"] = ["priority_query_unavailable"]
    client = None
    try:
        get = wmill.get_variable
        name = get("u/Alp/MONGODB_DB")
        client = MongoClient(
            get("u/Alp/MONGODB_HOSTS").split(","),
            username=get("u/Alp/MONGODB_USER"), password=get("u/Alp/MONGODB_PASS"),
            replicaSet=get("u/Alp/MONGODB_RS"), authSource=name,
            serverSelectionTimeoutMS=5000, connectTimeoutMS=5000,
            socketTimeoutMS=45000, tz_aware=True,
        )
        budget = remaining_seconds - (monotonic() - start)
        repairs = collect_identity_repairs(client[name], now, budget_seconds=min(10, max(0, budget)))
        budget = remaining_seconds - (monotonic() - start)
        if budget > 0:
            country = collect_countries(client[name], now, budget_seconds=budget)
        country["identity_repair"] = repairs
    except Exception:
        country["collection_errors"] = ["country_connection_unavailable"]
    finally:
        if client is not None:
            client.close()
    recent = [job for job in jobs if job.get("completed_at") and
              datetime.fromisoformat(job["completed_at"]) >= now - timedelta(days=1)]
    for snapshot in (country, publication):
        snapshot["source_failure_count"] = sum(job.get("source_failure_count", 0) for job in recent)
        snapshot["external_failure_count"] = sum(job.get("tolerable_external_failure_count", 0) for job in recent)
        successes = [job["completed_at"] for job in recent if job.get("source_success_count", 0)]
        if snapshot is country:
            snapshot["source_success_at"] = max(successes) if successes else None
    if not country.get("latest_job_id"):
        sources = [job for job in recent if job.get("source_failure_count", 0) or job.get("source_success_count", 0)]
        if sources:
            country["latest_job_id"] = max(sources, key=lambda job: job["completed_at"])["id"]
    for partition in country.get("partitions", []):
        partition["latest_job_id"] = country.get("latest_job_id")
    return {"country": country, "publication": publication}
