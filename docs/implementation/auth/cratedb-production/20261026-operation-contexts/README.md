# #644: operation-context investigation, 2026-10-26

## October28 backup repair — scheduled00:05 SUCCESS; next upgrade awaitsGO

OwnerQ64's two-statement repair completed23:59:25UTC: V2 nowwrites to
`/snapshots/q65-mixed-20261027`; protected`/snapshots/v2` staysread-only/untouched. Cronneverheld.
`hourly_20261028_000501` and`daily_20261028_000501` areSUCCESS567/no failures onall3coordinators;
helperfinished00:13:34UTC. Cluster145GREEN/1175STARTED; pagewatchhealthy, no gap.
[Execution and evidence](20261028-backup-repair.md), [summary](20261028-backup-repair-summary.json).
The next-night[runbook](../../../crate-6-upgrade.md) resumes03/01 thenfourhops, accepts onlyqualified
check3, retains aworking V2 throughout;October28 23:00–October29 04:00UTC. **Nothingarmed; awaitGO.**

## Q65 read-only follow-up — backups, persisted metadata and check3

[Findings and exact proposed repair](q65-findings.md), [version-pinned source research](q65-upstream.md),
[summary](q65-summary.json), [metadata comparison](q65-metadata-comparison.json),
[read-only evidence](q65-evidence.json.gz). No production change or armed action.

**Corrections to Q64:** no hourly run had failed at23:46 UTC:22:05 succeeded,23:05 was deliberately
skipped,00:05 is pending. V2 was removed by Q64 at23:10:01, so its next CREATE will fail unless repaired.
All3 persisted index metadata settings are wait3;6.0's persisted relation metadata is stale at2.
Normal SQL write enforcement reads the index setting3 (source inference, no production write test).
Check3 is the expected future7.x advisory for all145 five.x-created tables, not a6.0 readability failure.
See the report for isolated-writer proposal and mixed-cluster restrictions; nothing resumes automatically.

## Q64 October27 rolling upgrade — stopped after crate-02 to6.0.8

Only crate-02 reached6.0.8; crate-01/03 remain5.10.16. RecoveredGREEN, then stopped at the
first post-node gate (future-major table-recreation advisory). A separate mixed-coordinator YepWatch
policy readback disagreement remains after restoration. Schedules/cron restored exactly; the V2
writer registration is absent, so hourly backups are not yet operational. Rebalance remainsnone;
no automatic continuation or rollback. [Execution, exact residual state and decision](q64-execution.md),
[summary](q64-summary.json), [receipts](q64-receipts.json.gz), [watcher](q64-pages.jsonl.gz).

The initial read-only inspection of the production cluster was at **00:11:04–00:12:38 UTC** through each of
crate-01/02/03. Starting revision: `origin/main` **bb1265d4a**. No production KILL, restart, decommission,
setting change, client repair, snapshot mutation or file write was performed during that initial inspection.
The separately authorized Q37 production drain attempt below did change allocation/restart policy
and temporarily hold the backup cron; those changes were restored.
The backup failover part is already complete (`ee610dd1d`); its actual production failover
is recorded in [the enforcement execution](../20261015-enforcement/README.md).

## Q50 October27 plain restart — completed, watcher abort before rebalance

Owner-authorized plain crate-02 restart exited normally08:31:15 UTC and rejoined with its original
identity. At08:32:54, discover returned200 in4.376s and triggered the mandatory3s abort. Stopped
progression; no rebalance test or second restart. Safe restoration completed08:34:31:145 GREEN on
all coordinators, all145 policies restored (YepWatch waits3), Dockeralways, allocationall, cron
byte-for-byte restored; **rebalance remainsnone**. crate-02's112 historical orphaned operations are
gone. Lock clearance remains unproven because the observed rebalance phase was omitted.

[Execution and limitations](q50-execution.md), [receipts](q50-receipts.json.gz),
[watcher samples](q50-pages.jsonl.gz), [failed Windmill jobs](q50-windmill-failures.json).
One job failed: vector_data at08:31:52.979, Crate client401 Unauthorized; no rerun performed.
Next hourly09:05 is not yet due at handover. No further production action is armed.

## October27 immediate GO — stopped at first workload gate,07:06 UTC

Owner replaced the11:30 proposal with immediate gates around07:05 UTC, SIGTERM cutoff07:45 and
hard stop08:45. The first instruction was to check heavy work and report before starting if any was
running. **Stopped on that first check; no watcher/full Crate gates or production preparation ran.**
No automatic retry, including the previous11:30 proposal, is armed.
[Summary](20261027-immediate-workload-stop.json), [sanitized API/progress evidence](20261027-immediate-workload-stop.json.gz).

Fresh read-only queue at **07:06:15 UTC** had67 jobs/16 running. The provider-list reader and23:00
provider initialization were absent from the active set, but other bulk jobs were running:

| Job | ID | Started UTC | Direct progress observation at07:07:18 |
| --- | --- | --- | --- |
| f/metacritic_web/metacritic_init_ratings | 01a17702-467a-14c7-ff57-786979ec7686 | 07:00:00.023 | Module0 InProgress; main script copied/scanned352,388 movies,0 new; total unknown |
| f/sync/copy/tmdb_streaming | 01a17b0b-bef8-089d-6b50-cf6b74db901d | 07:00:00.030 | Script running; one logged movie upsert, no reliable total/completed-batch counter |
| f/social/deletion_sync | 01a17ad5-e3ce-bb2b-4744-1811091bee77 | 06:50:00.008 | Additional long flow; module0 InProgress (metadata at07:06:53) |
| f/social/discover (Bluesky schedule) | 01a17bdf-63c7-fc14-4110-574a57edcc77 | 06:40:00.006 | Additional long flow; module0 InProgress (metadata at07:06:53) |

Metacritic's main script job is01a17c28-a1f4-802e-cea2-28b58778e3d8, started07:00:00.131.
The count is a completed scan/copy checkpoint, not a total or percent-complete estimate. Streaming's
single emitted upsert is not proof that only one record has been processed overall; no reliable ETA
was inferred. Raw logs were read in memory only, filtered into whitelisted numeric progress records,
and neither saved nor printed. No job arguments, results, resources or credentials were retained.

No cron hold, wait/write-block change, Docker restart-policy change, allocation/rebalance change,
job/schedule mutation, CANCEL, DROP/CREATE SNAPSHOT, decommission, drain, SIGTERM, start or KILL
occurred. Nothing required rollback. No fresh claim about cluster health, current Crate settings or
backup status is made because the workload gate stopped the sequence first. The owner was notified
immediately, then given progress metadata for a decision on whether to accept that workload or wait.

Prepared from freshorigin/main **c5b5a6cbeaba9d7311cc150b2c3f66c018f61ad8**, branch **fix/644-immediate-restart-workload-stop**.
Validation: live queue and direct job-state agreement, progress counter shapes, absence of the two
named provider jobs from active work, JSON/archive parsing/hash, credential/argument exclusion and
diff checks. No application changes; app suites/typecheck were not rerun for this evidence-only stop.

## Q49 — October27 runner-up window,planning only

Owner selected **October27 11:30–13:00 UTC**: gates11:20, lastSIGTERM12:00, hard stop13:00.
[Active plain-restart plan](q40-execution-plan.md) now uses those times, the11:05 backup gate,
the12:05 potential cron skip and a unique October27 stop-unit name. Await explicit go around11:15;
**no production checks, watcher, settings, schedules, jobs or restart were started for this update**.

The owner explicitly retained the heavy-work gate: if a heavy Windmill job is running at the
fresh gates, stop and report rather than waiting it out or changing schedules. Accepted light jobs
remain running. Historical runner-up risks (including the11:00 provider-detector carry-over) must
be checked live after go, not treated as a passed gate. The normal unlimited-grace procedure and
all phase-specific restoration/handover rules remain unchanged. No automatic restart is scheduled.

## Q47 GO — stopped at initial workload gate,October26 21:20–21:23 UTC

**No restart or production preparation was performed.** The owner gave explicit go for the plain
restart, with fresh gates and a stop on any failed gate. At the live workload gate, Windmill still
reported the large **f/tmdb_api/read_daily_provider_lists** flow running from **14:00:00.009 UTC**,
over7h20m into its run. Direct GET confirmation at21:21:08 showed runningtrue, canceledfalse,
suspend0 and module0 **InProgress**, not merely a scheduled future trigger. Job ID
**01a174a4-169f-be62-b3b1-118ce2163038**. This was the bulk carry-over the quiet-window research aimed
to avoid, outside Q47's accepted light-job baseline. The operator reported the first stop during
gates and did not proceed toward21:30 or retry after the stop.

[Summary](q47-preflight-stop.json), [sanitized gate/runtime/cron/API/page receipts](q47-preflight-stop.json.gz).
Fresh branch **fix/644-q47-crate02-plain-restart**, base **7c9ca7bbc1660c8cec0cf807956b8075cb7cac5b** fromorigin/main. The active runbook was verified
byte-for-byte identical to the owner referencef50b76655 (SHA256792a7c2b31f8baa30b5f37af0133657735b30f20272f4dc82db7b0507df7d5f1).
The owner's checkout was not used or modified.

Initial checks completed before the workload stop:

- All3 expected members,5.10.16;145 GREEN relations through every coordinator, no missing or
  underreplicated shards, no RELOCATING/INITIALIZING copies, all node checks passing.
- Latest hourly **hourly_20261026_210501 SUCCESS**, started21:05:02.233,
  finished**21:05:21.248 UTC**,567 shards/no failures; no IN_PROGRESS snapshot or SQL maintenance job.
- Allocation**all**, rebalance**none**, gracefulPRIMARIES/forcefalse/2h on all coordinators.
  All145 captured policies match the prior inventory;14 YepWatch tables remain replicas2/wait3,
  REQUEST and original false block flags. No partition was present.
- No active Coolify deploy; the latest12 GitHub runs were completed. Windmill bulk-flow metadata
  is the failed gate. No schedule/job was changed, cancelled or paused.
- Watcher ran every10s across all5 requested endpoints. **75 expected responses**,
  no transport/status/slow-page alarm, maximum**1.900s**. MCP401 was expected and
  accepted; title/show/discover/discovery returned200. The3s rule was unchanged. The watcher ended
  normally via its local stop flag after read-only evidence capture.
