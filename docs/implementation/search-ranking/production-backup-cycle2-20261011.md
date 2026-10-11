# Second modified-backup cycle: native batch tail remains

Task [#406](https://github.com/alp82/goodwatch-monorepo/issues/406), verification [#407](https://github.com/alp82/goodwatch-monorepo/issues/407), map [#100](https://github.com/alp82/goodwatch-monorepo/issues/100). The second frozen hourly comparison completed the modified backup successfully, but the first native-title Qdrant batch afterward took **2,747.7 ms**, compared with 170.4 ms before backup and 91.7 ms on its warm repeat. Rotation and completed cache advice did not remove this diagnostic tail. Cycle three remains pending at this audit; these observations do not establish application latency or seven-day acceptance.

## Retained evidence and execution

The [sanitized report](production-backup-cycle2-report-20261011.json) was generated with the current offline `cycle_report` helper, SHA-256 `59fe995eba6018d447ee4ca231139f9de2446d1322213b723915cc2ee333bd75`, without selecting a diagnostic policy. It retains the controller and deployed backup hashes, phase events, source counts and hashes, three counter brackets, case comparisons and coarse extent comparisons. Sources are the [431-record observer prefix](production-backup-cycle2-observer-20261011.jsonl), [12 consumer records](production-backup-cycle2-consumer-20261011.jsonl), and [before/after allocation metadata](production-backup-cycle2-allocation-20261011.json). These contain fixed case tags, numeric observations, result/score hashes and booleans, without queries, vectors, account data, credentials or private paths.

The continuous observer and memory-only consumer remained unchanged. Baselines began at 22:10 UTC on 2026-10-11. Backup phases ran from 22:15:02.184 to 22:17:05.347 UTC: 16 phase events, zero failed phases, two accepted and zero rejected advice calls. Media snapshot creation took 120,111.049 ms; reference snapshot creation took 2,548.812 ms. Both collections completed snapshot, publish, cache-advice and retention phases. Publication and advice success establish completed operations, rather than removed cache pressure.

The first post-backup queries began after observed process exit, successful phase checks and fresh whole/extent snapshots. A separate counter gate preceded one warm repeat of each unchanged batch. The consumer completed this cycle at 22:17:32.431 UTC; the observer retained warm counters and residency afterward. No application search, interpretation call or history write was involved.

| Fixed case tag | Signals | Baseline server ms | First post-backup server ms | Warm repeat server ms |
| --- | ---: | ---: | ---: | ---: |
| known-exact-title | 3 | 78.3 | 1,059.7 | 26.8 |
| known-native-title | 7 | 170.4 | 2,747.7 | 91.7 |
| known-low-vote-title | 7 | 48.9 | 428.8 | 40.3 |

ID-set hashes and sorted per-ID score hashes match baseline to post and post to warm for all three cases. For the native batch, ordered result-ID and ordered ID-and-score hashes differ between baseline and first post, then match post to warm. Its ordering change remains unexplained; sorted score parity must not be reported as ordered parity. Exact and low-vote ordered comparisons match throughout. This compares captured signal batches and does not validate whole-product ranking or unseen inputs. Sequential calls can warm later cases.

## Residency and counter observations

The table compares filesystem-reported data-extent residency before backup (22:14:26.932 UTC), after backup (22:17:16.095), and after the warm repeat (22:17:50.155). Source timestamps and class metadata remain in the observer prefix. Pages are 4,096 bytes.

| Mapped-file class | Data-extent pages before → after | Resident pages before → after → after warm |
| --- | ---: | ---: |
| vector | 179,435 → 179,437 | 173,508 → 131,623 → 174,129 |
| graph | 104,256 → 104,256 | 64,460 → 98,586 → 100,790 |
| sparse | 54,850 → 54,850 | 34,250 → 39,765 → 39,765 |
| payload | 576,867 → 576,868 | 403,760 → 424,977 → 431,292 |
| other | 105,093 → 105,097 | 45,773 → 93,742 → 93,742 |

The vector resident count falls by 41,885 pages, approximately 171.6 MB, while graph, sparse, payload and other resident counts rise. These are aggregate count differences, not exact same-range eviction totals. File identities and counts match before/post in every class, but vector, payload and other extent counts grow. The helper therefore marks those comparisons incomparable; its overall cycle status is `incomparable`, with a separate finding for the native direct-batch tail. It does not silently turn small extent growth into proof of an unchanged cohort.

Extent-sampling failures, excluded files and unsupported files are zero. Exact SEEK_DATA/HOLE ranges and contents were not retained. Even matching identity hashes and page counts permit only coarse comparison, because concurrent range or content changes remain possible. Whole-file sparse-hole residency is excluded from these data-extent comparisons. Post-to-warm counts are comparable by the helper's coarse rule, and vector residency rises by 42,506 pages during those batches and grace. Fast repeats still do not establish recovery for all mapped pages or unseen queries.

| Aggregate counter bracket | Major faults | Physical read bytes | Host kswapd pages stolen |
| --- | ---: | ---: | ---: |
| Last pre-phase sample → pre-post-query counters | 446,171 | 1,397,317,632 | 463,210 |
| Three first post batches plus grace | 45,508 | 203,182,080 | 0 |
| Three warm batches plus grace | 512 | 2,097,152 | 0 |

The first bracket begins at 22:14:57.906 UTC. Its ending control event is stamped 22:17:16.465 after signaling; counters were read before signaling, but their exact read timestamp was not retained. The post and warm counter records are stamped 22:17:31.803 and 22:17:43.309. These timestamps fence sequential reads; they do not provide exact proc-read instants. Ten-second grace, sampling overhead, organic traffic and background work can contribute. No fault count is attributed exclusively to a batch, and overlapping reclaim fields must not be summed.

The retained passive interval from 22:16:50.273 to 22:16:58.915 shows `pgsteal_kswapd` increasing by 293,131 pages and `pgscan_kswapd` by 295,676. Media snapshot creation was still active; its completion, publication and cache advice came afterward. This places substantial reclaim within the snapshot phase, but does not identify the internal snapshot stage or allocating process. No during-backup meminfo was retained, so later available-memory readings cannot establish headroom during reclaim.

Allocation observations at 22:08:44.022 and 22:18:18.422 retain the same actual Qdrant child PID and pinned image. Docker memory/CPU limits are zero, cgroup memory.max/high are `max`, and CPU quota is `max` in both observations. These samples show no quota in either retained observation, rather than continuous proof against unobserved allocation changes.

## Completion limits

The [first modified cycle](production-backup-cycle1-20261011.md) also retained a native direct-batch tail. Cycle two independently adds successful backup phases, late snapshot-phase reclaim, a vector resident-count deficit and a slow first native batch that becomes fast on repeat. The mapped working sets and resident distributions differ between cycles, so cross-cycle page counts are not an unchanged-cohort comparison. This supports continuing the reviewed diagnosis; it does not select or validate a remedy.

The frozen third cycle continues without added queries, warming, restarts or producer work on the production Qdrant host. New remedy experiments require their own reviewed guards and evidence. Ten report fixtures and six separate memory-observation fixtures pass; reporting checks do not establish production efficacy.

Tasks 406/407 and map 100 remain open. No new seven-day window is established. Acceptance requires rollout followed by seven days of covered organic searches with zero errors and first usable results p95 below 1.5 seconds, with full completion time reported separately. Direct Qdrant diagnostic times cannot satisfy that criterion.
