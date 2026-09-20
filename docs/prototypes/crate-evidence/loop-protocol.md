# Autonomous search-variant loop

The user authorized assistant assessments to drive implementation, trials, and elimination until a clear winner emerges. This supersedes the earlier requirement to wait for live human relevance judgments between prototype iterations. It does not authorize pretending assistant labels are user ratings or deploying a search strategy without verification.

## Comparison boundary

Use the same frozen 50,000-title sample. Preserve the earlier variants and results. No source catalog writes or schema changes are needed for this loop. Candidate retrieval can read the existing scratch columns; request interpretation and evidence reranking can use inexpensive language-model calls when a measured quality gain justifies them.

The 13 existing requests form the development set. Additional challenge requests are frozen before new results are inspected, in `loop-challenges.json`. A challenge consulted during iteration is no longer held-out validation. After a finalist emerges, test fresh requests and paraphrases not used to adjust its implementation. Do not hardcode query strings, expected title IDs, or film-specific exceptions into search code.

## Judgment discipline

Judge the whole request: central topic, requested conjunctions, media/format, and explicit exclusions. Distinguish strong, acceptable, weak/wrong, and evidence-insufficient matches. Do not reward a familiar title simply because it is familiar. Do not call an unfamiliar title wrong without examining its evidence. Preserve uncertainty where catalog descriptions do not establish a requested ending or a negative condition.

Inference is not a hard constraint: parents do not automatically imply child-friendly, a crime show does not automatically exclude documentaries, and a stage magician is not proof of supernatural powers. Rides, unreleased pilots, and unsuitable catalog versions are result-quality concerns; address them through general evidence rather than a blacklist of known title IDs.

A generator's self-reported relevance is a feature, not an independent quality measurement. The orchestrating assistant will compare actual lists and source evidence separately from model reranker scores. Record useful disagreements and counterexamples. Avoid claiming statistical validation or user acceptance from one assistant's review.

## Elimination and stopping

Discard a variant when it repeatedly loses request specificity, introduces explicit-constraint failures, or adds substantial latency/cost without a visible quality gain. Keep the established baseline as a control. Candidate coverage alone and average score alone cannot determine the winner.

A clear winner for this experiment must show a convincing, request-by-request quality advantage over the strongest surviving alternative on development and fresh confirmation requests, without hiding hard-constraint regressions, and with a stated acceptable speed/cost tradeoff. If a seemingly dominant option fails a counterexample, revise it and test again. Record each round's rationale and losses. If no option truly dominates, report that rather than manufacturing certainty; continue useful experiments while available alternatives remain.

This is description-search experimentation on a sample, not verification of all production search behavior, availability, exact-title routing, or the entire catalog. Mood requests previously skipped by text retrieval require a clearly identified sample fingerprint path to become evaluable.
