# Streaming availability rollout spec — October 26, 2026

Status: final planning handoff. The owner adopted the combined polling/demand plan on October 26 after approving the tier and block-policy decisions. All design choices for this conservative rollout are settled. This spec defines implementation and release acceptance; it does not claim those changes are deployed.

Decision details remain in the map's resolution tickets: [provider churn](https://github.com/alp82/goodwatch-monorepo/issues/689), [HTTP/2 client](https://github.com/alp82/goodwatch-monorepo/issues/690), [Niger and 404 handling](https://github.com/alp82/goodwatch-monorepo/issues/691), [provider identity](https://github.com/alp82/goodwatch-monorepo/issues/692), [TMDB note](https://github.com/alp82/goodwatch-monorepo/issues/693), [page ramp](https://github.com/alp82/goodwatch-monorepo/issues/695), [tier plan](https://github.com/alp82/goodwatch-monorepo/issues/696), [block policy](https://github.com/alp82/goodwatch-monorepo/issues/697), and [combined polling/demand plan](https://github.com/alp82/goodwatch-monorepo/issues/772). This document assembles the resulting implementation contract.

## Destination and fixed scope

Provider availability and direct-link verification are separate jobs with separate evidence timestamps. Use the non-commercial TMDB API for provider lists and honest GoodWatchBot HTTP/2 watch-page reads for direct links. Preserve TMDB/JustWatch attribution and original clickout URLs. No JustWatch scraping, unofficial API, browser impersonation, egress switching on blocks, IPv6 lane or paid proxy. Cost of the baseline is $0/day on existing infrastructure. Existing daily service-list history processing remains a separate workflow and retains its own precision contract.

## Reuse existing logic

Build the additions at three existing locations:

- **Provider observations:** extend `f/tmdb_api/provider_evidence.py` and the existing title-provider payload/proof fields in TMDB detail records. Validated observations from the metadata fetcher, `daily_provider_lists.title_checks` and the detector use the same persistence/diff path. Reuse an observation only when its actual check time, scope and provenance satisfy the requested freshness; publishing it again does not refresh its time. Older arriving observations cannot replace newer evidence. Keep the daily-list reader's same-day and list-conflict recheck rules and its existing history writer. Its temporary SQLite cache can remain a per-run optimization.
- **Demand and selection:** keep `crawl_priority` as the title demand record and the current Mongo country documents as the page-work records. One availability selector derives opened, changed, popular and sweep eligibility from timestamps and counters. Store coalesced pending provider-change revision on the existing country record; a successful page claim can clear only the revision it actually handled. No separate tier queues, opened-message acknowledgment, consumer offsets or replay infrastructure are needed. General metadata acknowledgment remains unchanged.
- **Page admission:** extend the current `country_state` gate and country-claim logic through one page-admission module used by every legacy and new page caller. Callers request admission and report the outcome; shared pacing, six expiring in-flight permits, daily counters and the post-probe rate schedule stay inside that module. Reuse existing gate generations, leased probes, failure classification and backoff. Do not build a second recovery subsystem or a general adaptive-rate controller.

The daily service-list reader does not replace registry polling: its discovery scope is 15 configured provider identities and subscription/free/ad offers, and its per-title checks follow list changes/retries rather than every registered title. The measured ordinary run had 18,950 potentially reusable complete title-provider reads and 150,054 discovery reads. Only the former can satisfy a title-provider freshness check, and their unique-title overlap with detector work has not been measured. The detector polls the remaining due observations rather than duplicating a separate ingestion path.

The shared provider write is a narrow conditional update of provider payload/proof and provider-attempt/error fields. Preserve the existing normalized payload hash and proof continuity. Detector/list callers must not invoke `convert_and_save_details` or change general metadata `updated_at`, selection state or lease ownership. Metadata callers use the same provider operation without letting a later full-document save overwrite a newer observation. Publish changed provider observations through the existing targeted streaming transformation with explicit title IDs; do not advance metadata freshness to trigger publication or run the full enrichment publisher for a provider-only change.

## Approved operating envelope

The page ceiling is **1.3 total wire requests/second**, across all workers, not per worker and not additional benchmark traffic. Every redirect, retry and canary consumes an admission. The failed-to-complete ramp proves no higher sustained rate and no per-IP/global limit. Random Windmill worker selection is preserved.

