# Read-only public fingerprint acquisition and validation

This evidence supports #100 and #407, which remain open; issue #406 remains closed. It records one root-executed bounded read-only catalog acquisition and a separate offline matrix validation. It establishes neither useful results, current Qdrant ranking parity, production latency nor acceptance. No application source or frontend behavior changed.

The fixed plan selected the 74 typed raw fingerprint columns in the original `CoreScores` / web fingerprint-key order for the verified index's 42,934 movie/show IDs. There were 87 sequential fixed SELECT requests, no retries or SQL writes, and no ordinary search, history, Jev or model calls. Credentials stayed in request memory and were not retained in output. Docker's existing container was used for the reader; no new container or data staging was created by this acquisition.

| Actual observation | Value |
|---|---:|
| Aligned requested index rows | 42,934 |
| Valid returned raw fingerprints | 42,933 |
| Missing catalog rows | 1 |
| Invalid returned fingerprints | 0 |
| Current adult true / null values | 0 / 0 |
| Current vote counts below 2,000 | 29 |
| SQL calls / writes / retries | 87 / 0 / 0 |
| Retained stream bytes | 15,164,608 |

The reader's terminal status is complete acquisition with explicit omissions, not universal catalog coverage. Its measured read loop was 6,750.72 ms; root's enclosing SSH/Docker/Node invocation exited zero. A Node lifetime watchdog, remote timeout and transport timeout separately bounded input and final-receipt handling. The reader's own `outputBytes` counts serialized pre-terminal frames; actual delivered journal size/hash is retained independently. No claim is made that these userspace timeouts prove hard kernel deadlines.

The strict offline builder authenticates the exact plan, reader, title-table gzip and index-validation receipt. It rejects incomplete framing, missing terminal EOF, duplicate/misaligned IDs, wrong 74-key order, invalid numeric scores, lying omissions and inconsistent count/byte/batch budgets. It places rows by authenticated index row rather than response order. It emits two aligned Float32 matrices and a required validity bitmap. Valid raw components retain exact integer values in 0..10; the one missing row is NaN in both matrices and has validity zero. Missing data is never substituted with a valid zero vector.

The original ranker uses raw reading weights with `fingerprint_v1_raw` Dot scoring. **Use the unnormalized raw matrix for that signal.** The L2-normalized sidecar is a separate analysis product, not a production-equivalent replacement. Any ablation must use the same original eligibility mask intersected with validity for every compared variant and declare a common candidate universe. No fingerprint study result is included here.

Current catalog values are not the historical index's fingerprint snapshot. The 29 current below-floor vote observations are retained as drift, not silently filtered by the builder. Root additionally observed that all 29 were above the floor in the index and that 2,772 aligned vote values differed overall; those counts describe the two retained inputs, not a globally atomic transaction or timestamp attribution. Catalog values have not been attested equal to current Qdrant stored vectors.

Root's independent fixtures passed: 13 reader cases (15.413 s) and 10 full-size builder cases (50.261 s). The peer independently read source/tests/methods, checked six builder source bindings, authenticated and validated the entire actual stream without rebuilding outputs, checked full point/key alignment and all output hashes, and checked every raw/normalized/bitmap row. Those checks are distinct from runtime or ranking acceptance. Fixtures use local synthetic/loopback inputs and do not establish production transaction semantics.

The exact small source, tests and root validation receipts are included. `matrix-manifest-projection.json` omits the large point-order array while binding the exact original manifest hash and size; the original full order remains authenticated by the retained plan and title table. `acquisition-invocation-projection.json` contains a fixed safe subset of the original invocation and its hash. `evidence-bindings.json` binds copied originals. The 5 MB plan, 15 MB raw stream, 25 MB matrix payloads and full manifest remain hash-referenced outside this publication. Reproduction requires those retained inputs and fresh absent output paths; source/test files contain local retained-input paths and are not a self-contained downloadable dataset.

The projected `pointOrderSha256` is SHA-256 of UTF-8 Python `json.dumps(pointOrder, separators=(',', ':'))`, preserving the parsed dictionary insertion order. It does not use `sort_keys` and is not a claim of canonical JSON.
