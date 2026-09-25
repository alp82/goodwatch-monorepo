"""Compare the TypeScript ranker's lists (goodwatch-webapp/scripts/search-ranking-run.ts --json) with the prototype's
(export_prototype.py), query by query, stage by stage.

Usage: python bench/parity/compare.py <prototype.json> <port.json> [--show=<n>] [--out=<summary.json>]
The first file can also be a port run, to compare two port runs (for example two stores).

Per query it checks, in pipeline order: the reference (seeds, own titles, profile terms), the encoded texts, the era
filter, the candidate pool, the order of the candidates before the blend, and the final top 10. The first stage that
differs is where to look for the cause.
"""
import json, sys
from collections import Counter


def arg(name, default=None):
    for a in sys.argv:
        if a.startswith(f"--{name}="):
            return a.split("=", 1)[1]
    return default


MODEL = {"bgeb-notitle": "english", "me5s": "multilingual"}


def as_reference(path):
    """A prototype export, or a port run (then compared as if it were the prototype: two port runs)."""
    data = json.load(open(path))
    if isinstance(data, dict):
        return data["queries"]
    out = {}
    for q in data:
        tr, ref = q["trace"], q["reference"]
        out[q["id"]] = {
            "query": q["query"], "top50": [[r["id"], r["score"]] for r in q["results"]],
            "discovery": tr["discovery"], "candidates": {str(i): s for i, s in tr["candidates"]},
            "texts": [[m, t] for m, ts in tr["texts"].items() for t in ts if not (ref and "X" in t.split())],
            "terms": tr["profileTerms"],
            "reference": None if ref is None else dict(ref, seeds=tr["seeds"], own=tr["own"]),
        }
    return out


MODEL.update({"english": "english", "multilingual": "multilingual"})


def load(proto_path, port_path):
    proto = as_reference(proto_path)
    port = {q["id"]: q for q in json.load(open(port_path))}
    return proto, port


def kendall_top(a, b, k=10):
    """Positions in b of a's top k (None when missing)."""
    pos = {x: i for i, x in enumerate(b)}
    return [pos.get(x) for x in a[:k]]


def compare_query(p, q):
    """Stage differences of one query: dict of stage -> detail (only differing stages)."""
    d = {}
    pr, tr = p["reference"], q.get("trace") or {}
    if (pr is None) != (q["reference"] is None):
        d["reference"] = f"prototype {pr and pr['kind']} vs port {q['reference'] and q['reference']['kind']}"
    elif pr is not None:
        qr = q["reference"]
        if pr["intent"] != qr["intent"]:
            d["intent"] = f"{pr['intent']} vs {qr['intent']}"
        if pr["residual"] != qr["residual"]:
            d["residual"] = f"{pr['residual']!r} vs {qr['residual']!r}"
        if pr["seeds"] != tr.get("seeds"):
            ps, qs = set(pr["seeds"]), set(tr.get("seeds") or [])
            d["seeds"] = (f"{len(ps & qs)}/{len(ps)} shared, order {'same' if pr['seeds'] == tr.get('seeds') else 'differs'}"
                          f"; only prototype {sorted(ps - qs)[:5]}, only port {sorted(qs - ps)[:5]}")
        po, qo = set(pr["own"]), set(tr.get("own") or [])
        if po != qo:
            d["own"] = f"{len(po & qo)} shared, only prototype {len(po - qo)}, only port {len(qo - po)}"
        pt = [t for t, _ in (p["terms"] or [])]
        qt = [t for t, _ in (tr.get("profileTerms") or [])]
        if set(pt) != set(qt):
            d["terms"] = f"{len(set(pt) & set(qt))}/{len(pt)} shared; only prototype {sorted(set(pt) - set(qt))[:6]}, only port {sorted(set(qt) - set(pt))[:6]}"
    ptexts = {(MODEL[m], t) for m, t in p["texts"]}
    qtexts = {(m, t) for m, ts in (tr.get("texts") or {}).items() for t in ts}
    if ptexts - qtexts:
        d["texts_missing"] = sorted(ptexts - qtexts)
    extra = {x for x in qtexts - ptexts if not (x[0] == "multilingual" and pr and "X" in x[1].split())}
    if extra:
        d["texts_extra"] = sorted(extra)
    pc, qc = set(map(int, p["candidates"])), {c for c, _ in tr.get("candidates") or []}
    if pc != qc:
        d["pool"] = f"{len(pc & qc)} shared, only prototype {len(pc - qc)}, only port {len(qc - pc)} (of {len(pc)} / {len(qc)})"
    pd = [i for i, _ in p["discovery"]]
    qd = [i for i, _ in tr.get("discovery") or []]
    if pd[:10] != qd[:10]:
        d["discovery10"] = f"{len(set(pd[:10]) & set(qd[:10]))}/10 shared, positions in port {kendall_top(pd, qd)}"
    return d


def main():
    proto, port = load(sys.argv[1], sys.argv[2])
    show = int(arg("show", "0"))
    rows = []
    for qid, p in proto.items():
        q = port.get(qid)
        if q is None:
            rows.append((qid, None))
            continue
        a = [i for i, _ in p["top50"]]
        b = [r["id"] for r in q["results"]]
        shared = len(set(a[:10]) & set(b[:10]))
        rows.append((qid, dict(shared=shared, same_set=set(a[:10]) == set(b[:10]), same_order=a[:10] == b[:10],
                               same50=a == b, stages=compare_query(p, q), route=q["route"])))
    ok = [r for _, r in rows if r]
    n = len(ok)
    summary = {
        "queries": n, "missing": [q for q, r in rows if r is None],
        "mean_shared_top10": round(sum(r["shared"] for r in ok) / n, 3),
        "same_set": sum(r["same_set"] for r in ok), "same_order": sum(r["same_order"] for r in ok),
        "same_top50": sum(r["same50"] for r in ok), "min_shared": min(r["shared"] for r in ok),
        "first_differing_stage": Counter(next(iter(r["stages"]), "none") for r in ok if not r["same_order"]),
        "by_route": {rt: f"{sum(r['same_order'] for r in ok if r['route'] == rt)}/{sum(1 for r in ok if r['route'] == rt)}"
                     for rt in sorted({r["route"] for r in ok})},
    }
    print(json.dumps(summary, indent=1))
    if show:
        for qid, r in rows:
            if r and not r["same_order"]:
                print(f"\n{qid} [{r['route']}] {proto[qid]['query']!r}: shared {r['shared']}/10")
                for k, v in r["stages"].items():
                    print(f"   {k}: {v}")
    if arg("out"):
        json.dump({"summary": summary, "queries": {q: r for q, r in rows}}, open(arg("out"), "w"), indent=1, default=str)


if __name__ == "__main__":
    main()
