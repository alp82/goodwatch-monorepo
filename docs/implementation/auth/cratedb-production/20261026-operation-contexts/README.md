# #644: operation-context investigation, 2026-10-26

Read-only inspection of the production cluster at **00:11:04–00:12:38 UTC** through each of
crate-01/02/03. Starting revision: `origin/main` **bb1265d4a**. No production KILL, restart, decommission,
setting change, client repair, snapshot mutation or file write was performed.
The backup failover part is already complete (`ee610dd1d`); its actual production failover
is recorded in [the enforcement execution](../20261015-enforcement/README.md).

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
