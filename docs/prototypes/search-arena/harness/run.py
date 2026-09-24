"""Run the round-1 rankers offline and write results/round1/.

Usage: .venv/bin/python harness/run.py

Steps (only the dev split decides anything; holdout is computed and reported, never used to choose):
1. prod (captured), prod-replay, fp-count, emb-e5s, emb-e5s-notitle, emb-bgeb.
2. Pick the e5-small variant with the better dev anchors for the hybrids.
3. Sweep hyb-lin weights on dev anchors, keep the best as hyb-lin (and for hyb-lin+prior).
4. hyb-lin, hyb-rrf, emb-then-fp, nojev-knn, hyb-lin+prior.
Outputs: lists/<ranker>.json (top 50 after the title blend), timings.json, choices.json, sweep-hyb-lin.md,
replay-fidelity.md.
"""
import json, os, statistics, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import anchors as A  # noqa: E402
import blend as B  # noqa: E402
import catalog as C  # noqa: E402
import context as X  # noqa: E402
import qemb  # noqa: E402
import rankers as R  # noqa: E402

OUT = os.path.join(C.ARENA, "results", "round1")
LISTS = os.path.join(OUT, "lists")
TOP = 50
TUNE_EXCLUDE = ("title_lookup",)


def prod_list(ctx):
    return [dict(id=p["point_id"], title=p["title"], year=str(p["year"] or ""), media_type=p["media_type"],
                 score=p["score"]) for p in ctx.prod[:TOP]]


def run_ranker(fn, ctxs):
    lists, ms = {}, {}
    for ctx in ctxs:
        t = time.perf_counter()
        disc = fn(ctx)
        ms[ctx.id] = (time.perf_counter() - t) * 1000
        blended = B.blend(ctx.title_lookup, [(pid, i + 1, s) for i, (pid, s, _) in enumerate(disc)], ctx.query)
        lists[ctx.id] = [{k: x[k] for k in ("id", "title", "year", "media_type", "score")} for x in blended[:TOP]]
    return lists, ms


def dev_key(ctxs, lists):
    s = A.summarize(ctxs, lists, "dev", TUNE_EXCLUDE)
    return (s["anchor10"], s["anchor50"], -s["avoid5"]), s


def save(name, lists):
    json.dump(lists, open(os.path.join(LISTS, f"{name}.json"), "w"), ensure_ascii=False)


