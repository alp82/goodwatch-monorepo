# Essence-tag vocabulary gap audit

Date: 2026-10-19. Scope: existing generated catalog essence tags versus the 547-attribute compact V2 registry and the fuller V2 proposal. This audit proposes changes; it does not modify either definition.

## Evidence and limits

The primary evidence is the read-only catalog export: [extraction manifest](essence-extraction-manifest.json), [all exact tags](essence-tags-all.json.gz), and the source [title-analysis instructions](../../../goodwatch-flows/windmill/f/dna/generate/fetch.py). The latter asks for 8–10 descriptive tags per title, based on the model's assessment. Consequently these tags are evidence of vocabulary GoodWatch already produces, **not verified title facts, observed search demand, or a human reference answer**.

The extraction covers 165,170 movies and 87,441 shows with nonnull essence tags. It contains 334,284 distinct exact strings and 2,224,427 tag assignments. These sum across movie and show titles; they are not 2.2 million distinct titles. Case/punctuation normalization yields 327,007 labels; normalized frequencies are summed, never overwritten, and cannot establish deduplicated title counts across variants.

[essence-audit.py](essence-audit.py) computationally screens **every** exact tag. [essence-tag-triage.csv.gz](essence-tag-triage.csv.gz) records every result; [essence-triage-summary.json](essence-triage-summary.json) provides counts, family examples and unresolved high-frequency labels. This is lexical candidate generation, not semantic completeness certification. Categories overlap: 112,196 labels have an existing-attribute lexical clue, 16,409 have a full-design annotation clue, and 12,628 match candidate gap families. 201,384 have none of those clues; many are synonyms, vague evaluative language, names or highly specific compounds rather than genuine gaps. These counts must not be presented as coverage percentages.

Semantic review considered the 360 highest-frequency exact labels, the 15 highest-frequency labels within each candidate family, and the 150 highest-frequency lexically unresolved labels. Their deduplicated union is saved in [essence-reviewed-sample.json](essence-reviewed-sample.json). The remaining long tail received computational screening only. Title-level truth and audience demand remain unevaluated.

Frequency in the table below is **summed tag assignments within the stated regex family**, not unique titles. One title can contribute multiple labels, and a label can enter several families. This is useful prioritization evidence, not a measurement of how many titles require a new score.

## Highest-priority descriptive changes

| Gap family | Exact labels / assignments | Proposed treatment and distinction |
|---|---:|---|
| Character priority and introspection | 1,221 / 63,385 | Add `storytelling.character_emphasis_intensity`; separately assess introspective mode if reproducible. `Character-Driven` alone occurs 27,074 times and `Character Study` 10,934. Characterization **quality**, ensemble size and transformation arcs do not describe whether character experience drives the story. |
| Supernatural mechanisms | 1,295 / 13,237 | Add `world.supernatural_centrality`; use controlled narrower concepts for afterlife, reincarnation, immortality and supernatural powers. `Supernatural Horror` has 1,915 assignments across 1,914 titles (1,715 movies and 199 shows); `Supernatural Mystery` has 1,424 assignments. The one-assignment difference comes from a repeated identical tag within a title, not normalization. Magic, ghosts and demons cover subsets, not the full concept. |
| Ethics and moral conflict | 189 / 10,473 | Add `themes.ethical_dilemmas_centrality`; separately retain good-versus-evil as a targeted concept. `Moral Dilemma` 3,299, `Moral Dilemmas` 2,435. A morally admirable cast can confront ethical dilemmas; morally gray characters need not face one. |
| Sacrifice and resilience | 1,131 / 9,892 | Add separate `themes.sacrifice_centrality` and `themes.resilience_centrality`. `Human Resilience` 1,155, `Overcoming Adversity` 1,086. Survival, hope, redemption and recovery cover related but different stories. |
| Secrets, deception and manipulation | 831 / 8,555 | Add `themes.deception_centrality`; use targeted family-secrets/con-artistry/manipulation concepts. `Family Secrets` 3,468, `Psychological Manipulation` 427. Mystery and betrayal alone lose the mechanism. |
| Eccentric characters | 52 / 5,418 | Add `characters.eccentricity_intensity`, or an equivalent well-defined descriptor. `Eccentric Characters` 3,116, `Quirky Characters` 1,814. Absurdist humor and visual surrealism do not imply eccentric people. |
| Power and corruption | 650 / 5,315 | Add distinct power-abuse/corruption concepts, with centrality scores if frequent filtering justifies them. `Power Dynamics` 868, `Political Corruption` 584, `Police Corruption` 297. Politics, crime and coercive relationships provide incomplete coverage. |
| Isolation and claustrophobia | 549 / 4,415 | Add `aesthetics.claustrophobia_intensity`; keep physical/social isolation separately searchable. `Claustrophobic Atmosphere` 524, `Isolation` 509. Loneliness is emotional and confinement is not required for loneliness. |
| Poverty and precarity | 584 / 3,193 | Add `themes.economic_precarity_centrality` or separate poverty/precarity concepts. `Poverty` 295, `Economic Hardship` 263. Class and capitalism are broader; finance need not describe financial hardship. |
| Infidelity and unrequited romance | 219 / 2,662 | Add `relationships.infidelity_centrality` and `relationships.unrequited_romance_centrality`; second-chance romance can be a targeted trope. `Adultery` 615, `Infidelity` 524, `Unrequited Love` 373. Love triangles and forbidden romance are not substitutes. |
| Teamwork and heroism | 365 / 2,628 | Add teamwork as a targeted theme, consider heroism/sacrifice hierarchy. `Teamwork` 622. A workplace team is a social context, not an account of cooperation; heroism is not synonymous with superhero membership. |
| Magical realism | 113 / 1,856 | Add `world_treatment.magical_realism_intensity` with a precise convention-based definition. `Magical Realism` 1,459. Magic presence, everyday realism and surrealism together do not establish its distinctive treatment. |

