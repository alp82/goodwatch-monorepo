"""Pure grouped backlog assessment from eligible aggregate snapshots.

Collectors apply shared eligibility predicates and grace before exact counts.
Country and publication observations stay independent: title acknowledgment
never implies that pending countries have been scraped. No source payloads enter
reports or progress state. Collection gaps restart the observation window.
"""

from datetime import datetime
from typing import Any

from f.monitoring.health import timestamp

COUNTRY_GRACE_SECONDS = 1800
PUBLICATION_GRACE_SECONDS = 7200
COUNTRY_STALL_SECONDS = 3600
PUBLICATION_STALL_SECONDS = 7200
EXHAUSTED = {"attempts_exhausted", "budget_exhausted"}
PUBLICATION_FAILURES = EXHAUSTED | {
    "authentication",
    "invalid_data",
    "permanent_error",
    "incomplete_status",
    "lease_lost",
    "http_400",
    "http_401",
    "http_403",
    "http_404",
    "http_422",
}
EXCLUSION_KEYS = {"fresh", "backoff", "leased", "upstream_backoff", "cooldown"}


def count_value(value: Any) -> int | None:
    return (
        value
        if isinstance(value, int)
        and not isinstance(value, bool)
        and value >= 0
        else None
    )


def assess_backlogs(
    country_snapshot: dict[str, Any],
    publication_snapshot: dict[str, Any],
    previous_progress: dict[str, Any] | None,
    now: datetime,
) -> dict[str, Any]:
    """Return grouped country/publication reports and progress watermarks.

    Snapshot counts already exclude freshness/backoff/leases and grace. A global
    source backoff and a newest item still inside grace are also fenced here.
    failure_unacknowledged must be correlated to the failed titles' demand;
    another title's newer acknowledgment cannot clear that failure.
    """
    previous = previous_progress or {}
    reports: list[dict[str, Any]] = []
    progress: dict[str, Any] = {}
    partitioned = isinstance(country_snapshot.get("partitions"), list)
    countries = [country_snapshot]
    if partitioned:
        by_media = {
            part["media_type"]: part
            for part in country_snapshot["partitions"]
            if isinstance(part, dict)
            and part.get("media_type") in {"movie", "tv"}
        }
        countries = [
            by_media.get(media, {"media_type": media, "complete": False})
            for media in ["movie", "tv"]
        ]
    scopes = [
        (
            "country",
            part,
            "overdue_country_count",
            "oldest_due_at",
            "last_success_at",
            COUNTRY_STALL_SECONDS,
            COUNTRY_GRACE_SECONDS,
        )
        for part in countries
    ]
    scopes.append(
        (
            "publication",
            publication_snapshot,
            "overdue_title_count",
            "oldest_unacknowledged_at",
            "last_acknowledged_at",
            PUBLICATION_STALL_SECONDS,
            PUBLICATION_GRACE_SECONDS,
        )
    )
    for (
        kind,
        snapshot,
        count_key,
        oldest_key,
        successful_key,
        window,
        grace,
    ) in scopes:
        media_type = (
            snapshot.get("media_type")
            if kind == "country" and partitioned
            else None
        )
        scope_key = f"country_{media_type}" if media_type else kind
        count = count_value(snapshot.get(count_key))
        titles = count_value(snapshot.get("overdue_title_count"))
        complete = (
            snapshot.get("complete") is True
            and count is not None
            and titles is not None
        )
        dates = {}
        try:
            for key in [
                oldest_key,
                successful_key,
                "upstream_blocked_until",
                "last_failure_at",
                "source_success_at",
            ]:
                dates[key] = timestamp(snapshot.get(key))
        except (TypeError, ValueError):
            complete = False
        oldest = dates.get(oldest_key)
        successful = dates.get(successful_key)
        if count and oldest is None:
            complete = False
        excluded = {
            key: value
            for key, value in snapshot.get("excluded", {}).items()
            if key in EXCLUSION_KEYS and count_value(value) is not None
        }
        blocked_until = (
            dates.get("upstream_blocked_until") if kind == "country" else None
        )
        if (blocked_until and blocked_until > now) or (
            oldest and (now - oldest).total_seconds() < grace
        ):
            if blocked_until and blocked_until > now:
                excluded["upstream_backoff"] = (
                    excluded.get("upstream_backoff") or 0
                ) + (count or 0)
            count, titles, oldest = 0, 0, None
        track_pending = (
            kind == "publication" and "unacknowledged_title_count" in snapshot
        )
        pending_count = (
            count_value(snapshot.get("unacknowledged_title_count"))
            if track_pending
            else count
        )
        if track_pending and pending_count is None:
            complete = False
        old = previous.get(scope_key, {})
        old_pending = old.get("pending_count", old.get("count"))
        first_pending = (
            timestamp(old.get("first_pending_at")) if track_pending else None
        )
        since = timestamp(old.get("last_progress_at")) or now
        causes = []
        changed = False
        if complete and pending_count is not None:
            old_success = timestamp(old.get("last_success_at"))
            old_oldest = timestamp(old.get("oldest_due_at"))
            changed = bool(
                old.get("observation_complete")
                and (
                    (
                        pending_count
                        < (
                            old_pending
                            if old_pending is not None
                            else pending_count
                        )
                    )
                    or (
                        successful
                        and successful <= now
                        and (not old_success or successful > old_success)
                    )
                    or (
                        not track_pending
                        and oldest
                        and old_oldest
                        and oldest > old_oldest
                    )
                )
            )
            if (
                changed
                or not old.get("observation_complete")
                or not old_pending
                or not pending_count
            ):
                since = now
                if track_pending:
                    first_pending = now if pending_count else None
            if track_pending and pending_count and first_pending is None:
                first_pending = now
                since = now
            grace_elapsed = not track_pending or (
                first_pending is not None
                and (now - first_pending).total_seconds() >= grace
            )
            if (
                pending_count
                and grace_elapsed
                and (now - since).total_seconds() >= window
            ):
                causes.append(
                    "country_backlog_stalled"
                    if kind == "country"
                    else "publication_unacknowledged"
                )
            progress[scope_key] = {
                "last_progress_at": since.isoformat(),
                "count": count,
                "pending_count": pending_count,
                "first_pending_at": first_pending.isoformat()
                if first_pending
                else None,
                "oldest_due_at": oldest.isoformat() if oldest else None,
                "last_success_at": successful.isoformat()
                if successful
                else None,
                "last_observed_at": now.isoformat(),
                "observation_complete": True,
            }
        else:
            progress[scope_key] = {
                **old,
                "observation_complete": False,
                "last_observed_at": now.isoformat(),
            }
        classification = snapshot.get("last_failure_classification")
        if classification not in PUBLICATION_FAILURES:
            classification = None
        failed_at = dates.get("last_failure_at")
        active_failure = (
            kind == "publication"
            and snapshot.get("failure_unacknowledged") is True
            and failed_at
            and failed_at <= now
            and classification
        )
        if active_failure:
            causes.append(
                "publication_retry_exhausted"
                if classification in EXHAUSTED
                else "publication_failed"
            )
        source_success = dates.get("source_success_at")
        source_failures = (
            count_value(snapshot.get("source_failure_count")) or 0
        )
        stage = (
            "publication_after_source_success"
            if active_failure
            and source_success
            and source_success <= failed_at
            else "publication"
            if active_failure
            else "source"
            if source_failures
            else None
        )
        external = count_value(snapshot.get("external_failure_count")) or 0
        reported_oldest = oldest
        if track_pending:
            reported_oldest = (
                first_pending
                if pending_count
                and first_pending
                and (now - first_pending).total_seconds() >= grace
                else None
            )
        reports.append(
            {
                "path": f"f/monitoring/{kind}_backlog"
                + (f"_{media_type}" if media_type else ""),
                "media_type": media_type,
                "source_pipeline": "f/tmdb_web/tmdb_crawl_providers"
                if kind == "country"
                else "f/priority/crawl_all",
                "status": "unhealthy"
                if causes
                else "healthy"
                if complete
                else "unknown",
                "causes": causes,
                "latest_job_id": snapshot.get("latest_job_id"),
                "overdue_country_count": count if kind == "country" else 0,
                "overdue_title_count": titles,
                "unacknowledged_title_count": pending_count
                if kind == "publication"
                else None,
                "first_pending_at": first_pending.isoformat()
                if first_pending
                else None,
                "oldest_overdue_at": reported_oldest.isoformat()
                if reported_oldest
                else None,
                "oldest_overdue_age_seconds": max(
                    0, (now - reported_oldest).total_seconds() - grace
                )
                if reported_oldest
                else None,
                "outstanding_demand": count_value(
                    snapshot.get("outstanding_demand")
                )
                if kind == "publication"
                else None,
                "excluded": excluded,
                "grace_seconds": grace,
                "stall_window_seconds": window,
                "last_progress_at": since.isoformat(),
                "progress_observed": changed,
                "observation_complete": complete,
                "counts_are_lower_bounds": bool(
                    snapshot.get("lower_bound") or not complete
                ),
                "age_basis": "monitor_observation"
                if track_pending
                else "due_timestamp"
                if kind == "country"
                else snapshot["age_basis"]
                if snapshot.get("age_basis")
                in {"monitor_observation", "last_queue_update_lower_bound"}
                else "unacknowledged_timestamp",
                "external_failure_count": external,
                "external_failure_classification": "tolerable_external_backoff"
                if external and count == 0 and complete
                else "eligible_source_failures"
                if external and count
                else "unknown_external_failures"
                if external
                else None,
                "source_failure_count": source_failures,
                "failure_stage": stage,
                "last_failure_classification": classification,
                "failure_unacknowledged": bool(active_failure),
            }
        )
    return {"reports": reports, "progress": progress}


def main() -> None:
    """Import-only Windmill module."""
