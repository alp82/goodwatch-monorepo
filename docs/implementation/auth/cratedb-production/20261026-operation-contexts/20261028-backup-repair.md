# October28 backup writer repair and next-night upgrade plan

Owner **Q64** authorized exactly the two-statement repository repair from Q65, followed by the next
scheduled hourly run with cron left running. Owner **Q65** approved the remaining upgrade for
**October28 23:00→October29 04:00 UTC**, after a separate GO expected aroundOctober28 22:45.
This execution changes **repository registrations only**; no node stop/start/restart, drain, decommission,
replica/wait/HBA change, manual snapshot, job/schedule change or cron change was made. No upgrade is armed.

Started from freshmain`84e855724` onbranch`fix/644-backup-writer-and-next-window`. Scratch/private
receipts are under`~/.cache/gw-work/644-q66`; the owner's main checkout was not touched.

## Repository repair

Fresh all-coordinator gates:145 GREEN, no IN_PROGRESS snapshot, exact expected two read-only aliases,
no active backup helper, fresh candidate directory absent, same shared mounted source and existing
path.repo allowlist onall nodes. The exact original cron was active with its one backup entry and
SHA256`374f2ac2eea0fee650130b13c5ae3cf24276f80dabee6b35c54fb2cf5f502e37`.
Two complete watcher baseline rounds preceded the first write. Q60 page checks continued throughout.

Executed once via trusted-loopback crate_sql transport oncrate-01:

```sql
DROP REPOSITORY "goodwatch-db-backup";
CREATE REPOSITORY "goodwatch-db-backup-v2" TYPE fs WITH (
    location='/snapshots/q65-mixed-20261027', compress=true, readonly=false
);
```

- DROP acknowledgement **October27 23:59:24.226 UTC**, rowcount1. Only the legacy read-only root
  registration was removed; no old snapshot/file was deleted.
- CREATE acknowledgement **October27 23:59:25.137 UTC**, rowcount1. All-coordinator registration and
  GREEN readbacks completed **23:59:29.636 UTC**. Normal CREATE uses repository verification: the
 5.10.16[request defaults verify=true](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/action/admin/cluster/repositories/put/PutRepositoryRequest.java),
  and the[SQL plan preserves that default](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/planner/node/ddl/CreateRepositoryPlan.java).
- V2 is nowfs/location`/snapshots/q65-mixed-20261027`,compress=true,readonly=false onall coordinators.
- Protected`goodwatch-pre6` remainsfs/location`/snapshots/v2`,compress=true,readonly=true. The original
  protectedsnapshot+BLOB/config pair is untouched. Legacy root alias is absent; do not recreate a
  registered parent repository around the active child writer.
- Cron was never held, rewritten or manually invoked. No validation CREATE SNAPSHOT was sent by this
  operator; the scheduled helper owns the following CREATE/cleanup/verification sequence.

## Scheduled backup result

The next scheduled helper started at **October28 00:05:01UTC**, without an operator invocation.
All three coordinators verified both results at **00:14:31.633UTC**:

| Snapshot | StartedUTC | FinishedUTC | State/shards/failures |
| --- | --- | --- | --- |
| `hourly_20261028_000501` |00:05:01.821|**00:13:19.969**|**SUCCESS /567 /none**, all3coordinators|
| `daily_20261028_000501` |00:13:20.369|**00:13:32.179**|**SUCCESS /567 /none**, all3coordinators|

First full hourly took **8m18.148s**; the daily's incremental write took11.810s. The helper then found
zero expired snapshots, performed no retention deletion, verified both and logged **Backup run finished.
at00:13:34UTC**. No error or fallback action occurred. Final all-coordinator health was145GREEN,
1175STARTED, allocationall/rebalancenone, expected unchanged5.10/6.0 node versions; protectedpre6
snapshot stillSUCCESS567/no failures. Finalcron hash matches the original exactly. The next01:05
run is future/unverified; nothing is held or manually scheduled.

Recorded **500 page probes**, zero unexpected status/transport failures, zero>3s, zeroalarms;
maximum **1.308195s**. ExpectedMCP401 remained healthy. Maximum round-start gap **10.001s**; no monitoring
gap. Watcher ran from2026-10-27T23:58:53.484094+00:00 through2026-10-28T00:15:23.510537+00:00 and was stopped at handover; no upgrade process is running.


See[summary](20261028-backup-repair-summary.json),[receipts](20261028-backup-repair-receipts.json.gz)
and[page checks](20261028-backup-repair-pages.jsonl.gz). The summary includes exact watcher coverage,
latencies/alarms and final cron/health/repository readbacks.

## Next-night runbook

Updated[crate-6-upgrade.md](../../../crate-6-upgrade.md) and the
[14-row remaining-node matrix](../../../crate-6-upgrade/20261028-rolling-resume/node-matrix.json):

- Resume03 then01 to6.0.8; never repeat02's completed first-hop stop. Later hops retain02→03→01,
  through6.1.6,6.2.11,6.3.7 and6.4.6 on pinned digests.
- October28 gates after freshGO around22:45, window23:00–04:00UTC; initial remaining-node heap gate10min,
  nextnode2min, laterhops10/2/2. Below80% tostart, stopabove85%; no newhop unless completion and safe
  handover fit. First failed gate still ends progression; no overnight rollback or forced completion.
- Accept only the verified severity1/check3 future7.x advisory on6.x with actual compatible5.x creation
  versions. No other failed check/incompatible table is waived. Known14-table stale relation readbacks
  use the source-proven authoritative index settings and fresh offline metadata checks; no display-driven
  ALTER loop or new repair is authorized.
- Keep the repaired V2 registration/path writable throughout. Remove the old unregister/re-register
  stage entirely. Use that same incremental writer for the current forward checkpoint and homogeneous
  stage snapshots; keep the original pre6 repository read-only and untouched.
- The5.10 rollback point is **stillOctober27 23:02:34.012UTC** plus its originalSHA1 pair. A new mixed/6.x
  snapshot cannot reset that rollback RPO. The fresh resume checkpoint/currentBLOB pair is separate,
  for forward recovery; no per-minor full repository copies.
- Preserve each node's existing mounts/path.repo, including02's existing extra mount. Capture live
  systemd unlimited-grace properties before unit garbage collection. Use only supported watcher phase
  values and check its heartbeat throughout restoration, avoiding Q64's monitoring gap.
- Retain nine exact approved job holds/restoration, Q55 BLOBgrant timing, all original copies,
  plain unlimited SIGTERM, allocationprimaries/all, rebalancenone until final placement test, Q60 watcher,
  exact cron restoration at normal **or early mixed** handover once the existing writer/no-active-backup
  gates pass. No fallback that removes the writer.

## Validation and limits

Live repository acknowledgements/readbacks and scheduled backup evidence are recorded above. Local
checks:21 watcher tests passed;14-node order/digests/uniqueunit matrix checks; noV2 DROP/CREATE in the
active runbook; updatedwindow; all shell snippets passbash-n; embeddedPython AST/local links and
JSON/archive/diff validation pass. No application source changed; webapp suites/typecheck or flowpytest
were not rerun for this operational/documentation change. New snapshotSUCCESS is not a restore test;
mixed snapshots are not proven5.10 rollback artifacts. The upgrade itself has not started.
