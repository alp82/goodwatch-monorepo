# October 22 runtime and alert thresholds

Evidence: [measurements and projection inputs](october-22-runtime-and-alerts.json).
All new production probes were read-only: Windmill GETs, TMDB GETs, Mongo reads,
and Crate SELECTs. Mutation guards rejected database writes, including operational
leases. No deployment, schedule change, production repair, or push was performed.

## Runtime

The October 22 child `01a163e9-5b47-5209-9ff4-e0e867c77019` completed its reader
in 22,828.195 seconds. Its parent took 22,830.141 seconds. It attempted 3,660 lists,
completed 3,659, and made 234,912 requests. The 630 new baseline lists checked
540,168 memberships; the 3,029 successful rereads checked only 16,732 changes or
retries. Scaling the entire run by list count would treat every subsequent read
as another baseline.

Read-only checkpoint timestamps put the first new baseline at **16:28:40 UTC**:

| Phase | Wall time | Requests | Time at 15 requests/s | Remaining wall time |
| --- | ---: | ---: | ---: | ---: |
| Existing checkpoint rereads | 2h 28m 40s | 120,451 | 2h 13m 50s | 14m 50s |
| New baselines, including deferred-country discovery | 3h 51m 48s | 114,460 | 2h 07m 11s | 1h 44m 37s |

The catalog GET is outside the phase request counters. The last column is a
residual, **not an isolated database-write benchmark**: it includes title leases,
Crate refresh/read/write work, Mongo metadata and checkpoints, cache/JSON/SQLite
work, HTTP connection startup, and latency beyond pacing. Production logs did not
record those separately, and no production writes were performed to benchmark
them. In the baseline, the existing publisher serially acquires a title lease
for every candidate and plans history in batches of 200; the 540k memberships
cause thousands of batches. Those costs recur for changes/retries after admission,
not for every unchanged list member. There is only one checkpoint transaction
per successful baseline list, not per title.

**Discover paging dominates steady state.** The existing-country census predicts
104,499 primary pages versus 120,451 measured requests, and roughly 90% of reread
wall time is already required by pacing those requests. Per-title confirmation
and history/publication overhead make the baseline much heavier.

A separate read-only XK baseline probe completed **30/30 lists, no failures**, in
**92.805 seconds / 1,173 requests** (83 discover, 1,090 title, zero retries/429s).
Timed components: discover 7.887s, title checks/cache 75.599s, history read/planning
2.427s, metadata 2.454s, open-history reads 1.173s. This isolates read-side work;
it does not measure live title lease acquisition, Crate writes, or transactions.

## Projection at the current settings

A fresh census of the remaining 17 countries made **512 GETs in 35.363 seconds**:
510 lists, 321,162 catalog memberships, 16,468 primary discover requests. A
SELECT found 371,437 eligible open-history memberships there. Scaling the measured
baseline union/catalog ratio predicts approximately **375,357 candidates**, within
the 570k admission budget. The exact union is established by the job's preflight;
these aggregate counts alone cannot prove all 17 will fit.

The model scales measured rereads by census page work (128,014 pages tomorrow;
144,399 globally). It scales baseline HTTP by new-country page work, and the
baseline residual by candidate memberships. This includes measured publication
cost instead of applying HTTP throughput alone.

| Run | Expected requests | Expected runtime | Planning allowance | Eight-hour headroom |
| --- | ---: | ---: | ---: | ---: |
| October 23, including remaining baselines | 227,715 | 5.73h | 7.51h | 0.49h at allowance |
| All 139 countries, daily rereads only | 166,443 | 3.42h | 3.89h / 191,409 requests | 4.11h at allowance |

Tomorrow's expected phases are 147,556 requests / 3.04h rereading and 80,159
requests / 2.70h baselining. Its planning allowance uses 15% extra reread requests,
**all 120k new-baseline requests**, and **all 570k candidate memberships** at the
measured residual cost. The steady-state allowance adds 15% requests. These are
capacity estimates for similar catalog churn and backend latency, not guarantees
against outages or widespread origin-cache failures. Membership preflight may
leave countries for another day; hard-cap exhaustion remains a systemic failure.

**Keep six HTTP workers, 15 requests/s, the 350k hard stop, existing ramp budgets,
and the eight-hour timeout.** The steady state is well below 6.5 hours; increasing
concurrency or the timeout is not warranted by these measurements. Tomorrow has
less headroom while it still pays baseline publication costs.

## Why PY did not qualify for count agreement

The saved October 22 failure says only `Expected 2205 distinct titles, read 2203`.
That gap is **2 / 2205 = 0.0907%**, within both existing bounds (five titles and
0.1%). A regression confirms that two internally consistent sorts returning the
same 2,203 IDs with total 2,205 already succeed. The numeric tolerance was not the
reason this list failed. At least one other acceptance condition failed: page
metadata consistency, duplicate-free paging, or set/total agreement across sorts.
The old failure did not retain enough detail to identify which one historically.

