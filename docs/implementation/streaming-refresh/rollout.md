# Streaming refresh rollout

Status: not deployed. The commands below are an operator runbook, not a record of completed production actions. Review the [approved plan](plan.md) and [local validation limits](backend-validation.md) before enabling work. Keep the page ceiling at **1.3 total wire requests/second** across all legacy/new workers, including redirects, retries and probes. Keep API detector allocation separate.

## Defaults and controls

| Entrypoint | Omitted arguments |
| --- | --- |
| `f/tmdb_api/provider_detector` | `mode=preview`: reads selection without HTTP or production writes. Its checked-in schedule is disabled. |
| `f/tmdb_web/tmdb_crawl_providers` | `availability_selection=false`: retains the legacy selector and its publication behavior. |
| Same flow with `availability_selection=true` only | New selection preview: `shadow_selection=true`, `publication_enabled=false`. |
| `f/tmdb_web/tmdb_crawl_providers/batch` called directly | `shadow_selection=true`, `publication_enabled=false`: no page HTTP or source writes. |
| `f/tmdb_web/page_admission` | `dry_run=true`: reads whether gate state exists. |
| `f/tmdb_web/tmdb_crawl_providers/unsupported_canary` | `dry_run=true`: previews one Niger candidate. |
| `scripts/streaming_identity_republish.py` | Preview action; explicit media, IDs, cap and manifest are required. |

`shadow_selection=true` stops before country claims and HTTP. With selection enabled, `shadow_selection=false, publication_enabled=false` performs admitted page checks without replacing country link evidence. Provider detector `mode=shadow` performs bounded API reads and stores isolated shadow observations; it does not publish live provider evidence or release country work. `mode=publish` is a production write/publication action.

Keep worker selection random. `crawl_all_by_id` splits work into batches of at most twenty root pages, each using one HTTP/2 client; shared admission enforces pacing and six expiring in-flight permits. Do not run a second page caller or a benchmark outside that path.

## Prepare before enabling new work

1. Review the exact resource list and active schedules in [deployment-preflight.md](deployment-preflight.md). Pause the affected legacy page and priority schedules and drain running callers before changing shared transport or gate code; old unpaced workers must not overlap new admitted workers. Back up and deploy the reviewed helper/model/script/flow set and regenerated locks, leaving the detector disabled and new selection in preview. Keep page scheduling paused until the migration, indexes and gate readbacks below pass. Deploy the opened-demand frontend only after its additive Crate migration is verified. Resume only the intended legacy or reviewed preview stage after these preparations.
2. Preview the additive Crate migration from the flows directory:

   ```bash
   python scripts/migrate_opened_demand.py
   ```

   The preview makes no database connection. After review, apply explicitly using the existing connection settings:

   ```bash
   python scripts/migrate_opened_demand.py --apply --env-file .env
   ```

   Read back `crawl_priority.last_opened_at` as `TIMESTAMP WITH TIME ZONE`; consumers cast to UTC epoch milliseconds. Preserve existing demand, acknowledgments, claims and leases. The generic priority initializer is not a substitute for altering an existing table.
3. Run `f/tmdb_web/tmdb_crawl_providers/backfill` separately for `media_type=movie` and `media_type=tv`, initially with `dry_run=true, batch_size=1000`. Review identity errors and paging cursors. Then perform the reviewed bounded migration with `dry_run=false`, continuing from each returned `after_id` until `done=true`. This normalizes `has_streaming_links` and declares `availability_oldest_links` on `(updated_at, has_streaming_links, _id)`, `availability_pending_changes` on `(provider_change_pending, provider_change_pending_since, tmdb_id)`, and `availability_parse_failures` on `(parse_failed_at)`, alongside existing country indexes. Read back index definitions and resolve identity errors before rollout. Do not reset failures, leases or successful evidence times.
4. Read `f/tmdb_web/page_admission` with `dry_run=true`. Bootstrap deliberately with `dry_run=false`, then read back with `dry_run=true`. Initialization uses `$setOnInsert`; it does not reset an existing gate, generation, probe, request clock or counters. A missing gate must stop page workers. Never delete/reset live gate state to force admissions through.
5. Verify the shared country projections from valid live provider observations. `provider_title_observed_at` releases a title's existing country records without declaring omitted countries empty. `provider_observed_at` and `provider_verified_empty` describe explicit country proof separately. Unobserved titles stay outside the new selector; complete verified-empty countries, API-confirmed deleted titles and ordinary Niger work are skipped. A page 404 sets API confirmation pending rather than declaring deletion.
6. Validate opened demand with the deployed frontend/endpoint: list then open, direct entry without a poster, TV title view, one continuous foreground second, background/prefetch ignored, and independent thirty-minute poster/open deduplication. Metadata acknowledgment must not erase `last_opened_at`; its seven-day full-refresh queue remains independent.

## Shadow and recovery proof

Run the provider detector in `mode=preview` first. Inspect registry scope, due work and bounds. Then enable only the reviewed shadow schedule or bounded manual shadow jobs in 00:00–12:00 UTC. The detector shares a three-wire-request/second bucket and a hard 100,000-request UTC-day ceiling, including retries and reruns. It pauses while the prior daily service-list lease is active; window/budget expiry retains due work. Confirm the daily service-list workflow remains enabled at 14:00 UTC and is not silently replaced.

For page selection preview, pass:

```json
{"availability_selection": true, "shadow_selection": true, "publication_enabled": false}
```

