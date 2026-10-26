# Q43 — plain restart of crate-02

**Planning only. Wait for the owner's explicit go at03:00 UTC on2026-10-27 (04:00 CET).**
This replaces the Q40 drain procedure. The route is a **plain normal stop/start of crate-02**, with
its existing5.10.16 image/container/data/config. There is **no decommission, drain, zero-primary gate
or replica lowering**. Never KILL/SIGKILL, force a stop, shorten normal-stop grace, promote a stale
primary, close/reopen tables, delete lock files or restart a second time. No restart was executed
while preparing this revision. Only the separately approved Q44 backup rescue was executed today.

**No SIGTERM after03:30 UTC. Hard stop for new maintenance work04:30 UTC.** A running unlimited-grace
stop is never killed to meet either time. At a failed gate, stop progression and use the phase-specific
handover below. Keep a staffed operator, a second SSH session and the independent page watcher.

## Current evidence and scope

- Rebalance is already **none** on every coordinator under the owner's12:50 hold; allocation isall.
- Q44 target-only cancel of person_worked_on4 oncrate-02 at13:17:08 preserved the primary oncrate-01
  and unblocked `hourly_20261026_130501`: **SUCCESS13:17:09.276,567 shards, no failures**, all coordinators.
  The scheduled helper finished13:18:34. [Action receipts](q44-target-cancel.json).
- Latest all-node checks after that action:145 GREEN relations, no missing/underreplicated copies;
  only person_appeared_in5 **replica** oncrate-03 relocating towardcrate-02. Revalidate tonight.
- [Full145-table inventory](q40-inventory.json.gz):30 tables have replicas`2` (15 auth,14 YepWatch,
  user_mcp_action),106 have literal`0-1`, nine have literal`1`. No partitions were present at that
  inspection. Re-capture live settings for every schema/table/partition tonight rather than relying
  on this historical inventory. All replica expressions remain unchanged throughout Q43.
- Only14 YepWatch tables change `write.wait_for_active_shards` from3 to2 temporarily. Their REQUEST
  durability, original false write blocks and replica count2 are preserved/restored exactly.
- **Q43 changes the previous rebalance restoration order:** after rejoin/GREEN/original policies,
  enableall to test real placement, then observe20–30min. A recurring shard-lock error immediately
  returns rebalance tonone. Successful new placement plus no lock errors is the agreed proof.

## Window and observed Windmill conflicts

Target run2026-10-27 **03:00–04:30 UTC**, gates02:50–03:00. Normal expectation45–75min including
20–30min observation; stop/start is normally minutes but has unlimited grace. Reserve the full90min.
If the02:05 snapshot is still IN_PROGRESS at03:00, **wait for it**. Do not stop a node mid-snapshot.
If it cannot complete with enough time for safe preparation and SIGTERM by03:30, do not restart.

Read-only live Windmill API inspection at13:19–13:21 found **56 schedules,53 enabled**. Cron expressions
were evaluated seconds-first in each schedule's actual timezone for03:00≤time≤04:30 UTC onOctober27;
Europe/Berlin is UTC+1 then. Five recent completed root jobs per relevant schedule supplied runtime
context, not a guarantee of future cost. [Sanitized evidence](q43-windmill-evidence.json.gz) excludes
arguments, resources, tokens and logs. Some enabled jobs **conflict with the no-heavy-job gate**:

