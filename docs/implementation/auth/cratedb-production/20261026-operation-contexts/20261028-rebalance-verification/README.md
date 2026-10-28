# October 28: search-pool diagnosis and approved rebalance follow-up

**Complete: rebalance and both former shard locks verified; the actual 04:05 hourly snapshot is SUCCESS on all coordinators.**
Branch `fix/644-rebalance-verification`, fresh main `ca1545368`.
The owner's new GO permits only `rebalance.enable = all` after normal pools/GREEN,
and returning it to `none` on a lock error or watcher abort. No restart, extra hold,
logging setting change, job rerun or data repair is authorized or performed.

## Search pools and attribution

Four fresh samples before enabling rebalance: search queues 0–4 / capacity 1,000,
active threads 0–13 / 25, rejection counters unchanged at 2,068 / 0 / 585.
All coordinators GREEN, all 1,175 copies STARTED; fresh final gate also below 80% heap.

The exact 02:55–03:05 SQL ranking **cannot be reconstructed from sys.jobs_log**:
by collection at 03:15–03:16, each node retained only about 10,000 rows beginning
03:15:03–03:15:05. The target window returned zero rows, not zero workload.
Settings: size 10,000, expiration 0s, persistent filter false. These are bounded
in-memory logs with old rows evicted, as described in the
[CrateDB system-information documentation](https://cratedb.com/docs/crate/reference/en/latest/admin/system-information.html#jobs-operations-and-logs).
No log configuration was changed to recover unavailable history.

Retained Windmill evidence does identify two concurrent failure paths:

- IMDb ingest started 03:00:00; failed 03:02:11 in `sync_crate`, line 330:
  `DELETE FROM imdb_episode/imdb_season WHERE show_id = ANY(?) AND NOT (CAST(show_id AS TEXT) || ':' || CAST(key AS TEXT) = ANY(?))`.
  It processes batches of 200 shows after bulk upserts. The exact table/arguments
  of this failed execute were not retained; do not fabricate them or SQL timings.
- Priority crawler/next started 03:02:00; failed 03:02:19 in ranked candidate paging.
  Seven SELECT prints survive for `crawl_priority`, ordering by unacknowledged demand
  with cooldown/lease filters and LIMIT/OFFSET. The parent and child errors are one
  propagated failure, not independent proof of two workloads.
- Both use actual role `goodwatch_windmill` through `CrateConnector`.
  Rejections show 25 active / 1,000 queued on crate-01 and crate-03 search executors.
- Final recovery finished 02:59:15.358; stage snapshot finished 03:00:50.967.
  Neither was actively running at the 03:02 failure. Residual cache/I/O effects remain
  possible, but active snapshot/recovery overlap is not supported by those timestamps.

A separate **current** SQL sample (03:16, not the incident window) attributes over
90% of logged requests to `goodwatch_auth`; token/user/consent point reads dominate
count. `admin` catalog/social SQL matches webapp families; `goodwatch_windmill` has
fewer, heavier statements. No `goodwatch_search` SQL was seen in that sample; BLOB
HTTP reads are not SQL jobs, so this does not establish search inactivity.

## Regression assessment

**Do not dismiss a possible query-specific 6.4.6 regression.** Yesterday's 5.10.16
IMDb job succeeded: 2,491 shows, 195,382 episode rows, 11,212 season rows, Crate phase
29.2 seconds, total 121.176 seconds. Today's job planned 2,572 shows, logged progress
past 200 shows, then failed at 131.680 seconds. Root script hash `60deffd57841de1b`
and arguments match. Data, imported dependency versions, concurrent load and cache
state are not controlled. This is a useful comparison, not an isolated reproduction.

Current actual SQL log medians: movie catalog CTE 67–85 ms, show catalog CTE
45.5–81 ms, auth refresh-token reads 2 ms, social-title joins 7.7–8.1 seconds.
The social joins remain materially slow despite normal global pools. The retained
5.10 evidence has HTTP timings and status canaries, **not comparable per-query SQL
server timings**; a SQL before/after ratio cannot honestly be supplied.

Same-page HTTP comparisons against Q50's all-5.10.16 baseline are in the receipts.
Frozen watcher-window comparison (24 baseline vs 152 current probes per endpoint):

| Endpoint | 5.10 median / p95 | 6.4.6 median / p95 |
| --- | --- | --- |
| Movie | 0.279 / 0.453 s | 0.442 / 0.530 s |
| Show | 0.278 / 0.650 s | 0.467 / 0.580 s |
| Discover | 0.238 / 0.672 s | 0.349 / 0.454 s |

 These include app/network/cache/load differences and cannot
attribute the change to CrateDB. Normal current pools and subsequent successful
priority jobs show no sustained executor saturation, but do not exclude a regression
in the large IMDb anti-list DELETE. Confirmation needs a controlled isolated comparison
of the identical SQL/data/parameters on 5.10.16 and 6.4.6, not an unapproved production rerun.

## Approved rebalance and backup

Fresh gates passed on all three coordinators. At 03:19:02 UTC:

```sql
SET GLOBAL TRANSIENT "cluster.routing.rebalance.enable" = 'all';
```

Both allocation and rebalance read back `all` everywhere. The Q60 five-endpoint watcher
runs every 10 seconds, with the original thresholds. On a lock error, watcher alarm,
unsafe heap or failed observation read, the controller returns rebalance to `none`;
no other production changes are armed. Seventeen new groups reached STARTED on
crate-02 by 03:21, including both originally blocked copies: `doc.person_appeared_in`
shard 4 and `doc.person_worked_on` shard 5. The 1,211.9-second interval completed successfully, all coordinators GREEN / 1,175 STARTED,
allocation and rebalance all, no lock errors. Copies balanced 400/374/401 → 392/391/392.
The watcher completed 760 probes: zero failures, zero slow (>3 s) responses, zero alarms; max 2.635 s.
The watcher exited normally after final readback at 03:40:41. No further write is armed.

The scheduled `goodwatch-db-backup-v2.hourly_20261028_040501` is **SUCCESS**, 567 shards, no failures,
identical metadata verified through all three coordinators. Started 2026-10-28T04:05:01.916000+00:00, finished 2026-10-28T04:05:46.759000+00:00
(44.843 seconds). It was the normal cron run, not a manual substitute. No cron or schedule
change was made during this follow-up. Dedicated helper-log evidence is preserved in the receipts;
its completion/cleanup status must be read separately from snapshot SUCCESS.

Final all-coordinator readback after the scheduled snapshot again verifies 6.4.6, GREEN/all copies
STARTED, allocation/rebalance all. Both read-only monitors are stopped; no maintenance is armed.

[Live summary](summary.json), [sanitized receipts](receipts.json.gz),
[page watcher](pages.jsonl.gz), [initial pools](pool-samples.jsonl.gz),
[rebalance routing/heap/pools/lock samples](rebalance-samples.jsonl.gz),
[backup samples](backup-samples.jsonl.gz), [post-test pools](post-test-pools.jsonl.gz), [SQL change acknowledgements](events.jsonl.gz).
Raw query text/values remain private outside Git. Local Q60 policy tests: 11 passed.

The dedicated helper log also confirms **Backup run finished** after cleanup and final verification,
with no BACKUP FAILED marker for this run.
