"""One bounded Discord webhook attempt; delivery state belongs to the caller."""

import json
import math
import re
from datetime import datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener


DELIVERY_CLIENT_IDENTITY = (
    "DiscordBot (https://github.com/alp82/goodwatch-monorepo, 1.0.0)"
)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(
        self,
        req: Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> None:
        return None


CAUSES = {
    "missing_execution",
    "excessive_runtime",
    "missing_descendants",
    "consecutive_failures",
    "lack_of_progress",
    "material_child_failures",
    "material_outcome_failures",
    "controlled_failure",
    "country_backlog_stalled",
    "publication_unacknowledged",
    "publication_retry_exhausted",
    "publication_failed",
}


def failure(
    code: str, permanent: bool = False, delay: float = 1800
) -> dict[str, Any]:
    return {
        "delivered": False,
        "message_id": None,
        "error_code": code,
        "retry_after_seconds": delay,
        "permanent_failure": permanent,
    }


def deliver_notification(
    webhook_url: str, notification: dict[str, Any]
) -> dict[str, Any]:
    if not isinstance(webhook_url, str) or not re.fullmatch(
        r"https://discord\.com/api/webhooks/[0-9]+/[A-Za-z0-9._-]+",
        webhook_url,
    ):
        return failure("invalid_webhook", True)
    pipeline = notification.get("pipeline")
    kind = notification.get("kind")
    causes = notification.get("causes")
    job_id = notification.get("job_id")
    if (
        not isinstance(pipeline, str)
        or not re.fullmatch(r"[fu]/[A-Za-z0-9_/-]{1,200}", pipeline)
        or kind not in {"incident", "reminder", "recovery"}
        or not isinstance(causes, list)
        or len(causes) > 8
        or any(
            not isinstance(cause, str) or cause not in CAUSES
            for cause in causes
        )
        or (
            job_id is not None
            and (
                not isinstance(job_id, str)
                or not re.fullmatch(
                    r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}",
                    job_id,
                )
            )
        )
    ):
        return failure("invalid_notification", True)
    source_pipeline = notification.get("source_pipeline")
    if source_pipeline is not None and (
        not isinstance(source_pipeline, str)
        or not re.fullmatch(r"[fu]/[A-Za-z0-9_/-]{1,200}", source_pipeline)
    ):
        return failure("invalid_notification", True)
    count_fields = {
        "overdue_country_count": "Overdue countries",
        "overdue_title_count": "Overdue titles",
        "outstanding_demand": "Outstanding demand",
    }
    for field in count_fields:
        value = notification.get(field)
        if value is not None and (
            not isinstance(value, int)
            or isinstance(value, bool)
            or not 0 <= value <= 10**18
        ):
            return failure("invalid_notification", True)
    oldest = notification.get("oldest_overdue_at")
    if oldest is not None:
        try:
            if (
                not isinstance(oldest, str)
                or len(oldest) > 40
                or datetime.fromisoformat(oldest.replace("Z", "+00:00")).tzinfo
                is None
            ):
                return failure("invalid_notification", True)
        except ValueError:
            return failure("invalid_notification", True)
    age_basis = notification.get("age_basis")
    if age_basis is not None and age_basis not in {
        "due_timestamp",
        "monitor_observation",
        "last_queue_update_lower_bound",
        "unacknowledged_timestamp",
    }:
        return failure("invalid_notification", True)
    prefix = (
        "[controlled monitor check] "
        if pipeline == "f/monitoring/notification_check"
        else ""
    )
    content = f"{prefix}{kind}: {pipeline}\nCause: {', '.join(causes) or 'recovered'}"
    for field, label in count_fields.items():
        if notification.get(field) is not None:
            content += f"\n{label}: {notification[field]}"
    if oldest:
        content += f"\nOldest observed timestamp: {oldest} ({age_basis or 'unspecified'})"
    if source_pipeline:
        content += f"\nhttps://windmill.goodwatch.app/flows/get/{source_pipeline}?workspace=goodwatch"
    if job_id:
        content += f"\nhttps://windmill.goodwatch.app/run/{job_id}?workspace=goodwatch"
    else:
        content += "\nNo resolved execution. https://windmill.goodwatch.app/schedules?workspace=goodwatch"
    request = Request(
        webhook_url + "?wait=true",
        data=json.dumps(
            {"content": content, "allowed_mentions": {"parse": []}}
        ).encode(),
        headers={
            "Content-Type": "application/json",
            "User-Agent": DELIVERY_CLIENT_IDENTITY,
        },
        method="POST",
    )
    try:
        with build_opener(NoRedirect()).open(request, timeout=15) as response:
            result = json.loads(response.read(65536))
    except HTTPError as error:
        if error.code == 429:
            delays = [1800.0]
            try:
                body = json.loads(error.read(16384))
            except (ValueError, OSError):
                body = {}
            for value in [
                error.headers.get("Retry-After"),
                body.get("retry_after") if isinstance(body, dict) else None,
            ]:
                try:
                    delay = float(value)
                    if math.isfinite(delay) and delay >= 0:
                        delays.append(delay)
                except (ValueError, TypeError):
                    pass
            # A supplied Discord delay is authoritative; fallback only if absent.
            return failure(
                "rate_limited",
                delay=max(delays[1:]) if len(delays) > 1 else delays[0],
            )
        return failure(
            f"http_{error.code}",
            error.code in {400, 401, 403, 404} or 300 <= error.code < 400,
        )
    except (URLError, OSError):
        return failure("transport_error")
    except (ValueError, TypeError):
        return failure("unconfirmed_response")
    if (
        not isinstance(result, dict)
        or not isinstance(result.get("id"), str)
        or not result["id"].isdigit()
    ):
        return failure("unconfirmed_response")
    return {
        "delivered": True,
        "message_id": result["id"],
        "error_code": None,
        "retry_after_seconds": 0,
        "permanent_failure": False,
    }


def main() -> None:
    """Import-only Windmill module."""
