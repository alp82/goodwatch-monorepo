# CrateDB 6.4.6 rolling upgrade — rebalance and scheduled backup verified

**Latest October28 handover:** all three nodes6.4.6;145GREEN/1175STARTED, copies392/391/392.
Owner's fresh follow-up GO passed the20m12s rebalance observation, including successful placements
of both originally blocked shards onto crate-02 with no new lock errors. Allocation/rebalanceall;
original waits/policies, Docker always, schedules and cron remain restored. The actual04:05 hourly
`hourly_20261028_040501` isSUCCESS567/no failures onallcoordinators, finished2026-10-28T04:05:46.759000+00:00.
[Final follow-up evidence and remaining IMDb-query uncertainty](auth/cratedb-production/20261026-operation-contexts/20261028-rebalance-verification/README.md).
No maintenance is armed. No new node replacement or in-place downgrade is authorized.

## Historical first-stop handover


**October28 handover:** all three nodes are **6.4.6**, 145 GREEN / 1,175 STARTED. All14 remaining
replacements completed, but the final homogeneous observation stopped at its first failed gate:
03:02:16UTC, a health query returned HTTP500, coincident with search-pool exhaustion and failed jobs.
The failure was not cleared or retried. All original table policies (including YepWatch wait3),
Docker always, allocation all, nine schedule configurations/states and byte-exact backupcron were
restored. **Rebalance remains none; the final crate-02 placement/lock test is unproven.** Final6.4.6
snapshot is SUCCESS; next hourly04:05UTC is pending. No further action is armed.

See the [stopped-run evidence and required next decision](auth/cratedb-production/20261026-operation-contexts/20261028-rolling-execution/README.md).
Read-only diagnosis of the search-pool rejection burst is recommended before a separately approved
rebalance observation. Do not replay the completed replacement matrix or downgrade a data directory.

## Historical approved execution procedure

The following records the instructions used for this execution; it is not a fresh authorization.


**Latest owner override, October28:** resume immediately after an explicit GO and fresh gates,
then continue hop after hop until6.4.6 is complete. **The04:00UTC limit is removed.** No clock-based
hop admission/stop deadline remains; every health/heap/watcher gate and first-failure rule remains.
Daytime traffic rises around06:00UTC; expect more noise but **do not change abort thresholds**.
The prior23:00–04:00 plan is historical, not a second automatic start.

Existing provider_detector shadow job`01a17fb1-feb6-c0d2-651f-9ab682b96648` may finish. Other active heavy
jobs are also allowed and recorded **except schema-changing or index-publishing work** (build_indexes,
migrations), which still stops entry. Pause future starts of exactly the same nine approved schedules.
This waiver does not permit cancellation, schema/publication overlap or extra holds; deploys follow the bounded wait rule below.

**Current deploy rule:** if a deployment is building/rolling at any gate, wait for it to finish,
up to15minutes, keeping the watcher/heap guard active. If it fails or remains active after15minutes,
stop. After it finishes successfully, recheck GREEN and a fresh watcher round, then the normal node
gates. Do not stop merely because the initial read found a deployment. The owner will not push main
until completion; no Coolify setting change is needed or authorized. No concurrent node swap/deploy.

[Execution evidence](auth/cratedb-production/20261026-operation-contexts/20261028-rolling-execution/README.md).
A first failed health/heap/site or overdue/failed-deploy gate still ends progression underQ62.

Entry handover before this execution: **crate-02 was already6.0.8; crate-01/03 remained5.10.16**, all145 GREEN.
[Q64 execution](auth/cratedb-production/20261026-operation-contexts/q64-execution.md) stopped after the
first node; [Q65 read-only diagnosis](auth/cratedb-production/20261026-operation-contexts/q65-findings.md)
qualified the expected future-major check and identified stale6.0 relation metadata. Read all gates fresh;
this recorded handover is not a substitute for current versions/copies/heap/backup health.

The separately approved [backup repair](auth/cratedb-production/20261026-operation-contexts/20261028-backup-repair.md) restored the cluster-wide writer name **goodwatch-db-backup-v2**
at **/snapshots/q65-mixed-20261027**. Keep that working registration/path throughout this campaign;
**never repeat the stage that removed V2**. The original **goodwatch-pre6** registration at
**/snapshots/v2** stays read-only and untouched. The legacy root alias is absent; never re-register
/snapshots as a parent repository while its child writer is active. The actual scheduledOctober28 00:05
hourly anddaily run was verifiedSUCCESS567/no failures onall coordinators; cron remains active until the
next maintenanceGO/hold. First full hourly took8m18s; the immediately following incremental daily11.810s.

The approved route remains **no decommission, no drain, no zero-primary gate, no replica removal,
no KILL/SIGKILL, no in-place downgrade**. All prior Q55/Q58–Q63 safeguards still apply, with the
bounded check3 qualification below. Nothing starts before the next explicit GO.

Use the [new plain-stop rehearsal](crate-6-upgrade/20261027-plain-rehearsal/README.md),
[tagged-source check](../research/crate-q53-plain-rolling-source-check.md),
[43-release compatibility audit](../research/crate-6-upgrade-compatibility.md), and
[archived production preflight](crate-6-upgrade/20261026-preflight/README.md).
The October27 [Q50 restart](auth/cratedb-production/20261026-operation-contexts/q50-execution.md) returned GREEN
in about 3 minutes, but one discover200 taking4.376s triggered its old abort rule. **Q60 supersedes that
single-event rule tonight**; see the watcher section below.
Historical GREEN or a completed restart does not establish current allocation/heap/backup/lock health.

## Path, images and node order

Finish hop1 on **crate-03 → crate-01**, skipping the already-upgraded crate-02; then complete each later
row on **crate-02 → crate-03 → crate-01**, one node at a time. There are **14 remaining replacements**,
not15. Never stop crate-02 again for6.0.8. Re-read placement/master state;
02-first is a canary preference (historically fewest primaries), not a way around version compatibility.
The order is the one qualified locally. Any order change requires review, not a silent in-flight experiment.

| Hop | Starting state / remaining nodes | Target image |
| --- | --- | --- |
| Baseline/restore only | 5.10.16 | `crate:5.10.16@sha256:5d7cd92eb84d56d538e2222a436e432164b853fdf186aebb17c446787f23a307` |
| 1, resume | 02 already6.0.8; upgrade03 then01 from5.10.16 | `crate:6.0.8@sha256:7b6af0abb4792123cfa225c8186471bbe81e039ef336af33095a181f4e8c17bf` |
| 2 | 6.0.8 | `crate:6.1.6@sha256:c59adf651f296ce372018ae7d82167beb6ab469052e67cccdbfc57db19f69e46` |
| 3 | 6.1.6 | `crate:6.2.11@sha256:696200f834ce187423ba40e4e83514747daad8ce37b28aeabec8f4b0949183b9` |
| 4 | 6.2.11 | `crate:6.3.7@sha256:af6b41db307460e8189b6e84dfdc4b673ba36996c5a912cb3d776bcdfafe7f02` |
| 5 | 6.3.7 | `crate:6.4.6@sha256:8d3e8778378236192724776877d2ea4546d5b5586362c8d174e6aa46177bb0fb` |

