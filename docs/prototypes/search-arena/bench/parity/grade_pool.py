"""Grading packets for the ungraded titles in the top 10s of ranked lists (the arena's pooled procedure, as
`evalsimp.py pool`), for the regular splits and holdout5 together.

Usage (the arena's .venv; ARENA_DIR with the data):
  .venv/bin/python bench/parity/grade_pool.py <tag> <lists.json> [...] [--names=<port.json>,...]
Writes results/grading/r6-<tag>-part1.json and r6-<tag>-part1-rev.json in this repository's arena (not ARENA_DIR),
then: two sonnet assessors (A on part1, B on part1-rev) with results/grading/GRADER.md, `grade6.py compare <tag>`, a
blind assessor C for pairs 2+ apart, `grade6.py merge <tag>`. Run grade6.py with GRADE_DIR pointing here too (see
merge_grades.py). A title outside the arena snapshot (new in production) gets its name from the port runs (--names).
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OURS = os.path.dirname(os.path.dirname(HERE))
ARENA = os.environ.get("ARENA_DIR", OURS)
sys.path.insert(0, os.path.join(ARENA, "harness"))

import context as X  # noqa: E402
import cuts  # noqa: E402
import evalsimp as E  # noqa: E402
import grade6  # noqa: E402

sys.path.insert(0, HERE)
from score import lists_of  # noqa: E402

grade6.G = os.path.join(OURS, "results", "grading")
grade6.GRADES = os.path.join(OURS, "results", "grades.json")


def main():
    tag = sys.argv[1]
    files = [a for a in sys.argv[2:] if not a.startswith("--")]
    all_lists = [lists_of(f) for f in files]
    names = {}
    for a in sys.argv:
        if a.startswith("--names="):
            for path in a.split("=", 1)[1].split(","):
                for q in json.load(open(path)):
                    for r in q["results"]:
                        names[r["id"]] = (r["title"], r["year"], r["mediaType"])
    packets, pairs = [], []
    for split in ("regular", "holdout5"):
        if split == "holdout5":
            E.use_split("holdout5")
        ctxs = E.contexts()
        grades = E.load_grades()
        qs = {q["id"]: q for q in grade6.load_queries(E.SPLITS)}
        fb = dict(X.outside_names())
        fb.update(names)
        for c in ctxs:
            if c.type == "title_lookup":
                continue
            new = []
            for ls in all_lists:
                ids = [x["id"] for x in ls[c.id]]
                second = set(cuts.second_cuts(ids, 10))
                for i, pid in enumerate(ids[:10]):
                    if i not in second and pid not in grades.get(c.id, {}) and pid not in new:
                        new.append(pid)
            if new:
                pk = grade6.make_packet(qs[c.id], new, fb)
                if split == "holdout5" and c.id in E.VAGUE and "rubric" not in pk:
                    pk["rubric"] = "vague"
                packets.append(pk)
                pairs += [(c.id, p) for p in new]
    grade6.write(tag, packets)
    print("pairs:", len(pairs), "outside the snapshot:",
          sum(1 for _, p in pairs if p not in E.C.load().row_of))


if __name__ == "__main__":
    main()