| Enabled schedule | Trigger UTC in window | Maximum runtime among five recent root runs | Concern |
| --- | --- | ---: | --- |
| f/tmdb_api/provider_detector | 03:00,04:00 | 3602.5s | Hour-long provider work; must classify/resolve |
| f/imdb_datasets/ingest | 03:00 | 163.8s | Bulk ingest, Mongo writes and Crate delete/update paths |
| f/sync/copy/tmdb_details | 03:00 | 553.7s | Bulk catalog writes/deletes to Crate |
| f/social/discover_mastodon | 03:10 | 341.3s | Long-running flow |
| f/social/discover_bluesky | 03:40 | 2880.0s | Long-running flow |
| f/social/discover_rss | 03:20,04:20 | 308.0s | Long-running flow |
| f/critic_sites/crawl_rotten_tomatoes | 03:05,03:35,04:05 | 807.6s | Repeated crawl workload |
| f/sync/copy/title_snapshot | 03:45 | 59.1s | Bulk snapshot/copy; assess load, not runtime alone |
| f/sync/copy/dna_data | 04:00 | 87.5s | Bulk copy; assess load |
| f/sync/copy/vector_data | 04:30 boundary | 400.0s | Bulk/vector copy at the hard-stop boundary |
| f/rotten_web/rotten_tomatoes_init_ratings | 04:00 | 1562.4s | Long-running initialization flow |

Recurring priority/provider/API crawlers also trigger every15–60s. Some earlier jobs, such as00:00
language ingestion (configured three-hour budget),02:00 DNA initialization and02:05 DNA generation,
may carry into the window; inspect live queue/active root jobs and descendants, not just next triggers.
Recent successful runtime is not a sufficient test for a heavy job or a guarantee it will have ended.

**The schedule gate is not currently cleared.** Owner must resolve conflicting heavy work for this
window or choose another window. The04:30 boundary is included conservatively. Current13:25 deployment checks had no queued/running
Coolify deployment and the latest12 GitHub runs were completed; these do not predict tonight.
The only repository cron workflow found was Saturday06:00 UTC index-record, outside this window.
No Windmill schedule was disabled, rescheduled or cancelled in prep;
Q43 planning does not authorize those changes. Do not silently pause all schedules or count the
routine monitoring jobs as an approved workload exception. Re-read the API at02:50 even after a decision.

## Common read/write route and evidence

Set local TMPDIR to `~/.cache/gw-work/644-q43`; keep scratch/private originals there, never/tmp.
Use trusted loopback administration through a survivor. SQL goes on stdin, JSON encoded locally:

```bash
crate_sql() {
  python3 -c 'import json,sys; print(json.dumps({"stmt":sys.stdin.read()}))' |
    ssh -o BatchMode=yes root@10.0.0.11 \
      docker exec -i crate-01 curl --silent --show-error --fail-with-body \
      --max-time 30 -H Content-Type:application/json --data-binary @- \
      http://127.0.0.1:4200/_sql
}
```

Check transport success **and** JSON `error`/acknowledgement/rowcount. A lost acknowledgement is
ambiguous: inspect state, do not replay blindly. Maintain the equivalent crate-03 route for survivor
checks. Every gate/readback uses **all three coordinators** while all are up, both survivors while
crate-02 is down, and all three again after rejoin. Every settings capture includes **both** controls:

```sql
SELECT settings['cluster']['routing']['allocation']['enable'],
       settings['cluster']['routing']['rebalance']['enable'],
       settings['cluster']['graceful_stop'] FROM sys.cluster;
SELECT id,name,version['number'],heap,load FROM sys.nodes ORDER BY name;
SELECT health,count(*),sum(missing_shards),sum(underreplicated_shards)
FROM sys.health GROUP BY health;
SELECT schema_name,table_name,partition_ident,id,node['name'],primary,state,routing_state,relocating_node
FROM sys.shards WHERE state<>'STARTED' OR routing_state<>'STARTED';
SELECT repository,name,state,started,finished,total_shards,failures
FROM sys.snapshots ORDER BY started DESC LIMIT 8;
SELECT repository,name,state,started FROM sys.snapshots WHERE state='IN_PROGRESS';
SELECT table_schema,table_name,number_of_shards,number_of_replicas,
       settings['write']['wait_for_active_shards'],settings['translog']['durability'],settings['blocks']
FROM information_schema.tables WHERE table_schema NOT IN ('sys','information_schema','pg_catalog')
ORDER BY table_schema,table_name;
```

