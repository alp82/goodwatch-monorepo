# extra_requirements:
# httpx
# wmill

"""Alert on enabled schedules whose recent root runs are failing.

A script of its own, separate from `f/monitoring/check`: it reads only the last
completed root runs of each enabled schedule, so old ledger rows can't starve
it. The alerted set lives in a Windmill state resource at a fixed path, so a
manual run and the scheduled runs share it.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from f.monitoring.notifications import deliver_notification

Api = Callable[[str], Any]

STATE_PATH = "f/monitoring/failing_schedules_state"
RUNS_INSPECTED = 10
FAILURE_STREAK = 3
STALE_SUCCESS = timedelta(hours=20)
SCHEDULE_PAGE = 100
RUN_FILTER = "has_null_parent=true&is_skipped=false"


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def finished_at(run: dict[str, Any]) -> datetime:
    # The completed-jobs list has no completed_at; start plus duration is it.
    return parse_time(run["started_at"]) + timedelta(
        milliseconds=run.get("duration_ms") or 0
    )


def assess(
    runs: list[dict[str, Any]], last_success: datetime | None, now: datetime
) -> bool:
    """Runs are newest first. No completed run is not a failure."""
    if not runs or runs[0]["success"]:
        return False
    streak = runs[:FAILURE_STREAK]
    if len(streak) == FAILURE_STREAK and not any(run["success"] for run in streak):
        return True
    return last_success is None or now - last_success >= STALE_SUCCESS


def observe_schedule(api: Api, path: str, now: datetime) -> dict[str, Any]:
    runs = api(
        f"jobs/completed/list?schedule_path={path}&{RUN_FILTER}"
        f"&per_page={RUNS_INSPECTED}"
    )
    success = next((run for run in runs if run["success"]), None)
    if success is None and runs and not runs[0]["success"]:
        # The last success is older than the inspected window, or never was.
        older = api(
            f"jobs/completed/list?schedule_path={path}&{RUN_FILTER}"
            "&success=true&per_page=1"
        )
        success = older[0] if older else None
    last_success = finished_at(success) if success else None
    return {
        "failing": assess(runs, last_success, now),
        "failed_runs": sum(not run["success"] for run in runs),
        "runs": len(runs),
        "newest_job_id": runs[0]["id"] if runs else None,
        "last_success_job_id": success["id"] if success else None,
        "last_success_at": last_success.isoformat() if last_success else None,
    }


def enabled_schedules(api: Api) -> list[str]:
    paths: list[str] = []
    page = 1
    while True:
        batch = api(f"schedules/list?per_page={SCHEDULE_PAGE}&page={page}")
        paths += [item["path"] for item in batch if item["enabled"]]
        if len(batch) < SCHEDULE_PAGE:
            return sorted(paths)
        page += 1


def plan(
    alerted: dict[str, dict[str, Any]], observed: dict[str, dict[str, Any]]
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    """Return the next alerted set and the notifications it still owes.

    Statuses: `incident_pending` (not yet delivered), `alerted`, and
    `recovery_pending`. A schedule missing from `observed` is disabled or
    deleted and leaves the set silently; an unreadable one keeps its entry.
    """
    state: dict[str, dict[str, Any]] = {}
    owed: list[dict[str, Any]] = []
    for path in sorted(set(alerted) | set(observed)):
        entry = alerted.get(path)
        seen = observed.get(path)
        if seen is None:
            continue
        if seen.get("unreadable"):
            if entry:
                state[path] = entry
            continue
        status = entry["status"] if entry else None
        if seen["failing"]:
            if status in {"alerted", "recovery_pending"}:
                # An undelivered recovery means the incident still stands.
                state[path] = {**entry, "status": "alerted"}
                continue
            state[path] = {
                "status": "incident_pending",
                "job_id": (entry or {}).get("job_id") or seen["newest_job_id"],
            }
            owed.append({"kind": "incident", "pipeline": path,
                         "job_id": state[path]["job_id"]})
        elif status in {"alerted", "recovery_pending"}:
            state[path] = {**entry, "status": "recovery_pending",
                           "recovery_job_id": seen["newest_job_id"]}
            owed.append({"kind": "recovery", "pipeline": path,
                         "job_id": seen["newest_job_id"]})
        # A pending incident that was never delivered needs no recovery.
    return state, owed


def run_check(
    api: Api,
    load_state: Callable[[], dict[str, Any] | None],
    save_state: Callable[[dict[str, Any]], None],
    webhook_url: str | None,
    *,
    deliver: Callable[[str, dict[str, Any]], dict[str, Any]] = deliver_notification,
    clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
) -> dict[str, Any]:
    now = clock()
    observed: dict[str, dict[str, Any]] = {}
    for path in enabled_schedules(api):
        try:
            observed[path] = observe_schedule(api, path, now)
        except Exception as error:
            observed[path] = {"unreadable": True, "error": type(error).__name__}
    previous = load_state() or {}
    alerted, owed = plan(previous.get("schedules", {}), observed)

    retry_at = previous.get("retry_at")
    gated = retry_at is not None and parse_time(retry_at) > now
    next_retry_at = retry_at if gated else None
    deliveries: list[dict[str, Any]] = []
    for notice in owed:
        path = notice["pipeline"]
        if webhook_url is None or gated:
            deliveries.append({**notice, "delivered": False,
                               "error_code": "deferred"})
            continue
        payload = {"kind": notice["kind"], "pipeline": path,
                   "causes": ["consecutive_failures"]}
        if notice["job_id"]:
            payload["job_id"] = notice["job_id"]
        result = deliver(webhook_url, payload)
        deliveries.append({**notice, "delivered": result["delivered"],
                           "error_code": result["error_code"],
                           "message_id": result["message_id"]})
        if result["delivered"]:
            if notice["kind"] == "incident":
                alerted[path] = {**alerted[path], "status": "alerted",
                                 "message_id": result["message_id"]}
            else:
                del alerted[path]
            continue
        # One failure defers the rest of this run; a broken webhook would
        # otherwise spend a timeout on every owed message.
        gated = True
        if result["error_code"] == "rate_limited":
            next_retry_at = (
                now + timedelta(seconds=result["retry_after_seconds"])
            ).isoformat()

    state = {"schedules": alerted, "retry_at": next_retry_at,
             "checked_at": now.isoformat()}
    if webhook_url is not None:
        save_state(state)
    return {
        "checked_at": now.isoformat(),
        "schedules": len(observed),
        "failing": sorted(p for p, s in observed.items() if s.get("failing")),
        "unreadable": sorted(p for p, s in observed.items() if s.get("unreadable")),
        "deliveries": deliveries,
        "alerted": alerted,
        "observed": observed,
    }


def main(notify: bool = True) -> dict[str, Any]:
    import httpx
    import wmill

    client = wmill.Windmill(workspace="goodwatch").client

    def request(method: str, path: str, **kwargs: Any) -> Any:
        try:
            response = client.request(
                method, "/w/goodwatch/" + path, timeout=10, **kwargs
            )
        except httpx.HTTPError:
            raise RuntimeError("Windmill API transport failed") from None
        if response.status_code == 404:
            raise FileNotFoundError(path)
        if response.status_code not in {200, 201}:
            raise RuntimeError(f"Windmill API failed: HTTP {response.status_code}")
        return response.json() if method == "GET" else None

    def api(path: str) -> Any:
        return request("GET", path)

    def load_state() -> dict[str, Any] | None:
        # A failed read raises: an empty state would repeat every alert.
        try:
            return request("GET", f"resources/get/{STATE_PATH}")["value"]
        except FileNotFoundError:
            return None

    def save_state(value: dict[str, Any]) -> None:
        try:
            request("POST", f"resources/update_value/{STATE_PATH}",
                    json={"value": value})
        except FileNotFoundError:
            request("POST", "resources/create", json={
                "path": STATE_PATH, "value": value, "resource_type": "state",
            })

    webhook = None
    if notify:
        webhook = wmill.get_variable("f/monitoring/discord_webhook_url")
    return run_check(api, load_state, save_state, webhook)
