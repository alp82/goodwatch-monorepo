# Q53 — rolling CrateDB 5.10.16 → 6.4.6 with plain stops

**Local rehearsal and execution plan only. No production operation was performed for this revision.**
Owner selected October 27 **23:00 UTC = October 28 00:00 CET**, with an explicit go expected around 22:45 UTC.
Do not start checks or changes early. Outstanding approvals are at the end. The older Q32 drain/copy-reduction
plan is superseded: **no decommission, no drain, no zero-primary gate, no replica removal, no KILL/SIGKILL**.

Use the [new plain-stop rehearsal](crate-6-upgrade/20261027-plain-rehearsal/README.md),
[tagged-source check](../research/crate-q53-plain-rolling-source-check.md),
[43-release compatibility audit](../research/crate-6-upgrade-compatibility.md), and
[archived production preflight](crate-6-upgrade/20261026-preflight/README.md).
Today's [Q50 restart](auth/cratedb-production/20261026-operation-contexts/q50-execution.md) returned GREEN
in about 3 minutes, but one discover200 taking4.376s triggered its old abort rule. **Q60 supersedes that
single-event rule tonight**; see the watcher section below.
Historical GREEN or a completed restart does not establish current allocation/heap/backup/lock health.

## Path, images and node order

Complete each row on **crate-02 → crate-03 → crate-01**, one node at a time. Re-read placement/master state;
02-first is a canary preference (historically fewest primaries), not a way around version compatibility.
The order is the one qualified locally. Any order change requires review, not a silent in-flight experiment.

| Hop | From, all nodes | Target image, all three replacements |
| --- | --- | --- |
| Baseline/restore only | 5.10.16 | `crate:5.10.16@sha256:5d7cd92eb84d56d538e2222a436e432164b853fdf186aebb17c446787f23a307` |
| 1 | 5.10.16 | `crate:6.0.8@sha256:7b6af0abb4792123cfa225c8186471bbe81e039ef336af33095a181f4e8c17bf` |
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

Propose **23:00–04:00 UTC** (00:00–05:00 CET), recovery owner available until 06:00 UTC. Initial gates/watcher
22:45–23:00 only after explicit go. Start backup protection/preparation 23:00; first SIGTERM only after it
and fresh gates pass, likely 23:15–23:30. No new hop after 03:00, no SIGTERM after 03:30; hard stop for new
maintenance 04:00. These proposed end/cutoff times still need confirmation. Q59 supersedes the shorter
between-node heap assumption; do not compress its ten-minute history to fit the proposed slot.

| Work | Production allowance |
| --- | --- |
| Initial 10 min gates/watcher, image pulls, protected SQL snapshot + BLOB/config copy | 20–30 min after go; allow longer if backup not settled |
| Each node: preparation/readbacks and replacement | 1–2 min |
| Each node: stop → rejoin → original replication GREEN | 3–5 min, based on today's ~3 min;6.x upgrades may be slower |
| Before every node: all-coordinator heap history, GREEN/policy/client checks | **Heap <80% for ten full minutes on every node**, sampled every 30s; a new JVM needs its own history |
| Each complete hop: version/access/BLOB/backup canaries | 5 min additional |
| First snapshot into the new 6.x repository | **15–30 min extra** for the first full write; later snapshots are incremental |
| Final waits/restart/policy/cron restoration and observation | 25–40 min including Q43 final rebalance observation; hand over if the hard stop prevents it |

Q59 supersedes the earlier three-minute between-node assumption. Budget roughly **11–15 minutes per
replacement** including the new node's ten-minute heap history before the next stop, plus the protected
baseline, first full 6.x snapshot, hop checks and final restoration: **about 4–6 hours**. The last node's
heap/recovery still needs checking before final restoration. Heap history may overlap recovery only when
fresh readings remain below 80%; GREEN and original copies are required before progression regardless.
The proposed23:00–04:00 slot may therefore finish fewer than five hops. Confirm the window; never compress
the gate, silently extend the cutoff or force completion. Stop at a healthy complete-hop checkpoint if time
runs out; at any first failed gate follow Q62, even if the resulting GREEN cluster is mixed.

