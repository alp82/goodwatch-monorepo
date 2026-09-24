"""Round 6: effect of the style re-grade and of the alternate-cut rule on the round-5 numbers (saved r5 lists).
Usage: .venv/bin/python harness/regrade_effect.py"""
import json, os, statistics, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import catalog as C, grade6, metrics as M  # noqa: E402

R5 = os.path.join(C.ARENA, "results", "round5")
qs = {q["id"]: q for q in grade6.load_queries()}
new = M.load_grades()
old = {q: dict(v) for q, v in new.items()}
for q, v in json.load(open(os.path.join(C.ARENA, "results", "grading", "pre-r6-style-grades.json"))).items():
    old[q] = {int(p): g for p, g in v.items()}
lists = {}
for n in ("prod", "r4-combo-fast", "r5"):
    lists[n] = json.load(open(os.path.join(R5, "lists", f"{n}.json")))
    lists[n].update(json.load(open(os.path.join(R5, "holdout3", "lists", f"{n}.json"))))
sty = lambda q: qs[q].get("person_intent") in ("style", "both")
groups = {"dev-style": [q for q in qs if qs[q]["split"] == "dev" and sty(q)],
          "ho3-style": [q for q in qs if qs[q]["split"] == "holdout3" and sty(q)],
          "dev": [q for q in qs if qs[q]["split"] == "dev" and qs[q]["type"] != "title_lookup"],
          "holdout3": [q for q in qs if qs[q]["split"] == "holdout3"]}
L = ["| ranker | grades / metric | " + " | ".join(f"{g} ndcg10" for g in groups) + " | bad5 holdout3 | bad5 dev-style |",
     "|---|---|" + "---|" * (len(groups) + 2)]
for n in lists:
    for label, G, f in (("old grades, r5 metric", old, M.graded_query), ("re-graded, r5 metric", new, M.graded_query),
                        ("re-graded, round-6 metric (cuts)", new, M.graded_query6)):
        cells = [f"{statistics.mean(f([x['id'] for x in lists[n][q]], G[q])['ndcg10'] for q in qq):.3f}" for qq in groups.values()]
        b3 = sum(f([x['id'] for x in lists[n][q]], G[q])['bad5'] for q in groups["holdout3"])
        bd = sum(f([x['id'] for x in lists[n][q]], G[q])['bad5'] for q in groups["dev-style"])
        L.append(f"| {n} | {label} | " + " | ".join(cells) + f" | {b3} | {bd} |")
print("\n".join(L))
