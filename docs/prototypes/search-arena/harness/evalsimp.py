"""Simplify loop: score any ranker candidate on every existing split with the round-6 metric rules.

Usage (from docs/prototypes/search-arena, with .venv/bin/python):
  harness/evalsimp.py score <spec> [<spec> ...] [--no-ref] [--reps=3]
                                                           # lists + one table row per candidate (r6 is added as
                                                           # the latency reference unless --no-ref)
  harness/evalsimp.py table [<name> ...]                   # the table again from saved lists (no timing)
  harness/evalsimp.py compare <A> <B>                      # per-query ndcg10 deltas and top-10 diffs
  harness/evalsimp.py pool <tag> <name> [<name> ...]       # ungraded top-10 pairs -> grading packets
  harness/evalsimp.py latency <spec> [<spec> ...] [--uncached] [--reps=5] [--no-ref]
                                                           # latency only (nothing saved). --uncached: every query
                                                           # embedding a ranker asks for is encoded (qemb.NO_CACHE)
  --overlay[=path]   (score, table, compare) apply a re-grade overlay on top of results/grades.json, in memory only
                     (default results/simplify/rubric/overlay.json: {"grades": {qid: {pid: grade}}, ...}). Off by
                     default; grades.json is never written. Saved scores record which grades they used.

Candidate specs:
  prod, r4-combo-fast, r5, r6          built in (prod is the captured production list, no latency)
  r6+w_terms=0+damp=0.0                r6 with discovery (rankers6.hyb6) overrides; b.<key>=... overrides the blend
  mymodule:FINAL                       every entry of harness/mymodule.py's FINAL dict
  mymodule:FINAL/name                  one entry of it
  mymodule:rank                        a callable; the candidate is named "mymodule"
  path/to/file.py:FINAL                the same with a file path
An entry (dict value or attribute) is one of:
  - a (kw, bk) tuple, run through run6.run: hyb6 + blend4 + cut folding + cap_own (exactly as r6);
  - a dict {"kw": ..., "bk": ...} (the same), or a plain dict of hyb6 overrides on r6's kw;
  - a callable rank(ctx) -> list of point ids or dicts with "id" (ranked; the top 50 are kept). ctx is a
    context.QueryCtx. Do the cut folding yourself if the candidate should have it (r6 does).
Python: `import evalsimp; evalsimp.score({"mine": rank_fn})` does the same as the CLI.

Splits and groups (queries.json, only these splits are read; holdout5 only with --split holdout5):
  dev (all dev), dev-sty (dev, person_intent style/both), holdout, holdout2, holdout3,
  ho3-sty (holdout3 style/both), holdout4 (all sty-*). title_lookup queries are excluded from ndcg / bad5 and
  reported as the title@1 guardrail (7 queries).

  --split holdout5   (score, table, compare, pool, latency) the one-time blind holdout: only the 30 h5-* queries
                     are loaded and ranked (the warm-up still uses the four WARMUP queries of the regular splits, which
                     are not timed or saved). Groups: holdout5 (all), ho5-sty (style/both); own10 over its
                     person_intent == "style" queries; no title_lookup queries. Lists and scores go to
                     results/simplify/holdout5/{lists,scores}/, never mixed with the regular ones. score there saves
                     lists and latency only (no metrics); table computes them. pool adds
                     "rubric": "vague" to the packets of the GRADER.md vague ids (h5-01..h5-08, h5-28) unless the
                     query is a style query (then "style" wins). Off by default.

Metrics (contract note, round 6; metrics.graded_query6 and metrics.own10, the same functions run6.py uses):
  ndcg10    macro NDCG@10, a 2nd+ alternate cut in the top 10 counts 0; ungraded titles count 0.
  cond      condensed NDCG@10: ungraded titles are dropped from the list before the same computation (run3's
            proxy, with the cut rule). When cond > ndcg10 the candidate needs grading before any verdict.
  unj       unjudged titles in the top 10 (2nd cuts excluded, they count 0 anyway), summed per split.
  bad5      grade 0 or a 2nd cut in the top 5, summed per split.
  own10     mean own titles in the top 10 over person_intent == "style" queries (target 3 to 6).
  title@1   title_lookup guardrail: the expected title at rank 1.
  p50 / p95 in-process ms per query after the Jev reading, as round 6 measured it (run6.final: perf_counter around
            discovery + blend + folding + cap for one query; p95 = sorted[int(0.95 n) - 1]) over all queries of all
            splits. Differences to round 6's timings.json (one cold pass): every candidate is warmed up on a few
            queries first (lazy index loads are not charged to the first query), each query is timed --reps times
            (default 3, per-query median), and the candidates run interleaved per query so machine noise hits them
            alike. numpy uses every core. The absolute numbers move with machine load (other agents): compare
            candidates only against r6 from the same run.

  latency   the same timing as score (warm-up, interleaved, per-query median of --reps). With --uncached the
            query-embedding cache is off: every model encode a ranker does for a query is inside its timing, cold
            per query, with the models loaded during the warm-up (the offline intent example phrases are built
            there too). Also prints the encodes per query. Lists can differ slightly from the cached run (the
            cache stores rounded vectors); the count of queries with a different top 10 is printed.

Outputs: results/simplify/lists/<name>.json ({query id: top 50}) and results/simplify/scores/<name>.json.

Grading new pairs (the round-6 pipeline, grade6.py; files get grade6's "r6-" prefix):
  1. .venv/bin/python harness/evalsimp.py pool simp1 <name> [<name> ...]
       -> results/grading/r6-simp1-part1.json (shuffled per query, credits, "rubric": "style" on style queries)
          and r6-simp1-part1-rev.json (reversed order for assessor B)
  2. Two sonnet assessors with results/grading/GRADER.md: A grades r6-simp1-part1.json and writes
     r6-simp1-A-part1.json, B grades r6-simp1-part1-rev.json and writes r6-simp1-B-part1.json
     (both {query_id: {pid: grade}}).
  3. .venv/bin/python harness/grade6.py compare simp1   # kappa; pairs 2+ apart -> r6-simp1-C-packets.json
  4. If any: a blind assessor C grades r6-simp1-C-packets.json -> r6-simp1-C.json
  5. .venv/bin/python harness/grade6.py merge simp1     # add-only into results/grades.json
  6. .venv/bin/python harness/evalsimp.py table         # re-score the saved lists
"""
import ast, importlib, importlib.util, json, math, os, statistics, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import anchors as A  # noqa: E402
import catalog as C  # noqa: E402
import context as X  # noqa: E402
import cuts  # noqa: E402
import grade6  # noqa: E402
import metrics as M  # noqa: E402
import run5  # noqa: E402
import run6  # noqa: E402

