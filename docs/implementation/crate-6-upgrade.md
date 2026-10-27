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
in about3 min, but a discover200 taking4.376s triggered its abort. The watcher rule remains in force tonight.
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

## Mixed 6.0/6.1 BLOB qualification — explicit approval required

The145-table lab exposed behavior the earlier drain rehearsal missed: with6.0.8 and6.1.6 mixed,
newer coordinators omit remote older-node BLOB rows from `sys.shards`, and `SELECT digest FROM
blob.search_index_files` can fail `RelationUnknown`. All coordinators still report145GREEN and1175
STARTED `sys.allocations`; collecting each node's own shard rows directly gives the full1175 copies,
including6BLOBcopies. Authenticated BLOB HTTP GET/HEAD and SHA1 content work through all 3nodes.
[Source and mechanism](../research/crate-q53-plain-rolling-source-check.md).

**Do not waive an unexplained missing copy.** Only for this qualified6.0/6.1 mixture, the proposed gate
requires full STARTED allocation counts/identities on all coordinators plus the union of directown-node
`sys.shards` rows, every copySTARTED/STARTED and correctBLOB HTTP/SHA1. Non-BLOBrows must still agree;
no missing allocation, failedHTTP, unexpectedversion or anyother tableerror is covered. Afterhomogeneous
6.1 require full BLOB SQL/inventoryagreement again. Owner must approve this bounded visibility/SQL exception
or the 6.1hop is NO-GO. It is not permission to ignore health or incomplete physical copies.

Hold `f/search/build_indexes` (including itscleanup) through the campaign: itsline444 executes that
BLOB SQL. Webapp/search index download uses HTTP (`search-index-build.server.ts:139`). Hold schema and
index publication jobs as approved; catalog/member reads/writes retain the normalwatcher gates.

## Window and forecast

Propose **23:00–04:00 UTC** (00:00–05:00 CET), recovery owner available until 06:00 UTC. Initial gates/watcher
22:45–23:00 only after explicit go. Start backup protection/preparation 23:00; first SIGTERM only after it
and fresh gates pass, likely 23:15–23:30. No new hop after 03:00, no SIGTERM after 03:30; hard stop for new
maintenance 04:00. These end/cutoff times and shorter between-node soak require owner approval.

| Work | Production allowance |
| --- | --- |
| Initial 10 min gates/watcher, image pulls, protected SQL snapshot + BLOB/config copy | 20–30 min after go; allow longer if backup not settled |
| Each node: preparation/readbacks and replacement | 1–2 min |
| Each node: stop → rejoin → original replication GREEN | 3–5 min, based on today's ~3 min;6.x upgrades may be slower |
| Each node: all-coordinator stable GREEN/policy/client/heap checks | 3 min minimum, samples every 30s |
| Each complete hop: version/access/BLOB/backup canaries | 5 min additional |
| First snapshot into the new 6.x repository | **15–30 min extra** for the first full write; later snapshots are incremental |
| Final waits/restart/policy/cron restoration and observation | 25–40 min including Q43 final rebalance observation; hand over if the hard stop prevents it |

Fifteen nodes at 7–10 min plus baseline/hop/final work and the first full 6.x snapshot give **roughly 3–4½ hours**; book 5 hours, not the old drain-based
20–24h estimate. The local small-data timings are linked above; they do not predict production transfer
throughput. Recovery may reuse local segments, but38.18GiB primary/75.17GiB across copies and40MiB/s
configured recovery still bound a worst retransmission. No primary drain is budgeted. Do not start a node
unless its measured forecast plus recovery/soak fits the remaining slot. If the first hop runs slower,
finish safely and stop at a homogeneous checkpoint; do not compress the gates to meet the clock.
Keeping 10 min settled GREEN after every node instead of the proposed 3 min adds 105 min: book about 6–7 hours.

## Entry gates and gates before every node/hop

Use all three coordinators while up, both survivors while down. Explicit columns in mixed versions.
Before entry require10 min of heap/load/site baseline; after each node require3 min stable GREEN (subject
to owner approval). Heap is sampled every 30s, including recovery. New JVMs get their own post-GREEN samples.

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
- **Heap <75% used/max on every node**, no upward/GC/breaker pressure; loads5/15 below available processors
  (historically16), disk/recovery queues sane. Hold progression on a breach; >=85% for2 min, OOM, repeated
  GC stalls or breaker pressure is abort/escalation. No forced GC, heap or recovery-rate changes.
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
Use the [Q43 watcher](auth/cratedb-production/20261026-operation-contexts/q40-page-watch.py) every 10s from
gates through restoration/observation,5s request timeout. Expected pages200 (Usual Suspects, Breaking Bad,
discover), unauthenticated `/mcp`401 and discovery200. **First unexpected status/transport error OR any
request>3s is a sticky abort**. No re-baselining away an alarm; heartbeat<=15s, controller checks<=5s.

