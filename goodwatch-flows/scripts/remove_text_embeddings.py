"""Copy existing fingerprints/payloads to a collection without text vectors.

Use the runbook in docs/text-embedding-removal.md. Credentials stay in environment
variables. Writers must remain paused from copy through deployment and cleanup.
The copy never regenerates DNA or embeddings and never edits the source.
"""
import argparse
from contextlib import closing
import itertools
import json
import math
import os
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "windmill"))
from qdrant_client import QdrantClient, grpc, models as qm
from qdrant_client.qdrant_remote import QdrantRemote
from f.sync.models.qdrant_schemas import desired_payload_indexes

SOURCE = "media"
TARGET = "media_fingerprint_v1"
VECTOR = "fingerprint_v1"
BATCH_SIZE = 2000


def grpc_storage(client):
    return isinstance(client._client, QdrantRemote)


def retained_point(point):
    """Keep protobuf payloads intact instead of decoding/re-encoding every value."""
    vectors = point.vectors.vectors.vectors
    vector = vectors.get(VECTOR)
    data = list(vector.data or vector.dense.data) if vector is not None else None
    return SimpleNamespace(id=point.id.num if point.id.HasField("num") else point.id.uuid,
                           payload=point.payload, vector={VECTOR: data})


def vector_selector():
    return grpc.WithVectorsSelector(include=grpc.VectorsSelector(names=[VECTOR]))


def point_id(value):
    return grpc.PointId(num=value) if isinstance(value, int) else grpc.PointId(uuid=value)


def points(client, collection):
    offset = None
    while True:
        if grpc_storage(client):
            result = client.grpc_points.Scroll(grpc.ScrollPoints(
                collection_name=collection, limit=BATCH_SIZE, offset=offset,
                with_payload=grpc.WithPayloadSelector(enable=True),
                with_vectors=vector_selector()), timeout=180)
            yield from map(retained_point, result.result)
            if not result.HasField("next_page_offset"):
                break
            offset = result.next_page_offset
            continue
        batch, offset = client.scroll(collection_name=collection, limit=BATCH_SIZE,
                                      offset=offset, with_payload=True, with_vectors=[VECTOR])
        yield from batch
        if offset is None:
            break


def fingerprint(point):
    vector = point.vector.get(VECTOR) if isinstance(point.vector, dict) else None
    if not isinstance(vector, list) or len(vector) != 74 or not all(
        isinstance(v, (float, int)) and math.isfinite(v) for v in vector
    ):
        raise ValueError(f"Point {point.id} has no valid 74-dimensional fingerprint")
    return vector


def validate_target(client):
    vectors = client.get_collection(TARGET).config.params.vectors
    if set(vectors) != {VECTOR} or vectors[VECTOR].size != 74 or vectors[VECTOR].distance != qm.Distance.COSINE:
        raise ValueError("Destination schema must contain only the 74-dimensional cosine fingerprint")


def verify(client):
    validate_target(client)
    count = 0
    for source, target in itertools.zip_longest(points(client, SOURCE), points(client, TARGET)):
        if source is None or target is None or source.id != target.id:
            raise ValueError("Source and destination point IDs differ; keep writers paused")
        if source.payload != target.payload:
            raise ValueError(f"Payload differs for point {source.id}")
        if not all(math.isclose(a, b, rel_tol=1e-6, abs_tol=1e-7)
                   for a, b in zip(fingerprint(source), fingerprint(target))):
            raise ValueError(f"Fingerprint differs for point {source.id}")
        count += 1
    return {"verified_points": count, "source": SOURCE, "target": TARGET}


