# Search ranking implementation

This spec describes how to replace production's search ranking with the simplified ranker from the search arena, and
which Windmill changes it needs. The ranker to port is `FINAL["combo-safe-v3"]` in
[`simp_combo.py`](../../prototypes/search-arena/harness/simp_combo.py). The
[walkthrough](../../prototypes/search-arena/results/simplify/HOW-IT-WORKS.md) explains how it works.

Status: draft for review, September 24, 2026. The owner approved the [ticket breakdown](#ticket-breakdown) the same
day. No issues are created yet.

## What changes for users

| | Production today | Simplified ranker |
|---|---|---|
| NDCG@10, holdout5 (blind) | see the arena log | .794 (r6: .764) |
| NDCG@10, dev / holdout / holdout2 / holdout3 / holdout4 | see the arena log | .827 / .780 / .754 / .911 / .872 |
| Grade-0 titles in the top 5, all splits | see the arena log | 40 (r6: 62) |
| Paid calls per search | the Jev reading | the same Jev reading, nothing more |
| Median search time, cached reading | 688 ms | an estimated 690 to 840 ms |
| Median search time, fresh reading | 1,750 ms | an estimated 1,750 to 1,900 ms |

The search times are estimates from the [benchmark](#performance-benchmark). They are ranges because production
doesn't record how long its own retrieval takes.

## Decisions

The owner made these decisions on September 24, 2026:

1. **Bring back text embeddings** as local models. See [ADR 0002](../../adr/0002-local-text-embeddings-for-search.md).
2. **Port the ranker to TypeScript in the webapp.** Windmill does only offline work: embedding titles and building
   indexes. Windmill doesn't answer searches. Each search would wait in the job queue, a normal job would reload the
   models each time, and workers that stay loaded between jobs are an Enterprise feature. This instance runs the
   Community Edition (v1.803.0).
3. **Keep the data in Qdrant.** Per-title vectors live in the existing Qdrant collection. Small derived tables are
   built by Windmill, stored in Crate, and cached in webapp memory. No GPU is needed.

The owner also confirmed two smaller choices the same day: the search indexes go into a Crate blob table, and the
first embedding starts from the prototype's stored vectors.

## Architecture

```
Windmill (offline)                             Webapp (per search)
------------------                             -------------------
embed titles (new) ──> Qdrant named vectors ─┐ Jev reading (unchanged)
fingerprint publish ─> fingerprint vectors ──┤   │
build search indexes (new)                   │   v
   ├─> Qdrant reference profiles ────────────┼─> encoder worker (2 local models)
   └─> Crate artifact tables ──> loaded ─────┼─> ranker (in-memory tables)
                                  at start   └─> Qdrant: 2 or 3 batched requests
                                                 Crate: display fields and title lookup (as today)
```

### Qdrant

The collection `media_fingerprint_v1` keeps its name and points, and gains these named vectors:

| vector | size | distance | written by | search mode |
|---|---|---|---|---|
| `fingerprint_v1` (existing) | 74 | Cosine | fingerprint publish | HNSW |
| `fingerprint_v1_raw` | 74, raw 0-10 scores | Dot | fingerprint publish | exact |
| `text_en_v1` | 768, bge-base-en-v1.5, text without title | Cosine, float16 | embed titles | HNSW |
| `text_multi_v1` | 384, multilingual-e5-small, text with title | Cosine, float16 | embed titles | HNSW |
| `terms_bm25f_v1` | sparse, the ranker's own BM25F document weights | Dot | embed titles | sparse index |

- **`fingerprint_v1_raw`** carries the Jev weighted sum, whose weights can be negative. Approximate search lost results on
  it (recall 0.55 on one query), and exact search is faster.
- **`terms_bm25f_v1`** holds each title's saturated, field-weighted term frequencies from the prototype's tokenizer. The
  webapp sends IDF times the query term weight, so the dot product equals the prototype's BM25F score exactly. Crate's
  `MATCH` recalled only 39 to 92% of the prototype's lists, so it doesn't replace BM25F. Qdrant's built-in IDF
  modifier can't be used either: it counts per shard and counts all titles, not only the eligible ones.
- **A new collection, `search_reference_profiles`**, holds one point per person, studio and team, with fingerprint and
  text centroids and the top 40 profile terms. The ranker reads it with `lookup_from`, which saves one round trip on
  reference queries.

Memory on the Qdrant host grows by about 1.1 GB: 635 MiB of dense vectors, 440 MiB of sparse index, and a small
profile collection. The host has 18.8 GB free. Storing `terms_bm25f_v1` only for eligible titles would cut the sparse
cost by about 59%.

### Crate

Crate leaves the ranking path. It keeps serving the title lookup and display fields as it does today. It gains:

- **`created_by` for shows.** TMDB's `created_by` is never copied to Crate today. The ranker needs it for show creators.
- **A blob table, `search_index_files`,** holding the search indexes the webapp loads at startup, one gzipped file per
  index. The stack has no file storage such as S3, and reading millions of rows through SQL at every startup would be
  slow.
  - **Files never change.** Crate stores each blob under the SHA-1 hash of its content, so a new build writes new files.
    An unchanged index has the same hash and isn't stored again.
  - **One complete build at a time.** A normal table, `search_index_builds`, records each build's files. Its
    current-build row moves only after every file is written, so the webapp never loads a mix of two builds.
  - **At most two builds.** After moving the current-build row, the build job deletes every file that neither the new
    build nor the previous one uses. The previous build stays for rollback and for a webapp still loading it. That
    keeps the table at about 60 to 100 MB, estimated from about 30 to 50 MB per compressed build.
  - **Check access first.** Nobody has used blob tables on this cluster yet. Confirm the webapp can read the blob
    endpoint (`/_blobs/search_index_files/<sha1>`) with its SQL credentials. If it can't, fall back to a normal table
    with one compressed file per row, with the same build record and cleanup.

### Webapp

The webapp loads about 130 MB of tables at startup:

| table | size in memory | used for |
|---|---|---|
| Term statistics (659k terms, document frequency) | 49 MiB | BM25F query weights, spell correction |
| Name index | 9 MB | people, studios, teams, typo matching |
| Credits (main and minor, writer fallback for shows) | 11 MB | own-title boost and bounds |
| People and studios | 15 MB | peers, dominance tests |
| Negation labels | 9 MB | label negation |
| Title table (50,305 eligible titles) | 3 MB | priors, filters, cuts |
| Intent examples, vocabulary, alternate cuts | under 3 MB | intent, spell correction, cut folding |

It also loads the two query models, about 1.35 GB together.

## Performance benchmark

Six agents built a local copy of production with the full catalog and replayed all 168 graded queries through a
TypeScript version of the store calls. The code and results are in `docs/prototypes/search-arena/bench/` and
`docs/prototypes/search-arena/results/bench/`:

| file | contents |
|---|---|
| `infra.json` | production hosts, network delay, Qdrant and Crate load, Windmill workers, today's search times |
| `trace/` | every store read the ranker makes, per query, grouped into rounds |
| `stores.json` | local Qdrant 1.19.1 and Crate 5.10.9 with all 191,634 titles, three storage precisions |
| `encoders.json` | query models in Node: speed, memory, and parity with the prototype |
| `backfill.json` | catalog embedding speed on CPU |
| `replay.json` | end-to-end replay with production network delay, CPU limits and background load |
| `sparse.json` | exact BM25F as Qdrant sparse vectors |

### Results

Ranker time, from the Jev reading to the ranked list, estimated for production processors 2 to 3 times slower than the
benchmark machine:

| | median | slowest 5% |
|---|---|---|
| All queries, one search at a time | 105 to 154 ms | 263 to 392 ms |
| Non-English queries | 281 to 418 ms | 454 to 678 ms |
| Four searches at a time | 205 to 299 ms | 423 to 628 ms |

- **Capacity:** about 13 to 20 searches per second before the slowest 5% pass 1 second. Query encoding is the limit.
- **Retrieval parity:** every store list matches the prototype's exact lists at a recall of 0.986 or higher. BM25F
  through `terms_bm25f_v1` matches exactly.
- **Background load:** production-rate recommendation calls and catalog upserts made no measurable difference locally.
  This doesn't reproduce production's current Qdrant load. See [prerequisites](#prerequisites).

### Design rules the benchmark set

1. **Use full precision for the query models,** 4 threads, in one worker thread with a queue. Int8 failed parity.
   Running encodes at the same time adds no throughput.
2. **Encode in two batches per search, one per model.** `bge-base` encodes only the query and the residual. The
   multilingual model encodes the intent string and the facet phrases. Never send the facet phrases through `bge-base`:
   41 phrases take 161 ms there.
3. **Call Qdrant over plain HTTP with `node:http`,** one `/points/query/batch` request per round. Two problems with
   the alternatives:
   - `@qdrant/js-client-rest` converts every JSON value and costs about 10 ms per batch, against 1.4 ms of Qdrant time.
   - undici and Node's built-in `fetch` stall about 40 ms on Qdrant responses of 1.1 to 5.5 KB.
4. **Search `fingerprint_v1_raw` exactly** (`params.exact: true`).
5. **Handle non-English queries with a union and a rescore.** Take the top 2,000 from each multilingual list, then score
   the union with both vectors in one more request. Merging two short lists with precomputed statistics lost 44% of the
   correct titles.
6. **Precompute reference profiles** into `search_reference_profiles`. Queries about a person, studio or "like X" drop
   from 3 rounds to 2.
7. **Break ties by term** when choosing the top 40 profile terms: sort by weight, then by term. numpy's order for exact
   ties can't be reproduced in TypeScript.

## Windmill changes

### Replace upserts with inserts and updates

Every Qdrant write goes through `upsert_with_retry` in `f/sync/copy/qdrant_retry.py`. An upsert replaces the whole
point, so today's fingerprint publish would delete a title's text vectors. Replace upserts before any text vector
exists.

A test on Qdrant 1.19.1 showed what each write does to a point with a vector that the write leaves out:

| write | existing point | missing point |
|---|---|---|
| `upsert` (today) | replaced: the other vector is deleted, the payload is replaced | created |
| `upsert` with `update_mode: update_only` | replaced: the other vector is deleted | skipped |
| `upsert` with `update_mode: insert_only` | unchanged | created |
| `update_vectors` | only the named vectors change | error 404 |
| `overwrite_payload` | payload replaced, vectors kept | |
| `set_payload` | named keys merged, vectors kept | |

Replace `upsert_with_retry` with two helpers whose names say what they do, and remove plain upserts from the codebase:

- **`insert_points`** uses `upsert` with `update_mode: insert_only`. It creates missing points and never touches
  existing ones.
- **`update_points`** writes each writer's own vectors with `update_vectors` and the payload with `overwrite_payload`,
  the same full payload replacement as today.

Each writer calls `insert_points` and then `update_points` for the same ids, in one `batch_update_points` request. New
points get created with the writer's vectors, and existing points keep vectors other writers own:

- **Fingerprint publish** (`vector_data.py`) writes `fingerprint_v1` and `fingerprint_v1_raw`, from the same scores.
- **Embed titles** writes `text_en_v1`, `text_multi_v1` and `terms_bm25f_v1` with `update_points` only. A title without a point
  yet returns 404. The job skips it and embeds it on the next run.

### Schema

Add the new vectors and the profile collection to `f/sync/models/qdrant_schemas.py`. Qdrant 1.19 adds a named vector
in place with `PUT /collections/{name}/vectors/{vector}`. The local test re-indexed every named vector afterwards, which
took 5 to 10 minutes per collection. Plan the change for a quiet hour.

### New flow: embed titles

`f/search/embed_titles` embeds titles whose embedding text changed, and writes `text_en_v1`, `text_multi_v1` and
`terms_bm25f_v1` with `update_points`.

- **Runtime:** ONNX Runtime with fp32 models, and the `tokenizers` library. It needs no torch.
- **Worker:** `default-highperf` (6 vCPU, 19.6 GiB). Use 4 threads and load one model at a time. Peak memory is 1.3 GB
  for `bge-base` and 1.6 GB for the multilingual model.
- **Model files:** cache the ONNX files on the worker host. They are 436 MB and 470 MB.
- **Incremental mode:** titles whose essence text, tags, keywords or tropes changed since the last run. About 260
  titles per 48 hours take about 20 seconds.
- **First load: start from the prototype's vectors.** The stored vectors equal CPU fp32 output (cosine 1.0000), and
  loading them took about a minute locally, against an estimated 4 to 8 hours of embedding on the worker.
  1. Load `text_en_v1`, `text_multi_v1` and `terms_bm25f_v1` for the 191,634 titles in the catalog snapshot of
     September 23, 2026, 08:48 UTC. The files are `data/emb-bge-base-en-v1.5-notitle.npy`,
     `data/emb-multilingual-e5-small.npy` and `data/emb-ids.json` in the arena, which are gitignored local data.
  2. Run incremental mode once, starting at the snapshot time. It embeds every title changed or added since then.
  3. Continue on the incremental schedule.
- **Full mode:** resumable, checkpointing every 1,000 titles. A chunk takes about 35 seconds on 4 threads, and a full
  run takes an estimated 4 to 8 hours. It's needed only for a new vector version, such as `text_en_v2`.
- **Text preparation** is part of the contract in ADR 0002:
  - `bge-base`: the text without the title, no prefix, CLS pooling.
  - Multilingual model: the text with the title, the `passage: ` prefix, mean pooling.
  - Both: at most 512 tokens, L2-normalized.
- **BM25F document weights** use fixed average field lengths as constants. Freezing them keeps stored weights stable.
  Averages drift under 1% in 30 days.

### New flow: build search indexes

`f/search/build_indexes` runs nightly and after a full embedding run. It builds the tables the webapp loads, writes
them to `search_index_files` as one build, moves the current-build row, and deletes files older than the previous
build. It also rewrites `search_reference_profiles`. The webapp checks the current-build row periodically and reloads
when it changes.

| output | source | notes |
|---|---|---|
| Term statistics | eligible titles' BM25F fields | Refresh on every run. Stale IDF is the main drift risk: new terms go missing. |
| Credits | Crate cast and crew, plus `created_by` | Main: director, Writing-department writer, creator, top 4 billed actors. Minor at 0.5. Shows without a creator fall back to their writers, never to pure executive producers. |
| Name index, people, teams | credits | Full names, last names, studio brands. People who share most credits merge into a team. |
| Reference profiles | credits, text and fingerprint vectors | Centroids and top 40 terms, with the term tie-break. |
| Negation labels | keywords and essence tags | Stems per title. |
| Alternate cuts, vocabulary, intent examples | catalog, `INTENT_EXAMPLES` | Small. |

Port the builders from `docs/prototypes/search-arena/scripts/pull_credits.py --writer-creators` and the index code in
the harness.

### Copy `created_by`

Extend `f/sync/copy/tmdb_details.py` to store TMDB's `created_by` for shows in Crate, then backfill existing shows.

### Deploying Windmill changes

- CI deploys with `wmill sync push` on pushes to `main`.
- Scripts that pin `qdrant-client` resolve their locks against the deployed locks of imported `f.*` modules. Push
  `f/db/qdrant.py` first.
- Relock per file with `wmill generate-metadata --lock-only <path>`. Without a path it regenerates the whole workspace.
- The live locks can be newer than the repository's. Compare them before relocking.
- A syntax error in `qdrant_schemas.py` broke every Qdrant publication from September 22 to 24, 2026. After each deploy,
  check that the next `vector_data` and `f/priority/publish` runs succeed.

## Webapp changes

- **Rename as you go.** `combined-search/d4.server.ts` and `retrieveD4` carry prototype names. The new code lives in
  `app/server/search-ranking/`, with modules named by behavior: the encoder worker, the Qdrant HTTP client, the index
  loader, the query parser (negation, era, spell correction), references, and ranking. Don't port names like
  `combo-safe-v3` or `simp_combo`.
- **Export the reading fields.** The ranker needs the decoded `searchedPhrases`, `concreteWords` and flag kinds, which
  are private to `d4.server.ts` today.
- **Keep the Jev contract string unchanged.** The ranker reads the same two readings, so cached readings stay valid.
  Add a ranker version to each search history row so results can be compared by version.
- **Keep production's title blend,** the strict and fuzzy title matching, so exact title searches still win.
- **Record time per stage:** reading, encoding, each Qdrant round, ranking and display. Production doesn't record its
  retrieval time today.
- **Roll out behind a switch:**
  1. Run the new ranker in shadow mode on real searches and log its list and timings.
  2. Compare with the old list.
  3. Switch over.
  4. Remove the old ranking code.

### Parity check

Before shadow mode, compare the TypeScript ranker with the prototype on all 168 graded queries:

1. Export the prototype's top-50 lists and scores.
2. Run the TypeScript ranker against the same readings.
3. Compare.

Target identical top 10s, and scores within float tolerance. This is a one-off script next to the prototype, not a test
suite in the webapp.

## Prerequisites

1. **Fix the Qdrant recommendation load.** Since Qdrant restarted on September 22, 2026, it has handled about 47,000
   related-title recommendation calls. They average 970 ms, and 1,353 of them hit the 60-second timeout. The new ranker
   makes 2 to 3 heavier Qdrant requests per search. Fix or measure this before switching.
2. **Apply the prototype fixes and re-score.** Add the term tie-break (design rule 7) and the non-English union and
   rescore (design rule 5) to `simp_combo.py`. Re-run `evalsimp.py table` to confirm the scores hold.

## Known gaps and follow-ups

- **Negation needs catalog labels.** "space opera without aliens" fails for every ranker. The fix is enrichment labels
  for concrete elements (aliens, robots, dragons, gore), not a ranking rule. See the walkthrough's section on this gap.
- **Spanish and Turkish queries route as English.** The marker lists exist, but routing needs two marker hits.
- **Jev 529 errors** fall back to basic search with no retry.
- **The undici stall** may affect today's search, which uses `@qdrant/js-client-rest`.
- **holdout5 is agent-written.** Confirm quality on real queries from shadow mode.

## Ticket breakdown

The owner approved this breakdown on September 24, 2026.

| # | ticket | depends on | area |
|---|---|---|---|
| 1 | Reduce the Qdrant recommendation load | | Qdrant, webapp |
| 2 | Apply the prototype fixes and re-score | | prototype |
| 3 | Replace upserts with `insert_points` and `update_points`, and write `fingerprint_v1_raw` | | Windmill |
| 4 | Add the new vectors and `search_reference_profiles` to the schema | 3 | Windmill, Qdrant |
| 5 | Copy `created_by` for shows, and backfill | | Windmill, Crate |
| 6 | Embed titles: first load from the prototype vectors, then incremental and full modes | 4 | Windmill, Qdrant |
| 7 | Build search indexes into the Crate blob table and the profile collection | 2, 5, 6 | Windmill, Crate |
| 8 | Encoder worker and Qdrant HTTP client in the webapp | | webapp |
| 9 | Port the ranker, the index loader and the reading exports; rename the prototype modules | 2, 7, 8 | webapp |
| 10 | Parity check against the prototype | 9 | prototype, webapp |
| 11 | Stage timings, shadow mode, switch-over, removal of the old ranking | 1, 10 | webapp |
| 12 | Follow-ups: Spanish and Turkish routing, Jev 529 retry, undici stall in today's client | | webapp |
| 13 | Enrichment labels for concrete elements (the aliens gap) | | Windmill, DNA |

Tickets 3, 4 and 6 change live data on the Qdrant host, so each needs a snapshot check first. Hourly snapshots land in
`/mnt/backup-qdrant/snapshots`.
