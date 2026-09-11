"""Resolve actual executions and project only non-sensitive monitoring evidence."""

import json

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


def outcome_evidence(result: Any, source_context: bool = False) -> tuple[str, list[str]]:
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
                saved_retry = source_context and state == "failed" and (
                    value.get("retry_saved") is True or value.get("rate_limit_reached") is True
                )
                failures |= state in FAILURE_OUTCOMES and not saved_retry
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
                    # Windmill uses this sentinel for a skipped module without a job.
                    if value.get("skipped") is True and item == "00000000-0000-0000-0000-000000000000":
                        continue
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


SOURCE_FETCH_PATH = "f/tmdb_web/tmdb_crawl_providers/fetch"


def source_evidence(job: dict[str, Any], observed: dict[str, Any]) -> None:
    if job.get("script_path") != SOURCE_FETCH_PATH:
        return
    result = job.get("result")
    if not isinstance(result, dict):
        return
    if job.get("success") is True and result.get("outcome") == "fetched":
        observed["source_success_count"] += 1
        completed = completion_time(job)
        if completed and completed > (observed["source_last_success_at"] or ""):
            observed["source_last_success_at"] = completed
    elif result.get("outcome") == "failed" or job.get("success") is False:
        observed["source_failure_count"] += 1
        # Only this explicit producer result proves saved external backoff.
        if job.get("success") is True and result.get("outcome") == "failed" and (
            result.get("rate_limit_reached") is True or result.get("retry_saved") is True
        ):
            observed["tolerable_external_failure_count"] += 1


PUBLICATION_CLASSIFICATIONS = {
    "attempts_exhausted", "budget_exhausted", "lease_lost", "authentication",
    "invalid_data", "incomplete_status", "permanent_error", "http_timeout", "http_connect",
    "grpc_unavailable", "grpc_deadline_exceeded",
} | {f"http_{code}" for code in range(400, 600)}