OUT = os.path.join(C.ARENA, "results", "simplify")
LISTS = os.path.join(OUT, "lists")
SCORES = os.path.join(OUT, "scores")
SPLITS = ("dev", "holdout", "holdout2", "holdout3", "holdout4")
GROUPS = ("dev", "dev-sty", "holdout", "holdout2", "holdout3", "ho3-sty", "holdout4")
BAD5_GROUPS = ("dev", "holdout", "holdout2", "holdout3", "holdout4")
OWN_GROUPS = ("dev-sty", "ho3-sty", "holdout4")
BASE_SPLITS = SPLITS   # the regular splits (the warm-up queries live there)
HOLDOUT5 = "holdout5"
VAGUE = {"h5-01", "h5-02", "h5-03", "h5-04", "h5-05", "h5-06", "h5-07", "h5-08", "h5-28"}   # GRADER.md, set blind
TOP = 50
OVERLAY = os.path.join(OUT, "rubric", "overlay.json")
REF = "r6"
WARMUP = ("ppl-09", "sty-01", "lab-01", "ppl-01")  # style, style, generic, filmography: loads every lazy index

# --- grades ---------------------------------------------------------------------------------------

_overlay = None   # path of the re-grade overlay to apply, set by --overlay


def load_grades():
    """results/grades.json as metrics.load_grades returns it, with the --overlay re-grades replacing their pairs."""
    g = M.load_grades()
    if _overlay:
        ov = json.load(open(_overlay))["grades"]
        for q, d in ov.items():
            g.setdefault(q, {}).update({int(p): int(x) for p, x in d.items()})
        print(f"grades: results/grades.json + overlay {os.path.relpath(_overlay, C.ARENA)} "
              f"({sum(map(len, ov.values()))} pairs replaced)")
    return g


