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

- **`created_by` for shows.** The ranker needs it for show creators. It was never copied to Crate before #140.
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
  - **Access, checked in #142.** The webapp container on 10.0.0.21 read a test blob from all three Crate nodes with
    its SQL credentials (`CRATE_USER`, basic auth). A node that doesn't hold the blob answers `307` with a `Location`
    on the node that does, so the loader must follow redirects. Like `/_sql`, the blob endpoint also answers LAN
    requests without credentials. The fallback (a normal table with one compressed file per row) wasn't needed.

### Webapp

The webapp loads the index files of one build at startup. Sizes of the first production build (#142), gzipped and
as JSON; the [index files](#index-files) section has the formats:

| file | gzipped | JSON | used for |
|---|---|---|---|
| `term_statistics` (660k terms, id and document frequency) | 5.1 MB | 17 MB | BM25F query weights and term ids |
| `name_index` (32k resolving keys, 22k entities with their credits) | 3.0 MB | 12 MB | people, studios, teams, typo matching, own titles |
| `negation_labels` (104k labels) | 3.6 MB | 15 MB | label negation |
| `title_table` (50,371 eligible titles) | 1.6 MB | 6 MB | priors, "like X" titles, fuzzy titles, era, filters |
| `peers` (4.5k people and studios) | 1.4 MB | 2 MB | peers |
| `word_frequencies`, `collocations`, `alternate_cuts`, `intent_examples` | 1 MB | 3 MB | spell correction, name tests, units, cut folding, intent |
| `mix_vectors` (int8 text vectors of the eligible titles) | 58 MB | 78 MB | z statistics of the non-English mix |

Held as typed arrays, `mix_vectors` takes 58 MB of memory and the other tables about 100 MB.

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
2. **Encode in two batches per search, one per model.** The query's main model encodes the query or the residual, the
   facet phrases, the coverage units and the negated clauses: `bge-base` for English queries, the multilingual model
   for non-English ones. The multilingual model also encodes the intent text, and `bge-base` also encodes Jev's
   English chips of a non-English query. This is what the prototype does (checked in #145); an earlier version of
   this rule sent the facet phrases to the multilingual model, which changes the ranking. Batched, the encodes took
   p50 12 ms and p95 30 ms on the benchmark machine (#144).
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

Done in #139. `f/sync/init/qdrant` applies the schema: it creates missing collections and adds missing vectors and
payload indexes, and prints the plan unless `apply` is set. What the change showed:

- **Adding an empty vector is instant.** The re-index happens when writers fill it.
- **A float16 vector added in place needs a Qdrant restart.** In 1.19.1 the existing segments get the wrong storage
  type for it, so the first segment merge fails ("source is not a half dense storage") and the collection turns red.
  Searches keep working, but the optimizer stops until a restart reloads the segments.
- **`fingerprint_v1_raw` has no HNSW graph** (`m: 0`). It's only searched exactly.
- **`search_reference_profiles` stores `fingerprint_v1` and `text_en_v1` centroids.** The ranker's profile uses the
  English text vector for every query, so it has no `text_multi_v1` centroid. Its payload is `kind`, `name` and
  `terms` (the top 40 profile terms).

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
     September 23, 2026, 06:48 UTC (08:48 CEST). The files are `data/emb-bge-base-en-v1.5-notitle.npy`,
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

Done in #141. What was built and decided:

- **Code:** `f/search/embed_titles` (the flow), `f/search/title_text` (text preparation and input hash),
  `f/search/terms` (tokenizer and BM25F document weights), `f/search/text_encoder` (ONNX models).
- **Text sources.** A title's text comes from two stores, as the catalog snapshot did: `title`, `original_title`,
  `release_year`, `genres` and `tropes` from the Qdrant payload, and `essence_text`, `essence_tags`,
  `substr(synopsis, 1, 600)` and `keywords` from Crate (`original_title` and `tropes` fall back to Crate). The two
  stores disagree for about 5,000 titles, so reading everything from Crate would change their vectors. Built this way,
  every title unchanged since the snapshot reproduces the snapshot's inputs exactly.
- **Models:** the official `onnx/model.onnx` of each Hugging Face repository at a pinned revision, with pinned SHA-256
  hashes. The files are downloaded once per host into `/tmp/windmill/cache/search-models`, which is the workers'
  persistent `windmill_worker_dependency_cache` volume. Both highperf workers have the tag `highperf` (one on
  10.0.0.10, one on gw-vector1 next to Qdrant), and a job can land on either.
- **Term ids: a vocabulary that only grows.** Crate table `search_terms (term, id)`. A term keeps its id forever; new
  terms get the next free ids, reserved in blocks with a compare-and-set on the counter row
  `terms_bm25f_v1.next_term_id` in `search_embedding_state`, so concurrent runs can't give one id to two terms. The
  table was seeded with the benchmark's ids (first-seen order over the snapshot's body terms, 1,548,830 terms). A
  32-bit hash was the alternative: it needs no state, but about 550 of today's terms would collide (CRC32 over the
  vocabulary), which breaks exact BM25F. The index build (#142) maps terms to ids with this table; the webapp gets
  the ids in the term statistics and never hashes terms itself.
- **`terms_bm25f_v1` is stored for every title, not only eligible ones.** Eligible-only would save about 260 MiB of
  the 440 MiB sparse index, but eligibility changes with vote counts, and every crossing would need a re-embed. The
  Qdrant host has about 20 GB free. The ranker filters to eligible titles, and term statistics count only eligible
  titles. A title without body terms (10,597 of them) gets an empty sparse vector, so every point has all three
  vectors.
- **Incremental mode** finds candidates in two ways: Crate rows whose `tmdb_details_updated_at`, `dna_updated_at` or
  `tvtropes_tags_updated_at` is newer than the last run's start minus 72 hours (the copy flows write rows up to
  12 hours after the source changed), and points that lack one of the three vectors (`has_vector`). It embeds a
  candidate only when its input hash differs from the one in `search_embedding_inputs`: most timestamp changes are
  rating updates, about 4,500 titles a day against about 100 real text changes. A title without a point is skipped;
  once the publish creates its point, the missing-vector check picks it up.
- **Full mode** scrolls every point and re-embeds it whatever its hash, checkpointing the next point id in
  `search_embedding_state` after every 1,000 titles. `restart` starts over and `max_minutes` stops early.
- **Where the embedding text is built:** `f/search/title_text`. `title_inputs(payload, crate_row)` collects the
  inputs, `english_text` and `multilingual_text` build what each model embeds (the `passage: ` prefix is added
  there), `term_fields` builds the BM25F body fields, and `input_hash` hashes all of it. `f/search/terms` turns the
  fields into document weights. The index build (#142) should reuse `term_fields` and `f/search/terms` for the term
  statistics, so query and document terms are tokenized the same way.
- **State in Crate** (tables defined in `f/sync/models/crate_schemas.py`):
  - `search_terms (term, id, created_at)`: the term vocabulary.
  - `search_embedding_inputs (point_id, input_hash, embedded_at, updated_at)`: one row per embedded point. Rows of
    deleted points stay behind; they are harmless.
  - `search_embedding_state (name, value, updated_at)`, `value` is JSON: `terms_bm25f_v1.next_term_id`
    (`{"next_id": n}`), `embed_titles.incremental` (`{"started_at", "stats"}` of the last successful incremental run)
    and `embed_titles.full` (`{"started_at", "next_point_id", "completed_at"}`).
- **Snapshot time.** The catalog file was written at 08:48 CEST, which is 06:48 UTC. The catch-up run used
  `since: 2026-09-22T06:48:00Z`, 24 hours before the snapshot, to cover the copy flows' lag. Only titles whose input
  hash differs from the snapshot's were embedded, so the earlier start cost only hash comparisons.
- **First load and catch-up (September 24 and 25, 2026):** the first load wrote the snapshot's vectors to 191,633
  points (one snapshot title had been deleted) and seeded 1,548,830 terms. The catch-up (job
  `01a0d71b-65f2-7cbc-b0cb-920f7a7932d2`) embedded 183 titles in 103 seconds: 78 points created after the snapshot
  and 105 whose text changed. It added 943 terms. Afterwards all 191,711 points had all three vectors.
- **Parity:** a preview job on a highperf worker embedded 250 random unchanged titles and compared them with the
  loaded vectors: cosine at least 0.9999993 for `text_en_v1` and 0.9999996 for `text_multi_v1`, and `terms_bm25f_v1`
  equal for all 250. The script is `goodwatch-flows/scripts/check_embedding_parity.py`; run it as a Windmill preview
  on the `highperf` tag before and after a model or text change.
- **Full-mode duration is not measured yet.** The parity run took 60 seconds for `bge-base` and 32 seconds for the
  multilingual model on 250 titles, including the first model download. If that rate holds without the download,
  a full run takes longer than the 4 to 8 hours estimated above. Measure it with `max_minutes` before relying on it.
- **Schedule:** `f/search/embed_titles` runs incremental mode (`{"mode": "incremental"}`) every 6 hours, at 05:45,
  11:45, 17:45 and 23:45 Europe/Berlin (`0 45 5/6 * * *`), 45 minutes after each DNA copy. Windmill schedules are not
  synced from the repository; this one was created through the API. The catch-up measured about 90 changed or new
  titles a day, so a run embeds about 25 titles and takes about a minute. A new title gets its text vectors at most
  6 hours after the publish creates its point, and the nightly index build sees them the same day.

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

Done in #142. What was built and decided:

- **Code:** `f/search/build_indexes` reads the sources, stores the files and the build records, writes the profiles and
  cleans up. `f/search/index_builders` holds the builders as pure functions, ported rule for rule from
  `pull_credits.py --writer-creators` and `simp_combo.py`. Tests: `goodwatch-flows/tests/test_build_indexes.py`.
- **Sources.** The eligible titles (`goodwatch_overall_score_voting_count >= 2000`, not adult in the payload or in
  Crate) come from Qdrant (payload, `fingerprint_v1`, `text_en_v1`, `text_multi_v1`) and Crate, combined with
  `f/search/title_text.title_inputs` exactly as the embedding does, so the body terms are the terms of each title's
  `terms_bm25f_v1` vector. Credits come from Crate `person_worked_on` (director, writing, `Creator` and Executive
  Producer jobs) and `person_appeared_in` (billing order below 15 for movies and 40 for shows), companies from
  `movie`/`show.production_company_ids` and `show.network_ids`. Term ids come from `search_terms`; a term without an
  id yet (its title's new text isn't embedded yet) is left out until the next build.
- **Worker:** tag `highperf`. A run takes about 12 to 13 minutes: 3.5 to 4 minutes reading, 5 minutes building
  (including loading multilingual-e5-small for the intent examples), and under 30 seconds storing files. It peaked
  at 2.9 GiB, too close to a default worker's 4 GiB limit.
- **Storage.**
  - `search_index_files` is a blob table with 3 shards, created on September 25, 2026, and listed in
    `BLOB_TABLES` in `f/sync/models/crate_schemas.py`; `f/sync/init/cratedb` creates missing blob tables.
  - `search_index_builds (build_id, status, manifest, started_at, finished_at)`: one row per build (`building`,
    then `complete`) with its manifest, plus the row `build_id = 'current'` holding the manifest of the build the
    webapp loads. Build ids are UTC timestamps such as `20260925T061500Z`.
  - A run computes every file first, records the build as `building` with its file list, writes the files whose
    digest isn't stored yet, writes the profiles, marks the build `complete` and moves `current` with a
    compare-and-set on `_seq_no`. A run that loses the compare-and-set fails and publishes nothing. A run that fails
    after recording its build marks it `failed`.
  - **Writing blobs:** a node that doesn't hold a blob's shard answers a `PUT` with `307` before it reads the body,
    which broke crate-python's blob client on the 58 MB `mix_vectors` file. `BlobStore` in the flow asks with `HEAD`
    which node to send the body to (`404` there means "not stored yet, write here"), then writes to that node.
  - **Cleanup** keeps `current`, the build it replaced (`previous_build_id`), and builds still `building` that started
    less than 6 hours ago. It deletes every other build row, every blob none of the kept builds lists, and every
    profile point whose `build_id` isn't a kept build.
- **Reference profiles.** One point per entity of the name index (person, team or studio brand): the log-vote
  weighted, normalized centroids of its top 20 main-credit titles by votes (ties: lower point id), and the top 40
  profile terms sorted by weight, then by term. Point id: UUIDv5 of the entity key (`person:<id>`,
  `team:<id>,<id>`, `studio:c:<id>,n:<id>,...`) in the namespace `6f1c2d8e-5b0a-4f7e-9a51-3c2e8d4b7a10`, so an
  entity keeps its point from build to build. Payload: `kind`, `name`, `terms` (`[{term, weight}]`) and
  `build_id`. The name index lists each entity's point id, so the webapp never computes it. A query that names
  several entities ("Bud Spencer and Terence Hill") has no stored profile; the webapp builds it from the seeds'
  vectors, as the prototype does.
- **Schedule and manual runs:** see [the flow's schedule](#build-schedule).

#### Build schedule

`f/search/build_indexes` runs daily at 06:15 Europe/Berlin (`0 15 6 * * *`), after the night's credit copy (04:00),
DNA copy (05:00) and embedding run (05:45). Windmill schedules aren't synced from the repository; this one was
created through the API. After a full `f/search/embed_titles` run, start `f/search/build_indexes` by hand (no
arguments), so the term statistics and profiles use the new vectors the same day. `dry_run: true` builds everything
and reports sizes without writing.

#### Fidelity against the prototype

`docs/prototypes/search-arena/bench/indexes/fidelity.py` compares the builders with `simp_combo.py`'s own
in-memory indexes (`FINAL["combo-safe-v3"]`).

- **Same inputs** (`logic`, `results/bench/indexes-logic.json`): the arena's catalog, raw credits and embeddings go
  through the production builders. Credits (266,850 people), studios, word frequencies and the spell vocabulary,
  term df and IDF (bitwise, 659,282 terms), negation labels, alternate cuts, peers (4,505, identical centroids), and
  all 48 single-entity reference profiles of the graded queries (seeds, top 40 terms and order; centroid cosine
  1.0) are identical. The names detected in all 168 graded queries are identical. Two known differences:
  - **Kept people.** The prototype's `persons.json` counted each person's titles with the older creator fallback
    (top Executive Producers); the build counts them from the credits the ranker uses (the writer fallback). 826
    people drop out and 9 come in, which changes 4 of 32,444 resolving keys ("kevin fox" no longer resolves;
    "clery", "stoudt" and "charlotte stoudt" now do). No graded query is affected.
  - **Collocations:** 1 of 102,440 differs, because a person was renamed between the two arena data pulls.
- **Production build** (`prod`, build `20260925T080750Z`, `results/bench/indexes-prod.json`): the names detected
  in all 168 graded queries are identical. Of the 50 entities of the graded reference queries, 40 have identical credits; the other 10
  differ by fresher data (new titles, and `created_by` creators: Vince Gilligan is now a writer on The X-Files
  instead of its fallback creator, Seth Rogen is now a creator of Preacher). Profile centroids have cosine 0.9993
  (fingerprint) and 0.9975 (text) or higher against the prototype's, and 98% of the top 40 terms are the same.
  Term df of the graded queries' terms changed by 0.4% at the 95th percentile. The intent example vectors, encoded
  by the flow's ONNX model, have cosine 0.9999992 or higher with the prototype's, and the nearest intent is the
  same on all 39 graded queries that use one.
- **Drift to expect:** the main-writer rule reads TMDB's `known_for_department` (a writer's credit is main only for
  people known for Writing). A person-row refresh on September 25, 2026 changed it for about 0.16% of the credited
  people (for example Writing to Acting or to Creator), and 83 of 32,405 name keys stopped resolving between two
  builds 13 minutes apart. That follows TMDB, as the prototype's rule does.

### Index files

Every file is one gzipped UTF-8 JSON object, stored in `search_index_files` under the SHA-1 of the gzipped bytes.
Gzip's timestamp is fixed, so an unchanged index has the same digest and isn't written again. Conventions:

- Arrays are columnar: parallel arrays of equal length, not arrays of objects.
- Point ids are JSON numbers (below 2^53, exact in JavaScript).
- A numeric matrix is `{"shape": [rows, columns], "float32": "<base64>"}` (or `"int8"`), little-endian, row-major.
- Title rows are the eligible titles in point id order, the same order in `title_table` and `mix_vectors`.
- Text rules the webapp must reproduce:
  - `words(s)`: the lowercased runs of letters and digits (Python `[^\W_]+`: Unicode letters and numbers, no
    underscore, no combining marks). `normalized(s)` joins them with spaces.
  - `fold(s)`: lowercase, NFKD, drop combining marks, remove a possessive `'s` / `’s` / `` `s ``, `&` becomes
    ` and `, `+` becomes a space, then `words` joined with spaces.
  - Terms: `f/search/terms` (`tokens`, `stem`, `terms`), which the webapp ports for the query side.

The manifest in `search_index_builds` is `{format: 1, build_id, created_at, previous_build_id, files: {<name>:
{sha1, bytes}}, profiles: {collection, points}, stats}`.

**Loading.** The webapp reads `SELECT manifest FROM search_index_builds WHERE build_id = 'current'` (a primary-key
read, always current), downloads each file with `GET http://<crate host>:4200/_blobs/search_index_files/<sha1>`
(basic auth, follow a `307`), checks the SHA-1, gunzips and parses it. It swaps in a new build only when every file
has loaded, and checks the row again every few minutes. If a download returns 404, the cleanup of a later build
removed it: read the current row again. From the webapp container on 10.0.0.21, reading the manifest and
downloading, checking and parsing all ten files of the first build took 3.5 seconds.

| file | fields | how the ranker uses it |
|---|---|---|
| `title_table` | `point_ids`, `titles` (the title, else the original title), `original_titles` (`""` when unknown), `years` (0 when unknown), `votes`, `goodwatch_scores` (null when unknown), `popularity`, `imdb_ids` (null when unknown), `flag_names`, `flags` (bit `i` set when `flag_names[i]` is true), `production_methods` | votes and GoodWatch score priors, "like X" titles (votes >= 10,000), franchise titles, fuzzy titles, the era filter, the imdb dedup of the blend, and the query's filter evaluated in memory for the mix statistics |
| `term_statistics` | `n` (eligible titles), `terms` (sorted by code point), `ids` (`search_terms` id: the index in `terms_bm25f_v1`), `df` | `idf(t) = ln(1 + (n - df + 0.5) / (df + 0.5))`. The BM25F query is a sparse vector of `idf(t)` at `ids[t]` for each distinct query term; a term not in the file adds nothing |
| `word_frequencies` | `words` (sorted), `df` (eligible titles whose title, original title, essence text, essence tags or keywords contain the word), `spell_vocabulary` (words with df >= 20 made only of letters, sorted) | spell correction: an unknown word (ASCII letters, 4 or more, df < 3) becomes the vocabulary word one edit away (transpositions count one) with the highest df, ties to the first in file order. Name keys: a single-word key's df. Typos and fuzzy titles: words with df 0 |
| `collocations` | `bigrams`: sorted terms `a_b` | two adjacent unit words form one facet unit when `stem(a) + "_" + stem(b)` is in the list (df of the bigram >= 0.3 x the rarer word's df over the titles, body fields, and creator and cast names the prototype indexed) |
| `name_index` | `keys` (sorted folded keys that resolve), `entity` (index into `entities` per key), `entities`: `{id` (profile point id), `kind` (`person`, `team`, `studio`), `name`, `members` (`p:<person id>`, `c:<company id>`, `n:<network id>`), `mass` (votes of the main-credit titles), `titles` (`[point id, weight]`: 1 for a main credit, 0.5 for a minor one, the max over members), `codirected` (point ids a person member co-directed), `mention` (folded names searched in other titles' texts)`}` | a key is listed only when it resolves (its entity's mass >= 3 x the next entity's and >= 150,000 x (1 + the key's word df)), so detection is a lookup. Keys with a space are the typo targets (one Levenshtein edit). A team counts as a person with several ids. Title weights of several entities: the mean over entities. Own titles: weight 1, plus `codirected` for the bounds. Mentions: `mention` joined with spaces, scored as BM25F |
| `peers` | `members`, `fingerprints` (float32 `[n, 74]` centroids), `titles` (top 8 point ids by votes) | peers of a reference: members of the same kind (`p:` people, `c:`/`n:` studios), z-scored cosine to the reference's fingerprint centroid, the nearest 15 that aren't the reference's own members, each giving `max(z, 0)` to its titles |
| `negation_labels` | `labels` (lowercased keywords and essence tags), `stems` (the label's distinct content stems, sorted), `titles` (point ids) | a negated phrase hits the labels whose stems contain every stem of the phrase; a title's penalty share is `min(1, hits / 2)` |
| `alternate_cuts` | `pairs` of point ids | cut folding: keep the first title of every linked set in rank order |
| `intent_examples` | `labels`, `texts`, `model`, `prefix` (`query: `), `vectors` (float32 `[39, 384]`, multilingual-e5-small of prefix + text) | the intent is the label of the example with the highest dot product with the query (names replaced by `X`) |
| `mix_vectors` | `point_ids`, `text_multi_v1` and `text_en_v1`, each `{scale: float32 [d], values: int8 [n, d]}` (vector = values x scale; a title without the vector has zeros) | z statistics of the non-English mix, see below |

**The non-English mix statistics.** The mix z-scores the multilingual cosine and the chips' bge-base cosine over
every filtered title (#137). Those statistics depend on the query vectors, so no number can be stored per filter.
Storing a covariance matrix per filter works only for a few fixed filters, and the filters vary: media type,
animation, anime, audience and mood flags, and the era. `bench/indexes/mix_stats.py` ranked the 12 graded non-English
queries with chips four ways (`results/bench/indexes-mix.json`):

| z statistics over | top 10 as the prototype | top 50 in the same order |
|---|---|---|
| every eligible title | 7 of 12 | 4 of 12 |
| the eligible titles of the query's media type | 8 of 12 | 8 of 12 |
| the filtered titles, from `mix_vectors` (int8) | 12 of 12 | 11 of 12 |

So the build ships the int8 vectors, and the webapp computes the mean and spread of both cosines over the query's
filtered titles (the Qdrant filter evaluated on `title_table`, plus the era filter): for each model,
`values[row] · (q ⊙ scale)` over the filtered rows. Only the ratio of the two spreads changes the ranking. The
spread ratio is within 0.04% of the exact one. In Node, the scan over all 50,371 titles took 33 ms on the benchmark
machine; it runs only for non-English queries, and it can overlap the Qdrant round that fetches the two top-2,000
lists.

### Copy `created_by`

Extend `f/sync/copy/tmdb_details.py` to store TMDB's `created_by` for shows in Crate, then backfill existing shows.

Done in #140. How it's stored:

- Each creator is a `person_worked_on` row with `media_type = 'show'`, `job = 'Creator'` and the `created_by` credit id.
  A creator without a cast or crew credit also gets a `person` row. There's no schema change.
- About 2,900 older rows also have `job = 'Creator'`. They come from TMDB's aggregate crew, with other credit ids, and
  name the same people. Read creators as the distinct people with `job = 'Creator'`.
- Every show crew row, creators included, has `department` NULL, because aggregate credits carry no department per job.
  For show writers, match the job (`Writer`, `Teleplay`, `Screenplay`, ...) instead of `department = 'Writing'`.
- After the backfill, 50,824 shows have a creator. The shows without one have an empty `created_by` on TMDB, for
  example most anime. Those shows need the writer fallback.
- `goodwatch-flows/scripts/backfill_show_creators.py` reads the stored `created_by` from Mongo, so it makes no TMDB
  calls. It runs as a Windmill preview job and can run again safely.

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

### Query encoder and Qdrant client

Done in #143, in `goodwatch-webapp/app/server/search-ranking/`:

- **Switch:** `SEARCH_RANKING_MODE` is `off` (default), `shadow` or `on` (`mode.server.ts`). While it's off, the encoder
  and the Qdrant client throw, and importing them loads nothing.
- **Encoder:** `encodeQueryTexts({ english, multilingual })` in `query-encoder.server.ts` sends one request per search
  to one worker thread (`query-encoder.worker.js`, 4 intra-op threads, a queue, one batch per model). It adds the
  query prefixes itself. `startQueryEncoder()` loads the models ahead of the first search. More than 32 waiting
  requests are rejected, and a failed start is retried after 5 minutes.
- **Tokenizer:** `@huggingface/tokenizers`, the library transformers.js uses internally, without transformers.js's
  onnxruntime-web and sharp dependencies. Vectors match the Python reference vectors of all 158 benchmark queries
  with texts (cosine at least 0.99999999996).
- **Model files** (`query-models.server.ts`): the fp32 Xenova exports at pinned revisions and SHA-256 hashes, about
  925 MB. They are downloaded on first start into `SEARCH_MODEL_DIR` (default: a temp directory, so each deploy
  downloads them again). Mount a volume and set `SEARCH_MODEL_DIR` to keep them across deploys.
- **Build:** `.npmrc` skips onnxruntime-node's CUDA download. `vite.config.js` copies the worker next to
  `build/server/index.js`. The nixpacks build installs the Linux x64 binary, which loads with the image's Node 24.10.
- **Qdrant client:** `queryBatch(collection, queries)` in `qdrant-http.server.ts` sends one
  `POST /collections/{c}/points/query/batch` over a keep-alive `node:http` agent, from `QDRANT_URL` (6334 becomes
  6333) and `QDRANT_API_KEY`. It returns each query's points, Qdrant's time and the wall time.
- **Benchmark:** `goodwatch-webapp/scripts/search-ranking-bench.ts` (run with Node 24 on the TypeScript sources).

Measured on the webapp host (10.0.0.21, Intel Skylake, AVX-512 without VNNI) on September 25, 2026, in a separate
container of the production image, pinned to 4 cores with `nice -n 19`, while the webapp served about 14 requests a
second:

| | result |
|---|---|
| Download of the model files | 10 s |
| Model load, cold page cache, plus warm-up | 6.2 s + 0.4 s |
| Memory of both models | 1,374 MB RSS |
| Encoding per search, one at a time (p50 / p95 / max) | 53 / 184 / 345 ms |
| `bge-base` batch / multilingual batch (p50 / p95) | 54 / 169 ms, 21 / 77 ms |
| Four searches at a time, including queueing (p50 / p95) | 196 / 476 ms |
| Throughput | 15 to 18 searches a second |

Encoding is about 4.5 times slower than on the benchmark machine, more than the estimated 2 to 3 times. Site latency
didn't change during the run.

Qdrant query batches from the same container (158 benchmark queries, `text_en_v1` and `text_multi_v1` with the
eligibility filter). Client overhead is wall time minus Qdrant's time:

| limit, response size (p50) | client | client overhead p50 / p95 | requests over 30 ms overhead |
|---|---|---|---|
| 20, 2.2 KB | `node:http` | 4.4 / 7.7 ms | 0 of 158 |
| 20, 2.2 KB | fetch | 9.3 / 52 ms | 50 of 158 |
| 100, 10.7 KB | `node:http` | 5.0 / 9.2 ms | 0 of 158 |
| 500, 53 KB | `node:http` | 6.7 / 15.6 ms | 1 of 158 |

Most of the wall time is Qdrant's own time: 25 ms p50 at limit 20, and up to 760 ms at limit 500 while Qdrant was
loaded (see [prerequisites](#prerequisites)).

### Ranker

Done in #144, in `goodwatch-webapp/app/server/search-ranking/`. Nothing calls it yet: #146 adds shadow mode.

- **Entry point:** `rankSearch(reading, request, eligibility)` in `rank-search.server.ts`. `reading` is
  `readingFields(text, readings, nativeOnly)` from `combined-search/reading-retrieval.server.ts` (the decoded searched
  phrases, concrete words, flags with their kind and Qdrant condition, the fingerprint weights and vector, and the
  chips). `request` is the typed query, the text the reading used, the language flag and the allowed title lookup rows.
  It returns the ranked list (at most 50), the route, the reference, the time per stage and each Qdrant round.
- **Modules:** `search-index.server.ts` (the index loader), `text-rules.server.ts` (`words`, `normalized`, `fold`,
  `tokens`, `stem`, `terms`), `query-parsing.server.ts` (language, negation, labels, era, spelling, facets and units),
  `references.server.ts` (names, teams, typos, intent, "like X" titles, the residual), `search-filter.server.ts` (the
  Qdrant filter and the same test on the title table), `ranking.server.ts` (weights, z-scores, profile terms, peers,
  own-title bounds, cut folding), `title-blend.server.ts` (production's blend with strict and fuzzy titles).
- **Index loader:** reads the `current` row, downloads the ten files in parallel from any Crate node (following
  `307`), checks each SHA-1, and swaps the build in only when all of them have parsed. It checks the row every
  5 minutes and loads a new build in the background. A missing blob means a newer build's cleanup removed it: it reads
  the row again. `startSearchIndex()` preloads it. From a laptop over the VPN a load took 30 to 37 seconds (the
  download); on the LAN it took 3.5 seconds (#142).
- **Qdrant requests per search:**
  1. While the texts are encoded: the stored profile of one person, team or studio (`search_reference_profiles`,
     its `fingerprint_v1` for the peers and its `terms`), or the seed titles' three vectors for a "like X" title or
     several people. Qdrant's query by point id leaves the point itself out, so a "like X" title can't be read that
     way.
  2. Round 1, the top lists: fingerprint (`fingerprint_v1_raw`, exact), dense, BM25F, facets, coverage units, and the
     profile (its centroids with `lookup_from` for one entity, as vectors otherwise).
  3. Non-English queries with English chips only: the union of both top 2,000 lists, scored with both vectors.
  4. Round 2, the pool: every signal for the pool ids, with the search's filter. The candidates are the pool titles
     that pass it. Every dense query here and in step 3 searches exactly (`params.exact`): without it, Qdrant can
     return only part of a known set of ids (789 of 1,110 in "zombie movie without gore"), and the missing titles
     scored 0 (fixed in #145; exact costs no measurable Qdrant time).

  So 156 of the 168 graded queries take 2 rounds and the 12 non-English queries with chips take 3, plus the request in
  step 1, which overlaps the encoding.
- **Filter:** the ranker ranks the indexed titles only (`goodwatch_overall_score_voting_count >= 2000`, not adult),
  whatever `lesserKnown` and `includeAdult` say. The title table can't test the genre and streaming chip filters: the
  Qdrant queries apply them, the in-memory parts (the mix statistics, reference titles and peers before round 2) don't.
- **Versions:** `search_history.ranker_version` (added with
  `goodwatch-webapp/migrations/20260925_search_history_ranker_version.sql`, applied on September 25, 2026) records
  the ranking that produced the served list: `fingerprint-text-v1` (today's), `essence-text-v1` (the basic search)
  and, once it serves, `hybrid-v1` (`RANKER_VERSION`). The Jev contract and question version strings are unchanged.
- **Encoding follows the prototype** (design rule 2, corrected in #145): the facet phrases, coverage units and negated
  clauses go through the query's main model, `bge-base` for English queries, as in `simp_combo.rank_query` and the
  benchmark trace (71 facet and 75 unit encodes with `bge-base`). For English queries, only the intent text goes
  through the multilingual model.
- **Local run:** `goodwatch-webapp/scripts/search-ranking-run.ts` ranks the arena captures (recorded readings) against
  production Qdrant and the current build. On September 25, 2026 (build `20260925T082040Z`), all 168 graded queries
  ran; their top 10s share 9.86 titles on average with the prototype's trace, 145 are the same set and 119 the same
  order. #145 checked parity properly: see [parity check](#parity-check).
- **Trace:** `rankSearch` with `request.trace` also returns the encoded texts, every candidate with its score and
  each signal's contribution, the top 50 before the blend, the reference's seeds, own titles and profile terms, and
  how many candidates each pool query returned. `search-ranking-run.ts --json` asks for it.

### Parity check

Before shadow mode, compare the TypeScript ranker with the prototype on all 168 graded queries:

1. Export the prototype's top-50 lists and scores.
2. Run the TypeScript ranker against the same readings.
3. Compare.

Target identical top 10s, and scores within float tolerance. This is a one-off script next to the prototype, not a test
suite in the webapp.

Done in #145 (`docs/prototypes/search-arena/bench/parity/`, results in `results/bench/parity.json` and the arena log's
"Parity check" section). The port also ran on local copies of production's stores that hold the arena snapshot
(`mirror.py`), one exact and one with production's Qdrant settings, so logic, approximation and data drift could be
told apart:

- **One port bug, fixed:** round 2 and the rescore now search exactly (see the Qdrant requests above).
- **Same data:** 136 of 168 top 10s in the same order, and 9.94 shared titles on average. All 32 differences are
  explained: 22 by the arena's stored embeddings, whose norms differ from 1 by up to 5e-4 (Qdrant normalizes them,
  the prototype doesn't), 7 by pools that differ at list cuts (mostly ties: a one-dimension fingerprint reading can tie
  thousands of titles, and numpy and Qdrant keep different ones), and 3 by near ties. With normalized embeddings and
  the port's pool, the prototype gives the port's top 10 on 165 of 168 queries.
- **Production:** 42 of 168 in the same order, because the data changed: the IMDb vote-count repair of September 25
  (eligible titles: 50,371 in the build, 41,507 in Qdrant's live payload hours later), about 3,000 new points,
  re-embedded titles and new credits. The prototype with production's votes gives the same top 10 as the port on 112
  queries. The rest is attributed title by title.
- **Quality**, with 61 new grades: on the same data the port is within 0.003 NDCG@10 of the prototype on every split
  (dev .820 against .822, holdout5 .787 against .790). On production it's within 0.005 of the prototype with
  production's votes, except the dev style group, where two queries have new credits.
- **Before the switch (#146):** the 2,000-vote eligibility line was tuned on the inflated vote counts, so decide
  whether it moves. Rebuild the indexes after the vote repair.

### Rollout: stage timings and shadow mode

Built in #146 (`5dee4328`). The switch-over waits for the owner.

- **Stage timings:** every `search_history` row has `stage_ms` (`OBJECT(IGNORED)`, added with
  `goodwatch-webapp/migrations/20260925_search_stage_timings_and_shadow.sql`, applied on September 25, 2026):
  `language`, `reading` (Jev), `ranking` (the current ranking, with `rankingQdrant` for its Qdrant time),
  `titleLookup` (the extra wait for the TMDB title lookup that runs alongside), `display` (catalog metadata and the
  blend) and `total`. Read the whole object: its keys aren't indexed.
- **Shadow mode** (`SEARCH_RANKING_MODE=shadow`, `app/server/search-ranking/shadow.server.ts`):
  - At server start, `startShadowRanking()` loads the index and the query models in the background.
  - The current ranking still serves. After the response stream closes, `shadowRank()` runs `rankSearch` on the same
    reading, title lookup and filters, then reads the display fields of its list (the `display` stage).
  - At most two run at a time. A search is skipped while the index or the models load, while the encoder queue is
    full, or when the search had no reading (basic search). Errors are caught and logged; the user's response never
    waits.
  - Each search gets a `search_shadow` row, joined to `search_history` by `history_id`: `outcome` (`ranked`,
    `skipped`, `failed`) and `reason`, the served list's first 50 keys (`served_keys`), the new list with its scores,
    the build, the route, `lesser_known`, the pool size, `stage_ms` (the ranker's stages plus `display` and `waited`)
    and each Qdrant request (`rounds`). The trace (encoded texts, the reference, the top 50's signals, profile terms)
    is sealed with `SEARCH_STORAGE_KEY` in `ciphertext`, because it holds text from the query.
  - The mode `on` isn't wired yet: it behaves like `shadow`.
- **Trace cost:** the trace now reads only the profile's terms instead of mapping all 660k terms, and its time is
  reported as `trace`, outside `total`.

Measured on September 25, 2026 on the webapp host (10.0.0.21), in a separate container of the production image
(`--cpuset-cpus=4-7`, `nice -n 19`) next to live traffic, on 32 real past searches with cached readings (28 general,
4 reference, all English), build `20260925T082040Z`, in milliseconds:

| stage | one at a time, p50 / p95 | two at a time, p50 / p95 |
|---|---|---|
| ranker total | 162 / 469 | 299 / 585 |
| encoding | 88 / 235 | 170 / 371 |
| Qdrant round 1 (wall; Qdrant's own time) | 43 / 113 (35 / 102) | 43 / 123 |
| Qdrant round 2 (wall; Qdrant's own time) | 28 / 78 (15 / 42) | 28 / 103 |
| scoring and blend | 12 / 38 | 14 / 59 |

The spec's estimate was a median of 105 to 154 ms and a 95th percentile of 263 to 392 ms. Encoding takes the
difference, as #143 found. Loading took 6 s for the index and 21 s for the models (14 s of it the download), and
the process grew to 2.1 GB RSS.

## Follow-ups: language routing, Jev retries and Qdrant clients

Done in #147.

### Spanish and Turkish routing

`nonEnglish()` in `combined-search/language.server.ts` decides whether a search takes the non-English path (today:
the Jev reading of the original text and the fingerprint vector only, because translation is off in production).

- **German and French** keep the v1 rule: two marker words.
- **Spanish and Turkish** need two points and more points than the search has English function words ("the",
  "with", "about", "movies", "english", ...). A strong word ("películas", "temporada", "dizi", "izle", "bölüm") is
  worth two, a weak word ("una", "comedia", "komik", "korku") one, and so is a word with "ñ" or a Turkish verb ending
  ("izlenecek", "oynuyor").
- **"ñ" and "ç" no longer route on their own.** v1 sent "Iñárritu movies" and "quinceañera coming of age film" to the
  non-English path. "ä", "ö", "ü", "ß", "ğ", "ı", "ş" and "İ" still do.
- **Version:** `LANGUAGE_VERSION` is now `five-language-markers-v2`. It's part of the Jev reading's cache key for
  every search, English ones included, so readings cached under v1 aren't reused. Each text pays for one new reading
  the next time someone searches it (about $0.0003).

`goodwatch-webapp/scripts/language-routing/check.ts` checks the routing on these sets (September 25, 2026):

| set | v1 | v2 |
|---|---|---|
| Spanish searches, tuning set | 19 of 100 | 84 of 100 |
| Turkish searches, tuning set | 62 of 100 | 97 of 100 |
| Spanish searches, held out | 10 of 60 | 54 of 60 |
| Turkish searches, held out | 37 of 60 | 57 of 60 |
| Arena non-English queries (German, Spanish, French, Turkish) | 8 of 14 | 10 of 14 |
| English graded arena queries: routed non-English | 0 of 154 | 0 of 154 |
| English searches with Spanish and Turkish names, titles and loanwords: routed non-English | 2 of 241 | 0 of 241 |
| Production search history, distinct texts: routed non-English | 0 of 43 | 0 of 43 |

The held-out sets were written after the tuning and never used for it. Most remaining Spanish and Turkish misses are
bare titles ("la casa de papel", "dirilis ertugrul"), which are language-neutral and stay English. The 4 arena misses
are French and German, which this change doesn't touch.

### Jev 529 retry

`executeJevStage` in `search-runtime/runtime.server.ts` sends a request that gets HTTP 529 (TypeSafe overloaded)
again after 100 ms, and after another 529 again after 250 ms.

- **Deadline:** the retries run inside the same 1,500 ms deadline. A retry starts only while at least 700 ms of it
  are left; otherwise the search falls back to the basic search as before.
- **Accounting:** retries run under the one claim, Redis lock and spending estimate of the search. There's no second
  claim or estimate. The settlement counts each rejected 529 attempt as if it was billed like the identical request
  that succeeded, capped at the estimate. TypeSafe's docs don't say whether a 529 is billed, and the store's rule is
  never to infer zero usage from an error.
- **Other errors** (429, 5xx, timeouts, connection errors) aren't retried.

A simulation with a fake TypeSafe endpoint (no paid calls) checked nine cases: one or two 529s recover with one claim
and one estimate; three 529s, a late 529, a 500 and a 429 fall back with the settlement left `unknown`, as before; and
a retry that runs past the deadline falls back with `deadline`.

### Qdrant clients

Measured on the webapp host (10.0.0.21) on September 25, 2026, in a separate container of the production image
(`--cpuset-cpus=4-7`, `nice -n 19`) next to live traffic, with `goodwatch-webapp/scripts/qdrant-client-bench.ts`.
Client overhead is wall time minus Qdrant's reported time, p50 / p95 in milliseconds:

| requests | response | client | wall | Qdrant | overhead |
|---|---|---|---|---|---|
| search `query`, 148 recorded from the arena captures | 540 KB | `@qdrant/js-client-rest` | 186 / 315 | 84 / 121 | 105 / 219 |
| | | `node:http` | 113 / 181 | 78 / 108 | 35 / 82 |
| search `retrieve` (100 titles' display fields) | 196 KB | `@qdrant/js-client-rest` | 59 / 82 | 7 / 12 | 52 / 74 |
| | | `node:http` | 23 / 36 | 7 / 12 | 16 / 28 |
| related seed read, 150 titles | 0.8 KB | `@qdrant/js-client-grpc` | 5 / 19 | 0.5 / 2.6 | 4.7 / 14 |
| | | `node:http` | 3 / 9 | 0.4 / 2.5 | 2.6 / 5.4 |
| related `recommend` (100 results) | 226 KB | `@qdrant/js-client-grpc` | 109 / 158 | 47 / 81 | 60 / 85 |
| | | `node:http` | 63 / 94 | 46 / 76 | 16 / 23 |

- **Search:** today's reading retrieval calls Qdrant on 74 of the 168 arena searches: every non-English search and
  every English search whose text evidence fills fewer than 100 results. Each of those makes one `query` (limit 2,000)
  and one `retrieve`. No response is small, so undici's 40 ms stall doesn't apply. The cost is
  `@qdrant/js-client-rest`'s JSON reviver, which visits every value: about 100 ms per search at the median. The
  retrieval now calls `queryPoints` and `retrievePoints` in `search-ranking/qdrant-http.server.ts` (`node:http`,
  keep-alive). On the 148 recorded requests both clients returned deep-equal results (the one difference at first
  was gone on repeat and came from a change between the two calls), and the 8 vector-only arena searches returned
  deep-equal result lists end to end.
- **Related titles** don't use undici either: they use gRPC. The seed read shows no stall. `recommend` spends about
  44 ms more in the client than `node:http` would, from protobuf decoding. Production logs show 151 ms p50 and 494 ms
  p95 for the two calls together. Moving `app/utils/qdrant.ts` to `node:http` would change the transport of six
  modules (related titles, discover, guest and user recommendations, interest discovery, fingerprint preview), so
  it's a separate change. To keep scores identical it would have to round REST scores to float32 (`Math.fround`),
  as gRPC returns them.

### Reading cache keys and ICU

#146 suspected that `canonical()` in `runtime.server.ts`, which sorts object keys with `localeCompare`, made the
reading cache keys differ between a laptop (ICU 78.3) and the container (ICU 76.1). It doesn't:

- The key order is the same in both. On the 278 distinct key sets of the reading requests for 290 queries (the arena
  queries and the routing check sets), `localeCompare` gave the same order under Node 26 with ICU 78.3 (`en-US`, `tr-TR` and `C`
  locales) and in the production container (Node 24.10, ICU 76.1, no `LANG`), and that order equals plain code point
  order.
- The keys differ because the environments use different `SEARCH_STORAGE_KEY` values. The cache key is an HMAC with
  that key. Both write to the same Crate tables, so `search_interpretations` and `search_history` hold rows of both
  keys, and a laptop can't see production's cached readings.

Deploys of the same image compute the same keys. A Node or ICU upgrade could only change a key if the collation of
two keys in one object changes. The keys are question ids made of lowercase ASCII letters, digits, `'`, `-`, `_`, `:`
and spaces, where ICU's root order and code point order agree today. The effect would be cache misses (a new paid
reading per text), not wrong results. Replacing `localeCompare` with a code point comparison would remove the
dependency without changing any current key, but it changes the key computation, so it waits for the owner.

## Prerequisites

1. **Fix the Qdrant recommendation load.** Since Qdrant restarted on September 22, 2026, it has handled about 47,000
   related-title recommendation calls. They average 970 ms, and 1,353 of them hit the 60-second timeout. The new ranker
   makes 2 to 3 heavier Qdrant requests per search. Fix or measure this before switching.
2. **Apply the prototype fixes and re-score.** Done (#137). `FINAL["combo-safe-v3"]` now has the term tie-break
   (design rule 7) and the non-English union and rescore (design rule 5). The top 10 is unchanged on every graded
   query, so every split scores the same. The version without the fixes is `combo-safe-v3-scan`. See "Port fixes" in
   the [arena log](../../prototypes/search-arena/results/LOG.md).

## Known gaps and follow-ups

- **Negation needs catalog labels.** "space opera without aliens" fails for every ranker. The fix is enrichment labels
  for concrete elements (aliens, robots, dragons, gore), not a ranking rule. See the walkthrough's section on this gap.
- **Spanish and Turkish queries route as English.** Fixed in #147: see [follow-ups](#follow-ups-language-routing-jev-retries-and-qdrant-clients).
- **Jev 529 errors** fall back to basic search with no retry. Fixed in #147: two bounded retries.
- **The undici stall** may affect today's search, which uses `@qdrant/js-client-rest`. Measured in #147: the stall
  doesn't apply (every response is 150 KB or more), but the client's JSON conversion cost about 100 ms per search.
  The search now uses `node:http`.
- **Related titles** (`app/utils/qdrant.ts`, gRPC) spend about 60 ms of client time per `recommend` call, against
  16 ms over `node:http` (#147). Not changed yet.
- **A Jev reading that fails stays blocked.** After any provider error the attempt is `unknown`, and later searches
  of the same text get the basic search until the attempt is reconciled (`reconcileUnknown`). #147's retries make
  this rarer, but don't change it.
- **holdout5 is agent-written.** Confirm quality on real queries from shadow mode.

## Ticket breakdown

The owner approved this breakdown on September 24, 2026. Each ticket is a GitHub issue.

| # | issue | ticket | depends on | area |
|---|---|---|---|---|
| 1 | #136 | Reduce the Qdrant recommendation load | | Qdrant, webapp |
| 2 | #137 | Apply the prototype fixes and re-score | | prototype |
| 3 | #138 | Replace upserts with `insert_points` and `update_points`, and write `fingerprint_v1_raw` | | Windmill |
| 4 | #139 | Add the new vectors and `search_reference_profiles` to the schema | #138 | Windmill, Qdrant |
| 5 | #140 | Copy `created_by` for shows, and backfill | | Windmill, Crate |
| 6 | #141 | Embed titles: first load from the prototype vectors, then incremental and full modes | #139 | Windmill, Qdrant |
| 7 | #142 | Build search indexes into the Crate blob table and the profile collection | #137, #140, #141 | Windmill, Crate |
| 8 | #143 | Encoder worker and Qdrant HTTP client in the webapp | | webapp |
| 9 | #144 | Port the ranker, the index loader and the reading exports; rename the prototype modules | #137, #142, #143 | webapp |
| 10 | #145 | Parity check against the prototype | #144 | prototype, webapp |
| 11 | #146 | Stage timings, shadow mode, switch-over, removal of the old ranking | #136, #145 | webapp |
| 12 | #147 | Follow-ups: Spanish and Turkish routing, Jev 529 retry, undici stall in today's client | | webapp |
| 13 | #148 | Enrichment labels for concrete elements (the aliens gap) | | Windmill, DNA |

Tickets 3, 4 and 6 change live data on the Qdrant host, so each needs a snapshot check first. Hourly snapshots land in
`/mnt/backup-qdrant/snapshots`.
