"""Build results/bench/replay.json from bench/replay/out/runs.jsonl (replay runs), out/lists-*.json (recorded top-k
lists), out/exact.json (numpy exact lists) and out/env.json (hardware, limits, notes written by run_all.sh).

Breakdown per search (all ms, additive; the means add up to the mean total):
  compute          the recorded in-memory ranker time, burned on the main thread (pre + post)
  encode           worker compute for the query's texts (one batch per model)
  encode_queue     wait in the encoder worker behind other searches
  qdrant / crate   per store, the client-observed request time on the critical path of each stage, incl. the
                   injected RTT (stage 1 is max(encode + Qdrant, Crate) since Crate starts at once). Split into
                   _server (Qdrant `time`, Crate `duration`), _rtt and _transfer (the rest: request/response JSON
                   on both ends, HTTP, and the event loop picking up the response; Qdrant's `time` excludes its own
                   request parsing and response serialization)
  display          the final 50-title payload fetch (Qdrant retrieve), incl. RTT
  other            the rest: event-loop waits behind other searches' CPU work, request building, mixing
Production scaling: CPU work (everything except the injected RTT) times f, RTT unchanged.
"""
import json, os, sys
from collections import defaultdict

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ARENA = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(HERE, "out")
RESULT = os.path.join(ARENA, "results", "bench", "replay.json")
TRACE = os.path.join(ARENA, "results", "bench", "trace", "trace.jsonl")

PROD = dict(cached_p50=688, fresh_p50=1750, cached_p95=1375, fresh_p95=3188)
JEV_FRESH_EST = PROD["fresh_p50"] - PROD["cached_p50"]   # the fresh reading's extra time at p50


def pct(v, p):
    v = sorted(v)
    return round(float(v[min(len(v) - 1, int(round(p / 100 * (len(v) - 1))))]), 1) if v else None


def dist(v):
    return dict(p50=pct(v, 50), p95=pct(v, 95), p99=pct(v, 99), mean=round(float(np.mean(v)), 1) if v else None, n=len(v))


def parts(r):
    """Additive split of one search's wall time along its critical path."""
    enc = r.get("encode") or {}
    enc_c, enc_q, enc_w = enc.get("compute", 0.0), enc.get("queue", 0.0), enc.get("wall", 0.0)
    acc = dict(qdrant=0.0, qdrant_server=0.0, qdrant_rtt=0.0, crate=0.0, crate_server=0.0, crate_rtt=0.0)
    rtt_crit = 0.0
    for i, s in enumerate(r["stages"]):
        q, c = s.get("qdrant"), s.get("crate")
        qw = q["wall"] + q["rtt"] if q else 0.0          # client-observed, incl. injected RTT
        cw = c["wall"] if c else 0.0                      # crate wall already includes its RTT
        qpath = qw + (enc_w if i == 0 else 0.0)
        if q and (not c or qpath >= cw):
            acc["qdrant"] += qw
            acc["qdrant_server"] += q["server"]
            acc["qdrant_rtt"] += q["rtt"]
            rtt_crit += q["rtt"]
        elif c:
            acc["crate"] += cw
            acc["crate_server"] += c["server"]
            acc["crate_rtt"] += c["rtt"]
            rtt_crit += c["rtt"]
            if i == 0:          # encode ran in parallel with the (longer) Crate branch: off the critical path
                enc_c = enc_q = 0.0
    d = r.get("display") or {}
    disp = d.get("wall", 0.0) + d.get("rtt", 0.0)
    rtt_crit += d.get("rtt", 0.0)
    compute = r["pre"] + r["post"]
    known = compute + enc_c + enc_q + acc["qdrant"] + acc["crate"] + disp
    out = dict(total=r["total"], compute=compute, encode=enc_c, encode_queue=enc_q, **acc, display=disp,
               other=r["total"] - known, rtt_critical=rtt_crit)
    out["qdrant_transfer"] = acc["qdrant"] - acc["qdrant_server"] - acc["qdrant_rtt"]
    out["crate_transfer"] = acc["crate"] - acc["crate_server"] - acc["crate_rtt"]
    return out


