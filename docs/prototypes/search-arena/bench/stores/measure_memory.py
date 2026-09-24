"""Resident memory per Qdrant variant, measured in isolation.

searchbench-qdrant holds all three collections, so its RSS is their sum. For a per-variant number this stops it,
copies its storage volume with only one collection into a scratch volume, starts a throwaway Qdrant 1.19.1
(`searchbench-qdrant-measure`, no host ports) on the copy, waits for the collection to load, reads RSS / docker stats
idle and after 50 warm-up queries, and removes it. An empty-storage Qdrant gives the baseline. Finally
searchbench-qdrant restarts and its RSS with all collections (three variants + base) is recorded too.

Usage: .venv/bin/python bench/stores/measure_memory.py
"""
import json, subprocess, time

import common as K

IMAGE = "qdrant/qdrant:v1.19.1"
TMP = "searchbench-qdrant-measure"
TMP_VOL = "searchbench-qdrant-measure-data"


def sh(*args, check=True):
    return subprocess.run(list(args), capture_output=True, text=True, check=check).stdout.strip()


def ip(container):
    return sh("docker", "inspect", "-f", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}", container)


def wait_ready(base, names, timeout=600):
    t0 = time.time()
    c = K.client(base, timeout=10)
    while time.time() - t0 < timeout:
        try:
            ok = all(c.get(f"/collections/{n}").json()["result"]["status"] in ("green", "grey") for n in names)
            if ok and c.get("/readyz").status_code == 200:
                return time.time() - t0
        except Exception:
            pass
        time.sleep(1)
    raise TimeoutError(names)


def warm(base, name, n=50):
    c = K.client(base, timeout=60)
    if name == K.BASE[1]:
        for i in range(n):
            c.post(f"/collections/{name}/points/query", json=dict(query=[(i * 7 + j) % 11 / 10 for j in range(74)],
                   using="fingerprint_v1", limit=500, with_payload=False)).raise_for_status()
        return
    qemb = json.load(open(f"{K.DATA}/query-emb-bge-base-en-v1.5.json"))
    qm = list(json.load(open(f"{K.DATA}/query-emb-multilingual-e5-small.json")).values())
    for i, q in enumerate(list(qemb)[:n]):
        c.post(f"/collections/{name}/points/query", json=dict(query=qemb[q], using="text_en", limit=500,
                                                             with_payload=False)).raise_for_status()
        c.post(f"/collections/{name}/points/query", json=dict(query=qm[i % len(qm)], using="text_multi", limit=500,
                                                             with_payload=False)).raise_for_status()


def isolated(name):
    sh("docker", "rm", "-f", TMP, check=False)
    sh("docker", "volume", "rm", TMP_VOL, check=False)
    sh("docker", "volume", "create", TMP_VOL)
    keep = f"collections/{name}" if name else ""
    script = ("cp -a /src/. /dst/ && cd /dst/collections && for d in *; do "
              f"[ \"collections/$d\" = \"{keep}\" ] || rm -rf \"$d\"; done; ls /dst/collections")
    sh("docker", "run", "--rm", "-v", "searchbench-qdrant-data:/src:ro", "-v", f"{TMP_VOL}:/dst", "--entrypoint",
       "sh", IMAGE, "-c", script)
    sh("docker", "run", "-d", "--name", TMP, "-v", f"{TMP_VOL}:/qdrant/storage", IMAGE)
    base = f"http://{ip(TMP)}:6333"
    load_s = wait_ready(base, [name] if name else [])
    time.sleep(10)
    out = dict(startup_s=round(load_s, 1), idle=dict(**K.container_rss(TMP), **K.docker_stats(TMP)))
    if name:
        warm(base, name)
        time.sleep(3)
        out["after_warmup"] = dict(**K.container_rss(TMP), **K.docker_stats(TMP), smaps=K.smaps(TMP))
        out["telemetry_memory"] = K.client(base).get("/telemetry?details_level=1").json()["result"].get("memory")
    sh("docker", "rm", "-f", TMP)
    sh("docker", "volume", "rm", TMP_VOL)
    return out


def main():
    sh("docker", "stop", K.QDRANT_CONTAINER)
    res = {}
    try:
        res["baseline_empty"] = isolated(None)
        print("baseline", res["baseline_empty"], flush=True)
        for v, name in list(K.VARIANTS.items()) + [K.BASE]:
            res[v] = isolated(name)
            print(v, res[v], flush=True)
    finally:
        sh("docker", "start", K.QDRANT_CONTAINER)
    t = wait_ready(K.QDRANT_URL, list(K.VARIANTS.values()) + [K.BASE[1]])
    time.sleep(10)
    res["all_three_after_restart"] = dict(startup_s=round(t, 1), **K.container_rss(K.QDRANT_CONTAINER),
                                          **K.docker_stats(K.QDRANT_CONTAINER), smaps=K.smaps(K.QDRANT_CONTAINER),
                                          telemetry_memory=K.client(K.QDRANT_URL).get(
                                              "/telemetry?details_level=1").json()["result"].get("memory"))
    print("all", res["all_three_after_restart"], flush=True)
    K.update_results("qdrant_memory", res)
    K.update_results("crate_memory", crate_after_restart())


def crate_after_restart():
    """CrateDB RSS / heap after a restart, idle and after 20 BM25 queries (the JVM commits most of its 4 GB heap)."""
    sh("docker", "restart", K.CRATE_CONTAINER)
    c = K.client(K.CRATE_URL, timeout=10)
    sql = lambda s, a=None: c.post("/_sql", json={"stmt": s, "args": a or []}).json()
    t0 = time.time()
    while True:
        try:
            if sql(f"SELECT health FROM sys.health WHERE table_name = 'search_title'")["rows"][0][0] == "GREEN":
                break
        except Exception:
            pass
        time.sleep(1)
    start = time.time() - t0
    time.sleep(10)
    heap = lambda: dict(zip(("heap_used_bytes", "heap_committed_bytes"),
                            sql("SELECT heap['used'], heap['max'] FROM sys.nodes")["rows"][0]))
    idle = dict(**K.container_rss(K.CRATE_CONTAINER), **K.docker_stats(K.CRATE_CONTAINER), **heap())
    qemb = json.load(open(f"{K.DATA}/query-emb-bge-base-en-v1.5.json"))
    for q in list(qemb)[:20]:
        sql(f"SELECT id, _score FROM {K.CRATE_TABLE} WHERE MATCH((tags 2, keywords 2, tropes 1, essence_text 1), ?) "
            "USING most_fields ORDER BY _score DESC LIMIT 300", [q])
    time.sleep(3)
    out = dict(startup_s=round(start, 1), idle=idle,
               after_queries=dict(**K.container_rss(K.CRATE_CONTAINER), **K.docker_stats(K.CRATE_CONTAINER), **heap()))
    print("crate", out, flush=True)
    return out


if __name__ == "__main__":
    main()
