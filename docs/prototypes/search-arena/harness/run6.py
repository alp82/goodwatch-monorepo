"""Round 6: style neighbours for person / studio style queries, alternate cuts folded.

Usage:
  .venv/bin/python harness/run6.py sweep [prefix ...]   # variants on the style queries; every split, round-6 metrics
  .venv/bin/python harness/run6.py lists <tag> [variant ...]  # pool ungraded top 10s of prod, r4-combo-fast, r5 and
                                                         # the variants (style / both queries of the earlier splits)
  .venv/bin/python harness/run6.py final                 # FINAL lists on the earlier splits -> results/round6/lists
  .venv/bin/python harness/run6.py report                # results/round6/metrics-dev.md
  .venv/bin/python harness/run6.py holdout4              # ONLY after the freeze: lists + pool for holdout4
  .venv/bin/python harness/run6.py holdout4-metrics      # ONLY after grading: metrics.md, criteria

Blindness: every command except holdout4 / holdout4-metrics reads only the splits dev, holdout, holdout2 and
holdout3 (run5.contexts filters queries.json before any capture is read). holdout4 (sty-*) is never read before
the freeze in LOG.md ("Round 6").

Metrics (contract note, round 6): metrics.graded_query6 (a 2nd+ alternate cut in the top 10 counts as grade 0,
the ideal keeps one cut per set) and metrics.own10.
"""
import json, math, os, statistics, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import blend4 as B4  # noqa: E402
import catalog as C  # noqa: E402
import cuts  # noqa: E402
import entities as E  # noqa: E402
import grade6  # noqa: E402
import metrics as M  # noqa: E402
import rankers6 as R6  # noqa: E402
import run5  # noqa: E402

OUT = os.path.join(C.ARENA, "results", "round6")
LISTS = os.path.join(OUT, "lists")
TOP = 50
SPLITS = ("dev", "holdout", "holdout2", "holdout3")
NAMES = ["prod", "r4-combo-fast", "r5", "r6"]


def contexts(splits=SPLITS):
    return run5.contexts(splits)


def run(kw, bk, ctxs, fold=True):
    """hyb6 + blend4 (title-word bonus off on entity queries, as r5) + alternate cuts folded."""
    import rankers6
    lists, ms, info_by = {}, {}, {}
    for ctx in ctxs:
        t = time.perf_counter()
        info = {}
        disc = rankers6.hyb6(ctx, debug=info, **kw)
        b = dict(bk)
        if info.get("entity"):
            b["kind"] = False
        blended = B4.blend(ctx, [(pid, i + 1, s) for i, (pid, s, _) in enumerate(disc)], exclude=info.get("exclude"), **b)
        if fold:
            keep = set(cuts.fold([x["id"] for x in blended]))
            blended = [x for x in blended if x["id"] in keep]
        ent = info.get("entity")
        if ent and ent.get("intent") == "style" and ent.get("own_max") is not None:
            blended = cap_own(blended, ent["own_ids"], ent["own_max"])
        ms[ctx.id] = (time.perf_counter() - t) * 1000
        lists[ctx.id] = [{k: x[k] for k in ("id", "title", "year", "media_type", "score")} for x in blended[:TOP]]
        info_by[ctx.id] = {k: v for k, v in ent.items() if k != "own_ids"} if ent else None
    return lists, ms, info_by


def cap_own(blended, own_ids, own_max, n=10):
    """Guard after the blend and the cut folding: at most own_max own titles in the top n (the blend's lookup rows or
    a folded cut can shift an own title from rank 11 into the top 10)."""
    top_, extra, k = [], [], 0
    for x in blended:
        if len(top_) >= n:
            break
        if x["id"] in own_ids:
            k += 1
            if k > own_max:
                extra.append(x)
                continue
        top_.append(x)
    ids = {x["id"] for x in top_} | {x["id"] for x in extra}
    return top_ + extra + [x for x in blended if x["id"] not in ids]


def base_lists(ctxs):
    return {"prod": run5.prod_lists(ctxs), "r4-combo-fast": run5.base_lists(ctxs),
            "r5": run5.run(*run5.FINAL["r5"], ctxs)[0]}


# --- metrics --------------------------------------------------------------------------------------

_qmeta = {}


