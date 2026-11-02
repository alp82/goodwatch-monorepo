# Separate V2 generation contracts

Owner-authorized benchmark contracts, 2026-10-24. These replace the combined 554-score/146-presence request for the new experiment; they do not replace production V1 or mutate historical benchmark packets.

| Request | Version | Required output |
|---|---|---|
| Similarity | `2.0.0-similarity.1` | 258 selected integer-or-null scores; no metadata or presence sidecar |
| Metadata | `2.0.0-metadata.1` | 296 other scores and 146 typed presence entries |

Use separate requests. Generate the similarity fingerprint first, and schedule metadata enrichment independently. Metadata unknowns do not prevent a complete fingerprint. Each request contains its own definitions and schema, plus the same title identity and scope. Do not send old scores, reviewer conclusions or expected answers to either request.

Separation avoids regenerating both outputs when only one needs completion. It also repeats some title and instruction context when both run; lower total cost is not guaranteed. The first test runs only the similarity request and cannot measure the cost of both requests together. Later metadata work may use requested subsets, but each subset needs an explicit contract and unrequested fields must remain unassessed.

## Prompt change

[similarity.SYSTEM.txt](similarity.SYSTEM.txt) asks for all selected traits, including low-relevance ones, using title knowledge as well as the synopsis. It distinguishes supported zeros from inability to assess. Null remains an honest escape for genuinely unknown scores, but blocks vector completion. No required-numeric schema is used to force guesses.

Definitions and scoring anchors come unchanged from the source registry. Only the selected field set, response envelope and task instructions change. Wire keys are canonical names such as `experience.adrenaline`; historical measurement-suffixed keys are not used. The source registry and exact mapping hashes are in [manifest.json](manifest.json).

[metadata.SYSTEM.txt](metadata.SYSTEM.txt) preserves explicit unknowns and movie NAs. This metadata contract includes quality evaluations and viewing-context scores as separate logical destinations in the parent mapping; it is not a complete title-analysis or content-advisory contract.

## Assembly

1. Store raw responses before validation. Bind the full request/title scope, model, route and schema version in the controller record; title/year in the compact response are only identity checks, not a complete provenance record.
2. Validate the similarity response with [similarity.schema.json](similarity.schema.json). Reject unknown keys, missing keys, duplicate JSON keys, invalid numbers and identity mismatches.
3. `../validate_generation.py` uses the frozen coordinate order to export a [vector.schema.json](vector.schema.json) score array only when every selected value is an integer in 0–10. Missing or null values are never converted to zero. The raw ordinal array is not a weighted/normalized retrieval configuration.
4. Validate metadata separately with [metadata.schema.json](metadata.schema.json). Join only matching identities, scopes and compatible registry versions. Reconcile presence/score contradictions across requests without silently rewriting either response. Metadata cannot overwrite similarity scores.
5. Keep failed or incomplete candidates separate from the last usable published fingerprint. Semantic contradictions still need resolution even if structural validation passes.

## Reproduce and validate

```sh
python -B docs/design/fingerprint-v2/similarity/render_generation.py
python -B docs/design/fingerprint-v2/similarity/check_generation.py
python -B docs/design/fingerprint-v2/similarity/validate_generation.py response.json \
  --title 'Thank You for Smoking' --year 2005 --output assessment.json
```

The renderer partitions all 554 scores into 258 and 296 without overlap. Focused checks cover valid zero values, nulls, booleans, decimals, range errors, missing/extra fields, identity mismatch, duplicate keys and non-finite JSON. The validator uses `jsonschema`; it writes a new assessment file exclusively and never changes the input.

The initial live test uses the same *Thank You for Smoking* title input as the previous benchmark. It compares coverage and selected-score changes against both earlier outputs. Prompt, grouping, field count and output envelope change together, so any observed difference belongs to this new recipe as a whole.

The [completed first test](tyfs-test.md) returned all 258 numeric scores on its first attempt, at $0.002523 attributed cost. Metadata generation remains untested under the separate contract.
