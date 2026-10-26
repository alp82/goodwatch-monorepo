# Title page deadline during a graceful CrateDB restart (#774)

Issue: https://github.com/alp82/goodwatch-monorepo/issues/774

Measured on main `45b4d909d`, 2026-10-26, with three disposable CrateDB 5.10.16 nodes.
No production connection or environment file was used. Production code is unchanged by this
investigation. The ordinary three-coordinator graceful proof still fails; a timeout candidate
was rejected after it introduced a cold-start 503 before the fault.

## Evidence and reproduction

Run [the local harness](../../goodwatch-webapp/scripts/crate-failover/README.md).
The committed [measurement receipt](../../goodwatch-webapp/scripts/crate-failover/results/title-deadline-774.json)
contains source/report hashes, request IDs, paired title attempt timings, fault/rejoin times,
route totals, cluster samples and cleanup receipts. Full raw reports/logs are in
`/home/alp/.cache/gw-work/title-503/`; these local scratch paths are supplementary, not required
to read the committed measurements. Each run used project `gw774-title-503` and loopback port
17774. Heap was 384 MiB, CPU limit one core per node, as in the existing harness.

The earlier untouched-main control from #634, started 00:27:06.819 UTC, had four 503s at
3000.173, 3000.699, 3000.986 and 3001.462 ms. Its request IDs are in #774's body. The new
baseline reproduced four 503s (three movie, one show); a second, traced run reproduced five
(three movie, two show). Thus this is independent of #633/#634's tracking changes.

| Run (UTC start) | Coordinators used by app | Movie successes / 503s | Show successes / 503s | Verdict |
| --- | --- | ---: | ---: | --- |
| Baseline 00:46:57 | All three | 166 / 3 | 192 / 1 | Red |
| Traced 00:48:46 | All three | 211 / 3 | 236 / 2 | Red |
| Survivor control 00:50:51 | Node2 and node3 | 279 / 0 | 354 / 0 | Full proof green |
| Rejected candidate 00:53:30 | All three | 0 / 1 | 1 / 0 | Red during warmup, before restart |

The survivor control completed all eight lost-response checks, durable-write audits and cleanup.
All 3,647 route requests succeeded (including warmup and the two post-load score checks),
6,178 probe reads succeeded, and 1,259 keyed inserts/upserts succeeded. This is an experiment,
not a deployed fix or permission to change production configuration.

## What exceeded the deadline

The title's essential dependency is `getDetailsForMovie` / `getDetailsForShow`, wrapped by
`titleDetailsWithin` at 3,000 ms. The large details CTE is one client query, with internal SQL
subqueries; it is not a serial chain of separate title-detail HTTP requests. SQL has a shared
10,000 ms budget. With three coordinators, the client initially reserves 3,334 ms for one
attempt. A silent draining/rejoining coordinator therefore outlasts the whole page deadline
before the existing safe-read retry can run. Failure-driven cooldown also starts too late.

The traced run proves this for four requests:

| Request ID | Phase | Initial coordinator | First result | Next coordinator elapsed / server ms |
| --- | --- | --- | --- | --- |
| 4513fd7b-f5f0-4794-a3c9-5417c4d831b4 | Decommission | Node1 | Timeout at 3335.830 ms | Node3: 582.420 / 497.487 |
| a24c6ba6-79f4-4d20-8dd2-4de54796ae31 | Decommission | Node1 | Timeout at 3334.646 ms | Node3: 342.980 / 246.820 |
| ef6c7183-9341-4561-ba2b-d38fb09551df | Rejoin | Node1 | Timeout at 3334.565 ms | Node3: 13.206 / 12.260 |
| e847742f-4ce7-45c0-a1f2-ddfbbe6504b8 | Rejoin | Node1 | Timeout at 3334.761 ms | Node3: 306.655 / 304.937 |

All four pages had already returned 503 before their retry started. No draining-node SQL error
was received before those timeouts. Successful retries use the same SQL; the 13 ms survivor
result especially argues against a cluster-wide absence of readable shards as the sufficient
explanation for that request. It does not identify the internal Java wait on node1: no thread
dump was captured, so metadata/planning/shard waits inside that coordinator remain unclassified.

