# Synthetic query coverage audit

## Scope and evidence

This audit independently imagined **256 distinct phrases in 32 categories**, eight per category, to stress-test coverage. These are test scenarios, **not observed searches**. Counts say nothing about demand, frequency, or priority in the real audience. All cases and candidate mappings are in [queries-cases.json](queries-cases.json).

Primary sources are the local [compact definition](../../design/fingerprint-v2/llm-definition.json), [full definition](../../design/fingerprint-v2/definition.json), and [domain vocabulary](../../../CONTEXT.md). No external factual movie claims are needed for this synthetic task. Existing coverage below means the design has the concept or structure; it does not establish production implementation, annotation completeness, or correct title scores.

## Recommended changes

### 1. Add explicit monochrome treatment

The user's **“black&white car chase scenes”** exposes two independent gaps. `visuals.restricted_palette_intensity` does not establish black and white: a red-and-gold color palette is also restricted. Add a dedicated `visuals.black_and_white_prominence` description. Record selective color and mixed color/monochrome as controlled presentation annotations if needed. The edition also matters when a black-and-white original has a colorized release.

The query additionally requires **the car chase itself to be monochrome**. Title-level monochrome, car presence, and chase scores can all be high while referring to different scenes. This requires the scene structure below.

### 2. Introduce an extensible subject/entity vocabulary

The existing `entities`, `sports`, `activities`, and `occupations` are useful but finite. Do not add a permanent numeric column for every animal, profession, instrument, or creature. Add sparse controlled subject annotations with a concept identifier, aliases, broader concepts, centrality, evidence, scope, and optional role.

Representative omissions from the 256 scenarios:

- Creatures: dragons, mermaids, witches, trolls, shapeshifters, angels, sentient fungi.
- Animals: octopuses, bees, raccoons, penguins, elephants, crocodiles, wolves, foxes.
- Sports: fencing, chess, figure skating, climbing, archery, rowing, roller derby, badminton. Whether chess is formally classified as a sport need not block its availability as a searchable activity concept.
- Activities: pottery, crossword solving, birdwatching, quilting, model making, winemaking, escape rooms, foraging.
- Occupations: firefighters, astronauts, lighthouse keepers, undertakers, truck drivers, interpreters, postal workers, archaeologists.
- Music: reggae, flamenco, opera, synthwave, a cappella, qawwali; instrument concepts such as piano.
- Social situations: homelessness, union organizing, housing/food insecurity, bullying, infertility, adoption, foster care, reentry after prison.
- Relationship patterns: friends-to-lovers, fake dating, second chance, long distance, arranged marriage, polyamory, estrangement, explicitly platonic intimacy.
- Speculative mechanisms: reincarnation, immortality, telepathy, curses, wishes, precognition, resurrection, bodily transformation.
- Genre traditions: cozy fantasy, solarpunk, magical realism, acid western, swashbuckling, wuxia, isekai.

A genre tradition should describe actual conventions, a depicted creature should describe actual content, and an artistic influence should describe an attributed relationship. A single generic tag relation would blur these meanings. Parent/child concepts must not get extra independent similarity votes.

The full definition's generation strategy already anticipates retrieving relevant long-tail concepts. The missing piece is their declared representation and vocabulary lifecycle: concept IDs, aliases, hierarchy, relations, and validation.

### 3. Add a few broad thematic dimensions, conditionally

Candidate broadly reusable scalar themes are **memory**, **mortality**, **freedom and control**, **power and corruption**, and **truth and deception**. Additional candidates include **consent/bodily autonomy**, **reconciliation**, and **responsibility/consequences**. Existing identity, aging, politics, justice, trauma and guilt do not fully imply them.

Evaluate whether these deserve core scalars by judged title comparisons and repeatability. They can begin as subject concepts. This audit supports vocabulary inclusion, not a claim that adding every candidate to the fixed core will improve recommendation quality.

### 4. Add scene/event relations and role binding

Examples requiring more than whole-title AND:

- A car chase without music; a hallway fight filmed as one take; an underwater sword fight.
- A wedding interrupted by aliens; a funeral played for comedy.
- A Black woman who is a scientist; a wheelchair user who is the romantic lead.
- No cheating **by the main couple**; the dog survives; a mother and child reunite.

Minimal conceptual structure: event or segment ID; action/concept; participants and roles; place/world layer; visual/audio treatment; evidence; spoiler flag. Explicit timestamps are optional and should not be invented when only textual evidence is available. Character IDs can be local to an analysis; they need not imply a full public cast-character knowledge graph.

The full design already provides representation annotations, world layers and temporal segments. Extend/link those structures instead of inventing parallel ones. Intersectional queries must bind identities and occupations to the **same character**, rather than accept two unrelated characters.

