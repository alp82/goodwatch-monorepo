# First modified-backup cycle: tail remains

Task [#406](https://github.com/alp82/goodwatch-monorepo/issues/406), verification [#407](https://github.com/alp82/goodwatch-monorepo/issues/407), map [#100](https://github.com/alp82/goodwatch-monorepo/issues/100). The first observed hourly cycle after [PR #439](https://github.com/alp82/goodwatch-monorepo/pull/439) completed all backup phases, but the controlled native-title Qdrant batch took **3,991.7 ms** afterwards. Rotation alone did not remove the tail in this cycle. Two further scheduled cycles remain pending at this audit; this is neither an efficacy rate nor seven-day acceptance.

## Deployment and controlled measurements

[Rollout evidence](backup-rotation-rollout-20261011.md) records deployment at 2026-10-11 20:52:15.917 UTC of backup script SHA-256 `eeedbb37190845856ec63528e8dc86f8fbac376b8bfa2037b5d8b9ced572d705`. The frozen observer retained 216 cycle-one records. Backup phases ran from 21:15:02.077 to 21:17:04.401 UTC: 16 phase events, zero failed phases, two accepted and zero rejected cache-advice calls. Successful publication, fsync and advice establish completed operations, rather than removed production cache pressure.

The [independent sanitized audit](production-backup-cycle1-audit-20261011.json) compares three unchanged, memory-only direct Qdrant batches. Their baselines began at 21:10 UTC; first post-backup batches began only after observed backup exit, successful phases and post-backup whole/extent residency snapshots. One warm repeat began after a separate counter gate. No application search, interpretation call or history write was involved.

| Fixed case tag | Signals | Baseline server ms | First post-backup server ms | Warm repeat server ms |
| --- | ---: | ---: | ---: | ---: |
| known-exact-title | 3 | 57.5 | 1,347.6 | 18.7 |
| known-native-title | 7 | 242.3 | 3,991.7 | 84.2 |
| known-low-vote-title | 7 | 60.8 | 611.0 | 45.0 |

Ordered result-ID hashes, ordered ID-and-score hashes, ID-set hashes and sorted per-ID score hashes all match baseline to post-backup for all three cases. Ordered and sorted score hashes also match post-backup to warm repeat. This establishes parity for these captured signal batches; it does not validate whole-product ranking or unseen inputs. Sequential calls can warm later cases. These direct-batch times are diagnostic observations, not application first-usable latency or organic p95.

## Residency and counter evidence

The table compares filesystem-reported allocated data-extent residency before backup (21:14:27.533 UTC), after backup (21:17:15.513), and after the warm repeat (21:17:51.212). Pages are 4,096 bytes.

| Mapped-file class | Data-extent pages before → after | Resident pages before → after → after warm |
| --- | ---: | ---: |
| vector | 179,711 → 179,712 | 174,918 → 110,392 → 172,271 |
| graph | 103,765 → 103,765 | 98,478 → 52,836 → 59,593 |
| sparse | 54,897 → 54,898 | 41,865 → 38,845 → 38,845 |
| payload | 577,505 → 577,508 | 463,213 → 431,489 → 434,730 |
| other | 104,471 → 104,475 | 95,305 → 45,076 → 45,076 |

File identity hashes and file counts match in each class, and extent-sampling failures/unsupported files are zero. Exact extent ranges and contents were not retained. Matching hashes or page counts permit only coarse comparisons; they cannot establish byte-for-byte unchanged ranges. Small extent-count growth is visible in four classes. The vector and graph resident-count differences are −64,526 and −45,642 pages, respectively; they are aggregate differences, not exact same-range eviction totals. SEEK_DATA/HOLE reflects filesystem semantics, and whole-file residency includes sparse holes.

The 84.2 ms native repeat is same-query warm. Graph data remains about 57% resident and other about 43% after that repeat, compared with about 95% and 91% before backup. Fast repeated queries therefore do not establish recovery across the mapped working set.

| Aggregate counter bracket | Major faults | Physical read bytes | Host kswapd pages stolen |
| --- | ---: | ---: | ---: |
| Last pre-phase sample → pre-post-query counters | 448,674 | 741,441,536 | 674,848 |
| Three first post batches plus grace | 64,442 | 288,378,880 | 0 |
| Three warm batches plus grace | 226 | 925,696 | 0 |

The first bracket begins at the last passive sample before the first backup phase, 21:14:58.515 UTC. Its ending control event is stamped 21:17:15.931 after signaling; the counters were read before the query signal, but their exact read timestamp was not retained. The other bracket record fences are 21:17:32.314 and 21:17:43.811. Counter timestamps are fences, not exact proc-read instants. Ten-second grace, observer overhead, organic traffic and background work can contribute; no fault count is attributed to an individual batch. Host reclaim fields overlap and must not be summed as independent totals.

Actual Qdrant PID/image continuity was preserved, with no Docker or cgroup memory/CPU quota in the retained production allocation samples. This differs from the earlier memory-capped clone experiment. No during-backup meminfo was retained: available memory sampled later cannot establish headroom during reclaim. The allocating source remains unattributed.

## Next reviewed experiment and completion limits

The actual Claude Code Opus 5.5 review proposes a preventive host helper that maps files read-only and locks allocated data extents for vector, graph, sparse and other classes. Payload remains measurement-only until filter-related fault attribution supports expanding the target. This is a proposed design, not a validated or deployed remedy. Earlier clone prefault success had memory-cap events and excluded payload/other, so it supplies no clean production remedy proof.

Before a production decision, freeze the new rule and code, review memory/headroom and lock-byte bounds, and run a guarded clone negative control followed by pinning under bounded snapshot-sized pressure. Require explicit residency/fault and cap/OOM/throttling outcomes, ordered and sorted per-ID score parity, and held-out coverage for multilingual dense search, must-filters, limit 2,000, multi-term sparse and low-vote cases. Missing coverage must stay explicit. Restart/segment-turnover fixtures must show reconciliation without leaked locks. Capture query batches privately in memory, with no query/vector/credential persistence. Clone resource bounds differ from production and limit causal transfer.

The running 21/22/23 UTC observation remains frozen: unchanged private batches, stable serving/Qdrant identities, and no warming or restarts within this experiment. Cycles two and three must be reported independently even though cycle one already retains a tail. A later reviewed diagnosis/fix/deployment remains within the owner's authorized task scope; this experiment's controls are not a blanket prohibition on future remedies.

The six initial plus twelve later ordinary-search probe allowances have all been used (18 total). Additional ordinary application searches or search-history writes require a fresh owner goahead. The current direct read-only diagnostic does not consume or extend that allowance.

No fresh seven-day acceptance window is established here. Tasks 406/407 and map 100 remain open. Acceptance still requires rollout followed by seven days of covered organic searches with zero errors and first usable results p95 below 1.5 seconds; full completion time is reported separately. These three diagnostic cases cannot satisfy that criterion.
