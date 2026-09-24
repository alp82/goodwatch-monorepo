# r3-combo-fast latency on a local Qdrant (2026-09-23)

I ran r3-combo-fast end to end against a local Qdrant 1.19.1 in Docker, using the captured Jev readings, for the 69 queries
that have an offline list. Nothing touched production. Timings are per-query medians over 5 repetitions. The
tables give p50 / p95 / max across queries, in ms, for everything after the reading.

Scripts: `harness/live_build.py` (builds the collection), `harness/live_bench.py` (fidelity and stage timings,
raw output in `latency-live-arena_50k.json` and `latency-live-arena_191k.json`) and `harness/live_replay.mjs` (the
same Qdrant request bodies sent from Node fetch).

Machine: Ryzen 9 9950X3D. The ONNX embedding used 4 threads, and Qdrant had all 32 cores. Another session loaded
the machine during part of the runs. Every number below comes from a quiet window (load below 4) unless marked otherwise.

## Collection

The collection has these vectors and payload:
- Named vectors:
  - `bge`: 768 dimensions, cosine, int8 scalar quantization always in RAM.
  - `me5s`: 384 dimensions, cosine, int8. Non-English queries use it.
  - `fingerprint_v1`: 74 dimensions, cosine.
  - `fp_raw`: 74 dimensions, dot product, raw 0–10 scores. Its dot product with the query weights is exactly the
    weighted sum.
- Sparse vector `lex`: `modifier: idf`. Document values are the saturated BM25F weights from `sparse.py`, and the
  term index is `crc32(term)`. There are 85 hash collisions in a vocabulary of 892k terms (471 in 2.0M at 191k).
- Payload: votes, year, media_type, production_method, the boolean flags, goodwatch_score and fingerprint_scores. The
  filter fields are indexed.

| | 50,305 eligible | 191,634 (all) |
|---|---|---|
| disk | 637 MB | 2.0 GB |
| largest parts | bge 185 MB (int8 part 38 MB), sparse 81 MB + 101 MB index, me5s 93 MB, payload 69 MB | bge 703, me5s 352, sparse 196 + 231, payload 261 MB |
| Qdrant RSS after restart | about 1.2 GB (0.8 GB anonymous) | about +1.7 GB |
| upload to green | 65 s | 302 s (under load) |

The footprint can come down in three ways: put the original vectors on disk and keep only int8 in RAM, drop the
`fingerprint_scores` payload if the fingerprint stays in process, and drop `me5s` if non-English queries move to bge.

## Fidelity: top-10 overlap with the offline r3-combo-fast list

