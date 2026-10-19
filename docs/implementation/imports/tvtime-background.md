# TV Time background resolution (#629)

Built on `fix/tvtime-real-export` following the 2026-10-19 in-process job decision and owner Q15/Q28. The [Windmill proposal](tvtime-background-proposal.md) is superseded. This changes the server pipeline, plus the existing preview polling guard; it adds no source row or match-panel UI. Map #365 is unchanged.

## Execution and deployment

`service.previewImport()` uses a cached-only TV Time preview: catalog identities already stored in Crate are trusted without TMDB revalidation. The upload performs no remote identity or suggestion lookup. After durable admission, a detached webapp run starts through `resolution-runtime.server.ts`, like the existing detached Confirm writer. `entry.server.tsx` starts its reconciler through `connectionCleanup`, the same lifecycle facility as TMDB Connect: first sweep after one second, then every minute. Search-only processes do not start this loop. Normal webapp processes require the existing `TMDB_API_KEY`; there is no new endpoint credential, Windmill driver, schedule, queue service or dependency.

All metadata uses dedicated `user_import_item.kind = 'resolution'` rows. The root job occupies row index -1 on its import; auxiliary rows use reserved `resolution:` import IDs. The full primary key plus Crate `_seq_no` and `_primary_term` fences each write. Import `options` is untouched. Summaries, item lists, Confirm, result and recount exclude these internal rows. There is no new schema or flows deployment in this change. The previously documented `show.tvdb_id` column prerequisite still applies to installations missing that earlier migration; no new migration is required here.

A singleton OCC row admits one active root per member and two globally. A third receives a coded 409 rather than entering a queue. Its reservation retains the original deadline, including recovery between reservation and initial checkpoint. Claims use a 60-second lease, refreshed every 10 seconds. An expired run is re-claimed from its checkpoint by a startup/minute sweep; a second claimant cannot own the same generation. Process shutdown needs no external driver: later sweeps recover an expired lease. No import is applied by a job.

## Limits, checkpoints and identity

- Work order: watched parents, episodes, remaining parents/statuses/wishes, then movie suggestions. An episode-only export can establish its parent through its TVDB episode identity; episode numbers never establish identity by themselves. Shared resolver parent/uniqueness/live catalog checks remain in force.
- Source reads and enrichment checkpoints hold at most 200 item rows each, using keyset paging. Movie work checkpoints four groups at a time. Each metadata value is limited to 2 MiB. Group evidence retains at most two distinct normalized values per field: two already establish a contradiction, and later variants cannot erase it.
- The existing preview planner still assembles up to the existing 50,000 useful observations for final publication and member projection. Working pages are bounded; the entire publication planner is not constant-memory. Suggestion pagination keeps at most 50,000 lightweight source-index/key pairs to preserve the existing panel's order, retrieving full proofs only for the requested ten groups. Member decisions are read in 200-row pages into a bounded lightweight map, rather than one database lookup per group. The 105-group panel regression reduces 134 database reads to at most 24. Decision writes explicitly refresh before the next paged search, so an immediate read cannot offer a just-rejected or accepted group again.
- The existing rate limiter permits 20 starts/second keyed by the hashed TMDB key, with its existing per-process memory fallback. The transport shares a four-request semaphore per process across jobs/phases. Valkey coordinates starts when available; its Retry-After cooldown is best effort. Without Valkey, four in flight and 20 starts/second apply per process, not across all webapp instances or unrelated ingestion scripts. Valkey failure never gates resolution.
- Each import has 25,000 actual HTTP attempts, including retries, and 30 minutes from admission. Each lookup has a five-second timeout and at most three attempts. HTTP 429 honors Retry-After seconds or HTTP-date; missing headers use bounded exponential delay. Ordinary failures also retry with delay. Attempt reservation and every checkpoint re-check ownership/generation; checkpoint cursor advancement is OCC-fenced. A crash can repeat safe reads/cache writes, but not apply member intents.
- Immutable parser observations are saved separately as `resolutionOriginal` before initial matching. Enrichment checkpoints never replace this evidence. The episode resolver may correct placement after establishing identity, while preserving the original placement. Positive show/episode TVDB identities use the already-shipped catalog cache writes. Provider failures are never negative identities. Successful negative/raw lookup responses are job-scoped, and cache/parent/enrichment rows are deleted after completion/cancellation/limits; receipt reasons and suggestion proofs remain audit evidence, not a cross-import negative lookup cache.
- `tvtime_lookup_pending`, `tvtime_lookup_budget_exhausted` and `tvtime_lookup_unavailable` distinguish active work, a bounded partial result and provider failure. Parent and episode phases preserve the same lookup codes. A limited run publishes available matches and leaves the rest held. A later explicit upload starts another bounded job and benefits from positive catalog identities.