def summarize_run(run):
    by = defaultdict(list)
    for r in run["records"]:
        p = parts(r)
        by[r["path"]].append(p)
        by["all"].append(p)
    out = dict(label=run["label"], config={k: run["config"][k] for k in (
        "collection", "concurrency", "passes", "warmup", "mix", "mixk", "profiles", "crate", "rtt", "bg", "display")},
        searches=run["searches"], seconds=round(run["seconds"], 1), throughput_per_s=round(run["throughput"], 2),
        event_loop_delay_ms={k: round(v, 1) for k, v in run["event_loop_delay_ms"].items()}, paths={})
    for path, ps in by.items():
        out["paths"][path] = dict(
            total=dist([p["total"] for p in ps]),
            breakdown_mean={k: round(float(np.mean([p[k] for p in ps])), 1) for k in ps[0] if k not in ("total", "rtt_critical")},
            breakdown_p50={k: pct([p[k] for p in ps], 50) for k in ps[0] if k not in ("total", "rtt_critical")},
        )
    if run.get("background"):
        b = run["background"]
        out["background"] = dict(recommend_calls=b["recommend_n"], recommend_ms=dist(b["recommend_ms"]),
                                 recommend_errors=b["recommend_errors"], upsert_bursts=b["upserts"])
    return out, by


def scaled(by, f):
    res = {}
    for path, ps in by.items():
        tot = [(p["total"] - p["rtt_critical"]) * f + p["rtt_critical"] for p in ps]
        res[path] = dist(tot)
    return res


def recall(store, exact, k=None):
    e = exact[:k] if k else exact
    s = store[:k] if k else store
    if not e:
        return None
    return len(set(s) & set(e)) / len(e)


def parity(trace, exact):
    out = {}
    for fn in sorted(os.listdir(OUT)):
        if not fn.startswith("lists-"):
            continue
        label = fn[6:-5]
        lists = json.load(open(os.path.join(OUT, fn)))
        acc = defaultdict(list)
        for q in trace:
            got = lists.get(q["id"], {})
            for o in q["ops"]:
                if o["id"] not in got or o["id"] not in exact[q["id"]]:
                    continue
                ex = exact[q["id"]][o["id"]]
                e = ex["ids"]
                s, s_scores = got[o["id"]]
                if o["kind"] == "bm25_topk":
                    key = f"bm25_topk {o['role']}"
                    if e:
                        acc[key + " | recall of prototype list"].append(recall(s, e))
                        acc[key + " | top-20 overlap"].append(recall(s, e, 20))
                    else:
                        acc[key + " | prototype list empty, Crate returned >0"].append(float(len(s) > 0))
                elif o["kind"] == "dense_mix_topk":
                    acc["dense_mix_topk | recall@500"].append(recall(s, e))
                    acc["dense_mix_topk | recall@100"].append(recall(s[:100], e[:100]))
                else:
                    vs = o.get("vector_set")
                    vtype = "centroid" if o["role"].startswith("profile:") else "query"
                    acc[f"{o['kind']} {vs} ({vtype}) | recall@{o['k']}"].append(recall(s, e))
                    if vs == "fingerprint_raw":
                        # integer 0..10 scores x few non-zero weights: many exact ties at the k boundary. A store hit
                        # scoring at least the exact k-th score is as good as the exact list's pick.
                        kth = ex["scores"][-1]
                        hits = sum(1 for x in s_scores if x >= kth - 1e-4 * max(1.0, abs(kth)))
                        acc[f"{o['kind']} {vs} ({vtype}) | tie-aware recall@{o['k']}"].append(min(1.0, hits / len(e)))
        out[label] = {k: dict(mean=round(float(np.mean(v)), 4), min=round(float(np.min(v)), 4), n=len(v),
                              below_0_95=int(sum(x < 0.95 for x in v))) for k, v in sorted(acc.items())}
    return out


def _p(summ, label, path="all"):
    r = summ.get(label)
    if not r:
        return None
    t = r["paths"][path]["total"]
    return dict(p50=t["p50"], p95=t["p95"], p99=t["p99"], throughput_per_s=r["throughput_per_s"])


