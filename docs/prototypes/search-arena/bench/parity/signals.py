"""Signal by signal: the prototype's weighted contributions over the TypeScript ranker's candidate pool, next to the
port's own (search-ranking-run.ts --json traces them).

Usage (the arena's .venv; ARENA_DIR with the data):
  .venv/bin/python bench/parity/signals.py <port.json> <query id> [<query id> ...] [--top=10] [--patch=<file.py>,...]

For each signal it prints the largest absolute difference over the pool and the difference on the port's top titles.
The signals follow simp_combo.rank_query's scoring (the names are the port's).
"""
import json, os, sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ARENA = os.environ.get("ARENA_DIR", os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, os.path.join(ARENA, "harness"))

import catalog as C  # noqa: E402
import context as X  # noqa: E402
import simp_combo as M  # noqa: E402

CFG = M.FINAL["combo-safe-v3"][0]


def prototype_signals(ctx, cand, cfg=CFG):
    """{name: contribution per cand row}: rank_query's score terms over the given candidate rows."""
    cat = C.load()
    M._sims.clear()
    z, sims = M.z, M.sims
    non_en = ctx.non_english or M.looks_foreign(ctx.text)
    ref = M.resolve_reference(ctx, cfg, non_en)
    M.settle(ref)   # the intent may still be encoding in the worker thread
    emb_main = "me5s" if non_en else cfg["emb"]
    positive, negated = M.split_negation(ctx.text if non_en else M.spell(ctx.text))
    dense_text = positive
    if ref is not None:
        positive, negated = ref.text, ref.negated
        dense_text = dense_text if ref.kind == "title" else positive
    mask = M.era_filter(ctx.text, ctx.mask)
    rows = np.flatnonzero(mask)
    sec = cfg["secondary"]
    wt = (lambda name: sec[name]) if isinstance(sec, dict) else (lambda name: sec)
    out = {}
    out["fingerprint"] = cfg["b"] * z(M.weighted_sum(ctx)[cand])
    e_all, extra_neg = None, []
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
        if non_en:
            en_pos, en_neg = M.english_from_chips(ctx)
            if en_pos:
                e_en = sims(cfg["emb"], en_pos)
                e_all = M.mix_z(e_all, e_en, rows, cfg["nonen_mix"])
                extra_neg = [sims(cfg["emb"], n) for n in en_neg]
        out["dense"] = cfg["a"] * z(e_all[cand])
    if not non_en and positive:
        s_all, _ = M.sparse_top(positive, cfg["body"], mask, rows, cfg["k_part"])
        if s_all[cand].any():
            out["bm25"] = wt("bm25") * z(s_all[cand])
    f_alls = []
    if positive:
        f_alls = [sims(emb_main, f) for f in M.facets(ctx, negated, ref.words if ref is not None else set(), cfg)]
    if f_alls:
        out["facets"] = wt("facet") * np.mean([z(fa[cand]) for fa in f_alls], axis=0)
    units = []
    if ref is None and len(M.S.tokens(positive)) <= cfg["cov_max_tokens"]:
        units = M.facet_units(ctx, negated, cfg)
        if not any(set(u.split()) & M.concrete_words(ctx) for u in units):
            units = []
    if units:
        u_d = [sims(emb_main, u) for u in units]
        u_s = [M.sparse_top(u, cfg["body"], mask, rows, cfg["k_part"])[0] for u in units]
        out["coverage"] = wt("cov") * z(np.min([z(d[cand]) + cfg["cov_beta"] * z(s[cand]) for d, s in zip(u_d, u_s)], axis=0))
    pens = [sims(emb_main, n)[cand] for n in negated] + [x[cand] for x in extra_neg]
    if pens:
        out["negation"] = -wt("neg") * z(np.max(pens, axis=0))
    if negated and cfg["neg_lex"]:
        out["negationLabels"] = -cfg["neg_lex"] * np.max([M.label_negation(n)[cand] for n in negated], axis=0)
    lv = np.log1p(cat.votes[cand]).astype(np.float64)
    out["goodwatchScore"] = wt("gw") * z(M.filled(cat.goodwatch_score[cand]))
    if ref is None:
        out["votes"] = wt("votes") * z(lv)
    else:
        w_all = np.zeros(len(cat.ids))
        for r, w in ref.weights.items():
            w_all[r] = w
        own = w_all[cand] >= 1
        strength = cfg["weak"] if ref.intent in ("like", "filmography") else 1.0
        zs = []
        names = iter(["profileFingerprint", "profileText", "profileTerms", "mentions", "peers"])
        for w, sc, kind in M.reference_profile(ref, cfg, cat):
            zc = z(np.log1p(sc[cand])) if kind == "mention" else sc[cand] if kind == "peer" else z(sc[cand])
            out[next(names)] = strength * w * zc
            if kind in ("centroid", "terms"):
                zs.append(zc)
        if cfg["w_agree"]:
            out["agreement"] = strength * cfg["w_agree"] * np.min(zs, axis=0)
        out["ownTitles"] = (cfg["lead_boost"] if ref.intent == "filmography" else cfg["own_boost"]) * w_all[cand]
        if ref.intent in ("style", "both"):
            out["popularityDamping"] = -cfg["damp"] * z(lv) * (~own)
        else:
            out["votes"] = wt("votes") * z(lv)
        if ref.era:
            out["career"] = cfg["career_w"] * z(M.filled(cat.year[cand])) * (1 if ref.era == "late" else -1)
    return out


def main():
    port = {q["id"]: q for q in json.load(open(sys.argv[1]))}
    top = int(next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--top=")), "10"))
    ids = [a for a in sys.argv[2:] if not a.startswith("--")]
    patches = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--patch=")), "")
    for i, path in enumerate(filter(None, patches.split(","))):
        import importlib.util
        spec = importlib.util.spec_from_file_location(f"parity_patch{i}", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.apply(M)
    cat = C.load()
    ctxs = {c.id: c for c in X.contexts() if c.id in ids}
    for qid in ids:
        q = port[qid]
        tr = q["trace"]
        pids = [i for i, _ in tr["candidates"]]
        cand = np.array([cat.row_of[i] for i in pids], np.int64)
        proto = prototype_signals(ctxs[qid], cand)
        ptotal = sum(proto.values())
        qtotal = np.array([s for _, s in tr["candidates"]])
        order = np.argsort(-qtotal, kind="stable")[:top]
        print(f"\n{qid} {q['query']!r}: pool {len(pids)}; total max |diff| {np.abs(ptotal - qtotal).max():.2e}")
        for name in sorted(set(proto) | set(tr["signals"])):
            a = proto.get(name)
            b = np.array(tr["signals"][name]) if name in tr["signals"] else None
            if a is None or b is None:
                print(f"   {name:20s} only in {'port' if a is None else 'prototype'}")
                continue
            d = np.abs(a - b)
            print(f"   {name:20s} max |diff| {d.max():.2e}   on port top {top}: {d[order].max():.2e}")
        prank = np.argsort(-ptotal, kind="stable")[:top]
        print("   port top:", [(pids[i], round(float(qtotal[i]), 4), round(float(ptotal[i]), 4)) for i in order])
        print("   proto top:", [(pids[i], round(float(ptotal[i]), 4)) for i in prank])


if __name__ == "__main__":
    main()