def grades_label():
    return f"grades.json+{os.path.relpath(_overlay, C.ARENA)}" if _overlay else "grades.json"


# --- queries --------------------------------------------------------------------------------------

_ctxs = None


_warm = []   # holdout5 mode: the WARMUP queries of the regular splits (warm-up only, never timed or saved)


def use_split(split):
    """Switch the module to the holdout5 mode (only its queries, its own lists / scores directories)."""
    global SPLITS, GROUPS, BAD5_GROUPS, OWN_GROUPS, LISTS, SCORES, _ctxs
    if split != HOLDOUT5:
        raise SystemExit(f"unknown --split {split!r} (only {HOLDOUT5})")
    SPLITS, GROUPS, BAD5_GROUPS, OWN_GROUPS = (HOLDOUT5,), (HOLDOUT5, "ho5-sty"), (HOLDOUT5,), (HOLDOUT5,)
    LISTS = os.path.join(OUT, HOLDOUT5, "lists")
    SCORES = os.path.join(OUT, HOLDOUT5, "scores")
    _ctxs = None


def contexts():
    """All queries of SPLITS (run5.contexts also fills the outside-name cache from these captures)."""
    global _ctxs, _warm
    if _ctxs is None:
        if SPLITS != BASE_SPLITS:
            cat = C.load()
            _warm = [X.load_query(q, cat) for q in grade6.load_queries(BASE_SPLITS) if q["id"] in WARMUP]
            _ctxs = run5.contexts(SPLITS)
            for q in grade6.load_queries(BASE_SPLITS):
                run6._qmeta[q["id"]] = q
        else:
            _ctxs = run5.contexts(SPLITS)
        for q in grade6.load_queries(SPLITS):   # run6.qmeta otherwise loads only the first ctx's split
            run6._qmeta[q["id"]] = q
    return _ctxs


def style(c):
    return run6.qmeta(c).get("person_intent") in ("style", "both")


def groups(ctxs):
    g = [c for c in ctxs if c.type != "title_lookup"]
    by = {s: [c for c in g if c.split == s] for s in SPLITS}
    if SPLITS == (HOLDOUT5,):
        return {HOLDOUT5: by[HOLDOUT5], "ho5-sty": [c for c in by[HOLDOUT5] if style(c)]}
    return {"dev": by["dev"], "dev-sty": [c for c in by["dev"] if style(c)], "holdout": by["holdout"],
            "holdout2": by["holdout2"], "holdout3": by["holdout3"], "ho3-sty": [c for c in by["holdout3"] if style(c)],
            "holdout4": by["holdout4"]}


# --- candidates -----------------------------------------------------------------------------------

def _config_rank(kw, bk):
    return lambda ctx: run6.run(kw, bk, [ctx])[0][ctx.id]


def _r5_rank(ctx):
    return run5.run(*run5.FINAL["r5"], [ctx])[0][ctx.id]


def _r4_rank(ctx):
    kw, bk = run5.run4.FINAL[run5.BASE]
    return run5.run4.run(kw, {**run5.run4.STRICT, **bk}, [ctx])[0][ctx.id]


def _prod_rank(ctx):
    return run5.prod_lists([ctx])[ctx.id]


