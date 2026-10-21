# October 21: daily list completeness failures

Production investigation used Windmill GETs, Mongo reads, Crate SELECTs, and
cache-bypassed TMDB GETs only. No production publication, leases, deployments,
schedules, or tables were changed. Machine-readable results are in
[october-21-evidence.json](october-21-evidence.json).

## Actual execution dates and ownership

Windmill creates a future scheduled job ahead of its execution. `created_at`
is not its run date. The three supplied job IDs actually started one day later:

| Job prefix | Created UTC | Started UTC | Completed / failed lists | Underlying failures |
| --- | --- | --- | --- | --- |
| 01a14af9 | October 17 17:47:36 | October 18 14:00:00 | 1,410 / 60 | US movie 8: retry 4,750 vs original 4,751; GB movie 9: reported 1,718, returned 1,717 |
| 01a14f4f | October 18 14:00:00 | October 19 14:00:00 | 1,680 / 30 | GB movie 9: reported 1,723, returned 1,722 |
| 01a15476 | October 19 14:00:00 | October 20 14:00:00 | 2,339 / 31 | LC movie 8: retry 4,829 vs original 4,832; GB movie 9: reported 1,721, returned 1,720 |

The first job's creator is
`schedule-f-tmdb_api-read_daily_provider_lists`. The schedule was edited under
**Alp** at October 17 17:47:36, during the authorized rollout; enabling it created
the October 18 job. There was no off-hour execution at 17:47. The successful
October 17 baseline was the separate job
`01a148ff-c3f3-225f-7687-9af7c75273bf`, started at 14:00.

A new country's checkpoints must commit together, so one genuinely incomplete
list still withholds all 30 baseline checkpoints. The 60/30 failures above mean
two/one country baselines were withheld, rather than 60/30 independent TMDB
errors. Existing lists progress individually: October 20 withheld GB's 30 new
lists and failed just LC's affected reread. Other countries continued. US did
successfully baseline on October 19; GB remained unstarted through October 20.
The flow's final report failed after preserving the other successful lists.

## October 20 and today's queue

There was no missing execution, backlog, or outage for these two scheduled jobs
on October 20. Both began within 22 milliseconds of their cron time:

- Daily lists: `01a15476-475e-24d5-f32b-729c4587e03a`, started October 20
  14:00:00.013 UTC, finished after 5 h 17 m 13.750 s. Its report failed for the
  31 lists above; 2,339 lists completed.
- Recent releases: `01a1543f-5944-9be8-b078-195e3cc777ff`, started October 20
  13:00:00.013 UTC, succeeded after 23 m 27.510 s.

Filtering on job creation day explains their apparent absence on October 20:
both completed jobs were created on October 19. At **October 21 11:36 UTC**,
both schedules were enabled, without schedule errors, and today's jobs were
queued for their proper times:

- Recent releases: `01a15965-b49c-9783-575d-9cb3ef62aef6`, October 21 13:00 UTC.
- Daily lists: `01a1599c-a321-c141-c9a9-2162961c7bea`, October 21 14:00 UTC.

These are future queued executions, not a claim that either has already run.
No schedule changes were made. The current production reader remains unchanged
until this fix is reviewed and deployed.

## Root causes and new completeness rule

The US and LC errors came from comparing the retry's total with the first,
already rejected traversal's total. An independently complete newer snapshot
was rejected for catalog changes of just one or three titles. It now stands on
its own: a complete traversal with consistent metadata and no duplicate IDs is
accepted against its **own** total, regardless of the failed traversal's total.
Historical logs retain counts, not page bodies; the regression responses
reconstruct the reported count pairs rather than claiming to replay saved pages.

GB exposes a different failure. A fresh production probe isolated vote counts
**50–99** in `GB:movie:9`. Four traversals (title/date sorts, then both repeated)
all reported **1,721** titles but returned the **same 1,720 IDs**, with **zero
duplicates** and unchanged metadata on every page. Title-sort page 13 and
date-sort page 59 each contained 19 rows; the other interior pages contained 20.
This is a reproducible counted-but-unreturned title, not observed page drift.
The missing ID is not available from discover, so its underlying filtering or
indexing cause cannot be established from these responses. The probe used
**361 GETs in 25.943 seconds**, with zero retries or rate-limit refusals.

The bounded exception requires all of the following, per vote-count leaf:

1. Every requested page returns its own page number and the same total/page count
   as that traversal's first page.
2. No ID repeats anywhere in either traversal, including within a page.
3. Two independent sorts return exactly the same ID set **and the same total**.
4. The total overstates that set by at most **five titles AND 0.1%**. A one-title
   deficit in 1,723 passes; one in 999, or six in 10,000, fails.

