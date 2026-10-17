"""Persist transitions before notification and retain failures across checker runs."""

from datetime import datetime, timedelta
import hashlib
from typing import Any, Callable

from f.monitoring.health import incident_transition, timestamp
from f.monitoring.notifications import (
    DELIVERY_CLIENT_IDENTITY,
    deliver_notification,
)


def actionable_causes(report: dict[str, Any]) -> list[str]:
    """Separate evidence worth interrupting a person for from diagnostics."""
    causes = set(report.get("causes", []))
    actionable = causes & {
        "consecutive_failures", "excessive_runtime", "controlled_failure",
        "country_backlog_stalled", "publication_unacknowledged",
        "publication_retry_exhausted", "publication_failed",
        "crate_checkpoint_stalled", "crate_disk_near_watermark", "crate_disk_watermark",
        "crate_backup_stale", "crate_backup_missing", "crate_backup_unreadable",
    }
    if (report.get("path") == "f/monitoring/tmdb_watch_upstream"
            and "upstream_blocked" in causes
            and (report.get("blocked_seconds") or 0) >= 2 * 3600):
        actionable.add("upstream_blocked")
    if {"missing_execution", "lack_of_progress"} <= causes:
        actionable.add("missing_execution")
    return sorted(actionable)


def record_incident(
    store: Any, report: dict[str, Any], now: datetime, webhook_url: str | None,
    deliver: Callable[[str, dict[str, Any]], dict[str, Any]] = deliver_notification,
) -> dict[str, Any]:
    path = report["path"]
    previous = store.get("pipeline:" + path) or {}
    fingerprint = (
        hashlib.sha256(
            f"{DELIVERY_CLIENT_IDENTITY}\0{webhook_url}".encode()
        ).hexdigest()
        if webhook_url else None
    )
    gate = store.get("discord-delivery") or {}
    if fingerprint and gate.get("fingerprint") not in {None, fingerprint}:
        if previous.get("incident"):
            previous["incident"]["last_delivery_attempt_at"] = None
    attention = {**report, "causes": actionable_causes(report)}
    prior = previous.get("incident")
    if (prior and prior.get("attention_policy") != 1
            and prior.get("active") and not actionable_causes(prior)):
        # Retire old diagnostic-only incidents silently, not as a claimed recovery.
        prior = {**prior, "active": False, "pending_notification": None,
                 "last_notified_at": None, "announced_causes": []}
    if report["status"] == "unhealthy" and not attention["causes"]:
        attention["status"] = "unknown"
    if prior and attention["status"] == "unknown":
        prior = {**prior, "pending_notification": None}
    planned = incident_transition(prior, attention, now)
    state = planned["state"]
    state["attention_policy"] = 1
    payload = {"report": report, "incident": state}
    store.put("pipeline:" + path, "pipeline", path, payload)
    notification = planned["notification"]
    if not notification or not webhook_url:
        return {"transition": planned["transition"], "delivery": "not_attempted"}
    if gate.get("fingerprint") == fingerprint:
        retry_at = timestamp(gate.get("retry_at"))
        if gate.get("permanent_failure") or (retry_at and retry_at > now):
            return {"transition": planned["transition"], "delivery": "deferred"}
    # Persist the attempt first. A killed checker cannot immediately flood Discord.
    state["last_delivery_attempt_at"] = now.isoformat()
    store.put("pipeline:" + path, "pipeline", path, payload)
    store.put("discord-delivery", "notification", "", {
        "fingerprint": fingerprint,
        "retry_at": (now + timedelta(minutes=30)).isoformat(),
        "last_attempt_at": now.isoformat(), "error_code": "attempt_in_progress",
    })
    store.assert_owner()
    delivery = deliver(webhook_url, notification)
    state["last_delivery"] = delivery
    if delivery["delivered"]:
        state["last_notified_at"] = now.isoformat()
        state["announced_causes"] = sorted(
            set(state.get("announced_causes", [])) | set(notification["causes"])
        )
        state["pending_notification"] = None
    store.put("pipeline:" + path, "pipeline", path, payload)
    delay = max(float(delivery.get("retry_after_seconds", 1800)), 0)
    store.put("discord-delivery", "notification", "", {
        "fingerprint": fingerprint,
        "retry_at": (now + timedelta(seconds=delay)).isoformat(),
        "last_attempt_at": now.isoformat(),
        "error_code": delivery.get("error_code"),
        "permanent_failure": bool(delivery.get("permanent_failure")),
        "last_message_id": delivery.get("message_id"),
    })
    return {"transition": planned["transition"], "delivery": delivery}


def main() -> None:
    pass
