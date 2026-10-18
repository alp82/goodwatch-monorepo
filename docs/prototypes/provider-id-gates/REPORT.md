# Provider-ID suggestion benchmark — #709

Throwaway offline prototype on map #702. Owner verdict pending. Identifier-free matching remains #374. No UI or production changes.

## Candidate gates — frozen before evaluation

These are proposed limits for **reviewable suggestions**, requiring explicit member acceptance. They do not authorize automatic resolution. This section is committed before harness evaluation; later results must not redefine thresholds.

| Dimension | Candidate acceptance gate |
| --- | --- |
| Precision | At least 99% observed proposal precision and a two-sided 95% Wilson lower bound ≥99% on independently reviewed provider references; report numerator/denominator. Synthetic challenge cases are a separate deterministic safety check, never population estimates. |
| Wrong matches | Zero known wrong suggestions on the challenge set and reviewed real set. A sole stale link or a hidden conflicting target must not be described as proven identity. |
| Coverage | ≥90% correct proposals / all eligible reviewed provider-ID groups, and ≥95% / groups with a valid unambiguous catalog identity. Publish both; do not omit hard cases. |
| Ambiguity | All known conflicting canonical typed targets abstain; report ambiguous / all eligible groups separately. Missing evidence and backend failure are not ambiguity. |
| Abstention | Every unsupported, contradictory, missing-target, stale-only or incomplete-evidence challenge abstains. Publish manual / all groups and unavailable / all groups separately; real-set combined abstention ≤10% is a usability target subordinate to precision. |
| Latency | Ten-group page p50 ≤1.5s, p95 ≤3s, cold and warm reported separately, ≥200 independent page invocations per mode; production applicability requires representative transport/catalog size, not repeated fixture timing. Group deadline 2.5s and page deadline 12s retained. |
| Requests | ≤100 catalog requests per ten-group page, ≤10 per group averaged on representative data; no provider HTTP calls. An index must report build cost separately; zero per-lookup requests cannot hide refresh cost. |
| Rows inspected | ≤50,000 returned rows consumed per page and ≤10,000 per group, no sentinel truncation silently treated as absence. Report database rows scanned as unknown without backend query profiles. |
| Concurrency | ≤3 groups and ≤6 concurrent reads per page, including failed siblings; report aggregate concurrency for simultaneous page calls separately. No implied global limit. |
| Cancellation | Abort returns within 100ms in an abort-aware fixture transport; no reads start after cancellation, all active reads drain. Check pre-aborted, in-flight, sibling failure and actual deadline. Real transport cancellation remains a separate prerequisite. |
| Index evidence | Preserve provider namespace, all conflicting typed targets, retired→canonical links and provenance. Reject stale/unknown observation age (candidate freshness ≤30 days), missing/adult targets and supplied-year contradiction. Freshness alone cannot validate a misassigned link. Report cold build and warm lookup separately. |

## Protocol fixed before evaluation

Use actual shipped suggestion source with only catalog and import-group seams replaced in memory. Block all network access; do not import application boot/cache modules or load .env. Compare with a small in-memory provider-ID index using the shipped URL parser and canonicalization. Construct and audit truth labels from synthetic scenarios before running either route; retain rationale per case. Agent semantic review is explicit, not independent owner review.

Reuse the authorized 77-entry Netflix baseline aggregate and existing 24-entry type/year corroboration as historical evidence only. Do not open real exports or rerun healthy production queries. No precision denominator exists until an independent identity review is supplied. No source-capture recall can be inferred from this benchmark.

Use ≥200 fresh page calls per route/mode with fixed synthetic 2ms per-read delay (event loop adds overhead). Cold means rebuilding index and module seams, not a cold production cache. Report warm repeated fixture behavior without claiming a service cache. Publish unique semantic denominators separately from repeated latency samples. Use nearest-rank percentiles; Wilson intervals describe binomial sampling assumptions only, not uncertainty over adversarial fixtures. Pin source hashes and record runtime/environment.

## Results

Pending evaluation.
