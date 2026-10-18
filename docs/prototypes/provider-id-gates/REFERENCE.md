# Synthetic reference audit

Reviewed by the implementing agent before evaluating routes. This is a semantic challenge set, not an independently reviewed real sample or a population draw. All names and native IDs are invented; the retired/canonical pair comes from the public canonicalization helper. Both routes receive the same catalog/offer world. Candidate lanes are scripted responses, not a test of database ranking/tokenization. Source-group construction is injected, not tested.

Truth describes the underlying work or requires abstention independently of the algorithm. Unknown-age and conflicting associations cannot certify a target; those suggestions are unsafe, but not asserted to be known wrong identities. The two misassigned-link scenarios have a known different target, so they can establish wrong matches. Retrieval overflow/failure is specific to the bounded transport: the index has a previously complete synthetic snapshot and can still produce a valid identity.

| Case | Required reference outcome | Rationale |
| --- | --- | --- |
| exact | movie:101 | One current link to the known synthetic movie. |
| localized-de | movie:101 | German translation retrieves the known movie with no title-lane hit. |
| localized-ja | movie:101 | Japanese alternative name retrieves the known movie. |
| typed-collision | movie:101 | Same numeric movie/show ID and title; only the movie has the requested native ID. |
| remake | movie:101 | Two same-name movies with different years/native IDs; provider identity selects the older work. |
| top-ten-miss | movie:111 | Known movie is ranked eleventh; ten plausible candidates do not establish absence. |
| retired | movie:10679 | Retired 162483 canonicalizes to 10679; its original offer remains evidence. |
| duplicate-retired | movie:10679 | Current and retired rows represent the same work, not ambiguity. |
| visible-conflict | Abstain; cannot certify identity | A native ID assigned to distinct movie/show works is unsafe to propose. |
| hidden-conflict | Abstain; cannot certify identity | Conflicting show is outside title/alias candidates; a complete identity snapshot must retain it. |
| stale-wrong-link | Abstain; underlying reference movie:102 | Only link points at the wrong remake and was observed 45 days ago; correct work is movie:102. |
| fresh-wrong-link | Abstain; underlying reference movie:102 | A newly observed but misassigned link is still wrong; truth is independent of link freshness. |
| unknown-link-age | Abstain; cannot certify identity | Unknown observation age cannot meet a freshness gate. |
| missing-source-metadata | movie:101 | Known identity remains usable without source year or original catalog year. |
| year-conflict | Abstain; cannot certify identity | Supplied source year contradicts catalog year. |
| missing-catalog-year | Abstain; cannot certify identity | A supplied year cannot be corroborated against null catalog year. |
| missing-target | Abstain; cannot certify identity | Offer exists but referenced catalog row is absent. |
| adult-target | Abstain; cannot certify identity | Adult catalog targets are excluded by the shipped reader. |
| conflicting-source | Abstain; cannot certify identity | Same source group has contradictory observed titles. |
| hostile-link | Abstain; cannot certify identity | A lookalike host is not Netflix evidence. |
| lowercase-wrapper | movie:101 | An allowlisted wrapper with lowercase country carries the known native identity. |
| alias-overflow | movie:101 | 101 alias rows are incomplete evidence, not catalog absence. |
| offer-overflow | movie:101 | 5001 offer rows are incomplete evidence, not catalog absence. |
| lane-failure | movie:101 | One failed candidate lane must cancel its sibling and abstain. |
| unsupported-id | Abstain; cannot certify identity | Identifier-free/invalid provider-ID matching remains outside #709. |

Locales: synthetic English/default, German translation, Japanese alternative title. No real locale/layout/profile matrix was tested. Each case is a separate catalog world; IDs can intentionally repeat between worlds. Twenty-five cases include one unsupported identity control (excluded from the eligible provider-ID denominator). Timing repetitions add no semantic references.