Three fresh unbounded traversals with each sort reproduce **mixed origin page
snapshots**, despite unique `cb` values. Title sort reports 2,202 but returns
1,998 distinct IDs / 2,220 rows, with **222 duplicated IDs** and page totals
2,202, 2,203, 2,204, and 2,221. Release-date sort reports 2,221 but returns
1,907 distinct / 2,206 rows, with **299 duplicated IDs** and multiple totals.
The sorts differ by 280 title-only and 189 release-date-only IDs. Repeating each
sort reproduces its set, so small day-to-day churn alone does not explain it.

The integer query `vote_count.gte=0` returns **2,221/2,221**, no duplicates,
identical sets and metadata in both sorts. The `0.0` query still mixes snapshots.
These probes cost 1,117 GETs / 77.091 seconds, with no HTTP retries or 429s.
A subsequent public-coordinator preview reproduced rejection in 447 GETs /
32.094 seconds: all four traversals failed paging metadata consistency, and also
contained duplicates. Crucially, the old coordinator sent **`0.0` at the root**,
not the working integer `0`; the blanket float conversion intended to refresh
bounded leaves also changed the root query. This is a concrete current cause,
although October 22's saved counts alone cannot establish its historical details.

The fix uses **integer zero for the root retry**, while preserving **`50.0` and
the identical upper bound for a bounded 50–99 retry**. This changes the origin
query key without adding traversals or widening the result set. A simulated
public-job test first failed with the same 2,205/2,203 message and now reads the
complete 2,221-ID integer-zero snapshot. The agreement bounds are unchanged.
The fixed read-only public-coordinator preview completed **1/1 list, zero failures**,
returning all **2,221 IDs**, with one query retry and no shortfall. It made
**396 GETs (335 discover, 61 title) in 29.117 seconds**, with no HTTP retries,
429s, or production writes.
Future failures now include
`read_attempts`: sort/range, reported/returned counts, duplicate count, page
metadata values, and the rejection reason for each traversal.

## Alerting changes

The report succeeds with isolated failures and returns them in `failed_lists`.
It fails for access errors, exhausted hard request budgets, **more than 1%** of attempted
lists failing, or any list failing on **three consecutive UTC calendar days**.
Exactly 1% succeeds unless another gate applies. The denominator is completed plus
failed lists; skipped lists cannot dilute it. Existing fatal access/lease stops,
the skipped-run guard, the 20-consecutive-TMDB-error stop, and a country too large
to ever fit its nonzero membership admission budget remain failures.

Streaks use `failure_day`, `consecutive_failure_days`, and `last_failure` fields on
the existing `tmdb_daily_provider_list_pending` document. Repeated attempts on one
day count once; a missed day restarts at one; successful checkpoint publication
clears the document and its streak. Missing-baseline lists get streaks too.
Dry runs read/predict the streak and never update it. Collection of streaks starts
with deployment; old failures are not inferred from missing checkpoints.

A pending document may now contain only failure metadata, with no `ids` to repair.
Inspect `ids` separately from failure trackers when checking pending history work.
No new table, collection, index, or schedule is needed. Existing retired-list
cleanup still archives both checkpoint and pending document. Planned membership
deferral warns; an explicit zero budget still pauses expansion without failing
rereads. Exhausting the daily new-baseline request budget is normal ramp deferral,
even when no country has completed yet. Only the shared hard-cap stop
(`hard_budget_exceeded` / `RequestBudgetExceeded`) or `rereads_budget_exceeded`
is fatal for request budgeting. Discovery, confirmation, and publication preserve
the hard-cap flag alongside partial progress; catching a hard-cap exception cannot
turn it into a successful deferral. `BaselineBudgetExceeded` remains nonfatal.

Verification covers the public daily coordinator/entrypoint and real storage with
simulated TMDB, plus disposable localhost Crate and a Mongo replica set. Tests
first reproduced isolated-failure alerting, absent persistent streaks, absent
traversal rejection evidence, explicit-pause misclassification, and the torn
decimal-root retry before each correction. The completeness bounds and shared history writer are unchanged.

Initial verification: **148 tests, 141 passed, seven opt-in Windmill previews skipped**,
including disposable localhost Crate 5.10.16 and Mongo 8.0 replica-set tests.
The unchanged bounded retry regression still asserts the float `50.0` floor,
upper bound `99`, and equal integer/float result sets. `git diff --check` passed.
No full monorepo test run or remote Windmill preview was performed.

The budget correction for the October 23 run first reproduced normal new-baseline request
stops failing the report and hard-cap stops losing their identity in all three
baseline steps. The corrected public-entrypoint/report tests include deferral
before any completed country, retained completed lists, and the real TMDB
client's 350k guard with a simulated prior request count. Final focused checks:
**152 tests, 145 passed, seven opt-in Windmill previews skipped**, with disposable
localhost Crate 5.10.16 and Mongo 8.0 replica set. No production operations were
performed for this correction.
