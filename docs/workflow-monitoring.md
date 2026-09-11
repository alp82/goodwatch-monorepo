# Workflow health and Discord alerts

`f/monitoring/check` observes enabled Windmill schedules and execution history. It never cancels, restarts, or replays work. Workflow evidence is separate from infrastructure connectivity; a successful API read does not establish pipeline health or retired PostgreSQL health.

## Execution evidence

The observation boundary is the retirement shutdown at **2026-09-09 21:01:10 UTC**. Candidate UUIDs are not counted as roots until the full job or Windmill root resolver proves ancestry. Root IDs are deduplicated; unresolved ancestry remains unknown. The ledger retains running and incomplete executions for later refresh, including completions whose start predates the observation boundary. Results, arguments, logs, provider payloads, and credentials are not stored.

Reports distinguish useful success, no eligible work, overlap skips, failures, cancellations, and successful executions whose useful outcome is unknown. Failed descendants and structured error counts remain visible even if a parent tolerated them. Missing descendants are distinct from temporarily unavailable detail requests. Future queued work is not overdue.

Cron evaluation accepts five, six, and seven fields in the schedule's timezone, with seconds first for Windmill's six/seven-field form. All eight daily pipelines retain coverage since shutdown. Frequent schedules retain full ledger outcome counts but limit slot computation to the latest 48 hours and expose truncation; their returned slot details show the latest 20 entries. Reports identify uninspected candidates, unresolved observations, missing daily paths, and incomplete history explicitly. Initial backfill is not a clean bill of health.

Collection uses eight readers, at most 800 root resolutions and 50 descendants per root, and a 220-second collection/notification admission budget. API requests have a 10-second timeout. The Windmill job timeout is 300 seconds; a ten-minute Crate lease prevents overlapping checkers. Slow or truncated history remains unknown and is revisited. The ledger does not delete history automatically.

## Thresholds and incidents

`RUNTIME_HOURS` in `f/monitoring/check.py` sets explicit per-pipeline runtime limits: two hours for frequent publication/provider jobs, six hours for rating crawlers and daily initialization, twelve hours for full Crate population, and six minutes for homepage warming. Unknown future paths default to six hours. Scheduling grace is half a cadence bounded to five minutes–one hour. Three genuine failures trigger a failure incident; neutral no-work/overlap outcomes do not reset or create that streak. Lack-of-progress requires independent unhealthy evidence and exceeds the larger of twice the runtime limit or three cadences.

Excessive runtime, missing descendants, material child/outcome failures, consecutive failures, missing current execution, and sustained failed progress open incidents. Historic gaps remain in coverage but do not prevent a later verified recovery. Unknown health never closes an incident.

The idempotently initialized Crate table `workflow_monitoring` stores normalized jobs, latest reports, pipeline incidents, and delivery state. State and attempt timestamps are written before Discord I/O. Confirmed incidents are deduplicated, reminders are six-hourly, and recovery is sent once. Discord delivery requires `wait=true` and a returned message ID. Failures retain pending notification state, respect a global retry gate (at least 30 minutes for ordinary transient failures and Discord's longer requested delay for 429), and block retries after permanent webhook errors until the secret changes. Discord and Crate cannot commit atomically: a process death after Discord accepts a message but before persistence can cause a delayed duplicate; the durable attempt gate prevents immediate flooding.

## Configuration and rollout

1. Create the Windmill **secret** variable `f/monitoring/discord_webhook_url` with the chosen channel's Discord webhook URL. Never put it in Git, job arguments, or chat. The adapter accepts the fixed HTTPS Discord webhook host/path and disables redirects and mentions.
2. Deploy the committed scripts and pinned locks through the existing main-branch Windmill workflow.
3. Run `f/monitoring/check` with `notify=false`. Inspect `latest-report` and the returned root/unknown counts; do not infer useful success from a successful checker job.
4. Run `f/monitoring/notification_check` with `phase=incident`, then `phase=recovery`. Both must return `status=delivered` and distinct Discord message IDs. Messages are labelled controlled checks and reference the real check job. Repeating a confirmed phase produces no extra message. This does not fail or manipulate a production pipeline.
5. Enable the `f/monitoring/check` schedule with cron `0 */5 * * * *`, timezone `Europe/Berlin`, and args `{"notify":true}`. Keep it disabled until the secret and controlled delivery checks succeed.

For webhook failure, inspect safe `error_code`, retry time, pending incident, and message ID fields. Correct the secret for permanent errors; the next checker recognizes its fingerprint and retries pending work. Do not manually erase active incidents to retry delivery. Existing retirement infrastructure observation remains separate from this workflow report.

## Validation

The implementation suite covers ancestry resolution/deduplication, missing and unfinished descendants, tolerated structured failures, all cron forms and eight daily paths, delayed completion, bounded unknown backfill, API failure, neutral outcomes, durable incident/recovery planning, Discord confirmation/redaction/rate limits, and real Crate lease/state behavior. A bounded live sample of 40 jobs matched Windmill's root resolver exactly: 20 roots, 20 children, zero mismatches or unresolved parents.

Live deployment, controlled Discord delivery, and schedule activation evidence are recorded in issue #9 when completed.

Protocol references: [Discord execute webhook](https://docs.discord.com/developers/resources/webhook#execute-webhook), [Discord rate limits](https://docs.discord.com/developers/topics/rate-limits), [croniter seconds/year/timezone support](https://pypi.org/project/croniter/).
