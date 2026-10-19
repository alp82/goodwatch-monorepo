# TV Time background resolution: job mechanism checkpoint

Status: proposed implementation mechanism, not implemented or enabled. The orchestrator approved background resolution, watched-parent priority and strict movie suggestions with bulk acceptance on 2026-10-19, and explicitly requested a proposal and stop if there was no reusable job mechanism. This document covers that checkpoint. It does not change the approved matching rules or the scope of map #365.

## Existing mechanisms and the missing boundary

Windmill is the repository's durable job infrastructure. `f/sync/copy/personal_order_trigger.py` enqueues scripts with `wmill.run_script_by_path_async`; its worker consumes a shared dirty set and reconciles missed work on later scheduled runs. The webapp's personal-order writer only marks the Valkey dirty set. There is no reusable Windmill-to-webapp job adapter in the current webapp.

Native import confirmation is different: `confirmImport()` claims a Crate import row, then starts `void applyRun(...)` inside the web process. Its heartbeat and stalled state permit explicit resumption; it has no automatic durable queue or restart dispatcher. It must not be reused unchanged for this feature.

The reusable pieces are Windmill execution, Crate `_seq_no`/`_primary_term` claims, persisted import/item JSON, and shared Valkey coordination. The proposed addition is a narrow import-job adapter on these pieces, not a new broker or queue dependency.

## Recommended mechanism

Use a Windmill driver that calls a private TypeScript resolution-step endpoint. Keep parsing, identity checks, suggestions and child-preview construction in the webapp so the job uses the shipped resolver and manual matching path instead of maintaining Python copies.

Proposed files and boundaries:

- `app/server/imports/resolution-job.server.ts`: durable state, claims, bounded work steps, progress, cancellation and child-preview publication.
- `app/server/imports/resolution-tmdb.server.ts`: shared admission and HTTP budget for both identity and movie-suggestion lookups.
- `app/server/imports/tvtime-suggestions.server.ts`: the approved strict title/date rule and immutable evidence proof, invoked only by the job.
- A private Remix POST route for one bounded driver step, authenticated with a dedicated server credential, redirects forbidden and request body bounded. It accepts opaque import/job references; it cannot Confirm, Undo or invoke member tracking writers. No member session or source records are passed through Windmill.
- `f/imports/resolve_tvtime` plus a bounded pending-job reconciler: Windmill execution/retry and recovery after a failed or uncertain initial enqueue. The driver stores no source rows or movie names in job arguments/results/logs.
- Existing preview, matching and confirmation services: cached-only upload matching, progress projection, explicit cancellation, typed individual choices and one-child bulk acceptance.

### Persistence and recovery

Avoid DDL by placing a versioned resolution envelope in the existing import `options` JSON and per-item resolution evidence/proposals in existing item `payload` JSON. Keep immutable original evidence separate from enrichment. Do not put the whole export or a large candidate map in the import-level envelope.

The envelope holds job ID, root/active preview IDs, state, phase/cursor, generation, lease token/expiry, request count, overall deadline, progress counts, snapshot version and published replacement ID. Item checkpoints hold terminal lookup evidence or held/failed codes and suggestion proofs. Large candidate enumeration must have bounded page/candidate cursors and fail closed when its evidence cannot be completed within the declared limits.

Important compatibility requirement: `confirmImport()` currently treats any non-null `options` as already chosen import options. Introduce explicit envelope parsing; job metadata alone must not replace the member's early Confirm options with undefined values. Preserve the existing apply/Undo options and semantics.

Each step claims via Crate OCC, and checkpoints before advancing its cursor. A crash can repeat reads and positive catalog-cache writes, but cannot apply an import or publish a second child. Restart recovery discovers pending/expired-lease jobs from persisted import state, independently of a browser visiting the page. Initial enqueue is an optimization; the reconciler closes the persist/enqueue gap.

Use a deterministic replacement identity plus an OCC-fenced publication pointer. Unpublished partial children are never exposed as the replacement. Publication verifies that the job generation and active preview are still current. Concurrent member choices are preserved; stale job work cannot replace a newer accepted/manual choice. A lost lease cannot publish.

### Scheduling and limits

Proposed defaults, configurable downward:

