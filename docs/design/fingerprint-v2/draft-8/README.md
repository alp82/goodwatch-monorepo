# Fingerprint V2 acceptance candidate — draft.8

Fingerprint comprises **vector + attributes**. This candidate retains all **274 ordered vector dimensions**, **344 targeted scores**, **171 presence fields**, and **22 × 5 advisory details**. One calendar-system facet raises facts/facets from 60 to **61**, giving **686 attribute entries** and **960 total entries**.

Version: `2.0.0-draft.8`. Projection: `similarity-v2.3`. The new projection deliberately distinguishes clarified semantics from draft.7 despite unchanged coordinate order. This is an acceptance candidate, not a production deployment or approval to overwrite historical data.

## Complete readable contracts

- [Vector: 274 key/value definitions](vector.readable.md) · [Flat JSON](vector.readable.json) · [Publication schema](vector.schema.json)
- [Attributes: 686 key/value definitions](attributes.readable.md) · [Flat JSON](attributes.readable.json) · [Schema](attributes.schema.json)
- [Field catalog](field-catalog.json) · [Ordered mapping](mapping.json) · [Versioned changes](migration.json)

## Generation

Use the three **disjoint** request contracts in [request-contract.json](request-contract.json):

1. Vector: 274 scores + 15 matching presence flags.
2. Targeted: 344 scores + 156 matching presence flags + four dependent dance/jump-scare facets.
3. Facts: remaining 57 facts/facets + 110 advisory details.

Controller attaches exact title/scope/version, merges by the supplied pointers, and validates the full pair. No field is independently generated twice. Null intake vectors remain diagnosable but cannot publish. Presence with zero centrality remains valid; absent with positive score does not. Predicted values are never silently repaired.

Only known production facts should be populated. Story dates/decades require established BCE/CE correspondence; fictional calendar numbers stay out of them. Specific older-adult, simulation, ideological-radicalization and voice-performance boundaries are clarified. Advisory present/zero-frequency conflicts are rejected, and one local semantic failure no longer hides cross-part contradictions.

## Verification and scope

`python build.py` reproduces artifacts; `python checks.py` exercises structural and semantic contracts. [Producer freeze](producer-freeze.json) records the exact tested interface. [Field-purpose audit](audit/REPORT.md) records retention and near-neighbor decisions separately; it does not prove empirical independence.

No retrieval weights, entity graph, query planner, catalog join, production migration, deployment or paid call is implemented here. The existing Qwen-primary ADR remains unchanged.