**Harness bug:** `rankers3._floor` does nothing. It uses `np.minimum`, so every score below the k-th is left
unchanged. The offline r3-combo-fast therefore scored every candidate exactly, and its "one Qdrant request" truncation
was never really tested. With a real floor (a title outside a list gets that list's k-th score), dev full ndcg10 drops
from 0.828 to 0.668, with 78 unjudged titles in the top 10 (proxy ndcg 0.779). Deeper lists (dense 1000, facet and
negation 500) only recover this to 0.699.

"Cached" uses the harness's fp32 query vectors, so it tests only the Qdrant path. "ONNX" uses the live int8 model.

| variant | cached | ONNX int8 | ONNX fp32 |
|---|---|---|---|
| 1req-floor: one batch, lists only | 5.72 | 5.61 | |
| **1req-localvec**: one batch for the candidate lists; exact candidate scores from in-process matrices | **9.93** (65/69 identical sets) | 9.42 | 9.93 |
| 2req-qdrant: stateless; request 2 fetches exact scores (`has_id`) and the prior payload | 9.88 | 9.39 | |
| 1req-localvec on the 191k collection | | 9.23 | |

What the table shows:
- The Qdrant path reproduces the harness when candidate scores are exact. The small remaining gap comes from HNSW
  approximation, the non-English z-mix and ties.
- int8 query embedding costs about 0.5 of overlap. fp32 ONNX restores it, but takes about 2× the embedding time.
- At 191k, Qdrant's IDF and BM25 length norms span the whole collection, which shifts the sparse scores (9.23).
- The `fp_raw` search needs `exact: true`. HNSW on a dot product with negative weights missed titles: "tense but not
  bleak" came out at 5/10. The exact scan costs about 2 ms server time.

## Latency (50k, ONNX int8, local)

| stage | 1req-localvec | 2req-qdrant |
|---|---|---|
| prep (spell, negation, era, facets, sparse terms, filter) | 0.1 / 0.5 / 0.7 | 0.1 / 0.5 / 0.7 |
| embed (3–11 texts, batched per model) | 5.5 / 14.1 / 20.7 | 5.7 / 17.0 / 45.2* |
| Qdrant request 1, client time (server time) | 5.5 / 9.2 / 53.6 (2.8 / 5.4 / 8.6) | 8.7 / 13.4 / 53.6 (5.3 / 8.1 / 10.0) |
| in-process fingerprint scan (50k × 74, filter + top 500) | 0.7 / 0.8 / 0.9 | – |
| Qdrant request 2 (server time) | – | 21.1 / 68.4 / 76.1 (11.9 / 16.9 / 22.4) |
| fuse (incl. candidate scoring) | 1.5 / 8.3 / 8.4 | 1.5 / 2.2 / 2.5 |
| blend + fuzzy title | 2.9 / 4.9 / 5.1 | 2.9 / 5.1 / 9.5 |
| **total** | **14.9 / 35.6 / 86.3** | 39.6 / 99.7 / 150.6 |
| response bytes | 62 / 106 / 150 KB | request 1: 88 / 130 / 175 KB; request 2: 271 / 545 / 841 KB |

`*` A load spike hit during this run.

- On 191k, 1req-localvec is 16.3 / 36.3 / 88.0 (Qdrant server time 3.5 / 7.3 / 10.6). Scaling costs little.
- The p95 fuse time (8 ms) comes from the non-English queries. Their z-mix scans all 50k bge and me5s rows, as the
  harness does.
- Node fetch replay of the same bodies:
  - Request 1: 3.7 / 6.0 / 51.1 ms.
  - Request 2: 15.3 / 59.6 / 62.1 ms.
- **The about-50 ms maximum is a TCP stall, not Qdrant.** It shows up on keep-alive connections at some payload
  sizes (core-27: 157 KB request, 150 KB response; most request-2 responses) in both Python and Node, and never on a
  fresh curl connection. It looks like delayed-ACK/Nagle on large keep-alive payloads, which production would see
  too. Options: smaller payloads (fewer searches, round the vectors, no scores for request 2), gRPC, or a fresh or
  pooled connection per search.
- The `formula` fingerprint (sum of w·`fingerprint_scores.k` over a 2,000-point `fingerprint_v1` prefetch, production's
  pool shape) fits in the same batch. It costs 126 / 242 / 292 ms of server time (quiet run), because it reads payload
  for 2,000 points, and it is approximate. Use `fp_raw` or the in-process scan instead.

## Production estimate (1req-localvec)

Embedding and CPU stages ×2–3 for the app server, Qdrant server time ×2–3, plus 1–3 ms LAN and about 1 ms per 100 KB:

| | p50 | p95 |
|---|---|---|
| embed | 11–17 | 28–42 |
| Qdrant batch | 8–14 | 15–22 |
| fingerprint + fuse + blend + prep | 10–15 | 30–45 |
| **after the reading** | **about 30–45 ms** | **about 75–100 ms** (+40 ms if the TCP stall is not fixed) |

This matches round 3's 52 ms estimate and is well under production's about 235 ms. 2req-qdrant would be about 70–90 ms
at p50 and 150 ms or more at p95.

## Design issues

1. Exact candidate scores are needed, which a single lists-only request cannot give. Two ways to get them:
   - Keep the eligible embeddings in the service: bge int8 is 38 MB, me5s int8 19 MB, fingerprints 15 MB (fp32 here,
     int8 not yet tested for fidelity). This keeps one Qdrant request.
   - Make a second request with `has_id`. It adds 15–20 ms and returns large responses.
2. The fingerprint and dense+sparse retrieval can be one request (`fp_raw` dot with `exact: true`). The formula query
   works but is about 50× slower. With in-process fingerprints the scan takes 0.7 ms and can run in parallel with the
   Qdrant call.
3. Non-English queries need `me5s` as well (or a switch to bge on English chips only), and their mix needs statistics
   over the whole catalog. Those are only available in process.
4. At 50k, a brute-force dense scan in process takes a few ms. Qdrant earns its place mainly through the sparse index
   and filtered retrieval.
5. Not measured: the display rows (Crate or Qdrant retrieve) and the TMDB title lookup. Both run outside this path.
