"""Subject-matter embeddings for every catalog row, one .npy per model (float16, L2-normalized).

Usage: .venv/bin/python scripts/embed_catalog.py [model ...]
"""
import gzip, json, os, sys, time
import numpy as np

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(HERE, "data")

MODELS = {
    "bge-small-en-v1.5": dict(hf="BAAI/bge-small-en-v1.5", query="Represent this sentence for searching relevant passages: ", passage=""),
    "e5-small-v2": dict(hf="intfloat/e5-small-v2", query="query: ", passage="passage: "),
    "bge-base-en-v1.5": dict(hf="BAAI/bge-base-en-v1.5", query="Represent this sentence for searching relevant passages: ", passage=""),
    "multilingual-e5-small": dict(hf="intfloat/multilingual-e5-small", query="query: ", passage="passage: "),
}
MAX_KEYWORDS = 25
MAX_TROPES = 15


def embedding_text(r):
    head = r["title"] or r.get("original_title") or ""
    if r.get("year"):
        head += f" ({r['year']})"
    parts = [head]
    if r["genres"]:
        parts.append(", ".join(r["genres"]))
    if r["essence_tags"]:
        parts.append(", ".join(r["essence_tags"]))
    # Titles without an essence fall back to the (600-char) synopsis so they still say what they are about.
    body = r.get("essence_text") or r.get("synopsis")
    if body:
        parts.append(body.strip())
    if r["keywords"]:
        parts.append("Keywords: " + ", ".join(r["keywords"][:MAX_KEYWORDS]))
    if r["tropes"]:
        parts.append("Tropes: " + ", ".join(r["tropes"][:MAX_TROPES]))
    return ". ".join(p.rstrip(". ") for p in parts if p) + "."


def load_catalog():
    return [json.loads(l) for l in gzip.open(os.path.join(DATA, "catalog.jsonl.gz"), "rt", encoding="utf-8")]


def main(names):
    import torch
    from sentence_transformers import SentenceTransformer
    rows = load_catalog()
    texts = [embedding_text(r) for r in rows]
    json.dump([r["id"] for r in rows], open(os.path.join(DATA, "emb-ids.json"), "w"))
    for name in names:
        cfg = MODELS[name]
        model = SentenceTransformer(cfg["hf"], device="cuda", model_kwargs={"torch_dtype": torch.float16})
        model.max_seq_length = 512
        # Sort by length so batches pad little, then restore catalog order.
        order = np.argsort([len(t) for t in texts])
        t0 = time.time()
        emb = model.encode([cfg["passage"] + texts[i] for i in order], batch_size=256, normalize_embeddings=True,
                           convert_to_numpy=True, show_progress_bar=False)
        out = np.empty_like(emb)
        out[order] = emb
        np.save(os.path.join(DATA, f"emb-{name}.npy"), out.astype(np.float16))
        print(f"{name}: {out.shape} in {time.time() - t0:.0f}s", flush=True)
        del model
        torch.cuda.empty_cache()


if __name__ == "__main__":
    main(sys.argv[1:] or list(MODELS))
