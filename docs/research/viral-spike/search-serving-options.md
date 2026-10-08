# Serving options for query encoding and ranking under concurrent load

This page answers "Research: serving query encoding and ranking under concurrent load" for the map "Serve a viral
traffic spike". It feeds "Decide whether search becomes its own service". It collects evidence from primary sources and
makes no decision. Researched on October 8, 2026.

The workload: two local query encoders on CPU (`BAAI/bge-base-en-v1.5` and `intfloat/multilingual-e5-small`, full
precision, see [ADR 0002](../../adr/0002-local-text-embeddings-for-search.md)), a Qdrant collection with dense,
fingerprint, and BM25F vectors, and a ranking step that runs in Node. The budget is spare hosts with 4 to 16 cores and
no GPU.

## Summary

- **Encoding:** no primary source publishes CPU numbers for these two models on hardware like ours. The only numbers
  for our hosts are our own: 15 to 18 encodes per second on 4 cores, and 319 ms of encoder CPU per search with 4
  threads against 130 ms with 1 thread. Every candidate server on CPU wraps the same ONNX Runtime library, so the
  encode time itself doesn't depend on the server.
- **Vector parity:** Text Embeddings Inference (TEI) can load the same ONNX file as today for `bge-base-en-v1.5`,
  because the file in the `BAAI` repository has the same SHA-256 hash as the pinned Xenova file. For
  `multilingual-e5-small` the two repositories hold different files. Infinity picks a quantized file on CPU by default,
  and FastEmbed ships a different, half-size file for `bge-base-en-v1.5`. Both defaults lead to the int8 kind of
  mismatch that failed before unless they're overridden.
- **Ranking inside Qdrant:** Qdrant 1.19 can fetch candidates, rescore them, and combine scores with a formula in one
  request. It can't compute the ranker's per-query z-scores over the candidate pool, and its closest built-in
  (distribution-based score fusion) has no documented weights. Moving the score fusion into Qdrant is a ranker change
  that needs the graded query set, not a transport change.
- **Load behavior:** TEI, Infinity, and Traefik answer HTTP 429 at a limit, and Triton rejects by queue policy. Only
  Triton documents a per-request queue timeout. Qdrant's request timeout is in whole seconds, with a minimum of 1. The
  webapp already has an in-flight limit, a bounded encoder queue, and a degraded result. Its ranking deadline doesn't
  cancel the work.
- **Scaling:** every option scales out as stateless replicas that each hold the models (1.33 GB measured in Node). No
  candidate server documents unloading a model when idle, except Triton's explicit unload call. No source publishes
  cold start times or memory per replica for these models.
- **Runtime:** no measured Node, Rust, or Python comparison exists for this workload. The documented differences are
  structural: `onnxruntime-node` runs inference synchronously on the calling thread, the Python binding releases the
  interpreter lock during inference, and TEI is the only existing Rust server.

## How to read the numbers

Our hosts are Intel Xeon Skylake virtual machines with 4 to 16 cores, AVX-512 without VNNI, and no GPU. Every number
on this page carries one of these marks:

| Mark | Meaning |
| --- | --- |
| **[ours]** | Measured on our hosts, in this repository |
| **[unlike ours]** | Measured on other hardware. Don't transfer the absolute value |
| **[vendor]** | The project's or author's own benchmark or claim |
| **[local, weak]** | A small experiment on the development laptop for this page, on a busy machine |

## What runs today

Read from the code on `main` at `aef43052`. A replacement must reproduce every row of the first table to produce the
same vectors.

### Encoding

| Aspect | Today | Source |
| --- | --- | --- |
| Runtime | ONNX Runtime through `onnxruntime-node` 1.30.0, CPU execution provider | `goodwatch-webapp/package.json` |
| Where it runs | One Node worker thread per process, one request at a time from a queue | [`query-encoder.worker.js`](../../../goodwatch-webapp/app/server/search-ranking/query-encoder.worker.js) |
| Model files | `Xenova/bge-base-en-v1.5` and `Xenova/multilingual-e5-small`, `onnx/model.onnx` (fp32), pinned by revision and SHA-256 | [`query-models.server.ts`](../../../goodwatch-webapp/app/server/search-ranking/query-models.server.ts) |
| Tokenizer | `@huggingface/tokenizers` 0.2.0 (JavaScript) with each repository's `tokenizer.json` | Same files |
| Query prefix | `Represent this sentence for searching relevant passages: ` for bge-base, `query: ` for the multilingual model | `query-models.server.ts` |
| Pooling | CLS for bge-base, attention-masked mean for the multilingual model, done in JavaScript | `query-encoder.worker.js` |
| Normalization | L2, done in JavaScript | Same file |
| Truncation | 128 tokens, keeping the closing special token (the models allow 512) | Same file |
| Session options | `intraOpNumThreads` from a setting (half the cores, at most 4), `interOpNumThreads: 1`, sequential, graph optimization `all`, memory arena and memory pattern off | Same file, [`limits.server.ts`](../../../goodwatch-webapp/app/server/search-runtime/limits.server.ts) |
| Batching | Per search: one batch per model. No batching across searches | Same file |
| Limits | 4 searches in flight per process, 32 waiting encoder requests, a 1,500 ms ranking deadline that doesn't cancel | `limits.server.ts`, [`query-encoder.server.ts`](../../../goodwatch-webapp/app/server/search-ranking/query-encoder.server.ts) |
| Cache | The vectors of the last 500 encoder requests, in the process | `query-encoder.server.ts` |

The catalog side (Windmill, `f/search/text_encoder`) uses ONNX Runtime in Python with fp32 models and the `tokenizers`
library. The stored vectors are float16
([search ranking implementation](../../implementation/search-ranking/README.md)).

### Ranking

[`rank-search.server.ts`](../../../goodwatch-webapp/app/server/search-ranking/rank-search.server.ts) sends two or three
`POST /collections/{collection}/points/query/batch` requests per search over `node:http`
([`qdrant-http.server.ts`](../../../goodwatch-webapp/app/server/search-ranking/qdrant-http.server.ts)):

