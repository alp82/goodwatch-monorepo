# Real Reddit requests: gaps in V2 draft.3

**The next improvement should concentrate on contextual metadata and query interpretation. The research does not justify another broad expansion of the 274-dimensional vector.** We found many requests whose individual words already match existing fields but whose meaning would be lost by independent tag/score matching: who does something, why, when, for how long, and which exceptions the viewer allows.

Three **Sol 6.1** agents independently researched movies/cinephile taste, TV/viewing situations, and horror/niche constraints. Root checked mappings, removed several false gaps and added five cross-check cases. The result is **121 unique Reddit threads across 15 communities**, found through **87 distinct web-search queries**. Google itself returned consent or JavaScript interstitials, so the actual research used the available web-search fallback. Thirteen distinct threads were opened with their posts/comments available; the other 108 rely on indexed excerpts, sometimes substantial. Each row records its evidence level. Source dates/relative crawl labels are not used to infer trends.

This is a purposive discovery sample, not a prevalence estimate or an end-to-end search-accuracy test. Reddit requests establish what people ask for; commenters' proposed movies are not verified correct answers. Draft.3 remains a design contract, not a deployed retrieval system.

## Concrete requests that expose limitations

Request wording below is paraphrased; the linked thread and case ledger preserve the observed text.

| Real request | What exists already | Remaining limitation | Smallest useful improvement |
|---|---|---|---|
| [Female revenge where sexual assault is not the reason](https://www.reddit.com/r/horror/comments/1j6fh2y) | Female protagonist, revenge, sexual-violence advisory, entities and outcomes | A global no-assault filter is different from excluding assault **as the motive for this character's revenge** | Link actor → action → motivating event; apply negation to that relation |
| [A time loop where the character still ages and can die](https://www.reddit.com/r/MovieSuggestions/comments/1vc42qd/) | Time loop, aging, character outcomes | Those facts can occur independently; no typed assertion says aging persists across resets | Scoped narrative-mechanic assertions with subject and reset/persistence qualifiers |
| [A dog with agency that survives at least three quarters of the film](https://www.reddit.com/r/HorrorMovies/comments/1edncal/i_want_to_see_a_horror_movie_where_the_pet_doesnt/) | Animal entities and entity-bound survival outcomes | No outcome-to-time attachment; global animal-harm absence also misses the request's alternative aggressive-surviving-dog interpretation | Timed outcomes and preserved OR alternatives |
| [Starts as comedy, then becomes genuine horror—not a horror-comedy mixture](https://www.reddit.com/r/horror/comments/1ah1z6r/movies_that_start_out_funny_but_turn_into/) | Humor, horror, fear and temporal segments | Whole-work averages erase order; segments currently contain prose rather than typed trait assertions | Segment-bound tone/genre assertions and transition order |
| [Snow must be an obstacle in the plot](https://www.reddit.com/r/horror/comments/1vygr9y/looking_for_horror_movie_in_snowy_weathersetting/) | Settings, seasonal/world contexts, survival and escape | Snowy scenery does not establish snow causing isolation or obstructing escape | Context/event relation such as environment obstructs action |
| [Same event retold from different viewpoints, adding complementary information](https://www.reddit.com/r/MovieSuggestions/comments/1ourrfg/) | Multiple viewpoints, information withholding, unreliable narration | Multiple storylines are not the same-event retelling; complementary accounts are not necessarily contradictory | Canonical retelling technique plus event identity and account relationship |
| [Villain wins and later sequels never undo it](https://www.reddit.com/r/MovieSuggestions/comments/1g6lz5i/) | Character outcomes, work relations, franchise IDs | One title's ending does not establish a franchise-wide outcome; future installments cannot be guaranteed | Role-bound outcome joined across known related works, with an explicit as-of scope |
| [Episode cases resolve, while relationships develop across the series](https://www.reddit.com/r/televisionsuggestions/comments/1tj2e53/looking_for_immersive_show_with_a_more_episodic/) | Episodic/serialized traits, character transformation, season/episode scopes | One overall serialization score cannot specify which narrative strand closes each episode | Strand-specific resolution/continuity assertions, preferably derived from scoped assessments |
| [A happy ending with justice for the villain and no credit-scene mystery](https://www.reddit.com/r/horror/comments/1qr0fcj/good_movie_with_happy_ending/) | Happiness, closure, interpretive openness, post-credit scene presence | Scene presence does not say whether it reopens the threat; overall happiness does not bind each character's outcome | Character outcomes and credit-scene narrative function |
| [Earned competence, excluding implausibly effortless mastery](https://www.reddit.com/r/MovieSuggestions/comments/14f1c6w/) | Intellectual problem solving, training, transformation | Practical or professional expertise is broader than intellect; training occurrence does not establish credible competence | Character-linked demonstrated expertise and competence basis; possible later taste dimension |
| [Documentaries with source audio but no conventional talking-head explanation](https://www.reddit.com/r/movies/comments/15nyp8b/) | Documentary devices, voiceover, sound traits | A generic voiceover flag loses narration origin and function | Device/source-role qualifiers, with explicit absence coverage |
| [Audio-described titles for listening while working](https://www.reddit.com/r/netflix/comments/g214l6) or [horror using a spatial home-theater mix](https://www.reddit.com/r/MovieSuggestions/comments/1s8cymz/im_looking_for_horror_movies_where_sound_design/) | Languages, auditory/visual dependence, sound design | A title's artistic properties do not establish which audio tracks a particular offer provides | Edition/offer-level language, AD, subtitle and audio-mix catalog data |

For the three directly inspected examples about animal survival, snow as obstacle and episodic structure, the operative condition appears in the request itself. The other examples' access levels are individually recorded rather than assumed to be full-post reads.

## Prioritized design work

### 1. Extend the existing entity model with a small contextual assertion layer

`entities`, `character_relationships` and `character_outcomes` are already valuable. Retain them. The missing general capability is an assertion that can reference a subject, action/event, object, motive, location and temporal scope. Add optional qualifiers only when the request or evidence requires them; do not invent a detailed plot graph for every film.

This can serve revenge motivation, harm to children rather than all violence, snow blocking escape, a monster outside trying to enter, or magical realism used for comedy. Relations should have source references, uncertainty and spoiler flags. Canonical relation types need explicit semantics; arbitrary prose in `concept_assertions` is not automatically executable.

**Priority: high.** This is recurring across all branches and fixes several false-positive patterns without adding numeric dimensions for each combination.

### 2. Make temporal and narrative scope queryable

The existing `temporal_segments` has start/end fractions and a description. It cannot currently attach typed scores, presence or outcomes to a segment. The broader scope object can identify seasons/episodes, but an aggregation and linkage policy is still needed.

Support distinctions such as early versus late tone, survival until a point, apparent versus revealed character role, reverse chronology, final-episode satisfaction, episodic case resolution and continuity across known sequels. Keep **presentation time** distinct from **story chronology**; time-loop length, reverse narration and runtime fraction are different notions. Use precise timestamps only when evidence supports them; coarse phases are often sufficient.

**Priority: high.** Metadata extension and scoped joins, not replacement of the whole-title vector.

### 3. Preserve the logical structure of the request

A query plan needs hard requirements, preferences, exclusions, alternatives and named-title comparisons. Negation must retain its scope: “not motivated by assault” is not “no assault anywhere.” “Snow preferred, gloomy isolation acceptable instead” is an OR, not an AND. “Like this show's warmth, without its romance” is a selected-facet comparison, not nearest-neighbor distance over every dimension.

Keep viewer history, provider/region, shared-viewing compromises and temporary intent outside intrinsic title properties. Opposite [grief-avoidance](https://www.reddit.com/r/televisionsuggestions/comments/1srey0w/can_someone_reccomend_me_anything_to_keep_my_mind/) and [grief-processing](https://www.reddit.com/r/televisionsuggestions/comments/16zpkg8/shows_to_process_grief/) requests demonstrate why one generic comfort label is insufficient. These are viewing preferences, not evidence of therapeutic effects.

**Priority: high.** This is primarily query handling. The schemas cannot solve it alone.

### 4. Use the existing absence contract and fill its evidence gaps

Advisory coverage, depiction modes and explicit unknowns already solve much of the representation problem. They must actually be populated and respected. Missing tags, low centrality or a summary's silence cannot establish a strict exclusion.

Further precision may require event-target binding, an explicit general death-occurrence concept beyond violent death, and a distinction between visual and audio jump scares. The request that allows implied sexual violence but rejects particular treatment demonstrates that depiction mode and subjective tolerance differ. “Respectful” treatment or “not too scary” needs attributed/calibrated judgment, not a universal numeric cutoff.

**Priority: high for evidence and binding; medium for new vocabulary.** Do not add duplicate no-sex/no-nudity fields: they already exist.

### 5. Complete catalog joins before inventing more fingerprint fields

The schema already has `catalog_facts.show_status`, ending fields, language facts, work links and edition scope. Use them correctly: cancelled does not necessarily mean unresolved, and ended does not mean the viewer will like the finale. A whole-series evaluation also cannot establish consistency across seasons.

Offer-level audio description, dubbing, subtitles and spatial mixes require region/provider/edition data with freshness. Stable cast across seasons can be derived from credits and core-role scope. These are catalog/aggregation capabilities, not LLM-generated mood scores.

**Priority: high for required playback and completion conditions.** No current catalog coverage or live provider availability was tested in this research.

### 6. Curate vocabulary; add vector dimensions sparingly

French New Wave, Italian neorealism, wuxia, J-horror and slow cinema demonstrate demand for named traditions and forms. Existing cultural contexts and `concept_assertions` provide the extension point. Build a controlled vocabulary with aliases, provenance and explicit indexing; do not equate origin country, language or low pace with membership in an artistic tradition.

The clearest broad taste candidate from the root cross-check is **demonstrated competence**, but requests use that label differently: [earned individual mastery](https://www.reddit.com/r/MovieSuggestions/comments/14f1c6w/) versus a [mostly competent cast making reasonable decisions](https://www.reddit.com/r/movies/comments/1u4rtsc/looking_for_general_competency_porn/). Start with character/domain metadata and judged examples before promoting a score. Reverse chronology, same-event retelling, underwater facilities, narration source and sustained screaming/laugh tracks are better initial metadata concepts.

**Priority: medium.** The current vector remains a sensible base; this audit did not measure neighbor quality or prove a particular new dimension useful.

## False gaps removed during review

- Whole-work single-take presentation already has `format_facts.single_take_presentation`; the request accepting real or simulated continuous takes does not require a new field. Physical capture versus presentation remains a separate distinction when explicitly requested.
- Generic gothic horror romance composes `aesthetics.gothic`, `genres.horror` and romantic feeling/relationships.
- Cosmic horror already defines human insignificance before incomprehensible forces; those words do not justify another score.
- Magical realism, minimal dialogue, melancholy plus humor, folk horror, ordinary happy endings and background-viewing demands already have useful support.
- Directed relationship scaffolding already exists for unrequited love. The hard part is supplying character traits, perspective and evidence for exclusions.
- `show_status` already exists. Missing data or a missing catalog join is not a missing schema property.

Across the ledger the reviewers labeled 36 cases represented, 79 partial, three direct gaps and three non-schema. These labels are design judgments, not pass/fail search measurements; most partial cases contain both supported and unsupported components. There is no defensible overall accuracy percentage from this audit.

## Practical next step

Keep the 274-vector definition stable while implementing and testing three focused pieces: **contextual assertions, temporal attachment, and a structured query plan**. Populate those only where evidence supports them. Use a compact acceptance set drawn from the strongest cases above, with candidate titles checked independently. Text retrieval can find long-tail candidates, consistent with the existing search design, but it should not certify hard exclusions without supporting metadata.

## Deliverables and method

- [All 121 cases, CSV](cases.csv) and [JSON](cases.json): source URL, request excerpt, predicates, exact existing fields, limitation and proposed remedy.
- [Search/count summary](summary.json).
- Branch reports: [movies/cinephile](movies.md), [TV](tv.md), [horror/niche](niche.md).
- Exact query logs: [movies](movies-searches.json), [TV](tv-searches.json), [niche](niche-searches.json), [root cross-checks](root-searches.json).
- [Schema bindings](schema-bindings.json), [reproducible consolidation](consolidate.py), [verification](verification.json).

The screenshot's communities were starting points. Searches of r/Film, r/tvshow and r/whattowatch yielded no retained useful cases in this pass. r/degoogle results concerned service migration/privacy and were excluded from fingerprint-gap counts. Related r/movies and r/television requests were retained where relevant. Search batches limit exact per-query result attribution; logs say so.

All existing schema inputs remain unchanged. No fingerprints, paid API calls, Reddit interactions, production modifications or schema expansion were performed for this research. Some sources are only indexed excerpts, and not all request details can be verified from those excerpts; conclusions remain limited accordingly.