def qmeta(ctx):
    if not _qmeta:
        for q in grade6.load_queries(tuple(set(SPLITS) | {ctx.split})):
            _qmeta[q["id"]] = q
    return _qmeta.get(ctx.id) or {}


def per_query(ctxs, lists, grades):
    out = {}
    for c in ctxs:
        if c.type == "title_lookup":
            continue
        ids = [x["id"] for x in lists[c.id]]
        g = grades.get(c.id, {})
        m = M.graded_query6(ids, g) if g else dict(ndcg10=float("nan"), good10=0, bad5=0, unj10=10, cuts10=0)
        m["own10"] = M.own10(ids, c.query) if qmeta(c).get("person_intent") in ("style", "both") else None
        out[c.id] = m
    return out


def _mean(v):
    v = [x for x in v if x is not None and not (isinstance(x, float) and math.isnan(x))]
    return statistics.mean(v) if v else float("nan")


def groups(ctxs):
    g = [c for c in ctxs if c.type != "title_lookup"]
    sty = lambda c: qmeta(c).get("person_intent") in ("style", "both")
    return {"dev-style": [c for c in g if c.split == "dev" and sty(c)],
            "ho3-style": [c for c in g if c.split == "holdout3" and sty(c)],
            "dev": [c for c in g if c.split == "dev"], "holdout": [c for c in g if c.split == "holdout"],
            "holdout2": [c for c in g if c.split == "holdout2"], "holdout3": [c for c in g if c.split == "holdout3"]}


def summary(ctxs, lists, grades):
    pq = per_query(ctxs, lists, grades)
    s = {}
    for k, cs in groups(ctxs).items():
        s[k] = _mean([pq[c.id]["ndcg10"] for c in cs])
        s[k + "_unj"] = sum(pq[c.id]["unj10"] for c in cs)
        s[k + "_bad5"] = sum(pq[c.id]["bad5"] for c in cs)
        s[k + "_own"] = _mean([pq[c.id]["own10"] for c in cs if qmeta(c).get("person_intent") == "style"])
    return s, pq


def fmt(name, s):
    return (f"{name:30s} dsty {s['dev-style']:.3f} u{s['dev-style_unj']:3d} b{s['dev-style_bad5']:2d} o{s['dev-style_own']:.1f} | "
            f"h3sty {s['ho3-style']:.3f} u{s['ho3-style_unj']:3d} b{s['ho3-style_bad5']:2d} o{s['ho3-style_own']:.1f} | "
            f"dev {s['dev']:.3f} ho {s['holdout']:.3f} ho2 {s['holdout2']:.3f} ho3 {s['holdout3']:.3f}")


# --- configs --------------------------------------------------------------------------------------

KW5, BK5 = run5.FINAL["r5"]


def cfg(**over):
    return (dict(KW5, **over), BK5)


FINAL = {"r6": cfg()}


