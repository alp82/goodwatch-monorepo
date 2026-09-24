"""Round 2: sweeps on dev (proxy NDCG), then the chosen round-2 rankers into results/round2/.

Usage:
  .venv/bin/python harness/run2.py sweep      # dev-only sweeps -> results/round2/sweeps.md
  .venv/bin/python harness/run2.py final      # chosen configs -> results/round2/lists, timings, stages, choices

Proxy NDCG (sweeps only): graded titles only (ungraded ones are skipped, "condensed" list), ideal from every
graded title of the query; `cov` is the share of the top 10 that is graded. Final metrics use full grading
(metrics.py) after the round-2 pool is graded. Holdout lists are written for later; nothing reads holdout grades.
"""
import json, math, os, shutil, statistics, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import anchors as A  # noqa: E402
import blend as B  # noqa: E402
import blend2 as B2  # noqa: E402
import catalog as C  # noqa: E402
import context as X  # noqa: E402
import metrics as M  # noqa: E402
import rankers2 as R2  # noqa: E402

OUT = os.path.join(C.ARENA, "results", "round2")
LISTS = os.path.join(OUT, "lists")
TOP = 50


def blend_fn(strict=None, fuzzy=None):
    if strict is None and fuzzy is None:
        return lambda ctx, disc: B.blend(ctx.title_lookup, disc, ctx.query)
    return lambda ctx, disc: B2.blend(ctx.title_lookup, disc, ctx.query, strict=strict or 0, fuzzy=fuzzy or 0, mask=ctx.mask)


def run(fn, ctxs, bl):
    lists, ms = {}, {}
    for ctx in ctxs:
        t = time.perf_counter()
        disc = fn(ctx)
        ms[ctx.id] = (time.perf_counter() - t) * 1000
        blended = bl(ctx, [(pid, i + 1, s) for i, (pid, s, _) in enumerate(disc)])
        lists[ctx.id] = [{k: x[k] for k in ("id", "title", "year", "media_type", "score")} for x in blended[:TOP]]
    return lists, ms


def proxy(ctxs, lists, grades):
    nd, cov, bad = [], [], 0
    for c in ctxs:
        if c.type == "title_lookup" or c.id not in grades:
            continue
        g = grades[c.id]
        ids = [x["id"] for x in lists[c.id]]
        top10 = ids[:10]
        cov.append(sum(1 for p in top10 if p in g) / 10)
        judged = [p for p in ids if p in g][:10]
        dcg = sum((2 ** g[p] - 1) / math.log2(i + 2) for i, p in enumerate(judged))
        ideal = sorted(g.values(), reverse=True)[:10]
        idcg = sum((2 ** x - 1) / math.log2(i + 2) for i, x in enumerate(ideal))
        nd.append(dcg / idcg if idcg else 0)
        bad += sum(1 for p in ids[:5] if g.get(p) == 0)
    return statistics.mean(nd), statistics.mean(cov), bad


def full(ctxs, lists, grades):
    ms = [M.graded_query([x["id"] for x in lists[c.id]], grades[c.id]) for c in ctxs
          if c.type != "title_lookup" and c.id in grades]
    return statistics.mean(m["ndcg10"] for m in ms), sum(m["bad5"] for m in ms), sum(m["unj10"] for m in ms)


def summary(ctxs, lists, grades):
    nd, cov, bad = proxy(ctxs, lists, grades)
    s = A.summarize(ctxs, lists, "dev", ("title_lookup",))
    ok, n = M.title_guardrail(ctxs, lists, "dev")
    inc = next((i + 1 for i, x in enumerate(lists.get("core-04", [])) if x["id"] == C.point_id("movie", 27205)), None)
    return dict(pndcg=nd, cov=cov, bad5=bad, a10=s["anchor10"], a50=s["anchor50"], t1=f"{ok}/{n}", incepton=inc)


BASE = dict()  # hyb-lin+prior as in round 1: e5s-notitle, a .4 b .42 c .18, prior (.1, .1) additive


def configs():
    """name -> (discovery kwargs for R2.hyb2, blend kwargs). Grids per idea; the base is hyb-lin+prior."""
    g = {"base (hyb-lin+prior)": ({}, {}), "base no prior (hyb-lin)": (dict(prior=(0, 0)), {})}
    for lam in (0.1, 0.2, 0.3, 0.5, 0.8):
        g[f"neg lam={lam}"] = (dict(neg=lam), {})
    g["neg pos-only"] = (dict(neg_pos=True), {})
    for av in (0.5, 1.0):
        g[f"neg lam=0.3 avoid={av}"] = (dict(neg=0.3, avoid=av), {})
    for f in (0.1, 0.2, 0.3, 0.5):
        for src in ("auto", "phrases", "chunks"):
            g[f"facet f={f} {src}"] = (dict(facet=f, facet_source=src), {})
    for p in (0.1, 0.2, 0.3, 0.5):
        g[f"prior mult p={p}"] = (dict(prior=(p, p), prior_mode="mult"), {})
    for k in (10, 20, 30, 50):
        for p in (0.1, 0.2, 0.4):
            g[f"prior gate k={k} p={p}"] = (dict(prior=(p, p), prior_mode="gate", gate_k=k), {})
    for s in (0.8, 0.85, 0.9, 0.95):
        g[f"title-strict s={s} fuzzy=.88"] = ({}, dict(strict=s, fuzzy=0.88))
    g["title-strict s=0.9 no fuzzy"] = ({}, dict(strict=0.9, fuzzy=0))
    g["fuzzy only .88"] = ({}, dict(strict=0, fuzzy=0.88))
    for a in (0.4, 0.5, 0.6, 0.7):
        g[f"notext a={a}"] = (dict(text=False, c=0, a=a, b=round(1 - a, 2)), {})
    for a in (0.3, 0.4, 0.5):
        b = round((1 - a) * 0.7, 2)
        g[f"bgeb-notitle a={a}"] = (dict(emb="bgeb-notitle", a=a, b=b, c=round(1 - a - b, 2)), {})
    g["bgeb (with title) a=0.4"] = (dict(emb="bgeb"), {})
    return g


