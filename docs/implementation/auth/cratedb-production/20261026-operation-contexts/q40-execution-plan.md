# Q40 — crate-02 guarded restart execution plan

**Planning only, prepared October26. No Q40 mutation or monitoring loop was executed today.**
Execute only after a fresh owner **go**, around **2026-10-27 03:00 UTC** (04:00 CET).
**Execution blocker identified during planning:** a pending global relocation can keep the5.10
native action in its health-wait phase, where today's dynamic-timeout abort is not prompt.
A proposed30s initial timeout was rejected after reviewing the unchecked timed-out response path:
it could lead to native exit without the external zero-primary check. **Do not set that fuse.**
If the known pending moves remain at03:00, this plan is **NO-GO until a safe bounded cancellation
path is independently qualified**. Owner go does not waive zero primaries or this unresolved safety
condition. The sequence below is conditional, not a claim that tonight's pending-move case is solved.

Hard stop for new maintenance work: **04:30 UTC**. This is a same-image5.10.16 restart, not the6.x upgrade.
Only crate-02; never KILL/SIGKILL, force=true, forced primary promotion, REROUTE cancellation,
manual internal-marker reset, file deletion, close/reopen or shortened normal-stop grace.
See [Q37 failure and successful native abort](README.md#q37-urgent-native-abort--service-restored-october261033-utc).

## Full inventory and exact replica statements

[Read-only inventory](q40-inventory.json.gz), sampled through crate-01 at **2026-10-26T10:43:01.930781+00:00**,
contains **all145 user tables across four schemas**, all1175 shard-copy rows and zero partitions.
All145 health rows were GREEN. Grouped by schema/table/partition/shard, **35 shard groups in30 tables**
have a copy on each of crate-01/02/03. The other115 tables have no such group. Replica expressions across
all145:106 literal `0-1`, nine literal `1`,30 literal `2`; these strings are preserved verbatim.
All30 below have REQUEST durability and all block flagsfalse. No BLOB or backup-schema table has
three-node copies. Exact statements for the16 non-YepWatch tables are reference material, **not an
instruction or approval to execute them**. Their current primary owners are crate-01/03.

**Approved reduction scope remains the14 YepWatch tables.** Their17 primaries are currently the
only primaries on crate-02 (4,033,251 bytes,3.85MiB). All15 auth tables and `user_mcp_action` stay
replicas2/write-wait1. If a fresh preflight finds a primary on crate-02 in any of these16 or another
unapproved three-node-copy table, **NO-GO**: ask for expanded scope rather than changing it.
Do not treat the following30-row inventory as authorization to lower all30 tables.

| Table | Current replicas, verbatim | Current write-wait | Three-node shard groups | Scope | Exact lower statement | Exact restore statement |
| --- | --- | --- | ---: | --- | --- | --- |
| `doc.auth_account` | `2` | `1` | 1 | REFERENCE ONLY; no change approved | `ALTER TABLE "doc"."auth_account" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."auth_account" SET (number_of_replicas='2');` |
| `doc.auth_capacity` | `2` | `1` | 1 | REFERENCE ONLY; no change approved | `ALTER TABLE "doc"."auth_capacity" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."auth_capacity" SET (number_of_replicas='2');` |
| `doc.auth_jwks` | `2` | `1` | 1 | REFERENCE ONLY; no change approved | `ALTER TABLE "doc"."auth_jwks" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."auth_jwks" SET (number_of_replicas='2');` |
| `doc.auth_oauth_access_token` | `2` | `1` | 1 | REFERENCE ONLY; no change approved | `ALTER TABLE "doc"."auth_oauth_access_token" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."auth_oauth_access_token" SET (number_of_replicas='2');` |
| `doc.auth_oauth_client` | `2` | `1` | 1 | REFERENCE ONLY; no change approved | `ALTER TABLE "doc"."auth_oauth_client" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."auth_oauth_client" SET (number_of_replicas='2');` |
| `doc.auth_oauth_client_assertion` | `2` | `1` | 1 | REFERENCE ONLY; no change approved | `ALTER TABLE "doc"."auth_oauth_client_assertion" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."auth_oauth_client_assertion" SET (number_of_replicas='2');` |
| `doc.auth_oauth_client_resource` | `2` | `1` | 1 | REFERENCE ONLY; no change approved | `ALTER TABLE "doc"."auth_oauth_client_resource" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."auth_oauth_client_resource" SET (number_of_replicas='2');` |
| `doc.auth_oauth_consent` | `2` | `1` | 1 | REFERENCE ONLY; no change approved | `ALTER TABLE "doc"."auth_oauth_consent" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."auth_oauth_consent" SET (number_of_replicas='2');` |
| `doc.auth_oauth_refresh_token` | `2` | `1` | 1 | REFERENCE ONLY; no change approved | `ALTER TABLE "doc"."auth_oauth_refresh_token" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."auth_oauth_refresh_token" SET (number_of_replicas='2');` |
| `doc.auth_oauth_resource` | `2` | `1` | 1 | REFERENCE ONLY; no change approved | `ALTER TABLE "doc"."auth_oauth_resource" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."auth_oauth_resource" SET (number_of_replicas='2');` |
| `doc.auth_rate_limit` | `2` | `1` | 1 | REFERENCE ONLY; no change approved | `ALTER TABLE "doc"."auth_rate_limit" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."auth_rate_limit" SET (number_of_replicas='2');` |
| `doc.auth_session` | `2` | `1` | 1 | REFERENCE ONLY; no change approved | `ALTER TABLE "doc"."auth_session" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."auth_session" SET (number_of_replicas='2');` |
| `doc.auth_user` | `2` | `1` | 1 | REFERENCE ONLY; no change approved | `ALTER TABLE "doc"."auth_user" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."auth_user" SET (number_of_replicas='2');` |
| `doc.auth_user_email` | `2` | `1` | 1 | REFERENCE ONLY; no change approved | `ALTER TABLE "doc"."auth_user_email" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."auth_user_email" SET (number_of_replicas='2');` |
| `doc.auth_verification` | `2` | `1` | 1 | REFERENCE ONLY; no change approved | `ALTER TABLE "doc"."auth_verification" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."auth_verification" SET (number_of_replicas='2');` |
| `doc.user_mcp_action` | `2` | `1` | 3 | REFERENCE ONLY; no change approved | `ALTER TABLE "doc"."user_mcp_action" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."user_mcp_action" SET (number_of_replicas='2');` |
| `doc.yepwatch_agreement` | `2` | `3` | 1 | Q40 YepWatch | `ALTER TABLE "doc"."yepwatch_agreement" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."yepwatch_agreement" SET (number_of_replicas='2');` |
| `doc.yepwatch_candidate` | `2` | `3` | 1 | Q40 YepWatch | `ALTER TABLE "doc"."yepwatch_candidate" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."yepwatch_candidate" SET (number_of_replicas='2');` |
| `doc.yepwatch_command_receipt` | `2` | `3` | 1 | Q40 YepWatch | `ALTER TABLE "doc"."yepwatch_command_receipt" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."yepwatch_command_receipt" SET (number_of_replicas='2');` |
| `doc.yepwatch_control` | `2` | `3` | 1 | Q40 YepWatch | `ALTER TABLE "doc"."yepwatch_control" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."yepwatch_control" SET (number_of_replicas='2');` |
| `doc.yepwatch_decision` | `2` | `3` | 1 | Q40 YepWatch | `ALTER TABLE "doc"."yepwatch_decision" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."yepwatch_decision" SET (number_of_replicas='2');` |
| `doc.yepwatch_invitation` | `2` | `3` | 1 | Q40 YepWatch | `ALTER TABLE "doc"."yepwatch_invitation" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."yepwatch_invitation" SET (number_of_replicas='2');` |
| `doc.yepwatch_member_grant` | `2` | `3` | 1 | Q40 YepWatch | `ALTER TABLE "doc"."yepwatch_member_grant" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."yepwatch_member_grant" SET (number_of_replicas='2');` |
| `doc.yepwatch_member_intent` | `2` | `3` | 1 | Q40 YepWatch | `ALTER TABLE "doc"."yepwatch_member_intent" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."yepwatch_member_intent" SET (number_of_replicas='2');` |
| `doc.yepwatch_participant` | `2` | `3` | 1 | Q40 YepWatch | `ALTER TABLE "doc"."yepwatch_participant" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."yepwatch_participant" SET (number_of_replicas='2');` |
| `doc.yepwatch_proposal` | `2` | `3` | 1 | Q40 YepWatch | `ALTER TABLE "doc"."yepwatch_proposal" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."yepwatch_proposal" SET (number_of_replicas='2');` |
| `doc.yepwatch_room` | `2` | `3` | 4 | Q40 YepWatch | `ALTER TABLE "doc"."yepwatch_room" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."yepwatch_room" SET (number_of_replicas='2');` |
| `doc.yepwatch_runtime` | `2` | `3` | 1 | Q40 YepWatch | `ALTER TABLE "doc"."yepwatch_runtime" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."yepwatch_runtime" SET (number_of_replicas='2');` |
| `doc.yepwatch_ticket` | `2` | `3` | 1 | Q40 YepWatch | `ALTER TABLE "doc"."yepwatch_ticket" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."yepwatch_ticket" SET (number_of_replicas='2');` |
| `doc.yepwatch_vote` | `2` | `3` | 1 | Q40 YepWatch | `ALTER TABLE "doc"."yepwatch_vote" SET (number_of_replicas='1');` | `ALTER TABLE "doc"."yepwatch_vote" SET (number_of_replicas='2');` |

## Before admitting writes with fewer copies

Use only [q40-yepwatch-lower.sql](q40-yepwatch-lower.sql),70 ordered statements for14 tables.
For each table: block writes, RESET wait, SET wait2, lower replicas2→1, read back and remove its
originally-false write block. Do not issue an entire file as one SQL statement. The brief block
prevents writes during RESET's default1 interval. Verify the new wait2 before unblocking, and
record every successful change so partial failure can be restored exactly. If any step fails,
stop before decommission and restore changed tables; do not automatically unblock an unknown policy.
No auth/MCP wait changes, no REQUEST durability change. Two-active-copy admission checks availability
before a write; it is not a guarantee of two acknowledgements. The future owner go must cover this
explicit temporary write-policy exception as well as the replica reduction.

## SQL and host control recipes

Run from a private operator workspace with TMPDIR under `~/.cache/gw-work/644-q40`.
Use a surviving trusted-loopback coordinator, not a production .env or an application server.
The function receives SQL on stdin, keeps literals out of shell interpolation and surfaces SQL errors:

```bash
crate_sql() {
  python3 -c 'import json,sys; print(json.dumps({"stmt":sys.stdin.read()}))' |
    ssh -o BatchMode=yes root@10.0.0.11 \
      docker exec -i crate-01 curl --silent --show-error --fail-with-body \
      --max-time 7500 -H Content-Type:application/json --data-binary @- \
      http://127.0.0.1:4200/_sql
}
```

Check curl's status **and** response JSON for `error`, acknowledgement and expected rowcount.
The read-only gate/zero-primary queries include:

```sql
SELECT health,count(*),sum(missing_shards),sum(underreplicated_shards)
FROM sys.health GROUP BY health;
SELECT count(*) FROM sys.shards
WHERE primary=true AND node['id']='r0IgCe17SPOgudkQIGsRQA';
SELECT schema_name,table_name,partition_ident,id,node['name'],primary,state,routing_state,relocating_node
FROM sys.shards WHERE state<>'STARTED' OR routing_state<>'STARTED';
SELECT settings['cluster']['graceful_stop'],settings['cluster']['routing']['allocation']['enable'],
settings['cluster']['routing']['allocation']['exclude'] FROM sys.cluster;
```

The checked cron helper is archived in `q37-receipts.json.gz` under `files["cron-hold.py"]`.
Extract that exact source locally and review it; do not reimplement cron editing. Future execution:

```bash
# After owner go only; helper stdin is source, crontab listing itself uses DEVNULL.
ssh -o BatchMode=yes root@10.0.0.11 python3 - hold < "$TMPDIR/cron-hold.py"
# Save the returned state path. Restore using THAT path after all mutation/stop work:
ssh -o BatchMode=yes root@10.0.0.11 python3 - restore REVIEWED_STATE_PATH < "$TMPDIR/cron-hold.py"
```

The page watcher only writes a local alarm; a **staffed controlling operator** performs the native
abort SQL and all restoration. This is not an unattended restart script. Keep the watcher in its own
terminal/process and its controller continuously available; inability to staff abort is NO-GO.
SELECT probes use a separate10-second bounded request. Mutation timeout/disconnection is ambiguous:
read the state before any retry; never resend decommission blindly. Keep a second working SSH/SQL
session on crate-03 for abort if crate-01 becomes unavailable. Do not change credentials/HBA.

## Ordered execution and time budget

| UTC / budget | Step and required evidence |
| --- | --- |
| 02:50–03:00 /10min | Read-only fresh inventory, repeated health/operation/client gates and monitoring baseline; await go. |
| 03:00–03:05 /5min | Exact cron hold, policy/runtime capture and14-table reduction; GREEN at temporary policy. |
| 03:05–03:10 /up to5min preparation | Confirm qualified abort controller, target identity, source-copy availability; one drain attempt, maximum5min before stopping progression. |
| 03:10–03:25 /up to15min | Zero-primary recheck; host-managed unlimited-grace SIGTERM and same-container start. Expected stop/start1–5min;15min is an escalation point, never a kill deadline. |
| 03:25–03:40 /15min | All three members, allocationall, GREEN at temporary policy; restore replicas and wait for all original copies. |
| 03:40–04:20 /40min | Restore wait3, original restart/graceful settings; observe successful allocation onto crate-02 and absence of closing-lock errors for30–40min. |
| 04:20–04:30 /10min | Restore cron exactly, final health/page/policy checks and evidence handover. |

Expected **45–75 minutes**, reserve90. Today's residual primary data alone transfers in<1s at40MiB/s;
metadata, copy deletion/selection, pending global health waits and retained tasks dominate. Fresh data
movement can differ: recovery throughput is shared, replica catch-up and full GREEN are separate gates.
If the fresh primary volume/topology makes a5-minute drain implausible, **NO-GO**. The separate
abort-qualification blocker above must also be resolved. No repeated drain attempts.

1. **Gates, before any mutation:** Confirm owner go/date; all three expected IDs and5.10.16,
   GREEN on all coordinators, zero missing/underreplicated shards, no unexpected block, checks passing,
   no active snapshot and latest scheduled backup SUCCESS/recent (≤90min; record name and finish).
   Capture heap/load; require a stable10-minute baseline and no new heap/load anomaly versus tonight's
   baseline. Current three-node-copy primaries on crate-02 must remain confined to the approved14.
   Inventory operations/jobs twice≥1min apart. Record exact image/container/PID/mounts/config/restart
   policy/StopSignal and original transient/persistent graceful/allocation settings.
   Check no maintenance/deploy via host processes/units, SQL jobs, GitHub and Coolify queue.
   Start the page watcher below; require three200/<3s baseline rounds and fresh heartbeat.
2. **Shard-state gate:** No INITIALIZING or RELOCATING copies except the two explicitly acknowledged
   pending moves. At today's10:43 sample those are **doc.person_appeared_in4 primary crate-01→crate-02**
   and **doc.person_appeared_in5 replica crate-03→crate-02**, no target rows. These differ from the pair
   before Q37; do not reuse stale identities. Fresh state must match this pair or be fully settled;
   any different/new non-started copy is NO-GO. All exception source copies must remain STARTED,
   both survivors must have safe copies and all primaries must be available. Save sys.shards and
   sys.allocations, recovery stage/bytes and relevant logs. Never cancel those moves under this scope.
   **Separate cancellation-safety gate:** the presence of either allowed move still prevents claiming
   a quick native abort. Without an independently qualified abort path for health-wait, do not proceed
   even though this pair satisfies the owner's shard-state exception.
3. **Hold cron exactly:** Use the guarded [Q37 cron recipe](README.md#q37-guarded-restart-attempt--october2609521027-utc),
   `crontab -l` with stdinDEVNULL, one named backup line only, protected original copy, named-file
   installation and hash/readback; never `crontab -`. Save the exact original bytes, not a reconstructed
   schedule. Check no backup process/snapshot is already running. Restore exactly on every exit path
   once mutations/stop have ceased; do not overwrite unrelated concurrent cron edits. Record skipped runs.
4. **Lower only approved tables:** Execute the14-table file with per-step readback as above. Require
   replicas1/wait2, original blockfalse/REQUEST; all other131 policies unchanged. Wait for GREEN on all
   coordinators at this temporary policy, with only acknowledged stuck relocation exceptions.
5. **Prepare native drain and qualified abort before calling it:** This step remains blocked if the
   health-wait abort issue above is unresolved. Through crate-01 verify force=false,
   min_availabilityPRIMARIES and original timeout2h. **Do not shorten the initial native timeout**
   to create an unqualified fuse. Set crate-02 Docker restart policy `no`, allocation `primaries`
   as in the guarded runbook; verify all other settings/config unchanged. Set watcher phase `drain`
   immediately before issuing once:

   ```sql
   SET GLOBAL TRANSIENT "cluster.routing.allocation.enable" = 'primaries';
   ALTER CLUSTER DECOMMISSION 'r0IgCe17SPOgudkQIGsRQA';
   ```

   Keep decommission in a separate live session (7500s client limit), while the controlling session
   checks primary count, all source copies and page abort marker every≤5s. Allow at most5min to reach
   zero, otherwise stop progression and take the qualified abort path; if it cannot restore service,
   report immediately without improvising. A normal acknowledgement does not establish zero primaries.
6. **Zero-primary stop gate:** Twice freshly query `sys.shards` through survivors for
   primary=true/nodeID=`r0IgCe17SPOgudkQIGsRQA` and require0; immediately recheck before SIGTERM.
   Require at least one complete three-URL monitoring round begun after drain initiation, with all
   results200/≤3s; do not stop before the first in-flight drain probes can report. Verify no page
   abort flag, no missing primary, forcefalse, target exclusion still effective,
   correct PID/StopSignal unset/SIGTERM/15, unchanged config and safe acknowledged exception sources.
   If native abort removed exclusion, do not stop. No new SIGTERM after03:30 UTC.
   Set phase `stopping` only after final gate; if the node already exited normally, verify and skip stop.
   Otherwise use one unique, host-managed unit on crate-02. Immediately before this, the controller
   must exclude both an abort trigger and a previously issued1s-abort change; never race a pending
   native abort against the host stop:


   ```bash
   systemd-run --unit=gw-crate02-q40-stop-20261027T03 \
     --property=Type=exec --property=TimeoutStopSec=infinity --property=SendSIGKILL=no \
     /usr/bin/docker stop --timeout=-1 crate-02
   ```

   No force/SIGKILL, no Compose recreation. If still stopping after15min, report immediately and keep
   unlimited grace intact. A hard stop time never authorizes killing the process/unit.
7. **Start:** Only after confirmed normal exit, `docker start crate-02`, same existing container/image,
   data, ID, mounts, HBA/config. Set phase `recovery`. Verify original digest/config, no OOM/SIGKILL,
   node rejoins as the same persistent ID. Restore allocationall. The16 unchanged three-copy auth/MCP
   tables can be YELLOW while crate-02 is down; that expected missing replica is not a missing primary.
   GREEN is required before stop and after rejoin, not falsely promised during a two-node interval.
   Any missing primary/unexpected failed copy or member failure ends progression and needs owner handover.
8. **Restore original copies:** After all three nodes are present and GREEN at temporary policy,
   run [q40-yepwatch-restore-replicas.sql](q40-yepwatch-restore-replicas.sql), then require all original
   copies STARTED/STARTED and GREEN through all coordinators. Only then run
   [q40-yepwatch-restore-waits.sql](q40-yepwatch-restore-waits.sql) to restore literal wait3 behind brief
   write blocks. Verify all145 original policies, zero unexpected blocks and REQUEST unchanged.
   Restore original Docker restart policy and graceful timeout/settings layer. Never restore wait3
   before three copies are active. A recovery problem is not permission for another reduction.
9. **Verify locks and member service:** Observe sys.shards/sys.allocations/recovery progress and
   crate-02 logs every2–3min for30–40min. Require successful placement/recovery on crate-02, including
   acknowledged pending shard IDs; no new `closing shard` lock failures. Inventory all eight historical
   blocked paths from Q35, not just today's pair. Check old operation rows disappeared after the new JVM.
   Unrelated successful placement alone does not prove those eight particular stores are unlocked.
   If no relevant allocation occurs, report lock clearance unproven; do not force a REROUTE to test it.
   Keep the10-second page monitor throughout, plus read-only MCP/health checks.
10. **Finish/stop:** Restore cron byte-for-byte and verify one active schedule/no hold marker.
    Record next scheduled run and confirm it when due; do not trigger a manual backup. Final all-node
    GREEN, all copies STARTED/STARTED, all original policies, normal pages and no residual decommission.
    At04:30 stop new maintenance and hand over any incomplete recovery or unlimited stop; do not force
    completion, silently leave cron held, launch a second drain or treat an unresolved shutdown as cancelled.

## Live page loop and exact pre-SIGTERM abort

Run [q40-page-watch.py](q40-page-watch.py) locally before gates, with phase/abort/log files under the
operator's TMPDIR, and keep it running until final checks finish. It runs all three curl calls in parallel
every10 seconds, `--max-time 5`, no redirect following. Three consecutive failures are counted **per URL**;
any HTTP status other than200 or transport failure counts. During phase `drain`, **any measured time>3s**
or a per-URL failure streak≥3 writes an abort marker immediately after that probe completes (≤5s).
The controller must check the marker/heartbeat every≤5s and before SIGTERM; it is forbidden to proceed
if the watcher dies or heartbeat is>15s old. Outside drain, the same conditions are logged as alarms;
after SIGTERM there is no pending live coordinator to “cancel”, so recover the same container normally
and report any impact rather than issuing abort SQL blindly.

```bash
# Local only; future execution after go:
printf '%s' baseline > "$TMPDIR/q40-phase"
python3 q40-page-watch.py --phase-file "$TMPDIR/q40-phase" \
  --abort-file "$TMPDIR/q40-abort" --heartbeat "$TMPDIR/q40-heartbeat" \
  >> "$TMPDIR/q40-pages.jsonl" 2>&1
```

Before drain, controller verifies no old abort marker and writes phase `drain`. On a trigger or a failed
zero-primary gate, **do not send SIGTERM**. Check the target is still running, native decommission active,
forcefalse, and whether it is in health wait or active-request wait. **Only once the native action has reached the verified active-request wait** (the stage proven
in Q37), use the surviving coordinator:

```sql
SET GLOBAL TRANSIENT "cluster.graceful_stop.timeout" = '1s';
```

If still in the preceding health-wait, changing the dynamic timeout is not a qualified prompt
cancellation. That is a pre-execution NO-GO blocker, not permission to improvise during an incident.
Wait for the native abort log **and** internal marker removal and successful direct crate-02 SQL.
Only then restore the original timeout (`2h`, preserving its original layer), allocationall and restart
policy. Restore changed replicas2; require all copies/GREEN before guarded wait3 restoration and cron
restoration. Verify all three URLs3 times, each200/<3s, and GREEN on all coordinators. If no service
recovery within5min, report immediately; no restart, KILL, manual-marker reset or further improvisation.
If the daemon has already exited naturally, skip abort SQL and start only the same approved container;
record that the pre-SIGTERM abort path could no longer apply.

**Important source limit / missed by the initial proposal:** in5.10.16 `clusterHealthGet()` captures
its timeout in the health request. A dynamic setting change cannot retime that in-flight request.
Today's quick1s abort occurred after reaching `exitIfNoActiveRequests`, whose5s retry loop does read
the dynamic timeout. Moreover the handler tests only `error == null`, not `res.isTimedOut()`; then the
active-request loop checks for zero work **before** checking the timeout. Thus an initial short timeout
is not an established safe cancellation fuse: it can progress toward exit without the externally
required zero-primary check. The proposed30s initial fuse was **rejected and is not authorized SQL**.
This cannot honestly be described as a fully executable safe plan with the known stuck moves still
present. Qualify a supported bounded abort for that stage in isolation, or wait until relocation is
settled and qualify the remaining race, before authorizing execution. No production experiment today.

References: [5.10 ALTER CLUSTER](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/alter-cluster.html),
[5.10 ALTER TABLE SET/RESET](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/alter-table.html),
[tagged5.10.16 DecommissioningService](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/cluster/gracefulstop/DecommissioningService.java).
Q40 uses one unchanged version on every node; this plan gives no permission to remove copies during
mixed-version6.x upgrade hops.

## Preparation validation (today, no production mutation)

Read-only production SQL collected all145 policies/1175 copies/zero partitions. Generation checks
require30 three-node-copy tables and14 approved YepWatch tables. Nine pure watcher cases verify
three-failure threshold, per-URL reset, strict>3s threshold and transport timeouts; a local temporary
file check verifies first-trigger marker preservation. Python parses and SQL scope/count/restore
values are checked against the captured metadata. No Q40 curl loop, table setting, cron change,
decommission or restart was executed. Application suites/typecheck were not rerun for this evidence
and future-operations-only change; neither real restart nor a safe health-wait abort has been rehearsed today.
