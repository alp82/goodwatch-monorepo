# Three modified-backup cycles: observation complete, latency remedy incomplete

Task [#406](https://github.com/alp82/goodwatch-monorepo/issues/406), verification [#407](https://github.com/alp82/goodwatch-monorepo/issues/407), map [#100](https://github.com/alp82/goodwatch-monorepo/issues/100). The frozen three-hour comparison completed successfully as an observation. Each hourly backup completed its phases and cache advice, yet the first native-title Qdrant batch afterward took **3,991.7, 2,747.7 and 2,242.8 ms**, respectively. Warm repeats took 84.2, 91.7 and 97.3 ms. The modified rotation has not supplied the required latency remedy in these controlled cases.

## Complete sources and reproduction

The [full observer journal](production-backup-three-cycles-observer-20261011.jsonl) contains 1,077 records; its final completion event is 2026-10-11 23:17:49.250 UTC. There is no failure event and observer stderr was empty. The [consumer journal](production-backup-three-cycles-consumer-20261011.jsonl) contains 38 records and completes at 23:17:31.692 UTC. The process and private input producer had no new workloads added during the frozen experiment. Production heavy source reads remained on hold until the observer's final counters and residency sampling completed.

The [descriptive report](production-backup-three-cycles-report-20261011.json) was recomputed with the existing offline helper, without a selected policy. It records `journalsComplete=true`, `recordedFailure=false`, and valid evidence gates for all three cycles. Overall diagnostic status is `incomparable` because earlier vector extent counts changed; the direct native-batch tail is retained independently in every cycle. Completion of observation must not be presented as success of the latency remedy.

[Provenance](production-backup-three-cycles-provenance-20261011.json) pins source hashes, record counts, the reviewed controller, deployed backup script and report helper, and all six production allocation observations. The report helper SHA-256 is `59fe995eba6018d447ee4ca231139f9de2446d1322213b723915cc2ee333bd75`.

```sh
python3 goodwatch-qdrant/diagnostics/report.py \
  docs/implementation/search-ranking/production-backup-three-cycles-observer-20261011.jsonl \
  docs/implementation/search-ranking/production-backup-three-cycles-consumer-20261011.jsonl
```

This command returns exit 1 for the retained `incomparable` diagnostic status; it does not indicate missing execution or a runtime failure. Ten report fixtures and six memory-observation fixtures pass. These files retain fixed tags, numeric counts/spans, enum metadata and result/score hashes. No query text, vectors, account data, credentials or private paths are retained.

## Controlled batch results

Three unchanged batches stayed in consumer memory. Each cycle ran a baseline before backup, first post-backup batches only after process exit, successful phase checks and whole/extent snapshots, then one warm repeat after a separate counter gate. Exact/native/low-vote batches contain 3/7/7 signals. These direct Qdrant durations do not measure application first-usable results, organic p95 or the full ranker; sequential queries can warm later cases.

| Cycle | Fixed case tag | Baseline server ms | First post-backup server ms | Warm server ms |
| --- | --- | ---: | ---: | ---: |
| 1 | known-exact-title | 57.5 | 1,347.6 | 18.7 |
| 1 | known-native-title | 242.3 | 3,991.7 | 84.2 |
| 1 | known-low-vote-title | 60.8 | 611.0 | 45.0 |
| 2 | known-exact-title | 78.3 | 1,059.7 | 26.8 |
| 2 | known-native-title | 170.4 | 2,747.7 | 91.7 |
| 2 | known-low-vote-title | 48.9 | 428.8 | 40.3 |
| 3 | known-exact-title | 67.8 | 1,093.5 | 33.1 |
| 3 | known-native-title | 180.9 | 2,242.8 | 97.3 |
| 3 | known-low-vote-title | 56.0 | 386.9 | 43.2 |

ID sets and sorted per-ID score hashes match for all baseline-to-post and post-to-warm comparisons. Ordered result-ID and ordered ID-and-score hashes differ in two comparisons: cycle 2 native baseline-to-post, and cycle 3 exact post-to-warm. Other ordered comparisons match. Those ordering differences remain unexplained; equal per-ID scores must not be reported as ordered parity or whole-product ranking validation.

Each cycle retains 16 phase events, zero failures, two accepted and zero rejected advice calls. Both media and reference collections completed snapshot, publish, cache-advice and retention. [Cycle one](production-backup-cycle1-20261011.md) and [cycle two](production-backup-cycle2-20261011.md) retain their individual audits. Cycle three ran from 23:15:02.044 to 23:17:06.966 UTC: media snapshot creation took 121,956.702 ms and reference snapshot creation 2,527.263 ms. Publication/advice success establishes completed operations, rather than an absence of cache pressure.

## Third-cycle residency and faults

Data-extent samples were retained before backup at 23:14:27.131 UTC, after backup at 23:17:16.379, and after warm at 23:17:49.192. Pages are 4,096 bytes.

| Mapped-file class | Data-extent pages before → after | Resident pages before → after → after warm |
| --- | ---: | ---: |
| vector | 179,505 → 179,505 | 174,544 → 149,761 → 176,939 |
| graph | 104,256 → 104,256 | 100,792 → 91,785 → 93,692 |
| sparse | 54,863 → 54,863 | 39,850 → 39,749 → 39,756 |
| payload | 576,924 → 576,927 | 444,389 → 420,009 → 424,960 |
| other | 105,209 → 105,212 | 93,856 → 88,937 → 88,939 |

Before/post vector, graph and sparse identities, file counts and data-page counts match, meeting the helper's coarse comparison rule. Vector and graph resident-count differences are −24,783 and −9,007 pages, approximately 101.5 and 36.9 MB. Payload and other extent counts grow and remain incomparable. Post-to-warm vector and sparse counts also grow, so their raw differences are retained without claiming an unchanged range cohort. Sampling failures, excluded files and unsupported files are zero throughout.

Exact extent ranges and file contents were not retained. Matching identity hashes and counts cannot rule out concurrent range/content changes, and resident-count differences are not exact same-range eviction totals. SEEK_DATA/HOLE uses filesystem semantics; whole-file sparse-hole residency is excluded. Working sets differ between cycles, so their aggregate page counts must not be compared as an unchanged cohort. Same-query warm speed cannot establish coverage or recovery for unseen inputs.

| Third-cycle counter bracket | Major faults | Physical read bytes | Host kswapd pages stolen |
| --- | ---: | ---: | ---: |
| Last pre-phase sample → pre-post-query counters | 442,864 | 823,865,344 | 410,019 |
| Three first post batches plus grace | 27,609 | 128,937,984 | 0 |
| Three warm batches plus grace | 2,027 | 8,302,592 | 0 |

The bracket fences are 23:14:58.084 → 23:17:16.768 → 23:17:31.068 → 23:17:42.539 UTC. Post-control events are stamped after signaling, while their counters were read beforehand; exact proc-read instants were not retained. Ten-second grace, observer overhead, organic traffic and background work can contribute. Host reclaim fields overlap and must not be summed. No fault count is assigned exclusively to an individual batch.

The journals place substantial reclaim late in snapshot creation in the preceding cycles and near the third snapshot's completion boundary. They do not identify the internal snapshot stage or allocating process. No during-backup meminfo was retained; later headroom cannot establish headroom during reclaim. The separate prepared memory-pressure collector remained unlaunched during this experiment.

All six before/after allocation observations retain the same actual Qdrant child PID and pinned image. Docker memory/CPU limits are zero; cgroup memory.max/high and CPU quota are `max` in every observation. These are retained allocation observations, rather than continuous proof against unobserved changes. Serving/Qdrant restarts, production helper deployment and extra model/profile/query workloads were not added to this frozen comparison.

## Remaining work

The direct native batch retains a tail in each of three scheduled observations, with post-backup faults, storage reads and a large warm improvement. This is a feedback loop for further guarded diagnosis, not an efficacy rate, a calibrated diagnostic policy or a selected remedy. Prepared clone helpers require their own feasibility, memory/headroom, residency, resource and parity gates before any production decision.

No fresh seven-day acceptance window is established. Tasks 406/407 and map 100 remain open. Acceptance requires rollout followed by seven days of covered organic searches with zero errors and first usable results p95 below 1.5 seconds, with full completion time reported separately. The completed diagnostic cannot satisfy that criterion.
