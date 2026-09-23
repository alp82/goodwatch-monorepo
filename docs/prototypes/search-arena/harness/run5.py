"""Round 5: cast, crew and studio matching on top of r4-combo-fast.

Usage:
  .venv/bin/python harness/run5.py detect            # entity detection on every non-holdout3 query (false positives)
  .venv/bin/python harness/run5.py sweep [prefix ...] # dev sweeps (graded pairs + unjudged counts), regression splits
  .venv/bin/python harness/run5.py final             # FINAL configs on dev / holdout / holdout2 -> results/round5/lists
  .venv/bin/python harness/run5.py pool <tag>        # ungraded top-10 pairs of the lists -> grading/r5-<tag>-part1(.rev).json
  .venv/bin/python harness/run5.py compare <tag>     # A vs B kappa, disagreements
  .venv/bin/python harness/run5.py merge <tag>       # + C -> add-only grades.json
  .venv/bin/python harness/run5.py report            # results/round5/metrics-dev.md
  .venv/bin/python harness/run5.py holdout3          # ONLY after the freeze: prod, r4-combo-fast, r5 on holdout3

Blindness: every command except `holdout3` filters queries.json to the splits dev, holdout and holdout2 before any
capture is read, and fills the outside-name cache from those captures only. The holdout3 split (12 ppl-* queries) is
never read, run or scored before `holdout3`.
"""
import hashlib, json, math, os, random, statistics, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import anchors as A  # noqa: E402
import blend4 as B4  # noqa: E402
import catalog as C  # noqa: E402
import context as X  # noqa: E402
import entities as E  # noqa: E402
import metrics as M  # noqa: E402
import pool as P  # noqa: E402
import rankers5 as R5  # noqa: E402
import run4  # noqa: E402

OUT = os.path.join(C.ARENA, "results", "round5")
LISTS = os.path.join(OUT, "lists")
G = os.path.join(C.ARENA, "results", "grading")
TOP = 50
SPLITS = ("dev", "holdout", "holdout2")
BASE = "r4-combo-fast"


def load_queries(splits):
    for _ in range(5):
        try:
            qs = json.load(open(X.QUERIES))
            break
        except json.JSONDecodeError:
            time.sleep(1)
    return [q for q in qs if q["split"] in splits]


def contexts(splits=SPLITS):
    qs = load_queries(splits)
    cat = C.load()
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


def run(kw, bk, ctxs, ent_kind=False):
    """hyb5 + blend4. On entity queries the blend's title-word bonus (kind) is off unless ent_kind."""
    lists, ms, info_by = {}, {}, {}
    for ctx in ctxs:
        t = time.perf_counter()
        info = {}
        disc = R5.hyb5(ctx, debug=info, **kw)
        ms[ctx.id] = (time.perf_counter() - t) * 1000
        b = dict(bk)
        if info.get("entity") and not ent_kind:
            b["kind"] = False
        blended = B4.blend(ctx, [(pid, i + 1, s) for i, (pid, s, _) in enumerate(disc)], exclude=info.get("exclude"), **b)
        lists[ctx.id] = [{k: x[k] for k in ("id", "title", "year", "media_type", "score")} for x in blended[:TOP]]
        info_by[ctx.id] = info.get("entity")
    return lists, ms, info_by


def base_lists(ctxs):
    kw, bk = run4.FINAL[BASE]
    ls, _ = run4.run(kw, {**run4.STRICT, **bk}, ctxs)
    return ls


def prod_lists(ctxs):
    return {c.id: [dict(id=p["point_id"], title=p["title"], year=str(p["year"] or ""), media_type=p["media_type"],
                        score=p["score"]) for p in c.prod[:TOP]] for c in ctxs}


def per_query(ctxs, lists, grades):
    out = {}
    for c in ctxs:
        if c.type == "title_lookup":
            continue
        g = grades.get(c.id, {})
        ids = [x["id"] for x in lists[c.id]]
        if not g:
            out[c.id] = dict(ndcg10=float("nan"), good10=0, bad5=0, unj10=sum(1 for p in ids[:10]), proxy=float("nan"))
            continue
        m = M.graded_query(ids, g)
        judged = [p for p in ids if p in g][:10]
        dcg = sum((2 ** g[p] - 1) / math.log2(i + 2) for i, p in enumerate(judged))
        ideal = sorted(g.values(), reverse=True)[:10]
        idcg = sum((2 ** x - 1) / math.log2(i + 2) for i, x in enumerate(ideal))
        m["proxy"] = dcg / idcg if idcg else 0
        out[c.id] = m
    return out