Good additional targeted facets include serial killers (111 labels / 1,440 assignments), cultural conflict/tradition (242 / 3,739), bullying/social exclusion (232 / 901), mortality (87 / 267), and coercive religious groups (28 / 257). A broad parent often already exists—crime, cultural identity annotations, grief, or faith—but a parent is inadequate for a person explicitly asking for the narrower subject. Preserve the narrower concept without counting parent and child twice in general similarity.

## Form, aesthetics and presentation

Black-and-white needs an explicit representation. `restricted_palette_intensity` includes a work dominated by red and blue and therefore cannot implement a monochrome filter. The monochrome/selective-color family has 124 labels / 1,028 assignments; exact `Black and White` occurs 442 times. Add a sourced presentation/color-treatment annotation distinguishing original monochrome, selective color, and edition-specific colorization. An explicit achromatic black-and-white prominence score can additionally describe mixed works; tinted monochrome and sepia require separate annotations.

Silent/archival forms have 203 labels / 4,297 assignments. Distinguish silent-film form from a modern work with sparse dialogue, and archival footage from fictional flashbacks. `Archival Footage` occurs 1,709 times, `Silent Film` 940, and `Silent Film Era` 541. The last may describe historical context instead of presentation; do not map it blindly.

Performance and entertainment formats have 1,067 labels / 6,470 assignments: stand-up, concert, game show, variety show, talk show and puppetry. The full definition already provides extensible format annotations, but these useful values are not currently explicit examples and the compact output has no way to emit them. Extend the format vocabulary, not the general similarity vector. `Stand-Up Comedy` occurs 846 times and `Concert Film` 616.

Exploitation/B-movie/grindhouse family: 378 labels / 4,313 assignments. Consider controlled aesthetic or cinema-tradition concepts, with attributed scope. Low budget is not itself a schlock aesthetic and `cult_following` is reception. Avoid treating the isolated word `exploitation` as exploitation cinema; it may mean exploitation of people.

Poetic form: 360 labels / 2,131 assignments, including `Visual Poetry` 601 and `Poetic Realism` 241. This could be a targeted style concept, with visual lyricism distinct from poetic dialogue. First check scoring agreement: a broad poetic-quality score risks becoming a vague quality judgment.

## Searchable long tail: do not add a required score for every term

The tags demonstrate a **representational need in the existing generated catalog vocabulary**, even where they do not justify required dimensions. This is not observed user demand. Candidate families contain:

- Sports/games: 429 labels / 923 assignments. Horse racing, figure skating, mountaineering, fishing, chess, table tennis, sumo, sailing, fencing, archery, badminton, bowling, billiards and Olympics. Some are activities, some competitions/events; keep those roles. Existing `horses`, `hiking` and `competition` do not answer specific sport queries.
- Entities: 429 / 752. Dragons, witches, wizards, angels, mermaids, fairies, elves, dwarves, clones, cyborgs and shapeshifters. `mythical_creatures` is too broad for explicit inclusion or exclusion of dragons. `Dungeons & Dragons` may instead be a source work/franchise and `Komodo Dragons` are animals.
- Music: after guards removing space/soap-opera false positives, 672 / 1,994. Opera, gospel, blues, punk, reggae, funk, soul and disco. Split musical genre from a narrative described metaphorically as operatic; keep opera performance different from space opera.
- Settings: 514 / 1,815. Jungle/rainforest, underwater, submarine, summer camp, boarding school, orphanage, shopping mall and retirement home. School and ocean remain useful parents, not exact substitutes.
- Work domains: 430 / 1,038. Agriculture, mining, firefighting, emergency response, social work, sex work and domestic labor. Avoid guessing occupation centrality from a location or incidental scene.
- Disaster specifics: 180 / 343. Earthquake, tsunami, volcanic eruption, tornado/hurricane, asteroid, avalanche, shipwreck and nuclear catastrophe. Disaster membership alone does not distinguish these requests.

