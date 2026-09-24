"""Per-query ndcg10 (plain / condensed) of saved lists side by side, for queries where the target moved against r6.

Usage: .venv/bin/python results/simplify/combo/matrix.py <target> [<other list> ...] [--min=0.03] [--graded]
  --graded: only queries whose loss is on graded titles (condensed also below r6).
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "harness"))
import evalsimp as E  # noqa: E402

args = [a for a in sys.argv[1:] if not a.startswith("--")]
mn = next((float(a.split("=")[1]) for a in sys.argv[1:] if a.startswith("--min=")), 0.03)
graded = "--graded" in sys.argv
target, others = args[0], args[1:]
names = ["r6", target] + others
ctxs = E.contexts()
grades = E.load_grades()
ls = E._lists_for(names, ctxs)
pq = {n: E.per_query(ctxs, ls[n], grades) for n in names}
rows = []
for c in ctxs:
    if c.id not in pq["r6"]:
        continue
    d = pq[target][c.id]["ndcg10"] - pq["r6"][c.id]["ndcg10"]
    dc = pq[target][c.id]["cond"] - pq["r6"][c.id]["cond"]
    if d > -mn or (graded and dc > -mn / 2):
        continue
    rows.append((d, c))
print("query | " + " | ".join(names))
for d, c in sorted(rows, key=lambda x: x[0]):
    cells = [f"{pq[n][c.id]['ndcg10']:.3f}/{pq[n][c.id]['cond']:.3f}" for n in names]
    print(f"{c.id} {c.query[:40]!r} | " + " | ".join(cells))