def _mean(v):
    v = [x for x in v if not (isinstance(x, float) and math.isnan(x))]
    return statistics.mean(v) if v else float("nan")


def summary(ctxs, lists, grades):
    pq = per_query(ctxs, lists, grades)
    s = {}
    groups = {"ppl-dev": [c for c in ctxs if c.split == "dev" and c.id.startswith("ppl")],
              "dev-old": [c for c in ctxs if c.split == "dev" and not c.id.startswith("ppl")],
              "dev": [c for c in ctxs if c.split == "dev"], "holdout": [c for c in ctxs if c.split == "holdout"],
              "holdout2": [c for c in ctxs if c.split == "holdout2"]}
    for k, cs in groups.items():
        cs = [c for c in cs if c.id in pq]
        s[k] = _mean([pq[c.id]["ndcg10"] for c in cs])
        s[k + "_proxy"] = _mean([pq[c.id]["proxy"] for c in cs])
        s[k + "_unj"] = sum(pq[c.id]["unj10"] for c in cs)
        s[k + "_bad5"] = sum(pq[c.id]["bad5"] for c in cs)
    return s, pq


def fmt(name, s):
    return (f"{name:28s} ppl-dev {s['ppl-dev']:.3f}/{s['ppl-dev_proxy']:.3f} u{s['ppl-dev_unj']:3d} b{s['ppl-dev_bad5']:2d} | "
            f"dev-old {s['dev-old']:.3f} u{s['dev-old_unj']:2d} | ho {s['holdout']:.3f} u{s['holdout_unj']:2d} | "
            f"ho2 {s['holdout2']:.3f} u{s['holdout2_unj']:2d}")


# --- configs --------------------------------------------------------------------------------------

R4F = run4.FINAL[BASE]
KW4, BK4 = R4F[0], {**run4.STRICT, **R4F[1]}


def cfg(**over):
    return (dict(KW4, **over), BK4)


FINAL = {
    "r5": cfg(),
}


def variants():
    v = {"r5": cfg()}
    for k, vals in dict(fil_boost=[1.5, 4.0], sty_boost=[0.3, 1.0], sty_cap=[2, 4], head_style=[3, 6], mix_style=[0.5, 0.85],
                        mix_fil=[0.3], cen_fp=[0.0, 0.6], cen_k=[6, 20], ent_sparse_people=[True],
                        cen_fp_fil=[0.3], ent_facet=[False], sty_prior=[0.0, 0.5], less_neg=[0.1, 0.6],
                        head_actor=[4, 8]).items():
        for x in vals:
            v[f"r5-{k}={x}"] = cfg(**{k: x})
    v["r5-less_fp=0"] = cfg(less_fp=0.0)
    v["r5-less_fp=1"] = cfg(less_fp=1.0)
    C1 = dict(head_style=6, sty_cap=4, fil_boost=4.0, ent_sparse_people=True)
    v["c1"] = cfg(**C1)
    v["c1-mixfil"] = cfg(**C1, mix_fil=0.3)
    v["c1-styb"] = cfg(**C1, sty_boost=0.3)
    v["c1-cenk20"] = cfg(**C1, cen_k=20)
    v["c1-all"] = cfg(**C1, mix_fil=0.3, sty_boost=0.3, cen_k=20)
    v["c1-head5"] = cfg(**dict(C1, head_style=5))
    v["c1-cap3"] = cfg(**dict(C1, sty_cap=3))
    v["c1-fil3"] = cfg(**dict(C1, fil_boost=3.0))
    v["c1-lessfp0"] = cfg(**C1, less_fp=0.0)
    v["c1-sp0"] = cfg(**C1, sty_prior=0.0)
    C2 = dict(C1, mix_fil=0.3, sty_boost=0.3, cen_k=20, less_fp=0.0)
    v["c2"] = cfg(**C2)
    v["c2-cap3"] = cfg(**dict(C2, sty_cap=3))
    v["c2-head5"] = cfg(**dict(C2, head_style=5))
    v["c2-head8"] = cfg(**dict(C2, head_style=8))
    v["c2-lessneg6"] = cfg(**dict(C2, less_neg=0.6))
    v["c2-people0"] = cfg(**dict(C2, ent_sparse_people=False))
    return v


