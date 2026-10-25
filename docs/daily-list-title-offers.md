# Daily service lists and title offers

The daily list job can establish an arrival/drop before the title's next full
publication. Its verified changes now hand affected titles to the existing
streaming publisher. This implements the owner's October 25, 2026 decision
following #682 and #489 Part C.

## Publication path

`daily_list_storage.ListStorage.flush` compares each verified country/service
scope with Crate's child offers and aggregate arrays under the existing title
publication leases. A verified change or disagreement stages a durable Mongo
`tmdb_list_offer_refresh` intent **before** history and checkpoint writes.
Matching unchanged scopes need no additional HTTP request. Multiple countries/services
merge into one title intent; movie and show identities remain separate.
On a baseline (`previous_at` absent), empty previous membership is not a change:
only an actual child/aggregate mismatch queues a refresh. A newly introduced
country or service therefore does not enqueue all already-correct list members.

After the lists finish, `daily_list_ramp.run_daily_job` consumes these intents
with the same `TMDBClient`: one fresh `/movie/{id}/watch/providers` or
`/tv/{id}/watch/providers` request per selected title, including normal retry,
cache-bypass, pacing and hard-budget rules. A narrow Mongo source update writes
the normalized watch-provider payload, proof, attempt time and durable scoped
evidence. It does not change details `updated_at`, selection state, the 30-day
cycle, or country-scrape retry state. Standalone endpoint `id` is removed through
the existing strict `WatchProviders` model before storage.

`list_offer_refresh.publish_offers` calls
`f/sync/copy/tmdb_streaming.copy_media` with exact TMDB IDs and
`recent_only=False`, `mapping_refresh_limit=0`, and `targeted_batch=True`, then
`f/sync/copy/vector_data.copy_to_qdrant` with strict
writes. These are the existing scheduled/targeted transformations and title
leases. The shared copier remains the only writer of child offers and the
`streaming_availabilities`, `streaming_country_codes`, and
`streaming_service_ids` arrays. The same path publishes `streaming_evidence`
and reconciles history. The vector writer rereads the published Crate snapshot
under its existing lease, reusing the caller’s Crate connection. Strict vector
publication uses one token and ownership query for the group, and fails before
writing if any requested lease is busy. Targeted vector reads project only the
fields used to build the same payload/vectors; the overwritten raw provider
merge is omitted. The offer refresh skips the unrelated global deletion scan;
selected flagged titles are still excluded and scheduled deletion behavior is
unchanged. The streaming batch overlaps two Mongo source reads with its Crate
reads while holding the publication leases; it joins the readers and rechecks
ownership before writing. No whole details/ratings/DNA refresh is needed.
The consumer prepares at most 20 titles at a time with six workers and groups
successful results per media type. Every worker uses the same paced, locked
TMDB client; retries still consume the shared budget. Source writes are narrow
and guarded against a newer observation. The Crate cursor remains on the caller
thread. Catalog existence and version-fenced queue acknowledgments use one
operation per group. Mongo source reads use a narrow projection. List/backfill
connections negotiate built-in zlib compression for large provider/proof reads.
The consumer groups at most 20 prepared titles per media type. Both the shared
streaming batch writer and vector writer receive the whole group: Mongo index
setup and service-catalog reads occur once per group, and Crate reads/writes
are shared across titles. Individual history/identity failures stay pending
while successful titles are acknowledged after vector publication.

This deliberately uses a fresh per-title API read instead of constructing
offers from discover membership. Discover proves only service membership;
the title endpoint supplies all countries, offer types, links and priorities.

The consumer disables synchronous mapping-recovery web fetches through the
shared copier's optional `mapping_refresh_limit=0`. Unmapped scraped countries
retain/defer their contribution normally, while mapped API offers can publish.
Thus no hidden TMDB requests escape this job's counter.

## Drops and recovery