def variants():
    v = {"r6": cfg(), "r6-nos6": cfg(s6=False)}
    for k, vals in dict(w_fp=[0.2, 0.8], w_emb=[0.0, 0.6], w_terms=[0.0, 0.6], w_mention=[0.0, 0.3], w_peer=[0.0, 0.6],
                        w_agree=[0.0, 0.5], w_jev=[0.0, 0.4], damp=[0.0, 0.4], own_boost=[0.0, 1.0], own_min=[2, 4],
                        own_max=[4, 6], peer_k=[8, 30], peer_titles=[4, 15], terms_n=[20, 80]).items():
        for x in vals:
            v[f"r6-{k}={x}"] = cfg(**{k: x})
    v["r6-peer_emb=0"] = cfg(peer_emb=0.0)
    v["r6-strong"] = cfg(w_fp=0.8, w_emb=0.6, w_jev=0.4, own_max=6)
    S = dict(w_fp=0.8, w_emb=0.6, w_jev=0.4, own_max=6)
    v["c1"] = cfg(**S, peer_emb=0.0)
    v["c1-damp4"] = cfg(**S, peer_emb=0.0, damp=0.4)
    v["c1-ob1"] = cfg(**S, peer_emb=0.0, own_boost=1.0)
    v["c1-all"] = cfg(**S, peer_emb=0.0, damp=0.4, own_boost=1.0)
    v["c1-all-max5"] = cfg(**dict(S, own_max=5), peer_emb=0.0, damp=0.4, own_boost=1.0)
    v["c1-all-peer0"] = cfg(**S, w_peer=0.0, damp=0.4, own_boost=1.0)
    v["c1-all-terms0"] = cfg(**S, peer_emb=0.0, damp=0.4, own_boost=1.0, w_terms=0.0)
    v["c1-all-terms6"] = cfg(**S, peer_emb=0.0, damp=0.4, own_boost=1.0, w_terms=0.6)
    v["c1-all-neg"] = cfg(**S, peer_emb=0.0, damp=0.4, own_boost=1.0, neg_own_min=0, neg_own_boost=0.0)
    v["c1-all-emb9"] = cfg(**dict(S, w_emb=0.9), peer_emb=0.0, damp=0.4, own_boost=1.0)
    v["c1-all-jev6"] = cfg(**dict(S, w_jev=0.6), peer_emb=0.0, damp=0.4, own_boost=1.0)
    v["c1-all-damp6"] = cfg(**S, peer_emb=0.0, damp=0.6, own_boost=1.0)
    B = dict(S, peer_emb=0.0, own_boost=1.0)
    v["c2"] = cfg(**B)
    v["c2-max5"] = cfg(**dict(B, own_max=5))
    v["c2-terms6"] = cfg(**B, w_terms=0.6)
    v["c2-less"] = cfg(**B, neg_own_max=3, neg_own_min=0)
    v["c2-less-w8"] = cfg(**B, neg_own_max=3, neg_own_min=0, neg_w=0.8)
    v["c2-less-w8-ob0"] = cfg(**B, neg_own_max=3, neg_own_min=0, neg_w=0.8, neg_own_boost=0.0)
    v["c2-max5-terms6"] = cfg(**dict(B, own_max=5), w_terms=0.6)
    return v


def style_ctxs(ctxs):
    return [c for c in ctxs if qmeta(c).get("person_intent") in ("style", "both") or
            (E.detect(c.query) and E.detect(c.query).intent in ("style", "both"))]


def sweep(only=None, extra=None):
    grades = M.load_grades()
    ctxs = contexts()
    base = base_lists(ctxs)
    for n in ("prod", "r4-combo-fast", "r5"):
        print(fmt(n, summary(ctxs, base[n], grades)[0]), flush=True)
    sc = style_ctxs(ctxs)
    vs = dict(variants(), **(extra or {}))
    for name, (kw, bk) in vs.items():
        if only and not any(name.startswith(o) for o in only):
            continue
        ls, _, _ = run(kw, bk, sc)
        full = {**base["r5"], **ls}
        # folding applies to every query: r6 lists of the other queries are r5's with cuts folded
        for c in ctxs:
            if c.id not in ls:
                keep = set(cuts.fold([x["id"] for x in full[c.id]]))
                full[c.id] = [x for x in full[c.id] if x["id"] in keep]
        print(fmt(name, summary(ctxs, full, grades)[0]), flush=True)


def pool(tag, names):
    """Ungraded top-10 pairs of prod, r4-combo-fast, r5 and the named variants (style / both queries)."""
    ctxs = contexts()
    sc = style_ctxs(ctxs)
    ls = {k: v for k, v in base_lists(sc).items()}
    vs = variants()
    for n in names:
        kw, bk = vs[n] if n in vs else FINAL[n]
        ls[n], _, _ = run(kw, bk, sc)
    grades = M.load_grades()
    packets = []
    names_fb = grade6._names()
    for c in sc:
        if c.type == "title_lookup":
            continue
        new = []
        for n, l in ls.items():
            for x in l[c.id][:10]:
                if x["id"] not in grades.get(c.id, {}) and x["id"] not in new:
                    new.append(x["id"])
        if new:
            q = qmeta(c) or dict(id=c.id, query=c.query, intent=c.intent)
            packets.append(grade6.make_packet(q, new, names_fb))
    grade6.write(tag, packets)


# --- final lists and report -----------------------------------------------------------------------

