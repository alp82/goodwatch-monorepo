"""Bounded, read-only execution collection and durable health assessment."""
# extra_requirements:
# croniter==6.2.4
# wmill==1.564.0

from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from time import monotonic
from typing import Any, Callable
from urllib.parse import urlencode

from f.monitoring.collection import observe_execution
from f.monitoring.backlog_health import assess_backlogs
from f.monitoring.cluster_health import assess_cluster
from f.monitoring.health import (assess_pipeline, assess_upstream, apply_upstream_cause,
                                 empty_history, fold_history, schedule_cadence,
                                 timestamp)
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
    "f/imdb_datasets/ingest",
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
    "f/sync/copy/tmdb_episodes": 1,
    "f/tmdb_api/tmdb_fetch_episodes_from_api": 1,
    "f/tmdb_api/tmdb_fetch_episodes_from_api/changes": 1,
    "f/tmdb_api/tmdb_fetch_details_from_api/awaited": 0.25,
    "f/sync/copy/title_snapshot": 1,
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
    "f/imdb_datasets/ingest": 1,
    "f/tmdb_daily/tmdb_extract_daily_dump_data": 6,
    "f/tmdb_api/tmdb_init_details": 6,
    "f/tmdb_daily/tmdb_check_daily_dump_availability": 2,
    "f/monitoring/backup_check": 0.25,
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


# Each schedule's newest runs are resolved before any older work.
NEWEST_RUNS = 3
# Rows that stay incomplete (more descendants than the inspection limit,
# descendants Windmill no longer has) once took the whole budget of every
# poll. They are now refreshed this many per poll, least recently first.
STALE_REFRESH_LIMIT = 40


# Complete rows of frequent schedules are folded into a stored history
# (`history:<path>`) once they're older than slot coverage looks back (48 hours),
# so a poll reads two days of rows instead of every row since 2026-09-09.
FOLD_AFTER = timedelta(hours=49)
HISTORY_VERSION = 1


def boundary_id(at: datetime) -> str:
    """The smallest Windmill job id created at `at`.

    Windmill job ids are ULIDs: the first 48 bits are the creation time in
    milliseconds, so ids sort by creation time.
    """
    stamp = f"{int(at.timestamp() * 1000):012x}"
    return f"{stamp[:8]}-{stamp[8:]}-0000-0000-000000000000"


def folds_history(schedule: dict[str, Any], now: datetime) -> bool:
    # Daily schedules keep slot coverage since the observation start, so they
    # keep every row. They have about one row a day.
    try:
        return schedule_cadence(schedule, now) < 23 * 3600
    except (ValueError, KeyError):
        return False


def is_unresolved(job: dict[str, Any]) -> bool:
    return bool(
        not job.get("parent_resolved")
        or job.get("evidence_incomplete")
        or job.get("unresolved_descendants")
    )


def load_ledger(
    store: Any, schedule: dict[str, Any], now: datetime
) -> tuple[dict[str, dict[str, Any]], dict[str, Any] | None]:
    """The rows a poll reads, and the schedule's stored history."""
    path = schedule["path"]
    history = store.get("history:" + path)
    if not history or history.get("version") != HISTORY_VERSION:
        return store.jobs(path), None
    # A schedule whose next interval is a day or more (a weekday cron over the
    # weekend) gets slot coverage since the observation start, so this poll
    # reads every row and assesses them without the history.
    if not folds_history(schedule, now):
        return store.jobs(path), history
    # Below the boundary a poll only saves rows of pending or unobserved ids,
    # so these reads also find rows saved by a poll that died before it wrote
    # the history.
    return store.recent_jobs(
        path, history["boundary"],
        sorted(set(history["pending"]) | set(history["unobserved"])),
    ), history


def is_folded(identity: str, history: dict[str, Any] | None) -> bool:
    """Whether a run's row was folded into the history."""
    return bool(
        history
        and identity < history["boundary"]
        and identity not in history["pending"]
        and identity not in history["unobserved"]
    )


