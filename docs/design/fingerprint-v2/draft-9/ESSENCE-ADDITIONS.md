# Essence audit → draft.9

The audit screened all 334,284 distinct essence strings in the saved 2026-10-19 export and semantically reviewed 787 distinct labels, including every top-200 label and systematic tail samples. Tags are generated vocabulary, not factual reference scores. Computational matches were not treated as semantic coverage. The full [audit report](/home/alp/.local/share/goodwatch-benchmarks/v2-essence-draft8-audit-v1/REPORT.md) retains per-label reasons and unresolved cases; the corpus remains in [the earlier gap-audit directory](../../../research/fingerprint-v2-gap-audit/essence-extraction-manifest.json).

## Numeric additions — attributes only

| Field | Rubric | Distinction retained |
|---|---|---|
| `storytelling.character_emphasis` | prominence | Sustained character understanding organizes the work; different from good writing, intimacy, psychological subject or a transformation arc. |
| `themes.ethical_dilemmas` | centrality | Consequential competing moral choices, not simply ambiguous people. |
| `themes.resilience` | centrality | Endurance/adaptation under adversity, without requiring recovery, success or uplift. |
| `themes.voluntary_sacrifice` | centrality | Willing substantial cost, not coerced loss or unwilling ritual victims. |
| `atmosphere.claustrophobia` | intensity | Felt inability to escape, not merely a small location. |
| `themes.economic_precarity` | centrality | Insecure subsistence/deprivation, not all class differences or financial activity. |
| `music_styles.blues` | prominence | Audible blues, not sad mood or blue imagery. |
| `music_styles.reggae` | prominence | Audible reggae, not Caribbean setting or musician identity. |
| `music_styles.gospel` | prominence | Audible gospel, not all religious subjects or sacred music. |

All use the existing 0–10 rubrics with honest null intake. They add no new presence flags or vector dimensions. Character emphasis remains the strongest possible later vector promotion; this revision does not change the 274-coordinate projection.

## Multi-select additions

| Field | New choices |
|---|---|
| `relationships.family_dynamics` | `family_secrets`, `reconciliation` |
| `relationships.romantic_arc_patterns` | `rekindled_relationship` |
| `speculative.supernatural_mechanisms` | `reincarnation`, `resurrection`, `immortality`, `telepathy` |

Family dynamics explicitly concern a family; unrelated family and secrecy tags are insufficient. Rekindled romance concerns the same former partners. Mechanisms must be established as operative rather than only rumored, researched or metaphorical. Scientific speculative explanations are allowed. Afterlife, possession and superpowers keep their existing fields; no automatic cross-field inference is made.

## Expanded existing facets

- `format_facts.presentation_modes`: `stand_up`, `concert_performance`, `game_show`, `talk_show`, `variety_show`, `staged_performance`, `opera_performance`, `live_puppetry`. These describe substantial work/program presentation, not a passing scene. Documentary and performance modes may coexist. Opera does not imply Western classical music, and live puppetry does not imply animation.
- `cultural.movements_and_traditions`: `czechoslovak_new_wave`, `british_new_wave`, `new_german_cinema`, `french_poetic_realism`. Artistic affiliation is required. Bollywood is not automatically masala; poetic realism as loose description is not automatically the named French movement.

No existing option was removed. Multi-select values, including overlapping formats and relationship dynamics, are retained as sets of supported choices. `[]` is assessed with no listed choice; null is unknown. Earlier empty selections cannot certify absence of newly added enum choices.

## Retained boundaries

The audit's named people/places/works, arbitrary singleton details, reception claims and universal audience-suitability promises remain outside this bounded change. Existing catalog ownership does not assert those data are available. No entity graph, per-character records, free-text matching layer or query implementation is added. Existing eccentricity, infidelity, magical realism, afterlife, possession, dance, periods, colors, soul/R&B, funk and professional wrestling are reused.

The attributes total rises from 686 to 698: nine numeric fields plus three facets. Enum expansions add choices, not additional entries. The total fingerprint rises from 960 to 972 canonical entries. Schema/type checks establish contract consistency, not the correctness of future model predictions.
