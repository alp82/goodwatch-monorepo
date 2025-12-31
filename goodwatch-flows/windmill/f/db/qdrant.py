from typing import Any, Dict, List, Optional, Tuple

import wmill
from qdrant_client import QdrantClient, models as qm


GRPC_OPTS: dict[str, object] = {
    # --- Keep the connection alive even when idle ---
    "grpc.keepalive_time_ms": 20_000,                     # send PING every 20s
    "grpc.keepalive_timeout_ms": 10_000,                  # wait 10s for ACK
    "grpc.keepalive_permit_without_calls": 1,             # allow PINGs with no active RPCs

    # --- Don’t throttle pings if there’s no data ---
    "grpc.http2.max_pings_without_data": 0,               # unlimited pings between data frames
    "grpc.http2.min_ping_interval_without_data_ms": 10_000,  # server-side throttle guard

    # --- Message sizes: allow very large batches ---
    "grpc.max_send_message_length": -1,                   # unlimited
    "grpc.max_receive_message_length": -1,                # unlimited

    # --- Reconnect/backoff to ride out transient network blips ---
    "grpc.enable_retries": 1,
    "grpc.initial_reconnect_backoff_ms": 1000,
    "grpc.min_reconnect_backoff_ms": 1000,
    "grpc.max_reconnect_backoff_ms": 30_000,

    # --- Keep channels from being torn down due to idleness/age at proxies ---
    "grpc.client_idle_timeout_ms": 0,                     # never go IDLE automatically
    "grpc.max_connection_idle_ms": 0,                     # disable idle shutdown
    "grpc.max_connection_age_ms": 0,                      # no forced rotation
    "grpc.max_connection_age_grace_ms": 0,

    # --- Make sure no HTTP proxy interferes (if any env is set) ---
    "grpc.enable_http_proxy": 0,
    "grpc.http_proxy": "",

    # (Optional) If you see HPACK issues on very chatty channels:
    # "grpc.http2.hpack_table_size.decoder": 65536,
    # "grpc.http2.hpack_table_size.encoder": 65536,
}


