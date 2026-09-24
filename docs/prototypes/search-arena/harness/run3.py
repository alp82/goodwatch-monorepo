"""Round 3: sweeps on dev (proxy NDCG), then the chosen round-3 rankers into results/round3/.

Usage:
  .venv/bin/python harness/run3.py check      # hyb3 defaults reproduce r2-combo-bgeb-strict
  .venv/bin/python harness/run3.py sweep      # dev-only sweeps -> results/round3/sweeps.md
  .venv/bin/python harness/run3.py final      # chosen configs -> results/round3/lists, timings, stages, choices

Every variant starts from the round-2 leader r2-combo-bgeb-strict (rankers3.LEADER + blend3 kind=False).
Proxy NDCG as in run2.py (graded titles only). Holdout lists are written for later; nothing reads holdout grades.
"""
import json, os, shutil, statistics, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import blend2 as B2  # noqa: E402
import blend3 as B3  # noqa: E402
import catalog as C  # noqa: E402
import context as X  # noqa: E402
import metrics as M  # noqa: E402
import rankers3 as R3  # noqa: E402
from run2 import proxy, full, summary  # noqa: E402

OUT = os.path.join(C.ARENA, "results", "round3")
LISTS = os.path.join(OUT, "lists")
TOP = 50
STRICT = dict(strict=0.9, fuzzy=0.88, kind=False)


def run(kw, bk, ctxs):
    lists, ms = {}, {}
    bk = {**STRICT, **bk}
    for ctx in ctxs:
        t = time.perf_counter()
        disc = R3.hyb3(ctx, **kw)
        ms[ctx.id] = (time.perf_counter() - t) * 1000
        blended = B3.blend(ctx, [(pid, i + 1, s) for i, (pid, s, _) in enumerate(disc)], **bk)
        lists[ctx.id] = [{k: x[k] for k in ("id", "title", "year", "media_type", "score")} for x in blended[:TOP]]
    return lists, ms


def check():
    ctxs = X.contexts()
    lists, _ = run({}, {}, ctxs)
    ref = json.load(open(os.path.join(C.ARENA, "results", "round2", "lists", "r2-combo-bgeb-strict.json")))
    diff = [c.id for c in ctxs if [x["id"] for x in lists[c.id][:10]] != [x["id"] for x in ref[c.id][:10]]]
    print("top-10 differences vs r2-combo-bgeb-strict:", diff or "none")


FAST = dict(dense=500, facet=200, neg=200, sparse=300)


