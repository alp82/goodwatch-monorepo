# Letterboxd movie scores

`f/letterboxd/seed` maintains a movie queue in Mongo `letterboxd_movie_rating` from TMDB details. The first run
seeds the catalog; subsequent daily runs read changes since the last successful seed with a two-day overlap.
Initial/full scans checkpoint the source ID after each batch, so an interrupted scan resumes its remaining work.
An explicit `full=true` reconciles the whole catalog. Only movies with a valid effective IMDb ID are seeded.
The crawler never uses Letterboxd's TMDB shortcut, which can import absent movies into Letterboxd.

`f/letterboxd/crawl` uses a bulk Wikidata URL hint when available, otherwise follows the IMDb redirect for a new
movie, and saves the canonical movie URL for subsequent refreshes. Hints are never treated as verified identity.
A missing or mismatched mapped page falls back to the IMDb lookup, and the rejected hint is remembered.
The crawler verifies the page's exact external movie identity and extracts the published weighted score and
exact integer vote count from the movie's JSON-LD. Source LIDs come from `production:identifier` metadata,
falling back to an unambiguous `boxd.it` link. No reviews, member records, histogram fragments or browser automation
are collected. The [research](research/letterboxd-data-acquisition.md) describes the source's display guidance,
access restrictions and coverage limitations.

Each redirect hop uses a shared two-second request slot in `critic_site_state` for the `letterboxd` site and an
identifying GoodWatchBot User-Agent. The HTTP helper reuses the existing critic crawler's block detection,
deadlines and audit log. A 403, 429 or challenge stops the whole site; requests are never retried through a block.
Three consecutive unexpected/network errors pause the site for six hours. The crawl returns its block state
in its result; a successful Windmill job can therefore mean it stopped cleanly on a source block.

The queue runs in popularity order, claims one movie at a time for two hours, and uses a separate expiring
site-wide run lease to prevent overlapping workers. A crawl runs for at most 25 minutes. Refresh intervals:

| Outcome | Next attempt |
| --- | --- |
| Movie released in the last 180 days, or upcoming | 14 days |
| Older movie | 90 days |
| Missing page, rejected identity, missing catalog/IMDb identity | 90 days |
| Network, HTTP or parse error | 1 day, subject to the shared site block |

Transport and parse failures preserve the last good data. A verified page without a published rating clears
the rating; a 404/410 or rejected identity clears both the source URL and score. Values removed by negative
outcomes are backed up in `letterboxd_rating_history`. No match, unrated, temporarily blocked and failed parsing
are distinct statuses.

## Publication

`f/letterboxd/schema` adds only the seven Letterboxd columns on the Crate `movie` table; its default is a dry run.
The same columns are declared in the shared checked-in schema and `Movie` model:

- `letterboxd_url`, `letterboxd_id`;
- `letterboxd_user_score_original` (native 0.5–5), `letterboxd_user_score_normalized_percent` (score × 20);
- `letterboxd_user_score_rating_count` (`BIGINT`, an exact rating count);
- `letterboxd_ratings_created_at`, `letterboxd_ratings_updated_at`.

Every completed crawl batch publishes through `f/sync/copy/all_ratings`. Its existing scheduled catch-up also
selects Letterboxd-only changes, so an interrupted publication is recoverable. Removed values explicitly clear
their Crate columns. Show publication does not reference the movie-only columns. Letterboxd is stored as its
own source; this change does not alter the GoodWatch aggregate formula or add a webapp score chip.

## Schedules and operations

The checked-in schedules and the live `goodwatch` workspace use UTC:

| Schedule | Timing | Arguments |
| --- | --- | --- |
| `f/letterboxd/seed` | Daily at 02:40 | `full=false` |
| `f/letterboxd/crawl` | Every hour at :15 and :45 | `max_minutes=25`, `batch_size=25` |
| `f/letterboxd/backfill` | Every minute when the previous run has finished | `max_hours=24`, `batch_size=100` |
| `f/letterboxd/mappings` | Mondays at 03:00 | `dry_run=false` |

All schedules are enabled and set `no_flow_overlap=true`. For a bounded manual run, pass `tmdb_ids=[27205,603,129]`
and a short `max_minutes` to the crawler. It seeds those movies if needed, respects their due dates and the
site block, and publishes its results. The recurring seed checkpoint is unaffected by such a targeted run.

`f/letterboxd/backfill` runs consecutive bounded crawl segments for up to 24 hours. Its one-minute schedule
and `no_flow_overlap=true` start the next run after the active job finishes, minimizing handoff and recovery gaps.
It shares the same popularity queue, leases, request pacing and source block state;
ordinary retries and refreshes therefore continue during backfill. It waits if another crawler already owns the
lease. The backfill does not add concurrent Letterboxd request workers. Its default publish batch is 100 rather
than 25. Every HTTP request, including redirect hops, still takes one globally shared two-second slot.

`f/letterboxd/mappings` joins Wikidata's [TMDB movie IDs (P4947)](https://www.wikidata.org/wiki/Property:P4947)
and [Letterboxd slugs (P6127)](https://www.wikidata.org/wiki/Property:P6127) in one CSV export. It rejects malformed
exports, ambiguous/shared slugs, mismatched IMDb IDs and deleted movies. It attaches only `wikidata_url` hints
to existing uncrawled queue entries, preserving crawled URLs and scores. A candidate hint saves the IMDb
redirect when its page verifies successfully, reducing a new movie from two source requests to one.
New source hints are corroborated against the TMDB movie details before attachment; cached hints avoid repeat
reads of those larger documents. A dry-run preview is the default for manual mapping runs.

Inspect the job result's `blocked`, `error`, `ok`, `requests` and `published` fields; Mongo also holds
`critic_site_state`, `critic_site_blocks`, and each movie's `crawl_status`/`crawl_error`. Disable the Letterboxd
crawl and backfill schedules to stop recurring source requests; the seed/mapping jobs only maintain the queue
and hints, and the general ratings publisher can remain enabled.
Do not clear a source block to retry through a challenge.

The owner also requested reports every two hours in the existing Ghostex conversation. A Ghostex interval
automation runs the read-only `goodwatch-flows/scripts/letterboxd_status.py` helper and posts the current MongoDB
and CrateDB counts, changes since the previous report, and source block/publishing lag. The local baseline is
`~/.local/state/goodwatch/letterboxd-report-state.json`; it contains counts only. Delivery is attached to the
durable conversation and uses the local Ghostex host and its existing Windmill profile. This is separate from
the data collection schedules. Configuration evidence:
[reporting-automation-2026-11-01.json](implementation/letterboxd-scores/reporting-automation-2026-11-01.json).

Deployment and acceptance evidence: [2026-11-01 rollout](implementation/letterboxd-scores/rollout-2026-11-01.md).
Backfill optimization: [2026-11-01 acceleration](implementation/letterboxd-scores/backfill-2026-11-01.md).

Offline checks:

```sh
goodwatch-flows/.venv/bin/python -m unittest discover -s goodwatch-flows/tests -p 'test_letterboxd*.py'
goodwatch-flows/.venv/bin/python -m unittest discover -s goodwatch-flows/tests -p 'test_ratings_publication.py'
```
