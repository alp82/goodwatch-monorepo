---
status: proposed
---

# Bring back text embeddings for search, as local models

Search ranking uses two local text embedding models again, alongside the fingerprint. Titles are embedded with
`BAAI/bge-base-en-v1.5` (768 dimensions, the title's text without its title) and `intfloat/multilingual-e5-small`
(384 dimensions). Queries are embedded on the webapp's CPU. Qdrant also stores a BM25F keyword vector per title.

This reverses part of the [text embedding removal](../text-embedding-removal.md) of September 14, 2026. That removal
retired paid API embeddings whose results were poor while production queries used only the fingerprint. The search
arena measured the opposite for the new ranker: dense text similarity is its second-largest signal (weight 0.4), and
the ranker built on it beats production and the earlier prototypes on every graded split.

Evidence:
- [Simplified ranker walkthrough](../prototypes/search-arena/results/simplify/HOW-IT-WORKS.md), September 24, 2026.
- [Search ranking implementation](../implementation/search-ranking/README.md), which covers the performance benchmark.

## Choices

- **Local models, no paid calls.** Query encoding costs CPU time only. Embedding the whole catalog on a CPU worker takes
  a few hours once, and about 20 seconds per day after that.
- **Full precision (fp32) for encoding, float16 for storage.** Int8 models are 2 to 3 times faster, but they change 12
  to 19% of each query's nearest titles, both at query time and in the catalog. Float16 storage loses nothing, because
  the source vectors are float16.
- **Named vectors on the existing collection.** Qdrant 1.19 can add a named vector to an existing collection, so
  `media_fingerprint_v1` keeps its name and points.

## Consequences

- The model names, text preparation and vector names form one contract between Windmill and the webapp. Changing any of
  them means re-embedding the catalog and releasing both sides together.
- Every Qdrant writer must keep vectors it doesn't own. An upsert replaces the whole point, so writers switch from
  upserts to inserts (`insert_only`) and vector updates (`update_vectors`).
- The webapp process grows by about 1.35 GB for the two query models.
