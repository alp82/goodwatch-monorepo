# October 28: all nodes on 6.4.6; stopped at final checkpoint

**All 14 remaining plain-stop replacements completed.** Crate-01/02/03 are **6.4.6**, with their
original persistent IDs/data volumes. **The approved procedure stopped at its first failed gate:**
03:02:16.863 UTC, a periodic `sys.health` query through crate-01 returned HTTP 500 during the final
five-minute homogeneous observation. The failure remains latched. No retry of the stage, further
restart, rollback, extra job hold, thread-pool change or rebalance test was performed.

## Safe handover

- All three coordinators verified **145 GREEN / 1,175 STARTED**, including the final read at 03:08 UTC.
- All 145 original table policies restored. The 14 YepWatch waits are **3** again, replicas unchanged,
  no write blocks. Matching 6.4.6 decoders independently verified persisted **index and relation**
  metadata on all three nodes, including wait 3 / replica 2 / blocks false for those 14 tables.
- Docker policies and durable Compose overrides are **always**, pinned to approved 6.4.6 digest;
  original volumes, mounts, password HBA, command, memory/heap and persistent node IDs retained.
- Allocation **all**, rebalance **none**, no exclusions/decommission. **Crate-02's final placement/lock
  test is unproven**: enabling rebalance after this failed gate needs a new owner decision. No new
  `ShardLockObtainFailedException` was found in the per-node post-start checks; that does not substitute
  for the omitted 20–30 minute placement observation.
- All nine original Windmill schedule configurations and enabled states restored at
  2026-10-28T03:07:10.144599+00:00. Four missed occurrences recorded, no manual reruns/enqueues,
  and fresh queue inspection found no historical held occurrence queued for catch-up.
- Backup cron restored **byte-for-byte** at 2026-10-28T03:07:08.324454+00:00, SHA256
  `374f2ac2eea0fee650130b13c5ae3cf24276f80dabee6b35c54fb2cf5f502e37`. One active `5 * * * *` entry verified.
  **Next hourly run: 04:05 UTC, pending; not claimed SUCCESS.** The 02:05/03:05 occurrences were held.
- Actual deployed catalog/auth/search clients on both app hosts and worker password/negative-auth
  probes passed after cleanup. No preview/server or synthetic production writes were started.
- Local heap collector and watcher exited normally, watcher last. Handover observation interval:
  2026-10-28T01:10:42.023576+00:00 to 2026-10-28T03:09:40.763303+00:00. Nothing is armed.

## Failed gate and best hypothesis

The health query's response body was discarded by the existing read helper's `curl --fail`, so its exact
SQL error is **not retained**. Do not claim it conclusively identified the exception. Concurrent Windmill
failures at 03:02:11–03:02:19 explicitly show **EsRejectedExecutionException**: crate-01 and crate-03
search executors each had **25 active threads and 1,000 queued tasks**. A fresh 03:03 read showed
cumulative rejections **2,068 / 0 / 585** on crate-01/02/03, empty search queues, and GREEN/all copies
STARTED; heaps were 43.77% / 32.32% / 32.52%. This strongly points to transient search-pool saturation
as the failed health request's cause. **The workload trigger and whether 6.4.6 changed behavior remain
unverified**; bulk ingest and priority crawling were active under the owner's heavy-job waiver.
Do not blame a particular job or dismiss a possible regression without further read-only investigation.

Q62 was followed even though the queues cleared: the final observation was not resumed and rebalance
stays none. Only required cleanup proceeded after fresh GREEN/all-copy/no-active-snapshot checks;
the original gate-failure file was preserved. Recommend read-only diagnosis of the rejection burst
before separately authorizing the final rebalance observation. No additional production fix proposed
or armed in this handover.

## Replacement timings

First SIGTERM 2026-10-28T01:30:31.935502+00:00; final node GREEN 2026-10-28T02:59:15.357860+00:00,
88.7 minutes including intermediate checkpoints/heap gates.
The full gate-to-monitor-stop interval was 119.0 minutes.

