from f.db.qdrant import QdrantConnector
from f.sync.models.qdrant_schemas import (
    desired_media_collection,
    desired_payload_indexes,
    MEDIA_COLLECTION,
)


def init_qdrant():
    print("Starting Qdrant initialization...")
    qc = QdrantConnector()
    try:
        spec = desired_media_collection()
        # Create collection if missing
        qc.ensure_collection(
            name=spec.name,
            vectors={
                vname: {
                    "size": vs.size,
                    "distance": vs.distance,
                    "on_disk": vs.on_disk,
                }
                for vname, vs in spec.vectors.items()
            },
            shards=spec.shards,
            replication_factor=spec.replication_factor,
            write_consistency_factor=spec.write_consistency_factor,
            optimizers_config=spec.optimizers_config,
            hnsw_config=spec.hnsw_config,
        )

        # Create payload indexes (idempotent)
        for idx in desired_payload_indexes():
            qc.create_payload_index(MEDIA_COLLECTION, idx.field, idx.field_schema)

    except Exception as e:
        print(f"\nAn error occurred during Qdrant initialization: {e}")
        raise
    finally:
        qc.close()
        print("\nQdrant initialization process finished.")


def main():
    init_qdrant()
