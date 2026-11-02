Parent map: [Benchmark a richer fingerprint and discovery system](https://github.com/alp82/goodwatch-monorepo/issues/716).

## Question

Which candidate scales and representations improve annotation reliability and useful similarity/filtering while reducing generation cost and unnecessary precision?

Resolve this as **prototype / HITL**. Use prototype.

## Evidence to load

Start with [Fingerprint and discovery evidence](https://github.com/alp82/goodwatch-monorepo/blob/planning/fingerprint-discovery-v2-20261019/docs/design/fingerprint-v2/wayfinder/evidence-index.md). Use the measurement-family design and audits, including proposed foreshadowing/dramatic-irony concepts and long-tail trope/entity specificity. Preserve the V1 baseline for comparison.

## Resolution criteria

Compare selected binary, coarse ordinal, 0–10, categorical, sparse concept and scoped-relation arms under matched evidence/model conditions. Separate native-scale correctness/agreement from a derived normalized-vector score; do not infer scale quality merely by remapping the same 0–10 outputs. Measure inter-reviewer and repeated-run agreement, abstention coverage, generation cost, rank/filter behavior and threshold stability. Include short-severe/long-mild content, rare central subjects, mixed color, applicability, and alias/polarity cases. Avoid a full all-model×all-scale×all-evidence Cartesian product; preselect a small design and justify escalation.

## Asset or decision record

A reviewable representation comparison and small working scorer/filter demonstration over the frozen corpus, with human-reviewed paired cases.

Record the answer in a resolution comment and link its assets. Close only when the stated decision or prerequisite is complete. Add a named context pointer to the parent map; do not copy full conclusions into the map body.