Today's production stop-to-GREEN was about3min, not the full verification time. The local fixture does not
predict production transfer throughput. Recovery can reuse segments, but the prior38.18GiB primary /
75.17GiB across copies and40MiB/s recovery rate remain capacity considerations. No primary drain is budgeted.

## Entry gates and gates before every node/hop

Use all three coordinators while up, both survivors while down. Explicit columns in mixed versions.
**Q59: before every node, every node must have fresh used/max heap readings below 80% for ten full minutes.**
Sample every30s and retain timestamped history through recovery; a new JVM cannot inherit its predecessor's
history. Require GREEN and all original copies before progression as well. An entry/pre-node gate that
fails ends progression under Q62; do not keep retrying a failed gate or reset its history silently.

- Three expected persistent IDs; only the row's source/target versions, then homogeneous target before
  next hop. Initially all 5.10.16. Archived IDs:01 `xlclgwGeSHe18p5J4WvfFA`,02 `r0IgCe17SPOgudkQIGsRQA`,
  03 `ch8EXZwrQVmCls79_T_vUg`; stop on unexplained identity/config change.
- **145 GREEN**, zero missing/underreplicated copies, all copies STARTED/STARTED; no RELOCATING primary,
  no RELOCATING/INITIALIZING/RECOVERING copy before the next stop. Do not advance on GREEN alone while
  local recovery states differ. Current lock/relocation state must be checked fresh; do not reuse Q50.
- During the qualified6.0/6.1 mixture only, apply the BLOB cross-check above; require all physical copies
  via `sys.allocations` and each node's localshardrows rather than identical clusterwideBLOB stat rows.
- Every primary on the node to stop has a STARTED survivor copy; two survivors provide cluster quorum.
  No failed cluster/node checks, unexpected exclusion/write block or active decommission.
- **Q59 heap gate: <80% used/max on every node for ten minutes before each node stop.** Any reading not
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
- No deploy for the whole slot. Owner-approved schema/SWAP/RENAME and index-publication hold prevents
  snapshot/BLOB pairing races; no schedule mutation beyond the approved list. Light member/workflow writes
  may continue under the selected RPO/write policy. If workload breaks heap/site gates, stop and report.