def final():
    os.makedirs(LISTS, exist_ok=True)
    ctxs = contexts()
    base = base_lists(ctxs)
    for n, l in base.items():
        json.dump(l, open(os.path.join(LISTS, f"{n}.json"), "w"), ensure_ascii=False)
    timings, ents = {}, {}
    for name, (kw, bk) in FINAL.items():
        ls, ms, info = run(kw, bk, ctxs)
        json.dump(ls, open(os.path.join(LISTS, f"{name}.json"), "w"), ensure_ascii=False)
        v = sorted(ms.values())
        sv = sorted(ms[c.id] for c in style_ctxs(ctxs))
        timings[name] = {"mean_ms": statistics.mean(v), "p95_ms": v[int(0.95 * len(v)) - 1], "max_ms": v[-1],
                         "style_median_ms": statistics.median(sv), "style_max_ms": sv[-1]}
        ents[name] = {q: e for q, e in info.items() if e}
    json.dump(timings, open(os.path.join(OUT, "timings.json"), "w"), indent=1)
    json.dump(ents, open(os.path.join(OUT, "entities.json"), "w"), indent=1, ensure_ascii=False, default=str)
    json.dump({n: {"discovery": {**R6.DEFAULTS6, **kw}, "blend": bk} for n, (kw, bk) in FINAL.items()},
              open(os.path.join(OUT, "choices.json"), "w"), indent=1, default=str)
    print("final lists written", timings)


def _cell(x, g):
    return f"{x['title']} ({x['year']}) **{g.get(x['id'], '?')}**"


def table(ctxs, ls, grades, names, gs):
    pq = {n: per_query(ctxs, ls[n], grades) for n in names}
    L = ["| ranker | " + " | ".join(f"{g} ndcg10" for g in gs) + " | bad5 (" + list(gs)[0] + ") | own10 style (" + list(gs)[0] + ") |",
         "|---|" + "---|" * (len(gs) + 2)]
    out = {}
    for n in names:
        cells = []
        for g, cs in gs.items():
            v = _mean([pq[n][c.id]["ndcg10"] for c in cs])
            out.setdefault(n, {})[g] = v
            cells.append(f"{v:.3f}")
        cs0 = list(gs.values())[0]
        out[n]["bad5"] = sum(pq[n][c.id]["bad5"] for c in cs0)
        out[n]["own10"] = _mean([pq[n][c.id]["own10"] for c in cs0 if qmeta(c).get("person_intent") == "style"])
        L.append(f"| {n} | " + " | ".join(cells) + f" | {out[n]['bad5']} | {out[n]['own10']:.2f} |")
    return L, pq, out


def report():
    ctxs = contexts()
    grades = M.load_grades()
    ls = {n: json.load(open(os.path.join(LISTS, f"{n}.json"))) for n in NAMES}
    gs = groups(ctxs)
    L, pq, out = table(ctxs, ls, grades, NAMES, gs)
    L = ["# Round 6 dev metrics", "", "Round-6 metrics: a 2nd+ alternate cut in the top 10 counts as grade 0; own10 = the "
         "entity's own titles in the top 10 (style queries).", ""] + L
    L += ["", "## Per query: style and both queries", "",
          "| query | split | intent | " + " | ".join(NAMES) + " | own10 r5 / r6 | Δ r6 − r5 |", "|---|---|---|" + "---|" * (len(NAMES) + 2)]
    for c in gs["dev-style"] + gs["ho3-style"] + [c for c in gs["dev"] + gs["holdout2"] if c.id in ("lab-01", "ho2-15")]:
        L.append(f"| {c.id} {c.query} | {c.split} | {qmeta(c).get('person_intent', 'both (no field)')} | "
                 + " | ".join(f"{pq[n][c.id]['ndcg10']:.3f}" for n in NAMES)
                 + f" | {pq['r5'][c.id]['own10']} / {pq['r6'][c.id]['own10']} | {pq['r6'][c.id]['ndcg10'] - pq['r5'][c.id]['ndcg10']:+.3f} |")
    moved = [(c.id, pq["r6"][c.id]["ndcg10"] - pq["r5"][c.id]["ndcg10"]) for cs in (gs["dev"], gs["holdout"], gs["holdout2"], gs["holdout3"])
             for c in cs if abs(pq["r6"][c.id]["ndcg10"] - pq["r5"][c.id]["ndcg10"]) > 1e-9]
    L += ["", "Queries whose ndcg10 moves r6 vs r5: " + ", ".join(f"{q} {d:+.3f}" for q, d in moved), ""]
    L += ["## Top 10 with grades (style and both queries)", ""]
    for c in gs["dev-style"] + gs["ho3-style"]:
        L += [f"### {c.id} {c.query}", "", f"Intent: {c.intent}", "", "| rank | " + " | ".join(NAMES) + " |", "|---|" + "---|" * len(NAMES)]
        for i in range(10):
            L.append(f"| {i + 1} | " + " | ".join(_cell(ls[n][c.id][i], grades.get(c.id, {})) if i < len(ls[n][c.id]) else ""
                                                for n in NAMES) + " |")
        L.append("")
    os.makedirs(OUT, exist_ok=True)
    open(os.path.join(OUT, "metrics-dev.md"), "w").write("\n".join(L) + "\n")
    json.dump(dict(summary=out, per_query={n: {q: v["ndcg10"] for q, v in pq[n].items()} for n in NAMES}),
              open(os.path.join(OUT, "metrics-dev.json"), "w"), indent=1)
    print("\n".join(L[:14]))


