# Cheap search iteration protocol

The objective is better relevance within the original cheap, fast retrieval architecture. The higher-cost model pipeline is historical evidence, not the target to reproduce at any cost. No new runtime model calls, tokens, or hidden reuse of paid-planner outputs are allowed. The original interpretation cost stays constant. Independent assistant review drives iteration; it is not user ground truth.

## Frozen comparison

The primary cohort is the exact 13 requests, in their original order, in [comparison.json](comparison.json). Its six variants and original result lists remain immutable. Default review is corrected D4+ against English combined evidence; the phrase variant and other original alternatives stay available. A new variant must face the strongest relevant inexpensive alternative, not only whichever baseline it happens to beat.

Use the same 50,000-title sample and unchanged original Jev interpretation. Frozen SHA-256 values:

- `comparison.json`: `9c789d0b870f32add90835292b09ce77affd0c5062fc8ff810f4d6f60ceec3e8`
- private `interpretations.json`: `9b125d1da0599e4e5de4deeb35d6107f274798e956d6326a075de023d07793b0`
- private `sample.json`: `642c9d89ac6e18bfb1d94ee9c71b2737f31aeb14f29133c4da8f0b4b3b1e34f8`

The fixed supplemental cohort is [8 challenge requests](loop-challenges.json), [12 confirmation requests](loop-confirmation.json), and [8 later validation requests](loop-final-validation.json), in that order. Report these 28 separately from the original 13. They have already been inspected in prior work: they are regression/stress evidence, not fresh held-out validation. Do not replace the default cohort or quietly rename these observations as new confirmation.

Permitted inputs are the original user text, frozen original interpreter output, original candidate pools/retrieval scores when identified, and frozen catalog evidence/fingerprints. A deterministic experiment may use a broader frozen sample only if it says so and accounts for the work. Existing stored catalog enrichments are allowed; newly paid runtime plans, rewritten facets, model-generated eligibility, model-ranked candidates, relevance scores, reasons, and chosen-title lists are not. Merely caching those expensive inputs does not make a variant cheap. Supplemental captures must likewise use their unchanged original interpreter outputs, not later paid plans.

## Independent quality rubric

Review top three first, then all top five, then the remaining tail. Judge the whole request, including relationships among concepts, rather than independent word presence. Candidate generation, deterministic scoring explanations, model outputs and aggregate scores are mechanisms, not ground-truth labels.

For each inspected title record one of:

- **Direct support:** supplied synopsis, essence or specific evidence supports the requested central intent and no inspected evidence conflicts with explicit constraints.
- **Acceptable or uncertain:** a plausible fit with a softer preference, central relationship or exclusion not established by the supplied evidence. Absence of evidence is not verified absence.
- **Mismatch:** the source establishes a conflicting subject, role, format or explicit exclusion, or only an incidental mention where the request calls for centrality.
- **Catalog issue:** a ride, rejected pilot or other unsuitable version supported by catalog evidence. This is distinct from thematic relevance.
- **Unavailable:** failed run or gated/empty path; never silently scored as a successful recommendation list.

Inspect actual source prose before rejecting unfamiliar titles or rewarding familiar ones. Genre inference, missing ending information, conflicting annotations and subjective taste remain explicit uncertainty. A match on `Upper-Class Twit` is not proof the story centers rich people; `Cathartic Scream` is not a happy-ending guarantee; a train meeting is not a mostly-on-a-train setting. Never turn those examples into title IDs, query strings or manually supplied desired answers in the implementation.

Record a per-request preference as better, tie, worse or unevaluable, with concrete evidence and a comparator. Explicitly distinguish a top-three regression from a weaker tail, and do not trade away a material top-three failure under a grand average. Positive changes also need source support. Fewer returned titles may be honest selectivity, but dropped relevant coverage must be recorded. A shared issue in both lists is not an automatic win for either.

## Original-request anchors and failure criteria

These are review anchors from the original lists and source evidence, not target rankings or implementation rules.

| Original request | Baseline strength to preserve | Concrete failure criteria |
| --- | --- | --- |
| car chases | Corrected repeatedly places chase-centered driving films; phrase variant has useful leaders. | Do not replace central pursuits with generic action/vehicular combat, or promote a theme-park ride. Source explicitly identifies Fast & Furious: Supercharged as a ride. |
| sunglasses | They Live is strong across arms; combined finds Fiancés on the Bridge, whose glasses alter the plot. | Losing the obscure plot-central match for familiar incidental accessories is a regression. Keyword presence alone is weak centrality evidence. |
| unreliable narrator | Both corrected and combined have directly supported leaders and viable alternatives. | General ambiguity/twists alone do not establish unreliable narration. Preserve catalog/version hygiene: the original Mulholland Dr. record explicitly describes a rejected pilot. Do not ban nonfiction without user support. |
| dark comedy about rich people | Phrase-restored combined improves the conjunction; general dark comedy is weaker. | A strong dark-comedy score cannot compensate for missing wealthy-person focus. Broad political/class satire is not automatically the required subject. |
| tense but not bleak | Original text variants are gated; production vector fill was omitted. | Empty text output is unevaluable for complete-search quality. A newly added mood path is a separate scope change and must not be counted as a fair lexical win. Low bleakness does not verify an ending. |
| no anime, gritty crime show | Corrected has coherent gritty crime-series evidence. | Anime is an explicit exclusion. Factual crime is an inferred-format tradeoff, not a hard violation; do not invent fiction-only eligibility. |
| with my parents | Original text variants are gated; user preferences are underspecified. | Do not assume parents means preschool content or a sex/violence ban. Generic popular results are coverage, not demonstrated personalization. |
| I want something tense that keeps me guessing, but I don’t want to finish it feeling miserable. | Existing lists support suspense but not consistently emotional comfort. | Re:Mind source says dark/unsettling with lingering unease. Do not let suspense compensate for explicit distress avoidance, or infer a reassuring ending from catharsis-related words. |
| Rich people being absolutely awful to each other, preferably funny. | Combined/phrase variants improve wealthy interpersonal dysfunction over corrected. | Separate wealth and humor mentions do not establish rich people mistreating each other. Preferably funny is soft; rich-person relationship centrality is the harder requirement. |
| A crime show that feels grubby and real. No animation, and nothing where the detective has magic powers. | Some corrected detective dramas and combined factual-crime results both plausibly fit. | Check animation and actual supernatural powers separately. A stage magician or gritty factual format is not automatically forbidden. Real must not silently mean documentary-only. |
| Something where halfway through you realise the person telling the story has been feeding you nonsense. | Plain combined direction is better; Spider and explicit perspective-reversal stories are useful. | Words on Bathroom Walls matches halfway through a school year, not narrator revelation. Generic temporal phrase bonuses and any-twist equivalence are concrete failures. |
| Give me car chases, but make it more getaway driver than superheroes destroying a city. | Corrected leads with driver-centered choices; unfamiliar Executive Target also explicitly has a coerced getaway driver. | A pursuing police officer, racing competition or general stunt spectacle is not necessarily the escape-driver role. Do not invent an absolute superhero ban from a contrastive preference. |
| Brain’s fried. Something warm and funny, but not painfully cheesy. | Corrected/phrase keep Moone Boy and warm-comedy leaders; its source explicitly supports warmth and humor. | Viewer fatigue is not a desired plot topic. Warmth alone cannot replace funny; food travel or generic children’s comfort is weaker evidence. Cheesy remains subjective, not a categorical ban on family titles. |

