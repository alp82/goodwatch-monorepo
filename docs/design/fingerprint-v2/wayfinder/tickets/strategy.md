## Question

What strategy is justified by the reviewed evidence, what uncertainty remains, and what precisely should a subsequent implementation effort build?

Resolve this as **grilling / HITL**. Use grilling and domain-modeling.

## Evidence to load

Start with [Fingerprint and discovery evidence](https://github.com/alp82/goodwatch-monorepo/blob/planning/fingerprint-discovery-v2-20261019/docs/design/fingerprint-v2/wayfinder/evidence-index.md). Read the final holdout artifacts and relevant resolution comments, zooming into source reports on demand. Include a named pointer for every accepted/rejected approach and disclose remaining limitations.

## Discussion scope

Keep grilling bounded: ask at most three consequential questions in an initial round, with recommended defaults. Ask a followup only if an answer blocks the next benchmark/prototype or materially changes cost, quality, or scope. Use provisional defaults for reversible details; defer refinements until results reveal a need. Stop once the next experiment can run responsibly. Do not require an exhaustive taxonomy, final architecture, or every attribute decision before a first useful comparison.

## Resolution criteria

Decide model/provider roles and any enriched-evidence/classifier/generator cascade, field representations/scales, required versus optional concepts, extra-output producers, query/retrieval approach, and resource/quality tradeoffs. Preserve unresolved evidence rather than force a winner. Specify versioned schemas/feature ordering, null/applicability/coverage semantics, projection/adapters, indexed/snapshot subsets, taste recalibration, cache invalidation, scope/spoiler handling and cross-page/API compatibility. Record whether ADR 0001 needs a separately justified revision; initial research does not revise it. Production migration/backfill/deployment gets its own map.

## Asset or decision record

A human-approved strategy or a focused next experiment, with an implementation-ready contract and migration/rollback requirements; close the map only when the destination is met.

Record the answer in a resolution comment and link its assets. Close only when the stated decision or prerequisite is complete. Add a named context pointer to the parent map; do not copy full conclusions into the map body.