### 5. Separate intensity, prevalence and exposure

The compact anchors sometimes blend these: intensity 10 says “exceptionally strong **or pervasive**,” while explicitness 10 also mentions sustained detail. A single brief scene can be extremely graphic but not pervasive. Clarify these rubrics.

Use a maximum or peak intensity where it matters, plus exposure duration/fraction or coarse frequency. This allows “one scary scene is fine but not constant dread,” “only brief nudity,” or “at least half an hour of car chases.” Temporal segments help locate changes, but do not independently measure exact scene duration. Unknown duration cannot pass a precise threshold.

Content advisories already have stronger detail in the full schema than the compact numeric attributes. Preserve that output path; do not squeeze all advisories back into ordinary centrality scores. Absence requires actual assessment coverage.

### 6. Expand specific triggers and presentation methods

The advisory vocabulary lacks directly searchable **vomiting/emesis, needles/injections, drowning, suffocation, eye injuries and dental injury**. Add a controlled trigger concept hierarchy or specific topics. Spiders can use the entity taxonomy, but “no spiders even briefly” requires assessed exposure/absence rather than low centrality. Sudden loud sounds are broader than the existing `audio_startles` characteristic and need sensory advisory coverage.

For visual narrative requests, add or annotate **screenlife, silent/intertitle presentation, subjective/first-person camera, still-image storytelling, animation surface treatment**, and **rhythmic editing**. “One continuous shot” requires distinguishing actual capture from apparently continuous edited presentation. Long-take intensity alone does not certify either fact.

### 7. Complete nonfiction, unscripted and performance vocabulary

The full definition already covers nonfiction/hybrid mode, documentary approaches, reality competition and observational reality. These are **not entirely missing**.

Extend its open presentation vocabulary with **quiz, panel, makeover/renovation, dating, talent competition, travelogue, instructional program, stand-up, concert recording, stage recording**. Add documentary method qualifiers such as archival-only, talking-head interviews, reenactment, and evidence/investigative approach. Couple these with subjects (fungi, finance fraud) and perspective (victim-centered rather than perpetrator-centered true crime). “Competition” does not distinguish a quiz show from sports, cooking or dating.

### 8. Complete offer and edition metadata

Audio description, closed captions/SDH, sign-language interpretation, sensory-adjusted releases, alternate cuts and colorized editions belong to offers/editions. Language availability exists in the full catalog contract, but it does not expressly distinguish these accessibility modes. Add explicit capability fields and unknown/freshness policies. Never infer accessibility certification from fingerprint scores.

Sign language is also a **language and representation** concern when used by characters in the original work; this is separate from an interpreted release. Original language, spoken languages, cultural setting, production origin, and the viewer's selected dub/subtitle track remain separate.

## Preserve the broader design outside compact attributes

Geography and historical contexts, holiday relationships, cultural traditions, ages/sensitivities for co-viewing, runtime, language tracks, cancellation/renewal, streaming availability, and source adaptations already have homes in `definition.json`. They are gaps **only if the compact attribute response becomes the entire analysis**.

Examples such as “winter without Christmas,” “Eid celebrations with family conflict,” “something for a seven-year-old who scares easily,” or “French dub with matching captions” cannot be faithfully answered by a larger trait vector alone. Keep the compact output concise while generating or joining structured annotations separately.

Ending outcomes can use private spoiler-sensitive matching. “The dog survives” and “queer romance where both leads live” require actual event/outcome knowledge; high ending happiness does not establish either. Do not expose those conclusions in recommendation descriptions unless the viewer has opted in.

## Retrieval work, not new attributes

Conjunction, OR, NOT, maximum exposure, minimum duration, same-scene binding, same-character binding, temporal scope, and reference-title comparisons require a query representation with typed predicates. “Like Alien but less scary” should identify the desired aspects of the reference and the direction of change. It should not demand an `alien_but_less_scary` trait. Hard exclusions require coverage; unknown is not absence. “Best,” service availability, runtime and renewal status use catalog/ranking data.

## What I would implement first

1. Explicit monochrome treatment, and clarification of intensity versus exposure.
2. Sparse subject/concept annotations with hierarchy and aliases; seed the omissions above.
3. Preserve the existing broader annotations and advisories in the concise generation workflow.
4. Typed query constraints and controlled advisory trigger detail.
5. Optional event/role relations for precise scene and intersectional requests.
6. Expand format, accessibility and edition fields; evaluate the proposed broad thematic scores before promoting them into a fixed vector.

This prioritization reflects correctness and representational reach across the imagined cases, not measured popularity. Test the full 256-case suite with real annotated titles before estimating recall or promising support.