def copy(client):
    source = client.get_collection(SOURCE)
    if not client.collection_exists(TARGET):
        client.create_collection(
            collection_name=TARGET,
            vectors_config={VECTOR: source.config.params.vectors[VECTOR]},
            shard_number=source.config.params.shard_number,
            replication_factor=source.config.params.replication_factor,
            write_consistency_factor=source.config.params.write_consistency_factor,
            on_disk_payload=source.config.params.on_disk_payload,
            hnsw_config=(qm.HnswConfigDiff(**source.config.hnsw_config.model_dump())
                         if source.config.hnsw_config else None),
            optimizers_config=(qm.OptimizersConfigDiff(**source.config.optimizer_config.model_dump())
                               if source.config.optimizer_config else None),
        )
    validate_target(client)
    # Numeric indexes must exist before vector indexing builds filterable HNSW.
    existing = client.get_collection(TARGET).payload_schema
    for index in desired_payload_indexes():
        if index.field in existing and existing[index.field].data_type == index.field_schema:
            continue
        client.create_payload_index(TARGET, index.field, index.field_schema, wait=True)
    # Avoid repeatedly rebuilding HNSW during the bulk copy. Payload indexes
    # already exist, so the final graph incorporates their filtering edges.
    client.update_collection(TARGET, optimizers_config=qm.OptimizersConfigDiff(indexing_threshold=0))
    def write_batch(batch):
        if grpc_storage(client):
            result = client.grpc_points.Get(grpc.GetPoints(
                collection_name=TARGET, ids=[point_id(p.id) for p in batch],
                with_payload=grpc.WithPayloadSelector(enable=True),
                with_vectors=vector_selector()), timeout=180)
            existing = {p.id: p for p in map(retained_point, result.result)}
        else:
            existing = {p.id: p for p in client.retrieve(
                TARGET, ids=[p.id for p in batch], with_payload=True, with_vectors=[VECTOR])}
        changed = []
        for point in batch:
            old = existing.get(point.id)
            if old is not None and old.payload == point.payload:
                try:
                    if all(math.isclose(a, b, rel_tol=1e-6, abs_tol=1e-7)
                           for a, b in zip(fingerprint(old), point.vector[VECTOR])):
                        continue
                except ValueError:
                    pass
            changed.append(point)
        if changed:
            if grpc_storage(client):
                client.grpc_points.Upsert(grpc.UpsertPoints(
                    collection_name=TARGET, wait=True, points=[grpc.PointStruct(
                        id=point_id(p.id), payload=p.payload,
                        vectors=grpc.Vectors(vectors=grpc.NamedVectors(vectors={
                            VECTOR: grpc.Vector(data=p.vector[VECTOR])})))
                        for p in changed]), timeout=180)
            else:
                client.upsert(TARGET, [qm.PointStruct(
                    id=p.id, payload=p.payload, vector=p.vector) for p in changed], wait=True)

    batch = []
    count = 0
    for point in points(client, SOURCE):
        batch.append(SimpleNamespace(id=point.id, payload=point.payload,
                                     vector={VECTOR: fingerprint(point)}))
        if len(batch) == BATCH_SIZE:
            write_batch(batch)
            count += len(batch)
            batch = []
            print(json.dumps({"copied": count}), flush=True)
    if batch:
        write_batch(batch)
    threshold = source.config.optimizer_config.indexing_threshold if source.config.optimizer_config else 10000
    client.update_collection(TARGET, optimizers_config=qm.OptimizersConfigDiff(indexing_threshold=threshold))
    return verify(client)


def cleanup_mongo(database):
    counts = {}
    for name in ("dna_movie", "dna_tv"):
        # Keep essence text, tags, fingerprint, timestamps and queue state intact.
        result = database[name].update_many(
            {"vector_essence_text": {"$exists": True}},
            {"$unset": {"vector_essence_text": ""}},
        )
        counts[name] = result.modified_count
        if database[name].count_documents({"vector_essence_text": {"$exists": True}}):
            raise RuntimeError(f"Text vectors remain in {name}")
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["prefill", "copy", "verify", "cleanup-mongo", "delete-source"])
    parser.add_argument("--writers-paused", action="store_true")
    parser.add_argument("--deployment-verified", action="store_true")
    args = parser.parse_args()
    if args.phase not in ("prefill", "verify") and not args.writers_paused:
        parser.error("Pause and drain writers first; then pass --writers-paused")
    if args.phase == "cleanup-mongo":
        from pymongo import MongoClient
        with MongoClient(os.environ["MONGODB_URI"]) as mongo:
            print(json.dumps(cleanup_mongo(mongo.get_default_database())))
        return
    with closing(QdrantClient(url=os.environ["QDRANT_URL"], api_key=os.environ.get("QDRANT_API_KEY"), prefer_grpc=True, timeout=180)) as client:
        if args.phase in ("prefill", "copy"):
            print(json.dumps(copy(client)))
        elif args.phase == "verify":
            print(json.dumps(verify(client)))
        elif args.phase == "delete-source":
            if not args.deployment_verified:
                parser.error("Verify all deployed readers/writers use the destination before --deployment-verified")
            # Recheck every retained value immediately before removing the old collection.
            report = verify(client)
            client.delete_collection(SOURCE)
            print(json.dumps({**report, "deleted_source": True}))


if __name__ == "__main__":
    main()
