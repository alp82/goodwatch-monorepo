"""CPU catalog-embedding benchmark for a GPU-less Windmill backfill: runs every job, then writes the report.

Each (model, runtime, threads) job runs in a fresh process pinned to `threads` physical cores (CPUs 8..15,
one CCD, no SMT siblings), with CUDA hidden. Raw job lines go to cache/runs.jsonl (resumable);
the report goes to results/bench/backfill.json.

Usage: .venv/bin/python bench/backfill/bench.py [run|report]   (default: both; run prepare.py first)
"""
import json, os, subprocess, sys
import numpy as np

os.environ["CUDA_VISIBLE_DEVICES"] = ""
import common as C  # noqa: E402

RUNTIMES = ["st-fp32", "ort-fp32", "ort-int8"]
THREADS = [1, 2, 4, 8]
FIRST_CORE = 8
VEC_THREADS = 8  # vectors are saved from this run for the quality check
CATALOG = 191_634
INCREMENTAL_PER_48H = 260
RUNS = os.path.join(C.HERE, "cache", "runs.jsonl")
OUT = os.path.join(C.ARENA, "results", "bench", "backfill.json")


def vec_path(model, runtime):
    return os.path.join(C.HERE, "cache", f"vec-{model}-{runtime}.npy")


def done():
    if not os.path.exists(RUNS):
        return {}
    return {(r["model"], r["runtime"], r["threads"]): r for r in map(json.loads, open(RUNS))}


def run():
    have = done()
    for model in C.MODELS:
        for runtime in RUNTIMES:
            for n in THREADS:
                if (model, runtime, n) in have:
                    continue
                cores = f"{FIRST_CORE}-{FIRST_CORE + n - 1}"
                cmd = ["taskset", "-c", cores, sys.executable, os.path.join(C.HERE, "run_one.py"), model, runtime, str(n)]
                if n == VEC_THREADS:
                    cmd.append(vec_path(model, runtime))
                p = subprocess.run(cmd, capture_output=True, text=True, env={**os.environ, "CUDA_VISIBLE_DEVICES": ""})
                line = [l for l in p.stdout.splitlines() if l.startswith("{")]
                if p.returncode or not line:
                    sys.exit(f"{model} {runtime} {n} failed:\n{p.stderr[-3000:]}")
                rec = {**json.loads(line[-1]), "cores": cores}
                open(RUNS, "a").write(json.dumps(rec) + "\n")
                print(json.dumps(rec), flush=True)


def quality(model):
    """Cosine of each CPU runtime's vectors vs the stored GPU fp16 vectors, and ranking agreement on arena queries."""
    cfg = C.MODELS[model]
    idx = json.load(open(C.sample_path(model)))["idx"]
    ref = np.load(os.path.join(C.DATA, cfg["stored"]), mmap_mode="r")[idx].astype(np.float32)
    ref /= np.linalg.norm(ref, axis=1, keepdims=True)
    q = json.load(open(os.path.join(C.DATA, f"query-emb-{cfg['hf'].split('/')[-1]}.json")))
    Q = np.array(list(q.values()), dtype=np.float32)
    Q /= np.linalg.norm(Q, axis=1, keepdims=True)
    top_ref = np.argsort(-(Q @ ref.T), axis=1)[:, :20]
    out = {}
    for runtime in RUNTIMES:
        v = np.load(vec_path(model, runtime))
        c = (v * ref).sum(1)
        top = np.argsort(-(Q @ v.T), axis=1)[:, :20]
        out[runtime] = {
            "cos_vs_stored": {"min": round(float(c.min()), 4), "p1": round(float(np.percentile(c, 1)), 4),
                              "p5": round(float(np.percentile(c, 5)), 4), "median": round(float(np.median(c)), 5),
                              "mean": round(float(c.mean()), 5), "below_0.99": int((c < 0.99).sum()),
                              "below_0.99_catalog_rows_first50": [int(idx[i]) for i in np.where(c < 0.99)[0]][:50]},
            "query_top20_overlap_in_sample": {"queries": len(Q), "mean": round(float(np.mean(
                [len(set(a) & set(b)) / 20 for a, b in zip(top, top_ref)])), 4), "top1_same": round(float(np.mean(
                    top[:, 0] == top_ref[:, 0])), 4)},
        }
    return out