An omitted API country normally means unknown. A list-confirmed scope plus the
fresh title check is stronger evidence for the specific service's subscription,
free and ad-supported offers. Durable `watch_providers_list_scopes` in the title
source records that fresh check's time and eligible types for each monitored
country/service. The shared reconciler removes disproved older contributions,
including scraped and legacy rows, even when the entire country is omitted.
Other services and rent/buy offers retain ordinary reconciliation rules.

Cached, failed or concurrently saved details cannot revive those disproved
offers. A newer cache-bypassed API result, or a newer successful web scrape, can
supersede the scoped check. Scraped evidence excludes the same superseded offers.
Quarantined identities remain frozen by the existing publisher.

Regular details reads for a title with scoped evidence now bypass TMDB's cache
using the existing request, so this adds no requests to that queue. An older
cached request already in flight is treated as superseded in a country where
it contradicts the verified scope: it cannot clear an already published arrival
or re-add a disproved drop. Its evidence remains unknown until a fresh read.
Scoped negative intents also reconcile an open history stay when its child
offer was already missing; the shared history writer does this for the verified
service only.

A failed source/publication/vector write retains the intent. A version token
prevents acknowledgment from consuming newer work. Daily changes have priority
over the older backfill, and unattempted work precedes failed retries at the same
priority. The automatic daily consumer handles at most 30,000 titles; manual
consumer invocations retain their 20,000-title maximum. Budget
exhaustion leaves the rest pending and triggers the existing hard-budget alert.
The daily drain also consumes priority-0 backfill items after priority-1 daily
changes, using any remaining part of that same 30,000-title allowance. Backfill
is not restricted to manual execution. Inspect queue progress before planning
manual batches or computing the day's remaining request allowance.
The daily consumer also stops at 28,000 total run seconds, reserving time inside
the existing 28,800-second flow timeout for reporting and cleanup. Excess work
stays queued and is reported as a warning. Manual consumer batches use the same
runtime bound; the documented 1,000-title batches keep review/execution bounded.
Twenty consecutive preparation/publication failures stop the drain, so a Qdrant
outage spends at most one 20-title batch of TMDB reads before stopping. All intents
remain pending. Queue sort and index directions share one definition; the bounded
selection is materialized before sort keys change, preventing a failed item from
being selected twice in the same invocation.
Missing/deleted/duplicate source identities, missing catalog rows, provider 404s
and quarantines are reported for the existing full ingestion/identity path;
the provider endpoint alone never authorizes title-wide deletion.

Existing list access, 350k, >1% and three-consecutive-day alert rules remain.
The offer stage applies the same >1% and three-day thresholds to failed title
refreshes. Operational error samples contain identity, error class and stable
defer codes; arbitrary upstream exception text is omitted.

## Request cost

Read-only Windmill results:

| Run | Existing requests | Existing title checks | New changes only, before retries | Full 30k daily drain including backfill, before retries |
| --- | ---: | ---: | ---: | ---: |
| October 24 | 164,495 | 18,436 | 182,931 | 194,495 |
| October 25 | 169,005 | 18,950 | 187,955 | 199,005 |

The upper bound assumes every checked title needs repair. Actual extra requests
equal distinct queued changed/mismatching titles, not country/service rows. The 30,000-title daily
consumer limit caps the normal added successful requests at 30,000, including
older pending work. All retries count toward the **same 350,000 hard limit**.
No new schedule is needed: daily lists still start at 14:00 UTC, after the
13:00 UTC recent-release recheck. Extra HTTP pacing alone is at most about
33 minutes 20 seconds at 15 requests/second; publication time is additional. The old consumer measured 1.574 s/title in the
approved pilot; the throughput fix below still needs its reviewed live timing. Count the day's requests as existing
list work + **all** daily-drain requests (both priorities) + manual previews +
manual execution + retries. A full pending queue makes October 25's daily upper
bound 199,005, rather than the fresh-change-only 187,955. The higher cap leaves
room for 20–23k daily changes and some backfill; the remaining-time bound can
stop the consumer earlier. It does not reserve additional requests beyond 350k.

## Read-only backfill

