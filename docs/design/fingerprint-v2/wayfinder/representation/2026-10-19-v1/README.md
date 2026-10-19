# Candidate representation contract — review copy

The actual assisted direction is **develop_ordinal_plus_facts**. The [decision candidate](decision-candidate.md) proposes reversible technical defaults for a13-slot screen: eight anchored ordinal fields and five finite fact templates. It does not approve a complete schema, evidence policy, provider lineup, experiment or production change.

- [Matrix and anchors](candidate-matrix.json)
- [Schema](screen.schema.json)
- [Native value/state/profile mapping and bounds](native-mapping.json)
- [Synthetic structural example](example.synthetic.json), not a real title or model result
- [Consistency validator](validate_contract.py) and [bounded validation summary](validation-summary.json)
- [Static source references/hashes](source-register.json), without source bodies
- [Proposed ticket resolution and named map pointer](resolution-candidate.md), not posted

With Python and the already available jsonschema package:

```sh
python -B validate_contract.py example.synthetic.json
```

The command performs JSON shape checks only, reads local schema/matrix files and prints a result. It performs no inference, source acquisition, evidence-entailment validation or production integration. No package download was performed to prepare this candidate. Internal validate() adds declared-metadata checks. Executable assemble() must supply frozen metadata and the run manifest, including primary work/cell identity; a producer cannot create verified coverage by declaring it.

All13 representation slots are required even when unknown. Other families are explicitly deferred/not-assessed. Full essence/advisory/context companions remain a separate required ownership/assembly contract before complete-output comparisons. Native option counts do not establish token/cost fit. Q8's evidence-first protocol remains unapproved. The old74-score consumers remain unchanged and incompatible with this subdocument.

Review-v2 applies R1–R4. See [corrections](corrections.md), [renderer boundary](renderer-boundary.md), [companion reconciliation](companion-reconciliation.md) and [review receipt](review-receipt.json). Q11 is unchanged; no arm/provider/full protocol has been approved.
