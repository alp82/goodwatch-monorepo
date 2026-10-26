# #644: operation-context investigation, 2026-10-26

Read-only inspection of the production cluster at **00:11:04–00:12:38 UTC** through each of
crate-01/02/03. Starting revision: `origin/main` **bb1265d4a**. No KILL, restart, decommission,
setting change, client repair, snapshot mutation or production file write was performed.
The backup failover part is already complete (`ee610dd1d`); its actual production failover
is recorded in [the enforcement execution](../20261015-enforcement/README.md).

## Current counts

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

## Likely cause and limits

**Best hypothesis: task initialization during temporary node loss leaks the separate operation
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

## How to confirm without experimenting on production

Use an isolated 5.10.16 upstream test/lab with no production credentials:

1. Extend upstream `TasksServiceTest.test_raises_error_if_participating_node_is_missing_on_create` to retain its `JobsLogs`, then check active operations and subtask completion after the missing-participant exception. The existing test only asserts root removal/recent failure, leaving the statistics cleanup untested.
2. Assert the exact symptom: root absent, KILL count zero, operation still listed. Also check task closure/resource release, not merely that a newer version hides the row.
3. Run distributed read queries while disconnecting/rejoining a participant in a disposable three-node lab, recording job UUID, SQL template/type and originating client. Compare the operation signatures and missing-job persistence to this evidence.
4. Compare a candidate release containing #18768 and its relevant cleanup fixes. Verify resource accounting and graceful shutdown as well as visible rows; choose an upgrade target only after compatibility/release-note review.
5. During a future separately approved maintenance window, capture coordinator job metadata immediately around a disconnect/drain before the small history rings evict it. Correlate the same UUID across application/client logs. Retain templates and classifications without member parameters. Historical Oct 22 host/JVM/network telemetry could separately establish why crate-02 lost membership.

No fault injection, JVM attachment, debug logging or stats toggling was performed. This read-only
task deliberately stops at a source-supported hypothesis and a confirmation procedure; it does
not provide a regression test proving a CrateDB engine fix.

## Current operational advice and owner decision

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
