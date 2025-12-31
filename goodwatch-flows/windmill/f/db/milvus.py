from typing import Any, Iterable, List, Optional, Sequence

import wmill
from pymilvus import (
    connections,
    Collection,
    utility,
)

# Reasonable client channel hints; Milvus uses gRPC under the hood as well.
GRPC_OPTS = {
    "grpc.keepalive_time_ms": 20_000,
    "grpc.keepalive_timeout_ms": 10_000,
    "grpc.keepalive_permit_without_calls": 1,
    "grpc.http2.max_pings_without_data": 0,
    "grpc.http2.min_ping_interval_without_data_ms": 10_000,
    "grpc.max_send_message_length": -1,
    "grpc.max_receive_message_length": -1,
}

class MilvusConnector:
    def __init__(self, alias: str = "default"):
        host = wmill.get_variable("u/Alp/MILVUS_HOST") or "127.0.0.1"
        port = int(wmill.get_variable("u/Alp/MILVUS_PORT") or 19530)
        user = None
        password = None

        connections.connect(
            alias=alias,
            host=host,
            port=str(port),
            user=user,
            password=password,
            secure=False,  # set True if you enabled TLS
            client_kwargs={"grpc_options": GRPC_OPTS},
        )
        self.alias = alias
        print(f"Connected to Milvus at {host}:{port}")

    # ---- Collection helpers ----

    def has_collection(self, name: str) -> bool:
        return utility.has_collection(name, using=self.alias)

    def get_collection(self, name: str) -> Collection:
        return Collection(name, using=self.alias)

    def drop_collection(self, name: str) -> None:
        if self.has_collection(name):
            utility.drop_collection(name, using=self.alias)

    def load(self, name: str, replicas: int = 1):
        col = self.get_collection(name)
        col.load(replica_number=replicas)

    def release(self, name: str):
        self.get_collection(name).release()

    # ---- Data plane ----

    def upsert_rows(self, name: str, columnar_rows: Sequence[Sequence[Any]]):
        """
        Upsert using column-oriented data in the schema's field order.
        Milvus >= 2.3 supports upsert; pymilvus Collection.upsert is available in 2.4+.
        Fallback to insert if upsert not available (idempotent for same PK).
        """
        col = self.get_collection(name)
        if hasattr(col, "upsert"):
            mr = col.upsert(columnar_rows, timeout=None)
        else:
            mr = col.insert(columnar_rows, timeout=None)
        return mr

    def delete_by_ids(self, name: str, ids: Iterable[int]):
        col = self.get_collection(name)
        expr = f"id in [{','.join(str(i) for i in ids)}]"
        return col.delete(expr)

    def search(
        self,
        name: str,
        vector_field: str,
        queries: List[List[float]],
        limit: int = 50,
        expr: Optional[str] = None,
        output_fields: Optional[List[str]] = None,
        metric_type: str = "COSINE",
        index_params: Optional[dict] = None,
        search_params: Optional[dict] = None,
        offset: int = 0,
    ):
        """
        Wrap Collection.search
        """
        col = self.get_collection(name)
        _search_params = search_params or {"metric_type": metric_type, "params": {"ef": 64}}
        res = col.search(
            data=queries,
            anns_field=vector_field,
            param=_search_params,
            limit=limit,
            expr=expr,
            output_fields=output_fields or [],
            offset=offset,
            guarantee_timestamp=0,  # best-effort latest
        )
        return res

    def query(
        self,
        name: str,
        expr: str,
        output_fields: Optional[List[str]] = None,
        offset: int = 0,
        limit: int = 1000,
        order_by: Optional[str] = None,
    ):
        col = self.get_collection(name)
        return col.query(
            expr=expr,
            offset=offset,
            limit=limit,
            output_fields=output_fields or [],
            consistency_level="Bounded",
            order_by=order_by,
        )
