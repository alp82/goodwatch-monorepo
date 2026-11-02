# V2 similarity projection proposal

Version `similarity-v2-proposal.1`, 2026-10-24. Source: unchanged `2.0.0-draft.2` registry. The owner approved this selection for the next benchmark. The mapping retains its original identifier and bytes for provenance. This implements the agreed [similarity boundary](../changes/similarity-boundary.md) as an exhaustive field mapping and fixed projection. It is not a production migration or a claim that these dimensions have been optimized against user choices.

## Concrete output split

| Destination | Numeric attributes | Purpose |
|---|---:|---|
| Similarity fingerprint | **258** | Content, experience and form that contribute to general resemblance |
| Content metadata | **261** | Detailed genre, trope, activity, sport, setting, occupation, entity and other targeted discovery signals |
| Viewing context | **17** | Prerequisite knowledge, attention/access requirements and situational suitability |
| Series metadata | **8** | Show-only structure, without inventing movie zeros |
| Evaluations | **10** | Craft quality for separate ranking and filtering |
| **Total** | **554** | Every existing numeric attribute has one primary destination |

All **146 presence entries** remain separate metadata. Advisories, evidence, confidence, essence text and explanatory highlights also stay outside vector distance. The logical destinations do not require separate databases or discard the broader analysis.

The fingerprint is 53.4% smaller in dimension count than the full 554-field inventory. This is not a measured token, latency or billing reduction. Generating the entire analysis would still incur its cost; a future fingerprint-only request should contain just the selected definitions and output schema, with metadata enrichment run separately when useful.

## What stays in similarity

- Emotional experience and humor: 40 dimensions.
- Themes, narrative engines, relationships, characters, world premises and horror modes: 131 dimensions.
- World treatment, storytelling, stakes, dialogue, aesthetics, visuals, action, sound, ending and sensory intensity: 87 dimensions.

Themes measure **centrality**, not occurrence. A passing mention of capitalism is different from a story organized around capitalism. Narrative engines measure what drives the action; they are not interchangeable with themes. Relationships distinguish, for example, a parent–child story from a romance even when mood and genre overlap.

The ordered list is in [mapping.json](mapping.json); [attribute-placement.md](attribute-placement.md) lists every field and its destination. [selection.json](selection.json) contains the editable choices and inclusion/exclusion rationales. The mapping binds the exact source-registry hash and retains original measurement types, applicability and spoiler flags.

## Deliberate tradeoffs

| Choice | Reason and consequence |
|---|---|
| Keep `technological_change` and `human_nature` | These are different thematic concerns and remain separate coordinates. |
| Keep `clandestine_groups` and `coercive_group_control` | Secret organization and coercion describe different central social structures. Neither implies the other. |
| Keep boxing and underground fighting as content metadata | Their distinction remains searchable, with centrality preserved. A specific “underground fighting” request can use it directly; general resemblance uses action treatment, competition, relationships and themes. This deliberately sacrifices exact activity matching in the default vector. |
| Move all genre membership to metadata | Genre filters remain available. Avoid adding broad and nested genre labels on top of their experiential and narrative components. Genre-specific retrieval may still use membership scores. |
| Keep all 68 thematic centralities | Topic differences matter. This large block must not outweigh tone and form merely because it has more fields. Correlated themes still need contribution control. |
| Move demographic protagonist/representation fields to metadata | Preserve explicit preference-directed discovery. Shared identity alone is not made a default general-resemblance signal; thematic identity concerns remain in the fingerprint. |
| Keep broad aesthetic treatment, move finer technical detail | A noir or surreal treatment affects the experience; exact aspect-ratio changes or a particular production technique need not be a coordinate for every title. |
| Keep emotional ending/resolution dimensions | The emotional destination affects resemblance. Do not expose these in spoiler-free explanations. Specific ending devices and sequel requirements remain separate. |
| Keep action dimensions even when TYFS left them unknown | Membership is based on usefulness across titles, not on whether one saved response filled the field. |

These are defaults for **general similarity**, not a claim that excluded fields can never influence a recommendation. Targeted queries can combine metadata conditions or explicit preferences with the fingerprint. The detailed sport, setting and creature taxonomies are the main tradeoff to revisit if neighbors lose important content specificity.

## Complete-vector contract

1. Use exactly the 258 ordered coordinates from this projection version for every movie and show. Never select a different subset per title.
2. Require an assessed integer from 0 through 10 for every selected field. Boolean, missing, null, out-of-range and non-applicable values do not form a complete vector.
3. Preserve zero only when assessed under that field's rubric. Centrality zero means no narrative importance; it does not certify absence. An unknown score must not become zero merely because a synopsis omits the subject.
4. Validate selected-field consistency before publication. Presence metadata may remain incomplete, but a known contradiction involving a selected field requires resolution.
5. If completion fails, preserve the previous usable fingerprint or leave the new version unpublished. The broader analysis and its unknowns remain available separately.
6. Version the projection, scoring definitions, scaling and distance configuration together. Do not compare V1, full draft.2 arrays and this projection as if they shared coordinates.

The selection does **not** authorize unweighted flattening of 258 scores. The next retrieval configuration must balance content, experience and form, including correlated subgroups. No metric or weight values are selected here. Shared absence of many narrow concepts should not dominate recommendations; coordinate completeness is necessary but does not solve weighting or quality.

## Saved-output coverage

No new model calls were made. [coverage.json](coverage.json) records source assessment hashes, per-group counts and every unavailable selected field.

| Existing draft.2 output | Numeric / selected | Selected nulls | Interpretation |
|---|---:|---:|---|
| Thank You for Smoking, original monolithic | 114 / 258 | 144 | Incomplete |
| Thank You for Smoking, completed split run | **249 / 258** | **9** | Nearly complete, still not publishable under this contract |
| The Truman Show | **258 / 258** | **0** | Numerically complete; retained `world.virtual_reality` score/presence contradiction blocks clean publication |

The nine split-run gaps are `action.martial_arts_choreography`, `grappling`, `gunplay`, `blade_combat`, `superpowered_combat`, `large_battles`, `gritty_combat`, `stylized_violence` and `realistic_violence`. These may be inexpensive to resolve in a focused completion request, but this work has not sent one or asserted that all should be zero.

Existing numeric values are not thereby endorsed. Earlier concerns about individual zeros and calibration remain attached to the source analysis. No new quality acceptance is inferred from this projection.

## Reproduction and next implementation

Run `python -B docs/design/fingerprint-v2/similarity/build.py` to rebuild the mapping and readable field table. To refresh coverage, repeat `--assessment 'LABEL=/absolute/path/to/assessment.json'` for each saved draft.2 assessment. The script checks the complete field set, selected keys, uniqueness and cross-format applicability; it performs no inference or imputation.

The [generation contracts and prompts](generation/README.md) now implement the separate 258-field similarity request and metadata request. `validate_generation.py` validates the response and exports an ordered score array only when all 258 values are valid integers. A complete array is not factual acceptance or a configured serving vector: retrieval scaling, weights and metric still need a separate versioned configuration. The frozen draft.2 registry, benchmark requests, original predictions, production V1 and existing Qdrant data remain unchanged.
