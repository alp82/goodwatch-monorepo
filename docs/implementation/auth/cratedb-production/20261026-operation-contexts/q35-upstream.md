# Q35: shard-lock lifetime and upstream evidence

Source/document review on October26,2026 for #644. No production access or mutation was performed
by this research subtask. Production logs, operation matches, filesystem metadata and the single
thread dump are recorded separately in the evidence README/receipts. Tagged5.10.16 source and
first-party issue/PR API responses were saved under the local Q35 `upstream/` scratch folder.

## What the lock actually protects

The failing retry in
[`IndicesService.createShard`](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/indices/IndicesService.java#L507)
is entered after `ShardLockObtainFailedException`. This is the node's **in-memory shard lock**,
not evidence that a second OS process owns Lucene's `write.lock` file. `IndexService.createShard`
acquires it with the description `starting shard` before constructing the Store.
[NodeEnvironment](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/env/NodeEnvironment.java#L630)
keeps `ShardId → InternalShardLock`, backed by a semaphore, and releases it through the returned
ShardLock's close callback.

The timeout exception can identify a **lifecycle description and age**, not a job/thread owner.
[`InternalShardLock.acquire`](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/env/NodeEnvironment.java#L744)
formats the current description and elapsed milliseconds since its last update. `setDetails` resets
that timestamp. Therefore an age reported with `closing shard` is time since that description was
set, not necessarily time since the original lock acquisition or creation of a particular query.

[`IndexService.closeShard`](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/index/IndexService.java#L434)
first calls Store.beforeClose; [`Store.beforeClose`](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/index/store/Store.java#L694)
sets `closing shard`. The shard is removed from the IndexService map before closure. Store.close
then decrements a reference; it does **not** forcibly close a Store with outstanding references.
Only [Store.closeInternal](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/index/store/Store.java#L422)
closes the directory and shard lock when the reference count reaches zero. This explains how a
shard can disappear from current shard routing/IndexService while a closing Store still owns its lock.

## A concrete query-reference path that can retain it

The tagged code contains this complete lifetime chain:

1. [`FetchTask`](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/execution/engine/fetch/FetchTask.java#L268)
   retains a map of acquired searchers, with acquisition labels containing job UUID, phase ID and name.
2. [`SharedShardContext`](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/execution/jobs/SharedShardContext.java#L44)
   acquires an IndexShard/Engine searcher through a reference-counted wrapper.
3. [`Engine.acquireSearcher`](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/index/engine/Engine.java#L543)
   increments the Store reference; the searcher's close callback decrements it.
4. [`FetchTask.close/kill`](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/execution/engine/fetch/FetchTask.java#L210)
   closes those searchers. Kill defers that release while searchers are borrowed; the last borrow return
   completes the release. A task that fails to reach these paths can therefore retain the Store and lock.

This is a **mechanism and hypothesis for this incident**, not an identification of one production
FetchTask. Other searcher-owning collect/query paths can retain Store references too. An old
`sys.operations` row alone is insufficient:5.10 keeps a separate statistics map which can retain
already-closed tasks; a correctly closed FetchTask clears its searcher map. Old open segment FDs,
missing jobs, closing-shard lock descriptions and their timing strengthen the hypothesis, but a
reference graph or direct holder instrumentation would be needed to name the exact owning object.

A particularly relevant first-party analogue is
[Crate issue#18722 and maintainer comments](https://github.com/crate/crate/issues/18722): on5.10.14,
affected targets did not recover after node restarts; changing replicas off/on did not help, while
restarting the affected target did. Maintainers explain that stuck queries retaining searchers are a
common cause and that cheap reference counting currently does not record which job owns each lock.
They closed the issue without a unique remedy because there was no reproducible root cause. This
supports the mechanism and diagnostic limitation, **not proof that this deployment has the identical bug**.

## Why WARN logs can omit the holder description

In5.10.16 the createShard retry handler catches the original lock exception but does not log its
message. It warns only if the computed delay equals5000ms. However
[`LimitedExponentialBackoff`](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/action/LimitedExponentialBackoff.java#L47)
returns `50 + min(5000, floor((iteration/e)^1.8))` milliseconds. Enumerating all1000 configured
iterations gives **no delay equal to5000**, a cap of5050ms and a total4055.692s. Thus the normal
WARN branch does not expose the lock exception during this retry sequence. At exhaustion, `next()`
throws NoSuchElementException without retaining that original lock exception as its cause.

This source-level logging defect explains why logs can show only the final backoff exhaustion while
hiding `closing shard`/age. A direct lock timeout in another code path may still include those details.
Do not raise production logging to try to force them under this read-only task.

## Upstream fixes: what is and is not missing

| Upstream item | Version/relevance |
| --- | --- |
| [#13982](https://github.com/crate/crate/issues/13982), later async creation work | Describes locked shards after overloaded nodes leave/rejoin and motivates non-blocking retries. Tagged5.10.16 already has async retries; merely increasing retries does not release a leaked reference. |
| [#17673](https://github.com/crate/crate/pull/17673), backport[#17675](https://github.com/crate/crate/pull/17675) | Fixes retry behavior across cluster-state changes; [5.10.4 notes](https://cratedb.com/docs/crate/reference/en/5.10/appendices/release-notes/5.10.4.html) document it. **Already included in5.10.16**; not a missing update. |
| [#18728](https://github.com/crate/crate/pull/18728), related[#18721](https://github.com/crate/crate/issues/18721) | PG client-disconnect large-result memory leak; released5.10.15,6.0.4,6.1.1. Already included in5.10.16. Its existence does not identify these holders. |
| [#18723](https://github.com/crate/crate/pull/18723) | GROUP BY/LIMIT0 query-accounting leak, released5.10.15,6.0.4,6.1.1. Already included; not a newly available remedy. |
| [#18768](https://github.com/crate/crate/pull/18768),6.2.0 | Removes separate operation statistics storage and derives operations from active tasks. Improves observability/retention; does not establish that all searcher leaks or already-held5.10 locks are repaired. |
| [#19901](https://github.com/crate/crate/pull/19901), backport of[#19653](https://github.com/crate/crate/pull/19653), [6.4.3 notes](https://cratedb.com/docs/crate/reference/en/6.4/appendices/release-notes/6.4.3.html) | Fixes task cleanup when a disconnected coordinator was not listed as a participant. A plausible preventive fix for a node-loss task leak, included in proposed6.4.6. It is not evidence that every existing lock has that origin or that an upgrade can release it without replacing its process. |
| [#19582](https://github.com/crate/crate/pull/19582) | Resize/.resized temporary-index kill-cleanup race. Different lifecycle; not a general unlock operation for these ordinary existing tables. No evidence that it applies here. |

The ancient searcher-release races in[#10560](https://github.com/crate/crate/pull/10560), merged2020,
also support the general resource-retention mechanism. They predate installed5.10.16 and are not a
reason to prescribe a currently missing patch. No first-party issue/source reviewed here establishes
a universally safe SQL “unlock this old Store” command.

## Thread-dump and on-disk limits

A thread dump is a single stack snapshot. The shard mutex is a **Semaphore**, whose permit is not
owned by an enduring Java thread: a task/object reference can retain the Store while no thread is
executing that task. Async createShard retries can be between short callbacks, so absence of a
blocked createShard/search thread does not rule out this leak. `Thread.print -l` reports stacks and
owned synchronizers; it is not a heap reference graph and cannot enumerate every old FetchTask's
searcher map or Store refcount.

Likewise a persistent `write.lock` filename/mtime says neither that it is actively locked nor who
holds the in-memory NodeEnvironment lock. An open old .fdt/.fdx FD proves a reader reference at that
instant, not its job UUID. **Never delete write.lock, index files or old shard directories as a remedy.**

## Remedy assessment — no action authorized here

| Option | Assessment and risk |
| --- | --- |
| Wait/observe | Avoids operational disruption but does not close a leaked strong reference. Useful only if counters/holders show a legitimate finite operation; the recorded stalled interval and repeated backoff failures do not show that progress. |
| Specific REROUTE CANCEL | The [documented action](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/alter-table.html#reroute) cancels an allocation/recovery. [The command implementation](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/org/elasticsearch/cluster/routing/allocation/command/CancelAllocationCommand.java#L128) fails the specified routing copy and removes its allocation ID: cancelling the active source is not merely clearing a flag and can reduce redundancy. RoutingNodes includes the synthetic INITIALIZING target, so a separately approved target-node cancellation could abort only that target attempt instead. Neither action walks old FetchTask/Store references; the same target can immediately retry and hit the same lock. This is potential mitigation of a busy rebalance slot, not a validated holder-release cure. No cancellation is authorized here. |
| REROUTE MOVE / allocate elsewhere | May route around a bad target if a compatible eligible node lacks the shard; it does not release the old lock. With the existing primary/replica on the other two nodes, another replica cannot simply be placed beside the same shard's existing copy. Extra capacity is an infrastructure change, not a proven narrow fix. |
| Specific job cancellation | Could release searchers if the actual live owning RootTask can be identified. [TasksService](https://github.com/crate/crate/blob/5.10.16/server/src/main/java/io/crate/execution/jobs/TasksService.java#L219) enumerates active RootTasks and ignores missing IDs; a residual statistics row without its root is not sufficient. [KILL](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/kill.html) may leave partial writes and is expressly prohibited in this task. Earlier failed KILLs must not be replayed. |
| Close/reopen, change replicas, delete files, clear stats | No validated reference-release remedy here. Closing/reopening changes table availability and may encounter the same retained Store; replica changes weaken protection. Deleting files risks corruption/data loss; clearing statistics is not closing the underlying task. None is authorized. |
| Guarded normal restart of only crate-02 | The most direct process-scoped way to release every JVM reference/in-memory shard lock **once the process exits**; supported by the5.10.14 issue's outcome. Requires separate owner approval, current primary/copy/backup gates, a single-node safe drain and unlimited-grace normal stop. It may take time or fail to exit promptly; do not force it. Reduced redundancy, member errors/recovery load and another node loss are material risks. A restart can remove the symptom without curing the leak, so recurrence after future disconnects remains possible. |

A restart is therefore the **best-established bounded operational reset**, not a mathematical proof
that no narrower remedy can ever exist. If Q35 identifies an actual reachable holder, reassess a
separately approved targeted action. If only refcount-retention evidence is available, no narrower
validated release path was established by the reviewed primary sources. Do not issue any mutation
under the research recommendation.
