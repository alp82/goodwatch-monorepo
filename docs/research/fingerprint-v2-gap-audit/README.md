# Fingerprint V2 gap audit recommendations

The richer fingerprint should be retained, with a small scored extension and an extensible typed concept layer. The audit does not support making every searchable noun a required numeric dimension. The main opportunities are precise concepts, explicit presentation/form facts, and relations connecting a concept to the relevant scene, character, or episode.

No V2 definition, generation prompt, production data, or application code was changed. [Recommended changes as JSON](recommended-changes.json) records the proposed keys, definitions, annotation changes, and concept seeds.

## Evidence and actual review coverage

The catalog was queried read-only on 2026-10-19. “Top” means `goodwatch_overall_score_voting_count DESC NULLS LAST, tmdb_id ASC`, with no silently applied quality, presentability, or analysis-availability filter. The [title extraction manifest](title-extraction-manifest.json) preserves the exact selection, hashes, and missingness; the [essence extraction manifest](essence-extraction-manifest.json) preserves all tag aggregation queries and hashes.

| Branch | Computational scope | Semantic/editorial scope | Detailed findings |
|---|---|---|---|
| Essence tags | All 334,284 exact labels; 2,224,427 assignments over 165,170 movie and 87,441 show rows with nonnull tags | Prioritized 823-label sample; 201,384 labels remain lexically unresolved and are not declared gaps | [Essence report](essence-findings.md) |
| Movies | Exact top 2,000 rows, all supplied content fields | All title names; first four tags of all 798 initial residual rows; 77 targeted detailed source reviews | [Movie report](movies-report.md) |
| Shows | Exact top 1,000 rows, all supplied content fields | All titles plus three rare tags each; all tags/synopsis excerpts for 160 residual rows; 99 detailed followups | [Show report](shows-findings.md) |
| Search phrases | 256 distinct synthetic common/uncommon scenarios across 32 categories | Scenario-based mapping to the compact and full designs, with representational/retrieval requirements | [Query report](queries-findings.md) |

This is a systematic vocabulary audit, not a semantic verification of all 334,284 labels or an independent full-work review of all 3,000 titles. The imagined query set is deliberately varied, not sampled from production search logs; no query-coverage percentage or user-demand estimate is inferred. Generated essence tags can be wrong, and the ranked catalog includes suspect identities. The branch reports preserve concrete examples and limitations rather than treating these sources as a gold standard.

## Add a small scored shortlist

The following are recommended new vocabulary entries for scoring evaluation. Their usefulness as compulsory generation fields or similarity-vector features must be established separately.

| Proposed key | Missing distinction |
|---|---|
| `storytelling.character_emphasis_intensity` | Character experience/development organizing the work, independently of writing quality, ensemble size, or plot speed. The exact `Character-Driven` tag alone occurs on 27,074 catalog titles. |
| `themes.ethical_dilemmas_centrality` | Consequential choices between competing values or duties; morally gray characters are not required. |
| `themes.memory_centrality` | Remembrance, forgetting, and memory as a subject, beyond the existing memory-loss trope. |
| `themes.sacrifice_centrality` | Voluntarily surrendering something important for another person, commitment, or cause. |
| `themes.corruption_centrality` | Abuse of entrusted power or responsibility, rather than generic crime or political subject matter. |

Evidence is convergent vocabulary and title examples, not proof of improved recommendation accuracy. For memory, the movie audit cites Eternal Sunshine of the Spotless Mind, Coco, Total Recall, and Still Alice; the show audit adds Severance. For ethical dilemmas, the sources include 12 Angry Men and The Good Place. Full definitions are in the JSON proposal.

An overlap review deliberately reduced the initial wishlist. `themes.trust_and_betrayal_centrality` already explicitly mentions deception: split/redefine that compound before adding a separate deception score. `themes.existential_meaning_centrality` already explicitly includes freedom and mortality: use narrower controlled concepts when exact filtering needs them. Resilience, eccentricity, introspection, magical realism, and claustrophobia are useful searchable ideas, but should start as concepts or calibration candidates rather than automatically increasing the fixed vector.

## Make presentation and narrative structure explicit

Add black-and-white/color/mixed/selective-color/tinted-monochrome treatment with work/segment and edition scope. A restricted palette is insufficient. An optional `visuals.black_and_white_prominence` can describe partly grayscale works, while sepia/tinted monochrome must not silently pass an achromatic black-and-white predicate. The movie corpus supplies Pleasantville's explicit black-and-white-to-color premise; the show corpus supplies RIPLEY and Kota Factory tags.

Generalize anthology/vignette structure to movies as well as shows. The Ballad of Buster Scruggs and The French Dispatch expose the current series-only applicability. Keep the TV-specific episode/season independence scores.

Extend form/convention annotations for screenlife, silent works, archival footage, single-location stories, physical isolation, real-time storytelling, inverted mysteries, case/monster-of-week, multi-camera sitcoms, improvisation, hidden-camera/prank, stand-up, concert/stage recording, quiz/panel/variety, travelogue and instructional/scientific demonstration. Several already have a home in the full design's format vocabulary; the compact response needs a companion output for them.

## Add a sparse controlled concept layer

