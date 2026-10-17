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
timeout leaves the current page unacknowledged. After a Crate timeout, the runner
probes `SELECT 1` with waits of 30, 60, and 120 seconds, with one final wait clipped
to the remaining recovery window. Probe HTTP time is included in the **300-second
recovery window**. The initial failed call is outside that window. At most four
probes are attempted, each retaining the 2-second connect/35-second read timeout.
Every wait and call also consumes the run's wall-clock budget; a recovery that
cannot fit another probe stops with `budget` and preserves checkpoint time.

When Crate answers, reads retry their original query. Publication replays the
**whole validated page from cached responses**, without refetching TMDB. This is
safe even when a timed-out batch committed: preserve-existing upserts neither
create duplicate keys nor replace populated text. Each timeout halves the bulk
batch limit from 500, down to a floor of 25, for the rest of that run. The cursor
advances only when the replay is fully acknowledged. Stop conditions are:

- The wall-clock deadline, reserving time for HTTP calls and final checkpoints.
- More than 5% failed TMDB requests. An isolated failure below that ratio also
  stops the current run with `endpoint_failed`, preserving the retry cursor.
- `crate_recovery_window_exhausted` when no health probe recovers within the
  bounded window. This replaces `two_consecutive_crate_timeouts`.
- `crate_recovered_stall_limit` on the **sixth recovered stall** in a run, including
  read stalls. Successful queries do not reset this run-wide counter; the sixth
  recovery stops before replaying the unacknowledged operation. A fresh night
  starts a fresh counter.
- Malformed/identity-mismatched payloads, failed bulk results, lost state lease,
  or discovery limits that could otherwise silently truncate work.

Summaries report actual TMDB requests, failed requests, new translation keys
acknowledged by Crate, completed shows/pages, recovered Crate stalls, and the stop
reason. `recovered_crate_stalls` is saved in active and final run summaries.
New-key counts compare writes with the show's initial key snapshot, deduplicating repeated
pages. An uncertain write or partial bulk failure explicitly flags counts as a
lower bound, including a budget stop during write recovery. A fully acknowledged
replay clears that uncertainty and counts each new key once. Crate search
visibility can lag; supervised proof reconciles counts with later reads and checks every pre-existing non-empty field of touched shows.

## Verification and operating capacity

`tests/test_episode_translation_nightly.py` covers order, popularity exclusions,
wall-clock stops, failure ratios, bounded timeout recovery, cached idempotent
page replay (both changed targets and backlog), adaptive batch sizes, recovery
window exhaustion, six-stall limits, recovery budget accounting, uncertain
writes, SQL restrictions, page validation, durable cursors, seed import, lease
exclusion, canonical additions, numbering gaps, and actual preserve-existing SQL
execution against a small in-memory database. The existing media-language tests
continue covering the underlying ingestion helper. Publisher-job detection is
intentionally omitted: an API check can race with a new publisher, and transient
Crate stalls need the same bounded recovery regardless of their source.

The saved backfill estimate has 198,028 requests left in the capped cohort and
429,344 in the initial 800-show cohort. At five requests/second a three-hour night
has a theoretical maximum of 54,000 requests: at least four nights for the capped
cohort and twelve for both cohorts together. HTTP/database overhead, page replay,
new canonical additions, and safety stops increase that; use the supervised
run's observed throughput for an operational estimate. The wider untranslated
catalog is open-ended and is not included in that 847-show estimate.

## Production proof, 2026-10-15

Implementation commit `7a2123fae9d646b5ec18f2e816817f20435ea0ae` reached main by
non-force fast-forward push. [Windmill workspace sync](https://github.com/alp82/goodwatch-monorepo/actions/runs/38808513011)
passed, and all four deployed script contents matched the committed files.

Windmill job `01a1416c-a14d-a375-560f-ddc316272fc3`, submitted through the synced
entry point with a 600-second budget, ran for 562.169 seconds (9 minutes 22 seconds)
and stopped cleanly with `budget`. It made 2,714 TMDB requests with zero failures,
completed 65 pages and two shows, and added 5,935 episode translation rows.
No season translation rows were added. Database counts reconciled exactly with
the run summary. Every one of 2,296 pre-existing non-empty fields across the three
touched shows remained identical, and no pre-existing translation row disappeared.

The majority-acknowledged state retained show 65733, season 1, episode 634 as the
next cursor. Its durable run summary matched the Windmill result, and its lease
was released. Progress was also read directly from Mongo during the run.

The schedule was then created and enabled in Windmill with the arguments above.
Windmill reported `enabled: true` and queued job
`01a14175-fa2f-d107-0f71-3633beacba59` for **2026-10-16T00:00:00Z**.
All 49 existing schedules retained their original definitions and enabled states.

The 21 nightly unit tests pass. The flows suite passes 1,419 tests with 64 skipped
after excluding two failures reproduced on untouched main: the known
deletion-coverage assertion and an additional existing backup-notification text
assertion. The isolated baseline reproduction ran 29 tests with those same two
failures and no errors. Neither unrelated implementation was changed.

Observed throughput was about 4.83 requests/second. Allowing 5% for smaller-page
overhead yields approximately **four more nights for the capped cohort** and
**13 nights for the full known cohort**, including the 800 untouched shows.
Plan for 13–15 nights at comparable throughput; canonical additions and safety
stops can extend that. Two of the original 47 capped shows are now complete.

Machine-readable proof is in
[`media-language-nightly-episodes-production.json`](media-language-nightly-episodes-production.json).
Full test logs, before/after field snapshots, deployment checks, the enabled
schedule, and its queued job are retained under
`/home/alper/projects/goodwatch-media-language-evidence/episode-translation-nightly/`.

## Stall recovery verification, 2026-10-17

The original two-timeout behavior is reproduced by the new committed-but-timed-out
write test: untouched code stops with `two_consecutive_crate_timeouts` rather than
replaying the page. The recovery implementation passes all 27 nightly tests,
including a simulated lost acknowledgement after a real SQLite upsert, successful
page replay without duplicate keys or overwritten text, durable cursor/lease
checks, exhausted recovery windows, the sixth-stall cap, and global budget usage.

The full flows suite ran 1,539 tests, with 75 skipped and only the known deletion
coverage failure. That failure reproduced in an untouched `origin/main` archive;
the backup-notification tests now pass there. With that one baseline assertion
excluded, the full suite passes: 1,538 tests, with 75 skipped. Logs and supervised-run
evidence are retained under
`/home/alper/projects/goodwatch-media-language-evidence/episode-translation-recovery/`.