| Target | Node | SIGTERM UTC | Rejoined UTC | GREEN UTC | Stop → GREEN |
| --- | --- | --- | --- | --- | --- |
| 6.0.8 | crate-03 | 01:30:31 | 01:31:05 | 01:32:55 | 143.6 s |
| 6.0.8 | crate-01 | 01:36:06 | 01:36:33 | 01:38:00 | 113.5 s |
| 6.1.6 | crate-02 | 01:50:34 | 01:50:59 | 01:52:12 | 98.8 s |
| 6.1.6 | crate-03 | 01:54:44 | 01:55:11 | 01:56:36 | 112.0 s |
| 6.1.6 | crate-01 | 01:59:03 | 01:59:28 | 02:00:52 | 109.6 s |
| 6.2.11 | crate-02 | 02:10:44 | 02:11:06 | 02:12:19 | 95.0 s |
| 6.2.11 | crate-03 | 02:14:43 | 02:15:10 | 02:16:35 | 111.8 s |
| 6.2.11 | crate-01 | 02:18:43 | 02:19:03 | 02:20:27 | 103.4 s |
| 6.3.7 | crate-02 | 02:30:23 | 02:30:42 | 02:32:05 | 102.3 s |
| 6.3.7 | crate-03 | 02:34:23 | 02:34:49 | 02:36:13 | 110.1 s |
| 6.3.7 | crate-01 | 02:38:13 | 02:38:34 | 02:39:46 | 92.5 s |
| 6.4.6 | crate-02 | 02:49:55 | 02:50:15 | 02:51:28 | 92.9 s |
| 6.4.6 | crate-03 | 02:53:44 | 02:54:09 | 02:55:34 | 109.5 s |
| 6.4.6 | crate-01 | 02:57:44 | 02:58:02 | 02:59:15 | 90.6 s |

Every stop was host-managed SIGTERM with unlimited grace and no SIGKILL, confirmed normal exit before
next-image replacement. No drain, decommission, replica removal or data-directory downgrade. Each
individual replacement recovered GREEN, including mixed-version stages. Approved 10/2/2-minute heap
histories passed, all below 80%; >85% emergency guard and Q60 watcher remained active. The original
04:00 deadline was removed; deployments could finish within 15 minutes before fresh GREEN/watcher
checks; existing heavy work was allowed except schema/index publication. All nine future schedules
were held for the window. Qualified check 3 remained the verified future-7.x advisory.

## Snapshots and BLOB grant

V2 stayed registered and writable at `/snapshots/q65-mixed-20261027` throughout. The read-only protected
`goodwatch-pre6` registration at `/snapshots/v2` was untouched; no root alias/repository transition.
Fresh forward snapshot `q65_pre_resume_20261028` succeeded before the first stop. All later snapshots
below are in **goodwatch-db-backup-v2**, SUCCESS/no failures verified through every coordinator:

| Snapshot | State | Shards | Finished UTC |
| --- | --- | --- | --- |
| q65_stage_608_20261028 | SUCCESS | 567 / no failures | 01:46:27.294 |
| q65_stage_616_20261028 | SUCCESS | 567 / no failures | 02:04:20.095 |
| q65_stage_6211_20261028 | SUCCESS | 567 / no failures | 02:22:21.106 |
| q65_stage_637_20261028 | SUCCESS | 567 / no failures | 02:41:20.501 |
| q65_stage_646_20261028 | SUCCESS | 567 / no failures | 03:00:50.967 |

**Snapshot SUCCESS is distinct from final checkpoint completion:** `q65_stage_646_20261028` finished
03:00:50.967 UTC, but the subsequent five-minute health observation failed. Do not fabricate a
`hop-646-complete` receipt.

The separate forward BLOB copy has 38 unique SHA1 objects / 271,593,347 bytes, all 21 current references
verified. Original protected 5.x snapshot/BLOB pair untouched. Q55 `GRANT DQL ON SCHEMA blob TO
goodwatch_search` was applied at homogeneous 6.1.6, before the first 6.2.11 node. Exact grant read back
through all three; actual search credentials verified all 21 refs with HEAD/GET, length and SHA1 through
each coordinator (126 checks). Subsequent per-node and post-cleanup BLOB canaries passed, homogeneous
6.4.6 SQL inventories agreed on all 21 objects.

Rollback remains separately approved restore to **fresh 5.10.16 directories**, never an image reversion
on upgraded data. Protected `goodwatch-pre6.q53_pre6_20261027` finished October27 23:02:34.012 UTC;
Q61 accepts loss of later writes. New 6.x snapshots are forward recovery points, not replacements for
that protected 5.x point. No restore was attempted; production-volume RTO remains unqualified.

## Watcher and failed Windmill jobs

**3565 probes, 0 unexpected status/transport errors, 3 responses over
3 seconds, 0 alarms; maximum 4.125801 seconds.** The three slow expected-status
responses were isolated, not Q60's three within one minute. These are sampled endpoint results,
not proof every member request succeeded. The database/job failures above occurred despite healthy
external page probes.

Complete failed-job inventory, including children and earlier-started jobs, from 2026-10-28T01:10:42.023576+00:00 to
2026-10-28T03:09:40.763303+00:00; **9 records, none rerun**:

- `f/monitoring/check` — `01a18024-85b9-2688-7b60-b8d3c8964bfc`, failed 2026-10-28T01:36:10.384073+00:00, parent `None`: **ProgrammingError** — NodeNotConnectedException[[crate-01][10.0.0.11:4300] Node not connected].
- `f/social/ingest` — `01a1802a-0677-d353-8f0d-34ea2eb4731e`, failed 2026-10-28T01:59:25.141000+00:00, parent `01a17ff3-1724-a02f-2f6d-f1a93d2454aa`: **JSONDecodeError** — Expecting value: line 1 column 1 (char 0).
- `f/social/discover` — `01a17ff3-1724-a02f-2f6d-f1a93d2454aa`, failed 2026-10-28T01:59:25.172803+00:00, parent `None`: **JSONDecodeError** — Expecting value: line 1 column 1 (char 0).
- `f/monitoring/check` — `01a18069-328b-9139-2e67-4dc49b4d4bee`, failed 2026-10-28T02:53:50.568414+00:00, parent `None`: **ProgrammingError** — NodeNotConnectedException[[crate-03][10.0.0.13:4300] Node not connected].
- `f/social/ingest` — `01a18060-f44a-cfca-b317-c61748e97b57`, failed 2026-10-28T02:58:01.041336+00:00, parent `01a1802a-0630-fb0e-d6b3-c5850e192d3e`: **JSONDecodeError** — Expecting value: line 1 column 1 (char 0).
- `f/social/discover` — `01a1802a-0630-fb0e-d6b3-c5850e192d3e`, failed 2026-10-28T02:58:01.079923+00:00, parent `None`: **JSONDecodeError** — Expecting value: line 1 column 1 (char 0).
- `f/imdb_datasets/ingest` — `01a17b4e-c18d-c4e9-2625-e10e019a0633`, failed 2026-10-28T03:02:11.711436+00:00, parent `None`: **ProgrammingError** — EsRejectedExecutionException[rejected execution of [collect/LOW=io.crate.execution.engine.collect.CollectTask$$Lambda/0x000000008911a800@1484b3b9] on [name = crate-03/search, queue capacity = 1000, org.elasticsearch.threadpool.PrioFixedExecutorBuilder$1@15d114ce[Running, pool size = 25, active threads = 25, queued tasks = 1000, completed tasks = 314871]]].
- `f/priority/next` — `01a18075-1878-e4ca-e0bd-ed79b2485c73`, failed 2026-10-28T03:02:19.290104+00:00, parent `01a18074-cad1-814b-b76e-1b93f8923e1b`: **ProgrammingError** — EsRejectedExecutionException[rejected execution of [pageBucketReceiver/HIGH=io.crate.execution.jobs.CumulativePageBucketReceiver$$Lambda/0x0000000061189800@714c6664] on [name = crate-01/search, queue capacity = 1000, org.elasticsearch.threadpool.PrioFixedExecutorBuilder$1@b768a65[Running, pool size = 25, active threads = 25, queued tasks = 1000, completed tasks = 142774]]].
- `f/priority/crawl_all` — `01a18074-cad1-814b-b76e-1b93f8923e1b`, failed 2026-10-28T03:02:19.322586+00:00, parent `None`: **ProgrammingError** — EsRejectedExecutionException[rejected execution of [pageBucketReceiver/HIGH=io.crate.execution.jobs.CumulativePageBucketReceiver$$Lambda/0x0000000061189800@714c6664] on [name = crate-01/search, queue capacity = 1000, org.elasticsearch.threadpool.PrioFixedExecutorBuilder$1@b768a65[Running, pool size = 25, active threads = 25, queued tasks = 1000, completed tasks = 142774]]].

The monitoring node-not-connected failures coincide with approved node stops. The social parent/child
JSON-decode errors at 01:59:25 and 02:58:01 coincide with crate-01 swaps; the earlier trace reaches the
Crate HTTP response decoder, but HTTP status/body were not retained, so precise causes remain unproven.
The 03:02 executor-rejection burst caused the strict checkpoint stop described above.

## Verification and retained evidence

- Local Q60 watcher tests: **11 passed**; BLOB-copy guard tests: **4 passed**.
- Production gates, same-ID rejoin, all-copy recovery, actual deployed reads/auth/BLOB/YepWatch after
  each node; snapshots per homogeneous version; final original policies/runtime/metadata/cron/schedules.
- No application code changed, no application server started. No additional production mutation after
  the failed gate beyond required table-policy and schedule/cron restoration.
- A local metadata-reader filename initially shadowed Python's stdlib `copy`. The local controller
  was interrupted before SIGTERM after acknowledged pre-stop preparation, the filename corrected,
  and stable index metadata verified on all nodes before guarded resume without replaying settings.
  No Crate process was signalled by that correction; no genuine production alarm was cleared.

[Summary/timings](progress.json), [sanitized receipts](receipts.json.gz), [watcher](pages.jsonl.gz),
[heap samples](heap-stream.jsonl.gz), [operation acknowledgements](events.jsonl.gz).
Raw credentials/configs/binary state copies remain private outside Git. Base `de2749c94e8df87a9dd4e8b0acc4362578515142`,
branch `fix/644-rolling-upgrade-execution`; locally committed only.
The [runbook](../../../../crate-6-upgrade.md) is retained as the approved historical procedure.