BUILTIN = {"prod": _prod_rank, "r4-combo-fast": _r4_rank, "r5": _r5_rank}
NO_TIMING = {"prod"}


def as_rank(entry):
    """A candidate entry (see the module docstring) -> rank(ctx) callable."""
    if callable(entry):
        return entry
    if isinstance(entry, tuple) and len(entry) == 2:
        return _config_rank(*entry)
    if isinstance(entry, dict):
        if "kw" in entry or "bk" in entry:
            kw0, bk0 = run6.FINAL[REF]
            return _config_rank(entry.get("kw", kw0), entry.get("bk", bk0))
        kw0, bk0 = run6.FINAL[REF]
        return _config_rank(dict(kw0, **entry), bk0)
    raise TypeError(f"unsupported candidate entry: {type(entry)}")


def _lit(v):
    try:
        return ast.literal_eval(v)
    except (ValueError, SyntaxError):
        return v


def _module(ref):
    if ref.endswith(".py") or os.sep in ref:
        spec = importlib.util.spec_from_file_location(os.path.splitext(os.path.basename(ref))[0], ref)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    return importlib.import_module(ref)


def resolve(spec):
    """Spec string -> {name: rank callable}."""
    if spec in BUILTIN:
        return {spec: BUILTIN[spec]}
    if spec.split("+")[0] in run6.FINAL:
        base, *over = spec.split("+")
        kw, bk = run6.FINAL[base]
        kw, bk = dict(kw), dict(bk)
        for o in over:
            k, v = o.split("=", 1)
            (bk if k.startswith("b.") else kw)[k[2:] if k.startswith("b.") else k] = _lit(v)
        return {spec: _config_rank(kw, bk)}
    if ":" in spec:
        mref, attr = spec.rsplit(":", 1)
        key = None
        if "/" in attr:
            attr, key = attr.split("/", 1)
        obj = getattr(_module(mref), attr)
        mname = os.path.splitext(os.path.basename(mref))[0]
        if isinstance(obj, dict) and not ({"kw", "bk"} & set(obj)) and all(isinstance(k, str) for k in obj) and \
                any(callable(v) or isinstance(v, (tuple, dict)) for v in obj.values()):
            items = {key: obj[key]} if key else obj
            return {n: as_rank(e) for n, e in items.items()}
        return {getattr(obj, "name", mname): as_rank(obj)}
    raise SystemExit(f"unknown candidate spec: {spec}")


def normalize(ranked):
    """rank(ctx) output -> the top TOP as list-file dicts (id, title, year, media_type, score)."""
    cat = C.load()
    names = X.outside_names()
    out = []
    for i, x in enumerate(ranked[:TOP]):
        if isinstance(x, dict) and {"title", "year", "media_type", "score"} <= set(x):
            out.append({k: x[k] for k in ("id", "title", "year", "media_type", "score")})
            continue
        pid = int(x["id"] if isinstance(x, dict) else x)
        r = cat.row_of.get(pid)
        if r is not None:
            t, y, mt = cat.title[r], str(int(cat.year[r]) or ""), cat.media_type(r)
        else:
            t, y, mt = names.get(pid, (str(pid), "", "movie"))
        score = x.get("score", TOP - i) if isinstance(x, dict) else TOP - i
        out.append(dict(id=pid, title=t, year=str(y or ""), media_type=mt, score=score))
    return out


# --- running --------------------------------------------------------------------------------------

