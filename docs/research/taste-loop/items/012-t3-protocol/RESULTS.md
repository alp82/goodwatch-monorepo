# Item 012: T3 choices and sample-size plan

October 14, 2026. Amendment A3 and the builder/analyst specification are in `../../PROTOCOL.md` sections
4a, 4c and 13. Two-family review is pending; invitations/exposure still wait for the owner's checkpoint.

**Pool:** G1/B2 first 10 each; standardized taste B3, pooled predictor B5 and GoodWatch score alone first 4
each; 8 uniform random slots. Deduplicate, retain every evaluated top-ten title, fill a short union randomly
to 24, shuffle and blind. Maximum 40 cards. Random slots can overlap scorer selections; filler is separate.
Before exposure, ledger all six full-ranking hashes plus input, pool/display, code and protocol digests.
Freeze per-member inputs/cards; permutation and member-bootstrap seed `20261014`, 10,000 draws.

**Eligibility/answers:** consenting non-owner members with 20+ ratings, 5+ ratings of 8+, usable B2 Taste and
40+ eligible titles. Titles require poster, score, 1,000+ votes, fingerprint and past release; exclude ratings,
Want to See, Skip, Not interested and recorded watching/Seen/Dropped. Apply known country/services availability;
flag unknown/stale availability. Keep all five answers and partial sessions. Missing/Can't tell supply no
expressed hit and unknown harm; Seen it without a rating has unknown harm. Shared title judgments serve every
scorer. Bound unknown exclusive G1 slots as harmful and exclusive B2 slots as harmless for safety.

**Decision:** paired mean G1−B2 unseen Want to See hits per ten; estimate ≥+1 and 95% lower endpoint >0.
Harm is Not for me plus Seen it rated ≤5; its conservative 95% upper endpoint must be <+1. Equality or wide
uncertainty blocks. Decline Fable's noisy random-point veto; report random harm with intervals and equivalent
per-ten rates. Report novel/familiar hits, seen-high titles, franchise repeats and availability. Binding
mix/franchise guards reject demonstrated worsening. A3(c) fixes per-view absolute mix distance before member
averaging for all future candidates, with signed gaps alongside. Pass can establish G1; fail/inconclusive keeps B2.

**Planning:** T2a first-50 high retrieval is G1 .102482 versus B2 .018942; low .030302 versus .001125.
These watched-title retrieval shares are not unseen-title response probabilities. Assume independent members,
ten Bernoulli slots per scorer, no overlap variance discount, clustering variance multiplier 2, classifiable
labels, hit probabilities .30/.20 and harm .25/.25. Normal 80% planning uses `1.96 + .84 = 2.80`:

| Question | Paired variance | Members |
|---|---:|---:|
| Detect +1 primary hit against zero | `2×10×(.30×.70 + .20×.80) = 7.4` | `ceil(2.80²×7.4) = 59` |
| Harm upper endpoint <+1 at true extra harm 0 | `2×10×(.25×.75 + .25×.75) = 7.5` | `ceil(2.80²×7.5) = 59` |
| Pass primary floor and interval at hits .35/.20 (gain +1.5) | `2×10×(.35×.65 + .20×.80) = 7.75` | `max(ceil(2.80²×7.75/1.5²), ceil(.84²×7.75/.5²)) = 28` |

Choose **60 first exposures**, then one analysis after submission/14-day session closure; no peeking or partial
session replacements. At 60, SDEs ≈.98/.99; at 20, ≈1.70/1.71. Detection power differs from floor passage:
true +1 meets the point floor about half the time; true +1.5 gives ≈92% primary passage at 60. True extra harm
+.25 needs 105 members; +.50 needs 236. The census supplies at most 96 non-owner members with 20+ ratings
before exclusions. Sixty requires ≥62.5% of that ceiling, or 80 eligible invitations at assumed 75% uptake.
Actual eligibility, uptake and variation remain unknown; recruitment below 60 blocks the fixed checkpoint.

**Frozen SHA-256:** G1 `e864bd47ced025f9641fdbfe041e3b7bd5717dac77f8d8d67cf26c9705feebd1`;
B2 `0a3aacc3ade1854fd6d9d7c9104bab91769ca35531ef004dcef1507ebd1e258c`.
Normal development adds a flagged page and isolated `user_taste_judgment` table. Select-only exports go to
private sealed packs with keyed member hashes; repository output stays hashes/aggregates. Privacy unchanged.
Only the two requested documents changed; no code, ledger, production, experiment, gate read or commit.