def is_gone(
    identity: str, job: dict[str, Any], plan: dict[str, Any], now: datetime
) -> bool:
    """An incomplete row of a run Windmill no longer has, finished before slot
    coverage starts. Refreshing it could only replace it with a lookup error,
    so it's kept as observed."""
    end = timestamp(job.get("completed_at") or job.get("started_at"))
    return bool(
        plan["oldest_listed"]
        and identity < plan["oldest_listed"]
        and identity not in plan["ids"]
        and identity not in plan["queued"]
        and not job.get("running")
        and (job.get("success") is not None or job.get("lookup_error"))
        and (end is None or end < now - FOLD_AFTER)
    )


def fold_ledger(plan: dict[str, Any], now: datetime) -> dict[str, Any]:
    """Move complete rows older than FOLD_AFTER from the plan into its history.

    Every id below the history's boundary is folded, `pending` (an incomplete
    or recent row, read by id each poll) or `unobserved` (a listed run never
    resolved, read by id in case a poll saved it and died). A row Windmill no
    longer lists (it keeps about 14 days) is folded even when incomplete.
    """
    stored = plan["history"]
    history = stored or {
        "version": HISTORY_VERSION,
        "boundary": "",
        "pending": [],
        "unobserved": [],
        "history": empty_history(),
        "unresolved_count": 0,
        "publication_failures": [],
    }
    ledger = plan["jobs"]
    # Rows this poll has: read, or saved after being resolved.
    have = set(ledger)
    if plan["inventory_ok"]:
        boundary = max(history["boundary"], boundary_id(now - FOLD_AFTER))
        # Queued runs not yet due count too: their ids can be older than the
        # boundary by the time they run.
        unobserved = [
            identity for identity in plan["ids"] | plan["queued"]
            if identity < boundary and identity not in have
            and not is_folded(identity, stored)
        ]
    else:
        # Without the list of runs, runs newer than the boundary that were
        # never observed are unknown, so the boundary stays.
        boundary = history["boundary"]
        unobserved = []
    # One a poll saved and died, that this read missed, is still read by id.
    unobserved = sorted(
        set(unobserved) | {i for i in history["unobserved"] if i not in have}
    )
    # A pending row a read missed (not yet visible) stays pending.
    pending = [i for i in history["pending"] if i not in have]
    cutoff = now - FOLD_AFTER
    for identity, job in sorted(ledger.items()):
        if identity >= boundary:
            break
        end = timestamp(job.get("completed_at") or job.get("started_at"))
        complete = not needs_refresh(job) and (end is None or end < cutoff)
        if not (complete or is_gone(identity, job, plan, now)):
            pending.append(identity)
            continue
        fold_history(history["history"], [job], now, OBSERVATION_START)
        history["unresolved_count"] += is_unresolved(job)
        if isinstance(job.get("publication_failure"), dict):
            history["publication_failures"].append(job["publication_failure"])
        del ledger[identity]
        plan["folded_ids"].add(identity)
    history.update(
        boundary=boundary, pending=sorted(pending), unobserved=unobserved
    )
    plan["history"] = history
    return history


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
    cluster_collector: Callable[[Any, float], dict[str, Any]] | None = None,
) -> dict[str, Any]:
    started_clock = clock()
    deadline = started_clock + budget_seconds
    collection_deadline = (
        deadline
        - (70 if backlog_collector else 0)
        - (20 if cluster_collector else 0)
    )
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
        in_flight: list[tuple[str, str]] = []
        newest: list[tuple[str, str]] = []
        stale: list[tuple[str, str, str]] = []
        daily: list[tuple[str, str]] = []
        backfill: list[tuple[str, str]] = []
        for schedule in schedules:
            path = schedule["path"]
            ledger, stored = load_ledger(store, schedule, now)
            folds = folds_history(schedule, now)
            # Assessed with the history only when the ledger leaves out its rows.
            history = stored if folds else None
            failed = queue_failed
            inventory_ok = False
            oldest_listed = None
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
                # Runs still queued or running are listed only by the queue.
                inventory_ok = len(identifiers) < 100000 and not queue_failed
                if identifiers and inventory_ok:
                    oldest_listed = min(identifiers)
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
            # Listed runs that were folded away are complete.
            folded_ids = {
                identity for identity in identifiers
                if is_folded(identity, stored) and identity not in ledger
            }
            plans[path] = {
                "schedule": schedule,
                "jobs": ledger,
                "ids": identifiers,
                "incomplete": failed,
                "history": history,
                "folded_ids": folded_ids,
                "inventory_ok": inventory_ok,
                "oldest_listed": oldest_listed,
                "queued": {
                    str(j["id"]) for j in queued
                    if j.get("schedule_path") == path
                },
            }
            # Windmill job ids sort by creation time.
            ordered = sorted(identifiers | set(ledger), reverse=True)
            latest = set(ordered[:NEWEST_RUNS])
            for identity in ordered:
                old = ledger.get(identity)
                # Folded rows don't change, also when this poll reads them all.
                if is_folded(identity, stored):
                    continue
                if old is not None and not needs_refresh(old):
                    continue
                if (old is not None and folds
                        and is_gone(identity, old, plans[path], now)):
                    continue
                if identity in queue_ids or (
                    old
                    and (old.get("running") or old.get("success") is None)
                    # A job Windmill no longer lists can't be looked up again.
                    and (not old.get("lookup_error") or identity in identifiers)
                ):
                    in_flight.append((identity, path))
                elif identity in latest:
                    newest.append((identity, path))
                elif old is not None:
                    stale.append((old.get("refreshed_at") or "", identity, path))
                elif path in DAILY_PATHS:
                    daily.append((identity, path))
                else:
                    backfill.append((identity, path))
        stale.sort(key=lambda item: item[1], reverse=True)
        stale.sort(key=lambda item: item[0])
        tasks = [
            task
            for tier in [
                sorted(in_flight, reverse=True),
                sorted(newest, reverse=True),
                [(identity, path) for _, identity, path in stale]
                [:STALE_REFRESH_LIMIT],
                sorted(daily, reverse=True),
                sorted(backfill, reverse=True),
            ]
            for task in tier
        ]
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
                    for identity, path in chunk
                ]
                batches: dict[str, list[dict[str, Any]]] = {}
                for path, future in futures:
                    try:
                        observed = future.result()
                        observed["refreshed_at"] = now.isoformat()
                        batches.setdefault(path, []).append(observed)
                        plans[path]["jobs"][observed["id"]] = observed
                        resolved += 1
                    except Exception:
                        plans[path]["incomplete"] = True
                        infrastructure["windmill_api"] = "degraded"
                for path, batch in batches.items():
                    store.save_jobs(path, batch)
        # After the poll's last row write. If the poll dies before this, the
        # next poll reads its rows by id (pending, unobserved) or by boundary.
        for path, plan in plans.items():
            if folds_history(plan["schedule"], now):
                history = fold_ledger(plan, now)
                store.put("history:" + path, "history", path, history)
        backlog_result = None
        backlog_now = now
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
                folded_failures = [
                    {"publication_failure": failure}
                    for plan in plans.values() if plan["history"]
                    for failure in plan["history"]["publication_failures"]
                ]
                snapshots = backlog_collector(
                    store, list(normalized.values()) + folded_failures, now,
                    remaining,
                )
                infrastructure["backlogs"] = (
                    "ok"
                    if all(
                        snapshots[name].get("complete")
                        for name in ["country", "publication"]
                    ) and snapshots['country'].get('availability', {'complete': True}).get('complete') is True
                    else "degraded"
                )
            except Exception:
                snapshots = {
                    "country": {"complete": False},
                    "publication": {"complete": False},
                }
                infrastructure["backlogs"] = "degraded"
            backlog_now = now + timedelta(
                seconds=max(0, clock() - started_clock)
            )
            backlog_result = assess_backlogs(
                snapshots["country"],
                snapshots["publication"],
                store.get("backlog-progress"),
                backlog_now,
            )
            store.put(
                "backlog-progress", "progress", "", backlog_result["progress"]
            )
        cluster_result = None
        if cluster_collector:
            try:
                remaining = max(0, deadline - clock() - 5)
                if remaining <= 0:
                    raise TimeoutError("No cluster collection budget remains")
                cluster_snapshot = cluster_collector(store, remaining)
            except Exception:
                cluster_snapshot = {"complete": False}
            infrastructure["crate_cluster"] = (
                "ok" if cluster_snapshot.get("complete") is True else "degraded"
            )
            cluster_result = assess_cluster(
                cluster_snapshot, store.get("crate-cluster-progress"), now
            )
            store.put(
                "crate-cluster-progress",
                "progress",
                "",
                cluster_result["progress"],
            )
        upstream_report = assess_upstream(snapshots["country"], backlog_now) if backlog_result else None
        reports = []
        for path, plan in plans.items():
            ledger = plan["jobs"]
            history = plan["history"]
            uninspected = len(plan["ids"] - set(ledger) - plan["folded_ids"])
            unresolved = sum(is_unresolved(job) for job in ledger.values()) + (
                history["unresolved_count"] if history else 0
            )
            incomplete = bool(plan["incomplete"] or uninspected or unresolved)
            schedule = {**plan["schedule"], "history_incomplete": incomplete}
            report = assess_pipeline(
                schedule,
                list(ledger.values()),
                now,
                OBSERVATION_START,
                pipeline_thresholds(schedule, now),
                history["history"] if history else None,
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
            if upstream_report:
                apply_upstream_cause(report, upstream_report)
            delivery = record_incident(
                store,
                report,
                now,
                webhook_url if notify and clock() < deadline else None,
            )
            report["notification"] = delivery
            reports.append(report)
        workflow_counts = dict(Counter(r["status"] for r in reports))
        if upstream_report:
            upstream_report["notification"] = record_incident(
                store, upstream_report, backlog_now,
                webhook_url if notify and clock() < deadline else None)
            reports.append(upstream_report)
        if backlog_result:
            for report in backlog_result["reports"]:
                report["observed_at"] = backlog_now.isoformat()
                report["notification"] = record_incident(
                    store,
                    report,
                    backlog_now,
                    webhook_url if notify and clock() < deadline else None,
                )
                reports.append(report)
        if cluster_result:
            for report in cluster_result["reports"]:
                report["observed_at"] = now.isoformat()
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
            "backlog_observed_at": backlog_now.isoformat()
            if backlog_result
            else None,
            "infrastructure": infrastructure,
            "workflow_status_counts": workflow_counts,
            "backlog_status_counts": dict(
                Counter(r["status"] for r in backlog_result["reports"])
            )
            if backlog_result
            else {},
            "cluster_status_counts": dict(
                Counter(r["status"] for r in cluster_result["reports"])
            )
            if cluster_result
            else {},
            "pipelines": reports,
            "provider_identity_repair": snapshots["country"].get("identity_repair")
            if backlog_result else None,
            "resolved_this_poll": resolved,
            "resolution_candidates": {
                "in_flight": len(in_flight),
                "newest": len(newest),
                "stale_refresh": len(stale),
                "stale_refresh_limit": STALE_REFRESH_LIMIT,
                "daily_backfill": len(daily),
                "backfill": len(backfill),
            },
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
    from f.monitoring.cluster_collection import collect_cluster

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
        cluster_collector=lambda store, remaining: collect_cluster(store.db),
    )
