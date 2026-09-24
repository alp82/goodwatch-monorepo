"""Write fingerprint_v1_raw for every point in media_fingerprint_v1 that lacks it or disagrees.

The fingerprint publish (f/sync/copy/vector_data) writes fingerprint_v1_raw from the same
scores it stores in the `fingerprint_scores_v1` payload. Points published before the
vector existed have none. This script computes the vector from each point's payload with
the publish's own function, and writes only the vector: the payload and every other
vector stay as they are.

A publish that runs at the same time can write newer scores between this script's read
and its write. Run the script until it reports `written: 0`; the last run then proves that
every point's vector matches its payload.

Credentials come from the environment (QDRANT_URL with the REST or gRPC port,
QDRANT_API_KEY). `--dry-run` only counts.
"""
import argparse
import json
import os
import sys
import time
from contextlib import closing
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "windmill"))
from qdrant_client import QdrantClient, models as qm

from f.sync.copy.qdrant_retry import REQUEST_TIMEOUT_SECONDS, update_points, write_with_retry
from f.sync.copy.vector_data import _raw_fingerprint
from f.sync.models.qdrant_schemas import FINGERPRINT_RAW_VECTOR, MEDIA_COLLECTION

BATCH_SIZE = 1000


def stored_vector(point) -> list | None:
    vectors = point.vector if isinstance(point.vector, dict) else {}
    return vectors.get(FINGERPRINT_RAW_VECTOR)


def stale_points(batch) -> tuple[list[qm.PointStruct], int]:
    """Points whose raw vector is missing or differs from their payload scores."""
    stale, no_scores = [], 0
    for point in batch:
        scores = (point.payload or {}).get("fingerprint_scores_v1")
        expected = _raw_fingerprint(scores) if isinstance(scores, dict) else None
        if expected is None:
            no_scores += 1
            continue
        if stored_vector(point) != expected:
            stale.append(qm.PointStruct(id=point.id, vector={FINGERPRINT_RAW_VECTOR: expected}, payload=None))
    return stale, no_scores


def backfill(client: QdrantClient, collection: str, dry_run: bool) -> dict:
    vectors = client.get_collection(collection).config.params.vectors
    if FINGERPRINT_RAW_VECTOR not in vectors:
        raise SystemExit(f"{collection} has no {FINGERPRINT_RAW_VECTOR}; run f/sync/init/qdrant first")
    written = "would_write" if dry_run else "written"
    report = {"scanned": 0, written: 0, "no_scores": 0, "attempts": 0, "retries": 0, "errors": {}}
    started = time.monotonic()
    offset = None
    while True:
        batch, offset = client.scroll(
            collection_name=collection, limit=BATCH_SIZE, offset=offset,
            with_payload=["fingerprint_scores_v1"], with_vectors=[FINGERPRINT_RAW_VECTOR],
        )
        stale, no_scores = stale_points(batch)
        report["scanned"] += len(batch)
        report["no_scores"] += no_scores
        if stale and not dry_run:
            # update_points with payload=None writes only the named vector.
            result = write_with_retry(client, collection, update_points(stale), lambda: None)
            for field in ("attempts", "retries"):
                report[field] += result[field]
            for kind, count in result["errors"].items():
                report["errors"][kind] = report["errors"].get(kind, 0) + count
        report[written] += len(stale)
        print(json.dumps({"scanned": report["scanned"], "stale_in_batch": len(stale)}), flush=True)
        if offset is None:
            break
    report["seconds"] = round(time.monotonic() - started, 1)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--collection", default=MEDIA_COLLECTION)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    url = os.environ["QDRANT_URL"]
    with closing(QdrantClient(
        url=url, api_key=os.environ.get("QDRANT_API_KEY"), prefer_grpc=url.endswith(":6334"),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )) as client:
        print(json.dumps(backfill(client, args.collection, args.dry_run)))


if __name__ == "__main__":
    main()
