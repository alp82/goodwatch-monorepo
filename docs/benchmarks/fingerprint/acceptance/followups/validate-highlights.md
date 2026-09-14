# Reject invalid highlight keys before persisting DNA

Proposed child of [Implement the Windmill fingerprinting strategy](https://github.com/alp82/goodwatch-monorepo/issues/35). Labels: `wayfinder:task`, `ready-for-agent`. Blocks [Run the acceptance criteria on the ten benchmark titles](https://github.com/alp82/goodwatch-monorepo/issues/39). Draft pending breakdown approval.

## Question

Ensure generated DNA obeys the existing highlight contract before it is saved. Live acceptance persisted `action_core_scores_placeholder_check` for The Matrix and `erotica` for Preacher. Neither is a key in CoreScores; both responses passed DNAAnalysis because highlight_keys is list[str].

Add local validation at the generation boundary that rejects unknown highlight keys, duplicate highlights and counts outside 4–8. Audit and enforce the existing mechanically checkable response rules (including 8–10 distinct essence tags and the exact 74 integer scores) without changing the frozen DNAAnalysis schema or serialised 74-score contract. Validation failures must use the already bounded repair/fallback policy; do not substitute or silently delete invalid keys.

Use TDD at the existing generation seam: real captured invalid responses must trigger repair before persistence; a valid repair must be associated with the same title; exhausted repairs must follow the existing fallback/request cap. Review before merge. Correct the affected benchmark records through the repaired generation path and re-run the failed acceptance checks, preserving the failed evidence. Agree the additional paid-run budget before inference.

Evidence: ../independent-validation.json, ../matrix-evidence.json, ../preacher-retry-evidence.json, and ../postflight-job.json. The DNA generation schedule remains disabled; the affected records currently contain the invalid generated highlights.
