# Streaming country retries

Issue [#5](https://github.com/alp82/goodwatch-monorepo/issues/5) makes the
scheduled and priority provider crawlers share country eligibility and ownership.
Provider Mongo IDs are distinct from title-detail IDs and from TMDB IDs. Movie
and TV identities remain separate even when their numeric TMDB IDs coincide.

`updated_at` means the last verified successful country scrape, including a
verified response with no offers. `next_fetch_at` governs subsequent eligibility;
success remains fresh for seven days. Failures retain links and success time,
and retry after 30 minutes, two hours, then six hours with positive jitter and
any longer upstream retry delay. A shared upstream backoff prevents another
country or worker immediately bypassing a source rate limit.

An unresolved provider during publication can request a mapping-recovery fetch,
even for a fresh successful scrape. This uses the same atomic country claim and
failure/upstream backoff, with an additional 30-minute `mapping_refresh_after`
deadline to bound repeated requests. It does not alter normal scheduled freshness.

A worker claims a country atomically immediately before requesting its page.
An expiring token fences both successful and failed writes: an expired worker
cannot overwrite or release its replacement's claim. Fresh, failed and deferred
outcomes are separate from actual successful fetches. Publication semantics and
title acknowledgment are handled separately by issue #6.

The parser accepts empty availability only from TMDB's explicit `.no_offers`
marker. Bounded live reads on September 10, 2026 verified that TV 1859's US page
contains provider blocks and its DE page contains that empty-result marker.
Arbitrary HTTP 200 HTML does not prove a completed scrape.

## Migration and rollout

The initial live inventory contained approximately 6.61 million movie-provider
and 1.51 million TV-provider documents. Backfill must remain bounded and
resumable; it must not turn migration into a bulk source rescrape. It preserves
existing success timestamps and links, derives eligibility from actual success,
and reports conflicting or duplicate country identities without merging them.

Before deployment, save the affected deployed scripts, flows and schedules,
then pause scheduled provider crawling, provider initialization and priority
processing and allow existing writers to finish. Deploy the compatible scripts
and flows together before restoring those schedules. The September 10 rollback
snapshot is retained privately at
`/home/alp/.local/state/goodwatch/issue-5/20260910T223519Z`.

Rollback restores the saved crawler and initializer definitions while the same
schedules are paused and their current writers have finished. Keep the updated
MongoEngine model definitions so they can read the added retry fields; restoring
an older strict model against those fields would cause schema errors. Retain
newly successful source results and retry metadata. Resume schedules only after
the restored definitions are consistent.

## Validation evidence

A bounded Mongo probe used disposable collections on the real replica set:
eight simultaneous country claimants produced exactly one winner; an expired
worker's write was rejected after replacement; the replacement persisted an
explicit empty success; a subsequent claim six days later remained ineligible.
The probe's collections were removed immediately afterward. No production
country records or shared source-rate-limit state were modified by this probe.

Read-only backfill probes each scanned 100 existing provider records, reporting
no identity conflicts and no writes. Movie and TV batches completed in 1.64 and
0.57 seconds respectively; each returned a continuation ObjectId. These are
bounded samples, not a claim that every legacy record has a valid identity.

The focused regression suite requires the existing flow dependencies plus
`mongomock>=4.3`. Run `python -m unittest discover -s goodwatch-flows/tests -v`.
The complete suite passes 75 tests, with five optional Crate integration checks
skipped when no disposable Crate test instance is configured. The changed
Python scripts pass Pyright without errors against the production dependency
pins. Windmill locks retain Python 3.11 and existing package versions; `bson`
is supplied by PyMongo and must not be installed as a separate package.

Scheduled initialization uses batches of 500 titles: one indexed provider lookup
per batch and unordered bulk writes with fenced updates. A real-Mongo disposable
batch probe verified a changed title slug reuses the existing country, preserves
its successful links, inserts one new country, and inserts nothing on repetition.

Invalid country identities retain their source data and record a
`country_identity_error` that excludes them from scheduling. After an operator
repairs the identity, successful backfill normalization clears that exclusion.
This prevents invalid records from occupying every batch indefinitely.
