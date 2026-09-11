"""Explicit, isolated incident/recovery check for the configured Discord channel."""

from datetime import datetime, timedelta, timezone
import os

import wmill

from f.monitoring.incidents import record_incident
from f.monitoring.store import MonitoringStore


def main(phase: str, scenario: str = "workflow") -> dict:
    if phase not in {"incident", "recovery"}:
        raise ValueError("phase must be incident or recovery")
    if scenario not in {"workflow", "country", "publication"}:
        raise ValueError("scenario must be workflow, country or publication")
    try:
        webhook = wmill.get_variable("f/monitoring/discord_webhook_url")
    except Exception:
        raise RuntimeError("Monitoring Discord secret unavailable") from None
    store = MonitoringStore()
    store.initialize()
    if not store.acquire():
        return {"status": "overlap_skipped"}
    try:
        report = {
            "path": "f/monitoring/notification_check",
            "status": "unhealthy" if phase == "incident" else "healthy",
            "causes": ["controlled_failure"] if phase == "incident" else [],
            "latest_job_id": os.environ.get("WM_JOB_ID"),
        }
        if scenario != "workflow":
            from f.monitoring.backlog_health import assess_backlogs
            now = datetime.now(timezone.utc)
            overdue = (now - timedelta(hours=5)).isoformat()
            previous = {kind: {"last_progress_at": overdue, "count": 2,
                        "oldest_due_at": overdue, "observation_complete": True}
                        for kind in ["country", "publication"]}
            country = {"complete": True, "overdue_country_count": 2 if phase == "incident" else 0,
                       "overdue_title_count": 1 if phase == "incident" else 0,
                       "oldest_due_at": overdue if phase == "incident" else None}
            publication = {"complete": True, "overdue_title_count": 2 if phase == "incident" else 0,
                           "oldest_unacknowledged_at": overdue if phase == "incident" else None,
                           "outstanding_demand": 2 if phase == "incident" else 0,
                           "age_basis": "monitor_observation"}
            if scenario == "publication" and phase == "incident":
                publication.update(last_failure_classification="attempts_exhausted",
                    last_failure_at=(now - timedelta(minutes=4)).isoformat(),
                    source_success_at=(now - timedelta(minutes=5)).isoformat(),
                    failure_unacknowledged=True)
            evaluated = assess_backlogs(country, publication, previous, now)
            scoped = evaluated["reports"][0 if scenario == "country" else 1]
            report = {**scoped, "path": report["path"], "latest_job_id": report["latest_job_id"]}
        result = record_incident(store, report, datetime.now(timezone.utc), webhook)
        delivery = result.get("delivery")
        if not isinstance(delivery, dict) or not delivery.get("delivered"):
            return {"status": "not_delivered", **result}
        return {"status": "delivered", **result}
    finally:
        store.release()
