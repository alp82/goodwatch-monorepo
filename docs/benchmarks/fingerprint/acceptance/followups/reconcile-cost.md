# Reconcile the unlogged fallback attempt and complete acceptance cost evidence

Proposed child of [Implement the Windmill fingerprinting strategy](https://github.com/alp82/goodwatch-monorepo/issues/35). Labels: `wayfinder:task`, `needs-info`. Blocks [Run the acceptance criteria on the ten benchmark titles](https://github.com/alp82/goodwatch-monorepo/issues/39). Draft pending breakdown approval.

## Question

Reconcile the first live Preacher fallback request, which returned no usage.cost and stopped the acceptance harness. The successful retry cost $0.0003022. The first attempt's $0.001798208 reservation remains outstanding; it is neither a measured charge nor zero.

Use the OpenRouter activity record for the production key around 2026-09-14 13:18 UTC, or management API access, to recover the request/generation identity, status and actual charge. The old harness did not retain the response status/body/generation ID when usage was absent, so these cannot be reconstructed from the saved Windmill job. Preserve this limitation; do not infer the error from a later successful retry.

Known usage.cost entries total $0.006699506. The account counter changed from $0.020251256 to $0.027569874 in the captured snapshots; attribution and counter freshness are not established. The full unresolved reservation plus conservative embedding bound keeps the acceptance work below $0.010142, within the $0.05 ceiling, but does not supply the missing exact charge.

Resolve with attributable cost evidence and a complete ledger. Improve the acceptance capture to retain sanitized error/status/generation metadata on missing usage before another run; no new paid experiment is authorised by this ticket alone.

Evidence: ../preacher-evidence.json, ../preacher-retry-evidence.json, ../key-after-nine-job.json, and ../postflight-job.json.
