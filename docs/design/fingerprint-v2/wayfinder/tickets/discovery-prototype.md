## Question

How do the promising title representations combine with Jev or alternative query interpreters, lexical/dense retrieval, structured filters and ranking on real discovery tasks?

Resolve this as **prototype / HITL**. Use prototype.

## Evidence to load

Start with [Fingerprint and discovery evidence](https://github.com/alp82/goodwatch-monorepo/blob/planning/fingerprint-discovery-v2-20261019/docs/design/fingerprint-v2/wayfinder/evidence-index.md). Load discovery-evidence-index.md, old Jev A–E/D4+ comparisons, arena contracts/log/ablation/holdout artifacts and current query reading/snapshot/filter code. Local text embeddings are back in the code; the September paid-embedding retirement is not the present complete architecture.

## Resolution criteria

Compare the current hybrid baseline with a small selected set of structured/sparse/dense/text approaches. Hold title evidence fixed for interpreter/ranker-only tests, then test representation interactions. Include common/uncommon, multilingual, like-X, mood, precise entity, conjunction/negation, same-scene/same-character and hard-exclusion cases from the inventories. Evaluate candidate recall separately from ranking and final constraints. Distinguish soft preferences from verified absence and unknown coverage; preserve spoiler-safe explanations. Report accepted quality metrics plus cached/uncached interpretation, local encoding, retrieval/ranking, display and first-useful/full-response time. Historical arena holdouts and the new published synthetic phrases are development sets, not fresh confirmation.

## Asset or decision record

A bounded, side-by-side discovery playground and offline benchmark with matched catalogs, source-backed judgments, component ablations and complete latency/cost accounting.

Record the answer in a resolution comment and link its assets. Close only when the stated decision or prerequisite is complete. Add a named context pointer to the parent map; do not copy full conclusions into the map body.