1. **Round 1, the top lists:** the fingerprint (exact, limit 500), the dense query (limit 500), BM25F as a sparse
   query (limit 300), and one list per facet, coverage unit, and reference profile. The union of the lists, plus
   candidates from in-memory tables, is the pool.
2. **Rescore, for non-English queries with English chips only:** both dense vectors over the union of two top 2,000
   lists.
3. **Round 2, the pool:** one query per signal, each filtered to the pool's ids with `has_id`, exact, with the limit set
   to the pool size. The response holds one score per pool title per signal.

The ranker then scores in memory. It z-scores each signal over the candidates, takes the mean over facets, the minimum
over coverage units, and the maximum over negation penalties, and sums the results with fixed weights (fingerprint
0.48, dense 0.4, coverage 0.3, BM25F 0.12, and others in
[`ranking.server.ts`](../../../goodwatch-webapp/app/server/search-ranking/ranking.server.ts)). It adds signals that
come from in-memory tables (label negation, peers, credit weights, votes, the Goodwatch score), then blends title
matches, folds alternate cuts, and bounds a reference's own titles. The `search-ranking` folder holds about 4,800
lines of TypeScript without tests.

## 1. Encoding

### Numbers from our hosts

These are the only numbers for these models on our hardware. All are **[ours]**.

