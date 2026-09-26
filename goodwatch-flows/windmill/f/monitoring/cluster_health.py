"""Pure CrateDB shard and disk assessment from read-only system table snapshots.

A replica that stops advancing its local checkpoint pins the primary's global
checkpoint. Retention leases then keep every soft-deleted document and the
translog above that checkpoint, so the shard grows with every update (the
2026-09 `movie` shard 8/9 incident). Disk watermarks stop shard allocation
and, at flood stage, block writes. Both are reported here before they bite.
"""

import re
from datetime import datetime
from typing import Any

from f.monitoring.health import timestamp

CHECKPOINT_LAG_OPS = 500_000
CHECKPOINT_STALL_SECONDS = 3600
# Ordinary in-flight writes keep a few ops between local and global checkpoint.
CHECKPOINT_STALL_FLOOR_OPS = 1_000
TRANSLOG_BYTES = 1_000_000_000
DISK_NEAR_WATERMARK_POINTS = 10
DEFAULT_WATERMARKS = {"low": 85.0, "high": 90.0, "flood_stage": 95.0}
SHARDS_PATH = "f/monitoring/crate_shards"
DISK_PATH = "f/monitoring/crate_disk"
DETAIL_LIMIT = 3


def shard_summaries(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Group sys.shards copies by shard; lag is measured on the started primary."""
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        key = f"{row['schema_name']}.{row['table_name']}#{row['id']}"
        grouped.setdefault(key, []).append(row)
    summaries = []
    for key, copies in grouped.items():
        primary = next(
            (
                c
                for c in copies
                if c.get("primary") and c.get("routing_state") == "STARTED"
            ),
            None,
        )
        if primary is None:
            continue
        local = primary.get("local_checkpoint") or 0
        global_ = primary.get("global_checkpoint") or 0
        summaries.append(
            {
                "shard": key,
                "primary_node": primary.get("node"),
                "replica_nodes": sorted(
                    c.get("node") or "?" for c in copies if not c.get("primary")
                ),
                "checkpoint_lag": max(0, local - global_),
                "global_checkpoint": global_,
                # A recovering copy replays a large translog; it is transient.
                "translog_bytes": max(
                    (c.get("translog_bytes") or 0)
                    for c in copies
                    if c.get("routing_state") in {"STARTED", "RELOCATING"}
                ),
            }
        )
    return sorted(summaries, key=lambda s: s["shard"])


def safe_detail(text: str) -> str | None:
    """Fit the notification detail allowlist; an invalid one blocks delivery."""
    text = re.sub(r"[^A-Za-z0-9_.#%(),;:+ -]", "_", text)[:300]
    return text or None


def watermark_percent(value: Any, default: float) -> float:
    """Percent watermarks only; absolute byte watermarks use the Crate default."""
    if isinstance(value, str):
        match = re.fullmatch(r"\s*([0-9]+(?:\.[0-9]+)?)\s*%\s*", value)
        if match:
            return float(match.group(1))
    return default


def assess_cluster(
    snapshot: dict[str, Any],
    previous_progress: dict[str, Any] | None,
    now: datetime,
) -> dict[str, Any]:
    previous = previous_progress or {}
    if snapshot.get("complete") is not True:
        return {
            "reports": [
                {
                    "path": path,
                    "status": "unknown",
                    "causes": [],
                    "latest_job_id": None,
                    "observation_complete": False,
                }
                for path in [SHARDS_PATH, DISK_PATH]
            ],
            "progress": previous,
        }
    progress: dict[str, Any] = {}
    affected = []
    causes: set[str] = set()
    for shard in snapshot.get("shards", []):
        key = shard["shard"]
        lag = shard["checkpoint_lag"]
        reasons = []
        if lag >= CHECKPOINT_STALL_FLOOR_OPS:
            old = previous.get(key) or {}
            since = timestamp(old.get("since"))
            if since is None or old.get("global_checkpoint") != shard["global_checkpoint"]:
                since = now
            progress[key] = {
                "global_checkpoint": shard["global_checkpoint"],
                "since": since.isoformat(),
            }
            if (now - since).total_seconds() >= CHECKPOINT_STALL_SECONDS:
                reasons.append("crate_checkpoint_stalled")
        if lag >= CHECKPOINT_LAG_OPS:
            reasons.append("crate_checkpoint_lag")
        if shard["translog_bytes"] >= TRANSLOG_BYTES:
            reasons.append("crate_translog_oversized")
        if reasons:
            causes.update(reasons)
            affected.append({**shard, "causes": reasons})
    affected.sort(
        key=lambda s: (s["checkpoint_lag"], s["translog_bytes"]), reverse=True
    )
    order = [
        "crate_checkpoint_lag",
        "crate_checkpoint_stalled",
        "crate_translog_oversized",
    ]
    shards_report = {
        "path": SHARDS_PATH,
        "status": "unhealthy" if causes else "healthy",
        "causes": [cause for cause in order if cause in causes],
        "latest_job_id": None,
        "observation_complete": True,
        "checkpoint_lag_ops": max(
            (s["checkpoint_lag"] for s in affected), default=0
        ),
        "translog_mb": max(
            (s["translog_bytes"] for s in affected), default=0
        )
        // 1_000_000,
        "detail": safe_detail(
            "; ".join(
                f"{s['shard']} lag {s['checkpoint_lag']} translog "
                f"{s['translog_bytes'] // 1_000_000}MB replica "
                f"{','.join(s['replica_nodes']) or 'none'}"
                for s in affected[:DETAIL_LIMIT]
            )
            + (
                f"; +{len(affected) - DETAIL_LIMIT} more"
                if len(affected) > DETAIL_LIMIT
                else ""
            )
        ),
        "affected_shards": affected,
        "thresholds": {
            "checkpoint_lag_ops": CHECKPOINT_LAG_OPS,
            "checkpoint_stall_seconds": CHECKPOINT_STALL_SECONDS,
            "translog_bytes": TRANSLOG_BYTES,
        },
    }

    marks = snapshot.get("watermarks") or {}
    low = watermark_percent(marks.get("low"), DEFAULT_WATERMARKS["low"])
    near = low - DISK_NEAR_WATERMARK_POINTS
    nodes = []
    for node in snapshot.get("nodes", []):
        total = node.get("total_bytes") or 0
        if total <= 0:
            continue
        used = 100 * (total - (node.get("available_bytes") or 0)) / total
        nodes.append((used, node.get("name") or "?"))
    nodes.sort(reverse=True)
    worst = nodes[0][0] if nodes else 0.0
    disk_causes = (
        ["crate_disk_watermark"]
        if worst >= low
        else ["crate_disk_near_watermark"]
        if worst >= near
        else []
    )
    disk_report = {
        "path": DISK_PATH,
        "status": "unhealthy"
        if disk_causes
        else "healthy"
        if nodes
        else "unknown",
        "causes": disk_causes,
        "latest_job_id": None,
        "observation_complete": bool(nodes),
        "disk_used_percent": int(worst),
        "detail": safe_detail(
            ", ".join(f"{name} {int(used)}%" for used, name in nodes)
            + f" (low watermark {low:g}%)"
        ),
        "thresholds": {"near_percent": near, "low_watermark_percent": low},
    }
    return {"reports": [shards_report, disk_report], "progress": progress}


def main() -> None:
    """Import-only Windmill module."""
