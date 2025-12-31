from f.db.milvus import MilvusConnector
from f.sync.models.milvus_schemas import desired_media_collection, ensure_collection

def init_milvus():
    print("Starting Milvus initialization…")
    mc = MilvusConnector()
    try:
        spec = desired_media_collection()
        ensure_collection(mc, spec)
    finally:
        print("Milvus initialization finished.")

def main():
    init_milvus()
