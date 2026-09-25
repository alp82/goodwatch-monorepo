"""A local copy of production's search stores holding the arena snapshot (2026-09-23 06:48 UTC), so the TypeScript
ranker can run on exactly the prototype's data.

It writes:
  - a Qdrant `media_fingerprint_v1` with the production vector names, payload fields and payload indexes:
    fingerprint_v1 (the catalog's normalized fingerprint), fingerprint_v1_raw (the raw scores), text_en_v1 and
    text_multi_v1 (the arena's stored embeddings), terms_bm25f_v1 (the prototype's own BM25F document weights, with
    the prototype's term columns as ids);
  - `search_reference_profiles`, from the production index builders run on the arena inputs;
  - a Crate blob table `search_index_files` and `search_index_builds` with one build of the ten index files, from the
    same builders (the parity check of #142 found them identical to the prototype's indexes on these inputs).

Two Qdrant layouts:
  exact  text vectors float32 and indexing off (indexing_threshold 0), eligible titles only: every search is a full scan,
         so what differs from the prototype is the port's logic, the int8 mix statistics and the query encodes.
  prod   production's settings (float16 text vectors, HNSW m 16, 6 shards, 2 segments, thresholds 1000 KB) and every
         catalog title: what differs from `exact` is the approximation.

Usage (the arena's .venv; ARENA_DIR with the data):
  .venv/bin/python bench/parity/mirror.py --qdrant=http://127.0.0.1:26333 --layout=exact --crate=http://127.0.0.1:34200
  .venv/bin/python bench/parity/mirror.py --qdrant=http://127.0.0.1:26343 --layout=prod
(--crate is optional: the index files only need writing once. --cache=<file> keeps the build between runs.)
"""
import gzip, hashlib, json, os, pickle, sys, time, urllib.error, urllib.request

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "indexes"))
import fidelity as F  # noqa: E402  (puts the arena harness and goodwatch-flows/windmill on sys.path)

C, M, SP, B = F.C, F.M, F.SP, F.B
CFG = F.CFG
DIMS_TEXT = {"text_en_v1": ("bgeb-notitle", 768), "text_multi_v1": ("me5s", 384)}
FLAGS = list(C.BOOL_FLAGS)


def arg(name, default=None):
    return F.arg(name, default)


