"""Bring the Qdrant collections in line with f/sync/models/qdrant_schemas.

- A missing collection is created with every vector and payload index.
- An existing collection gains the named vectors and payload indexes it lacks.
  Qdrant 1.19 adds a named vector in place, and existing points have no value
  for it until a writer sets one.
- Nothing is deleted or changed in place. A vector whose size, distance or
  datatype differs from the spec is reported, because fixing it means a new
  vector name.

Adding an empty vector is instant. Qdrant re-indexes when writers fill it:
backfilling a 74-float vector on all 191,634 titles took about a minute to write
and 2.5 minutes to re-index locally.

**Restart Qdrant right after adding a float16 vector in place.** Qdrant 1.19.1
gives existing segments the wrong storage type for it until the segments are
reloaded, so the first segment merge fails with "Cannot merge vector storage:
source is not a half dense storage" and the collection turns red. Searches keep
working, but the optimizer stops. A restart reloads the segments with float16
storage and merges succeed again. New collections are not affected.

Run with apply=True in a quiet hour, after checking that a recent snapshot exists.
"""

from qdrant_client import QdrantClient, models as qm

from f.db.qdrant import QdrantConnector
from f.sync.models.qdrant_schemas import (
    CollectionSpec,
    NamedVectorSpec,
    SparseVectorSpec,
    desired_collections,
)

DISTANCES = {
    "Cosine": qm.Distance.COSINE,
    "Dot": qm.Distance.DOT,
    "Euclid": qm.Distance.EUCLID,
}
DATATYPES = {
    "float32": qm.Datatype.FLOAT32,
    "float16": qm.Datatype.FLOAT16,
    "uint8": qm.Datatype.UINT8,
}
PAYLOAD_SCHEMAS = {
    "keyword": qm.PayloadSchemaType.KEYWORD,
    "integer": qm.PayloadSchemaType.INTEGER,
    "float": qm.PayloadSchemaType.FLOAT,
    "bool": qm.PayloadSchemaType.BOOL,
}


def vector_params(spec: NamedVectorSpec) -> qm.VectorParams:
    return qm.VectorParams(
        size=spec.size,
        distance=DISTANCES[spec.distance],
        on_disk=spec.on_disk,
        datatype=DATATYPES[spec.datatype],
        hnsw_config=qm.HnswConfigDiff(**spec.hnsw_config) if spec.hnsw_config else None,
    )


def sparse_vector_params(spec: SparseVectorSpec) -> qm.SparseVectorParams:
    return qm.SparseVectorParams(
        modifier=qm.Modifier.IDF if spec.modifier == "idf" else None,
    )


def _live_datatype(params: qm.VectorParams) -> str:
    return params.datatype.value if params.datatype else "float32"


def _live_modifier(params) -> str | None:
    modifier = getattr(params, "modifier", None)
    if modifier in (None, qm.Modifier.NONE):
        return None
    return modifier.value


def _hnsw_matches(live: qm.HnswConfigDiff | None, wanted: dict | None) -> bool:
    if not wanted:
        return True
    return live is not None and all(getattr(live, key) == value for key, value in wanted.items())


def plan_collection(client: QdrantClient, spec: CollectionSpec) -> dict:
    """What `apply_collection` would do, and any drift it can't fix."""
    if not client.collection_exists(spec.name):
        return {
            "collection": spec.name,
            "create": True,
            "add_vectors": list(spec.vectors),
            "add_sparse_vectors": list(spec.sparse_vectors),
            "set_vector_hnsw": [],
            "add_payload_indexes": [idx.field for idx in spec.payload_indexes],
            "conflicts": [],
            "not_in_spec": [],
        }

    info = client.get_collection(spec.name)
    live_vectors = info.config.params.vectors
    live_vectors = live_vectors if isinstance(live_vectors, dict) else {}
    live_sparse = info.config.params.sparse_vectors or {}
    conflicts = []
    set_hnsw = []
    for name, wanted in spec.vectors.items():
        live = live_vectors.get(name)
        if live is None:
            continue
        found = (live.size, live.distance.value, _live_datatype(live))
        expected = (wanted.size, wanted.distance, wanted.datatype)
        if found != expected:
            conflicts.append(f"{name}: live {found}, spec {expected}")
        elif not _hnsw_matches(live.hnsw_config, wanted.hnsw_config):
            set_hnsw.append(name)
    for name, wanted in spec.sparse_vectors.items():
        live = live_sparse.get(name)
        if live is not None and _live_modifier(live) != wanted.modifier:
            conflicts.append(f"{name}: live modifier {_live_modifier(live)}, spec {wanted.modifier}")

    live_indexes = info.payload_schema or {}
    return {
        "collection": spec.name,
        "create": False,
        "add_vectors": [name for name in spec.vectors if name not in live_vectors],
        "add_sparse_vectors": [name for name in spec.sparse_vectors if name not in live_sparse],
        "set_vector_hnsw": set_hnsw,
        "add_payload_indexes": [
            idx.field for idx in spec.payload_indexes if idx.field not in live_indexes
        ],
        "conflicts": conflicts,
        "not_in_spec": sorted(
            (set(live_vectors) - set(spec.vectors)) | (set(live_sparse) - set(spec.sparse_vectors))
        ),
    }