`goodwatch-flows/scripts/backfill_list_title_offers.py` scans the whole history,
not only recent exact arrivals or the daily job's 15 services. It selects the
newest stay **per title, country, service and eligible offer type**, then compares
the union of eligible types against child offers and title arrays. A closed
flatrate stay beside an open ads stay is not a service drop. Rent/buy offers can
legitimately keep an aggregate token after eligible offers end.

Each batch reads every country for 1,000 titles once. At most two batches run
concurrently. The audit uses SELECT only, writes a local resumable manifest,
and records a SHA-256 over every proposed title/scope row. Its summary and
country/service breakdown are in the accompanying audit evidence. The audit
is a rolling read, not a database transaction; subsequent source changes can
change the final correction. A fresh title response at execution takes priority
over an older history snapshot. Never force old membership into current offers.

The manifest dry run describes exactly the queue intents to be written. Queueing
it does not hand-edit offers. The consumer refetches current truth and uses the
same publisher as the daily job. A complete manifest is required for apply.
After queueing, `--drain --preview-offers` uses fresh budgeted HTTP plus SELECT/find
only to report each selected title's source fields, child upserts/deletes, title
arrays, evidence, history and vector availability. It calls the same normalization
and pure publication transformations as execution. Inspect this local diff before
each live batch. Execution refetches again, so later upstream changes can alter
the result; the preview is an observation, not a reservation of upstream truth.
`--check-sources` reports titles needing a full ingestion or identity repair
without performing one. Repeated applies/refreshes are safe, but spend another
request per selected title.

The October 25 full read-only audit scanned **254,637 movies and 74,353 shows**
across **139 countries**. It found **58,275 affected titles**, comprising
**50,469 arrival mismatches** (7,259 titles) and **493,942 drop mismatches**
(53,887 titles): **544,411 country/service scopes**. A title can have both
directions in different scopes. These counts include older disagreements,
not just the exact arrivals displayed by `/new` today.
An additional read-only latest-stay check confirmed **2,520 exact-drop stays
across 615 titles** among the affected scopes, so the reverse problem is present
for exact drops too. The CSV includes their country/service counts and names
for all 48 affected provider IDs.

All affected titles exist in Crate. Mongo preflight found **58,274 eligible
titles** and one deferred duplicate identity, `movie:145249`. Resolve that
through the existing details/identity path after review; do not pick an arbitrary
source record. The normal backfill would spend about **58,274 fresh requests**
before retries or newly discovered upstream deferrals. Its actual after counts
are **not measured** for the full manifest. The approved 1,000-title pilot
published 995 titles, deferred five, and left 57,280 intents pending; it did not
finish the backfill.
Previewing every eligible title once and then applying costs about **116,548
requests** before retries. Alongside a full 30k daily drain using October 25 list costs, the
planning ceiling is **315,553 requests**, leaving **34,447** of the 350k
allowance before other manual runs, profiling, or retries. This deliberately gives no credit for backfill titles
already consumed automatically: those reduce subsequent manual execution.

Committed evidence:
[summary](implementation/daily-provider-lists/title-offer-backfill-20261025.json),
[complete country/service CSV](implementation/daily-provider-lists/title-offer-backfill-20261025.csv).
The complete 171 MB intent manifest with every title/scope is retained locally at
`~/.local/state/goodwatch/title-offers-backfill-20261025/backfill-reviewed.json`, intent-row SHA-256
`4f0dfec84ca048f861fe792091cede514aed4e315d4be431fc8f0947e2b00a8c`.
For example, DE/Netflix (ID 8) has 83 arrival and 1,299 drop mismatches;
US/Netflix has 109 arrival and 1,218 drop mismatches. Dorothy, movie 1578079,
is in the manifest for Germany and other missing Netflix countries.

## Commands after review

Run from the reviewed worktree root. Keep production read-only until review
passes. The helper reads credentials in memory; do not print it or its token.

