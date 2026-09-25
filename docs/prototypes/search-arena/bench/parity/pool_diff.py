"""Why a candidate is in one pool and not the other: the prototype's top lists with their cut scores.

The pool is the union of top lists (fingerprint and dense top 500, BM25, facet, coverage unit and profile top 300, the
reference's titles, peers). A title the prototype has and the port lacks (or the reverse) sits at the edge of some
list. For each such title this script finds the list where it is closest to the cut, and classifies the margin:
  tie     its score equals the list's cut score: which tied titles make the cut is arbitrary (numpy's argpartition
          in the prototype, Qdrant's shard and segment order in the port);
  near    within EPS of the cut: 1e-3 for dense cosines (the stored vectors' norms differ from 1 by up to 5e-4),
          1e-5 relative for BM25, 1e-4 for the fingerprint's sums;
  mix     a non-English mixed list (its z statistics come from int8 vectors in the port);
  fixed   a reference title or peer title only one side has (the credits differ);
  other   none of these: look at it (on production: new or changed titles).
Also the two top-2,000 lists a non-English query's union comes from.

Usage: .venv/bin/python bench/parity/pool_diff.py <prototype.json> <port.json> [--only=id,id] [--out=<file.json>]
  [--patch=<file.py>,...]   (the same patches the prototype export ran with)
"""
import json, os, sys
from collections import Counter

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ARENA = os.environ.get("ARENA_DIR", os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, os.path.join(ARENA, "harness"))

import catalog as C  # noqa: E402
import context as X  # noqa: E402
import simp_combo as M  # noqa: E402

CFG = M.FINAL["combo-safe-v3"][0]
EPS = {"fingerprint": 1e-4, "dense": 1e-3, "bm25": 1e-5, "profile": 1e-3}


def arg(name, default=None):
    for a in sys.argv:
        if a.startswith(f"--{name}="):
            return a.split("=", 1)[1]
    return default


def top_lists(ctx, cfg=CFG):
    """[(name, kind, scores over all rows, k, rows)]: rank_query's top lists (kind picks the tolerance), plus the fixed
    parts (reference titles, peers) as k = None."""
    cat = C.load()
    M._sims.clear()
    sims = M.sims
    non_en = ctx.non_english or M.looks_foreign(ctx.text)
    ref = M.resolve_reference(ctx, cfg, non_en)
    M.settle(ref)
    emb_main = "me5s" if non_en else cfg["emb"]
    positive, negated = M.split_negation(ctx.text if non_en else M.spell(ctx.text))
    dense_text = positive
    if ref is not None:
        positive, negated = ref.text, ref.negated
        dense_text = dense_text if ref.kind == "title" else positive
    mask = M.era_filter(ctx.text, ctx.mask)
    rows = np.flatnonzero(mask)
    km, kp = cfg["k_main"], cfg["k_part"]
    out = [("fingerprint", "fingerprint", M.weighted_sum(ctx).astype(np.float64), km, rows)]
    e_all = None
    ent_dense = cfg["entity_dense"] if ref is not None and ref.kind == "entity" else "residual"
    if ent_dense == "reuse":
        ent_dense = "intent" if emb_main == M.INTENT_EMB else "residual"
    if ent_dense == "intent":
        M.settle(ref)
    if dense_text and ent_dense == "intent" and ref.det.qvec is not None:
        e_all = C.embeddings(M.INTENT_EMB) @ ref.det.qvec
    elif dense_text and ent_dense == "residual":
        e_all = sims(emb_main, dense_text)
    if e_all is not None:
        kind, e_rows = "dense", rows
        if non_en:
            en_pos, _ = M.english_from_chips(ctx)
            if en_pos:
                e_en = sims(cfg["emb"], en_pos)
                n = cfg["nonen_union_k"]
                e_rows = np.union1d(M.top(rows, e_all[rows], n)[0], M.top(rows, e_en[rows], n)[0])
                # the union's two top lists gate which titles the mixed list can hold
                out.append(("union multilingual", "dense", e_all, n, rows))
                out.append(("union english", "dense", e_en, n, rows))
                e_all = M.mix_z(e_all, e_en, rows, cfg["nonen_mix"])
                kind = "mix"
        out.append(("dense", kind, e_all, km, e_rows))
    if not non_en and positive:
        s = M.S.scores(positive, cfg["body"]).astype(np.float64)
        out.append(("bm25", "bm25", np.where(mask, s, 0), kp, rows))
    if positive:
        for f in M.facets(ctx, negated, ref.words if ref is not None else set(), cfg):
            out.append((f"facet {f!r}", "dense", sims(emb_main, f), kp, rows))
    units = []
    if ref is None and len(M.S.tokens(positive)) <= cfg["cov_max_tokens"]:
        units = M.facet_units(ctx, negated, cfg)
        if not any(set(u.split()) & M.concrete_words(ctx) for u in units):
            units = []
    for u in units:
        out.append((f"unit {u!r}", "dense", sims(emb_main, u), kp, rows))
        s = M.S.scores(u, cfg["body"]).astype(np.float64)
        out.append((f"unit bm25 {u!r}", "bm25", np.where(mask, s, 0), kp, rows))
    if ref is not None:
        fixed = np.zeros(len(cat.ids))
        for r in ref.weights:
            fixed[r] = 1
        out.append(("reference titles", "fixed", fixed, None, rows))
        for w, sc, kind in M.reference_profile(ref, cfg, cat):
            if kind == "peer":
                out.append(("peers", "fixed", sc, None, rows))
            else:
                out.append((f"profile {kind}", "profile" if kind == "centroid" else "bm25", sc.astype(np.float64),
                            km if kind == "centroid" else kp, rows))
    return out


