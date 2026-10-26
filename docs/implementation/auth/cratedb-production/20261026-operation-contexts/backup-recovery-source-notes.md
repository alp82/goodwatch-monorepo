# Backup-first recovery proposal — October26,11:39–11:45 UTC

Read-only production checks and tagged5.10.16 source review. **No proposed statement executed.**
[Live receipts](backup-priority-readonly.json). Host time was11:39 UTC/12:39 CET when asked about
12:05 UTC: **12:05 UTC is still future**, not an observed failed run. The11:05 UTC run (12:05 CET)
started11:05:02 and logged BACKUP FAILED at11:35:02 after30min ReadTimeout. No12-prefix snapshot
exists at the11:39 all-coordinator read. Do not wait until12:05 to report this urgent proposal.

## Current snapshot and exact shard copies

All three coordinators agree: `goodwatch-db-backup-v2.hourly_20261026_110502` is IN_PROGRESS,
started11:05:02.127, finish0,567 shards, failuresempty. All145 health rows GREEN, no missing or
underreplicated shards. Latest SUCCESS was independently read at11:35:57 as
`hourly_20261026_090502`, finished09:05:30.639. We have that older backup; new complete full
snapshots are not currently demonstrated. The CREATE client timeout did not cancel server work.

For the `doc` schema (similarly named backup-schema tables are separate, settled relations):

| Relation/shard | Node | Role | state / routing_state | relocating_node |
| --- | --- | --- | --- | --- |
| person_appeared_in4 | crate-01 | Primary | STARTED / RELOCATING | crate-02 (`r0IgCe17SPOgudkQIGsRQA`) |
| person_appeared_in4 | crate-03 | Replica | STARTED / STARTED | null |
| person_worked_on5 | crate-01 | Primary | STARTED / STARTED | null |
| person_worked_on5 | crate-03 | Replica | STARTED / STARTED | null |