- Same volume/data path, image digest, HBA/startup arguments, heap, network/publication addresses, mount
  sources, StopSignal unset/SIGTERM/15 and restart policy captured privately. Do not print `.env` or full
  Docker/Compose configuration into evidence. Maintain a second SSH session and staffed observer.

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
SELECT id,passed,description FROM sys.checks WHERE NOT passed;
SELECT node_id,id,passed,description FROM sys.node_checks WHERE NOT passed;
```

Read job history again at the end for **every** failed Windmill root/step between gates and completion;
include failures of jobs started before gates. Record name/ID/error/completion time, do not rerun them.

## Operator routes and watcher

Set `TMPDIR=$HOME/.cache/gw-work/644-q53-execution`; scratch/private originals there, never/tmp.
Use the existing [watcher](auth/cratedb-production/20261026-operation-contexts/q40-page-watch.py) with
**`--policy q60`** every10s from gates through restoration/observation, with5s request timeout.
Q60 aborts on **three consecutive unexpected-status/transport failures for the same endpoint**, or
**three responses over 3s across the probes within a rolling 60-second window**. Healthy responses reset
only that endpoint's failure streak; fast responses do not erase recent slow responses. A single slow or
failed probe is logged, not an abort. The three page URLs and discovery expect200; unauthenticated
`/mcp` expects401, which remains healthy. This expected401 is not counted as a non-200 page failure.

The helper's default remains historical Q43; omitting `--policy q60` is not tonight's approved command.
Q60 alarms remain sticky. Monitor failure/stale heartbeat still stops progression: heartbeat<=15s,
controller checks<=5s. Do not discard an alarm or reinterpret thresholds during execution.

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
2. Hold the approved publication/schema jobs; preserve current search BLOB metadata and its SHA1 manifest,
   user/privilege metadata, HBA/startup config, private credential/payload keys. Take **one** fresh protected
   baseline before any6.x data directory is opened (use the long-snapshot route):

   ```sql
   CREATE SNAPSHOT "goodwatch-db-backup-v2".q53_pre6_20261027 ALL WITH (wait_for_completion=true);
   ```

   Re-read exact name SUCCESS/no failures on all coordinators. No DROP if slow; inspect/report. SQL snapshots
   omit BLOBs. Copy all immutable SHA1 files for the only BLOB table from **all three nodes**, deduplicate by
   digest, verify each file's SHA1/length and each referenced index object. The [copy helper](crate-6-upgrade/20261027-plain-rehearsal/copy-blob-sha1.py)
   reads the inspected `/data` mount source and writes only an approved private sibling backup directory:

   ```bash
   # After go, on each11/12/13 host (pass its real container name):
   ssh root@10.0.0.11 python3 - crate-01 /mnt/backup-cratedb/q53-pre6-20261027/blob \
     < docs/implementation/crate-6-upgrade/20261027-plain-rehearsal/copy-blob-sha1.py
   # Repeat .12/crate-02 and .13/crate-03. Merge per-node manifests; compare to frozen references. An empty node is valid;
   # the union must cover every frozen reference (and must not be empty).
   ```

   Snapshot + SHA1 copy is the single rollback point. Protect the **whole old repository**, including
   dependencies; no per-minor full repository copies. If publication cannot be held or references cannot
   be paired/verified, NO-GO. Resume only approved light work after the protected pair is complete.
3. With no active snapshots, protect old registrations by unregistering/re-registering **the same existing
   options** withreadonly=true. Archived options were onlylocation; recheck before using these statements:

   ```sql
   DROP REPOSITORY "goodwatch-db-backup-v2";
   CREATE REPOSITORY "goodwatch-pre6" TYPE fs WITH (location='/snapshots/v2', readonly=true);
   DROP REPOSITORY "goodwatch-db-backup";
   CREATE REPOSITORY "goodwatch-db-backup" TYPE fs WITH (location='/snapshots', readonly=true);
   ```

   DROP REPOSITORY unregisters; it does **not** delete snapshot files. The active writer name stays absent
   until homogeneous 6.0; cron remains held. Do not drop either snapshot or filesystem contents. Readonlyfs
   was locally qualified on5.10 and is supported by taggedsource; [details](../research/crate-q53-plain-rolling-source-check.md#one-protected-baseline-and-repository-transition).
4. Apply the exact14 YepWatch waits3→2 **once**, keeping2 across the entire campaign. All30 three-copy
   tables retain replicas2. Auth + user_mcp_action retainwait 1 and REQUEST; no other wait change was needed.
   Use [q40-yepwatch-lower.sql](auth/cratedb-production/20261026-operation-contexts/q40-yepwatch-lower.sql),
   56 statements, **no number_of_replicas statement**. Each table: blockwrite, RESETwait, SET2, read2 on all
   coordinators while blocked, then restore its original false block. Do not stream the file unattended.
   Names:agreement,candidate,command_receipt,control,decision,invitation,member_grant,member_intent,participant,
   proposal,room,runtime,ticket,vote, all with `doc.yepwatch_`. This is weaker admission while maintenance
   runs, not a write-acknowledgement quorum. Restore3 only with all three original copies STARTED.
5. Capture allocation/rebalance on every readback. Keep **rebalance `none`** throughout rolling replacements;
   allocation alternatesprimaries/all below. No recovery-rate, exclusion, graceful-stop or replica change.

## Each of fifteen replacements: exact host procedure

Execute this template manually for each of the [15 exact node/hop rows](crate-6-upgrade/20261027-plain-rehearsal/node-matrix.json), order 02→03→01.
Each row records the host, node, unique stop unit and full target image. Select only one row at a time. **No loop automatically
starts the next node.** Production project directory is `/root/goodwatch/goodwatch-monorepo/goodwatch-crate`,
Compose project`goodwatch-crate`, service`cratedb`; verify those against Docker's existing Compose labels.
If path/labels/runtime differ, stop. Hosts01/02/03 are10.0.0.11/.12/.13.

1. Pass fresh gates and reserve enough time. Pin/pull this node's exact target image. Save root-private
   `.env`, Compose files/runtime hashes and original policy. Save exact`Config.Cmd` privately for
   the replacement code below. Prepare shared host directory
   `/mnt/backup-cratedb/snapshots-v6` **outside** old `/mnt/backup-cratedb/snapshots` and verify with `findmnt`
   and a shared visibility canary across hosts; don't assume matching directory names are shared storage.
   This approved new mount/path allowlist is the only first-hop config change. Never put the new repository
   under`/snapshots/v6`: legacy repository owns`/snapshots` itself.
2. On target host, `docker update --restart=no crate-0N`. Through survivor:

   ```sql
   SET GLOBAL TRANSIENT "cluster.routing.allocation.enable" = 'primaries';
   ```

   Read back primaries/none on all coordinators; require a complete live watcher round **started after**
   changes, a fresh heartbeat and no Q60 alarm, plus unchanged image/config/PID and valid StopSignal.
   A single logged slow or unexpected response does not independently fail this watcher gate. Recheck GREEN, no snapshot, placement and alarm immediately
   before dispatch. **No decommission or zero-primary check.** Before the approved SIGTERM cutoff only:

   ```bash
   # On the host of the selected node-matrix row; example first row:
   Q53_NODE=crate-02
   Q53_UNIT=gw-q53-608-02
   systemd-run --unit="$Q53_UNIT" --property=Type=exec \
     --property=TimeoutStopSec=infinity --property=SendSIGKILL=no \
     /usr/bin/docker stop --timeout=-1 "$Q53_NODE"
   ```

   Watch unit and Docker State independently. After15 min still stopping: report, leave unlimited wait
   intact and two survivors staffed. Never kill the unit/docker/JVM or dispatch a second stop.
3. Only after confirmed exit, PID0/no OOM/normal exit0 or143, recreate **that stopped service only** on the
   same named data volume. Durable Compose override (JSON is valid YAML) example for first hop02 below;
   replaceimage using the table for every later hop. Preserve the complete originalcommand/HBA arguments,
   changing only path.repo toallow`/snapshots,/snapshots-v6`; use the verified host substitutions from the
   existing effectivecommand, not a copied command with another host's address. Store the reviewed full
   command vector privately in`q53-command.json` (sanitized hash in evidence).

   ```bash
   cd /root/goodwatch/goodwatch-monorepo/goodwatch-crate
   # Q53_HOST_IMAGE is selected from the pinned table, e.g. first hop02:
   Q53_HOST_IMAGE='crate:6.0.8@sha256:7b6af0abb4792123cfa225c8186471bbe81e039ef336af33095a181f4e8c17bf'
   export Q53_HOST_IMAGE
   export NODE_NAME=crate-02  # For this row/host only; usecrate-03/.13 orcrate-01/.11 as appropriate.
   python3 - <<'PY'
   import json,os,pathlib
   # Capture Config.Cmd privately before the first recreation; verify existing project/labels first.
   import subprocess,re,shutil,tempfile
   private=pathlib.Path('/root/.config/goodwatch/q53');private.mkdir(parents=True,exist_ok=True,mode=0o700)
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
   cmd=[('-Cpath.repo=/snapshots,/snapshots-v6' if x.startswith('-Cpath.repo=') else x) for x in cmd]
   override={'services':{'cratedb':{'image':os.environ['Q53_HOST_IMAGE'],'restart':'no','command':cmd,
     'volumes':['/mnt/backup-cratedb/snapshots-v6:/snapshots-v6']}}}
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
   # same env/heap/network/HBA/command except approved path.repo; restart no. Stop on drift.
   docker start crate-02
   ```

   For03/01 change only host/node and selectedimage. Never useCompose to stop a running target, never
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
   writes as a canary. Require the Q59 ten-minute <80% heap history before the next node, plus stable GREEN/site checks.
   Stop at the first failed gate or Q60 alarm; no next node after it.
5. Restore target `docker update --restart=always crate-0N`; change onlyoverride.restart to`always` privately
   so future Compose recreation preserves it too. Recordall/none on all settings readbacks. Save timing,
   placement/version matrix, exit/rejoin/runtime hashes, logs and watcher receipts before the next node.

## Homogeneous checkpoints, BLOB grant and final restoration

After each three-node row, confirm all at thattarget, all 145GREEN/all copiesSTARTED, stable heap, policies,
client/auth/catalog/search/YepWatch/MCP access and no watcher alarm; take5 min checkpoint. Finish a row
before the next hop. Do not intentionally leave a mixed cluster overnight: docs support transient rolling
mixtures, not a vendor guarantee for multi-day mixtures. Safety may nevertheless require a staffed mixed
GREEN handover on abort; never upgrade another node just to make versions uniform after an alarm.

After homogeneous 6.0.8, create the **one** new 6.x writer repository with the helper's existing name:

```sql
CREATE REPOSITORY "goodwatch-db-backup-v2" TYPE fs WITH (location='/snapshots-v6');
CREATE SNAPSHOT "goodwatch-db-backup-v2".q53_stage_608 ALL WITH (wait_for_completion=true);
```

Verify SUCCESS/no failures on every coordinator, activepath/sentinel/shared storage and old registrations
readonly=true. Later homogeneous snapshots `q53_stage_616`, `q53_stage_6211`, `q53_stage_637`,
`q53_stage_646` use **this same incremental repository**; no per-stage40GiB copies. Never snapshot in a
mixed stage or overlap one with a stop. Cron stays held. Direct helper compatibility on the new repository
and monitoring canaries must pass before restoration (no unapproved retention cleanup of the protected repo).

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
If it falls after the hardstop, hand it over as pending, not SUCCESS. Stop the localwatcher last.

## Abort, recovery, rollback and RPO

**Q62: at the first failed gate, stop the upgrade and hand over GREEN, homogeneous where already possible.**
Do not start another node/hop merely to make versions uniform. Only complete the approved normal recovery
of the node already stopping/rejoining and restore safe settings/copies. **No rollback during the night**;
the owner decides in the morning. No restore, data-directory downgrade, second restart or forced stop.
If the already dispatched stop/rejoin cannot recover GREEN, report the actual state immediately and keep
the safest supported state; Q62 does not authorize forcing GREEN or concealing YELLOW/missing primaries.
**Q58 schedule restoration is required at handover even on this early-stop path**, as detailed below.

- **Before SIGTERM:** stop progression; restoreallocation all, targetDocker always, leave rebalance none.
  With3members/original copiesGREEN restore changedwaits/blocks. If no6.x node was started, restore original
  repository registrations/options and exactcron; retain protectedbaseline safely. No decommission to cancel.
- **After SIGTERM:** a normalstop cannot be cancelled safely. Reportalarm immediately; only recover the
  already stopped node using the approved targetimage/same data and unlimitedgrace. At15 min stillstopping,
  leave the unit intact, no secondstop/SIGKILL. Two-nodes/YELLOW onfixed replica2tables is expected, missing
  primaries is not. Keepwait 2/restart no/allocation primaries/rebalance none if stilldown; don't restore wait 3.
- **After rejoin:** allocation all/rebalance none; recoverGREEN before restoringwait 3/Docker always. No next node
  after any alarm. A mixed GREEN cluster is an actively staffed incidenthandover; **do not automatically finish
  the hop**, and never reopen a newer data directory with an olderimage. Leavecronheld whilemixed or without
  a verified writable6.xbackup repo; name its restoration owner/deadline and accept the explicit RPO extension.
  Once homogeneous with a verified compatiblewriter repo/no conflict, restorecron exactly. No silentindefinitehold.
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
window, cluster state and backup-cron restoration responsibility at handover.

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
proof no work is active. Any incompatible active work or other failed gate triggers Q62 rather than an
unapproved cancellation or additional hold. The documented manual schema/publication holds remain in force.

**At normal or early-stop handover, restore those nine schedule configurations and original enabled states
exactly, then read them back. Do not catch up, manually rerun or enqueue missed executions.** Next scheduled
runs must be future cron occurrences; record missed runs without replaying them. Managed timestamps are
server-maintained, not a reason to alter the saved configuration or request a historical execution.
The handover restoration applies even if Q62 leaves a GREEN mixed 6.0/6.1 cluster. Note the documented BLOB
SQL risk for restored index cleanup in that case; do not silently extend its pause beyond the window.
Report any restoration failure or concurrent configuration edit instead of overwriting an unrelated edit.
The backup cron has its separate repository/phase safety rules; record its exact held/restored state too.

## Owner approvals before 23:00 UTC

Recorded owner decisions (production execution still waits for the explicit go around22:45 UTC):

- [x] **Q53:** Rolling plain stops starting October27 at23:00 UTC; pinned five-hop path, original copies retained, only 14 YepWatch waits lowered across the campaign then restored, and one protected snapshot+BLOB pair with the backup cron held throughout.
- [x] **Q55:** `GRANT DQL ON SCHEMA blob TO goodwatch_search` before the first 6.2.11 node, followed by authenticated index-file GET/HEAD and SHA1 verification.
- [x] **Q58:** Pause exactly the nine named Windmill job paths above for the window; capture their exact original schedule configurations, restore them exactly at handover, and do not catch up missed runs. No permission to cancel active jobs or pause other schedules.
- [x] **Q59:** Every node's heap must stay below 80% for ten minutes before every node stop; stop if above 85%. This supersedes the proposed 75% gate, three-minute heap assumption and two-minute 85% grace.
- [x] **Q60:** Abort on three consecutive unexpected responses/transport failures per endpoint, or three responses over 3s within one minute across probes; a single slow response is only logged. Expected unauthenticated MCP401 remains healthy. Use `--policy q60`.
- [x] **Q61:** Accept rollback data loss since the protected pre-upgrade snapshot. No separate write-loss-cap or write-freeze decision is pending for this window.
- [x] **Q62:** Stop at the first failed gate and hand over GREEN, homogeneous where safely possible. No rollback during the night; the owner decides in the morning. Do not upgrade another node merely to make versions uniform after a failed gate.
- [x] **Mixed 6.0/6.1 BLOB exception:** The owner approved the documented allocation/local-copy/HTTP cross-check and holds. No unexplained missing copy, HTTP failure or unrelated SQL error is waived.
- [x] **Q43 final restoration:** If the campaign completes safely, retain the approved final rebalance observation/abort procedure; if the hard stop prevents it, leave`none` and record the unproven placement test.

Operational confirmations still to record after go, not additional requests to reapprove the decisions above:

- [ ] **Window and operators:** Confirm end/cutoff times and staffed handover. The previous proposal was 23:00–04:00UTC, last new hop 03:00 and SIGTERM cutoff 03:30. Q59 now raises the estimate to about 4–6 hours; do not shorten its ten-minute gate or silently extend a cutoff. Stop safely if the available window cannot cover another complete hop.
- [ ] **Shared storage/configuration:** Verify the new genuinely shared `/snapshots-v6` location, read-only old registrations and reviewed durable Compose/image/allowlist changes. Stop before the first node if storage is not shared or configuration differs.
- [ ] **Restoration responsibility:** Record the schedule/backup-cron restoration owner and observed states at handover. Any later rollback/cutover owner, fresh restore capacity and 60–120 minute unqualified RTO are for the separately approved morning decision, not authority to restore tonight.