def main():
    os.makedirs(LISTS, exist_ok=True)
    cat = C.load()
    ctxs = X.contexts()
    # Warm caches so timings measure ranking only.
    for name in ("e5s", "e5s-notitle", "bgeb", "me5s"):
        C.embeddings(name)
    t = time.perf_counter()
    for ctx in ctxs:
        for name in ("e5s", "bgeb") if not ctx.non_english else ("me5s",):
            qemb.embed(name, ctx.text)
    print(f"query embeddings ready in {time.perf_counter() - t:.1f}s")

    timings, stages, choices = {}, {}, {}
    all_lists = {"prod": {ctx.id: prod_list(ctx) for ctx in ctxs}}
    save("prod", all_lists["prod"])
    stages["prod"] = ["crate_text", "qdrant_fp2000"]

    base = R.registry()
    for name in ("prod-replay", "fp-count", "emb-e5s", "emb-e5s-notitle", "emb-bgeb"):
        fn, st = base[name]
        lists, ms = run_ranker(fn, ctxs)
        all_lists[name], timings[name], stages[name] = lists, ms, st
        save(name, lists)
        print(name, dev_key(ctxs, lists)[1])

    k_full, s_full = dev_key(ctxs, all_lists["emb-e5s"])
    k_nt, s_nt = dev_key(ctxs, all_lists["emb-e5s-notitle"])
    e5 = "e5s-notitle" if k_nt > k_full else "e5s"
    choices["e5_variant"] = {"chosen": e5, "dev_emb-e5s": s_full, "dev_emb-e5s-notitle": s_nt}
    print("e5 variant:", e5)

    # Sweep hyb-lin on dev only.
    grid = []
    for a in (0.4, 0.6, 0.8):
        for bc in (0.5, 0.7):
            b = round((1 - a) * bc, 3)
            c = round((1 - a) - b, 3)
            grid.append(dict(a=a, b=b, c=c))
    dev_ctxs = [c for c in ctxs if c.split == "dev"]
    sweep = []
    for g in grid:
        lists, _ = run_ranker(lambda c, g=g: R.hyb_lin(c, e5, **g), dev_ctxs)
        key, s = dev_key(dev_ctxs, lists)
        sweep.append((key, g, s))
        print("hyb-lin", g, s)
    best = max(sweep, key=lambda x: x[0])
    choices["hyb_lin"] = {"chosen": best[1], "grid": [{"params": g, **s} for _, g, s in sweep]}
    with open(os.path.join(OUT, "sweep-hyb-lin.md"), "w") as f:
        f.write(f"# hyb-lin sweep (dev only, {e5}, title_lookup queries excluded)\n\n")
        f.write("| a (emb) | b (weighted sum) | c (text) | anchor10 | anchor50 | avoid5 |\n|---|---|---|---|---|---|\n")
        for _, g, s in sweep:
            mark = " **chosen**" if g == best[1] else ""
            f.write(f"| {g['a']} | {g['b']} | {g['c']} | {s['anchor10']:.3f} | {s['anchor50']:.3f} | {s['avoid5']}{mark} |\n")

    reg = R.registry(e5=e5, hyb=best[1])
    for name in ("hyb-lin", "hyb-rrf", "emb-then-fp", "nojev-knn", "hyb-lin+prior"):
        fn, st = reg[name]
        lists, ms = run_ranker(fn, ctxs)
        all_lists[name], timings[name], stages[name] = lists, ms, st
        save(name, lists)
        print(name, dev_key(ctxs, lists)[1])

    json.dump({n: {"mean_ms": statistics.mean(v.values()), "p95_ms": sorted(v.values())[int(0.95 * len(v)) - 1],
                   "max_ms": max(v.values())} for n, v in timings.items()},
              open(os.path.join(OUT, "timings.json"), "w"), indent=1)
    json.dump({"stages": stages, "stage_notes": R.STAGES}, open(os.path.join(OUT, "stages.json"), "w"), indent=1)
    json.dump(choices, open(os.path.join(OUT, "choices.json"), "w"), indent=1)
    fidelity(ctxs, all_lists["prod"], all_lists["prod-replay"])


def fidelity(ctxs, prod, replay):
    rows, overlaps, overlaps_disc = [], [], []
    for ctx in ctxs:
        p = [x["id"] for x in prod[ctx.id][:10]]
        r = [x["id"] for x in replay[ctx.id][:10]]
        ov = len(set(p) & set(r)) / max(len(p), 1)
        same_order = p == r
        # Discovery-only: production's own retrieveD4 ranking vs the replay's, before the blend.
        pd = [x["point_id"] for x in sorted((x for x in ctx.prod if x["discovery"]), key=lambda x: x["discovery"]["rank"])][:10]
        rd = [pid for pid, _, _ in R.prod_replay(ctx)[:10]]
        ovd = len(set(pd) & set(rd)) / max(len(pd), 1)
        overlaps.append(ov)
        overlaps_disc.append(ovd)
        rows.append((ctx.id, ctx.path, ov, same_order, ovd, [x["title"] for x in prod[ctx.id][:10] if x["id"] not in r],
                     [x["title"] for x in replay[ctx.id][:10] if x["id"] not in p]))
    with open(os.path.join(OUT, "replay-fidelity.md"), "w") as f:
        f.write("# prod-replay fidelity\n\n")
        f.write(f"Mean top-10 overlap after the blend: **{statistics.mean(overlaps):.3f}** "
                f"(identical top 10 in {sum(1 for r in rows if r[3])} of {len(rows)} queries). "
                f"Discovery top 10 before the blend: **{statistics.mean(overlaps_disc):.3f}**.\n\n")
        f.write("| query | path | top10 overlap | same order | discovery overlap | only in prod | only in replay |\n|---|---|---|---|---|---|---|\n")
        for r in rows:
            f.write(f"| {r[0]} | {r[1]} | {r[2]:.1f} | {'yes' if r[3] else 'no'} | {r[4]:.1f} | {'; '.join(r[5])} | {'; '.join(r[6])} |\n")
    print(f"replay overlap: blended {statistics.mean(overlaps):.3f}, discovery {statistics.mean(overlaps_disc):.3f}")


if __name__ == "__main__":
    main()