def classify(pid, side, lists):
    """(class, list name, margin) of a candidate only one side has."""
    cat = C.load()
    r = cat.row_of[pid]
    best = None
    for name, kind, sc, k, rows, member, cut in lists:
        if not member[r]:
            continue
        v = sc[r]
        if k is None:
            if v > 0 and side == "prototype":
                return ("fixed", name, 0.0)
            continue
        if kind != "fingerprint" and kind != "mix" and cut <= 0:
            cut = 0.0   # sparse and profile lists keep positive scores only
        margin = v - cut
        if side == "prototype" and margin < 0 and not name.startswith("union"):
            continue
        if kind == "bm25":
            eps = EPS["bm25"] * max(abs(cut), 1e-9)
        else:
            eps = EPS.get(kind, 0)
        if abs(margin) <= 1e-9 * max(1.0, abs(cut)):
            cls = "tie"
        elif kind == "mix":
            cls = "mix"
        elif abs(margin) <= eps:
            cls = "near"
        else:
            cls = "other"
        rank = {"tie": 0, "mix": 1, "near": 2, "other": 3}[cls]
        if best is None or (rank, abs(margin)) < (best[0], abs(best[3])):
            best = (rank, cls, name, float(margin))
    return (best[1], best[2], best[3]) if best else ("none", None, None)


def main():
    proto = json.load(open(sys.argv[1]))["queries"]
    port = {q["id"]: q for q in json.load(open(sys.argv[2]))}
    only = set(arg("only").split(",")) if arg("only") else None
    for i, path in enumerate(filter(None, (arg("patch") or "").split(","))):
        import importlib.util
        spec = importlib.util.spec_from_file_location(f"parity_patch{i}", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.apply(M)
    ctxs = {c.id: c for c in X.contexts()}
    report, total = {}, Counter()
    for qid, p in proto.items():
        if only and qid not in only:
            continue
        q = port[qid]
        pc = set(map(int, p["candidates"]))
        qc = {c for c, _ in q["trace"]["candidates"]}
        if pc == qc:
            continue
        lists = []
        for name, kind, sc, k, rows in top_lists(ctxs[qid]):
            member = np.zeros(len(C.load().ids), bool)
            member[rows] = True
            vals = sc[rows]
            cut = -np.inf if k is None or len(vals) <= k else -np.partition(-vals, k - 1)[k - 1]
            lists.append((name, kind, sc, k, rows, member, cut))
        cats = Counter()
        examples = []
        for side, ids in (("prototype", pc - qc), ("port", qc - pc)):
            for pid in sorted(ids):
                if pid not in C.load().row_of:
                    cls = ("not in snapshot", None, None)
                else:
                    cls = classify(pid, side, lists)
                cats[(cls[0], cls[1] if cls[0] != "other" else cls[1])] += 1
                total[cls[0]] += 1
                if cls[0] in ("other", "none", "not in snapshot") and len(examples) < 50:
                    examples.append((side, pid, cls))
        report[qid] = {"only_prototype": len(pc - qc), "only_port": len(qc - pc),
                       "classes": {f"{a} {b}": n for (a, b), n in cats.items()}, "examples": examples}
        print(qid, p["query"][:50], report[qid]["classes"], examples[:3])
    print("total", dict(total))
    if arg("out"):
        json.dump({"total": total, "queries": report}, open(arg("out"), "w"), indent=1, default=str)


if __name__ == "__main__":
    main()
