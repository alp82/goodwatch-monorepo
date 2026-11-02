# Fingerprint V2 producer recipes

**ACCEPTANCE COMPLETED — NOT APPROVED FOR UNATTENDED COLLECTION.** The [final acceptance verdict](../REPORT.md) freezes the field inventory but rejects this producer for unattended trusted collection. This package preserves the evaluated recipes from the frozen [draft8](../../draft-8/README.md) sources. It is not a production deployment or release authorization.

The canonical fingerprint remains **vector + attributes**, `2.0.0-draft.8`, projection `similarity-v2.3`: 274 ordered vector coordinates and 686 attribute entries. Three producer requests own disjoint portions of those two stored parts.

| Request | Recipe ID | Producer representation | Canonical decoding |
|---|---|---|---|
| vector | `draft8-ordinal-paired-r3` | 259 ordinary scores plus 15 joint score/presence objects | Restore all 274 scores and 15 presence keys |
| targeted | `draft8-ordinal-assessment-r1` | 344 scores, 156 presence keys, four dependent facets | Identity mapping after validation |
| facts | `draft8-facts-advisory-branches-r1` | 22 advisory presence branches; animal-harm types generated within that advisory | Move animal-harm types back to its canonical facet |

These are the existing recipes, not new semantic changes. Definitions, rubrics, coordinate order and canonical schemas remain unchanged. The vector recipe removes historical membership annotations, clarifies ordinal judgment and known absence in nonnarrative works, and repeats four existing definition boundaries. The targeted recipe removes historical annotations and misplaced vector-only reminders. The facts recipe adds only its representation instructions. See `code/recipe_text.py` and `code/VECTOR-JUDGMENT-SUFFIX.md` for the exact text.

Unknowns remain unknown. Present with zero centrality remains valid. Positive score with absent presence fails the paired schema. Advisory presence branches preserve all currently allowed null details; they do not force factual certainty. The decoders never impute, repair, normalize or change predicted values.

## Render without calling a model

Requires Python 3 and the existing `jsonschema` dependency. Run from the repository root:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 docs/design/fingerprint-v2/acceptance/producer-recipes/render.py \
  --part vector \
  --title docs/design/fingerprint-v2/acceptance/producer-recipes/fixtures/truman.json \
  --output /path/to/new-render-directory
```

Use `targeted` or `facts` for the other parts. Title input must contain exactly `title`, `scope` and `synopsis`; its title/scope must satisfy draft8's identity schema. The supplied text becomes the user message unchanged. The renderer does not choose a work, edition, scope or synopsis for you. The output directory must not exist.

Outputs: `request.json`, full local `wire.schema.json`, unchanged canonical `canonical.schema.json`, `interface.json`, controller-only `identity.json` and `receipt.json`. A render verifies every pinned draft8 source hash and checks both schema structures. It never sends HTTP, reads credentials, reserves money, retries requests or changes production.

`settings.json` captures the tested candidate model/provider/settings, including its output cap and explicit endpoint pin. These are reproducibility inputs, not a claim of current entitlement, availability or prices. A separate authorized runner owns live checks and accounting.

## Validate and decode

Preserve the provider response and extracted producer JSON. Decode into a separate canonical file:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 docs/design/fingerprint-v2/acceptance/producer-recipes/code/paired.py \
  --input /path/to/raw-vector-projection.json \
  --interface /path/to/vector-render/interface.json \
  --output /path/to/new-canonical-vector-projection.json
```

Use `code/advisories.py` with the same arguments for facts. Targeted output needs strict wire and canonical validation but no shape change. Python interfaces:

- `paired.decode_projection(document, wire_schema, canonical_schema, paired_fields)`
- `advisories.decode_projection(document, wire_schema, canonical_schema)`

Each decoder validates input and output, rejects malformed/duplicate ownership and leaves the raw input unchanged. Attach the exact controller envelope and assemble through the draft8 request contract; then run full-pair and cross-part checks. Numeric vector completeness alone is not full fingerprint admission. Metadata unknowns are permitted under the contract; unknown advisory presence cannot establish an exclusion guarantee.

The historical baseline wire projection expands local references and omits unsupported/nonsemantic annotations. Full local canonical constraints remain authoritative. Existing `uniqueItems` checks remain local; this package does not silently add unsupported wire keywords.

## Verification

```sh
PYTHONDONTWRITEBYTECODE=1 python3 docs/design/fingerprint-v2/acceptance/producer-recipes/checks.py
```

Eight bounded tests cover:

- Exact parsed request/message/schema reproduction for representative vector, targeted and facts candidate inputs, against fixed SHA256 digests. Request object key formatting is not treated as semantic drift.
- Pinned draft8 sources and canonical schema equality.
- All 390 allowed vector pair states and rejection of 150 positive/absent combinations across the 15 pairs.
- Advisory branch rules, animal-type lossless roundtrips and malformed input rejection.
- Title input boundaries and targeted identity validation.

Fixtures contain only neutral title/scope/synopsis inputs, never predictions or reference scores. `fixtures/golden.json` stores reproducibility digests, not model answers. No private home-directory dependency is needed to run the package. `verification.json` records the earlier preparation checks and this status-only update; the [acceptance verdict](../REPORT.md) records the completed live outcome.
