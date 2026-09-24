"""Holdout evaluation of the round-3 finalists (evaluation-contract.md, Winning).

Usage:
  .venv/bin/python harness/holdout.py lists     # rerun the frozen configs on holdout -> results/holdout/lists
  .venv/bin/python harness/pool.py holdout holdout   # blinded packets -> results/holdout/pool-holdout.json
  .venv/bin/python harness/holdout.py metrics   # tables -> results/holdout/metrics-tables.md + metrics.json
                                                # (metrics.md = verdict text + these tables)

Configs are run3.FINAL (frozen after round 3) and the round-2 leader (run3 defaults) as a reference.
`prod` is the captured production list. The regenerated lists are checked against the holdout entries
run3.py final already wrote into results/round3/lists.
"""
import json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import anchors as A  # noqa: E402
import catalog as C  # noqa: E402
import context as X  # noqa: E402
import metrics as M  # noqa: E402

OUT = os.path.join(C.ARENA, "results", "holdout")
LISTS = os.path.join(OUT, "lists")
R3 = os.path.join(C.ARENA, "results", "round3")
FINALISTS = ["r3-combo", "r3-combo-fast", "sparse-fast"]
REFERENCE = "r2-combo-bgeb-strict"
NAMES = ["prod"] + FINALISTS + [REFERENCE]
# Finalist family: the Notes rule compares within a family by latency, the 0.02 margin applies across families.
FAMILY = {"r3-combo": "r3-combo", "r3-combo-fast": "r3-combo", "sparse-fast": "sparse"}


def lists():
    import run3
    os.makedirs(LISTS, exist_ok=True)
    ctxs = [c for c in X.contexts() if c.split == "holdout"]
    cfg = {n: run3.FINAL[n] for n in FINALISTS}
    cfg[REFERENCE] = ({}, {})
    prod = json.load(open(os.path.join(R3, "lists", "prod.json")))
    json.dump({c.id: prod[c.id] for c in ctxs}, open(os.path.join(LISTS, "prod.json"), "w"), ensure_ascii=False)
    for name, (kw, bk) in cfg.items():
        ls, _ = run3.run(kw, bk, ctxs)
        json.dump(ls, open(os.path.join(LISTS, f"{name}.json"), "w"), ensure_ascii=False)
        ref = json.load(open(os.path.join(R3, "lists", f"{name}.json")))
        diff = [c.id for c in ctxs if [x["id"] for x in ls[c.id][:10]] != [x["id"] for x in ref[c.id][:10]]]
        print(f"{name}: {len(ls)} holdout lists; top-10 differences vs results/round3/lists: {diff or 'none'}", flush=True)


def fmt(x, d=3):
    return "–" if x is None or (isinstance(x, float) and math.isnan(x)) else f"{x:.{d}f}"