- This early stop means the full10min heap/load stability/final pre-stop gates were **not completed**;
  the above are initial passing observations, not a claim that every execution gate cleared.

No cron hold, write-wait/write-block change, restart-policy change, allocation/rebalance change,
decommission, drain, replica change, cancellation, SIGTERM, start or KILL occurred. Consequently
there was nothing to reverse. Post-stop runtime readback proved the original container/image/config/
mounts, PID**3628315**, October15 start time, restartcount0 and restart policy**always** unchanged.
Cron readback was exactly original SHA256
**374f2ac2eea0fee650130b13c5ae3cf24276f80dabee6b35c54fb2cf5f502e37**, one active named backup job,
no hold installed. Next scheduled backup is**22:05 UTC**, not yet observed here.

Rebalance intentionally remainsnone under the earlier owner hold. Lock clearance is untested;
there is no new JVM, placement test or20–30min recovery observation. A later attempt needs an owner
decision and fresh passing gates; no automatic retry or background restart is scheduled.
Local watcher tests passed10/10. Receipt parsing, all-node checks, policy/runtime/cron comparisons,
page assertions, archive hash and diff checks passed. No application code changed; app suites/typecheck
were not rerun for this evidence-only stop record.

## Q46 — chosen proposed window21:30 UTC,read-only

[Complete schedule/runtime/window research](q46-window-research.md):56 schedules/53 enabled,
809 recent completed root jobs, current queue/deploy metadata and seven full UTC days of aggregate
captured pageviews. **Recommend October26 21:30–23:00 UTC**, gates21:20, lastSIGTERM22:00.
Runner-up October27 11:30–13:00 UTC. [Active plain-restart plan](q40-execution-plan.md) now uses the
chosen dates/cutoffs and latest pre-window21:05 backup gate. No job, schedule, cron, setting, deploy
or process was changed or started for Q46; no automatic restart was scheduled.

The time shift lowers added batch overlap but is **not a heavy-free slot**: continuous crawls,
hourly social work and22:45 embedding remain, with23:00 provider initialization at the boundary.
The earlier strict no-heavy-work gate still needs an explicit owner decision on that baseline;
no workload exception or pause is silently assumed. All execution gates and explicit go still apply.

## Q43 — active plain-restart plan,awaiting go

[Q43 execution plan](q40-execution-plan.md) replaces the drain route: **plain normal stop/start only,
no decommission, no drain, no zero-primary gate and no replica lowering**. It includes the exact
backup-cron helper, temporary14-table wait3→2→3 scripts, unlimited normal-stop grace, same-container
start, all-node health/settings/policy gates, phase-specific abort/two-node handovers, a five-endpoint
10-second watcher, no SIGTERM after03:30 and04:30 UTC hard stop. Q43 explicitly enables rebalanceall
after rejoin/GREEN/original policies to prove placement for20–30min, then returnsnone on a lock error
or failed test; this supersedes the previous proof-before-enable order. No Q43 restart/preparation
mutation has been executed. Rebalance remainsnone/allocationall after today's completed Q44 action.

**Open scheduling gate:** read-only Windmill API inspection found53 enabled schedules;26 trigger
in/at the03:00–04:30 UTC window, including03:00 IMDb ingest/TMDB details and04:00 ratings initialization,
plus repeated long-running crawls. [Sanitized schedules,timezone evaluation and root-job runtime evidence](q43-windmill-evidence.json.gz).
No schedule was changed. Resolve heavy-work conflicts or choose another window before go; fresh
02:50 schedule/queue/deployment/snapshot checks remain mandatory. Local watcher tests passed10/10.

## Q44 — target-only cancel unblocked the13:05 snapshot

At **13:17:08.954 UTC**, under the new owner authorization, executed exactly once:

```sql
ALTER TABLE doc.person_worked_on REROUTE CANCEL SHARD 4 ON 'crate-02';
```

The snapshot had remained IN_PROGRESS for over10min, with the sole relocating primary still
person_worked_on4 oncrate-01→crate-02. All-node preflight verified that source primary, its STARTED
replica oncrate-03,145 GREEN relations, rebalancenone/allocationall, and a healthy page watcher.
No allow_primary, source cancellation, DROP, manual CREATE, restart, replica or cron change.
[Before/action/after receipts](q44-target-cancel.json).

Every coordinator immediately confirmed **the same primary remained oncrate-01 and replica oncrate-03,
both STARTED/STARTED with no relocation**. The unrelated person_appeared_in5 replica move was untouched.
Cluster stayed145 GREEN, no missing/underreplicated shards; rebalance remainsnone, allocationall.

**hourly_20261026_130501 became SUCCESS at13:17:09.276 UTC**,567 shards/no failures, verified through
all3 coordinators. The scheduled helper logged successful creation13:17:11 and **Backup run finished
13:18:34** after its normal retention/verification. Cron hash stayedexactoriginal, one active job/no
hold marker. This completes the previously pending13:05 backup verification and demonstrates the
logical target cancellation preserved the active source while removing the snapshot's routing blocker.

Page watcher ran every10s with5s timeouts from **2026-10-26T13:15:45.194904+00:00 to 2026-10-26T13:21:15.053835+00:00**:
**102/102 HTTP200**, no transport/slow-page alarms, maximum1.799s. Stopped only that local watcher
with SIGINT after operation/backup verification; no production process was signalled.

Q44 remains limited until tonight to target-only cancellation when an observed primary relocation
towardcrate-02 is actually blocking a running backup. No proactive replica/source cancellation.
Each future action needs fresh exact-copy/snapshot/health checks and its own timestamped receipt;
never replay an ambiguous command. An accepted skipped backup does not justify another kind of repair.

## Rebalance hold — owner-approved,October26 12:50 UTC

Applied **only** `SET GLOBAL TRANSIENT "cluster.routing.rebalance.enable"='none'` once,
acknowledged **12:50:09.296 UTC**. All three coordinators independently read back rebalance none,
allocationall and145 GREEN health rows, zero missing/underreplicated shards, immediately afterward
and again at13:05:52. [Mutation and verification receipts](rebalance-hold-verification.json).

Keepnone through tonight's crate-02 restart. [Q40 plan](q40-execution-plan.md) now permits restoringall
**only after crate-02 has rejoined and closing-shard lock clearance is confirmed**. Generic cleanup,
a failed gate, aborted drain, GREEN alone or the04:30 hard stop must not enable balancing. If proof
is incomplete, keep the hold and hand it over for an owner decision. The plan includes targeted
recovery/log/old-store checks before restoringall, followed by all-node readback and observation.

Fresh pre-hold inspection found a different primary move already in flight:
**doc.person_worked_on4 primary,crate-01→crate-02**; the other move is
**doc.person_appeared_in5 replica,crate-03→crate-02**. Both source copies remain STARTED with
RELOCATING routing. Setting rebalancenone does not cancel these in-flight moves. No CANCEL, DROP,
manual snapshot, replica change, decommission, restart, KILL or cron change was performed.
The12:49/12:50 preflight,12:56/13:01 observations and13:05 all-node readbacks retain this primary
relocation; the owner was notified that it could still delay the next snapshot despite the hold.

**Historical13:05 verification, later completed under Q44 above:** root cron invoked at13:05:01.365616 UTC;
`hourly_20261026_130501` started13:05:01.675. At13:05:52–13:06:10 every coordinator returned
IN_PROGRESS, finish0,567 shards, no listed failures. Do not treat this as SUCCESS. Original cron
hash remains `374f2ac2eea0fee650130b13c5ae3cf24276f80dabee6b35c54fb2cf5f502e37`, one active
`5 * * * *` job, no hold marker. Continue read-only verification; no additional production action
is authorized to complete that snapshot. Its SUCCESS and the authorized follow-up action are recorded above.

## Q42 — stopped at changed preflight,October26,12:44–12:46 UTC

**Backups recovered before any Q42 mutation. All coordinators now verify both snapshots SUCCESS:**

| Snapshot, repositorygoodwatch-db-backup-v2 | Started UTC | Finished UTC | Shards/failures |
| --- | --- | --- | --- |
| `hourly_20261026_110502` | 11:05:02.127 | **11:40:33.416** | 567 / none |
| `hourly_20261026_120501` | 12:05:01.818 | **12:05:17.641** | 567 / none |

The11:05 helper had timed out at11:35, but the native snapshot subsequently completed; its client
failure did not mean the native snapshot failed. The12:05 scheduled run logged successful creation,
verification and `Backup run finished` at **12:06:44 UTC**. No manual snapshot was necessary or created.
This supersedes the earlier observations of IN_PROGRESS and a failed fresh-backup gate.
[Q42 receipts, all-node queries, cron/settings and page samples](q42-preflight-stop.json).

Owner approved the proposed five-step recovery, with rebalance to remainnone until tonight, but
also explicitly required stopping at the first unexpected result. Fresh checks showed the approved
**primary** relocation was gone: person_appeared_in4 primary oncrate-01 was STARTED/STARTED, with
null relocating_node. Its **replica oncrate-03** is now STARTED/RELOCATING towardcrate-02; the other
pending move is person_worked_on5 **replica oncrate-03→crate-02**. All three coordinators agree and
report145 GREEN relations, zero missing/underreplicated shards. These are different copies/roles
from the blocking primary on which the target-only approval was based. **Stopped before mutation;
did not redirect the approved command to the now-relocating replica.**

No rebalance hold, cron hold, CANCEL, DROP, CREATE, replica change, decommission, restart or KILL
was executed. **Rebalance remainsall**, allocationall, gracefulPRIMARIES/forcefalse/2h. The instruction
to keep rebalance none would apply after reaching that step; because preflight stopped first, no
hold was applied. Do not hand over the cluster as though balancing is disabled for tonight.

Cron remains byte-for-byte original (SHA256
`374f2ac2eea0fee650130b13c5ae3cf24276f80dabee6b35c54fb2cf5f502e37`), with one active named backup
entry. No hold/restoration was needed; the12:05 job had already finished before this attempt, so
there was no manual/scheduled collision.

