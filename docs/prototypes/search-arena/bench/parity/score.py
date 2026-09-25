"""Arena metrics of ranked lists: NDCG@10 per split and bad5, as evalsimp.py computes them (round-6 rules), for the
regular splits and holdout5. Nothing is written to the arena's results.

Usage (the arena's .venv; ARENA_DIR with the data):
  .venv/bin/python bench/parity/score.py <name>=<lists.json> [...] [--grades=<grades.json>] [--out=<file.json>]
A lists file is a prototype export (export_prototype.py), a port run (search-ranking-run.ts --json) or an evalsimp
list file ({query id: [{id, ...}]}). --grades replaces results/grades.json (for example with new grades merged in).
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ARENA = os.environ.get("ARENA_DIR", os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, os.path.join(ARENA, "harness"))

import evalsimp as E  # noqa: E402
import metrics as MT  # noqa: E402


def arg(name, default=None):
    for a in sys.argv:
        if a.startswith(f"--{name}="):
            return a.split("=", 1)[1]
    return default


def lists_of(path):
    data = json.load(open(path))
    if isinstance(data, dict) and "queries" in data:
        return {q: [{"id": i, "score": s} for i, s in v["top50"]] for q, v in data["queries"].items()}
    if isinstance(data, list):
        return {q["id"]: [{"id": r["id"], "score": r["score"]} for r in q["results"]] for q in data}
    return {q: [{"id": x["id"], "score": x.get("score")} for x in v] for q, v in data.items()}


def main():
    specs = [a for a in sys.argv[1:] if not a.startswith("--")]
    named = [(s.split("=", 1)[0], lists_of(s.split("=", 1)[1])) for s in specs]
    if arg("grades"):
        path = arg("grades")
        MT.load_grades = lambda: {q: {int(p): g for p, g in gs.items()} for q, gs in json.load(open(path)).items()}
    out = {}
    for split in ("regular", "holdout5"):
        if split == "holdout5":
            E.use_split("holdout5")
        ctxs = E.contexts()
        grades = E.load_grades()
        lines = [E.header()]
        for name, ls in named:
            sub = {c.id: E.normalize(ls[c.id]) for c in ctxs}
            s, pq = E.summarize(ctxs, sub, grades)
            out.setdefault(name, {})[split] = {"summary": s, "per_query": {q: v["ndcg10"] for q, v in pq.items()}}
            lines.append(E.row(name, s))
        print(f"\n{split}\n" + "\n".join(lines))
    if arg("out"):
        json.dump(out, open(arg("out"), "w"), indent=1)


if __name__ == "__main__":
    main()
