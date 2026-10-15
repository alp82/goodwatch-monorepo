# Q25 production upgrade — in progress

Owner go Q25: complete crate-03, then crate-01, to pinned 5.10.16; crate-02 already upgraded. PR #589 runtime commit ebe8581f is present on both page containers and both search roles. Restore validation remains waived for this patch only. Known legitimate tables are accepted; real health/recovery/decommission gates remain. No auth-user/table, HBA, app/config, firewall or table-setting changes.

All 93 initial health rows GREEN, all 956 copies STARTED, all 21 node checks pass; 478 logical shards have copies on two distinct nodes. Master crate-01 last. Graceful timeout verified 2h, force=false, PRIMARIES; administrative HTTP 7500s / outer SSH 7530s. Actual process exit is an independent gate.

Fresh snapshot goodwatch-db-backup-v2.pre_auth_547_20261015035349 SUCCESS: CREATE 03:56:05.389–03:56:21.687 UTC (16.298s). Retained 18 unique BLOB files / 126,677,290 bytes with SHA1/size verification, protected on crate-01 under /root/cratedb-maintenance/547-20261015035349/blob-artifacts. Existing backup lock serialized creation.

Crate-03 staged with only the pinned image changed in rendered Compose; same data/mounts/private ports/runtime settings. Graceful decommission sent through crate-02. Read-only health observer, exact-window client logs/HTTP metrics and public GET probes active. No owned write probe is created in this upgrade-only window.

## Crate-03 interim client observation

Timeout log lines are not all terminal queries: inspected installed node-crate source explicitly logs `Unexpected connection error` in req.on(error), then rejects the per-host attempt; the deployed wrapper can fail over within the remaining deadline. Sanitized source excerpts are retained in native-client-error-logging.json. At approximately 04:01 UTC, both search roles had zero Crate error/timeout/FAILED/5xx observations. Page hosts had individual-host timeout log lines, and abio had **one terminal FAILED query / one HTTP 5xx**; thus this window does not establish zero member-facing errors. All public synthetic probes were still HTTP 200. Q25 explicitly limits abort conditions to real database health/recovery/decommission failures, so the healthy, progressing drain continued; no client/config change was made. Final window counts will supersede this interim observation.

## Crate-03 target startup / hard deadline

Decommission SQL succeeded at 2026-10-15T04:00:59.221315+00:00 after 200.825s. Original daemon exited normally code 0 at 04:01:13.668 UTC; no forced stop or job cancellation. Target process started at 2026-10-15T04:01:48.196212552Z, retaining node identity and every runtime field except image. Allocation all was restored during startup, before the first recorded rejoin confirmation (the first 04:02:00 poll still showed two nodes); it did not wait for that local polling assertion. No actual health failure or settings outside the permitted allocation override occurred. The subsequent watcher confirmed all three nodes with crate-03 on 5.10.16 at 04:02:20 UTC. Replica replay/rebalance is still being observed to full STARTED.

The owner subsequently set **hard deadline 04:14 UTC**: finish the node already in progress, leave GREEN, and defer the rest because cloud cannot reach private hosts. **crate-01 will not be staged/decommissioned/restarted in this window**. Final expected version matrix is 5.10.9 / 5.10.16 / 5.10.16; completing crate-01 waits for the owner and private-network access. Runtime/Compose/mount/private-port/table-setting comparisons already pass; goodwatch_auth is absent and HBA unchanged.
