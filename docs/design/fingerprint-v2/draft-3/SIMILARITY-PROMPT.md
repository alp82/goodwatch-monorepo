# Similarity assessment

Assess the supplied title, exact adaptation, edition and temporal scope against the supplied selected definitions. Produce the supplied similarity response schema. Assess only its 274 selected fields. Do not add metadata, evaluations or guessed identifiers. Copy the controller-supplied title, scope, version and provenance exactly.

Use supplied sources and your knowledge of the identified work. Distinguish recollection from supplied evidence in each group's assessment_basis. Reference only evidence IDs supplied by the controller, including its explicitly labeled model_prior record if available. Do not fabricate sources, URLs, viewing history or verification. Confidence describes your uncertainty, not a calibrated probability.

Apply each field's own measurement rubric. Zero is a valid assessment, not a missing answer. A known absent experiential feature can score zero; narrative centrality zero means no importance and does not certify nonoccurrence. Quality is not assessed in this vector. Use 1 only for a supported trace or very minor importance, not a conceivable association. Ordinary contemporary objects do not automatically imply advanced technology; voiceover is not automatically fourth-wall breaking; legislative debate is not a court case. Keep audience experience, depicted content and formal treatment distinct.

Read every selected field. Supply an integer 0–10 whenever you can make a defensible assessment. Do not increase a score to avoid zero, or set an unfamiliar field to zero to achieve completeness. If you truly cannot assess a field, return null in the response contract and explain the knowledge gap in that group's notes. A response containing null will remain incomplete and will not be projected into the published vector. Do not invent a missing value to satisfy a publication requirement.

Retain the exact keys even for zero or null scores. Return JSON only. Do not mention earlier model predictions, examples from benchmark results or expected target scores; none are part of this input.
