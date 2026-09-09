"""CrateDB queue leases. Ranking may be stale; full-key OCC decides ownership."""

from uuid import uuid4

COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000
LEASE_MS = 2 * 60 * 60 * 1000
MAX_RETRIES = 8
CANDIDATE_PAGE_SIZE = 100


def read_entry(db, media_type, tmdb_id):
    rows = db.select(
        """SELECT demand, acknowledged_demand, claimed_demand, lease_token,
                  CAST(lease_expires_at AS BIGINT) AS lease_expires_ms,
                  CAST(last_success_at AS BIGINT) AS last_success_ms,
                  CAST(current_timestamp AS BIGINT) AS now_ms,
                  _seq_no, _primary_term
           FROM crawl_priority WHERE media_type = ? AND tmdb_id = ?""",
        (media_type, tmdb_id),
    )
    return rows[0] if rows else None


def candidate_ids(db, media_type, offset=0):
    return [
        row["tmdb_id"]
        for row in db.select(
            """SELECT tmdb_id FROM crawl_priority
           WHERE media_type = ? AND demand > acknowledged_demand
             AND (last_success_at IS NULL OR CAST(last_success_at AS BIGINT) < CAST(current_timestamp AS BIGINT) - ?)
             AND (lease_expires_at IS NULL OR lease_expires_at <= current_timestamp)
           ORDER BY demand - acknowledged_demand DESC, tmdb_id ASC LIMIT ? OFFSET ?""",
            (media_type, COOLDOWN_MS, CANDIDATE_PAGE_SIZE, offset),
        )
    ]


def claim(db, media_type, tmdb_id, *, explicit=False):
    if media_type not in ("movie", "show") or int(tmdb_id) <= 0:
        raise ValueError("Invalid queue key")
    tmdb_id = int(tmdb_id)
    if explicit:
        db.run(
            """INSERT INTO crawl_priority
               (media_type, tmdb_id, demand, acknowledged_demand, claimed_demand, created_at, updated_at)
               VALUES (?, ?, 0, 0, 0, current_timestamp, current_timestamp)
               ON CONFLICT (media_type, tmdb_id) DO NOTHING""",
            (media_type, tmdb_id),
        )
    token = str(uuid4())
    for _ in range(MAX_RETRIES):
        row = read_entry(db, media_type, tmdb_id)
        if row is None:
            return None
        now = row["now_ms"]
        if row["lease_expires_ms"] is not None and row["lease_expires_ms"] > now:
            return None
        if not explicit and (
            row["demand"] <= row["acknowledged_demand"]
            or (
                row["last_success_ms"] is not None
                and row["last_success_ms"] >= now - COOLDOWN_MS
            )
        ):
            return None
        db.run(
            """UPDATE crawl_priority SET lease_token = ?, lease_expires_at = ?,
               claimed_demand = ?, updated_at = current_timestamp
               WHERE media_type = ? AND tmdb_id = ? AND _seq_no = ? AND _primary_term = ?""",
            (
                token,
                now + LEASE_MS,
                row["demand"],
                media_type,
                tmdb_id,
                row["_seq_no"],
                row["_primary_term"],
            ),
        )
        if db.cur.rowcount == 1:
            return {
                "media_type": media_type,
                "tmdb_id": tmdb_id,
                "lease_token": token,
                "claimed_demand": row["demand"],
            }
    return None


def acknowledge(db, lease):
    """Never let an old worker acknowledge a replacement lease or newer demand."""
    for _ in range(MAX_RETRIES):
        row = read_entry(db, lease["media_type"], lease["tmdb_id"])
        if (
            row is None
            or row["lease_token"] != lease["lease_token"]
            or row["claimed_demand"] != lease["claimed_demand"]
            or row["lease_expires_ms"] is None
            or row["lease_expires_ms"] <= row["now_ms"]
        ):
            raise RuntimeError(
                "Priority lease expired or ownership changed; demand was not acknowledged"
            )
        db.run(
            """UPDATE crawl_priority SET acknowledged_demand = ?,
               last_success_at = current_timestamp, lease_token = NULL,
               lease_expires_at = NULL, updated_at = current_timestamp
               WHERE media_type = ? AND tmdb_id = ? AND _seq_no = ? AND _primary_term = ?""",
            (
                lease["claimed_demand"],
                lease["media_type"],
                lease["tmdb_id"],
                row["_seq_no"],
                row["_primary_term"],
            ),
        )
        if db.cur.rowcount == 1:
            return
    raise RuntimeError(
        "Priority acknowledgment conflicted repeatedly; demand was retained"
    )


def release(db, lease):
    """Release a selection aborted before crawling without acknowledging demand."""
    for _ in range(MAX_RETRIES):
        row = read_entry(db, lease["media_type"], lease["tmdb_id"])
        if row is None or row["lease_token"] != lease["lease_token"]:
            return
        db.run(
            """UPDATE crawl_priority SET lease_token = NULL, lease_expires_at = NULL,
               updated_at = current_timestamp WHERE media_type = ? AND tmdb_id = ?
               AND _seq_no = ? AND _primary_term = ?""",
            (
                lease["media_type"],
                lease["tmdb_id"],
                row["_seq_no"],
                row["_primary_term"],
            ),
        )
        if db.cur.rowcount == 1:
            return
    raise RuntimeError("Could not release priority lease after selection failed")


def main():
    pass
