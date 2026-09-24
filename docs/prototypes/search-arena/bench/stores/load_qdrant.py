"""Load the catalog into three Qdrant collection variants that mirror production's `media_fingerprint_v1`.

Production settings (goodwatch-flows/windmill/f/sync/models/qdrant_schemas.py): 6 shards, 2 segments per shard,
indexing_threshold and full_scan_threshold 1000 KB, HNSW m 16 / ef_construct 200, the production payload indexes
(including `adult` bool and the 74 fingerprint_scores_v1.* integer indexes). Named vectors:
  fingerprint_v1  74-d Cosine (as production, identical in every variant)
  text_en         768-d Cosine, bge-base-en-v1.5 over the title's text without its title
  text_multi      384-d Cosine, multilingual-e5-small
Variants differ only in text_en / text_multi storage: float32, float16, float32 + int8 scalar quantization in RAM.

Timing: points are uploaded with indexing off (indexing_threshold 0), then the threshold goes to 1000 KB and the
index build is timed until the collection is green with every vector indexed.

Usage: .venv/bin/python bench/stores/load_qdrant.py [f32 f16 sq8 base]
(base: the fingerprint vector only, i.e. production today, as the memory / disk reference)
"""
import sys, time

import numpy as np
from qdrant_client import QdrantClient

import common as K

SHARDS = 6
OPT = dict(deleted_threshold=0.2, vacuum_min_vector_number=10000, default_segment_number=2)
HNSW = dict(m=16, ef_construct=200, full_scan_threshold=1000)
SQ8 = dict(scalar=dict(type="int8", quantile=0.99, always_ram=True))


def vectors_config(variant):
    text = {}
    if variant == "base":
        return dict(fingerprint_v1=dict(size=74, distance="Cosine", on_disk=False))
    for name, (_, dim) in K.EMB.items():
        v = dict(size=dim, distance="Cosine", on_disk=False)
        if variant == "f16":
            v["datatype"] = "float16"
        if variant == "sq8":
            v["quantization_config"] = SQ8
        text[name] = v
    return dict(fingerprint_v1=dict(size=74, distance="Cosine", on_disk=False), **text)


def payload_indexes():
    idx = [("tmdb_id", "integer"), ("media_type", "keyword"), ("title", "keyword"), ("original_title", "keyword"),
           ("genres", "keyword"), ("release_year", "integer"), ("release_decade", "integer"), ("is_anime", "bool"),
           ("adult", "bool"), ("production_method", "keyword")]
    idx += [(f, "bool") for f in K.BOOL_FLAGS if f != "is_anime"]
    idx += [("goodwatch_overall_score_normalized_percent", "float"),
            ("imdb_user_score_rating_count", "integer"), ("tmdb_user_score_rating_count", "integer"),
            ("goodwatch_overall_score_voting_count", "integer")]
    idx += [(f"fingerprint_scores_v1.{d}", "integer") for d in K.DIMS]
    return idx


def payload(r):
    fl = r.get("flags") or {}
    year = r.get("year")
    p = dict(
        tmdb_id=r["tmdb_id"], media_type=r["media_type"],
        title=[r["title"]] if r.get("title") else [], original_title=[r["original_title"]] if r.get("original_title") else [],
        poster_path=[r["poster_path"]] if r.get("poster_path") else [],
        genres=r.get("genres") or [], release_year=int(year) if year else None,
        release_decade=int(year) // 10 * 10 if year else None,
        adult=False, production_method=fl.get("production_method"),
        goodwatch_overall_score_normalized_percent=r.get("goodwatch_score"),
        goodwatch_overall_score_voting_count=r.get("votes") or 0,
        imdb_user_score_rating_count=r.get("imdb_votes"), tmdb_user_score_rating_count=r.get("tmdb_votes"),
        popularity=r.get("popularity"),
        tropes=r.get("tropes") or [],
        fingerprint_scores_v1={d: int((r.get("fingerprint_scores") or {}).get(d) or 0) for d in K.DIMS},
    )
    for f in K.BOOL_FLAGS:
        p[f] = fl.get(f)
    return p


