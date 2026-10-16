# T5 results: whose Taste is this (S screen, October 16, 2026)

Registered run `run-20261016f` (private), registration `PREREG.md` (commits `04f515b2`, `79135120`). Aggregates
only. An earlier job in `run-20261016e` ran the harness's fake reader; it was never scored (see the incident in
`PREREG.md`). Review: `REVIEW-fable-result.md`.

**Registered verdict: the screen does not pass.** GPT-6 Astra clears every rule. Haiku 5.5 meets the 43 1/3% share
line and beats its numbers-only control, but its excess over chance has a 95% interval that includes zero, and the
rule needs both readers. Both readers point the same way. Unreplicated: 12 members, movie-only lists.

## Run

- 12 members, 47 triples (movie-only later lists, amendment A1). Readers ran apart: Haiku 5.5 (`claude-haiku-5-5`,
  effort low; 141 calls, US$0.11, 610 s), then GPT-6 Astra (`gpt-6-astra`, reasoning low; 141 calls, 2.2 M input
  tokens of which 1.5 M cached, 937 s).
- No transport failure, malformed answer, tool use or void in either suite. Fresh-process scoring replay: match.

## Primary

Member-weighted share correct, paired bootstrap over members (10,000 draws, seed 20261013). Chance is 1/3.

| Reader | Input | Correct | 95% interval | Excess over 1/3 | SDE |
|---|---|---:|---|---:|---:|
| Haiku | S | 46.5% | 30.6% to 62.5% | +13.2 (−2.8 to +29.2) | 23.8 |
| Haiku | numbers only | 34.0% | 20.1% to 50.7% | +0.7 | 23.3 |
| Haiku | no description | 29.9% | 20.1% to 39.6% | −3.5 | 14.5 |
| Haiku | permuted key | 23.6% | 12.5% to 34.7% | −9.7 | 16.2 |
| Astra | S | 75.0% | 56.2% to 89.6% | +41.7 (+22.9 to +56.3) | 25.9 |
| Astra | numbers only | 35.4% | 18.8% to 52.1% | +2.1 | 25.1 |
| Astra | no description | 35.4% | 18.8% to 54.2% | +2.1 | 26.5 |
| Astra | permuted key | 20.8% | 10.4% to 33.3% | −12.5 | 16.9 |

S minus numbers only, paired: Haiku +12.5 points (4.2 to 22.9; SDE 13.6; 5 members improved, 7 tied, 0 worse);
Astra +39.6 points (18.8 to 60.4; SDE 30.4).

| Rule | Haiku | Astra |
|---|---|---|
| Share at least 43 1/3% | met (46.5%) | met (75.0%) |
| Excess over chance, interval above zero | **not met** (−2.8 to +29.2) | met |
| S beats numbers only, interval above zero | met | met |
| No-description and permuted controls not positive | met | met |

At n = 12 with an SDE of 23.8 points, Haiku's miss says little: it is absence of evidence, not evidence of absence.

## Descriptive (no effect on the verdict)

- **Answer positions in S (A/B/C):** Haiku 9/21/17, Astra 16/16/15, against answer keys 15/17/15. With no
  description Haiku answered A in 44 of 47 triples: a position habit, at chance by construction.
- **Highest-mean prior:** under numbers only, both readers pick the list with the highest mean (Astra 37 of 47,
  Haiku 31 of 47). Balanced anchor ranks keep that at chance. In S, Astra is right in every triple where the
  member's list also has the highest mean and in 60% of the rest; the words add correct answers at every rank.
  Haiku's S answer equals its numbers-only answer in 35 of 47 triples: it mostly follows the prior.
- **Pooled triples correct in S:** Haiku 22 of 47, Astra 35 of 47.
- **Residual title cues** (known gap for any replication): in three of Astra's correct triples a title link
  survived removal (a show named in the description with a same-named movie in the list; a same-character film
  under a different franchise id). Without them Astra has 32 of 44; the verdict does not change.

| Subset | Reader | Members | Triples | S correct (95% interval) | S minus numbers (95% interval) |
|---|---|---:|---:|---|---|
| Unedited lists | Haiku | 9 | 30 | 48.1% (24.1% to 73.1%) | +11.1 (0.0 to +22.2) |
| Unedited lists | Astra | 9 | 30 | 72.2% (47.2% to 91.7%) | +38.9 (+11.1 to +69.4) |
| Early history 40–79 | Haiku | 5 | 19 | 41.7% (16.7% to 66.7%) | +5.0 (0.0 to +15.0) |
| Early history 40–79 | Astra | 5 | 19 | 75.0% (35.0% to 100.0%) | +45.0 (+15.0 to +80.0) |
| Early history 80–159 | Haiku | 4 | 16 | 43.8% (25.0% to 81.2%) | +6.2 (0.0 to +18.8) |
| Early history 80–159 | Astra | 4 | 16 | 68.8% (37.5% to 93.8%) | +12.5 (−12.5 to +37.5) |
| Early history 160+ | Haiku | 3 | 12 | 58.3% (50.0% to 75.0%) | +33.3 (+25.0 to +50.0) |
| Early history 160+ | Astra | 3 | 12 | 83.3% (75.0% to 100.0%) | +66.7 (+50.0 to +75.0) |

Show-share strata are struck by A1 (all lists are movies). No member had fewer than 40 early ratings.
The pooled-triple binomial assumes independent trials and is not used for the decision. No product authorization.
