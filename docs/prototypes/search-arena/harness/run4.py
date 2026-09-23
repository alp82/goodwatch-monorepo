"""Round 4: fixes for the holdout failure patterns, tuned on dev+ (splits `dev` and `holdout`).

Usage:
  .venv/bin/python harness/run4.py check       # r4 code with round-3 switches reproduces r3-combo / r3-combo-fast
  .venv/bin/python harness/run4.py sweep [prefix ...]   # dev+ sweeps -> results/round4/sweeps.md
  .venv/bin/python harness/run4.py final       # chosen configs -> results/round4/lists, timings, stages, choices
  .venv/bin/python harness/run4.py report      # results/round4/metrics-tables.md (dev+ per query vs prod)

Only splits `dev` and `holdout` are loaded: `devplus_contexts()` filters queries.json by split before any capture is
read, and the title-name cache used by the blends is filled from dev+ captures only. The `holdout2` split (ids
`ho2-*`) is never read, run or scored here.
"""
import json, math, os, statistics, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import anchors as A  # noqa: E402
import blend2 as B2  # noqa: E402
import blend4 as B4  # noqa: E402
import catalog as C  # noqa: E402
import context as X  # noqa: E402
import metrics as M  # noqa: E402
import rankers4 as R4  # noqa: E402

OUT = os.path.join(C.ARENA, "results", "round4")
LISTS = os.path.join(OUT, "lists")
R3 = os.path.join(C.ARENA, "results", "round3")
TOP = 50
SPLITS = ("dev", "holdout")


def devplus_queries():
    for _ in range(5):
        try:
            qs = json.load(open(X.QUERIES))
            break
        except json.JSONDecodeError:  # queries.json is appended concurrently by another agent
            time.sleep(1)
    return [q for q in qs if q["split"] in SPLITS]


def devplus_contexts():
    qs = devplus_queries()
    cat = C.load()
    # Fill the outside-name cache from dev+ captures only (context.outside_names would read every split).
    names = {}
    for q in qs:
        cap = json.load(open(os.path.join(X.CAPTURES, f"{q['id']}.json")))
        for p in cap["prod"]:
            names[p["point_id"]] = (p["title"], p["year"], p["media_type"])
        for t in cap.get("titleLookup") or []:
            if t.get("type") in ("movie", "tv"):
                names.setdefault(C.point_id(t["type"], t["id"]), (t["title"], t.get("year"), "show" if t["type"] == "tv" else "movie"))
    X._names = names
    return [X.load_query(q, cat) for q in qs]


def run(kw, bk, ctxs):
    lists, ms = {}, {}
    for ctx in ctxs:
        t = time.perf_counter()
        info = {}
        disc = R4.hyb4(ctx, debug=info, **kw)
        ms[ctx.id] = (time.perf_counter() - t) * 1000
        blended = B4.blend(ctx, [(pid, i + 1, s) for i, (pid, s, _) in enumerate(disc)], exclude=info.get("exclude"), **bk)
        lists[ctx.id] = [{k: x[k] for k in ("id", "title", "year", "media_type", "score")} for x in blended[:TOP]]
    return lists, ms


def per_query(ctxs, lists, grades):
    out = {}
    for c in ctxs:
        if c.type == "title_lookup" or c.id not in grades:
            continue
        ids = [x["id"] for x in lists[c.id]]
        m = M.graded_query(ids, grades[c.id])
        g = grades[c.id]
        judged = [p for p in ids if p in g][:10]
        dcg = sum((2 ** g[p] - 1) / math.log2(i + 2) for i, p in enumerate(judged))
        ideal = sorted(g.values(), reverse=True)[:10]
        idcg = sum((2 ** x - 1) / math.log2(i + 2) for i, x in enumerate(ideal))
        m["proxy"] = dcg / idcg if idcg else 0
        out[c.id] = m
    return out


def summary(ctxs, lists, grades, prod=None):
    pq = per_query(ctxs, lists, grades)
    s = dict(full=statistics.mean(m["ndcg10"] for m in pq.values()), proxy=statistics.mean(m["proxy"] for m in pq.values()),
             bad5=sum(m["bad5"] for m in pq.values()), unj=sum(m["unj10"] for m in pq.values()))
    for sp in SPLITS:
        v = [pq[c.id]["ndcg10"] for c in ctxs if c.split == sp and c.id in pq]
        s[sp] = statistics.mean(v)
    a = A.summarize(ctxs, lists, None, ("title_lookup",))
    s["a10"] = a["anchor10"]
    ok = sum(M.title_guardrail(ctxs, lists, sp)[0] for sp in SPLITS)
    n = sum(M.title_guardrail(ctxs, lists, sp)[1] for sp in SPLITS)
    s["t1"] = f"{ok}/{n}"
    inc = next((i + 1 for i, x in enumerate(lists.get("core-04", [])) if x["id"] == C.point_id("movie", 27205)), None)
    s["inc"] = inc
    if prod is not None:
        pp = per_query(ctxs, prod, grades)
        losses = sorted(((pq[q]["ndcg10"] - pp[q]["ndcg10"], q) for q in pq if pq[q]["ndcg10"] - pp[q]["ndcg10"] < -0.15))
        s["losses"] = losses
    return s, pq