Also capture partition settings if present, full shard/copy inventory, node checks, original block
flags, current replica expression strings, current image digest/container ID/PID/start time/mounts,
StopSignal and Docker restart policy. Preserve sensitive raw runtime/cron originals privately; commit
only sanitized metadata and hashes. Verify image/config unchanged against that baseline after start.

## Page watcher and phase boundaries

Run [q40-page-watch.py](q40-page-watch.py), updated for Q43, **every10s throughout** gates, stop/start,
recovery and final observation. Five concurrent curl probes, each5s maximum, discard bodies:

| Endpoint | Expected status |
| --- | ---: |
| /movie/629-the-usual-suspects | 200 |
| /show/1396-breaking-bad | 200 |
| /discover | 200 |
| /mcp, unauthenticated | 401 |
| /.well-known/oauth-protected-resource/mcp | 200 |

First unexpected status/transport failure or any request>3s writes a sticky local alarm. Expected MCP401
is healthy, not a failure. Heartbeat must be≤15s old; a dead watcher is an alarm. The watcher never
changes production. A staffed controller checks its marker/heartbeat every≤5s and immediately before
SIGTERM. Do not discard an alarm and retry a restart. Logs include probe-start times so a completed
round can be verified to have begun after the final settings changes.

```bash
# Future execution after go; use new empty marker paths for this attempt.
printf '%s' baseline > "$TMPDIR/phase"
python3 q40-page-watch.py --phase-file "$TMPDIR/phase" \
  --abort-file "$TMPDIR/abort" --heartbeat "$TMPDIR/heartbeat" \
  --stop-file "$TMPDIR/stop-watcher" >> "$TMPDIR/pages.jsonl" 2>&1
```

The watcher runs in its own terminal/process. Controller phases:baseline,pre_stop,stopping,recovery,
rebalancing,complete. Before SIGTERM, an alarm means reverse the preparation settings and stop.
After SIGTERM, report impact immediately; there is no safe pretend-cancellation of a normal stop.
Follow only the approved normal stop/start recovery and handover rules below, with unlimited grace.

## Ordered execution

### 1. Gates02:50–03:00 UTC

Require owner go, **three expected nodes/IDs, all5.10.16**,145 GREEN health rows on all coordinators,
zero missing/underreplicated shards, passing checks, no unexpected write blocks and original policies.
Capture heap/load and require a stable baseline without a new load/heap anomaly. Confirm each survivor
has active copies needed for safe primary promotion when crate-02 leaves; do not assume GREEN alone
lists which copies/primaries are on the target. There is no zero-primary requirement.

Require latest **hourly snapshot SUCCESS**, record exact name/finish/no failures/shard count, and
**none IN_PROGRESS**, no pending deletion/restore or active backup process. The02:05 hourly run is
expected; if still in progress at03:00, wait. Recheck immediately before SIGTERM after cron hold.
Q44 below can rescue a genuinely stalled snapshot; it does not permit stopping during it.

Require **no RELOCATING primary anywhere**. A relocating replica is acceptable only towardcrate-02
(`r0IgCe17SPOgudkQIGsRQA`), with its source STARTED oncrate-01 orcrate-03. Record every identity;
any initializing target row must be the matching counterpart of that allowed replica move oncrate-02.
No unrelated initializing copies or survivor-to-survivor moves. Stop on a different unsafe state.

Require no deploy/maintenance running or scheduled03:00–04:30: read GitHub deployment/workspace sync
runs and Coolify deployment queue; owner confirms no main deploy during the window. Read Windmill
`GET schedules/list` in full, timezones/seconds included, and live `GET jobs/queue/list` (paginated,
root jobs and descendants). Resolve the bulk/long-running conflicts above and any carry-over job.
Do not POST/run a preview job as a read-only gate. Do not mutate schedules without separate approval.

Start watcher and require **three complete healthy baseline rounds**. Confirm separate operator access
to survivors and target; capture Docker StopSignal/PID/image/config/mounts/restart policy (expectedalways).
Settings at entry:allocationall/rebalancenone; retain gracefulPRIMARIES/forcefalse/2h unchanged.
An unmet gate is NO-GO; there is no decommission to cancel or timeout to shorten.