The fifth request, `9d2334fc-f133-480b-a089-e2f4c2fe7ac8`, started at 00:49:06.862 on node1
and completed successfully in 3072.567 ms, of which Crate reported 3070.635 ms. Its page
returned 503 at 3001.132 ms. Decommission was requested at 00:49:09.860; nearly all that
latency occurred before the fault. A coordinator policy alone cannot make every cold/loaded
query meet 3 s. There is a separate cold query latency concern.

Shard samples show relocation/recovery around the fault, and container CPU samples approach
the one-core limits. A node2 cgroup sample reported 528 throttled periods out of 661. These
are workload conditions, not proof that CPU throttling or a particular SQL subquery caused
node1's waits. The survivor control still underwent real shard movement/rejoin and had zero
SQL attempt failures for its 633 title queries. Its slowest title SQL was 2778.416 ms, so even
healthy queries in this fixture can legitimately take longer than 1 s.

## Rejected contained fix

The [candidate patch](../../goodwatch-webapp/scripts/crate-failover/results/rejected-title-attempt-cap-774.patch)
adds an optional 1,000 ms safe-read attempt cap to the details query while another coordinator
remains. The final coordinator keeps the remaining total SQL budget. Writes are unaffected.
A real HTTP regression passed the title query through `titleDetailsWithin`: it failed with the
actual 503 before the patch and passed with it. Additional cases verified mutation behavior
and the final coordinator's budget (32 focused tests passed with the candidate).

The real-Crate cold run then disproved safety: movie warmup tried node2 for 1000.913 ms,
node3 for 998.721 ms, then node1 for 1257.526 ms (server 1255.762 ms). Both early attempts
timed out while still healthy. The page crossed 3 s before the final result. Aborting/restarting
cold work can cost more than allowing the original attempt to complete. The candidate was
reverted, including its tests. The patch remains only as a reproducible rejected experiment.

## Options

1. **Bounded hedging for title-details reads.** Start one alternate coordinator after a measured
   delay while keeping the original attempt alive; accept the first successful result and close
   the loser. Preserve shared cache fills and error semantics. Bound concurrency and ensure
   unavailable/missing-title errors cannot win over a successful result. Recommended code
   follow-up, with cold/warm, loaded, all-slow, cancellation and real restart tests. It needs a
   separate design because extra concurrent SQL can amplify load and closing the HTTP socket
   has not been shown here to cancel server execution.
2. **Split or simplify the details SQL critical path.** Keep essential title fields under the page
   budget and move suitable extras to their existing optional boundaries. First profile/query-plan
   the CTE; this investigation identifies the query, not the expensive subquery. This is a broader
   query/response-shape change and needs cold-cache and distinct-title workload coverage.
3. **Maintenance routing procedure.** Exclude the leaving coordinator before drain and restore
   it after readiness/warmup. The survivor control supports this direction for this fixture only.
   An operational proposal needs connection/config rollout and readiness criteria; no production
   setting was changed. Keep #774 open for normal unexpected restarts.

Do not simply increase the page's 3 s gate or globally shorten SQL timeouts: neither addresses
both measured failure classes. Recommend option 1 as the code follow-up, with option 3 evaluated
separately if maintenance is imminent.

## Validation and limits

The harness needed compatibility repairs for current main's optional genre-row dependencies
and user-settings fixture shape before it could reach this fault. SQL and route deadline
assertions were preserved. It now accepts isolated project/port values and optional SQL tracing.
External auth/cache/availability/related content boundaries remain fixture stubs, as in the
original proof; rendering, production data size and Valkey resilience are outside this proof.

Before any runtime edits: client/title-budget tests **29 passed**. Full web suite: **5,246 passed,
11 failed, 8 skipped, 1 todo** (5,266 total). Failures include unrelated auth/import fixtures,
scoring expectations and performance thresholds; the full suite was run while a baseline proof
was active, so those performance failures are not isolated measurements. Typecheck returned
**192 diagnostics**, byte-identical on main and the candidate. Pytest stopped at **87 collection
errors**, including missing `groq`, `croniter`, `mongomock` and `crate` packages. These gates are
not reported green. Build and final focused/SSR checks are recorded in the measurement receipt.

No runtime fix is included and the ordinary graceful gate remains red. All owned containers,
volumes and networks were removed; no other thread's containers were stopped.
