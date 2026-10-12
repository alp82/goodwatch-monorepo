# Retained numeric transient-memory evidence

Local-only fixed-whitelist extraction from the retained private journal SHA256 `39614490ac0ed7ca1392bd2e7370b6d3ca3e932c022223e3160bf63065935ac8`. [Numeric packet](production-retained-transient-memory-20261012.json) SHA256 `112702bf5d59ecd4f79b2293edc5a34234a6f08e1136a85755a14ee6a48c9725`. The private dataset and path keys are excluded. No host operation, fresh observation or runtime change was performed.

The packet contains 59 rows / 118 pressure reads from 2026-10-12T07:59:02.935170+00:00 through 2026-10-12T08:28:02.155319+00:00, one source PID/start-tick generation. Two directory scans were incomplete; the source-fenced before/after resource reads still exist. The reader was terminated early and gone is proven, but clean full-window completion is false. Sample time is scan completion, not the exact timestamp of each pressure read; both reads fall within the recorded duration bracket estimate.

| Metric (bytes) | First before | Last after | Minimum | Maximum | Maximum sample completion time / fence |
| --- | ---: | ---: | ---: | ---: | --- |
| accounting.currentBytes | 7,571,046,400 | 5,266,911,232 | 4,928,000,000 | 10,038,751,232 | 2026-10-12T08:16:02.959679+00:00 / after |
| derived.hostDirtyPlusWriteback | 286,720 | 155,648 | 32,768 | 934,662,144 | 2026-10-12T08:15:31.493442+00:00 / after |
| derived.sourceDirtyPlusWriteback | 4,096 | 8,192 | 0 | 934,162,432 | 2026-10-12T08:15:31.493442+00:00 / after |
| host.Cached | 8,991,789,056 | 7,800,213,504 | 7,468,752,896 | 12,509,650,944 | 2026-10-12T08:16:32.126929+00:00 / after |
| host.Dirty | 286,720 | 155,648 | 32,768 | 934,662,144 | 2026-10-12T08:15:31.493442+00:00 / after |
| host.MemAvailable | 12,736,765,952 | 13,885,571,072 | 12,199,165,952 | 14,299,561,984 | 2026-10-12T08:24:02.257105+00:00 / before |
| host.SwapFree | 0 | 0 | 0 | 0 | 2026-10-12T07:59:02.935170+00:00 / before |
| host.SwapTotal | 0 | 0 | 0 | 0 | 2026-10-12T07:59:02.935170+00:00 / before |
| host.Writeback | 0 | 0 | 0 | 4,096 | 2026-10-12T08:00:32.641437+00:00 / after |
| sourceMemory.anon | 3,953,156,096 | 2,927,439,872 | 2,888,138,752 | 4,021,092,352 | 2026-10-12T08:00:04.126779+00:00 / before |
| sourceMemory.file | 3,343,130,624 | 2,115,702,784 | 1,811,038,208 | 6,828,994,560 | 2026-10-12T08:16:32.126929+00:00 / after |
| sourceMemory.file_dirty | 4,096 | 8,192 | 0 | 934,162,432 | 2026-10-12T08:15:31.493442+00:00 / after |
| sourceMemory.file_writeback | 0 | 0 | 0 | 32,768 | 2026-10-12T08:23:02.276362+00:00 / after |
| sourceMemory.kernel | 274,284,544 | 223,768,576 | 222,339,072 | 309,030,912 | 2026-10-12T08:16:02.959679+00:00 / before |
| sourceMemory.unevictable | 0 | 0 | 0 | 0 | 2026-10-12T07:59:02.935170+00:00 / before |

The JSON retains each before/after reading, within-sample delta extrema and sample/fence tags; table extrema need not occur simultaneously. Dirty-plus-writeback sums are numeric proxies, not deduplicated physical-page unions. Whole cgroup file bytes include more than archive cache and cannot be converted into clean cache by this extraction.

| MemAvailable paired with | Pearson correlation (118 reads) | Sample covariance (bytes squared) |
| --- | ---: | ---: |
| host.Cached | -0.298875 | -1.550978e+17 |
| host.Dirty | 0.024580 | 1.201420e+15 |
| host.Writeback | -0.094921 | -4.829357e+10 |
| sourceMemory.anon | -0.900881 | -1.340462e+17 |
| sourceMemory.file | -0.293038 | -1.521533e+17 |
| sourceMemory.file_dirty | -0.006323 | -2.902462e+14 |
| sourceMemory.file_writeback | 0.051557 | 8.161830e+10 |
| sourceMemory.kernel | -0.636349 | -6.111308e+15 |

Covariance is descriptive over ordered before/after observations, with repeated near-adjacent readings and background workload. It neither proves causality nor creates 118 independent experiments. Between-sample activity and transient peaks can be missed. No counter-reset compensation or per-query attribution is applied.

Host MemFree, active/inactive file LRU, Mlocked/Unevictable, source shmem, SSHFS/SSH process memory, other host cgroup memory and per-archive resident/dirty bytes were not recorded. Those classes remain unmeasured. SwapTotal/SwapFree are zero throughout. Source limits remain uncapped and required max/OOM/throttle counters retain zero deltas in the already-reviewed interval.

Observed dirty/source-anonymous/kernel values demonstrate why source archive size alone is not a RAM budget. They do not identify which anonymous growth belongs to snapshot work versus background updates/optimization, and cannot establish a future nonreclaimable allowance. Gross source/target archive bytes are separately labelled disk metadata in each numeric row. The Linux MemAvailable formula can count dirty/writeback file-LRU pages; a high estimate does not guarantee prompt reclaim on stalled IO. Conversely, clean archive cache is ordinarily reclaimable and does not require subtracting its entire disk size as additional committed RAM.

A corrected candidate must still use full additional locks, independent source/ancestor cgroup accounting, reviewed dirty/anonymous/kernel/buffering transient allowances and emergency/pressure gates. This failed full-window observation does not validate a 2 GiB-only replacement, prove a 13 GiB reserve necessary, authorize a guard change, or establish application latency/acceptance. The existing guard remains unchanged.