A deterministic child ID includes the job nonce and generation. The child is private until an OCC update publishes its replacement pointer. Check ownership before every checkpoint, insertion batch and publication; a lost lease/generation cannot publish. Partially inserted/unpublished children cannot be opened through member APIs. A member match creates a new generation and active preview, invalidating stale projection work. Publication reads the latest member projection and preserves explicit choices. Discard invalidates the generation and aborts local requests; another process observes cancellation before writing its next checkpoint. Early Confirm cancels resolution before claiming the existing writer and applies only the selected preview. Confirm, Undo, source play keys, additive wishes and Seen-title rewatch choices keep their existing behavior.

## Strict suggestions and acceptance

Suggestions run only in the background. Group by the native source movie identity, not its name. Preserve source country from official exports. Combine supplied full dates within that identity; a missing date on one observation does not contradict the consistent full date on another. Invalid nonempty dates, differing supplied dates/titles/countries, or no full date hold the group. Original blanks stay blank.

Rule `tvtime_exact_title_release_date_v1` requires an exact NFC/trimmed/lowercase/whitespace-normalized title against TMDB primary, original, alternative or translated names. No fuzzy matching, punctuation removal or accent folding. Require the exact primary calendar release date, or a premiere/limited-theatrical/theatrical date (types 1/2/3) in the explicit source country. Never substitute an arbitrary country's release or a digital/physical date.

Enumerate every TMDB search page, up to five pages and 100 distinct candidates, and verify every discovered candidate, including those absent from GoodWatch. Truncated search, failed verification, multiple qualifying candidates and missing typed catalog movies stay held. Exactly one qualifying candidate must also exist as a typed GoodWatch movie. Discovery completeness means the complete bounded TMDB search response, not a claim that TMDB search enumerates every movie in existence.

The proof records rule/version, typed target, source fingerprint, matched title/value/kind/locale/country, date/value/basis/country/release type, source country, one qualifying candidate, number verified, complete discovery/page count and bounds, and verification time. Alternative-title language is unknown (`und`), rather than invented from its country.

An opaque server-owned snapshot token covers every eligible page. It is bound to the owned job's member, active preview and generation, expires after 30 minutes and is renewed on reading an unchanged completed/limited preview. A choice or replacement changes the snapshot. Bulk acceptance reads server proposals, verifies fingerprints and revalidates typed catalog targets through the shipped manual projection path; the client cannot supply alternate bulk targets. One deterministic child contains all accepted groups. Accepted proof is retained on `wishlistResolution.suggestionProof`; original watch/rating/For later evidence is unchanged. Repeating a successful token returns that child, including recovery if the process stopped after publication but before saving its acceptance receipt. Individual accept/reject uses the existing resolve endpoint; member decisions supersede suggestions. Acceptance prepares matching only. Confirm remains the only step applying watches, supported ratings, statuses or wishes.

## Frontend API contract

Existing authenticated summary GET returns optional `resolution`:

| Fields | Meaning |
| --- | --- |
| `jobId`, `state`, `phase` | Opaque job identity; queued/running/editing/completed/limited/failed/cancelled; current work phase |
| `total`, `processed`, `matched`, `held`, `pending` | Source observations, not distinct titles; matching a suggested movie still requires acceptance, so it remains held |
| `heldByCode`, `failed`, `failedByCode` | All hold counts, with provider/worker failures separately counted; ordinary no-match/manual-review holds are not outages |
| `attempts`, `updatedAt`, `deadline` | Actual HTTP attempts and ISO timestamps |
| `replacementId` | Published child to load; never points at unpublished work |

The existing hook keeps polling while resolution is queued/running/editing. The frontend thread must display progress and follow `replacementId`; this backend commit does not add those components. Summary counts describe the specific requested preview; resolution progress describes the root job. Parent lookup can make progress before observation counts change. Matching is finished only when state is terminal, not when `processed == total` during publication.

Existing match groups retain original row evidence (now including source country), representative indices and member-resolution projection. Existing suggestions GET adds `suggestionId`, `proof`, `state`, `proposal` (typed movie ID/title/year/poster) and reason code to each group. Pagination stays `offset`/`nextOffset`/`hasMore`, ten groups per page in source order. It also returns `bulkAccept: {token, eligibleCount, previewId, generation, expiresAt}` over all pages. A null token means the snapshot is not ready or has no eligible groups. Individual rejection returns the group to manual review.