```bash
WM_HELPER=/tmp/claude-1000/-home-alp-dev-projects-goodwatch-goodwatch-monorepo/9b66f89c-8298-487a-b040-f359220ae9af/scratchpad/wm.py
STATE_DIR="$HOME/.local/state/goodwatch/title-offers-backfill-20261025"
mkdir -p "$STATE_DIR"
BACKFILL_PLAN="$STATE_DIR/backfill-reviewed.json"
```

The commands below use `uv run -q --with wmill --with mongoengine --with requests
--with pydantic --with python-dateutil --with crate --with sqlalchemy --with
qdrant-client python`. Define a shell function to keep them readable:

```bash
offer_backfill() {
  uv run -q --with wmill --with mongoengine --with requests --with pydantic \
    --with python-dateutil --with crate --with sqlalchemy --with qdrant-client \
    python goodwatch-flows/scripts/backfill_list_title_offers.py \
    --wm-helper "$WM_HELPER" "$@"
}
```

1. Deploy the reviewed commit through main's existing
   `push-windmill-workspace.yml`. Deploy all changed shared modules, metadata and
   locks together. No new Crate table, schedule or Coolify setting is required.
   Keep `watch_providers_list_scopes` in the strict Mongo model during any
   rollback, so titles written by this version still deserialize. Retain pending
   intents for replay; do not delete them or roll back source evidence.
2. Refresh the SELECT-only audit if needed, or inspect the retained complete
   manifest. An interrupted scan can add `--resume`:

   ```bash
   offer_backfill --output "$STATE_DIR/backfill-fresh-before.json" --workers 2
   offer_backfill --manifest "$BACKFILL_PLAN" --check-sources
   ```

   If a fresh audit replaces the reviewed input, review that new file and set
   `BACKFILL_PLAN` to its path before applying it.

3. After the dry-run manifest and code pass review, enqueue exactly that manifest:

   ```bash
   offer_backfill --manifest "$BACKFILL_PLAN" --apply
   ```

4. Outside the daily list run (the existing run lease prevents overlap), preview
   and then consume a bounded batch. Inspect failures and `remaining` before
   repeating. A 1,000-title batch spends at most 20,000 HTTP requests including
   retries; normally it spends at most 1,000. Account for manual requests beside
   that day's normal run, and keep the combined operational allowance below 350k:

   ```bash
   offer_backfill --drain --limit 1000
   offer_backfill --drain --preview-offers --limit 1000 \
     --output "$STATE_DIR/next-batch-offer-diff.json"
   offer_backfill --drain --limit 1000 --max-requests 20000 --apply
   ```

   Repeat successful batches until `remaining=0`; investigate deferred source or
   identity cases instead of clearing them. The same consumer is deployed as
   `f/tmdb_api/list_offer_refresh`; its defaults are read-only.
5. Rerun the complete SELECT-only audit to a different file and compare summaries:

   ```bash
   offer_backfill --output "$STATE_DIR/backfill-after.json" --workers 2
   ```

   Report actual residual arrivals/drops and full-ingestion/identity blockers.
   An upstream change can legitimately leave a mismatch with an older history
   snapshot; inspect it rather than claiming zero from a dry run.

## Cache limits

There is no title-page invalidation in the existing publication path. This
change reuses that path and corrects stored offers; it **does not promise
immediate agreement in already cached responses**. In particular:

- `app/server/title-details-cache.ts` includes country offers in data cached for
  12 hours fresh plus 12 hours stale. A corrected Crate title can therefore
  still show its previous offers for up to 24 hours, plus a cached HTML response.
- Anonymous HTML uses 30 minutes fresh plus two hours stale in each webapp
  process, with no publication reset across processes (ADR 0007).
- `availability-index.server.ts` reloads each country's in-memory index every
  six hours. Qdrant and Crate updates do not reset those indexes.
- `availability.server.ts` caches raw evidence for 30 minutes. Its eligibility
  clock is independent of cache age.

Cache invalidation needs an application-wide mechanism; the flows cannot clear
the process-local HTML/index state. Do not work around this by writing to
Coolify. After applying, distinguish direct Crate/uncached verification from a
warm title page. The actual post-backfill counts and user-visible freshness are
unverified until the reviewed execution and cache expiry/invalidation.

