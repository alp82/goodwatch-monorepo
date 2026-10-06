"""Where a scheduled copy starts reading changes: shortly before its last successful run (#194).

One document per job and media type in `sync_state`:

    {_id: "vector_data:movie", last_success_started_at,
     last_run: {started_at, finished_at, since, fallback, lookback_capped, counts}}

A run calls `begin` once, before it reads its selection, and copies the documents whose
`updated_at >= selection.since`. It calls `commit` only after every step for that job and
media type succeeded. A failed run writes nothing, so the next run starts from the same
place and covers the gap.

All times are naive UTC, like the `updated_at` fields the copies select on.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

STATE = "sync_state"
# A document can get its updated_at shortly before its write lands, so a run reads from
# this long before the last successful run started.
OVERLAP = timedelta(minutes=30)
# Without a state document (first run), the window every copy used before.
FALLBACK_WINDOW = timedelta(hours=48)
# A run never reaches further back than this. Older changes need a full copy.
MAX_LOOKBACK = timedelta(days=7)


@dataclass(frozen=True)
class Selection:
    """What one run of a job and media type selects, and the start time it commits."""

    state_id: str
    started_at: datetime
    since: datetime
    last_success_started_at: Optional[datetime]
    fallback: bool
    lookback_capped: bool

    @property
    def warning(self) -> Optional[str]:
        if not self.lookback_capped:
            return None
        return (
            f"{self.state_id} last succeeded with a run started at {self.last_success_started_at.isoformat()}, "
            f"more than {MAX_LOOKBACK.days} days ago. This run reads changes since {self.since.isoformat()} only; "
            f"earlier changes are not copied. Run a full copy to repair them."
        )

    def report(self) -> dict:
        """The selection for the job result."""
        report = {
            "started_at": self.started_at.isoformat(),
            "since": self.since.isoformat(),
            "last_success_started_at": (
                self.last_success_started_at.isoformat() if self.last_success_started_at else None),
            "fallback": self.fallback,
            "lookback_capped": self.lookback_capped,
        }
        if self.warning:
            report["warning"] = self.warning
        return report


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def state_id(job: str, media_type: str) -> str:
    return f"{job}:{media_type}"


def begin(db: Any, job: str, media_type: str, now: Optional[datetime] = None) -> Selection:
    """Take the run's start time and work out where its selection starts.

    Call it before the selection is read: a change written after `started_at` is left to
    the next run, which starts reading OVERLAP before this time.
    """
    started_at = now or utc_now()
    # Mongo keeps milliseconds; the time is cut here so the stored one equals it.
    started_at = started_at.replace(microsecond=started_at.microsecond // 1000 * 1000)
    key = state_id(job, media_type)
    state = db[STATE].find_one({"_id": key}) or {}
    last_success = state.get("last_success_started_at")
    oldest = started_at - MAX_LOOKBACK
    if last_success is None:
        since = started_at - FALLBACK_WINDOW
    else:
        since = max(last_success - OVERLAP, oldest)
    selection = Selection(
        state_id=key,
        started_at=started_at,
        since=since,
        last_success_started_at=last_success,
        fallback=last_success is None,
        lookback_capped=last_success is not None and last_success - OVERLAP < oldest,
    )
    if selection.fallback:
        print(f"{key}: no successful run recorded, reading changes since {since.isoformat()}", flush=True)
    elif selection.lookback_capped:
        print(f"!!! WARNING: {selection.warning}", flush=True)
    else:
        print(f"{key}: reading changes since {since.isoformat()}", flush=True)
    return selection


def commit(db: Any, selection: Selection, counts: dict, now: Optional[datetime] = None) -> None:
    """Record a run that succeeded in every step, so the next run starts from its start time.

    last_success_started_at only ever moves forward. A run that started before the recorded
    one (two runs overlapped) changes nothing.
    """
    db[STATE].update_one(
        {"_id": selection.state_id},
        {"$max": {"last_success_started_at": selection.started_at}},
        upsert=True,
    )
    db[STATE].update_one(
        {"_id": selection.state_id, "last_success_started_at": selection.started_at},
        {"$set": {"last_run": {
            "started_at": selection.started_at,
            "finished_at": now or utc_now(),
            "since": selection.since,
            "fallback": selection.fallback,
            "lookback_capped": selection.lookback_capped,
            "counts": counts,
        }}},
    )
