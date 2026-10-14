# Production retry — abort recovery in progress

Owner go 2026-10-14T20:47:56Z; target pinned 5.10.16; same restore-validation waiver. Hard cutoff 2026-10-15 02:30 UTC.

**Genuine failed gate:** at 22:24:55.948868 UTC the watcher detected unexpected new production health identities doc.episode_translation and doc.season_translation. This operation did not create them; actor unverified. Rollout stopped. New tables have creation metadata 5.10.9 and were retained unchanged.

Current versions: crate-01 5.10.9, crate-02 5.10.16, crate-03 5.10.9. Only crate-02 was upgraded. It passed 91 GREEN / 932 STARTED, all 21 checks and 18 source-client reads at 21:13 UTC. Crate-01 was never staged/decommissioned. No 5.10.16 process started on crate-03.

Crate-03 decommission SQL succeeded after 878.374 seconds at 21:29:13, but actual exit remained pending for active work. No long-running SQL job appeared in the sampled view; internal context identities remain unproven. After the external-table gate failed, original env/mode/owner/rendering and restart always were restored at 22:25:31, allocation all at 22:25:33. At 22:27 the complete physical health gate passed (93 GREEN / 956 STARTED), crate-03 held zero primaries, and its SQL endpoint still timed out. New-table creation versions were verified 5.10.9 before recovery.

The runbook pre-target abort recovery then restarted the **same original crate-03 container/image** using normal SIGTERM and unlimited grace, 22:28:16.707–22:28:25.740 UTC (9.033 seconds). Old image, data mounts and identity retained; Docker events show signal 15, exit 143, no SIGKILL. This was original-image abort recovery, not a forced upgrade or target startup. No SQL KILL or graceful-stop force setting was used. All 18 actual-source reads passed again by 22:30 UTC; replica recovery is still pending, so this is not yet a completed clean stop.

Named safety snapshot goodwatch-db-backup-v2.pre_auth_547_20261014204756 succeeded in 22 seconds and was verified 20:54:52 UTC; BLOB artifacts retained and hash/size verified under /root/cratedb-maintenance/547-20261014204756 on crate-01. Hourly_20261014_220501 succeeded, finishing 22:06:21 UTC. Both snapshots predate the external new tables. No restore was validated; the owner waiver is recorded.

One owned maintenance row remains pending cleanup: doc.workflow_monitoring key maintenance_auth_547_20261014204756, kind maintenance_probe, pipeline auth-prereqs, payload crate02-up. It was absent before creation; its acknowledged data was read back with crate-02 down and after target rejoin. Cleanup may remove only this owned row after final readback. No member/auth rows were touched.

No auth user, app code/config, HBA, manual firewall or table-setting change was made by this operation. Timeout fix: explicit server 2h with force=false and PRIMARIES unchanged; HTTP 7500 seconds / outer SSH 7530 seconds. Allocation is restored all; same-effective-baseline transient settings retained without erasing unknown persistent layers.

Bounded read-only client investigation completed before mutation: actual node-crate 3.0.0 round robins SQL .12/.13/.11, no generic connection-error retry/host eviction. Failed-query counts are retained across external app replacements; union sampled and continuous-reader line hashes at final reporting. Some removed-container tails before readers attached can be missing; report captured minima, not unique member/HTTP requests. Crate-02 captured 198 webapp FAILED lines and zero search lines; crate-03 count remains open through abort recovery.

Local verification corrections are preserved: expected gateway node-count warning 1 only during the planned two-node phase; every check must pass again with three nodes. Docker mount array order varies; canonical full mount objects/runtime invariants were verified identical. Neither correction waived a real production gate.

Finish original-image recovery and require all current tables/copies GREEN/STARTED, all checks and client probes passing. Verify actual version/config/setting differences, clean up only owned probe data, update final outcome, push auth/cratedb-prereqs and post full outcome on #547. Keep #547 open; remaining upgrade and auth user (#562) are incomplete. No merge/main push.
