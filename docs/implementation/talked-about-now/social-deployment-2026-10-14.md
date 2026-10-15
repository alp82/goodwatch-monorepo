# Social Windmill deployment — 2026-10-14

**Deployed and scheduled; all-source green verification is blocked by the existing OpenRouter daily cap.** The next manual retry is queued for 2026-10-15 00:05 UTC (02:05 Berlin).

## Deployment and configuration

- Main squash `449c3744` was deployed by [Actions run 38638902778](https://github.com/alp82/goodwatch-monorepo/actions/runs/38638902778). All fifteen social script contents and both flows initially matched main exactly; dependency jobs reported no lock errors.
- The first actual flow run failed before any social-table writes because the entrypoint worker environment omitted `wmill`. Windmill inferred only requests dependencies through the shared modules, despite the manually supplied local locks.
- Added explicit `extra_requirements` to discovery and maintenance, following the working buzz entrypoint; regenerated locks/metadata with CLI 1.803.0 and deployed only the two entrypoints and the two social flows with a restricted `wmill sync push`. Variables, secrets, resources, unrelated flows and schedules were excluded from that sync.
- Configured concurrency limit one on each entrypoint/flow and overlap protection on each schedule. The durable fix is [PR #582](https://github.com/alp82/goodwatch-monorepo/pull/582), branch `feat/talked-about-now-social-deploy`. **Merge it so the next main sync retains these deployment fixes.** Main was not pushed or merged here.
- Verified required Crate, OpenRouter and Qdrant variables exist and are nonempty under `u/Alp/`. No resource object is needed. Optional Crate port, YouTube API key and Qdrant URL use the documented defaults/fallbacks. No variable, secret, resource or provider limit was changed.

## Actual Windmill runs

- Initial missing-SDK failure: `01a13c48-b7d6-4d13-b966-869c78f4a6ae`.
- Dependency-fixed [discovery job](http://10.0.0.10:9000/api/w/goodwatch/jobs_u/get/01a13c4b-02c1-cd18-bd35-8ab9a0923d05) ran for 328.791 seconds. YouTube and RSS succeeded; Bluesky and Mastodon failed on OpenRouter HTTP 403 after the daily budget ran out. It is **not green**.

| Source | Collected | Processed | Links upserted | Status |
| --- | ---: | ---: | ---: | --- |
| youtube | 50 | 14 | 8 | ok |
| rss | 260 | 121 | 62 | ok |
| bluesky | 616 | 216 | 51 | failed |
| mastodon | 77 | 0 | 0 | failed |

The run recorded $0.2142112 in returned inference usage. Link upserts are not the same as net new links: changed-content reprocessing also removed obsolete links. All adapter error lists were empty; the final failures were inference quota errors.

- [Deletion-sync job](http://10.0.0.10:9000/api/w/goodwatch/jobs_u/get/01a13c53-0cb4-04a9-72ad-088cd7137563) completed **green** in 1.726 seconds: 8 checked, 0 removed, 0 unknown.
- 31 offline social tests passed after the dependency change; flow wiring checks passed again after concurrency configuration.
- After the runs: **2,355 active posts; 571 title links** (YouTube 76 / RSS 375 / Bluesky 120 / Mastodon 0). **Zero links lack a current passing quality verdict.** Pending eligible posts: YouTube 0 / RSS 0 / Bluesky 14 / Mastodon 68. Only social-owned Crate tables were written; no other Crate table or Valkey was modified.

## Schedules

All are enabled, use timezone UTC, cron parser v2, run as `u/Alp`, and have `no_flow_overlap=true`. Read-back confirmed exact arguments. Discovery arguments are days=2, pages=2, max_posts=400, vector_enabled=true, plus the source below. Deletion arguments are source=all, limit=2000.

| Schedule | Flow | Source | UTC cron |
| --- | --- | --- | --- |
| `f/social/discover_youtube` | `f/social/discover` | youtube | `0 0 * * * *` |
| `f/social/discover_rss` | `f/social/discover` | rss | `0 20 * * * *` |
| `f/social/discover_bluesky` | `f/social/discover` | bluesky | `0 40 * * * *` |
| `f/social/discover_mastodon` | `f/social/discover` | mastodon | `0 10 3 * * *` |
| `f/social/deletion_sync` | `f/social/deletion_sync` | all | `0 50 */6 * * *` |

Discovery schedules are temporarily paused until **2026-10-15 00:00 UTC**, avoiding repeated known quota failures; deletion sync is active without a pause. The scheduler has queued YouTube for 01:00, RSS for 00:20, Bluesky for 00:40, Mastodon for 03:10 and deletion sync for 00:50 UTC. Source-specific schedules keep Mastodon out of the hourly runs.

## Quota blocker and queued retry

OpenRouter key metadata reports **$1/day**, **$0 remaining**, daily usage $1.011203746. [Daily key limits reset automatically at midnight UTC](https://openrouter.ai/docs/api/api-reference/api-keys/update-keys). The existing guard was respected: no alternate key, limit increase or Valkey pause key was used.

An explicit all-source [manual retry](http://10.0.0.10:9000/api/w/goodwatch/jobs_u/get/01a13c53-b725-8df6-88f6-35e1fe010d76) is queued for **2026-10-15 00:05 UTC**, after reset. It has not run yet, so the green discovery criterion remains unverified. If verification is needed sooner, the owner must make quota available and rerun; the queued retry can then be cancelled to avoid redundant work.

Merge PR #582 before another main workspace sync. After quota returns, confirm the queued discovery succeeds and update #556; three actual days of scheduled production observations still remain acceptance work. Full audits and schedule/job IDs are in [the deployment evidence JSON](social-deployment-2026-10-14.json).