## Validation

Focused tests cover durable staging before history failure, deduplication,
separate movie/show identities, strict Mongo deserialization, dry-run inertness,
hard-budget retention, version-fenced acknowledgment, source deferrals, scoped
whole-country drops, legacy/scraped contributions, later cached/failed reads,
newer positive checks, scheduled publication, type unions and aggregate-only
backfill mismatches. Existing daily-list, streaming publication, availability
and vector publication suites are also run. Live publication and backfill writes
remain gated on review.

The focused suite ran **249 tests: 234 passed and 15 optional integration checks
were skipped**. A production read-only preview, guarded against all SQL/Mongo
writes and using an in-memory queue, made exactly **three TMDB requests**:
movie 1578079 planned 76 offer upserts and eight history upserts; movie 28 planned
one offer deletion; show 25391 planned six offer upserts. All three previews
completed without errors in 3.441 seconds. Full diffs are retained at
`/tmp/title-offers-sync/live-offer-preview.json`. These are plans, not executed
production corrections.

The review follow-up runs **every daily-list suite**, including
`test_daily_list_ramp.py`, and adds baseline, remaining-time, consecutive-failure,
indexed-selection and batched-publication regressions. A 1,000-title benchmark
uses the actual shared streaming copier with in-memory Mongo/Crate adapters and
a recorded vector boundary. It completes in **3.108 seconds (0.003108 s/title)**,
using **50** copier/catalog/vector batches and **200** index setup calls, rather
than 1,000 batches and 4,000 index setup calls. These are CPU/adapter timings;
they do not establish production network/write throughput. The first reviewed
1,000-title live batch must still be timed against the approximately
**0.77 s/title** steady-state budget. Every consumer result now includes elapsed
seconds, seconds per published title, and publication batch count.

The complete follow-up verification ran **288 tests: 271 passed and 17 optional
integration checks skipped**. All four daily-list suites ran: 30 ramp,
72 provider-list, 2 integration and
9 preview tests. The ramp suite includes the remaining-time handoff regression.
[Review-fix evidence](implementation/daily-provider-lists/title-offer-review-fixes-20261025.json)
records the measured timings and setup counts.

To run every daily-list suite explicitly:

```bash
PYTHONWARNINGS=ignore uv run -q --with pyyaml --with wmill --with mongoengine \
  --with mongomock --with requests --with pydantic --with python-dateutil \
  --with crate --with sqlalchemy --with qdrant-client --with beautifulsoup4 \
  python -m unittest discover -s goodwatch-flows/tests -p 'test_daily*list*.py'
```


## October 25 throughput profile and fix

The approved live pilot selected 1,000 titles, published 995, deferred five,
and used 1,000 TMDB requests without retries. Its drain took 1,566.106 seconds
(**1.573976 s/published title**). The existing second-resolution vector logs
account for approximately **508 seconds across 50 groups** (32% of the run).
They do not time Mongo source writes or Crate bulk writes individually. Mongo
profiling was disabled, and the matching Crate jobs were no longer retained;
those historical write timings cannot be reconstructed accurately.

A read-only probe of the first 40 repaired titles measured:

- Sequential TMDB checks: **7.676 s**, or **0.192 s/title**; six concurrent
  checks through the same paced client: **2.741 s**, or **0.069 s/title**.
- Mongo source reads: **6.681 s** for the original 80 identity/full-document
  reads. Small maintenance/lease reads averaged **28–34 ms** each.
- A replay of the original vector path made **309 Mongo read calls in
  18.675 s**, plus write RTT surrogates; the full vector stage took **20.754 s**.
  The actual vector boundary test made 80 maintenance reads for 20 titles.
- The original streaming replay spent **4.035 s** in eight Crate SELECTs and
  **7.117 s** in 40 Mongo reads. Its Crate bulk-write read surrogates took
  **0.107 s**; that last number is **not production bulk-write latency**.
