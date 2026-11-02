# What the reviews and Reddit research changed

This draft implements the owner's later choice of **simple structured generation**, superseding the graph/query-plan recommendations in the historical [Reddit research](../research/reddit-discovery-2026-10-24/REPORT.md). The research files remain unchanged. It carries forward draft.3's accepted vector additions and definition fixes from the independent Fable/Opus reviews, without another vector expansion.

| Finding | Data captured now | Boundary retained |
|---|---|---|
| Competence beyond intellect | `characters.demonstrated_competence`, `characters.competence_basis` | Does not bind skill and training to a named person or certify realistic mastery |
| Reverse chronology vs parallel timelines | `storytelling.chronology` | Time travel and time loops keep their existing separate scores |
| Same event retold, adding or disputing information | `storytelling.retelling_structure` | No event IDs or individual narrator truth judgments |
| Comedy becomes horror | `storytelling.tone_progression` | Coarse predominant transition, not an exact timeline or every episode's trajectory |
| Source-audio documentaries without added explanation | `presentation.narration_sources` plus existing documentary devices | Origin/type captured; no per-speaker archive links |
| Low-stimulus viewing; sudden scares | `presentation.jump_scares`, modalities, laugh track, sustained screaming; existing sensory scores | Not a universal suitability or accessibility guarantee |
| Snow matters to the plot | `world_context.environmental_obstacles` vs depicted seasons | No causal/event graph; ordinary scenic snow does not qualify |
| Cases resolve but characters develop | `series.case_resolution_pattern`, `series.character_continuity` | Scoped typical pattern, not a promise about every episode |
| Credits reopen an otherwise closed story | `ending.post_credits_function` and existing scene presence | Ending happiness and character-specific justice remain different concepts |
| Death avoidance beyond violence | `advisories.death` and depiction modes | Unknown cannot certify safety; natural, offscreen and discussed deaths count |
| Cinephile traditions and materiality | Fixed cultural vocabulary; color/capture/one-take/documentary facts; existing form/music scores | Membership is not inferred from geography or pacing; genuine unknowns stay unknown |
| Cultural, seasonal and period essence | Fixed era/relative-period, seasonal, cultural and reality-layer facets | Lists are bounded and do not resolve every place, community or named historical event |
| Representation and preference perspectives | Existing representation scores plus established protagonist traits | No inference from actors; two tags need not refer to the same person |
| Genre, sports, settings, jobs, music and niche themes | All 325 previous metadata scores retained, plus competence | A useful filter does not automatically become a vector dimension |
| Remakes, source works, real subjects | Broad adaptation/factual-basis/relation-type categories; target IDs belong to catalog | No model-generated Wikidata IDs or manually curated relation graph required |
| Audio description, dubbing, regional playback and status | Explicit catalog ownership boundary | Not generated from a film's tone or sound-design score |
| Revenge not motivated by assault; loop aging; timed survival | Existing revenge/loop/aging/harm properties remain | These exact relational conditions are intentionally not represented by independent tags |

## Why the vector stays at 274

It already contains the accepted additions for tranquility, indignation, disgust, lyricism, transgression, cutting pace, magical realism, didacticism, confined setting, persuasion/propaganda, illness/dying, corruption and four story-arc tropes. The later examples mostly distinguish *how a concept occurs*, which is well suited to companion categories. The research supplied no neighbor-quality evidence for replacing or expanding those axes.

Possible theme redundancy, simulation/VR merging, era promotion, competence promotion, score floors, group weights and taste-specific relevance remain decisions for a future retrieval evaluation. None is silently applied. Metadata can carry a preference-relevant distinction without making it a universal similarity coordinate.

## Two complete generation contracts, not an extra curation project

The similarity prompt requests every selected score. The metadata prompt requests all companion scores, flags, facets and advisories in one structured response. No manually authored evidence object per field, proposed concept approval workflow or bespoke entity resolver is required. The controller retains the actual source material and generation records separately. Independently verified catalog/advisory evidence remains distinguishable from model judgments.

The new contracts are checked offline only. This completes the design and generation/validation artifacts; it does not claim that an LLM will fill all fields accurately or that the requested niche queries are solved by existing production code.