Counts remain candidate evidence; for example `Psychological Chess Match` is a metaphor, `Fishing Village` may be setting, and `Dungeons & Dragons` is not proof of depicted dragons. The script guards common chess and opera collisions; other ambiguity needs entity/relationship-aware extraction.

## What should remain outside the scalar registry

Many apparent compact-format gaps are already accommodated by the fuller design: geographic/historical contexts, cultural traditions, season/holiday relationships, representation annotations, production method, adaptations, people/franchises and reception. Supply those in a compact companion output rather than restoring pseudo-cultural numeric scores. A geographic label can mean setting, production origin or artistic influence; preserve the relation.

Vague or evaluative tags (`Cinematic Masterpiece`, `Emotional Depth`, `Visually Stunning`, `Iconic Performance`) are not reasons to add descriptive attributes. The separate quality/reception groups already provide places for appropriately attributed judgments. Similarity should not equate acclaim with subject matter.

The proposal should keep essence tags or introduce explicit searchable concept annotations. A suitable compact companion is a sparse list of concept, role, and scope: e.g. `{ "concept": "horse_racing", "role": "sport", "centrality": 8 }`. Resolve names to stable IDs outside the LLM output. For scenes, carry the actual relation: `{ "kind": "chase", "vehicle": "car", "color_treatment": "monochrome" }` only when supported. Whole-title cars + chases + monochrome scores cannot prove that the car chase itself is monochrome.

Existing [ADR 0002](../../adr/0002-local-text-embeddings-for-search.md) retains text embeddings and BM25F alongside fingerprints. Preserving long-tail tag/concept text follows that architecture. Existing [ADR 0001](../../adr/0001-no-jev-for-fingerprint-scoring.md) also warns through its experiment that synopsis-only explicit evidence misses traits. Generating ever more dimensions does not by itself supply reliable evidence.

## Recommendation

My fixed-score evaluation shortlist is the following **12 proposed compact keys**. These are candidate definitions, not installed registry changes or calibrated production dimensions:

| Proposed key | Definition |
|---|---|
| `storytelling.character_emphasis_intensity` | Degree to which character experience, psychology and relationships organize the work rather than primarily external plot mechanics. Character quality is assessed separately. |
| `storytelling.introspective_mode_intensity` | Sustained attention to a character's reflection on their own thoughts, feelings and experiences; not merely slow pacing or philosophical dialogue. |
| `themes.ethical_dilemmas_centrality` | Importance of consequential choices between competing moral duties, values or harms. Does not require morally gray characters. |
| `themes.sacrifice_centrality` | Importance of voluntarily giving up something significant for another person, commitment or larger purpose. |
| `themes.resilience_centrality` | Importance of enduring, adapting or rebuilding in response to adversity. Does not by itself establish an uplifting tone. |
| `themes.deception_centrality` | Importance of deliberate misleading, concealed truth or manipulation as a subject or organizing story mechanism. Unreliable narration is separate. |
| `themes.corruption_centrality` | Importance of misuse of entrusted power or institutional responsibility for private or factional benefit. General moral ambiguity is separate. |
| `characters.eccentricity_intensity` | Degree to which conspicuously unconventional habits, behavior and outlook define the depicted characters. Not a claim of diagnosis or disability. |
| `world.supernatural_centrality` | Importance of non-natural spiritual or paranormal forces and phenomena, distinct from scientifically framed speculation and unconfirmed character belief. |
| `visuals.black_and_white_prominence` | Extent of imagery presented as achromatic black, white and grayscale. Tinted monochrome, sepia, selective color, mixed presentation and edition-specific colorization require separate annotations. |
| `world_treatment.magical_realism_intensity` | Degree to which extraordinary or magical events are integrated into a recognizable everyday world as ordinary experience, rather than explained as an elaborate separate fantasy system. |
| `aesthetics.claustrophobia_intensity` | Strength of felt spatial restriction and inability to get away produced by staging, framing, sound and situation. A small location alone does not establish it. |

The highest-confidence first tranche is explicit black-and-white, character emphasis, ethical dilemmas, sacrifice, resilience, deception, corruption, eccentric characters and general supernatural content. Introspection, magical realism and claustrophobia need especially careful calibration to establish repeatable distinctions from existing traits. Economic precarity, infidelity, unrequited romance, cultural conflict, teamwork, serial killers and the entity/sport/music/format examples remain **sparse targeted vocabulary candidates first**, rather than expanding the required core automatically.

Extend controlled entity/sport/setting/music vocabularies sparsely, retain tag text, and add scene/relation annotations. Do not attempt to replace the catalog's hundreds of thousands of descriptive expressions with hundreds of thousands of fixed numeric dimensions.
