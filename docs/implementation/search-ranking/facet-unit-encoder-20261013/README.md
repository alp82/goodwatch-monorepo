# Local public facet/unit encoder completion

This completed preparation step supports #100 and #407; issue #406 remains closed. One authorized local run encoded the exact 132 missing English facet/coverage-unit texts derived from the existing 101-query English-routed nonreference cohort. It does not establish quality, production latency, current-final ranking parity, capacity or acceptance. No subsequent scoring study ran as part of this evidence.

The run used the original deployed-source `927d38b2` worker and six already-cached pinned model files, with intra-op threads 2/inter-op 1 and one outstanding request. Original startup warmups account for six batches/twelve texts. Requested work was exactly 17 sequential batches of at most eight texts, totaling 132 new unique model/text pairs. Existing cached vectors were not re-encoded. The plan retains every exact text, text hash, query ID and facet/unit role; the original phrase/concrete/token gates and cohort were not enlarged.

| Actual observation | Result |
|---|---:|
| Process exit / stderr | 0 / 0 bytes |
| New English vectors | 132 × 768D |
| Prior vectors retained bit-exact | 269 |
| Derived merged cache total | 401 |
| Stable pinned model pre/post proofs | 6 files, 923,875,007 bytes |
| Maximum unit-norm error | 5.17 × 10⁻⁹ |
| Outer invocation elapsed | 22.130 seconds |
| Worker startup observed | 8.637 seconds |
| Sum of requested batch wall times | 3.726 seconds |
| Worker/postflight/publication wall interval | 15.373 seconds |

The outer interval also includes authentication and preflight full-file hashing. Startup and encoding timings describe this local warm-cache embedding run, not production end-to-end search. There were no downloads, remote/host operations, ordinary searches, JeV/LLM calls or production writes. The unchanged worker loads both sessions and performs its original multilingual warmups, but no new multilingual corpus encoding requests were added.

The original prepared source had a real deadline gap: it checked before worker termination, allowing termination or synchronous publication to finish late. That reviewed source is preserved under `encoder/reviewed-v1/`. The successor races termination against the remaining original wall budget, independently rechecks completion time, and checks immediately before the terminal record and public success log. Eight local fixtures cover the original plan/vector/model guards plus delayed termination, completion-clock drift and late publication. Root independently reported all eight fixtures passing before the once-only actual run. A completion file alone is not success authority if the process exits nonzero or the bounded success log is absent.

The runner authenticated the exact plan, its eleven bound inputs, original worker/model source, original encoder freeze and 72 dependency files before creating the worker. All six model files were fully SHA256-checked through stable NOFOLLOW file descriptors before and after requests, retaining dev/inode/size/mtime/ctime. The final postflight exactly matches preflight. The successful terminal record also retains observed worker termination. `validate-actual.py` independently checks the CLI/log chain, all 132 vectors' finite Float32 values/unit norms, exact plan roles/batch order, all 269 reused vectors' double-bit identity, and the six model proof tuples against the original pins. It does not perform another embedding run.

The source README/manifests and plan still record prepared-only/not-executed metadata because they freeze pre-run inputs. Those original bytes are preserved. Actual completion is separately bound by `encoder/actual-invocation.json`, the bounded stdout/stderr, run records, `actual-validation.json` and `actual-freeze.json`. The V1 manifest references the unchanged shared worker file; there was no separate V1 worker copy. None of these preparation records is silently rewritten into an execution receipt.

`evidence-bindings.json` authenticates 27 exact copied artifacts. Large additions and merged-vector JSON files remain outside Git, with their size/SHA/path retained in the omitted-artifact table. The derived merged cache SHA is `df96f124ef1e85b5c997a58ff9e69550f500d37b784fc93cf475c7ef4e6734d3`; additions SHA is `3a8a86b4bbed5f1696dfc800761e46342d8034d2b1b9ea43456de415ad37b407`. Models, dependencies, prior caches and public corpus inputs are not duplicated here. Exact scripts preserve their original retained-layout paths; this publication is an evidence package, not a self-contained executable dataset.

Any next facets/incomplete-coverage comparison remains a separately reviewed step. Quantized index dense columns approximate production Qdrant stored-vector scores; preserving aggregation formulas does not prove vector-score parity. Per-title BM25 postings and returned sparse maps are absent, so missing BM25 cannot be treated as observed zero or used to claim exact original coverage. The completed [common-union study](../common-union-fingerprint-ablation-20261013/README.md) retains both relevance gains and known-bad regressions. No application behavior, frontend, host setting, production model call or quality threshold changed in this publication.
