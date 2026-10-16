# Workflow health and Discord alerts

`f/monitoring/check` observes enabled Windmill schedules and execution history. It never cancels, restarts, or replays work. Workflow evidence is separate from infrastructure connectivity; a successful API read does not establish pipeline health or retired PostgreSQL health.

## Execution evidence

The observation boundary is the retirement shutdown at **2026-09-09 21:01:10 UTC**. Candidate UUIDs are not counted as roots until the full job or Windmill root resolver proves ancestry. Root IDs are deduplicated; unresolved ancestry remains unknown. The ledger retains running and incomplete executions for later refresh, including completions whose start predates the observation boundary. Results, arguments, logs, provider payloads, and credentials are not stored.

Reports distinguish useful success, no eligible work, overlap skips, failures, cancellations, and successful executions whose useful outcome is unknown. Failed descendants and structured error counts remain visible even if a parent tolerated them. Missing descendants are distinct from temporarily unavailable detail requests. Future queued work is not overdue.

Cron evaluation accepts five, six, and seven fields in the schedule's timezone, with seconds first for Windmill's six/seven-field form. All eight daily pipelines retain coverage since shutdown. Frequent schedules retain full ledger outcome counts but limit slot computation to the latest 48 hours and expose truncation; their returned slot details show the latest 20 entries. Reports identify uninspected candidates, unresolved observations, missing daily paths, and incomplete history explicitly. Initial backfill is not a clean bill of health.

Collection uses eight readers, at most 800 root resolutions and 50 descendants per root, and a 220-second collection/notification admission budget. API requests have a 10-second timeout. The Windmill job timeout is 300 seconds; a ten-minute Crate lease prevents overlapping checkers. Slow or truncated history remains unknown and is revisited. The ledger does not delete history automatically.

## Thresholds and incidents

`RUNTIME_HOURS` in `f/monitoring/check.py` sets explicit per-pipeline runtime limits: two hours for frequent publication/provider jobs, six hours for rating crawlers and daily initialization, twelve hours for full Crate population, and six minutes for homepage warming. Unknown future paths default to six hours. Scheduling grace is half a cadence bounded to five minutes–one hour. Three genuine failures trigger a failure incident; neutral no-work/overlap outcomes do not reset or create that streak. Lack-of-progress requires independent unhealthy evidence and exceeds the larger of twice the runtime limit or three cadences.

Excessive runtime, missing descendants, material child/outcome failures, consecutive failures, missing current execution, and sustained failed progress are diagnostic health findings. Only the actionable subset below opens a Discord incident. Historic gaps remain in coverage but do not prevent a later verified recovery. Unknown health never closes an incident.