### 2. Hold only the backup cron, byte-for-byte

Use **the exact Q37 helper**, archived in `q37-receipts.json.gz`, `files["cron-hold.py"]`. Extract it
locally and review; do not reimplement it. It uses `crontab -l` with stdinDEVNULL, exactly one named
backup line, protected original bytes, named-file installation and exact hash/readback. Never use
`crontab -`. It has a historical Q37 marker/path name; use its returned state path, not a guessed one.

```bash
ssh -o BatchMode=yes root@10.0.0.11 python3 - hold < "$TMPDIR/cron-hold.py"
# Save returned state path privately; verify readback/hash and no active backup first.
```

Do not hold while the02:05 job is still running and assume it cancelled that job. Resolve/wait for
that job before changing node state. Record which later hourly run(s) the hold may skip. If a
concurrent cron edit occurs, helper refuses overwrite; stop and report rather than reconstructing it.

### 3. Temporarily change YepWatch write-wait3→2; replicas stay2

[q40-yepwatch-lower.sql](q40-yepwatch-lower.sql) has been revised for Q43: **56 statements, no
number_of_replicas statements**. Exactly14 tables:agreement,candidate,command_receipt,control,
decision,invitation,member_grant,member_intent,participant,proposal,room,runtime,ticket,vote, each
with the `doc.yepwatch_` prefix. For each table separately:

```sql
-- Example; the file enumerates all14 names.
ALTER TABLE doc.yepwatch_agreement SET ("blocks.write"=true);
ALTER TABLE doc.yepwatch_agreement RESET ("write.wait_for_active_shards");
ALTER TABLE doc.yepwatch_agreement SET ("write.wait_for_active_shards"='2');
-- Read backwait2 while blocked, through all coordinators, then:
ALTER TABLE doc.yepwatch_agreement SET ("blocks.write"=false);
```

Submit one statement at a time and stop on error. Track changes so partial preparation can be reversed.
The brief write block protects RESET's default1 interval. Never unblock an unknown policy. Preserve
replicas2, REQUEST durability and original block flags. All auth/MCP waits remain1. Active-copy admission
checks availability before a write; it does not promise acknowledgements from a particular count.

### 4. Prepare the normal stop

On crate-02 set Docker restart policy tono (`docker update --restart=no crate-02`), verify readback,
then through a survivor:

```sql
SET GLOBAL TRANSIENT "cluster.routing.allocation.enable" = 'primaries';
```

Capture/read back **allocationprimaries AND rebalancenone** on every coordinator. No graceful-stop
setting change, no replica change, no internal decommission setting. Leave rebalancenone unchanged.
Require a complete healthy watcher round begun after these changes, no alarm and fresh heartbeat.

### 5. Final gate, then normal unlimited-grace SIGTERM

Recheck three members/GREEN/all primaries active, no IN_PROGRESS snapshot/active backup, allowed
replica-only relocation state, exact14 temporary waits2 and unchanged replicas, healthy watcher,
StopSignal unset/SIGTERM/15 and unchanged target container/PID/config/image. Capture both allocation
and rebalance again:primaries/none. Recheck the alarm immediately before dispatch. **No zero-primary
gate. No SIGTERM after03:30 UTC**; if preparation finishes too late, reverse it and stop.

Set watcher phasestopping only when dispatching the confirmed stop. One unique host-managed unit
oncrate-02; normal configured SIGTERM, unlimited grace:

```bash
systemd-run --unit=gw-crate02-q43-stop-20261027T03 \
  --property=Type=exec --property=TimeoutStopSec=infinity --property=SendSIGKILL=no \
  /usr/bin/docker stop --timeout=-1 crate-02
```