- Watched parents first; then their episodes; then remaining show/status/wish parents; then movie suggestions. Keep all existing unique typed identity, parent and live-catalog checks. Never establish identity from numbers alone.
- Four active TMDB requests globally across import workers, with starts spaced to at most 20/second; fair bounded batches between imports.
- One job per root import, at most two active root imports per member, five active jobs globally and 32 queued jobs globally. Refuse excess admission explicitly; do not silently lose work or multiply per-preview request budgets.
- 25,000 HTTP attempts per import job, including retries and movie discovery/verification; 30-minute overall deadline from enqueue. Reaching either bound makes remaining rows held with a specific limit code, not an outage. A new explicit retry must receive a new bounded budget.
- Ten-second work steps, 30-second leases, lease refresh during work, five-second HTTP timeout, at most three attempts per lookup. HTTP 429 Retry-After sets a shared cooldown across workers.
- Checkpoint in bounded batches; keep successful and definitive negative evidence for this job. Do not persist a provider failure as a negative identity. Do not create a permanent negative catalog cache.

The current generic Valkey limiter has a memory fallback. That fallback is unsuitable for a strict cross-instance TMDB limit: resolution must pause when shared coordination is unavailable. Existing ingestion scripts have local pacing/concurrency, not one repository-wide TMDB limiter. The new permit must be shared by every import worker and both background phases; its scope must be documented rather than claiming that unrelated ingestion traffic is already covered.

### Cancellation and early Confirm

Discard cancels the root job and invalidates its publication generation. The worker checks cancellation/ownership before starting requests, checkpoints and publication; outstanding HTTP requests are aborted locally or bounded by timeout. Later callbacks return a terminal cancelled result. Discard must not rely on the page merely dropping its local preview ID.

Early Confirm uses only the currently matched preview rows. It fences off automatic replacement of that preview and stops further resolution for that root. The job never runs apply or changes member watches, ratings, wishes or show statuses. Positive catalog caching is the same limited side effect as the shipped resolver.

### Movie acceptance

Preserve source country alongside full calendar date in immutable parser evidence. Use the approved exact normalized title plus exact primary/source-country premiere or theatrical date rule. Require one qualifying TMDB candidate before typed GoodWatch movie validation. Incomplete discovery/verification is held.

Persist the full approved proof: rule/version, typed target, source fingerprint, matched title kind/locale, date basis, country/release type, candidate count, completeness and verification time. Keep member acceptance separate from provider evidence.

The suggestion snapshot token is opaque and server-owned, bound to member, active preview, job/snapshot generation and expiry. It covers all pages. Bulk accept validates the complete snapshot and creates one child through the existing projection path, preserving original evidence and source watch keys. Repeated acceptance is idempotent. Individual accept/reject also uses that projection path. Acceptance prepares matching; Confirm applies intents. Suggestions arriving later do not enlarge an already accepted snapshot.

## Proposed API projection

The member's preview response exposes:

- `resolution`: job ID, state (`queued`, `running`, `completed`, `cancelled`, `limited`, `failed`), phase, total, processed, matched, held, pending, failed, held/failed counts by code, updated/heartbeat time, deadline, retry-after and replacement preview ID.
- `suggestions`: paginated existing proposal/group fields, suggestion ID and rule/evidence signal, plus aggregate suggested/manual/held counts and snapshot version.
- `bulkAccept`: opaque snapshot token, eligible count and expiry. The count covers every page, not just the currently visible suggestions.

Add a member-owned cancel action. Bulk accept returns the fresh child ID, parent ID, accepted/skipped counts and codes. Stale tokens receive a specific review-again response. Get/progress calls never perform TMDB suggestion lookups in the request path.

## Deploy order

No schema change is proposed. The already required `show.tvdb_id` column remains a prerequisite from the shipped convergence work.

1. Deploy the webapp adapter/private endpoint with job activation disabled, and provision its dedicated server credential.
2. Sync the Windmill driver/reconciler and provision only its required callback configuration. Follow the existing pinned workspace sync; regenerate/review script metadata and dependency locks where needed.
3. Enable the recovery schedule and verify callback authentication, shared Valkey admission and restart recovery with synthetic jobs.
4. Enable TV Time background jobs, then expose the frontend after review. Rollback disables admission; already queued callbacks safely observe disabled/cancelled state.

Do not rely only on Windmill's declared script concurrency fields: existing repository notes record CE behavior that requires operational leases as well.

## Test seams after the mechanism decision

Use the public preview/progress/cancel and individual/bulk-resolution services, with fake database, clock, queue and HTTP boundaries. Cover cached-only upload with no provider requests; watched-parent priority; two-worker admission; crash/lease recovery; cancellation; early Confirm; one-child publication under replay; member-choice/publication races; global outage/429 behavior; strict unique suggestions and incomplete holds; immutable evidence; accepted-snapshot paging; Confirm/re-import/Undo.

Run the imports server, legacy IMDb, imports UI and tracking suites, and compare typecheck against 185. Run the private export only through the read-only adapter, intercepting cache writes in memory, and report convergence, suggestions and request aggregates. None of those new-feature checks has run at this decision checkpoint.
