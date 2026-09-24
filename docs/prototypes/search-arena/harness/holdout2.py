"""Holdout-2 evaluation of the frozen round-4 finalists (evaluation-contract.md, Winning + Notes).

Usage:
  .venv/bin/python harness/holdout2.py lists            # frozen run4.FINAL configs on holdout2 -> results/holdout2/lists
  .venv/bin/python harness/pool.py holdout2 holdout2    # blinded packets -> results/holdout2/pool-holdout2.json
  .venv/bin/python harness/holdout2.py packets          # grading/ho2-part{1,2}.json (pool order) + -rev (reversed)
  .venv/bin/python harness/holdout2.py compare          # A vs B kappa, ho2-disagreements.json
  .venv/bin/python harness/holdout2.py merge            # + ho2-C.json -> ho2-merged-detail.json, add-only grades.json
  .venv/bin/python harness/holdout2.py metrics          # results/holdout2/metrics-tables.md + metrics.json

No ranker code or config changes: configs are run4.FINAL as frozen in round 4. `prod` is the captured list.
"""
import json, math, os, statistics, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import anchors as A  # noqa: E402
import catalog as C  # noqa: E402
import context as X  # noqa: E402
import metrics as M  # noqa: E402

SPLIT = "holdout2"
OUT = os.path.join(C.ARENA, "results", "holdout2")
LISTS = os.path.join(OUT, "lists")
G = os.path.join(C.ARENA, "results", "grading")
FINALISTS = ["r4-combo", "r4-combo-fast"]
REFS = ["r3-combo", "r3-combo-fast"]
NAMES = ["prod"] + FINALISTS + REFS
PARTS = 2


def ctxs():
    return [c for c in X.contexts() if c.split == SPLIT]


def lists():
    import run, run4
    os.makedirs(LISTS, exist_ok=True)
    cs = ctxs()
    json.dump({c.id: run.prod_list(c) for c in cs}, open(os.path.join(LISTS, "prod.json"), "w"), ensure_ascii=False)
    timings = {}
    for name in FINALISTS + REFS:
        kw, bk = run4.FINAL[name]
        ls, ms = run4.run(kw, {**run4.STRICT, **bk}, cs)
        json.dump(ls, open(os.path.join(LISTS, f"{name}.json"), "w"), ensure_ascii=False)
        v = sorted(ms.values())
        timings[name] = {"mean_ms": statistics.mean(v), "p95_ms": v[int(0.95 * len(v)) - 1], "max_ms": v[-1]}
        print(name, len(ls), "lists", flush=True)
    json.dump(timings, open(os.path.join(OUT, "timings.json"), "w"), indent=1)


def packets():
    pool = json.load(open(os.path.join(OUT, f"pool-{SPLIT}.json")))
    pool = [p for p in pool if p["items"]]
    total = sum(len(p["items"]) for p in pool)
    parts, cur, n = [], [], 0
    for p in pool:
        cur.append(p)
        n += len(p["items"])
        if n >= total * (len(parts) + 1) / PARTS and len(parts) < PARTS - 1:
            parts.append(cur)
            cur = []
    parts.append(cur)
    for i, part in enumerate(parts, 1):
        json.dump(part, open(os.path.join(G, f"ho2-part{i}.json"), "w"), ensure_ascii=False, indent=1)
        rev = [dict(p, items=list(reversed(p["items"]))) for p in reversed(part)]
        json.dump(rev, open(os.path.join(G, f"ho2-part{i}-rev.json"), "w"), ensure_ascii=False, indent=1)
        print(f"part{i}: {len(part)} queries, {sum(len(p['items']) for p in part)} pairs")


def _load(who):
    out = {}
    for i in range(1, PARTS + 1):
        for q, d in json.load(open(os.path.join(G, f"ho2-{who}-part{i}.json"))).items():
            out.setdefault(q, {}).update({str(k): int(v) for k, v in d.items()})
    return out


def _keys():
    return [(p["query_id"], str(it["pid"])) for i in range(1, PARTS + 1)
            for p in json.load(open(os.path.join(G, f"ho2-part{i}.json"))) for it in p["items"]]


