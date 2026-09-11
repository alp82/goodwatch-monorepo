"""Pure assessment of resolved Windmill executions; never performs recovery."""

from bisect import bisect_left, bisect_right
from collections import Counter
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from croniter import croniter

# extra_requirements:
# croniter==6.2.4


def classify_outcome(job: dict[str, Any]) -> str:
    if job.get("canceled"):
        return "cancelled"
    if job.get("running"):
        return "running"
    if job.get("is_skipped") or job.get("outcome") == "overlap":
        return "overlap"
    if job.get("success") is False or job.get("outcome") == "failure":
        return "failure"
    if job.get("success") is True:
        if job.get("outcome") in {"useful", "no_work", "external_deferred"}:
            return job["outcome"]
        return "success_unknown"
    return "unknown"


def timestamp(value: Any) -> datetime | None:
    if value is None:
        return None
    parsed = (
        value
        if isinstance(value, datetime)
        else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    )
    if parsed.tzinfo is None:
        raise ValueError("Workflow timestamps must include a timezone")
    return parsed.astimezone(timezone.utc)


def schedule_cadence(schedule: dict[str, Any], now: datetime) -> float:
    expression = schedule["schedule"]
    iterator = croniter(
        expression,
        now.astimezone(ZoneInfo(schedule["timezone"])),
        second_at_beginning=len(expression.split()) > 5,
    )
    first = iterator.get_next(datetime)
    return (iterator.get_next(datetime) - first).total_seconds()


def scheduled_occurrences(
    schedule: dict[str, Any], start: datetime, now: datetime
) -> tuple[list[datetime], datetime | None]:
    expression = schedule["schedule"]
    fields = len(expression.split())
    if fields not in {5, 6, 7}:
        raise ValueError("Expected five, six or seven cron fields")
    iterator = croniter(
        expression,
        (start - timedelta(microseconds=1)).astimezone(
            ZoneInfo(schedule["timezone"])
        ),
        second_at_beginning=fields > 5,
    )
    due = []
    for _ in range(10000):
        value = iterator.get_next(datetime).astimezone(timezone.utc)
        if value > now:
            return due, value
        due.append(value)
    raise ValueError("Coverage window exceeds bounded cron occurrence limit")


def assess_pipeline(
    schedule: dict[str, Any],
    jobs: list[dict[str, Any]],
    now: datetime,
    observation_start: datetime,
    thresholds: dict[str, Any],
) -> dict[str, Any]:
    unique = {}
    for job in jobs:
        previous = unique.get(str(job["id"]))
        # Prefer a resolved completion over an earlier queue snapshot.
        if previous is None or (
            bool(job.get("parent_resolved")),
            bool(job.get("completed_at")),
        ) > (
            bool(previous.get("parent_resolved")),
            bool(previous.get("completed_at")),
        ):
            unique[str(job["id"])] = job
    relevant = []
    for job in unique.values():
        start = timestamp(job.get("started_at"))
        end = timestamp(job.get("completed_at"))
        if (end and observation_start <= end <= now) or (
            start
            and start <= now
            and (job.get("running") or start >= observation_start)
        ):
            relevant.append(job)
    unknown = sum(not job.get("parent_resolved") for job in relevant)
    roots = [
        job
        for job in relevant
        if job.get("parent_resolved") and job.get("parent_job") is None
    ]
    roots.sort(
        key=lambda job: (
            timestamp(job.get("completed_at") or job.get("started_at"))
            or observation_start
        )
    )
    outcomes = Counter(classify_outcome(job) for job in roots)
    useful = [job for job in roots if classify_outcome(job) == "useful"]
    cron_error = False
    coverage_start = observation_start
    try:
        cadence = schedule_cadence(schedule, now)
        # Daily local schedules can be 23 hours apart across DST.
        if cadence < 23 * 3600:
            coverage_start = max(observation_start, now - timedelta(hours=48))
        due, next_due = scheduled_occurrences(schedule, coverage_start, now)
    except (ValueError, KeyError):
        due, next_due = [], None
        cron_error = True
    causes: list[str] = []
    grace = float(thresholds["grace_seconds"])
    runtime = float(thresholds["runtime_seconds"])
    material_count = sum(
        len(job.get("material_child_failures", [])) for job in roots
    )
    last_useful = (
        timestamp(
            useful[-1].get("completed_at") or useful[-1].get("started_at")
        )
        if useful
        else None
    )
    for job in roots:
        started = timestamp(job.get("started_at"))
        age = (now - started).total_seconds() if started else 0
        if job.get("running") and age > runtime:
            causes.append("excessive_runtime")
        if job.get("missing_descendants") and (
            not job.get("running") or age > grace
        ):
            if (
                job.get("running")
                or not last_useful
                or (timestamp(job.get("completed_at")) or now) >= last_useful
            ):
                causes.append("missing_descendants")
    meaningful = [
        job
        for job in roots
        if classify_outcome(job)
        not in {
            "overlap",
            "no_work",
            "external_deferred",
            "running",
            "cancelled",
        }
    ]
    if meaningful and meaningful[-1].get("material_child_failures"):
        causes.append("material_child_failures")
    if meaningful and meaningful[-1].get("material_outcome_failures"):
        causes.append("material_outcome_failures")
    consecutive = 0
    for job in reversed(meaningful):
        if (
            classify_outcome(job) != "failure"
            and not job.get("material_child_failures")
            and not job.get("material_outcome_failures")
        ):
            break
        consecutive += 1
    if consecutive >= int(thresholds["consecutive_failures"]):
        causes.append("consecutive_failures")
    matched: list[set[str]] = [set() for _ in due]
    for job in roots:
        scheduled = timestamp(
            job.get("scheduled_for") or job.get("started_at")
        )
        actual_start = timestamp(job.get("started_at"))
        end = now if job.get("running") else timestamp(job.get("completed_at"))
        if scheduled:
            slot = bisect_right(due, scheduled) - 1
            if slot >= 0 and (next_due is None or scheduled < next_due):
                matched[slot].add(str(job["id"]))
        if actual_start and end:
            first = bisect_left(due, actual_start)
            last = bisect_right(due, end)
            for slot in range(first, last):
                matched[slot].add(str(job["id"]))
    coverage = []
    for index, occurrence in enumerate(due):
        matching = sorted(matched[index])
        overdue = (now - occurrence).total_seconds() > grace
        coverage.append(
            {
                "due_at": occurrence.isoformat(),
                "root_ids": matching,
                "state": "observed"
                if matching
                else (
                    "unknown"
                    if unknown or schedule.get("history_incomplete")
                    else "missing"
                    if overdue
                    else "pending"
                ),
            }
        )
    missing = sum(item["state"] == "missing" for item in coverage)
    # Historical coverage gaps remain visible; only the latest due slot defines a current missing-run incident.
    if (
        coverage
        and coverage[-1]["state"] == "missing"
        and schedule.get("enabled", True)
    ):
        causes.append("missing_execution")
    unhealthy_evidence = causes or (
        meaningful and classify_outcome(meaningful[-1]) == "failure"
    )
    if unhealthy_evidence and (
        now - (last_useful or observation_start)
    ).total_seconds() > float(thresholds["progress_seconds"]):
        causes.append("lack_of_progress")
    terminal = [job for job in roots if classify_outcome(job) != "running"]
    # Cancellation ends execution, but cannot prove that failed work recovered.
    inconclusive = bool(
        (terminal and classify_outcome(terminal[-1]) == "cancelled")
        or cron_error
        or unknown
        or outcomes["success_unknown"]
        or outcomes["unknown"]
        or schedule.get("history_incomplete")
    )
    return {
        "path": schedule["path"],
        "status": "unhealthy"
        if causes
        else "unknown"
        if inconclusive
        else "healthy",
        "root_count": len(roots),
        "outcomes": dict(outcomes),
        "unknown_parent_count": unknown,
        "causes": sorted(set(causes)),
        "due_count": len(due),
        "next_due": next_due.isoformat() if next_due else None,
        "last_useful_at": last_useful.isoformat() if last_useful else None,
        "latest_job_id": str(roots[-1]["id"]) if roots else None,
        "material_child_failure_count": material_count,
        "tolerable_external_failure_count": sum(
            job.get("tolerable_external_failure_count", 0) for job in roots
        ),
        "material_outcome_failure_count": sum(
            len(job.get("material_outcome_failures", [])) for job in roots
        ),
        "consecutive_failures": consecutive,
        "missing_due_count": missing,
        "coverage": coverage,
        "coverage_start": coverage_start.isoformat(),
        "coverage_truncated": coverage_start > observation_start,
        "cron_valid": not cron_error,
    }