Page work uses the existing expiring, fenced title/country claims and one shared capacity-one limiter. HTTP/2 jobs keep a connection for up to 20 root pages, with a global six-request in-flight ceiling and expiring permits. Pacing and concurrency are distinct: stalled requests still count against the six permits. Workers fail closed if shared pacing/gate state cannot be read. Never keep an indefinitely held lease or classify a claim timeout as missing availability.

Opened priority lasts 24 hours and is capped at 20,000 pair attempts per UTC day. Changed/new pairs are capped at 30,000 pair attempts/day; unserved changes remain durable pending state on their country records. Popularity ≥20 pairs are due weekly. Everything else is swept by oldest verified-link time, with no-link pairs first within equal age. At least 10% of wire admissions go to the sweep when it has work; unused allocations may be borrowed. Implement these budgets as shared counters and selection rules in the same selector/admission path. These caps do not exempt redirects/retries from the shared limiter. A pair eligible in several tiers is claimed only once; successful verification satisfies its due conditions but must not erase a newer provider-change revision.

Actual throughput is measured after deployment; model outputs are estimates. The current catalog snapshot has 8,248,715 eligible title/country pairs, excluding Niger. The approved cohort model estimates 93,299 successful pair slots/day at the page cap, 10% downtime allowance and observed request-to-200 yield. It clears the initial background no-link cohort in 126 days, with a 247-day background link cycle. It does not promise a 30-day direct-link age. Changes invisible to provider-set diffs, including link/price/quality changes, wait for opened/popular/sweep work.

## Evidence and publication contract

A successful complete title API response records provider IDs by country/offer type, the API observation time and its provenance. Compare sorted provider-ID sets, ignoring names/order/logos/priority/links. A failed, partial or structurally invalid response cannot advance the observation or remove an offer. Preserve unknown versus verified empty. An API-only change can update provider membership without claiming a direct link was verified.

Persist these validated observations through the shared provider-evidence path before scheduling new detector HTTP reads. Reuse existing validation, snapshot identity and history publication rather than adding another history writer. Sharing observations must not weaken a list reader's conflict recheck or let cached/incomplete evidence establish an exact day or verified absence.

Link evidence records the country-validated page time independently. A valid no-offers page is a successful check; a missing offer container, unknown offer type, bad country or ambiguous provider identity is an error. Identify clickout providers by embedded providerId, not fuzzy page labels or an alias table. Where the current API provider has no verified matching link, link to TMDB's country-specific where-to-watch page. An old link must not reintroduce a provider absent from newer provider evidence. Availability whose own evidence is 30 days old is Unknown; old link age alone is not provider absence or stale provider evidence.

The provider detector must not overwrite the existing availability-history precision contract: first observations and gaps remain unknown precision. Daily service-list evidence can remain stronger for exact-day stays. Preserve current writer leases, pending intents and retry semantics rather than creating a second independent history writer.

## Recovery

A genuine challenge, 403 refusal or 429 stops normal page admissions globally. Respect Retry-After and use the existing exponential/jittered upstream gate otherwise. One fenced canary probes after the deadline; only a valid country-matched watch-page parse reopens service. A failed probe extends backoff without marking each title failed. Keep API work separately governed. Preserve actual timestamps and offer evidence while blocked; no egress/source changes are made to get past it.

After a successful canary, restart at 0.325 req/s (25% of cap). Add 0.1 req/s after each clean ten-minute interval, capped at 1.3. This is a deterministic post-probe schedule within page admission, not an autonomous search for a higher rate. A further refusal reopens the existing gate; transient 5xx/transport issues use bounded retries and cannot produce empty publication. Parse/markup errors are reported separately. Add the gate-duration, sustained-parse-error and opened/changed-backlog-over-24-hours checks to existing monitoring; no new monitoring or recovery framework is required.

## P0 — Correct known waste and classification

Skip page work for Niger (keep API availability; one monthly canary), countries with a verified complete no-offers observation and confirmed-deleted titles. A country omitted from an unproven API scope remains unknown; omission alone does not authorize deletion or a verified negative. API-confirm page 404s before marking deletion; an API-present title refreshes its canonical URL and returns through normal eligibility. Resolve clickout identity with providerId. Replace substring-only challenge detection: the ordinary film Just a Moment must parse successfully, while real interstitial structures/headers and access refusals still stop the upstream.

Proof: fixtures from the ordinary Just a Moment DO watch page and actual interstitial patterns; valid/invalid-country and verified-empty cases; unknown provider identity; page-404/API-present and page-404/API-missing cases. Use a 30-minute live observation only after deployment: zero ordinary Niger attempts and separate classified errors; do not set a target that hides legitimate source failures.

