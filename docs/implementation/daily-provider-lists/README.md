# Daily service lists (#682)

Implements [#682](https://github.com/alp82/goodwatch-monorepo/issues/682), including
the [absent-country departure](https://github.com/alp82/goodwatch-monorepo/issues/682#issuecomment-6226608969).
Research: `docs/research/offer-arrival-everywhere.md` and
`docs/research/availability-history.md` on `origin/research/offer-arrival-everywhere`.
The existing [history contract](../availability-history/README.md) remains authoritative.

## Scope and entrypoints

`f/tmdb_api/read_daily_provider_lists` calls `f/tmdb_api/daily_provider_lists` and
fails its report step if any list failed or the whole run was skipped for a held lease. Both default to `dry_run: true`; only
an explicit Boolean `false` enables publication. A null flow argument cannot enable data publication.
Windmill CE v1.803 ignores `concurrent_limit`; the main entrypoint instead takes
one Mongo run lease before any TMDB request. It renews every minute with a
15-minute expiry and checks ownership before batches and publication. Overlapping
runs return `run_skipped: true` without TMDB requests; the report step fails
so a missed scheduled read cannot appear successful. The declared Windmill
concurrency limit also works on editions that support it.

A **live dry run takes this operational run lease and ensures its TTL index**.
It performs no history, offer, checkpoint, pending-marker, or title writes.
Use the measurement tool below for strictly read-only production checks; it
runs the public coordinator with read-only storage, bypasses live main, and
refuses Mongo mutations and non-SELECT Crate statements. Run only one such
measurement at a time and avoid overlapping the scheduled job.

Per-list leases serialize apply callers; a held list is skipped rather than
failed. History publication uses the streaming publisher's existing title leases.

The research's 15 service identities are explicit, rather than fuzzy name matches:

| Brand/tier | TMDB IDs |
| --- | --- |
| Netflix, including Standard with Ads | 8, 1796 |
| Amazon Prime Video, including its regional identity and ads tier | 9, 119, 2100 |
| Disney Plus | 337 |
| HBO Max | 1899 |
| Apple TV | 350 |
| Hulu | 15 |
| Peacock Premium and Premium Plus | 386, 387 |
| Paramount Plus and Premium | 531, 2303 |
| Crunchyroll | 283 |
| MUBI | 11 |

Movies and shows are separate lists. Every country returned by TMDB's provider
regions endpoint is included, plus countries with existing checkpoints or pending
publication intents. Service catalogs do not decide whether an existing list is
still read. Empty lists are read and baselined too. Explicit `countries` and
`service_ids` inputs allow staged rollout and later expansion.

## How list reads feed stays

For a list, a checkpoint holds its UTC read time, sorted discover IDs, verified
eligible offer types for members, and IDs where discover and the title check
disagreed. It also records version 1, completeness, and cache-bypass provenance.
Only a successful complete read advances it. An already completed UTC day's
list is skipped on rerun. Gaps are retained: they cannot establish exact days.

The first read verifies listed titles and opens missing stays with unknown
precision, without substituting a premiere. It also selects eligible open history
stays for that country/service and verifies those missing from the list. A fresh
per-title absence closes a stuck stay with **unknown** precision; a positive
check keeps it open and queues another check. Failed checks leave the checkpoint
unchanged. No first-read transition is exact. An empty first read establishes an
absence baseline for later arrivals.

After the baseline, the job compares today's discover IDs with the last complete
checkpoint. It also includes unresolved disagreements and interrupted publications.
Every changed title is checked with a fresh `/movie/{id}/watch/providers` or
`/tv/{id}/watch/providers` GET. The response must have the requested title ID and
a structurally valid service payload. Only `flatrate`, `free`, and `ads` offers
of the requested service in the requested country count; rent/buy and another
service's offer never do.

The job supplies `HistoryTitle` and a scoped `ListRead` to the existing history
writer. The writer, including its `Observation`, UTC-day comparison, collision
handling, original-premiere mapping, and `Stay` planner, remains the only place
that chooses precision and days. The job never supplies an `exact` flag.

- An arrival needs today's fresh positive title check and yesterday's complete,
  uncached list evidence of absence. A gap leaves it unknown.
- A drop needs today's fresh title check to omit the eligible offer and
  yesterday's list to establish presence. A title still offered is retained,
  with a retry on the next read even if discover continues to omit it.
- An absent country in that validated title response can establish absence
  **only for the country/service list being reconciled**. Ordinary title
  publication still treats an absent country as unknown. Thus a service losing
  its only offer in a country can now close its stay after daily confirmation.
- Changes inferred by pending repair skip history observations newer than the
  API observation. This filter leaves the live publisher's own additions and
  removals intact, including removals of stays opened from later scrape times.
- A repair-inferred return after any closed stay requires a supporting positive
  API offer or scrape presence on the reconciled offer row: a non-null
  `stream_url`, `price_dollar`, or `quality`, matching `reconcile_availability`.
  Country scrape coverage alone is insufficient. An empty verified scrape plus
  a retained API link cannot reopen unknown baseline/gap drops. An exact drop
  additionally requires a supporting API offer from a strictly later UTC day, as before.
- A confirmed drop followed by a return opens another stay. Timestamp collisions
  and missing observation days retain the writer's unknown-precision fallback.
- A title publisher may open/close an unknown stay earlier today. The same writer
  can refine that same-day transition with the later list evidence without
  inserting another stay or changing its primary key.

Existing Mongo title metadata is read in batches so later arrivals can use the
writer's existing original-premiere rule. Missing metadata falls back to the
ordinary observation rule. Confirmed arrivals retain `appeared_source = 'title'`:
the confirming read uses TMDB's per-title service endpoint. The deployed schema allows that source;
there is no new `list` enum value or schema migration.

A union discover list proves eligible service membership, not an invisible switch
between eligible offer types while the title remains listed. Such switches remain
with ordinary title publication. When a changed title check reveals a type switch
with continued membership, the list evidence does not label the type transition
exact. The job does not heartbeat every open history row; `last_seen_on` keeps the
history writer's transition-evidence meaning.

No path writes `streaming_availability`, streaming evidence, media rows, title
documents, the details queue, or its watermark. Catalog publication continues
through the ordinary publisher.

## Completeness and request controls

All TMDB requests, including retries, receive a unique `cb` query parameter using
main's cache-bypass mechanism. Six HTTP workers share one limiter, defaulting to
15 requests/second, with a hard configurable ceiling of 20. Retries consume the
same budget. A 429 delays all workers and honors `Retry-After` seconds or an HTTP
date; transient network/5xx failures back off, with six attempts total. A 404 or
malformed service response is a failure, never evidence for a drop. Authentication
failures (401/403) stop the run immediately. Twenty consecutive lists failing
with `TMDBReadError` also stop the run. A successful list resets the failure
counter; a non-TMDB list error breaks that sequence. URLs/credentials are not
returned in reports.

The default request budget is 350,000 per run, including retries; exhausting it
fails the run. Completed checkpoints survive for the next attempt. TMDB describes
its upper limit as approximately 40 requests/second, subject to change, rather
than a guaranteed daily allowance. See its [rate-limit documentation](https://developer.themoviedb.org/docs/rate-limiting).
The 15/second default leaves headroom for existing fetchers; unrelated jobs do not
share this in-process limiter.

Each list first uses `title.asc` for movies or `name.asc` for shows. Page numbers,
totals, and page counts must remain consistent. Unique IDs must match
`total_results`. Otherwise it reads the second sort (`primary_release_date.desc`
or `first_air_date.desc`). Stable short reads can union their IDs against the
same total. Changed paging metadata discards that traversal's IDs and tries a
clean second sort; a changed second-sort total also requires an independently
complete second read. A second incomplete traversal is rejected before staging
or history publication. If both sorts are torn, the error reports the last
observed distinct-title count, without treating that read as complete.

Lists beyond TMDB's 500-page limit split into disjoint integer `vote_count`
ranges. This retains undated titles that date splits can exclude. Each leaf gets
the same completeness/fallback checks. The lower range is read first: increasing
vote counts can repeat a title in the upper range, so the ranges are unioned.
Changed uncapped parent cardinality rejects the read. TMDB caps reported
`total_results` at **20,001**, so larger partitioned lists cannot compare their
union with that capped parent total. An indivisible oversized bin fails safely. This
does not turn a changing upstream API into a transactional snapshot; per-title
confirmation remains necessary even after cardinality matches.

One fresh per-title response covers every country/service. A compressed,
temporary SQLite cache shares it within the run, with bounded Python memory and
the original read timestamp. It expires across UTC days and rechecks a conflict
discovered after the cached response. The cache is local to the job and is removed
when it exits.

## Failure recovery and storage

The job uses three new Mongo collections. All have built-in `_id` indexes;
`tmdb_daily_provider_list_leases.expires_at` additionally has a TTL index with
`expireAfterSeconds: 0`, ensured on lease acquisition. Expired leases are reclaimable
immediately through the acquisition predicate, independently of TTL cleanup:

| Collection | Contents |
| --- | --- |
| `tmdb_daily_provider_lists` | Last completed snapshot per `country:media_type:service` |
| `tmdb_daily_provider_list_pending` | Candidate title IDs staged before any history writes |
| `tmdb_daily_provider_list_leases` | Renewable, token-owned 15-minute run and list leases |

History writes are batched in groups of 200 under the existing
`streaming_publication_leases`. The shared writer reads history only for that
country/service in list mode. The normal publisher's title-wide query stays
unchanged. Free titles publish first, then busy titles retry after 5, 10, 20,
and 30 seconds. Only exhausted retries fail that list. Pending IDs preserve the
already published batches for idempotent replay. TMDB failures, incomplete reads,
and history failures leave the checkpoint unchanged.

There is no cross-database transaction. Before publication, durable pending IDs
are staged. After all history writes succeed, the snapshot is saved, then its
pending marker is removed. Retrying after a partial history commit reuses existing
stay keys. Pending IDs are rechecked even when TMDB changed again before retry,
and reconcile all eligible types in that scope; an interrupted arrival cannot
remain open just because the new list again matches the old checkpoint. Recovery
across an unobserved daily gap remains unknown. An acknowledgement failure after
checkpoint commit merely causes redundant checking on a later run.
A pending title publication with an older UTC observation cannot reopen a stay
already closed with a later exact drop; this guard is in the shared writer too.

The local read-only measurement acquires no leases, stages no intents, refreshes no tables, and saves no
checkpoints. It reads Mongo metadata/checkpoints and uses SELECT-only history
queries, then calls the same stay planner in memory. Its adapter refuses write
mode before acquiring a lease. Temporary measurement and inert preview files are
local only. Live Windmill previews take the operational run lease described above.

A per-title `/movie/{id}/watch/providers` or `/tv/{id}/watch/providers` response
with HTTP 404 and TMDB status code 34 uses the fetcher's shared
`is_tmdb_deleted_response` predicate. It sends a title-wide removal intent to the
existing history writer, which reads all that media title's stays and applies its
normal unknown-precision removal rules. This does not change current offers or
Mongo title documents. The deletion check is shared across lists for that run;
if discover still lists the deleted title, its checkpoint retains a retry ID.
Discover 404s and unconfirmed per-title 404s remain list failures. Every list
failure reports its list key, media type, TMDB ID, endpoint, and HTTP status;
non-title requests have a null TMDB ID, and non-HTTP storage errors have a null
endpoint/status. Other lists continue unless the existing systemic stop applies.

## Production measurements

Measured on 2026-10-17 UTC with real TMDB GETs, production Mongo metadata reads,
and SELECT-only production Crate access. [evidence.json](evidence.json) contains
the reports, per-country census totals, source hashes, and extrapolation inputs.

| Read | Result | Requests | Elapsed |
| --- | --- | ---: | ---: |
| Global page-one census, including split-bin metadata | 139 countries; 4,170 lists, 1,661 nonempty; 2,820,026 entries | 4,243 | 426.1 s at a separate 10/s cap |
| BR, DE, NG comparison with the earlier fresh panel | 18 complete lists; 36,876 entries; no differences | 1,854 discover | 147.6 s |
| BR, DE, NG, US comparison with the earlier fresh panel | 36 complete lists; 91,861 entries; 28 changed-title checks; no refused/incomplete lists | 4,621 discover + 28 title = **4,649** | **348.3 s**; repeat 360.2 s |

The US Prime Video movie list has **26,150 titles**. It needed six internal vote
partitions; every leaf completed with the primary sort. No second-sort fallback,
429, or retry occurred in these completed samples. The 28 differences can include
undated titles excluded by the earlier research reader's date partitions; they
are **not** evidence of 28 daily arrivals. The previous snapshot was read at
2026-10-16 22:02:55 UTC, so these comparisons span only roughly three hours across
two UTC dates. They do not measure a full day's churn. The final preview planned
three rows in memory and published zero.

The review-fix rerun of that same four-country panel completed **36 lists**
(84 outside-panel lists skipped by the measurement adapter), checked 28 changed
IDs, and used **4,649 GETs in 328.188 s**: 4,621 discover + 28 per-title requests.
It had **zero failed lists, retries, refusals, or production writes** and planned
three unknown-arrival rows in memory. That run achieved **14.17 requests/s**.
Its requests and rows match the earlier comparison; the panel's absence evidence
remains untrusted. The full result is `review_read_only_comparison` in the evidence.

The later full four-country baseline read used **93,059 GETs in 7,223.599 s**
(10,516 discover and 82,543 per-title), processing 240,832 title/list candidates.
It completed 119 lists and rejected `US:show:9` as torn. Two subsequent repeats
returned identical sets within each sort, but different sets between sorts:
5,459 title-sorted IDs versus 5,423 air-date-sorted IDs. Every page matched one of
two snapshots, of 5,473 and 5,474 titles, differing only by `130842` (The Newsreader).
Mixed snapshots produced 15 and 51 duplicate rows respectively. Requests with
unique `cb` values were CloudFront misses but retained these origin snapshots.
This is not a stable filtered-count shortfall, so a 1% tolerance would be unsafe.

Adding `vote_count.gte=0` returned all 5,474 IDs in both independent sorts, with
stable paging metadata. After both ordinary sorts fail, the reader now discards
them and retries once with this nonnegative vote floor, retaining the same
catalog and all existing count/metadata checks. `query_retries` reports this
fallback. If both retry sorts are also torn, the list still fails; no shortfall is accepted. The
adult-inclusive control returned one additional softcore title, which does not
explain the paging gap.

The first deployed four-country preview on October 17 was canceled after
1,809.590 seconds when two lists reported 404s. A read-only replay completed both
discover lists and identified `/movie/1162367/watch/providers` for
`BR:movie:2100`, and `/tv/287001/watch/providers` for `BR:show:119`. Targeted reads
confirmed HTTP 404 / TMDB status 34 for both. The replay used 6,694 GETs (294
discover, 6,400 title) with zero retries or refusals; neither the original nor
fixed HTTP client retries a 404. The original logs omitted endpoint/title IDs,
so these are reproduced failures rather than a recovered original HTTP trace.

The 328-second panel comparison is not the first-read workload. Production had
no checkpoints, so the deployed run had to baseline every list and check all
listed titles plus eligible open history. Those two Brazilian lists alone had
5,399 and 1,496 candidates at replay time, compared with 28 changed-title checks
in the entire earlier sample. The first four-country run includes all 120 lists,
whereas that sample completed 36 and deliberately skipped 84 outside its panel.
A full initial dry run therefore needs baseline cost/time allowances, just like
the first apply; it does not establish the later daily runtime. The canceled
run's rotated logs do not preserve complete aggregate retry statistics.

The census sizes the real daily primary pass at **144,399 discover requests +
one regions GET = 144,400/day**. Add second-sort pages for incomplete primary
reads and fresh changed-title checks, shared across countries/services. Measured
throughput was **12.6–14.2 requests/s** at the configured 15/s cap. That gives:

| Planning case | Requests/day or first read | Read/preview runtime at observed throughput |
| --- | ---: | ---: |
| Primary pass | 144,400 | 2.8–3.2 h |
| Ordinary daily allowance: primary + 5,000 title checks | **149,400** | **2.9–3.3 h** |
| Also reserve 15% extra discover requests for fallbacks | 171,060 | 3.4–3.8 h |
| First global baseline, refreshed distinct-title proxy | About 282,584 before reserves | About 9.1 h locally; about 8 h projected on Windmill, before writes |

Use **about 150,000 requests/day and 3.2 hours** for the ordinary daily plan;
the formula, request budget, and failed-list report remain authoritative during
actual changes or country drops. No daily change-rate claim comes from this short
sample. New metadata GETs are not needed: original metadata is read from Mongo.

The first baseline confirms listed titles and eligible open stays. A new
production **SELECT-only recount**, filtering the 15 service IDs and
`streaming_type IN ('flatrate','free','ads')`, found **108,332 movie + 30,041 show
IDs**, or **138,373**. Grouping by IDs independently confirms this count; adding
eligible open history stays leaves the union unchanged. Apple TV (350) contributes
only **160 eligible movie IDs and 235 eligible show IDs** (235 flatrate and
28 free show IDs, with overlap). Its 67,859 movie buy / 66,266 movie rent /
7,215 show buy counts are excluded, not subtracted from eligible titles
on other services. Thus the eligible-only recount does **not** support reducing
the proxy by 75,800. Full queries, parameters, type/service breakdowns, and union
results are saved in [evidence.json](evidence.json).

Treat 138,373 as a planning proxy for distinct title checks, not an API count:
Crate includes ended offers and can lack new titles, and conflicting cached
responses may need another check. With a 15% fallback reserve, that proxy becomes
about 304,433 requests. **The former 6.0–6.7-hour baseline estimate omitted how
per-list history work scales; do not use it to plan an apply.** A new count found
138,184 distinct eligible open titles but 3,287,968 distinct title/list
memberships. Combining per-list counts with the census and the four-country
overlap predicts about 3.36 million candidates and 17,920 history batches.
The four-country timing trace fits 0.0674 s/title request, 0.0668 s/discover
request, and 0.706 s/history batch, including the associated metadata/planning
work. This predicts about 9.1 hours for 282,584 GETs, or about **9–11 hours of
reads for 294,000–336,000 GETs** allowing extra title checks and discover retries.
Read-only Windmill component probes found faster database round trips than the
local runner. Adjusting the model for those measured differences gives roughly
**8–9 hours of Windmill reads before writes**. Apply additionally acquires one
title lease per candidate: 3.3 million serial acquisitions cost about 0.9–1.9
hours at an assumed 1–2 ms each, before other lease operations, Crate refreshes,
and history writes. An indexed read measured 1.3 ms on the worker; production
writes were not benchmarked. The global first apply should therefore not be
planned within 14:00–21:00 UTC or assumed to fit the current eight-hour timeout,
even if it fits the 350,000-request budget. These are model estimates from the
completed sample and read-only component probes, not a measured global apply.

The proposed fallback is a six-day baseline, balanced by open memberships and
discover pages rather than country count. Each stage adds roughly 0.55 million
memberships and 24,000 primary discover requests. Each day's one run must include
all countries already started, preserving their consecutive daily observations.
A balanced grouping of the current census gives about 116k, 142k, 169k, 195k,
214k, and 238k requests on days 1–6, including a 15% discover reserve and 5,000
daily title checks. Estimated reads are 2.9–5.2 hours/day before apply overhead;
preview each stage and shrink it if necessary to retain headroom before 21:00.
This costs about 1.07 million requests over six days because distinct-title
checks repeat between runs. It is a proposal; no stage or schedule was created.

Skipping all baseline per-title checks is not equivalent: first observations
remain unknown, but their verified offer types supply tomorrow's exact-drop
proof, and old open stays still require a per-title check before closure.
A snapshot-only baseline could cost about 144k–166k discover requests and 3 hours,
but would defer history reconciliation and lose exact first departures until
offer types were verified. The six-day plan retains the existing writer rules.

A separate full three-country baseline probe was stopped after at least 15,000
GETs in 1,139 seconds once the completed daily samples supplied the requested
cost measurement. It made no production writes. **A complete global baseline and
production apply were not run.** Its partial result is explicitly marked
incomplete in the evidence rather than reported as a completed benchmark.

Reproduce with the existing local Windmill CLI `goodwatch` remote; the tool reads
credentials using variable GETs, intercepts Crate calls to permit only SELECT,
and invokes the public coordinator with `ListStorage(dry_run=True)` (no operational leases):

```sh
python goodwatch-flows/tools/measure_daily_provider_lists.py \
  --countries BR DE NG --output /tmp/daily-list-baseline.json
python goodwatch-flows/tools/measure_daily_provider_lists.py \
  --census --output /tmp/daily-list-census.json
python goodwatch-flows/tools/measure_daily_provider_lists.py \
  --countries BR DE NG US \
  --previous-panel ~/.local/share/goodwatch-availability-measure/data/daily-snap-2026-10-16.json.gz \
  --output /tmp/daily-list-comparison.json
```

The research-panel mode uses actual earlier fresh list IDs and projects prior
offer kinds from history for preview planning only; it does not install production
checkpoints. The earlier reader used date partitions that can omit undated titles.
Its absence evidence is deliberately untrusted for precision. Request counts and
completeness results are observed; detected differences can include reader changes
and are not a full day's arrival/departure rate or a production-write validation.

## Owner rollout and schedule

Nothing in this build creates production tables, collections, scripts, flows,
schedules, or data. Windmill submissions only validate inert previews or resolve
dependencies for the local lock files.

1. Review the change, then deploy through the normal main/GitHub Actions pipeline.
   This checkout was not pushed. Confirm the shared history helper, the new
   `daily_provider_lists` and `daily_list_storage` scripts, and
   `read_daily_provider_lists` flow all match the reviewed sources before running.
   Both locks were regenerated with `wmill script generate-metadata --lock-only`;
   ensure the deployed script locks include `crate`, `orjson`, and `verlib2`.
   The shared writer changes affect ordinary publication immediately on deploy;
   deploying the helper is not inert.
2. No Crate DDL, enum change, or backfill is required. The existing
   `availability_history` table and writer must already be deployed, as they are
   on this production system. No new credentials are required.
3. Run the flow manually with `dry_run: true`, first for a few countries, then
   without a country restriction, starting at 14:00 UTC. Investigate incomplete
   lists or service errors. This validates the eight-hour timeout on CE, which
   has not yet run a job of that length. Live dry runs create only the operational
   lease collection/index, not the other collections or any data publications.
4. **Back up `availability_history` before the first apply** into an owner-created
   table, e.g. `availability_history_before_682`, using its existing schema and
   `INSERT ... SELECT`. List observations share `appeared_source = 'title'` with
   ordinary publication, so there is no reliable list-only undo filter. Then run
   the baseline at 14:00 UTC, allowing its larger cost and duration. The apply
   creates the checkpoint/pending collections; the TTL lease index is automatic.
   Larger expansions can baseline country groups
   over several days. Preserve checkpoints; deleting them discards daily evidence.
5. Create the disabled schedule from [proposed-schedule.json](proposed-schedule.json),
   then enable it after checking the baseline and pending markers. Proposed time:
   **14:00 UTC every day**, cron **`0 0 14 * * *`**. The weekday field is `*`;
   Windmill numbering is **1 = Sunday, 7 = Saturday** if explicitly enumerating
   days. Its currently deployed recent-release recheck is at 13:00 UTC. TMDB's
   true batch hour remains unconfirmed; this schedule records TMDB read days,
   not guaranteed real-world service arrival days.
6. After two consecutive daily reads, inspect exact arrivals/drops, failed lists,
   pending IDs, request/refusal counts, and duration. The report fails the flow
   when any list is rejected, while independent completed lists retain progress.

To stop, disable the new schedule and wait for its active job. Preserve history
and checkpoints. A pause introduces an unknown gap, not an exact day. For rollback,
revert the code; restore the history backup if the baseline published incorrect
stays. No Coolify setting changes are required.

For a deliberately **retired** list, first exclude it from the configured scope
(`service_ids`, an explicit `countries` filter, or future pair enumeration).
Deleting a checkpoint while its pair remains in scope creates a new baseline.
Pause the schedule and wait for the active job, verify and finish its pending
history reconciliation, then archive its
checkpoint and pending document. Delete those two documents by exact list `_id`
only after confirming retirement with the owner; do not delete history. Once the
country has no checkpoints or pending IDs and TMDB no longer lists it, country
selection stops including it. An empty or dropped-country list is not automatically
retired: keep reading it to detect returns. Catalog-listed countries remain in
scope. Leases self-clean through TTL; active checkpoints and recovery intents
have no TTL because expiring either would erase daily evidence or lose recovery.

## Widening to every list later

Service IDs are configuration, not embedded in the completeness or history logic.
Every added list gets its own unknown baseline and later daily evidence. Snapshot
identity, recovery, type checks, and history publication work for other services.
For option 1, enumerate the union of regional service pairs and existing
checkpoint/pending pairs rather than probing all 925 services in every country.
Keep reading previously known pairs after they disappear from catalogs. Size and
increase the request budget/runtime before enabling that larger scope; oversized
indivisible bins remain explicit failures rather than truncated lists.

## Verification and files

Tests were written red before implementation at the agreed seams. The two
re-review scratch cases (genuine pending removal and retained offer after an
unknown baseline drop) both failed before the writer correction. Further checks
cover positive API/scrape returns and the unchanged exact-drop day guard. Both
report nits also failed before their fixes. The final empty-scrape scratch case
(`SCRAPE=1`) failed before requiring offer-level scrape presence; positive checks
cover URL, quality, and zero-price offers while keeping the exact-drop day guard. Final checks:

- New tests with disposable local Crate 5.10.16: **47 passed**, five opt-in
  Windmill previews skipped in that run; those **five remote previews passed**
  separately, alongside their local fixture check.
- Existing history regressions with local Crate: **39 passed, one opt-in preview
  skipped**. The new inert preview also exercises the shared history writer.
- Full flow suite with local Crate: **1,585 tests, 1,537 passed, 47 skipped,
  one pre-existing failure**. It is
  `test_deleted_titles.DeleteFromCrateTests.test_user_tables_are_untouched_and_all_derived_tables_are_covered`:
  the deletion inventory omits `social_title_link`, `social_link_report`, and
  `social_relevance`. The test, deletion helper, and schema are unchanged from
  HEAD; the preceding history build already documented the same failure.
- Both regenerated locks include `orjson`/`verlib2` and are identical. Installing
  the daily-job lock into a fresh Python 3.12 environment passed imports; its
  dependencies also passed the 41 local daily-job tests (with test-only mongomock
  and PyYAML added).
- `git diff --check` passed. No production data publication, table/collection
  creation, script/flow deployment, schedule mutation, push, merge, or PR occurred.

The two agreed test seams are the daily job entrypoint with simulated TMDB/storage
adapters and the existing history writer. Tests cover baseline/empty baseline,
consecutive-day arrivals and returns, whole-country drops, false-change retries,
sort fallback, short/changed responses, large-list partitions, gaps and freshness,
same-day refinements, stale pending publications in both directions, busy-title
retries, run/list leases, authentication and outage stops, original metadata,
null dry-run inputs, and interrupted
publication whose source changes before retry. The SQL test runs the entrypoint
against the deployed schema on disposable localhost Crate, with no offer table
present. Opt-in inert Windmill previews execute checkout code and the real flow's
argument wiring, omitted-input defaults, and report failure paths with in-memory HTTP/storage adapters.

```sh
python -m unittest discover -s goodwatch-flows/tests -p 'test_daily_provider_lists*.py'
TEST_CRATE_URL=http://127.0.0.1:16883 python -m unittest discover \
  -s goodwatch-flows/tests -p 'test_daily_provider_lists*.py'
TEST_WINDMILL_PREVIEW=1 BASE_INTERNAL_URL=... WM_WORKSPACE=goodwatch WM_TOKEN=... \
  python -m unittest discover -s goodwatch-flows/tests -p test_daily_provider_lists_preview.py
```

- `goodwatch-flows/windmill/f/tmdb_api/daily_provider_lists.py` and its script metadata/lock: reader, completeness gates, HTTP budget, entrypoint.
- `goodwatch-flows/windmill/f/tmdb_api/daily_list_storage.py` and metadata/lock: checkpoint, intent, lease, and shared history adapters.
- `goodwatch-flows/windmill/f/tmdb_api/read_daily_provider_lists.flow/`: flow and failure-report step.
- `goodwatch-flows/windmill/f/sync/availability_history.py`: scoped list evidence, same-day refinements, and scoped history reads in the existing writer.
- `goodwatch-flows/tests/test_daily_provider_lists*.py`: entrypoint/writer behavior, real local SQL, inert previews.
- `goodwatch-flows/tools/measure_daily_provider_lists.py`: production SELECT-only dry run and request census.
- This directory: design, reproducible measurements, evidence, and a disabled schedule proposal.
