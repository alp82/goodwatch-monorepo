# T5 results: whose Taste is this, live Sides of you (#674, October 16, 2026)

Registered run `run-016-3cba031f` (private), registration `PREREG.md` (commit `3f66ac92`, before any reader call).
Production code pinned at `3cba031f`: the live Sides of you with the final short taste group names (Q65, Q66, Q70)
and the "Fits your taste" heading (Q71). Aggregates only. Review: `REVIEW-fable-result.md`.

An earlier registration on `0da351cd` was held when Q70 changed five names; that run is abandoned unscored and
unread (`HOLD.md`).

**Registered verdict: the screen passes on both of the owner's bars.** GPT-6 Astra picks the member's own later
ratings from their Sides of you panel text well above chance (bar 1, Q62) and well above what it gets from the
numbers alone (bar 2, Q67). No Astra control clears chance. The rule has one deciding reader; the owner set it
before this run and after item 015's result. Haiku 5.5 is descriptive: its interval includes chance. Unreplicated:
12 members, 36 triples, movie-only lists, one data pack, one pin.

The panel text is everything the Taste page shows for the Sides of you: the group names, the headline, attribute
labels, mood lines, and up to four example titles with ratings per group. No control separates the generated
wording from the example titles, so the pass is about the whole panel.

The readers are offline stand-ins for "does this text carry something personal". The product never calls an LLM.

## Run

- 12 members, 36 triples: three per member, with the member's list once at each mean rank (lowest, middle,
  highest). Readers ran apart: Haiku 5.5 (`claude-haiku-5-5`, effort low; 144 calls, US$0.06, 609 s), then GPT-6
  Astra (`gpt-6-astra`, reasoning low; 144 calls, 2.3 M input tokens of which 1.6 M cached, 891 s).
- No transport failure, malformed answer, tool use, or void in either suite. Fresh-process scoring replay: match.

## Primary

Member-weighted share correct, paired bootstrap over members (10,000 draws, seed 20261013). Chance is 1/3.

| Reader | Input | Correct | 95% interval | Pooled |
|---|---|---:|---|---:|
| Astra | S (the description) | 80.6% | 69.4% to 91.7% | 29 of 36 |
| Astra | nouns only | 47.2% | 22.2% to 69.4% | 17 of 36 |
| Astra | numbers only | 44.4% | 27.8% to 63.9% | 16 of 36 |
| Astra | no description | 33.3% | 16.7% to 52.8% | 12 of 36 |
| Astra | permuted key | 38.9% | 25.0% to 52.8% | 14 of 36 |
| Haiku | S (the description) | 47.2% | 30.6% to 66.7% | 17 of 36 |
| Haiku | nouns only | 44.4% | 22.2% to 69.4% | 16 of 36 |
| Haiku | numbers only | 41.7% | 22.2% to 61.1% | 15 of 36 |
| Haiku | no description | 36.1% | 33.3% to 41.7% | 13 of 36 |
| Haiku | permuted key | 36.1% | 22.2% to 50.0% | 13 of 36 |

Paired differences:

| Reader | S minus numbers only | S minus nouns only |
|---|---|---|
| Astra | +36.1 (+19.4 to +52.8); 10 members improved, 1 tied, 1 worse | +33.3 (+11.1 to +55.6) |
| Haiku | +5.6 (−22.2 to +30.6) | +2.8 (−16.7 to +19.4) |

| Registered rule | Result |
|---|---|
| Bar 1 (Q62): Astra share correct, interval above 33.3% | **met** (69.4% to 91.7%) |
| Bar 2 (Q67): Astra S minus numbers only, interval above zero | **met** (+19.4 to +52.8) |
| Validity guard: no Astra control with share interval above 33.3% | **met** (numbers 27.8%, none 16.7%, permuted 25.0% lower bounds) |
| Voids at most 10% | **met** (0) |

## Descriptive (no effect on the verdict)

The rank, prior, position, and residual-cue counts in this section were computed from the private records after
scoring, outside the registered scorer, as item 015 did. The scorer's `aggregate.json` doesn't hold them.

