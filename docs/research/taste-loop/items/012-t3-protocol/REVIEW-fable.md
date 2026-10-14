# Review of amendment A3 by Fable (read-only), October 14, 2026

Saved by the orchestrator from the reviewer's final message.

**Verdict: accept with changes.**

1. **High. The harm rule as written blocks almost surely, so a "block" would not be one.** Every unknown label in a
   G1-only slot counts as harmful and the upper endpoint of the mean is the criterion; sessions with no answers are
   retained. A member with k unanswered or Can't tell G1-exclusive cards adds k to the bound; with the planned
   half-width 0.69 the average must stay under about 0.3 such cards per member. Six zero-answer members in 60 block by
   themselves. Change: Can't tell counts 0 for both scorers (the owner's rule names two answers); impute No answer and
   Seen-unrated at the scorer's observed per-slot harm rate on the member's answered cards in that ten (population
   rate if none); exclude sessions with no answer in the G1 ∪ B2 union and report them as non-response; keep the
   worst-case bound and the complete-answer table as reported figures.
2. **High. 60 first exposures with a count-only stop is infeasible on this census and has no date fallback.** 96
   non-owner members have 20+ ratings, but only 31 ever rated in a second sitting; the 75% uptake assumption has no
   basis; the owner's direction is "recruit toward 20". Change: stop at the earlier of the 60th first exposure or a
   date fixed at the owner checkpoint (about 8 weeks after the first invitation), minimum 20 exposed, one analysis;
   the interval rules already make a smaller n honest. If an interim is wanted, two pre-registered looks (30 and 60)
   with z = 2.18 at both. Keep the smallest detectable effect in the verdict.
3. **Medium. One bad availability row blocks the whole window.** Hash mismatches block; after-the-fact ineligibility
   is reported per card and blocks only above a pre-set share, say 5% of exposed G1/B2 top-ten cards.
4. **Medium. The harm row assumes true extra harm 0, which the evidence contradicts** (G1's top is far more popular
   and holds more disliked titles). At +0.25 the draft's own figure needs 105 members. State that at the realistic
   harm case the test is more likely inconclusive than passing at any feasible n.
5. **Low. B3's four slots carry no information** (G1's first positions are B3's order). Drop B3 or take its ranks
   11–14 and say why.
6. **Low. Availability on the card differs between G1 and B2.** Say the judged object is "the suggestion as the
   product would show it, availability included", or hide it.
7. **Low. Over-specified storage.** Specify what must be recoverable, not the schema.

A3(c) is precise; add "each mix is a separate guard, and both must pass". No way to report a false win was found;
findings 1 and 2 are the two ways to report a false block.
