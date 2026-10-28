# October28 rolling execution — live local record

**IN PROGRESS. Do not use this intermediate record as a final handover or start another operator.**
Freshmain`de2749c94e8df87a9dd4e8b0acc4362578515142`, branch`fix/644-rolling-upgrade-execution`. Latest ownerGO permits remaining14
plain-stop replacements, existingheavy jobs exceptschema/index publication, and no04:00deadline.
Deploys may finish within15minutes; failed/overdue deploys stop the run. Every otherQ55/Q58–Q63
health/heap/first-failure/Q60 safeguard remains; daytime06:00 traffic does not change thresholds.
No push or Coolify change. See[canonical runbook](../../../../crate-6-upgrade.md).

[Live summary](progress.json),[sanitized receipts](receipts.json.gz),[page watcher](pages.jsonl.gz).
UpdatedUTC:2026-10-28T02:52:28.836318+00:00. This record is committed locally at checkpoints; raw metadata/config/credentials
remain private under`~/.cache/gw-work/644-q69` and root-private per-host backup paths.

## Verified preparation

- Initial all-coordinator145GREEN/1175STARTED, writableV2unchanged and protectedpre6read-only;
  expectedcheck3 warning qualified. Fresh10-minute<80% heapgate passed; realclient/auth/BLOB/YepWatch
  reads passed. All five pinnedtargetimages cachedamd64 onallhosts.
- Ninefuture schedules paused with complete originalstates saved. Existingallowedjobs recorded;
  no schema/indexpublication active. Cronheld with exactQ37 namedfile helper and saved returnstate.
- Protected5.10 rollbacksnapshot`goodwatch-pre6.q53_pre6_20261027`/originalSHA1pair unchanged and verified.
  Freshforward`goodwatch-db-backup-v2.q65_pre_resume_20261028` SUCCESS567/no failures onall3; current
  separateBLOBpair38objects/271593347bytes,all21refs/lengths/SHA1verified, metadataunchanged.
- Maintenancewaits2 applied with per-tableblocks/RESET/SET/unblock; replicasunchanged. Freshstable
  persistedmetadata copies onall3 verifiedlegacywait2/replicas2/blocksfalse before a node stop.
- The oldBLOBcopyhelper allowedonly the originalpre6path, so a separately guarded forward-only helper
  was derived for`/mnt/backup-cratedb/q65-resume-20261028/blob`; the originalhelper/oldbackup staysuntouched.
- A localmetadata-reader filename`copy.py` caused a Pythonstdlib import collision. The local nodecontroller
  was interruptedbeforeSIGTERM after its acknowledgedpre-stop settings; no Crateprocess was signalled.
  The reader was corrected, all3indexsettings verified, and the controller resumed from recordedpre-stop
  state without repeating preparation/settings. No genuineproduction gate failed or alarm was cleared.

## Current progress

Versions last directly observed:{"crate-01": "6.3.7", "crate-02": "6.4.6", "crate-03": "6.3.7"}. Phase:recovery.

- crate-03 5.10.16→6.0.8,verified2026-10-28T01:33:47.342799+00:00
- crate-01 5.10.16→6.0.8,verified2026-10-28T01:38:41.257367+00:00
- crate-02 6.0.8→6.1.6,verified2026-10-28T01:52:53.342600+00:00
- crate-03 6.0.8→6.1.6,verified2026-10-28T01:57:14.501395+00:00
- crate-01 6.0.8→6.1.6,verified2026-10-28T02:01:34.258624+00:00
- crate-02 6.1.6→6.2.11,verified2026-10-28T02:12:58.136605+00:00
- crate-03 6.1.6→6.2.11,verified2026-10-28T02:17:13.045006+00:00
- crate-01 6.1.6→6.2.11,verified2026-10-28T02:21:06.490973+00:00
- crate-02 6.2.11→6.3.7,verified2026-10-28T02:32:43.886932+00:00
- crate-03 6.2.11→6.3.7,verified2026-10-28T02:36:52.674517+00:00
- crate-01 6.2.11→6.3.7,verified2026-10-28T02:40:24.884924+00:00
- crate-02 6.3.7→6.4.6,verified2026-10-28T02:52:08.447867+00:00

The authoritative`progress.json` carries timestamps and failures, and the receipts preserve per-node
same-ID/image/runtime/stop/recovery/canary data. Normalstops useSIGTERM withunlimitedgrace andnoSIGKILL;
no decommission, drain, copy removal or downgrade. No loop starts another node automatically.

At final handover this record will include all versions/timings, failedWindmilljobs, watcher errors,
backups, restored schedules/cron/settings and the final crate-02 placement/lock test. Until then,
**schedules/cron may still be held and maintenancewaits2 active**; do not assume restoration.
