"""Blinded grading packets for a round and split.

Usage: .venv/bin/python harness/pool.py [round1] [dev|holdout|all] [--depth 10]

Pools the top `depth` of every ranker list in results/<round>/lists/, drops title_lookup queries and
(query, point id) pairs that results/grades.json already grades, and writes
results/<round>/pool-<split>.json:
[{query_id, query, intent, items: [{pid, title, year, media_type, genres, essence_text, tags, keywords}]}]
Items are shuffled per query with a fixed seed; nothing reveals the ranker or the rank.
"""
import argparse, hashlib, json, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import catalog as C  # noqa: E402
import context as X  # noqa: E402
import metrics as M  # noqa: E402

SEED = 20260923


def packet(cat, pid, fallback):
    r = cat.row_of.get(pid)
    if r is None:
        title, year, mt = fallback
        return dict(pid=pid, title=title, year=year, media_type=mt, genres=[], essence_text="", tags=[], keywords=[],
                    note="not in the fingerprint catalog: no essence text")
    text = cat.essence_text[r]
    if len(text) > 500:
        text = text[:497].rsplit(" ", 1)[0] + "..."
    return dict(pid=pid, title=cat.title[r], year=int(cat.year[r]) or None, media_type=cat.media_type(r),
                genres=cat.genres[r], essence_text=text, tags=cat.essence_tags[r], keywords=cat.keywords[r][:12])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("round", nargs="?", default="round1")
    ap.add_argument("split", nargs="?", default="dev")
    ap.add_argument("--depth", type=int, default=10)
    args = ap.parse_args()
    cat = C.load()
    lists = M.load_lists(args.round)
    grades = M.load_grades() or {}
    queries = {q["id"]: q for q in X.queries()}
    splits = ("dev", "holdout") if args.split == "all" else (args.split,)
    for split in splits:
        out, pairs, per_ranker_new = [], 0, {}
        for qid, q in queries.items():
            if q["split"] != split or q["type"] == "title_lookup":
                continue
            seen = {}
            for name, ls in lists.items():
                for x in ls.get(qid, [])[: args.depth]:
                    if x["id"] in grades.get(qid, {}):
                        continue
                    seen.setdefault(x["id"], (x["title"], x["year"], x["media_type"]))
            items = [packet(cat, pid, fb) for pid, fb in seen.items()]
            items.sort(key=lambda it: it["pid"])
            seed = int(hashlib.sha256(f"{SEED}:{qid}".encode()).hexdigest()[:8], 16)
            random.Random(seed).shuffle(items)
            pairs += len(items)
            out.append(dict(query_id=qid, query=q["query"], intent=q.get("intent", ""), items=items))
        path = os.path.join(C.ARENA, "results", args.round, f"pool-{split}.json")
        json.dump(out, open(path, "w"), ensure_ascii=False, indent=1)
        sizes = [len(p["items"]) for p in out]
        print(f"{split}: {len(out)} queries, {pairs} ungraded pairs (min {min(sizes)}, max {max(sizes)} per query) -> {path}")


if __name__ == "__main__":
    main()
