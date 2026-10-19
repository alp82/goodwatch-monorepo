Parent map: [Benchmark a richer fingerprint and discovery system](https://github.com/alp82/goodwatch-monorepo/issues/716).

## Question

Once candidate configurations and review rules have been selected with the human, do they retain their quality/cost/time behavior on the untouched confirmation set?

Resolve this as **task / AFK**. Use the map notes and the relevant repository workflows.

## Evidence to load

Start with [Fingerprint and discovery evidence](https://github.com/alp82/goodwatch-monorepo/blob/planning/fingerprint-discovery-v2-20261019/docs/design/fingerprint-v2/wayfinder/evidence-index.md). The old ten-title benchmark and all disclosed catalog/query audit cases are reusable development data. The actual fresh holdout and protocol come from the corpus/goals decisions and human-reviewed prototypes.

## Resolution criteria

Use frozen candidate configurations, prompts/sources/scales, limits, corpus/query split and grading instructions selected by the preceding tickets. Verify that confirmation items and human/source judgments were not used for tuning. Capture raw outputs and first/after-repair validity; score quality and task constraints separately; include repeat variation and all end-to-end costs/times. Make no new candidate, budget or pass-threshold choices in this execution task. If approvals/configuration are incomplete, return to their decision ticket; after a miss, record it rather than tuning on this holdout and still calling it blind.

## Asset or decision record

Immutable confirmation artifacts and a reconciled comparison, with failures, incomplete arms and review disagreement visible for the final decision.

Record the answer in a resolution comment and link its assets. Close only when the stated decision or prerequisite is complete. Add a named context pointer to the parent map; do not copy full conclusions into the map body.