# --- holdout4 (only after the freeze in LOG.md) ----------------------------------------------------

H4 = os.path.join(OUT, "holdout4")


def _frozen():
    log = open(os.path.join(C.ARENA, "results", "LOG.md")).read()
    assert "## Round 6" in log and "frozen before holdout4" in log, "freeze the r6 config in LOG.md first"


def holdout4_lists():
    _frozen()
    os.makedirs(os.path.join(H4, "lists"), exist_ok=True)
    cs = contexts(("holdout4",))
    ls = base_lists(cs)
    kw, bk = FINAL["r6"]
    ls["r6"], ms, info = run(kw, bk, cs)
    for n, l in ls.items():
        json.dump(l, open(os.path.join(H4, "lists", f"{n}.json"), "w"), ensure_ascii=False)
    json.dump(info, open(os.path.join(H4, "entities.json"), "w"), indent=1, ensure_ascii=False, default=str)
    v = sorted(ms.values())
    json.dump({"r6": {"mean_ms": statistics.mean(v), "median_ms": statistics.median(v), "max_ms": v[-1]}},
              open(os.path.join(H4, "timings.json"), "w"))
    grades = M.load_grades()
    qs = {q["id"]: q for q in grade6.load_queries(("holdout4",))}
    names_fb = {}
    for c in cs:
        cap = json.load(open(os.path.join(run5.X.CAPTURES, f"{c.id}.json")))
        for p in cap["prod"]:
            names_fb[p["point_id"]] = (p["title"], p["year"], p["media_type"])
    packets = []
    for c in cs:
        if c.type == "title_lookup":
            continue
        new = []
        for n in NAMES:
            for x in ls[n][c.id][:10]:
                if x["id"] not in grades.get(c.id, {}) and x["id"] not in new:
                    new.append(x["id"])
        if new:
            packets.append(grade6.make_packet(qs[c.id], new, names_fb))
    grade6.write("ho4", packets)
    for c in cs:
        print(c.id, c.query, "->", (info.get(c.id) or {}).get("names"), (info.get(c.id) or {}).get("intent"))


