# Nightly season and episode translations

Owner authorization: 2026-10-15, including production enablement and a three-hour
budget per run. Entry point: `f/media_language/ingest_episode_translations`, with
`nightly: true`, `dry_run: false`, `max_seconds: 10800`.

Schedules are managed in Windmill, following the existing sitemap and other
schedules. `wmill.yaml` and `push-windmill-workspace.yml` intentionally exclude
schedules; do not add `--include-schedules`. Scripts and their locks deploy through
the existing GitHub action after a fast-forward push to main. Create the new
schedule through Windmill only after the supervised run passes.

Daily window: **00:00–03:00 UTC**, cron `0 0 0 * * *`, timezone `UTC`.
Production schedule inspection on 2026-10-15 found `populate_crate` at 19:00
Europe/Berlin (17:00 UTC in summer, 18:00 in winter), and `build_indexes` at 06:15
Europe/Berlin (04:15 UTC in summer, 05:15 in winter). The new window avoids both.
The existing schedules are unchanged.

## Selection and durable progress

1. New canonical episode rows, using the `episode` copy's `created_at`, and new
   canonical season documents in `tmdb_tv_season_details`. Fetch only the affected
   season/episode translation endpoints, validating their stable TMDB IDs.
2. The 47 capped shows from the approved manual backfill's `remaining-work.json`,
   in its saved order. Conan starts at the last acknowledged page, season 7,
   episode 132. Other capped titles reconstruct their original successful counts
   against actual valid episode numbers, preserving gaps in numbering.
3. Shows with no rows in either translation table, ordered by descending
   popularity and then TMDB ID. Empty successful translation responses are
   remembered, so a title with no available text cannot hold up the queue.

State and per-run summaries use the existing Mongo
`tmdb_episode_catalog_state` collection, with majority writes. The state document
is `episode_translations_nightly_v1`; run records append `:run:<UUID>`. There are
no schema changes. A four-hour lease prevents manual and scheduled runs from
overlapping. A killed worker leaves its last acknowledged page cursor intact;
the lease expires before the following nightly run. Do not remove or reset this
document to restart a run: rerun the entry point normally.

The canonical scan saves its closed upper watermark together with the pending
work before ingestion. Its 15-minute overlap tolerates publication visibility
delay; repeated work uses the same preserve-existing SQL. Pending changed work
is exhausted before the backlog, and the upper watermark advances only once its
queue is complete. The initial watermark is the manual backfill's finish time,
2026-10-15T19:20:10.681202Z.

## Writes and stops

TMDB calls are serial with at least 205 ms between request starts, including
page and title boundaries. Pages contain at most 40 episodes or 100 requests.
Fetch and validate a page first, then publish those exact cached responses with
unconditional `preserve_existing=True`. Only `season_translation` and
`episode_translation` receive Crate writes. A SQL allowlist rejects other tables
and any write without the preserve-existing CASE expression. Non-empty names and
overviews remain unchanged; missing fields can be filled.

The cursor advances only after every write in the page succeeds. A failure or
timeout replays the current page on the next run. Stop conditions are:

- The wall-clock deadline, reserving time for HTTP calls and final checkpoints.
- More than 5% failed TMDB requests. An isolated failure below that ratio also
  stops the current run with `endpoint_failed`, preserving the retry cursor.
- Two consecutive Crate timeouts. Successful Crate responses reset the counter.
  A timed-out write is never retried in the same run: one read-only health probe
  distinguishes a second timeout, then the runner stops with the page unacknowledged.
- Malformed/identity-mismatched payloads, failed bulk results, lost state lease,
  or discovery limits that could otherwise silently truncate work.

Summaries report actual TMDB requests, failed requests, new translation keys
acknowledged by Crate, completed shows/pages, and the stop reason. New-key counts
compare writes with the show's initial key snapshot, deduplicating repeated
pages. An uncertain write or partial bulk failure explicitly flags counts as a
lower bound. Crate search visibility can lag; supervised proof reconciles counts
with later reads and checks every pre-existing non-empty field of touched shows.

## Verification and operating capacity

`tests/test_episode_translation_nightly.py` covers order, popularity exclusions,
wall-clock stops, failure ratios, consecutive timeout/reset behavior, uncertain
writes, SQL restrictions, page validation, durable cursors, seed import, lease
exclusion, canonical additions, numbering gaps, and actual preserve-existing SQL
execution against a small in-memory database. The existing media-language tests
continue covering the underlying ingestion helper.

The saved backfill estimate has 198,028 requests left in the capped cohort and
429,344 in the initial 800-show cohort. At five requests/second a three-hour night
has a theoretical maximum of 54,000 requests: at least four nights for the capped
cohort and twelve for both cohorts together. HTTP/database overhead, page replay,
new canonical additions, and safety stops increase that; use the supervised
run's observed throughput for an operational estimate. The wider untranslated
catalog is open-ended and is not included in that 847-show estimate.
