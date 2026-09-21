# Capture and verify the actual monthly guardrail rejection

Proposed child of [Implement the Windmill fingerprinting strategy](https://github.com/alp82/goodwatch-monorepo/issues/35). Labels: `wayfinder:task`, `needs-info`. Blocks [Run the acceptance criteria on the ten benchmark titles](https://github.com/alp82/goodwatch-monorepo/issues/39). Draft pending breakdown approval.

## Question

Obtain the actual HTTP status and sanitized error JSON from the provisioned OpenRouter monthly guardrail and replay it through the deployed spend-pause handler. The production inference key cannot list/manage guardrails (401 Invalid management key); owner input or management access is required.

Preferred input: an existing attributable monthly-budget rejection. Otherwise use an isolated temporary inference key and monthly zero-budget guardrail, verifying the rejection occurs before any billable inference; leave production limits untouched. Owner-only key provisioning uses wizard. Capture the original response and reset interval, verify pause expiry at the next UTC month, and verify unrelated 403 responses still fail visibly. Remove temporary resources and any test-only Redis pause.

The synthetic fixture `Monthly budget exceeded (acceptance fixture)` already passed on real Windmill/Redis/MongoDB, including the unchanged paused production flow. It proves runtime/reset behavior for that fixture, not provider wording. Do not waive the actual-response gate or declare it validated from documentation alone.

Evidence: ../monthly-evidence.json, ../monthly-state-job.json, ../monthly-paused-flow-evidence.json, ../permission-evidence.json, and ../guardrail-access-job.json.
