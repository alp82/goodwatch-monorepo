# Scheduled crawler rollout, 21 September 2026

The user authorized checking production schedules, deploying the reviewed crawler fixes, and letting regular scheduled crawling handle recovery. The fixed 45-title wrong-page audit is now a separate [audit task](https://github.com/alp82/goodwatch-monorepo/issues/123). This report is evidence for [Deploy TV Tropes crawler repairs and verify scheduled recovery](https://github.com/alp82/goodwatch-monorepo/issues/120).

## Outcome

**The repaired helper, initializer, and fetch scripts are deployed, but real Windmill worker source access is blocked.** This is production worker evidence, not an inference from the earlier local denial. No successful recovery or Mongo-to-Crate publication was observed. The rollout ticket remains open for successful extraction and ingestion verification.

The two preexisting production script contents and dependency locks exactly matched the parent of reviewed archive `881305b5`. Only those two scripts and the new helper were published through Windmill's script-version API. [deployment.json](deployment.json) records previous/current hashes and content SHA256 values. Existing schedules, flow definitions, dependency pins, and worker configuration were preserved. The helper's empty dependency lock was generated as `# py: 3.12`; it has no third-party dependencies. Existing caller locks still use their previous environment.

| Script | Previous hash | Deployed hash |
| --- | --- | --- |
| Title candidate helper | new | `4ac10ba83c6986f3` |
| Initialization | `7ca93e7e718b16ba` | `5fa3102fb1d8531f` |
| Fetch | `0caa331a69d161db` | `3f78e2ee47145eea` |

The source commit/branch accompanying this report mirrors the production delta for review and future repository deployments. It has not been merged to main. Until merged, a later full workspace deployment from an older main can replace these two repaired scripts. The API deploy did not push unrelated shared-workspace changes. Rollback source and original locks are recorded in [fetch-before.json](fetch-before.json) and [main-before.json](main-before.json); restoration should create a new script version using the then-current parent hash. Do not delete/recreate scripts.

## What the schedules actually do

All three schedules are enabled in Europe/Berlin:

- Crawler: every 20 seconds (seconds 16/36/56), with existing overlap protection. The regular selector takes eight titles per batch; this is not a targeted 186-title recovery job.
- Initializer: daily at 02:00. This updates existing title metadata as well as inserting new entries. Deploying its repair means the next ordinary run can refresh candidates and release years; no manual broad initializer or extra metadata job was run.
- Mongo-to-Crate sync: 03:00, 09:00, 15:00, 21:00. It considers source updates from the last 48 hours and only upserts trope rows. Confirmed wrong-page replacements still need their separately scoped obsolete-row cleanup.

Recent green parent crawler jobs were **overlap-skipped**, not successful extraction. A pre-deploy worker leaf failed with the legacy combined 403/429 label. The latest initializer (21 September 02:00 Berlin) failed after a Mongo socket timeout; the previous two daily jobs succeeded. This intermittent initializer failure is distinct from source access denial. The latest sync (21 September 09:00 Berlin) succeeded but processed **zero movies and zero shows**.

## Worker verification

The first captured completed scheduled fetch using repaired hash `3f78e2ee47145eea` was `01a0c2ca-2593-1e7e-3f74-be68fa5e72b1`, started 07:07:20 UTC on worker `wk-default-89e481c8e3ab-N9HzX`. It reached the browser/source path and failed with the existing combined `Rate limit reached` error for The Flying Deuces (movie 22999). This confirms the new script and helper import work in the real scheduler path, but the old error wording alone does not distinguish 403 from 429.

A separate **single-navigation, read-only worker probe** (`01a0c2ca-2219-44d5-9d4e-043107b6cd98`) on worker `wk-default-2f4bb8b4f321-GfOWB` returned **HTTP 403**, page title **Just a moment...**, and Cloudflare challenge markup. It used normal Playwright Chromium launch/context behavior, no challenge bypass, no retry, and no database writes. The deployed helper imported successfully and generated `TwelveAngryMen`. [probe.py](probe.py) and [probe-result.json](probe-result.json) preserve the probe and sanitized result; transient challenge URL parameters are omitted.

Read-only Mongo verification of movie 22999 after its scheduled failure found `is_selected=false`, `failed_at=2026-09-21 07:07:27.962`, 26 existing tropes, and source `updated_at=2025-10-02 03:59:13.614`. This supports queue release and preservation of existing source data; it is not a new recovery. No manually initiated source/data replacements or Crate writes occurred. Naturally scheduled jobs retained their ordinary failure-state writes.

## Remaining work and resume condition

An authorized TV Tropes source path must work from the production crawler workers. Repeating the same denied probe adds no evidence. Once access conditions change, inspect a naturally scheduled leaf on the repaired hash, confirm nonempty correctly attributed source data and Mongo persistence, then verify its exact movie/show identity passes through the next enabled sync into Crate. Check the next daily initializer's outcome for metadata freshness; a recurrent Mongo timeout needs diagnosis before relying on its completion. None of this requires running the frozen local audit or mass-recovery job first.

The fixed 45-title wrong-page audit, frozen cohort completion counts, before/after relevance review, and expansion decision remain separate. No title was marked recovered from the blocked probes, no suspicious match was confirmed, and no search improvement is claimed.

Validation: 18 existing focused TV Tropes tests passed in the original reviewed workspace, including Chromium fixtures and evidence-runner checks. The release branch includes the 16 crawler fixture tests and their exact deployed source. All three deployed contents were read back and verified byte-for-byte against the reviewed archive; lock readiness/error state was checked before declaring publication complete.