def run(cands, ctxs, timed=True, reps=1):
    """{name: rank} -> ({name: {qid: list}}, {name: {qid: ms}}). Warm-up, then candidates interleaved per query;
    with reps > 1 every query is ranked reps times per candidate and its ms is the median (the lists must match)."""
    if timed:
        warm = [c for c in ctxs if c.id in WARMUP] + [c for c in _warm if c.id not in {x.id for x in ctxs}]
        for c in warm:
            for rank in cands.values():
                rank(c)
    lists = {n: {} for n in cands}
    ms = {n: {} for n in cands}
    for c in ctxs:
        ts = {n: [] for n in cands}
        for rep in range(reps if timed else 1):
            for n, rank in cands.items():
                t = time.perf_counter()
                ranked = rank(c)
                ts[n].append((time.perf_counter() - t) * 1000)
                ranked = normalize(ranked)
                if rep == 0:
                    lists[n][c.id] = ranked
                elif [x["id"] for x in ranked] != [x["id"] for x in lists[n][c.id]]:
                    raise RuntimeError(f"{n} is not deterministic on {c.id}")
        for n in cands:
            ms[n][c.id] = statistics.median(ts[n])
    return lists, ms


def latency(ms_by_q, ctxs):
    v = sorted(ms_by_q.values())
    sv = sorted(ms_by_q[c.id] for c in ctxs if style(c))
    return dict(median_ms=statistics.median(v), p95_ms=v[int(0.95 * len(v)) - 1], mean_ms=statistics.mean(v),
                max_ms=v[-1], style_median_ms=statistics.median(sv) if sv else float("nan"), n=len(v))


# --- metrics --------------------------------------------------------------------------------------

def per_query(ctxs, lists, grades):
    out = {}
    for c in ctxs:
        if c.type == "title_lookup":
            continue
        ids = [x["id"] for x in lists[c.id]]
        g = grades.get(c.id, {})
        m = M.graded_query6(ids, g)
        m["cond"] = M.graded_query6([p for p in ids if p in g], g)["ndcg10"]
        m["own10"] = M.own10(ids, c.query) if style(c) else None
        out[c.id] = m
    return out


def _mean(v):
    v = [x for x in v if x is not None and not (isinstance(x, float) and math.isnan(x))]
    return statistics.mean(v) if v else float("nan")


def summarize(ctxs, lists, grades):
    pq = per_query(ctxs, lists, grades)
    s = {}
    for g, cs in groups(ctxs).items():
        s[g] = dict(n=len(cs), ndcg10=_mean([pq[c.id]["ndcg10"] for c in cs]), cond=_mean([pq[c.id]["cond"] for c in cs]),
                    unj=sum(pq[c.id]["unj10"] for c in cs), bad5=sum(pq[c.id]["bad5"] for c in cs),
                    own10=_mean([pq[c.id]["own10"] for c in cs if run6.qmeta(c).get("person_intent") == "style"]))
    s["bad5_total"] = sum(s[g]["bad5"] for g in BAD5_GROUPS)
    s["unj_total"] = sum(s[g]["unj"] for g in BAD5_GROUPS)
    ok = n = 0
    for sp in SPLITS:
        a, b = M.title_guardrail(ctxs, lists, sp)
        ok, n = ok + a, n + b
    s["title1"] = [ok, n]
    return s, pq


SHORT = {"dev": "dev", "dev-sty": "dsty", "holdout": "ho", "holdout2": "ho2", "holdout3": "ho3", "ho3-sty": "h3sty",
         "holdout4": "ho4", "holdout5": "ho5", "ho5-sty": "h5sty"}


def header():
    return ("| candidate | " + " | ".join(SHORT[g] for g in GROUPS) + " | bad5 " + "/".join(SHORT[g] for g in BAD5_GROUPS)
            + " = tot | unj tot | own10 " + "/".join(SHORT[g] for g in OWN_GROUPS) + " | title@1 | p50 ms | p95 ms |\n|---|" + "---|" * (len(GROUPS) + 7))


