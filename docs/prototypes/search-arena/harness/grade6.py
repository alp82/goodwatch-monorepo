"""Round-6 grading bookkeeping: packets with credits and the style rubric flag, A/B agreement, assessor C, merges.

Usage:
  .venv/bin/python harness/grade6.py regrade-pool             # dev + holdout3 style/both pairs -> r6-regrade-part1(.rev).json
  .venv/bin/python harness/grade6.py compare <tag>            # r6-<tag>-A vs -B: kappa, disagreements, C packets
  .venv/bin/python harness/grade6.py merge <tag>              # add-only merge (new pairs)
  .venv/bin/python harness/grade6.py merge-regrade            # replace the re-graded pairs, old grades kept in
                                                              # pre-r6-style-grades.json
Grade = C when |A - B| >= 2, else floor((A + B) / 2).

Blindness: only the splits in SPLITS are read from queries.json unless a caller passes others explicitly.
"""
import hashlib, json, os, random, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import catalog as C  # noqa: E402
import grade4  # noqa: E402
import pool as P  # noqa: E402

G = os.path.join(C.ARENA, "results", "grading")
GRADES = os.path.join(C.ARENA, "results", "grades.json")
QUERIES = os.path.join(C.ARENA, "queries.json")
SPLITS = ("dev", "holdout", "holdout2", "holdout3")
REGRADE_SPLITS = ("dev", "holdout3")
STYLE = ("style", "both")


def load_queries(splits=SPLITS):
    for _ in range(5):
        try:
            qs = json.load(open(QUERIES))
            break
        except json.JSONDecodeError:
            time.sleep(1)   # another agent may be writing the file
    return [q for q in qs if q["split"] in splits]


def is_style(q):
    return q.get("person_intent") in STYLE


_pk = {}


def credits_packet(pid):
    import run5
    return run5.credits_packet(pid)


def make_packet(q, pids, names=None):
    cat = C.load()
    items = []
    for pid in pids:
        it = P.packet(cat, int(pid), (names or {}).get(int(pid), (str(pid), "", "movie")))
        it["credits"] = credits_packet(int(pid))
        items.append(it)
    items.sort(key=lambda it: it["pid"])
    seed = int(hashlib.sha256(f"{P.SEED}:{q['id']}".encode()).hexdigest()[:8], 16)
    random.Random(seed).shuffle(items)
    out = dict(query_id=q["id"], query=q["query"], intent=q.get("intent", ""), items=items)
    if is_style(q):
        out["person_intent"] = q["person_intent"]
        out["rubric"] = "style"
    return out


