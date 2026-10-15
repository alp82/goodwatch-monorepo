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
    "crate_checkpoint_lag",
    "crate_checkpoint_stalled",
    "crate_translog_oversized",
    "crate_disk_near_watermark",
    "crate_disk_watermark",
    "crate_backup_stale",
    "crate_backup_missing",
    "crate_backup_unreadable",
}
# Infrastructure incidents have no Windmill execution to link.
INFRASTRUCTURE_PIPELINES = {
    "f/monitoring/crate_shards",
    "f/monitoring/crate_disk",
    "f/monitoring/crate_backup",
}
DETAIL_PATTERN = r"[A-Za-z0-9_.#%(),;:+ -]{1,300}"


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


# Fixed copy only: raw job errors, arguments and provider responses never enter Discord.
NAMES = {
    "f/tmdb_web/tmdb_crawl_providers": "Streaming availability",
    "f/priority/crawl_all": "Catalog updates",
    "f/monitoring/country_backlog": "Streaming availability",
    "f/monitoring/publication_backlog": "Search catalog updates",
    "f/monitoring/crate_shards": "Database replication",
    "f/monitoring/crate_disk": "Database storage",
    "f/monitoring/crate_backup": "Database backups",
}


def format_notification(notice: dict[str, Any]) -> str:
    path = notice["pipeline"]
    name = NAMES.get(path, path.rsplit("/", 1)[-1].replace("_", " ").capitalize())
    prefix = "[controlled monitor check] " if path == "f/monitoring/notification_check" else ""
    if notice["kind"] == "recovery":
        return f"{prefix}Resolved: {name}. Checks are back to normal."
    causes = set(notice["causes"])
    if "crate_checkpoint_stalled" in causes:
        problem = "A replica has stopped catching up for at least 1 hour; retained writes can grow disk use."
        action = "Inspect the lagging replica before disk use grows further."
    elif causes & {"crate_checkpoint_lag", "crate_translog_oversized"}:
        problem = "Replication is behind and retained writes are using extra disk space."
        action = "Inspect replication progress and available disk space."
    elif causes & {"crate_disk_near_watermark", "crate_disk_watermark"}:
        problem = f"Disk use reached {notice.get('disk_used_percent', '?')}%; database allocation is at risk."
        action = "Free disk space or add capacity."
    elif causes & {"crate_backup_missing", "crate_backup_stale", "crate_backup_unreadable"}:
        problem = "A recent successful database backup could not be confirmed."
        action = "Check the backup job and repository."
    elif "country_backlog_stalled" in causes:
        problem = f"Availability refreshes stalled: {notice.get('overdue_country_count', '?')} country updates overdue."
        action = "Inspect the provider crawler's failed work."
    elif causes & {"publication_unacknowledged", "publication_retry_exhausted", "publication_failed"}:
        problem = "Catalog changes are not reaching search reliably."
        action = "Inspect the publication failure and search database connectivity."
    elif "consecutive_failures" in causes:
        problem = "Repeated runs or their required steps are failing."
        action = "Inspect the failed step in the linked run."
    elif "excessive_runtime" in causes:
        problem = "A run has exceeded its expected time limit."
        action = "Inspect the running step for a blocked dependency."
    elif "missing_execution" in causes:
        problem = "Scheduled work has not started within its allowed delay."
        action = "Check the schedule and available Windmill workers."
    else:
        problem = "The monitoring delivery check needs attention."
        action = "Review the linked check."
    title = "Worsened" if notice["kind"] == "escalation" else "Action needed"
    lines = [f"{prefix}{title}: {name}. {problem}", action]
    if path in INFRASTRUCTURE_PIPELINES:
        link = "https://github.com/alp82/goodwatch-monorepo/blob/main/docs/workflow-monitoring.md#crate-shard-and-disk-health"
    elif notice.get("job_id"):
        link = f"https://windmill.goodwatch.app/run/{notice['job_id']}?workspace=goodwatch"
    else:
        source = notice.get("source_pipeline", path)
        link = f"https://windmill.goodwatch.app/flows/get/{source}?workspace=goodwatch"
    lines.append(link)
    return "\n".join(lines)


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
        or kind not in {"incident", "escalation", "recovery"}
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
        "unacknowledged_title_count": "Unacknowledged titles",
        "checkpoint_lag_ops": "Largest checkpoint lag (ops)",
        "translog_mb": "Largest translog (MB)",
        "disk_used_percent": "Highest disk use (%)",
    }
    for field in count_fields:
        value = notification.get(field)
        if value is not None and (
            not isinstance(value, int)
            or isinstance(value, bool)
            or not 0 <= value <= 10**18
        ):
            return failure("invalid_notification", True)
    detail = notification.get("detail")
    if detail is not None and (
        not isinstance(detail, str) or not re.fullmatch(DETAIL_PATTERN, detail)
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
    content = format_notification(notification)
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
