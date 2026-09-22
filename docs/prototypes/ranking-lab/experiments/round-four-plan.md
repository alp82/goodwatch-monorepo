# Round four: interpretation before support

The unconditioned semantic reranker improves development NDCG substantially but fails the fixed guardrail: broad romantic-repetition analogies introduce an off-target top-five result for `like groundhog day`. The result is preserved in `semantic-v1-development.json`; it is not a winner.

Hypothesis: independently extract the requested core premise, roles, modifiers and ambiguity before evaluating candidates. A fresh interpreter read only the 14 query strings, not the evaluator rubric, grades, ranks or captured fingerprint readings. Its output is `parsed-intents.json`. The candidate-support ranker now receives that interpretation and must not silently broaden it through alternative readings.

The original description packet has three official-source factual supplements collected by the independent uncertain-evidence audit. These expose source facts only, never proposed grades. They are preserved in `semantic-packets-v2.json` and permit a missing catalog fact to be recognized rather than guessed.

All scoring coefficients, the candidate slate and the separate evaluation rubric remain fixed. The ranker writes a separate `semantic-support-v2.json`. The four reused-case confirmation query grades have still not been opened when this hypothesis was declared. A reference analogy's mechanism must be met before shared mood can improve its rank; this rule applies to the interpretation shape, not a hardcoded title list.

The user can inspect the assumed interpretation in the demo. This does not establish that an ambiguous interpretation is the user's intended one, and it does not authorize changing the accepted production query interpreter.
