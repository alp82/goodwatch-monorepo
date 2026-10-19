## Question

What must improve for a new fingerprint/discovery approach to be worthwhile, and what quality, cost, latency, throughput, review-effort and spending constraints govern the experiments?

Resolve this as **grilling / HITL**. Use grilling and domain-modeling.

## Evidence to load

Start with [Fingerprint and discovery evidence](https://github.com/alp82/goodwatch-monorepo/blob/planning/fingerprint-discovery-v2-20261019/docs/design/fingerprint-v2/wayfinder/evidence-index.md). Load the current gap-audit summary, architecture impact, previous fingerprint protocol and Jev result, and the discovery evidence index. Existing scores and historical quality stars are not a new gold standard.

## Discussion scope

Keep grilling bounded: ask at most three consequential questions in an initial round, with recommended defaults. Ask a followup only if an answer blocks the next benchmark/prototype or materially changes cost, quality, or scope. Use provisional defaults for reversible details; defer refinements until results reveal a need. Stop once the next experiment can run responsibly. Do not require an exhaustive taxonomy, final architecture, or every attribute decision before a first useful comparison.

## Resolution criteria

Agree with the human on priority tasks/surfaces, acceptable regressions, treatment of unknowns and hard exclusions, quality review and disagreement handling, generation/query latency and throughput measures, resource accounting, total and per-stage budget, retry/concurrency limits, and stop/escalation rules. Separate valid JSON from factual correctness and useful discovery. Name development and fresh holdout rules; freeze no numerical pass threshold on the agent's authority alone.

## Asset or decision record

An agreed evaluation contract and experiment envelope; explicitly distinguish per-title generation, per-query interpretation, retrieval-only work, and end-to-end discovery. No budget from an earlier map is inherited.

Record the answer in a resolution comment and link its assets. Close only when the stated decision or prerequisite is complete. Add a named context pointer to the parent map; do not copy full conclusions into the map body.
