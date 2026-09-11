"""Persist transitions before notification and retain failures across checker runs."""

from datetime import datetime, timedelta
import hashlib
from typing import Any, Callable

from f.monitoring.health import incident_transition, timestamp
from f.monitoring.notifications import (
    DELIVERY_CLIENT_IDENTITY,
    deliver_notification,
)


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
    planned = incident_transition(previous.get("incident"), report, now)
    state = planned["state"]
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
