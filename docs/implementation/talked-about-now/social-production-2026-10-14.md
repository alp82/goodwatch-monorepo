# Social discovery production evidence — 2026-10-14

Implementation: #556. Executed locally against production Crate, writing only the four new social tables. No Valkey or catalog writes. All source runs finished; no local collection jobs were left running. Reddit is absent.

| Source | Stored posts | Processed | Title-post links | Distinct title IDs |
| --- | ---: | ---: | ---: | ---: |
| youtube | 94 | 94 | 68 | 51 |
| rss | 523 | 523 | 317 | 215 |
| bluesky | 864 | 864 | 251 | 209 |
| mastodon | 77 | 77 | 0 | 0 |

**Total: 1558 posts, 636 links; zero pending posts.**

Backfill requests used a seven-day window and up to six RSS/uploads pages; rolling feeds and first-page Bluesky search limit historical coverage. The final runs successfully read all ten YouTube channels, nineteen RSS feeds and three Mastodon instances. YouTube used official channel feeds because no Data API key was configured. API uploads-playlist behavior has offline fixture coverage.

The [Other Mommy title read](evidence/social-read-example-2026-10-14.json) returns a Bluesky review and two official YouTube clips. Trailer deduplication, report hiding, stale-link removal, lane controls, author-wide opt-out purge and content-free tombstones passed live Crate integration tests. Six integration tests plus eighteen offline tests and two existing schema checks passed. A real deletion-sync smoke checked eight posts from each source: 32 checked, zero removed, zero unknown. Actual source deletion/opt-out events were simulated in fixtures, not induced at external services.

Manual checks: [150 links with judgments and reasons](social-review-2026-10-14.md). Initial samples: YouTube 45 right / 4 wrong / 1 unsure; RSS 44 / 3 / 3; Bluesky 42 / 5 / 3. These text-based checks are not equivalent to the earlier prototype benchmark. Mastodon yielded zero links across 77 trend posts, so its fifty-link acceptance sample is unavailable.

Posted on #556: [YouTube sample](https://github.com/alp82/goodwatch-monorepo/issues/556#issuecomment-6173492648), [RSS sample](https://github.com/alp82/goodwatch-monorepo/issues/556#issuecomment-6173493231), [Bluesky sample](https://github.com/alp82/goodwatch-monorepo/issues/556#issuecomment-6173493763).

Full counts, run audits, inference cost caveats and maintenance results: [production evidence JSON](evidence/social-production-2026-10-14.json). Failed/superseded initial trials remain in the run journal; final successful runs processed every stored row. Per-run counts include retry/upsert activity and must not be added as distinct row counts.

After merge: verify existing Windmill secrets; optionally add YOUTUBE_API_KEY for uploads pagination; enable discover hourly and deletion_sync every six hours with one concurrent discovery run. Finish three actual production days and the Mastodon sample before closing #556. The title-page ticket owns the webapp wrong-title endpoint/cache invalidation. See [operations/API contract](social.md).

## Content-quality follow-up

This initial matching snapshot predates the publication gate. The [subsequent production sweep](social-quality-2026-10-14.md) removed 182 Bluesky links and documents current counts, policy and thirty rejected examples. Use that report for publication eligibility.