def incident_transition(
    previous_state: dict[str, Any] | None,
    report: dict[str, Any],
    now: datetime,
    reminder_seconds: int = 21600,
    retry_seconds: int = 1800,
) -> dict[str, Any]:
    """Plan durable notification delivery; caller persists before external I/O.

    On every send attempt persist last_delivery_attempt_at. Only confirmed delivery
    clears pending_notification and advances last_notified_at. A delivery failure
    never resets active incident state. Unknown health cannot imply recovery.
    """
    state: dict[str, Any] = dict(
        previous_state or {"active": False, "pending_notification": None}
    )
    transition = "unchanged"
    kind = None
    if report["status"] == "unhealthy":
        if not state.get("active"):
            state.update(active=True, opened_at=now.isoformat())
            transition = "opened"
            kind = "incident"
        state["causes"] = list(report.get("causes", []))
        last_notified = timestamp(state.get("last_notified_at"))
        if (
            kind is None
            and not state.get("pending_notification")
            and last_notified
            and (now - last_notified).total_seconds() >= reminder_seconds
        ):
            kind = "reminder"
    elif report["status"] == "healthy" and state.get("active"):
        state.update(active=False, recovered_at=now.isoformat())
        transition = "recovered"
        kind = "recovery"
    if kind:
        state["last_delivery_attempt_at"] = None
        identity = f"{report['path']}:{state.get('opened_at')}:{kind}:{now.isoformat()}"
        state["pending_notification"] = {
            "id": hashlib.sha256(identity.encode()).hexdigest(),
            "kind": kind,
            "pipeline": report["path"],
            "causes": list(state.get("causes", [])),
            "job_id": report.get("latest_job_id"),
        }
        for field in [
            "source_pipeline",
            "overdue_country_count",
            "overdue_title_count",
            "outstanding_demand",
            "unacknowledged_title_count",
            "oldest_overdue_at",
            "age_basis",
        ]:
            if report.get(field) is not None:
                state["pending_notification"][field] = report[field]
    pending = state.get("pending_notification")
    attempted = timestamp(state.get("last_delivery_attempt_at"))
    notification = (
        pending
        if pending
        and (
            attempted is None
            or (now - attempted).total_seconds() >= retry_seconds
        )
        else None
    )
    return {
        "state": state,
        "notification": notification,
        "transition": transition,
    }


def main() -> None:
    """Import-only Windmill module."""
