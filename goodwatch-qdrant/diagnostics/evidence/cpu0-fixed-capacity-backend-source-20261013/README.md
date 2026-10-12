# Inactive fixed-capacity CPU0 backend source

This source preparation supports open issue #100. It performs no host execution and establishes no capacity, latency, production activation, or seven-day acceptance result. Issue #406 remains closed; #407 remains open.

The 15 source/freeze files match reviewed author commit `1aae3c10531cd9aebaa5ed03b510dc8d1fe68c66` byte for byte. The prepared ABI2 derives the running-unheld admission floor from frozen 2 GiB maximum locks plus 2 GiB reserve, retains the stopped-start floor, debits the complete selected working set, and records actual query memory and bounded overhead evidence. Core pin/runtime/daemon/CPU guards and helper policy remain unchanged. The fork implementation removes the multiprocessing tracker, closes inherited control ownership in the child, and refuses extra descriptors, threads, source mappings, or parent anonymous/PTE accounting over the declared 64 MiB margin. That margin is not a verified COW bound.

The actual local suite passed 341 fixtures in 130.732 seconds. Fixtures exercise real local fork/EOF/TERM, descriptor and lock ownership, and a real published enrolment followed by a mocked admission refusal. Source authority and placement remain stand-ins; they do not prove clone cgroup placement or host readiness. The fixture receipt's review-pending field records its earlier creation time; the separate source-review receipt records the later completed review.

Historical 08ea and 990 BLOCK reports, their raw model results, and the conditional fork-design review are retained unchanged. The final actual Claude Code `claude-opus-5-5`, medium-effort, tools-disabled review found no concrete static blocker. It ran no tests or host actions and qualified its exact reading coverage. Its residuals include a pending-handler race inside signal masking that can skip constructor cleanup, unknown-child cleanup with no reason, and a restore-time signal replacing a start failure. These are retained qualifications, not runtime safety claims.

The corrected backend emits `released=false` and `pinChildExited=false` for unknown or live constructor children. Current JS requires both `released` and `pinChildExited` to be true to recognize cleanup, but its safe failure projection drops `childFailureDetails` and `released.cleanupReason`; the original backend frames retain those facts. Backend and JS closed reason enums match exactly at 273 entries. This component does not establish complete external cleanup. The historical integrated review used 990; a final successor review of the complete backend, external, registration and consumer closure remains required.

`provenance.json` binds the copied reports, raw CLI results, immutable gzip-compressed deltas (original-byte hashes are also retained) and source manifest. Prompt bytes remain in the local review archive and are hash-referenced, rather than duplicated here. To check the source manifest, hash each named file under `diagnostics/pinning-prototype` and compare it with `sourceFiles`. To reproduce local fixtures from that directory, run both discovery patterns:

```sh
/usr/bin/python3 -I -B -m unittest discover -s . -p 'test_*.py'
/usr/bin/python3 -I -B -m unittest discover -s . -p 'test_lifecycle*.py'
```

These are local fixture commands. No normal searches, encrypted-history/Jev writes, models, production operations, or benchmark resume are authorized by this evidence.
