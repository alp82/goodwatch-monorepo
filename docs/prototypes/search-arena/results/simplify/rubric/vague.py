"""Re-grade of vague and mood queries under GRADER.md's "Vague and mood queries" section, into a reversible overlay.

The overlay never touches results/grades.json. evalsimp applies it only when asked (see evalsimp-overlay.patch).

Usage (from docs/prototypes/search-arena, with .venv/bin/python):
  results/simplify/rubric/vague.py packets    # queries in vague-queries.json ->
      regrade-part1.json / -part1-rev.json: graded top-10 pairs of r6, r5, r4-combo-fast, plus the user's
                                            calibration pairs on these queries (blind; they check the rubric)
      regrade-part2.json / -part2-rev.json: every other graded pair of these queries (NDCG's ideal uses all graded
                                            pairs of a query, so a query should not mix old and new rubric grades)
  Assessor A grades regrade-partN.json -> regrade-A-partN.json, B grades regrade-partN-rev.json -> regrade-B-partN.json.
  results/simplify/rubric/vague.py compare    # A vs B over the parts present: kappa, pairs 2+ apart
                                              # -> regrade-C-packets.json (for the blind assessor C -> regrade-C.json)
  results/simplify/rubric/vague.py merge      # A/B(/C) of the parts present -> overlay.json: {"grades": {qid: {pid: new}},
                                              # "previous": {qid: {pid: grades.json value}}, "meta": {...}}
  results/simplify/rubric/vague.py diff       # changed pairs with titles, old -> new, and the human calibration check

Grade = C when |A - B| >= 2, else floor((A + B) / 2), as grade6.
"""
import json, os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ARENA = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(ARENA, "harness"))
import catalog as C  # noqa: E402
import context as X  # noqa: E402
import cuts  # noqa: E402
import grade4  # noqa: E402
import grade6  # noqa: E402

SPLITS = ("dev", "holdout", "holdout2", "holdout3", "holdout4")
LISTS = ("r6", "r5", "r4-combo-fast")
LIST_DIR = os.path.join(ARENA, "results", "simplify", "lists")
GRADES = os.path.join(ARENA, "results", "grades.json")
HUMAN = os.path.join(ARENA, "results", "grading", "human-calibration-grades.json")
OVERLAY = os.path.join(HERE, "overlay.json")
P = lambda name: os.path.join(HERE, name)


def targets():
    return json.load(open(P("vague-queries.json")))


def pairs():
    """{qid: [pid, ...]}: graded, first-cut titles in the top 10 of any list in LISTS, in first-seen order, then the
    user's calibration pairs of these queries."""
    grades = json.load(open(GRADES))
    human = json.load(open(HUMAN))
    lists = {n: json.load(open(os.path.join(LIST_DIR, f"{n}.json"))) for n in LISTS}
    out = {}
    for qid in targets():
        seen = []
        for n in LISTS:
            ids = [x["id"] for x in lists[n][qid]]
            second = set(cuts.second_cuts(ids, 10))
            for i, pid in enumerate(ids[:10]):
                if i not in second and str(pid) in grades.get(qid, {}) and pid not in seen:
                    seen.append(pid)
        seen += [int(h["pid"]) for h in human if h["query_id"] == qid and int(h["pid"]) not in seen]
        out[qid] = seen
    return out


