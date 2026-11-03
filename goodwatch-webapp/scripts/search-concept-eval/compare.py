"""Compares two run.ts outputs (before, after) for the concept-title and cited-year changes.

    python3 scripts/search-concept-eval/compare.py <before.json> <after.json> <arena queries.json> [--show=id,id]

Prints, per changed query, both top 10s; for concept queries the share of the top 20 that carries the concept label
(from the after run's label set); for the search arena's graded queries, must-anchor hits in the top 10 and 20 and
avoid-anchor hits in the top 10.
"""

import json
import sys

before = {q["id"]: q for q in json.load(open(sys.argv[1]))}
after = {q["id"]: q for q in json.load(open(sys.argv[2]))}
arena = {q["id"]: q for q in json.load(open(sys.argv[3]))}
show = set()
for a in sys.argv[4:]:
    if a.startswith("--show="):
        show = set(a[7:].split(","))

MOVIE, SHOW = 1_000_000_000_000, 2_000_000_000_000


def point(anchor):
    return (SHOW if anchor["media_type"] == "show" else MOVIE) + anchor["tmdb_id"]


def top(q, n):
    return [r["id"] for r in q["results"][:n]]


def line(r):
    v = r.get("votes")
    return f'{r["title"]} ({r["year"]}) v={int(v) if v is not None else "-"} s={r["score"]}'


changed = 0
concept_rows = []
anchor = {"b": [0, 0, 0, 0], "a": [0, 0, 0, 0]}  # must@10, must@20, must total, avoid@10
for qid, a in after.items():
    b = before.get(qid)
    if not b:
        continue
    same = top(a, 10) == top(b, 10)
    if not same:
        changed += 1
    concept = set(a.get("concept") or [])
    if concept:
        share = lambda q: sum(1 for i in top(q, 20) if i in concept) / max(1, len(top(q, 20)))
        concept_rows.append((qid, a["query"], share(b), share(a)))
    if qid in arena:
        must = {point(x) for x in arena[qid]["anchors"].get("must", [])}
        avoid = {point(x) for x in arena[qid]["anchors"].get("avoid", [])}
        for key, q in (("b", b), ("a", a)):
            anchor[key][0] += len(must & set(top(q, 10)))
            anchor[key][1] += len(must & set(top(q, 20)))
            anchor[key][2] += len(must)
            anchor[key][3] += len(avoid & set(top(q, 10)))
    if (not same and qid not in arena) or qid in show or (not same and qid in arena):
        print(f'\n=== {qid} "{a["query"]}"' + (" [arena]" if qid in arena else ""))
        for i in range(10):
            left = line(b["results"][i]) if i < len(b["results"]) else ""
            right = line(a["results"][i]) if i < len(a["results"]) else ""
            print(f"  {i + 1:2}. {left[:58]:58} | {right[:58]}")

print(f"\n{changed} of {len(after)} queries changed their top 10")
if concept_rows:
    print("\nConcept label share of the top 20 (before -> after):")
    for qid, query, sb, sa in concept_rows:
        print(f"  {query:28} {sb:5.0%} -> {sa:5.0%}")
    print(
        f"  mean {sum(r[2] for r in concept_rows) / len(concept_rows):.0%} -> "
        f"{sum(r[3] for r in concept_rows) / len(concept_rows):.0%}"
    )
for key, label in (("b", "before"), ("a", "after")):
    m10, m20, total, av = anchor[key]
    print(f"Arena {label}: must@10 {m10}/{total}, must@20 {m20}/{total}, avoid@10 {av}")
