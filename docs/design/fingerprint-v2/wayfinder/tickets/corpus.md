## Question

Which independently reviewable movies, shows, queries, factual probes and evidence conditions will distinguish knowledge, extraction and discovery quality without rewarding memorization or catalog errors?

Resolve this as **grilling / HITL**. Use grilling and domain-modeling.

## Evidence to load

Start with [Fingerprint and discovery evidence](https://github.com/alp82/goodwatch-monorepo/blob/planning/fingerprint-discovery-v2-20261019/docs/design/fingerprint-v2/wayfinder/evidence-index.md). Load source QA from the trope audit: The Dragon/Kick the Dog aliases, averted/subverted applications, book/album/show snippets on movie rows, malformed URLs, and same-character/same-scene requirements. The earlier ten-title benchmark is historical development evidence, not an untouched holdout.

## Discussion scope

Keep grilling bounded: ask at most three consequential questions in an initial round, with recommended defaults. Ask a followup only if an answer blocks the next benchmark/prototype or materially changes cost, quality, or scope. Use provisional defaults for reversible details; defer refinements until results reveal a need. Stop once the next experiment can run responsibly. Do not require an exhaustive taxonomy, final architecture, or every attribute decision before a first useful comparison.

## Resolution criteria

Choose a cost-bounded stratified pilot: familiar/obscure/international/new/old movies and shows, remakes/aliases, explicit season/edition scopes, tone/style and narrow concepts, and unsupported/unknown cases. Draw candidates from all inventories but verify truth independently of generated tags or Qwen. Compare identity-only, identity+synopsis, matched enriched evidence, identity-masked evidence and retrieval-produced evidence with equalized source budgets. Recognizable plots can leak identity; an anonymized synopsis is not guaranteed blind. If using invented/counterfactual variants, label them as variants and test evidence overrides separately from factual title knowledge. Balance true/false plausible factual probes and negative trope applications. Turn a selected subset of synthetic queries into source-supported relevance/constraint judgments; keep a genuinely fresh blind confirmation set.

## Asset or decision record

A frozen corpus/split/annotation specification and source/identity policy, including approved pilot size and expansion/holdout triggers.

Record the answer in a resolution comment and link its assets. Close only when the stated decision or prerequisite is complete. Add a named context pointer to the parent map; do not copy full conclusions into the map body.
