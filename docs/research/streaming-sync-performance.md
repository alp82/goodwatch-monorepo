# Streaming sync performance

Research date: 2026-09-26. The scheduled `f/sync/copy/tmdb_streaming` run went from about 40 minutes to a projected 200 hours. This note records the measurements, the benchmarks and the fix: commits 8cd25ffe and 1a169d5a.

## Finding

The run did not get slower per query. It got about 50 times more titles and spent most of its time waiting on synchronous fetch jobs.

1. **Candidate volume.** Commit 5f629442 (2026-09-25 09:02 UTC) made the TMDB details queue refresh stale titles. From that hour on, `tmdb_movie_details.updated_at` and `watch_providers_attempted_at` advance for about 8,500 movies and 2,200 shows an hour, where they had advanced for a few hundred. Every refreshed title is a streaming candidate. A fixed 48-hour window read by a run every 6 hours then held 274,000 movies and 106,000 shows (measured 2026-09-26 21:00 UTC), and published each change eight times.
2. **Synchronous mapping refreshes.** A title whose scraped provider name has no catalog mapping ran `f/tmdb_web/tmdb_crawl_providers/fetch` once per unmapped country and waited for it. Each call took about 2.4 s (1.6 s of execution plus queueing). The refreshed stale titles are older, popular titles with legacy scrapes: 24% of a sample needed at least one refresh, and one title needed 122. Runs before 2026-09-25 made about 300 refreshes. Run `01a0dd3a` made 12,912 in 9.3 hours, about 8.6 of those hours.
3. **Per-title round trips.** Even without refreshes, each title took about 20 Mongo and Crate round trips: a lease upsert and delete, six ownership checks, two `REFRESH TABLE` calls, two selects, one upsert each for evidence, availability and the aggregate, and one `DELETE` per removed row (8.5 per title in a sample). That capped publication at 3.4 titles per second.

Commit b897cafc did not change which titles a run selects. It did not add an N+1 query either: the per-title loop was already there. It removed the per-page selection aggregates, whose timeouts had been failing the runs, so the run now reached the per-title loop with the new volume.

The Mongo host was not the bottleneck: 2.8% iowait, 6 GB page cache, and each per-title find returned in 2–3 ms. Crate stayed green (75 shards) throughout the benchmarks.

## Job history

| Run start (UTC) | Duration | Result | Titles published (movies + shows) | Mapping refreshes |
| --- | ---: | --- | ---: | ---: |
| 2026-09-22 18:00 | 143 min | success | 6,144 + 5,265 | 290 |
| 2026-09-23 06:00 | 121 min | success | 5,626 + 4,276 | 295 |
| 2026-09-24 06:00 | 40 min | success | 2,532 + 1,701 | 297 |
| 2026-09-25 00:00 | 38 min | success | 2,278 + 1,737 | 299 |
| 2026-09-25 06:00 | 35 min | success | 2,138 + 1,712 | 299 |
| 2026-09-25 21:32 (two restarted runs) | 153 min | failed (Mongo `NetworkTimeout`) | – | 13,536 and 7,216 |
| 2026-09-26 06:00 | 85 min | failed | – | 1,262 |
| 2026-09-26 12:00 (`01a0dd3a`, b897cafc) | 9.3 h, then restarted from scratch at 21:32 | cancelled 21:50 | about 17,300 movies at 0.52 titles/s | 12,912 |

"Titles published" counts titles with a confirmed source. Candidates without one are read but not written.

## Benchmarks

Preview jobs read production Mongo and wrote to scratch Crate tables (`bench_sa`, `bench_se`, `bench_movie`), created from `SHOW CREATE TABLE` and seeded with each sample's published rows. Leases were held in memory, and each lease call made one real Mongo round trip. The samples were 600 movie candidates above tmdb_id 70,000 and 100–150 of them for the per-title runs. Refreshes were not run. Their cost comes from production job timings.

| Variant | Titles/s | Crate calls per 100 titles | Notes |
| --- | ---: | ---: | --- |
| Production run `01a0dd3a` (per title, synchronous refreshes) | 0.52 | ~1,200 | measured from the lease position and refresh job count |
| Per title, refreshes deferred | 3.2–3.4 | 1,083 | same code path, `RefreshBudget(0)` |
| Reads only, per title | 11–23 | 400 | Mongo finds plus two `REFRESH`/`SELECT` pairs, no writes |
| Reads only, one read per source per batch | 118–2,040 | 4 | shows the round-trip cost alone |
| Batched, 50 titles | 21.4 | 16 | before the CPU fixes |
| Batched, 200 titles | 23.7 | 4 | before the CPU fixes |
| Batched, 500 titles | 24.2 | 3 | before the CPU fixes |
| **Batched, 200 titles, CPU fixes** | **34.2** | 4 | first publish: 36,968 rows changed |
| Batched, 200 titles, CPU fixes, replay | 39.1 | 4 | nothing changed; 0 availability rows written |