def row(name, s, lat=None):
    def cell(g):
        x = s[g]
        c = f"{x['ndcg10']:.3f}"
        return c if not x["unj"] else f"{c} (c{x['cond']:.3f} u{x['unj']})"
    lat = lat or {}
    f = lambda k: f"{lat[k]:.1f}" if k in lat else "–"
    return (f"| {name} | " + " | ".join(cell(g) for g in GROUPS)
            + " | " + "/".join(str(s[g]["bad5"]) for g in BAD5_GROUPS) + f" = {s['bad5_total']} | {s['unj_total']} | "
            + "/".join(f"{s[g]['own10']:.2f}" for g in OWN_GROUPS) + f" | {s['title1'][0]}/{s['title1'][1]} | "
            + f"{f('median_ms')} | {f('p95_ms')} |")


LEGEND = ("ndcg10 per split (round-6 cut rule); '(c… u…)' = condensed ndcg10 with ungraded titles skipped, and the "
          "unjudged count in the top 10, shown only when a split has ungraded titles. Latency: in-process ms per "
          "query after the Jev reading, compare only against r6 from the same run.")


def _fname(name):
    return name.replace("/", "_").replace(" ", "_")


def save(name, lists, s, lat):
    os.makedirs(LISTS, exist_ok=True)
    os.makedirs(SCORES, exist_ok=True)
    json.dump(lists, open(os.path.join(LISTS, _fname(name) + ".json"), "w"), ensure_ascii=False)
    json.dump(dict(summary=s, latency=lat, grades=grades_label()), open(os.path.join(SCORES, _fname(name) + ".json"), "w"), indent=1)


def load_lists(name):
    p = os.path.join(LISTS, _fname(name) + ".json")
    return json.load(open(p)) if os.path.exists(p) else None


# --- commands -------------------------------------------------------------------------------------

def score(cands, ref=True, reps=3):
    """{name: entry or rank callable} -> {name: (summary, latency)}; prints the table."""
    t0 = time.time()
    ctxs = contexts()
    grades = load_grades()
    cands = {n: as_rank(e) for n, e in cands.items()}
    if ref and REF not in cands:
        cands = {REF: as_rank(run6.FINAL[REF]), **cands}
    lists, ms = run(cands, ctxs, reps=reps)
    out = {}
    if SPLITS == (HOLDOUT5,):
        # blind holdout: lists and latency only; metrics come from `table --split holdout5` once graded
        print("| candidate | p50 ms | p95 ms | mean ms | max ms | top-10 lists |\n|---|---|---|---|---|---|")
        for n in cands:
            lat = None if n in NO_TIMING else latency(ms[n], ctxs)
            save(n, lists[n], None, lat)
            out[n] = (None, lat)
            f = lambda k: f"{lat[k]:.1f}" if lat else "–"
            print(f"| {n} | {f('median_ms')} | {f('p95_ms')} | {f('mean_ms')} | {f('max_ms')} | "
                  f"{sum(1 for v in lists[n].values() if len(v) >= 10)}/{len(lists[n])} |")
        print(f"{len(ctxs)} holdout5 queries x {len(cands)} candidates in {time.time() - t0:.0f} s; no metrics "
              f"computed. Lists: {LISTS}")
        return out
    lines = [header()]
    for n in cands:
        s, _ = summarize(ctxs, lists[n], grades)
        lat = None if n in NO_TIMING else latency(ms[n], ctxs)
        save(n, lists[n], s, lat)
        out[n] = (s, lat)
        lines.append(row(n, s, lat))
    print("\n".join(lines))
    print(LEGEND)
    print(f"{len(ctxs)} queries x {len(cands)} candidates in {time.time() - t0:.0f} s (incl. loading). Lists: {LISTS}")
    return out


def table(names=None):
    ctxs = contexts()
    grades = load_grades()
    names = names or sorted(f[:-5] for f in os.listdir(LISTS) if f.endswith(".json"))
    lines = [header()]
    for n in names:
        ls = load_lists(n)
        if ls is None:
            print(f"no saved lists for {n}; run `score {n}` first")
            continue
        sp = os.path.join(SCORES, _fname(n) + ".json")
        lat = json.load(open(sp)).get("latency") if os.path.exists(sp) else None
        s, _ = summarize(ctxs, ls, grades)
        lines.append(row(n, s, lat))
    print("\n".join(lines))
    print(LEGEND + " Latency is from the run that wrote the lists.")


