# Production CrateDB 5.10.16 → 6.4.6 — #644

Initial planning/rehearsal used main **7ee29ce30**. Read-only production preparation and the full release audit
were updated from main **1770d08d1** on October 26, 2026.
**No production write, restart, credential, setting, schedule or filesystem change was made.**
Owner option B authorizes preparation, not execution. This is a reviewable candidate procedure with
explicit go/no-go gates; the previous #562 restart approval does not authorize this major upgrade.

[Compatibility/source review](../research/crate-6-upgrade-compatibility.md),
[current guarded-stop runbook](auth/cratedb-production-rollout.md#current-stale-context-and-restart-advice--644),
[#644 operation-retention evidence](auth/cratedb-production/20261026-operation-contexts/README.md).

## Supported path and scope

A direct **rolling** 5.10 → 6.4.6 jump is not documented. Complete every node and verification at each boundary:

| Hop | Target | Supported rolling source |
| --- | --- | --- |
| 1 | **6.0.8** | >=5.10.1 |
| 2 | **6.1.6** | >=6.0.2 |
| 3 | **6.2.11** | >=6.1.2 |
| 4 | **6.3.7** | >=6.2.0 |
| 5 | **6.4.6** | >=6.3.0 |

Use **crate-02 → crate-03 → crate-01 at each hop**, fifteen replacements. Do not begin the next
minor until all three nodes are on the current target, fully recovered, original table settings
restored, client gates passed and a stage snapshot verified.
The [rolling guide](https://cratedb.com/docs/guide/admin/upgrade/rolling.html#version-requirements)
and each target's release notes govern support. The [6.0.8 note](https://cratedb.com/docs/crate/reference/en/6.0/appendices/release-notes/6.0.8.html)
appears to misprint its target as 6.0.6; the [6.0.0 note](https://cratedb.com/docs/crate/reference/en/6.0/appendices/release-notes/6.0.0.html)
explicitly permits >=5.10.1, and patch upgrades within a minor are supported. This plan deliberately
uses patched intermediates rather than the initial 6.0/6.1/6.2/6.3 releases with known old-metadata
corruption bugs. Pin every image by the reviewed digest in the rehearsal receipts; never deploy `latest`.

## Decisions required before production

1. **Client compatibility patch:** this preparation updates/tests the webapp and operator-script node-loss
   matchers for both `Participating node` and `Coordinator node` messages. Review/deploy it before production6.x.
   Retain the distinction between recoverable reads and indeterminate writes; add no blanket write replay.
2. **BLOB read scope:** approve an effective search-reader privilege policy before the first 6.2.11 node.
   In the 6.4.6 lab, `GRANT DQL ON TABLE blob.search_index_files` did not authorize HTTP GET/HEAD:
   it returned 404 `Schema 'blob' unknown`, even after a fresh re-grant. Schema-level DQL worked;
   PUT/DELETE remained denied. A schema grant reads **all current and future BLOB tables**. Inventory them
   and obtain explicit approval; do not assume table-scoped DENY protects other BLOBs from this HTTP path.
   If that scope is unacceptable, stop for a verified upstream/client alternative.
3. **Three-copy maintenance exception:** approve the active-copy/write-admission and last-node replica
   policy below, including brief table write blocks during settings changes. Otherwise provision compatible
   extra capacity and rehearse that alternative before scheduling production. No waiver of zero primaries,
   no missing primaries, `force=false` or unlimited-grace normal stop is proposed.
4. **Backup hold and repository transition:** approve bounded scheduled-backup holds while versions are
   mixed, protected old-repository retention, a separate shared 6.x repository path and coordinated
   registration cutover preserving the identifier used by the writer and monitor.
5. **Window and recovery policy:** choose a maintenance window, checkpoints and the rollback RPO. Continued
   production writes after a snapshot cannot be guaranteed recoverable by that snapshot. Zero-loss rollback
   requires an approved write freeze/queue/replay mechanism; this lab's fixed-key retries are not that mechanism.

## Read-only production preflight — October 26, 2026

Collected from all three trusted-loopback coordinators, Docker/runtime metadata and snapshot manifests
at **02:36–02:47 UTC** from main `1770d08d1`. No production data, config, grants, schedules, processes or
repositories were changed; no production snapshot or restore was started. This is a dated preparation
record, not permission to execute. [Evidence and commands](crate-6-upgrade/20261026-preflight/README.md),
[structured inventory](crate-6-upgrade/20261026-preflight/results.json).

| Gate / measurement | Observed result and implication |
| --- | --- |
| Versions/membership | Three members, all **5.10.16**; crate-03 master. IDs match the previous rollout. |
| Health/checks | All coordinators agree: **145 GREEN**, zero missing/underreplicated shards, zero failed cluster/node checks. |
| **Stop readiness — NOT passed** | **1,175 copies: 1,173 STARTED/STARTED and two STARTED/RELOCATING**, present in both samples. `person_appeared_in` shard4 primary on crate-01 and shard5 replica on crate-03 point to crate-02. Historical recovery DONE is not a completed routing transition. Require every copy STARTED/STARTED and independent checkpoint/placement verification before any drain; investigate read-only if this persists. |
| Creation versions | **145 base tables: 94 created5.10.9, 51 created5.10.16; zero partitions, zero closed tables.** No pre5.x recreation/reindex prerequisite was found. This includes BLOB and retained backup schemas. Repeat before execution. |
| DDL/analyzers | SHOW CREATE succeeded for all144 SQL tables; BLOB SHOW CREATE is unsupported and was inventoried separately. Only `standard` fulltext analyzer observed; no removed analyzer names, `soft_deletes.enabled`, explicit `current_catalog` identifier or legacy creation versions found. |
| Replica policy | **106 tables `0-1`, nine `1`, thirty `2`**. The thirty include15 auth tables plus **`user_mcp_action`** with wait1/REQUEST, and14 YepWatch tables with wait3/REQUEST. All145 tables use REQUEST. The earlier29-table rehearsal omitted `user_mcp_action`: include it in the exact approved list, preserve its wait1, and verify its keyed-write/readback behavior. No unaccounted table write blocks observed. |
| Effective settings | Allocation/rebalance `all`; no node exclusions; graceful stop PRIMARIES/force=false/2h. Recovery cap **40MiB/s per node**, two concurrent recoveries; all gateways expect/recover-after3 data nodes. No `gateway.auto_import_dangling_indices` override in startup argv/effective settings. |
| Node config/HBA | All image tags5.10.16, heaps16GiB, same data volumes, `/snapshots` allowlist and shared bind. HBA enabled: trusted `crate` only at127.0.0.1, password fallback. Preserve these settings. Captured argv/effective settings are available; Crate's REST settings endpoint returned404, so persistent/transient provenance was not obtained through it. Export approved configuration sources before execution. |
| Current data | **40,993,871,678 bytes (38.18GiB) primary**, **80,709,631,140 bytes (75.17GiB) all copies**, excluding translogs. Live data can differ from the older snapshot. |
| Node free disk | crate-01 **215.5GiB**, crate-02 **199.2GiB**, crate-03 **237.4GiB**; each data filesystem about300.17GiB. Shared backup filesystem has **1.055TiB free** across all mounts. These are filesystem totals, not reserved recovery capacity. |
| BLOB inventory | Exactly **`blob.search_index_files`**, three primary/three replica shards, **21 objects / 137,651,413 bytes (131.27MiB) per complete copy**. No other BLOB table found. SQL snapshots omit these objects. Owner must approve the content classification and future-table read scope before schema DQL is added. |
| Installed page/search clients | Both page containers (.20/.21) and search-a/b (.20): **Node24.22.1, node-crate3.0.0, pg8.23.1**. Image identities recorded; this prep patch is not deployed. |
| Installed flow clients | **17 Python worker containers on15 hosts** expose cached crate-python **2.0.0,2.2.1,2.3.0** (2.0.0 under Python3.11;2.2.1 under3.11/3.12;2.3.0 under3.12). Two native workers have no such package at probed paths. Cache presence does not establish which active script lock a running job selected; inventory/qualification of that mapping remains a gate. The earlier rehearsal did not cover2.0.0. Supplemental isolated single-node canaries now pass all three versions on both5.10.16 and6.4.6 for typed array/object parameters and `_version` OCC; this is not end-to-end active-job qualification. |
| Installed backup | Actual `/root/goodwatch/goodwatch-monorepo/goodwatch-crate/backup.py` SHA256 recorded; its existing uv environment is **Python3.14.0 / requests2.32.5**, uv0.9.10. Uses HTTP requests, not crate-python. No installer or backup invocation was run. |
| Repositories | Active filesystem repository `goodwatch-db-backup-v2` at `/snapshots/v2`; legacy `goodwatch-db-backup` at `/snapshots`. Active repository **131,239,461,309 bytes (122.23GiB)** apparent size. Legacy parent traversal exceeded the100s read budget; its separate retained size is unverified. Choose a disjoint6.x path, never a child of either repository. |
| Latest captured snapshot | **`hourly_20261026_020501`**, SUCCESS,5.10.16,567 SQL shards, no failures; started02:05:02.293, finished02:05:43.747 UTC (**41.454s**), global state included. A fresh protected snapshot is still required at execution. |
| Snapshot recovery set | Read all567 shard manifests: **36,257,350,348 bytes (33.77GiB),58,837 referenced files**. Only **2,129,430,348 bytes (1.98GiB),11,561 files** were incremental. Manifest parser follows the tagged5.10.16 stream format and asserts complete consumption. No shard-content reads or production restore. |
| #644 residuals | Both samples agree: crate-01 **1,460**, crate-02 **112**, crate-03 **2,897** contexts older than1h without a matching job. They match the existing report; no KILL or cleanup was attempted. |

### Full-volume restore estimate and booked window

**Book a twelve-hour operator maintenance window**, replacing the earlier provisional six-hour estimate:
**one hour preflight, three hours for15 replacements, five hours for protected repository/snapshot gates,
one hour for verification/soak, two hours held for recovery/escalation**. This is a scheduling estimate,
not twelve hours of planned user outage or a guarantee that an unlimited-grace stop completes on a deadline.
Use homogeneous-version checkpoints; do not start another hop after hour10 or if its forecast exceeds the
remaining upgrade budget. Restore schedules/settings deliberately at the checkpoint. Never accelerate a
stop or waive copy/health gates to meet the booking.

For the captured33.77GiB SQL recovery set, **40MiB/s serial transfer alone is14.4 minutes**; three nodes
can recover concurrently but share the repository. At conservative **10–20MiB/s aggregate effective read
throughput**, transfer is **29–58 minutes**. Budget **60–120 minutes** for a fresh-cluster recovery including
bootstrap, many small files, replica recovery, users/HBA/BLOB verification and application cutover. Current
primary SQL size is larger than the snapshot and adds roughly4–8 transfer minutes at those assumed rates.
The measured incremental write rate (about49MiB/s) is not a measured restore rate. Neither snapshot SUCCESS
nor metadata proves file readability, full-volume RTO or reverse restore compatibility. A firm **validated**
RTO cannot be derived from metadata alone: before promising one, run a separately authorized full-volume
restore on isolated capacity from a protected repository copy. Do not run it in production.

Protecting a122.23GiB repository by serial copy alone costs **104–209 minutes at10–20MiB/s**.
Do not assume snapshots are independent full files, or copy only a snapshot's small manifest. Before the
window, approve/complete protected-copy seeding or qualify a version-specific repository rotation: freeze
each pre-hop path read-only and move the **same active registration** to a fresh disjoint path for each
homogeneous minor, so later writers never touch older recovery points. This extends the lab's first-hop
rotation and needs a local/isolated qualification before production. Five fresh40GiB-stage snapshots
cost roughly **3–6 hours at10–20MiB/s**, before metadata overhead; the five-hour gate allowance assumes
at least12MiB/s effective aggregate throughput. If the verified rate/forecast cannot meet it, extend the
booking or stop at a homogeneous checkpoint. Repeated full copies of the growing retained repository
are **not** silently included in this booking. The separate full-volume DR qualification must finish
before execution approval, not consume the two-hour emergency reserve.

### Exact execution approvals still needed

1. **Reviewed code rollout:** approve/deploy this compatibility patch to page/search images and the operator
   population scripts before6.x. It recognizes both node-loss messages while retaining generic-write ambiguity
   and explicit non-retryable receipt safeguards. Qualify actual selected flow locks and additional release-audit
   canaries, including feedback/correction `_version` OCC, parameter inference and social-ranking windows.
2. **BLOB scope:** explicitly approve DQL on **all current/future `blob` tables** for `goodwatch_search`, currently
   the single131.27MiB search index; retain negative PUT/DELETE behavior. Table grants/DENYs are not a proven
   narrowing mechanism for this HTTP bug. If future-table access is unacceptable, defer this workaround/upgrade
   until a verified narrower alternative exists. No grant is made in prep.
3. **Temporary write/copy policy:** approve the exact **30-table** inventory in the evidence, including
   `user_mcp_action`; only14 wait3 tables temporarily use2, with brief guarded write blocks. Preserve all original
   wait1/REQUEST settings; reduce replicas2→1 only for the last old node of each hop, then restore every original
   copy/setting before proceeding. Alternatively approve additional compatible capacity and rehearse it.
4. **RPO/write handling:** choose either **up to60 minutes of accepted post-snapshot write loss** (only if protected
   checkpoint age and hop forecasts remain within60 minutes; otherwise stop at a checkpoint and refresh before
   proceeding), or another explicitly quantified bound (for example120min if full-stage snapshots make60min infeasible),
   or **zero-loss rollback**, which needs an approved write freeze/queue/replay design before execution.
   Current hourly snapshots/synthetic fixed-key retries do not themselves provide zero loss. Agree client-facing
   handling of brief write blocks and non-idempotent errors; never silently replay arbitrary writes.
5. **Recovery/cutover owner:** name the operator with authority to stop, rebuild a pre-hop-version cluster in fresh
   directories, restore/cut over and reconcile post-snapshot writes, plus a substitute and escalation route. Approve
   the60–120min planning allowance and isolated restore-capacity drill; otherwise do not promise a verified RTO.
6. **Backup/config/window:** approve exact disjoint shared6.x path/mounts/allowlist, storage capacity for protected
   per-hop repository copies and separate BLOB backups, bounded schedule/schema-job holds with restoration owner,
   and the twelve-hour slot/checkpoint deadlines. Freeze SWAP/RENAME with other DDL during snapshot gates: the
   earlier safe-swap improvement was reverted in6.3.6/6.4.1. Review config provenance, preserve password HBA and
   approve the exact image digests/commit. No freeze, mount change or schedule hold is authorized by preparation.

**Current status: preparation only; execution is NO-GO.** Settle the two routing transitions, finish the
remaining client/config/recovery qualification and obtain the approvals above before scheduling a drain.

## Preflight — repeat fresh evidence before execution

Keep all evidence/config exports in a protected operator directory; no passwords, password hashes,
member statements or arguments in public receipts. Use `TMPDIR=$HOME/.cache/gw-work/644-upgrade` on the
operator host, never `/tmp`; do not copy a production `.env` into a preview or local test server.
Run the existing trusted-loopback SSH `crate_sql` helper on each host. Execute only selected metadata reads
until the execution approval below exists.

- Record node IDs, current master, exact images/digests, original Compose/env file hashes, volumes,
  private binds, StopSignal, restart policies, HBA argv, `crate.yml`, persistent/transient/default settings,
  repository registrations and mounts. Preserve the #562 trusted loopback and password rules unchanged.
- Require all three members, every health row GREEN, all copies STARTED/STARTED, no failed cluster/node
  checks, allocation at its captured baseline and sufficient surviving-node disk/recovery headroom.
  Use current counts, not the old 96/962 or the lab's counts. Sample operations/jobs twice a minute apart;
  record #644 residuals without KILL. New unexplained load, a drain already in flight or unsettled shards stops preflight.
- Inventory every user-created table **and partition**, including retained backup schemas and closed objects.
  Separate views (which may have no creation version) from base-table indices, then parse creation versions numerically. Any index created before **5.x** blocks the major upgrade until a
  separately reviewed reindex/recreation, semantic comparison and new backup/restore drill are complete.
  Passing fresh-schema lab tests does not establish production compatibility.
- Review actual stored analyzers, table settings and node settings. Reject removed analyzers/options or
  `soft_deletes.enabled` before 6.0; remove a present `gateway.auto_import_dangling_indices` before 6.4
  through a reviewed config change. No automatic setting resets or global compatibility toggles.
- Export original replica counts, literal `write.wait_for_active_shards`, `translog.durability`, write blocks,
  partition overrides and placement for every table touched by the maintenance policy. Stop if the actual
  policy differs materially from the rehearsed one, including an unexpected blocked/partitioned table.
- Inventory actual users, grants/DENYs, role membership and client identities. Verify current installed
  node-crate/pg and every active Windmill lock/version, not just package manifests. Search-a/b run the
  webapp image. Source locks are **node-crate 3.0.0**, **pg 8.23.1**, **crate-python 2.2.1 and 2.3.0**.
- Gate both page hosts, search-a/b, actual Windmill workers, backup helper, monitoring/Kuma, readonly scripts
  and PostgreSQL-wire administration against each node with their existing credentials. Require correct
  identity/access, wrong/missing passwords refused, local trusted `crate` intact, auth-table DENYs effective,
  and authenticated BLOB GET/HEAD including redirects. Negative PUT/DELETE tests must not target real data.
- Verify the latest installed scheduled backup actually succeeded, the repository is usable and the existing
  restore drill/RTO covers these data. Capture an explicit fresh named pre-upgrade snapshot, independently
  verify SUCCESS, and preserve it outside automatic retention. Separately copy/verify BLOB content by SHA1
  and size. Snapshots exclude BLOB tables. Protect users/roles/password metadata and the auth payload keys
  required to interpret restored data.
- Prepare a disjoint shared 6.x filesystem repository with enough free space and correct ownership on every
  Crate host. If the old repository occupies `/snapshots`, **do not nest the new repository underneath it**.
  Example: host `/mnt/backup-cratedb/snapshots-v6` → container `/snapshots-v6`, with both approved paths in
  `path.repo`. Review these explicit mount/allowlist changes with the image changes; retain all unrelated argv,
  bindings, data volumes, credentials and settings. Prove actual shared-filesystem visibility on all hosts.

Selected SQL for the inventory (explicit columns are required during mixed versions):

```sql
SELECT id,name,version['number'] FROM sys.nodes ORDER BY name;
SELECT health,count(*),sum(missing_shards),sum(underreplicated_shards)
FROM sys.health GROUP BY health;
SELECT state,routing_state,count(*) FROM sys.shards GROUP BY state,routing_state;
SELECT id,description,passed FROM sys.checks WHERE NOT passed;
SELECT node_id,id,description,passed FROM sys.node_checks WHERE NOT passed;
SELECT table_schema,table_name,table_type,closed,version,number_of_replicas,settings
FROM information_schema.tables
WHERE table_schema NOT IN ('sys','information_schema','pg_catalog');
SELECT table_schema,table_name,partition_ident,closed,version,number_of_replicas,settings
FROM information_schema.table_partitions;
SELECT grantee,class,ident,type,state FROM sys.privileges;
SELECT name,superuser FROM sys.users;
SELECT name,type,settings FROM sys.repositories;
```

## Three-copy policy and why ordering matters

Auth tables intentionally use two replicas, REQUEST translog durability and write-wait **1**. Current
YepWatch typed tables use two replicas and write-wait **3**. Preserve auth's wait 1 and REQUEST durability.
`write.wait_for_active_shards` is a **pre-write active-copy check**, not an acknowledgement quorum or a
promise that writes reached that many copies. See the [domain/ADR discussion](../research/crate-6-upgrade-compatibility.md#three-copy-tables-and-the-zero-primary-stop-gate).

The initial lab correctly refused to stop the last 5.10 node while ten primaries remained on it. With
three copies occupying three nodes, there may be no destination slot for its primary relocation.
An attempted early replica reduction followed by restoration also failed to recover GREEN in the mixed
major: newer-primary → older-replica allocation can be refused. Neither failed strategy is the runbook.

The candidate policy preserves the original replica count for the **first two** replacements of each
hop. For tables whose original write-wait is 3 or `all`, temporarily use 2 while a node is absent.
For the **last old-version node only**, after both survivors are upgraded, temporarily reduce the captured
three-copy tables to one replica so the zero-primary drain can place their copies on the upgraded survivors.
Do not apply this reduction indiscriminately to all tables or before the first node.

A lab settings transition exposed validation against the old write-wait when lowering replica count.
For affected three-active-copy tables, block writes briefly, RESET write-wait, SET it to 2, verify the
result on all coordinators, then release the write block. This prevents admitting writes during the RESET's
default-1 interval. The application must present planned maintenance/retry behavior for that brief block;
ordinary non-idempotent requests must not be blindly replayed. Captured originals govern restoration.

```sql
-- Reviewed per-table list only, with writes deliberately gated during this transition:
ALTER TABLE doc.REVIEWED_TABLE SET ("blocks.write"=true);
ALTER TABLE doc.REVIEWED_TABLE RESET ("write.wait_for_active_shards");
ALTER TABLE doc.REVIEWED_TABLE SET ("write.wait_for_active_shards"='2');
-- Verify current setting through every coordinator, then restore original write-block state.
ALTER TABLE doc.REVIEWED_TABLE SET ("blocks.write"=false);
-- Only before the LAST old-version node, where the original replica count is exactly2:
ALTER TABLE doc.REVIEWED_TABLE SET (number_of_replicas=1);
```

Before drain require GREEN at the reviewed temporary policy, with no unexpected missing copy. After rejoin,
restore allocation, settle the current policy, restore original replicas to2 for last-node changes, require
all original copies STARTED/STARTED and GREEN, and **only then** restore original write-wait3/`all`.
Restore literal original values; never reset all settings to defaults. Capture independent readbacks and
require no active unaccounted write block. Unexpected second node loss or failure to regain original
replication stops the run immediately; no next replacement.

## Each node replacement — repeat at all five targets

Freeze schema-changing jobs/initializers while versions are mixed. Keep routine read/write traffic only
within the approved maintenance/admission/RPO policy. Do not KILL member work or snapshots.

1. Check all previous gates and the target's current image/ID. Hold new scheduled backup starts and let
   an existing snapshot/drop finish. Save the exact cron before its bounded hold using the existing safe
   named-file tooling/readback; never `crontab -` as a read command. Record a restoration owner/deadline.
2. Apply the approved table maintenance policy above. Before the last old node, verify both survivors
   have the target version. Require GREEN at that reviewed policy. Set the target Docker restart policy to
   `no` before decommission and verify it. Preserve the captured original policy for its rejoin.
3. Through a surviving trusted-loopback coordinator, preserve `min_availability=PRIMARIES`, `force=false`
   and the existing **2h** graceful timeout; set allocation to `primaries` as in the guarded runbook.
   Issue `ALTER CLUSTER DECOMMISSION 'crate-0N'`. Acknowledgement is not the stop gate. Monitor progress;
   a lost HTTP/SSH response is not permission to repeat a mutating operation blindly.
4. Through a survivor, freshly require **zero primaries on the target**, zero missing primary shards,
   no unresolved target relocation, exclusion still effective and force=false. Re-read immediately before
   stopping; timeout/aborted decommission can restore placement. Stale-route read errors may be retried
   through a survivor; unrelated SQL, permission or health errors stop the run.
5. If the process exited naturally, verify its exit and primary availability. If still running, confirm
   StopSignal unset/SIGTERM/15 and use the current runbook's **host-managed** stop, preserving its wait
   across SSH loss. Use a fresh unique unit name:

   ```bash
   systemd-run --unit="gw-crate6-stop-UNIQUE" --property=Type=exec \
     --property=TimeoutStopSec=infinity --property=SendSIGKILL=no \
     /usr/bin/docker stop --timeout=-1 crate-0N
   ```

   Never shorten grace, set force=true, issue KILL/KILL ALL, use Compose to stop a running target, or
   escalate to SIGKILL. If it has not exited after15 minutes, leave the unlimited wait running and request
   a decision. This review threshold is not a kill timeout.
6. Once stopped, recreate **only that node** from the frozen reviewed configuration with the target digest,
   the same data volume and node identity, the reviewed repository mounts/allowlist and unchanged HBA.
   Do not run an older minor/major image against a directory already opened by a newer version.
7. Require the same node ID, correct new version, all three members, original trusted-local administration,
   correct/wrong/missing credential gates, schema permissions and required BLOB reads. Run real catalog,
   typed-array/object, auth CAS/readback and monitoring queries. Check actual page/search/worker behavior,
   not only `SELECT 1`. Defer snapshots until versions are homogeneous.
8. Restore allocation to the captured baseline, regain GREEN/STARTED, restore original table policy in the
   order above, verify every original copy and setting, and restore the target's original Docker restart policy.
   No next node until this complete gate passes. Preserve authenticated loopback recovery routes on survivors.

The lab used local Docker stop processes; production's SSH-independent systemd wrapper remains mandatory.
Do not generalize a sub-second lab SIGTERM to production shutdown or recovery time.

## Homogeneous-stage backup and repository gates

After the first complete hop to6.0.8, use a new repository **path** before allowing 6.x snapshot writes.
`backup.py` and the flow monitor both hardcode `goodwatch-db-backup-v2`; merely creating a new v3 name
leaves them writing/monitoring the old location. With the backup hold still active and no running repository
mutation, verify the old path is protected, drop only the active **registration**, register the old path
read-only under a protected name, and register the **same active identifier** at the new disjoint6 path.
`DROP REPOSITORY` does not delete its files. Inventory the actual paths before constructing these statements.

```sql
DROP REPOSITORY "goodwatch-db-backup-v2";
CREATE REPOSITORY "goodwatch-pre6" TYPE fs
WITH (location='/REVIEWED_OLD_PATH',readonly=true);
CREATE REPOSITORY "goodwatch-db-backup-v2" TYPE fs
WITH (location='/REVIEWED_DISJOINT_6_PATH');
```

Use the installed credentialed backup helper with its current user/password-file mechanism. Verify an actual
new snapshot independently through every coordinator, plus monitoring of that active identifier and the
separate BLOB backup. Restore the exact held schedule with explicit readback while homogeneous. Hold it
again before the next mixed hop. Do not let old/new clusters concurrently write one repository.
Historical stuck-snapshot fixes are included in6.0.7/6.1.6, hence both selected targets; any stalled operation
is an abort/owner decision, not a reason to KILL it or claim success from an HTTP acknowledgement.

Before **each** next minor, quiesce every repository writer and freeze a protected, version-qualified
copy of the complete pre-hop repository (or use a separate immutable per-stage path), plus its BLOB
manifest and settings/privilege inventory. Independently establish readability/restore on that pre-hop
image before exposing the copy to a newer writer. Preserve it outside routine retention. A named
snapshot in the one evolving6.x repository is insufficient to promise earlier-minor rollback. The
local drill proves the original5.10 recovery point; later-minor rollback copies/readability are an
additional production gate, not a claim established by the forward-restore test.

## Abort and rollback

Abort on missing primaries, unexpected loss of another node, unapproved policy drift, incomplete original
replication, unsafe disk/recovery conditions, table-version/analyzer incompatibility, auth/permission or
client failures, lost required BLOB access, unexpected write outcomes or a failed/unverified backup.
If a fully homogeneous intermediate stage is healthy, stop there and request a decision. Preserve snapshots,
write receipts and the current image/metadata state; do not race back through image downgrades.

Before any newer image has opened data, an unstarted config change can be reverted to the saved5.10
configuration. Once a node has opened6.x data, or a later6.x minor has opened it, **major/minor rollback
is backup-based**, not an in-place image swap. The [planning guide](https://cratedb.com/docs/guide/admin/upgrade/planning.html)
explicitly distinguishes that from limited patch-level downgrades.

Rebuild an isolated cluster on the **pre-hop version** using fresh directories; restore its protected
pre-hop snapshot, matching users/privileges and the separate BLOB backup, preserve HBA and external payload
keys, prove identities/data/digests, then execute a separately approved cutover. Never point it at the newer
cluster's writable repository or reuse upgraded directories. `RESTORE … TABLES` excludes cluster metadata;
`USERMANAGEMENT` restores users/roles/grants and requires operator AL authority. `ALL` also overwrites settings
and metadata; do not use it blindly. The routine backup user must not receive AL just for a restore.

Writes accepted after the rollback snapshot are outside that recovery point. A forward5.10→6.4 restore
proves forward compatibility of the fixture, not reverse snapshot compatibility or zero-loss rollback.
The owner must explicitly accept a bounded RPO or authorize the write freeze/queue/replay needed for it.

## Rehearsal record and production timing

The three-node Docker fixture completed all **15 replacements**, in the documented five-hop order,
with fifteen zero-primary/no-missing-primary receipts and fifteen normal-exit receipts (no OOM/forced kill).
Every node retained its identity. At each homogeneous boundary the original table policy was restored,
all 676 fixture shard copies were STARTED/STARTED, all 108 health rows were GREEN, and a stage snapshot
was verified through the actual `backup.py` SQL path. Final backup create/verify/list/drop also passed.
The fixture includes all 76 pipeline schema tables, 15 auth tables, the current 14 YepWatch typed tables,
synthetic catalog rows and a separately backed-up BLOB. It uses password HBA and restricted fixture roles.

The bounded load completed **11,453 reads and 9,143 writes**, with every acknowledged key/value verified
exactly afterward and zero exhausted logical requests. There were **1,856 transient attempts**, including
planned write-block errors and node-loss/timeouts; the harness retried fixed-key fixture writes and does
not establish safe replay of arbitrary production mutations or an outage-free user experience.
Discovery attempts were stopped at their failed guards. The qualified sequence resumed after first-hop
controller/observer corrections; this was not a single uninterrupted execution of a frozen automation script.
The final runbook records the successful policy, including RESET/write-block sequencing.

An independent clean three-node **6.4.6** cluster restored the protected **5.10.16** snapshot with TABLES
and USERMANAGEMENT. Catalog/auth/typed-room samples, privileges, password behavior and separate BLOB
SHA1 matched; the original repository file hashes remained unchanged. The real auth integration suite
passed **25 tests on the upgraded cluster and 25 on the restored cluster**. Webapp Crate/catalog tests
passed **50**, backup unit tests **38 plus 9 subtests**, and relevant flow tests **38 plus 17 subtests**.
Pinned node-crate/pg and both Python driver versions passed parameterized client canaries; Python bulk
upsert/OCC and actual wrapper fulltext, typed-array and NULL-timestamp queries passed.

The original rehearsal and this preparation's `npx tsc --noEmit` both report **192 existing diagnostics
in unrelated application source**. This preparation changes only node-loss matching and regression tests
in application code. The earlier node-loss gap is patched/tested in the present preparation, awaiting deployment; the BLOB table-grant failure remains.
Production-specific identities/configuration and protected later-minor rollback restores remain unverified.
Both isolated clusters, six containers, two networks, their data/snapshot/BLOB directories and local proxies
were removed after verification; cached images were retained.

See [rehearsal evidence](crate-6-upgrade/20261026-rehearsal/README.md), [structured results](crate-6-upgrade/20261026-rehearsal/results.json)
and the compressed scripts/logs/receipts linked there.

Source/client compatibility details and primary citations are in the linked research note. The lab uses
synthetic data and fresh5.10-created indices. It cannot qualify old production indices, dormant clients,
production kernel/storage behavior, peak traffic or full-volume restore throughput. No claim that6.4.6
fully fixes #644 is made; the earlier isolated disconnect trial retained tasks even on6.4.6.

**Book the twelve-hour window detailed in the production preflight above**, including two hours reserved
for recovery/escalation. The fresh-data lab is not a production benchmark. The60–120min full-volume restore
allowance is an estimate from measured sizes and assumed read rates, not a tested RTO. Stop at a healthy
homogeneous checkpoint if the remaining budget cannot cover the next hop; never compress safety gates.

Execution approval must identify the exact commit/digests, compatibility patch, BLOB scope, temporary copy/
write-admission exception, repository paths and schedule holds, window, RPO and rollback/cutover owner.
Until those approvals and fresh production preflight pass, this document does not authorize execution.
