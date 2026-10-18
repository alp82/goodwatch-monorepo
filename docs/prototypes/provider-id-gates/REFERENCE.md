# Synthetic reference audit

Truth labels were authored and agent-audited before their execution. This is a semantic challenge set, not independent real identity review or a population draw. Names/IDs are synthetic except the retired/canonical pair from the public helper. Candidate lanes are scripted; database ranking/tokenization and import-group enumeration are not tested.

The original 25 cases (24 eligible, 11 requiring abstention under the original policy) remain a separate denominator. Two supplementary mirror cases show index losses and are not silently mixed into the original headline. A fresh misassigned link is undetectable from provider-ID evidence alone: its known error measures an evidence ceiling, not a route defect. The stale misassignment likewise cannot be diagnosed as wrong from age; a freshness rule only abstains.

The hidden-conflict and unknown-age cases now record underlying truth explicitly: both reader suggestions are correct but uncertifiable under the original protocol. That certification distinction is not an identity precision estimate. Overflow/failure cases give the index a complete preexisting snapshot; hidden conflicts give it global evidence; age policies give it a rejection rule. These are structural assumptions, not representative wins.

| Case | Reference / certification policy | Rationale |
| --- | --- | --- |
| exact | movie:101 | One current link to the known synthetic movie. |
| localized-de | movie:101 | German translation retrieves the known movie with no title-lane hit. |
| localized-ja | movie:101 | Japanese alternative name retrieves the known movie. |
| typed-collision | movie:101 | Same numeric movie/show ID and title; only the movie has the requested native ID. |
| remake | movie:101 | Two same-name movies with different years/native IDs; provider identity selects the older work. |
| top-ten-miss | movie:111 | Known movie is ranked eleventh; ten plausible candidates do not establish absence. |
| retired | movie:10679 | Retired 162483 canonicalizes to 10679; its original offer remains evidence. |
| duplicate-retired | movie:10679 | Current and retired rows represent the same work, not ambiguity. |
| visible-conflict | Original policy abstains | A native ID assigned to distinct movie/show works is unsafe to propose. |
| hidden-conflict | Original policy abstains; underlying truth movie:101 | Conflicting show is outside title/alias candidates; a complete identity snapshot must retain it. |
| stale-wrong-link | Original policy abstains; underlying truth movie:102 | Only link points at the wrong remake and was observed 45 days ago; correct work is movie:102. |
| fresh-wrong-link | Original policy abstains; underlying truth movie:102 | Evidence ceiling: a fresh misassigned link cannot be detected by any method using only this provider-ID evidence. |
| unknown-link-age | Original policy abstains; underlying truth movie:101 | Unknown observation age cannot meet a freshness gate. |
| missing-source-metadata | movie:101 | Known identity remains usable without source year or original catalog year. |
| year-conflict | Original policy abstains | Supplied source year contradicts catalog year. |
| missing-catalog-year | Original policy abstains | A supplied year cannot be corroborated against null catalog year. |
| missing-target | Original policy abstains | Offer exists but referenced catalog row is absent. |
| adult-target | Original policy abstains | Adult catalog targets are excluded by the shipped reader. |
| conflicting-source | Original policy abstains | Same source group has contradictory observed titles. |
| hostile-link | Original policy abstains | A lookalike host is not Netflix evidence. |
| lowercase-wrapper | movie:101 | An allowlisted wrapper with lowercase country carries the known native identity. |
| alias-overflow | movie:101 | 101 alias rows are incomplete evidence, not catalog absence. |
| offer-overflow | movie:101 | 5001 offer rows are incomplete evidence, not catalog absence. |
| lane-failure | movie:101 | One failed candidate lane must cancel its sibling and abstain. |
| stale-correct-link (mirror) | movie:101 | Mirror: a correct identity link is 45 days old; freshness loses a valid suggestion. |
| outdated-snapshot (mirror) | movie:101 | Mirror: live catalog has a newly added title, absent from the older index snapshot. |
| unsupported-id | Original policy abstains | Identifier-free/invalid provider-ID matching remains outside #709. |

Final execution: 27 cases, 26 eligible, original and mirror summaries separate. The outdated snapshot excludes both the newly added catalog row and its link. The stale-correct link keeps its valid identity at age 45 days. Neither index case is a backend failure. Locales include synthetic English/default, German translation and Japanese alternative name; no real layout/profile matrix is tested. Repeated timing calls add no semantic reference identities.