- `POST /api/imports/:id/resolve`: existing `{choices:[{index,target}]}`. Select the suggested movie as the typed target to accept individually; `target:null` rejects/clears it. Creates a fresh child.
- `POST /api/imports/:id/accept-suggestions`: `{token}` only, bounded 32 KiB JSON. Returns `{import,parentImportId,acceptedCount,skippedCount}` with status 201. Counts are groups; accepted intents remain unapplied. A replay returns the original child/counts.
- `POST /api/imports/:id/discard`: invalidates the background generation and returns `{resolution}`. The page must call this when discarding an import rather than only deleting its local ID.
- Existing Confirm and Undo endpoints remain the application boundary. Keep current kind/date selection and explicit Seen-title rewatch choice. No bulk-accept action may imply Confirm.

## Member-facing copy

New or changed server strings:

| Code | Text |
| --- | --- |
| `tvtime_lookup_pending` | GoodWatch is still matching this title. |
| `tvtime_resolution_member_busy` | You already have an import matching. Wait for it to finish or discard it. |
| `tvtime_resolution_global_busy` | Two imports are already matching. Try again after one finishes. |
| `tvtime_resolution_busy` | Import matching is busy. Please try again. |
| `tvtime_preview_replaced` | This preview has been replaced. Review the latest preview. |
| `tvtime_preview_changing` | This preview is changing. Try again in a moment. |
| `tvtime_preview_discarded` | This preview was discarded. Upload the file again. |
| `tvtime_suggestion_stale` | These suggestions have changed. Review them again. |
| `tvtime_suggestion_request_invalid` | Choose a current set of suggestions to accept. |
| `tvtime_suggestion_empty` | There are no suggestions left to accept. |
| `tvtime_suggestion_limit` | This import has too many match groups. |

Existing budget text stays “This preview reached its lookup limit. Run the import again to match more.” Existing outage text stays “TMDB's TVDB lookup is unavailable; retry this import later.” `episode_tvdb_catalog_missing` now explicitly codes the existing “The TVDB episode is missing or ambiguous in this show's current catalog.” reason.

Suggestion reason codes for the frontend: `conflicting_source_evidence`, `tvtime_suggestion_pending`, `tvtime_suggestion_search_incomplete`, `tvtime_suggestion_unavailable`, `tvtime_suggestion_no_exact_match`, `tvtime_suggestion_ambiguous`, `tvtime_suggestion_catalog_missing`, `tvtime_suggestion_rejected`, `tvtime_lookup_budget_exhausted`. These codes currently carry no new rendered panel copy. Proposed frontend labels: “Matching episodes…”, “Checking movie suggestions…”, “Accept all suggestions”, and “Matching couldn't finish. Import the file again to retry.” for `tvtime_resolution_failed`. The frontend owner should distinguish incomplete search/manual review from a provider failure.

No source rows, titles, provider IDs or member IDs are written to logs by this job. The reconciler's fixed operational error text is “Import matching recovery is unavailable; pending work will be retried.”

## Verification

Test-first coverage exercises cached upload, watched-parent priority and episode-only parents, 200-row paging, restart mid-step, double claim, generation checks at checkpoint/publication, cancellation during requests, early Confirm, member-choice publication races, hidden children, budget/outage codes, admission-gap deadline preservation, complete strict proofs, malformed/incomplete/ambiguous verification, all-page bulk acceptance, snapshot refresh/ownership/staleness, receipt-gap recovery, immutable evidence, explicit Confirm/re-import/Undo, job-only negative caching, and the existing polling guard. The private real-export run uses allowlisted production SELECTs and TMDB GETs only, with import and positive catalog-cache writes intercepted in memory. It never calls Confirm or writes production member/catalog state.

Validation on this implementation: imports server **372 passed**, legacy IMDb **12 passed**, imports UI **101 passed**, and tracking server/domain **313 passed** with one existing TODO, zero failed. Typecheck retains **185 diagnostics**, with zero normalized additions/removals against the saved main baseline; exit status remains the baseline 2. Biome passes on all 34 changed TypeScript files, and `git diff --check` passes. No production writes, push, merge, issue edits or resolution comments were made. Real-export timing and aggregate outcomes are recorded separately below after the final read-only run.
