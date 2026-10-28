# #782 — IMDb anti-list DELETE: 5.10.16 versus 6.4.6

**Verdict: no reproducible steady-state regression of the original DELETE, and no
reproduction of the production search-pool saturation in this isolated lab.**
Warm medians differ by −2.6% to +1.1%; trial ranges overlap. No original-statement run
rejected a search/write task. This does not rule out production-specific contention,
data distribution, cold recovery/cache effects, or a wider workload interaction.
**No application/production code change is recommended or included.**

## Results

Three warm trials per cell, identical synthetic input and snapshot reset before each
trial. Times are wall seconds for all 13 batches (26 DELETE statements). The last two
rows also include the real script's bulk upserts immediately before each DELETE.

| Scenario | 5.10.16 median | 6.4.6 median | 6.4.6 / 5.10 |
| --- | ---: | ---: | ---: |
| Original DELETE alone | 0.705 s | 0.713 s | 1.011 |
| Original DELETE + priority paging | 0.709 s | 0.704 s | 0.992 |
| Upsert → original DELETE, alone | 2.509 s | 2.443 s | 0.974 |
| Upsert → original DELETE + paging | 2.522 s | 2.489 s | 0.987 |

The DELETE portion of the upsert scenarios is 0.688–0.704 s at the per-version
scenario medians; most phase time is upserting, not anti-list deletion.

| Scenario | Version | Sampled search active / queue | Sampled write active / queue | Search + write rejections | Peak observed heap |
| --- | --- | ---: | ---: | ---: | ---: |
| DELETE alone | 5.10.16 | 2 / 0 | 1 / 0 | 0 | 59.8% |
| DELETE alone | 6.4.6 | 2 / 0 | 2 / 0 | 0 | 60.6% |
| DELETE + paging | 5.10.16 | 2 / 0 | 1 / 0 | 0 | 51.5% |
| DELETE + paging | 6.4.6 | 2 / 0 | 1 / 0 | 0 | 60.3% |
| Upserts + DELETE | 5.10.16 | 2 / 0 | 3 / 0 | 0 | 58.9% |
| Upserts + DELETE | 6.4.6 | 0 / 0 | 3 / 0 | 0 | 66.5% |
| Upserts + DELETE + paging | 5.10.16 | 2 / 0 | 4 / 0 | 0 | 61.2% |
| Upserts + DELETE + paging | 6.4.6 | 2 / 0 | 3 / 0 | 0 | 60.5% |

Peaks are the maximum across three nodes and three trials, sampled through
`sys.nodes` approximately every 200 ms plus query time. They are **lower bounds** on
instantaneous peaks: a zero sampled write-active value does not mean no write ran.
Rejection deltas are cumulative counters read before/after each run and were zero.
Per-batch/per-table wall/server timings, deletes, keep-list lengths and upsert timings
are in [batches.csv](batches.csv); exact trials and resource summaries are in
[results.json](results.json). Full telemetry and profiles: [receipts.json.gz](receipts.json.gz).

### Exploratory first passes, retained rather than hidden

The first accepted DELETE-only runs were 0.778/0.730 s (5.10, alone/paging) and
1.100/0.777 s (6.4). Initial upsert phases were 3.425/2.528 s and 4.920/2.692 s.
These had unequal JVM/JIT warm-up history; the 5.x lab had also seeded the corpus.
The apparent first-run gap disappeared with warm repetitions and a reopened 5.x
control. Do not treat those first passes as a controlled cold-start benchmark.

One earlier exploratory run had an off-by-one in synthetic season keep-list length.
A cardinality assertion caught it; the generator was corrected and that run was
excluded. Its receipt is retained under `discarded_files`. All accepted runs use
exactly 195,382 episode keys and 11,212 season keys across the changed shows.

## Isolation, images and resources

Read #782 with `gh issue view 782`; fresh branch from origin/main `6a5a64cf2`.
**No production contact, SSH, production environment file or application import.**
Only local Docker commands and HTTP to task-owned container IPs were used for the lab.
SQL refuses 10.0.0.0/8, addresses outside the inspected Docker subnet and redirects;
environment HTTP proxies are disabled. Unit tests exercise those refusals without
making requests. CrateDB telemetry was disabled in both versions.