def http(method, url, body=None, raw=None, headers=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    h = {"Content-Type": "application/json"} if raw is None else {}
    req = urllib.request.Request(url, data=data, method=method, headers={**h, **(headers or {})})
    with urllib.request.urlopen(req, timeout=600) as r:
        out = r.read()
    return json.loads(out) if out and raw is None else out


# === index build =======================================================================================

def arena_build():
    """The production builders on the arena inputs, with the prototype's BM25F term columns as term ids."""
    src, el = F.arena_sources()
    rows_idx, vocab, X, idf = SP.index(CFG["body"])
    src.term_ids = dict(vocab)

    def encode_intents(texts):
        prefix = B.QUERY_PREFIX
        return np.stack([M.embed(M.INTENT_EMB, t[len(prefix):]) for t in texts]).astype(np.float32)
    build = B.build_indexes(src, encode_intents=encode_intents)
    return build, el


def serialize(doc):
    raw = json.dumps(doc, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()
    return gzip.compress(raw, compresslevel=9, mtime=0)


def write_crate(crate, build):
    sql = lambda stmt, args=None: http("POST", f"{crate}/_sql", {"stmt": stmt, **({"args": args} if args else {})})
    sql("CREATE TABLE IF NOT EXISTS search_index_builds (build_id TEXT PRIMARY KEY, status TEXT, "
        "manifest TEXT INDEX OFF STORAGE WITH (columnstore = false), started_at TIMESTAMP, finished_at TIMESTAMP) "
        "CLUSTERED INTO 1 SHARDS")
    try:
        sql("CREATE BLOB TABLE search_index_files CLUSTERED INTO 3 SHARDS")
    except urllib.error.HTTPError:
        pass
    files = {name: serialize(doc) for name, doc in build.files.items()}
    entries = {}
    for name, data in files.items():
        sha1 = hashlib.sha1(data).hexdigest()
        entries[name] = {"sha1": sha1, "bytes": len(data)}
        try:
            http("PUT", f"{crate}/_blobs/search_index_files/{sha1}", raw=data)
        except urllib.error.HTTPError as e:
            if e.code != 409:   # already stored
                raise
    build_id = "arena" + time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    manifest = {"format": 1, "build_id": build_id, "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "previous_build_id": None, "files": entries,
                "profiles": {"collection": "search_reference_profiles", "points": len(build.profiles)},
                "stats": build.stats}
    sql("INSERT INTO search_index_builds (build_id, status, manifest) VALUES (?, ?, ?) ON CONFLICT (build_id) "
        "DO UPDATE SET status = excluded.status, manifest = excluded.manifest", ["current", "complete", json.dumps(manifest)])
    sql("REFRESH TABLE search_index_builds")
    print("crate: build", build_id, {k: v["bytes"] for k, v in entries.items()})


# === Qdrant ===============================================================================================

def media_config(layout):
    exact = layout == "exact"
    dense = lambda size, dist, dt: dict(size=size, distance=dist, on_disk=False,
                                        **({"datatype": dt} if dt != "float32" else {}))
    return {
        "vectors": {
            "fingerprint_v1": dense(74, "Cosine", "float32"),
            "fingerprint_v1_raw": {"size": 74, "distance": "Dot", "hnsw_config": {"m": 0}},
            "text_en_v1": dense(768, "Cosine", "float32" if exact else "float16"),
            "text_multi_v1": dense(384, "Cosine", "float32" if exact else "float16"),
        },
        "sparse_vectors": {"terms_bm25f_v1": {}},
        "shard_number": 6, "replication_factor": 1,
        "optimizers_config": {"deleted_threshold": 0.2, "vacuum_min_vector_number": 10000, "indexing_threshold": 0,
                              "default_segment_number": 2},
        "hnsw_config": {"m": 16, "ef_construct": 200, "full_scan_threshold": 1000},
    }


PAYLOAD_INDEXES = [("media_type", "keyword"), ("genres", "keyword"), ("release_year", "integer"), ("is_anime", "bool"),
                   ("adult", "bool"), ("production_method", "keyword"), ("goodwatch_overall_score_voting_count", "integer")] + \
                  [(f, "bool") for f in FLAGS if f != "is_anime"]


def recreate(qdrant, name, config):
    try:
        http("DELETE", f"{qdrant}/collections/{name}")
    except urllib.error.HTTPError:
        pass
    http("PUT", f"{qdrant}/collections/{name}", config)


def upload(qdrant, name, points, batch=500):
    for i in range(0, len(points), batch):
        http("PUT", f"{qdrant}/collections/{name}/points?wait=true", {"points": points[i:i + batch]})


def wait_green(qdrant, name, expect_indexed, timeout=3600):
    t0 = time.time()
    while time.time() - t0 < timeout:
        info = http("GET", f"{qdrant}/collections/{name}")["result"]
        if info["status"] == "green" and info.get("indexed_vectors_count", 0) >= expect_indexed:
            return time.time() - t0
        time.sleep(5)
    raise TimeoutError(name)


def write_qdrant(qdrant, layout, build):
    cat = C.load()
    rows_idx, vocab, X, idf = SP.index(CFG["body"])
    Xr = X.tocsr()
    pos = {int(r): i for i, r in enumerate(rows_idx)}
    el = cat.eligible()
    rows = np.flatnonzero(el) if layout == "exact" else np.arange(len(cat.ids))
    emb = {name: C.embeddings(m) for name, (m, _) in DIMS_TEXT.items()}
    recreate(qdrant, "media_fingerprint_v1", media_config(layout))
    for field, schema in PAYLOAD_INDEXES:
        http("PUT", f"{qdrant}/collections/media_fingerprint_v1/index?wait=true", {"field_name": field, "field_schema": schema})
    t0 = time.time()
    batch = []
    for r in rows:
        r = int(r)
        i = pos.get(r)
        sparse = {"indices": [], "values": []}
        if i is not None:
            row = Xr[i]
            order = np.argsort(row.indices)
            sparse = {"indices": row.indices[order].tolist(), "values": row.data[order].astype(float).tolist()}
        year = int(cat.year[r])
        payload = {"media_type": cat.media_type(r), "tmdb_id": int(cat.tmdb_id[r]), "adult": False,
                   "goodwatch_overall_score_voting_count": int(cat.votes[r]), "release_year": year or None,
                   "release_decade": year // 10 * 10 if year else None, "production_method": cat.production_method[r],
                   "genres": list(cat.genres[r] or [])}
        for f in FLAGS:
            v = int(cat.flags[f][r])
            payload[f] = None if v < 0 else bool(v)
        batch.append({"id": int(cat.ids[r]), "payload": payload, "vector": {
            "fingerprint_v1": cat.fp[r].astype(float).tolist(), "fingerprint_v1_raw": cat.fps[r].astype(float).tolist(),
            "text_en_v1": emb["text_en_v1"][r].astype(float).tolist(),
            "text_multi_v1": emb["text_multi_v1"][r].astype(float).tolist(), "terms_bm25f_v1": sparse}})
        if len(batch) == 500:
            upload(qdrant, "media_fingerprint_v1", batch)
            batch = []
    if batch:
        upload(qdrant, "media_fingerprint_v1", batch)
    if layout == "prod":
        # exact keeps indexing_threshold 0: no segment is ever indexed, so every search is a full scan
        http("PATCH", f"{qdrant}/collections/media_fingerprint_v1", {"optimizers_config": {"indexing_threshold": 1000}})
    print(f"qdrant {layout}: {len(rows)} points in {time.time() - t0:.0f} s")
    if layout == "prod":
        print(f"  indexed in {wait_green(qdrant, 'media_fingerprint_v1', 3 * len(rows)):.0f} s")
    exact = layout == "exact"
    recreate(qdrant, "search_reference_profiles", {
        "vectors": {"fingerprint_v1": {"size": 74, "distance": "Cosine"},
                    "text_en_v1": {"size": 768, "distance": "Cosine", **({} if exact else {"datatype": "float16"})}},
        "shard_number": 1, "replication_factor": 1})
    http("PUT", f"{qdrant}/collections/search_reference_profiles/index?wait=true", {"field_name": "kind", "field_schema": "keyword"})
    pts = [{"id": p["id"], "vector": {"fingerprint_v1": p["fingerprint_v1"].astype(float).tolist(),
                                      "text_en_v1": p["text_en_v1"].astype(float).tolist()},
            "payload": p["payload"]} for p in build.profiles]
    upload(qdrant, "search_reference_profiles", pts)
    print(f"  {len(pts)} reference profiles")


def main():
    t0 = time.time()
    cache = arg("cache")
    if cache and os.path.exists(cache):
        build = pickle.load(open(cache, "rb"))
    else:
        build, _ = arena_build()
        if cache:
            pickle.dump(build, open(cache, "wb"))
    print(f"built in {time.time() - t0:.0f} s: {json.dumps(build.stats)[:400]}")
    if arg("crate"):
        write_crate(arg("crate"), build)
    if arg("qdrant"):
        write_qdrant(arg("qdrant"), arg("layout", "exact"), build)


if __name__ == "__main__":
    main()
