# Holdout 2 metrics (round-4 finalists)

2026-09-23. Finalists `r4-combo` and `r4-combo-fast` (frozen in round 4, `run4.FINAL`), `prod` (captured list), and
the round-3 combos `r3-combo` / `r3-combo-fast` as references (not finalists). Split `holdout2`: 22 queries, 21 graded,
ho2-22 "the expanse" (title_lookup) is a guardrail only. Lists: `harness/holdout2.py lists`. No ranker code or config
changed and no query crashed. The r3 reference lists are identical in the top 10 to `run3.run` with `run3.FINAL`. New
query embeddings were computed with the same models through the `qemb` cache (bge-base +67 texts, multilingual-e5-small
+3; existing entries unchanged). The sparse and people index was used as built.

Grading: 398 new pairs (21 queries, 12-26 pooled titles each, top 10 of all five lists), 2 parts (216 / 182). Two
independent sonnet assessors: A in pool order, B with queries and items reversed (`results/grading/GRADER.md`).
A/B quadratic weighted kappa 0.902, exact agreement 78.4%. 5 pairs were 2+ apart and were settled by a blind
assessor C (`ho2-C.json`, packet only): ho2-09 The Empire Strikes Back 0 (A 0 / B 3), Star Trek Into Darkness 0
(0 / 2), Star Wars 0 (0 / 3), all built around alien species; ho2-10 Justice League: Crisis on Infinite Earths Part
One 1 (3 / 1); ho2-21 Deca-Dence 1 (2 / 0). Merged add-only into `results/grades.json` (2,675 → 3,073 pairs; no
existing grade touched). Files: `results/grading/ho2-*`.

## Verdict: no finalist wins

Applied mechanically (evaluation-contract.md, Winning and Notes):

| criterion | r4-combo | r4-combo-fast |
|---|---|---|
| ndcg10 ≥ prod + 0.05 (prod 0.518) | pass (0.710, +0.191) | pass (0.729, +0.211) |
| beats other-family finalists by ≥ 0.02 | n/a (no other family among the finalists) | n/a |
| Notes rule (same family within 0.02 → lower latency wins) | triggered: r4-combo-fast − r4-combo = 0.019 → **r4-combo loses** to the lower-latency variant | triggered → preferred (156 ms vs 30-45 ms), if it meets every other criterion |
| bad5 ≤ prod (31) | pass (16) | pass (17) |
| no query loses > 0.15 vs prod | **fail** (ho2-09 −0.434, ho2-02 −0.166) | **fail** (ho2-09 −0.442, ho2-21 −0.196, ho2-02 −0.164, ho2-05 −0.158) |
| added cost < $0.10 / 1k | pass ($0: local embedding, no LLM) | pass ($0) |
| est. whole-search p95 < 1 s | pass, marginal (~0.95 s: reading 0.44 + Crate tail ~0.5) | pass (~0.54 s: reading 0.44 + 75-100 ms) |
| **wins** | **no** | **no** |

The "unless the review explains why the production grade was wrong" exception doesn't apply: production's graded
titles on every losing query are graded correctly (below). The references would fail too: `r3-combo` on ho2-09 −0.434
and ho2-04 −0.202, `r3-combo-fast` on ho2-09, ho2-04 −0.433 and ho2-21 −0.196.

## Losing queries (> 0.15 below prod)

- **ho2-09 "space opera without aliens"** (prod 0.521, all four combos 0.080-0.087): every combo fills the top 10 with
  alien-heavy space operas (the Guardians of the Galaxy films, Star Wars, Clone Wars, Ahsoka, Deep Space Nine), all
  graded 0. Only one pooled title is graded 2 (Scavengers 2013, a human scavenger crew; A 2 / B 3), and production
  has it at #2. With a single good title in the pool, that one hit decides the query. Production's other nine titles
  are also 0, so the loss is real but thin. The cause is on our side: Jev reads "space opera" at 0.97, and the
  negation penalty (λ 0.1) plus the popularity prior can't push the famous alien space operas down. Coverage doesn't
  apply (no units, because the negated word is dropped).
- **ho2-02 "comedy set in a prison"** (prod 0.780; r4 0.614 / 0.616; r3 0.877 / 0.884): a round-4 regression. The
  facet-coverage units are `set`, `prison`, `comedy`. `set` is a generic word that `_GENERIC` doesn't filter, and it
  lifts non-prison workplace sitcoms (Drop the Dead Donkey, Trial & Error, The John Larroquette Show, all 0; Escape
  1) past Big Stan and Fanged Up (3). The fast variant without coverage (`r4-fast-nocov`, the existing ablation)
  scores 0.705. Production's 3s (The Longest Yard, Let's Go to Prison, Porridge, Hard Cell) are correct.