- **Rank of the member's list:** Astra's S is right 10 of 12 times when the member's list has the lowest mean, 8 of
  12 at the middle, and 11 of 12 at the highest. The panel carries the answer at every rank, not only where a
  high-mean prior would help.
- **Numbers-only prior:** with numbers only, Astra picks the highest-mean list in 19 of 36 triples and Haiku in 17.
  Balanced ranks keep that at chance. Astra's S answer equals its numbers-only answer in 19 of 36 triples; Haiku's
  in 15.
- **Nouns only:** the group nouns alone ("comedies", "war stories") give Astra 47.2%; the interval includes chance.
  The full panel adds 33.3 points over them (+11.1 to +55.6), so the result does not rest on the genre nouns.
- **Residual title cues:** no list title shares a normalized title or a production franchise prefix with a named
  example (both removed by design). A looser check, any shared word of four or more letters between a named title
  and a list title, flags 6 answer lists and 7 distractor lists. Without those 6 triples Astra has 24 of 30 (80%),
  the same rate as with them. Same-character films, remakes, and cast or director links can't be checked: the pack
  has no such identities.
- **Answer positions in S (A/B/C):** Astra 14/11/11, Haiku 13/11/12, against a key of 12/12/12. With no
  description Haiku answered A in 35 of 36 triples: a position habit, at chance by construction.
- **Build baselines:** middle mean 36.1%, outlier 36.1%, closest printed mean 36.1%, positions 33.3%. Media type
  41.7% is tie-breaking only (every list is movies only).
- **Item 015 comparison:** on the pre-#666 Sides (`6082cadc`), Astra had 75.0% and +39.6 over numbers only. The live
  Sides give 80.6% and +36.1. Different pins, matching, and triples, so this is a direction, not a paired contrast.

| Subset | Reader | Members | Triples | S correct (95% interval) | S minus numbers (95% interval) |
|---|---|---:|---:|---|---|
| Unedited lists | Haiku | 8 | 23 | 52.1% (27.1% to 77.1%) | +6.2 (−35.4 to +41.7) |
| Unedited lists | Astra | 8 | 23 | 81.2% (68.8% to 95.8%) | +27.1 (+4.2 to +45.8) |
| Early history under 40 | Astra | 1 | 3 | 66.7% | n/a |
| Early history 40–79 | Astra | 5 | 15 | 86.7% (73.3% to 100.0%) | +46.7 (+33.3 to +60.0) |
| Early history 80–159 | Astra | 4 | 12 | 83.3% (66.7% to 100.0%) | +33.3 (+8.3 to +58.3) |
| Early history 160+ | Astra | 2 | 6 | 66.7% (33.3% to 100.0%) | +50.0 (+33.3 to +66.7) |

Show-share strata are empty by design (all lists are movies). The pooled-triple binomial assumes independent
trials and is not used for the decision.

## What this licenses

- The live Sides of you panel, as members see it on the Taste page at `3cba031f` (names, labels, and example
  titles together), carries enough of a member's taste that one strong offline reader can tell their later
  ratings from two matched members', beyond what the ratings alone allow. That opens the words gate on map #652
  under the owner's rule.
- It does not show that the generated names or trait labels carry the signal without the example titles, that
  Haiku corroborates, that members recognize themselves, that the words improve recommendations, or that the
  effect holds for show-heavy members, members with fewer than 40 early ratings, another pack, or later data. No
  product authorization follows from a model screen.
- Low power: n = 12 members. A pass at this size means a large effect; the intervals are wide, and distractors
  shared between members make them somewhat too narrow. The margins absorb this.

## Follow-ups from the result review

- `score.py`: a tripped shortcut guard sets `pass: false` but not `invalid: true`, unlike the registration text.
  It did not trip here. Fix before the next registration.
- `run.rule_for` picks the Astra rule from `sides == 'live'`, not from the registration. Tie it to the PREREG
  before any further live run.
- Add wall-clock timestamps to the run ledger.