The idempotently initialized Crate table `workflow_monitoring` stores normalized jobs, latest reports, pipeline incidents, and delivery state. State and attempt timestamps are written before Discord I/O. Discord uses an attention policy separate from diagnostic health. It sends one actionable incident, one escalation for a newly observed actionable cause, and one short recovery for a delivered incident. There are no timed reminders. Missing descendants, unknown history, isolated child/outcome failures, and lack of useful work alone never notify. Missing scheduled execution must also exceed the progress threshold; repeated failures and excessive runtime remain actionable. Shard lag/translog size alone remain diagnostics until a checkpoint stalls for an hour; disk capacity and backup failures remain actionable. Old diagnostic-only incidents and pending timed reminders are retired silently. Failed delivery of an actionable alert still retries through the durable gate. Discord delivery requires `wait=true` and a returned message ID. Failures retain pending notification state, respect a global retry gate (at least 30 minutes for ordinary transient failures and Discord's longer requested delay for 429), and block retries after permanent webhook errors until the secret changes. Discord and Crate cannot commit atomically: a process death after Discord accepts a message but before persistence can cause a delayed duplicate; the durable attempt gate prevents immediate flooding.

## Crate shard and disk health

The same five-minute check reads `sys.shards`, `sys.nodes` and `sys.cluster` (read only, about 20 seconds of the budget are reserved) and reports two grouped incidents through the same ledger and Discord path:

- `f/monitoring/crate_shards` is unhealthy when a started primary's global checkpoint trails its local checkpoint by **500,000 operations or more** (`crate_checkpoint_lag`), when a lag of at least 1,000 operations keeps the **same global checkpoint for an hour** (`crate_checkpoint_stalled`), or when a started copy's **translog reaches 1 GB** (`crate_translog_oversized`). The message names the three worst shards with lag, translog size and replica node.
- `f/monitoring/crate_disk` is unhealthy when any node's disk use comes within **10 points of the configured low watermark** (`crate_disk_near_watermark`, 75% with the default 85%) or passes it (`crate_disk_watermark`). Absolute byte watermarks fall back to the 85% default.

A stuck replica checkpoint pins the retention leases, so the translog and every soft-deleted document above it are kept and the shard grows with each update. In September 2026 this left `movie` shards 8 and 9 at 24–29 GB instead of 0.2 GB. The fix is to cancel the lagging replica with `ALTER TABLE <table> REROUTE CANCEL SHARD <id> ON '<replica node>'`, one shard at a time, so it recovers from the primary. Thresholds live in `f/monitoring/cluster_health.py`. A failed system table read is `unknown` and never counts as recovery.

## Crate backup age

`f/monitoring/backup_check` is a separate hourly script, because a read of `sys.snapshots` takes 15 to 90 seconds on the backup repository and doesn't fit the five-minute check's budget. It reads the newest snapshot with state `SUCCESS` in the repository `goodwatch-db-backup` (read only) and reports `f/monitoring/crate_backup` through the same ledger and Discord path:

- `crate_backup_stale`: the newest successful snapshot finished more than **3 hours** ago. The backup runs hourly, so this means at least two missed snapshots.
- `crate_backup_missing`: the query returned 0 rows. A disabled repository returns 0 rows without an error.
- `crate_backup_unreadable`: the query failed or didn't return within 240 seconds.

Unlike the shard and disk reports, a failed read is unhealthy here, not `unknown`: a silent failure is the case this check exists for. The read runs before the script takes the monitoring lease, and the script then waits up to 240 seconds for the lease, so the five-minute check is blocked for a few seconds at most. If the lease stays busy, the job fails, and the five-minute check reports the `f/monitoring/backup_check` schedule after three failures. The Windmill job timeout is 600 seconds.

To activate it after the deploy, create a schedule with path `f/monitoring/backup_check`, script `f/monitoring/backup_check`, cron `0 40 * * * *`, and args `{"notify":true}`. Minute 40 is after the hourly backup's snapshot, which starts at minute 5. For the recovery steps, see [the Crate backup README](../goodwatch-crate/README.md).

## Failing schedules

`f/monitoring/failing_schedules` is a separate script that runs every 10 minutes. `f/monitoring/check` missed a tmdb_episodes sync failure for 2.5 days because old ledger rows used up its inspection budget. This script reads only the latest runs, so old history can't crowd them out. For every enabled schedule it reads the last 10 completed root runs (`jobs/completed/list` with `schedule_path`, `has_null_parent=true`, `is_skipped=false`). A schedule is failing when its last 3 runs failed, or when its newest run failed and its last success finished 20 hours ago or more (or never). A daily or weekly job therefore alerts on its first failure.

It sends one Discord incident (cause `consecutive_failures`, linking the newest failed run) when a schedule starts failing and one recovery when its newest run succeeds again. The alerted set is saved in the Windmill state resource `f/monitoring/failing_schedules_state`. Manual and scheduled runs share that fixed path. Undelivered messages are retried on the next run. After one failed delivery, the rest of the run's messages wait, and a Discord rate limit pauses delivery for the time Discord asks. A disabled or deleted schedule leaves the set without a message. A schedule whose history can't be read keeps its entry. `notify=false` reports without sending or saving.

Schedule: path `f/monitoring/failing_schedules`, cron `0 */10 * * * *`, timezone `Europe/Berlin`, args `{"notify":true}`. The thresholds are at the top of `f/monitoring/failing_schedules.py`.

## Configuration and rollout

1. Create the Windmill **secret** variable `f/monitoring/discord_webhook_url` with the chosen channel's Discord webhook URL. Never put it in Git, job arguments, or chat. The adapter accepts the fixed HTTPS Discord webhook host/path, sends Discord's required identifying User-Agent, and disables redirects and mentions. A corrected delivery-client identity also invalidates an old permanent-error gate while preserving the pending incident.
2. Deploy the committed scripts and pinned locks through the existing main-branch Windmill workflow.
3. Run `f/monitoring/check` with `notify=false`. Inspect `latest-report` and the returned root/unknown counts; do not infer useful success from a successful checker job.
4. Run `f/monitoring/notification_check` with `phase=incident`, then `phase=recovery`. Both must return `status=delivered` and distinct Discord message IDs. Messages are labelled controlled checks and reference the real check job. Repeating a confirmed phase produces no extra message. This does not fail or manipulate a production pipeline.
5. Enable the `f/monitoring/check` schedule with cron `0 */5 * * * *`, timezone `Europe/Berlin`, and args `{"notify":true}`. Keep it disabled until the secret and controlled delivery checks succeed.

For webhook failure, inspect safe `error_code`, retry time, pending incident, and message ID fields. Correct the secret for permanent errors; the next checker recognizes its fingerprint and retries pending work. Do not manually erase active incidents to retry delivery. Existing retirement infrastructure observation remains separate from this workflow report.

## Validation

The implementation suite covers ancestry resolution/deduplication, missing and unfinished descendants, tolerated structured failures, all cron forms and eight daily paths, delayed completion, bounded unknown backfill, API failure, neutral outcomes, durable incident/recovery planning, Discord confirmation/redaction/rate limits, and real Crate lease/state behavior. A bounded live sample of 40 jobs matched Windmill's root resolver exactly: 20 roots, 20 children, zero mismatches or unresolved parents. The first successful durable dry report completed in 113 seconds, resolved 400 executions, included all eight daily schedules among 23 pipelines, and matched its Crate readback exactly. It reported 21 unknown, one healthy, and one unhealthy pipeline, with 27,378 uninspected candidates explicitly retained as incomplete backfill. This snapshot is evidence of truthful reporting, not a claim that those pipelines have recovered.

Live deployment, controlled Discord delivery, and schedule activation evidence are recorded in issue #9 when completed.

Protocol references: [Discord execute webhook](https://docs.discord.com/developers/resources/webhook#execute-webhook), [Discord rate limits](https://docs.discord.com/developers/topics/rate-limits), [croniter seconds/year/timezone support](https://pypi.org/project/croniter/).

The live rollout caught two protocol details now covered by regressions: Discord rejected the default urllib User-Agent (403) while the documented DiscordBot identity succeeded (200 on a read-only webhook check); and lease release must use a realtime primary-key read plus compare-and-set, because an indexed token predicate can miss the newly written lease before refresh. [Discord client identity requirement](https://docs.discord.com/developers/reference#user-agent).

## October 2026 alert audit

The October 15 audit compared the screenshot, actual webhook messages, the monitoring ledger, and live Windmill executions. Access is by stored webhook message IDs, not unrestricted Discord channel history.

- The 14:32 Berlin provider alert linked to a successful run with an empty result. Its sole missing descendant was the all-zero UUID: Windmill's successful empty-loop placeholder (`type=Success`, `skipped=false`, `flow_jobs=[]`). The monitor incorrectly looked it up as a real job, then amplified that false finding into lack of progress. The country backlog check reported zero overdue countries.
- The 11:32 catalog alert likewise linked to a useful, successful run whose sole missing descendant was that placeholder. Newer catalog runs continued publishing. Large flows also exceeded the 50-descendant inspection budget; that remains explicit uncertainty, not a paging condition or proof of full health.
- Crate alerts described a real stalled replication/storage risk, but the six-hour reminders provided no new decision or instruction. At audit time shard checks were healthy and the highest disk use was 33%. The earlier messages do not by themselves establish a user-visible outage.
- Every unchanged incident could repeat four times per day. Three such incidents account for up to twelve daily notifications without a new failure.

The collector now ignores the placeholder only for explicitly skipped modules or successful empty loops; real missing children remain visible. Alerts use plain-language impact and a next step, with one link. Detailed counts and technical cause codes remain in the ledger. Recovery is one line. A resolved diagnostic-only legacy incident does not produce a spurious recovery message.

Example:

> Action needed: Database replication. A replica has stopped catching up for at least 1 hour; retained writes can grow disk use.
> Inspect the lagging replica before disk use grows further.
> [Investigation guide](https://github.com/alp82/goodwatch-monorepo/blob/main/docs/workflow-monitoring.md#crate-shard-and-disk-health)

Validation covers the observed empty-loop shape, real missing children, unchanged incidents over 30 days, escalation deduplication, legacy pending reminders, transient delivery retries, and one recovery only after a delivered alert. A replay of all 56 saved pipeline states produced zero notifications; a fresh observation of the affected provider run produced `no_work` with no missing or unresolved descendants.

Rollout on October 15: deployed `collection`, `health`, `incidents`, and `notifications` individually, preserving live backup cause support, the `listed` outcome counter, and the deployed dependency locks. The live checker source and its additional runtime thresholds were preserved. All four module sources matched their local counterparts after deployment. The production check [01a14091-dec0-84f4-d837-2cd66bd5118b](https://windmill.goodwatch.app/run/01a14091-dec0-84f4-d837-2cd66bd5118b?workspace=goodwatch) completed successfully in 143 seconds with `notify=false`; both recurring crawler incidents were inactive with no pending notification afterward. Historical diagnostic uncertainty remains visible. The final targeted suite ran 97 tests: 92 passed and five opt-in database integration tests were skipped.

The initial direct rollout was overwritten by the normal main-branch GitHub Actions deployment at 17:46 UTC, causing the old provider alert to return at 17:52 UTC. Monitoring changes must be committed to main and deployed through `push-windmill-workspace.yml`; direct script updates are not a durable rollout. The fix was reapplied on current main, preserving its newer monitoring changes. Validation on that base ran 101 tests: 96 passed and five opt-in database integration tests were skipped.