Each version used three nodes, network `gw782-isolated-20261028` with `--internal`,
no published ports, and bind data/repository under `~/.cache/gw-work/782-lab`.
Only one version ran at a time. Both used:

- 4 GiB container memory and 2 GiB Java heap per node.
- Four CPU quota cores per node; `ActiveProcessorCount=16` makes JVM pool sizing
  match the production geometry: 25 search threads and 16 write threads.
- Identical six-shard IMDb tables, routing by `show_id`, replica setting `0-1`
  (one replica with three nodes), plus the real three-shard priority table.

Pinned production images, already cached locally:

- `crate:5.10.16@sha256:5d7cd92eb84d56d538e2222a436e432164b853fdf186aebb17c446787f23a307`
- `crate:6.4.6@sha256:8d3e8778378236192724776877d2ea4546d5b5586362c8d174e6aa46177bb0fb`

CPU/heap limits are smaller than production; internal pool sizes match, physical
capacity does not. No broad production auth traffic, other table workload, rolling
recovery or large database working set was reproduced. SQL used the trusted local
lab user rather than production credentials. Short-run wall times also depend on
host scheduling, JIT and cache state; three trials cannot detect a tiny regression.

## Synthetic corpus and correctness oracle

[schemas.json](schemas.json) contains the real cached Q53 `SHOW CREATE TABLE` output
for `doc.imdb_episode`, `doc.imdb_season` and `doc.crawl_priority` (strict columns,
composite primary keys, routing, shards and replica policy). No real rows were copied.

Changed subset: **2,491 shows, 195,382 retained episodes, 11,212 retained seasons**.
There are also 133 synthetic stale episodes and 20 stale seasons spread across shows.
Background shows outside the changed set bring the seeded table totals to
**825,015 episodes and 77,256 seasons**, modeling the earlier job's full-table counts,
not claiming a new production inventory. Priority has 100,000 synthetic movies and
60,000 shows. Names/ratings/IDs are deterministic synthetic values; episode specials
include NULL season numbers, while primary keys remain non-NULL.

The 5.10 seed was refreshed, optimized, analyzed and snapshotted once. Every trial
restored the same immutable local snapshot, waited for GREEN/STARTED, and analyzed.
6.4.6 also restored this **5.10-created snapshot**, rather than loading new-version
indexes. Receipts confirm `version.created=5.10.16` in both versions and
`version.upgraded=6.4.6` after restore on 6.4.6.

The original 200-show chunks and composite string keep arrays match `sync_crate`.
The final chunk has 91 shows. The upsert scenarios send the whole per-table chunk as
one `_sql` `bulk_args` request, with the same PK/conflict-update behavior and subsequent
DELETE ordering as `CrateConnector.upsert_many(replace_nulls=True)`. No artificial
1,000-row client split was introduced. All bulk results are checked for partial errors.

Paging uses the exact `crawl_priority` demand/cooldown/lease predicate and ordering,
LIMIT 100, offsets cycling 0…600, alternating movie/show, one sequential reader capped
at one request/second. It is not a high-concurrency overload test. DELETE-only runs are
short, so they overlap few paging queries; the upsert scenarios extend that overlap.

After every accepted original run, the independent oracle verifies:

- Exactly 824,882 episode and 77,236 season rows remain.
- All 133/20 marked stale rows disappeared.
- The changed subset retains exactly 195,382/11,212 rows.

Because the tested statements only delete, the initial corpus consists solely of
known keep/background/stale rows, and all marked stale rows plus exactly that many
total rows are gone, this also checks that no keep/background rows were deleted.

## EXPLAIN ANALYZE

