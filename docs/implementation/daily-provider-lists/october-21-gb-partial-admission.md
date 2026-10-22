# GB cache investigation and independent list baselines

Follow-up to the [October 21 completeness diagnosis](october-21-completeness.md)
and [#682](https://github.com/alp82/goodwatch-monorepo/issues/682). The owner
replaced the original requirement to start a whole country atomically: completed
lists should retain their checkpoints when another list fails. This supersedes
the earlier country admission policy, while retaining the history writer's
per-list baseline and precision rules.

## Repeated read-only captures

After the scheduled October 21 run ended, GB:movie:9's affected `vote_count`
50–99 leaf was read three times with each sort. Every GET used a unique `cb`;
the single measurement process used the normal 15 requests/second limiter.
The [sanitized captures](october-21-gb-reads.json) contain every distinct ID,
per-page metadata, duplicate IDs, and differences between reads. No production
state changed.

| Query lower bound | Sort | Repetitions | Page-one total | Distinct IDs | Rows | Duplicate IDs | Page totals |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `50` | `title.asc` | 3 | 1,725 | 1,717 | 1,724 | 7 | 1,721 and 1,725 |
| `50` | `primary_release_date.desc` | 3 | 1,725 | 1,711 | 1,720 | 9 | 1,721 and 1,725 |
| `50.0` | `title.asc` | 2 | 1,725 | 1,724 | 1,724 | 0 | 1,725 only |
| `50.0` | `primary_release_date.desc` | 2 | 1,725 | 1,724 | 1,724 | 0 | 1,725 only |

Original queries took **522 GETs / 36.044 seconds**. All repeated reads of the
same sort had identical sets and metadata. The two sorts disagreed on 22 IDs:

- Only title sort: `14541, 22858, 34084, 37196, 44585, 53369, 53370, 53375,
  76815, 78352, 88431, 123107, 229839, 806731`.
- Only date sort: `18558, 21463, 31634, 407335, 438731, 786345, 835017, 1393382`.

This is a persistent torn traversal: mixed metadata, duplicates, and sort-specific
omissions. The observations support mixed cached page snapshots at TMDB's origin,
even with CDN bypass. They do not support accepting the 17-title production gap
as harmless overcount, nor explain it as ongoing changes between repetitions.
TMDB's internal cache implementation is an inference, not something exposed by
its API.

The earlier equivalent-query retry added `vote_count.gte=0` at the root. A bounded
leaf still used `50`, so that retry repeated the same problematic leaf query.
The fix spells every existing retry lower bound as an exactly equal float:
`50` becomes `50.0`. TMDB documents these filters as
[float parameters](https://developer.themoviedb.org/reference/discover-movie).
This preserves the numeric predicate and changes the request spelling.

Those four fresh queries took **348 GETs / 24.067 seconds**. All returned the same
1,724 IDs with uniform metadata and no duplicates. The remaining one-title count
overstatement is stable, but these responses do not identify its cause.
The fresh set contains all
1,717 original title-sort IDs plus `18558, 21463, 31634, 407335, 438731, 786345,
835017`. Compared with original date sort, it adds the 14 title-only IDs above
and omits `1393382`. One response's payload reports vote_count 100 for ID
1215020; the same ID also appears in the original query. Payload and search-index
vote values need not change together; no additional client-side vote filter is
introduced.

A diagnostic fractional bound `49.5` was rejected: it included titles with 49
votes, changing the set. It took 360 GETs / 24.820 seconds. The implementation
uses only numerically equal integer/float spellings.

## Completeness and publication rules

No completeness tolerance is widened. A single traversal must still have uniform
totals and page metadata, no duplicate IDs, and exactly its own reported count.
The existing alternative accepts only the same set and total from both independent
clean sorts, with at most five missing IDs **and** at most 0.1% missing. The clean
1,725/1,724 agreement meets this existing rule; the original torn reads do not.
Failed traversals are discarded, never unioned. Parent partition union checks
remain unchanged. A new cache variant can still fail these checks and remains a
failed list in that case.

Baseline discovery failures and title-check failures are now reported per list.
Successful sibling lists keep their checkpoints and pending cleanup in separate
Mongo transactions. `countries_partial` maps each partially started country to
its missing list keys. Those lists receive a first read again tomorrow; completed
siblings receive daily rereads first. Countries can appear in both the started
and remaining reports until all configured lists have checkpoints.

Every source response for one list is validated before any of its history writes.
This also applies to daily rereads: a failure after the first 200 title checks
cannot leave earlier batches of exact closures behind. Failed source validation
keeps that list's history and checkpoint unchanged. The eventual first successful
read remains unknown/backfill, while sibling lists can earn exact days on their
own consecutive reads. The existing shared writer makes all precision decisions.

The 350k hard request stop, 120k new-baseline request budget, 570k membership
budget, authentication stop, 20-consecutive-failure stop, and eight-hour timeout
remain. Country discovery still preflights the membership budget; a country whose
successfully discovered missing lists do not fit is deferred. Request exhaustion
retains earlier lists with fully completed source checks and defers the rest.

Crate history and Mongo checkpoints still have no distributed transaction.
An infrastructure error during history/checkpoint publication can leave partial
valid-source writes, recovered through durable pending IDs. This existing recovery
contract is distinct from a failed discovery or title check, which publishes
nothing. No second precision rule, offer-table writes, or production repair was
introduced.

## Verification

Regression tests were observed failing before the corresponding fixes, through
the public job entrypoint with simulated TMDB/storage and through the existing
history writer. They cover torn-leaf cache retries, 29 successful GB siblings,
late title-check failure, next-day per-list precision, independent Mongo checkpoint
transactions, partial request-budget completion, lease renewal during long rereads, and the
20-failure stop. Cross-day title-check errors retain their title ID and endpoint.

The focused reader, ramp, storage, writer, and integration suite ran **135 tests**:
**128 passed, 7 opt-in Windmill previews skipped**. Disposable local Crate and a
Mongo replica set were enabled. Production Windmill previews were not submitted.
The full monorepo suite was not run.

The GB-only production measurement uses the public ramp coordinator with guarded
SELECT-only Crate and read-only Mongo adapters. An explicit measurement country
filter now restricts checkpoint inventory as well, avoiding an unintended global
reread. Live job inventory retains its existing dropped-country behavior.

### GB-only production preview

Command (run with the checkout's locked Python dependencies):

```bash
python goodwatch-flows/tools/measure_daily_provider_lists.py \
  --ramp --countries GB --output /tmp/gw682-oct21/gb-partial-baseline-preview.json
```

The [complete sanitized report](october-21-gb-preview.json) records **30 completed,
zero failed, zero skipped lists**, all first reads. The preview ran October 21,
19:49:57–21:08:21 UTC, after the scheduled job had finished. It took
**4,704.344 seconds (1h 18m 24s)** and made **60,687 GETs**:

- Discover: **6,738**.
- Per-title checks: **53,949**, including eight handled deleted-title responses.
- HTTP retries and rate-limit responses: **zero**.
- Existing checkpoint rereads and region-catalog GETs: **zero**; scope was GB only.

The 102,992 title/list candidate memberships share the per-title response cache.
Per-title checks account for 88.9% of GETs. History planning then uses SELECT-only
database reads. The plan contains 1,911 unknown arrivals and 11,635 unknown drops,
**zero exact arrivals or drops**, and **zero production writes**. These are plans,
not applied rows. GB would obtain all 30 checkpoints; production checkpoints and
the global countries-remaining count were unchanged.

GB:movie:9 returned **26,992 titles**, with 30,300 candidate memberships, one
equivalent-query retry, and a clean two-sort agreement in the 50–99 leaf:
**1,725 reported / 1,724 returned**. GB:movie:2100 also used the existing agreement
rule: **1,722 / 1,721** in the same vote range. GB:movie:9's 391 title/list
disagreements remain retry IDs under the existing writer contract; they are not
HTTP failures and do not establish unsupported exact days.

The measurement began after the cache, independent-admission, and source-validation
fixes. While it ran, final regression hardening added reread lease renewal,
preserved cross-midnight error context, and removed duplicate accounting at the
20-failure stop. Those branches are absent from this same-day, failure-free GB
first-read measurement; the final 135-test suite covers them. No production
Windmill job, deployment, schedule change, table, lease, or index was created.
