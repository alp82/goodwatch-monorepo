# Q46 — next24h maintenance-window comparison

Read-only planning. No production setting, cron, schedule, job, deployment or process was changed
or started. Fresh primary data:56 Windmill schedules/53 enabled,809 completed root jobs (up to20
non-skipped attempts per schedule), a sanitized live queue, and aggregate GoodWatch PostHog counts.
[Raw/derived evidence and analysis](q46-window-evidence.json.gz).

## Recommendation

| Choice | Window UTC | Gates UTC | Last SIGTERM UTC | CET |
| --- | --- | --- | --- | --- |
| **Best practical** | **2026-10-26 21:30–23:00** | **21:20–21:30** | **22:00** | 22:30–00:00 |
| Distinct runner-up | 2026-10-27 11:30–13:00 | 11:20–11:30 | 12:00 | 12:30–14:00 |

The best follows the21:00 TMDB daily copy's observed maximum1615.944s, finishing about21:26:56.
It avoids the14:00 provider-list reader's5–6⅓hour span,23:00 provider initialization (~2h),
00:00 language ingestion (observed up to3h), and the03:00–04:30 bulk cluster. It is not idle:
Bluesky discovery21:40/22:40, RSS22:20, DNA copy22:00 and title embedding22:45 still occur,
plus continuous crawls and monitoring. Embedding P90=15m15s/max=16m17s can extend to~23:01.
Provider initialization starts23:00 exactly at the hard-stop boundary; no silent extension.

Runner-up has about2.6%more P90 root-wall-time overlap. It includes the11:00
provider-detector run carrying to~12:00, vector copy12:30, deletion sync12:50 and recurring crawls.
The provider-detector forecast has only one completed sample and is especially uncertain.

**There is no truly heavy-job-free90min under unchanged schedules.** Hourly Bluesky discovery alone
has P90~47min; crawlers trigger every15–20s. Moving reduces added batch overlap but does not itself
clear Q43's strict no-heavy-job gate. Owner must explicitly accept the listed recurring/late-window
work or authorize separate coordination, or defer. No pause/cancellation is implied or executed.

## Ranking method and uncertainty

Data horizon: **2026-10-26T13:39:05.010914+00:00 to2026-10-27T13:39:05.010914+00:00**.
Evaluated266 complete90min windows on a5min UTC grid, with≥20min notice from the
data snapshot. A runner-up must not overlap the best; a five-minute shift in the same gap is not
a distinct alternative. Cron is seconds-first, including seven-field year forms, in its own timezone.

Project each occurrence using median,nearest-rankP90 and observed-max completed root durations.
Include preceding jobs out to their maximum duration (at least3h lookback). Sum only the intersection
of each [start,start+duration) with the90min window. This is an orchestration-overlap proxy, **not CPU,
Crate query time or utilization**. Parent/child work, concurrency/skips, external waits and ad-hoc jobs
can change actual load. Success/failure/cancelled attempts are included as returned, not only fast
successes. Disabled schedules are listed but not projected. All53 enabled schedules had≥1 sample.

Raw minimum21:25–22:55. Practical21:30–23:00 is only0.53%higher and avoids starting during
the21:00 copy tail. Raw distinct runner-up11:25–12:55 was rounded to11:30–13:00. End-boundary jobs have
zero mathematical overlap but remain operational risks below. Nearby differences are smaller than
runtime uncertainty. Against03:00,21:30 is about9.9%lower on the P90 proxy.
Samples span minutes for frequent jobs and roughly14days for daily jobs; they are not forecasts.
A current queue snapshot cannot rule out future carry-over; recheck roots and descendants at gates.

| Window | Median root-minutes | P90 root-minutes | Max scenario root-minutes | Mean captured pageviews/90min |
| --- | ---: | ---: | ---: | ---: |
| Raw21:25 | 693.7 | 1152.6 | 1309.7 | 45.8 |
| Practical21:30 | 700.4 | 1158.7 | 1314.6 | 45.4 |
| Runner11:30 | 731.7 | 1188.2 | 1351.2 | 35.2 |
| Old03:00 | 826.0 | 1286.3 | 1440.9 | 34.4 |