def configs():
    g = {"leader": ({}, {})}
    # 1 title kind
    for cap in (None, 0.9, 0.65, 0.4):
        g[f"title-kind cap={cap}"] = ({}, dict(kind=True, cap=cap))
    # 2 era
    g["era filter"] = (dict(era=True, era_mode="filter"), {})
    for w in (0.2, 0.4, 0.8):
        g[f"era soft w={w}"] = (dict(era=True, era_mode="soft", era_w=w), {})
    # 3 non-English
    for mix in (0.3, 0.5, 0.7):
        g[f"nonen mix={mix}"] = (dict(nonen=True, nonen_mix=mix), {})
    # 4 spell
    g["spell"] = (dict(spell=True), {})
    # 5 weights
    for a in (0.3, 0.4, 0.5, 0.6):
        for c in (0.12, 0.18, 0.25):
            for p in (0.05, 0.1, 0.15):
                g[f"w a={a} c={c} p={p}"] = (dict(a=a, b=round(1 - a - c, 2), c=c, prior=(p, p)), {})
    # 6 notext
    for a in (0.4, 0.5, 0.6):
        g[f"notext a={a}"] = (dict(text="none", c=0, a=a, b=round(1 - a, 2)), {})
    # 7 sparse
    for c in (0.12, 0.18, 0.25, 0.35):
        for tf in ("raw", "log"):
            g[f"sparse c={c} tf={tf}"] = (dict(text="sparse", c=c, b=round(0.6 - c, 2), sparse_tf=tf), {})
    for a, c in ((0.4, 0.12), (0.5, 0.12), (0.5, 0.18), (0.3, 0.12), (0.3, 0.18)):
        g[f"sparse a={a} c={c} b=rest"] = (dict(text="sparse", a=a, c=c, b=round(1 - a - c, 2)), {})
        g[f"sparse a={a} c={c} b=.64"] = (dict(text="sparse", a=a, c=c, b=0.64), {})
    for k in (100, 300, 1000):
        g[f"sparse c=0.18 k={k}"] = (dict(text="sparse", sparse_k=k), {})
    g["sparse c=0.18 bigram=2"] = (dict(text="sparse", sparse_bigram=2.0), {})
    g["sparse c=0.18 bigram=0.5"] = (dict(text="sparse", sparse_bigram=0.5), {})
    g["sparse c=0.18 no people"] = (dict(text="sparse", sparse_w=dict(creators=0, cast=0)), {})
    g["sparse c=0.18 no tropes"] = (dict(text="sparse", sparse_w=dict(tropes=0)), {})
    g["sparse c=0.18 title=3"] = (dict(text="sparse", sparse_w=dict(title=3.0)), {})
    g["sparse c=0.18 essence=2"] = (dict(text="sparse", sparse_w=dict(essence=2.0)), {})
    g["both c=0.18"] = (dict(text="both"), {})
    g["both c=0.25"] = (dict(text="both", c=0.25, b=0.35), {})
    # 8 sparse-fast (truncated lists)
    for c in (0.18, 0.25):
        g[f"sparse-fast c={c}"] = (dict(text="sparse", c=c, b=round(0.6 - c, 2), trunc=FAST), {})
        g[f"sparse-fast c={c} tight"] = (dict(text="sparse", c=c, b=round(0.6 - c, 2), trunc=dict(dense=200, facet=100, neg=100, sparse=100)), {})
    # 9 combinations
    K = dict(era=True, spell=True, nonen=True, nonen_mix=0.5)
    KB = dict(kind=True, cap=0.65)
    for name, kw in {
        "crate a=.4 c=.18": dict(),
        "crate a=.5 c=.12": dict(a=0.5, b=0.38, c=0.12),
        "both a=.4 c=.18": dict(text="both"),
        "both a=.4 c=.12": dict(text="both", c=0.12, b=0.48),
        "sparse a=.4 c=.12": dict(text="sparse", c=0.12, b=0.48),
        "sparse a=.5 c=.12": dict(text="sparse", a=0.5, c=0.12, b=0.38),
        "sparse a=.4 c=.18": dict(text="sparse", c=0.18, b=0.42),
        "sparse-fast a=.4 c=.12": dict(text="sparse", c=0.12, b=0.48, trunc=FAST),
        "none a=.5": dict(text="none", a=0.5, b=0.5, c=0),
    }.items():
        g[f"combo {name}"] = ({**K, **kw}, KB)
        g[f"combo-nokind {name}"] = ({**K, **kw}, {})
    return g


def sweep(only=None):
    os.makedirs(OUT, exist_ok=True)
    grades = M.load_grades()
    ctxs = [c for c in X.contexts() if c.split == "dev"]
    rows = []
    for name, (kw, bk) in configs().items():
        if only and not any(name.startswith(o) for o in only):
            continue
        lists, _ = run(kw, bk, ctxs)
        s = summary(ctxs, lists, grades)
        nd, bad, unj = full(ctxs, lists, grades)
        s.update(full=nd, unj=unj)
        rows.append((name, s))
        print(f"{name:34s} pndcg {s['pndcg']:.3f} full {nd:.3f} cov {s['cov']:.2f} bad5 {s['bad5']:3d} a10 {s['a10']:.3f} "
              f"a50 {s['a50']:.3f} t@1 {s['t1']} inc@{s['incepton']}", flush=True)
    if only:
        return
    with open(os.path.join(OUT, "sweeps.md"), "w") as f:
        f.write("# Round 3 sweeps (dev only)\n\nBase = r2-combo-bgeb-strict. `proxy` skips ungraded titles (condensed list); "
                "`full` counts ungraded titles as 0 with the grades after the round-3 grading (swept before it, with the proxy); `cov` = graded share of the top 10; "
                "`bad5` = graded grade-0 titles in the top 5. `inc@` = rank of Inception for \"Incepton\".\n\n")
        f.write("| config | proxy ndcg10 | full | cov | bad5 | anchor10 | anchor50 | title@1 | Incepton |\n"
                "|---|---|---|---|---|---|---|---|---|\n")
        for name, s in rows:
            f.write(f"| {name} | {s['pndcg']:.3f} | {s['full']:.3f} | {s['cov']:.2f} | {s['bad5']} | {s['a10']:.3f} | "
                    f"{s['a50']:.3f} | {s['t1']} | {s['incepton']} |\n")


