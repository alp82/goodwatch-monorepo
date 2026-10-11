# Production backup and search latency, 2026-10-11

The prospective experiment supports backup-associated eviction as a cause of the
Qdrant tail in [#406](https://github.com/alp82/goodwatch-monorepo/issues/406).
It measures direct Qdrant calls, not first usable application results. The remedy
and fresh seven-day acceptance are still outstanding.

## Paired experiment

A lightweight consumer retained three captured ranker batches in memory throughout
the experiment. Its model producer exited before the baseline. No ordinary search
API calls, interpretation-provider calls or search-history writes were made.
The production Qdrant process stayed running with no memory or CPU cap.

Baseline batches ran at 20:10 UTC. The normal hourly backup started at 20:15;
its exit was observed at 20:18:31. Whole-file and filesystem data extent snapshots
completed at 20:18:34 and 20:18:40 without sampling errors. A guarded signal then
released the same three batches at 20:18:52, in the same order.

| Fixed case | Before backup, server | After backup, server | Result ID sets | Ordered IDs and scores |
| --- | ---: | ---: | --- | --- |
| Exact title | 61 ms | 223 ms | Match | Match |
| Native title | 175 ms | 2,123 ms | Match | Differ |
| Low-vote title | 54 ms | 274 ms | Match | Differ |

The [batch artifact](production-backup-batches-20261011.json) retains timings,
shapes and hashes; the [control artifact](production-backup-control-20261011.json)
records the post-backup gate. Inputs stayed unchanged in memory. Sequential calls
can warm pages for later cases. Per-ID score-set hashes were not retained, so the
two ordered differences cannot be attributed to ties, score drift or data updates.
Result-set agreement does not establish ordered ranking parity.

## Residency and physical reads

Residency of filesystem-reported data extents did not decrease between the baseline and pre-backup
snapshots. Across the backup, mapped file cohorts remained the same, but resident
vector data decreased by 26,845 pages, about 110 MB, and graph data by 4,890 pages,
about 20 MB. Sparse and payload residency increased. The
[extent snapshots](production-backup-data-residency-20261011.jsonl) distinguish
filesystem-reported data extents from holes, which may include unwritten
allocations as well as cached zero-filled pages; the
[whole-file snapshots](production-backup-whole-residency-20261011.jsonl) preserve
the original comparison method.

During the backup monitoring interval, Qdrant incurred about 451,439 major faults
and 2.0 GB of physical reads, its RSS decreased about 185 MB, and the kernel
reclaimed about 2.49 million pages. In the post-query interval, Qdrant incurred
about 25,217 major faults and 109.2 MB of physical reads, while RSS increased
about 137 MB. No further reclaim appeared in that post-query interval. These are
aggregate ten-second samples and include any other Qdrant or host activity;
they cannot assign individual faults to the native-title call.

The [counter comparison](production-backup-counters-20261011.json) and
[passive samples](production-backup-passive-window-20261011.jsonl) retain that
evidence. Paired residency loss followed by fresh physical reads and a two-second
known-batch tail strengthens the [isolated cold-page mechanism](cold-page-diagnosis-20261011.md)
with production evidence.

## Limits and next step

This is one backup cycle with concurrent production activity, not a seven-day
latency estimate or a controlled exclusion of every other workload. It does not
separate the Qdrant snapshot stage from the host copy-and-delete stage. Normal
backup scheduling and retention were unchanged.

Actual Claude Code Opus 5.5 medium reviewed the remedy against this production
proof and recommended fixing backup rotation first: rename completed snapshots,
use hardlinks for retention names, and release completed snapshot files from cache.
That change still needs tests, restore verification, deployment and observation
across three modified backup cycles. Query-independent warming remains a fallback
experiment; clone memory-cap reclaim prevents claiming a clean serving fix from it.
