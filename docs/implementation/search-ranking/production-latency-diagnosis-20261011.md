# Production latency diagnosis — 2026-10-11

Map 100 / task 406 remains incomplete. Three of the six approved production probes missed the 1.5-second first-usable-results target. Read-only replays did not reproduce their ranking timeouts, so these findings support further attribution, not a speculative ranking or SQL change.

The deployed revision was `94fce25b7a141d376f81185991aa24412065ccc9`. The six probes ran from 05:27:41 to 05:28:00 UTC. Only fixed public case tags and numeric diagnostics are retained here; query text, account data, vectors, cached interpretations and credentials are omitted.

| Case | First results, ms | Outcome | First ranking batch pending at deadline, ms |
| --- | ---: | --- | ---: |
| exact-title | 2119 | ranking timeout | 1490.2 |
| native-title | 2851 | ranking timeout | 1388.4 |
| low-vote-title | 2479 | ranking timeout | 1436.1 |
| person | 1134 | hybrid-v2 | — |
| description | 865 | hybrid-v2 | — |
| reference | 708 | hybrid-v2 | — |

The deadline snapshots place the title-case delay inside the await for the first Qdrant batch. They do not separate local socket queueing, connection establishment, server execution, response transfer or event-loop scheduling. The successful cases reported Qdrant wall/server times of 667/623.1, 342.7/284.2 and 255.3/207 ms respectively. The title cases have no corresponding completed server-duration measurement in the deadline snapshot.

## Exact round-one replay

Read-only diagnostics decoded the approved cases' existing ready interpretation cache in memory. Production `rankSearch`, the actual query encoder, index build `20261011T041503Z` and production filter construction generated the complete round-one payloads. The first outbound Qdrant batch was intercepted before execution and then replayed as a complete batch and as individual signals. This performed no interpretation requests or search-history writes. Six existing model files were verified and no model files downloaded.

The second replay used the original production `queryBatch` HTTP transport, including its agent, DNS path, request headers, timeout handling and JSON parsing, in a separate process with a fresh connection pool.

| Case | Signals | First production-transport batch wall/server, ms | Warm repeat wall/server, ms |
| --- | ---: | ---: | ---: |
| exact-title | 3 | 34.1 / 23 | 33.6 / 26 |
| native-title | 7 | 77.2 / 68 | 65.9 / 57 |
| low-vote-title | 7 | 49.3 / 40 | 48.2 / 39 |

No batch timed out. The earlier custom Node HTTP replay also completed all batches in 34–102 ms. Individual signals did not reveal a persistent expensive filter or vector query. Qdrant collection status was green with no optimizer errors, 243839 points, 12 segments and six shards at the read-only inspection.

“First” identifies the first batch in a diagnostic process; it does not establish a cold Qdrant cache. No backend cache flush or service restart was performed. The independent process cannot reproduce the original serving process's socket pool, event-loop load or concurrent work. These few replays do not establish production p95 or satisfy the seven-day acceptance window.

## Claim outlier

The native-title probe also recorded 802.7 ms in the spend SQL stage. The corresponding Crate job took 795 ms, placing that outlier principally inside Crate. Twenty repetitions of the same read-only aggregate produced a wall-time median of 9.25 ms, nearest-rank p95 of 11.4 ms and maximum of 42.9 ms; server duration peaked at 6.64 ms. GC, disk latency and historical contention remain unproven. No change to spending semantics is supported by this evidence.

## Next evidence

A passive diagnostic step should record fixed numeric HTTP phase spans for socket assignment, connection readiness, response headers and response completion, together with completed Qdrant server duration. It should retain late completion timing after the ranking deadline without changing the deadline, admission hold or ranking payload. Time-correlated event-loop delay and host/Qdrant metrics would distinguish client scheduling from server execution when the tail recurs. Avoid query text, account identifiers, vectors or cache keys in these diagnostics.

No ranking-quality, timeout or admission policy was changed. The first-usable-results target and zero-error seven-day window still require fresh production evidence after the latency problem is resolved.

## Evidence files

- [Six production responses](production-probes-20261011.jsonl)
- [Production stage snapshots](production-probe-stages-20261011.json)
- [Read-only Qdrant/filter isolation](production-qdrant-isolation-20261011.json)
- [Exact round-one replay with both transports](production-qdrant-round1-replay-20261011.json)
- [Claim SQL outlier and repetitions](production-claim-spend-audit-20261011.json)