def write(tag, packets):
    json.dump(packets, open(os.path.join(G, f"r6-{tag}-part1.json"), "w"), ensure_ascii=False, indent=1)
    rev = [dict(p, items=list(reversed(p["items"]))) for p in reversed(packets)]
    json.dump(rev, open(os.path.join(G, f"r6-{tag}-part1-rev.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{tag}: {len(packets)} queries, {sum(len(p['items']) for p in packets)} pairs")


def _names():
    """Titles for pids outside the catalog, from the captures of the allowed splits."""
    import context as X
    names = {}
    for q in load_queries():
        cap = json.load(open(os.path.join(X.CAPTURES, f"{q['id']}.json")))
        for p in cap["prod"]:
            names[p["point_id"]] = (p["title"], p["year"], p["media_type"])
        for t in cap.get("titleLookup") or []:
            if t.get("type") in ("movie", "tv"):
                names.setdefault(C.point_id(t["type"], t["id"]), (t["title"], t.get("year"), "show" if t["type"] == "tv" else "movie"))
    return names


def regrade_targets():
    return [q for q in load_queries(REGRADE_SPLITS) if is_style(q)]


def regrade_pool():
    grades = json.load(open(GRADES))
    names = _names()
    packets = [make_packet(q, list(grades.get(q["id"], {})), names) for q in regrade_targets()]
    write("regrade", packets)


def _load(tag, who):
    return json.load(open(os.path.join(G, f"r6-{tag}-{who}-part1.json")))


def compare(tag):
    Ag, Bg = _load(tag, "A"), _load(tag, "B")
    packets = json.load(open(os.path.join(G, f"r6-{tag}-part1.json")))
    keys = [(p["query_id"], str(it["pid"])) for p in packets for it in p["items"]]
    miss = [(q, pid) for q, pid in keys if q not in Ag or pid not in Ag[q]] + \
           [(q, pid) for q, pid in keys if q not in Bg or pid not in Bg[q]]
    assert not miss, f"incomplete: {miss[:5]}"
    a = [int(Ag[q][pid]) for q, pid in keys]
    b = [int(Bg[q][pid]) for q, pid in keys]
    dis = {}
    for q, pid in keys:
        if abs(int(Ag[q][pid]) - int(Bg[q][pid])) >= 2:
            dis.setdefault(q, []).append(pid)
    json.dump(dis, open(os.path.join(G, f"r6-{tag}-disagreements.json"), "w"), indent=1)
    exact = sum(x == y for x, y in zip(a, b)) / len(a)
    n_dis = sum(len(v) for v in dis.values())
    print(f"{len(keys)} pairs, quadratic weighted kappa {grade4.qwk(a, b):.3f}, exact {exact:.1%}, {n_dis} pairs 2+ apart")
    cpk = [dict(p, items=[it for it in p["items"] if str(it["pid"]) in dis[p["query_id"]]]) for p in packets
           if p["query_id"] in dis]
    json.dump(cpk, open(os.path.join(G, f"r6-{tag}-C-packets.json"), "w"), ensure_ascii=False, indent=1)
    return grade4.qwk(a, b), n_dis


def merged(tag):
    Ag, Bg = _load(tag, "A"), _load(tag, "B")
    cp = os.path.join(G, f"r6-{tag}-C.json")
    Cg = json.load(open(cp)) if os.path.exists(cp) else {}
    packets = json.load(open(os.path.join(G, f"r6-{tag}-part1.json")))
    detail = {}
    for p in packets:
        q = p["query_id"]
        for it in p["items"]:
            pid = str(it["pid"])
            a, b = int(Ag[q][pid]), int(Bg[q][pid])
            c = Cg.get(q, {}).get(pid)
            if abs(a - b) >= 2:
                assert c is not None, f"missing C grade for {q} {pid}"
                g = int(c)
            else:
                g = (a + b) // 2
            detail.setdefault(q, {})[pid] = dict(A=a, B=b, C=c, grade=g)
    json.dump(detail, open(os.path.join(G, f"r6-{tag}-merged-detail.json"), "w"), indent=1)
    return detail


def merge(tag):
    detail = merged(tag)
    grades = json.load(open(GRADES))
    before = sum(len(v) for v in grades.values())
    added = 0
    for q, d in detail.items():
        for pid, x in d.items():
            if pid in grades.get(q, {}):
                continue
            grades.setdefault(q, {})[pid] = x["grade"]
            added += 1
    json.dump(grades, open(GRADES, "w"), indent=1)
    print(f"added {added}; grades.json {before} -> {sum(len(v) for v in grades.values())}")


def merge_regrade():
    detail = merged("regrade")
    grades = json.load(open(GRADES))
    backup = os.path.join(G, "pre-r6-style-grades.json")
    old = {q: dict(grades.get(q, {})) for q in detail}
    if not os.path.exists(backup):
        json.dump(old, open(backup, "w"), indent=1)
    else:
        old = json.load(open(backup))
    changed, n = 0, 0
    for q, d in detail.items():
        for pid, x in d.items():
            n += 1
            changed += old[q].get(pid) != x["grade"]
            grades[q][pid] = x["grade"]
    json.dump(grades, open(GRADES, "w"), indent=1)
    print(f"re-graded {n} pairs, {changed} changed; old grades in {backup}")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "regrade-pool":
        regrade_pool()
    elif cmd == "compare":
        compare(sys.argv[2])
    elif cmd == "merge":
        merge(sys.argv[2])
    elif cmd == "merge-regrade":
        merge_regrade()