def apply_collection(client: QdrantClient, spec: CollectionSpec, plan: dict) -> None:
    if plan["conflicts"]:
        raise ValueError(f"{spec.name} differs from the spec: {plan['conflicts']}")

    if plan["create"]:
        client.create_collection(
            collection_name=spec.name,
            vectors_config={name: vector_params(v) for name, v in spec.vectors.items()},
            sparse_vectors_config={
                name: sparse_vector_params(v) for name, v in spec.sparse_vectors.items()
            } or None,
            shard_number=spec.shards,
            replication_factor=spec.replication_factor,
            write_consistency_factor=spec.write_consistency_factor,
            optimizers_config=(
                qm.OptimizersConfigDiff(**spec.optimizers_config) if spec.optimizers_config else None
            ),
            hnsw_config=qm.HnswConfigDiff(**spec.hnsw_config) if spec.hnsw_config else None,
        )
    else:
        for name in plan["add_vectors"]:
            wanted = spec.vectors[name]
            client.create_vector_name(
                collection_name=spec.name,
                vector_name=name,
                vector_name_config=qm.DenseVectorNameConfig(dense=qm.DenseVectorConfig(
                    size=wanted.size,
                    distance=DISTANCES[wanted.distance],
                    datatype=qm.VectorStorageDatatype(wanted.datatype),
                )),
                wait=True,
            )
        for name in plan["add_sparse_vectors"]:
            wanted = spec.sparse_vectors[name]
            client.create_vector_name(
                collection_name=spec.name,
                vector_name=name,
                vector_name_config=qm.SparseVectorNameConfig(sparse=qm.SparseVectorConfig(
                    modifier=qm.Modifier.IDF if wanted.modifier == "idf" else None,
                )),
                wait=True,
            )
        # Creating a named vector takes only its size, distance and datatype. Per-vector
        # HNSW and on-disk settings follow as a separate update.
        tuned = {
            name: qm.VectorParamsDiff(
                hnsw_config=qm.HnswConfigDiff(**spec.vectors[name].hnsw_config)
                if spec.vectors[name].hnsw_config else None,
                on_disk=spec.vectors[name].on_disk or None,
            )
            for name in plan["add_vectors"] + plan["set_vector_hnsw"]
            if spec.vectors[name].hnsw_config or spec.vectors[name].on_disk
        }
        if tuned:
            client.update_collection(collection_name=spec.name, vectors_config=tuned)

    indexes = {idx.field: idx for idx in spec.payload_indexes}
    for field in plan["add_payload_indexes"]:
        client.create_payload_index(
            collection_name=spec.name,
            field_name=field,
            field_schema=PAYLOAD_SCHEMAS[indexes[field].field_schema],
            wait=True,
        )


def reconcile(client: QdrantClient, specs: list[CollectionSpec], apply: bool) -> list[dict]:
    plans = [plan_collection(client, spec) for spec in specs]
    for plan in plans:
        print(plan)
    conflicts = [c for plan in plans for c in plan["conflicts"]]
    if conflicts:
        raise ValueError(f"Live collections differ from the spec: {conflicts}")
    if apply:
        for spec, plan in zip(specs, plans):
            apply_collection(client, spec, plan)
            print(f"Applied {spec.name}")
            half = [n for n in plan["add_vectors"] if spec.vectors[n].datatype == "float16"]
            if half and not plan["create"]:
                print(f"RESTART QDRANT NOW: {spec.name} gained float16 vectors {half} in place.")
    return plans


def main(apply: bool = False):
    """Print the changes; with apply=True, make them."""
    qc = QdrantConnector()
    try:
        return reconcile(qc.client, desired_collections(), apply)
    finally:
        qc.close()
