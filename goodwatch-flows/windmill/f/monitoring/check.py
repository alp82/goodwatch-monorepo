"""Bounded, read-only execution collection and durable health assessment."""
# extra_requirements:
# croniter==6.2.4
# wmill==1.564.0

from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from time import monotonic
from typing import Any, Callable
from urllib.parse import urlencode

from f.monitoring.collection import observe_execution
from f.monitoring.backlog_health import assess_backlogs
from f.monitoring.health import assess_pipeline, schedule_cadence, timestamp
from f.monitoring.incidents import record_incident

OBSERVATION_START = datetime(2026, 9, 9, 21, 1, 10, tzinfo=timezone.utc)
DAILY_PATHS = {
    "f/sync/populate_crate",
    "f/dna/initialize_dna",
    "f/tmdb_web/tmdb_init_providers",
    "f/tvtropes_web/tvtropes_init_ratings",
    "f/rotten_web/rotten_tomatoes_init_ratings",
    "f/metacritic_web/metacritic_init_ratings",
    "f/imdb_web/imdb_init_ratings",
    "f/tmdb_api/tmdb_init_details",
}
RUNTIME_HOURS = {
    "f/sync/copy/vector_data": 2,
    "f/sync/copy/tvtropes": 2,
    "f/sync/copy/all_ratings": 2,
    "f/sync/copy/dna_data": 2,
    "f/sync/copy/tmdb_streaming": 2,
    "f/sync/copy/tmdb_details": 2,
    "f/sync/copy/tmdb_daily": 2,
    "f/sync/populate_crate": 12,
    "f/dna/initialize_dna": 6,
    "f/tmdb_web/tmdb_init_providers": 6,
    "f/priority/crawl_all": 2,
    "f/tmdb_web/tmdb_crawl_providers": 2,
    "f/tvtropes_web/tvtropes_crawl_tags": 6,
    "f/metacritic_web/metacritic_crawl_ratings": 6,
    "f/imdb_web/imdb_crawl_ratings": 6,
    "f/utils/visit_goodwatch_schedule": 0.1,
    "f/tvtropes_web/tvtropes_init_ratings": 6,
    "f/rotten_web/rotten_tomatoes_init_ratings": 6,
    "f/metacritic_web/metacritic_init_ratings": 6,
    "f/imdb_web/imdb_init_ratings": 6,
    "f/tmdb_daily/tmdb_extract_daily_dump_data": 6,
    "f/tmdb_api/tmdb_init_details": 6,
    "f/tmdb_daily/tmdb_check_daily_dump_availability": 2,
}


def pipeline_thresholds(
    schedule: dict[str, Any], now: datetime
) -> dict[str, Any]:
    try:
        cadence = schedule_cadence(schedule, now)
    except (ValueError, KeyError):
        cadence = 86400
    runtime = RUNTIME_HOURS.get(schedule["path"], 6) * 3600
    return {
        "runtime_seconds": runtime,
        "grace_seconds": max(300, min(3600, cadence / 2)),
        "progress_seconds": max(runtime * 2, cadence * 3),
        "consecutive_failures": 3,
    }


def needs_refresh(job: dict[str, Any]) -> bool:
    return bool(
        job.get("observation_version") != 2
        or not job.get("parent_resolved")
        or job.get("running")
        or job.get("success") is None
        or job.get("evidence_incomplete")
        or job.get("unresolved_descendants")
        or job.get("missing_descendants")
    )


