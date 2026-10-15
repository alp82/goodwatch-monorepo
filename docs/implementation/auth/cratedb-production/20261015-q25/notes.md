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

## Final Q25 outcome — 2026-10-15T04:07:21.685207+00:00

**PARTIAL UPGRADE, CLEAN STOP FOR OWNER'S HARD DEADLINE.** crate-03 is now pinned **5.10.16**, crate-02 remains **5.10.16**, and crate-01 remains **5.10.9**. Crate-01 was not staged, decommissioned or restarted; its original process start time is unchanged. Do not automatically resume from the cloud: the laptop/private-network access closes by 04:14 UTC. The owner requested finishing the in-progress node and leaving GREEN rather than starting a restart without recovery margin.

Final gate through crate-02 at **2026-10-15T04:06:45.453697+00:00**: **93 GREEN health rows, 956 STARTED/STARTED copies, all 21 checks passing**, allocation all; no initializing, relocating or unassigned copies. Final actual-source catalog reads: **21/21 HTTP 200**, from all three Windmill workers, both page instances and both search roles through all three coordinators. Independently checked the other two endpoints. Configuration comparison passes: same identities, commands/HBA/env, volumes/mounts, private bindings, limits and restart always; only crate-03's image changed this window. All 123 baseline table-settings rows unchanged; no new/removed settings identities. No auth user, auth tables, member-data probe, HBA, app/config, manual firewall or table-setting changes.

Fresh named snapshot **goodwatch-db-backup-v2.pre_auth_547_20261015035349 SUCCESS**, 16.298-second CREATE, 03:56:05.389–03:56:21.687 UTC. Separate 18-file / 126,677,290-byte BLOB artifacts checksum-verified and protected on crate-01. A new scheduled backup **hourly_20261015_040501 SUCCESS** also completed; its metadata is retained. Restore validation remains explicitly waived, not established.

Crate-03 decommission succeeded in **200.825s** at 04:00:59.221 UTC; old process exited normally code 0 at **04:01:13.668**. Target started **04:01:48.196**, same node ID/volume. No SIGKILL, forced shutdown, SQL job cancellation or downgrade. Two-hour grace / 7500s administrative HTTP bound were used. All current tables, including the three owner-confirmed legitimate additions, were monitored; none triggered a schema-only abort.

### Observed client impact during crate-03 restart

All four unchanged client containers remained healthy on **ebe8581f44fa58dc27da8ee55738c5a07794bbb9**, zero container restarts. Log window starts 03:57:00 UTC before decommission; HTTP counters were captured immediately before it and after recovery. Full counts and hashes are in client-impact-crate03.json and client-sample-crate03-after.json.

| Client host / container | Terminal FAILED query lines | CrateTimeoutError log lines | CrateError log lines | New HTTP 5xx | HTTP responses |
| --- | ---: | ---: | ---: | ---: | ---: |
| 20 / goodwatch-search-b | 0 | 0 | 0 | 0 | 53 |
| 20 / goodwatch-search-a | 0 | 0 | 0 | 0 | 53 |
| 20 / gk4owk8-20261015T034301 | 24 | 166 | 0 | 6 | 5057 |
| 21 / gk4owk8-20261015T034054 | 3 | 240 | 4 | 3 | 5914 |

Totals: **27 terminal FAILED query lines, 406 timeout log lines, 4 CrateError lines, 9 new HTTP 5xx / 11077 responses**. Also 82 connection-reset/refused/socket log lines and 447 native `Unexpected connection error` lines; categories overlap and must not be summed as unique failures. There were 27819 successful Crate query log lines. No client replacement/counter reset or log-read failure occurred.

**The new failover client did not eliminate all observed page failures.** Its recoverable host-attempt errors are logged by node-crate before the wrapper retries, as the installed source excerpts show; those logs alone do not imply failed caller queries. Terminal FAILED lines and actual 5xx prove some failures escaped. Counts are log occurrences/HTTP counter deltas, not unique members, and no signed-in journey was exercised. Both search roles' final counts are separately listed, rather than extrapolated from page traffic. No client fix/config change was attempted in this upgrade-only window.

Continuous public GET probes (home + command palette): **214 responses**, 0 HTTP 5xx, 0 transport failures. Successful probes do not erase independently observed page 5xx. Crate-01 had **no restart window**, so its restart error counts are not applicable. Crate-02 was not restarted in Q25; its prior counts remain in the prior attempt's evidence.

### Remaining #547 work

Keep #547 open. Finish **crate-01 5.10.9 → 5.10.16** only when the owner/private-network access and a sufficient maintenance window are available. Re-run live checks/fresh backup and all rolling gates, with generous timeout and client observation. Review this window's residual client failures before claiming zero member impact. **goodwatch_auth remains absent**, its SQL prepared in the runbook; creation waits for password-enforcement #562 and explicit scope. No auth-table creation/grants/settings are authorized here. Firewall inspection/runbook/local rehearsal are already recorded; observed private binding is not proof of a general forwarded source ACL.