def sweep(only=None):
    grades = M.load_grades() or {}
    ctxs = contexts()
    ppl = [c for c in ctxs if c.id.startswith("ppl") or E.detect(c.query)]
    base = base_lists(ctxs)
    s, _ = summary(ctxs, base, grades)
    print(fmt(BASE, s), flush=True)
    prod = prod_lists(ctxs)
    s, _ = summary(ctxs, prod, grades)
    print(fmt("prod", s), flush=True)
    for name, (kw, bk) in variants().items():
        if only and not any(name.startswith(o) for o in only):
            continue
        ls, _, _ = run(kw, bk, ppl)
        full = {**base, **ls}
        s, pq = summary(ctxs, full, grades)
        print(fmt(name, s), flush=True)


# --- final lists, pools, grading ------------------------------------------------------------------

def final():
    os.makedirs(LISTS, exist_ok=True)
    ctxs = contexts()
    json.dump(prod_lists(ctxs), open(os.path.join(LISTS, "prod.json"), "w"), ensure_ascii=False)
    json.dump(base_lists(ctxs), open(os.path.join(LISTS, f"{BASE}.json"), "w"), ensure_ascii=False)
    timings, ents = {}, {}
    for name, (kw, bk) in FINAL.items():
        ls, ms, info = run(kw, bk, ctxs)
        json.dump(ls, open(os.path.join(LISTS, f"{name}.json"), "w"), ensure_ascii=False)
        v = sorted(ms.values())
        timings[name] = {"mean_ms": statistics.mean(v), "p95_ms": v[int(0.95 * len(v)) - 1], "max_ms": v[-1]}
        ents[name] = {q: e for q, e in info.items() if e}
    json.dump(timings, open(os.path.join(OUT, "timings.json"), "w"), indent=1)
    json.dump(ents, open(os.path.join(OUT, "entities.json"), "w"), indent=1, ensure_ascii=False)
    json.dump({n: {"discovery": {**R5.DEFAULTS5, **kw}, "blend": bk} for n, (kw, bk) in FINAL.items()},
              open(os.path.join(OUT, "choices.json"), "w"), indent=1, default=str)
    print("final lists written", timings)


def credits_packet(pid):
    """Directors / creators, top-5 cast, first companies and networks (graders can't judge person queries without)."""
    if "cr" not in _pk:
        import gzip
        cr, co = {}, {}
        with gzip.open(os.path.join(C.DATA, "credits.jsonl.gz"), "rt", encoding="utf-8") as f:
            for line in f:
                t = json.loads(line)
                cr[t["id"]] = t
        with gzip.open(os.path.join(C.DATA, "companies.jsonl.gz"), "rt", encoding="utf-8") as f:
            for line in f:
                t = json.loads(line)
                co[t["id"]] = t
        _pk["cr"], _pk["co"] = cr, co
    t, c = _pk["cr"].get(pid), _pk["co"].get(pid)
    out = {}
    if t:
        out["directors"] = [d["name"] for d in t["directors"][:3]]
        if t["creators"]:
            out["creators"] = [d["name"] for d in t["creators"][:3]]
        out["writers"] = [d["name"] for d in t["writers"][:3]]
        out["cast"] = [d["name"] for d in t["cast"][:5]]
    if c:
        out["companies"] = [x["name"] for x in (c["companies"] or [])[:3]]
        if c.get("networks"):
            out["networks"] = [x["name"] for x in c["networks"][:2]]
    return out


_pk = {}


