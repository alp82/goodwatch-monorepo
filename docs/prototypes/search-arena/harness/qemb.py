"""Query embeddings, cached per model in data/query-emb-<model>.json ({text: [floats]}).

Models run on the CPU (the app server has no GPU); the cache makes repeat runs free.
"""
import json, os

import numpy as np

import catalog as C

_models, _cache = {}, {}


def _path(hf):
    return os.path.join(C.DATA, f"query-emb-{hf.split('/')[-1]}.json")


def embed(emb_name, text):
    """L2-normalized query vector for the catalog embedding `emb_name` (a key of C.EMBEDDINGS)."""
    _, hf, prefix = C.EMBEDDINGS[emb_name]
    if hf not in _cache:
        p = _path(hf)
        _cache[hf] = json.load(open(p)) if os.path.exists(p) else {}
    cache = _cache[hf]
    if text not in cache:
        if hf not in _models:
            os.environ.setdefault("HF_HUB_OFFLINE", "1")
            from sentence_transformers import SentenceTransformer
            _models[hf] = SentenceTransformer(hf, device="cpu")
        v = _models[hf].encode([prefix + text], normalize_embeddings=True)[0]
        cache[text] = [round(float(x), 6) for x in v]
        json.dump(cache, open(_path(hf), "w"))
    return np.array(cache[text], np.float32)