## P1 — Provider detector in shadow

Approved detector allocation: daily API checks for popularity ≥5 and accepted opens, with a seven-day sweep of other registered titles. The measured initial registry scope is 383,798 titles with current offer rows or prior provider-check timestamps, including formerly offered titles, plus newly published titles. Keep titles registered after zero-offer results. Do not poll all 1.5 million raw imported catalog rows. Use a shared detector bucket at 3 wire req/s and a shared hard 100,000-request UTC-day ceiling including retries/reruns. Run only in 00:00–12:00 UTC; pause while the prior daily service-list run remains active, and carry due work forward if the window or budget expires. Existing API users retain their own rates; do not confuse the detector allocation with aggregate API load. Schedule cold baseline cohorts by a stable hash of canonical media type/TMDB ID modulo seven UTC day slots; persist failed or deferred due work rather than silently advancing its next success date. Recompute due eligibility from the last valid provider observation when popularity or opened status changes. A complete per-title response covers all supported countries and all offer types. Establish a first baseline without inventing changes or exact history days. Compare subsequent observations and count changed pairs by tier before enqueuing pages.

Release proof for the daily cohort: complete observation counts and per-title gap distribution, API request/retry/status/p95 counters, budget adherence, and three complete UTC days of shadow diffs for that cohort. Compare with the frozen 20k-title churn experiment without treating those two days as a permanent ceiling. Confirm coexistence with the enabled daily service-list workflow at 14:00 UTC and other TMDB API consumers.

Weekly coverage proof runs in the background: complete the cold baseline and observe a second complete cold pass before claiming weekly coverage across the registry. This is not a blanket two-pass prerequisite for releasing a verified daily cohort. A cold title's first valid observation remains a baseline with unknown precision; it cannot establish a change or exact day merely because the daily cohort has passed its checks.

## P2 — Tier claims, pacing and opened demand

Deploy queue selection and batched HTTP/2 at the approved cap behind separate operational toggles for shadow selection and publication. Approved opened semantics: reuse the existing impression endpoint validation/transport and canonical crawl_priority row, adding an explicit last_opened_at timestamp. The title hero already records ordinary poster demand; distinguish actual title-page/TV-title views from list posters with a backward-compatible source kind (omitted means poster) and separate 30-minute deduplication. An opened signal requires one continuous second with that title view active in a foreground document; it must not depend on a poster being present. Browser-side opened deduplication expires after 30 minutes too; a prior list impression cannot suppress an open. Avoid the current in-tab seen set suppressing real opens after a listing. General metadata counters, acknowledgment and the seven-day full-refresh cooldown remain independent. Availability workers read the accepted-open timestamp for 24 hours and check provider/link evidence against a 24-hour due threshold, preserving active claims, failure backoff and upstream gates. Prefetch and background loading do not raise opened demand. A recent valid API check from an existing flow satisfies the provider due condition. Do not treat metadata acknowledgment as a country-link verification. The crawler does not depend on analytics consent or PostHog ingestion. Preserve current country fencing and upstream-gate semantics. Update provider and link evidence independently and avoid duplicate work across tiers.

Proof: real shared-store multi-worker admission/claim/expiry checks, including 12 concurrent claimers; restarts and lost shared state; late completion cannot publish under an expired lease; token rate ±10% over a clean observation interval; every wire request is charged; batch sizes stay ≤20. Verify opened/changed caps, protected sweep progress and unused-budget borrowing. Replay an opening spike and a change storm. Measure actual successful verifications and freshness per tier, not only admissions.

## P3 — Capacity decision

Complete for the conservative rollout: retain 1.3 req/s. Do not rerun the three-day ramp as a rollout prerequisite. Raising the ceiling needs a future explicit experiment after P0 classification is fixed; its result must be based on complete intervals and total source load. Neither the 3.48-hour partial ramp nor the API benchmark licenses a higher page rate.

## P4 — Recovery proof

Reuse the existing global gate and single fenced canary; add only the approved admission pacing/permit accounting and slow-start schedule. Integrate these recovery checks into the scheduling change's acceptance. Exercise synthetic refusals and loss/recovery of shared-store state on scratch gate documents, never by provoking production TMDB blocks. Verify no ordinary admissions during a block, no per-title failure amplification, no path switching and recovery at the intended ceiling. Use existing production monitoring for blocked duration and freshness counters, without duplicate alerts.

## P5 — Outreach disposition

