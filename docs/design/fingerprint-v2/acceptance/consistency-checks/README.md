# Fingerprint consistency checks

Read-only audit of completed canonical export snapshots. These are the existing acceptance audit v3 rules, copied without semantic changes. The only code change is a display-name fallback: summary name, canonical `title.name`, then title key.

Run from the repository root with Python 3 and the existing `jsonschema` dependency:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 docs/design/fingerprint-v2/acceptance/consistency-checks/audit.py \
  --exports /path/to/completed-export-snapshot \
  --schema docs/design/fingerprint-v2/draft-8 \
  --output /path/to/new-audit-directory

PYTHONDONTWRITEBYTECODE=1 python3 docs/design/fingerprint-v2/acceptance/consistency-checks/checks.py
```

The export directory needs `summary.json` with a `titles` array. Each title entry has `title` (its directory key), optional `name`, and `returned_parts`. Fully returned entries have vector, targeted and facts; their directory contains canonical `vector.json` and `attributes.json`. Incomplete entries are reported as skipped, never filled. Output must be a new directory.

The audit writes `REPORT.md` and `audit.json`, recording source hashes and verifying that inputs did not change during the read. It performs no model calls, repairs, source writes or production actions.

Keep four conclusions separate:

- **Numeric vector complete:** all 274 coordinates are numeric. This alone does not admit the fingerprint.
- **Pair checks:** the frozen validator checks schemas, identity/scope, applicability, score/presence and existing facet/advisory dependencies.
- **Additional cross-part checks:** known contradictions involving real-time presentation, whole-work single takes, audio startles/jump scares, and bounded century/decade assertions. Era checks conservatively allow boundary overlaps and skip lists containing unbounded eras.
- **Factual judgment:** these checks cannot establish which conflicting value is correct or certify title knowledge, recommendation quality or advisory safety. Semantic spot-checks are explicitly separate from hard contradictions.

Full fingerprint admission requires pair and cross-part consistency in addition to numeric completeness and the separate quality decision. Unknown attributes remain unknown; present with zero centrality remains valid. Unknown advisory presence cannot establish absence.

The JSON retains legacy `vector_publication_valid` and `unpublishable_vectors` keys for compatibility; `field_semantics` explicitly limits these to standalone vector-schema validation. `numeric_vector_complete` is the table's yes/no condition.

Eleven bounded synthetic checks cover the existing rules. `verification.json` records the copied-source comparison and display-only delta. Frozen draft8 validation and earlier audit artifacts remain unchanged.
