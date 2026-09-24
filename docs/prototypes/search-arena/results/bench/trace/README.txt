STORE ACCESS TRACE OF combo-safe-v3
===================================

What this is
  The data the ranker simp_combo.FINAL["combo-safe-v3"] reads for each of the 168 queries in queries.json, as a
  store-agnostic plan: what it reads, in which order, and what each read depends on. The replay benchmark runs the
  plan against Qdrant and Crate. The Jev reading, the TMDB title lookup and the query embeddings come from the
  harness caches.

  The trace records what the ranker actually does. The ranker code is not changed: bench/trace/instrument.py wraps
  it at runtime. Check: the traced run and an unwrapped run give identical top-50 lists and scores on all 168
  queries. The top-10 lists also match results/simplify/lists/combo-safe-v3.json on all 138 queries that file has.

  Regenerate with .venv/bin/python bench/trace/run_trace.py [--reps=3]. It takes about 5 minutes.

Files
  trace.jsonl    one JSON object per query, in queries.json order
  vectors.json   {query id: {vector id: base64 float32 little-endian}}: every query vector an operation uses
  summary.json   distributions by query path, verification results, in-memory table sizes, restructuring estimates

One query (trace.jsonl)
  id, query, text, type, split    from queries.json and the capture
  path                            "reference": a person, studio or "like X" reference was found;
                                  "non_english": no reference, and the query is non-English (production's flag or
                                  the stopword check);
                                  "general": everything else
  non_english                     true when the query took the multilingual path (a reference query can be too)
  reference                       null, or {kind: entity|title, intent, residual, negated, n_seeds,
                                  n_weighted_titles, entities}
  filter                          the filter every top-k runs under, "F" in the operations:
                                  {min_votes: 2000, adult: false, media_type, required: [flag ids],
                                   excluded: [flag ids or "media_type:x" / "production_method:x"],
                                   year_range: [lo, hi] or null, n_rows, verified}
                                  Flag ids are Qdrant payload booleans. verified = the filter rebuilds the
                                  ranker's mask exactly.
  encodes                         query-side encodes: {id, model, hf_model, prefix, text, role, dim, repeat}.
                                  The model input is prefix + text. id is also the vector id in vectors.json.
                                  role says what the vector is for (dense:query, facet, coverage unit: dense,
                                  negation: dense, dense:english chips, negation:english chips, intent). repeat =
                                  the same (model, text) was already encoded for this query.
  vectors                         {vector id: {kind, dim, ...}}. kind is one of:
                                  encode;
                                  jev_weights (the 74 Jev weights, v0);
                                  centroid (the vote-weighted centroid of the reference seeds, computed in the
                                  webapp from fetched seed vectors).
                                  The values are in vectors.json.
  id_lists                        {name: [point ids]}. Common names:
                                  "seeds": the reference seed titles;
                                  "pool": the candidate pool;
                                  "display": the returned top 50.
                                  An operation's ids field names one of these lists.
  ops                             the operations, sorted by seq (the order the ranker needs them)
  stages                          [{stage, ops: [op ids]}]. Operations in one stage have no dependencies on each
                                  other, so they can run concurrently. The last stage is the display fetch.
  n_store_stages                  sequential store stages, without the external title lookup and the display fetch
  n_store_stages_if_profiles_precomputed
                                  the same count if reference profiles were precomputed (no seed fetches)
  n_store_ops, op_kinds           count of store operations (same exclusions) and the count per kind
  n_round_trips_batched           number of requests if each stage sends one batched request per store
                                  (Qdrant query batch, one Crate statement)
  pool_size, pool_lists           the pool size, and the top-k lists (by role) and in-memory sources that fed it
  tables                          in-memory tables the query touched (sizes in summary.json)
  timing_ms                       median over the reps, in milliseconds:
                                  wall_uninstrumented: rank() with no wrapping;
                                  store_emulated: time in the local numpy stand-ins for store reads;
                                  encode_cached: time in query-vector cache lookups;
                                  recorder_overhead: time spent writing the trace;
                                  memory = wall_instrumented - store_emulated - encode_cached - recorder_overhead.
                                  memory is the compute that stays in the webapp, measured in Python with warm
                                  caches.
                                  memory_parts_inclusive: a breakdown by function. The parts are inclusive and can
                                  overlap.
  top10                           the ranker's top 10 point ids, for checking a replay