def compare():
    import grade4
    Ag, Bg = _load("A"), _load("B")
    keys = _keys()
    assert all(q in Ag and pid in Ag[q] for q, pid in keys), "A incomplete"
    assert all(q in Bg and pid in Bg[q] for q, pid in keys), "B incomplete"
    a = [Ag[q][pid] for q, pid in keys]
    b = [Bg[q][pid] for q, pid in keys]
    dis = {}
    for q, pid in keys:
        if abs(Ag[q][pid] - Bg[q][pid]) >= 2:
            dis.setdefault(q, []).append(pid)
    json.dump(dis, open(os.path.join(G, "ho2-disagreements.json"), "w"), indent=1)
    exact = sum(x == y for x, y in zip(a, b)) / len(a)
    print(f"{len(keys)} pairs, quadratic weighted kappa {grade4.qwk(a, b):.3f}, exact {exact:.1%}, "
          f"{sum(len(v) for v in dis.values())} pairs 2+ apart: {dis}")


def merge():
    Ag, Bg = _load("A"), _load("B")
    cp = os.path.join(G, "ho2-C.json")
    Cg = json.load(open(cp)) if os.path.exists(cp) else {}
    gp = os.path.join(C.ARENA, "results", "grades.json")
    grades = json.load(open(gp))
    before = sum(len(v) for v in grades.values())
    detail, added = {}, 0
    for q, pid in _keys():
        a, b = Ag[q][pid], Bg[q][pid]
        c = Cg.get(q, {}).get(pid)
        if abs(a - b) >= 2:
            assert c is not None, f"missing C grade for {q} {pid}"
            g = int(c)
        else:
            g = (a + b) // 2
        detail.setdefault(q, {})[pid] = dict(A=a, B=b, C=c, grade=g)
        if pid in grades.get(q, {}):
            continue  # add-only
        grades.setdefault(q, {})[pid] = g
        added += 1
    json.dump(detail, open(os.path.join(G, "ho2-merged-detail.json"), "w"), indent=1)
    json.dump(grades, open(gp, "w"), indent=1)
    print(f"added {added} pairs; grades.json {before} -> {sum(len(v) for v in grades.values())} pairs")


def fmt(x, d=3):
    return "–" if x is None or (isinstance(x, float) and math.isnan(x)) else f"{x:.{d}f}"


# Estimated added p50 after the reading (round-4 stage model / latency design note) and whole-search p95
# (Jev reading p95 ~440 ms + post-reading p95).
P50 = {"prod": "235 ms", "r4-combo": "156 ms", "r4-combo-fast": "30-45 ms", "r3-combo": "156 ms", "r3-combo-fast": "30-45 ms"}
P95_POST = {"prod": 460, "r4-combo": 510, "r4-combo-fast": 100, "r3-combo": 510, "r3-combo-fast": 100}


