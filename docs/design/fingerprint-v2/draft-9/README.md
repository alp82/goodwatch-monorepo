# Fingerprint V2 essence additions — draft.9

Fingerprint comprises **vector + attributes**. Version `2.0.0-draft.9` retains projection `similarity-v2.3`: all **274 vector coordinates**, their order, definitions and rubrics are unchanged. Attributes now contain **353 targeted scores**, **171 presence concepts**, **64 facets/facts**, and **110 advisory entries**: **698 attribute entries**, **972 entries overall**.

## Complete readable contracts

- [Vector: 274 key/value definitions](vector.readable.md) · [Flat JSON](vector.readable.json) · [Publication schema](vector.schema.json)
- [Attributes: 698 key/value definitions](attributes.readable.md) · [Flat JSON](attributes.readable.json) · [Schema](attributes.schema.json)
- [Field catalog](field-catalog.json) · [Ordered mapping](mapping.json) · [Migration](migration.json)
- [Exact additions and rationale](ESSENCE-ADDITIONS.md) · [Source definitions](essence_changes.py)

## What changed

Nine attribute scores add character emphasis, ethical dilemmas, resilience, voluntary sacrifice, claustrophobia, economic precarity, and audible blues, reggae and gospel music. Character emphasis is retained as an attribute while the existing vector remains stable.

Three multi-select facets capture family secrets/reconciliation, rekindled romantic relationships, and reincarnation/resurrection/immortality/telepathy. Existing presentation modes gain stand-up, concert, game/talk/variety shows, staged/opera performance and live puppetry. Four cultural-movement choices extend the existing vocabulary. All choices support overlap; null, assessed empty selections, absence and zero retain different meanings.

## Generation

Use the three disjoint request contracts in [request-contract.json](request-contract.json):

1. [Vector](requests/vector.PROMPT.md): 274 scores + 15 matching presence flags.
2. [Targeted](requests/targeted.PROMPT.md): 353 scores + 156 matching presence flags + four dependent facets.
3. [Facts](requests/facts.PROMPT.md): remaining 60 facts/facets + 110 advisory details.

Each contract links its exact definitions and strict schema. Every canonical entry has exactly one producer. The controller assembles the two stored parts and validates the full pair. Stored attributes are not a fourth request. Vector request schema and prompt are byte-identical to draft.8; version envelopes and attributes distinguish this revision. The new targeted/facts prompt boundaries prevent confusing character emphasis with craft quality, a performance scene with a whole-work format, or independent relationships with the same pair of people.

Earlier fingerprints remain historical records. Newly introduced attributes require assessment; no automatic zero/empty backfill or version relabeling is provided. Expanding an enum also requires reassessing its older empty/other results if those distinctions are needed.

## Verification

`python -B build.py` reproduces schemas, definitions, readables and request contracts. `python -B freeze.py` runs the offline contract checks and writes [producer-freeze.json](producer-freeze.json) only if they pass. Checks cover preserved vector semantics, historical source bytes, all-field producer ownership, strict types, overlap, unknown handling and full-pair consistency. [Parent seals](parent-seals.json) preserve draft.8 independently.

This updates the draft and producer interface. Existing [twelve-title acceptance results](../acceptance/REPORT.md) describe draft.8; these additions have not received a new generation/quality benchmark. Production V1 and existing benchmark recipes remain unchanged.