def metrics():
    ctxs = [c for c in X.contexts() if c.split == "holdout"]
    ls = M.load_lists("holdout")
    grades = M.load_grades()
    graded = [c for c in ctxs if c.type != "title_lookup"]
    missing = [c.id for c in graded if c.id not in grades]
    assert not missing, f"ungraded holdout queries: {missing}"
    per_q = {n: {c.id: M.graded_query([x["id"] for x in ls[n][c.id]], grades[c.id]) for c in graded} for n in NAMES}
    mean = lambda n, key, cs=graded: sum(per_q[n][c.id][key] for c in cs) / len(cs)
    row = {}
    for n in NAMES:
        s = A.summarize(ctxs, ls[n], "holdout", ("title_lookup",))
        ok, tn = M.title_guardrail(ctxs, ls[n], "holdout")
        row[n] = dict(ndcg10=mean(n, "ndcg10"), good10=mean(n, "good10"), bad5=sum(per_q[n][c.id]["bad5"] for c in graded),
                      unj10=sum(per_q[n][c.id]["unj10"] for c in graded), anchor10=s["anchor10"], anchor50=s["anchor50"],
                      avoid5=s["avoid5"], title=f"{ok}/{tn}")
    stages = json.load(open(os.path.join(R3, "stages.json")))["stages"]
    # Estimated added p50 after the reading (metrics.py stage model) and whole-search p95 (see metrics.md text).
    p50 = {"prod": 235, "r3-combo": 156, "r3-combo-fast": 52, "sparse-fast": 51, REFERENCE: 156}
    p95 = {"prod": 0.90, "r3-combo": 0.95, "r3-combo-fast": 0.55, "sparse-fast": 0.55, REFERENCE: 0.95}

    L = ["# Holdout metrics (round-3 finalists)", "",
         f"Holdout split: {len(ctxs)} queries, {len(graded)} graded (title_lookup excluded, checked as guardrails). "
         "Lists: `harness/holdout.py lists` (run3.FINAL configs, frozen after round 3; identical to the holdout entries "
         "`run3.py final` wrote). Every holdout top 10 is pooled and graded, so `unj10` is 0. "
         f"`{REFERENCE}` is the round-2 leader, a reference and not a finalist.", "",
         "| ranker | ndcg10 | Δ vs prod | good10 | bad5 | anchor10 | anchor50 | avoid5 | title@1 | unj10 | est. p50 after reading | est. p95 whole search |",
         "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for n in NAMES:
        r = row[n]
        L.append(f"| {n} | {fmt(r['ndcg10'])} | {r['ndcg10'] - row['prod']['ndcg10']:+.3f} | {fmt(r['good10'], 2)} | {r['bad5']} | "
                 f"{fmt(r['anchor10'])} | {fmt(r['anchor50'])} | {r['avoid5']} | {r['title']} | {r['unj10']} | {p50[n]} ms | ~{p95[n]:.2f} s |")
    L.append("")

    # Guardrails detail.
    L += ["## Guardrails: title lookups", "", "| query | expected | " + " | ".join(NAMES) + " |", "|---|---|" + "---|" * len(NAMES)]
    for c in ctxs:
        if c.type != "title_lookup":
            continue
        must = A.anchor_ids(c.anchors, "must")
        cells = []
        for n in NAMES:
            ids = [x["id"] for x in ls[n][c.id]]
            r = next((i + 1 for i, p in enumerate(ids) if p in must), None)
            cells.append(f"#{r}" if r else "–")
        L.append(f"| {c.id} {c.query} | {c.anchors['must'][0].get('title', must[0])} | " + " | ".join(cells) + " |")
    L.append("")

    # Per type.
    L += ["## ndcg10 by query type", "", "| type (queries) | " + " | ".join(NAMES) + " |", "|---|" + "---|" * len(NAMES)]
    for t in sorted({c.type for c in graded}):
        tc = [c for c in graded if c.type == t]
        L.append(f"| {t} ({len(tc)}) | " + " | ".join(fmt(mean(n, "ndcg10", tc)) for n in NAMES) + " |")
    L.append(f"| all ({len(graded)}) | " + " | ".join(fmt(row[n]["ndcg10"]) for n in NAMES) + " |")
    L.append("")

    # Per query.
    L += ["## ndcg10 per query (diff vs prod)", "",
          "| query | type | prod | " + " | ".join(n for n in NAMES[1:]) + " |", "|---|---|---|" + "---|" * (len(NAMES) - 1)]
    for c in sorted(graded, key=lambda c: per_q["r3-combo-fast"][c.id]["ndcg10"] - per_q["prod"][c.id]["ndcg10"]):
        p = per_q["prod"][c.id]["ndcg10"]
        cells = []
        for n in NAMES[1:]:
            v = per_q[n][c.id]["ndcg10"]
            d = v - p
            cells.append(f"{v:.3f} ({d:+.2f}){' **LOSS**' if d < -0.15 else ''}")
        L.append(f"| {c.id} {c.query[:55]} | {c.type} | {p:.3f} | " + " | ".join(cells) + " |")
    L.append("")

    # Top 10 with grades for every losing query.
    losing = sorted({c.id for c in graded for n in FINALISTS
                     if per_q[n][c.id]["ndcg10"] - per_q["prod"][c.id]["ndcg10"] < -0.15})
    if losing:
        L += ["## Losing queries (> 0.15 below prod): top 10 with grades", ""]
        for qid in losing:
            c = next(c for c in graded if c.id == qid)
            L += [f"### {qid} {c.query}", "", f"Intent: {c.intent}", "", "| rank | " + " | ".join(["prod"] + FINALISTS) + " |",
                  "|---|" + "---|" * (1 + len(FINALISTS))]
            for i in range(10):
                cells = []
                for n in ["prod"] + FINALISTS:
                    x = ls[n][qid][i] if i < len(ls[n][qid]) else None
                    cells.append(f"{x['title']} ({x['year']}) **{grades[qid].get(x['id'], '?')}**" if x else "")
                L.append(f"| {i + 1} | " + " | ".join(cells) + " |")
            L.append("")

    # Grade-0 titles in the top 5.
    L += ["## Grade-0 titles in the top 5", "", "| ranker | query | rank | title |", "|---|---|---|---|"]
    for n in NAMES:
        for c in graded:
            for i, x in enumerate(ls[n][c.id][:5]):
                if grades[c.id].get(x["id"]) == 0:
                    L.append(f"| {n} | {c.id} {c.query[:45]} | {i + 1} | {x['title']} ({x['year']}) |")
    L.append("")

    os.makedirs(OUT, exist_ok=True)
    json.dump({"summary": row, "per_query": {n: {q: v["ndcg10"] for q, v in d.items()} for n, d in per_q.items()},
               "losing": losing}, open(os.path.join(OUT, "metrics.json"), "w"), indent=1)
    open(os.path.join(OUT, "metrics-tables.md"), "w").write("\n".join(L))
    print("\n".join(L[:12]))
    print("losing:", losing)


if __name__ == "__main__":
    {"lists": lists, "metrics": metrics}[sys.argv[1]]()
