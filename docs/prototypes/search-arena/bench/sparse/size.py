"""Size of the `terms_bm25f` sparse vector on Qdrant: disk (per component, from the live collection, before vs after the
add) and resident memory (measured in isolation, with and without the sparse vector).

.venv/bin/python bench/sparse/size.py [disk] [memory]
  disk    bench/stores/disk.py's breakdown of media_fingerprint_v1_f16 now vs out/mem_before.json (taken before upload)
  memory  stops searchbench-qdrant for the copy only (about a minute), restarts it, then runs a throwaway Qdrant on a
          copy holding only media_fingerprint_v1_f16: RSS / smaps / jemalloc telemetry after warm-up (dense and sparse
          queries), then DELETE /collections/{c}/vectors/terms_bm25f on the copy, restart, warm-up, measure again
"""
import json, os, sys, time

from common import ARENA, COLLECTION, OUT, VECTOR, update_result

sys.path.insert(0, os.path.join(ARENA, "bench", "stores"))
import common as K  # noqa: E402  (bench/stores/common.py; ours is already imported as `common`)
import disk  # noqa: E402
import measure_memory as MM  # noqa: E402

if not hasattr(K, "smaps"):   # `common` resolved to bench/sparse/common.py: load the stores one explicitly
    import importlib.util
    spec = importlib.util.spec_from_file_location("stores_common", os.path.join(ARENA, "bench", "stores", "common.py"))
    K = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(K)
    MM.K = K
    disk.K = K


def mib(b):
    return round(b / 2 ** 20, 1)


def disk_step():
    before = json.load(open(os.path.join(OUT, "mem_before.json")))["disk"]
    after = disk.breakdown(COLLECTION)
    comp = {k: v for k, v in after["allocated_bytes"].items() if VECTOR in k}
    app = {k: v for k, v in after["apparent_bytes"].items() if VECTOR in k}
    res = dict(allocated_mib={k: mib(v) for k, v in comp.items()}, apparent_mib={k: mib(v) for k, v in app.items()},
               sparse_total_allocated_mib=mib(sum(comp.values())),
               collection_total_allocated_mib_before=mib(before["total_allocated_bytes"]),
               collection_total_allocated_mib_after=mib(after["total_allocated_bytes"]),
               wal_mib_before=mib(before["allocated_bytes"].get("wal", 0)),
               wal_mib_after=mib(after["allocated_bytes"].get("wal", 0)),
               after=after)
    print(json.dumps({k: v for k, v in res.items() if k != "after"}, indent=1), flush=True)
    update_result("disk", res)


def sparse_warm(base, n=300):
    ops = json.load(open(os.path.join(OUT, "latency_ops.json")))
    c = K.client(base, timeout=60)
    for o in ops[:n]:
        body = dict(query=o["sparse"], using=VECTOR, with_payload=False)
        if o["kind"] == "bm25_topk":
            body.update(filter=o["filter"], limit=300)
        else:
            body.update(filter=dict(must=[dict(has_id=o["ids"])]), limit=len(o["ids"]))
        c.post(f"/collections/{COLLECTION}/points/query", json=body).raise_for_status()


def measure(base):
    MM.warm(base, COLLECTION)
    if VECTOR in (K.client(base).get(f"/collections/{COLLECTION}").json()["result"]["config"]["params"]
                  .get("sparse_vectors") or {}):
        sparse_warm(base)
    time.sleep(3)
    sm = K.smaps(MM.TMP)
    return dict(**K.container_rss(MM.TMP), smaps_anon=sm["anon"],
                smaps_collection={k: v for k, v in sm.get(COLLECTION, {}).items()},
                telemetry_memory=K.client(base).get("/telemetry?details_level=1").json()["result"].get("memory"))


def memory_step():
    sh = MM.sh
    sh("docker", "rm", "-f", MM.TMP, check=False)
    sh("docker", "volume", "rm", MM.TMP_VOL, check=False)
    sh("docker", "volume", "create", MM.TMP_VOL)
    script = ("cp -a /src/. /dst/ && cd /dst/collections && for d in *; do "
              f"[ \"$d\" = \"{COLLECTION}\" ] || rm -rf \"$d\"; done; ls /dst/collections")
    sh("docker", "stop", K.QDRANT_CONTAINER)
    try:
        sh("docker", "run", "--rm", "-v", "searchbench-qdrant-data:/src:ro", "-v", f"{MM.TMP_VOL}:/dst",
           "--entrypoint", "sh", MM.IMAGE, "-c", script)
    finally:
        sh("docker", "start", K.QDRANT_CONTAINER)
    res = {}
    try:
        sh("docker", "run", "-d", "--name", MM.TMP, "-v", f"{MM.TMP_VOL}:/qdrant/storage", MM.IMAGE)
        base = f"http://{MM.ip(MM.TMP)}:6333"
        res["with_sparse"] = dict(startup_s=round(MM.wait_ready(base, [COLLECTION]), 1))
        time.sleep(10)
        res["with_sparse"].update(measure(base))
        print("with sparse", mib(res["with_sparse"]["rss_bytes"]), flush=True)
        c = K.client(base, timeout=600)
        c.delete(f"/collections/{COLLECTION}/vectors/{VECTOR}", params=dict(wait="true")).raise_for_status()
        t0 = time.time()
        while c.get(f"/collections/{COLLECTION}").json()["result"]["status"] != "green":
            time.sleep(2)
        res["delete_wait_s"] = round(time.time() - t0, 1)
        sh("docker", "restart", MM.TMP)
        base = f"http://{MM.ip(MM.TMP)}:6333"
        res["without_sparse"] = dict(startup_s=round(MM.wait_ready(base, [COLLECTION]), 1))
        time.sleep(10)
        res["without_sparse"].update(measure(base))
        print("without sparse", mib(res["without_sparse"]["rss_bytes"]), flush=True)
    finally:
        sh("docker", "rm", "-f", MM.TMP, check=False)
        sh("docker", "volume", "rm", MM.TMP_VOL, check=False)
    w, wo = res["with_sparse"], res["without_sparse"]
    res["delta_mib"] = dict(
        rss=mib(w["rss_bytes"] - wo["rss_bytes"]), rss_anon=mib(w["rss_anon_bytes"] - wo["rss_anon_bytes"]),
        rss_file=mib(w["rss_file_bytes"] - wo["rss_file_bytes"]),
        jemalloc_allocated=mib(w["telemetry_memory"]["allocated_bytes"] - wo["telemetry_memory"]["allocated_bytes"]),
        sparse_mmap_resident={k: mib(v) for k, v in w["smaps_collection"].items() if VECTOR in k})
    print(json.dumps(res["delta_mib"], indent=1), flush=True)
    MM.wait_ready(K.QDRANT_URL, [COLLECTION])
    update_result("memory", res)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["disk", "memory"]
    if "disk" in steps:
        disk_step()
    if "memory" in steps:
        memory_step()
