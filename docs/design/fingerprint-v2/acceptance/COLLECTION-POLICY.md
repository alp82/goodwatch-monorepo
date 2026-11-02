# V2 collection policy

The data contract and the extraction recipe have separate versions. Keep the draft.8 field meanings and the ordered `similarity-v2.3` mapping fixed. Changing a prompt does not rewrite historical predictions; changing coordinate meanings requires a new projection version. Qwen remains the primary producer. This document does not deploy collection or change production V1.

## Store drafts; admit usable fingerprints separately

Retain the raw response, exact work/adaptation/scope, model and endpoint, schema/projection/recipe versions, request hash, attempt history and validation result. Preserve all returned values, including unknowns and contradictions. A successful request or an attributable charge does not establish quality.

Assemble the three disjoint producer parts by their owned leaf paths. Never replace an entire facet group when another request owns some of its leaves. Validate the producer shape, losslessly decode it, attach the controller's exact identity and validate the assembled vector and attributes together.

A vector admitted to similarity must contain all 274 integer scores in the pinned order, with values from 0 to 10. Require matching identity/scope and passing pair and additional consistency checks. Do not fill missing scores with zero or infer absence from unknown. A standalone ordered-vector export is not evidence that the full fingerprint passed.

Unknown attributes and eight movie-inapplicable series traits remain legitimate states. Record their coverage; a response containing all required keys can still have very little useful information. Broad abstention, such as a nearly blank targeted-score request, must remain visible as a generation failure rather than being described as a complete analysis.

## Facts and exclusions

Presence and importance are different: present with zero centrality can be valid; positive importance with absent presence is contradictory. Multi-select facets retain overlapping values. Independent tags do not establish that they refer to the same character, scene or event.

Unknown advisory presence cannot establish an exclusion such as “no animal harm.” Model-predicted absence is also not a release-independent safety guarantee. Keep known source contradictions visible. Do not infer advisories from a gentle tone, a genre label or synopsis silence.

Precise production facts, calendar years and categorical traditions need stronger evidence than resemblance. A film-like image does not establish film capture; a historical setting does not establish a true-story adaptation; acrobatics do not establish breaking. Where a reliable existing catalog fact is available, preserve its provenance. Otherwise an unknown fact is preferable to invented specificity. This policy does not require a new manual-curation system.

## Corrections and scope

Transport retries and semantic correction are separate. The tested transport policy retries only throttles, at most five additional attempts with exponential delay and a longer valid Retry-After; budget guards still apply. It does not authorize unlimited retries or erase unknown charges.

A later correction should regenerate only the affected owned fields or request part, retain the original failure, record lineage and revalidate the whole assembled fingerprint. Do not change a value merely to make a validator pass. Semantic correction is not yet wired into production by this work.

These are admission and provenance requirements, not retrieval weights, taste-matching logic, a query planner or a human approval gate for every title. Automatic consistency checks are necessary but cannot detect every factual error. The acceptance report records the actual remaining producer limitations.
