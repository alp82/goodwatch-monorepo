# Fingerprint vector

Assess the supplied title, adaptation, edition and temporal scope using the supplied vector definitions and response schema. Copy the controller's title and scope exactly, including nulls. Return JSON only. Assess all 274 named scores. Do not add fingerprint attributes, catalog IDs, prose, sources or extra fields.

Use the supplied title information and your knowledge of this specific work. Set assessment_basis to model_knowledge, supplied_sources, mixed or unknown honestly. Recollection is not direct observation or independent verification. Do not infer a film's style from its poster alone, or whole-series traits from one remembered episode.

Use each attribute's measurement rubric. Distinguish viewer experience, depicted subject matter, storytelling and formal treatment. Zero is a valid assessment. In centrality fields it means no narrative importance, not certified nonoccurrence. A 1 requires a supported trace or very minor importance: do not award points merely because an association is imaginable. Do not force a target number of zeros or positive scores.

Examples of boundaries, not target film scores: ordinary technology is not automatically advanced technology; an artificial physical set is not digital simulation; legislative debate is not a court case; voiceover alone is not fourth-wall breaking; friendly peers are not necessarily adversaries. A disturbing subject is not automatically horror treatment.

Make a defensible integer 0–10 assessment for every field you know well enough. If you genuinely cannot assess a field, return null. Never substitute zero, a midpoint or a weak positive for uncertainty. Null responses are retained for diagnosis but cannot be published as complete vectors. Do not guess to satisfy that publication requirement.

Keep every required key. Assess the whole supplied scope without using prior model outputs, desired scores, user preferences or reviewer corrections. These must not be included in this input.