[CrateDB documents EXPLAIN for SELECT and COPY FROM, not DELETE](https://cratedb.com/docs/crate/reference/en/latest/sql/statements/explain.html).
The lab therefore profiles the equivalent `SELECT show_id,key` with the **identical
WHERE predicate and first-batch arguments**; actual DELETE timings are measured
separately. Both versions have the same logical Collect/filter plan. Both use a
`PointInSetQuery` for show selection and `GenericFunctionQuery` for concatenated-key
membership. Lucene wrapper details differ (including ConstantScore in 6.4).

One-shot profiled SELECT `Total` times were 106.8→135.1 ms (episode) and 3.76→7.40 ms
(season). These instrumented, single-profile measurements are not the steady-state
DELETE comparison; their detail and wall times are retained in the receipts, not
used to claim a large production regression or saturation.

## Candidate evaluated, not proposed for production

A per-show typed-key form removes concatenation:

```sql
DELETE FROM imdb_episode
WHERE show_id = ? AND NOT (imdb_episode_id = ANY(?));
```

A two-show bulk probe worked, but a **200-item bulk request stalled** with idle search
and write pools: the full 6.4.6 candidate hit the 180-second client timeout; the 5.10
probe was still pending at its 15-second deadline. Those unequal deadlines are not a
performance ratio. Local job/context receipts were captured; local-only KILL attempts
returned zero, and normal Docker stops ended the labs. This is a different bulk
execution path, **not a reproduction of the production single-statement DELETE**.
It is not a safe or verified faster fix and must not be deployed from this experiment.

No production diff is proposed: the original has no meaningful slowdown/pool regression
in this test. Applying a speculative rewrite or batch-size change is not justified by
these results. The production burst still needs a wider contention/cold-recovery
reproduction if further diagnosis is wanted. The earlier record's missing 03:02 SQL
history remains a limitation, not evidence that the incident did not occur.

## Reproduce the accepted comparison

Requires cached pinned images and Docker; only Python's standard library is used.
From the repo root (this creates and removes only labeled local lab resources):

```bash
export TMPDIR="$HOME/.cache/gw-work/782-lab"
mkdir -p "$TMPDIR"
LAB=docs/research/782-imdb-delete-lab
trap 'python3 "$LAB/lab.py" cleanup' EXIT
python3 -m unittest discover -s "$LAB" -p 'test_fixture.py'
python3 "$LAB/lab.py" start 5.10.16
python3 "$LAB/lab.py" seed
for version in 5.10.16 6.4.6; do
  if [ "$version" = 6.4.6 ]; then
    python3 "$LAB/lab.py" stop
    python3 "$LAB/lab.py" start "$version"
  fi
  python3 "$LAB/bench.py" run prime --upserts
  for n in 1 2 3; do
    python3 "$LAB/bench.py" run "alone-warm$n"
    python3 "$LAB/bench.py" run "paging-warm$n" --paging
    python3 "$LAB/bench.py" run "upsert-alone-warm$n" --upserts
    python3 "$LAB/bench.py" run "upsert-paging-warm$n" --upserts --paging
  done
  python3 "$LAB/lab.py" restore
  python3 "$LAB/bench.py" profile original
 done
python3 "$LAB/lab.py" cleanup
python3 "$LAB/summarize.py"
trap - EXIT
```

Use an empty scratch directory; the harness refuses to overwrite a named trial.
The historical typed-bulk probe is intentionally not part of this default recipe.
The accepted experiment also reopened 5.10 after 6.4 as a control against host/order
and warm-up effects; detailed ordering/timestamps remain in `events.jsonl` receipts.

## Verification and cleanup

Five fixture/isolation tests passed. All 24 warm original trials and eight accepted
exploratory original trials passed correctness checks, as did a reopened-cluster
priming run. No original run rejected search/write work. No application suite or
webapp server was needed or started; application code is unchanged.

Cleanup receipt at **07:21:08 UTC** confirms zero issue-owned containers, zero lab
networks, zero database directories and no snapshot repository data. Other agents'
containers/networks were not touched. After archiving receipts, the entire `~/.cache/gw-work/782-lab` scratch tree was also
removed. Evidence and reproduction scripts are retained here; no push or issue comment was made.

Incident wording note: the retained #644 trace records the 03:02 **SQL health query**
returning HTTP 500; its page watcher (including `/mcp`'s expected challenge) had no
unexpected status. The triaged issue's `/mcp` wording is not a separately reproduced
HTTP failure in this lab.