def load_prod(ctxs):
    p = json.load(open(os.path.join(R3, "lists", "prod.json")))
    return {c.id: p[c.id] for c in ctxs}


def fmt_s(name, s):
    loss = " ".join(f"{q}{d:+.3f}" for d, q in s.get("losses", []))
    return (f"{name:40s} full {s['full']:.3f} (dev {s['dev']:.3f} ho {s['holdout']:.3f}) proxy {s['proxy']:.3f} "
            f"unj {s['unj']:3d} bad5 {s['bad5']:2d} a10 {s['a10']:.3f} t@1 {s['t1']} inc@{s['inc']} | {loss}")


FAST = dict(dense=500, facet=200, neg=200, sparse=300)
_KIND = dict(kind=True, cap=0.65)
_R3 = dict(era=True, spell=True, nonen=True, nonen_mix=0.5)
_SPARSE = dict(text="sparse", a=0.4, b=0.48, c=0.12)
R3CFG = {
    "r3-combo": (dict(_R3, text="both", a=0.4, b=0.48, c=0.12), _KIND),
    "r3-combo-fast": (dict(_R3, **_SPARSE, trunc=FAST), _KIND),
}
STRICT = dict(strict=0.9, fuzzy=0.88, kind=False)


# Round-4 changes on top of both round-3 combos (frozen before holdout2; see LOG.md "Round 4").
_R4 = dict(ref=True, ref_mix=0.2, ref_text="full", ref_agree=0.2, ref_sparse="body", sparse_body=True,
           cov=0.3, cov_k=300, cov_mode="z", cov_beta=0.5, cov_fields="body", sparse_bigram=2.0)
_KIND4 = dict(_KIND, kind_all=True)
FINAL = {
    "r3-combo": R3CFG["r3-combo"],
    "r3-combo-fast": R3CFG["r3-combo-fast"],
    "r4-combo": (dict(R3CFG["r3-combo"][0], **_R4), _KIND4),
    "r4-combo-fast": (dict(R3CFG["r3-combo-fast"][0], **_R4), _KIND4),
    # ablations of the fast finalist, one change removed each
    "r4-fast-noref": (dict(R3CFG["r3-combo-fast"][0], **dict(_R4, ref=False)), _KIND4),
    "r4-fast-nocov": (dict(R3CFG["r3-combo-fast"][0], **dict(_R4, cov=0.0)), _KIND4),
    "r4-fast-bigram1": (dict(R3CFG["r3-combo-fast"][0], **dict(_R4, sparse_bigram=1.0)), _KIND4),
}
FINALISTS = ["r4-combo", "r4-combo-fast"]
# Stage model (metrics.py STAGE_MS). The r4 extras ride in the same Qdrant batch (reference point query, one
# dense + one sparse list per facet unit) and the in-process fingerprint scan; +5 ms for the extra lists.
_FASTS = ["qemb", "qdrant_batch", "fp_full", "qemb_extra", "fuzzy_title", "spell"]
_LEAD = ["crate_text", "qemb", "qdrant_emb", "fp_full", "qemb_extra", "fuzzy_title", "qdrant_sparse", "spell"]
STAGES = {"r3-combo": _LEAD, "r3-combo-fast": _FASTS, "r4-combo": _LEAD + ["r4_extra"], "r4-combo-fast": _FASTS + ["r4_extra"],
          "r4-fast-noref": _FASTS + ["r4_extra"], "r4-fast-nocov": _FASTS + ["r4_extra"], "r4-fast-bigram1": _FASTS + ["r4_extra"]}