def poll(
    api: Callable[[str], Any],
    store: Any,
    now: datetime,
    notify: bool = True,
    webhook_url: str | None = None,
    *,
    max_resolutions: int = 800,
    budget_seconds: float = 220,
    clock: Callable[[], float] = monotonic,
    backlog_collector: Callable[
        [Any, list[dict[str, Any]], datetime, float], dict[str, Any]
    ]
    | None = None,
) -> dict[str, Any]:
    deadline = clock() + budget_seconds
    collection_deadline = deadline - 70 if backlog_collector else deadline
    store.initialize()
    if not store.acquire():
        return {"status": "overlap", "reason": "checker_lease_busy"}
    infrastructure = {"windmill_api": "ok", "cratedb": "ok"}

    def bounded_api(path: str) -> Any:
        if clock() >= collection_deadline:
            raise TimeoutError("Monitoring collection budget exhausted")
        return api(path)

    try:
        try:
            schedules = bounded_api("schedules/list")
        except Exception:
            result = {
                "status": "infrastructure_failure",
                "observed_at": now.isoformat(),
                "infrastructure": {
                    "windmill_api": "unavailable",
                    "cratedb": "ok",
                },
                "workflow_status_counts": {"unknown": len(DAILY_PATHS)},
                "pipelines": [
                    {"path": path, "status": "unknown"}
                    for path in sorted(DAILY_PATHS)
                ],
            }
            store.put("latest-check-failure", "report", "", result)
            return result
        schedules = [
            s
            for s in schedules
            if s.get("enabled")
            and s.get("script_path") != "f/monitoring/check"
            and s["path"] != "f/monitoring/check"
        ]
        queue_failed = False
        try:
            queued = bounded_api(
                "jobs/queue/list?has_null_parent=true&per_page=1000"
            )
            queue_failed = len(queued) >= 1000
        except Exception:
            queued = []
            queue_failed = True
            infrastructure["windmill_api"] = "degraded"
        plans: dict[str, dict[str, Any]] = {}
        tasks: list[tuple[int, str, str]] = []
        for schedule in schedules:
            path = schedule["path"]
            ledger = store.jobs(path)
            failed = queue_failed
            try:
                identifiers = bounded_api(
                    "jobs/list_filtered_uuids?"
                    + urlencode(
                        {
                            "has_null_parent": "true",
                            "completed_after": OBSERVATION_START.isoformat(),
                            "schedule_path": path,
                        }
                    )
                )
                if not isinstance(identifiers, list):
                    raise ValueError("Invalid inventory response")
                failed |= len(identifiers) > 100000
                identifiers = set(str(value) for value in identifiers[:100000])
            except Exception:
                identifiers = set()
                failed = True
                infrastructure["windmill_api"] = "degraded"
            queue_ids = {
                str(j["id"])
                for j in queued
                if j.get("schedule_path") == path
                and (
                    j.get("running")
                    or j.get("started_at")
                    or (timestamp(j.get("scheduled_for")) or now) <= now
                )
            }
            identifiers.update(queue_ids)
            plans[path] = {
                "schedule": schedule,
                "jobs": ledger,
                "ids": identifiers,
                "incomplete": failed,
            }
            for identity in identifiers | set(ledger):
                old = ledger.get(identity)
                if old is None or needs_refresh(old):
                    urgent = identity in queue_ids or (
                        old and needs_refresh(old)
                    )
                    priority = 0 if urgent else 1 if path in DAILY_PATHS else 2
                    tasks.append((priority, identity, path))
        tasks.sort(key=lambda item: item[1], reverse=True)
        tasks.sort(key=lambda item: item[0])
        resolved = 0
        with ThreadPoolExecutor(max_workers=8) as executor:
            for offset in range(0, min(len(tasks), max_resolutions), 8):
                if clock() >= collection_deadline:
                    break
                chunk = tasks[offset : min(offset + 8, max_resolutions)]
                futures = [
                    (
                        path,
                        executor.submit(
                            observe_execution, bounded_api, identity, 50
                        ),
                    )
                    for _, identity, path in chunk
                ]
                batches: dict[str, list[dict[str, Any]]] = {}
                for path, future in futures:
                    try:
                        observed = future.result()
                        batches.setdefault(path, []).append(observed)
                        plans[path]["jobs"][observed["id"]] = observed
                        resolved += 1
                    except Exception:
                        plans[path]["incomplete"] = True
                        infrastructure["windmill_api"] = "degraded"
                for path, batch in batches.items():
                    store.save_jobs(path, batch)
        backlog_result = None
        if backlog_collector:
            try:
                remaining = min(60, max(0, deadline - clock() - 10))
                if remaining <= 0:
                    raise TimeoutError("No backlog collection budget remains")
                normalized = {
                    job["id"]: job
                    for plan in plans.values()
                    for job in plan["jobs"].values()
                }
                snapshots = backlog_collector(
                    store, list(normalized.values()), now, remaining
                )
                infrastructure["backlogs"] = (
                    "ok"
                    if all(
                        snapshots[name].get("complete")
                        for name in ["country", "publication"]
                    )
                    else "degraded"
                )
            except Exception:
                snapshots = {
                    "country": {"complete": False},
                    "publication": {"complete": False},
                }
                infrastructure["backlogs"] = "degraded"
            backlog_result = assess_backlogs(
                snapshots["country"],
                snapshots["publication"],
                store.get("backlog-progress"),
                now,
            )
            store.put(
                "backlog-progress", "progress", "", backlog_result["progress"]
            )
        reports = []
        for path, plan in plans.items():
            ledger = plan["jobs"]
            uninspected = len(plan["ids"] - set(ledger))
            unresolved = sum(
                not job.get("parent_resolved")
                or bool(
                    job.get("evidence_incomplete")
                    or job.get("unresolved_descendants")
                )
                for job in ledger.values()
            )
            incomplete = bool(plan["incomplete"] or uninspected or unresolved)
            schedule = {**plan["schedule"], "history_incomplete": incomplete}
            report = assess_pipeline(
                schedule,
                list(ledger.values()),
                now,
                OBSERVATION_START,
                pipeline_thresholds(schedule, now),
            )
            report.update(
                inventory_candidate_count=len(plan["ids"]),
                uninspected_count=uninspected,
                unresolved_count=unresolved,
                history_incomplete=incomplete,
            )
            if path not in DAILY_PATHS:
                report["coverage_entries_omitted"] = max(
                    0, len(report["coverage"]) - 20
                )
                report["coverage"] = report["coverage"][-20:]
            delivery = record_incident(
                store,
                report,
                now,
                webhook_url if notify and clock() < deadline else None,
            )
            report["notification"] = delivery
            reports.append(report)
        workflow_counts = dict(Counter(r["status"] for r in reports))
        if backlog_result:
            for report in backlog_result["reports"]:
                report["notification"] = record_incident(
                    store,
                    report,
                    now,
                    webhook_url if notify and clock() < deadline else None,
                )
                reports.append(report)
        result = {
            "status": "completed",
            "observed_at": now.isoformat(),
            "infrastructure": infrastructure,
            "workflow_status_counts": workflow_counts,
            "backlog_status_counts": dict(
                Counter(r["status"] for r in backlog_result["reports"])
            )
            if backlog_result
            else {},
            "pipelines": reports,
            "resolved_this_poll": resolved,
            "daily_paths_present": sorted(DAILY_PATHS & set(plans)),
            "daily_paths_missing": sorted(DAILY_PATHS - set(plans)),
            "notification_status": "disabled"
            if not notify
            else "configured"
            if webhook_url
            else "unconfigured",
        }
        store.put("latest-report", "report", "", result)
        return result
    finally:
        store.release()


def main(notify: bool = True) -> dict[str, Any]:
    import wmill
    import httpx
    from f.monitoring.store import MonitoringStore
    from f.monitoring.backlog_collection import collect_backlogs

    client = wmill.Windmill(workspace="goodwatch").client

    def api(path: str) -> Any:
        try:
            response = client.get("/w/goodwatch/" + path, timeout=10)
        except httpx.HTTPError:
            raise RuntimeError("Windmill read transport failed") from None
        if response.status_code == 404:
            raise FileNotFoundError("Windmill resource unavailable")
        if response.status_code != 200:
            raise RuntimeError(
                f"Windmill read failed: HTTP {response.status_code}"
            )
        return response.json()

    webhook = None
    if notify:
        try:
            webhook = api(
                "variables/get_value/f/monitoring/discord_webhook_url"
            )
        except Exception:
            pass
    return poll(
        api,
        MonitoringStore(),
        datetime.now(timezone.utc),
        notify,
        webhook,
        backlog_collector=collect_backlogs,
    )
