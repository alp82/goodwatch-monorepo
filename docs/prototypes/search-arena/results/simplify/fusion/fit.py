"""Fit the shared signal weights of the general and filmography paths (simp_fusion.SIGNALS) on graded pairs.

Usage: .venv/bin/python results/simplify/fusion/fit.py <base config as a dict literal> [--names fp,bm25,...]
       [--objective plain|cond] [--folds 5] [--out results/simplify/fusion/fit-<tag>.json]

Method
- Signals are captured once per query by ranking with the base config (simp_fusion.CAPTURE). The candidate set does
  not depend on the weights, so re-scoring a query is: fused score -> top 100 -> production title blend -> cut fold.
  Style-path queries have no captured signals and are not part of the fit (their lists do not change).
- The fused score is scale-free except for the filmography boost, so the dense weight is fixed at 1 (the unit) and
  the other weights are fitted relative to it.
- Coordinate ascent on the mean NDCG@10 (round-6 cut rule; plain = ungraded titles count 0, cond = condensed) of the
  training queries: each pass tries every weight at x0, x0.5, x0.7, x0.85, x1.2, x1.4, x2 of its value (and 0.1 when
  it is 0), keeps a move only when it gains more than 0.0005, stops after 6 passes or when nothing moves.
- Cross-validation: 5 folds grouped by query (a query's pairs never cross folds), stratified by split and path.
  Splits: dev, holdout, holdout2, holdout3, holdout4 only (no holdout5 exists and none is read).
  CV NDCG = every query scored with the weights fitted on the other 4 folds.
"""
import functools, json, os, random, sys, time

import numpy as np

sys.path.insert(0, "harness")
import evalsimp as ES  # noqa: E402
import metrics as M  # noqa: E402
import simp_fusion as F  # noqa: E402

# memoize the pure per-(title, query) pieces of the blend: the fit calls it thousands of times per query
F.title_match = functools.lru_cache(maxsize=None)(F.title_match)
F.title_similarity = functools.lru_cache(maxsize=None)(F.title_similarity)
F.names_creator = functools.lru_cache(maxsize=None)(F.names_creator)
_fz = F.fuzzy_title
_fz_cache = {}


def _fuzzy(query, mask, cutoff, gate=True):
    k = (query, cutoff, gate)
    if k not in _fz_cache:
        _fz_cache[k] = _fz(query, mask, cutoff, gate)
    return _fz_cache[k]


F.fuzzy_title = _fuzzy

MULTS = (0.0, 0.5, 0.7, 0.85, 1.2, 1.4, 2.0)


def capture(cfg, ctxs):
    F.CAPTURE = {}
    for c in ctxs:
        F.rank(c, cfg)
    cap, F.CAPTURE = F.CAPTURE, None
    return cap


def finish(ctx, cfg, cap, W):
    path, cand, sig, exclude, less = cap
    s = 0.0
    for name, x in sig.items():
        if name == "fil":
            continue
        w = W.get(name, 0.0)
        if name == "neg" and less:
            w = max(w, cfg["less_neg"] / cfg["a"])
        if w:
            s = s + w * x
    if "fil" in sig:
        s = s + W.get("fil", 0.0) * sig["fil"]
    r, sc = F.top(cand, s, F.LIMIT)
    disc = F.as_list(r, sc)
    blended = F.blend(ctx, disc, cfg, exclude, entity=path == "filmography")
    ids = [x["id"] for x in blended]
    if cfg["fold_after_blend"] and cfg["cut_rule"]:
        ids = F.fold_cuts(ids, cfg)
    return ids[: F.TOP]


def q_ndcg(ctx, ids, grades, objective):
    g = grades.get(ctx.id, {})
    if objective == "cond":
        ids = [p for p in ids if p in g]
    return M.graded_query6(ids, g)["ndcg10"]


def mean_ndcg(qs, cfg, caps, W, grades, objective):
    return float(np.mean([q_ndcg(c, finish(c, cfg, caps[c.id], W), grades, objective) for c in qs]))


def fit(qs, cfg, caps, W0, names, grades, objective, log=None):
    W = dict(W0)
    best = mean_ndcg(qs, cfg, caps, W, grades, objective)
    for p in range(6):
        moved = False
        for n in names:
            group = n.split("+")      # tied signals share one weight
            base = W[group[0]]
            trials = sorted({round(base * m, 4) for m in MULTS} | ({0.1} if base == 0 else set()))
            for v in trials:
                if v == base:
                    continue
                W2 = dict(W, **{g: v for g in group})
                sc = mean_ndcg(qs, cfg, caps, W2, grades, objective)
                if sc > best + 0.0005:
                    best, W, moved = sc, W2, True
        if log:
            log(f"  pass {p}: {best:.4f} {json.dumps({k: round(v, 3) for k, v in W.items()})}")
        if not moved:
            break
    return W, best


