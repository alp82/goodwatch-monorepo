# Evaluation contract

Frozen on 2026-09-23 before any ranker is scored. Changes need a dated note at
the end of this file.

## Units

- A **ranker** maps a captured query (Jev reading, text pool, title lookup) plus
  the local catalog to an ordered list of titles.
- A **round** scores a set of rankers on the `dev` split. The `holdout` split is
  scored only for finalists, once per finalist.

## Grading

1. For each query, pool the top 10 of every ranker in the round.
2. Grade each pooled title that has no grade yet. Grades are reused across
   rounds, keyed by `(query id, point id)`.
3. Assessors see the query, its `intent`, and the title packet (title, year,
   type, genres, essence text, tags, top keywords). They don't see which ranker
   returned the title or its rank. Packets are shuffled with a fixed seed per
   query.
4. Scale:
   - 3: exactly what the query asks for, a top pick.
   - 2: clearly relevant, a good result.
   - 1: loosely related, one aspect matches.
   - 0: wrong, or it contradicts an explicit constraint.
5. Two independent agent assessors grade every pair. When they differ by 2 or
   more, a third assessor decides. Otherwise the grade is the rounded-down mean.
6. Assessors may use their own knowledge of well-known titles, but the packet
   takes precedence when they conflict.
7. The human calibration set is a fixed sample of about 40 pairs graded by the
   user. Agreement with it (weighted kappa) is reported, and systematic
   disagreements feed back as a dated note in this file.

## Metrics per ranker

- `ndcg10`: macro NDCG@10 over graded pools, gain `2^g - 1`. Ungraded titles
  count as 0, which can't happen within a round because every top 10 is pooled.
- `good10`: mean count of grade 2 or 3 in the top 10.
- `bad5`: total count of grade 0 in the top 5 across queries.
- `anchor10`, `anchor50`: share of `anchors.must` found in the top 10 or 50.
  `avoid5`: count of `anchors.avoid` in the top 5.
- Cost: added dollars per 1,000 searches beyond the Jev reading.
- Latency: estimated added p50 and p95 on the app server, from measured stage
  timings.

`title_lookup` queries are guardrails only: the expected title must stay at
rank 1 after the blend with the TMDB lookup. They are excluded from `ndcg10`.

## Winning

A finalist wins when, on the `holdout` split:

- its `ndcg10` beats production by at least 0.05 and every other finalist by at
  least 0.02,
- `bad5` is not higher than production's,
- no single query loses more than 0.15 NDCG against production, unless the
  review explains why the production grade was wrong,
- the added cost stays under $0.10 per 1,000 searches and the estimated p95 of
  the whole search stays under 1 s.

## Notes

- 2026-09-23, before any holdout scoring: finalists are `r3-combo`,
  `r3-combo-fast` and `sparse-fast`. `r3-combo` and `r3-combo-fast` differ
  only in whether the Crate text pool is added. If two finalists are within
  0.02 `ndcg10` of each other on holdout, the one with the lower estimated
  latency wins, provided it meets every other criterion. The "beats every
  other finalist by 0.02" rule applies between different ranker families
  only.
- 2026-09-23, after the holdout verdict (no finalist won; failures on "heist
  on a train" and "like Breaking Bad but a comedy"): the holdout split is now
  treated as dev for tuning ("dev+"). A new split `holdout2` of 22 unseen
  queries, written without looking at any ranker output, is the confirmation
  set. The win criteria stay the same, applied to `holdout2`. Round 4
  finalists are frozen before `holdout2` is scored.
- 2026-09-23, person and studio round: 24 new queries (`ppl-*`), 12 `dev`
  and 12 `holdout3`, written blind to rankers. The baseline is the accepted
  winner `r4-combo-fast`. The round-5 candidate is frozen before `holdout3`
  is scored. It wins when, on `holdout3`, it beats `r4-combo-fast` by at
  least 0.05 `ndcg10` with `bad5` not higher, and on all earlier splits
  (dev, holdout, holdout2) its `ndcg10` drops by no more than 0.01 against
  `r4-combo-fast`. People and studios are boosts, never filters (user
  decision). For style queries, a mix of the person's own titles and similar
  titles by others is wanted.
- 2026-09-23, round 5, before any round-5 grading: packets graded in round 5
  (all splits, including holdout3) also carry a `credits` field (up to 3
  directors, creators and writers, the top 5 billed cast, the first 3
  production companies and the networks), because person and studio
  relevance can't be judged from the essence text. Earlier grades stay as
  they are (add-only).
- 2026-09-23, round 6 (style queries and alternate cuts), set before any
  round-6 grading:
  - Grading rubric for `person_intent` style or both: grade by fit to the
    person's or studio's style. A genuinely similar title by someone else can
    earn 3, the same as the person's own films. Generic popular titles that
    share only a genre get 0 or 1. The rubric change applies to new pairs;
    style-query pairs graded before this note are re-graded under it.
  - A new metric `own10`: the count of the entity's own titles in the top 10
    for style queries. The user wants a mix, so the target range is 3 to 6.
  - Alternate cuts of one film (Redux, Extended, Director's Cut, "The Whole
    Bloody Affair") count once. A second cut in the top 10 is graded 0.
  - Confirmation split `holdout4`: about 12 new style and both queries,
    written blind. Round 6 wins when, on `holdout4`, it beats
    `r4-combo-fast` and `r5` by at least 0.05 `ndcg10`, `bad5` is not higher
    than either, the mean `own10` is within 3 to 6, and earlier splits drop
    by no more than 0.01 against `r5`.