Keep separate observation of container state, PID and unit status. No second stop command, stopping
that unit, timeout reduction, dockerkill or SIGKILL. A lost SSH acknowledgement is not a reason to
repeat the action. If it is still stopping after15min, keep the unlimited-grace wait and hand over
as described below; do not proceed to a second attempt or another node.

### 6. Start the same container and restore allocation

Only after confirmed normal exit, verify no OOM/SIGKILL and original container/data/config identity:

```bash
docker start crate-02
```

Set watcher phaserecovery. Wait for **the same persistent node ID** (`r0IgCe17SPOgudkQIGsRQA`) on
all coordinators, version5.10.16, expected digest/mounts/config and a new JVM PID/start time. No
Compose recreate, image update, HBA change or automatic retry loop. Then:

```sql
SET GLOBAL TRANSIENT "cluster.routing.allocation.enable" = 'all';
```

Read back **allocationall/rebalancenone** through every coordinator. Wait for GREEN, original
replication and STARTED copies. Do not restore write-wait3 with only two nodes or before three
active copies for the YepWatch shards. Keep restart policyno until stable recovery.

### 7. Restore original write policy and restart policy

Require all three members, GREEN on every coordinator and **all three original copies of each
YepWatch shard STARTED/STARTED**. Run [q40-yepwatch-restore-waits.sql](q40-yepwatch-restore-waits.sql):
56 statements behind the brief per-table write block, RESET then literal3, readback before unblocking.
Every replica expression stays exactly original; the old restore-replicas file is historical and
is not part of Q43. Restore Docker restart policyalways and verify it.

Compare **all145 original table policies**, every schema/partition, literal replica expression,
write-wait, REQUEST durability and original block flags. If the table inventory changed, account for
it before proceeding. No missing/underreplicated copies, no unaccounted write block. Settings are
still allocationall/rebalancenone; capture both. Verify crate-02's pre-restart old operation contexts
are gone without issuing KILL, and record remaining/new rows accurately.

### 8. Enable rebalancing and prove lock clearance over20–30min

Q43 explicitly authorizes enabling balancing **after** the preceding rejoin/full-policy/GREEN gates,
then observing actual placement, rather than requiring placement proof before enabling it:

```sql
SET GLOBAL TRANSIENT "cluster.routing.rebalance.enable" = 'all';
```

Set watcher phaserebalancing. Read back **allocationall/rebalanceall** through every coordinator.
Sample sys.shards/sys.allocations and target recovery stage/bytes every2–3min, plus scoped crate-02
logs from its new JVM start, for20–30min. Require **at least one successful move onto crate-02**
(target recovery progresses to STARTED, relocation finishes) and **no new
ShardLockObtainFailedException**/closing-shard lock error in crate-02 logs. Record table/shard,
roles/source/target, timings and progress; unchanged source rows or GREEN alone are not proof.
Keep the five-endpoint watcher throughout. Do not force a test REROUTE or fabricate success from
absence of attempted allocations.

If **any lock error recurs**, immediately:

```sql
SET GLOBAL TRANSIENT "cluster.routing.rebalance.enable" = 'none';
```

Capture/read back **allocationall/rebalancenone**, preserve evidence, **no second restart**, report.
A watcher alarm during this rebalancing test also returns to none and stops progression.
If no successful move is observed before the hard stop, clearance remains unproven: return to the
previous holdnone and hand over for a decision. Do not leave a failed lock test as silently enabled
balancing. If proof succeeds, leave allocationall/rebalanceall and record the successful observation.

### 9. Restore cron exactly and hand over

Restore using the **returned Q37 helper state path**:

```bash
ssh -o BatchMode=yes root@10.0.0.11 python3 - restore REVIEWED_STATE_PATH < "$TMPDIR/cron-hold.py"
```

