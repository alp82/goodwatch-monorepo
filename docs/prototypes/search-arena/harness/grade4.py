"""Round-4 grading bookkeeping: A/B agreement, disagreements for assessor C, add-only merge into grades.json.

Usage:
  .venv/bin/python harness/grade4.py compare <tag>   # r4-<tag>-A-part1.json vs -B-part1.json -> kappa, r4-<tag>-disagreements.json
  .venv/bin/python harness/grade4.py merge <tag>     # + r4-<tag>-C.json -> r4-<tag>-merged-detail.json, add-only into grades.json
Grade = C when |A - B| >= 2, else floor((A + B) / 2).
"""
import json, os, sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import catalog as C  # noqa: E402

G = os.path.join(C.ARENA, "results", "grading")


def load(tag, who):
    return json.load(open(os.path.join(G, f"r4-{tag}-{who}-part1.json")))


def qwk(a, b, k=4):
    a, b = np.array(a), np.array(b)
    O = np.zeros((k, k))
    for x, y in zip(a, b):
        O[x, y] += 1
    W = np.array([[(i - j) ** 2 / (k - 1) ** 2 for j in range(k)] for i in range(k)])
    E = np.outer(O.sum(1), O.sum(0)) / O.sum()
    return 1 - (W * O).sum() / (W * E).sum()


def compare(tag):
    A, B = load(tag, "A"), load(tag, "B")
    packets = json.load(open(os.path.join(G, f"r4-{tag}-part1.json")))
    keys = [(p["query_id"], str(it["pid"])) for p in packets for it in p["items"]]
    assert all(q in A and pid in A[q] for q, pid in keys), "A incomplete"
    assert all(q in B and pid in B[q] for q, pid in keys), "B incomplete"
    a = [A[q][pid] for q, pid in keys]
    b = [B[q][pid] for q, pid in keys]
    dis = {}
    for q, pid in keys:
        if abs(A[q][pid] - B[q][pid]) >= 2:
            dis.setdefault(q, []).append(pid)
    json.dump(dis, open(os.path.join(G, f"r4-{tag}-disagreements.json"), "w"), indent=1)
    exact = sum(x == y for x, y in zip(a, b)) / len(a)
    print(f"{len(keys)} pairs, quadratic weighted kappa {qwk(a, b):.3f}, exact {exact:.1%}, "
          f"{sum(len(v) for v in dis.values())} pairs 2+ apart: {dis}")


def merge(tag):
    A, B = load(tag, "A"), load(tag, "B")
    cp = os.path.join(G, f"r4-{tag}-C.json")
    Cg = json.load(open(cp)) if os.path.exists(cp) else {}
    packets = json.load(open(os.path.join(G, f"r4-{tag}-part1.json")))
    gp = os.path.join(C.ARENA, "results", "grades.json")
    grades = json.load(open(gp))
    detail, added = {}, 0
    for p in packets:
        q = p["query_id"]
        for it in p["items"]:
            pid = str(it["pid"])
            a, b = A[q][pid], B[q][pid]
            c = Cg.get(q, {}).get(pid)
            if abs(a - b) >= 2:
                assert c is not None, f"missing C grade for {q} {pid}"
                g = c
            else:
                g = (a + b) // 2
            detail.setdefault(q, {})[pid] = dict(A=a, B=b, C=c, grade=g)
            if pid in grades.get(q, {}):
                continue  # add-only
            grades.setdefault(q, {})[pid] = g
            added += 1
    json.dump(detail, open(os.path.join(G, f"r4-{tag}-merged-detail.json"), "w"), indent=1)
    json.dump(grades, open(gp, "w"), indent=1)
    print(f"added {added} pairs; grades.json now {sum(len(v) for v in grades.values())} pairs")


if __name__ == "__main__":
    {"compare": compare, "merge": merge}[sys.argv[1]](sys.argv[2])
