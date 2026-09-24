"""int8 variants, to see whether a milder quantization keeps ranking quality: speed at 4 and 8 threads plus quality.

Variants (bench/backfill/models/<model>/model-<variant>.onnx):
- int8: quantize_dynamic, all ops (the main benchmark's int8)
- int8mm: MatMul only, per-channel (word-embedding Gather stays fp32)
- int8mmt: MatMul only, per-tensor
- xenova: Xenova/<model> onnx/model_quantized.onnx (transformers.js default)

Appends to cache/variants.jsonl and prints a table. Usage: .venv/bin/python bench/backfill/quant_variants.py
"""
import json, os, shutil, subprocess, sys
import numpy as np

os.environ["CUDA_VISIBLE_DEVICES"] = ""
import common as C  # noqa: E402
import bench as B  # noqa: E402

VARIANTS = ["int8", "int8mm", "int8mmt", "xenova"]
OUT = os.path.join(C.HERE, "cache", "variants.jsonl")


def build(model, v):
    from onnxruntime.quantization import quantize_dynamic, QuantType
    from huggingface_hub import hf_hub_download
    p = C.onnx_path(model, v)
    if os.path.exists(p):
        return
    if v == "xenova":
        shutil.copy(hf_hub_download("Xenova/" + model, "onnx/model_quantized.onnx"), p)
    else:
        quantize_dynamic(C.onnx_path(model, "fp32"), p, weight_type=QuantType.QInt8,
                         per_channel=(v == "int8mm"), op_types_to_quantize=["MatMul"])


def main():
    B.RUNTIMES = [f"ort-{v}" for v in VARIANTS] + ["ort-fp32"]
    have = set()
    if os.path.exists(OUT):
        have = {(r["model"], r["runtime"], r["threads"]) for r in map(json.loads, open(OUT))}
    for model in C.MODELS:
        for v in VARIANTS:
            build(model, v)
            for n in (4, 8):
                if (model, f"ort-{v}", n) in have:
                    continue
                cmd = ["taskset", "-c", f"8-{7 + n}", sys.executable, os.path.join(C.HERE, "run_one.py"), model, f"ort-{v}",
                       str(n)] + ([B.vec_path(model, f"ort-{v}")] if n == 8 else [])
                p = subprocess.run(cmd, capture_output=True, text=True)
                line = [l for l in p.stdout.splitlines() if l.startswith("{")]
                if not line:
                    sys.exit(p.stderr[-3000:])
                open(OUT, "a").write(line[-1] + "\n")
        q = B.quality(model)
        runs = {(r["runtime"], r["threads"]): r for r in map(json.loads, open(OUT)) if r["model"] == model}
        for rt in B.RUNTIMES:
            s = q[rt]
            speed = " ".join(f"{n}t={runs[(rt, n)]['titles_per_s']}" for n in (4, 8) if (rt, n) in runs)
            print(model, rt, speed, "cos p1/median", s["cos_vs_stored"]["p1"], s["cos_vs_stored"]["median"],
                  "<0.99", s["cos_vs_stored"]["below_0.99"], "top20", s["query_top20_overlap_in_sample"]["mean"],
                  "top1", s["query_top20_overlap_in_sample"]["top1_same"],
                  "peak", runs.get((rt, 8), {}).get("peak_rss_mb"), flush=True)
        json.dump(q, open(os.path.join(C.HERE, "cache", f"variants-quality-{model}.json"), "w"))


if __name__ == "__main__":
    main()
