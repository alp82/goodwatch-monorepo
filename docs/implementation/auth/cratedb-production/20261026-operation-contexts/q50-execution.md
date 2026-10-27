# Q50 plain crate-02 restart — October 27, 2026

**Restart completed; stopped before the rebalance test on the first watcher alarm. Safe restoration completed 08:34:31 UTC.** No automatic retry or further production work is armed.

Owner authorized immediate gates from08:24 UTC, SIGTERM cutoff09:04, hard stop10:04. Q50 superseded the plan's Q49 times and waived the current Windmill workload gate; new heavy work was to be noted, not cancelled. All other Q43 gates and abort rules remained. Started on fresh `origin/main` `841903bee9`, branch `fix/644-q50-plain-restart-execution`.

## Gates and actions

| UTC | Observation/action |
| --- | --- |
| 08:25:02 | Local gate record started; failure inventory conservatively begins08:24:00. Watcher ran every10s throughout, five concurrent probes,5s transport timeout and sticky3s alarm. |
| 08:25:19–08:26:04 | All three coordinators: expected node IDs,5.10.16,145 GREEN relations, zero missing/underreplicated copies; every copy STARTED/STARTED, no relocations or initializing copies. Cluster/node checks passed. No administrative job or active backup process. |
| Gates | Latest snapshot `goodwatch-db-backup-v2.hourly_20261027_080502` SUCCESS,567 shards, zero failures, finished08:05:28.611; none IN_PROGRESS on any coordinator. No active GitHub workflow or Coolify deployment. The only package-maintenance processes were the historical idle shutdown waiters. Initial heap approximately27%/47%/36%, one-minute load2.02/0.71/0.99. |
| 08:29:16 | Exact Q37 helper held only the named backup cron. Original protected privately; held/readback hashes verified. |
| 08:29–08:30 | All14 YepWatch waits3→2, one table at a time behind brief write blocks, readback through all coordinators before unblock. Replicas2/REQUEST unchanged; auth/MCP policies unchanged. |
| 08:30:22–08:30:25 | Docker policy `no`; allocation `primaries`; rebalance remained `none`. All coordinators agreed. |
| Before stop | Fresh final all-node GREEN/no-snapshot/no-relocation/policy gates passed. Same container/image/config/PID, default SIGTERM, fresh watcher heartbeat, completed healthy round begun after settings changes, no alarm. Each crate-02 primary had an active survivor copy. No zero-primary gate or drain. |
| 08:31:07–08:31:08 | Dispatched one host-managed `docker stop --timeout=-1 crate-02`, unit `gw-crate02-q50-stop-20261027T0832`. Unit properties `TimeoutStopSec=infinity`, `SendSIGKILL=no`. |
| 08:31:15.766 | Confirmed normal exit143, no OOM, about7s after dispatch. No second signal, grace shortening or force. |
| 08:31:39 | Started the same container once. New PID3036091; same persistent node ID `r0IgCe17SPOgudkQIGsRQA`,5.10.16, image/config/mount hashes unchanged. |
| 08:32:02 | After identity/rejoin checks, allocation restored `all`; rebalance still `none`, verified all coordinators. Replica recovery progressed without missing primaries. Temporary YELLOW was recovery, not an ignored pre-stop gate. |
| **08:32:54.230** | **Abort: `/discover` returned200 in4.376112s**, request started08:32:49.847. Sticky alarm retained. Stopped progression; no rebalance enable or placement test. |
| 08:33:30 | Approved recovery path reached145 GREEN on every coordinator, all copies STARTED including all51 YepWatch copies; only then restored waits. |
| 08:33:30–08:34:31 | Restored all14 waits3 behind blocks, exact all145-table policy comparison passed; Docker policy `always`, allocation `all`, rebalance `none`. Cron restored byte-for-byte08:34:31.825; helper readback exact. |
| 08:35:00.866 | Final read-only verification complete, watcher stopped locally; production work ended. |

The cron's original and restored SHA256 is `374f2ac2eea0fee650130b13c5ae3cf24276f80dabee6b35c54fb2cf5f502e37`. It was held only08:29–08:34, crossing no hourly :05 run. Next scheduled run is **09:05 UTC**, not yet due at this handover; its success is **not verified**. No manual snapshot or backup mutation occurred.

## Result and limits

All coordinators finally report145 GREEN, zero missing/underreplicated copies, no non-STARTED copies, allocationall/rebalancenone, unchanged graceful-stop PRIMARIES/forcefalse/2h and empty exclusions. All145 table policies and partition inventory match the fresh baseline; no lingering write blocks. Same container/image/config/mounts, new JVM, Docker restartalways.

crate-02's **112** old unmatched operations are gone on every coordinator. Other nodes' historical operations remain:1460 oncrate-01,2897 oncrate-03. Recovery placed copies onto the restarted node and settled, but **the owner-defined20–30min rebalance/closing-lock clearance proof was not run**. The two previously locked identities, person_appeared_in4 and person_worked_on5, currently have primary oncrate-01 and replica oncrate-03, both STARTED/STARTED; neither was deliberately placed ontocrate-02. New-JVM logs through the final read contain **zero `ShardLockObtainFailedException`**; that bounded absence does not establish the locks cannot recur.

All295 watcher requests had their expected HTTP status (pages/discovery200, unauthenticated MCP401). Exactly one exceeded3s, triggering the abort. Final round: title0.267s, show0.214s, discover0.220s, MCP0.106s, discovery0.279s. A successful normal restart does not waive the alarm or authorize turning rebalance on later.

## Windmill failures and new work

Read-only, paginated `jobs/completed/list?success=false&completed_after=...` plus individual job details; **all failed jobs including steps**, no root-only filter. Filtered by completion/failure time through08:35:00.866, including jobs started before gates. Exactly one failure; no jobs were rerun or schedules changed.

| Job | Failure UTC | Error | Job ID |
| --- | --- | --- | --- |
| `f/sync/copy/vector_data` | 08:31:52.979 | `ProgrammingError: 401 Client Error: Unauthorized`, during Crate Python client's server-version discovery | `01a17ba4-baed-762d-3027-dee875df3b56` |

This scheduled vector copy began08:30:00.036 during the window and failed after112.943s. Noted as new bulk work under Q50; it was not cancelled. Current gates also observed provider-detector, social ingest/discovery and priority/provider crawls. The failure's timing does not prove restart causality; no client credentials were changed or repaired. Owner can decide whether to rerun this job after reviewing its authentication failure.

## Evidence and validation

- [Sanitized receipts](q50-receipts.json.gz): fresh all-node gates/final verification, ordered SQL acknowledgements/readbacks, runtime hashes, cron hashes, schedule/queue/deploy metadata, bounded new-JVM log count and watcher unit-test output. No credentials, raw cron, member SQL, raw container environment or raw JVM logs committed.
- [Every watcher probe](q50-pages.jsonl.gz), including sticky alarm and final healthy round.
- [Complete failed-job inventory](q50-windmill-failures.json), error summaries/time/ID for owner follow-up.
- Local watcher suite: `python3 -m unittest discover -s docs/implementation/auth/cratedb-production/20261026-operation-contexts -p test_q43_page_watch.py`: **10 tests, OK**. Evidence assertions verified all-node GREEN, exact145 policies, zero crate-02 old operations, same runtime identity/config, restored restart/cron and exactly one watcher alarm. No application code changed; webapp/flow suites were not run.

Owner handover: **leave rebalance `none`** until a separate decision on the omitted observed placement test. No second restart is proposed. Next backup09:05 needs a read-only follow-up if requested; this execution stops at its abort handover.
