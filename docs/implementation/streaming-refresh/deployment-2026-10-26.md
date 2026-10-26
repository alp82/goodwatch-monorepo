# Streaming refresh cutover — 2026-10-26

The owner authorized the documented production shadow cutover. This record supplements the earlier local validation and preflight; it does not establish the three complete UTC shadow days, cold weekly coverage or publication canary acceptance.

## Deployed and verified

- Merged the streaming changes with deployed main `703ede89f80b4df32319fe84eac579b43e0518e8`, preserving its 74 independently changed frontend files. The producer added only its reviewed 17 frontend files. Eight demand tests, 29 Crate client tests, the production build, and the matched TypeScript comparison passed with zero introduced diagnostics.
- Pushed the integrated revision `68bba7d258ea6b3ef11f11da5e77f3779c667545` through the existing main-triggered deployment. Both page hosts reported that exact source commit, Docker healthy and `/health/ready` ready at 09:01:53 UTC. A later bounded readback at 09:50:04 UTC found both hosts healthy and ready on independently advanced main `06944811362dcff9f21e469be9b423895af8defb`, which retains the opened producer. No Coolify API, database, settings, variables or secrets were changed. Existing person-page 503 traffic was observed on the prior revision as well; it is not claimed resolved by this rollout.
- Applied and read back `crawl_priority.last_opened_at` as `timestamp with time zone`. The first verification found zero accepted opens; after frontend deployment, 96 rows had organically recorded accepted opens. No synthetic demand POST was needed. Metadata demand/acknowledgment and lease columns were retained.
- Deployed the 28 reviewed Windmill scripts and two page flows. Preserved independently deployed `trope_catalog_page` and `trope_catalog_reference` schema declarations. Script source and lock readbacks matched; an initially changed transitive grpcio pin was corrected by freezing the detector's exact 29-package reviewed closure in manual requirements. No package versions were added to that closure.
- Installed the country selection, pending-change and unresolved-parse indexes, plus the partial covered registry/confirmation indexes added after the first preview exposed collection scans. Registry query explains showed covered IXSCAN plans. Index preparation is explicit; ordinary detector runs do not create indexes.
- Initialized the existing page gate using `$setOnInsert`; preserved generation 17, block/probe state and evidence. All eight temporarily paused legacy schedules were resumed. The 14:00 UTC daily service-list schedule retained its existing allocation.

## Country scalar migration

The existing full unique country identity indexes were present. The existing migration preview inspected 1,000 movie and 1,000 TV country records with zero identity errors. The new derived scalar was absent in the initial samples.

Used bounded 10,000-ID ranges to add `has_streaming_links` only where missing, atomically deriving it from each document's current links. Existing scalars, identity, evidence timestamps, failures, claims and leases were retained. TV completed its 1,774,844-record scan; movie covered the initial confirmed range and completed recovery through the remaining 2,248,790 records. The collections held approximately 9.4 million records during cutover.

A temporary local cache directory and named worktrees disappeared during the operation. The writer stopped when checkpoint persistence failed; production documents were not rolled back. Recovery resumed after the last confirmed ID and wrote only still-missing scalars. Operator state moved into private repository metadata. Twenty-eight versioned script backups, including 22 pre-existing scripts, and both prior flow versions were recovered from Windmill history.

Bounded readback validated 300 movie records, including the recovery boundary, and 200 TV records at both collection ends: every scalar was Boolean and matched the current links. Global null/count verification attempts exceeded their query budgets; no successful full-count readback is claimed. The migration completion evidence is the exhausted ID ranges and the bounded source/scalar checks.

## Native Windmill acceptance and page pacing

The first resumed page flow failed in Windmill's lazy JavaScript result evaluator before admitting page HTTP. The iterator referenced `results.a` inside its callback. Corrected it to pass the result into the callback scope, then verified a native 21-entry shadow flow split into exactly **20 + 1** entries with all results `selected_shadow` and publication disabled. Proof job: `01a1777a-5ea0-bc4c-0186-98f97267046f`.

Page and priority scheduling resumed after that check. Real page batches subsequently returned fetched results and advanced the shared wire counter. A 445.9-second interval admitted 443 requests, below the 1.3 requests/second ceiling; generation remained 17 and the gate was unblocked. A recent five-batch sample contained 70 fetched outcomes. A further application-only observation covered 141 batches from 09:14:00 to 09:47:06 UTC: 1,934 fetched outcomes, 10 deferred and 80 fresh, with no failure classifications and zero Niger fetch results. The returned list was not capped. Dependency-resolution jobs are excluded from that runtime evidence.

An independent detector interval charged 611 additional requests over 225.0 seconds, within its three-request/second ceiling. No unresolved parse-failure markers were found since the page observation began.

The iterator fix is committed as `9f664cb39` and integrated with independent main changes in `7f19b66f0`; the frontend code is unchanged by those backend/documentation commits.

## Detector shadow stage

The indexed preview completed in **735,881 ms**: **385,443 registered titles**, **291,275 due**, **92,142 fresh**, and 100 returned candidates, with zero API observations/publications. Selection validates the complete registry before applying the output limit; its startup cost is material and must be included in throughput observations. The existing storage helper already requests zlib compression. No speculative cache or new queue was introduced.

Enabled the existing reviewed UTC schedule `0 0 0-11 * * *`, with `mode=shadow` and overlap prevention. First manual run: `01a1778d-8077-59db-fa4c-f97fb8ffca64`, started 09:32:04 UTC, with 100,000 title/request ceilings and a 1,630-second work budget ending before the next hourly schedule. It shares the global detector lease, three-wire-request/second clock and 100,000-request UTC-day ceiling. Exact source and lock readback matched all 28 script resources after the main deployment workflow; the iterator retained its single lazy-result reference.

At 09:47:23 UTC the first run had charged **133 API requests**. A bounded indexed lookup of the preview's 100 candidate IDs found **44 new validated shadow observations** checked after job start, all uncached, with zero invalid sampled proofs. Valid live proofs retained their older actual timestamps. The bounded first run subsequently completed successfully in **1,632,515 ms**, stopping normally at `runtime_budget`: **2,076 title requests, all HTTP 200**, **2,075 new shadow observations**, zero retries, refusals, deleted responses, failures, invalid responses or publications. Request p95 was **151.22 ms**. One last admitted request was not counted as a stored observation before the work budget expired; due work is retained. The next scheduled shadow job `01a1778d-8034-5e7d-bed3-4a3cf82facbc` started at **10:00:00.052704 UTC**. Detector and new-tier publication remain disabled; existing legacy publication retains its prior behavior under the shared gate. Historical identity repair has not run.

Today is a partial shadow window. Three complete UTC shadow days, daily-cohort gap/budget/error proof, integrated recovery acceptance and the exact bounded publication canary remain prerequisites for expansion. A cold baseline and second complete cold pass are required before claiming weekly registry coverage. See [rollout.md](rollout.md).
