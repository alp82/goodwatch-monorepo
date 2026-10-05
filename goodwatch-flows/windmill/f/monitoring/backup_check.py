"""Hourly check that a recent successful CrateDB snapshot exists.

This is a script of its own, not a part of `f/monitoring/check`: a read of
`sys.snapshots` takes 15 to 90 seconds on the backup repository, which doesn't
fit the five-minute check's budget, and an hourly backup needs no five-minute
check. The slow read runs before the script takes the monitoring lease, so the
five-minute check is blocked for a few seconds at most.
"""

from datetime import datetime, timezone
from threading import Thread
from time import sleep as wait
from typing import Any, Callable

from f.monitoring.backup_health import REPOSITORY, assess_backup
from f.monitoring.incidents import record_incident

# Measured on October 5, 2026: 15 to 90 seconds. The Windmill job timeout is
# 600 seconds and covers this read plus the wait for the lease.
READ_TIMEOUT_SECONDS = 240
# The five-minute check holds the lease for about 140 seconds of every 300.
LEASE_WAIT_SECONDS = 240
LEASE_RETRY_SECONDS = 10


def collect_backup(db: Any) -> dict[str, Any]:
    """Return the newest successful snapshot, or incomplete on a failed read."""
    try:
        rows = db.select(
            """SELECT name, finished FROM sys.snapshots
            WHERE repository = ? AND state = 'SUCCESS'
            ORDER BY finished DESC LIMIT 1""",
            (REPOSITORY,),
        )
    except Exception:
        return {"complete": False}
    return {"complete": True, "newest": rows[0] if rows else None}


def bounded(
    collect: Callable[[], dict[str, Any]], timeout_seconds: float
) -> dict[str, Any]:
    """Run the read in a daemon thread; a read that hangs counts as failed."""
    result: list[dict[str, Any]] = []

    def run() -> None:
        try:
            result.append(collect())
        except Exception:
            pass

    thread = Thread(target=run, daemon=True)
    thread.start()
    thread.join(timeout_seconds)
    return result[0] if result else {"complete": False}


def check_backup(
    collect: Callable[[], dict[str, Any]],
    store: Any,
    webhook_url: str | None,
    *,
    clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    read_timeout_seconds: float = READ_TIMEOUT_SECONDS,
    lease_wait_seconds: float = LEASE_WAIT_SECONDS,
    sleep: Callable[[float], None] = wait,
) -> dict[str, Any]:
    observation = bounded(collect, read_timeout_seconds)
    report = assess_backup(observation, clock())
    store.initialize()
    waited = 0.0
    while not store.acquire():
        if waited >= lease_wait_seconds:
            # A failed job is visible in Windmill and to the five-minute check.
            raise RuntimeError("Monitoring lease busy; backup report not recorded")
        sleep(LEASE_RETRY_SECONDS)
        waited += LEASE_RETRY_SECONDS
    try:
        now = clock()
        report["observed_at"] = now.isoformat()
        report["notification"] = record_incident(store, report, now, webhook_url)
    finally:
        store.release()
    return report


def main(notify: bool = True) -> dict[str, Any]:
    import wmill
    from f.db.cratedb import CrateConnector
    from f.monitoring.store import MonitoringStore

    webhook = None
    if notify:
        try:
            webhook = wmill.get_variable("f/monitoring/discord_webhook_url")
        except Exception:
            pass

    # The read gets its own connection: if it hangs, the store's stays usable.
    return check_backup(
        lambda: collect_backup(CrateConnector()), MonitoringStore(), webhook
    )