Operations (ops[])
  Common fields:
    id                    op id
    seq                   the order the ranker issued it in
    kind                  the operation type (listed below)
    store                 qdrant, crate, "qdrant|crate" (either can serve it) or external
    role                  what the operation is for
    deps                  op ids that must finish first
    encodes               encode ids whose vectors this operation needs
    stage                 1 + the highest stage among deps
  Top-k fields:
    k                     the list length
    filter                "F", the query's filter
    n_filter_rows         the number of titles the filter keeps
    n_returned            the number of results the ranker got
    n_positive            how many of those scored above 0
    positive_only         only hits scoring above 0 join the pool
  Score-ids fields:
    ids                   "pool"
    n_ids                 the number of ids to score
    n_ids_outside_own_topk
                          pool ids missing from this signal's own top-k list

  kinds
    fp_topk / fp_score_ids
        vector_set fingerprint_raw (dim 74, dot): production's weighted sum, the raw 0..10 fingerprint scores
        times the Jev weights (vector v0; weights can be negative). The bench collections do not have this vector
        yet: add a raw-score Dot named vector in Qdrant, or use ORDER BY over Crate's fps array.
        vector_set fingerprint_v1 (dim 74, cosine): the reference's fingerprint centroid.
    dense_topk / dense_score_ids
        vector_set text_en (bge-base-en-v1.5 over the text without the title, dim 768) or text_multi
        (multilingual-e5-small, dim 384), both cosine over L2-normalized vectors. vector = an encode or a
        centroid id.
    dense_mix_topk
        Non-English queries only (12 of them). The dense signal is (1-w) z(cos text_multi) + w z(cos text_en).
        Each z uses the mean and standard deviation over EVERY filtered title, and the top k is taken on the
        mixed score. This is a full scan of both vector sets under the filter, not a native top-k. parts lists
        the two vectors. Scoring the pool then needs one dense_score_ids per part, plus the scan's mean and
        standard deviation.
    bm25_topk / bm25_score_ids
        BM25F over the body fields tags 2, keywords 2, tropes 1 and essence 1 (fields). The formula is
        harness/sparse.py: score = sum over terms of qw * w(t, d). terms = [[term, qw]] with stemmed unigrams and
        bigrams ("tense_heist").
        text queries (main query, coverage units, mentions): qw = IDF.
        the term profile (role profile:terms): qw = share of seeds holding the term x IDF.
        bm25_topk scores are used only for their hits (0 elsewhere). So the main and coverage-unit BM25 signals
        need no score_ids. Only the reference profile (terms, mention) scores the pool.
    fetch_vectors
        get the vectors of ids "seeds" from vector_set (fingerprint_v1 and text_en). The webapp builds the
        log-vote-weighted centroid from them.
    fetch_terms
        get the BM25F term vectors of the seeds (the doc rows of the body-field index). The webapp builds the
        term profile with its in-memory IDF.
    title_lookup
        external (TMDB) and captured. Its rows go into the title blend. No dependencies.
    fetch_payload
        display: true. Fetches the returned list for rendering after ranking; the ranker itself does not need it.
        This is not counted in n_store_stages or n_store_ops.

  Not store reads (in-memory, from tables in summary.json):
    the name index, credits, studios, peer centroids (peers join the pool once the fingerprint_v1 seeds are
    fetched), label negation, spell correction, collocations, the intent examples, alternate cuts, the title
    blend, the own-title bounds, and the per-title priors (votes, GoodWatch score, year, from title_table).

Stage shapes (all 168 queries)
  general       stage 1: every top-k at once (fp, dense, bm25, facets, coverage units);
                stage 2: score_ids for the pool
  non_english   stage 1: top-k lists, including a dense_mix_topk full scan;
                stage 2: score_ids
  reference     stage 1: top-k lists, seed fetches (vectors, terms), mention bm25;
                stage 2: centroid and term-profile top-k;
                stage 3: score_ids

Caveats
  - top-k ties: the ranker's top() uses argpartition. A store may break ties at the k boundary differently, so the
    pool can differ by a title or two.
  - Stored query vectors are the cached vectors the ranker used (rounded to 6 decimals). A fresh encode
    differs slightly.
  - memory time is Python/numpy. It includes full-catalog-length bookkeeping (masks, np.zeros over 191k rows)
    that a store-backed port would not do. It does not include the Jev reading.