def _lists_for(names, ctxs):
    out, missing = {}, {}
    for n in names:
        ls = load_lists(n)
        if ls is None:
            missing.update(resolve(n))
        else:
            out[n] = ls
    if missing:
        ls, _ = run(missing, ctxs, timed=False)
        out.update(ls)
    return out


def compare(a, b):
    ctxs = contexts()
    grades = load_grades()
    ls = _lists_for([a, b], ctxs)
    pa, pb = per_query(ctxs, ls[a], grades), per_query(ctxs, ls[b], grades)
    gs = groups(ctxs)
    print(f"ndcg10 {b} − {a} per group: " + ", ".join(
        f"{SHORT[g]} {_mean([pb[c.id]['ndcg10'] for c in cs]) - _mean([pa[c.id]['ndcg10'] for c in cs]):+.3f}" for g, cs in gs.items()))
    moved = sorted((c for c in ctxs if c.id in pa), key=lambda c: pb[c.id]["ndcg10"] - pa[c.id]["ndcg10"])
    moved = [c for c in moved if [x["id"] for x in ls[a][c.id][:10]] != [x["id"] for x in ls[b][c.id][:10]]
             or abs(pb[c.id]["ndcg10"] - pa[c.id]["ndcg10"]) > 1e-9]
    same_tl = sum(1 for c in ctxs if c.type == "title_lookup" and ls[a][c.id][:1] == ls[b][c.id][:1])
    print(f"{len(moved)} of {len(pa)} graded queries have a different top 10; title_lookup rank 1 identical on "
          f"{same_tl}/{sum(1 for c in ctxs if c.type == 'title_lookup')}\n")
    for c in moved:
        g = grades.get(c.id, {})
        d = pb[c.id]["ndcg10"] - pa[c.id]["ndcg10"]
        ta, tb = ls[a][c.id][:10], ls[b][c.id][:10]
        ia, ib = [x["id"] for x in ta], [x["id"] for x in tb]
        lab = lambda x: f"{x['title']} ({x['year']}) [{g.get(x['id'], '?')}]"
        print(f"{c.id} [{c.split}] {c.query!r}: {pa[c.id]['ndcg10']:.3f} -> {pb[c.id]['ndcg10']:.3f} ({d:+.3f}), "
              f"unj {pa[c.id]['unj10']} -> {pb[c.id]['unj10']}")
        out_ = [f"#{ia.index(x['id']) + 1} {lab(x)}" for x in ta if x["id"] not in ib]
        in_ = [f"#{ib.index(x['id']) + 1} {lab(x)}" for x in tb if x["id"] not in ia]
        if out_:
            print("   - " + "; ".join(out_))
        if in_:
            print("   + " + "; ".join(in_))
        if not out_ and not in_:
            print("   reordered: " + ", ".join(f"{x['title']} #{ia.index(x['id']) + 1}->#{i + 1}" for i, x in enumerate(tb)
                                              if ia.index(x["id"]) != i))


def pool(tag, names):
    """Ungraded (query id, point id) pairs in the top 10 of the named candidates -> grade6 packets. 2nd alternate
    cuts are skipped: the metrics count them 0 whatever their grade."""
    ctxs = contexts()
    grades = load_grades()
    ls = _lists_for(names, ctxs)
    qs = {q["id"]: q for q in grade6.load_queries(SPLITS)}
    vague = VAGUE if SPLITS == (HOLDOUT5,) else set()
    fb = X.outside_names()
    packets, pairs = [], []
    for c in ctxs:
        if c.type == "title_lookup":
            continue
        new = []
        for n in names:
            ids = [x["id"] for x in ls[n][c.id]]
            second = set(cuts.second_cuts(ids, 10))
            for i, pid in enumerate(ids[:10]):
                if i not in second and pid not in grades.get(c.id, {}) and pid not in new:
                    new.append(pid)
        if new:
            pk = grade6.make_packet(qs[c.id], new, fb)
            if c.id in vague and "rubric" not in pk:
                pk["rubric"] = "vague"
            packets.append(pk)
            pairs += [(c.id, p) for p in new]
    if not packets:
        print("nothing to grade: every top-10 title of these candidates is graded")
        return
    grade6.write(tag, packets)
    print("pairs:", ", ".join(f"{q}:{p}" for q, p in pairs))


