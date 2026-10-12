# Clone pinning feasibility after the NOFILE fix

The reviewed helper passed actual initial pinning on the isolated clone at 2026-10-12 06:02 UTC: **1,725,227,008 actual VmLck bytes**, matching the helper's locked-byte count, with all selected vector/graph/sparse/other data pages resident. The child joined the clone cgroup while its parent stayed outside; cap/OOM/throttle deltas were zero. Cleanup returned child exit0, child gone, released, unchanged source identity and unchanged parent placement. This is one initial-pass feasibility result. No pressure or held-out query comparison ran, and this does not establish a production latency fix or seven-day acceptance.

The [source audit](clone-pin-proof-source-audit-20261012.json) pins merged PR453 source, helper/controller/config/manifest and execution-wrapper hashes. The source and resource rule remain the unchanged four-class, 2 GiB locked-byte budget, 6 GiB clone memory/swap, two CPUs, 256 MiB cap reserve and 1,024 VMA reserve. Payload was measured but excluded from pinning. Page/range identity hashing does not freeze file contents or exclude subsequent turnover.

## Actual preparation and lifecycle

The [CAS response](clone-source-cas-453-20261012.json) records nine changed files among the exact eighteen-file whitelist, updated directly from PR450 to PR453. Complete private old-source copies and exchanged original inodes remain available for rollback. The response records Qdrant PID3509840/start ticks3059108659 and historical memory.max events86, with no OOM or CPU throttling. It does not contain an execution timestamp; none was synthesized. Successful validation checked unchanged event counters and source identity after publication. This source publication made no Qdrant lifecycle change.

The first CAS attempt refused before publication because the existing empty task control lock was mode0644. The operator verified its same inode and exclusive flock, tightened only that lock to0600, and retried the same frozen updater. That operator-confirmed permission correction is not a relaxed source guard, and the successful response is the retained CAS artifact.

The [updated zero-pin gate](clone-zero-pin-453-20261012.jsonl) ran 2026-10-11 23:28:48–23:29:46 UTC. Its first child joined with zero locked bytes; stopping the owned clone terminated that foreign-cgroup child with SIGTERM/exit−15, and it was gone without surviving grace. The clone restarted, the new child joined with zero locked bytes and fresh Qdrant PID/start ticks, then exited0 and was gone. Both joins retained unchanged parent placement and clean limit deltas. Post-health was green/optimizer-ok/244,262 points/12 segments/six shards. The resulting Qdrant PID3519507/start ticks3059345162 also identify the later initial-pin pass. This gate included one owned-clone stop/start; it did not recreate the container, restore a snapshot, query search data or pin pages.

The [exact Node receipt](clone-node-stage-receipt-20261012.json), SHA256 `db019f01b0b25d9d85062d65fecbe5d79a35c9bc7add1d972301b2cbb95973ef`, records the Node-only archive from a retained stopped container with the pinned producer image. Container identity continuity is proven; live process continuity is explicitly unavailable. Node SHA256 is `7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c`, size126,595,440 bytes, private mode0700, matching the older owned clone binary. Staging created **two clone files**, binary and receipt. Its inherited `hostWrites:0` field describes only the source host; it is not a global zero-write statement. The receipt records no model-byte reads, no container creation and no binary execution during staging. A separate version command was operator-confirmed, but no standalone version artifact was retained and no version is inferred from the receipt.

## Fresh initial fit and locking

The [initial-pin launch result](clone-initial-pin-453-20261012.json) reports success, exit0 observed, no timeout/output limit, verified collection shape and these measured guards:

| Measurement | Bytes |
| --- | ---: |
| Clone current usage sampled by parent | 4,524,699,648 |
| Missing selected data pages | 673,484,800 |
| Required cap reserve | 268,435,456 |
| Parent’s clone projection | 5,466,619,904 |
| Unchanged clone cap | 6,442,450,944 |
| Actual child VmLck and locked-byte count | 1,725,227,008 |
| Child post-lock current cgroup usage | 5,163,843,584 |

The child independently repeated the cap check with its fresh accounting: projection5,476,200,448 bytes. It reported all selected pages resident: vector173,703; graph103,765; sparse54,814; other88,916. Those classes total421,198 pages. Existing page charges may belong to other cgroups; the retained state explicitly says complete charge placement inside the target cgroup is **not proven**. VmLck and mincore provide locking/residency evidence, not a complete attribution of every cgroup byte.

Parent NOFILE soft limit changed1024→20261; the child's inherited soft limit changed20261→20266. Both retained the hard limit1,048,576 and reported bounded descriptor accounting. Only those processes used the explicit soft-limit option; source and ancestor limits were not adjusted. The child's separate explicit MEMLOCK setup is part of the reviewed pin helper, not the readonly measurement action.

This fresh successful fit occurred more than six hours after the zero-pin gate, with different cache/accounting from the earlier [cap refusal](clone-pin-cap-refusal-20261012.json). The retained records do not establish what changed the cache during that interval. The NOFILE fix does not explain memory headroom, and the cap guard was not relaxed. Reclamation was unnecessary and **never executed**; [PR455's clone preparation](../../../goodwatch-qdrant/diagnostics/clone-preparation/README.md) remains prepared only.

The initial wrapper recorded no search queries, archive reads, cache advice or clone restart. These fields describe the diagnostic's own operations; they are not measured whole-system activity counts. The clone stayed private and bounded. Future pressure/held-out comparisons require their own source/cohort/counter fences, and production rollout/organic acceptance remain outstanding.
