## Question

Under the approved matched-input protocol, what do Jev and shortlisted alternatives actually know about movies/shows, what can they extract from supplied evidence, and what does a complete usable pipeline cost compared with Qwen?

Resolve this as **prototype / HITL**. Use prototype.

## Evidence to load

Start with [Fingerprint and discovery evidence](https://github.com/alp82/goodwatch-monorepo/blob/planning/fingerprint-discovery-v2-20261019/docs/design/fingerprint-v2/wayfinder/evidence-index.md). Load the prior Jev scoring result/ADR and Qwen review/repeat/cost evidence. Specifically test enriched inputs, the condition the old Jev rejection left open; do not repeat a large synopsis-only sweep without an explicit reason.

## Resolution criteria

Freeze exact model/provider/output/prompt/evidence settings and source hashes before runs. Run only the approved reduced matrix, including Qwen control and candidate-specific supported tasks. Measure identity/factual discrimination, evidence attribution, unknown/abstention, unsupported additions, wrong work/scope, application polarity and trait judgments independently of structural validity. Record per-attempt usage, bills/estimates, cache state, retries, concurrency and end-to-end time. Include enrichment/prose stages needed to match output coverage. Use independent source/human judgments; Qwen agreement is a diagnostic rather than truth. Review with the human before selecting or adding arms.

## Asset or decision record

A bounded runner/review prototype, raw versioned outputs, independent reviewed results, errors, repeatability and complete cost/time accounting; human interpretation of the comparison.

Record the answer in a resolution comment and link its assets. Close only when the stated decision or prerequisite is complete. Add a named context pointer to the parent map; do not copy full conclusions into the map body.
