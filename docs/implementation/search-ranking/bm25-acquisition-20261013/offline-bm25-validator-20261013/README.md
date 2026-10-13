Independent physical BM25 acquisition validation

This standalone Python validator consumes the frozen public NDJSON acquisition and its exact root invocation receipt. It does not import or execute the acquisition reader, wrapper, app, SDK, models, or host tools. Root's separate streaming validation is supporting evidence; this validator has not yet been run against the actual acquisition.

The source authenticates the corrected 42,934-ID plan, pinned term-statistics gzip, root wrapper, reader, driver, and executed-source hashes. It requires observed CLI exit zero, no outer refusal, empty physical stderr, exact file bytes and SHA, physical final newline and EOF, the header, two collection projections, all ordered point rows, and the terminal's 88-request accounting. It independently converts each observed decimal to binary32; valid short Rust serialization such as `0.33333334` and exact zero are accepted. Missing, omitted, null, malformed, and valid empty vectors remain distinct.

Unknown uint32 term IDs are written as bounded row-local occurrences in a fresh sidecar, preserving IDs without inventing names or a global unique count. The validator holds only pinned metadata and a single bounded corpus frame in memory. Limits are 4 MiB per frame, 2 GiB physical input, 1 GiB unknown sidecar, 32,768 entries per point, and 134,217,728 total entries. The report retains the terminal and collection projection hash. A refusal retains the consumed local output directory and a fixed reason; it cannot produce a successful report.

Local verification uses nine fixture groups, including synthetic full-size streams and corruption/serialization/deadline-metadata/output-bound cases. Synthetic fixtures provide no production source or vector correctness proof. The pinned gzip supplies 650,794 known IDs at `n=42934`; terms are not used to name unknown IDs.

After root source review, the local invocation is:

```sh
python3 -B validate.py \
  --plan ../offline-bm25-reader-20261013/PLAN-v2.json \
  --term-statistics ../index-readonly-acquisition-20261013/verified-index/term_statistics.json.gz \
  --stdout ../offline-bm25-acquisition-20261013/actual.ndjson \
  --stderr ../offline-bm25-acquisition-20261013/actual.stderr \
  --invocation ../offline-bm25-acquisition-20261013/actual-invocation.json \
  --wrapper ../offline-bm25-acquisition-20261013/run-root.py \
  --output ./actual-validation-v1
```

The output directory must be absent. A successful acquisition validation does not establish equality with the original index snapshot, production candidate parity, relevance quality, or production latency. Collection observations are bounded current projections, not a transactional snapshot. Production BM25 uses top-300 hit maps with absent hits scored zero; acquiring sparse vectors does not itself reproduce that candidate/ranking path.