Already settled: no TMDB note; JustWatch partner data access is outside budget. Do not send an email or register a new service as part of implementation. Widget/free-fallback additions are deferred for this rollout; no unauthenticated widget token is assumed available.

## P6 — Reconcile existing split rows

Use clickout providerId and the current catalog service identity. Do not create the superseded page-name alias table. Prepare a read-only inventory of affected title/country pairs and a bounded republish plan using the existing canonical publisher. Back up before any repair, preserve provenance and history, and make the repair restartable/idempotent.

Proof: run the same split-row query before/after a bounded sample, account for every removed duplicate and unmatched offer, verify representative Apple TV service 350 versus store 2 identities, and retain an audit of affected keys. Scale only after the bounded proof; no unsupported numeric near-zero target can justify deleting unmatched evidence.

## P7 — Optional integrations disposition

Explicitly deferred: widgets, free external availability APIs, proxies and IPv6 lanes. The baseline depends only on existing TMDB sources. These are not implementation prerequisites or unresolved choices in this handoff.

## Release and rollback

P0–P7 remain traceability labels, not eight independent projects. Implement three reviewable increments:

| Increment | Existing phase labels | Deliverable |
| --- | --- | --- |
| 1. Classification and evidence | P0 and the shared evidence part of P1 | Known parser/identity fixes and one provider-observation path reused by existing readers and the detector. |
| 2. Demand and scheduling | Remaining P1, P2 and P4 | The opened timestamp extension, bounded detector, one availability selector and one admission module; existing claims/gate/history logic reused. Recovery proof is part of this increment. |
| 3. Historical repairs | P6 | A separately backed-up, bounded republish through the verified publisher. Repairs do not block safe publication of newly verified data. |

P3/P5/P7 record settled capacity, outreach and optional-integration dispositions; they require no implementation projects. Keep the tests and observations below as recorded checks using existing test/monitoring facilities. Job arguments and manual readbacks are sufficient for the release stages; do not add rollout orchestration infrastructure.

Start increment 2 with shadow selection/publication-disabled mode. After the daily cohort's three shadow days and the integrated recovery checks pass, the first publication canary is the first 100 nondeleted registered titles with popularity ≥20 ordered by canonical media type/TMDB ID, restricted to DE/US countries where current complete provider evidence shows offers (at most 200 root country pairs). Record skipped/unavailable pairs. Observe a complete 24-hour interval, comparing provider and link evidence, before enabling the remaining popularity ≥20 work. Observe another complete 24-hour interval before enabling the full background selector for titles with their own validated provider observations. Unobserved titles remain unknown, and first observations retain baseline precision. Stop expansion on refusal, budget breach, stale pending high-priority work or publication mismatch; retain the same canary stage until its proof passes. The approved global gate and global page ceiling apply throughout. The DE/US canary establishes only its tested cohort; retain country-validation checks and classify failures during wider rollout rather than claiming worldwide parser coverage from it.

Rollback disables new selection/demand consumption/publication separately and restores the previous scheduled selector at its old pace, while retaining the global safety gate. Do not run both selectors without shared claims and pacing. Keep valid observations/checkpoints and pending demand; do not bulk-delete evidence or reset failure state to force work through. Disable/revert the specific publisher on a mapping mismatch and recover through the existing pending-intent path. Any repair rollback uses its pre-repair backup and affected-key audit.

## Implementation acceptance and evidence

The existing queue is reused, with independent availability freshness. Acceptance includes list-then-open, direct entry without a poster, TV title view, ignored prefetch/background loads, source-specific deduplication, metadata acknowledgment that cannot erase opened demand, API/page observations that independently satisfy freshness, country-scoped claims, empty/deleted/unsupported-country handling, alias canonicalization, shared daily budgets across retries/reruns, a delayed daily service-list workflow, window expiry with retained due work, and unknown precision on first baseline.

The three-request/second API experiment completed 60,000 observations across three rounds, and independent recomputation matched all saved churn counters. The page ramp did not complete a full day. Local Chromium smoke checks exercised both throwaway HTML prototypes without page errors. The source trace and read-only workload/registry extracts are recorded in `combined-proposal.md` and its named JSON assets. These validate the planning inputs and prototypes; implementation acceptance and production shadow observations remain rollout work.

Open decisions: none. Widgets/free APIs, proxy purchases, IPv6 lanes and a higher page ceiling are deferred beyond this rollout. Implementation and deployment are the handoff, not additional wayfinding tickets.