The original assessment file sometimes discusses a whole top ten rather than rank order. Read the actual immutable list and source evidence, not just the assessment shorthand. Later model-loop control copies are not substitutes for the original six lists.

## Timing and cost acceptance

Record separately:

1. Shared original interpretation: frozen model cost/timing, unchanged by the variant.
2. Retrieval: whether this is the original measured Crate median, cached replay, a new live query, or a local approximation. Do not call a local lexical scan Crate performance.
3. Local candidate preparation and reranking: measured wall time, candidate count, sample size, warm/cold state, repeat count and median/tail. Include index building or amortization separately rather than hiding it.
4. Any projected total: state its formula and overlapping components; never describe it as a newly measured end-to-end run.

Operational target: combined-evidence retrieval plus at most 50 ms local reranking, and below corrected D4+ retrieval median on comparable scope. Offline reuse can test local reranking and support a provisional projection; it cannot establish actual new SQL timings. Gated near-zero times omit text work and production vector fill, so they are not complete-search speed wins.

All new variants must have **zero additional runtime model calls and tokens**. Report equal shared interpretation cost and zero incremental model cost explicitly; database/infrastructure costs not measured remain unknown. Paid experiment spend from past work is neither free runtime nor current incremental spend.

## Evolution, elimination and stopping

Use distinct mechanisms with evidence-driven refinements: candidate-source union, phrase/token interpretation, evidence centrality, conjunction coverage, bounded fingerprint preference, explicit-constraint handling, generic catalog hygiene and calibrated lexical/fingerprint mixing are different hypotheses. Avoid making superficial coefficient sweeps stand in for architectural alternatives. The implementation agent owns ranking changes; independent reviewers inspect outputs and send counterexamples rather than desired title orders.

For each round persist configuration/provenance, immutable input hashes, exact candidate sources, per-request top10, score components, local timings, and independent judgments. Record what changed and why an arm survives, ties or is discarded. Preserve losing rounds for inspection. Stop a regression, revise a general mechanism where evidence supports it, and retain the strongest cheap surviving alternative.

Do not declare an overall winner while material top-three regressions against the strongest inexpensive alternative remain unexplained. Acceptance needs positive per-request evidence, no hidden cost violation, local-speed evidence, and separate supplemental regression results. A conditional choice or no winner is legitimate.

Continue until reasonable distinct mechanisms and informed refinements have been exercised and further attempts stop improving the quality/cost frontier. Document the explored space, successive failures, remaining unknowns, and why further attempts lack a supported hypothesis. This is practical exhaustion of reasonable options, not a proof that every possible search algorithm was tried. Unmeasured live retrieval performance remains unmeasured; do not conceal that limitation with repeated offline runs.

## Review presentation

Keep the original 13 requests primary and unchanged, with original corrected/English controls visible and other cheap variants selectable. Supplemental 28 are a separate view. Preserve original-size poster overlays, independent assistant opinions, user judgments and historical losers. Show incremental model cost and local reranking overhead alongside clearly scoped retrieval timing. Historical expensive experiments may remain accessible but cannot be presented as accepted winners or as legitimate cheap features.

## Separate phase: same-budget interpretation changes

A later, separately labeled phase may compare the unchanged interpretation prompt with at most two revised no-match/candidate-wording variants on the exact original 13 requests. This is not an unchanged-Jev ranking ablation: record the actual captured phrases, prompt/version, model inputs and outputs, and token/cost differences beside each result. Existing fingerprint inputs stay shared. The per-search number of model calls/stages must not increase, and measured runtime token/cost must pass the original budget gate; “same model” alone does not establish equal cost. Fresh paired capture spending is experiment spending and must be reported even when no extra runtime stage is added.

Keep original controls immutable. Compare freshly captured unchanged interpretation against the changed interpretation under matched retrieval/ranking, rather than attributing all differences against a historical capture to the wording change. Do not silently reuse paid planner features or carry the zero-additional-experiment-spend label into this phase. Quality still requires evidence-based per-request review, explicit ties/regressions, and separate supplemental confirmation.
