# Q65: version-pinned source research and offline metadata diagnosis

Research on October 27/28, 2026 against CrateDB **5.10.16** and **6.0.8**. This work made no
production change or JVM attachment. Local source/decoder scratch is `~/.cache/gw-work/644-q65/upstream`.
The main Q65 report owns live backup history and the final proposed recovery decision.

## Check 3 is expected for 5.x indices on 6.x

The 6.0.8 implementation gives check 3 `Severity.LOW`. For every index it tests
`getCreationVersion().major < Version.CURRENT.major`; any such index makes the check fail.
Therefore **every 5.x-created concrete index triggers the check on a 6.x coordinator**, including
otherwise valid 5.10 tables. It is not a special finding that these tables are unreadable on 6.0.
The warning anticipates the next major version: under the documented two-major storage compatibility
rule, those unchanged 5.x tables must be recreated before 7.x. New 6.x-created tables do not trigger
it. Actual compatibility before 6.x instead rejects **4.x** tables. [Exact 6.0.8 implementation](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/io/crate/expression/reference/sys/check/cluster/TablesNeedUpgradeSysCheck.java#L38-L79),
[6.0 release requirements](https://github.com/crate/crate/blob/6.0.8/docs/appendices/release-notes/6.0.0.rst),
[storage lifecycle policy](https://cratedb.com/support/lifecycle-policy).

Recommendation: classify this exact low-severity check with a verified 5.x creation-version inventory
as an expected future-major advisory; keep actual 4.x-index rejection and all other health checks.
Do not waive an unknown check or infer table corruption from check 3 alone. A revised execution gate
needs review before another GO; this read-only investigation does not resume the upgrade.

## Persisted metadata proves a dual-representation discrepancy

The parent investigator supplied stable, private copies of each production `_state` directory,
with unchanged `segments_N` before/after copying. The local decoder uses a **Lucene DirectoryReader**
without an IndexWriter, lock acquisition or production connection. Lucene 10's backwards codecs read
the 5.10 Lucene metadata copies; legacy SMILE is decoded with Jackson, while the 6.0 binary payload
is decoded with the matching 6.0.8 `Metadata.readFrom`, stream version and named-writeable registries.
It outputs only commit headers and the 14 YepWatch table/index settings; roles/password metadata is
never printed or saved in decoded output. The source format and read path are defined by
[PersistedClusterStateService](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/org/elasticsearch/gateway/PersistedClusterStateService.java#L406-L490).

Sanitized decoded files are `state-decoded-11.json`, `state-decoded-12.json`, `state-decoded-13.json`
in the Q65 scratch directory. All three copies have **current term 1419, last-accepted cluster-state
version 1144863**. Their node IDs match the recorded production IDs.

| Persisted copy | Node version ID | Metadata version | Legacy index settings, all 14 | New table relation settings |
| --- | --- | --- | --- | --- |
| crate-01 | 8101699 = 5.10.16 | 38921 | Wait 3, replicas 2, write block false | Format absent on 5.10 |
| crate-02 | 9000899 = 6.0.8 | 39004 | Wait 3, replicas 2, write block false | Wait 2, replicas 2, write block false |
| crate-03 | 8101699 = 5.10.16 | 38921 | Wait 3, replicas 2, write block false | Format absent on 5.10 |

The same index UUIDs, index-version counters and settings-version counters agree across all three
nodes for each table. For example `yepwatch_agreement` has UUID `dbSZLiLNT3yadcEmwAJjsw`,
`IndexMetadata.version=48`, `settings_version=21`; the 6.0 table relation has `table_version=31`
and the **same UUID**, but wait 2. These are different kinds of version counters; comparing 21
and 31 numerically is meaningless. The higher metadata version on 6.0 is from its locally upgraded
representation, not proof of a different coordination term or accepted cluster-state epoch.

This is **not merely a formatting change or a volatile information_schema cache**: the old value is
persisted in 6.0's new relation metadata while the legacy index metadata is current on every node.
It is also not evidence that the three nodes disagree on the index-level wait setting.
The persisted copies are a point-in-time view; compare their receipt timestamps and subsequent
live state-version readings before treating them as the exact latest in-memory state.

The source explains the observed behavior:

- 6.0 `DocTableInfoFactory` constructs table information using `RelationMetadata.Table.settings()`,
  which therefore feeds wait 2 into `information_schema.tables`. `DocSchemaInfo` refreshes its
  object only when that relation's `tableVersion` increases. [Factory](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/io/crate/metadata/doc/DocTableInfoFactory.java#L122-L188),
  [cache/version check](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/io/crate/metadata/doc/DocSchemaInfo.java#L144-L180).
- A cluster-state diff streamed from a pre-6.0 master supplies legacy index/template diffs and no
  new-schema diff. The 6.0 upgrade service creates missing relation metadata, but when an existing
  relation already contains that index UUID, it continues without updating its settings. This
  matches an index-level setting update on the 5.10 master leaving the 6.0 relation metadata stale.
  [Metadata diff compatibility](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/org/elasticsearch/cluster/metadata/Metadata.java#L506-L590),
  [upgrade service](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/org/elasticsearch/cluster/metadata/MetadataUpgradeService.java#L181-L273).
- Sending ALTER TABLE through the 6.0 coordinator still forwards the cluster-state mutation to
  the elected master; it does not make that coordinator the master or guarantee different
  metadata handling. [TransportAlterTable](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/io/crate/execution/ddl/tables/TransportAlterTable.java).

### Which wait normal SQL writes enforce

Source-backed conclusion: normal SQL writes use **IndexMetadata's wait 3**, despite 6.0's stale
catalog wait 2. `ShardUpsertRequest` and `ShardDeleteRequest` inherit `ReplicationRequest`'s DEFAULT
active-shard count. `TransportReplicationAction` resolves DEFAULT from
`indexMetadata.getWaitForActiveShards()`; `ReplicationOperation.checkActiveShardCount()` checks that
resolved count against routing before performing the primary operation. A scan of **all main Java
sources in the exact 6.0.8 tag** found no SQL upsert/delete caller overriding that count from
`DocTableInfo`. Explicit overrides are non-SQL-write maintenance actions such as refresh/retention
lease synchronization. [Request default](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/org/elasticsearch/action/support/replication/ReplicationRequest.java#L42-L101),
[upsert request](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/io/crate/execution/dml/upsert/ShardUpsertRequest.java),
[shared shard request](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/io/crate/execution/dml/ShardRequest.java),
[default resolution](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/org/elasticsearch/action/support/replication/TransportReplicationAction.java#L650-L665),
[actual check](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/org/elasticsearch/action/support/replication/ReplicationOperation.java#L307-L337).

This is a source inference combined with the persisted index settings, **not a production write test**.
No missing-copy test, write canary, restart, cache reset or DDL repair was performed. Recommendation:
retain the original wait 3, avoid repeating ALTERs to fix the catalog display, freeze unnecessary
schema/settings changes while mixed, and verify both representations after a separately approved
homogeneous transition. The stale relation model can affect other table planning/metadata operations;
do not dismiss it as cosmetic merely because this particular wait resolves from index metadata.

### Why HTTP/SQL raw-state probes failed

The version-pinned 5.10.16 and 6.0.8 `SysClusterTableInfo` have no `state` column. Newer documentation
about Base64 `sys.cluster.state` cannot be applied to these versions. `_cluster/state` is an internal
transport action, not an exposed Crate HTTP REST route; a file-not-found response on port4200 does
not prove missing cluster state. JMX's `NodeInfoMXBean` exposes the cluster-state version and shard
information, not raw metadata. [5.10 sys.cluster columns](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/metadata/sys/SysClusterTableInfo.java),
[6.0 sys.cluster columns](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/io/crate/metadata/sys/SysClusterTableInfo.java),
[transport action](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/org/elasticsearch/action/admin/cluster/state/TransportClusterState.java),
[JMX interface](https://github.com/crate/crate/blob/6.0.8/extensions/jmx-monitoring/src/main/java/io/crate/beans/NodeInfoMXBean.java).

## A day in the mixed cluster

5.10→6.0 is a supported **transient rolling-upgrade combination**. The official guidance does not
promise that an intentionally mixed production cluster is safe for a day or provide a numeric maximum
mixed duration. A GREEN observation is useful but does not remove storage/recovery and metadata
limitations. Treat a day-long pause as a monitored incident exception, not a steady-state deployment.
No automatic timeout forces the next upgrade, but this is not a reason to silently leave it indefinitely.
[Rolling compatibility and sequence](https://cratedb.com/docs/guide/admin/upgrade/rolling.html),
[lifecycle compatibility](https://cratedb.com/support/lifecycle-policy).

Recommended restrictions pending owner decision:

- Keep existing copies and replicas; do not lower replicas, remove/recreate old replicas, restart
  another node, or force a relocation. The node-version decider permits primary movement only to
  equal/newer major-minor nodes and replica recovery only onto nodes no older than their active
  primary. A 6.0 primary cannot recover a fresh replica onto 5.10, even when an already-existing old
  replica is presently STARTED. GREEN now does not guarantee GREEN after loss/recovery of an old copy.
  [Exact allocation decider](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/org/elasticsearch/cluster/routing/allocation/decider/NodeVersionAllocationDecider.java).
- Retain rebalance none and allocation all as the current approved handover; do not change allocation
  merely to make counts look balanced. Allocation all allows legitimate missing-copy recovery subject
  to version deciders; none would prevent useful recovery. This operational recommendation follows
  the observed accepted handover, not a blanket vendor mandate for all mixed clusters.
- Ordinary already-supported read/write traffic can continue subject to existing app retries and
  monitoring. Do not deploy SQL/features requiring homogeneous6.x, or change authentication,
  privileges, table schemas/settings, partitioning, shard counts, table swaps/renames/drops or replicas
  unnecessarily. Dynamic column creation is also a metadata change; schema-changing ingestion needs
  attention. This conservative freeze is particularly warranted by the demonstrated dual-metadata
  discrepancy. Upstream has documented mixed5.10/6.0 SWAP TABLE corruption; that issue illustrates
  why a mixed cluster must not be treated as unrestricted schema-maintenance time, without claiming
  every historical SWAP bug still affects this exact patch. [Upstream issue18972](https://github.com/crate/crate/issues/18972).
- Never downgrade the 6.0 data directory to5.10. Major/minor rollback is restore-based, separately
  approved; the protected old snapshot and BLOB pair must stay intact. [Upgrade recovery guidance](https://cratedb.com/docs/guide/admin/upgrade/planning.html).
- Do not treat a new mixed-cluster snapshot as the promised5.10 rollback target. 6.0 uses Lucene10;
  newly written shard segments cannot be assumed readable by5.10/Lucene9. A fresh snapshot can still
  be valuable for forward recovery, but needs a compatible restore validation and separate RPO claim.
  [6.0 format changes](https://github.com/crate/crate/blob/6.0.8/docs/appendices/release-notes/6.0.0.rst),
  [snapshot-version recovery check](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/org/elasticsearch/cluster/routing/allocation/decider/NodeVersionAllocationDecider.java).

Recommendation: first recover a working isolated backup writer under explicit owner approval, retain
monitoring and schema/deploy restraint, then make a near-term owner decision on completing the hop.
Do not offer an unconditional one-day safety guarantee or perform a downgrade to avoid the mixture.

## Snapshot repository mechanics and smallest SQL-only candidate

Repository registration lives in **cluster metadata**, not independently on individual coordinators.
CREATE/DROP REPOSITORY registers/unregisters the name and options; DROP does not delete repository
snapshot files. Each data node must resolve and access a shared fs path allowed by its own startup
`path.repo`. readonly=true forbids writes through that registration. Repository format compatibility
and shard-segment compatibility are separate. [Snapshot/reference mechanics](https://cratedb.com/docs/crate/reference/en/latest/admin/snapshots.html),
[repositories metadata](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/org/elasticsearch/cluster/metadata/RepositoriesMetadata.java).

There is no unconditional source check prohibiting CREATE SNAPSHOT in a mixed cluster:6.0's snapshot
service chooses repository metadata compatibility using the minimum node/snapshot version. That
mechanism does **not** certify a mixed snapshot's data can restore to5.10. Official planning advises
holding scheduled backups during active upgrade; official6.0 notes advise a fresh different-path
repository after the cluster is fully upgraded. [Compatibility selection](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/org/elasticsearch/snapshots/SnapshotsService.java#L1653-L1683),
[snapshot creation](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/org/elasticsearch/snapshots/SnapshotsService.java#L300-L340),
[planning](https://cratedb.com/docs/guide/admin/upgrade/planning.html),
[6.0 notes](https://github.com/crate/crate/blob/6.0.8/docs/appendices/release-notes/6.0.0.rst).

The `/snapshots-v6` writer planned for homogeneous6.0 cannot simply be registered now: only the
upgraded container has that new mount and allowlist. It would fail on the two old containers. The
smallest **candidate requiring approval and fresh fs/registration checks**, without a restart, is:

```sql
-- Proposal only. No statement below was executed by this research.
-- Precondition: no active snapshot; exact current aliases/options recorded;
-- all three nodes' existing /snapshots path is the SAME genuinely shared mount.
DROP REPOSITORY "goodwatch-db-backup";
CREATE REPOSITORY "goodwatch-db-backup-v2" TYPE fs WITH (
    location='/snapshots/q65-mixed-20261027',
    compress=true,
    readonly=false
);
```

Dropping the **read-only legacy root registration** first avoids keeping a registered repository
root at`/snapshots` while registering a child writer. Its old files remain. The new sibling is
separate from protected`/snapshots/v2`; protected`goodwatch-pre6` remainsread-only and untouched.
Do not recreate the parent registration while the child writer is active. Do not repoint either
protected path to a writer. SQL registration performs the new directory's repository verification;
verify exact settings on all coordinators and a uniquely named manual snapshot SUCCESS before
claiming the cron repaired. This candidate changes backup routing and unregisters one old name,
not table settings or node versions. A shared-storage permission/path failure would leave no V2
writer and require an explicit stop/report, not a source-path fallback. Future restoration of the
legacy root alias requires first resolving the nested writer path deliberately.

Risks: loss of the old root alias until deliberately restored; new writer fs permissions/shared
visibility; first full snapshot I/O; hardcoded writer and monitoring/retention scripts must point to
the intended new repository, and must not delete the protected pre6 snapshot; mixed-snapshot restore
compatibility remains unproven. Reuse of the old`/snapshots/v2` aswritable would be fewer syntax
changes but weakens the protected rollback boundary and is not the recommended fix.

## Reproducing the offline decode

[Decoder source](q65-state-decoder/DecodeMetadata.java) is included so the selected output can be
recreated. It reads only a **local copied** Lucene directory, never a live production data mount,
and opens no network connection. No Crate node is started. Use the exact6.0.8 runtime jars,
including Lucene backward codecs, and a Java24-compatible compiler/runtime (this run used host
javac27 with`--release24` and hostJava27; Lucene emitted an unsupported-newer-Java vectorization
warning, but all three read-only decodes completed successfully). Source SHA/digests can be
calculated directly from the checked-in file and cached exact-versionimage.

```bash
# Local only: matching jars were copied from a non-running crate:6.0.8 image container.
# All scratch and copied input directories remain private under ~/.cache/gw-work/644-q65.
export TMPDIR="$HOME/.cache/gw-work/644-q65"
mkdir -p "$TMPDIR/verify-classes"
javac --release 24 -cp "$TMPDIR/upstream/lib608/*" -d "$TMPDIR/verify-classes" \
  docs/implementation/auth/cratedb-production/20261026-operation-contexts/q65-state-decoder/DecodeMetadata.java
java -cp "$TMPDIR/verify-classes:$TMPDIR/upstream/lib608/*" DecodeMetadata \
  "$TMPDIR/state-12-private" > "$TMPDIR/state-decoded-12.json"
# Repeat the final command only with the stable LOCAL state-11/state-13 copies.
```

The decoder uses only`DirectoryReader`, never`IndexWriter` or the unsafe override/detach node tools.
The index-settings whitelist excludes all roles/passwords, global settings and arbitrary
custom metadata from its output. The current implementation includes five setting values (wait,
block, replicas, creation version, upgraded version); index UUID/version counters and coordination
commit headers are also retained. No full global metadata serialization is written.
