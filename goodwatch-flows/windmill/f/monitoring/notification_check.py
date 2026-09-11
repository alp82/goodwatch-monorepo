"""Explicit, isolated incident/recovery check for the configured Discord channel."""

from datetime import datetime, timezone
import os

import wmill

from f.monitoring.incidents import record_incident
from f.monitoring.store import MonitoringStore


def main(phase: str) -> dict:
    if phase not in {"incident", "recovery"}:
        raise ValueError("phase must be incident or recovery")
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
        result = record_incident(store, report, datetime.now(timezone.utc), webhook)
        delivery = result.get("delivery")
        if not isinstance(delivery, dict) or not delivery.get("delivered"):
            return {"status": "not_delivered", **result}
        return {"status": "delivered", **result}
    finally:
        store.release()
