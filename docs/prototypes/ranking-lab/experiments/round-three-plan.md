# Round three: semantic core, then mood

Declared after development-only scalar/lexical scores and before semantic inference output or confirmation grades were inspected.

Scalar tuning failed because a high phrase score can describe the wrong subject. Lexical core evidence substantially improves development acceptable@10, but still cannot establish relations such as parental bereavement, a spacecraft setting, or actual time loops. The next hypothesis is a separate inference stage over descriptions that verifies the subject and relationship before applying fingerprint preferences.

The semantic ranker is a fresh agent context. It receives original request and frozen catalog packet, not the evaluator rubric, grades, watched titles, candidate source, or old rank. It labels core support 0/1/2, modifier fit 0/1/2, explicit-exclusion contradiction and reference identity. It must preserve partial/unknown evidence. These labels are ranking inputs and must never become evaluation labels.

Ranking formula: `4 * core + fit + 0.25 * normalized attribute strength`, with `-8` for a supported explicit exclusion and `-4` for the original reference when requesting similar suggestions. Every coefficient is fixed before inference output is inspected. Core tiers cannot be crossed by mood strength. Mood-only and ambiguous requests retain the generic core-strength base; there is no hardcoded title or per-query scoring rule.

The semantic slate is the predeclared union of top tens from all compared variants, plus original prototype top tens, limited to the nine interpreted subject/analogy queries. Every compared algorithm's top ten was already admitted. This is an offline reranker feasibility experiment, not evidence of an efficient online shortlist policy. Timing/cost for running this inference as part of live search remain unmeasured.

Select a candidate using the six development requests, freeze it, then open the four reused-case confirmation scores exactly once. Do not tune against confirmation and relabel it unseen. Independent grade audit and primary-source resolution of uncertain time-loop packets apply equally to all configurations.