def wait_indexed(http, name, expect, timeout=7200):
    t0 = time.time()
    while True:
        info = http.get(f"/collections/{name}").json()["result"]
        if (info["status"] == "green" and info["optimizer_status"] == "ok"
                and info.get("indexed_vectors_count", 0) >= expect):
            return time.time() - t0, info
        if time.time() - t0 > timeout:
            raise TimeoutError(info)
        time.sleep(2)


def load(variant, rows, vecs):
    name = dict(K.VARIANTS, **dict([K.BASE]))[variant]
    if variant == "base":
        vecs = {"fingerprint_v1": vecs["fingerprint_v1"]}
    http = K.client(K.QDRANT_URL)
    http.delete(f"/collections/{name}")
    body = dict(vectors=vectors_config(variant), shard_number=SHARDS, replication_factor=1,
                write_consistency_factor=1, optimizers_config=dict(OPT, indexing_threshold=0), hnsw_config=HNSW)
    r = http.put(f"/collections/{name}", json=body)
    r.raise_for_status()
    for field, schema in payload_indexes():
        http.put(f"/collections/{name}/index?wait=true", json=dict(field_name=field, field_schema=schema)).raise_for_status()

    before = K.container_rss(K.QDRANT_CONTAINER)
    qc = QdrantClient(url=K.QDRANT_URL, grpc_port=16334, prefer_grpc=True, timeout=600)
    t0 = time.time()
    qc.upload_collection(collection_name=name, ids=[r["id"] for r in rows], payload=[payload(r) for r in rows],
                         vectors=vecs, batch_size=256, parallel=4, wait=True)
    load_s = time.time() - t0
    n = http.post(f"/collections/{name}/points/count", json=dict(exact=True)).json()["result"]["count"]
    assert n == len(rows), (n, len(rows))

    t1 = time.time()
    http.patch(f"/collections/{name}", json=dict(optimizers_config=dict(indexing_threshold=1000))).raise_for_status()
    expect = n * len(vecs)   # indexed_vectors_count counts every named vector
    build_s, info = wait_indexed(http, name, expect)
    after = K.container_rss(K.QDRANT_CONTAINER)
    out = dict(
        collection=name, points=n, load_s=round(load_s, 1), index_build_s=round(build_s, 1),
        status=info["status"], indexed_vectors_count=info.get("indexed_vectors_count"),
        segments_count=info.get("segments_count"), config=info["config"],
        rss_before_load=before, rss_after_index=after,
        rss_delta_bytes=after["rss_bytes"] - before["rss_bytes"],
        disk_bytes=K.du(K.QDRANT_CONTAINER, f"/qdrant/storage/collections/{name}"),
    )
    print(variant, {k: out[k] for k in ("points", "load_s", "index_build_s", "segments_count", "disk_bytes",
                                         "rss_delta_bytes", "indexed_vectors_count")}, flush=True)
    return out


def main(variants):
    t = time.time()
    rows = K.catalog()
    vecs = {"fingerprint_v1": np.array([r["fingerprint"] for r in rows], np.float32)}
    for name, (f, dim) in K.EMB.items():
        a = np.load(f"{K.DATA}/{f}").astype(np.float32)
        assert a.shape == (len(rows), dim)
        vecs[name] = a
    print(f"catalog + embeddings read: {len(rows)} rows in {time.time() - t:.0f}s", flush=True)
    import json, os
    res = json.load(open(K.RESULT_FILE)).get("qdrant", {}) if os.path.exists(K.RESULT_FILE) else {}
    for v in variants:
        res[v] = load(v, rows, vecs)
        K.update_results("qdrant", res)


if __name__ == "__main__":
    main(sys.argv[1:] or list(K.VARIANTS))
