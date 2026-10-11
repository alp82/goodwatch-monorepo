# Serving-process latency and restart comparison — 2026-10-11

Task #406 remains open. The deployed HTTP phase instrumentation has reproduced the remaining delay inside Qdrant server processing, while warm read-only replays and a restarted search process complete quickly. This evidence does not yet establish the cause or satisfy seven-day acceptance.

The observation and both controlled sequences used search-role commit `5f15698995eb4368baf5ea094b704a3752191e40`. Afterward, both roles were rolled to `927d38b2cca815f02a0b1636ec06f63c24603396` to include already merged palette/title-prefix changes; each became healthy with loaded models after 21 seconds. This source alignment is separate from resolving the measured Qdrant tail.

## Retained serving evidence

From 05:58:00 to 19:12:16 UTC, the durable collector retained 24 accepted and completed requests, 24 successful history acknowledgements, no lookup error flags, no rejection events and no collection gaps. First usable results had median 735 ms, nearest-rank p95 1648 ms and maximum 1697 ms. This observation predates ingress activation and is shorter than seven days. Same-key deliberate traffic cannot be independently separated.

Three over-target requests spent 890–1102 ms in the first Qdrant round after 368–478 ms of reading work. Authenticated history stage sums corroborate the temporally associated batches. Socket assignment took 1–3 ms and transport overhead 7–13 ms; these tails principally occurred in Qdrant, rather than its client's connection pool. HTTP batch UUIDs and lifecycle UUIDs are different, so associations remain temporal, not direct ID joins.

The route lifecycle clock starts slightly before the combined-search clock: the three lifecycle first-result timings are 1636/1697/1648 ms and corresponding history timings 1630/1691/1647 ms. Report both sources without substituting computation time for first usable results.

## Twelve owner-approved searches

Both sequences used identical normal JSON bodies, one request at a time, through loopback inside role A. No cookies, authentication or trusted ingress headers were supplied. Each completed stream was followed by nine seconds for late Qdrant work to drain. These calls write normal encrypted history and may use allowance; the owner explicitly authorized the bounded comparison. No further ordinary searches are included.

The baseline ran at 19:18:05–19:19:06 UTC on the process started at 05:57 UTC. A was then recreated on the same image while B remained healthy; readiness and loaded query models were verified. The repeated sequence ran at 19:20:15–19:21:12 UTC. Only A was restarted; Qdrant, Redis, Crate and filesystem caches were not flushed. The sequential runs also warmed shared caches, so order and cache warming remain comparison limitations.

| Fixed case | Baseline first/full, ms | After A restart first/full, ms | Baseline / restart warnings |
| --- | ---: | ---: | ---: |
| Exact title | 1962 / 1962 | 460 / 460 | 1 / 0 |
| Native title | 1856 / 1856 | 612 / 612 | 1 / 0 |
| Low-vote title | 1211 / 1211 | 442 / 442 | 0 / 0 |
| Person | 1050 / 1050 | 284 / 284 | 0 / 0 |
| Description | 787 / 787 | 447 / 447 | 0 / 0 |
| Reference | 563 / 563 | 348 / 348 | 0 / 0 |

All requests returned HTTP 200. Baseline exact/native title batches exceeded the ranking deadline and continued in the background: Qdrant reported 1934.1 and 4652.5 ms server processing, versus 1943.5 and 4672.1 ms total HTTP duration. The native-title stream finished before its late batch. A 200 response does not mean a warning-free search.

No provisional batches were observed in these twelve cases. These controlled timings are client receipt of the first usable NDJSON batch, separately from server history enqueue and computation. They are not a seven-day production p95. The twelve probes and all setup checks must precede any acceptance start.

## What remains

Current optimizer status and retained media/reference collection optimizer timelines do not overlap the measured slow windows. File-backed paging and rising Qdrant resident memory were observed, but samples began after the slow baseline calls and do not yet prove paging caused them. Historical infrastructure metrics were unavailable through the existing write-only monitoring credentials.

Read-only replay of the actual ranker/encoder/index/filter construction found no persistently expensive signal in the warmed backend: 27 complete batches and 105 individual signals succeeded, with repeated ordered-ID parity and individual/batch parity. Known exact-title batches took 26–29 ms wall time, native-title 93–102 ms, and low-vote title 45–52 ms. A disposable diagnostic container used the same pinned production image and index, keeping its memory separate from serving roles. Historical request filters were not stored, so their reconstructed policy variants cannot be claimed as exact payload parity; the new fixed-case bodies are known. An isolated snapshot clone is being used to test cold versus warm file residency without evicting production files or changing ranking quality, deadlines or spending rules.

Privacy-safe ingress logging is now active on both hosts; see [activation evidence](ingress-activation-20261011.json). Acceptance still requires an evidence-backed latency fix followed by a fresh, fully covered seven-day window.

## Artifacts

- [Serving journal and authenticated numeric stage audit](production-serving-audit-20261011.json)
- [Baseline response timing records](production-probes-baseline-20261011.jsonl)
- [Post-restart response timing records](production-probes-after-restart-20261011.jsonl)
- [Retained probe lifecycle and HTTP phase events](production-probe-http-phases-20261011.json)
- [Subsequent source alignment and smoke verification](production-source-alignment-20261011.json)
- [Warm batch/signal replay and explicit reconstruction limits](production-warm-replay-20261011.json)
