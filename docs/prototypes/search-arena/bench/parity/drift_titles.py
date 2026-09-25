"""What changed in production for the titles behind a top-10 difference that the vote counts don't explain.

For each query attribute.py left as "other drift" or "approximation and drift", it takes the titles that differ
between the port's production top 10 and the prototype-with-production-votes top 10, reads them from production
Qdrant (read-only), and compares them with the arena snapshot: text vectors (cosine), raw fingerprint, the build's
vote count, or a point the snapshot lacks. It also lists the query's pool differences that aren't ties (pool_diff.py).

Usage (the arena's .venv; ARENA_DIR with the data; QDRANT_URL and QDRANT_API_KEY from goodwatch-webapp/.env,
or the file WEBAPP_ENV names):
  .venv/bin/python bench/parity/drift_titles.py <attribution.json> <proto-votes.json> <port-prod.json> \
      <pool-prod.json> <title_table.json.gz> [--out=<file.json>]
"""
import gzip, json, os, sys, urllib.request
from collections import Counter

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE)))))
ARENA = os.environ.get("ARENA_DIR", os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, os.path.join(ARENA, "harness"))
sys.path.insert(0, HERE)

import catalog as C  # noqa: E402
from compare import as_reference  # noqa: E402


def env():
    out = {}
    for line in open(os.environ.get("WEBAPP_ENV", os.path.join(REPO, "goodwatch-webapp", ".env"))):
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            out[k] = v.strip().strip('"').strip("'")
    return out


def points(ids):
    e = env()
    url = e["QDRANT_URL"].replace(":6334", ":6333").rstrip("/") + "/collections/media_fingerprint_v1/points"
    out = {}
    for i in range(0, len(ids), 200):
        body = {"ids": ids[i:i + 200], "with_payload": False,
                "with_vector": ["text_en_v1", "text_multi_v1", "fingerprint_v1_raw"]}
        req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json", "api-key": e["QDRANT_API_KEY"]})
        for p in json.loads(urllib.request.urlopen(req, timeout=60).read())["result"]:
            out[p["id"]] = p["vector"]
    return out


def cosine(a, b):
    a, b = np.asarray(a, np.float64), np.asarray(b, np.float64)
    return float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b)))


def main():
    att = json.load(open(sys.argv[1]))["production"]
    pv, pp = as_reference(sys.argv[2]), as_reference(sys.argv[3])
    pool = json.load(open(sys.argv[4]))["queries"]
    tt = json.load(gzip.open(sys.argv[5]))
    trow = {p: i for i, p in enumerate(tt["point_ids"])}
    cat = C.load()
    emb = {"text_en_v1": C.embeddings("bgeb-notitle"), "text_multi_v1": C.embeddings("me5s")}
    todo = {q: w for q, w in att.items() if w in ("other drift", "approximation and drift")}
    moved = {}
    for q in todo:
        a = [i for i, _ in pv[q]["top50"][:10]]
        b = [i for i, _ in pp[q]["top50"][:10]]
        moved[q] = sorted(set(a) ^ set(b))
    vecs = points(sorted({i for m in moved.values() for i in m}))

    def changes(pid):
        if pid not in cat.row_of:
            return ["new point"]
        r, v, out = cat.row_of[pid], vecs.get(pid) or {}, []
        for name, E in emb.items():
            if name in v and cosine(v[name], E[r]) < 0.999:
                out.append(f"{name} re-embedded (cosine {cosine(v[name], E[r]):.3f})")
        if "fingerprint_v1_raw" in v and not np.allclose(v["fingerprint_v1_raw"], cat.fps[r]):
            out.append("fingerprint regenerated")
        i = trow.get(pid)
        if i is not None and tt["votes"][i] != cat.votes[r]:
            out.append(f"votes {int(cat.votes[r])} -> {tt['votes'][i]}")
        return out

    report, tally = {}, Counter()
    for q in todo:
        titles = {pid: changes(pid) for pid in moved[q]}
        other = {k: n for k, n in pool.get(q, {}).get("classes", {}).items() if not k.startswith(("tie", "near", "mix"))}
        if any(titles.values()):
            cls = "changed titles"
        elif other:
            cls = "pool drift"
        else:
            cls = "ties only"
        tally[cls] += 1
        report[q] = {"attribution": todo[q], "class": cls, "titles": titles, "pool": other}
        print(q, cls, {k: v for k, v in titles.items() if v}, other)
    print(dict(tally))
    if len(sys.argv) > 6 and sys.argv[6].startswith("--out="):
        json.dump({"tally": tally, "queries": report}, open(sys.argv[6].split("=", 1)[1], "w"), indent=1)


if __name__ == "__main__":
    main()