- The 40 titles' provider query returns **1,814 documents / 3.64 MB** and
  executes on Mongo in **13 ms**. An uncompressed slow sample spent 13.241 s
  receiving provider documents; the compressed sample spent 0.546 s. The live
  handshake negotiated zlib (compressor ID 2), without installing a package.

The patch overlaps provider/source preparation, removes repeated vector lease
checks, projects vector inputs, avoids the global deletion scan during offer
refreshes, overlaps Mongo/Crate source reads, and batches catalog checks and
queue acknowledgments. It retains the existing streaming/vector writers and
their publication fences. No production write was performed in this profile.

| Read-only replay | Titles | Total seconds | Seconds/title |
| --- | ---: | ---: | ---: |
| Original consumer | 40 | 50.450 | 1.261247 |
| Complete fix, same first 40 | 40 | 14.481 | 0.362029 |
| Complete fix, first 120 | 120 | 71.102 | 0.592519 |
| Complete fix, repeated 120 | 120 | 44.758 | 0.372983 |

These are production-read timings with private in-memory queue/lease state.
Every SQL/Mongo/Qdrant mutation and REFRESH is intercepted: writes use read RTT
surrogates. Already repaired titles can also need fewer writes than new work.
**They do not establish live write throughput.** All intermediate runs, including
slower samples, are retained in the evidence. The repeated 120-title run spent
9.270 s preparing sources, 24.457 s in streaming publication and 10.709 s in
vector publication. Its 24 streaming SELECTs returned 36,551 rows; aggregate
server SQL time was 1.041 s, showing that transfer/round trips remain material.
The investigation used **600 read-only TMDB requests**, zero retries.

Every future drain result now includes `timings`: preparation/publication wall
seconds, cumulative worker seconds for TMDB/source reads/source writes,
`streaming_publication`, `vector_publication`, queue acknowledgment, and actual
Crate `select`, `run`, `upsert_many` and `run_many` durations. Worker seconds
include shared pacing waits and overlap; nested Crate timings are parts of the
publication stages, so these fields must not all be summed. A reviewed live
pilot must still check `seconds_per_published_title` against 0.77 and inspect
actual bulk/source-write timings before continuing a large drain.

### If the fix is not deployed by October 26 at 14:00 UTC

Read-only Windmill API checks confirmed the deployed schedule is enabled at
14:00 UTC with `dry_run=false`, 15 requests/s and a 350,000 request budget. The
list module still has a 28,800-second timeout and precedes the report module.
Its deployed ramp completes list work first, then passes
`max_seconds=max(0, 28000 - elapsed)` to the old 20,000-title drain. At the assumed
12,550-second list stage, that leaves 15,450 seconds: about **9,816 titles** at
the pilot's rate. New priority-1 work goes first; unused capacity consumes the
priority-0 backfill. All unfinished/version-replaced work stays pending.

Time exhaustion reports `runtime_budget`, warns about remaining queue depth,
and leaves completed list checkpoints/history in place. Hard-budget exhaustion
retains work and raises the existing report error; access/lease failures still
stop the job, and the 20-consecutive-failure, >1%, and three-day rules remain.
The deadline is cooperative between groups: in-flight HTTP/DB work can overrun
it. The 800-second reserve is not an absolute guarantee that the report runs;
a prolonged operation can still hit Windmill's hard timeout. No schedule or
production configuration was changed by this fix.

The complete regression run contains **308 cases: 291 passed, 17 optional
checks skipped**, including all 113 daily-list cases. New tests cover bounded
concurrency and the real shared-client hard budget, partial response failures,
version-fenced group acknowledgment, overlapping reads with a single Crate
thread, busy/replaced vector leases, identical projected payloads/vectors, and
skipping global deletion work while excluding selected flagged titles.
[Profile and safety evidence](implementation/daily-provider-lists/title-offer-performance-20261025.json)
is committed. Full replay logs and scripts are under
`~/.local/state/goodwatch/title-offer-performance-20261025/`. Keep new manifests,
previews and reports in `~/.local/state/goodwatch/`, not `/tmp`.