def headline(summ):
    """The comparisons the report quotes. Labels: see run_all.sh."""
    paths = ("all", "general", "non_english", "reference")
    cmp = lambda *labels: {l: {p: _p(summ, l, p) for p in paths} for l in labels if l in summ}
    ceiling = {}
    for fam, labels in dict(recommended=["best-c1", "best-c4", "best-c8", "best-c16", "best-c32"],
                            js_client=["f16-c1", "f16-c4", "f16-c8", "f16-c16", "f16-c32"],
                            raw_client=["raw-c1", "raw-c4", "raw-c8", "raw-c16"]).items():
        pts = [(summ[l]["config"]["concurrency"], summ[l]["throughput_per_s"], summ[l]["paths"]["all"]["total"]["p95"])
               for l in labels if l in summ]
        ok = [tp for c, tp, p95 in pts if p95 <= 1000]
        ceiling[fam] = dict(points=[dict(concurrency=c, throughput_per_s=tp, p95=p95) for c, tp, p95 in pts],
                            max_throughput_with_p95_under_1s=max(ok) if ok else None)
    est = {}
    for label in ("best-c1", "best-c4", "f16-c1", "f16-c4"):
        if label not in summ:
            continue
        est[label] = {}
        for f in (2, 3):
            e = summ[label]["production_estimate"][f"{f}x_slower_cpu"]
            est[label][f"{f}x"] = {p: dict(ranker_p50=e[p]["p50"], ranker_p95=e[p]["p95"], ranker_p99=e[p]["p99"]) for p in paths}
            a = e["all"]["p50"]
            est[label][f"{f}x"]["end_to_end_p50_bounds"] = dict(
                note="production p50 minus today's d4 retrieval plus the new ranker; today's retrieval split is not "
                     "recorded, so: upper = nothing removed, lower = ~100 ms removed (Qdrant top-500 query 42 ms + "
                     "trope MATCH 61 ms p50, results/bench/infra.json)",
                cached=[round(PROD["cached_p50"] - 100 + a), round(PROD["cached_p50"] + a)],
                fresh=[round(PROD["fresh_p50"] - 100 + a), round(PROD["fresh_p50"] + a)])
    return dict(
        recommended_config="f16, raw undici fetch for Qdrant batches, fingerprint_raw top-k exact, non-English mix "
                           "as two top-2000 lists + one rescore round trip with precomputed per-filter stats, "
                           "precomputed reference profiles (lookup_from), Crate one UNION ALL statement per stage",
        main_scenario_c1=cmp("f16-c1", "raw-c1", "best-c1"),
        storage=cmp("f16-c1", "f32-c1", "sq8-c1", "best-c1", "best-f32-c1", "best-sq8-c1"),
        qdrant_client=cmp("f16-c1", "raw-c1", "f16-c4-long", "raw-f16-c4-long", "f16-c16", "raw-c16"),
        gap2_non_english=cmp("f16-c1", "mix-pre-c1", "mix-pre-global-c1", "mix-pre-k1000-c1", "mix-rescore-k2000-c1",
                             "raw-c1", "raw-mix-rescore-k2000-c1"),
        gap3_profiles=cmp("f16-c1", "profiles-c1", "raw-c1", "raw-profiles-c1", "f16-c4", "profiles-c4"),
        fingerprint_raw_hnsw_vs_exact=cmp("fp-hnsw-c1", "f16-c1"),
        crate_batching=cmp("crate-union-c1", "crate-parallel-c1", "crate-union-c4", "crate-parallel-c4"),
        background_load=cmp("f16-c4-long", "f16-c4-bg", "f16-c4-bg10x", "raw-f16-c4-long", "raw-f16-c4-bg", "best-c4",
                            "best-c4-bg"),
        cpu_limits=cmp("f16-c1", "f16-c1-nolimit"),
        concurrency=cmp("best-c1", "best-c4", "best-c8", "best-c16", "best-c32"),
        throughput_ceiling=ceiling, production_estimate=est)


def main():
    runs = [json.loads(l) for l in open(os.path.join(OUT, "runs.jsonl"))]
    latest = {}
    for r in runs:
        latest[r["label"]] = r        # the last run of each label counts
    trace = [json.loads(l) for l in open(TRACE)]
    exact = json.load(open(os.path.join(OUT, "exact.json")))
    env = json.load(open(os.path.join(OUT, "env.json"))) if os.path.exists(os.path.join(OUT, "env.json")) else {}
    prep = json.load(open(os.path.join(OUT, "prepare.json")))
    summ, scaled_main = {}, {}
    for label, run in latest.items():
        s, by = summarize_run(run)
        s["production_estimate"] = {f"{f}x_slower_cpu": scaled(by, f) for f in (2, 3)}
        summ[label] = s
    result = dict(
        generated=runs[-1]["at"], method=__doc__.strip(), environment=env,
        gap1_fingerprint_raw={k: v for k, v in prep.get("fingerprint_raw", {}).items()},
        gap3_profiles={k: v for k, v in prep.get("profiles", {}).items() if k != "index"},
        production_reference=dict(PROD, jev_fresh_extra_p50_estimate=JEV_FRESH_EST,
                                  note="production end to end (Crate search_history.elapsed_ms, 2026-09-21..23): includes "
                                       "language prep, the Jev stage, title lookup, d4 retrieval, metadata and blend. The "
                                       "fresh reading's extra time is estimated as fresh p50 - cached p50."),
        headline=headline(summ), runs=summ, parity=parity(trace, exact))
    json.dump(result, open(RESULT, "w"), indent=1)
    print("wrote", RESULT)


if __name__ == "__main__":
    main()