These are cached/rehearsed manifest digests, not inferred tags. Pull/inspect each exact reference on each
production host after go; record its actual image ID/architecture. Never use `latest`. Targets require,
respectively, predecessors >=5.10.1/6.0.2/6.1.2/6.2.0/6.3.0; no direct rolling5.10→6.4 jump.
[Official rolling requirements](https://cratedb.com/docs/guide/admin/upgrade/rolling.html#version-requirements),
[release-specific citations](../research/crate-q53-plain-rolling-source-check.md#version-path).

The official rolling guide recommends decommission; Q53 is the owner's separately rehearsed **plain TERM**
variation. TERM does not drain. Preserve all existing copies: `NodeVersionAllocationDecider` forbids **new
replica recovery** from a newer primary to an older major/minor node. Existing STARTED older replicas may
remain. Highest-version active replicas are preferred for promotion, so an upgraded primary can coexist
with an existing older replica. An unexpected loss of that older copy may leave YELLOW until it is
upgraded. Never remove copies to work around this. See [tagged source and promotion rules](../research/crate-q53-plain-rolling-source-check.md#why-preserving-existing-copies-matters-with-plain-stops).

## Mixed 6.0/6.1 BLOB qualification — approved cross-check

The145-table lab exposed behavior the earlier drain rehearsal missed: with6.0.8 and6.1.6 mixed,
newer coordinators omit remote older-node BLOB rows from `sys.shards`, and `SELECT digest FROM
blob.search_index_files` can fail `RelationUnknown`. All coordinators still report145GREEN and1175
STARTED `sys.allocations`; collecting each node's own shard rows directly gives the full1175 copies,
including6BLOBcopies. Authenticated BLOB HTTP GET/HEAD and SHA1 content work through all 3nodes.
[Source and mechanism](../research/crate-q53-plain-rolling-source-check.md).

**Do not waive an unexplained missing copy.** Only for this qualified6.0/6.1 mixture, the approved gate
requires full STARTED allocation counts/identities on all coordinators plus the union of directown-node
`sys.shards` rows, every copySTARTED/STARTED and correctBLOB HTTP/SHA1. Non-BLOBrows must still agree;
no missing allocation, failedHTTP, unexpectedversion or anyother tableerror is covered. Afterhomogeneous
6.1 require full BLOB SQL/inventory agreement again. **The owner approved this bounded cross-check and
its documented holds.** No unexplained failure or incomplete physical copy is waived.

Hold `f/search/build_indexes` (including itscleanup) through the campaign: itsline444 executes that
BLOB SQL. Webapp/search index download uses HTTP (`search-index-build.server.ts:139`). Hold schema and
index publication jobs as approved; catalog/member reads/writes retain the normalwatcher gates.

## Window and forecast

**The latest owner override removes the04:00 cutoff and the earlier next-night start.** After a fresh
GO, run the approved remaining14 replacements/hops until6.4.6, stopping at the first failed gate.
Do not insert a time-based stop at04:00 or waive a failed gate in order to finish. Start the watcher,
queue/schedule checks and10-minute heap history fresh; first remaining03 requires10min, then01 needs2min.
Later complete hops retain10/2/2. Overlap preparation/recovery/checkpoint work with qualifying heap
history where the approved gates allow it; no extra arbitrary waits. Continue measuring each hop for
staffing and safe recovery, not a removed deadline. At06:00 traffic may rise; Q60/Q59 thresholds stayfixed.

| Work | Production allowance |
| --- | --- |
| Initial 10 min gates/watcher, image pulls, preserved rollback verification + current forward SQL/BLOB/config checkpoint | 20–30 min after go; allow longer if backup not settled |
| Each node: preparation/readbacks and replacement | 1–2 min |
| Each node: stop → rejoin → original replication GREEN | Budget3–6min plus margin; Q64 first6.0 node took5m55s from dispatch to verifiedGREEN; heavier nodes may be slower |
| Before every node: all-coordinator heap history, GREEN/policy/client checks | **Q63: <80% for 10 min before the first node of each hop; 2 min before its second and third nodes**. Sample every 30s; a new JVM needs its own history |
| Each complete hop: version/access/BLOB/backup canaries | 5 min additional |
| Forward/stage snapshots in the existing V2 writer | Incremental in the same repository; budget5–15min per checkpoint until measured. Do not create another full repository or repoint V2 |
| Final waits/restart/policy/cron restoration and observation | 25–40 min including Q43 final rebalance observation; hand over explicitly if a failed gate prevents it |

Q63 supersedes Q59's ten-minute gate before every node: each hop uses **10/2/2-minute** pre-node heap
histories, below 80% on every cluster member. Preparation/recovery and fresh heap history may overlap
when readings qualify; GREEN and original copies are independently required before progression.
With the preserved rollback pair, current forward checkpoint, remaining14 node swaps, hop checks and final restoration, plan roughly
**3–5 hours**, subject to measured production recovery. This is not a guarantee all five hops fit.
Before each hop, budget every remaining node, its gates, snapshot/checkpoint, recovery margin and exact
schedule/cron/settings restoration. No04:00 limit now applies. Preserve staffing and recovery capacity while continuing; the first failed
gate still stops progression even mid-hop. Do not force homogeneity after a failed gate.

The morning Q50 plain restart returnedGREEN in about3min; Q64 first6.0 upgrade took5m55s from dispatch
to verifiedGREEN (normalexit5.4s, then125.6s operator verification before newstart). Budget the full
measured procedure and gates, not just JVM shutdown. The local fixture does not
predict production transfer throughput. Recovery can reuse segments, but the prior38.18GiB primary /
75.17GiB across copies and40MiB/s recovery rate remain capacity considerations. No primary drain is budgeted.

## Entry gates and gates before every node/hop

Use all three coordinators while up, both survivors while down. Explicit columns in mixed versions.
**Q63: every cluster member must have fresh used/max heap readings below 80% for 10 min before the first
node of each hop, and 2 min before that hop's second and third nodes.**
Sample every 30s and retain timestamped history through recovery; a new JVM cannot inherit its predecessor's
history. Require GREEN and all original copies before progression as well. An entry/pre-node gate that
fails ends progression under Q62; do not keep retrying a failed gate or reset its history silently.

- Three expected persistent IDs; only the row's source/target versions, then homogeneous target before
  next hop. At resumed entry02 must be6.0.8 and01/03 must be5.10.16. Stop on a different starting matrix. Archived IDs:01 `xlclgwGeSHe18p5J4WvfFA`,02 `r0IgCe17SPOgudkQIGsRQA`,
  03 `ch8EXZwrQVmCls79_T_vUg`; stop on unexplained identity/config change.
- **145 GREEN**, zero missing/underreplicated copies, all copies STARTED/STARTED; no RELOCATING primary,
  no RELOCATING/INITIALIZING/RECOVERING copy before the next stop. Do not advance on GREEN alone while
  local recovery states differ. Current lock/relocation state must be checked fresh; do not reuse Q50.
- During the qualified6.0/6.1 mixture only, apply the BLOB cross-check above; require all physical copies
  via `sys.allocations` and each node's localshardrows rather than identical clusterwideBLOB stat rows.
- Every primary on the node to stop has a STARTED survivor copy; two survivors provide cluster quorum.
  No failed cluster/node checks **except the exact qualified check3 advisory below**; no unexpected exclusion/write block or active decommission.
- **Q63 heap gate: <80% on every node for 10 min before the first node of each hop, 2 min before its second/third nodes.** Any reading not
  below 80% fails that pre-node gate. **Stop immediately if heap is above 85%**; the old two-minute allowance
  is removed. OOM, repeated GC stalls or breaker pressure also stop progression. Loads5/15 must stay below
  available processors (historically16), with sane disk/recovery queues. No forced GC, heap or recovery-rate changes.
- Latest hourly snapshot SUCCESS/no failures and **none IN_PROGRESS**, no DROP/RESTORE SNAPSHOT or active
  backup helper, no deploy or unrelated maintenance. Wait for an active snapshot; never stop mid-snapshot.
  Require protected baseline before first node and independently verified cron hold before every node.
- All145 tables/partitions inventoried: creation versions5.x+, no closed/unknown old indexes, exact replica
  strings, waits, blocks, REQUEST durability. Baseline had30 replicas`2`,106 literal`0-1`,9 literal`1` and
  no partitions. Any drift requires review, not a wildcard repair. All required clients/compatibility fixes
  deployed and exact versions/configuration recorded; no password/HBA change. #562 negative-auth canaries
  and trusted loopback administration must pass. No production synthetic test writes are implied.
- No concurrent deploy/node swap. Use the bounded15-minute deployment-wait gate above; after completion recheckGREEN/watcher before proceeding. Owner-approved schema/SWAP/RENAME and index-publication hold prevents
  snapshot/BLOB pairing races; no schedule mutation beyond the approved list. Light member/workflow writes
  may continue under the selected RPO/write policy. If workload breaks heap/site gates, stop and report.
- Same volume/data path, image digest, HBA/startup arguments, heap, network/publication addresses, mount
  sources, StopSignal unset/SIGTERM/15 and restart policy captured privately. Do not print `.env` or full
  Docker/Compose configuration into evidence. Maintain a second SSH session and staffed observer. Check
  Coolify deploy status at the start, in parallel with workload/heap reads, before pausing schedules.
  The owner will not push main during the upgrade; no Coolify setting change is needed. Repository policy
  reserves Coolify settings to the owner UI; use read-only status inspection and never cancel a deploy or
  disable auto-deploy through SQL/API.

Representative reads, repeated through each coordinator:

```sql
SELECT id,name,version['number'],heap,load,os_info['available_processors'] FROM sys.nodes ORDER BY name;
SELECT health,count(*),sum(missing_shards),sum(underreplicated_shards) FROM sys.health GROUP BY health;
SELECT schema_name,table_name,partition_ident,id,node['name'],primary,state,routing_state,relocating_node
FROM sys.shards WHERE state<>'STARTED' OR routing_state<>'STARTED';
SELECT schema_name,table_name,partition_ident,id,node['name'],primary,state,routing_state FROM sys.shards;
SELECT table_schema,table_name,shard_id,node_id,primary,current_state FROM sys.allocations;
-- Also query sys.shards directly on each node with WHERE node['name']='crate-0N'; union those local copies.
SELECT settings['cluster']['routing']['allocation']['enable'],
       settings['cluster']['routing']['rebalance']['enable'],settings['cluster']['graceful_stop'],
       settings['cluster']['routing']['allocation']['exclude'] FROM sys.cluster;
SELECT repository,name,state,started,finished,total_shards,failures FROM sys.snapshots ORDER BY started DESC LIMIT 8;
SELECT repository,name,state FROM sys.snapshots WHERE state='IN_PROGRESS';
SELECT table_schema,table_name,number_of_shards,number_of_replicas,
       settings['write']['wait_for_active_shards'],settings['translog']['durability'],settings['blocks']
FROM information_schema.tables WHERE table_schema NOT IN ('sys','information_schema','pg_catalog')
ORDER BY table_schema,table_name;
SELECT table_schema,table_name,partition_ident,number_of_replicas,settings FROM information_schema.table_partitions;
SELECT id,severity,passed,description FROM sys.checks WHERE NOT passed;
SELECT node_id,id,passed,description FROM sys.node_checks WHERE NOT passed;
```

Read job history again at the end for **every** failed Windmill root/step between gates and completion;
include failures of jobs started before gates. Record name/ID/error/completion time, do not rerun them.

## Expected check3 and first-hop metadata readbacks

The owner approved accepting **only sys.checks id3/severity1 on6.x**, with its exact future-major
recreation warning, when the actual listed index creation versions are verified5.x-compatible.
[Exact6.0.8 source and production quote](auth/cratedb-production/20261026-operation-contexts/q65-upstream.md#check-3-is-expected-for-5x-indices-on-6x).
Tagged sources6.0.8/6.1.6/6.2.11/6.3.7/6.4.6 were rechecked: all retainID3,LOW severity and the same
creation-major comparison ([final-target implementation](https://github.com/crate/crate/blob/6.4.6/server/src/main/java/io/crate/expression/reference/sys/check/cluster/TablesNeedUpgradeSysCheck.java)).
It is the expected advisory to recreate unchanged5.x tables before7.x, not an unreadable-table finding
on6.x. Keep every other check/node-check and health gate. Reject4.x-created/unknown indexes, a different
warning/severity/ID, unexplained table list or any other failed check. Re-inventory actual creation versions
before every hop; do not blindly assert count(sys.checks WHERE NOT passed)=0 on6.x.

Q65 proved term1419/state1144863 agreed across all nodes while the14 legacy index wait settings were3,
but the6.0 relation representation remained2. **Normal SQL writes enforce the index setting**, not this
stale catalog value. The existing14-table discrepancy is bounded; no other policy/schema drift is waived.
Before the first remaining node, capture fresh stable private `_state` copies and locally decode the
selected settings with [the read-only decoder](auth/cratedb-production/20261026-operation-contexts/q65-state-decoder/DecodeMetadata.java);
compare accepted versions with live`sys.nodes.cluster_state_version`. Never publish raw global metadata.
At entry require legacy wait3/replicas2/blocksfalse onall nodes; only the known6.0 relation wait2 is expected.

Lower waits to2 once using the existing per-table block/RESET/SET/unblock sequence. While the master is
5.10, use index metadata and5.10 coordinator readbacks for authoritative wait/block verification:6.0's
relation/block display can remain stale even after acknowledged index changes. Compare index UUIDs and
legacy settings across nodes; no synthetic writes or repeated ALTERs just to refresh a display. Before
any node stop all legacy/index settings must bewait2 and all blocksfalse. The old6.0 relation's2 must
agree with the maintenance wait; other discrepancy is a failed gate. At homogeneous6.0 require catalog
and index settings to agree at maintenance wait2 before admitting6.1. If they do not, stop/report; no
unapproved cache reset, metadata repair or extra restart. Restorewait3 behind blocks only with all original
copiesGREEN; use authoritative index checks on an early mixed-stop handover and report a stale catalog
explicitly. At normal homogeneous completion require both representations to agree at3.

## Operator routes and watcher

Set `TMPDIR=$HOME/.cache/gw-work/644-q65-20261028-execution`; scratch/private originals there, never/tmp.
Use the existing [watcher](auth/cratedb-production/20261026-operation-contexts/q40-page-watch.py) with
**`--policy q60`** every10s from gates through restoration/observation, with5s request timeout.
Q60 aborts on **three consecutive unexpected-status/transport failures for the same endpoint**, or
**three responses over 3s across the probes within a rolling 60-second window**. Healthy responses reset
only that endpoint's failure streak; fast responses do not erase recent slow responses. A single slow or
failed probe is logged, not an abort. The three page URLs and discovery expect200; unauthenticated
`/mcp` expects401, which remains healthy. This expected401 is not counted as a non-200 page failure.

The helper's default remains historical Q43; omitting `--policy q60` is not tonight's approved command.
Q60 alarms remain sticky. Monitor failure/stale heartbeat still stops progression: heartbeat<=15s,
controller checks<=5s **during cleanup as well as progression**. Do not discard an alarm or reinterpret thresholds during execution.
Only use supported phases`baseline`, `pre_stop`, `stopping`, `recovery`, `rebalancing`, `complete`.
Use`recovery` for handover cleanup; **never write an invented phase such as handover-restoration**.
Q64 lost monitoring because of that operator error. Validate phase values before writing them, inspect
heartbeat/alarm/process continuously, and record any coverage gap honestly. A monitor failure stops
progression; recovering monitoring for already-required safe cleanup never authorizes another node.

```bash
mkdir -p "$TMPDIR"
printf '%s' baseline > "$TMPDIR/phase"
python3 docs/implementation/auth/cratedb-production/20261026-operation-contexts/q40-page-watch.py --policy q60 \
  --phase-file "$TMPDIR/phase" --abort-file "$TMPDIR/abort" \
  --heartbeat "$TMPDIR/heartbeat" --stop-file "$TMPDIR/stop-watcher" > "$TMPDIR/pages.jsonl" 2>&1
# Own terminal/session; keep it running, inspect marker/heartbeat throughout.
```

SQL via trusted loopback on a **survivor**, statement on stdin; substitute11/crate-01 with13/crate-03
when needed. Check SSH/curl exit **and** JSON error/acknowledgement; ambiguous replies require readback,
never blind replay.

```bash
crate_sql() {
  python3 -c 'import json,sys; print(json.dumps({"stmt":sys.stdin.read()}))' |
    ssh -o BatchMode=yes root@10.0.0.11 docker exec -i crate-01 \
      curl --silent --show-error --fail-with-body --max-time 120 \
      -H Content-Type:application/json --data-binary @- http://127.0.0.1:4200/_sql
}
# Separate long-snapshot route: same recipe with --max-time 1800.
```

## Before the first node: protected rollback point and temporary waits

1. After all initial gates, hold only the named backup cron with **the exact Q37 helper** from
   `auth/cratedb-production/20261026-operation-contexts/q37-receipts.json.gz`, `files["cron-hold.py"]`:
   `ssh -o BatchMode=yes root@10.0.0.11 python3 - hold < "$TMPDIR/cron-hold.py"`.
   Save its returned state path/original/held hashes privately. Never `crontab -`. Verify no helper or
   snapshot remains active. Keep the cron held throughout all five hops; no retention writer may run.
2. Hold the approved nine publication/schema schedules and save their current complete configurations.
   **Preserve the original5.10 rollback point, do not recreate or replace it:**
   `goodwatch-pre6.q53_pre6_20261027` finishedOctober27 23:02:34.012UTC, with the verified SHA1 pair
   `/mnt/backup-cratedb/q53-pre6-20261027/blob` and private original config backups. Read back SUCCESS,
   readonly=true/compress=true/location=/snapshots/v2 through all coordinators. Verify its archived BLOB
   manifest/references remain intact; no writes, retention or repository verification canaries in that path.
   **A new mixed snapshot cannot refresh the5.10 rollback RPO.** Q61's loss window still begins at this
   originalOctober27 snapshot, including all intervening writes. Calculate and record the actual elapsed
   loss window for this immediate run; the earlier next-night/day-long estimate no longer applies.

   With cron held, no active backup and all nodesGREEN, take a **fresh forward-recovery checkpoint in
   the existing working V2 repository** before the first remaining node; choose a name not already present:

   ```sql
   CREATE SNAPSHOT "goodwatch-db-backup-v2".q65_pre_resume_20261028 ALL
   WITH (wait_for_completion=true);
   ```

   Require SUCCESS/no failures onall coordinators. This explicitly permitted pre-resume mixed checkpoint
   is a6.x-forward recovery candidate, not a5.10 restore guarantee. Later stage snapshots are taken only
   at homogeneous checkpoints. Pair the current checkpoint with current frozen search metadata and a
   separate SHA1 copy/config archive, never by adding/replacing files in the original5.10 rollback folder:

   ```bash
   # Only after the next GO, with publication held. Repeat for each real node/host.
   ssh root@10.0.0.11 python3 - crate-01 /mnt/backup-cratedb/q65-resume-20261028/blob \
     < docs/implementation/crate-6-upgrade/20261028-rolling-resume/copy-forward-blob-sha1.py
   ```

   Copy/verify the union from11/12/13, every SHA1/length and every frozen reference; keep current config
   backups separate from pre6 originals. No per-minor full repository copies. Stop if either the original
   rollback pair or current forward checkpoint/reference pairing cannot be verified.
3. **Keep V2 registered and writable throughout every hop and any early-stop handover.** At entry and
   before/after each node/checkpoint, read`sys.repositories` throughall coordinators. Require:

   - `goodwatch-db-backup-v2`:fs,location`/snapshots/q65-mixed-20261027`,compress=true,readonly=false.
   - `goodwatch-pre6`:fs,location`/snapshots/v2`,compress=true,readonly=true.
   - No legacy root registration at`/snapshots`; no overlapping writer alias.

   **No DROP REPOSITORY or writer-path transition is part of this upgrade.** In particular do not repeat
   Q64's removal of V2 and do not create V2 again at`/snapshots-v6`. The repaired sibling path is already
   mounted/allowed onall nodes. Preserve the old files and rollback alias untouched. A missing/non-writable
   writer, unexpected path/options or repository failure is a failed gate: stop/report, no automatic
   unregister/re-register, permissions change or fallback to a protected path.
4. Apply the exact14 YepWatch waits3→2 **once**, keeping2 across the entire campaign. All30 three-copy
   tables retain replicas2. Auth + user_mcp_action retainwait 1 and REQUEST; no other wait change was needed.
   Use [q40-yepwatch-lower.sql](auth/cratedb-production/20261026-operation-contexts/q40-yepwatch-lower.sql),
   56 statements, **no number_of_replicas statement**. Each table: blockwrite, RESETwait, SET2, verify authoritative index values while blocked as qualified above, then restore its original false block.
   Before a stop verifywait2/blocksfalse onall nodes and the known relation view; do not trust a stale catalog alone. Do not stream the file unattended.
   Names:agreement,candidate,command_receipt,control,decision,invitation,member_grant,member_intent,participant,
   proposal,room,runtime,ticket,vote, all with `doc.yepwatch_`. This is weaker admission while maintenance
   runs, not a write-acknowledgement quorum. Restore3 only with all three original copies STARTED.
5. Capture allocation/rebalance on every readback. Keep **rebalance `none`** throughout rolling replacements;
   allocation alternatesprimaries/all below. No recovery-rate, exclusion, graceful-stop or replica change.

## Each of fourteen remaining replacements: exact host procedure

Execute this template manually for each of the [14 remaining node/hop rows](crate-6-upgrade/20261028-rolling-resume/node-matrix.json):
03→01 for6.0.8, then02→03→01 per later hop. The original15-row rehearsal is historical, not a replay list.
Each row records the host, node, unique stop unit and full target image. Select only one row at a time. **No loop automatically
starts the next node.** Production project directory is `/root/goodwatch/goodwatch-monorepo/goodwatch-crate`,
Compose project`goodwatch-crate`, service`cratedb`; verify those against Docker's existing Compose labels.
If path/labels/runtime differ, stop. Hosts01/02/03 are10.0.0.11/.12/.13.

1. Pass fresh gates and reserve enough time. Pin/pull this node's exact target image. Save root-private
   `.env`, Compose files/runtime hashes and original policy. Save exact`Config.Cmd` privately for
   the replacement code below. Verify the existing shared`/snapshots` mount and repaired writer path. Preserve
   each node's existing mounts/allowlist exactly:02 already has`/snapshots-v6`,01/03 need no new mount or
   allowlist for the repaired writer. Do not add an unused repository or change the writer path. The old
   root registration was removed by the separately approved repair; do not recreate it around the child writer.
2. On target host, `docker update --restart=no crate-0N`. Through survivor:

   ```sql
   SET GLOBAL TRANSIENT "cluster.routing.allocation.enable" = 'primaries';
   ```

   Read back primaries/none on all coordinators; require a complete live watcher round **started after**
   changes, a fresh heartbeat and no Q60 alarm, plus unchanged image/config/PID and valid StopSignal.
   A single logged slow or unexpected response does not independently fail this watcher gate. Recheck GREEN, no snapshot, placement and alarm immediately
   before dispatch. **No decommission or zero-primary check.** Only after the fresh approved gates pass (the old clock cutoff is removed):

   ```bash
   # On the host of the selected node-matrix row; example first row:
   Q53_NODE=crate-03
   Q53_UNIT=gw-q65-20261028-608-03
   systemd-run --unit="$Q53_UNIT" --property=Type=exec \
     --property=TimeoutStopSec=infinity --property=SendSIGKILL=no \
     /usr/bin/docker stop --timeout=-1 "$Q53_NODE"
   ```

   Capture live`systemctl show "$Q53_UNIT" --property=LoadState,ActiveState,MainPID,TimeoutStopUSec,SendSIGKILL`
   immediately after dispatch, before the short-lived unit can be garbage-collected. A laternot-found unit
   exposes generic defaults, not proof of the dispatched grace; retain literal dispatch/journal receipts.
   Watch unit and Docker State independently. After15 min still stopping: report, leave unlimited wait
   intact and two survivors staffed. Never kill the unit/docker/JVM or dispatch a second stop.
3. Only after confirmed exit, PID0/no OOM/normal exit0 or143, recreate **that stopped service only** on the
   same named data volume. Durable Compose override (JSON is valid YAML) example for the next hop1 node03 below;
   replaceimage using the table for every later hop. Preserve the complete originalcommand/HBA arguments,
   keeping its current path.repo and mounts; use the verified host substitutions from the
   existing effectivecommand, not a copied command with another host's address. Store the reviewed full
   command vector privately in`q53-command.json` (sanitized hash in evidence).

   ```bash
   cd /root/goodwatch/goodwatch-monorepo/goodwatch-crate
   # Q53_HOST_IMAGE is selected from the pinned table, e.g. remaining hop1 node03:
   Q53_HOST_IMAGE='crate:6.0.8@sha256:7b6af0abb4792123cfa225c8186471bbe81e039ef336af33095a181f4e8c17bf'
   export Q53_HOST_IMAGE
   export NODE_NAME=crate-03  # For this row/host only; substitute the selected matrix node.
   python3 - <<'PY'
   import json,os,pathlib
   # Capture Config.Cmd privately before the first recreation; verify existing project/labels first.
   import subprocess,re,shutil,tempfile
   private=pathlib.Path('/root/.config/goodwatch/q65-20261028');private.mkdir(parents=True,exist_ok=True,mode=0o700)
   name=os.environ['NODE_NAME']  # Already-defined host .env value must also match inspected container.
   assert name in ('crate-01','crate-02','crate-03')
   item=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
   assert not item['State']['Running'] and item['State']['Pid']==0
   cmd=item['Config']['Cmd']
   saved=private/'q53-command.json'
   if not saved.exists():saved.write_text(json.dumps(cmd));saved.chmod(0o600)
   assert any(x.startswith('-Cauth.host_based.enabled=') for x in cmd)
   assert '-Cauth.host_based.enabled=true' in cmd
   assert sum(x.startswith('-Cpath.repo=') for x in cmd)==1
   # Existing base Compose preserves /data and /snapshots. Retain any already-present extra repo mount.
   extra=[m for m in item['Mounts'] if m['Destination']=='/snapshots-v6']
   assert all(m['Type']=='bind' and m['Source']=='/mnt/backup-cratedb/snapshots-v6' and m['RW'] for m in extra)
   service={'image':os.environ['Q53_HOST_IMAGE'],'restart':'no','command':cmd}
   if extra:service['volumes']=['/mnt/backup-cratedb/snapshots-v6:/snapshots-v6']
   override={'services':{'cratedb':service}}
   p=pathlib.Path('docker-compose.q53.yml');p.write_text(json.dumps(override,indent=2)+'\n');p.chmod(0o600)
   env=pathlib.Path('.env');original=env.read_bytes()
   backup=private/('env-before-'+os.environ['Q53_HOST_IMAGE'].split('@')[0].replace(':','-'))
   assert not backup.exists(), 'Ambiguous repeat: inspect prior acknowledgement/state'
   backup.write_bytes(original);backup.chmod(0o600)
   values={'CRATE_VERSION':os.environ['Q53_HOST_IMAGE'].removeprefix('crate:'),
           'COMPOSE_FILE':'docker-compose.yml:docker-compose.q53.yml'}
   lines=original.splitlines(keepends=True)
   for key,value in values.items():
    matches=[i for i,line in enumerate(lines) if re.match(rb'^(?:export )?'+key.encode()+rb'=',line)]
    assert len(matches)<=1, 'Duplicate env key'
    if key=='COMPOSE_FILE' and matches:
     prior=lines[matches[0]].split(b'=',1)[1].strip().strip(b"\"'")
     assert prior==value.encode(), 'Preserve/review pre-existing Compose file set'
    replacement=(key+'='+value+'\n').encode()
    if matches:lines[matches[0]]=replacement
    else:
     if lines and not lines[-1].endswith(b'\n'):lines[-1]+=b'\n'
     lines.append(replacement)
   fd,tmp=tempfile.mkstemp(prefix='.q53-env-',dir='.')
   with os.fdopen(fd,'wb') as f:f.write(b''.join(lines));f.flush();os.fsync(f.fileno())
   os.chmod(tmp,0o600);os.replace(tmp,env)
   PY
   docker compose --env-file .env -p goodwatch-crate -f docker-compose.yml -f docker-compose.q53.yml \
     up --no-start --no-deps --force-recreate cratedb
   # Inspect STOPPED replacement: correct image ID; same data-volume source and all existing mounts;
   # same env/heap/network/HBA/command/mounts; restart no. Stop on drift.
   docker start crate-03
   ```

   For each later matrix row change only the selected host/node and pinnedimage; no completed row is replayed. Never useCompose to stop a running target, never
   `down -v`, never reinitialize a missing volume. New container ID is expected; persistent node ID is not.
   Preserve the override **durably** and add/verify `COMPOSE_FILE=docker-compose.yml:docker-compose.q53.yml`
   in the host-private `.env`, as the checked byte-preserving code above does; CRATE_VERSION also holds
   the matchingversion@digest. No broadsed/source/echo of secrets.
   Future deployments must retain override/mount/path.repo and final image pins. Explicit`-f` commands must
   include both files. If existingCOMPOSE_FILE is different, merge its full file set deliberately or stop.
   Never restore the old image/`.env`/override against upgraded data; those private backups are for fresh-
   directory restore planning, not in-place rollback. Backupcron restoration is independentlybyte-for-byte.
4. Wait for same persistent node ID, expected new version and3members **as observed both directly on the
   new node and through survivors**, new PID/starttime, no OOM/lock errors. Then:

   ```sql
   SET GLOBAL TRANSIENT "cluster.routing.allocation.enable" = 'all';
   ```

   Readall/none everywhere; wait for all 145 GREEN and all original copies STARTED/STARTED on all
   coordinators. Poll, don't treat the first coordinator's GREEN as simultaneous agreement. Verify exact
   replica strings and14wait 2/otherwaitsoriginal, no blocks, REQUEST, expected user/privileges, catalog/auth/
   YepWatch/search reads, password/missing/wrong-auth behavior and BLOB GET/HEAD. Never send fake production
   writes as a canary. Require the Q63 <80% heap history before the next node: 2 min if within this hop, 10 min if it is the
   first node of the next hop. GREEN/site/copy gates remain unchanged.
   Stop at the first failed gate or Q60 alarm; no next node after it.
5. Restore target `docker update --restart=always crate-0N`; change onlyoverride.restart to`always` privately
   so future Compose recreation preserves it too. Recordall/none on all settings readbacks. Save timing,
   placement/version matrix, exit/rejoin/runtime hashes, logs and watcher receipts before the next node.

## Homogeneous checkpoints, BLOB grant and final restoration

After the resumed two-node row, and each later three-node row, confirm all at that target, all 145 GREEN/all copies STARTED, stable heap,
policies, client/auth/catalog/search/YepWatch/MCP access and no watcher alarm; take 5 min checkpoint.
**Q63 heap timing remains10/2/2; its old04:00 time limit is superseded.** After a healthy homogeneous
checkpoint, continue the next hop without waiting for another clock window. Restore waits/settings/jobs/
cron at final completion or the first failed gate, as below. Keep V2 registered throughout and restore
cron exactly when its writable/no-active-backup gates pass, including an early mixed-stop handover.
Leave rebalancenone if the final-version placement test was not reached.

Do not intentionally leave a mixed cluster overnight: docs support transient rolling mixtures, not a
vendor guarantee for multi-day mixtures. **Q62 still stops at the first failed gate**, even mid-hop;
recover only the node already stopping/rejoining. Never change another node merely to make versions
uniform after a failed gate, or force a stop/recovery for speed. Report an unexpected overrun/state
honestly, with no overnight rollback or data-directory downgrade.

After homogeneous6.0.8, **reuse the already-registered V2 writer at its repaired path**:

```sql
CREATE SNAPSHOT "goodwatch-db-backup-v2".q65_stage_608_20261028 ALL WITH (wait_for_completion=true);
```

Verify SUCCESS/no failures onall coordinators, unchanged writer path/options/shared mounts, preserved
read-onlypre6 registration, and no parent-root alias. Later homogeneous snapshots
`q65_stage_616_20261028`, `q65_stage_6211_20261028`, `q65_stage_637_20261028`, `q65_stage_646_20261028`
use **this same incremental repository**. No per-stage40GiB copies and no unregister/re-register step.
Never overlap a snapshot with a node stop; the only planned mixed checkpoint is the approved pre-resume
snapshot above. Cron stays held only for the actual maintenance window. The verified helper and monitor
must continue to resolve the same V2 name/path before exactcron restoration; no protected-repo retention.

**Before the first 6.2.11 node, while homogeneous 6.1.6 — Q55 APPROVED:**

```sql
GRANT DQL ON SCHEMA blob TO goodwatch_search;
SELECT grantee,class,ident,type,state FROM sys.privileges
WHERE grantee='goodwatch_search' AND ident='blob';
```

Owner approved Q55 onOctober 27: execute at this step during the upgrade, not during preparation.
Read grant everywhere and verify authenticated search GET/HEAD plus content SHA1 for its referenced index
files through every coordinator (follow redirects only with the approved internal credentials).6.2+ table-only BLOB DQL can fail on HTTP internal-index checks; schemaDQL permits
GET/HEAD. One BLOB table was inventoried (21objects/131.27MiB per copy), owner controls future ones;
Windmill already has schema-wide rights. This grant intentionally covers future BLOB tables; retain
no searchBLOB DML/DDL and passwordHBA. Don't execute negative PUT/DELETE tests on production objects.

At homogeneous 6.4.6/GREEN with all original three copies, restore wait 3 using the exact56-statement
[q40-yepwatch-restore-waits.sql](auth/cratedb-production/20261026-operation-contexts/q40-yepwatch-restore-waits.sql),
behind per-table blocks/readbacks. Compare all 145 policies/partitions tobaseline exactly; retain approved
BLOB grant. AllDocker policiesalways and durableoverride pins6.4.6. Allocationall, no exclusions/decommission.

Following Q43's approved final restoration step, once healthy and homogeneous at 6.4.6: set rebalance `all`, observe20–30 min for a
completed move ontocrate-02 with no ShardLockObtainFailedException and healthy watcher. On lock/alarm return
rebalance none immediately, allocation all; no second restart. If test is omitted, leave rebalance none and
hand that state over explicitly. Restore the backup cron **byte-for-byte** with the same returned state:
`ssh root@10.0.0.11 python3 - restore RETURNED_STATE_PATH < "$TMPDIR/cron-hold.py"`; checkoriginalhash/oneactiveentry.
Restore the approved job holds exactly, verify fresh6.4.6 snapshot and record next scheduledhourlyrun.
If it falls after handover, record it as pending, not SUCCESS. Stop the localwatcher last.

## Abort, recovery, rollback and RPO

**Q62: at the first failed gate, stop the upgrade and hand over GREEN, homogeneous where already possible.**
Do not start another node/hop merely to make versions uniform. Only complete the approved normal recovery
of the node already stopping/rejoining and restore safe settings/copies. **No rollback during the night**;
the owner decides in the morning. No restore, data-directory downgrade, second restart or forced stop.
If the already dispatched stop/rejoin cannot recover GREEN, report the actual state immediately and keep
the safest supported state; Q62 does not authorize forcing GREEN or concealing YELLOW/missing primaries.
**Q58 schedule restoration is required at handover even on this early-stop path**, as detailed below.

- **Before SIGTERM:** stop progression; restoreallocation all, targetDocker always, leave rebalance none.
  With3members/original copiesGREEN restore changedwaits/blocks. The writer is already registered: leave its name/path/options unchanged and restore exactcron after its
  writable/no-active-backup gates; preserve protectedpre6. Never undo the approved repository repair. No decommission to cancel.
- **After SIGTERM:** a normalstop cannot be cancelled safely. Reportalarm immediately; only recover the
  already stopped node using the approved targetimage/same data and unlimitedgrace. At15 min stillstopping,
  leave the unit intact, no secondstop/SIGKILL. Two-nodes/YELLOW onfixed replica2tables is expected, missing
  primaries is not. Keepwait 2/restart no/allocation primaries/rebalance none if stilldown; don't restore wait 3.
- **After rejoin:** allocation all/rebalance none; recoverGREEN before restoringwait 3/Docker always. No next node
  after any alarm. A mixed GREEN cluster is an actively staffed incidenthandover; **do not automatically finish
  the hop**, and never reopen a newer data directory with an olderimage. The working V2 registration remains in place even whilemixed. At handover verify it writable and no
  active snapshot/helper, then restorecron exactly, including an early mixed-stop handover, and record its
  next realrun. If the writer fails, report the exact error and explicit cron/restoration owner; no
  automatic repository repair, rerun or silentindefinitehold. Do not drop V2 to protect an unrelated path.
- Missing primaries, secondnode loss, failed backup, new locks, unexpectedwrites/auth/clientbehavior, unsafe heap/
  disk/GC or a Q60 watcher alarm stop progression. Capturestate/logs; no REROUTE/replicareduction/restart improvisation.

**Reference for a separately approved morning decision only — do not execute tonight.**

Rollback from any6.xstage is restore-based to5.10.16, all nodes in fresh directories/volumes, never
in-place downgrade. Preserve stoppedupgradeddata for diagnosis; don't overwrite/delete it. Start a separate
5.10.16 cluster/configuration with the old repo registeredreadonly and restore the protectedsnapshot's tables
andUSERMANAGEMENT; recreate the BLOB table from archivedDDL, upload copiedfiles by SHA1, verify references,
passwords/grants/keys/auth/catalog/counts/policies andGREEN, then separately approve cutover. Exact vetted
restore outline (freshclusteronly, substitute the recorded snapshot name):

```sql
CREATE REPOSITORY "goodwatch-pre6" TYPE fs WITH (location='/snapshots/v2',readonly=true);
RESTORE SNAPSHOT "goodwatch-pre6".q53_pre6_20261027
  TABLES, USERMANAGEMENT, VIEWS, ANALYZERS, UDFS WITH (wait_for_completion=true);
-- Explicitly reapply reviewed cluster settings; do not import global allocation/exclusion state blindly.
-- SQL snapshots exclude BLOB: recreate its original3-shard/0-1 policy, then SHA1 PUT every copied object.
```

No fresh 5.10directory may join a fully6.xcluster. Later6.xsnapshots are not the promised5.10rollback point.
Small-data restore was rehearsed previously; production-volumeRTO is **unqualified**. Budget60–120 min extra
for33.77GiB capturedSQLmetadata set, replicas,BLOB/auth checks andcutover;10–20MiB/s effective read rate alone
implies29–58min transfer. Restorecapacity/owner must be ready before the first node, not arrangedafter failure.

**Q61 approved:** the owner accepts rollback data loss since the one protected pre-upgrade snapshot,
including member/auth/YepWatch/ingestion writes and subsequent BLOB publication. No write freeze or durable
replay is promised. Q62 defers any rollback decision to the morning; acceptance of data loss is not an
instruction to restore tonight. Preserve the rollback point and record the actual snapshot/elapsed loss
window, cluster state and backup-cron restoration responsibility at handover. For this resumed campaign
the5.10 rollback point is stillOctober27 23:02:34.012UTC; a new current mixed/6.x snapshot does not reset it.

## Member impact and retry limits

Each swap briefly removes one coordinator and promotes its primaries; replica recovery competes with
normal reads. Pages may be slower, and a request can exhaust its deadline and return503. The deployed
webapp's node-loss matcher must recognize both5.10 and6.x participating/coordinator disconnect wording;
its bounded retry can choose a survivor, but cannot promise uninterrupted pages. Q60 replaces Q50's single-slow-response rule: three consecutive endpoint failures or three slow responses
in one minute stop progression; a lone slow200 is logged. The lab's keyed/idempotent write
ledger is not evidence that arbitrary member mutations may be blindly retried after uncertain outcomes.

## Q58 — exactly nine approved Windmill job holds

Pause schedules for **only these nine exact script paths** during the window:

1. `f/tmdb_web/tmdb_init_providers`
2. `f/sync/copy/all_ratings`
3. `f/sync/copy/vector_data`
4. `f/sync/copy/tmdb_streaming`
5. `f/tvtropes_web/tvtropes_init_ratings`
6. `f/sync/copy/tvtropes`
7. `f/dna/initialize_dna`
8. `f/tmdb_api/provider_detector`
9. `f/search/build_indexes`

Before changing any schedule, resolve its identity and save its **complete original configuration**
privately: enabled state, cron, timezone, script/flow path, arguments and all other editable settings.
Record every matching schedule identity and a sanitized configuration hash; never assume all were enabled.
Pause only these schedules. Do not change their cron/timezone/arguments, cancel running jobs, purge queued
work or touch unrelated schedules. Read schedules and active jobs fresh after go; archived timings are not
proof no work is active. Any active schema-changing/index-publishing work or other failed gate triggers Q62 rather than an
unapproved cancellation or additional hold; existing heavy work otherwise has the explicit ownerwaiver. The documented manual schema/publication holds remain in force. The latest owner waiver allows existing
heavy jobs (including the named shadow detector), except actual schema-changing or index-publishing
work. Record each allowed heavy job; pause future starts of the nine, do not cancel active jobs. A deployment prevents a concurrent node swap: apply the owner-approved15-minute wait,
then recheck GREEN and the watcher; failed or overdue deploys stop progression.

**At normal or early-stop handover, restore those nine schedule configurations and original enabled states
exactly, then read them back. Do not catch up, manually rerun or enqueue missed executions.** Next scheduled
runs must be future cron occurrences; record missed runs without replaying them. Managed timestamps are
server-maintained, not a reason to alter the saved configuration or request a historical execution.
The handover restoration applies even if Q62 leaves a GREEN mixed 6.0/6.1 cluster. Note the documented BLOB
SQL risk for restored index cleanup in that case; do not silently extend its pause beyond the window.
Report any restoration failure or concurrent configuration edit instead of overwriting an unrelated edit.
The backup cron has its separate repository/phase safety rules; record its exact held/restored state too.

## Owner approvals before the next GO

Recorded owner decisions (a failed attempt does not authorize an automatic retry; await fresh GO):

- [x] **Latest owner override:** No04:00 deadline; continue until6.4.6 unless a gate fails. Existing heavy jobs allowed except schema changes/index publication; nine future schedules still held. Daytime06:00 noise does not change thresholds. Active deploys may finish within15minutes; failed/overdue deploys stop the run, then recheckGREEN/watcher before any node change.

- [x] **Q53, resumed by Q65:** Rolling plain stops;October27 first02→6.0.8 is complete; the oldOctober28 23:00 start is superseded by the latest immediateGO/no-deadline override; pinned five-hop path, original copies retained, only 14 YepWatch waits lowered across the campaign then restored, and one protected snapshot+BLOB pair with the backup cron held throughout.
- [x] **Q65 next-night completion:** Original next-night timing superseded by immediate/no-deadline owneroverride; freshGO stillrequired; finish03/01→6.0.8 then all four later hops with the same safeguards. Accept only the verified check3 future7.x advisory; keep V2 registered/writable at its repaired path throughout. No upgrade begins under the backup-repair GO.
- [x] **Q64 backup repair:** Unregister legacy read-only root alias; create V2 at`/snapshots/q65-mixed-20261027`; preservepre6. This separate execution is recorded in the dated evidence, not repeated as an upgrade stage.
- [x] **Q55:** `GRANT DQL ON SCHEMA blob TO goodwatch_search` before the first 6.2.11 node, followed by authenticated index-file GET/HEAD and SHA1 verification.
- [x] **Q58:** Pause exactly the nine named Windmill job paths above for the window; capture their exact original schedule configurations, restore them exactly at handover, and do not catch up missed runs. No permission to cancel active jobs or pause other schedules.
- [x] **Q59, timing superseded by Q63:** Start below 80% and stop above 85% remain in force; the initial requirement for ten minutes before every node no longer applies.
- [x] **Q63:** Heap below 80% for ten minutes before the first node of each hop, two minutes before each later node in that hop; stop above 85%. Its original23:00–04:00 window is superseded by the owner's no-deadline override; do not apply the old04:00 stop. Q62 safety/first-failed-gate rules remain unchanged.
- [x] **Q60:** Abort on three consecutive unexpected responses/transport failures per endpoint, or three responses over 3s within one minute across probes; a single slow response is only logged. Expected unauthenticated MCP401 remains healthy. Use `--policy q60`.
- [x] **Q61:** Accept rollback data loss since the protected pre-upgrade snapshot. No separate write-loss-cap or write-freeze decision is pending for this window.
- [x] **Q62:** Stop at the first failed gate and hand over GREEN, homogeneous where safely possible. No rollback during the night; the owner decides in the morning. Do not upgrade another node merely to make versions uniform after a failed gate.
- [x] **Mixed 6.0/6.1 BLOB exception:** The owner approved the documented allocation/local-copy/HTTP cross-check and holds. No unexplained missing copy, HTTP failure or unrelated SQL error is waived.
- [x] **Q43 final restoration:** If the campaign completes safely, retain the approved final rebalance observation/abort procedure; if an early safety stop prevents it, leave`none` and record the unproven placement test.

Operational confirmations still to record after go, not additional requests to reapprove the decisions above:

- [ ] **Operators and admission forecast:** Record staffed handover and measured whole-hop forecasts. The10/2/2-minute heap policy remainsapproved; the04:00 deadline isremoved. Record staffed recovery/handover capacity while continuing under the latestGO.
- [ ] **Shared storage/configuration:** Verify the existing repaired V2 sharedpath onall nodes, read-onlypre6, no root alias, and exact per-node mounts/allowlists/durable imagepins. No new repository transition is planned. Stop before the first node if storage is not shared or configuration differs.
- [ ] **Restoration responsibility:** Record the schedule/backup-cron restoration owner and observed states at handover. Any later rollback/cutover owner, fresh restore capacity and 60–120 minute unqualified RTO are for the separately approved morning decision, not authority to restore tonight.
