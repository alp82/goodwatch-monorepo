# Qdrant cold-page diagnosis, 2026-10-11

Task [#406](https://github.com/alp82/goodwatch-monorepo/issues/406) remains open.
The isolated experiment establishes a cold-page latency mechanism; it does not
identify what caused the earlier production tails or complete the latency fix.
No seven-day acceptance window has started for #407.

## Controlled clone

An existing production snapshot was downloaded read-only and restored on a
separate host using the same Qdrant 1.19.1 image. The clone contains all six shards,
12 segments and 244,262 points; the live audit contained 244,308 points. Only the
clone was stopped or had cache eviction controls applied. Production caches were
not evicted, and the production Qdrant process was not restarted.

An independent review checked the exact image, task ownership, loopback-only
endpoint, mounts, CPU and memory bounds, and 19,236 store files. Files had no
symlinks, hardlinks, duplicate inodes or resolutions outside the owned directory.
The store used 4.45 GB physically, versus 13.36 GB apparent size due to sparse
and preallocated files. Guards use physical allocation, disk headroom and host
available memory as well as a bounded apparent size.

The [infrastructure artifact](cold-page-infrastructure-20261011.json) records the
snapshot, independent review, limits and nine controls, including nonmeasurements.

Each cold control stops only the clone, flushes and advises eviction of its
verified store files, restarts it, and waits for green readiness. Startup itself
repopulates some pages; “cold” describes the remaining query working pages.
Queries use captured production ranker batches, with no interpretation request,
search API call, history write or allowance spend.

## Complete batches at 6 GiB and two CPUs

| Fixed case | Cold server time | Warm repeats | Cold major faults | Physical reads | Limits affecting batch |
| --- | ---: | ---: | ---: | ---: | --- |
| Exact title | 1,975 ms | 19 / 29 ms | 18,495 | 104.9 MB | None observed |
| Native title | 5,947 ms | 128 / 114 ms | 58,085 | 253.1 MB | Cold memory cap; warm CPU throttling |
| Low-vote title | 3,485 ms | 50 / 46 ms | 23,810 | 128.2 MB | None observed |

Exact-title and low-vote complete batches had no memory-cap, OOM or CPU-throttle
increments. Their warm repeats had no major faults or physical reads. Ordered IDs
and scores agree between cold and warm runs, and between individual signals and
their corresponding complete batches. The native case supports the mechanism but
its absolute timings remain confounded by the clone's resource limits.

Compared with the earlier live replay, all three result ID sets agree, but ordered
ID hashes differ. Live score hashes were not retained, so restored shard ordering,
ties and snapshot drift remain possible explanations rather than established
causes. Clone timing and within-clone parity must not be presented as live ranking
parity or production latency measurements.

The [complete-batch artifact](cold-page-replay-20261011.json) retains the numeric
records and parity hashes.

## Individual signal checks

Two further clone controls tested the exact-title batch's raw fingerprint scan and
English text signal separately. The raw scan took 53 ms cold versus 11 / 19 ms
warm, with 74 major faults and 28.8 MB of physical reads. Its resources did not hit
their limits, and vector residency increased by 5,826 pages. It does not account
for the observed complete-batch delay under these startup conditions.

The English text signal took 2,054 ms cold versus 61 / 16 ms warm, with 13,934
major faults and 61.1 MB of physical reads. Vector residency increased by 13,869
pages while graph residency decreased by 5,867 pages. This supports missing dense
working pages as a candidate for this query; its cold memory-cap counter increased
by 24 and the next repeat by one, so timing and graph eviction remain confounded.
Ordered IDs and scores agree in both individual cold/warm checks.

The [individual-signal artifact](cold-page-isolated-signals-20261011.json) records
the per-call measurements and whole-file residency snapshots. These checks do not
establish the cause of the production tails.

## Persisted memory placement

Live and clone media collection configurations have no explicit `memory`
override. All four dense vectors use
six `InRamMmap` and six `InRamChunkedMmap` segments. Live payload storage uses
`mmap`; sparse indexes use six `ImmutableRam` and six `MutableRam` segments.
No explicit low-memory or population flags were found in the audited container
environment or command.

In the [pinned Qdrant source](https://raw.githubusercontent.com/qdrant/qdrant/v1.19.1/lib/segment/src/types.rs),
legacy dense `on_disk=false` means cached, evictable storage. Dense pinned placement
is rejected by API validation. Runtime low-memory mode or population overrides can
also affect loading without changing persisted configuration. This audit does not
instrument those runtime decisions.

The [placement audit](memory-placement-audit-20261011.json) retains those findings.

Whole-file residency percentages require care: sparse and preallocated holes
inflate apparent size. The initial live vector audit had about 730 MB resident
against 736 MB physically allocated, despite an apparent size near 2 GB.
Those similar totals do not prove allocated data pages were resident: whole-file
resident counts can include cached zero-filled holes. Extent-aware measurements
are needed to distinguish them.

## Production cause remains under test

The deployed backup script matches the repository and runs hourly at :15 UTC.
The 19:18 controlled baseline overlapped its second collection stage. Snapshot
filenames are timestamped before copying, so they are not precise completion
timestamps. This timing association alone does not establish eviction or contention.

Passive recording tracks the actual production Qdrant PID, faults, physical reads,
host memory, pressure and reclaim counters. A separate read-only residency sampler
and three fixed direct Qdrant batches compare before and after the next backup.
The producer exits before the baseline; a lightweight consumer holds its batches
only in memory and waits for an explicit post-backup control. Results from that
prospective experiment are recorded separately when available.

The [scheduler audit](backup-scheduler-audit-20261011.json) records the observed
execution schedule and timestamp limitations.

## Harness limitations

The first 5 GiB experiment hit its memory cap. Its native request failed with an
unknown error because the initial harness discarded error details; it is not used
as an unconfounded result. Process counters initially tracked an entrypoint wrapper;
the 6 GiB results track the actual Qdrant process and cgroup counters.
The [partial 5 GiB artifact](cold-page-partial-5g-20261011.jsonl) retains that failure.

An initial individual-signal selector performed controls without issuing queries;
those controls provide no latency evidence. The corrected path has a fixture that
checks its actual calls. One launcher returned status 127 after its script was
edited while it waited; the underlying complete replay emitted all three cases and
its completion record. Subsequent launchers are immutable while running.

Early disposable producers used Docker's default logging, so their private stdout
may have been written transiently before container removal. Those containers and
their local Docker logs were removed. Subsequent producers explicitly disable
Docker logging; retained
artifacts contain fixed case tags, query shapes, numeric measurements and hashes,
without query vectors, interpretations, result IDs or credentials.