class QdrantConnector:
    def __init__(self):
        host = wmill.get_variable("u/Alp/QDRANT_HOST")
        port = wmill.get_variable("u/Alp/QDRANT_PORT")
        api_key = wmill.get_variable("u/Alp/QDRANT_API_KEY")
        use_grpc = True

        self.client = QdrantClient(
            host=host,
            port=port,
            api_key=api_key,
            prefer_grpc=use_grpc,
            https=False,
            timeout=None,
            grpc_options=GRPC_OPTS,
        )
        print("Connected to Qdrant")

    # ---- Collection helpers ----

    def collection_exists(self, name: str) -> bool:
        try:
            _ = self.client.get_collection(name)
            return True
        except Exception:
            return False

    def ensure_collection(
        self,
        name: str,
        vectors: Dict[str, Dict[str, Any]],
        shards: int = 2,
        replication_factor: int = 1,
        write_consistency_factor: int = 1,
        optimizers_config: Optional[dict] = None,
        hnsw_config: Optional[dict] = None,
    ) -> None:
        """
        Create the collection if it doesn't exist.

        `vectors` example:
        {
            "essence_text_v1": {"size": 768, "distance": "Cosine", "on_disk": False},
            "fingerprint_v1": {"size": 74,  "distance": "Cosine", "on_disk": False},
        }
        """
        if self.collection_exists(name):
            print(f"Collection '{name}' already exists. Skipping create.")
            return

        # Build the {name: VectorParams} mapping
        vector_params_map = {
            vname: qm.VectorParams(
                size=spec["size"],
                distance=qm.Distance(spec.get("distance", "Cosine")),
                on_disk=bool(spec.get("on_disk", False)),
            )
            for vname, spec in vectors.items()
        }

        print(f"Creating collection '{name}' with named vectors: {list(vector_params_map.keys())}")

        self.client.create_collection(
            collection_name=name,
            # IMPORTANT: pass the dict directly; do NOT instantiate qm.VectorsConfig (it's a typing.Union alias)
            vectors_config=vector_params_map,
            optimizers_config=qm.OptimizersConfigDiff(**optimizers_config) if optimizers_config else None,
            hnsw_config=qm.HnswConfigDiff(**hnsw_config) if hnsw_config else None,
            shard_number=shards,
            replication_factor=replication_factor,
            write_consistency_factor=write_consistency_factor,
        )

    def create_payload_index(self, collection: str, field: str, field_schema: str) -> None:
        """
        Idempotently create a payload index. If it exists, ignore the error.
        field_schema in {"keyword","integer","float","bool"}.
        """
        schema_map = {
            "keyword": qm.PayloadSchemaType.KEYWORD,
            "integer": qm.PayloadSchemaType.INTEGER,
            "float": qm.PayloadSchemaType.FLOAT,
            "bool": qm.PayloadSchemaType.BOOL,
        }
        t = schema_map[field_schema]
        try:
            print(f"Creating index on '{field}' ({field_schema})")
            self.client.create_payload_index(
                collection_name=collection,
                field_name=field,
                field_schema=t,
            )
        except Exception as e:
            msg = str(e).lower()
            if "already exists" in msg or "exists" in msg:
                print(f"Index for '{field}' already exists. Skipping.")
            else:
                raise

    # ---- Upsert / search ----

    def upsert_points(
        self,
        collection: str,
        items: List[Tuple[int, Dict[str, Any], Dict[str, List[float]]]],
        *,
        batch_size: int = 500,
        parallel: int = 8,
        max_retries: int = 2,
        wait: bool = True,
    ) -> None:
        """
        High-throughput uploader backed by `QdrantClient.upload_collection`.

        Args:
            collection: Qdrant collection name
            items: list of (point_id:int, payload:dict, vectors_dict: {name -> list[float]})
                   Example vectors_dict: {"essence_text_v1": [...], "fingerprint_v1": [...]}
            batch_size: per-request batch size for `upload_collection`
            parallel: parallel processes used by `upload_collection` (1 = no multiprocessing)
            max_retries: retries per batch inside `upload_collection`
            wait: if True, wait for each update to be applied on server (slower)
        """
        if not items:
            return

        # Build parallel lists
        ids: List[int] = []
        payloads: List[Dict[str, Any]] = []
        vectors_list: List[Dict[str, List[float]]] = []

        for pid, payload, vectors in items:
            if not isinstance(vectors, dict):
                raise TypeError(
                    f"Expected dict[name -> list[float]] for vectors of point {pid}, got {type(vectors)}"
                )
            # Qdrant requires int/UUID ids; enforce int
            ids.append(int(pid))
            payloads.append(payload)
            # Ensure floats & non-None lists
            named = {name: [float(x) for x in (vals or [])] for name, vals in vectors.items()}
            vectors_list.append(named)

        # Let the helper stream this chunk in sub-batches
        self.client.upload_collection(
            collection_name=collection,
            ids=ids,
            payload=payloads,
            vectors=vectors_list,
            batch_size=batch_size,   # per-request size inside the helper
            parallel=parallel,       # use 1 unless you really want multiprocessing
            max_retries=max_retries,
            wait=wait,
        )

    def search(
        self,
        collection: str,
        vector_name: str,
        query_vector: List[float],
        limit: int = 50,
        score_threshold: Optional[float] = None,
        filter_: Optional[qm.Filter] = None,
        with_payload: bool = False,
        with_vectors: bool = False,
    ):
        return self.client.search(
            collection_name=collection,
            query_vector=qm.NamedVector(name=vector_name, vector=query_vector),
            limit=limit,
            score_threshold=score_threshold,
            query_filter=filter_,
            with_payload=with_payload,
            with_vectors=with_vectors,
        )

    def scroll(
        self,
        collection: str,
        filter_: Optional[qm.Filter] = None,
        with_payload: bool = True,
        with_vectors: bool = False,
        limit: int = 1000,
        offset: Optional[Any] = None,
    ):
        return self.client.scroll(
            collection_name=collection,
            offset=offset,
            limit=limit,
            with_payload=with_payload,
            with_vectors=with_vectors,
            scroll_filter=filter_,
        )

    def close(self):
        try:
            self.client.close()
        except Exception:
            pass


def main():
    pass