## Backups and deployments

Crate backup cron is5 * * * * UTC. It is held exactly during maintenance, so excluded from the
avoidable Windmill score. Best window requires21:05 SUCCESS/none IN_PROGRESS, normally skips22:05,
then next23:05 after restoration (or22:05 if work finished and cron restored earlier).
Runner-up:latest11:05,normally skips12:05,next13:05 after restoration. An in-progress backup delays
the node stop. Q44 rescue remains target-only for an actually stalled running backup; no proactive
cancel, DROP or manual snapshot is part of this research.

Owner reports no planned Coolify deploys. Current read-only deployment queue evidence is archived;
it does not predict main pushes or deployment state at the window. Runtime checks remain mandatory.
No deployment freeze or production schedule change was applied.

## Typical captured website traffic by UTC hour

GoodWatch PostHog project24375; verified standard$pageview and hostname goodwatch.app. Seven complete
UTC days October19–25, explicit UTC conversion (project timezone Europe/Berlin).167 non-empty
day/hour buckets; missing buckets zero-filled to168. Only aggregate counts: no identities/raw events.
No governed definition matched; this is a noncanonical one-off operational estimate.
[Aggregate source/query](q46-traffic-aggregates.json), [project](https://eu.posthog.com/project/24375),
[query documentation](https://posthog.com/docs/api/query).

Client-observed pageviews are not all HTTP requests, active users or bot-filtered human traffic.
Non-JS/bot/blocked telemetry can be absent. Means/medians diverge at07–08UTC; use traffic only as
a secondary signal. Best90min:~45 mean or~28 median-hour counts; runner:~35 mean or~37.5 median.
Lower traffic alone does not outweigh known Windmill conflicts.

| UTC hour | Seven-day pageviews | Mean/day | Median/day |
| ---: | ---: | ---: | ---: |
| 00:00 | 135 | 19.3 | 15 |
| 01:00 | 137 | 19.6 | 13 |
| 02:00 | 165 | 23.6 | 17 |
| 03:00 | 173 | 24.7 | 13 |
| 04:00 | 135 | 19.3 | 10 |
| 05:00 | 108 | 15.4 | 15 |
| 06:00 | 190 | 27.1 | 24 |
| 07:00 | 579 | 82.7 | 22 |
| 08:00 | 1214 | 173.4 | 14 |
| 09:00 | 123 | 17.6 | 13 |
| 10:00 | 124 | 17.7 | 19 |
| 11:00 | 167 | 23.9 | 25 |
| 12:00 | 163 | 23.3 | 25 |
| 13:00 | 123 | 17.6 | 16 |
| 14:00 | 209 | 29.9 | 21 |
| 15:00 | 337 | 48.1 | 40 |
| 16:00 | 161 | 23.0 | 20 |
| 17:00 | 156 | 22.3 | 19 |
| 18:00 | 229 | 32.7 | 17 |
| 19:00 | 201 | 28.7 | 31 |
| 20:00 | 161 | 23.0 | 17 |
| 21:00 | 234 | 33.4 | 28 |
| 22:00 | 201 | 28.7 | 14 |
| 23:00 | 200 | 28.6 | 12 |

## Every Windmill schedule, exact cron and timezone

Cron begins with seconds; seven-field forms also include year. Disabled schedules stay listed for
completeness. The evidence retains the target script/flow separately from the schedule path (for
example personal_order_dirty targets personal_order_trigger; social schedules share discover).

| Schedule path | Enabled | Cron verbatim | Timezone |
| --- | --- | --- | --- |
| f/tmdb_api/provider_detector | Yes | `0 0 0-11 * * *` | UTC |
| f/buzz/signals | Yes | `0 30 8 * * *` | UTC |
| f/tmdb_api/read_daily_provider_lists | Yes | `0 0 14 * * *` | UTC |
| f/tmdb_api/recheck_recent_releases | Yes | `0 0 13 * * *` | UTC |
| f/monitoring/failing_schedules | Yes | `0 */10 * * * *` | Europe/Berlin |
| f/anime_mapping/weekly | Yes | `0 20 3 * * MON` | UTC |
| f/media_language/ingest_episode_translations | Yes | `0 0 0 * * *` | UTC |
| f/sync/copy/personal_order_dirty | Yes | `0 */3 * * * *` | UTC |
| f/seo/regenerate_sitemaps | Yes | `0 0 3 * * 6` | UTC |
| f/social/deletion_sync | Yes | `0 50 */6 * * *` | UTC |
| f/social/discover_mastodon | Yes | `0 10 3 * * *` | UTC |
| f/social/discover_bluesky | Yes | `0 40 * * * *` | UTC |
| f/social/discover_rss | Yes | `0 20 * * * *` | UTC |
| f/social/discover_youtube | Yes | `0 0 * * * *` | UTC |
| f/buzz/daily | Yes | `0 30 2-23 * * *` | UTC |
| f/tmdb_api/tmdb_fetch_details_from_api/awaited | Yes | `0 0 * * * *` | Europe/Berlin |
| f/sync/tracking/fill_seen_groups | Yes | `0 10 7 * * *` | Europe/Berlin |
| f/tmdb_api/tmdb_fetch_episodes_from_api/changes | Yes | `0 20 6 * * *` | Europe/Berlin |
| f/sync/copy/tmdb_episodes | Yes | `40 2/5 * * * *` | Europe/Berlin |
| f/tmdb_api/tmdb_fetch_episodes_from_api | Yes | `25 * * * * *` | Europe/Berlin |
| f/monitoring/backup_check | Yes | `0 40 * * * *` | Europe/Berlin |
| f/sync/copy/title_snapshot | Yes | `0 45 4 * * *` | Europe/Berlin |
| f/critic_sites/directory_metacritic | Yes | `0 15 5 * * SUN` | Europe/Berlin |
| f/critic_sites/directory_rotten_tomatoes | Yes | `0 0 5 * * SUN` | Europe/Berlin |
| f/critic_sites/crawl_metacritic | Yes | `0 10/30 * * * *` | Europe/Berlin |
| f/critic_sites/crawl_rotten_tomatoes | Yes | `0 5/30 * * * *` | Europe/Berlin |
| f/external_ids/wikidata_backfill | Yes | `0 30 3 * * SUN` | Europe/Berlin |
| f/imdb_datasets/ingest | Yes | `0 0 4 * * *` | Europe/Berlin |
| f/sync/copy/orphaned_titles | Yes | `0 0 11 * * SUN` | Europe/Berlin |
| f/search/build_indexes | Yes | `0 15 6 * * *` | Europe/Berlin |
| f/search/embed_titles | Yes | `0 45 5/6 * * *` | Europe/Berlin |
| f/monitoring/check | Yes | `0 */5 * * * *` | Europe/Berlin |
| f/sync/copy/vector_data | Yes | `0 30 1/4 * * *` | Europe/Berlin |
| f/sync/copy/tvtropes | Yes | `0 0 3/6 * * *` | Europe/Berlin |
| f/sync/copy/all_ratings | Yes | `0 0 1/6 * * *` | Europe/Berlin |
| f/sync/copy/dna_data | Yes | `0 0 5/6 * * *` | Europe/Berlin |
| f/sync/copy/tmdb_streaming | Yes | `0 0 2/6 * * *` | Europe/Berlin |
| f/sync/copy/tmdb_details | Yes | `0 0 4/12 * * *` | Europe/Berlin |
| f/sync/copy/tmdb_daily | Yes | `0 0 10/12 * * *` | Europe/Berlin |
| f/sync/populate_crate | Yes | `0 0 19 * * *` | Europe/Berlin |
| f/dna/generate_dna | Yes | `0 5 */3 * * *` | Europe/Berlin |
| f/dna/initialize_dna | Yes | `0 0 3 * * *` | Europe/Berlin |
| f/tmdb_web/tmdb_init_providers | Yes | `0 0 0 * * * *` | Europe/Berlin |
| f/priority/crawl_all | Yes | `*/20 * * * * *` | Europe/Berlin |
| f/tmdb_web/tmdb_crawl_providers | Yes | `18/20 * * * * *` | Europe/Berlin |
| f/tvtropes_web/tvtropes_crawl_tags | No | `16 * * * * *` | Europe/Berlin |
| f/imdb_web/imdb_crawl_ratings | No | `12/20 * * * * *` | Europe/Berlin |
| f/tmdb_api/tmdb_fetch_details_from_api | Yes | `10/15 * * * * *` | Europe/Berlin |
| f/utils/visit_goodwatch_schedule | Yes | `0 0 0/12 * * *` | Europe/Berlin |
| f/tvtropes_web/tvtropes_init_ratings | Yes | `0 0 2 * * *` | Europe/Berlin |
| f/rotten_web/rotten_tomatoes_init_ratings | Yes | `0 0 5 * * *` | Europe/Berlin |
| f/metacritic_web/metacritic_init_ratings | Yes | `0 0 8 * * *` | Europe/Berlin |
| f/imdb_web/imdb_init_ratings | No | `0 0 11 * * *` | Europe/Berlin |
| f/tmdb_daily/tmdb_extract_daily_dump_data | Yes | `0 5/30 * * * *` | Europe/Berlin |
| f/tmdb_api/tmdb_init_details | Yes | `0 30 9 * * *` | Europe/Berlin |
| f/tmdb_daily/tmdb_check_daily_dump_availability | Yes | `0 */30 * * * *` | Europe/Berlin |

## Recent long/bulk-job durations

Seconds, up to20 completed non-skipped root runs. Included if max≥300s or a path identifies
ingest/sync/crawl/copy work. Per-run metadata is in the archive. A fast no-work path can yield a short
median without bounding a full sync. Child elapsed is not added again to root elapsed.

| Schedule | N | Median s | P90 s | Max s | Successful samples |
| --- | ---: | ---: | ---: | ---: | ---: |
| f/tmdb_api/provider_detector | 1 | 3602.5 | 3602.5 | 3602.5 | 1 |
| f/tmdb_api/read_daily_provider_lists | 8 | 17237.5 | 22830.1 | 22830.1 | 3 |
| f/tmdb_api/recheck_recent_releases | 10 | 1457.5 | 1491.6 | 1767.1 | 10 |
| f/media_language/ingest_episode_translations | 11 | 4.0 | 10762.8 | 10767.1 | 11 |
| f/sync/copy/personal_order_dirty | 20 | 0.4 | 0.5 | 0.6 | 20 |
| f/seo/regenerate_sitemaps | 2 | 2384.5 | 2425.3 | 2425.3 | 1 |
| f/social/deletion_sync | 20 | 1189.0 | 1474.3 | 1477.9 | 20 |
| f/social/discover_mastodon | 11 | 257.4 | 337.5 | 341.3 | 11 |
| f/social/discover_bluesky | 20 | 2636.4 | 2830.0 | 2880.0 | 20 |
| f/social/discover_rss | 20 | 278.2 | 308.0 | 310.8 | 20 |
| f/buzz/daily | 20 | 1.5 | 181.5 | 364.1 | 20 |
| f/sync/tracking/fill_seen_groups | 14 | 1.1 | 1.4 | 1.5 | 14 |
| f/sync/copy/tmdb_episodes | 20 | 2.0 | 2.2 | 2.2 | 20 |
| f/sync/copy/title_snapshot | 14 | 57.2 | 64.0 | 64.3 | 14 |
| f/critic_sites/crawl_metacritic | 20 | 12.9 | 33.5 | 207.9 | 20 |
| f/critic_sites/crawl_rotten_tomatoes | 20 | 15.3 | 91.0 | 807.6 | 20 |
| f/external_ids/wikidata_backfill | 2 | 460.7 | 463.8 | 463.8 | 2 |
| f/imdb_datasets/ingest | 14 | 127.0 | 151.8 | 163.8 | 14 |
| f/sync/copy/orphaned_titles | 2 | 77.9 | 78.0 | 78.0 | 2 |
| f/search/build_indexes | 14 | 618.1 | 662.3 | 694.6 | 14 |
| f/search/embed_titles | 20 | 700.4 | 915.0 | 976.7 | 20 |
| f/sync/copy/vector_data | 20 | 215.6 | 308.5 | 696.9 | 20 |
| f/sync/copy/tvtropes | 20 | 1.7 | 2.3 | 2.5 | 20 |
| f/sync/copy/all_ratings | 20 | 40.0 | 48.5 | 81.1 | 20 |
| f/sync/copy/dna_data | 20 | 80.6 | 86.6 | 88.2 | 20 |
| f/sync/copy/tmdb_streaming | 20 | 949.7 | 1370.7 | 1983.1 | 15 |
| f/sync/copy/tmdb_details | 20 | 411.6 | 553.0 | 562.2 | 20 |
| f/sync/copy/tmdb_daily | 20 | 1356.5 | 1597.1 | 1615.9 | 20 |
| f/sync/populate_crate | 14 | 6.5 | 8.3 | 9.9 | 14 |
| f/dna/generate_dna | 20 | 450.0 | 528.0 | 532.4 | 20 |
| f/dna/initialize_dna | 14 | 1415.2 | 1456.0 | 1504.4 | 14 |
| f/tmdb_web/tmdb_init_providers | 14 | 7187.3 | 7553.2 | 7740.3 | 14 |
| f/priority/crawl_all | 20 | 85.7 | 167.2 | 174.8 | 20 |
| f/tmdb_web/tmdb_crawl_providers | 20 | 22.0 | 35.5 | 40.2 | 20 |
| f/tvtropes_web/tvtropes_init_ratings | 14 | 1692.3 | 1715.1 | 1722.0 | 14 |
| f/rotten_web/rotten_tomatoes_init_ratings | 14 | 1513.9 | 1543.8 | 1562.4 | 14 |
| f/metacritic_web/metacritic_init_ratings | 14 | 1509.8 | 1593.1 | 1597.0 | 14 |
| f/tmdb_daily/tmdb_extract_daily_dump_data | 20 | 1.5 | 1.7 | 863.7 | 20 |
| f/tmdb_api/tmdb_init_details | 14 | 7528.7 | 7724.2 | 7728.5 | 14 |

## Remaining P90 overlap in selected windows

Carry-in can have zero starts but positive overlap. Every schedule with positive P90 overlap is listed to avoid
claiming an idle gap. Max-only carry-over remains in the archive. Late-window and hard-stop boundary starts still need operational review.

| Window | Schedule | Starts inside window | P90 overlap minutes |
| --- | --- | ---: | ---: |
| Best21:30 | f/priority/crawl_all | 270 | 752.29 |
| Best21:30 | f/tmdb_web/tmdb_crawl_providers | 270 | 159.80 |
| Best21:30 | f/monitoring/check | 18 | 73.93 |
| Best21:30 | f/social/discover_bluesky | 2 | 67.17 |
| Best21:30 | f/tmdb_api/tmdb_fetch_details_from_api | 360 | 40.99 |
| Best21:30 | f/search/embed_titles | 1 | 15.00 |
| Best21:30 | f/monitoring/failing_schedules | 9 | 12.89 |
| Best21:30 | f/monitoring/backup_check | 2 | 8.31 |
| Best21:30 | f/buzz/daily | 2 | 6.05 |
| Best21:30 | f/social/discover_rss | 1 | 5.13 |
| Best21:30 | f/tmdb_api/tmdb_fetch_episodes_from_api | 90 | 5.06 |
| Best21:30 | f/critic_sites/crawl_rotten_tomatoes | 3 | 4.55 |
| Best21:30 | f/social/discover_youtube | 1 | 3.22 |
| Best21:30 | f/critic_sites/crawl_metacritic | 3 | 1.67 |
| Best21:30 | f/sync/copy/dna_data | 1 | 1.44 |
| Best21:30 | f/sync/copy/tmdb_episodes | 18 | 0.65 |
| Best21:30 | f/sync/copy/personal_order_dirty | 30 | 0.27 |
| Best21:30 | f/tmdb_daily/tmdb_check_daily_dump_availability | 3 | 0.12 |
| Best21:30 | f/tmdb_daily/tmdb_extract_daily_dump_data | 3 | 0.09 |
| Best21:30 | f/tmdb_api/tmdb_fetch_details_from_api/awaited | 1 | 0.04 |
| Runner11:30 | f/priority/crawl_all | 270 | 752.29 |
| Runner11:30 | f/tmdb_web/tmdb_crawl_providers | 270 | 159.80 |
| Runner11:30 | f/monitoring/check | 18 | 73.93 |
| Runner11:30 | f/social/discover_bluesky | 2 | 67.17 |
| Runner11:30 | f/tmdb_api/tmdb_fetch_details_from_api | 360 | 40.99 |
| Runner11:30 | f/tmdb_api/provider_detector | 0 | 30.04 |
| Runner11:30 | f/monitoring/failing_schedules | 9 | 12.89 |
| Runner11:30 | f/social/deletion_sync | 1 | 10.00 |
| Runner11:30 | f/monitoring/backup_check | 2 | 8.31 |
| Runner11:30 | f/buzz/daily | 2 | 6.05 |
| Runner11:30 | f/sync/copy/vector_data | 1 | 5.14 |
| Runner11:30 | f/social/discover_rss | 1 | 5.13 |
| Runner11:30 | f/tmdb_api/tmdb_fetch_episodes_from_api | 90 | 5.06 |
| Runner11:30 | f/critic_sites/crawl_rotten_tomatoes | 3 | 4.55 |
| Runner11:30 | f/social/discover_youtube | 1 | 3.22 |
| Runner11:30 | f/critic_sites/crawl_metacritic | 3 | 1.67 |
| Runner11:30 | f/sync/copy/all_ratings | 1 | 0.81 |
| Runner11:30 | f/sync/copy/tmdb_episodes | 18 | 0.65 |
| Runner11:30 | f/sync/copy/personal_order_dirty | 30 | 0.27 |
| Runner11:30 | f/tmdb_daily/tmdb_check_daily_dump_availability | 3 | 0.12 |
| Runner11:30 | f/tmdb_daily/tmdb_extract_daily_dump_data | 3 | 0.09 |
| Runner11:30 | f/tmdb_api/tmdb_fetch_details_from_api/awaited | 1 | 0.04 |

Best23:00 boundary also starts provider initialization, social YouTube discovery, awaited TMDB and
monitoring work. Runner13:00 boundary starts recent-release recheck/hourly work. An unlimited stop
cannot be forced to finish by a deadline; hand over exact two-node/settings/cron state if delayed.

## Sources and validation

Primary sources: read-only Windmill GET /api/w/goodwatch/schedules/list, completed/list with
has_null_parent=true/is_skipped=false, and queue/list; read-only Coolify deployment queue; owner's
no-planned-deploy statement; connected PostHog aggregate query. Credentials stayed in memory, and
token/argument/result/log fields are excluded. Source code under goodwatch-flows/windmill/f supports
bulk-work classification. No preview/run, schedule mutation, Crate SQL mutation, cron hold, restart
or deploy occurred. Validation covers cron seconds/timezones, carry-over/boundaries,90min timing,
24h horizon, all56 schedules and traffic reconciliation. Fresh gates and owner go remain mandatory.

Validation completed successfully: overlap/carry/end boundaries, UTC/seconds/year cron conversion,
all56/53 schedules,809 root samples, all candidate90min/horizon checks, mean/median/max ordering,
167 daily-hour bucket reconciliation and exact plan offsets. Sanitized validation inputs/source
are included in the evidence archive. No production action was started.