def _write(part, by_q):
    qs = {q["id"]: q for q in grade6.load_queries(SPLITS)}
    names = X.outside_names()
    out = []
    for qid, pids in by_q.items():
        p = grade6.make_packet(qs[qid], pids, names)
        p["rubric"] = "vague"
        out.append(p)
    json.dump(out, open(P(f"regrade-{part}.json"), "w"), ensure_ascii=False, indent=1)
    rev = [dict(p, items=list(reversed(p["items"]))) for p in reversed(out)]
    json.dump(rev, open(P(f"regrade-{part}-rev.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{part}: {len(out)} queries, {sum(len(p['items']) for p in out)} pairs: "
          + ", ".join(f"{p['query_id']} {len(p['items'])}" for p in out))


def packets():
    grades = json.load(open(GRADES))
    first = pairs()
    rest = {q: [int(p) for p in sorted(grades[q]) if int(p) not in first[q]] for q in first}
    _write("part1", first)
    _write("part2", {q: v for q, v in rest.items() if v})


def _parts():
    return [pt for pt in ("part1", "part2") if os.path.exists(P(f"regrade-A-{pt}.json"))]


def _grades(who):
    out = {}
    for pt in _parts():
        for q, d in json.load(open(P(f"regrade-{who}-{pt}.json"))).items():
            out.setdefault(q, {}).update(d)
    return out


def _keys():
    return [(p["query_id"], str(it["pid"])) for pt in _parts() for p in json.load(open(P(f"regrade-{pt}.json")))
            for it in p["items"]]


def _packets():
    return [p for pt in _parts() for p in json.load(open(P(f"regrade-{pt}.json")))]


def compare():
    A, B = _grades("A"), _grades("B")
    keys = _keys()
    miss = [k for k in keys if k[1] not in A.get(k[0], {}) or k[1] not in B.get(k[0], {})]
    assert not miss, f"incomplete: {miss[:5]}"
    a, b = [int(A[q][p]) for q, p in keys], [int(B[q][p]) for q, p in keys]
    dis = {}
    for q, p in keys:
        if abs(int(A[q][p]) - int(B[q][p])) >= 2:
            dis.setdefault(q, []).append(p)
    cpk = [dict(pk, items=[it for it in pk["items"] if str(it["pid"]) in dis[pk["query_id"]]])
           for pk in _packets() if pk["query_id"] in dis]
    json.dump(cpk, open(P("regrade-C-packets.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(keys)} pairs, qwk {grade4.qwk(a, b):.3f}, exact {sum(x == y for x, y in zip(a, b)) / len(a):.1%}, "
          f"{sum(map(len, dis.values()))} pairs 2+ apart -> regrade-C-packets.json")


def merge():
    A, B = _grades("A"), _grades("B")
    Cg = json.load(open(P("regrade-C.json"))) if os.path.exists(P("regrade-C.json")) else {}
    old = json.load(open(GRADES))
    new, prev, detail = {}, {}, {}
    for q, p in _keys():
        a, b, c = int(A[q][p]), int(B[q][p]), Cg.get(q, {}).get(p)
        if abs(a - b) >= 2:
            assert c is not None, f"missing C grade for {q} {p}"
            g = int(c)
        else:
            g = (a + b) // 2
        new.setdefault(q, {})[p] = g
        prev.setdefault(q, {})[p] = old[q][p]
        detail.setdefault(q, {})[p] = dict(A=a, B=b, C=c, grade=g, previous=old[q][p])
    changed = sum(new[q][p] != prev[q][p] for q in new for p in new[q])
    n = sum(map(len, new.values()))
    meta = dict(rubric="GRADER.md 'Vague and mood queries'", queries=sorted(new), pairs=n, changed=changed,
                parts=_parts(), lists=list(LISTS), written=time.strftime("%Y-%m-%d %H:%M"))
    json.dump(dict(meta=meta, grades=new, previous=prev), open(OVERLAY, "w"), indent=1)
    json.dump(detail, open(P("regrade-merged-detail.json"), "w"), indent=1)
    print(f"overlay: {n} pairs, {changed} changed -> {OVERLAY}")


def diff():
    ov = json.load(open(OVERLAY))
    cat = C.load()
    names = X.outside_names()
    title = lambda pid: cat.title[cat.row_of[pid]] if pid in cat.row_of else names.get(pid, (str(pid),))[0]
    for q, d in ov["grades"].items():
        for p, g in d.items():
            if g != ov["previous"][q][p]:
                print(f"{q} {title(int(p))}: {ov['previous'][q][p]} -> {g}")
    for h in json.load(open(HUMAN)):
        g = ov["grades"].get(h["query_id"], {}).get(h["pid"])
        if g is not None:
            print(f"human check {h['query_id']} {title(int(h['pid']))}: user {h['grade']}, "
                  f"old {ov['previous'][h['query_id']][h['pid']]}, new {g}")


if __name__ == "__main__":
    {"packets": packets, "compare": compare, "merge": merge, "diff": diff}[sys.argv[1]]()