Read back byte-for-byte hash and one active original job/no hold marker. Do not overwrite unrelated
concurrent edits. Record skipped hours and the next actual `5 * * * *` UTC run; if restored before04:05,
next is04:05, otherwise05:05. Do not trigger a manual substitute. Record verification pending until
the next scheduled run is actually observed. Final normal success:three nodes, original table policies,
GREEN/all copies started, restartalways, allocationall/rebalanceall, healthy watcher and lock proof.
**04:30 hard stop** for new work. Stop only the local watcher after final checks/handover. No push.

## Abort and two-node handover rules

| Phase | Required action |
| --- | --- |
| Before step5/SIGTERM, any failed gate/page alarm/error | Stop progression. With all3 GREEN and3 copies available, restore changed wait3 behind blocks, original blocks/restartalways, allocationall, **rebalancenone**, and exact cron. Verify every readback. If those restoration gates fail, report the partial state; do not force writes or unblock unknown policy. No restart. |
| After SIGTERM, still stopping at15min | Keep the host-managed unlimited-grace unit running. Confirm two survivor members/all primaries available; YELLOW on the30 fixed replicas2 tables is expected with2 nodes, other copy deficits must be accounted for. Keep wait2, unchanged replicas, restartno, allocationprimaries and rebalancenone. Do not restore wait3 with2 nodes. Report/handover; no further start/stop action without an owner response, no SIGKILL or second restart. |
| Container exited but dockerstart fails, or identity/rejoin is wrong | No automatic second start/recreate/restart. Keep the safe two-node cluster and same temporary policy/settings above; capture logs/runtime and report. No wait3 with2 nodes. |
| Page alarm after SIGTERM | Report immediately. A normal stop cannot be cancelled with the decommission timeout trick. Continue only the already approved safe normal stop/start recovery if it completes normally; apply the15min/start-failure handover, no escalation/extra attempt. |
| Rejoined but recovery/policy verification fails | Stop progression; leave wait2 until3 active copies/GREEN permit restoration. Keep rebalance none, allocationall once rejoined, report exact state. No further reduction or second restart. |
| Lock error or watcher alarm during step8 rebalancing | Rebalance none again, allocation remainsall; verify both settings, no second restart, report evidence. |

For any handover, state membership, missing-primary count, every changed table/write block, Docker
unit/PID/restart policy, **both allocation and rebalance**, cron state/hash, latest snapshot and page
results. Never call a still-running stop cancelled. If any primary is missing, report urgently; no
manual force promotion or other unapproved repair. Restore exact backup cron on a handover once
survivor primaries are stably STARTED and no conflicting snapshot/job is active; otherwise report
explicitly why it remains held and obtain owner ownership, not a silent indefinite hold. Allocation
remainsprimaries until the approved rejoin step or a new owner decision.

## Q44 backup rescue before tonight, including a stalled02:05 run

Skipping a backup is acceptable. Do not cancel merely because a move exists. Only if a **running
backup is demonstrably stalled on a relocating primary towardcrate-02**, fresh all-coordinator reads
verify its STARTED source on a survivor and its active survivor replica, and page checks pass, Q44
allows **target-only** cancellation oncrate-02, **without allow_primary**. Never cancel a source or
replica, never substitute a different copy after failed lookup, and record each exact statement/time,
pre/post roles and backup outcome. The13:17 action is the existing example in [receipts](q44-target-cancel.json).
No proactive cancellations, DROP or manual snapshot under Q44. After any action, still wait for the
02:05 snapshot to finish SUCCESS/no IN_PROGRESS before step5; do not stop a node mid-snapshot.

## Preparation verification and limits

Local tests cover all5 expected statuses (including MCP401), first-failure/slow-page alarms, transport
failure, sticky markers and5s curl budget; no production HTTP is sent by those tests. The write-wait
files are checked against the14-table inventory:56 lower/56 restore statements and **no replica
mutation in the Q43 lowering file**. Live schedule API/timezone/history checks exposed unresolved
workload conflicts; no schedule/job was changed. No Q43 SIGTERM/start or write-policy change has run.
No application code changed; application suites/typecheck were not rerun. This is a reviewable plan awaiting go **and fresh passing gates**, not a scheduled restart.