def write_pool(tag, lists_by_name, ctxs):
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
        items = []
        for pid, fb in seen.items():
            it = P.packet(cat, pid, fb)
            it["credits"] = credits_packet(pid)
            items.append(it)
        items.sort(key=lambda it: it["pid"])
        seed = int(hashlib.sha256(f"{P.SEED}:{c.id}".encode()).hexdigest()[:8], 16)
        random.Random(seed).shuffle(items)
        pairs += len(items)
        out.append(dict(query_id=c.id, query=c.query, intent=c.intent, items=items))
    json.dump(out, open(os.path.join(G, f"r5-{tag}-part1.json"), "w"), ensure_ascii=False, indent=1)
    rev = [dict(p, items=list(reversed(p["items"]))) for p in reversed(out)]
    json.dump(rev, open(os.path.join(G, f"r5-{tag}-part1-rev.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{tag}: {len(out)} queries, {pairs} ungraded pairs")


def pool(tag, extra=None):
    """Pool the saved round-5 lists (and optional sweep variants) for the non-holdout3 splits."""
    ctxs = contexts()
    ls = {n: json.load(open(os.path.join(LISTS, f"{n}.json"))) for n in ["prod", BASE] + list(FINAL)}
    for name in extra or []:
        kw, bk = variants()[name]
        ls[name], _, _ = run(kw, bk, ctxs)
    write_pool(tag, ls, ctxs)


def _load(tag, who):
    return json.load(open(os.path.join(G, f"r5-{tag}-{who}-part1.json")))


def compare(tag):
    import grade4
    Ag, Bg = _load(tag, "A"), _load(tag, "B")
    packets = json.load(open(os.path.join(G, f"r5-{tag}-part1.json")))
    keys = [(p["query_id"], str(it["pid"])) for p in packets for it in p["items"]]
    assert all(q in Ag and pid in Ag[q] for q, pid in keys), "A incomplete"
    assert all(q in Bg and pid in Bg[q] for q, pid in keys), "B incomplete"
    a = [int(Ag[q][pid]) for q, pid in keys]
    b = [int(Bg[q][pid]) for q, pid in keys]
    dis = {}
    for q, pid in keys:
        if abs(int(Ag[q][pid]) - int(Bg[q][pid])) >= 2:
            dis.setdefault(q, []).append(pid)
    json.dump(dis, open(os.path.join(G, f"r5-{tag}-disagreements.json"), "w"), indent=1)
    exact = sum(x == y for x, y in zip(a, b)) / len(a)
    print(f"{len(keys)} pairs, quadratic weighted kappa {grade4.qwk(a, b):.3f}, exact {exact:.1%}, "
          f"{sum(len(v) for v in dis.values())} pairs 2+ apart")
    # packets for assessor C
    cpk = []
    for p in packets:
        if p["query_id"] in dis:
            cpk.append(dict(p, items=[it for it in p["items"] if str(it["pid"]) in dis[p["query_id"]]]))
    json.dump(cpk, open(os.path.join(G, f"r5-{tag}-C-packets.json"), "w"), ensure_ascii=False, indent=1)


def merge(tag):
    Ag, Bg = _load(tag, "A"), _load(tag, "B")
    cp = os.path.join(G, f"r5-{tag}-C.json")
    Cg = json.load(open(cp)) if os.path.exists(cp) else {}
    packets = json.load(open(os.path.join(G, f"r5-{tag}-part1.json")))
    gp = os.path.join(C.ARENA, "results", "grades.json")
    grades = json.load(open(gp))
    before = sum(len(v) for v in grades.values())
    detail, added = {}, 0
    for p in packets:
        q = p["query_id"]
        for it in p["items"]:
            pid = str(it["pid"])
            a, b = int(Ag[q][pid]), int(Bg[q][pid])
            c = Cg.get(q, {}).get(pid)
            if abs(a - b) >= 2:
                assert c is not None, f"missing C grade for {q} {pid}"
                g = int(c)
            else:
                g = (a + b) // 2
            detail.setdefault(q, {})[pid] = dict(A=a, B=b, C=c, grade=g)
            if pid in grades.get(q, {}):
                continue
            grades.setdefault(q, {})[pid] = g
            added += 1
    json.dump(detail, open(os.path.join(G, f"r5-{tag}-merged-detail.json"), "w"), indent=1)
    json.dump(grades, open(gp, "w"), indent=1)
    print(f"added {added} pairs; grades.json {before} -> {sum(len(v) for v in grades.values())} pairs")


def detect_report():
    for c in load_queries(SPLITS):
        d = E.detect(c["query"])
        if d:
            print(c["id"], c["type"], "|", c["query"], "->", [(e.name, e.match, e.role) for e in d.entities], d.intent,
                  d.lean, repr(d.residual), d.era)


# --- reports --------------------------------------------------------------------------------------

NAMES = ["prod", BASE, "r5"]
P50_ADDED = {"prod": "235 ms", BASE: "30-45 ms", "r5": "30-45 ms (+~1-3 ms on entity queries)"}


def _table(ctxs, ls, grades, groups):
    pq = {n: per_query(ctxs, ls[n], grades) for n in NAMES}
    g0 = list(groups)[0]
    L = ["| ranker | " + " | ".join(f"{g} ndcg10" for g in groups) + f" | bad5 ({g0}) | good10 ({g0}) |",
         "|---|" + "---|" * (len(groups) + 2)]
    out = {}
    for n in NAMES:
        cells = []
        for g, cs in groups.items():
            v = _mean([pq[n][c.id]["ndcg10"] for c in cs])
            out.setdefault(n, {})[g] = v
            cells.append(f"{v:.3f}")
        cs0 = list(groups.values())[0]
        bad = sum(pq[n][c.id]["bad5"] for c in cs0)
        good = _mean([pq[n][c.id]["good10"] for c in cs0])
        out[n]["bad5"] = bad
        L.append(f"| {n} | " + " | ".join(cells) + f" | {bad} | {good:.2f} |")
    return L, pq, out


def report():
    ctxs = contexts()
    grades = M.load_grades()
    ls = {n: json.load(open(os.path.join(LISTS, f"{n}.json"))) for n in NAMES}
    graded = [c for c in ctxs if c.type != "title_lookup"]
    groups = {"ppl-dev": [c for c in graded if c.id.startswith("ppl")],
              "dev (all)": [c for c in graded if c.split == "dev"],
              "dev (pre-round-5)": [c for c in graded if c.split == "dev" and not c.id.startswith("ppl")],
              "holdout": [c for c in graded if c.split == "holdout"], "holdout2": [c for c in graded if c.split == "holdout2"]}
    L, pq, out = _table(ctxs, ls, grades, groups)
    L = ["# Round 5 dev metrics", "", "Graded pools; ungraded titles count 0 (unj10 below).", ""] + L
    L += ["", "## Per query: entity queries (dev, holdout, holdout2)", "",
          "| query | split | entity (match) | intent | prod | r4-combo-fast | r5 | Δ r5 − base | unj10 r5 |", "|---|---|---|---|---|---|---|---|---|"]
    for c in graded:
        d = E.detect(c.query)
        if not d:
            continue
        cells = [f"{pq[n][c.id]['ndcg10']:.3f}" for n in NAMES]
        L.append(f"| {c.id} {c.query} | {c.split} | {', '.join(f'{e.name} ({e.match})' for e in d.entities)} | {d.intent} | "
                 + " | ".join(cells) + f" | {pq['r5'][c.id]['ndcg10'] - pq[BASE][c.id]['ndcg10']:+.3f} | {pq['r5'][c.id]['unj10']} |")
    diffq = [c.id for c in graded if [x["id"] for x in ls["r5"][c.id][:10]] != [x["id"] for x in ls[BASE][c.id][:10]]]
    L += ["", f"Queries whose r5 top 10 differs from r4-combo-fast: {', '.join(diffq)}", ""]
    L += ["## Top 10 with grades (entity queries)", ""]
    for c in graded:
        if not E.detect(c.query):
            continue
        L += [f"### {c.id} {c.query}", "", f"Intent: {c.intent}", "", "| rank | " + " | ".join(NAMES) + " |", "|---|" + "---|" * len(NAMES)]
        for i in range(10):
            cells = []
            for n in NAMES:
                x = ls[n][c.id][i] if i < len(ls[n][c.id]) else None
                cells.append(f"{x['title']} ({x['year']}) **{grades.get(c.id, {}).get(x['id'], '?')}**" if x else "")
            L.append(f"| {i + 1} | " + " | ".join(cells) + " |")
        L.append("")
    open(os.path.join(OUT, "metrics-dev.md"), "w").write("\n".join(L) + "\n")
    json.dump(out, open(os.path.join(OUT, "metrics-dev.json"), "w"), indent=1)
    print("\n".join(L[:12]))


# --- holdout3 (only after the freeze in LOG.md) ----------------------------------------------------

H3 = os.path.join(OUT, "holdout3")


def _frozen():
    log = open(os.path.join(C.ARENA, "results", "LOG.md")).read()
    assert "## Round 5" in log and "frozen before holdout3" in log, "freeze the r5 config in LOG.md first"


def holdout3_lists():
    _frozen()
    os.makedirs(os.path.join(H3, "lists"), exist_ok=True)
    cs = contexts(("holdout3",))
    json.dump(prod_lists(cs), open(os.path.join(H3, "lists", "prod.json"), "w"), ensure_ascii=False)
    json.dump(base_lists(cs), open(os.path.join(H3, "lists", f"{BASE}.json"), "w"), ensure_ascii=False)
    kw, bk = FINAL["r5"]
    ls, ms, info = run(kw, bk, cs)
    json.dump(ls, open(os.path.join(H3, "lists", "r5.json"), "w"), ensure_ascii=False)
    json.dump({q: e for q, e in info.items()}, open(os.path.join(H3, "entities.json"), "w"), indent=1, ensure_ascii=False)
    v = sorted(ms.values())
    json.dump({"r5": {"mean_ms": statistics.mean(v), "max_ms": v[-1]}}, open(os.path.join(H3, "timings.json"), "w"))
    lists = {n: json.load(open(os.path.join(H3, "lists", f"{n}.json"))) for n in NAMES}
    write_pool("ho3", lists, cs)


def holdout3_metrics():
    _frozen()
    cs = contexts(("holdout3",))
    grades = M.load_grades()
    graded = [c for c in cs if c.type != "title_lookup"]
    ls = {n: json.load(open(os.path.join(H3, "lists", f"{n}.json"))) for n in NAMES}
    L, pq, out = _table(cs, ls, grades, {"holdout3": graded})
    dev = json.load(open(os.path.join(OUT, "metrics-dev.json")))
    d = out["r5"]["holdout3"] - out[BASE]["holdout3"]
    drops = {g: dev["r5"][g] - dev[BASE][g] for g in ("dev (all)", "holdout", "holdout2")}
    ok1 = d >= 0.05
    ok2 = out["r5"]["bad5"] <= out[BASE]["bad5"]
    ok3 = all(v >= -0.01 for v in drops.values())
    unj = sum(pq[n][c.id]["unj10"] for n in NAMES for c in graded)
    L = ["# Round 5: holdout3", "", f"Frozen r5 (LOG.md, Round 5). Unjudged titles in the top 10 of the three lists: {unj}.", ""] + L
    L += ["", "## Contract criteria (round-5 note)", "",
          f"- ndcg10 r5 − r4-combo-fast on holdout3: {d:+.3f} (needs >= +0.05): {'pass' if ok1 else 'FAIL'}",
          f"- bad5 r5 {out['r5']['bad5']} vs r4-combo-fast {out[BASE]['bad5']} (not higher): {'pass' if ok2 else 'FAIL'}",
          "- earlier splits, r5 − r4-combo-fast (no drop over 0.01): " + ", ".join(f"{g} {v:+.3f}" for g, v in drops.items())
          + f": {'pass' if ok3 else 'FAIL'}",
          f"- verdict: **{'r5 wins' if ok1 and ok2 and ok3 else 'r5 does not win'}**", ""]
    L += ["## Per query", "", "| query | entity (match) | intent | prod | r4-combo-fast | r5 | Δ r5 − base |", "|---|---|---|---|---|---|---|"]
    for c in graded:
        det = E.detect(c.query)
        ent = ", ".join(f"{e.name} ({e.match})" for e in det.entities) if det else "none"
        L.append(f"| {c.id} {c.query} | {ent} | {det.intent if det else '–'} | " + " | ".join(f"{pq[n][c.id]['ndcg10']:.3f}" for n in NAMES)
                 + f" | {pq['r5'][c.id]['ndcg10'] - pq[BASE][c.id]['ndcg10']:+.3f} |")
    L += ["", "## Top 10 with grades", ""]
    for c in graded:
        L += [f"### {c.id} {c.query}", "", f"Intent: {c.intent}", "", "| rank | " + " | ".join(NAMES) + " |", "|---|" + "---|" * len(NAMES)]
        for i in range(10):
            cells = []
            for n in NAMES:
                x = ls[n][c.id][i] if i < len(ls[n][c.id]) else None
                cells.append(f"{x['title']} ({x['year']}) **{grades.get(c.id, {}).get(x['id'], '?')}**" if x else "")
            L.append(f"| {i + 1} | " + " | ".join(cells) + " |")
        L.append("")
    open(os.path.join(H3, "metrics-tables.md"), "w").write("\n".join(L) + "\n")
    json.dump(dict(summary=out, per_query={n: {q: v["ndcg10"] for q, v in pq[n].items()} for n in NAMES},
                   criteria=dict(delta=d, bad5_ok=ok2, drops=drops, win=ok1 and ok2 and ok3)),
              open(os.path.join(H3, "metrics.json"), "w"), indent=1)
    print("\n".join(L[:30]))


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "detect":
        E.warm()
        detect_report()
    elif cmd == "sweep":
        sweep(sys.argv[2:] or None)
    elif cmd == "final":
        final()
    elif cmd == "pool":
        pool(sys.argv[2], sys.argv[3:])
    elif cmd == "compare":
        compare(sys.argv[2])
    elif cmd == "merge":
        merge(sys.argv[2])
    elif cmd == "report":
        report()
    elif cmd == "holdout3":
        holdout3_lists()
    elif cmd == "holdout3-metrics":
        holdout3_metrics()
