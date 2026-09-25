"""Check that the worker's embeddings match the stored search vectors.

Samples titles whose input hash still equals the one recorded when they were embedded,
embeds them again with f/search/text_encoder and compares the result with the stored
`text_en_v1`, `text_multi_v1` and `terms_bm25f_v1`. Dense vectors should reach cosine 1.0
(0.99999 or more) and every sparse vector should be equal. It writes nothing.

Run it as a Windmill preview job on the `highperf` tag, with a path under `f/` (for
example `f/search/parity_check`), because it imports the `f.*` modules and uses the
workspace's Qdrant and Crate credentials. It isn't deployed. Use it after a change to the
models, the runtime or the text preparation, and after a full run.

First run on 2026-09-24 (preview job 01a0d57c-772f-d6dc-80d5-ef095bfe34ca, 250 titles):
text_en_v1 cosine min 0.9999993, text_multi_v1 min 0.9999996, terms_bm25f_v1 equal for 250.
"""

import socket, time
import numpy as np
from f.db.cratedb import CrateConnector
from f.db.qdrant import QdrantConnector
from f.search import embed_titles as flow
from f.search import terms as bm25f
from f.search.text_encoder import BGE_BASE_EN, MULTILINGUAL_E5_SMALL, encode
from f.search.title_text import english_text, input_hash, multilingual_text, term_fields, title_inputs
from f.sync.models.qdrant_schemas import MEDIA_COLLECTION, TERMS_BM25F_VECTOR, TEXT_EN_VECTOR, TEXT_MULTI_VECTOR


def main(n: int = 250):
    """Embed `n` unchanged titles on this worker and compare them with the stored vectors."""
    t0 = time.monotonic()
    crate = CrateConnector()
    client = QdrantConnector(timeout=60).client
    sample = crate.select("SELECT point_id, input_hash, embedded_at FROM search_embedding_inputs ORDER BY random() LIMIT ?", (4 * n,))
    ids = [r["point_id"] for r in sample]
    stored_hash = {r["point_id"]: r["input_hash"] for r in sample}
    payloads = flow.fetch_payloads(client, ids)
    rows = flow.fetch_crate_rows(crate, ids)
    inputs = {}
    for pid in ids:
        if pid in payloads and pid in rows:
            item = title_inputs(payloads[pid], rows[pid])
            if input_hash(item) == stored_hash[pid]:
                inputs[pid] = item
    chosen = sorted(inputs)[:n]
    t1 = time.monotonic()
    en = encode(BGE_BASE_EN, [english_text(inputs[p]) for p in chosen])
    t2 = time.monotonic()
    mu = encode(MULTILINGUAL_E5_SMALL, [multilingual_text(inputs[p]) for p in chosen])
    t3 = time.monotonic()
    vocabulary = flow.TermVocabulary(crate)
    weights = {p: bm25f.document_weights(term_fields(inputs[p])) for p in chosen}
    vocabulary._lookup(sorted({t for w in weights.values() for t in w}))
    stored = {int(r.id): r.vector for r in client.retrieve(MEDIA_COLLECTION, chosen, with_vectors=list(flow.TEXT_VECTORS))}
    cos_en, cos_mu, sparse_equal = [], [], 0
    for i, p in enumerate(chosen):
        s = stored[p]
        a = np.asarray(s[TEXT_EN_VECTOR], np.float64); b = np.asarray(s[TEXT_MULTI_VECTOR], np.float64)
        cos_en.append(float(en[i] @ a / np.linalg.norm(a)))
        cos_mu.append(float(mu[i] @ b / np.linalg.norm(b)))
        mine = flow.sparse_vector(weights[p], vocabulary.ids)
        sv = s[TERMS_BM25F_VECTOR]
        sparse_equal += list(sv.indices) == mine.indices and np.array_equal(np.float32(sv.values), np.float32(mine.values))
    crate.disconnect()
    return {
        "host": socket.gethostname(), "titles": len(chosen),
        "text_en_v1_cos": {"min": min(cos_en), "p1": float(np.percentile(cos_en, 1)), "mean": float(np.mean(cos_en))},
        "text_multi_v1_cos": {"min": min(cos_mu), "p1": float(np.percentile(cos_mu, 1)), "mean": float(np.mean(cos_mu))},
        "terms_bm25f_v1_equal": sparse_equal,
        "seconds": {"read": round(t1 - t0, 1), "bge_base_en": round(t2 - t1, 1), "multilingual_e5": round(t3 - t2, 1),
                    "total": round(time.monotonic() - t0, 1)},
    }