Give precise concepts stable IDs, aliases, parent relationships, and a typed role such as depicted entity, activity, topic, world mechanism, setting, genre convention, or artistic influence. Store only supported concepts for a title, with scope and optional scores; do not require thousands of mostly empty dimensions. Parent and child matches must not independently multiply similarity influence.

The [JSON proposal](recommended-changes.json) lists seed families. Particularly well-illustrated gaps include:

- **Sports/games:** chess (The Queen's Gambit), amateur/Olympic wrestling (Dangal, Foxcatcher), figure skating (I, Tonya), table tennis, dodgeball, bowling, climbing, gambling/poker. Existing professional wrestling and action martial arts are different concepts.
- **Entities/mechanisms:** dragons, witches, angels, shapeshifters, cyborgs, sentient objects; afterlife (The Good Place), cloning (Orphan Black), reincarnation, immortality, memory manipulation, psychic abilities, teleportation, shrinking, alternate history, and mecha/game progression.
- **Narrative specificity:** scams, undercover infiltration, first contact versus invasion/coexistence, death games, cold cases, forensic inquiry, counterfeiting, royal succession.
- **Social/relationship topics:** economic precarity, slavery/forced labor, coercive groups, bullying, body image, adoption/fostering/custody, infidelity, unrequited/fake/second-chance/long-distance romance.
- **Other detail:** courtroom/jury room, summer camp, boarding school, submarine, planet surface; firefighters, farming and professional specialties; specific music/dance traditions and disaster events.

A broad parent is often already present. The gap is exact retrieval: `mythical_creatures` cannot determine whether dragons appear; `competition` cannot distinguish chess from a death game; `robots` cannot establish a human cyborg; `world.time_travel` does not establish alternate history.

Retain essence text/tags and hybrid text retrieval as a complement. Lexical guards caught actual metaphor/title collisions: a psychological “chess match” is not chess played on screen; “cult classic” is not a depicted cult; “space opera” is not opera music; a movie title containing “bowling” does not establish a bowling-centered subject.

## Bind concepts to scenes, characters, outcomes, and scopes

The user's “black&white car chase scenes” requires both precise vocabulary and a relation: **this chase uses cars and is black-and-white**. Independent whole-title scores can describe unrelated sequences. Optional evidence-backed event annotations should connect action, participants, setting, and visual/audio treatment. Whole-title co-occurrence should be presented as uncertain when no scene-level evidence exists; timestamps must not be invented.

The same requirement appears in “a woman scientist protagonist,” “a dog that survives,” “a funeral played for comedy,” “an underwater sword fight,” and season-specific requests. Representation, occupation, role, and outcome must bind to the same character/event. Outcome and ending matches need spoiler-sensitive explanations.

Clarify the numeric rubrics: intensity/explicitness should not use duration or pervasiveness as alternative severity anchors. Peak severity, frequency, and duration/fraction are distinct. Otherwise one extreme scene and near-continuous mild content cannot be reliably distinguished.

Add controlled advisory details for vomiting, needles/injections, drowning, suffocation, eye/dental injury, and sudden loud sounds. Low centrality is not verified absence. Keep evidence coverage and unknown policies even if the LLM-facing score format is compact.

## Preserve non-score data and catalog boundaries

The full design already accommodates geography/era, culture, holidays, representation, audience, production technique, and reception. These should remain concise companion outputs or catalog joins. Their omission from `llm-definition.json` must not become removal from the title-analysis pipeline.

Extend edition/offer facts for audio description, captions/SDH, sign interpretation, sensory versions, alternate cuts, and colorized editions. These are neither film-quality scores nor assumed title-wide accessibility properties. Existing runtime, language, availability, people, franchise, source adaptation and age-certification data remain authoritative for their respective predicates.

## Recommended implementation order

1. Add the five scored vocabulary candidates, explicit color treatment, and general work-level anthology structure to a new proposal revision; split the existing compound trust/betrayal concept carefully.
2. Define sparse typed concepts and seed them from the corroborated catalog examples. Retain all companion annotation families and text/tag retrieval.
3. Clarify peak intensity versus exposure and represent specific advisory triggers.
4. Expand presentation/form and edition/accessibility vocabularies.
5. Add optional event/role bindings where supported, and test the synthetic scenarios against reviewed title evidence before promising scene precision or estimating recall.

The first practical validation should use judged examples that distinguish nearby concepts, including negative/metaphorical examples. Then evaluate consistency, search usefulness, generation cost and catalog coverage before changing the general recommendation feature set.

## Stored trope followup

The [trope synthesis](tropes-findings.md) adds the complete 42,936-name inventory, the separate 42,142-URL inventory, all three branch reports, review ledgers and 468 selected stored excerpts. It proposes foreshadowing and dramatic irony for scoring evaluation, optional symbolism calibration, and sparse narrative/role/mechanism concepts. The JSON recommendations retain these in a distinct trope addendum. Source aliases, assertion polarity, malformed URLs and work/scope mismatches become benchmark challenges, not positive labels by default.

All current and historical evidence is linked from the [wayfinder evidence index](../../design/fingerprint-v2/wayfinder/evidence-index.md).