A local strict first-failure watcher checked the three requested URLs in parallel every10s with
5s curl timeouts, **12:44:36–12:45:46 UTC**: **24/24 HTTP200**, no transport failures or alarms,
maximum2.293s. The baseline first round was slower than subsequent requests but below3s.
The watcher was stopped locally with SIGINT after the preflight stop; no production process was
signalled. Watcher selection tests confirm first non200/transport failure triggers immediately.

Validation: parsed all receipts; two SUCCESS snapshots and exact changed shard roles agree through
all3 coordinators;567 shards/no failures each; original cron hash; all/all settings;24 successful
page samples; local diff check. No application code or production state changed. Future restart
still needs fresh gates and the unresolved health-wait cancellation qualification; successful
snapshots do not prove the old crate-02 closing-store locks are cleared.

## Backup-first follow-up — read-only,11:39 UTC

[Current copies, snapshot concurrency, target-cancel and conditional DROP proposal](backup-recovery-source-notes.md),
with [all-coordinator receipts](backup-priority-readonly.json). **No writes executed.** The12:05 UTC
run was still future at this check; the failed11:05 UTC run was12:05 CET. A running snapshot is not
a universal CREATE mutex in5.10.16, but new full snapshots can queue on the blocked shard.
Important correction to an absence-based inference: no physical target in sys.shards does not mean
there is no logical relocation target. Tagged RoutingNodes constructs that target; cancelling the
crate-02 target can preserve the crate-01 source STARTED, unlike cancelling the active source.
This is a source-based proposal requiring new owner approval, not production validation.

## Restored backup cron verification — October26,11:05–11:36 UTC

**Cron ran, but the scheduled backup did not succeed. At11:35:02 UTC the helper logged
BACKUP FAILED after its30-minute CREATE read timeout; the server-side snapshot remained
IN_PROGRESS on all three coordinators at11:35:57–11:36:16.** This is not a SUCCESS receipt.
No manual backup, retry, snapshot cancel/delete, cron modification or production mutation occurred.
Started from fresh main `1df1af8d0`; branch `fix/644-q40-restart-execution-plan` also holds the
separately requested read-only Q40 plan. [Structured receipts](q37-restored-backup-verification.json)
contain the cron invocation, redacted schedule metadata, log lines, all-coordinator snapshot reads,
latest successful snapshot, current relocations and tagged source excerpts/hash.

- Journal confirms root cron invoked the backup at **11:05:02.006417 UTC**. The backup log records
  `Creating snapshot: hourly_20261026_110502` at11:05:02.
- Repo `goodwatch-db-backup-v2`: snapshot started **11:05:02.127**,567 shards, finish0 and no failures
  listed. All three coordinators returned IN_PROGRESS at11:06,11:11,11:16,11:21 and11:35–36.
  Empty failures with an unfinished snapshot is not proof of a valid rollback target.
- At **11:35:02**, log: `SQL CREATE failed ... ReadTimeout; not replayed; inspect server outcome`,
  then `BACKUP FAILED: Snapshot creation failed: hourly_20261026_110502`. The client timeout did
  not cancel the native snapshot, and no cancellation was attempted here.
- Latest current SUCCESS, independently re-read at11:35:57, remains **hourly_20261026_090502**,
  finished09:05:30.639,567 shards, no failures. It is over2½ hours old at this observation.
- Cron at11:35:58 has exactly one active backup line, schedule `5 * * * *`, zero Q37 hold markers,
  and original SHA256 `374f2ac2eea0fee650130b13c5ae3cf24276f80dabee6b35c54fb2cf5f502e37`.
  Schedule restoration is confirmed; do not confuse it with successful snapshot completion.

