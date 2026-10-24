# Recent-release recheck: first-week review

**Recommendation: keep the 13:00 UTC recheck as it is.** Daily provider lists
overlap with some of its arrival evidence but do not replace its current-offer
refresh. This review made no production data, code, or schedule changes and no
TMDB requests. Measurements were read on October 24, approximately 17:24–17:31 UTC.

[Machine-readable evidence](recent-release-recheck-week-one-2026-10-24.json)
contains job IDs, counters, source hashes, attribution methods, and recreation
examples. The raw job/read results and analysis scripts are locally retained in
`/tmp/gw679-week/`; raw job logs are not committed because request-error logs can
contain credentials. The first-week checklist is in
[recent-release-rechecks.md](../recent-release-rechecks.md#deploy-after-review).

## Daily runs and new US offers

All seven scheduled runs started at 13:00 UTC and succeeded. Requests below are
reconstructed from the actual leaf batches, cross-checked against every logged
`next entry is:` line. There were no batch retries, failed titles, or exhausted
iterations. TMDB's confirmed missing/deleted responses are shown separately.

The attribution matches each history row's title identity and `observed_at` to
that title's successful recheck batch interval. It is strong timestamp evidence,
not an explicit stored producer ID or a counterfactual estimate of arrivals that
would never have been found otherwise. It counts `flatrate`, `free`, and `ads`,
with movie/show IDs distinct. Returns can count as new offers; these are not all
first-ever arrivals.

| UTC day | US titles with recheck-matched new history stays | Of those, retained current US rows created that day: titles | All US titles with retained new `created_at` | Duration | Requests | Failures | TMDB deleted |
|---|---:|---:|---:|---|---:|---:|---:|
| Oct 17 | 193 | 193 | 678 | 24m 10s | 6,134 | 0 | 70 |
| Oct 18 | 16 | 15 | 552 | 23m 16s | 5,903 | 0 | 3 |
| Oct 19 | 4 | 4 | 535 | 23m 40s | 5,858 | 0 | 5 |
| Oct 20 | 4 | 4 | 590 | 23m 28s | 5,906 | 0 | 5 |
| Oct 21 | 7 | 7 | 579 | 24m 03s | 6,024 | 0 | 2 |
| Oct 22 | 12 | 12 | 671 | 24m 47s | 6,140 | 0 | 3 |
| Oct 23 | 17 | 17 | 681 | 24m 25s | 6,212 | 0 | 6 |

Total: **42,177 requests**, 2h 47m 49s execution, 94 confirmed deleted-title
responses, zero operational failures. The first day is catch-up. The following
six days matched **60 US title-days with new stays**, averaging 10 per day. Their global
recheck-matched title counts were 52, 34, 29, 42, 67, and 126 respectively.

The approximately 80-US-titles/day baseline is for the whole offer writer, not
this recheck alone. The retained whole-pipeline counts above average 601.3/day
after catch-up. They include ordinary refreshes, targeted publication, returns,
and backlog; attributing that entire increase to #679 would be incorrect.
Today's current table also omits any new rows deleted again before this review.
On October 18, one of the 16 history-attributed titles no longer has a matching
current offer created that day; the history and current-row counts therefore
deliberately differ.

## Flapping: what can be established retrospectively

An exact count of every physical DELETE followed by INSERT during the week, and
an exact subset **caused by the recheck**, cannot be reconstructed. There are no
per-publication offer snapshots in the reviewed artifacts, no mutation journal
on current offers, and no producing-job ID on history. Mongo keeps bounded
provider evidence rather than all seven daily snapshots. History covers only
subscription/free/ads, not rent/buy.

Three distinct measurements must not be conflated:

- **798 history keys** have a closed stay with a drop day in October 17–23 and a
  later observed stay before October 24; 47 are US keys. Four returns match
  recheck batch times (three US). Daily lists can close/reopen history without
  deleting/recreating a current offer, so 798 is not physical offer flapping.
- **44 surviving current offer keys** demonstrably have a later incarnation
  created during the week, compared with a prior physical-offer witness in
  `availability_history_before_682`; four are US keys. The original backfill
  copied actual offer `created_at` into history `observed_at`. We require the new
  offer's creation to be later than both the old observation and its backfill
  timestamp. The normal upsert never advances `created_at`.
- **41 of those 44** also have a history drop day within October 17–23. The other
  three have a recorded drop day of October 16. These are lower bounds on
  recreations, not complete deletion-event counts: later-deleted rows and keys
  first inserted after the baseline are absent from this comparison.

**Recheck subset:** one of the 41 physical recreation witnesses has a return
timestamp matching a recheck batch. The removal's causal source is not retained.
Thus the defensible report is **one recheck-associated reinstatement; causal
recheck-induced flapping count unknown**, not zero and not all four
history-only returns.

Three examples follow. Drop days are recorded observations with **unknown**
precision, not proven upstream removal dates or exact SQL DELETE timestamps.

| Title and full offer identity | Earlier current `created_at` | Recorded drop day | New current `created_at` (UTC) | Recheck association |
|---|---|---|---|---|
| Balli on the Menu / Bali på menuen — `show:336074`, DK, Allente `1961`, flatrate | Oct 14, 18:12:27.727 | Oct 17 | Oct 22, 18:15:47.816 | Return observed Oct 22 at 13:22:36.303, inside its recheck batch; removal cause unproven |
| Most Shocking — `show:12877`, US, Philo `2383`, flatrate | Jun 30, 2025, 02:29:15.984 | Oct 20 | Oct 23, 00:09:53.213 | Return observed Oct 22 at 22:16:29.801, outside the recheck |
| I Married Who? — `movie:139251`, US, Xumo Play `1963`, ads | Sep 26, 22:35:49.708 | Oct 20 | Oct 23, 05:03:59.810 | Return observed Oct 23 at 05:01:50.085, outside the recheck |

## Exact arrivals and daily-list overlap

Filter: `appeared_source = 'title' AND appeared_precision = 'exact'`, grouped by
UTC `appeared_on`. An arrival row is one country/service/offer-type stay. Distinct
titles deduplicate across all countries and services. Both the recheck and daily
lists can produce `appeared_source='title'`; awaited-title checks can too.
The source label alone cannot distinguish them. Later list evidence can also
refine an existing same-day unknown stay to exact.

| UTC appearance day | Exact title-source arrival rows, worldwide | Distinct titles, worldwide | Exact US rows / titles | Rows with recheck-matched observation times |
|---|---:|---:|---:|---:|
| Oct 18 | 826 | 177 | 49 / 25 | 522 |
| Oct 19 | 654 | 167 | 25 / 14 | 264 |
| Oct 20 | 666 | 151 | 28 / 18 | 209 |
| Oct 21 | 1,205 | 360 | 103 / 65 | 212 |
| Oct 22 | 2,954 | 666 | 161 / 107 | 253 |
| Oct 23 | 3,491 | 749 | 135 / 83 | 393 |
| Oct 24, partial before evening publication | 698 | 191 | 21 / 14 | 0 |

The October 23 list run completed **4,170 lists across 139 countries**, zero
failed or skipped lists, in **5h 56m 47s**, using **229,326 requests**. It finished
the country ramp, including 17 new country baselines. October 24's run also
succeeded: 4,170 lists, zero failures/skips, 164,495 requests, 3h 21m 56s.
Initial country baselines cannot themselves prove exact first-day arrivals;
those need a prior day's fresh absence evidence.

**Yes, coverage overlaps:** of the recheck's 393 timestamp-matched exact arrival
rows dated October 23, **99 rows across 28 titles** fall in country/media/service
scopes successfully read by that day's lists. Of these, 87 fall in newly
baselined scopes and 12 in reread scopes. **294 are outside those list scopes**:
290 use providers outside the list job's 15 IDs, and four use Guernsey (`GG`),
which was not in its 139-country run. This measures scope overlap, not duplicate
HTTP requests or duplicate history inserts. Historic per-title list request
identities are not retained in the reports.

## Recommendation and source verification

Keep #679's existing schedule, scope, cache bypass, and shared publication path.
Its ongoing cost is approximately **6,000 requests/day** and 24 minutes, and it
still supplies current offers for recent titles across providers and offer
types. The list job updates **history only**: it does not write
`streaming_availability`, streaming evidence, or Mongo title documents. It covers
15 provider IDs and union-list membership changes, not every service or every
offer-type change. Retiring #679 would remove a current-offer freshness mechanism
without replacing it.

If a future change aims to reduce duplicate reads, it must explicitly share
fresh title responses with the existing publisher, preserve evidence and
`created_at`, and retain coverage beyond those list scopes. This review does
not propose that unmeasured change for deployment. For a future causal flapping
check, retain before/after key snapshots with publication and originating-fetch
IDs; retrospective state cannot replace those missing observations.

The live `daily_provider_lists`, `daily_list_storage`, and `availability_history`
script contents were read and matched `origin/main`; their deployed hashes and
the inspected Git revision are in the evidence JSON. Relevant primary sources:

- `goodwatch-flows/windmill/f/tmdb_api/daily_provider_lists.py`: service scope and
  fresh confirmation requests.
- `goodwatch-flows/windmill/f/tmdb_api/daily_list_storage.py`: history-only list
  publication and checkpoint behavior.
- `goodwatch-flows/windmill/f/sync/availability_history.py`: source timestamps,
  exactness, same-day refinement, and stay transitions.
- `goodwatch-flows/scripts/backfill_availability_history.py`: prior physical
  offer witnesses and original creation timestamps.
- `docs/implementation/daily-provider-lists/README.md`: pre-rollout history
  backup and separation from current-offer publication.

Validation cross-checks passed: all seven runs' selected counts equal both leaf
input counts and logged fetch counts; saved plus deleted equals selected; raw
exact-arrival rows agree with the independent SQL daily/country aggregates;
current US rows agree with the independent daily counts; recreation and return
counts are deduplicated on all five offer-key fields. All database queries were
SELECT/find only. One broad historical SELECT join was stopped and replaced by
bounded extracts with in-memory joins; its cancellation is recorded separately
from the seven production runs' zero failures.