Review duplicate avoidance, opened/changed eligibility, scalar ordering and backlog ages. Opened priority lasts twenty-four hours with a 20,000-pair UTC-day cap; changed/new priority has a 30,000-pair cap. Changes remain coalesced on country records. Successful country work clears only the revision it claimed. Popularity at least twenty is due weekly; sweep work is oldest first, with no-link pairs first at equal age. Sweep admissions retain their reservation while it has work, and idle allocations can be borrowed.

Exercise gate/recovery checks only on local/scratch state. A genuine challenge, 403 or 429 closes normal admissions globally. Retry-After and the existing backoff apply; one fenced canary may probe after the deadline. Only a valid country-matched watch-page parse reopens service. Recovery starts at 0.325 requests/second, adds 0.1 after each clean ten-minute interval, and stops at 1.3. A new refusal closes the existing gate again. Preserve evidence while blocked and do not change egress paths.

Complete three UTC shadow days for the daily detector cohort and pass integrated recovery checks before publication. Record actual requests, complete observations/gaps, changed pairs by tier, budgets, failures and publication comparisons. Weekly cold coverage remains a separate baseline-plus-second-pass proof.

## Publication canary and expansion

1. Freeze and record the first one hundred **nondeleted registered** titles with popularity at least twenty, ordered by canonical media type/TMDB ID. Restrict page work to DE/US pairs where current complete provider evidence shows offers: at most two hundred root country pairs. Record skipped/unavailable pairs and the exact admitted IDs/countries. Do not invoke the unrestricted selector as a substitute for this explicit cohort.
2. Publish only the reviewed bounded cohort through existing targeted provider and streaming writers. For admitted page jobs, explicitly set `shadow_selection=false, publication_enabled=true`; keep the same global gate, daily tier counters and page ceiling.
3. Observe one complete twenty-four-hour interval, comparing provider membership, direct-link evidence, source times, history precision, classifications and successful verification counts. Expand to the remaining popularity-at-least-twenty work only after that proof passes.
4. Observe another complete twenty-four-hour interval. Only then enable full background selection for titles with their own validated provider observations. The DE/US canary does not establish worldwide parser coverage; continue country-validation checks and classified error observation.

Stop expansion on refusal, a budget breach, high-priority pending work older than twenty-four hours, or a publication mismatch. Keep the same stage until its proof passes. Observe thirty minutes after deployment for zero ordinary Niger attempts and separately classified errors. The explicit Niger canary entrypoint permits at most one attempt per UTC calendar month; preview first, then invoke `dry_run=false` only for the reviewed monthly check. It remains subject to shared admission and does not publish country link evidence.

Use existing monitoring for gate duration, sustained parse errors, opened/changed backlog older than twenty-four hours and freshness by tier. Count wire admissions separately from completed verifications. Do not infer a thirty-day direct-link age or a higher safe rate from the capacity estimates.

## Bounded historical identity republish

Historical repairs are a separate increment and do not block publication of newly verified data. Use the current canonical catalog and clickout provider ID resolution; do not create an alias table or guess unmatched providers. Preview explicit canonical IDs, starting with a representative Apple subscription service 350 versus store 2 case:

```bash
python goodwatch-flows/scripts/streaming_identity_republish.py preview --media movie --ids 42 --cap 1 --manifest /private/streaming-repair/sample.plan.json
```

`42` is an example placeholder, not a preapproved production cohort. Inspect the manifest's old service-350 rent/buy row count, canonical offer inventory, affected keys and deferred countries. Preview does not change production data; it writes a private local manifest. A cap from one to one hundred is required. Use `show` for the streaming publisher's show media type.

After reviewing the exact sample and backup location:

```bash
python goodwatch-flows/scripts/streaming_identity_republish.py apply --media movie --ids 42 --cap 1 --manifest /private/streaming-repair/sample.plan.json --backup-path /private/streaming-repair/backups
```

Apply rejects a stale source or published-state plan, uses the existing targeted publisher with mapping refresh budget zero, and performs no TMDB HTTP. The existing title publication lease spans the private durable before archive and after receipt. The archive includes full scoped availability, evidence, history and pending history state, plus streaming-owned title aggregate fields and source snapshots. Source documents are not repaired or rewritten by this tool.

Inspect the receipt's affected-key audit and run the same inventory after the bounded sample. Account for every removed duplicate and unmatched offer; verify history/provenance and representative Apple identities before scaling. Repeating apply resumes the existing canonical writer/pending-intent path or returns a matching completed receipt. Newer data causes refusal rather than an automatic overwrite.

For a reviewed rollback of that exact repair:

```bash
python goodwatch-flows/scripts/streaming_identity_republish.py rollback --media movie --ids 42 --cap 1 --manifest /private/streaming-repair/sample.plan.json --backup-path /private/streaming-repair/backups
```

Rollback requires current source and streaming-owned target state to match the receipt. It restores only the title scope and owned aggregate columns, preserving other titles and unrelated metadata. Durable per-step intents/readbacks make interrupted rollback resumable; an unexpected newer row or source change stops restoration. Retain the manifest, private backup, receipts and affected-key audit. This task has not run a production repair.

## Operational rollback

Disable new selection, opened-demand consumption and publication independently. Restore the previous scheduled selector with `availability_selection=false` and its prior schedule/pace, retaining shared claims, pacing and the global safety gate. Stop the replacement selector before restoring legacy scheduling; do not run independent competing limiters.

Keep valid provider/link observations, registry membership, checkpoints, pending changes and accepted-open timestamps. Do not bulk-delete evidence or clear failures to accelerate work. On a mapping mismatch disable/revert the specific publisher and recover through its existing pending-intent path. A historical repair rollback uses only its matching private backup and guarded receipt; it is not a general database rollback.
