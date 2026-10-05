"""Pure assessment of the newest successful CrateDB snapshot.

A root cron job on the first Crate node runs `goodwatch-crate/backup.py` every
hour. Crate disables a snapshot repository after an I/O error, and then
`sys.snapshots` returns 0 rows without an error. That went unnoticed three
times, the last time from September 30 to October 5, 2026. So 0 rows and a
failed read are incidents here, not unknown health.
"""

from datetime import datetime, timezone
from typing import Any

from f.monitoring.cluster_health import safe_detail

BACKUP_PATH = "f/monitoring/crate_backup"
REPOSITORY = "goodwatch-db-backup-v2"
# The backup runs hourly, so 3 hours means at least two missed snapshots.
MAX_AGE_SECONDS = 3 * 3600


def assess_backup(observation: dict[str, Any], now: datetime) -> dict[str, Any]:
    """Return the report for the newest successful snapshot."""
    newest = observation.get("newest")
    age_hours = None
    if observation.get("complete") is not True:
        causes = ["crate_backup_unreadable"]
        detail = "sys.snapshots read failed or timed out"
    elif not newest or newest.get("finished") is None:
        causes = ["crate_backup_missing"]
        detail = "no successful snapshot listed; the repository may be disabled"
    else:
        finished = datetime.fromtimestamp(newest["finished"] / 1000, timezone.utc)
        age_seconds = max(0.0, (now - finished).total_seconds())
        age_hours = round(age_seconds / 3600, 1)
        causes = ["crate_backup_stale"] if age_seconds > MAX_AGE_SECONDS else []
        detail = (
            f"newest successful snapshot {newest.get('name')} finished "
            f"{finished:%Y-%m-%d %H:%M} UTC, {age_hours} hours ago "
            f"(limit {MAX_AGE_SECONDS // 3600} hours)"
        )
    return {
        "path": BACKUP_PATH,
        "status": "unhealthy" if causes else "healthy",
        "causes": causes,
        "latest_job_id": None,
        "observation_complete": observation.get("complete") is True,
        "newest_snapshot_age_hours": age_hours,
        "detail": safe_detail(detail),
        "thresholds": {"max_age_seconds": MAX_AGE_SECONDS},
    }


def main() -> None:
    """Import-only Windmill module."""
