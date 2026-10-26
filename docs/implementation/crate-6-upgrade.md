# Rolling CrateDB 5.10.16 → 6.4.6 — Q32 / #644

Q32 selects the rolling route. **This is planning, not production execution authorization.**
This revision incorporates the Fable review's seven points and supersedes the earlier per-minor
rollback-copy plan and twelve-hour estimate. Production was not changed by this preparation.

**Current start gate is NO-GO:** the [08:20–08:50 UTC observation](auth/cratedb-production/20261026-operation-contexts/README.md#read-only-rebalance-follow-up--08200850-utc-october-26)
found two unchanged replica relocations toward crate-02, no completed moves, and historical
shard-creation failures caused by shard-lock acquisition retries. Changing relocation identities
was not evidence of successful recovery. Resolve this in a separately approved task; do not cancel,
restart, KILL or waive a gate under Q32's planning approval.

Evidence: [43-release compatibility audit](../research/crate-6-upgrade-compatibility.md),
[three-node rehearsal](crate-6-upgrade/20261026-rehearsal/README.md),
[production inventory](crate-6-upgrade/20261026-preflight/README.md), and
[current guarded-stop procedure](auth/cratedb-production-rollout.md#current-stale-context-and-restart-advice--644).

## Path and checkpoints

| Hop | Complete all nodes to | Documented rolling predecessor |
| --- | --- | --- |
| 1 | **6.0.8** | >=5.10.1 |
| 2 | **6.1.6** | >=6.0.2 |
| 3 | **6.2.11** | >=6.1.2 |
| 4 | **6.3.7** | >=6.2.0 |
| 5 | **6.4.6** | >=6.3.0 |

Order **crate-02 → crate-03 → crate-01 at every hop**: fifteen replacements. Pin the
[rehearsed image digests](crate-6-upgrade/20261026-rehearsal/results.json); never substitute `latest`
or an earlier unpatched intermediate. Complete recovery, restore original table policy and finish
all three nodes before beginning another hop. A direct rolling5.10→6.4 jump is not supported by
these instructions. The [rolling guide](https://cratedb.com/docs/guide/admin/upgrade/rolling.html#version-requirements)
and target release notes govern compatibility;6.0.8's rolling sentence appears to misprint its
own target as6.0.6, while [6.0.0](https://cratedb.com/docs/crate/reference/en/6.0/appendices/release-notes/6.0.0.html)
explicitly permits >=5.10.1.

**Recommend separate complete-hop windows**, ending each day with every node on the same version.
The guide describes supported mixtures during the rolling process and completion/recovery of every
node. It does **not** provide assurance for deliberately operating a mixed cluster across multiple
days; the [system-table warning](https://cratedb.com/docs/crate/reference/en/5.10/admin/system-information.html)
only explains querying a temporary mixed state. Therefore do not schedule overnight mixed operation.
This is a conservative operating rule, not a claimed vendor-defined maximum number of mixed hours.
An unplanned mixed-version pause is an actively staffed incident/owner decision; never hurry an
unsafe node change just to reach a homogeneous checkpoint.

## Production basis and time budget

The October26 inventory found145 base tables:94 created5.10.9 and51 created5.10.16, no partitions
or closed tables, and no creation-version reindex prerequisite. All144 SQL SHOW CREATE results were
read; only the standard analyzer was observed. Repeat metadata/config checks before execution.

| Initial node | Primary copies / approximate bytes | Transfer-only floor at40MiB/s |
| --- | --- | --- |
| crate-02 | 34 /0.132GB | About3 seconds; **not** its complete stop/recovery time |
| crate-03 | 263 /17.1GB | About6.8 minutes |
| crate-01 | 273 /23.9GB | About9.5 minutes |

Primary placement changes during drains: crate-02 will not necessarily remain a cheap34-primary
node on later hops. Budget up to **24GiB of primary movement per node**, about10.2min at40MiB/s,
plus restart and replica catch-up. A receiving node's40MiB/s limit is shared by concurrent recoveries;
two recoveries do not imply80MiB/s on that node. Existing local files may be reused, but a fresh-data
lab and an incremental backup do not establish production reuse or drain throughput.

Current logical data was38.18GiB primary /75.17GiB across copies, excluding translogs. A node holds
roughly21–31GB of logical shard data. If much needs retransmission, replica recovery adds another
roughly8–13min at the same rate, before contention and metadata/sequence catch-up. Allow:

- **45–60 minutes per node**: roughly10–20min drain allowance,2–5min normal stop/start/rejoin,
  10–20min catch-up and10min stable health/heap/client verification. These are planning allowances,
  not a stop deadline; a2h graceful-drain timeout or a slow unlimited-grace normal stop can overrun them.
- **2½–3½ hours per three-node hop**, including a15–30min homogeneous soak/checkpoint.
- **Book5 hours for the first hop**, including the protected baseline, BLOB copy and first6.x repository
  snapshot; **book4 hours for each remaining hop**. Have the rollback owner available for at least
  another2h after each slot. These five windows total21 booked hours, usually across five days.
- A continuous alternative needs approximately **20–24 hours**, including checks, first full6.x
  backup and recovery reserve. Prefer complete-hop windows to reduce operator fatigue, **only if
  the owner accepts the campaign-wide rollback RPO below or qualifies write preservation**.

Revise forecasts from the first real drain/catch-up. Do not start another node unless the remaining
slot covers its forecast plus a homogeneous recovery checkpoint. Do not start another hop late in
a slot. No schedule changes, capacity increase or recovery-rate setting change is implied by this estimate.

## Gates before every hop and every node

Record through **all three coordinators**, using explicit columns in mixed versions. Obtain at least
10min of stable readings before the first change and before proceeding to another node:

1. Three expected members/IDs/versions; **all health rows GREEN**, zero missing/underreplicated copies,
   no failed cluster/node checks, original copy counts and every visible copy **STARTED/STARTED**.
   **No RELOCATING or INITIALIZING routing and no CREATED/RECOVERING/POST_RECOVERY copy.** The current
   two pending moves fail this gate even though health is GREEN. Check placement/checkpoints independently.
   Target rows are omitted by these5.10 system-table routing iterators; missing SQL target rows alone do
   not prove missing recovery. Source DONE/100% counters are historical, not target-transfer progress.
2. **Proposed heap gate: used/max <75% on every node for10min**, sampled at least every30s, with no
   upward pressure/GC-overhead pattern. Use measured `heap['max']`:17,179,869,184bytes is16GiB
   (about17.2decimalGB), so75% is12GiB. Reported75–80% operation leaves limited spare capacity for two
   survivors. If this gate cannot be met, wait or obtain a separately approved workload reduction;
   do not force GC, raise heap or relax the threshold silently. Hold the next action on any breach;
   >=85% for2min, repeated GC stalls, OOM or breaker pressure is an abort/escalation condition.
3. Load5/load15 no greater than available processors and no growing work/recovery queue; current nodes
   report16 processors and observed loads were well below16. Compare member latency/error rates with a
   recorded10min baseline. Unexpected sustained degradation stops progression. No extra load generator.
4. **Backup cron held and independently read back**, with no CREATE/DROP SNAPSHOT in progress. Save
   the exact named cron, restoration owner and deadline. Hold schema/SWAP/RENAME and index-publication
   jobs for the hop; snapshot safety was reverted in6.3.6/6.4.1. Resume only at a homogeneous checkpoint.
5. Protected5.10.16 recovery point and BLOB SHA1 manifest verified; restore capacity and credentials ready.
   Enough surviving-node disk/headroom, not just nominal free space. Prior readings showed roughly
   199–237GiB free per data filesystem and1.055TiB on the shared backup filesystem; refresh them.
6. Reviewed app patch deployed to both page/search images and relevant operator scripts, actual worker
   locks qualified, correct/missing/wrong credential reads and trusted local administration checked,
   required BLOB reads working. Preserve #562 password HBA; no user recreation or secret changes.
7. Original allocation/rebalance settings, table settings, Docker restart policies, image/config hashes,
   paths and stop signals recorded. Current stop settings are PRIMARIES/force=false/2h. No unaccounted
   exclusion, write block or previous drain. Effective settings/argv are captured in the dated evidence;
   export configuration provenance before execution, without putting credentials in receipts.

Useful metadata reads (the exact production inventory contains the complete query list):

```sql
SELECT id,name,version['number'],heap,load,os_info['available_processors'] FROM sys.nodes;
SELECT health,count(*),sum(missing_shards),sum(underreplicated_shards) FROM sys.health GROUP BY health;
SELECT state,routing_state,count(*) FROM sys.shards GROUP BY state,routing_state;
SELECT node['name'],primary,count(*),sum(size) FROM sys.shards GROUP BY node['name'],primary;
SELECT table_schema,table_name,shard_id,node_id,primary,current_state,explanation,decisions
FROM sys.allocations WHERE current_state <> 'STARTED';
SELECT table_schema,table_name,number_of_replicas,settings FROM information_schema.tables
WHERE table_schema NOT IN ('sys','information_schema','pg_catalog');
```

## Three-copy/write policy: keep only the rehearsed changes

The [exact30-table inventory](crate-6-upgrade/20261026-preflight/results.json) is15 auth tables plus
`user_mcp_action` with replicas2, wait1 and REQUEST, and14 YepWatch tables with replicas2, wait3 and
REQUEST. The rehearsal covered29; production adds `user_mcp_action`. Qualify its action-receipt path
before execution and preserve its original wait1/REQUEST semantics. Do not apply a wildcard ALTER.

For the **first two replacements of a hop**, retain all original copies/replicas2. Only the14 original
wait3 tables temporarily use wait2. Apply the rehearsed transition per reviewed table: block writes,
RESET write-wait, SET2, verify on every coordinator, then restore the original write-block state.
The brief block prevents writes during RESET's default1 interval. Restore wait3 only after rejoin and
full original replication. Never change auth or `user_mcp_action` wait1 or REQUEST durability.
`write.wait_for_active_shards` is a pre-write active-copy check, not an acknowledgement quorum.

**Never remove copies in the middle of a mixed-version hop and try to rebuild them onto older nodes.**
[NodeVersionAllocationDecider](https://github.com/crate/crate/blob/6.0.8/server/src/main/java/org/elasticsearch/cluster/routing/allocation/decider/NodeVersionAllocationDecider.java#L82)
rejects recovery from a newer primary to an older major/minor replica. The failed early-reduction
trial demonstrated this: restoring replicas did not restore GREEN.

There is one unresolved policy distinction to approve explicitly. The successful three-node rehearsal
needed replicas2→1 for the **last old node only**, after both survivors were already at the target,
to provide a destination for its remaining primaries. It then drained to zero primaries, upgraded,
restored replicas2, recovered every original copy and restored wait3. Without that last-node change,
the earlier strict zero-primary drain retained ten primaries.

**That last-node reduction really removes a copy while one old node remains.** It is an explicit bounded
exception, not compliance with an absolute “no copy removal while mixed” rule. Q32's rolling choice does
not silently authorize it. If the owner requires the absolute rule, the three-node procedure remains
NO-GO for the third node: provide compatible extra capacity and rehearse that variant first. Do not
waive zero primaries, force a stop or invent an untested primary-promotion workaround.

```sql
-- Only the reviewed original wait3 tables, with the approved brief write block:
ALTER TABLE doc.REVIEWED_TABLE SET ("blocks.write"=true);
ALTER TABLE doc.REVIEWED_TABLE RESET ("write.wait_for_active_shards");
ALTER TABLE doc.REVIEWED_TABLE SET ("write.wait_for_active_shards"='2');
-- Read back through every coordinator, then restore original blocks.write=false.
-- Only if the separate LAST-OLD-NODE exception is explicitly approved:
-- ALTER TABLE doc.REVIEWED_THREE_COPY_TABLE SET (number_of_replicas=1);
```

Require GREEN at the exact approved temporary policy before drain. After rejoin, restore allocation,
settle, restore original replicas where changed, require all original copies STARTED/STARTED, then restore
literal original write-wait. Verify all30 policies independently. Another node loss, failed recovery or
unexpected block ends progression; no further reduction.

## One protected baseline and ordinary incremental backups

The **only planned rollback target is one protected pre-upgrade5.10.16 snapshot plus its BLOB SHA1 copy**,
taken immediately before the first hop. Protect user/privilege metadata, startup/HBA configuration and
external auth payload keys as well. Briefly hold index publication while pairing SQL metadata with the
BLOB manifest; verify every referenced digest/length. Snapshots exclude BLOB tables.

The captured baseline example contained33.77GiB across567 SQL shards/58,837 files. Its41.454s elapsed
covered only1.98GiB incremental upload. [Snapshots in one repository are incremental](https://cratedb.com/docs/crate/reference/en/6.4/admin/snapshots.html#creating-a-snapshot):
later snapshots share unchanged data. **Do not budget40GiB for every hop or make per-minor protected
repository copies.** Keep the protected snapshot's whole repository/dependency set intact and outside
retention; freeze every writer/retention process for that protected5.10 repository for the campaign.
Copying a small manifest alone is insufficient. Protection/isolated restore qualification
is a prerequisite, not work hidden inside the emergency recovery reserve.

After all three nodes reach6.0.8, follow the [major-upgrade repository advice](https://cratedb.com/docs/crate/reference/en/6.4/admin/snapshots.html#creating-a-repository)
**once**: retain the5.10 repository read-only and switch the hardcoded active registration
`goodwatch-db-backup-v2` to a new disjoint6.x path. Both `backup.py` and the monitor use that identifier.
A reviewed example is old `/snapshots/v2` preserved under `goodwatch-pre6`, new shared host
`/mnt/backup-cratedb/snapshots-v6` mounted as `/snapshots-v6`, with both paths allowlisted.
Do not nest the new path inside an existing repository; preserve all unrelated node/HBA configuration.
Only registration changes are intended; DROP REPOSITORY must never mean deleting its files.

Create/verify the first6.x snapshot, then use **that same6.x repository** for ordinary incremental
snapshots at homogeneous checkpoints and between windows. Independently verify SUCCESS/no failures,
backup-helper/monitor access and BLOB backup freshness. Actual deltas may grow when segments change;
measure them, rather than assuming either zero cost or a full40GiB every time. These snapshots support
normal6.x operations; **they are not a promised downgrade recovery point for5.10 or earlier6.x minors**.

Keep backup cron held throughout each mixed hop and verify the hold before every node. Restore its exact
saved schedule only after the homogeneous backup/checkpoint, with readback; hold it again before the next
window. Keep the protected5.10 baseline unchanged throughout the campaign. No schedule is changed in prep.

## What members experience

Two coordinators keep serving traffic while one node drains/stops/rejoins. Expect slower reads during
routing convergence and recovery I/O, and occasional brief request errors: the
[rolling guide](https://cratedb.com/docs/guide/admin/upgrade/rolling.html) explicitly warns distributed
requests can fail. This is reduced disruption, not a zero-error guarantee or a full-site outage plan.

The webapp patch recognizes both5.10 `Participating node … disconnected` and6.x `Coordinator node …
disconnected`, plus existing transport/routing errors. Reads fail over within their existing timeout;
exhausted budgets can still show a page/search error. Recovery errors alone do not exclude a healthy
coordinator. Generic dispatched mutations are **not blindly replayed**: receipt/CAS/readback paths may
confirm success, while ambiguous writes must remain ambiguous. Members can see a failed action or need
a status refresh. Brief approved per-table write blocks can also reject relevant writes; do not tell
members to repeat a non-idempotent action without its receipt/status check. Background workers and
catalog latency may slow while replicas catch up. Review live error/latency signals before the next swap.

## Per-node execution template — future approval only

1. Pass **all gates above**, including cron hold,10min stable health/heap and sufficient slot remaining.
   Verify the target/node ID and exactly which version is on both survivors. Apply only the approved table
   policy; for the last old node, obtain the explicit exception or qualified capacity variant described above.
2. Set the target's Docker restart policy to `no`, preserving its original for rejoin. Preserve
   PRIMARIES/force=false/2h and set allocation to `primaries` as in the guarded runbook. Through a surviving
   trusted-loopback coordinator, issue `ALTER CLUSTER DECOMMISSION 'crate-0N'`. Acknowledgement is not clearance.
3. Freshly verify zero primaries on the target, no missing primary, no unresolved target relocation,
   exclusion still effective and force=false. Re-read immediately before any stop: a timed-out decommission
   can restore placement. Lost SSH/HTTP acknowledgement is not permission to repeat a mutation blindly.
4. If already exited naturally, verify exit/no OOM and surviving availability. If still running, verify
   StopSignal unset/SIGTERM/15 and use the host-managed unlimited-grace stop with a unique unit:

   ```bash
   systemd-run --unit="gw-crate6-stop-UNIQUE" --property=Type=exec \
     --property=TimeoutStopSec=infinity --property=SendSIGKILL=no \
     /usr/bin/docker stop --timeout=-1 crate-0N
   ```

   After15min request an owner decision while leaving the wait intact. Never shorten grace, force=true,
   KILL/KILL ALL, SIGKILL or use Compose to stop a running target. TERM itself does not perform a drain.
5. Once stopped, recreate only that node with the reviewed target digest, same data/node identity,
   approved repository mounts and unchanged HBA/credentials/configuration. Never reopen its data with an
   older major/minor image. Require same ID, correct version and all three members on rejoin.
6. Restore allocation and original table policy in the proven order, then original Docker restart policy.
   Require all original copies STARTED/STARTED, GREEN, no pending relocation, original write-wait/REQUEST,
   no unaccounted write block, healthy heap/load and client/access canaries. No next node until these pass.
7. At the end of each complete hop: all three at the target,15–30min soak, authenticated page/search/worker,
   BLOB, monitoring, backup and auth/feedback/typed-room canaries; verified ordinary snapshot; saved schedule
   restored/read back. Overnight only in this homogeneous recovered state. No blanket production test writes.

Use the runbook's SSH `crate_sql` recipe; operator scratch is under `~/.cache/gw-work/644`, never `/tmp`.
Do not put production `.env` into any preview/test server. Preserve role DENYs and trusted loopback;
negative BLOB mutation tests belong to disposable fixtures, never real production objects.

## BLOB grant recommendation

**Recommend `GRANT DQL ON SCHEMA blob TO goodwatch_search` before the first6.2.11 node**, under explicit
execution approval. Current inventory has one table, `blob.search_index_files`:21 objects/131.27MiB per
copy. The owner controls future BLOB table creation, and `goodwatch_windmill` already has schema-wide
DQL/DML/DDL for index publication. This is a reasonable reader scope for this deployment.

The6.4.6 lab proved schema DQL permits GET/HEAD, while table-only DQL failed because the HTTP path checks
the internal index identifier. Retain no DML/DDL for search, preserve password enforcement and verify
GET/HEAD/redirects. The grant intentionally covers future BLOB tables too; do not rely on table-level
DENY to narrow this HTTP bug. Future sensitive BLOB data needs a deliberate privilege/design review.

## Abort, rollback and RPO

Abort/hold on any failed gate, missing primary, second node loss, unexplained policy drift, failed backup,
unsafe disk/heap/GC/load, broken permissions/client behavior or unexpected write outcome. A stuck target
lock or new pending relocation is not permission to cancel it under this plan. At a healthy homogeneous
checkpoint, stop progression and restore the agreed schedules/settings; otherwise remain actively staffed
and escalate. Preserve observations and receipts; do not race image downgrades.

**Rollback from any6.x stage is restore-based to5.10.16**, using fresh data directories and the single
protected pre-upgrade snapshot plus paired BLOB copy. There is no in-place major/minor downgrade and no
planned rollback to6.0/6.1/6.2/6.3 checkpoints. The
[planning guide](https://cratedb.com/docs/guide/admin/upgrade/planning.html#define-a-rollback-plan)
requires backup-based recovery for major/minor transitions. Restore table data and USERMANAGEMENT with
operator authority, preserve HBA/configuration/payload keys and verify data, identities, grants, BLOB
hashes, original policies and GREEN replication before an explicitly owned cutover. Do not blindly
RESTORE ALL over live metadata or grant AL to the routine backup user. Never let two clusters write
one repository, and never run5.10 against a directory opened by6.x.

The33.77GiB captured recovery set implies14.4min serial transfer at40MiB/s; at10–20MiB/s effective shared
read rate it is29–58min. Retain a **60–120min recovery planning allowance**, including fresh startup,
replicas, BLOB/auth/client checks and cutover. It remains an estimate until a full-volume isolated restore
qualifies it. The earlier drill proved a small5.10 snapshot restores forward into6.4; it did not establish
production-volume RTO. Do not restore anything in production as a qualification test.

RPO options, chosen before the first node:

- **Accept the loss window:** every write after the protected5.10 snapshot can be lost on rollback,
  including member actions/auth records and ingestion. With five daily windows this can span several
  days; later6.x snapshots do not shorten the planned5.10 rollback point. Set an explicit maximum
  elapsed loss window and stop/reschedule if it is exceeded.
- **Preserve writes:** qualify either an all-writer freeze/read-only maintenance period, or a durable
  mutation journal/queue with tested5.10 replay, ordering, idempotency and external/auth/BLOB handling.
  The latter is additional implementation work, not an existing guarantee. Queueing only Windmill jobs,
  ordinary HTTP retries and keyed fixture writes do not preserve all member mutations. A days-long
  freeze has substantial member impact; a continuous window may be preferable if that is the only option.

## Owner approvals

- [ ] **Window/dates:** choose five homogeneous windows (first5h, then4h each) or a20–24h continuous slot;
  name operators, backup/cron restoration responsibility and recovery standby. Approve exact commit/digests/config paths.
- [ ] **Heap threshold:** approve <75% for10min on every node, plus the load/GC hold/abort gates; record any revised number explicitly.
- [ ] **Write policy:** approve the exact30-table brief write blocks/wait changes and the bounded last-old-node copy exception,
  or require no removal while mixed and qualify extra capacity first. No early replica removal or waived zero-primary gate.
- [ ] **RPO choice:** accept an explicit snapshot-to-rollback loss window (including several days if split), or fund/qualify complete write preservation.
- [ ] **BLOB grant:** approve schema DQL for `goodwatch_search`, including owner-controlled future BLOB tables; retain no search DML/DDL.
- [ ] **Rollback owner:** name the person/substitute authorized to restore5.10.16 in fresh directories, validate/reconcile writes and order cutover;
  approve isolated restore capacity and qualify the60–120min recovery allowance before execution.
