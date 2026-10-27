# Q53 source check: rolling upgrade using plain stops

Checked October27,2026 for the local rehearsal/runbook task. No production access or change was performed for this research. This note checks the mechanism; the accompanying rehearsal must establish actual GREEN checkpoints and timings. It supersedes none of the production runbook's gates.

## Version path

| Current → target | Rolling predecessor required by target notes | Source |
| --- | --- | --- |
| 5.10.16 →6.0.8 | >=5.10.1 | [Tagged6.0.8 notes](https://github.com/crate/crate/blob/6.0.8/docs/appendices/release-notes/6.0.8.rst), [6.0.0 notes](https://cratedb.com/docs/crate/reference/en/6.4/appendices/release-notes/6.0.0.html) |
| 6.0.8 →6.1.6 | >=6.0.2 | [Tagged6.1.6 notes](https://github.com/crate/crate/blob/6.1.6/docs/appendices/release-notes/6.1.6.rst) |
| 6.1.6 →6.2.11 | >=6.1.2 | [6.2.11 notes](https://cratedb.com/docs/crate/reference/en/6.4/appendices/release-notes/6.2.11.html) |
| 6.2.11 →6.3.7 | >=6.2.0 | [6.3.7 notes](https://cratedb.com/docs/crate/reference/en/6.3/appendices/release-notes/6.3.7.html) |
| 6.3.7 →6.4.6 | >=6.3.0 | [6.4.6 notes](https://cratedb.com/docs/crate/reference/en/6.4/appendices/release-notes/6.4.6.html) |

The6.0.8 note has an apparent copy/paste typo naming6.0.6 in its rolling sentence; the stated predecessor and6.0.0 requirement agree with the chosen first hop. Each target requires tables created at5.x or newer. Complete one three-node hop before beginning the next: no5.10/6.4 direct rolling jump. [Version requirements](https://cratedb.com/docs/guide/admin/upgrade/rolling.html#version-requirements).

## Why preserving existing copies matters with plain stops

`NodeVersionAllocationDecider.canAllocate` rejects a **new replica recovery** onto an older major/minor node than its active primary; primary relocation also goes only to equal/newer nodes. The class does not implement an eviction decision against already-STARTED older replicas. Inspected complete class bytes are identical at all six selected tags, SHA256 `b6ff2355fdc190e44e177e7945b63e95192d259cfa2ec862b4e385a89c6c5258`. [6.0.8 source](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/org/elasticsearch/cluster/routing/allocation/decider/NodeVersionAllocationDecider.java), [6.4.6 source](https://github.com/crate/crate/blob/6.4.6/server/src/main/java/org/elasticsearch/cluster/routing/allocation/decider/NodeVersionAllocationDecider.java).

When an active primary departs, routing promotes an active replica on the **highest available version**. This can leave a newer primary alongside an already-STARTED older replica. That is distinct from rebuilding an absent old replica. [5.10.16 primary-promotion source](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/cluster/routing/RoutingNodes.java#L579), [6.0.8 promotion](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/org/elasticsearch/cluster/routing/RoutingNodes.java#L620), [6.4.6 highest-version selection](https://github.com/crate/crate/blob/6.4.6/server/src/main/java/org/elasticsearch/cluster/routing/RoutingNodes.java#L307).

**Source-based inference to verify in the lab:** upgrading each node exactly once, preserving all configured replicas, should avoid the old rehearsal's drain/reduction dead end. The stopped node returns on the target version and can recover from either version. Older copies that stayed active need no new recovery. A subsequent unexpected loss of an older copy may nevertheless leave YELLOW until that node advances; never treat an existing older replica as proof that arbitrary older-target recovery is supported. Record primaries and replica versions at every node checkpoint, not merely the final homogeneous GREEN.

Prefer the rehearsed2→3→1 order if all fresh placement/master gates permit it. Fewest primaries first reduces the first canary's promotion surface, but is not a compatibility exception. No Crate-specific requirement for elected-master-last was found in the official rolling guide. All three nodes are normally master-eligible; changing this role is outside scope. Leaving the current elected master until last avoids an early election when practical, but the lab must include the actual election/rejoin before claiming this order is qualified. Preserve two available voting members throughout. [Crate clustering/election](https://cratedb.com/docs/crate/reference/en/5.10/concepts/clustering.html#master-node-election).

## Plain stop is an owner-approved variation of the guide

The vendor guide recommends decommission; it separately documents TERM as a **normal** stop that does not drain. Q53 intentionally substitutes the rehearsed plain-stop route. This means the safety gate is active survivor copies for every departing primary, not zero target primaries or a decommission acknowledgement. `allocation.enable=primaries` suppresses replacement replica allocations during the brief stop; restoreall after the upgraded node rejoins and wait for original replication/GREEN **before the next stop**. Do not call this an exact execution of the vendor's decommission recipe. [Stop distinction and allocation setting](https://cratedb.com/docs/guide/admin/upgrade/rolling.html#graceful-stop-particularities).

Docker's configured StopSignal defaults to TERM. `docker stop --timeout=-1` waits indefinitely instead of escalating after its normal grace. Host-managed execution must retain `TimeoutStopSec=infinity`/`SendSIGKILL=no`; a deadline or disconnected operator terminal is not permission to force termination. Check StopSignal on each old container and target image. [Docker stop reference](https://docs.docker.com/reference/cli/docker/container/stop/).

## Container replacement without accidental second stop

Checked-in Compose is `goodwatch-crate/docker-compose.yml`, service `cratedb`, project `goodwatch-crate`; prior rollout documentation records host directory `/root/goodwatch/goodwatch-monorepo/goodwatch-crate`. **Freshly verify those labels/paths before execution.** Image is `crate:${CRATE_VERSION}`; the durable target value can be `6.0.8@sha256:APPROVED_DIGEST`, yielding a pinned tag-plus-digest. Inspect architecture-specific image metadata and `RepoDigests` after pull; never infer a digest from a version string. [Docker image inspect](https://docs.docker.com/reference/cli/docker/image/inspect/).

Compose can stop/recreate a running container when its image/config changes. Therefore invoke replacement **only after confirmed normal exit**, with the same project/service/config-file set, named data volume, bind mounts, HBA flags, published addresses, heap and environment. A reviewed override may change only image/restart policy and explicitly approved repository configuration. Do not dump rendered configuration containing secrets. A cautious sequence is `compose up --no-start --no-deps --force-recreate cratedb`, inspect the stopped replacement's image/config/mounts, then `docker start crate-0N`; use the locally rehearsed equivalent if different. Preserve restartno until verified GREEN, then restorealways. Never `down -v` or use Compose to stop a running production node. Retain the version override durably so a later ordinary deployment cannot resurrect an old image against upgraded data. [Compose recreation, volume preservation, and no-start option](https://docs.docker.com/reference/cli/docker/compose/up/).

## Abort and homogeneous checkpoints

The official guide documents mixed versions during rolling upgrades; no vendor guarantee for intentionally leaving this mixed cluster overnight was found. Prefer complete-hop homogeneous endpoints, but **a watcher alarm is not permission to upgrade the remaining nodes automatically**. Stop before the next node; perform only the approved recovery/restoration for the node already stopped. Leave at least GREEN, retain explicit staffed mixed-version handover if necessary, and obtain a decision before further upgrades. Once every node is on6.x, the major-version join barrier rejects a5.x node; image rollback is not recovery. [Tagged join validation](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/org/elasticsearch/cluster/coordination/JoinTaskExecutor.java#L304).

For major/minor transitions rollback requires backup restore; queue/replay must be qualified if the owner rejects losing post-baseline writes. No in-place downgrade of a data directory opened by the new version. [Vendor rollback guidance](https://cratedb.com/docs/guide/admin/upgrade/planning.html#define-a-rollback-plan).

## One protected baseline and repository transition

Take/verify the protected5.10 SQL snapshot plus separate SHA1 BLOB copy before the first node; hold all backup/retention writers throughout. BLOBs are excluded from SQL snapshots. After homogeneous6.0, create one disjoint6.x repository location; subsequent snapshots there remain incremental. `DROP REPOSITORY` unregisters configuration and does not delete snapshot data. Preserve the whole old dependency set, not just its manifest. [Snapshot/repository semantics](https://cratedb.com/docs/crate/reference/en/6.4/admin/snapshots.html).

Although the fs repository options table omits it, tagged source explicitly permits `readonly` in `FsRepository.optionalSettings` at5.10.16,6.0.8 and6.4.6. Qualify exact CREATE/re-registration/ALTER statements locally rather than copying S3-only documentation assumptions. [5.10.16 fs settings](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/repositories/fs/FsRepository.java#L65), [6.4.6 fs settings](https://github.com/crate/crate/blob/6.4.6/server/src/main/java/org/elasticsearch/repositories/fs/FsRepository.java#L65).

Both `goodwatch-crate/backup.py` and Windmill's `f/monitoring/backup_health.py` hardcode `goodwatch-db-backup-v2`. Preserve that active registration name while deliberately switching its location; retain old path under a distinct read-only registration, or qualify a coordinated writer/monitor name change. Before cron restoration verify the active name points to6.x, the old repository cannot be written, and a fresh6.x snapshot succeeds. The execution agent's archived inventory records **both** a legacy repository rooted at `/snapshots` and the v2 repository at `/snapshots/v2`. Therefore `/snapshots/v6` would still nest inside the legacy repository: **do not use it**. The reviewed plan instead needs shared host `/mnt/backup-cratedb/snapshots-v6` mounted separately at `/snapshots-v6`, with `path.repo` allowing both container paths on every replacement. Preserve every other startup/HBA argument. Verify the new host directory really resides on the shared backup filesystem on all three hosts, not merely that identical directory names exist locally. The node-local path allowlist and shared-fs requirement are documented in [CREATE REPOSITORY](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/create-repository.html#fs). No live production path was inspected for this note.

The execution agent also qualified the exact5.10.16 local re-registration sequence: `DROP REPOSITORY q53_pre5`, followed by `CREATE REPOSITORY q53_pre5 TYPE fs WITH (location='/snapshots/v5', readonly=true)`, with sys.repositories showingreadonlytrue. The production runbook must substitute its reviewed original options/location and avoid deleting any files.

## Newly reproduced6.0/6.1 BLOB visibility defect

The Q53 rehearsal paused after its first6.1.6 node: every coordinator reported145 GREEN and1175 STARTED allocation rows, but the new coordinator's `sys.shards` returned1171 rows, omitting four remote BLOB copies. Both old6.0.8 coordinators returned1175 including all six BLOB copies. Ordinary SQL shard rows agreed exactly. This persisted across repeat samples, not merely a sampling race. The execution agent recorded `mixed-61-sys-shards-difference.json` and `mixed-61-blob-access.json` in its local evidence.

There is a direct source explanation:

- [6.0.8 sys.shards routing](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/io/crate/metadata/sys/SysShardsTableInfo.java#L198) uses index **names** as collection keys; [6.1.6](https://github.com/crate/crate/blob/6.1.6/server/src/main/java/io/crate/metadata/sys/SysShardsTableInfo.java#L197) uses index **UUIDs**.
- [6.1.6 Routing.writeTo](https://github.com/crate/crate/blob/6.1.6/server/src/main/java/io/crate/metadata/Routing.java#L135) serializes these strings without a version conversion.
- [6.0.8 Metadata.index(String)](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/org/elasticsearch/cluster/metadata/Metadata.java#L294) looks up the name-keyed map, distinct from its UUID lookup method.
- [6.0.8 ShardCollectSource.getShardsIterator](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/io/crate/execution/engine/collect/sources/ShardCollectSource.java#L453) silently skips an unknown routing key. Thus old nodes can omit BLOB stats requested using a UUID by a new coordinator. This path does not delete data or change allocation.

**The defect also affects SQL reads, not only monitoring.** `SELECT digest FROM blob.search_index_files` returned RelationUnknown/4041 via the6.1 coordinator while both6.0 coordinators returned the expected digest. [6.1.6 BlobTableInfo.getRouting](https://github.com/crate/crate/blob/6.1.6/server/src/main/java/io/crate/metadata/blob/BlobTableInfo.java#L104) also chooses UUID keys; the old [DOC collector](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/io/crate/execution/engine/collect/sources/ShardCollectSource.java#L312) throws on missing metadata instead of silently skipping it. These tagged differences support the lab's observed behavior; an upstream fix/version was not established here.

Repository caller evidence: `goodwatch-flows/windmill/f/search/build_indexes.py:444` uses this SQL digest read for old-index cleanup. `goodwatch-webapp/app/server/search-ranking/search-index-build.server.ts` loads the index using HTTP. Authenticated HTTP GET with redirects returned200 and the expected SHA1 through every coordinator in the mixed lab, including the new one. This supports continued index-reader availability; redirected HTTP success alone does not prove each physical copy's content independently.

A bounded **owner-approved gate exception** can distinguish this known visibility defect from missing data: require all three `sys.health` views GREEN, identical complete `sys.allocations` copy identities/count/status, ordinary SQL shard rows agreeing, and union of each coordinator's own local BLOB shard rows matching all expected allocation identities and STARTED state. Also require authenticated BLOB GET/HEAD/digest checks through every coordinator. Keep `build_indexes` and all BLOB SQL cleanup/publication/schema jobs held while6.0/6.1 is mixed; do not dynamically route production jobs around errors. Record the precise coordinator/version exception; require ordinary all-coordinator BLOB SQL/stat agreement again at homogeneous6.1 before beginning another hop. Stop if any additional discrepancy appears. Without explicit approval of this exception, the observed SQL/gate failure is **NO-GO** for this route. The earlier review/rehearsal missed this mixed-version BLOB-specific behavior.

## Exact baseline, registration and selected restore SQL

`CREATE SNAPSHOT ... ALL` in5.10 includes full cluster metadata/persistent settings and all SQL tables, excluding BLOB data. The tagged [CreateSnapshotPlan](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/planner/node/ddl/CreateSnapshotPlan.java#L196) sets `includeGlobalState` forALL; [RolesMetadata.context](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/role/metadata/RolesMetadata.java#L236) includes SNAPSHOT, so user/role/password-hash/privilege metadata is covered. Node-local HBA, container config and external auth payload keys require their separately protected copies. [5.10 CREATE SNAPSHOT](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/create-snapshot.html).

Future execution examples below assume fresh gates, backup cron/retention held, no active snapshot or repository operation, reviewed existing repository options, and a unique baseline name. They were **not executed in production** by this research:

```sql
CREATE SNAPSHOT "goodwatch-db-backup-v2".pre6_q53_20261027 ALL
WITH (wait_for_completion=true);
-- Verify SUCCESS, zero failures, expected shard/table inventory on every coordinator.
-- Pair the snapshot with the separately verified BLOB SHA1 copy.
-- Preserve the complete old repository; retain original options where applicable.
CREATE REPOSITORY "goodwatch-pre6" TYPE fs
WITH (location='/snapshots/v2', readonly=true, compress=true);
DROP REPOSITORY "goodwatch-db-backup-v2";
CREATE REPOSITORY "goodwatch-db-backup-v2" TYPE fs
WITH (location='/snapshots/v2', readonly=true, compress=true);
-- After all nodes are6.0.8, with /snapshots-v6 shared/allowlisted on all nodes:
DROP REPOSITORY "goodwatch-db-backup-v2";
CREATE REPOSITORY "goodwatch-db-backup-v2" TYPE fs
WITH (location='/snapshots-v6', compress=true);
-- Keep goodwatch-pre6 read-only at its original location throughout all hops.
```

Preserve non-default chunk/rate options from the actual baseline rather than copying only the example's compress setting. Since legacy `/snapshots` contains `/snapshots/v2`, the legacy registration must also be read-only/unregistered and all other writers/retention held; protecting only the v2 alias does not protect against another writer to overlapping storage. No filesystem move/delete is implied by DROP REPOSITORY.

On an **isolated, fresh5.10.16 recovery cluster with empty data directories**, register the preserved repository read-only, then restore selected sections rather than applying potentially unsafe global allocation/settings over a live cluster:

```sql
CREATE REPOSITORY "goodwatch-pre6" TYPE fs
WITH (location='/snapshots/v2', readonly=true, compress=true);
RESTORE SNAPSHOT "goodwatch-pre6".pre6_q53_20261027
TABLES, USERMANAGEMENT, VIEWS, ANALYZERS, UDFS
WITH (wait_for_completion=true);
```

This combination is supported by the [5.10 restore grammar](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/restore-snapshot.html): sections can be combined, whileTABLES excludes global metadata andUSERMANAGEMENT selectively restores identities/grants. Operator authority must include the required restore/user-management privileges. Then restore the reviewed cluster settings and node-local configuration explicitly, recreate the BLOB table with its original policy and restore its paired SHA1 artifacts, verify all copies/data/identities/passwords/privileges, and only then approve cutover. `ALL` is available but also overwrites cluster settings/metadata; do not use it blindly against production. This note supplies SQL syntax and source reasoning, not a full-volume recovery/RTO qualification.

## Reading the allocation refusal without changing routing

For a negative-control old-replica recovery failure, use a separate read-only query for decisions, without selecting `explanation` first:

```sql
SELECT shard_id, decisions
FROM sys.allocations
WHERE table_schema='doc' AND table_name='REHEARSAL_CONTROL_TABLE'
  AND current_state='UNASSIGNED';
```

[SysAllocations](https://github.com/crate/crate/blob/6.1.6/server/src/main/java/io/crate/expression/reference/sys/shard/SysAllocations.java#L63) constructs an explanation from a routing snapshot with debug decisions excluding YES results; it does not issue a reroute. The system table routes to the elected master. [SysAllocation](https://github.com/crate/crate/blob/6.1.6/server/src/main/java/io/crate/expression/reference/sys/shard/SysAllocation.java#L87) has a lazy-cache hazard: `explanation()` initializes the shared decision while `decisions()` only initializes its node-decision list inside the same null-decision branch. Read decisions independently to avoid that column-evaluation interaction; the same code exists in6.0.8. Retain the actual node-version refusal text from the lab rather than assuming every YELLOW replica has this cause. No REROUTE, REST allocation command or production control-table mutation is required by this diagnostic.


The local negative-control query **did** recover the exact refusal (saved by the execution agent as `version-canary/exact-version-decisions.json`): `cannot allocate replica shard to a node with version [6.0.8] since this is older than the primary version [6.1.6]`. This confirms the intended compatibility refusal, not merely a correlation with YELLOW. The execution agent then advanced that last old node forward; no opened data directory was downgraded. The read-only query workaround was qualified in the lab.