def holdout4_metrics():
    _frozen()
    cs = contexts(("holdout4",))
    for q in grade6.load_queries(("holdout4",)):
        _qmeta[q["id"]] = q
    grades = M.load_grades()
    ls = {n: json.load(open(os.path.join(H4, "lists", f"{n}.json"))) for n in NAMES}
    graded = [c for c in cs if c.type != "title_lookup"]
    L, pq, out = table(cs, ls, grades, NAMES, {"holdout4": graded})
    dev = json.load(open(os.path.join(OUT, "metrics-dev.json")))["summary"]
    d4 = out["r6"]["holdout4"] - out["r4-combo-fast"]["holdout4"]
    d5 = out["r6"]["holdout4"] - out["r5"]["holdout4"]
    drops = {g: dev["r6"][g] - dev["r5"][g] for g in ("dev", "holdout", "holdout2", "holdout3")}
    own_style = [pq["r6"][c.id]["own10"] for c in graded if qmeta(c).get("person_intent") == "style"]
    own_mean = _mean(own_style)
    ok1 = d4 >= 0.05 and d5 >= 0.05
    ok2 = out["r6"]["bad5"] <= min(out["r4-combo-fast"]["bad5"], out["r5"]["bad5"])
    ok3 = 3 <= own_mean <= 6
    ok4 = all(v >= -0.01 for v in drops.values())
    win = ok1 and ok2 and ok3 and ok4
    unj = sum(pq[n][c.id]["unj10"] for n in NAMES for c in graded)
    L = ["# Round 6: holdout4", "", f"Frozen r6 (LOG.md, Round 6). Unjudged titles in the top 10 of the four lists: {unj}.", ""] + L
    L += ["", "## Contract criteria (round-6 note)", "",
          f"- ndcg10 r6 − r4-combo-fast {d4:+.3f}, r6 − r5 {d5:+.3f} (both need >= +0.05): {'pass' if ok1 else 'FAIL'}",
          f"- bad5 r6 {out['r6']['bad5']} vs r4-combo-fast {out['r4-combo-fast']['bad5']}, r5 {out['r5']['bad5']} (not higher than either): {'pass' if ok2 else 'FAIL'}",
          f"- mean own10 of r6 on the {len(own_style)} style queries {own_mean:.2f} (3 to 6): {'pass' if ok3 else 'FAIL'}",
          "- earlier splits, r6 − r5 (no drop over 0.01): " + ", ".join(f"{g} {v:+.3f}" for g, v in drops.items()) + f": {'pass' if ok4 else 'FAIL'}",
          f"- verdict: **{'r6 wins' if win else 'r6 does not win'}**", ""]
    L += ["## Per query", "", "| query | entity (match) | person_intent / detected | " + " | ".join(NAMES) + " | own10 r5 / r6 | Δ r6 − r5 |",
          "|---|---|---|" + "---|" * (len(NAMES) + 2)]
    for c in graded:
        det = E.detect(c.query)
        ent = ", ".join(f"{e.name} ({e.match})" for e in det.entities) if det else "none"
        L.append(f"| {c.id} {c.query} | {ent} | {qmeta(c).get('person_intent')} / {det.intent if det else '–'} | "
                 + " | ".join(f"{pq[n][c.id]['ndcg10']:.3f}" for n in NAMES)
                 + f" | {pq['r5'][c.id]['own10']} / {pq['r6'][c.id]['own10']} | {pq['r6'][c.id]['ndcg10'] - pq['r5'][c.id]['ndcg10']:+.3f} |")
    L += ["", "Grade-0 titles in the top 5 (incl. 2nd cuts): " + "; ".join(
        f"{n} {c.id} {ls[n][c.id][i]['title']} (#{i + 1})" for n in NAMES for c in graded for i in range(5)
        if i < len(ls[n][c.id]) and (grades.get(c.id, {}).get(ls[n][c.id][i]["id"]) == 0
                                     or i in cuts.second_cuts([x["id"] for x in ls[n][c.id]], 10))), ""]
    L += ["## Top 10 with grades", ""]
    for c in graded:
        L += [f"### {c.id} {c.query}", "", f"Intent: {c.intent}", "", "| rank | " + " | ".join(NAMES) + " |", "|---|" + "---|" * len(NAMES)]
        for i in range(10):
            L.append(f"| {i + 1} | " + " | ".join(_cell(ls[n][c.id][i], grades.get(c.id, {})) if i < len(ls[n][c.id]) else ""
                                                for n in NAMES) + " |")
        L.append("")
    open(os.path.join(H4, "metrics-tables.md"), "w").write("\n".join(L) + "\n")
    json.dump(dict(summary=out, per_query={n: {q: v["ndcg10"] for q, v in pq[n].items()} for n in NAMES},
                   own10={n: {q: v["own10"] for q, v in pq[n].items()} for n in NAMES},
                   criteria=dict(d4=d4, d5=d5, bad5_ok=ok2, own_mean=own_mean, drops=drops, win=win)),
              open(os.path.join(H4, "metrics.json"), "w"), indent=1)
    print("\n".join(L[:40]))


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "sweep":
        sweep(sys.argv[2:] or None)
    elif cmd == "lists":
        pool(sys.argv[2], sys.argv[3:])
    elif cmd == "final":
        final()
    elif cmd == "report":
        report()
    elif cmd == "holdout4":
        holdout4_lists()
    elif cmd == "holdout4-metrics":
        holdout4_metrics()