def metrics():
    cs = ctxs()
    ls = M.load_lists(SPLIT)
    grades = M.load_grades()
    graded = [c for c in cs if c.type != "title_lookup"]
    missing = [c.id for c in graded if c.id not in grades]
    assert not missing, f"ungraded queries: {missing}"
    per_q = {n: {c.id: M.graded_query([x["id"] for x in ls[n][c.id]], grades[c.id]) for c in graded} for n in NAMES}
    mean = lambda n, key, cc=graded: sum(per_q[n][c.id][key] for c in cc) / len(cc)
    row = {}
    for n in NAMES:
        s = A.summarize(cs, ls[n], SPLIT, ("title_lookup",))
        ok, tn = M.title_guardrail(cs, ls[n], SPLIT)
        losses = sorted((per_q[n][c.id]["ndcg10"] - per_q["prod"][c.id]["ndcg10"], c.id) for c in graded
                        if per_q[n][c.id]["ndcg10"] - per_q["prod"][c.id]["ndcg10"] < -0.15)
        row[n] = dict(ndcg10=mean(n, "ndcg10"), good10=mean(n, "good10"), bad5=sum(per_q[n][c.id]["bad5"] for c in graded),
                      unj10=sum(per_q[n][c.id]["unj10"] for c in graded), anchor10=s["anchor10"], anchor50=s["anchor50"],
                      avoid5=s["avoid5"], title=f"{ok}/{tn}", losses=losses)
    L = [f"| ranker | ndcg10 | Δ vs prod | good10 | bad5 | anchor10 | anchor50 | avoid5 | title@1 | unj10 | "
         "queries < prod − 0.15 | est. p50 after reading | est. p95 whole search |",
         "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for n in NAMES:
        r = row[n]
        loss = ", ".join(f"{q} {d:+.3f}" for d, q in r["losses"]) or "none"
        L.append(f"| {n} | {fmt(r['ndcg10'])} | {r['ndcg10'] - row['prod']['ndcg10']:+.3f} | {fmt(r['good10'], 2)} | {r['bad5']} | "
                 f"{fmt(r['anchor10'])} | {fmt(r['anchor50'])} | {r['avoid5']} | {r['title']} | {r['unj10']} | "
                 f"{loss if n != 'prod' else '–'} | {P50[n]} | ~{(440 + P95_POST[n]) / 1000:.2f} s |")
    L.append("")
    L += ["## Guardrails: title lookups", "", "| query | expected | " + " | ".join(NAMES) + " |", "|---|---|" + "---|" * len(NAMES)]
    for c in cs:
        if c.type != "title_lookup":
            continue
        must = A.anchor_ids(c.anchors, "must")
        cells = []
        for n in NAMES:
            ids = [x["id"] for x in ls[n][c.id]]
            r = next((i + 1 for i, p in enumerate(ids) if p in must), None)
            cells.append(f"#{r}" if r else "–")
        L.append(f"| {c.id} {c.query} | {c.anchors['must'][0].get('title')} | " + " | ".join(cells) + " |")
    L.append("")
    L += ["## ndcg10 by query type", "", "| type (queries) | " + " | ".join(NAMES) + " |", "|---|" + "---|" * len(NAMES)]
    for t in sorted({c.type for c in graded}):
        tc = [c for c in graded if c.type == t]
        L.append(f"| {t} ({len(tc)}) | " + " | ".join(fmt(mean(n, "ndcg10", tc)) for n in NAMES) + " |")
    L.append(f"| all ({len(graded)}) | " + " | ".join(fmt(row[n]["ndcg10"]) for n in NAMES) + " |")
    L.append("")
    L += ["## ndcg10 per query (diff vs prod, sorted by r4-combo-fast − prod)", "",
          "| query | type | prod | " + " | ".join(NAMES[1:]) + " |", "|---|---|---|" + "---|" * (len(NAMES) - 1)]
    for c in sorted(graded, key=lambda c: per_q["r4-combo-fast"][c.id]["ndcg10"] - per_q["prod"][c.id]["ndcg10"]):
        p = per_q["prod"][c.id]["ndcg10"]
        cells = []
        for n in NAMES[1:]:
            v = per_q[n][c.id]["ndcg10"]
            d = v - p
            cells.append(f"{v:.3f} ({d:+.2f}){' **LOSS**' if d < -0.15 else ''}")
        L.append(f"| {c.id} {c.query[:55]} | {c.type} | {p:.3f} | " + " | ".join(cells) + " |")
    L.append("")
    losing = sorted({q for n in NAMES[1:] for _, q in row[n]["losses"]})
    if losing:
        L += ["## Queries more than 0.15 below prod: top 10 with grades", ""]
        for qid in losing:
            c = next(c for c in graded if c.id == qid)
            L += [f"### {qid} {c.query}", "", f"Intent: {c.intent}", "", "| rank | " + " | ".join(NAMES) + " |",
                  "|---|" + "---|" * len(NAMES)]
            for i in range(10):
                cells = []
                for n in NAMES:
                    x = ls[n][qid][i] if i < len(ls[n][qid]) else None
                    cells.append(f"{x['title']} ({x['year']}) **{grades[qid].get(x['id'], '?')}**" if x else "")
                L.append(f"| {i + 1} | " + " | ".join(cells) + " |")
            L.append("| ndcg10 | " + " | ".join(f"{per_q[n][qid]['ndcg10']:.3f}" for n in NAMES) + " |")
            L.append("")
    L += ["## Grade-0 titles in the top 5", "", "| ranker | query | rank | title |", "|---|---|---|---|"]
    for n in NAMES:
        for c in graded:
            for i, x in enumerate(ls[n][c.id][:5]):
                if grades[c.id].get(x["id"]) == 0:
                    L.append(f"| {n} | {c.id} {c.query[:45]} | {i + 1} | {x['title']} ({x['year']}) |")
    L.append("")
    json.dump({"summary": row, "per_query": {n: {q: v["ndcg10"] for q, v in d.items()} for n, d in per_q.items()},
               "losing": losing}, open(os.path.join(OUT, "metrics.json"), "w"), indent=1)
    open(os.path.join(OUT, "metrics-tables.md"), "w").write("\n".join(L))
    print("\n".join(L[:8]))


if __name__ == "__main__":
    {"lists": lists, "packets": packets, "compare": compare, "merge": merge, "metrics": metrics}[sys.argv[1]]()