**Best-supported explanation:** `doc.person_appeared_in` primary shard4 remains RELOCATING from
crate-01 toward crate-02, still observed11:36:14 (also present before the11:05 snapshot).
Tagged5.10.16 [SnapshotsService](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/snapshots/SnapshotsService.java#L2067)
sets a relocating primary's snapshot shard state to WAITING and
[keeps waiting while it relocates](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/snapshots/SnapshotsService.java#L718).
The replica move for shard5 also remains pending. SQL does not expose the internal per-snapshot
shard WAITING state here, so the particular internal holder is inferred from source and persistent
routing, not directly measured. No REROUTE, restart or lock manipulation was performed to test it.

**Q40 fresh-backup gate fails on this evidence.** A working cron alone does not clear it. Resolve
snapshot completion and the health-wait cancellation safety issue in the plan before a new go;
this turn stops with those findings for an owner decision. No further production action authorized.

Validation: parsed receipts; checked three-coordinator state agreement, cron journal timestamp,
original cron hash/one active schedule/no hold marker, failure log and latest-success metadata.
No application code changed; no webapp/flow suites or typecheck were run for this evidence update.

## Q40 — tonight's restart plan (not executed)

Owner approved planning for crate-02 around **2026-10-27 03:00 UTC**, with a separate **go** still
required. [Exact plan and30-table inventory](q40-execution-plan.md) include all145 table policies,
verbatim replica expressions, lower/restore SQL, the14-table execution scope, guarded write-wait
changes, page-monitor/abort rules and a04:30 UTC hard stop. **Health-wait cancellation is an execution blocker while pending moves remain;
a short initial timeout is explicitly rejected as unsafe without qualification.** Today performed **read-only inventory
and local preparation only**; no Q40 production changes. The other16 three-copy auth/MCP tables
are reference inventory, not an approved reduction. A fresh primary outside the14 is NO-GO.

## Q37 urgent native abort — service restored October26,10:33 UTC

**Supersedes the pending-decommission state below: the native action aborted at10:32:56 UTC.
Crate-02 direct SQL returned at10:32:59; all nine requested public page probes returned200
at10:33:11–12. No stop/restart, KILL, replica change or manual internal-marker reset.**

The owner reported title-page503s while the native drain disabled new sessions. Owner explicitly
authorized cancellation through the5.10 mechanism, including graceful-stop settings. Reviewed
[5.10.16 DecommissioningService](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/cluster/gracefulstop/DecommissioningService.java):
`exitIfNoActiveRequests` checks the dynamically updated graceful timeout when active work remains;
`forceStopOrAbort` with force=false removes the decommission marker and calls
`sqlOperations.enable()`. There is no separate cancel SQL statement in this implementation;
resetting the internal marker alone does not run that enable/cancellation path. This used the
native timeout-abort mechanism, not an invented marker-only cancellation.

Before the change, rechecked force=false, timeout2h, allocationall and old active operations.
At **10:32:56.057 UTC**, set transient `cluster.graceful_stop.timeout='1s'` through crate-01.
The active native wait already exceeded that duration. Crate-02 logged **“Aborting graceful
shutdown due to error”**, a gracefulStopTimeout TimeoutException, and at **10:32:56.483** removed
`crate.internal.decommission.r0IgCe17SPOgudkQIGsRQA` (group changed from true to empty).
At **10:32:59.505**, direct SQL on crate-02 succeeded. At **10:33:00.261**, restored the original
`cluster.graceful_stop.timeout='2h'`; force remainedfalse throughout. No pending drain was resent.

Verification through **all three coordinators**,10:33:10–34: each answered SQL, reported145 GREEN
relations, zero missing/underreplicated shards, allocationall and every allocation exclusion empty.
Graceful settings were again PRIMARIES/forcefalse/2h. The native allocation exclusion is gone;
crate-02 is eligible to receive shards again. This establishes eligibility, not completion of a new
recovery or clearance of the original closing-store locks. Existing allocation samples reported
rebalancing throttled. Original container/PID/start time and restartcount0 remained unchanged.
One initial diagnostic selected unsupported `sys.cluster.settings['crate']` and received404;
the corrected supported-settings query succeeded through all three coordinators.

Each requested page was fetched three times, body discarded, without following redirects:

| Page | HTTP statuses | Seconds, successive requests |
| --- | --- | --- |
| `/movie/629-the-usual-suspects` | 200/200/200 | 0.476102 / 0.602423 / 0.426223 |
| `/discover` | 200/200/200 | 0.899920 / 0.468605 / 0.551208 |
| `/show/1396-breaking-bad` | 200/200/200 | 0.473120 / 0.457677 / 0.263274 |

Recovery was reported immediately during the turn. Exact timestamps, scripts, selected runtime,
SQL results and the short abort-log interval are in [q37-native-abort.json](q37-native-abort.json).
Cron remained restored at that observation; the later11:05 run is recorded above and failed its
CREATE client wait while the server-side snapshot remained IN_PROGRESS. Original stale contexts/closing locks are not claimed fixed by aborting.
Future maintenance must solve the three-copy primary-drain blocker and keep a tested native
abort path ready before disabling a production coordinator. No further production change made.

## Q37 guarded restart attempt — October26,09:52–10:27 UTC

**STOPPED before SIGTERM: crate-02 still has17 primaries. The native decommission remains
active; restoring allocation and cron did not cancel it. Do not resend the decommission.**
No restart, host stop, KILL, force=true, timeout shortening, replica/write-policy change or
lock-file manipulation was performed. Original PID3628315 and container start time
October15 23:45:26.513850873 UTC were unchanged at **10:27:22 UTC**. This is an incomplete
maintenance attempt requiring owner handover, not a successfully aborted native action.

Started from fresh main `06944811362dcff9f21e469be9b423895af8defb`, on branch
`fix/644-q37-crate02-guarded-restart`. Structured results are in
[q37-restart-attempt.json](q37-restart-attempt.json); timestamped SQL/runtime/cron receipts,
operator scripts and reviewed tagged5.10.16 source are in
[q37-receipts.json.gz](q37-receipts.json.gz), a gzip-compressed JSON file map.
Private cron contents, environment values and HTTP bodies/headers are excluded.

### Gates and action timeline (UTC)

- **09:52–09:57:** Repeated checks through all three coordinators:145 GREEN relations,
  zero missing/underreplicated shards, no write blocks or failed node checks, no active snapshot,
  and only the two known pending moves (`person_appeared_in`5 replica and
  `person_worked_on`4 replica, both crate-03→crate-02). No other INITIALIZING copies.
  Repeated old-operation/job inventories were separated by more than one minute.
- **Backup gate:** Latest scheduled snapshot `hourly_20261026_090502` in
  `goodwatch-db-backup-v2` was SUCCESS,567 shards, no failures,09:05:02.597–09:05:30.639.
  No active maintenance/deployment was found in host processes/units, SQL maintenance jobs,
  GitHub runs or Coolify deployment queue. Idle unattended-upgrade shutdown watchers were
  distinguished from an actual package upgrade.
- **Heap/load noted:** Crate-01/02/03 heap used12.55/7.52/9.12 GB of17.18 GB each;
  load1/5/15 respectively3.83/4.27/4.89,1.77/1.91/1.97,4.82/5.10/5.44.
- **10:01:37:** Held only the existing backup cron job, saving its exact original bytes in
  a mode0700 directory on crate-01 (`/root/.config/goodwatch/644-q37-20261026T100137Z`).
  Cron receipts contain hashes and exact readback verification, not cron contents.
- **10:01:54–55:** Temporarily set crate-02's Docker restart policy to `no`, set transient
  allocation to `primaries`, and issued native `ALTER CLUSTER DECOMMISSION
  'r0IgCe17SPOgudkQIGsRQA'` once. Existing graceful settings remained
  `min_availability=PRIMARIES`, `force=false`, `timeout=2h`.
- **~10:04:55:** The caller timed out after180 seconds. **Procedural error:** the runbook's
  long client wait (7500 seconds) should have been used. A client timeout does not cancel
  decommission. The command was not retried. This error did not explain the independent
  allocation blocker established below.
- **10:04–10:19:** Primary count fell34→17, then stayed17; allocation explanations and
  full copy topology established no eligible destination for the remaining copies.
  Stopped the restart procedure at the zero-primary gate rather than forcing or changing tables.
- **10:11:41–43:** Restored transient allocation `all`, original Docker restart policy
  `always`, and original cron **byte-for-byte**, all with readback checks. Original and
  restored cron SHA256: `374f2ac2eea0fee650130b13c5ae3cf24276f80dabee6b35c54fb2cf5f502e37`.
- **10:13:56 onward:** Logs changed to “There are still active requests on this node,
  delaying graceful shutdown”, repeated every5 seconds. Reviewed native code first waits
  globally for no relocating shards, then waits for active requests/tasks. The two old moves
  had exhausted retries; that health wait completing **does not prove zero primaries**.
- **10:15–10:27:** Crate-01/03 each reported145 GREEN relations with zero missing or
  underreplicated copies,17 primaries still on crate-02, allocation `all`, force=false.
  Direct new SQL probes to crate-02 timed out while native decommission remained active.
  Final host inspection proved the same running container/PID/start time, zero restarts,
  image digest/config/mount hashes unchanged, restart policy `always` restored.

### Structural zero-primary blocker

All17 remaining primary shards have **three STARTED/STARTED copies**, one on each existing
node (51 copy rows). They belong to14 `doc.yepwatch_*` tables, all with replicas2,
`write.wait_for_active_shards=3`, translog durability REQUEST:
`agreement`, `candidate`, `command_receipt`, `control`, `decision`, `invitation`,
`member_grant`, `member_intent`, `participant`, `proposal`, `room`, `runtime`, `ticket`, `vote`.
`room` has four shards; the others have one each. Their remaining primary data totaled only
4,033,251 bytes, so this was not a large-transfer delay. Every remaining primary's allocation
explanation was “cannot move shard to another node, even though it is not allowed to remain
on its current node”. A fourth destination does not exist; an existing replica occupies each
other node. The Q32 rehearsal's copy-policy exception matters **before this drain too**.
Q37 did not authorize changing replica counts or write requirements.

### Still-active native action and service limitations

Crate5.10.16's tagged `DecommissioningService` disables new SQL, sets an internal decommission
marker and keeps a server-side wait independently of the caller. Its active-request check may
schedule process exit later. `force=false` provides a timeout abort path; it is **not an immediate
cancellation guarantee**, and its existing2h setting was not altered. No supported SQL cancel
was established. Merely resetting the internal marker would not cancel the pending callback
or reliably re-enable SQL, so that unapproved action was not attempted. Original restart
policy was restored, but operators must treat this node as still under native maintenance.
Source receipts: `DecommissioningService.java` and `DecommissionAllocationDecider.java`,
from [Crate's5.10.16 source](https://github.com/crate/crate/tree/5.10.16/server/src/main/java/io/crate/cluster/gracefulstop).
Do not send SIGTERM while primaries remain or assume client timeout cancelled maintenance.

At10:23:29,112 old operations on crate-02 still had no matching current job:
110 fetchPhase, one collect and one distributed merge. Locks were not cleared and successful
post-restart allocations could not be tested because there was no restart.
Homepage checks before/after returned200; unauthenticated `/mcp` returned its expected401
with OAuth challenge, and resource discovery returned200. Discovery latency rose from0.644s
to17.096s in the after check; do not characterize that as full normal-service proof.
No authenticated MCP tool invocation or sustained member traffic validation was performed.

The10:05 scheduled backup was skipped during the hold. Cron is restored to its original
`5 * * * *` schedule (one active backup job, no hold marker, hash reconfirmed10:25).
**At that time, the next11:05 UTC scheduled run was not yet verified; its later failed outcome is recorded above.** The explicit gate-failure instruction
was to stop and report; no manual backup was substituted. Latest verified snapshot remains09:05.

### Owner decision before further changes

Q37 is blocked at the zero-primary gate and the native drain is still pending. Prompt operator
ownership of that state and the next scheduled backup check is required. Recommend a separately
reviewed, bounded exception for these14 tables: protect writes, reduce wait3→2 and replicas2→1
in the appropriate guarded order, allow the existing drain to reach zero, then use the approved
normal-stop procedure and restore copies/full GREEN before wait3. **This is a proposal, not
executed SQL**; exact write protection, native-action state and recovery gates must be reviewed
before authorization. An alternative is extra compatible capacity that preserves three copies.
Do not waive zero primaries, force the drain, repeat decommission, or delete shard locks.
If neither approach is approved, keep staffed observation of the existing native timeout/abort
and verify SQL availability before treating crate-02 as back in service; do not assume that
restored settings alone establish cancellation.

Validation for this evidence-only change: parsed summary/archive JSON, checked archive SHA256,
matched original/final runtime identifiers and config hashes, exact cron restoration and51-copy
blocker topology. No application code changed; webapp/flow suites and typecheck were not rerun.

## Q35 lock-holder investigation — October26,09:10–09:27 UTC

**Best-supported holder: closing Stores retained by unreleased reader/searcher references on
crate-02 after the October22 rejoin.** Logs identify the lifecycle holder as `closing shard`;
open old segment readers and the reference-lifetime code support that diagnosis. **The exact
owning job/FetchTask object could not be identified** from the allowed diagnostics. Do not
conflate a lifecycle holder description with a job/thread ID.

Started from fresh main **9b5bd6435**. No SQL mutation, REROUTE, restart, KILL, table close/reopen,
replica change, file deletion or logging/stat-setting change was performed. Exactly one
owner-authorized `jcmd Thread.print -l` diagnostic was taken; its output was streamed to operator
scratch, not a production output file. No GC request, heap dump or debugger was used.

### Direct holder descriptions and when closing started

Crate-02's logs at **October22 05:55:42–43 UTC** contain eight direct
`ShardLockObtainFailedException` records from `TransportNodesListShardStoreMetadata`. Two examples:

```text
[person_appeared_in][4]: obtaining shard lock for [read metadata snapshot] timed out after [5000ms], lock already held for [closing shard] with age [8525ms]
[person_worked_on][5]: obtaining shard lock for [read metadata snapshot] timed out after [5000ms], lock already held for [closing shard] with age [12925ms]
```

Subtracting the logged ages places the description changes at approximately **05:55:34.35 UTC**
for `person_appeared_in`4 and **05:55:30.27 UTC** for `person_worked_on`5. These are approximate
**closing-description** times, not original lock-acquisition times. `InternalShardLock.setDetails`
resets the age clock; logging/scheduling adds small timing uncertainty. No current four-day age
counter or exact holder object is exposed by SQL/the thread dump.

All eight affected paths have the same pattern:

| Relation/shard on crate-02 | Logged holder | Approximate closing time, Oct22 UTC | Current old segment FDs |
| --- | --- | --- | ---: |
| `person_appeared_in`0 | closing shard | 05:55:34.23 | 6 |
| `person_appeared_in`1 | closing shard | 05:55:34.30 | 2 |
| **`person_appeared_in`4** | closing shard | **05:55:34.35** | **4** |
| `person_appeared_in`5 | closing shard | 05:55:34.41 | 4 |
| `person_worked_on`0 | closing shard | 05:55:30.11 | 2 |
| `person_worked_on`1 | closing shard | 05:55:30.17 | 2 |
| `person_worked_on`4 | closing shard | 05:55:30.21 | 6 |
| **`person_worked_on`5** | closing shard | **05:55:30.27** | **2** |

The current JVM still has **28 segment-file descriptors** into exactly these eight directories,
which are absent from its current SQL shard assignments. A full scan found399 physical shard
directories versus391 assigned paths. Repeated filesystem/FD checks at09:19:33 and09:26:45 UTC
found unchanged inventories and the same FD counts for all eight. The four requested/previously
watched target identities are part of this larger set; **at least these eight shard IDs can impede
future allocations to crate-02**, not just the two pending at one instant. No additional inactive
open shard paths were found. This does not exclude retained references to currently assigned
stores becoming a problem if those stores later close.

### On-disk metadata: not an OS write.lock owner

The requested directories are:

- `person_appeared_in`4: `/data/nodes/0/indices/s45gGnNPT668rNeh8HDfkw/4`,154 files,
  379,471,136 apparent bytes; newest file Oct22 05:55:34.396 UTC.
- `person_worked_on`5: `/data/nodes/0/indices/FzH-GR-NQqm8P4Gs7lE8pQ/5`,124 files,
  321,295,612 apparent bytes; newest file Oct22 05:55:30.304 UTC.

Both contain the expected index/state/translog files. Their `index/write.lock` files are zero bytes,
with mtimes **Oct15 23:51:07.333** and **Oct15 23:51:28.346 UTC** respectively. Those mtimes do not
identify an acquisition time or a current owner. `/proc/locks` has **no matching OS advisory lock**
for any of the eight inactive paths. As a positive control, **all391 assigned paths have OS WRITE
locks owned by this same Java process**. This rules against the simple explanation that another
process is holding these eight Lucene write locks; the failing category is Crate's **in-memory
NodeEnvironment shard lock**, retained independently of those files. Do not delete any lock file.
No shard-data file contents were read or touched.

### Operations/jobs: strong timing correlation, no per-shard attribution

Crate-02 has **112 operations older than1h without a matching `sys.jobs` row**:110 `fetchPhase`
operations started **Oct22 05:55:10.706–05:55:22.333**, plus one collect and one distributed merge
started Oct16. The110 fetch phases predate the closing transitions by seconds. The counts were
unchanged in the09:24 final readback. However:

- `sys.operations` exposes node/job/phase/name/start/bytes, **no relation or shard ID**.
- The112 operations represent111 job IDs; the targeted `sys.jobs_log` lookup found **zero** retained
  history matches. It returned no member statements or parameters.
- A residual statistics row in5.10 can outlive the actual task. It is not by itself proof of an
  addressable RootTask, or proof that that particular row owns one of these stores.
- Therefore no particular orphaned operation can be claimed to reference either requested shard.
  The timing, old readers and closing-store evidence support the mechanism, not a unique job mapping.

The [tagged lifetime chain and upstream review](q35-upstream.md) explains why this is plausible:
FetchTask/SharedShardContext searchers increment Engine/Store references; closing the shard removes
it from active maps but releases its in-memory lock only when the last Store reference closes.
Other query paths can own searchers too. Crate maintainers describe the same failure class in
[issue18722](https://github.com/crate/crate/issues/18722) and note that cheap reference counting
does not track individual job owners. This is not proof that our exact leak is identical.

### One thread dump and the failed-attempt logs

The only dump ran **09:14:12.731–09:14:15.730 UTC**:

```text
docker exec --user 1000 crate-02 /crate/jdk/bin/jcmd 1 Thread.print -l
```

Exit0; command latency **2.9984s**, including Docker/attach/output. The exact safepoint pause was
not measured separately. It listed157 threads:62 RUNNABLE,62 WAITING,33 TIMED_WAITING, **zero BLOCKED**.
There was no createShard, FetchTask, ShardLock or recovery-target stack. A RecoverySource substring
was ordinary movie-segment merge pruning, not a blocked recovery handler. A semaphore permit and
an idle object/reference graph need not have an executing/blocked owner thread, so this negative
stack snapshot does not disprove the retained-store diagnosis. JVM addresses are tokenized consistently
in [the published dump](q35-thread-dump.txt); the dump does not contain a heap reference graph.

Six bounded failed-attempt windows—03:28:17,04:35:53,05:43:29,06:51:06,07:58:42 and09:06:18 UTC—
show the same `IndicesService.createShard`→`LimitedExponentialBackoff.next` exhaustion. The09:06
batch failed the requested `person_appeared_in`4 and `person_worked_on`5 targets again; the09:10
and09:24 reads instead show `person_appeared_in`5 and `person_worked_on`4 relocating to crate-02.
These rotating attempts are not successful recovery. Repeated log headers within a batch are not
counted as distinct allocations. The original exception is swallowed in that retry path, and its
WARN test expects5000ms while actual capped delays are5050ms, explaining the missing fresh
holder-description details. The source review documents the exact calculation and citations.

Health remained **145 GREEN**, with no failed checks. The JVM PID matched both FD samples; the
initial Docker readback reported an Oct15 start and restart count0. No exact job/reader owner or
safe job-scoped release was revealed by the dump.

### Remedies and risks — nothing executed

| Option | What it can do / risk |
| --- | --- |
| Keep observing | No immediate disruption, but four-day retained references and repeated failed creation do not show finite useful progress. Eight targets remain vulnerable and two rebalance slots stay occupied. |
| **Target-only REROUTE CANCEL** after a fresh exact check | A narrower way to abort an INITIALIZING target attempt and reset the source's relocation, under new explicit approval. **Not a Store-reference release**; the allocator can immediately retry and hit the same lock. Not a validated cure. |
| Cancel an active source copy | The command fails the specified copy/removes its allocation ID. It is not merely clearing a flag: redundancy can fall, primary cancellation can cause promotion/errors, and the old target Store still exists. Do not adapt Q31's source commands to this new situation. |
| Job-specific cancellation | Would require an identified reachable owning task. The residual rows do not establish that, and cancellation can leave partial writes. **No KILL was run or is authorized.** |
| Close/reopen, replica toggling or file manipulation | No validated reference-release cure. These broaden availability/redundancy risk; the analogous upstream report found replica toggling ineffective. File deletion can damage data and does not release the in-memory holder. Nothing was closed/reopened. |
| **Guarded normal restart of only crate-02** | Best-established process-scoped reset: when the JVM actually exits, its retained references and in-memory locks cease to exist. This is not proof that no narrower remedy could ever work. Requires separate explicit approval, a fresh backup, safe copies/zero-primary drain gates, approved handling of current pending allocations and unlimited-grace normal stop. Member errors, reduced redundancy, recovery/heap load and another node loss are risks; normal exit may be slow. Do not force it. A restart can clear symptoms without preventing recurrence. |

**Recommendation for the later owner decision:** prefer a separately reviewed guarded crate-02
process reset over repeated allocation cancellation as the holder-release remedy, unless further
evidence identifies a safely addressable live owner. Q35 does not authorize that reset. Do not
couple it automatically to the major upgrade or claim6.4.6 cures every leak: some relevant fixes
are already installed in5.10.16, and newer cleanup fixes are preventive evidence, not a diagnosis
of this exact retained object. The upgrade's pending-relocation gate still fails today.

### Evidence, verification and remaining limit

- [q35-lock-holders.json](q35-lock-holders.json): eight holder/timing records, filesystem/OS-lock
  controls, operation/history counts, diagnostic receipt and archive SHA256.
- [q35-receipts.json.gz](q35-receipts.json.gz): UTF-8 map of explicit read-only SQL/results, bounded
  sanitized lock/failure logs, two full FD/filesystem metadata samples, scripts, diagnostic receipt
  and tagged source files. Issue API bodies remain in scratch; the archive keeps provenance hashes/links.
- [q35-upstream.md](q35-upstream.md): source lifetime chain, matching first-party issue, fix-version
  qualifications, missing WARN explanation and command-risk analysis.
- Local checks verified eight matching holder/path identities,28 persistent old reader FDs, zero OS
  locks for those paths versus391 active controls, unchanged file inventories,112 old operations,
  zero matching historical jobs, exactly one successful diagnostic and GREEN before/after it.
  JSON/archive/link/syntax checks passed; application suites were not rerun for this documentation-only task.

The remaining limit is **the exact Java object/job retaining each Store**. Identifying it would need
reference-owner instrumentation or a reference graph, beyond SQL and the one stack dump; no heap
dump or new production instrumentation was attempted. The operator worktree was removed externally
mid-task and recreated under `~/.cache/gw-work/644-q35/worktree`; scratch evidence survived, and the
owner's main working files were not modified.

## Q31 production cancellation — stopped at the pre-check, 2026-10-26

Started from fetched `origin/main` **93521e697**, on branch `fix/644-q31-cancel-relocations`.
The owner authorized exactly two cancellations, conditional on an unchanged pre-check. Read-only
queries through the runbook's SSH/trusted-loopback `crate_sql` route began at **08:15:22 UTC** on
all three coordinators. **The exact-copy guard failed. Neither CANCEL statement was sent.** No
production data/settings/process/schedule change, restart, repeated cancellation or KILL occurred.

All three coordinators agreed on these two non-STARTED/STARTED rows, both targeting crate-02
(`r0IgCe17SPOgudkQIGsRQA`):

| Relation | Shard | Current source/copy | Current state | Q31-approved copy |
| --- | --- | --- | --- | --- |
| `doc.person_appeared_in` | 4 | **crate-03 replica** | STARTED/RELOCATING | crate-01 **primary** of this relation/shard |
| `doc.person_worked_on` | 5 | **crate-03 replica** | STARTED/RELOCATING | crate-03 replica of **person_appeared_in**, shard5 |

The approved `person_appeared_in` shard4 primary on crate-01 and shard5 replica on crate-03 are
both already **STARTED/STARTED**, with no relocation target. `person_appeared_in` shards4/5 have
no copy on crate-02 in the captured query. That targeted copy query did **not** cover
`person_worked_on` shard5; do not infer the absence of its target from it.

Other pre-checks passed: **145 GREEN health rows**, zero missing/underreplicated shards, no failed
cluster/node checks, all three members still5.10.16, and no table write/read-only/write-on-disk-full
blocks. Exactly the two rows in the table were non-STARTED/STARTED; no INITIALIZING row was returned.

[The structured pre-check receipt](q31-precheck.json) preserves every query, explicit result column
and all three coordinator responses. Local validation confirmed their agreement and that the exact
approved source/table/primary tuple check fails before reaching any mutation. No application code
changed, so no application test suite was run for this evidence-only update.

**The post-cancel verification,30-minute observation and conditional crate-02 log collection were
not performed:** the owner's stop-on-difference condition took precedence, and there was no approved
cancellation to observe. The samples do not establish how long the current relocations have existed,
whether the older copies completed naturally or were changed by another operator, or why these two
replicas are relocating. No additional production reads were made after identifying the mismatch.

Production remains unchanged by this attempt. Retain it as-is unless the owner explicitly approves
a revised operation for the actual two replicas, with a fresh exact-copy/target/health pre-check.
The prior Q31 statements must not be adapted or replayed under their original approval.

## Read-only rebalance follow-up — 08:20–08:50 UTC, October 26

**Result: stalled target-shard creation, not demonstrated healthy rebalancing.** No cancellation,
restart, config change, diagnostic attachment or production write was performed. This follow-up
continued on `fix/644-q31-cancel-relocations` after the Q31 guard stopped the earlier attempt.

Thirteen scheduled rounds at150-second intervals ran from **08:20:04.881 to08:50:04.881 UTC**;
final queries/log collection finished08:50:16.153. Every round queried all three coordinators:
**39 observations**, all145 GREEN, no missing/underreplicated shards, no failed cluster/node checks
and no table write/read-only blocks. Full shard-placement hashes agree across all39 observations
and are unchanged for the entire30-minute span. **Zero completed moves or new placements observed.**

| Pending copy in every sample | Source → intended target | Observed duration |
| --- | --- | --- |
| `doc.person_appeared_in`, shard4 **replica** | crate-03 → crate-02 | Entire30-minute watch; also present at08:15 Q31 pre-check, so at least34min observed |
| `doc.person_worked_on`, shard5 **replica** | crate-03 → crate-02 | Entire30-minute watch; also present at08:15 Q31 pre-check, so at least34min observed |

| Node | Copies, first → last | Primaries, first → last |
| --- | --- | --- |
| crate-01 | 391 →391 | 273 →273 |
| crate-02 | 391 →391 | 34 →34 |
| crate-03 | 393 →393 | 263 →263 |

`sys.allocations` consistently reports the two source copies RELOCATING. The sampled other
eligible shards report rebalancing throttled; the configured concurrent-rebalance limit is2.
The configured balance weights are0.45 for total copies and0.55 for copies per index, threshold1.
[The tagged allocator](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/cluster/routing/allocation/allocator/BalancedShardsAllocator.java#L163)
uses those counts, not equal primary counts. Thus34 primaries alone is not a balancing failure;
the unchanged placements and repeated creation failures are the evidence of stalled work.

### Correcting the “no target row” inference

Neither system table returned a target row on crate-02, so no target INITIALIZING/RECOVERING
stage or current target-byte counter could be observed through these queries. **That absence
alone is not evidence that no target exists.** In5.10.16,
[`SysShardsTableInfo`](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/metadata/sys/SysShardsTableInfo.java#L260)
uses `allAssignedShardsGrouped`, and
[`SysAllocations`](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/expression/reference/sys/shard/SysAllocations.java#L78)
uses `routingTable().allShards()`. Those iterators omit the synthetic relocation-target entries;
[`RoutingTable`](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/cluster/routing/RoutingTable.java#L241)
has a separate target-including iterator. The prior interpretation of missing SQL target rows
was too strong. Privilege filtering is not the explanation: these reads use trusted superuser `crate`.

The source rows' DONE/100% recovery values stayed fixed:390,996,692bytes/17,277ms for
`person_appeared_in`4 and306,566,234bytes/8,189ms for `person_worked_on`5. Those describe the
source's previous recovery, **not** a progressing transfer to crate-02.

Read-only filesystem checks on crate-02 found both intended paths already exist:

| On-disk shard directory | Apparent bytes / files | Newest file timestamp |
| --- | --- | --- |
| `person_appeared_in`4 | 379,471,136 /154 | Oct22 05:55:34.396 UTC |
| `person_worked_on`5 | 321,295,612 /124 | Oct22 05:55:30.304 UTC |

Twelve metadata samples from08:23:39.594 through08:50:06.303 found identical complete file inventories,
sizes and modification timestamps: **zero observed growth**. Crate-02's Java process had open
handles to old segment files in both paths at the first/final FD checks. This does not identify
the shard-lock owner or prove that a new target engine was successfully created. No shard-data file contents
were read, no heap dump/thread attachment was taken and no GC was requested.

### Logs explain the changing identities before this watch

A separate bounded read of02:45–08:15 UTC logs found master-side **failed target creation**, not
successful relocation completions. At03:28:17 the master failed the original `person_appeared_in`4
primary from crate-01 and shard5 replica from crate-03 on target crate-02. Further paired failures
occurred at04:35:53,05:43:29,06:51:06 and07:58:42, with new attempts involving
`person_appeared_in`4/5 and `person_worked_on`4/5. The failure reports explicitly name the target
as INITIALIZING and contain `failed to create shard` and:

```text
java.util.NoSuchElementException: Reached maximum amount of backoff iterations. Only 1000 iterations allowed.
  at io.crate.action.LimitedExponentialBackoff$LimitedExponentialBackoffIterator.next(...:74)
  at org.elasticsearch.indices.IndicesService.createShard(...:529)
```

[The exact5.10.16 createShard path](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/indices/IndicesService.java#L507)
retries after `ShardLockObtainFailedException`; the stack's backoff call is inside that catch.
[Its backoff implementation](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/action/LimitedExponentialBackoff.java#L47)
sums to4,055.692seconds, matching the observed roughly**67min36sec** failure cadence. This supports
**target shard-lock contention on crate-02**, with failures/retries explaining the changed identities.
The specific holder and any connection to orphaned fetch/search contexts remain unproven.

During the live watch there were no logged new allocation/recovery failures, membership changes,
OOM, corruption or disk-watermark events. There were BLOB HTTP connection-reset warnings, and a
crate-02 GC-overhead warning at08:47:27:578ms collecting in1.1s. Those do not explain away the
unchanged30-minute placement record. The earlier log window also includes an operations-log
queue breaker clear on crate-01; log-buffer pressure is not itself proof of the target lock owner.
All container runtimes remained running with unchanged start times and zero recorded restarts.

### Receipts and limits

- [rebalance-watch.json](rebalance-watch.json): all-round summaries, counts, stable-placement checks,
  target-directory samples, historical failures and archive SHA256.
- [rebalance-samples.json.gz](rebalance-samples.json.gz): UTF-8 file map of full39 shard/health/allocation
  readbacks, explicit SELECT queries, bounded/sanitized logs, filesystem/FD metadata, scripts and tagged sources.
- Local checks verified13 rounds, all39 placement hashes equal, all health/check/block gates, stable
  target file inventories, JSON/archive integrity and Python-script syntax. No application code changed;
  application test suites were not rerun for this evidence-only task.

Sampling can miss short-lived transitions between rounds; zero **observed** moves is the supported
statement. Directory growth is a supplementary observation, not a network-throughput measurement.
No current target transfer rate is available from these SQL views. The two copies demonstrably
made no observed progress over the requested window. No further production action is authorized
by this read-only watch; the rolling-upgrade start gate remains unmet.

## Isolated follow-up — owner option A, 2026-10-26 00:43–00:56 UTC

**Reproduced: yes on 5.10.16. The tested newer version, 6.4.6, still reproduced a residual failure.**
Production was never contacted during this follow-up. The working branch started from fetched main
`45b4d909d`. All six lab containers, both internal networks and all six bound data directories were
stopped/removed at the end; [cleanup receipts](lab-results.json) confirm zero owned containers remain.

### Fixture and trigger

Each version used a fresh three-node Docker cluster: 100,000 synthetic rows with a 128-character
payload, six primary shards, one replica, 768 MiB JVM heap, 1,500 MiB container limit and two CPUs per
container. Images were pinned by digest:

- **5.10.16:** `sha256:5d7cd92eb84d56d538e2222a436e432164b853fdf186aebb17c446787f23a307` (production's image).
- **6.4.6:** `sha256:8d3e8778378236192724776877d2ea4546d5b5586362c8d174e6aa46177bb0fb`.

Data lived only below `~/.cache/gw-work/644-repro/{data-1,data-2,data-3,v646/data-*}`.
Both Docker networks were `--internal`; actual published ports were empty. Python clients used
only inspected container addresses on those networks. No production credentials, `.env`, service
addresses, SSH access, production tables or application servers were involved.

The main trial used **48 concurrent HTTP clients**, a four-second client timeout and three SELECT
patterns, rotated across all coordinators: grouped collection/aggregation; ordered row fetch;
and an equality self-join followed by aggregation. These produced collect, distributed merge,
fetch and join phases. After eight seconds of load, container 2 was disconnected from its network.
The harness waited for the other two nodes to report its absence, held it out another eight seconds,
reconnected it, waited for all three members, continued ten seconds and stopped the clients.
Disconnect duration was 41.1 seconds on 5.10.16 and 42.1 seconds on 6.4.6.

A preceding **18-client pause/unpause** trial on 5.10.16 caused membership loss/rejoin but left no
orphans. That trial used a different query-to-node rotation and concurrency, so it does not establish
that pause is safe or that disconnect alone explains the difference. One additional synthetic
2-million-row CROSS JOIN count probe overlapped the beginning of the 5.10.16 disconnect trial.
These are timing-sensitive observations, not a controlled performance comparison or a quantified
failure rate.

### Missing-job operations and memory

Lab candidates are operations **older than ten seconds**, absent from a full `sys.jobs` sample,
after the clients stopped. The shorter age threshold permits a bounded lab; it does not change
the one-hour filter used for the earlier production inventory. Every endpoint independently
returned the same candidate set in each quiet sample, including after full GC.

| Version / trial | Node 1 | Node 2 | Node 3 | Distinct missing job IDs | Sum of positive reported `used_bytes` |
| --- | ---: | ---: | ---: | ---: | ---: |
| 5.10.16 pause, 18 clients | 0 | 0 | 0 | 0 | 0 |
| 5.10.16 disconnect, 48 clients | **224** | **138** | **108** | **132** | **2,415,915 bytes** |
| 6.4.6 disconnect, 48 clients | **0** | **96** | **0** | **36** | **16,487,456 bytes** |

On 5.10.16, the 470 candidates comprised 194 collect, 95 distributed merge, 76 join-merge,
38 hash-join and 67 fetchPhase rows. Sixteen additional old operations still had live jobs and
were excluded. The candidate set was unchanged in quiet/full-GC/pre-shutdown samples; a surviving
108-row subset remained for more than four minutes until its node was stopped. The 6.4.6 residual
comprised 42 collect, 28 fetchPhase, 12 join-merge, six hash-join and eight distributed merge rows;
it remained after full GC and more than a minute after client shutdown.

**They retain memory, even when accounting says zero.** `jcmd 1 GC.class_histogram` performs a full
GC by default. On 5.10.16 it still found 224/154/108 `OperationContext` instances on nodes 1/2/3,
plus retained `RootTask`, `CollectTask` and (on node 2) `FetchTask` objects. The extra 16 contexts
on node 2 belong to still-listed jobs. An `OperationContext` occupied 40 shallow bytes here, so the
470 candidate wrappers alone account for **at least 18,800 bytes**, excluding maps, suppliers,
callbacks and retained task graphs. In this version, each context stores a `task::bytesUsed` supplier,
which can retain more than the wrapper. After node 1 restarted, its contexts/root tasks disappeared
from the full-GC histogram. The no-orphan pause baseline had none of these task/context instances.

The 6.4.6 full-GC sample retained 42 root tasks, 48 collect tasks and 28 fetch tasks on node 2;
the survivor nodes retained none of those classes. The reported-byte sums above are **accounting
observations, not dominator-tree retained heap measurements**; heap/RSS differences also include
caches and bounded job logs. No exact total retained heap or production-memory extrapolation is
claimed. Removing the separate statistics map in newer versions therefore does not, by itself,
prove resource cleanup.

### Shutdown and KILL experiments — local only

All decommissions used `force=false`; a **30-second lab-only graceful timeout** bounded the test.
Normal stops used `docker stop --timeout=-1`, with Docker exit **143** and no OOM/SIGKILL.

| Local test | Decommission observation | Subsequent normal SIGTERM |
| --- | --- | --- |
| 5.10.16 node 1, 224 missing-job rows plus still-listed jobs | Acknowledged after 2.71s; repeatedly logged active-request wait, reached the lab timeout and was still alive at 41.21s | **0.209s** |
| 5.10.16 node 3, 108 missing-job rows and no non-probe jobs anywhere | Acknowledged after 0.011s; repeatedly logged active-request wait, reached the lab timeout and was still alive at 41.20s | **0.206s** |
| 5.10.16 clean node 1 after restart | Exited through decommission, code 0, within **5.15s** | Unnecessary |
| 6.4.6 node 2 with the 96-row residual and still-listed jobs | Zero primaries confirmed; acknowledged after 0.015s; still alive in active-request wait at **18.46s** | **0.185s** |
| 6.4.6 clean node 2 after restart | Exited through decommission, code 0, within **5.14s** | Unnecessary |

The 5.10.16 orphan-only test reproduces the shutdown symptom without a live coordinator-job row.
It does **not** prove the statistics-map size itself is the cause: the shutdown implementation
checks internal request/task counters, and their exact values were not introspected. The initial
5.10.16 trials did not observe a strict zero-primary target gate before the normal stop; these
were disposable experiments, not a rehearsal satisfying production maintenance gates. The clean
controls and 6.4.6 test did observe zero primaries. No production stop procedure is relaxed.

Two individual **local** KILL probes also show why rowcount is not a reliable clearance receipt:

- A collect/distributed-merge ID on node 3 returned **0** and both zero-byte rows remained, matching the historical production symptom.
- A fetchPhase/collect ID on node 2 returned **0**, but its two rows disappeared. This difference alone rules out assuming identical internals for every candidate.

### Upstream: exact released changes

Checked official release notes, release tags, PRs and tagged source on October 26. There is **no
published 5.10.x tag after 5.10.16** in the inspected upstream tag list. Relevant newer changes are:

| First release | Exact change | Interpretation |
| --- | --- | --- |
| **6.2.0**, Jan 13, 2026 | [#18768](https://github.com/crate/crate/pull/18768), commit `f95f6638b9c60211d15462eac896baa68edab45d`: derive `sys.operations` from active tasks and remove the separate `operationsTable` | Improves accuracy and removes that statistics-retention path. Tagged 5.10.16 and 6.1.6 retain the map; 6.2.0 does not. It is not a complete task-cleanup fix. |
| **6.4.3**, Aug 19, 2026 | [#19901](https://github.com/crate/crate/pull/19901), backport of [#19653](https://github.com/crate/crate/pull/19653), commit `4311c500a5f6583d38fb78a630e3b38ae376ee35`: cancel tasks when their **coordinator** disconnects, even when that coordinator is absent from `participatingNodes` | The earlier disconnect handler only checked participants. This is a concrete newer fix for node-loss cleanup, with an upstream regression test. It fits the class of failure seen here, without proving every production ID followed this path. |
| **6.4.3** | [#19916](https://github.com/crate/crate/pull/19916), backport of [#19915](https://github.com/crate/crate/pull/19915), commit `bd8f6cd52476014c383d5e8badd53be996d5506e`: call `NodeLimits.nodeDisconnected` to release node-limit tracking | Related cleanup of state retained after node loss. |
| **6.4.4**, Sep 3, 2026 | [Release notes](https://cratedb.com/docs/crate/reference/en/6.4/appendices/release-notes/6.4.4.html): prevent shutdown after a cluster-health wait timeout with `force=false`; also fix a false-positive aggregation circuit-breaker regression from 6.4.3 | Additional reasons to avoid selecting the first fix release, 6.4.3, as an upgrade target. |

The coordinator-disconnect branch was absent in inspected 6.2.11, 6.3.0–6.3.7 and 6.4.0–6.4.2
source, and present in 6.4.3/6.4.6. The [6.4.3 release notes](https://cratedb.com/docs/crate/reference/en/6.4/appendices/release-notes/6.4.3.html)
identify the temporarily-unreachable-node memory leak. The latest inspected tag is 6.5.0; it was
not tested in this lab. **6.4.6 contains all changes above but did not pass this workload cleanly.**
The former task-initialization hypothesis below remains plausible for some detached rows; the lab
and upstream findings show that a single statistics-only explanation is insufficient.

### Recommendation and owner options

**Recommend leaving production unchanged for #644. There is no validated complete upgrade fix yet.**
The evidence establishes recurrence, retained objects and a shutdown delay, but cannot map every
production orphan to one internal defect. 6.4.6 is a useful comparison baseline with relevant fixes,
not a demonstrated cure. A supported staged upgrade also requires compatibility and backup/restore
validation: [6.4.6's release notes](https://cratedb.com/docs/crate/reference/en/6.4/appendices/release-notes/6.4.6.html)
only support rolling from >=6.3.0 and warn about pre-5.x tables. Do not infer a direct rolling jump
from 5.10.16. Never select unpatched 6.2.0 merely because it first changed statistics collection.

Owner options:

- **A — Recommended:** Keep production on its current configuration. Authorize a smaller deterministic reproduction of the residual, then an upstream report for review and a 6.5.0 comparison. No upstream issue was posted during this task.
- **B:** Separately plan a supported staged upgrade to 6.4.6 for its known fixes, explicitly accepting that #644 remains open and requiring compatibility/restore and maintenance approval before production changes.
- **C:** Defer further work and retain the current guarded normal-stop runbook, accepting continued retention and maintenance uncertainty.

### Reproduction receipts and verification

[lab-results.json](lab-results.json) contains counts, full-GC class totals, timing receipts, images' runtime
metadata and cleanup. [upstream-followup.json](upstream-followup.json) records source checks, patches and
release-note text. [lab-receipts.json.gz](lab-receipts.json.gz) is a JSON object with a `files` mapping:
executed Python harnesses, endpoint samples, event streams, selected membership/shutdown logs, histogram
extracts with full-histogram SHA256 and cleanup receipts. SQL is synthetic. Full repetitive logs and
histograms remain in the operator's cache; containers and database data do not.

To repeat **only in a disposable local environment**, extract `files` keys beginning `scripts/` into
`~/.cache/gw-work/644-repro`, create/export that `TMPDIR`, run `lab.py start`, seed `lab` with the DDL
and INSERT…SELECT described above, then `run_load.py disconnect 1`, `memory.py after-fullgc` and
`shutdown.py trial`. The `lab646.py` / `run_load646.py` / `memory646.py` variants run the pinned newer
cluster. `cleanup.py` checks ownership labels and removes both versions' lab containers/networks/data;
it expects both sets to exist. The archived scripts use only their own networks and fixture names.
The aggregate/load scripts are timing-sensitive, not a test guaranteed to fail on every run.

The fixture was seeded with:

```sql
CREATE TABLE lab (id INT PRIMARY KEY, k INT, payload TEXT)
CLUSTERED INTO 6 SHARDS WITH (number_of_replicas=1);
INSERT INTO lab (id,k,payload)
SELECT generate_series, generate_series % 1000, repeat('x',128)
FROM generate_series(1,100000);
REFRESH TABLE lab;
```

The lab is the regression experiment; no application or CrateDB engine fix was made. Independent
checks: **38 Crate/backup tests + 9 subtests**, **28 flow tests + 13 subtests**, **50 webapp tests**
passed. Typecheck ran and still reported **192 diagnostics** on application source unchanged from
the starting main revision. Receipt/count/gzip/source-link checks and `git diff --check` passed.

## Production counts at 00:11–00:12 UTC

“Orphan candidate” here means an operation older than one hour whose `job_id` is absent
from a full superuser `sys.jobs` sample, persisting across samples. This is an observable
symptom, not proof that an internal task or resource is absent or safe to terminate.

| Node | Operations older than one hour | Orphan candidates | Distinct orphan job IDs on node | Operations with a matching live job |
| --- | ---: | ---: | ---: | ---: |
| crate-01 | 1,546 | **1,460** | 768 | 86 |
| crate-02 | 112 | **112** | 111 | 0 |
| crate-03 | 2,911 | **2,897** | 1,517 | 14 |
| Total | 4,569 | **4,469** | **1,653 cluster-wide** | 100 |

Do not sum per-node distinct IDs: jobs can have operations on several nodes. All three
coordinators returned the identical 4,569 operation rows in each of three rounds, beginning
00:11:04, 00:11:36 and 00:12:31 UTC (87 seconds between first and last rounds).
The 100 excluded rows belong to three old, still-listed `goodwatch_windmill` jobs. A fourth
Windmill job older than one hour also remains in `sys.jobs`; old age alone is not orphan status.

Every node still reports **5.10.16**, with the pinned image digest from the rollout.
Container start times are October 15 23:45:26 (crate-02), October 16 00:01:38 (crate-03), and
October 16 00:19:54 (crate-01), with restart counts zero and no current OOM flag.
Every coordinator reports **143 GREEN health rows**, zero missing/underreplicated shards,
**21 passing node checks**, allocation `all`, graceful `PRIMARIES` / `2h` / `force=false`.
Shard routing is **1,161 STARTED/STARTED plus two STARTED/RELOCATING**: the strict settled-shard
maintenance gate is not met. This is a snapshot, not a diagnosis of those relocations.

## What the candidates have in common

| Node / cohort | Start time UTC | Operation names | Reported bytes |
| --- | --- | --- | --- |
| crate-01: 1,460 | Oct 22 05:55:27.637–05:55:32.040 | 1,194 collect; 266 distributed merge | All 0 |
| crate-02: 2 | Oct 16 00:01:06.877 | 1 collect; 1 distributed merge | Both 0 |
| crate-02: 110 | Oct 22 05:55:10.706–05:55:22.333 | 110 fetchPhase | All -1 |
| crate-03: 2,897 | Oct 22 05:55:27.612–05:55:44.121 | 2,364 collect; 523 distributed merge; 4 hash-join; 6 join-merge | 2,893 at 0; 4 at -1 |

The two October 16 rows are the exact rollout recurrence ID
`ec6c1d3a-e751-cd36-cdbc-39d304289755`. They are about ten days old; the October 22 cohort
is about three days eighteen hours old. Zero means reported accounting is zero, not proof of
zero retained resources. In the [5.10 system-table reference](https://cratedb.com/docs/crate/reference/en/5.10/admin/system-information.html#jobs-operations-and-logs),
`used_bytes=-1` means unavailable accounting, not negative memory consumption.

These are distributed collection, merge, join and fetch phases. They strongly suggest queries
with distributed reads, but operation names do **not** establish the complete SQL statement type
(e.g. SELECT versus INSERT…SELECT), client process, endpoint or user.
**Exact statement type and source client remain unknown for all 1,653 orphan IDs.**
A filtered `sys.jobs_log` lookup of those IDs returned zero rows. Its 10,000-entry-per-node
rings covered only about the last 88 seconds on .12/.13 and 77 seconds on .11 when sampled;
there is no retained SQL history for either cohort. Current `stats.enabled=true`,
`jobs_log_filter=true`, persistent filter false, log sizes 10,000 and expiration 0s.
Current `statement_timeout=0ms`; no historical setting change is inferred from that value.
No member statements or arguments were captured. The identities of still-listed Windmill jobs
must not be attributed to the orphan cohort.

## Initial read-only hypothesis and limits (see lab follow-up above)

**Initial hypothesis: task initialization during temporary node loss leaks the separate operation
statistics on 5.10.16.** This is stronger than a general association with restarts, but is not a
confirmed production call trace or a reproduced fix.

The retained Docker logs identify a specific trigger for the new cohort:

- At **Oct 22 05:55:14.610 UTC**, master crate-03 removed **crate-02** after follower-check retries were exhausted.
- At **05:55:23.594**, crate-02 became a candidate after leader failure; at **05:55:25.754** it reapplied crate-03 as master.
- At **05:55:32.085**, crate-03 recorded crate-02 joining the existing leader, with the same ephemeral node ID.
- The inspected three-minute window on crate-02 includes 1,905 `StacklessClosedChannelException` and 1,133 `IOException` class occurrences. These count log mentions, not unique failures or requests.
- The orphan start times overlap the removal/rejoin and its immediate aftermath. The container timestamps rule out a container restart during this event. The underlying reason for the missed follower checks (network, host/JVM pause, overload, etc.) is unproven.

The exact deployed-tag source supplies a plausible mechanism:

1. [`RootTask` construction](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/execution/jobs/RootTask.java#L171) registers every subtask in `JobsLogs.operationStarted` and attaches its completion listener.
2. [`TasksService.createTask`](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/execution/jobs/TasksService.java#L164) builds that root, inserts it into `activeTasks`, then checks participant membership. If a participant is absent, it calls `TaskCallback` and throws `NoSuchNodeException`; that branch does not kill/complete the new root's subtasks. The callback removes the root from `activeTasks`.
3. [`JobsLogs`](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/execution/engine/collect/stats/JobsLogs.java#L159) keeps a separate `operationsTable`; its entries disappear through `operationFinished`. A missing completion leaves statistics behind even when no live root remains. Separately, completion while stats are disabled can also skip removal; there is no evidence that happened here.
4. [`KILL`'s node action](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/execution/jobs/kill/TransportKillJobsNodeAction.java#L64) calls `TasksService.killJobs`, which looks in `activeTasks`, not `operationsTable`. A detached statistics entry therefore fits the historical **rowcount 0 with unchanged rows**. No KILL was issued in this investigation.

A distinct possibility is a genuine distributed subtask that never completed, rather than a
statistics-only leak. `sys.jobs` tracks coordinator jobs and cannot rule that out by itself.
However, the initialization path above explains why KILL can find nothing. Crucially,
[`DecommissioningService`](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/cluster/gracefulstop/DecommissioningService.java#L228)
waits on `jobsLogs.activeRequests()` and `tasksService.numActive()`, **not** the size of the
operation statistics table. Do not claim these 4,469 rows themselves prove a shutdown blocker.
The historical normal SIGTERM cleared process-local state; it did not establish the counter's cause.

Upstream [PR #18768](https://github.com/crate/crate/pull/18768), merged November 24, 2025,
removed the separate operation table and derives `sys.operations` from active tasks instead.
That implementation is present in the [6.2.0 source](https://github.com/crate/crate/blob/6.2.0/server/src/main/java/io/crate/execution/jobs/TasksService.java),
while the deployed 5.10.16 tag retains the old map. This is a useful comparison target, **not**
proof that upgrading fixes every leaked resource or the follower-check incident.
The [5.10.16 release notes](https://cratedb.com/docs/crate/reference/en/5.10/appendices/release-notes/5.10.16.html)
list a join correctness fix, not this cleanup change. Related disconnect/leak fixes in
[5.10.5](https://cratedb.com/docs/crate/reference/en/5.10/appendices/release-notes/5.10.5.html) and
[5.10.8](https://cratedb.com/docs/crate/reference/en/5.10/appendices/release-notes/5.10.8.html)
already predate the installed version; do not prescribe those as missing patches.

## Original proposed confirmation procedure (lab execution recorded above)

Use an isolated 5.10.16 upstream test/lab with no production credentials:

1. Extend upstream `TasksServiceTest.test_raises_error_if_participating_node_is_missing_on_create` to retain its `JobsLogs`, then check active operations and subtask completion after the missing-participant exception. The existing test only asserts root removal/recent failure, leaving the statistics cleanup untested.
2. Assert the exact symptom: root absent, KILL count zero, operation still listed. Also check task closure/resource release, not merely that a newer version hides the row.
3. Run distributed read queries while disconnecting/rejoining a participant in a disposable three-node lab, recording job UUID, SQL template/type and originating client. Compare the operation signatures and missing-job persistence to this evidence.
4. Compare a candidate release containing #18768 and its relevant cleanup fixes. Verify resource accounting and graceful shutdown as well as visible rows; choose an upgrade target only after compatibility/release-note review.
5. During a future separately approved maintenance window, capture coordinator job metadata immediately around a disconnect/drain before the small history rings evict it. Correlate the same UUID across application/client logs. Retain templates and classifications without member parameters. Historical Oct 22 host/JVM/network telemetry could separately establish why crate-02 lost membership.

No fault injection, JVM attachment, debug logging or stats toggling was performed. This read-only
task deliberately stops at a source-supported hypothesis and a confirmation procedure; it does
not provide a regression test proving a CrateDB engine fix.

## Original read-only advice and owner decision (option A subsequently executed above)

**Recommend no immediate production cleanup, KILL, settings change or restart solely for these rows.**
Keep #644 open: the old “crate-02 has none left” criterion is not met. Prefer a separately scoped
isolated reproduction/upstream investigation before selecting a production remedy.

For a future owner-approved necessary restart, follow the [current runbook](../../cratedb-production-rollout.md#current-stale-context-and-restart-advice--644):
force=false drain, freshly verified zero primaries and settled health gates, then host-managed
normal SIGTERM with unlimited grace if the process remains alive. Prior rollout approval was
specific to that rollout and is not standing permission for a new stop. Never repeat the old KILL
sequence as a clearance step; never shorten grace or escalate to SIGKILL.
The [official rolling procedure](https://cratedb.com/docs/guide/admin/upgrade/rolling.html#graceful-stop-particularities)
distinguishes decommission from normal TERM: TERM itself does not perform the shard drain.

Owner options:

- **A — Recommended:** Leave production unchanged; authorize a separate disposable reproduction and upstream diagnosis, then review a tested fix/upgrade proposal.
- **B:** If there is an independent maintenance need or measured impact, approve one-node-at-a-time maintenance with the documented zero-primary/unlimited-grace gates, accepting that a stop clears local symptoms and recurrence is still possible. Wait for settled shard routing first.
- **C:** Defer root-cause work and retain the evidence/current procedure. This leaves recurrence and future maintenance uncertainty unresolved.

## Evidence and repeatability

- [evidence.json](evidence.json): all nine endpoint observations, counts, metadata, filtered history lookup, settings and sanitized log signatures.
- [operations.json.gz](operations.json.gz): one copy of the identical 4,569 rows, with explicit columns; all nine samples share its canonical-row SHA256 recorded in the JSON. It includes the 100 matching-live-job operations so exclusions can be recomputed.
- [membership-events.txt](membership-events.txt): selected membership events and exception counts; IP addresses redacted and SQL omitted.

Use the runbook's trusted-loopback `crate_sql` helper over SSH, with operator scratch under
`TMPDIR=$HOME/.cache/gw-work/644`. On **each** .11/.12/.13 coordinator, capture:

```sql
SELECT node['name'],job_id,id,name,started,used_bytes
FROM sys.operations
WHERE started < current_timestamp - INTERVAL '1 hour'
ORDER BY node['name'],started,job_id,id;
SELECT id,username,started FROM sys.jobs;
```

Subtract matching job IDs locally, compare the full operation row sets, and repeat at least a
minute later. Do not multiply counts by the number of coordinators: each returns cluster-wide rows.
For surviving candidate IDs, read `sys.jobs_log` with an ID array argument and return only
ID, username, start/end, statement classification and an error-presence flag. Never print member
SQL or parameters. Zero history matches means attribution is unavailable, not that no query ran.
Read-only Docker inspect and bounded logs (`--since 2026-10-22T05:54:00Z --until 2026-10-22T05:57:00Z`)
provided the runtime/membership evidence.

Verification commands, results and limitations are in [validation.txt](validation.txt).
