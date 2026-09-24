"""Diff two saved evalsimp list files (results/simplify/lists/<name>.json) query by query.

Usage (from docs/prototypes/search-arena):
  .venv/bin/python harness/listdiff.py simp r6 [--top=50] [--scores]

Prints every query whose top lists differ (first differing rank and the titles there) and a summary line. With
--scores the blend scores must match too. Exit code 1 when anything differs.
"""
import json, os, sys

LISTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "results", "simplify", "lists")


def load(name):
    return json.load(open(os.path.join(LISTS, name.replace("/", "_") + ".json")))


def main(argv):
    names = [a for a in argv if not a.startswith("--")]
    if len(names) != 2:
        raise SystemExit(__doc__)
    k = next((int(a.split("=", 1)[1]) for a in argv if a.startswith("--top=")), 50)
    fields = ("id", "score") if "--scores" in argv else ("id",)
    a, b = load(names[0]), load(names[1])
    bad = []
    for q in sorted(set(a) | set(b)):
        la, lb = a.get(q), b.get(q)
        if la is None or lb is None:
            bad.append(q)
            print(f"{q}: only in {names[0] if lb is None else names[1]}")
            continue
        ta = [tuple(x[f] for f in fields) for x in la[:k]]
        tb = [tuple(x[f] for f in fields) for x in lb[:k]]
        if ta == tb:
            continue
        bad.append(q)
        i = next((i for i, (x, y) in enumerate(zip(ta, tb)) if x != y), min(len(ta), len(tb)))
        at = lambda ls: f"{ls[i]['title']} ({ls[i]['year']})" if i < len(ls) else "–"
        print(f"{q}: first difference at rank {i + 1}: {names[0]} {at(la)} vs {names[1]} {at(lb)} "
              f"(lengths {len(ta)} / {len(tb)})")
    n = len(set(a) | set(b))
    print(f"{n - len(bad)} of {n} queries identical in the top {k} ({'+'.join(fields)}); {len(bad)} differ")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
