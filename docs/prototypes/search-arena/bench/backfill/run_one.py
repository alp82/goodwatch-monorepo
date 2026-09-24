"""One benchmark job, run in its own process so cold start and peak memory are those of a fresh Windmill job.

Embeds the 2,000-title sample as one chunk: sort by token length, batches of 32, L2-normalize.
Prints one JSON line. The ONNX path imports only onnxruntime + tokenizers (no torch, no transformers),
as a Windmill script would.

Usage: run_one.py <model> <runtime: st-fp32|ort-fp32|ort-int8> <threads> [vectors_out.npy]
"""
import os, sys, time

T0 = time.perf_counter()
MODEL, RUNTIME, THREADS = sys.argv[1], sys.argv[2], int(sys.argv[3])
OUT = sys.argv[4] if len(sys.argv) > 4 else None
os.environ["CUDA_VISIBLE_DEVICES"] = ""
for v in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS"):
    os.environ[v] = str(THREADS)

import json  # noqa: E402
import numpy as np  # noqa: E402
import common as C  # noqa: E402

BATCH = 32


def rss_mb():
    return int(open("/proc/self/statm").read().split()[1]) * os.sysconf("SC_PAGE_SIZE") / 2**20


def peak_mb():
    # VmHWM resets on exec; ru_maxrss can carry the forking parent's peak.
    return next(int(l.split()[1]) for l in open("/proc/self/status") if l.startswith("VmHWM")) / 1024


cfg = C.MODELS[MODEL]
sample = json.load(open(C.sample_path(MODEL)))
texts = sample["texts"]
t_data = time.perf_counter()

if RUNTIME == "st-fp32":
    import torch
    from sentence_transformers import SentenceTransformer
    torch.set_num_threads(THREADS)
    torch.set_num_interop_threads(1)
    t_import = time.perf_counter()
    model = SentenceTransformer(cfg["hf"], device="cpu")
    model.max_seq_length = C.MAX_LEN
    providers = [f"torch {torch.__version__} cpu, threads={torch.get_num_threads()}, cuda_available={torch.cuda.is_available()}"]
    assert not torch.cuda.is_available()

    def embed(batch_texts):
        # encode() also sorts by length internally; batches here are already sorted.
        return model.encode(batch_texts, batch_size=BATCH, normalize_embeddings=True, convert_to_numpy=True,
                            show_progress_bar=False)

    def ntokens(t):
        return [len(x) for x in model.tokenizer(t, truncation=True, max_length=C.MAX_LEN)["input_ids"]]
else:
    import onnxruntime as ort
    from tokenizers import Tokenizer
    from huggingface_hub import hf_hub_download
    t_import = time.perf_counter()
    tok = Tokenizer.from_file(hf_hub_download(cfg["hf"], "tokenizer.json"))
    tok.enable_truncation(C.MAX_LEN)
    so = ort.SessionOptions()
    so.intra_op_num_threads = THREADS
    so.inter_op_num_threads = 1
    so.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    so.enable_cpu_mem_arena = os.environ.get("BENCH_NO_ARENA") != "1"  # arena off: lower peak RSS
    so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    sess = ort.InferenceSession(C.onnx_path(MODEL, RUNTIME.split("-")[1]), so, providers=["CPUExecutionProvider"])
    providers = sess.get_providers()
    assert providers == ["CPUExecutionProvider"], providers
    pad_id = tok.token_to_id("[PAD]") if tok.token_to_id("[PAD]") is not None else tok.token_to_id("<pad>")

    def embed(batch_texts):
        out = []
        for b in range(0, len(batch_texts), BATCH):
            encs = tok.encode_batch(batch_texts[b:b + BATCH])
            L = max(len(e.ids) for e in encs)
            ids = np.full((len(encs), L), pad_id, dtype=np.int64)
            mask = np.zeros((len(encs), L), dtype=np.int64)
            for i, e in enumerate(encs):
                ids[i, :len(e.ids)] = e.ids
                mask[i, :len(e.ids)] = 1
            h = sess.run(None, {"input_ids": ids, "attention_mask": mask, "token_type_ids": np.zeros_like(ids)})[0]
            if cfg["pooling"] == "cls":
                v = h[:, 0]
            else:
                m = mask[..., None].astype(np.float32)
                v = (h * m).sum(1) / m.sum(1)
            out.append(v / np.linalg.norm(v, axis=1, keepdims=True))
        return np.concatenate(out)

    def ntokens(t):
        return [len(e.ids) for e in tok.encode_batch(t)]

t_load = time.perf_counter()
rss_loaded = rss_mb()
embed(texts[:BATCH])  # first batch: lazy init, kernel selection
t_first = time.perf_counter()

# The timed chunk: tokenize for lengths, sort, embed, restore order.
t1 = time.perf_counter()
order = np.argsort(ntokens(texts))
emb = embed([texts[i] for i in order])
vecs = np.empty_like(emb)
vecs[order] = emb
t2 = time.perf_counter()

if OUT:
    np.save(OUT, vecs.astype(np.float32))
print(json.dumps({
    "model": MODEL, "runtime": RUNTIME, "threads": THREADS, "providers": providers,
    "n": len(texts), "seconds": round(t2 - t1, 3), "titles_per_s": round(len(texts) / (t2 - t1), 2),
    "cold_start_s": {"import": round(t_import - t_data, 3), "load": round(t_load - t_import, 3),
                     "first_batch": round(t_first - t_load, 3), "total_to_ready": round(t_first - T0, 3)},
    "rss_after_load_mb": round(rss_loaded), "peak_rss_mb": round(peak_mb()),
}), flush=True)