```bash
mkdir -p "$TMPDIR"
printf '%s' baseline > "$TMPDIR/phase"
python3 docs/implementation/auth/cratedb-production/20261026-operation-contexts/q40-page-watch.py \
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

   Read backprimaries/none on all coordinators; require a healthy watcher round **started after** changes,
   unchanged image/config/PID and valid StopSignal. Recheck GREEN, no snapshot, placement and alarm immediately
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
   writes as a canary. Observe3 min stable GREEN/heap/site. No next node after an alarm.
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
  disk/GC or any watcher failure stopprogression. Capturestate/logs; no REROUTE/replicareduction/restart improvisation.

**Rollback from any6.xstage is restore-based to5.10.16**, all nodes in fresh directories/volumes, never
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

RPO decision: **continuing writes means every write after the one pre-upgrade snapshot can be lost on
rollback**, including member/auth/YepWatch/ingestion and laterBLOBpublication. Recommend owner explicitly
accepts the campaign loss window with a maximumelapsedlimit, rather than claiming retries preservewrites.
Alternative: all-writer freeze/read-only maintenance or a separately qualified durablejournal/replay across
members/auth/flows/BLOB/external effects. No such end-to-end journal is established by this rehearsal.

## Member impact and retry limits

Each swap briefly removes one coordinator and promotes its primaries; replica recovery competes with
normal reads. Pages may be slower, and a request can exhaust its deadline and return503. The deployed
webapp's node-loss matcher must recognize both5.10 and6.x participating/coordinator disconnect wording;
its bounded retry can choose a survivor, but cannot promise uninterrupted pages. The unchanged3s watcher
rule can stop this campaign after even one slow 200, as Q50 demonstrated. The lab's keyed/idempotent write
ledger is not evidence that arbitrary member mutations may be blindly retried after uncertain outcomes.

## Specific workload holds to approve and verify fresh

The archived 08:25 UTC schedule listing is a forecast, not a current gate. It includes midnight-local
`f/tmdb_web/tmdb_init_providers` (**23:00 UTC**), `f/sync/copy/all_ratings` (**00:00 UTC**),
`f/sync/copy/vector_data` (**00:30 UTC**), `f/sync/copy/tmdb_streaming` and
`f/tvtropes_web/tvtropes_init_ratings` (**01:00 UTC**), `f/sync/copy/tvtropes` and
`f/dna/initialize_dna` (**02:00 UTC**), and `f/tmdb_api/provider_detector` hourly 00:00–11:00 UTC.
Recommend owner-approved one-window deferral of these eight paths plus `f/search/build_indexes`
(publication/cleanup), preserving exact schedule enabled/cron/timezone state and restoring it on handover.
Record missed jobs; don't catch up or rerun them without approval. Freshly check all schedules/queue,
including carry-over `read_daily_provider_lists`, at 22:45. No inherited Q50 heavy-workload waiver applies
automatically to tonight. If owner declines deferral and a heavy job compromises the gates, stop/report;
do not cancel running work or rewrite schedules on your own. Also freeze manual/deploy schema/SWAP/RENAME
and index-publication writers for the protected baseline and mixed campaign.

## Owner approvals before 23:00 UTC

Already decided:

- [x] **Q53:** Rolling upgrades with plain stops, starting October 27 at 23:00 UTC. Wait for the explicit go around 22:45.
- [x] **Q53 maintenance policy:** Keep only the 14 YepWatch waits at 2 across the campaign, as the owner delegated and rehearsal qualified; restore 3 afterwards. No replica changes or other wait changes.
- [x] **Q53 backup scope:** One protected pre-upgrade SQL snapshot + BLOB SHA1 copy, with the hourly cron held throughout. The new shared location/configuration still needs readiness confirmation below.
- [x] **Q43 final restoration procedure:** Once healthy at the final version, enable rebalance `all` and observe 20–30 minutes; return to `none` on lock/site alarm, with no second restart. If the hard stop prevents the test, leave `none` and hand that limitation over.
- [x] **Q55:** `GRANT DQL ON SCHEMA blob TO goodwatch_search` before the first 6.2.11 node, followed by authenticated index-file GET/HEAD and SHA1 checks. No grant during preparation.

Remaining decisions:

- [ ] **Window and operators:** Approve 23:00–04:00 UTC, last new hop at 03:00, SIGTERM cutoff 03:30, and recovery coverage until 06:00. Name operator/observer and review this commit, pinned images and the rehearsed 02→03→01 order.
- [ ] **Heap and verification:** Approve <75% heap, a 10-minute initial baseline, three minutes stable GREEN between nodes and five-minute hop checks. Keeping ten minutes GREEN between nodes requires a six–seven-hour window. No silent gate waiver.
- [ ] **Job holds:** Approve the nine exact schedule-path deferrals above and manual schema/publication freeze, or specify an alternative workload policy. Light writes may continue under the selected RPO; Q53's selected wait policy is already recorded above.
- [ ] **Shared storage and persistent configuration:** Confirm the genuinely shared `/snapshots-v6` location is available, and review the read-only old registrations, mount/allowlist delta and durable Compose override/image pins/`COMPOSE_FILE`. Q53 already selects the baseline and cron hold; this confirms their exact storage/deployment implementation. If the new path is not shared or configuration differs, stop before the first node.
- [ ] **RPO and backup owner:** Accept post-baseline write loss on restore, with an explicit maximum loss window and policy for a mixed-version abort; alternatively approve and qualify a complete write freeze. No durable replay solution is ready. Name the backup/cron restoration owner.
- [ ] **Mixed-version BLOB exception:** Approve the bounded 6.0/6.1 SQL/stat visibility exception with full allocation/local-copy/HTTP checks and index-builder/schema/publication holds. Otherwise stop at homogeneous 6.0.8. Recommend the qualified exception with holds; do not waive an unexplained failure.
- [ ] **Rollback owner and capacity:** Name rollback/cutover owner and substitute, confirm fresh 5.10 restore capacity/credentials, and accept the unqualified 60–120-minute RTO estimate or require volume qualification first.