def final():
    os.makedirs(LISTS, exist_ok=True)
    ctxs = devplus_contexts()
    json.dump(load_prod(ctxs), open(os.path.join(LISTS, "prod.json"), "w"), ensure_ascii=False)
    timings, choices = {}, {}
    for name, (kw, bk) in FINAL.items():
        ls, ms = run(kw, {**STRICT, **bk}, ctxs)
        json.dump(ls, open(os.path.join(LISTS, f"{name}.json"), "w"), ensure_ascii=False)
        v = sorted(ms.values())
        timings[name] = {"mean_ms": statistics.mean(v), "p95_ms": v[int(0.95 * len(v)) - 1], "max_ms": v[-1]}
        choices[name] = {"discovery": {**R4.DEFAULTS, **kw}, "blend": {**STRICT, **bk}}
        print(name, "done", flush=True)
    json.dump(timings, open(os.path.join(OUT, "timings.json"), "w"), indent=1)
    json.dump({"stages": STAGES}, open(os.path.join(OUT, "stages.json"), "w"), indent=1)
    json.dump(choices, open(os.path.join(OUT, "choices.json"), "w"), indent=1, default=str)
    lists = {n: json.load(open(os.path.join(LISTS, f"{n}.json"))) for n in FINAL}
    write_pool("final", lists, ctxs)


STAGE_MS = {**M.STAGE_MS, "r4_extra": 5}


def est_p50(name):
    ms = {k: STAGE_MS[k] for k in STAGES.get(name, [])}
    if "qemb" in ms:
        ms["qemb"] = 15
    emb = sum(ms.get(k, 0) for k in ("spell", "qemb", "qdrant_emb", "qemb_extra", "qdrant_batch", "r4_extra"))
    text = max(ms.get("crate_text", 0), ms.get("qdrant_sparse", 0))
    return max(emb, text) + ms.get("fp_full", 0) + ms.get("fuzzy_title", 0)


