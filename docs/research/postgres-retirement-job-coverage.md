# Provider crawler recovery and retirement evidence

Research: 2026-09-10 ~07:00 UTC. Read-only investigation; no production changes. Primary evidence is current Windmill API responses, repository/monitor source and official Windmill documentation. Credentials were excluded.

## Findings

**Confirmed: a pre-migration orphan prevents scheduled provider crawling.** Live schedule detail has `no_flow_overlap: true` (the list endpoint omits this field). The latest completed run `01a08a1c-2f26-0e8c-9917-f8289f6b0eea` reports `success:true`, `is_skipped:true`, and result `not allowed to overlap with 019aa915-5416-fd17-9882-9e6871c86879, scheduling next iteration`. Its first module is skipped; this is not a completed crawl. [Schedule detail](http://10.0.0.10:9000/api/w/goodwatch/schedules/get/f/tmdb_web/tmdb_crawl_providers), [completed job](http://10.0.0.10:9000/api/w/goodwatch/jobs_u/get/01a08a1c-2f26-0e8c-9917-f8289f6b0eea).

The blocking root `019aa915-5416-fd17-9882-9e6871c86879` is still queued/running, started 2025-11-22, uncanceled, with child `019aa915-a956-0616-bc60-cc16768cc716` InProgress. That child is waiting on a parallel iteration: four success entries and one unresolved `019aa915-b25c-962f-68ae-59dfbcceb797`; fetching the unresolved iteration returns HTTP404. The broken execution tree and direct overlap result explain current starvation. **The original cause of the missing iteration is unproven**: retention, deletion, worker interruption or an engine bug require historical evidence. Do not label today's retirement as its cause. [Root](http://10.0.0.10:9000/api/w/goodwatch/jobs_u/get/019aa915-5416-fd17-9882-9e6871c86879), [child](http://10.0.0.10:9000/api/w/goodwatch/jobs_u/get/019aa915-a956-0616-bc60-cc16768cc716), [missing iteration](http://10.0.0.10:9000/api/w/goodwatch/jobs_u/get/019aa915-b25c-962f-68ae-59dfbcceb797).

**Confirmed: monitor green does not establish workflow success.** The local protected monitor's `windmill()` sets `ok` solely from unchanged enabled schedule definitions. It increments success even for skipped runs, assumes missing `parent_job` means top-level, and its `daily()` rejects seven-field cron. The midnight provider-init schedule uses seven fields. At 06:56 UTC the monitor counted two DNA and two TVTropes-init successes, whereas a fresh `has_null_parent=true` completed-job query finds one genuine root each. Therefore historical aggregate counts cannot be trusted without recomputation. [Monitor source](/home/alp/.local/state/goodwatch/postgres-retirement/20260909T085648Z/observation/monitor.py:214), [Windmill job semantics](https://www.windmill.dev/docs/core_concepts/jobs), [schedule and skip documentation](https://www.windmill.dev/docs/core_concepts/scheduling).

## Verified daily coverage since shutdown

Queried completed jobs with exact script path, `has_null_parent=true`, and `started_after=2026-09-09T21:01:00Z`; verified `success=true` and `is_skipped=false`. The observation started just after service stops, so this captures a conservative complete post-stop execution boundary. [Completed-jobs API](http://10.0.0.10:9000/api/w/goodwatch/jobs/completed/list), [queue API](http://10.0.0.10:9000/api/w/goodwatch/jobs/queue/list).

| Daily pipeline | Status around 07:00 UTC September 10 |
| --- | --- |
| TMDB provider initialization | Genuine successful root `01a08309-000d-f07e-dd9d-39c83b66787c` |
| DNA initialization | Genuine successful root `01a083ad-cb78-2bd5-a76b-9e407cd7c4ef` |
| TVTropes ratings initialization | Genuine successful root `01a08376-dcf3-1b5e-7bc4-0f2f7d77223a` |
| Rotten Tomatoes initialization | Running since 03:00 UTC; no completed root yet |
| Metacritic initialization | Running since 06:00 UTC; no completed root yet |
| TMDB details initialization | Not yet due: 07:30 UTC / 09:30 Berlin |
| IMDb initialization | Not yet due: 09:00 UTC / 11:00 Berlin |
| Populate Crate | Not yet due: 17:00 UTC / 19:00 Berlin |

Only **3 of 8 daily roots** are proven completed in this window. A completed root is necessary evidence, but still inspect material skipped/failed child work and resulting data freshness: a flow can tolerate child failures. Future queued executions should not be confused with concurrently running roots. These observations do not indicate a new Postgres dependency. [Live schedules](http://10.0.0.10:9000/api/w/goodwatch/schedules/list), [flow child-job model](https://www.windmill.dev/docs/flows/architecture).

## Proposed ticket: Restore crawler progress and make retirement checks reliable

1. Save bounded root/child evidence; temporarily pause only the provider schedule to prevent races. Recheck whether an actual worker still owns work. Cancel the stale root using supported Windmill cancellation, then inspect the root and all surviving descendants until terminal. If normal cancellation cannot clear the inconsistent tree, investigate the supported force-cancel endpoint and scope it to verified orphan jobs; do not directly alter Windmill's database. Preserve overlap protection and restore the schedule. Windmill exposes job cancellation and inspection; do not assume every version automatically clears all descendants. [Official job cancellation](https://www.windmill.dev/docs/advanced/cli/job), [supported job methods](https://app.windmill.dev/tsdocs/classes/JobService.html).
2. Prove one real scheduled provider execution selects eligible records, updates provider source data, and reaches its expected completion/publication boundary. Diagnose selection/crawling independently if it merely completes without work. Check no old descendants remain and the next scheduled run can make progress.
3. Repair the observation collector: fetch actual root identities (missing parent fields mean unknown), deduplicate IDs, separate success/failure/skip/cancel, use schedule details where list fields are missing, handle five/six/seven-field cron and timezone, and recompute the window from authoritative jobs. Separate infrastructure health from execution health. Add a stale-root/no-success alert based on job runtime and expected schedule progress; do not merely alert on every legitimate overlap skip.
4. Validate with fixtures covering missing parent fields, seven-field midnight schedules, explicit skips, long-running jobs that finish outside incremental query windows, canceled or missing descendants, and failed children under an otherwise successful root. Compare aggregate reports with a bounded live sample.

Acceptance: provider crawling demonstrably resumes; no unresolved stale tree; all eight daily pipelines represented; exact root counts reconcile with the API; skipped jobs cannot satisfy retirement readiness; failures/unknowns remain visible despite green infrastructure; supported failure/recovery behavior documented.

## Cutoff decision

**Recommend an evidence gate, not an arbitrary replacement time.** Keep old storage until (a) every required enabled pipeline has a genuine post-shutdown run or a justified controlled replay, (b) representative writes and reads prove expected source freshness, Crate publication, Qdrant publication and priority acknowledgment, (c) migration-related failures are resolved/replayed, and (d) backups and rollback retention are reviewed. A successful root alone cannot establish complete work. Expected external-source failures may be explicitly accepted with evidence and retry/backlog behavior; requiring zero child failures would be misleading. Cache warming can be tracked separately if confirmed unrelated to storage retirement. These are proposed project acceptance criteria, not guarantees from the vendor.

Decisions for the combined interview: wait for the remaining natural daily schedules versus allow targeted replays to shorten the window; define which external-source failures can be accepted; choose post-cutoff backup retention. Recommend natural coverage when imminent, targeted replays only where they safely exercise the missing dependency, and no change to the storage cutoff until the corrected gate passes.

## Authorized recovery — 2026-09-10 08:32 UTC

The user authorized stopping the stuck crawler. A fresh full queue audit found 38 entries and exactly two started more than 24 hours earlier: the known root and its child, one execution tree. The provider schedule was briefly paused. Ordinary cancellation marked both canceled but left them queued/running; supported force cancellation then moved both to terminal CompletedJob/canceled state. Neither remains queued; overlap protection was retained and the schedule resumed. Evidence and before-state are protected locally under `stale-job-audit-20260910/`. No direct Windmill database edits were made.

Three subsequent scheduled roots completed successfully without skips: `01a08a72-c678-673c-29b1-dd2d0b040f96`, `01a08a72-daa9-b1f2-7f35-f45fcdb970a1`, and `01a08a73-28c2-69c7-35ab-a8466588f4d4` (roughly 8–10 seconds each), returning actual provider fetch results for shows 108978/5920 and multiple countries. This establishes resumed source crawling; it does not repair the separate targeted handoff or establish final Crate/Qdrant publication. The existing retirement observation deadline remains unchanged at the user's request.
