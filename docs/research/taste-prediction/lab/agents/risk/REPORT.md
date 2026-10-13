# risk: the rating distribution and bad titles (round 3)

## Result in one paragraph

None of the 13 pre-specified inputs improves the rating distribution once the pooled point score is known: not for the owner, not for the 22 other members, not as a shift, a spread or a low-tail effect. The point score already carries them. The risk of a bad title is, to the limit of what 744 ratings can show, a function of the predicted score alone, and it is well calibrated. The one change that held is the form of the distribution: a proportional-odds model on the score (10 numbers per member) replaces nine separate logistic fits (18 numbers). It is slightly better for the owner and clearly better for the others. Better bad-title predictions now have to come from a better point score (the `scores` agent's work), not from the distribution.

## 1. Everything scored

Harness (owner 10-fold, others 5-fold, alpha 0.5):

| name | owner mae | macro_mae | rho | mae_bad | pred on bad | auc_bad | others skill | others rho |
|---|---|---|---|---|---|---|---|---|
| pooled/h_shape.py (round-2 leader, from the ledger) | 0.774 | 0.931 | 0.590 | 1.35 | 5.83 | 0.872 | 0.123 | 0.408 |
| **risk/best.py** (pooled score + proportional-odds distribution) | 0.773 | 0.944 | 0.590 | 1.40 | 5.89 | 0.872 | 0.150 | 0.434 |

The owner difference (macro 0.931 against 0.944) is inside noise; the others' gain (0.123 to 0.150) is the real one.

Distribution measures (3 split seeds x 5 folds, same cached point scores for every row; owner / mean of 22 others):

| distribution | owner log loss | owner Brier <=5 | owner Brier >=8 | owner auc_bad | owner mae | owner macro | others log loss | others Brier <=5 | others skill |
|---|---|---|---|---|---|---|---|---|---|
| member's histogram (no title information) | 1.655 | 0.0852 | 0.2412 | 0.50 | 0.937 | 1.333 | 1.795 | 0.1256 | 0.008 |
| `thr`: nine logistic fits on the score (round 2) | 1.446 | 0.0672 | 0.1844 | 0.866 | 0.776 | 0.948 | 1.749 | 0.1029 | 0.142 |
| **`po`: proportional odds on the score (kept)** | 1.437 | 0.0673 | 0.1841 | 0.867 | 0.774 | 0.954 | 1.667 | 0.1028 | 0.147 |
| `ls`: + spread depends on the score | 1.438 | 0.0673 | 0.1842 | 0.867 | 0.774 | 0.951 | 1.672 | 0.1035 | 0.144 |

`po` against `thr`, paired: owner log loss -0.009 ± 0.006, others -0.082 ± 0.018 (21 of 22 members better). Brier unchanged.

## 2. The per-input table

Each input added alone to `po`. Paired difference x1000 (negative = better), mean ± standard error; owner over 744 ratings, others over 22 members with the count of members improved. Effects are shrunk to the value learned across the other members (every other member with 40+ ratings, 36 members). Roles: L = shifts the whole distribution, T = moves only the mass at 5 or less, S = widens or narrows it.

| input (reason) | role | owner log loss | owner Brier <=5 | others log loss | others Brier <=5 | verdict |
|---|---|---|---|---|---|---|
| audience minus critics (owner follows audiences) | L | +1.5 ± 0.6 | +0.2 ± 0.1 | -1.4 ± 2.7 (11) | -0.2 ± 0.4 | no |
| | T | +1.1 ± 0.5 | +0.2 ± 0.1 | +4.8 ± 1.6 (4) | +0.5 ± 0.4 | no |
| size of that gap | S | -0.2 ± 1.5 | -0.1 ± 0.2 | +7.4 ± 1.7 (2) | +0.4 ± 0.3 | no |
| critics above audience only / audience above critics only | T | +0.7 ± 0.5 / +1.1 ± 0.8 | +0.2 / +0.2 | +2.2 ± 1.1 / +6.4 ± 2.0 | +0.3 / +0.8 | no |
| spread across the six sources (disagreement = wider) | S | +0.4 ± 0.4 | 0.0 | +6.5 ± 1.8 (2) | +0.3 ± 0.1 | no |
| IMDb minus the other sources | L / T / S(size) | +1.5 ± 0.4 / +0.1 ± 1.2 / +1.0 ± 0.4 | +0.1 / 0.0 / +0.1 | +0.6 / +0.7 / +3.4 | +0.3 / +0.5 / +0.1 | no |
| IMDb vote count (few votes = unreliable) | L | +0.6 ± 0.9 | +0.1 ± 0.1 | -3.6 ± 1.5 (13) | -0.4 ± 0.3 | no (see note) |
| | T / S | +0.7 ± 0.7 / +1.3 ± 0.7 | +0.1 / +0.2 | +10.5 ± 5.6 / -0.9 ± 2.0 | +1.8 / -0.1 | no |
| missing sources (0 to 4) | L / T / S | +0.8 / +1.3 / +0.9 (± 0.7 to 0.9) | 0.0 / +0.3 / 0.0 | +0.5 / +5.3 / +1.8 | 0.0 / +0.9 / 0.0 | no |
| hype: many votes and below-average score | L | -1.9 ± 4.0 | +0.8 ± 1.0 | +0.5 ± 0.7 (8) | +0.2 ± 0.3 | no |
| | T / S | +2.1 ± 0.5 / +1.4 ± 0.4 | +0.5 / +0.1 | +3.2 ± 2.0 / +2.4 ± 1.2 | +0.1 / +0.2 | no |
| season decline (later seasons minus first, IMDb) | L / T | -1.2 ± 1.5 / +0.6 ± 1.7 | -0.2 / -0.1 | +2.7 ± 1.5 / +3.6 ± 1.0 | +0.3 / +0.4 | no |
| sequel (keyword or later series entry) | L | +0.5 ± 1.9 | -0.4 ± 0.4 | +1.2 ± 1.2 (7) | +0.3 ± 0.2 | no |
| | T / S | -0.2 ± 2.0 / +1.3 ± 0.9 | -0.4 ± 0.6 / +0.1 | +9.6 ± 3.6 (0) / +7.1 ± 2.2 | +1.3 / +0.6 | no |
| kind: big spectacle adventure | L / T / S | -0.4 ± 2.3 / +0.5 ± 0.3 / +0.9 ± 0.6 | +0.3 / +0.1 / 0.0 | +2.5 / +4.9 / +6.0 | +0.1 / +0.1 / 0.0 | no |
| kind: light comedy | L / T / S | +0.8 / +0.5 / +1.0 | +0.1 / +0.1 / 0.0 | +2.6 / +3.9 / +4.0 | +0.6 / +0.5 / +0.1 | no |
| linear model minus trees (model disagreement) | L / T | +0.3 ± 0.8 / +1.2 ± 0.8 | 0.0 / +0.4 | +5.0 ± 2.1 / +18.8 ± 5.3 | +1.0 / +1.4 | no |
| size of that disagreement | S | +2.7 ± 0.9 | +0.1 ± 0.1 | +7.5 ± 2.1 (4) | +0.6 ± 0.4 | no |
| is a show | L / T / S | +1.3 / -0.5 ± 1.2 / -3.7 ± 2.8 | 0.0 / +0.2 / +0.3 | +1.5 / +3.7 / +1.1 | +0.1 / -0.3 / +0.3 | no |
| mean audience score, mean critic score, Metacritic user score | L | -0.9 ± 3.5 / +2.6 ± 1.3 / -1.2 ± 3.1 | +1.7 ± 0.6 / +0.3 / +1.1 ± 0.5 | -2.8 ± 1.8 / -1.2 ± 2.8 / -1.2 ± 1.7 | +0.2 / +0.4 / 0.0 | no |
| same three | T | +0.8 / +1.1 / +0.5 | +0.1 / +0.2 / +0.1 | +7.5 / +6.4 / +7.5 | +0.7 / +0.8 / +0.8 | no |
| low tail gets its own slope on the score | T | +0.4 ± 1.0 | -0.1 ± 0.2 | +44 ± 20 (3) | +5.0 ± 2.7 | no |
| post-hoc: IMDb points under 7.0 | L / T | +1.5 ± 1.4 / +0.9 ± 0.3 | +0.5 / +0.1 | -2.2 ± 1.0 / +6.3 ± 5.5 | -0.1 / +0.2 | no |
| all ten signed inputs as low-tail effects | T | +4.0 ± 3.0 | +0.5 ± 0.8 | +70 ± 17 (0) | +8.4 ± 2.9 | worse |
| all inputs in all three roles (25 effects) | LST | +11.4 ± 7.4 | +2.1 ± 1.3 | +139 ± 23 (1) | +11.1 ± 2.8 | worse |
| positive control: tree part hidden from the score, given back as an input | L | -21.3 ± 4.4 | -1.5 ± 0.7 | -7.0 ± 4.0 (14) | -1.1 ± 0.7 | found |

Note on vote count: with the effect fixed at the population value (no personal part) it gives the others -1.2 ± 0.4 log loss (18 of 22) and the owner -0.7 ± 0.6. That is a shift of the mean, a thousandth of a nat, and belongs in the point model if anywhere. Not kept.

No input passes the rule (better for the others as well, or for the owner by a clearly significant margin). The positive control shows the test finds an input of real size at 5 standard errors, so the nulls are not a blind test. Without pooling (owner's data only) the results are the same; the population effects are all near zero (largest: hype -0.12, Metacritic user +0.17 on standardised inputs).

Cross-check without any model: inside each group the bad titles observed match the number the score-only risk expects (owner, cross-validated):

| group | titles | bad observed | bad expected from the score | z |
|---|---|---|---|---|
| all | 744 | 9.4% | 9.4% | |
| sequel | 132 | 21.2% | 17.2% | +1.3 |
| hype, top fifth | 271 | 20.3% | 17.5% | +1.3 |
| audience well above critics | 230 | 17.8% | 15.2% | +1.3 |
| IMDb well above the other sources | 170 | 22.4% | 20.3% | +0.8 |
| sources disagree most | 144 | 17.4% | 18.0% | -0.2 |
| big spectacle adventure | 204 | 15.7% | 14.1% | +0.7 |
| light comedy | 86 | 16.3% | 14.8% | +0.4 |
| critics well above audience | 131 | 6.9% | 5.7% | +0.7 |
| shows | 105 | 2.9% | 5.3% | -1.2 |
| linear model well above trees | 149 | 9.4% | 7.1% | +1.2 |

These groups are riskier (round 1 and 2 were right about that), but the score already says so. No |z| reaches 2 for the owner or for the others pooled (3,043 ratings).

## 3. How low can a justified prediction go, and how many bad titles can be flagged

Owner, cross-validated, 70 bad titles of 744 (46 rated 5, 17 rated 4, 6 rated 3, 1 rated 2).

Risk P(rating <= 5) is calibrated across its whole range:

| risk shown | titles | bad predicted | bad observed |
|---|---|---|---|
| under 5% | 380 | 2.5% | 1.0% |
| 5 to 10% | 164 | 7.2% | 6.7% |
| 10 to 20% | 110 | 14.0% | 17.8% |
| 20 to 30% | 38 | 24.9% | 28.1% |
| 30 to 40% | 23 | 34.8% | 39.7% |
| 40 to 50% | 13 | 43.7% | 44.7% |
| 50 to 70% | 12 | 57.6% | 57.1% |
| over 70% | 5 | 76.3% | 78.6% |

Flagging by risk:

| flag when risk is at least | titles flagged | precision | recall | bad titles caught |
|---|---|---|---|---|
| 10% | 200 | 0.28 | 0.79 | 55 of 70 |
| 20% | 90 | 0.40 | 0.51 | 36 |
| 30% | 52 | 0.49 | 0.36 | 25 |
| 40% | 29 | 0.56 | 0.23 | 16 |
| 50% | 16 | 0.64 | 0.15 | 10 |
| 60% | 8 | 0.83 | 0.10 | 7 |

The predicted rating ("predicted 5 or less" = rounds to 5 or less):

| decision | mae | macro_mae | mae on bad | mean prediction on bad | predicted <= 5 | precision | recall | predicted <= 4 |
|---|---|---|---|---|---|---|---|---|
| alpha 0 (plain median) | 0.770 | 1.018 | 1.69 | 6.20 | 16 titles | 0.64 | 0.15 | 2 |
| **alpha 0.5 (delivered)** | 0.774 | 0.954 | 1.43 | 5.94 | 50 titles | 0.49 | 0.35 | 4 |
| alpha 0.75 | 0.788 | 0.918 | 1.26 | 5.77 | 79 titles | 0.42 | 0.47 | 4 |
| alpha 1 | 0.819 | 0.911 | 1.15 | 5.62 | 114 titles | 0.36 | 0.58 | 5 |

Honest answer:
- The lowest justified prediction is about 4, and only for 2 to 5 titles of 744. A 3 or lower is never justified: no title comes near a majority probability of 3 or less, and the owner gave only 7 such ratings.
- A prediction of 5 is justified (more likely bad than not) for about 16 titles; two thirds of them are bad.
- The average prediction on bad titles cannot honestly go below about 5.9 at alpha 0.5. Pushing it to 5.6 (alpha 1) means flagging 114 titles of which 64% are not bad.
- 15 of the 70 bad titles have a risk under 10%. They look like good titles on every score (Tangled, The World's End, The Bourne Supremacy, The Raid, Star Wars: The Force Awakens). Nothing in the pack separates them.
- The better product statement is the risk beside the score: "6, 35% chance you rate it 5 or less" is calibrated; "4" almost never is.

## 4. What makes a title risky for the owner

Risk is the low end of the predicted score, and the score is driven by audience scores. In plain terms:
- **Low audience scores.** IMDb under 60: 40% bad (43 titles). IMDb 60 to 70: 20% bad (207 titles). IMDb 70 to 75: 4%. Above 75: 1 to 2%. Risk tracks IMDb (rank correlation -0.83), TMDB (-0.81), Metacritic user (-0.78), RT audience (-0.76) more than critics (-0.65, -0.68).
- **Critics do not rescue a title and do not sink it.** Critic-loved, audience-cool titles are not riskier than their score says (6.9% bad against 5.7% expected). Audience-liked, critic-panned titles are not safer either. The owner's audience lean is already in the point score; it has no extra effect at the low end.
- **Sequels and later franchise entries**: 21% bad against 7% elsewhere; at the same IMDb band sequels run about 8 points riskier, which the score captures (17% expected).
- **Big spectacle adventure and light comedy**: 16% bad each, also captured.
- **Much voted on but mediocre** ("hype"): 20% bad, captured.
- **Shows are safe**: 3% bad (probably because a show gets rated only after the owner chose to keep watching it).
- **Source disagreement** by itself is not a risk signal once the score is known (17.4% against 18.0% expected). Round 2's "17% bad against 5 to 6%" is true but is the low score, not the disagreement.

Riskiest titles (cross-validated risk, the owner's rating): The Mummy: Tomb of the Dragon Emperor 83% (4), Doom 72% (5), Fantastic Four: Rise of the Silver Surfer 72% (5), The Tuxedo 71% (5), Eragon 68% (5), Beethoven's 5th 67% (5), Final Destination 2 62% (4), AVP 54% (3), 2012 48% (3). High-risk titles he liked anyway: Plan 9 from Outer Space 71% (7), Be Cool 45% (8), Hardcore Henry 31% (8), Warcraft 28% (8), The Chronicles of Riddick 23% (9).

## 5. What worked, what failed

Worked:
- Proportional odds on the out-of-fold score: fewer numbers, better log loss for 21 of 22 members, equal for the owner.
- The risk is calibrated for the owner at every level, and for P(rating >= 8).

Failed (all listed in the table): every score-disagreement input, vote counts, missing sources, hype, season decline, sequel, kinds, model disagreement, spread depending on the score, a separate low-tail slope, pooled threshold effects, any combination. Putting all inputs in together reproduces the round-2 failure in miniature (others' log loss +0.07 to +0.14).

## 6. What I expect on locked ratings

- Owner point measures equal to pooled/h_shape.py within noise, since the score is the same: mae about 0.85, macro about 1.09 to 1.10, rho 0.606 and auc_bad 0.867 (identical ranking by construction).
- Others' skill about 0.14 to 0.15, at or slightly above h_shape's 0.140.
- Owner log loss about 1.45 to 1.52, Brier of P(<=5) about 0.07, calibration within sampling error. With 24 bad titles locked, "predicted 5 or less" should flag about 15 to 20 titles with roughly half of them bad; that precision has a standard error near 0.12.
- Nothing here was selected on the owner's development ratings except the choice of `po` over `thr`, which the others decide.

## 7. Files

- `agents/risk/best.py`: runs through the harness as is. `predict`, `distribution` (n x 10), `risk` (P(rating <= 5), `at_most` settable), `score`. About 5 to 11 minutes with `--others` depending on machine load (six point-model fits per call).
- `agents/risk/om.py`: the ordinal location-scale model (location, spread and low-tail inputs, penalties towards pooled priors, analytic gradient). `common.py`: loads the pooled point model by path. `feats.py` + `feats.npz`: the 19 rating-free inputs. `ev.py`, `configs.py`, `table.py`, `groups.py`, `tail.py`, `examples.py`: the evaluation. `cache/base_*.pkl`: out-of-fold point scores for 23 members x 4 seeds x 5 folds (reusable by any agent testing a distribution). `cache/res_*.pkl`: every config's distributions.

## 8. Next steps

1. Rebuild the distribution on the `scores` agent's improved point score: `best.py` takes any score, and auc_bad of the score is the ceiling of everything in section 3.
2. Show the risk beside the score in the product instead of forcing low numbers; choose alpha by how many false alarms the owner accepts (table in section 3).
3. For members with few ratings, shrink the nine thresholds towards a population shape: the others' log loss is dominated by small members, and that is where the form still has room.
