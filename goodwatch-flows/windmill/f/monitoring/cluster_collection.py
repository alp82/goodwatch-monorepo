"""Read-only CrateDB system table snapshot for shard and disk monitoring."""

from typing import Any

from f.monitoring.cluster_health import shard_summaries


def collect_cluster(db: Any) -> dict[str, Any]:
    """Return shard summaries, node disk usage and watermarks, or incomplete."""
    try:
        rows = db.select("""SELECT schema_name, table_name, id, "primary",
            node['name'] AS node, routing_state,
            seq_no_stats['local_checkpoint'] AS local_checkpoint,
            seq_no_stats['global_checkpoint'] AS global_checkpoint,
            translog_stats['size'] AS translog_bytes
            FROM sys.shards""")
        nodes = db.select("""SELECT name, fs['total']['size'] AS total_bytes,
            fs['total']['available'] AS available_bytes FROM sys.nodes""")
        cluster = db.select("""SELECT
            settings['cluster']['routing']['allocation']['disk']['watermark']
            AS watermark FROM sys.cluster""")
    except Exception:
        return {"complete": False}
    return {
        "complete": True,
        "shards": shard_summaries(rows),
        "nodes": nodes,
        "watermarks": (cluster[0].get("watermark") if cluster else None) or {},
    }


def main() -> None:
    """Import-only Windmill module."""