# Chosen after the sweep (dev proxy); see results/round3/sweeps.md and LOG.md.
_KIND = dict(kind=True, cap=0.65)
_R3 = dict(era=True, spell=True, nonen=True, nonen_mix=0.5)
_SPARSE = dict(text="sparse", a=0.4, b=0.48, c=0.12)
FINAL = {
    "title-kind": ({}, _KIND),
    "era": (dict(era=True), {}),
    "nonen": (dict(nonen=True, nonen_mix=0.5), {}),
    "spell": (dict(spell=True), {}),
    "reweight": (dict(a=0.5, b=0.38, c=0.12), {}),
    "notext-r2": (dict(text="none", a=0.5, b=0.5, c=0), {}),
    "sparse": (dict(_SPARSE), {}),
    "sparse-fast": (dict(_SPARSE, trunc=FAST), {}),
    "r3-combo": (dict(_R3, text="both", a=0.4, b=0.48, c=0.12), _KIND),
    "r3-combo-fast": (dict(_R3, **_SPARSE, trunc=FAST), _KIND),
}
_LEAD = ["crate_text", "qemb", "qdrant_emb", "fp_full", "qemb_extra", "fuzzy_title"]
_FASTS = ["qemb", "qdrant_batch", "fp_full", "qemb_extra", "fuzzy_title"]
STAGES = {
    "title-kind": _LEAD, "era": _LEAD, "nonen": _LEAD, "spell": _LEAD + ["spell"], "reweight": _LEAD,
    "notext-r2": ["qemb", "qdrant_emb", "fp_full", "qemb_extra", "fuzzy_title"],
    "sparse": ["qdrant_sparse", "qemb", "qdrant_emb", "fp_full", "qemb_extra", "fuzzy_title"],
    "sparse-fast": _FASTS,
    "r3-combo": _LEAD + ["qdrant_sparse", "spell"],
    "r3-combo-fast": _FASTS + ["spell"],
}


def final():
    os.makedirs(LISTS, exist_ok=True)
    r2 = os.path.join(C.ARENA, "results", "round2")
    for f in os.listdir(os.path.join(r2, "lists")):
        shutil.copy(os.path.join(r2, "lists", f), os.path.join(LISTS, f))
    timings = json.load(open(os.path.join(r2, "timings.json")))
    stages = json.load(open(os.path.join(r2, "stages.json")))["stages"]
    ctxs = X.contexts()
    choices = {}
    for name, (kw, bk) in FINAL.items():
        B2.FUZZY_MS.clear()
        lists, ms = run(kw, bk, ctxs)
        json.dump(lists, open(os.path.join(LISTS, f"{name}.json"), "w"), ensure_ascii=False)
        v = sorted(ms.values())
        timings[name] = {"mean_ms": statistics.mean(v), "p95_ms": v[int(0.95 * len(v)) - 1], "max_ms": v[-1]}
        stages[name] = STAGES[name]
        choices[name] = {"discovery": {**R3.LEADER, **kw}, "blend": {**STRICT, **bk}}
        print(name, "done", flush=True)
    json.dump(timings, open(os.path.join(OUT, "timings.json"), "w"), indent=1)
    json.dump({"stages": stages}, open(os.path.join(OUT, "stages.json"), "w"), indent=1)
    json.dump(choices, open(os.path.join(OUT, "choices.json"), "w"), indent=1, default=str)


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "sweep":
        sweep(sys.argv[2:] or None)
    else:
        {"check": check, "final": final}[cmd]()
