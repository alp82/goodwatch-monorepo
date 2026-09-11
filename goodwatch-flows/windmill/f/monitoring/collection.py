"""Resolve actual executions and project only non-sensitive monitoring evidence."""

from datetime import datetime, timedelta, timezone
from typing import Any, Callable

Api = Callable[[str], Any]
WORK_COUNTERS = {
    "acknowledged", "upserts", "inserted", "updated", "deleted",
    "count_new_tv", "count_new_movies", "rows_upserted", "records_updated",
    "processed", "copied", "published", "item_count",
}
ERROR_COUNTERS = {"failed", "failures", "error_count", "identity_error_count"}
USEFUL_OUTCOMES = {"fetched", "verified", "published", "refreshed"}
FAILURE_OUTCOMES = {"failed", "failure", "error", "retry_scheduled"}
NO_WORK_OUTCOMES = {"no_work", "no_eligible_work", "no_eligible", "empty"}


def outcome_evidence(result: Any) -> tuple[str, list[str]]:
    """Recognized outcome summaries are evidence; arbitrary success text is not."""
    work = 0
    counters_seen = False
    explicit_empty = False
    failures = False
    unknown = False

    def visit(value: Any, depth: int = 0) -> None:
        nonlocal work, counters_seen, failures, unknown, explicit_empty
        if depth > 8:
            unknown = True
            return
        if isinstance(value, list):
            if not value:
                explicit_empty = True
            for item in value[:1000]:
                visit(item, depth + 1)
            unknown |= len(value) > 1000
        elif isinstance(value, dict):
            state = value.get("outcome", value.get("status"))
            if isinstance(state, str):
                work += state in USEFUL_OUTCOMES
                failures |= state in FAILURE_OUTCOMES
                explicit_empty |= state in NO_WORK_OUTCOMES
            for key, item in value.items():
                if isinstance(item, (int, float)) and not isinstance(item, bool):
                    if key in WORK_COUNTERS:
                        counters_seen = True
                        work += max(item, 0)
                    elif key in ERROR_COUNTERS:
                        failures |= item > 0
                elif isinstance(item, (dict, list)) and key not in {
                    "args", "logs", "error", "providers", "identity_errors",
                }:
                    visit(item, depth + 1)
        elif value is not None:
            unknown = True

    visit(result)
    if failures:
        return ("useful" if work else "failure"), ["structured_outcome_errors"]
    if work:
        return "useful", []
    if not unknown and (counters_seen or explicit_empty):
        return "no_work", []
    return "unknown", []


def descendant_ids(status: Any) -> list[str]:
    found: list[str] = []

    def walk(value: Any) -> None:
        if isinstance(value, dict):
            for key, item in value.items():
                if key == "job" and isinstance(item, str):
                    found.append(item)
                elif key == "flow_jobs" and isinstance(item, list):
                    found.extend(x for x in item if isinstance(x, str))
                elif isinstance(item, (list, dict)):
                    walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)

    walk(status)
    return list(dict.fromkeys(found))


def observe_execution(api: Api, job_id: str, child_limit: int = 100) -> dict[str, Any]:
    """Resolve identity, inspect bounded descendants, and discard raw payloads."""
    observed: dict[str, Any] = {
        "id": job_id, "parent_resolved": False, "outcome": "unknown",
        "missing_descendants": [], "material_child_failures": [],
        "material_outcome_failures": [], "unresolved_descendants": [],
    }
    try:
        job = api("jobs_u/get/" + job_id)
        if not isinstance(job, dict) or job.get("id") != job_id:
            return observed
    except Exception:
        observed["lookup_error"] = "job_unavailable"
        return observed
    for key in (
        "script_path", "schedule_path", "started_at", "completed_at",
        "created_at", "scheduled_for", "duration_ms", "success", "canceled",
        "is_skipped", "running", "job_kind",
    ):
        if key in job:
            observed[key] = job[key]
    if "parent_job" in job:
        observed.update(parent_resolved=True, parent_job=job["parent_job"])
    else:
        try:
            root = api("jobs_u/get_root_job_id/" + job_id)
            if isinstance(root, str) and root:
                observed.update(parent_resolved=True,
                                parent_job=None if root == job_id else root)
        except Exception:
            observed["lookup_error"] = "parent_identity_unavailable"
    if job.get("success") is not None and not observed.get("completed_at"):
        if job.get("started_at") and isinstance(job.get("duration_ms"), (int, float)):
            start = datetime.fromisoformat(job["started_at"].replace("Z", "+00:00"))
            observed["completed_at"] = (
                start + timedelta(milliseconds=job["duration_ms"])
            ).astimezone(timezone.utc).isoformat()
    outcome, errors = outcome_evidence(job.get("result"))
    observed["outcome"] = "overlap" if job.get("is_skipped") else outcome
    observed["material_outcome_failures"] = errors
    pending = descendant_ids(job.get("flow_status"))
    seen = {job_id}
    while pending and len(seen) <= child_limit:
        child_id = pending.pop(0)
        if child_id in seen:
            continue
        seen.add(child_id)
        try:
            child = api("jobs_u/get/" + child_id)
            if not isinstance(child, dict) or child.get("id") != child_id:
                observed["unresolved_descendants"].append(child_id)
                continue
        except FileNotFoundError:
            observed["missing_descendants"].append(child_id)
            continue
        except Exception:
            observed["unresolved_descendants"].append(child_id)
            continue
        if child.get("success") is False or child.get("canceled"):
            observed["material_child_failures"].append(child_id)
        elif child.get("success") is None and job.get("success") is not None:
            observed["unresolved_descendants"].append(child_id)
        pending.extend(descendant_ids(child.get("flow_status")))
    observed["unresolved_descendants"].extend(
        child for child in pending if child not in seen
    )
    if job.get("success") is True and observed.get("unresolved_descendants"):
        observed["evidence_incomplete"] = True
    return observed


def main() -> None:
    pass