- **ho2-05 "war film about snipers"** (r4-combo-fast only; prod 0.811, r4-fast 0.654, r4 0.672, r3 0.807): also
  coverage. The `war` unit lifts generic war films (The Hurt Locker, Civil War, Warfare, Savior, all 1) over sniper
  films. `r4-fast-nocov` gives 0.805. Production has nine sniper films graded 3, correctly.
- **ho2-21 "dystopain deth game series"** (fast variants only; prod 0.629, fast 0.433, Crate variants 0.545): spell
  fixes "dystopain" but not "deth". Without the Crate text pool, Squid Game drops from #2 to #5, and video-game
  adaptations (Fallout, Captain Laserhawk, Cyberpunk: Edgerunners at #1 in every combo, all 0) take the head.
  Production has Danganronpa 3 at #1 (3), which is correct.
- Near misses: r4-combo on ho2-05 (−0.139). ho2-04 "western with samurai" is fixed by round 4 (r3 −0.20 / −0.43 → r4
  +0.06).

What it means (not a contract outcome): on unseen queries the round-4 finalists are +0.19 to +0.21 over production,
with about half its bad5, and r4-combo-fast is the best list at the lowest latency. But the round-4 coverage term
introduced two new failures (generic units `set` and `war`), negation of a concrete noun ("without aliens") is still
unsolved, and the fast variant loses a typo query without Crate.

## Summary

| ranker | ndcg10 | Δ vs prod | good10 | bad5 | anchor10 | anchor50 | avoid5 | title@1 | unj10 | queries < prod − 0.15 | est. p50 after reading | est. p95 whole search |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| prod | 0.518 | +0.000 | 3.95 | 31 | 0.202 | 0.325 | 1 | 1/1 | 0 | – | 235 ms | ~0.90 s |
| r4-combo | 0.710 | +0.191 | 5.62 | 16 | 0.353 | 0.595 | 2 | 1/1 | 0 | ho2-09 -0.434, ho2-02 -0.166 | 156 ms | ~0.95 s |
| r4-combo-fast | 0.729 | +0.211 | 5.71 | 17 | 0.369 | 0.635 | 2 | 1/1 | 0 | ho2-09 -0.442, ho2-21 -0.196, ho2-02 -0.164, ho2-05 -0.158 | 30-45 ms | ~0.54 s |
| r3-combo | 0.709 | +0.191 | 5.62 | 18 | 0.365 | 0.595 | 2 | 1/1 | 0 | ho2-09 -0.434, ho2-04 -0.202 | 156 ms | ~0.95 s |
| r3-combo-fast | 0.703 | +0.185 | 5.67 | 20 | 0.377 | 0.663 | 2 | 1/1 | 0 | ho2-09 -0.442, ho2-04 -0.433, ho2-21 -0.196 | 30-45 ms | ~0.54 s |

## Guardrails: title lookups

| query | expected | prod | r4-combo | r4-combo-fast | r3-combo | r3-combo-fast |
|---|---|---|---|---|---|---|
| ho2-22 the expanse | The Expanse | #1 | #1 | #1 | #1 | #1 |

## ndcg10 by query type

| type (queries) | prod | r4-combo | r4-combo-fast | r3-combo | r3-combo-fast |
|---|---|---|---|---|---|
| creator (2) | 0.666 | 0.845 | 0.900 | 0.845 | 0.900 |
| era_genre (2) | 0.281 | 0.902 | 0.879 | 0.884 | 0.838 |
| like_x_but_y (3) | 0.366 | 0.757 | 0.832 | 0.706 | 0.708 |
| long_descriptive (2) | 0.251 | 0.800 | 0.828 | 0.832 | 0.818 |
| negation (2) | 0.506 | 0.274 | 0.283 | 0.284 | 0.297 |
| non_english (1) | 0.694 | 0.803 | 0.803 | 0.803 | 0.803 |
| setting_mood (2) | 0.401 | 0.588 | 0.608 | 0.557 | 0.633 |
| short_vague (1) | 0.212 | 0.587 | 0.587 | 0.587 | 0.587 |
| subject_object (5) | 0.807 | 0.775 | 0.799 | 0.808 | 0.770 |
| typo (1) | 0.629 | 0.545 | 0.433 | 0.545 | 0.433 |
| all (21) | 0.518 | 0.710 | 0.729 | 0.709 | 0.703 |

## ndcg10 per query (diff vs prod, sorted by r4-combo-fast − prod)

| query | type | prod | r4-combo | r4-combo-fast | r3-combo | r3-combo-fast |
|---|---|---|---|---|---|---|
| ho2-09 space opera without aliens | negation | 0.521 | 0.087 (-0.43) **LOSS** | 0.080 (-0.44) **LOSS** | 0.087 (-0.43) **LOSS** | 0.080 (-0.44) **LOSS** |
| ho2-21 dystopain deth game series | typo | 0.629 | 0.545 (-0.08) | 0.433 (-0.20) **LOSS** | 0.545 (-0.08) | 0.433 (-0.20) **LOSS** |
| ho2-02 comedy set in a prison | subject_object | 0.780 | 0.614 (-0.17) **LOSS** | 0.616 (-0.16) **LOSS** | 0.877 (+0.10) | 0.884 (+0.10) |
| ho2-05 war film about snipers | subject_object | 0.811 | 0.672 (-0.14) | 0.654 (-0.16) **LOSS** | 0.807 (-0.00) | 0.805 (-0.01) |
| ho2-11 claustrophobic thriller in the Arctic | setting_mood | 0.393 | 0.334 (-0.06) | 0.333 (-0.06) | 0.320 (-0.07) | 0.473 (+0.08) |
| ho2-10 animated movie that is not for kids | negation | 0.491 | 0.461 (-0.03) | 0.485 (-0.01) | 0.481 (-0.01) | 0.514 (+0.02) |
| ho2-03 anime about pirates | subject_object | 1.000 | 1.000 (+0.00) | 1.000 (+0.00) | 1.000 (+0.00) | 1.000 (+0.00) |
| ho2-16 jackie chan movies | creator | 0.946 | 0.964 (+0.02) | 0.964 (+0.02) | 0.964 (+0.02) | 0.964 (+0.02) |
| ho2-04 western with samurai | subject_object | 0.790 | 0.853 (+0.06) | 0.853 (+0.06) | 0.588 (-0.20) **LOSS** | 0.357 (-0.43) **LOSS** |
| ho2-19 Una comedia absurda sobre la vida en la oficina, con pe | non_english | 0.694 | 0.803 (+0.11) | 0.803 (+0.11) | 0.803 (+0.11) | 0.803 (+0.11) |
| ho2-08 like Amélie | like_x_but_y | 0.508 | 0.629 (+0.12) | 0.629 (+0.12) | 0.759 (+0.25) | 0.759 (+0.25) |
| ho2-01 horror on a submarine | subject_object | 0.655 | 0.737 (+0.08) | 0.870 (+0.22) | 0.769 (+0.11) | 0.807 (+0.15) |
| ho2-20 epic | short_vague | 0.212 | 0.587 (+0.38) | 0.587 (+0.38) | 0.587 (+0.38) | 0.587 (+0.38) |
| ho2-15 terry gilliam | creator | 0.387 | 0.727 (+0.34) | 0.836 (+0.45) | 0.727 (+0.34) | 0.836 (+0.45) |
| ho2-06 like Band of Brothers but about Vietnam | like_x_but_y | 0.455 | 0.705 (+0.25) | 0.929 (+0.47) | 0.678 (+0.22) | 0.684 (+0.23) |
| ho2-12 lazy sunny summer on the Italian coast | setting_mood | 0.410 | 0.843 (+0.43) | 0.884 (+0.47) | 0.793 (+0.38) | 0.794 (+0.38) |
| ho2-18 A soldier comes home from war and can't fit back into o | long_descriptive | 0.329 | 0.779 (+0.45) | 0.809 (+0.48) | 0.782 (+0.45) | 0.786 (+0.46) |
| ho2-13 70s paranoid conspiracy thrillers | era_genre | 0.290 | 0.921 (+0.63) | 0.874 (+0.58) | 0.899 (+0.61) | 0.825 (+0.53) |
| ho2-14 2000s British gangster comedies | era_genre | 0.272 | 0.883 (+0.61) | 0.883 (+0.61) | 0.870 (+0.60) | 0.851 (+0.58) |
| ho2-17 A small-town cop who is way out of their depth investig | long_descriptive | 0.173 | 0.822 (+0.65) | 0.847 (+0.67) | 0.881 (+0.71) | 0.851 (+0.68) |
| ho2-07 like The Sopranos but in Italy | like_x_but_y | 0.136 | 0.939 (+0.80) | 0.939 (+0.80) | 0.681 (+0.55) | 0.681 (+0.55) |

## Queries more than 0.15 below prod: top 10 with grades

### ho2-02 comedy set in a prison

Intent: Comedies whose main setting is a prison or jail. Serious prison dramas are wrong; comedies with only a brief jail scene are loosely relevant.

| rank | prod | r4-combo | r4-combo-fast | r3-combo | r3-combo-fast |
|---|---|---|---|---|---|
| 1 | Hard Cell (2022) **3** | Porridge (1979) **3** | Porridge (1979) **3** | Hard Cell (2022) **3** | Hard Cell (2022) **3** |
| 2 | Prison Playbook (2017) **2** | Sprung (2022) **1** | Sprung (2022) **1** | Porridge (1979) **3** | Porridge (1979) **3** |
| 3 | Porridge (1979) **3** | Hard Cell (2022) **3** | Escape (2024) **1** | Sprung (2022) **1** | Sprung (2022) **1** |
| 4 | Let's Go to Prison (2006) **3** | Escape (2024) **1** | Hard Cell (2022) **3** | Let's Go to Prison (2006) **3** | Let's Go to Prison (2006) **3** |
| 5 | Out of Tune (2019) **0** | Prison Playbook (2017) **2** | Let's Go to Prison (2006) **3** | Prison Playbook (2017) **2** | Fanged Up (2017) **3** |
| 6 | Sprung (2022) **1** | Orange Is the New Black (2013) **2** | Drop the Dead Donkey (1990) **0** | Fanged Up (2017) **3** | Big Stan (2007) **3** |
| 7 | Fanged Up (2017) **3** | Let's Go to Prison (2006) **3** | Trial & Error (2017) **0** | Big Stan (2007) **3** | Prison Playbook (2017) **2** |
| 8 | Old Men in New Cars: In China They Eat Dogs II (2002) **0** | Drop the Dead Donkey (1990) **0** | The John Larroquette Show (1993) **0** | Orange Is the New Black (2013) **2** | We're No Angels (1989) **1** |
| 9 | The Longest Yard (1974) **3** | Trial & Error (2017) **0** | We're No Angels (1989) **1** | Get Hard (2015) **1** | Orange Is the New Black (2013) **2** |
| 10 | Chozen (2014) **1** | The John Larroquette Show (1993) **0** | Fanged Up (2017) **3** | I Love You Phillip Morris (2010) **2** | I Love You Phillip Morris (2010) **2** |
| ndcg10 | 0.780 | 0.614 | 0.616 | 0.877 | 0.884 |

### ho2-04 western with samurai

Intent: Westerns that bring a samurai or Japanese swordsman into the frontier setting, or samurai films styled as westerns. A plain western or a plain samurai film is only loosely relevant.

| rank | prod | r4-combo | r4-combo-fast | r3-combo | r3-combo-fast |
|---|---|---|---|---|---|
| 1 | Red Sun (1971) **3** | Red Sun (1971) **3** | Red Sun (1971) **3** | Sukiyaki Western Django (2007) **3** | The Good, the Bad, the Weird (2008) **1** |
| 2 | Sukiyaki Western Django (2007) **3** | Sukiyaki Western Django (2007) **3** | Sukiyaki Western Django (2007) **3** | Samurai Champloo (2004) **0** | 13 Assassins (2010) **1** |
| 3 | Gintama (2017) **0** | Unforgiven (2013) **3** | Unforgiven (2013) **3** | 13 Assassins (2010) **1** | Sukiyaki Western Django (2007) **3** |
| 4 | Prisoners of the Ghostland (2021) **3** | The Good, the Bad, the Weird (2008) **1** | The Good, the Bad, the Weird (2008) **1** | Seven Samurai (1954) **1** | Samurai Champloo (2004) **0** |
| 5 | The Challenge (1982) **0** | Yojimbo (1961) **1** | Yojimbo (1961) **1** | The Good, the Bad, the Weird (2008) **1** | Seven Samurai (1954) **1** |
| 6 | The Magnificent Seven (1998) **1** | Seven Samurai (1954) **1** | 13 Assassins (2010) **1** | Lone Wolf and Cub: Baby Cart at the River Styx (1972) **1** | Yojimbo (1961) **1** |
| 7 | Shogun Assassin (1980) **1** | Samurai Champloo (2004) **0** | Samurai Champloo (2004) **0** | Samurai III: Duel at Ganryu Island (1956) **1** | Lone Wolf and Cub: Baby Cart at the River Styx (1972) **1** |
| 8 | Samurai III: Duel at Ganryu Island (1956) **1** | Lone Wolf and Cub: Baby Cart at the River Styx (1972) **1** | Seven Samurai (1954) **1** | Samurai 7 (2004) **1** | Samurai 7 (2004) **1** |
| 9 | Samurai 7 (2004) **1** | 13 Assassins (2010) **1** | Lone Wolf and Cub: Baby Cart at the River Styx (1972) **1** | Red Sun (1971) **3** | Samurai III: Duel at Ganryu Island (1956) **1** |
| 10 | Gintama (2006) **0** | Samurai III: Duel at Ganryu Island (1956) **1** | Sword of the Stranger (2007) **1** | Sword of the Stranger (2007) **1** | Sword of the Stranger (2007) **1** |
| ndcg10 | 0.790 | 0.853 | 0.853 | 0.588 | 0.357 |

### ho2-05 war film about snipers

Intent: War films where a sniper or sniper duel is the central focus. Generic war films are loosely relevant; non-war sniper thrillers only loosely.

| rank | prod | r4-combo | r4-combo-fast | r3-combo | r3-combo-fast |
|---|---|---|---|---|---|
| 1 | In Syria (2017) **1** | American Sniper (2014) **3** | American Sniper (2014) **3** | American Sniper (2014) **3** | American Sniper (2014) **3** |
| 2 | Shot Through the Heart (1998) **3** | Sniper: The White Raven (2022) **3** | Sniper: The White Raven (2022) **3** | The Wall (2017) **3** | The Wall (2017) **3** |
| 3 | Sniper: Ghost Shooter (2016) **3** | Snipers (2022) **3** | The Hurt Locker (2008) **1** | Enemy at the Gates (2001) **3** | Enemy at the Gates (2001) **3** |
| 4 | American Sniper (2014) **3** | Civil War (2024) **1** | Civil War (2024) **1** | In Syria (2017) **1** | Sniper: The White Raven (2022) **3** |
| 5 | Enemy at the Gates (2001) **3** | The Hurt Locker (2008) **1** | Snipers (2022) **3** | Sniper: The White Raven (2022) **3** | In Syria (2017) **1** |
| 6 | Snipers (2022) **3** | The Wall (2017) **3** | The Wall (2017) **3** | Snipers (2022) **3** | Snipers (2022) **3** |
| 7 | The Star (2002) **3** | In Syria (2017) **1** | Enemy at the Gates (2001) **3** | Sniper: Reloaded (2011) **3** | The Hurt Locker (2008) **1** |
| 8 | Sniper: The White Raven (2022) **3** | Enemy at the Gates (2001) **3** | In Syria (2017) **1** | Sniper (1993) **3** | Saving Private Ryan (1998) **1** |
| 9 | Sniper: Special Ops (2016) **3** | Warfare (2025) **1** | Warfare (2025) **1** | The Hurt Locker (2008) **1** | A Sniper's War (2018) **3** |
| 10 | The Wall (2017) **3** | Savior (1998) **1** | Savior (1998) **1** | Saving Private Ryan (1998) **1** | Sniper (1993) **3** |
| ndcg10 | 0.811 | 0.672 | 0.654 | 0.807 | 0.805 |

### ho2-09 space opera without aliens

Intent: Space-set adventure or drama with human-only (or robot/AI) antagonists and no alien species. Titles built around alien races contradict the constraint.

| rank | prod | r4-combo | r4-combo-fast | r3-combo | r3-combo-fast |
|---|---|---|---|---|---|
| 1 | Valerian and the City of a Thousand Planets (2017) **0** | Guardians of the Galaxy (2014) **0** | Guardians of the Galaxy (2014) **0** | Guardians of the Galaxy (2014) **0** | Guardians of the Galaxy (2014) **0** |
| 2 | Scavengers (2013) **2** | Star Wars: Clone Wars (2003) **0** | Star Wars: Clone Wars (2003) **0** | Star Wars: Clone Wars (2003) **0** | Star Wars: Clone Wars (2003) **0** |
| 3 | Babylon 5 (1994) **0** | Guardians of the Galaxy Vol. 3 (2023) **0** | Guardians of the Galaxy Vol. 3 (2023) **0** | Guardians of the Galaxy Vol. 3 (2023) **0** | Guardians of the Galaxy Vol. 3 (2023) **0** |
| 4 | Space Wars: Quest for the Deepstar (2023) **0** | Star Wars (1977) **0** | Star Wars (1977) **0** | Star Wars (1977) **0** | Star Wars (1977) **0** |
| 5 | Wing Commander (1999) **0** | Guardians of the Galaxy Vol. 2 (2017) **0** | Star Trek: Deep Space Nine (1993) **0** | Guardians of the Galaxy Vol. 2 (2017) **0** | Star Trek: Deep Space Nine (1993) **0** |
| 6 | Battle in Outer Space (1959) **0** | Ahsoka (2023) **0** | Guardians of the Galaxy Vol. 2 (2017) **0** | Ahsoka (2023) **0** | Guardians of the Galaxy Vol. 2 (2017) **0** |
| 7 | Space Pirate Captain Harlock: Arcadia of My Youth (1982) **0** | The Empire Strikes Back (1980) **0** | Ahsoka (2023) **0** | The Empire Strikes Back (1980) **0** | Ahsoka (2023) **0** |
| 8 | The New Adventures of Flash Gordon (1979) **0** | Rebel Moon - Part One: A Child of Fire (2023) **1** | Star Trek Into Darkness (2013) **0** | Rebel Moon - Part One: A Child of Fire (2023) **1** | Star Trek Into Darkness (2013) **0** |
| 9 | Flash Gordon (2007) **0** | Babylon 5 (1994) **0** | The Empire Strikes Back (1980) **0** | Babylon 5 (1994) **0** | The Empire Strikes Back (1980) **0** |
| 10 | Starship Troopers: Invasion (2012) **0** | Star Trek: Deep Space Nine (1993) **0** | Rebel Moon - Part One: A Child of Fire (2023) **1** | Star Trek: Deep Space Nine (1993) **0** | Rebel Moon - Part One: A Child of Fire (2023) **1** |
| ndcg10 | 0.521 | 0.087 | 0.080 | 0.087 | 0.080 |

### ho2-21 dystopain deth game series

Intent: Typo for 'dystopian death game series': shows (series preferred) where people are forced into deadly games in a dystopian or trapped setting. Films of the same kind are good.

| rank | prod | r4-combo | r4-combo-fast | r3-combo | r3-combo-fast |
|---|---|---|---|---|---|
| 1 | Danganronpa 3: The End of Hope's Peak High School (2016) **3** | Cyberpunk: Edgerunners (2022) **0** | Cyberpunk: Edgerunners (2022) **0** | Cyberpunk: Edgerunners (2022) **0** | Cyberpunk: Edgerunners (2022) **0** |
| 2 | Castlevania (2017) **0** | Squid Game (2021) **3** | Fallout (2024) **0** | Squid Game (2021) **3** | Fallout (2024) **0** |
| 3 | Manhunt (2017) **0** | Fallout (2024) **0** | Westworld (2016) **1** | Fallout (2024) **0** | Westworld (2016) **1** |
| 4 | Big Brother (2000) **1** | Alice in Borderland (2020) **3** | Captain Laserhawk: A Blood Dragon Remix (2023) **0** | Alice in Borderland (2020) **3** | Captain Laserhawk: A Blood Dragon Remix (2023) **0** |
| 5 | Squid Game (2021) **3** | Westworld (2016) **1** | Squid Game (2021) **3** | Westworld (2016) **1** | Squid Game (2021) **3** |
| 6 | Dragon Age: Redemption (2011) **0** | The Walking Dead (2010) **0** | Alice in Borderland (2020) **3** | The Walking Dead (2010) **0** | Alice in Borderland (2020) **3** |
| 7 | The Angry Joe Show (2008) **0** | Captain Laserhawk: A Blood Dragon Remix (2023) **0** | Deca-Dence (2020) **1** | Captain Laserhawk: A Blood Dragon Remix (2023) **0** | Deca-Dence (2020) **1** |
| 8 | Tekken: Bloodline (2022) **0** | Deca-Dence (2020) **1** | Black Mirror (2011) **1** | Deca-Dence (2020) **1** | Black Mirror (2011) **1** |
| 9 | Yu-Gi-Oh! Zexal (2011) **0** | Deadman Wonderland (2011) **3** | The Walking Dead (2010) **0** | Deadman Wonderland (2011) **3** | The Walking Dead (2010) **0** |
| 10 | Deadman Wonderland (2011) **3** | Black Mirror (2011) **1** | Deadman Wonderland (2011) **3** | Black Mirror (2011) **1** | Deadman Wonderland (2011) **3** |
| ndcg10 | 0.629 | 0.545 | 0.433 | 0.545 | 0.433 |

## Grade-0 titles in the top 5

| ranker | query | rank | title |
|---|---|---|---|
| prod | ho2-02 comedy set in a prison | 5 | Out of Tune (2019) |
| prod | ho2-04 western with samurai | 3 | Gintama (2017) |
| prod | ho2-04 western with samurai | 5 | The Challenge (1982) |
| prod | ho2-06 like Band of Brothers but about Vietnam | 1 | The Pacific (2010) |
| prod | ho2-06 like Band of Brothers but about Vietnam | 2 | Band of Brothers (2001) |
| prod | ho2-06 like Band of Brothers but about Vietnam | 3 | Gang Related (2014) |
| prod | ho2-07 like The Sopranos but in Italy | 4 | Happy Valley (2014) |
| prod | ho2-09 space opera without aliens | 1 | Valerian and the City of a Thousand Planets (2017) |
| prod | ho2-09 space opera without aliens | 3 | Babylon 5 (1994) |
| prod | ho2-09 space opera without aliens | 4 | Space Wars: Quest for the Deepstar (2023) |
| prod | ho2-09 space opera without aliens | 5 | Wing Commander (1999) |
| prod | ho2-10 animated movie that is not for kids | 1 | The Barbie Diaries (2006) |
| prod | ho2-10 animated movie that is not for kids | 5 | A Cat in Paris (2010) |
| prod | ho2-11 claustrophobic thriller in the Arctic | 3 | Shuttle (2008) |
| prod | ho2-11 claustrophobic thriller in the Arctic | 4 | Hunger (2009) |
| prod | ho2-12 lazy sunny summer on the Italian coast | 3 | Valentino: The Last Emperor (2008) |
| prod | ho2-13 70s paranoid conspiracy thrillers | 2 | The Lady Vanishes (1938) |
| prod | ho2-13 70s paranoid conspiracy thrillers | 5 | Thoughtcrimes (2003) |
| prod | ho2-14 2000s British gangster comedies | 1 | Get Carter (1971) |
| prod | ho2-14 2000s British gangster comedies | 2 | St George's Day (2012) |
| prod | ho2-14 2000s British gangster comedies | 3 | Rise of the Footsoldier 3: The Pat Tate Story (2017) |
| prod | ho2-14 2000s British gangster comedies | 5 | Brighton Rock (1948) |
| prod | ho2-15 terry gilliam | 1 | Terry Gilliam () |
| prod | ho2-18 A soldier comes home from war and can't fit b | 3 | Yossi & Jagger (2002) |
| prod | ho2-18 A soldier comes home from war and can't fit b | 5 | Soldier Soldier (1991) |
| prod | ho2-20 epic | 2 | Epic (1985) |
| prod | ho2-20 epic | 3 | Epic (2015) |
| prod | ho2-20 epic | 4 | Epic () |
| prod | ho2-20 epic | 5 | Epic Rap Battles of History (2010) |
| prod | ho2-21 dystopain deth game series | 2 | Castlevania (2017) |
| prod | ho2-21 dystopain deth game series | 3 | Manhunt (2017) |
| r4-combo | ho2-01 horror on a submarine | 4 | Alien (1979) |
| r4-combo | ho2-06 like Band of Brothers but about Vietnam | 1 | The Pacific (2010) |
| r4-combo | ho2-09 space opera without aliens | 1 | Guardians of the Galaxy (2014) |
| r4-combo | ho2-09 space opera without aliens | 2 | Star Wars: Clone Wars (2003) |
| r4-combo | ho2-09 space opera without aliens | 3 | Guardians of the Galaxy Vol. 3 (2023) |
| r4-combo | ho2-09 space opera without aliens | 4 | Star Wars (1977) |
| r4-combo | ho2-09 space opera without aliens | 5 | Guardians of the Galaxy Vol. 2 (2017) |
| r4-combo | ho2-10 animated movie that is not for kids | 4 | The Return of the King (1980) |
| r4-combo | ho2-11 claustrophobic thriller in the Arctic | 3 | Buried (2010) |
| r4-combo | ho2-18 A soldier comes home from war and can't fit b | 4 | The Patience Stone (2013) |
| r4-combo | ho2-20 epic | 2 | Epic (1985) |
| r4-combo | ho2-20 epic | 3 | Epic (2015) |
| r4-combo | ho2-20 epic | 4 | EPiC: Elvis Presley in Concert (2026) |
| r4-combo | ho2-20 epic | 5 | Epic - First Semester (2026) |
| r4-combo | ho2-21 dystopain deth game series | 1 | Cyberpunk: Edgerunners (2022) |
| r4-combo | ho2-21 dystopain deth game series | 3 | Fallout (2024) |
| r4-combo-fast | ho2-06 like Band of Brothers but about Vietnam | 2 | The Pacific (2010) |
| r4-combo-fast | ho2-09 space opera without aliens | 1 | Guardians of the Galaxy (2014) |
| r4-combo-fast | ho2-09 space opera without aliens | 2 | Star Wars: Clone Wars (2003) |
| r4-combo-fast | ho2-09 space opera without aliens | 3 | Guardians of the Galaxy Vol. 3 (2023) |
| r4-combo-fast | ho2-09 space opera without aliens | 4 | Star Wars (1977) |
| r4-combo-fast | ho2-09 space opera without aliens | 5 | Star Trek: Deep Space Nine (1993) |
| r4-combo-fast | ho2-10 animated movie that is not for kids | 3 | The Return of the King (1980) |
| r4-combo-fast | ho2-11 claustrophobic thriller in the Arctic | 1 | Buried (2010) |
| r4-combo-fast | ho2-11 claustrophobic thriller in the Arctic | 5 | Cave (2016) |
| r4-combo-fast | ho2-18 A soldier comes home from war and can't fit b | 3 | The Patience Stone (2013) |
| r4-combo-fast | ho2-20 epic | 2 | Epic (1985) |
| r4-combo-fast | ho2-20 epic | 3 | Epic (2015) |
| r4-combo-fast | ho2-20 epic | 4 | EPiC: Elvis Presley in Concert (2026) |
| r4-combo-fast | ho2-20 epic | 5 | Epic - First Semester (2026) |
| r4-combo-fast | ho2-21 dystopain deth game series | 1 | Cyberpunk: Edgerunners (2022) |
| r4-combo-fast | ho2-21 dystopain deth game series | 2 | Fallout (2024) |
| r4-combo-fast | ho2-21 dystopain deth game series | 4 | Captain Laserhawk: A Blood Dragon Remix (2023) |
| r3-combo | ho2-01 horror on a submarine | 4 | Alien (1979) |
| r3-combo | ho2-04 western with samurai | 2 | Samurai Champloo (2004) |
| r3-combo | ho2-06 like Band of Brothers but about Vietnam | 1 | Band of Brothers (2001) |
| r3-combo | ho2-06 like Band of Brothers but about Vietnam | 3 | The Pacific (2010) |
| r3-combo | ho2-09 space opera without aliens | 1 | Guardians of the Galaxy (2014) |
| r3-combo | ho2-09 space opera without aliens | 2 | Star Wars: Clone Wars (2003) |
| r3-combo | ho2-09 space opera without aliens | 3 | Guardians of the Galaxy Vol. 3 (2023) |
| r3-combo | ho2-09 space opera without aliens | 4 | Star Wars (1977) |
| r3-combo | ho2-09 space opera without aliens | 5 | Guardians of the Galaxy Vol. 2 (2017) |
| r3-combo | ho2-11 claustrophobic thriller in the Arctic | 1 | Buried (2010) |
| r3-combo | ho2-11 claustrophobic thriller in the Arctic | 2 | The Descent (2005) |
| r3-combo | ho2-18 A soldier comes home from war and can't fit b | 4 | The Patience Stone (2013) |
| r3-combo | ho2-20 epic | 2 | Epic (1985) |
| r3-combo | ho2-20 epic | 3 | Epic (2015) |
| r3-combo | ho2-20 epic | 4 | EPiC: Elvis Presley in Concert (2026) |
| r3-combo | ho2-20 epic | 5 | Epic - First Semester (2026) |
| r3-combo | ho2-21 dystopain deth game series | 1 | Cyberpunk: Edgerunners (2022) |
| r3-combo | ho2-21 dystopain deth game series | 3 | Fallout (2024) |
| r3-combo-fast | ho2-04 western with samurai | 4 | Samurai Champloo (2004) |
| r3-combo-fast | ho2-06 like Band of Brothers but about Vietnam | 1 | Band of Brothers (2001) |
| r3-combo-fast | ho2-06 like Band of Brothers but about Vietnam | 4 | The Pacific (2010) |
| r3-combo-fast | ho2-09 space opera without aliens | 1 | Guardians of the Galaxy (2014) |
| r3-combo-fast | ho2-09 space opera without aliens | 2 | Star Wars: Clone Wars (2003) |
| r3-combo-fast | ho2-09 space opera without aliens | 3 | Guardians of the Galaxy Vol. 3 (2023) |
| r3-combo-fast | ho2-09 space opera without aliens | 4 | Star Wars (1977) |
| r3-combo-fast | ho2-09 space opera without aliens | 5 | Star Trek: Deep Space Nine (1993) |
| r3-combo-fast | ho2-10 animated movie that is not for kids | 5 | The King and the Mockingbird (1980) |
| r3-combo-fast | ho2-11 claustrophobic thriller in the Arctic | 1 | Buried (2010) |
| r3-combo-fast | ho2-11 claustrophobic thriller in the Arctic | 2 | The Descent (2005) |
| r3-combo-fast | ho2-11 claustrophobic thriller in the Arctic | 4 | [REC] (2007) |
| r3-combo-fast | ho2-18 A soldier comes home from war and can't fit b | 2 | The Patience Stone (2013) |
| r3-combo-fast | ho2-20 epic | 2 | Epic (1985) |
| r3-combo-fast | ho2-20 epic | 3 | Epic (2015) |
| r3-combo-fast | ho2-20 epic | 4 | EPiC: Elvis Presley in Concert (2026) |
| r3-combo-fast | ho2-20 epic | 5 | Epic - First Semester (2026) |
| r3-combo-fast | ho2-21 dystopain deth game series | 1 | Cyberpunk: Edgerunners (2022) |
| r3-combo-fast | ho2-21 dystopain deth game series | 2 | Fallout (2024) |
| r3-combo-fast | ho2-21 dystopain deth game series | 4 | Captain Laserhawk: A Blood Dragon Remix (2023) |
