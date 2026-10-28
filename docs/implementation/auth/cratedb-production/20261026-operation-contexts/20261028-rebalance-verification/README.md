# October 28: search-pool diagnosis and approved rebalance follow-up

**IN PROGRESS — the 20-minute observation and 04:05 backup are not yet verified complete.**
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
At the first comparison: movie median 0.279→0.431 s, show 0.278→0.459 s,
discover 0.238→0.340 s. These include app/network/cache/load differences and cannot
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
shard 4 and `doc.person_worked_on` shard 5. The full interval is still running.

The normal 04:05 hourly backup remains scheduled. A read-only monitor checks it through
all coordinators; **no SUCCESS claim until the actual snapshot is verified**.

[Live summary](summary.json), [sanitized receipts](receipts.json.gz),
[page watcher](pages.jsonl.gz), [initial pools](pool-samples.jsonl.gz),
[rebalance routing/heap/pools/lock samples](rebalance-samples.jsonl.gz),
[backup samples](backup-samples.jsonl.gz), [SQL change acknowledgements](events.jsonl.gz).
Raw query text/values remain private outside Git. Local Q60 policy tests: 11 passed.