Partial sorts are never unioned. This also fixes a previous unsafe path where
incomplete, disagreeing sets could be combined to reach the advertised total.
After two rejected sorts, the equivalent-query retry discards them entirely and
uses the same rules. Neither a changed page snapshot nor duplicate drift can
qualify for the bounded exception. A clean independent fallback can recover a
rejected traversal. For partitioned lists, an uncapped parent must match the
union plus only the explicitly agreed child deficits; an unexplained parent
mismatch still fails. The report includes `count_shortfall` and each accepted
range's totals in `count_agreements`.

TMDB offers no atomic snapshot. No finite discover-only check can prove that
two sorts never share a hidden omission. The exception deliberately admits only
a very small stable discrepancy, while rejecting observable torn reads. It does
not prove real-world service membership. Every detected change still receives
the existing per-title check; a conflict remains a retry, and a removal cannot
close a stay without confirmation. The history writer alone decides precision.
The first read stays unknown/backfill; missing consecutive days stay unknown.
No `streaming_availability` writes or writer precision changes were introduced.

## Day-1 country rereads and exact days

The day-1 countries were AR, BS, CD, CO, CV, GH, ID, IQ, LC, MA, MC, MK, MZ,
NG, PY, RU, SA, SC, SK, SN, SV, and TC.

| Actual UTC run day | Successful rereads in those countries | Failed rereads | Exact arrivals | Exact drops |
| --- | --- | --- | --- | --- |
| October 18 | 660: all 30 lists in all 22 countries | 0 | 176 | 40 |
| October 19 | 660: all 30 lists in all 22 countries | 0 | 167 | 60 |
| October 20 | 659: LC had 29, the other 21 countries had 30 | 1: LC movie 8 | 154 | 245 |

The counts are existing history stay rows for those 22 countries, the configured
15 service IDs, and eligible types `flatrate`, `free`, and `ads`, grouped by exact
`appeared_on`/`dropped_on` UTC day. The writer is shared with ordinary publication;
these counts cannot exclusively attribute each row to the list job. Reread
success itself is verified from the corresponding daily child-job reports.

Reproduce the count for each direction by selecting `COUNT(*)`, grouped by
`appeared_on` or `dropped_on`, with the corresponding precision equal to `exact`,
country/service/type restricted as above, and day bounds October 18 inclusive to
October 21 exclusive. No history repair or precision backfill was attempted.

## Verification

Tests use the previously agreed public job entrypoint with simulated TMDB and
storage, and the existing history writer. The US retry-total and GB shortfall
cases failed before their fixes. The disagreeing-sort regression also failed
before removing the unsafe union path.

Coverage includes all five recorded count pairs across the three jobs, duplicate
drift despite a matching distinct count, differing short sets, both shortfall
bounds, unexplained partition changes, metadata drift, complete fallback reads,
and a 30-list GB baseline that now commits all checkpoints. A consecutive-day
shortfall test verifies confirmed exact arrivals and departures through the
existing writer; first-country stays remain unknown/backfill.

The focused reader/ramp/history suite ran **126 tests: 119 passed, seven opt-in
Windmill previews skipped**, with disposable local Crate and Mongo replica-set
integration tests enabled. `git diff --check` passed. Dependency locks and pinned
versions are unchanged; only the local Windmill script source hash was refreshed.
Remote preview jobs and the full monorepo suite were not run for this fix.

A guarded read-only production check of the fixed code then completed:

- Full GB movie 9 discover: **26,956 IDs**, six partitions, one second sort,
  zero query retries. Only the 50–99 vote range used the one-title exception.
  **1,444 discover GETs in 97.942 seconds**.
- LC movie 8 through the daily coordinator: **one completed list, zero failures**,
  4,822 listed IDs and 63 per-title checks. **305 GETs in 22.511 seconds**.
  It planned four unknown arrivals and 16 unknown drops, with zero exact plans:
  its last checkpoint was October 19, so the failed October 20 read left a gap.
  Forty-one title/list conflicts remained retries, as required by existing rules.
- Total: **1,749 GETs in 121.312 seconds**, zero HTTP retries/refusals, and
  **zero production writes**. GB validation covered discover completeness,
  not its expensive full first-country history baseline. The baseline path was
  verified with simulated adapters in the public-entrypoint test above.

The global 350,000-request ceiling, 120,000-request new-baseline budget, ramp
country ordering, whole-country checkpoint transaction, and eight-hour Windmill
timeout are unchanged. No production apply, deployment, push, or repair occurred.