def latency_cmd(cands, ref=True, reps=5, uncached=False):
    """{name: entry} -> {name: latency}; prints p50 / p95 (and encodes per query with uncached)."""
    import qemb
    ctxs = contexts()
    cands = {n: as_rank(e) for n, e in cands.items()}
    if ref and REF not in cands:
        cands = {REF: as_rank(run6.FINAL[REF]), **cands}
    n_enc = {n: {} for n in cands}

    def counted(n, rank):
        def f(c):
            k = len(qemb.encodes)
            out = rank(c)
            n_enc[n][c.id] = len(qemb.encodes) - k
            return out
        return f
    qemb.NO_CACHE = uncached
    try:
        lists, ms = run({n: counted(n, r) for n, r in cands.items()}, ctxs, reps=reps)
    finally:
        qemb.NO_CACHE = False
    print(f"latency, {'uncached query encodes' if uncached else 'cached query embeddings (ranking only)'}, "
          f"reps {reps}, {len(ctxs)} queries")
    print("| candidate | p50 ms | p95 ms | mean ms | max ms | encodes / query (mean, max) | top 10 differs from saved |\n"
          "|---|---|---|---|---|---|---|")
    out = {}
    for n in cands:
        lat = latency(ms[n], ctxs)
        e = list(n_enc[n].values())
        saved = load_lists(n)
        diff = sum(1 for c in ctxs if saved and c.id in saved and
                   [x["id"] for x in saved[c.id][:10]] != [x["id"] for x in lists[n][c.id][:10]]) if saved else "–"
        enc = f"{statistics.mean(e):.2f}, {max(e)}" if uncached else "–"
        print(f"| {n} | {lat['median_ms']:.1f} | {lat['p95_ms']:.1f} | {lat['mean_ms']:.1f} | {lat['max_ms']:.1f} | "
              f"{enc} | {diff} |")
        out[n] = lat
    return out


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return
    global _overlay
    cmd, args = argv[0], argv[1:]
    for i, a in enumerate(list(args)):
        if a == "--split" or a.startswith("--split="):
            val = a.split("=", 1)[1] if "=" in a else args[i + 1]
            args = [x for j, x in enumerate(args) if j != i and not (a == "--split" and j == i + 1)]
            use_split(val)
            break
    for a in [a for a in args if a == "--overlay" or a.startswith("--overlay=")]:
        _overlay = a.split("=", 1)[1] if "=" in a else OVERLAY
        args.remove(a)
    if cmd == "score":
        ref = "--no-ref" not in args
        reps = next((int(a.split("=", 1)[1]) for a in args if a.startswith("--reps=")), 3)
        cands = {}
        for spec in (a for a in args if not a.startswith("--")):
            cands.update(resolve(spec))
        score(cands, ref=ref, reps=reps)
    elif cmd == "table":
        table(args or None)
    elif cmd == "compare":
        compare(*args)
    elif cmd == "pool":
        pool(args[0], args[1:])
    elif cmd == "latency":
        reps = next((int(a.split("=", 1)[1]) for a in args if a.startswith("--reps=")), 5)
        cands = {}
        for spec in (a for a in args if not a.startswith("--")):
            cands.update(resolve(spec))
        latency_cmd(cands, ref="--no-ref" not in args, reps=reps, uncached="--uncached" in args)
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