def folds_of(qs, cfg, k, seed=7):
    strata = {}
    for c in qs:
        path = "style" if c.id not in caps_global else caps_global[c.id][0]
        strata.setdefault((c.split, path), []).append(c)
    rnd = random.Random(seed)
    fold, i = {}, 0
    for key in sorted(strata):
        cs = sorted(strata[key], key=lambda c: c.id)
        rnd.shuffle(cs)
        for c in cs:
            fold[c.id] = i % k
            i += 1
    return fold


caps_global = {}


def main():
    args = sys.argv[1:]
    base = eval(args[0]) if args and not args[0].startswith("--") else {}
    opt = {a.split("=", 1)[0]: a.split("=", 1)[1] for a in args if a.startswith("--")}
    objective = opt.get("--objective", "plain")
    k = int(opt.get("--folds", 5))
    names = opt.get("--names", "fp,bm25,facet,cov,neg,votes,gw,fil,agree").split(",")
    out = opt.get("--out", f"results/simplify/fusion/fit-{objective}.json")
    cfg = F.variant(**base)[0]
    t0 = time.time()
    ctxs = ES.contexts()
    grades = M.load_grades()
    caps = capture(cfg, ctxs)
    caps_global.update(caps)
    qs = [c for c in ctxs if c.id in caps and c.type != "title_lookup" and c.id in grades]
    print(f"{len(qs)} fitted queries ({len(caps)} captured) in {time.time() - t0:.0f} s", flush=True)
    a = cfg["a"]
    W0 = {n: F.weight(cfg, n) / a for n in F.SIGNALS}   # dense = 1
    for n in names:                                       # a tied group starts at its members' mean
        group = n.split("+")
        m = float(np.mean([W0[g] for g in group]))
        W0.update({g: m for g in group})
    for kv in filter(None, opt.get("--fix", "").split(",")):   # fixed weights ("fp=1.0")
        k_, v_ = kv.split("=")
        W0[k_] = float(v_)
    base_score = mean_ndcg(qs, cfg, caps, W0, grades, objective)
    print(f"baseline weights (dense = 1): {json.dumps({n: round(v, 3) for n, v in W0.items()})} -> {base_score:.4f}")
    fold = folds_of(qs, cfg, k)
    per_q = {}
    fold_w = []
    for f in range(k):
        tr = [c for c in qs if fold[c.id] != f]
        te = [c for c in qs if fold[c.id] == f]
        W, tr_score = fit(tr, cfg, caps, W0, names, grades, objective)
        fold_w.append(W)
        for c in te:
            ids = finish(c, cfg, caps[c.id], W)
            ids0 = finish(c, cfg, caps[c.id], W0)
            g = grades.get(c.id, {})
            per_q[c.id] = dict(split=c.split, path=caps[c.id][0],
                               cv=M.graded_query6(ids, g)["ndcg10"], base=M.graded_query6(ids0, g)["ndcg10"],
                               cv_c=M.graded_query6([p for p in ids if p in g], g)["ndcg10"],
                               base_c=M.graded_query6([p for p in ids0 if p in g], g)["ndcg10"])
        print(f"fold {f}: train {tr_score:.4f}, weights {json.dumps({n: round(v, 3) for n, v in W.items()})}", flush=True)
    Wall, in_score = fit(qs, cfg, caps, W0, names, grades, objective, log=print)
    ins = {}
    for c in qs:
        ids = finish(c, cfg, caps[c.id], Wall)
        g = grades.get(c.id, {})
        ins[c.id] = (M.graded_query6(ids, g)["ndcg10"], M.graded_query6([p for p in ids if p in g], g)["ndcg10"])
    print(f"\nall-data fit: {json.dumps({n: round(v, 3) for n, v in Wall.items()})}  in-sample {objective} {in_score:.4f}")
    print("\n| split (fitted queries) | n | baseline | CV | in-sample | baseline cond | CV cond | in-sample cond |")
    print("|---|---|---|---|---|---|---|---|")
    for sp in ES.SPLITS + ("all",):
        ids = [q for q, v in per_q.items() if sp == "all" or v["split"] == sp]
        if not ids:
            continue
        m = lambda key: np.mean([per_q[q][key] for q in ids])
        mi = lambda j: np.mean([ins[q][j] for q in ids])
        print(f"| {sp} | {len(ids)} | {m('base'):.3f} | {m('cv'):.3f} | {mi(0):.3f} | {m('base_c'):.3f} | {m('cv_c'):.3f} | {mi(1):.3f} |")
    print("CV weights per fold:", [json.dumps({n: round(v, 3) for n, v in w.items()}) for w in fold_w])
    json.dump(dict(base=base, objective=objective, names=names, W0=W0, fold_weights=fold_w, W=Wall, per_query=per_q,
                   in_sample={q: v for q, v in ins.items()}), open(out, "w"), indent=1)
    print(f"\n{time.time() - t0:.0f} s; written {out}")


if __name__ == "__main__":
    main()