def count(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None


def completion_time(job: dict[str, Any]) -> str | None:
    try:
        if job.get("completed_at"):
            value = datetime.fromisoformat(str(job["completed_at"]).replace("Z", "+00:00"))
        elif job.get("started_at") and count(job.get("duration_ms")) is not None:
            value = datetime.fromisoformat(job["started_at"].replace("Z", "+00:00")) + timedelta(milliseconds=job["duration_ms"])
        else:
            return None
        return value.astimezone(timezone.utc).isoformat() if value.tzinfo else None
    except (ValueError, TypeError, OverflowError):
        return None


def publication_targets(job: dict[str, Any]) -> list[dict[str, Any]]:
    args = job.get("args")
    values = args.get("next_ids") if isinstance(args, dict) else None
    if job.get("script_path") != "f/priority/publish" or not isinstance(values, dict):
        return []
    targets: dict[tuple[str, int], dict[str, Any]] = {}
    for field, media_type in (("movie_ids", "movie"), ("tv_ids", "show")):
        ids = values.get(field, [])
        if isinstance(ids, list):
            for identity in ids[:100]:
                if count(identity) and len(targets) < 100:
                    targets[(media_type, identity)] = {"media_type": media_type, "tmdb_id": identity, "claimed_demand": None}
    claims = values.get("claims", [])
    if isinstance(claims, list):
        for claim in claims[:100]:
            if not isinstance(claim, dict):
                continue
            media_type = claim.get("media_type", claim.get("type"))
            media_type = "show" if media_type == "tv" else media_type
            identity = count(claim.get("tmdb_id"))
            if isinstance(media_type, str) and media_type in {"movie", "show"} and identity:
                key = (media_type, identity)
                if key in targets:
                    targets[key]["claimed_demand"] = count(claim.get("claimed_demand"))
    return list(targets.values())


def summary_counts(job: dict[str, Any], observed: dict[str, Any]) -> None:
    totals = {"acknowledged_count": 0, "partial_country_count": 0,
              "publication_attempt_count": 0, "publication_retry_count": 0}

    def walk(value: Any, depth: int = 0) -> None:
        if depth > 8:
            return
        if isinstance(value, list):
            for item in value[:1000]:
                walk(item, depth + 1)
        elif isinstance(value, dict):
            for key, field in (("acknowledged", "acknowledged_count"),
                               ("deferred_country_count", "partial_country_count")):
                totals[field] += count(value.get(key)) or 0
            if all(count(value.get(key)) is not None for key in ("batches", "attempts", "retries")):
                totals["publication_attempt_count"] += value["attempts"]
                totals["publication_retry_count"] += value["retries"]
            for key, item in value.items():
                if key not in {"args", "logs", "error", "providers", "identity_errors"}:
                    if isinstance(item, (dict, list)):
                        walk(item, depth + 1)
    walk(job.get("result"))
    # Parents often return the child's exact summary; these are observed high-water
    # counts rather than a sum across duplicate nested execution results.
    for field, value in totals.items():
        observed[field] = max(observed[field], value)


def publication_evidence(job: dict[str, Any], observed: dict[str, Any]) -> None:
    if job.get("script_path") not in {"f/priority/publish", "f/sync/copy/vector_data"}:
        return
    result = job.get("result")
    error = result.get("error") if isinstance(result, dict) else None
    if not isinstance(error, dict) or error.get("name") != "PublicationFailure":
        return
    message = error.get("message")
    if not isinstance(message, str) or len(message) > 16384 or not message.startswith("Qdrant publication failed ("):
        return
    try:
        summary, _ = json.JSONDecoder().raw_decode(message[message.index("{") :])
    except (ValueError, TypeError):
        return
    if (not isinstance(summary, dict) or not isinstance(summary.get("classification"), str)
            or summary["classification"] not in PUBLICATION_CLASSIFICATIONS):
        return
    attempts, retries = count(summary.get("attempts")), count(summary.get("retries"))
    if attempts is None or retries is None or retries != max(0, attempts - 1):
        return
    observed["publication_failure"] = {
        "classification": summary["classification"], "attempts": attempts, "retries": retries,
        "job_id": job["id"], "completed_at": completion_time(job), "targets": publication_targets(job),
    }
    observed["publication_attempt_count"] = max(observed["publication_attempt_count"], attempts)
    observed["publication_retry_count"] = max(observed["publication_retry_count"], retries)


def observe_execution(api: Api, job_id: str, child_limit: int = 100) -> dict[str, Any]:
    """Resolve identity, inspect bounded descendants, and discard raw payloads."""
    observed: dict[str, Any] = {
        "id": job_id, "observation_version": 2, "parent_resolved": False, "outcome": "unknown",
        "source_success_count": 0, "source_failure_count": 0,
        "source_last_success_at": None,
        "tolerable_external_failure_count": 0,
        "publication_attempt_count": 0, "publication_retry_count": 0,
        "acknowledged_count": 0, "partial_country_count": 0,
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
    outcome, errors = outcome_evidence(
        job.get("result"), str(job.get("script_path", "")).startswith("f/tmdb_web/")
    )
    observed["outcome"] = "overlap" if job.get("is_skipped") else outcome
    observed["material_outcome_failures"] = errors
    summary_counts(job, observed)
    source_evidence(job, observed)
    publication_evidence(job, observed)
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
        summary_counts(child, observed)
        source_evidence(child, observed)
        publication_evidence(child, observed)
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
    failure = observed.get("publication_failure")
    source_success_at = observed["source_last_success_at"]
    if (failure and failure.get("completed_at") and source_success_at
            and source_success_at <= failure["completed_at"]):
        failure["source_success_at"] = source_success_at
    if (
        job.get("success") is True
        and str(job.get("script_path", "")).startswith("f/tmdb_web/")
        and observed["source_failure_count"] > 0
        and observed["source_failure_count"] == observed["tolerable_external_failure_count"]
        and not observed["source_success_count"]
        and not observed["material_outcome_failures"]
        and not observed["material_child_failures"]
        and not observed["missing_descendants"]
        and not observed["unresolved_descendants"]
    ):
        observed["outcome"] = "external_deferred"
        observed["material_outcome_failures"] = []
    return observed


def main() -> None:
    pass
