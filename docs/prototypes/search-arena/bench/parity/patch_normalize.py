"""export_prototype.py --patch: L2-normalize the stored title embeddings, as Qdrant's Cosine distance does.

The arena's stored text embeddings have norms between 0.9995 and 1.0005 (float16 precision), and the prototype scores
the dot product without normalizing them. Qdrant normalizes every vector of a Cosine vector at write time, so the
port's cosines differ from the prototype's by up to about 3e-4. This patch removes that difference.
"""
import numpy as np


def apply(M):
    C = M.C
    load = C.embeddings

    def normalized(name):
        key = ("normalized", name)
        if key not in _cache:
            E = load(name).astype(np.float32)
            _cache[key] = (E / np.linalg.norm(E, axis=1, keepdims=True).clip(1e-12)).astype(np.float32)
        return _cache[key]
    C.embeddings = normalized


_cache = {}