def sweep():
    os.makedirs(OUT, exist_ok=True)
    grades = M.load_grades()
    ctxs = [c for c in X.contexts() if c.split == "dev"]
    rows = []
    for name, (kw, bk) in configs().items():
        lists, _ = run(lambda c, kw=kw: R2.hyb2(c, **kw), ctxs, blend_fn(**bk))
        s = summary(ctxs, lists, grades)
        rows.append((name, s))
        print(f"{name:34s} pndcg {s['pndcg']:.3f} cov {s['cov']:.2f} bad5 {s['bad5']:3d} a10 {s['a10']:.3f} "
              f"a50 {s['a50']:.3f} t@1 {s['t1']} inc@{s['incepton']}", flush=True)
    with open(os.path.join(OUT, "sweeps.md"), "w") as f:
        f.write("# Round 2 sweeps (dev only)\n\nProxy NDCG@10: ungraded titles skipped (condensed list), `cov` = graded "
                "share of the top 10, `bad5` = grade-0 titles in the top 5 (graded only). `inc@` = rank of Inception for "
                "\"Incepton\". Base = hyb-lin+prior (e5s-notitle, a 0.4, b 0.42, c 0.18, prior 0.1/0.1 additive).\n\n")
        f.write("| config | proxy ndcg10 | cov | bad5 | anchor10 | anchor50 | title@1 | Incepton rank |\n|---|---|---|---|---|---|---|---|\n")
        for name, s in rows:
            f.write(f"| {name} | {s['pndcg']:.3f} | {s['cov']:.2f} | {s['bad5']} | {s['a10']:.3f} | {s['a50']:.3f} | {s['t1']} | {s['incepton']} |\n")


# Chosen after the sweep (dev proxy); see results/round2/sweeps.md and LOG.md.
_NEG = dict(neg=0.1)
_FACET = dict(facet=0.1, facet_source="phrases")
_FUZZY = dict(fuzzy=0.88)
_STRICT = dict(strict=0.9, fuzzy=0.88)
FINAL = {
    "neg": (_NEG, {}),
    "facet": (_FACET, {}),
    "prior-gated": (dict(prior=(0.4, 0.4), prior_mode="gate", gate_k=10), {}),
    "title-strict": ({}, _STRICT),
    "notext": (dict(text=False, c=0, a=0.4, b=0.6), {}),
    "bgeb-notitle": (dict(emb="bgeb-notitle"), {}),
    "r2-combo": ({**_NEG, **_FACET}, _FUZZY),
    "r2-combo-bgeb": ({**_NEG, **_FACET, "emb": "bgeb-notitle"}, _FUZZY),
    "r2-combo-strict": ({**_NEG, **_FACET}, _STRICT),
    "r2-combo-bgeb-strict": ({**_NEG, **_FACET, "emb": "bgeb-notitle"}, _STRICT),
}
_HYB = ["crate_text", "qemb", "qdrant_emb", "fp_full"]
STAGES = {n: list(_HYB) for n in FINAL}
STAGES["notext"] = ["qemb", "qdrant_emb", "fp_full"]
for n in ("neg", "facet", "r2-combo", "r2-combo-bgeb", "r2-combo-strict", "r2-combo-bgeb-strict"):
    STAGES[n] = _HYB + ["qemb_extra"]  # extra query embeddings (negated clause, facets), batched
for n in ("title-strict", "r2-combo", "r2-combo-bgeb", "r2-combo-strict", "r2-combo-bgeb-strict"):
    STAGES[n] = STAGES[n] + ["fuzzy_title"]


def final():
    os.makedirs(LISTS, exist_ok=True)
    for f in os.listdir(os.path.join(C.ARENA, "results", "round1", "lists")):
        shutil.copy(os.path.join(C.ARENA, "results", "round1", "lists", f), os.path.join(LISTS, f))
    r1 = os.path.join(C.ARENA, "results", "round1")
    timings = json.load(open(os.path.join(r1, "timings.json")))
    stages = json.load(open(os.path.join(r1, "stages.json")))["stages"]
    ctxs = X.contexts()
    choices = {}
    for name, (kw, bk) in FINAL.items():
        B2.FUZZY_MS.clear()
        lists, ms = run(lambda c, kw=kw: R2.hyb2(c, **kw), ctxs, blend_fn(**bk))
        json.dump(lists, open(os.path.join(LISTS, f"{name}.json"), "w"), ensure_ascii=False)
        v = sorted(ms.values())
        timings[name] = {"mean_ms": statistics.mean(v), "p95_ms": v[int(0.95 * len(v)) - 1], "max_ms": v[-1]}
        if B2.FUZZY_MS:
            timings[name]["fuzzy_ms_mean"] = statistics.mean(B2.FUZZY_MS)
        stages[name] = STAGES[name]
        choices[name] = {"discovery": {**R2.DEFAULT, **kw}, "blend": bk or "production blend"}
        print(name, "done", flush=True)
    json.dump(timings, open(os.path.join(OUT, "timings.json"), "w"), indent=1)
    json.dump({"stages": stages}, open(os.path.join(OUT, "stages.json"), "w"), indent=1)
    json.dump(choices, open(os.path.join(OUT, "choices.json"), "w"), indent=1, default=str)


if __name__ == "__main__":
    {"sweep": sweep, "final": final}[sys.argv[1]]()
