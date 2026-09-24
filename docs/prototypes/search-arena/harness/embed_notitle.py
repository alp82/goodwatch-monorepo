"""e5-small-v2 catalog embeddings without the title in the passage text (ranker R2c).

Same text as scripts/embed_catalog.py, minus the "{title}" head; the year stays.
Writes data/emb-e5-small-v2-notitle.npy (float16, L2-normalized, catalog row order).

Usage: .venv/bin/python harness/embed_notitle.py
"""
import os, sys, time
import numpy as np

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(HERE, "scripts"))
import embed_catalog as ec  # noqa: E402


def text_without_title(r):
    r = dict(r)
    r["title"] = ""
    r["original_title"] = ""
    t = ec.embedding_text(r)
    # embedding_text() renders " (1988)" as the head when the title is empty.
    return t.lstrip()


def main():
    import torch
    from sentence_transformers import SentenceTransformer
    rows = ec.load_catalog()
    texts = [text_without_title(r) for r in rows]
    print(texts[0][:200])
    cfg = ec.MODELS["e5-small-v2"]
    model = SentenceTransformer(cfg["hf"], device="cuda", model_kwargs={"torch_dtype": torch.float16})
    model.max_seq_length = 512
    order = np.argsort([len(t) for t in texts])
    t0 = time.time()
    emb = model.encode([cfg["passage"] + texts[i] for i in order], batch_size=256, normalize_embeddings=True,
                       convert_to_numpy=True, show_progress_bar=False)
    out = np.empty_like(emb)
    out[order] = emb
    np.save(os.path.join(ec.DATA, "emb-e5-small-v2-notitle.npy"), out.astype(np.float16))
    print(f"e5-small-v2-notitle: {out.shape} in {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
