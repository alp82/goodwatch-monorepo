# V2 fingerprint: select attributes for similarity

Design direction agreed with the owner, 2026-10-24. This records the boundary for the next draft; it does not change the frozen draft.2 registry, benchmark inputs, generated results or production V1.

The fingerprint is the similarity representation, not the complete title-analysis record. Include an attribute only when its difference should meaningfully affect which titles resemble one another in content, viewing experience or form. Other useful information remains in title analysis and can influence search, filters, explanations or recommendation ranking without becoming a vector dimension.

## Output responsibilities

| Output | Purpose and examples |
|---|---|
| Similarity fingerprint | Selected descriptive strengths: emotional tone, humor, narrative structure, pacing, visual/sonic treatment, and central themes or relationships when they contribute to useful resemblance. |
| Content metadata | Occurrence of objects, settings, occupations, activities and precise tropes; detailed query predicates and explicit unknowns. A concept's occurrence is distinct from its narrative importance. |
| Evaluations and reception | Craft-quality judgments and audience/critic ratings, available separately for ranking or filtering. Similar quality alone does not establish descriptive resemblance. |
| Viewing context | Runtime, viewing suitability, background/drop-in friendliness and similar situational considerations. A contextual recommendation may use these without placing all of them in the general fingerprint. |
| Advisories | Content warnings, scope and evidence-qualified presence/absence. Handle exclusions explicitly, including unknowns. |
| Explanatory outputs | Essence text, tags, highlights, provenance and assessment coverage. |

Storage placement is logical here; this does not require separate databases or settle a Qdrant payload layout.

## What the current inventory means

Draft.2 contains 554 numeric attributes, not an approved 554-dimensional similarity vector. Its current labels are 160 `core_candidate`, 378 `targeted_only`, six `context_only`, and ten `excluded` evaluations. Its 146 presence entries are separate metadata, not additional numeric dimensions.

These labels are a starting point, not the final projection. In particular, the current `targeted_only` label on all themes, genres and relationships must not automatically exclude meaningful content similarity. Consumerism, parent–child relationships or underground fighting may organize a title sufficiently to matter, while an incidental aircraft or a passing animal may only be useful for a specific query. Conversely, membership in `core_candidate` does not guarantee reliable assessment or useful retrieval.

The V1 envelope already separates fingerprint scores from production information, advisories, social suitability, viewing context and essence outputs (`goodwatch-flows/windmill/f/dna/models.py`). V1 does also include craft-quality scores; V2 should not copy that mixing merely to preserve the old boundary.

## Admission and completion rules

1. Select a fixed, versioned set of dimensions before generation and publication. Do not choose a different subset for each title or automatically flatten every numeric field in title analysis.
2. Judge each candidate by whether it improves the intended similarity: same premise/different tone, same tone/different subject, and meaningful stylistic or narrative differences. Avoid giving near-duplicate concepts several independent votes. Final membership and weights remain open.
3. Require a numeric assessment for every dimension in a published dense fingerprint. Missing metadata does not block that fingerprint; an unknown selected dimension does. Preserve the prior usable fingerprint while completing a replacement, or withhold a new fingerprint if none exists. Never silently turn unknowns into zero.
4. Interpret zero under the selected attribute's rubric. No narrative importance need not mean no occurrence. Presence metadata may remain unknown even when importance can be assessed.
5. Keep dimensions comparable across the supported title types. Show-only attributes remain metadata unless a separately versioned show-specific similarity representation is intentionally introduced; movie NAs are not zeros.
6. Retain the complete assessment and its unknowns independently of the published fingerprint. Broader targeted retrieval and contextual ranking can use that information without altering general vector distance.

This separates two questions: whether an attribute belongs in similarity, and whether we can assess it reliably. Do not remove a genuinely important dimension solely to hide a completion failure. Do not add a reliable but irrelevant dimension solely because it is easy to score.

## Next implementation step

The concrete [258-dimension proposal and exhaustive 554-field mapping](../similarity/README.md) now implement this classification, including saved-output coverage. The proposal is not a production migration; final retrieval weights and metric remain separate decisions.

Create an explicit attribute-to-output mapping and a candidate similarity projection from the existing registry. Preserve useful content traits while moving incidental occurrence, evaluations and context out of the general vector. Review that concrete selection before rerendering requests or changing schemas; no final dimension count is selected by this note. Score-only benchmark coverage over all 554 fields is not fingerprint-publication eligibility.

This follows the existing [architecture impact](../wayfinder/architecture-impact.md), which already calls for versioned vectors and separate profile evaluation. The frozen registry's jointly-assessed-feature comparison remains an offline analysis option, not a publication rule for the complete dense fingerprint described here.