def report():
    ctxs = devplus_contexts()
    grades = M.load_grades()
    names = ["prod"] + list(FINAL)
    ls = {n: json.load(open(os.path.join(LISTS, f"{n}.json"))) for n in names}
    graded = [c for c in ctxs if c.type != "title_lookup"]
    pq = {n: per_query(ctxs, ls[n], grades) for n in names}
    mean = lambda n, cs: statistics.mean(pq[n][c.id]["ndcg10"] for c in cs)
    L = ["| ranker | dev+ ndcg10 | dev | holdout | Δ vs prod | good10 | bad5 | unj10 | anchor10 | title@1 | Incepton | "
         "queries < prod − 0.15 | est. p50 after reading |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for n in names:
        sm, _ = summary(ctxs, ls[n], grades, ls["prod"])
        good = statistics.mean(pq[n][c.id]["good10"] for c in graded)
        loss = ", ".join(f"{q} {d:+.3f}" for d, q in sm["losses"]) or "none"
        L.append(f"| {n} | {sm['full']:.3f} | {sm['dev']:.3f} | {sm['holdout']:.3f} | {sm['full'] - mean('prod', graded):+.3f} | "
                 f"{good:.2f} | {sm['bad5']} | {sm['unj']} | {sm['a10']:.3f} | {sm['t1']} | #{sm['inc']} | "
                 f"{loss if n != 'prod' else '–'} | {est_p50(n) if n != 'prod' else 235} ms |")
    L += ["", "## ndcg10 by query type (dev+)", "", "| type (queries) | " + " | ".join(names) + " |", "|---|" + "---|" * len(names)]
    for t in sorted({c.type for c in graded}):
        tc = [c for c in graded if c.type == t]
        L.append(f"| {t} ({len(tc)}) | " + " | ".join(f"{mean(n, tc):.3f}" for n in names) + " |")
    L += ["", "## ndcg10 per query vs prod (dev+, sorted by r4-combo-fast − prod)", "",
          "| query | split | type | prod | " + " | ".join(names[1:]) + " |", "|---|---|---|---|" + "---|" * (len(names) - 1)]
    for c in sorted(graded, key=lambda c: pq["r4-combo-fast"][c.id]["ndcg10"] - pq["prod"][c.id]["ndcg10"]):
        p = pq["prod"][c.id]["ndcg10"]
        cells = []
        for n in names[1:]:
            d = pq[n][c.id]["ndcg10"] - p
            cells.append(f"{pq[n][c.id]['ndcg10']:.3f} ({d:+.2f}){' **LOSS**' if d < -0.15 else ''}")
        L.append(f"| {c.id} {c.query[:48]} | {c.split} | {c.type} | {p:.3f} | " + " | ".join(cells) + " |")
    L += ["", "## Former holdout failures and like-X queries: top 10 with grades", ""]
    for qid in ("new-01", "new-08", "core-18", "lab-12", "new-07", "lab-03", "lab-09"):
        c = next(c for c in ctxs if c.id == qid)
        cols = ["prod", "r3-combo-fast", "r4-combo", "r4-combo-fast"]
        L += [f"### {qid} {c.query}", "", f"Intent: {c.intent}", "", "| rank | " + " | ".join(cols) + " |", "|---|" + "---|" * len(cols)]
        for i in range(10):
            cells = []
            for n in cols:
                x = ls[n][qid][i] if i < len(ls[n][qid]) else None
                cells.append(f"{x['title']} ({x['year']}) **{grades[qid].get(x['id'], '?')}**" if x else "")
            L.append(f"| {i + 1} | " + " | ".join(cells) + " |")
        L.append("| ndcg10 | " + " | ".join(f"{pq[n][qid]['ndcg10']:.3f}" for n in cols) + " |")
        L.append("")
    L += ["## Grade-0 titles in the top 5 (finalists)", "", "| ranker | query | rank | title |", "|---|---|---|---|"]
    for n in FINALISTS:
        for c in graded:
            for i, x in enumerate(ls[n][c.id][:5]):
                if grades[c.id].get(x["id"]) == 0:
                    L.append(f"| {n} | {c.id} {c.query[:45]} | {i + 1} | {x['title']} ({x['year']}) |")
    out = {n: {q: v["ndcg10"] for q, v in pq[n].items()} for n in names}
    json.dump(out, open(os.path.join(OUT, "per-query.json"), "w"), indent=1)
    open(os.path.join(OUT, "metrics-tables.md"), "w").write("\n".join(L) + "\n")
    print("\n".join(L[:12]))


def check():
    ctxs = devplus_contexts()
    for name, (kw, bk) in R3CFG.items():
        ls, _ = run(kw, {**STRICT, **bk}, ctxs)
        ref = json.load(open(os.path.join(R3, "lists", f"{name}.json")))
        diff = [c.id for c in ctxs if [x["id"] for x in ls[c.id][:10]] != [x["id"] for x in ref[c.id][:10]]]
        print(name, "top-10 differences vs round-3 lists:", diff or "none")


def configs():
    """name -> (hyb4 kwargs, blend kwargs). Bases: r3-combo (Crate + sparse) and r3-combo-fast (sparse, truncated)."""
    g = {}
    for base, (kw0, bk0) in R3CFG.items():
        g[f"{base}"] = (kw0, bk0)
    return g


def sweep(only=None, extra=None):
    os.makedirs(OUT, exist_ok=True)
    grades = M.load_grades()
    ctxs = devplus_contexts()
    prod = load_prod(ctxs)
    ps, _ = summary(ctxs, prod, grades)
    print(fmt_s("prod", ps), flush=True)
    rows = []
    cfgs = extra or configs()
    for name, (kw, bk) in cfgs.items():
        if only and not any(name.startswith(o) for o in only):
            continue
        ls, _ = run(kw, {**STRICT, **bk}, ctxs)
        s, pq = summary(ctxs, ls, grades, prod)
        rows.append((name, s))
        print(fmt_s(name, s), flush=True)
        watch = os.environ.get("WATCH")
        if watch:
            print("      " + " ".join(f"{q}:{pq[q]['ndcg10']:.2f}/{pq[q]['proxy']:.2f}/u{pq[q]['unj10']}" for q in watch.split(",")), flush=True)
    return rows


def write_pool(tag, lists_by_name, ctxs):
    """Blinded packets for every (query, title) in the top 10 of any list that grades.json doesn't grade yet
    (same format and seeding as pool.py) -> results/round4/pool-<tag>.json."""
    import hashlib, random
    import pool as P
    cat = C.load()
    grades = M.load_grades() or {}
    out, pairs = [], 0
    for c in ctxs:
        if c.type == "title_lookup":
            continue
        seen = {}
        for name, ls in lists_by_name.items():
            for x in ls.get(c.id, [])[:10]:
                if x["id"] in grades.get(c.id, {}):
                    continue
                seen.setdefault(x["id"], (x["title"], x["year"], x["media_type"]))
        if not seen:
            continue
        items = [P.packet(cat, pid, fb) for pid, fb in seen.items()]
        items.sort(key=lambda it: it["pid"])
        seed = int(hashlib.sha256(f"{P.SEED}:{c.id}".encode()).hexdigest()[:8], 16)
        random.Random(seed).shuffle(items)
        pairs += len(items)
        out.append(dict(query_id=c.id, query=c.query, intent=c.intent, items=items))
    path = os.path.join(OUT, f"pool-{tag}.json")
    json.dump(out, open(path, "w"), ensure_ascii=False, indent=1)
    print(f"{tag}: {len(out)} queries, {pairs} ungraded pairs -> {path}")


def cli():
    cmd = sys.argv[1]
    if cmd == "check":
        check()
    elif cmd == "sweep":
        sweep(sys.argv[2:] or None)
    elif cmd == "final":
        final()
    elif cmd == "report":
        report()


if __name__ == "__main__":
    cli()
