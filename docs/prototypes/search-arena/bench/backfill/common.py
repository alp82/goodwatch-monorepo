"""Shared setup for the CPU backfill benchmark: models, text preparation, the 2,000-title sample.

Text preparation matches the stored catalog embeddings exactly:
- bge-base-en-v1.5: harness/embed_notitle.py `text_without_title` (the `bgeb-notitle` vectors), no passage prefix.
- multilingual-e5-small: scripts/embed_catalog.py `embedding_text` (title included), prefix "passage: ".
Both: max_seq_length 512 with truncation, L2-normalized output.
"""
import json, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ARENA = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(ARENA, "data")
MODELS_DIR = os.path.join(HERE, "models")
sys.path.insert(0, os.path.join(ARENA, "scripts"))
sys.path.insert(0, os.path.join(ARENA, "harness"))

SAMPLE_N = 2000
SEED = 20260924
MAX_LEN = 512

MODELS = {
    "bge-base-en-v1.5": dict(hf="BAAI/bge-base-en-v1.5", prefix="", pooling="cls", notitle=True,
                             stored="emb-bge-base-en-v1.5-notitle.npy", dim=768),
    "multilingual-e5-small": dict(hf="intfloat/multilingual-e5-small", prefix="passage: ", pooling="mean",
                                  notitle=False, stored="emb-multilingual-e5-small.npy", dim=384),
}


def sample_rows():
    """Uniform random 2,000 catalog row indices (fixed seed), in catalog order."""
    import embed_catalog as ec
    rows = ec.load_catalog()
    ids = json.load(open(os.path.join(DATA, "emb-ids.json")))
    assert len(ids) == len(rows) and ids[0] == rows[0]["id"] and ids[-1] == rows[-1]["id"], "emb-ids.json out of order"
    idx = np.sort(np.random.default_rng(SEED).choice(len(rows), SAMPLE_N, replace=False))
    return rows, idx


def texts_for(model, rows, idx=None):
    import embed_catalog as ec
    from embed_notitle import text_without_title
    cfg = MODELS[model]
    fn = text_without_title if cfg["notitle"] else ec.embedding_text
    sel = rows if idx is None else [rows[i] for i in idx]
    return [cfg["prefix"] + fn(r) for r in sel]


def sample_path(model):
    return os.path.join(HERE, "cache", f"sample-{model}.json")


def onnx_path(model, precision):
    return os.path.join(MODELS_DIR, model, f"model-{precision}.onnx")