| Measurement | Value | Source |
| --- | --- | --- |
| Encoding per search, one at a time, 4 cores (p50, p95) | 53 ms, 184 ms | [Search ranking implementation](../../implementation/search-ranking/README.md), webapp host, September 25, 2026 |
| bge-base batch and multilingual batch (p50) | 54 ms and 21 ms | Same |
| Four searches at a time, including queueing (p50, p95) | 196 ms, 476 ms | Same |
| Encoder throughput on 4 cores | 15 to 18 searches per second | Same |
| Encoder CPU per search with 4, 2, and 1 threads | 319 ms, 183 ms, 130 ms | [Search footprint](https://github.com/alp82/goodwatch-monorepo/blob/research/search-footprint/docs/research/viral-spike/search-footprint.md), 4-core host |
| Early encode p50 with 4, 2, and 1 threads | 43 ms, 42 ms, 71 ms | Same |
| Whole ranked search: main thread and encoder threads | 84 ms and 344 ms of CPU | Same |
| One process, ranked searches within the 1.5 s deadline | 4 to 5 per second on 4 cores | Same |
| Both models, resident | 1.33 GB (1.27 to 1.45 GB in a bare Node process) | Same |
| Model load and warm-up | 5.7 to 9.2 s | Same |
| Int8 models | 2 to 3 times faster, but 12 to 19% of each query's nearest titles change | [ADR 0002](../../adr/0002-local-text-embeddings-for-search.md) |

### Published numbers from other hardware

No source measures these two models with short queries on a Skylake-class server CPU. The closest published numbers:

| Source | What it measured | Hardware | Result |
| --- | --- | --- | --- |
| [Infinity benchmark](https://github.com/michaelfeil/infinity/blob/main/docs/docs/benchmarking.md) **[vendor]** | `BAAI/bge-small-en-v1.5` through a REST server, requests of 256 sentences and 115,000 tokens (about 450 tokens per sentence), Infinity 0.0.25 and TEI `cpu-0.6` | GCP g2-standard-16, Intel Cascade Lake. A similar CPU generation, but long documents, a smaller model, and versions from 2024 | Requests per second: Infinity with int8 ONNX 0.10, Infinity with ONNX 0.08, FastEmbed with ONNX 0.08, Sentence Transformers with PyTorch 0.04, TEI with its Candle backend 0.009 |
| [Vespa, August 2023](https://blog.vespa.ai/accelerating-transformer-based-embedding-retrieval-with-vespa/) **[unlike ours]** **[vendor]** | `multilingual-e5-small` inside Vespa, short queries | Apple M1 Pro laptop, 8 virtual CPUs | 340 queries per second with fp32 and 640 with int8. NDCG@10 fell from 0.675 to 0.661 with int8. Query embedding with int8: 8 ms average for one client, 12 ms for eight clients |
| [Vespa, January 2026](https://blog.vespa.ai/embedding-tradeoffs-quantified/) **[unlike ours]** **[vendor]** | Several models, 8-word queries | AWS Graviton 3 and Graviton 4 (ARM) | Int8 runs 2.7 to 3.4 times faster on CPU and keeps 94 to 98% of the quality. `e5-small-v2` with int8 encodes a query in 2.5 ms on Graviton 3 |
| [Sentence Transformers, "Speeding up Inference"](https://sbert.net/docs/sentence_transformer/usage/efficiency.html) **[unlike ours]** **[vendor]** | `bge-base-en-v1.5` and others across backends, including a short-text dataset (39 characters on average) | Intel Core i7-13700K and Hugging Face cloud CPU instances, 8 and 20 threads | The results are charts. The page's guidance for CPU: OpenVINO int8 if a small accuracy loss is acceptable, otherwise OpenVINO on Intel CPUs, otherwise ONNX |
| [TEI README](https://github.com/huggingface/text-embeddings-inference/blob/main/README.md) **[unlike ours]** **[vendor]** | `BAAI/bge-base-en-v1.5` at 512 tokens | NVIDIA A10 GPU | Charts only. No CPU benchmark is published |

Two points transfer despite the hardware:

- **On CPU, the ONNX-based servers tie.** In Infinity's table, Infinity with ONNX and FastEmbed with ONNX both reach
  0.08 requests per second. The inference library decides the encode time, not the server around it. TEI's low result
  there is its Candle backend in an early version. TEI's README now recommends the ONNX backend on x86, and the CPU
  image is built with the ONNX Runtime, Candle, and MKL backends
  ([Dockerfile](https://github.com/huggingface/text-embeddings-inference/blob/main/Dockerfile)).
- **The published int8 gains match ours** (2 to 3.4 times faster), and so does a measurable quality loss. ONNX
  Runtime's own documentation adds a reason why int8 is riskier on our CPUs: on x86-64 with AVX2 or AVX-512 without
  VNNI, the instruction it uses for the default int8 format "might suffer from saturation issues", and it recommends
  the `reduce_range` option there
  ([quantization](https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html)). Whether saturation
  caused our parity failure wasn't tested.

### The candidate servers

| | Text Embeddings Inference | Infinity | Triton Inference Server | FastEmbed | Qdrant inference |
| --- | --- | --- | --- | --- | --- |
| Kind | Rust server, HTTP or gRPC | Python server (FastAPI) | C++ server, HTTP or gRPC | Python library, no server | Part of Qdrant |
| Latest release seen | 1.9.4, September 15, 2026 | 0.0.77, August 22, 2025 | Not checked | 0.9.0, October 7, 2026 | 1.19.2, October 5, 2026 |
| CPU engine | ONNX Runtime (recommended on x86) or Candle | PyTorch, ONNX Runtime through Optimum, or CTranslate2 | ONNX Runtime backend, among others | ONNX Runtime | BM25 only when self-hosted |
| Models per process | One | Several | Several | Several | Not applicable |
| Tokenizer, pooling, normalization | In the server: `--pooling`, `--default-prompt`, `normalize` per request | In the server | Not in the ONNX backend, which takes tensors | In the library | Not applicable |
| Batching across requests | By token count: `--max-batch-tokens` (16,384), `--max-batch-requests` | By count: batch size 32, queue of 32,000 | Dynamic batcher with a configurable delay | No | Not applicable |
| Answer at the limit | HTTP 429 above `--max-concurrent-requests` (512) | HTTP 429 when the queue is over its size | Queue policy: maximum size and timeout | None | See section 3 |
| Unload when idle | Not in the options | Not found | Explicit load and unload calls | Not applicable | Not applicable |

Sources per column:

- **TEI:** the [README](https://github.com/huggingface/text-embeddings-inference/blob/main/README.md) with the full
  option list, the
  [ONNX backend](https://github.com/huggingface/text-embeddings-inference/blob/main/backends/ort/src/lib.rs), the
  [queue](https://github.com/huggingface/text-embeddings-inference/blob/main/core/src/queue.rs), and the
  [inference module](https://github.com/huggingface/text-embeddings-inference/blob/main/core/src/infer.rs). The ONNX
  backend accepts only `float32`, loads `model.onnx` or `onnx/model.onnx`, sets the intra-op thread count to the number
  of CPUs, uses the highest graph optimization level, and holds the session behind a mutex, so one batch runs at a
  time.
- **Infinity:** the [README](https://github.com/michaelfeil/infinity/blob/main/README.md), the
  [Optimum embedder](https://github.com/michaelfeil/infinity/blob/main/libs/infinity_emb/infinity_emb/transformer/embedder/optimum.py),
  the [batch handler](https://github.com/michaelfeil/infinity/blob/main/libs/infinity_emb/infinity_emb/inference/batch_handler.py),
  the [server](https://github.com/michaelfeil/infinity/blob/main/libs/infinity_emb/infinity_emb/infinity_server.py),
  and the [settings](https://github.com/michaelfeil/infinity/blob/main/libs/infinity_emb/infinity_emb/env.py). The
  last release is more than a year old.
- **Triton:** the [dynamic batcher](https://github.com/triton-inference-server/server/blob/main/docs/user_guide/batcher.md),
  [model management](https://github.com/triton-inference-server/server/blob/main/docs/user_guide/model_management.md),
  and the [ONNX Runtime backend](https://github.com/triton-inference-server/onnxruntime_backend/blob/main/README.md),
  which exposes the intra-op and inter-op thread counts, the memory arena, and a global thread pool per model. That the
  tokenizer and pooling stay outside is an inference from the backend's scope: it serves ONNX graphs.
- **FastEmbed:** the model lists in
  [`onnx_embedding.py`](https://github.com/qdrant/fastembed/blob/main/fastembed/text/onnx_embedding.py) and
  [`pooled_embedding.py`](https://github.com/qdrant/fastembed/blob/main/fastembed/text/pooled_embedding.py), and
  [`custom_text_embedding.py`](https://github.com/qdrant/fastembed/blob/main/fastembed/text/custom_text_embedding.py)
  for models added by hand with a pooling and a normalization setting.
- **Qdrant inference:** the [inference overview](https://qdrant.tech/documentation/inference/). A self-hosted cluster
  generates BM25 sparse vectors only. Dense models run in Qdrant Cloud Inference or at external providers through
  Qdrant Cloud. For self-hosted Qdrant, the page points to client-side inference, "for example using FastEmbed". So
  Qdrant can't encode our two models on our hosts.

### Dynamic batching for short queries

- **What the servers do.** TEI has no delay setting. Its batching task takes whatever is queued when the backend is
  free, so a lone request runs alone and batches only form under load
  ([`infer.rs`](https://github.com/huggingface/text-embeddings-inference/blob/main/core/src/infer.rs)). Triton's
  batcher can hold a request for up to `max_queue_delay_microseconds` to fill a batch. Its documentation tells you to
  raise the delay "until the latency budget is exceeded"
  ([batcher](https://github.com/triton-inference-server/server/blob/main/docs/user_guide/batcher.md)).
- **What it gains on CPU: not found.** No primary source measures batching across requests for short queries on CPU.
  The published batching gains are for GPUs or for long documents.
- **Our own evidence points to a small gain.** The ranking benchmark's design rule says that running encodes at the
  same time adds no throughput, because they split the same cores **[ours]**. On the development laptop, one batch of
  2, 4, or 8 short queries took between 0.9 and 1.3 times as long as the same queries one by one, across 1, 2, and 4
  threads **[local, weak]** (see [Local experiment](#local-experiment)). On CPU the intra-op threads already use the
  cores for a single query, so a batch mainly saves per-call overhead.
- **Batching doesn't change the vectors in ONNX Runtime 1.30.** A query's vector was bit-identical alone, in a batch
  of eight short queries, and next to a longer text that forces padding, for both models **[local]**. That agrees
  with the search latency follow-up in the implementation document. The comment in `query-encoder.server.ts` that a
  batch can differ "in the last float bits" wasn't reproduced. This was one query per model on one machine.

### Threads against replicas

- **ONNX Runtime's defaults.** With the thread count unset, a session uses one intra-op thread per physical core and
  pins them. With an explicit count, it doesn't pin. Threads spin while they wait for work by default, which "Provides
  faster inference but consumes more CPU cycles". Several sessions in one process each get their own pool, and the
  documentation offers a global thread pool and thread affinities against contention between them
  ([thread management](https://onnxruntime.ai/docs/performance/tune-performance/threading.html)).
- **More threads cost more CPU per search.** On our 4-core host, 4 threads used 2.5 times the CPU of 1 thread (319
  against 130 ms per search) and were no faster than 2 threads **[ours]**. By arithmetic from that CPU cost, 4 cores
  give about 31 searches per second with four single-thread encoders and about 13 with one 4-thread encoder (15 to 18
  were measured on the webapp host). Each search would wait longer for its own encode: 71 ms against 43 ms at p50 for
  the early part. This is an inference from the per-thread numbers, not a measurement of four encoders.
- **Spinning may explain part of that cost.** The footprint measurement didn't test it. On the development laptop, 30
  single encodes 150 ms apart with 4 threads used 1,139 ms of CPU each with spinning and 335 ms without
  **[local, weak]**. The worker doesn't set `session.intra_op.allow_spinning` today.
- **TEI uses every core.** Its ONNX backend sets the thread count to the CPU count, with no option for it. The
  `num_cpus` crate it calls also reads cgroup limits
  ([source](https://github.com/seanmonstar/num_cpus/blob/master/src/lib.rs)), so a container CPU limit is the control.
  Two TEI containers (one per model) on one host would each start a thread per core unless they're limited.

### Memory per replica

- **Node today:** 1.33 GB for both models **[ours]**. Per model in a bare Node process: 456 to 660 MB for the bge-base
  session, 357 to 557 MB for the multilingual session, and 233 to 273 MB for the multilingual tokenizer, of which
  157 MB is JavaScript heap.
- **Python on the worker:** peak 1.3 GB for bge-base and 1.6 GB for the multilingual model, one at a time, while
  embedding documents **[ours]** ([search ranking implementation](../../implementation/search-ranking/README.md)).
- **Other servers:** no published memory figure for either model in TEI, Infinity, or Triton. A lower bound is the
  file size, 436 MB and 470 MB, since each process loads its own copy of the weights. A server with a native tokenizer
  wouldn't carry the 157 MB JavaScript heap of the multilingual tokenizer. That is an inference, not a measurement.

### Vector parity per serving option

The bar: the catalog vectors come from fp32 ONNX Runtime in Python and are stored as float16. The Node encoder matches
the Python reference vectors at a cosine of at least 0.99999999996 on 158 queries **[ours]**. Int8 models failed
because they changed 12 to 19% of each query's nearest titles. A replacement must stay on the fp32 side of that line.

File comparison on Hugging Face, by SHA-256 (read on October 8, 2026):

| File | Xenova repository (pinned today) | Original repository | Same |
| --- | --- | --- | --- |
| bge-base `onnx/model.onnx` | [`Xenova/bge-base-en-v1.5`](https://huggingface.co/Xenova/bge-base-en-v1.5/tree/main/onnx): 435,811,539 bytes, `9bc579ac…` | [`BAAI/bge-base-en-v1.5`](https://huggingface.co/BAAI/bge-base-en-v1.5/tree/main/onnx): 435,811,539 bytes, `9bc579ac…` | Yes |
| bge-base `tokenizer.json` | `d241a60d…` | `d241a60d…` | Yes |
| multilingual `onnx/model.onnx` | [`Xenova/multilingual-e5-small`](https://huggingface.co/Xenova/multilingual-e5-small/tree/main/onnx): 470,268,533 bytes, `4aa845c2…` | [`intfloat/multilingual-e5-small`](https://huggingface.co/intfloat/multilingual-e5-small/tree/main/onnx): 470,268,510 bytes, `ca456c06…` | No |
| multilingual `tokenizer.json` | `0b44a9d7…` | `0b44a9d7…` | Yes |

The original repositories declare the pooling that the webapp uses: CLS for bge-base and mean for the multilingual
model (`1_Pooling/config.json`). The Xenova repositories have no pooling file.

| Option | Parity risk | Why |
| --- | --- | --- |
| Same Node code in another process or container | None expected | Same files, library, and code. The footprint measurement already ran this as a second container |
| A new Node service that reuses the worker | None expected | Same as above, if the worker file and the pinned files move unchanged |
| TEI, bge-base from the `BAAI` repository | Low, unmeasured | Byte-identical ONNX file and tokenizer file, CLS pooling from the repository, fp32 only, the highest optimization level as today. Differences left: the ONNX Runtime version inside TEI, the thread count, the Rust tokenizer in place of the JavaScript one, and truncation at 512 tokens in place of 128 |
| TEI, multilingual model from the `intfloat` repository | Unknown until measured | A different ONNX export. Pointing TEI at the Xenova repository or a local folder with the pinned file and `--pooling mean` removes that difference |
| TEI, either model, prefix handling | Low | `--default-prompt` adds a fixed prefix on the server. The caller can also keep adding it |
| Infinity with its defaults | High | On CPU, the Optimum engine prefers a file with `quantize` in its name, and the Xenova repositories contain `model_quantized.onnx`. It also rewrites the graph with Optimum's optimizer at level 99. Both can be turned off (`onnx_do_not_prefer_quantized`, `onnx_disable_optimize`) |
| Infinity with both turned off | Low, unmeasured | The same fp32 file through ONNX Runtime in Python, the runtime of the catalog side |
| FastEmbed with its built-in bge-base | High | It downloads `model_optimized.onnx` from [`Qdrant/bge-base-en-v1.5-onnx-Q`](https://huggingface.co/Qdrant/bge-base-en-v1.5-onnx-Q/tree/main), 217,824,172 bytes, half the fp32 size. Its precision wasn't verified. `multilingual-e5-small` isn't in the model lists that were read |
| FastEmbed with custom models | Low, unmeasured | A custom model takes our files with a pooling and a normalization setting |
| Triton with the ONNX backend | Low for the graph, plus the caller's work | The same fp32 file. The tokenizer, pooling, and normalization stay in the caller or must be rebuilt beside the model |
| Any int8 or float16 model file | High | The failure that ADR 0002 records |

What "low, unmeasured" leaves open: no source states that ONNX Runtime returns bit-identical results across versions
or thread counts, and it wasn't tested. A difference near 1e-7 is far below the float16 rounding of the stored
vectors, and the ranker's lists already vary between two runs of the same code (7 of 37 lists, from ties and the
approximate index) **[ours]**. So the practical test is the existing one: compare the nearest titles and the top 10
on the 158 benchmark queries.

## 2. Ranking inside Qdrant

### What the Query API offers in the 1.19 line

| Feature | Since | What it does | Source |
| --- | --- | --- | --- |
| `prefetch`, also nested | 1.10 | Runs sub-queries, then applies the main query over their results | [Hybrid queries](https://qdrant.tech/documentation/search/hybrid-queries/) |
| Rescoring by another named vector | 1.10 | The main query scores the prefetched points with a different vector. "Rescoring does not use the HNSW index" | Same |
| Reciprocal rank fusion (`rrf`) | 1.10, `k` since 1.16, weights per prefetch since 1.17 | Fuses by rank | Same, [1.17.0 release notes](https://github.com/qdrant/qdrant/releases/tag/v1.17.0) |
| Distribution-based score fusion (`dbsf`) | 1.11 | Normalizes each prefetch's scores with the mean and the sample standard deviation of its returned points, then sums them | Same |
| Formula query | 1.14 | Rescores with `sum`, `mult`, `div`, `abs`, `pow`, `sqrt`, `log10`, `ln`, `exp`, decay functions, payload values, filter conditions as 0 or 1, and `$score[i]` per prefetch, with defaults for missing values | [Search relevance](https://qdrant.tech/documentation/search/search-relevance/) |
| Query batch | 1.10 | Several queries in one request. The planner can optimize requests that share a filter | [Search](https://qdrant.tech/documentation/search/search/) |
| IDF corpus per query (`idf`) | 1.19 | Computes IDF over the points that match a payload filter, in place of the whole shard | [Multitenancy](https://qdrant.tech/documentation/manage-data/multitenancy/#per-tenant-idf-statistics), [1.19.0 release notes](https://github.com/qdrant/qdrant/releases/tag/v1.19.0) |
| Named vectors added to an existing collection | 1.18 | Already used | [1.18.0 release notes](https://github.com/qdrant/qdrant/releases/tag/v1.18.0) |

### What can move, by step

| Ranker step | In Qdrant 1.19? | Evidence |
| --- | --- | --- |
| Top lists per signal | Yes, already there | Round 1 is one batch request |
| Scoring the pool with one vector | Yes, as a prefetch plus a main query in one request | Nested prefetch and rescoring are documented. Today's round 2 sends the pool ids back in a `has_id` filter |
| Returning every signal's score for every pool title | Not in one query | A query returns one score per point. A formula can read `$score[i]` of several prefetches, but it returns the combined value |
| Weighted sum of raw scores | Yes | `sum` and `mult` in a formula over `$score[i]` |
| Z-score per signal over the pool | No | The expression list has no aggregate over the candidate set. The formula works point by point |
| Normalization per list | Only as `dbsf` | `dbsf` maps a score to `(s - (mean - 3 sd)) / (6 sd)`, which is the z-score divided by 6 plus 0.5. It uses each prefetch's returned points, not a shared pool. A point that a list doesn't return adds nothing for that list. Weights are documented for `rrf` only |
| Minimum over coverage units, maximum over penalties | Not as operators | No `min` or `max` in the list. For two terms, `abs` allows it algebraically. That is an inference and wasn't tried |
| Votes and Goodwatch score priors | Yes, as payload values in a formula, but not z-scored | "Payload variables used within the formula also benefit from having payload indices" |
| Label negation, peers, credit weights, title blend, alternate cuts, own-title bounds, the non-English mix statistics | No | They read in-memory tables that Qdrant doesn't hold |
| BM25F | Partly | Qdrant states that it doesn't support BM25F natively ([full-text search](https://qdrant.tech/documentation/search/text-search/full-text-search/)). The stored document weights stay. The new `idf` parameter removes one of the two reasons the implementation document gives against Qdrant's IDF (it counted all titles, not only the eligible ones). Whether Qdrant's IDF formula equals the ranker's wasn't checked |

### What that removes from the caller

- **Today's cost.** Round 2 returns a score for every pool title for every signal. The Qdrant client's notes record
  responses of 200 KB to 1 MB, and the implementation document measured a client overhead of 35 ms at p50 on a 540 KB
  response with `node:http` **[ours]**. The footprint measurement saw Qdrant's wall time 50 to 190 ms above its server time and named response
  parsing as a candidate for the 84 ms of main-thread time per search **[ours]**.
- **If the fusion ran in Qdrant,** the response would shrink to the ranked ids, one round trip would go, and the
  z-score arithmetic would leave the main thread. The steps that read in-memory tables would stay in the caller.
- **The price is a different ranker.** A formula over raw scores, or `dbsf` without weights, isn't the tuned ranking.
  Fixed weights over raw cosine and BM25 scores are what Qdrant's own page warns against: dense and sparse scores "live
  on different scales that also shift per query". Such a change needs the 168 graded queries, like any ranker
  version.
- **A smaller step keeps the ranking:** merging round 1 and round 2 into one request with nested prefetches. It saves
  a round trip and the `has_id` list, and it still returns every score. Whether a batch computes a prefetch tree once
  when several queries repeat it isn't documented. Untested.
- **One caveat for later.** In a collection with several shards, a fusion inside a prefetch runs per shard, and "to
  keep a formula rescore over fused results, use a single shard"
  ([hybrid queries](https://qdrant.tech/documentation/search/hybrid-queries/)).

## 3. Load behavior

### Documented patterns

From Google's Site Reliability Engineering book,
["Addressing Cascading Failures"](https://sre.google/sre-book/addressing-cascading-failures/):

| Pattern | The book's statement | Today in the webapp |
| --- | --- | --- |
| Short queues | "It is usually better to have small queue lengths relative to the thread pool size (e.g., 50% or less)". LIFO or CoDel drop requests that are "unlikely to be worth processing" | One encoder worker with up to 32 waiting requests, first in, first out |
| Load shedding | Drop a share of the load "as the server approaches overload conditions" | At most 4 searches in flight per process, then a busy answer |
| Graceful degradation | Serve a cheaper result under strain | The basic search |
| Deadlines | Set one. Without it, old problems "continue to consume server resources" | 1,500 ms for the ranking |
| Deadline checks and propagation | "Check the deadline left at each stage before attempting to perform any more work", with one absolute deadline for the whole call tree | Not done: the ranking "can't be cancelled and keeps running" after its deadline (footprint measurement) |
| Cancellation | Cancel work that became superfluous | Backend calls release their request on a timeout. The encoder queue has no cancel |
| Retries | Randomized exponential backoff and a retry budget per process | Not examined for search |

### What each component provides

| Component | Admission limit | Queue bound | Deadline or timeout | Dropped clients | Source |
| --- | --- | --- | --- | --- | --- |
| TEI | `--max-concurrent-requests` (512), then HTTP 429. "Having a low limit will refuse clients requests instead of having them wait for too long" | The same limit | None in the options | An entry whose client went away is skipped when a batch forms | [README](https://github.com/huggingface/text-embeddings-inference/blob/main/README.md), [`queue.rs`](https://github.com/huggingface/text-embeddings-inference/blob/main/core/src/queue.rs), [`server.rs`](https://github.com/huggingface/text-embeddings-inference/blob/main/router/src/http/server.rs) |
| Infinity | HTTP 429 when the queue exceeds `queue_size` | 32,000 items by default | Not found | Not found | [`infinity_server.py`](https://github.com/michaelfeil/infinity/blob/main/libs/infinity_emb/infinity_emb/infinity_server.py), [`env.py`](https://github.com/michaelfeil/infinity/blob/main/libs/infinity_emb/infinity_emb/env.py) |
| Triton | Queue policy per model | `max_queue_size` | `default_timeout_microseconds` with a timeout action, and an override per request. Priority levels | Not checked | [Batcher](https://github.com/triton-inference-server/server/blob/main/docs/user_guide/batcher.md) |
| Qdrant 1.19 | Strict mode: `read_rate_limit` per minute per replica, `search_max_batchsize`, `max_query_limit` | Not documented for reads | `timeout` per request in whole seconds, minimum 1. Strict mode `max_timeout` caps it | 1.17 improved "timeout handling on read operations" | [OpenAPI 1.19.2](https://github.com/qdrant/qdrant/blob/v1.19.2/docs/redoc/master/openapi.json), [administration](https://qdrant.tech/documentation/ops-configuration/administration/) |
| Traefik (the proxy in use) | `inFlightReq`: HTTP 429 above `amount` simultaneous requests, per source | None | Not examined | Not examined | [InFlightReq](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/inflightreq/) |
| Tower (Rust library) | Concurrency limit, rate limit, load shed | Buffer | Timeout | Not examined | [tower 0.5.3](https://docs.rs/tower/latest/tower/) |
| Node | Nothing built in | Nothing built in | Hand-written, as today | Hand-written | [`limits.server.ts`](../../../goodwatch-webapp/app/server/search-runtime/limits.server.ts) |

Observations that follow from the table, without a recommendation:

- **Only Triton documents a deadline per request.** With TEI, a caller that gives up closes its connection, and TEI
  then skips the entry if it's still queued. No such handling was found for Infinity.
- **TEI's and Infinity's default limits are far above our capacity.** At 15 to 18 encodes per second, 512 concurrent
  requests or 32,000 queued items would wait far longer than the 1.5 s deadline. Both settings can be lowered.
- **Qdrant's server-side timeout can't express 1.5 s.** The parameter is an integer number of seconds.
- **The 1.19 quota API doesn't protect reads.** It rejects writes when memory or disk is short. "Read operations are
  never affected" ([resource quotas](https://qdrant.tech/documentation/ops-configuration/quotas/)).
- **Our own measurement of overload:** at 20 searches per second in one process, 41% of searches hit the 30-second
  timeout and pages timed out **[ours]**. That was before the in-flight limit existed. The limit has no load number
  yet.

## 4. Scaling

### Scaling out

| Option | Replica | Memory per replica | Cold start | Balancing |
| --- | --- | --- | --- | --- |
| The webapp image with search on | A container of the same image | 2.4 GB resident **[ours]** | Listens after 4 to 7 s, models ready after 6 to 9 s more **[ours]** | The proxy route across instances that already exists in `goodwatch-proxy/traefik/` |
| A dedicated Node search service | A container | 1.7 to 1.9 GB, an inference in the footprint measurement | Model load 5.7 to 9.2 s **[ours]** | A proxy route |
| TEI | One container per model and replica | Not published | "Small docker images and fast boot times" **[vendor]**, no number | A proxy route. The server is stateless |
| Infinity | One container for both models | Not published | Not published. Warm-up is on by default | A proxy route |
| Triton | One container, several models, several instances per model | Not published | Not published | A proxy route, or instance groups inside one server |
| Qdrant | A peer in distributed mode with a replica of each shard | The collection again per replica | Not examined | Qdrant reads from one replica per shard. `read_fan_out_delay_ms` (1.17) sends a second read when the first is slow |

- **Coolify doesn't balance across servers.** The map's decision on the second webapp instance records this, and the
  proxy route was written for it. A search service on a second host would need the same kind of route.
- **Qdrant runs on one node.** Replicas for read throughput need distributed mode with more peers
  ([low-latency search](https://qdrant.tech/documentation/search/low-latency-search/)). The map's earlier research on
  related-title calls found that a second node adds availability, not speed, at today's load. Qdrant's server time
  stayed at 44 to 53 ms at p50 at 5 ranked searches per second **[ours]**. No measurement exists above that rate.

### Scaling up

- **Encoder:** on 4 cores, 2 threads matched 4 threads **[ours]**. On the 8-core webapp host, 4 threads encode in 36
  ms and 67 ms at p50 **[ours]**. No measurement exists for 16 cores. ONNX Runtime's documentation doesn't promise
  linear scaling. It recommends testing thread settings per machine.
- **Qdrant:** `max_search_threads: 0` selects the thread count automatically
  ([configuration](https://github.com/qdrant/qdrant/blob/v1.19.2/config/config.yaml)), and 1.18 added a dynamic CPU
  pool for search workers
  ([release notes](https://github.com/qdrant/qdrant/releases/tag/v1.18.0)).
- **Node main thread:** 84 ms per search limits one process to about 12 ranked searches per second whatever the core
  count, an inference in the footprint measurement. More cores help only through more processes.

### Scale to zero and unload when idle

- **In the webapp:** `stopQueryEncoder()` exists and frees the models. Nothing calls it on idle today. The first
  search after a reload would wait for the model load or get the basic search.
- **TEI and Infinity:** no idle unload was found in TEI's options or Infinity's settings.
- **Triton:** `--model-control-mode=explicit` allows load and unload calls. An idle timer wasn't found. The
  documentation warns that memory may not return to the operating system after an unload with the default allocator.
- **At the container level:** [Sablier](https://github.com/sablierapp/sablier) starts containers on demand and stops
  them after inactivity, with Docker as a provider and Traefik as a proxy integration. Its blocking strategy holds the
  request until the container is up, with a default timeout of 1 minute. It wasn't tested with Coolify.
- **The cost of a cold start is known for Node only:** 6 to 9 s for the models, against the 1.5 s deadline. So the
  first search after a start gets the basic search unless it waits.

## 5. Runtime choice for a dedicated service

Limited to measured or documented differences.

| | Node | Rust | Python |
| --- | --- | --- | --- |
| Inference call | `onnxruntime-node` runs `session.run` synchronously on the calling JavaScript thread, inside `setImmediate` ([`backend.ts`](https://github.com/microsoft/onnxruntime/blob/main/js/node/lib/backend.ts)). So inference needs a worker thread, as today | The `ort` crate, as TEI uses it. Threads are native | The binding releases the interpreter lock around the run ([source](https://github.com/microsoft/onnxruntime/blob/main/onnxruntime/python/onnxruntime_pybind_state.cc)), so several threads can run sessions |
| Tokenizer | JavaScript. The multilingual tokenizer takes 233 to 273 MB and 1.6 to 1.9 s to load **[ours]** | The native `tokenizers` library | The same native library through bindings. The catalog side uses it |
| Existing server | The webapp's own code | TEI | Infinity |
| Ranker code | Exists: about 4,800 lines, checked against the prototype in a parity run | A port | The prototype is Python with numpy. The port to TypeScript found tie-order differences that numpy can't reproduce elsewhere |
| Limit seen in measurement | The main thread: 84 ms per search, about 12 searches per second per process **[ours]** | None published for this workload | None published for this workload |
| Overload tools | Hand-written | Tower's limit, load shed, and timeout layers. TEI's 429 | Infinity's 429 |

- **The encode time is the same library in all three.** Node, Rust, and Python all call the ONNX Runtime C++ library.
  Infinity's CPU table shows two Python servers on ONNX at the same rate **[vendor]**. In our measurement the encoder
  threads use 344 of 441 ms of CPU per search **[ours]**. A runtime change can't shorten that part. It can only change
  the remaining 84 ms of ranking and response work, and the memory around the models.
- **No measured comparison was found** of Node, Rust, and Python for a service that encodes and ranks. No source gives
  a number for how much of the 84 ms a Rust or Python ranker would save.
- **A port must repeat the parity work.** The TypeScript port needed a dedicated parity run against the prototype: 136
  of 168 top 10s matched in order on the same data, and all 32 differences were explained one by one **[ours]**.
- **A split is possible without a port:** an embedding server for the encoder and the existing ranker in Node. That
  moves 344 ms of CPU and 1.33 GB out of the Node process and adds one network hop per encode. The hop between our
  hosts measured 0.58 ms on average **[ours]**. The ranker encodes twice per search (before and after the reading), so
  it would be two hops.

## What wasn't found

- **CPU benchmarks for these models on hardware like ours.** No source measures `bge-base-en-v1.5` or
  `multilingual-e5-small` with short queries on a Skylake-class server. TEI publishes no CPU benchmark at all.
- **The gain of batching across requests on CPU** for short queries. The local experiment ran on a busy laptop and
  gives a direction only.
- **Memory per replica and cold start times** for TEI, Infinity, and Triton with these models.
- **Bit-level reproducibility of ONNX Runtime** across versions, thread counts, and servers. Not documented and not
  tested. The ONNX Runtime version inside TEI 1.9.4 wasn't looked up.
- **A measured runtime comparison** for this kind of service.
- **Qdrant under concurrent ranked searches** above 5 per second, and how a batch handles a prefetch tree that several
  queries repeat.
- **The exact chart values** of the Sentence Transformers benchmark. The page shows charts, and the numbers weren't
  extracted.
- **The AWS Builders' Library article on load shedding.** The page didn't return its text, so it isn't cited.
- **OpenVINO.** The Sentence Transformers page recommends it for fp32 on Intel CPUs. It's a different runtime, so its
  vectors would need the parity check. It wasn't examined further.
- **Triton's image size and its handling of dropped clients, and Infinity's maintenance status** beyond the date of
  its last release.
- **Nothing was tested on our hosts for this page.** No production request was sent and nothing was installed.

## Local experiment

A small experiment for two questions that no source answers. It ran on the development laptop: Intel Core i7-1185G7
(4 cores, 8 threads, AVX-512 with VNNI), Node 26.8.1, `onnxruntime-node` 1.30.0, the pinned fp32 files, and the
worker's session options. The laptop is unlike our hosts, and it was busy with other work (load average about 21 on 8
threads), so the timings are weak evidence. The bit comparison doesn't depend on load.

- **Method:** a script tokenized, encoded, pooled, and normalized like `query-encoder.worker.js`. For 1, 2, and 4
  threads it timed one batch of 1, 2, 4, or 8 short queries against the same queries one by one, 15 times each,
  alternating, and took medians. For spinning it ran 30 single encodes 150 ms apart with
  `session.intra_op.allow_spinning` at 1 and at 0 and read the process's CPU time. For parity it compared one query's
  vector alone, in a batch of eight short queries, and beside one longer text (14 against 39 tokens for bge-base, 9
  against 37 for the multilingual model).
- **Batching (bge-base):** the one-by-one time divided by the batch time ranged from 0.91 to 1.27 across the twelve
  combinations. No clear gain.
- **Spinning (bge-base, 4 threads):** 1,139 ms of CPU per encode with spinning, 335 ms without. Wall time at p50 was
  455 ms and 300 ms on the busy machine, so spinning wasn't faster there.
- **Parity (both models, 4 threads):** bit-identical vectors in all three comparisons.

## Sources

Project documentation and source code:

- [Text Embeddings Inference README](https://github.com/huggingface/text-embeddings-inference/blob/main/README.md),
  [releases](https://github.com/huggingface/text-embeddings-inference/releases),
  [ONNX backend](https://github.com/huggingface/text-embeddings-inference/blob/main/backends/ort/src/lib.rs),
  [queue](https://github.com/huggingface/text-embeddings-inference/blob/main/core/src/queue.rs),
  [inference module](https://github.com/huggingface/text-embeddings-inference/blob/main/core/src/infer.rs),
  [HTTP server](https://github.com/huggingface/text-embeddings-inference/blob/main/router/src/http/server.rs),
  [Dockerfile](https://github.com/huggingface/text-embeddings-inference/blob/main/Dockerfile)
- [Infinity README](https://github.com/michaelfeil/infinity/blob/main/README.md),
  [benchmark](https://github.com/michaelfeil/infinity/blob/main/docs/docs/benchmarking.md),
  [releases](https://github.com/michaelfeil/infinity/releases)
- [Triton dynamic batcher](https://github.com/triton-inference-server/server/blob/main/docs/user_guide/batcher.md),
  [model management](https://github.com/triton-inference-server/server/blob/main/docs/user_guide/model_management.md),
  [ONNX Runtime backend](https://github.com/triton-inference-server/onnxruntime_backend/blob/main/README.md)
- [FastEmbed model list](https://github.com/qdrant/fastembed/blob/main/fastembed/text/onnx_embedding.py),
  [releases](https://github.com/qdrant/fastembed/releases)
- Qdrant: [hybrid queries](https://qdrant.tech/documentation/search/hybrid-queries/),
  [search relevance](https://qdrant.tech/documentation/search/search-relevance/),
  [search](https://qdrant.tech/documentation/search/search/),
  [full-text search](https://qdrant.tech/documentation/search/text-search/full-text-search/),
  [multitenancy](https://qdrant.tech/documentation/manage-data/multitenancy/),
  [inference](https://qdrant.tech/documentation/inference/),
  [administration](https://qdrant.tech/documentation/ops-configuration/administration/),
  [resource quotas](https://qdrant.tech/documentation/ops-configuration/quotas/),
  [low-latency search](https://qdrant.tech/documentation/search/low-latency-search/),
  release notes for [1.17.0](https://github.com/qdrant/qdrant/releases/tag/v1.17.0),
  [1.18.0](https://github.com/qdrant/qdrant/releases/tag/v1.18.0), and
  [1.19.0](https://github.com/qdrant/qdrant/releases/tag/v1.19.0),
  [configuration file 1.19.2](https://github.com/qdrant/qdrant/blob/v1.19.2/config/config.yaml),
  [OpenAPI 1.19.2](https://github.com/qdrant/qdrant/blob/v1.19.2/docs/redoc/master/openapi.json)
- ONNX Runtime: [thread management](https://onnxruntime.ai/docs/performance/tune-performance/threading.html),
  [quantization](https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html),
  [Node binding](https://github.com/microsoft/onnxruntime/blob/main/js/node/lib/backend.ts),
  [Python binding](https://github.com/microsoft/onnxruntime/blob/main/onnxruntime/python/onnxruntime_pybind_state.cc)
- Hugging Face repositories: [`BAAI/bge-base-en-v1.5`](https://huggingface.co/BAAI/bge-base-en-v1.5/tree/main),
  [`Xenova/bge-base-en-v1.5`](https://huggingface.co/Xenova/bge-base-en-v1.5/tree/main),
  [`intfloat/multilingual-e5-small`](https://huggingface.co/intfloat/multilingual-e5-small/tree/main),
  [`Xenova/multilingual-e5-small`](https://huggingface.co/Xenova/multilingual-e5-small/tree/main),
  [`Qdrant/bge-base-en-v1.5-onnx-Q`](https://huggingface.co/Qdrant/bge-base-en-v1.5-onnx-Q/tree/main)
- [Traefik InFlightReq](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/inflightreq/),
  [tower](https://docs.rs/tower/latest/tower/), [Sablier](https://github.com/sablierapp/sablier),
  [`num_cpus`](https://github.com/seanmonstar/num_cpus/blob/master/src/lib.rs)

Benchmarks and guidance:

- [Sentence Transformers, "Speeding up Inference"](https://sbert.net/docs/sentence_transformer/usage/efficiency.html)
- [Vespa, "Accelerating Transformer-based Embedding Retrieval with Vespa"](https://blog.vespa.ai/accelerating-transformer-based-embedding-retrieval-with-vespa/)
- [Vespa, "Embedding tradeoffs, quantified"](https://blog.vespa.ai/embedding-tradeoffs-quantified/)
- [Google, Site Reliability Engineering, "Addressing Cascading Failures"](https://sre.google/sre-book/addressing-cascading-failures/)

This repository:

- [ADR 0002](../../adr/0002-local-text-embeddings-for-search.md)
- [Search ranking implementation](../../implementation/search-ranking/README.md)
- [Search footprint in the webapp process](https://github.com/alp82/goodwatch-monorepo/blob/research/search-footprint/docs/research/viral-spike/search-footprint.md),
  on the branch `research/search-footprint`