The per-title and batched runs over the same 150 titles left identical scratch tables: availability, evidence payloads and aggregates.

Batch size hardly matters above 50. Once Crate calls are batched, Python dominates. A profile of 300 titles showed 58 ms per title in `reconcile_availability` and `build_evidence`. Every clickout URL was decoded twice, and `build_evidence` scanned all of a title's rows and the whole 872-entry provider catalog once per country. After caching `provider_name_from_url` and grouping rows by country, the profile showed 24 ms per title.

Selection is cheap in every variant. With the (field, tmdb_id) indexes from b897cafc, the 48-hour movie selection takes 2.4–3.1 s and a 7-hour window takes 0.6 s.

Hypotheses ruled out:

- **Mongo projection and 34 KB documents.** Batched details and provider reads for 200 titles take 0.1–0.3 s.
- **`_id` range scans instead of `$in`.** Candidates are sparse sorted tmdb_ids, and `$in` over the `tmdb_id` index already costs about 1 ms per title.
- **Skipping unchanged titles with a content hash.** Every details refresh moves `watch_providers_attempted_at`, which the evidence envelope records as `last_attempt_at`. That freshness is what marks availability as known rather than unknown, so the evidence must be written anyway. Reconciliation is idempotent: a replay changes no availability rows. The watermark removes the repeated work instead.
- **Parallel workers.** Not needed at 34 titles/s. Concurrent runs would also contend for the same leases.

## Fix

Commit 8cd25ffe, `perf(flows): publish scheduled streaming titles in batches since the last run`:

- **Watermark.** A scheduled whole-catalog run reads source changes since one hour before the last completed run started. The watermark is in `sync_watermarks`, `_id` `tmdb_streaming:movie` or `tmdb_streaming:show`, advanced with `$max`. Without one, the run falls back to 48 hours. A failed run leaves the watermark alone, so the next run catches up. Targeted and ObjectId-selector runs are unchanged.
- **Batched publication.** Scheduled titles are published 200 at a time: one lease per title taken under a shared token, one ownership check per write phase, one read per source, and one bulk write per table. Writes keep the per-title order: evidence, then availability additions, then removals, then aggregates. A title another publisher holds falls back to the per-title path, which waits up to 120 s. Quarantined titles keep their own path. Deletes go through `CrateConnector.run_many`, one bulk request.
- **Refresh budget.** A scheduled run makes at most 100 synchronous mapping refreshes per media type. Later unmapped countries are deferred, which is the documented outcome of a failed refresh: the country keeps its published contribution. Targeted publication still refreshes every unmapped country.

Commit 1a169d5a, `perf(flows): decode each clickout URL once and group evidence rows by country`: the CPU fixes above.

No new Mongo index was needed. Selection uses the existing indexes, and the watermark is an `_id` lookup.

## Expected run times

| Situation | Titles per run | Time |
| --- | ---: | ---: |
| Before (2026-09-24/25) | about 10,000 read, 4,000 published | 35–40 min |
| b897cafc with the stale-title volume | about 380,000 | about 200 h projected |
| First run of the fix (no watermark: 48 h) | about 380,000 | about 3 h at 34 titles/s, plus at most 8 min of refreshes |
| While the details queue works through stale titles (about 11,000 changes/h) | about 80,000 per 6 h + 1 h overlap | about 40 min |
| Steady state (1.3M titles each refreshed about every 30 days: about 1,800/h) | about 13,000 | about 6–10 min |

## Remaining risks

- A killed run leaves its batch's leases until they expire (15 minutes). A scheduled run that reaches a still-held title waits 120 s and then fails, as the per-title path always did. Start a replacement run at least 15 minutes after a cancellation.
- `no_flow_overlap` on the schedule does not cover manually started runs. A manual run and a scheduled run can overlap. That is safe, since batch leases are held for seconds, but it duplicates the work.
- Unmapped provider names beyond the refresh budget stay deferred until the regular provider crawl re-scrapes them or the catalog learns the name. The most common in the samples were `Classix`, `JustWatchTV`, `Freevee`, `Netflix basic with Ads`, `Vudu` and several `… Apple TV Channel` / `… Amazon Channel` names, some with a trailing space. That is a provider-catalog gap, separate from this fix.
