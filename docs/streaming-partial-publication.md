# Partial streaming publication

Streaming scraping and title publication have separate completion states. A title
can finish publication with countries still pending, because those country records
retain the independent retry state described in [country retries](streaming-country-retries.md).
The title priority cooldown does not change country eligibility.

Publication reconciles each country against its existing availability. TMDB API
results own the TMDB link and display priority; the web scrape owns the stream URL,
price, and quality. A confirmed result replaces only its source contribution. An
empty web response does not erase API availability, and pending or failed countries
do not erase their previously published contribution. Legacy rows without source
attribution are preserved when their ownership cannot be established safely.

Child availability and the title's streaming arrays are derived from the same
reconciled result. Both targeted and scheduled Qdrant publication read the latest
published Crate streaming arrays under the shared publication lease. Verified replacement explicitly clears obsolete nullable fields;
ordinary Crate upserts retain their existing null-preserving behavior. Publication
reports deferred countries separately from its successful writes. Qdrant failure or
any required Crate write failure prevents the normal priority acknowledgment step.
Acknowledgment still uses the claimed lease and demand watermark, preserving newer
impressions and rejecting stale ownership.

Scheduled and targeted streaming and vector publication share a short MongoDB lease per media
identity in `streaming_publication_leases`. Contention or loss of ownership fails
publication without acknowledging demand. Each writer reads source and child state
under the lease and checks ownership around writes. Vector writers read the latest
published Crate snapshot while holding these leases and finish synchronous writes
before releasing them. Unknown snapshots retain existing vector availability; an
unmapped scraped provider fails publication before availability is removed.
Crate does not provide an
atomic transaction across child records and aggregate fields: interrupted writes
remain recoverable by replay, and the title is acknowledged only after completion.

## Verification and recovery

Use `f/priority/crawl_all` for a normal targeted refresh. Its final result includes
publication evidence alongside the acknowledgment count. For a run that failed at
publication after source crawling finished, inspect its claim and root job status
before replaying publication. An active worker's claim must not be replaced. Run
`f/priority/publish` with the exact TMDB IDs, then acknowledge only after all required
writes succeeded. The existing reset script enforces current lease ownership; an
expired lease requires a fresh claim before replay.

A publication replay does not need another successful country scrape. To inspect
remaining work, use provider `updated_at`, `next_fetch_at`, `consecutive_failures`,
and the explicit deferred-country result. Never manufacture `updated_at` or clear
retry deadlines to make a title appear complete.

Rollback requires reverting the publication scripts and their metadata together.
There is no destructive schema migration. Reverting restores the old limitations
for pending countries, so pause targeted publication until a safe replacement is
available rather than acknowledging a known failed publication.
