"""Which z statistics the non-English mix can use in the port.

A non-English query's dense signal mixes z(multilingual-e5-small cosine) and z(bge-base cosine of Jev's English
chips), each z-scored over every filtered title (`simp_combo.mix_z`). The statistics depend on the query vectors, so
they can't be precomputed as numbers per filter. This script ranks every graded non-English query with chips four
ways and compares each list with the prototype's:

  exact      the prototype: mean and spread over the filtered titles
  eligible   over every eligible title, whatever the filter (one precomputed covariance per model)
  media      over the eligible titles of the query's media type (three precomputed covariances per model)
  int8       over the filtered titles, from the build's int8 vectors (`mix_vectors`, index_builders.quantized)

Usage: ARENA_DIR=<arena with data> .venv/bin/python bench/indexes/mix_stats.py [--out=results/bench/indexes-mix.json]
"""
import base64, json, os, sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fidelity as F  # noqa: E402

C, X, M, B = F.C, F.X, F.M, F.B
cat = C.load()
el = np.flatnonzero(cat.eligible())
pos = np.full(len(cat.ids), -1)
pos[el] = np.arange(len(el))


def dequantize(q):
    scale = np.frombuffer(base64.b64decode(q["scale"]["float32"]), "<f4")
    values = np.frombuffer(base64.b64decode(q["values"]["int8"]), np.int8).reshape(q["values"]["shape"])
    return values, scale


Q = {"me5s": dequantize(B.quantized(C.embeddings("me5s")[el])),
     "bgeb-notitle": dequantize(B.quantized(C.embeddings("bgeb-notitle")[el]))}
orig = M.mix_z
CUR = {}


def patched(x, y, rows, w):
    mode = CUR["mode"]
    if mode == "exact":
        return orig(x, y, rows, w)
    if mode == "int8":
        p = pos[rows]
        stats = []
        for key, sims in (("me5s", x), ("bgeb-notitle", y)):
            values, scale = Q[key]
            q = CUR["qvec"][key]
            c = values[p].astype(np.float32) @ (q * scale)
            stats.append((float(c.mean()), float(c.std())))
        (mu1, sd1), (mu2, sd2) = stats
        CUR["ratio"] = sd2 / sd1
        return (1 - w) * (x - mu1) / sd1 + w * (y - mu2) / sd2
    m = cat.eligible().copy()
    if mode == "media":
        media = {f for f, d, _ in CUR["ctx"].flags if d == "required" and f in ("movie", "show")}
        if media == {"show"}:
            m &= cat.is_show
        elif media == {"movie"}:
            m &= ~cat.is_show
    use = np.flatnonzero(m)
    CUR["ratio"] = float(y[use].std() / x[use].std())
    return orig(x, y, use, w)


def query_vectors(ctx, cfg):
    """The two vectors rank_query mixes: me5s of the (residual) query and bge of the English chips."""
    import qemb
    positive, _ = M.split_negation(ctx.text)
    ref = M.resolve_reference(ctx, cfg, True)
    dense = positive if ref is None or ref.kind == "title" else ref.text
    qm = qemb.embed("me5s", dense)
    if ref is not None and ref.kind == "entity":
        M.settle(ref)
        if ref.det.qvec is not None:
            qm = ref.det.qvec
    return {"me5s": qm, "bgeb-notitle": qemb.embed("bgeb-notitle", M.english_from_chips(ctx)[0])}


def main():
    M.mix_z = patched
    cfg = F.CFG
    out = []
    for ctx in X.contexts():
        non_en = ctx.non_english or M.looks_foreign(ctx.text)
        if not non_en or not M.english_from_chips(ctx)[0]:
            continue
        CUR["ctx"], CUR["qvec"] = ctx, query_vectors(ctx, cfg)
        lists, ratios = {}, {}
        for mode in ("exact", "eligible", "media", "int8"):
            CUR["mode"] = mode
            CUR.pop("ratio", None)
            rows = np.flatnonzero(M.era_filter(ctx.text, ctx.mask))
            lists[mode] = [x["id"] for x in M.rank(ctx, cfg)]
            if mode == "exact":
                e_multi = C.embeddings("me5s")[rows] @ CUR["qvec"]["me5s"]
                e_en = C.embeddings("bgeb-notitle")[rows] @ CUR["qvec"]["bgeb-notitle"]
                ratios[mode] = float(e_en.std() / e_multi.std())
            else:
                ratios[mode] = CUR.get("ratio")
        rec = {"query": ctx.id, "text": ctx.query, "filtered_titles": int(len(rows)), "sd_ratio": ratios}
        for mode in ("eligible", "media", "int8"):
            rec[mode] = {"top10_same": lists[mode][:10] == lists["exact"][:10],
                         "top50_overlap": len(set(lists[mode]) & set(lists["exact"])),
                         "top50_same_order": lists[mode] == lists["exact"]}
        out.append(rec)
        print(json.dumps(rec), flush=True)
    summary = {mode: {"top10_same": sum(r[mode]["top10_same"] for r in out),
                      "top50_same_order": sum(r[mode]["top50_same_order"] for r in out)} for mode in ("eligible", "media", "int8")}
    res = {"queries": len(out), "summary": summary, "per_query": out}
    path = F.arg("out", os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                                     "results", "bench", "indexes-mix.json"))
    json.dump(res, open(path, "w"), indent=1)
    print(json.dumps(res["summary"]))


if __name__ == "__main__":
    main()
