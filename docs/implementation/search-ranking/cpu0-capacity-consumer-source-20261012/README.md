# Fixed-capacity CPU0 consumer source preparation

Tracked in #100. #406 remains closed.

This adds a separately selected, inactive V2 JavaScript consumer and offline audit. Running admission uses the derived strict 4 GiB threshold; stopped prestart still requires strictly more than 5 GiB. Full selected working-set admission reserves 2 GiB, query endpoints require at least 1.5 GiB, and measured registered overhead permits at most 512 MiB. The original readiness, query and cleanup budgets stay unchanged.

The consumer binds actual owned controller births to C6 ledger identities, validates full selected per-class locks before querying, and requires nine real baseline/candidate pairs with zero exclusions. Candidate server and wall time must each be below 1.5 seconds, and the native baseline must be red. Complete preliminary enrolment, actual preflight exit and intent-bound handoffs precede private input selection. Typed refusal evidence survives later admission failures; raw errors are omitted.

## Review and validation

Three actual Claude Code Opus 5.5 medium source reviews are retained byte for byte. Tools and MCP were disabled and exact public source/context bytes were supplied inline. The reviewer did not execute tests or independently recompute hashes.

- V1 BLOCK identified six concrete source defects.
- V2 BLOCK confirmed those six corrections and identified two smaller receipt-retention and early audit-label gaps.
- V3 ACCEPT covers inactive preparation of the four JavaScript files. It confirms both final corrections; policy and timing budgets were unchanged.

The final author full JavaScript cohort passed 69 tests in 32.234 seconds, including owned Python/Node child pipes, candidate/baseline/null/failure frames, distinct-time stale samples, complete emitted nine-pair audit, real malformed-output CLI refusals and the actual unchanged 30-second socket timeout. Source/placement interfaces and query results in these fixtures are public stand-ins. Root independently verified the final source/context and review artifact bindings and read the complete final report. Root did not claim an independent rerun of the 69-test author cohort.

Regression tests also failed against the preserved V1 bytes. That comparison was performed after successor implementation; it is not a claim of test-first chronology. Historical BLOCK reports and source copies remain available. Final source enum agreement against the independently authored backend commit was 273/273; that local library comparison is not a host trial or combined execution-packet proof.

## Scope and remaining limits

There has been no host execution, query run, model/archive selection, persistent service activation or production acceptance in this step. The backend source14/full external packet and combined source review remain separate requirements. The offline consumer audit always leaves experiment completion and external cleanup unproven, and production acceptance false.

Carried-over nonblocking limits include incomplete end-to-end mainV2 fixture coverage, later completed-phase refusal retention, no audit requirement for eighteen distinct controller births, no cross-ledger monotonic ordering, no failure-ledger binding to the observed controller birth, and trusted external context for Node provenance/registration hashes. Legacy V1 controller null-frame handling remains unchanged. The full original limitations appear in the final review report.

## Reproduction

Run `python3 docs/implementation/search-ranking/cpu0-capacity-consumer-source-20261012/verify.py` from this checkout to check retained artifact hashes and exact final live four-file equality. This only reads local public files.

Run the eight `test_*cpu0.mjs` suites, including `test_capacity_cpu0.mjs`, with `node --test` in `goodwatch-qdrant/diagnostics/pinning-prototype` to reproduce the full local JavaScript cohort. This needs the complete repository test closure; the standalone review source/context copies deliberately omit unrelated fixture dependencies.