def report():
    lengths = json.load(open(os.path.join(C.HERE, "cache", "lengths.json")))
    runs = done()
    cpu = subprocess.run(["lscpu"], capture_output=True, text=True).stdout
    pick = lambda k: next((l.split(":", 1)[1].strip() for l in cpu.splitlines() if l.startswith(k + ":")), None)
    res = {
        "date": "2026-09-24",
        "host": {"cpu": pick("Model name"), "cores": pick("Core(s) per socket"), "threads_per_core": pick("Thread(s) per core"),
                 "max_mhz": pick("CPU max MHz"), "l3": pick("L3 cache"),
                 "isa": [f for f in ("avx2", "avx512f", "avx512_vnni", "avx_vnni", "avx512_bf16") if f in (pick("Flags") or "").split()],
                 "pinning": f"taskset to physical cores {FIRST_CORE}.. (CCD1, 32 MB L3 slice, no SMT siblings)",
                 "note": "desktop with other light load (load avg ~2 on 32 CPUs); scale by per-core speed to the Windmill host"},
        "setup": {"sample": f"{C.SAMPLE_N} uniform random catalog titles, seed {C.SEED}", "batch": 32,
                  "sort": "by token length within the 2,000-title chunk", "max_len": C.MAX_LEN,
                  "timed": "tokenize + sort + infer + pool + normalize; excludes load and first (warm-up) batch",
                  "cuda": "CUDA_VISIBLE_DEVICES='' (st: torch.cuda.is_available() False; ort: CPUExecutionProvider only)",
                  "int8": "onnxruntime.quantization.quantize_dynamic, QInt8 weights, per-channel, all ops incl. Gather",
                  "text": {m: {"prefix": c["prefix"], "title_in_text": not c["notitle"], "pooling": c["pooling"],
                               "stored": c["stored"]} for m, c in C.MODELS.items()},
                  "incremental": f"{INCREMENTAL_PER_48H} titles per 48 h ({INCREMENTAL_PER_48H // 2}/day), vector_data flow 2026-09-24"},
        "models": {},
        "notes": [
            "Speed noise: repeated 8-thread runs differ by up to ~10-15 % (desktop host).",
            "Peak RSS is VmHWM of a fresh process (verified at 8 threads after switching from ru_maxrss).",
            "ORT with enable_cpu_mem_arena=False: 30-40 % slower and no lower peak (bge fp32 1659 MB, int8 914 MB); keep the arena on.",
            "int8 variants (quant_variants.py): MatMul-only per-channel, per-tensor, and Xenova's model_quantized.onnx all keep "
            "query top-20 overlap at 0.69-0.88 vs 0.998 for fp32; none fixes int8 ranking drift.",
            "Cold start assumes model files are on local disk; a first run that downloads from Hugging Face adds the transfer "
            "(bge fp32 ONNX 436 MB, e5 fp32 ONNX 470 MB, int8 110/118 MB).",
        ],
    }
    for model in C.MODELS:
        pad = lengths[model]["padding_overhead_by_chunk"]
        # The sample chunk (2,000) pads ~1.4 %; a 260-title job pads like a ~256 chunk.
        inc_factor = (1 + pad["256"]) / (1 + pad["2000"])
        rows = []
        for runtime in RUNTIMES:
            for n in THREADS:
                r = runs.get((model, runtime, n))
                if not r:
                    continue
                tps = r["titles_per_s"]
                inc = INCREMENTAL_PER_48H / tps * inc_factor
                rows.append({
                    "runtime": runtime, "threads": n, "titles_per_s": tps,
                    "titles_per_s_per_thread": round(tps / n, 2),
                    "full_backfill_h": round(CATALOG / tps / 3600, 2),
                    "full_backfill_core_h": round(CATALOG / tps / 3600 * n, 2),
                    "cold_start_s": r["cold_start_s"]["total_to_ready"],
                    "cold_start_detail_s": r["cold_start_s"],
                    "incremental_260_job_s": round(r["cold_start_s"]["total_to_ready"] + inc, 1),
                    "incremental_260_compute_s": round(inc, 1),
                    "incremental_per_day_s": round((r["cold_start_s"]["total_to_ready"] + inc) / 2, 1),
                    "rss_after_load_mb": r["rss_after_load_mb"], "peak_rss_mb": r["peak_rss_mb"],
                    "providers": r["providers"],
                })
        res["models"][model] = {"lengths": lengths[model], "runs": rows, "quality": quality(model)}
        vq = os.path.join(C.HERE, "cache", f"variants-quality-{model}.json")
        if os.path.exists(vq):  # from quant_variants.py
            vr = [r for r in map(json.loads, open(os.path.join(C.HERE, "cache", "variants.jsonl"))) if r["model"] == model]
            res["models"][model]["int8_variants"] = {
                rt: {"titles_per_s": {r["threads"]: r["titles_per_s"] for r in vr if r["runtime"] == rt},
                     "cos_vs_stored": {k: v for k, v in q["cos_vs_stored"].items() if not k.startswith("below_0.99_")}
                     | {"below_0.99": q["cos_vs_stored"]["below_0.99"]},
                     "query_top20_overlap_in_sample": q["query_top20_overlap_in_sample"]}
                for rt, q in json.load(open(vq)).items() if rt != "ort-fp32"}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(res, open(OUT, "w"), indent=1)
    print("wrote", OUT)


if __name__ == "__main__":
    what = sys.argv[1:] or ["run", "report"]
    if "run" in what:
        run()
    if "report" in what:
        report()
