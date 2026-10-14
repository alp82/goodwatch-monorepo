# Item 012: who could be invited to T3 (aggregate counts, orchestrator)

Production, read-only (`lab/crate.py`), October 14, 2026. Members other than the owner with 20 or more ratings, and
of those, whose latest rating, Want to See add or Skip falls within the window. Aggregates only.

| Members, not the owner, 20+ ratings | Count |
|---|---:|
| All | 97 |
| Active in the last 30 days | 7 |
| Active in the last 90 days | 17 |
| Active in the last 180 days | 29 |

Reading: an invitation shown only inside the product reaches a handful of members per month; 20 exposed members
needs a channel that reaches inactive members too (email to the 97), and even then a response rate under about 20%
leaves the test under PLAN.md's minimum. Activity here counts writes only; visits without a write are not logged
(the exposure log, issue #525, does not exist yet).