Neither requested shard has a physical row on crate-02. The only other non-started-routing row
is **person_appeared_in5 replica on crate-03→crate-02**, stateSTARTED/routingRELOCATING.
`person_worked_on5` is not a current blocker. The sole relocating primary is person_appeared_in4.
[SnapshotsService lines2067–2070](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/snapshots/SnapshotsService.java#L2067)
assign WAITING for relocating/initializing primaries;
[lines718–733](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/snapshots/SnapshotsService.java#L718)
keep waiting. Thus person_appeared_in4 is the exact routing condition best explaining the snapshot
stall. The snapshot's internal per-shard WAITING entry was not directly exposed by these SQL reads;
other repository/I/O delay cannot be ruled out solely by this inference.

## An in-progress snapshot is not a universal CREATE mutex

Tagged [SnapshotsService lines121,244–257](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/snapshots/SnapshotsService.java#L244)
enable full concurrency for minimum node version≥5.2.0; production has only5.10.16.
[Lines162–167](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/snapshots/SnapshotsService.java#L162)
define default `snapshot.max_concurrent_operations=1000`; actual effective override was not measured.
Same-name CREATE is rejected, and the configured concurrency limit still applies.
[CreateSnapshotPlan](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/planner/node/ddl/CreateSnapshotPlan.java)
passes CREATE to that backend without a separate single-snapshot gate.
[SnapshotsInProgress lines693–699](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/cluster/SnapshotsInProgress.java#L693)
distinguish WAITING for primary availability from QUEUED behind another snapshot of the same
shard/repository. Another uniquely named full CREATE can be admitted but still wait/queue on this
same shard. Deleting the old snapshot alone does not fix that routing condition. Table-only backups
of unaffected tables could complete but would not provide the requested full rollback target.

## Critical CANCEL semantics: cancel the target, preserve the source

Do **not** describe cancelling the active source on crate-01 with allow_primary=true as preserving
that source. [CancelAllocationCommand lines161–177](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/cluster/routing/allocation/command/CancelAllocationCommand.java#L161)
calls failShard and removes the specified allocation ID.
[RoutingNodes lines516–616](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/cluster/routing/RoutingNodes.java#L516)
fails/removes the source and can promote an active replica if the cancelled copy is a primary.
That carries avoidable failover/redundancy risk here.

The smaller proposal is **cancel the logical target on crate-02**. No physical sys.shards target row
is required: [RoutingNodes lines122–134](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/cluster/routing/RoutingNodes.java#L122)
construct an initializing target routing entry from each RELOCATING source. CancelAllocationCommand
explicitly permits an initializing primary relocation target without allow_primary=true.
[RoutingNodes lines588–600](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/cluster/routing/RoutingNodes.java#L588)
cancel source relocation when the target is failed/removed;
[ShardRouting lines362–367](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/cluster/routing/ShardRouting.java#L362)
return the source on its original node with unchanged primary flag, STARTED and no relocatingNodeId.
This is source-derived and not a production dry-run. If target lookup fails, stop: **no fallback
cancellation of the source or force/promotion**. Re-read because placement can change before approval.

## Proposed owner-approved smallest practical sequence

Gates: refresh the exact states above through all coordinators, GREEN/all active copies, crate-02
normal SQL/no decommission, no overlapping maintenance/snapshot deletion/restore, current write blocks
unchanged. Keep public page monitoring active. Record original settings before any mutation.
Current effective rebalance and allocation enable are both `all` (11:42 read).

1. **Optional for one rescue snapshot; recommended for a fresh follow-up:** briefly suppress new
   balancing so the same move cannot restart between existing and fresh snapshots. This does not
   cancel existing moves or disable allocation/repair; it is cluster-wide and needs explicit scope.

   ```sql
   SET GLOBAL TRANSIENT "cluster.routing.rebalance.enable" = 'none';
   ```

   Verify rebalance none/allocationall through every coordinator. Risk: temporary deferral of load
   balancing; record start and a bounded owner-owned restoration point. The
   [EnableAllocationDecider](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/cluster/routing/allocation/decider/EnableAllocationDecider.java#L177)
   separates rebalancing from canAllocate. The
   [snapshot decider](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/cluster/routing/allocation/decider/SnapshotInProgressAllocationDecider.java#L58)
   also throttles movement of a snapshotted primary while its shard snapshot remains incomplete;
   the explicit hold covers the gap before a fresh follow-up snapshot begins.
2. **Cancel only the blocking relocation target:**

   ```sql
   ALTER TABLE doc.person_appeared_in REROUTE CANCEL SHARD 4 ON 'crate-02';
   ```

   No allow_primary=true. Expected: source crate-01 remains primary STARTED/STARTED, replica crate-03
   stays STARTED/STARTED, target removed. Verify exact roles, node names, relocating_nodenull and GREEN
   through every coordinator, plus normal page responses. Risks: placement race/lookup failure and
   allocation churn if balancing is not held; never adapt to a different copy automatically.
   Do not cancel the unrelated settled person_worked_on5 or replica move just to fix this backup.
3. **Let the already-started snapshot finish first.** Observe metadata every30–60s and require
   SUCCESS, nonzero finished, no failures and567 expected primary shards, with repository still healthy.
   This preserves useful progress and avoids unnecessary deletion. If no completion after a bounded
   observation (e.g.5min after source STARTED), stop and report new evidence; a DROP fallback needs its
   own explicit approval. An ambiguous client result must not be replayed.
4. **Conditional fallback only: DROP that exact incomplete snapshot**, if approval covers it:

   ```sql
   DROP SNAPSHOT "goodwatch-db-backup-v2"."hourly_20261026_110502";
   ```

   [DropSnapshotPlan](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/planner/node/ddl/DropSnapshotPlan.java)
   dispatches DeleteSnapshotAction. [SnapshotsService lines1201–1207 and1473–1497](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/snapshots/SnapshotsService.java#L1473)
   abort matched in-progress snapshots before deletion. [Entry.abort](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/cluster/SnapshotsInProgress.java#L265)
   marks unfinished assigned work ABORTED, unassigned work FAILED; deletion/finalization can take time.
   This is the supported API, not manual repository-file deletion. It does not delete production table
   data; it discards this incomplete backup/progress. [BlobStoreRepository lines617–618 and724–726](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/repositories/blobstore/BlobStoreRepository.java#L724)
   preserve surviving snapshot references and delete only unreferenced blobs. Existing09:05 snapshot
   should remain available with its original metadata; verify explicitly. Repository I/O failures or
   concurrent restore/deletion can still fail/delay DROP; do not promise instantaneous cancellation.
   Wait for the exact name to disappear, no pending delete/backup operation, and verify09:05 SUCCESS
   before another CREATE. No wildcard, no dropping the last good backup, no filesystem cleanup.
5. **Fresh uniquely named manual full snapshot**, only once routing is settled, no competing scheduled
   run/deletion, and the owner approves the manual snapshot. Choose a name once from actual UTC; the
   following is reserved proposal text, not an existing snapshot:

   ```sql
   CREATE SNAPSHOT "goodwatch-db-backup-v2"."manual_644_recovery_20261026_01"
   ALL WITH (wait_for_completion=true);
   ```

   Check that name is absent first. Use a long bounded client wait≥30min, observe independently if
   acknowledgement is lost, never blindly resend. Verify SUCCESS/nonzero finished/no failures and
   expected567 shard count, cross-check table inventory unchanged; don't accept rowcount alone.
   This is I/O/load and repository mutation, no production row writes; BLOB bytes remain outside SQL
   snapshots and need the separate BLOB copy policy.
6. **Restore the approved rebalance policy** (current observed effective valueall):

   ```sql
   SET GLOBAL TRANSIENT "cluster.routing.rebalance.enable" = 'all';
   ```

   Preserve the original settings layer as well if captured. Verify all-node settings/health and
   pages. The crate-02 closing-store locks are **not** fixed by cancelling the target: resuming balancing
   can recreate the primary relocation and block a later hourly backup. Owner must explicitly choose
   restoringall after rescue versus a time-bounded rebalance hold until lock remediation; do not
   silently leave balancing disabled. Cron is unchanged here; coordinate manual work against12:05 UTC.

Verification query (run separately on all three coordinators):

```sql
SELECT name,state,started,finished,total_shards,failures FROM sys.snapshots
WHERE repository='goodwatch-db-backup-v2'
AND name IN ('hourly_20261026_110502','manual_644_recovery_20261026_01','hourly_20261026_090502');
SELECT schema_name,table_name,id,node['name'],primary,state,routing_state,relocating_node
FROM sys.shards WHERE schema_name='doc'
AND ((table_name='person_appeared_in' AND id=4) OR (table_name='person_worked_on' AND id=5));
SELECT health,count(*),sum(missing_shards),sum(underreplicated_shards)
FROM sys.health GROUP BY health;
```

No production writes, CANCEL, DROP, CREATE, settings change, restart or KILL occurred in this review.
The attempted delegated source check was unavailable; the operator followed the tagged source directly.
