# Q69: streaming refresh shadow review — 2026-10-28

**Decision proposed: fix first. Keep detector shadow and legacy publication unchanged.**
No switch-on is approved by this review. Waiting a fixed number of days will not repair the observed scheduling, backlog and coexistence problems.

Read-only observations collected around 11:30–11:45 UTC on October 28, from base `22ed33ea8`, for [#777](https://github.com/alp82/goodwatch-monorepo/issues/777) and closed planning map [#688](https://github.com/alp82/goodwatch-monorepo/issues/688). Read both issues/comments and the implementation folder’s rollout, preflight, deployment and validation documents. Release contract: [plan](plan.md), [rollout](rollout.md), [initial deployment](deployment-2026-10-26.md). Machine-readable selected receipts: [evidence](q69-shadow-evidence-2026-10-28.json).

## Acceptance comparison

“Fail” includes required proof that is absent; it does not always mean a measured safety violation.

| Plan gate | Observed | Verdict |
| --- | --- | --- |
| Three complete UTC daily-cohort shadow days, complete counts/gaps | Only October 27 is a completed UTC day; October 26 is partial and October 28 ongoing. 548/8,180 registered nondeleted popularity ≥5 movies lack a timestamp within 24 h, even taking the latest live/shadow timestamp; show aggregate timed out. No complete daily-cohort gap proof. | Fail |
| Reliable hourly 00:00–11:00 UTC collection | 12 scheduled runs at/after October 26 10:00, versus 26 nominal hourly opportunities through October 28 11:00; all 12 stop at runtime budget. | Fail |
| Detector failures/retries/status/p95 recorded, publication off | 86,564 requests; 86,401 HTTP 200; 163 HTTP 404; 86,397 newly stored observations; 69,881 reuse events; zero failed/invalid/retry/refusal/publication counts. Per-run p95 144.29–157.67 ms. | Pass for recorded counters |
| Detector ≤3 wire requests/s, ≤100,000/day, 00:00–12:00 UTC | Observed requests/day: 7,346 / 44,148 / 35,070; October 26 bootstrap adds 2,076 before review window. Runs end by ~11:00 UTC. Highest run-wide average ~2.12 requests/s; deployed shared admission code matches source; October 28 global counter exactly 35,070. Full wire timestamp history unavailable. | Pass on observed bounds; burst history unverified |
| Pages ≤1.3 requests/s, shared gate | 45 additional admissions over 35.283 s of shared request-clock advance = 1.275/s; generation 17, unblocked, zero active permits at both endpoints. Initial deployment also recorded 443/445.9 s. | Pass for sampled intervals |
| Opened ≤20k/day, changed ≤30k/day, ≥10% protected sweep with due work | No `page_pairs:*` tier-counter documents. Legacy selection remains active; all 190,872 cumulative gate admissions labelled sweep. This is not proof of new-selector fairness/caps or per-tier successful verifications. | Fail: not exercised |
| No opened/changed pending work >24 h | Changed monitor: at least 5,000 pending pairs; oldest October 26 08:39:17.502 UTC, ~50.9 h old. Opened and parse monitors incomplete/unknown, not healthy-zero proofs. | Fail |
| Coexist with enabled 14:00 UTC daily lists | Schedule enabled; October 26 and 27 executions failed after ~7.5 h, with 164 and 250 failed lists respectively. | Fail |
| Correct targeted publication, separate provider/link evidence | 60-title comparison plus six-title offline canonical replay below. Changes look source-driven, but mapping deferrals and publication/history acceptance remain unresolved. | Fail: no publication canary acceptance |
| Whole-registry weekly coverage | Sticky source registry 480,310 titles (30,830 popularity ≥5; 449,480 below 5), versus 385,443 at deployment preview; latest job registry 476,813 and 241,562 due. Cold baseline plus second full pass absent. | Fail for weekly claim; separate from daily release |
| Integrated recovery and staged publication | Prior scratch tests documented; no new fault injection. No 100-title DE/US publication canary or either full 24-hour expansion stage. | Fail for activation |

## Detector execution evidence

Current schedule: `f/tmdb_api/provider_detector`, enabled, cron `0 0 0-11 * * *`, UTC, `args={"mode":"shadow"}`, `no_flow_overlap=true`. Actual scheduled arguments omit `max_seconds`, so the deployed default is 3,600 seconds; jobs take 3,602–3,604 seconds including overhead. This strongly explains alternate missing hourly starts. October 28 02:00 is additionally absent; its cause is not established. Do not attribute every gap to runtime overhead without a scheduler audit.

| UTC day | Actual start hours | Requests | Stored observations | HTTP 404 | Reuses |
| --- | --- | ---: | ---: | ---: | ---: |
| October 26, from 10:00 | 10 | 7,346 | 7,343 | 3 | 7,366 |
| October 27 | 00, 02, 04, 06, 08, 10 | 44,148 | 44,052 | 94 | 47,313 |
| October 28, through readback | 00, 04, 06, 08, 10 | 35,070 | 35,002 | 66 | 15,202 |

Every listed run succeeded and returned `deferred_reason=runtime_budget`. Four HTTP 200 responses did not become counted observations before stopping; due work must remain eligible. The earlier manual bootstrap (`01a1778d-8077-59db-fa4c-f97fb8ffca64`, 09:32 UTC) is excluded above and recorded separately in deployment evidence. First in-window job: `01a1778d-8034-5e7d-bed3-4a3cf82facbc`; latest: `01a181bc-e942-fb92-c2d1-2db05bc63ed9`. All run IDs/results are retained in the evidence JSON.

Changed-pair event sums: opened 1,304, popular 81,383, sweep 84,823. These are not unique pairs/day or newly enqueued page attempts: reused live observations and catch-up changes contribute. The frozen experiment estimated 14.6k/20.4k pairs/day on a different 20k-title cohort; these event totals cannot validate or refute that estimate. Returned `gaps_ms` contain 86,395 intervals, median 257.74 h, p95 773.75 h, max 888.45 h, all >24 h. They include old baseline/cold evidence and lack tier/title keys; they cannot establish daily-cohort gaps. At 11:43:58 UTC, a narrower indexed aggregate found only 7,632/8,180 registered nondeleted popularity ≥5 movies with a latest live-or-shadow timestamp within 24 h (93.3%; 548 stale/missing). This is an upper bound on validated freshness because timestamps were not individually proof-validated; accepted-open-only titles are additional scope. Two whole-registry timestamp aggregates exceeded 20-second server budgets and the daily-show aggregate exceeded 15 seconds; no complete count from them is claimed.

## Page evidence, caps and monitoring gaps

Indexed country-source counts with last successful page `updated_at` in the review window:

| UTC day | Movie pairs | Show pairs |
| --- | ---: | ---: |
| October 26, from 10:00 | 25,938 | 25,032 |
| October 27 | 42,036 | 42,957 |
| October 28, until ~11:40 | 21,112 | 18,962 |

Total 176,037 country records. These are latest-success timestamps, not append-only request counts: repeat checks overwrite prior timestamps. A most-recent 1,000-record sample per media type contained zero Niger records. `wire_count=sweep_wire_count=fairness_sweep_count=190872` is cumulative since initialization, not the review-window request total or a new-tier fairness result. No tier-counter records exist. Page pacing endpoint clocks were 11:40:07.376 and 11:40:42.659 UTC, counters 190,827 and 190,872.

Crate has **no shadow-observation table**: isolated detector observations are in Mongo details `watch_providers_shadow`; country page evidence is in Mongo provider records. Crate `streaming_evidence` is the published country envelope, and `workflow_monitoring` is a bounded observation ledger. Since the cutoff, 1,269,072 movie and 318,673 show evidence rows had publication `updated_at` values; those 1,587,745 rows must not be counted as page fetches or new provider HTTP calls.

Crate monitoring contains 11 detector job records, behind the 12 actual scheduled completions; its latest captured job still says running. Its hourly coverage can associate the same long job with two due slots. It is not an independent complete hourly execution ledger. For page/priority roots actually started in-window, retained monitoring has 391 page roots and 390 priority roots, 9,698 source successes and one source failure, zero recorded parse failures, 206 publication attempts and zero publication retries. This bounded, stale/partial ledger cannot certify zero failures across every country job. Opened and parse monitors have `observation_complete=false`, `counts_are_lower_bounds=true`.

Changed backlog receipt: `f/monitoring/availability_changed`, observed 11:33:47.630 UTC, at least 5,000, oldest age 183,270 s, active `availability_changed_overdue`. This alone violates the plan's expansion stop condition. The earlier pending timestamp predates the first detector shadow run; do not blame shadow isolation for creating that backlog.

Daily-list roots `01a174a4-169f-be62-b3b1-118ce2163038` and `01a17882-cbff-f7fc-1298-e6dde023014d` both failed the report step. The October 27 list result has 249 `ValueError` failures and one `RuntimeError`; examples include `LC:movie:8` and `AR:movie:337`, without HTTP status. List/refresh work made progress despite failed roots. Cause and attribution to this rollout are unproven; the detector itself had no refusals and did not overlap those 14:00–21:30 runs. Fix/qualify the failures before claiming coexistence acceptance. The list allocation is separate from the detector's 100k/day limit.

## Correctness sample and offline canonical replay

Deterministic sample: first 30 shadow-bearing movie IDs and first 30 shadow-bearing TV IDs, sorted numerically. This is a reproducible convenience sample, not the release canary or a representative estimate. Compared all countries/offer types against Crate: 10,061 movie and 793 show availability rows, plus 3,390 evidence envelopes. All 60 live API provider sets match their published usable API contribution; 48 newer shadow sets match it, while 12 differ. Whole published membership matches raw shadow membership for only 19/60 titles because it includes page/retained contributions. That raw difference is not a detector error rate.

Replayed the deployed canonical `reconcile_availability` and provider identity/evidence helpers **offline**, with socket connections denied, using read-only source/page/catalog/Crate snapshots. Deployed sources match checked-in source (hashes in evidence). Only pure definitions and the exact availability model were loaded; no initializer, publisher, lease, REFRESH, HTTP refresh or history writer was invoked. Unmapped countries were deferred locally, equivalent to a zero-refresh budget. Both live and shadow inputs were replayed against the same frozen existing rows to separate legacy residue from shadow effects.

| Title | Actual offer rows | Live replay | Shadow replay | Shadow mapping deferrals |
| --- | ---: | ---: | ---: | --- |
| Movie 2 | 178 | 174 | 160 | None |
| Movie 5 | 296 | 250 | 228 | AU, NZ (live: NZ) |
| Movie 27 | 27 | 27 | 21 | None |
| Movie 66 | 570 | 496 | 383 | NE (also live) |
| Show 6 | 12 | 12 | 11 | None |
| Show 45 | 93 | 93 | 95 | None |

Across these six: actual 1,176 rows versus shadow replay 898, with 10 additions and 288 removals. These are projected membership changes, not production writes or verified history transitions. Examples: show 6 drops US ads service 1971; show 45 adds AU/GB ads service 73; movie 27 removes six older AU/GB/IE offers; movie 66 would remove old DE rent/buy service 3 contributions. Movie 2 changes even with unchanged provider membership because the newer API timestamp excludes older page offers. Historical Apple split rows and mapping deferrals remain; do not use this projection to authorize a bulk historical repair. Snapshot reads were not atomic across stores. No unexplained source corruption is established by this sample, but it does not clear publication acceptance.

## Recommended next authorized work and later activation

1. Prepare a scheduling correction for approval: retain UTC cron/window, overlap prevention, shadow mode, 3/s and 100k/day; give scheduled runs explicit headroom below the hour (for example `max_seconds=3300`). Confirm at least two successive hourly starts and request budgets before starting the qualifying observation period. Investigate the separate missing October 28 02:00 run and registry-scan startup cost. No such change was made here.
2. Diagnose/resolve the daily-list failures and changed backlog; retain revisions, original pending ages, claims and evidence. Establish complete or explicitly bounded daily-cohort coverage, fresh-observation counts, per-title/tier gap distributions and mapping-deferral accounting. Repair incomplete monitoring evidence rather than treating unknown/lower-bound zeros as healthy.
3. Then collect three **qualifying complete UTC shadow days**. If corrected today, October 29–31 ending November 1 00:00 UTC is the earliest fresh three-day candidate, contingent on actual acceptance. This is not a promised switch date. Cold weekly coverage remains separate.
4. Re-review for the exact first-100 registered, nondeleted popularity ≥20 canonical-ID DE/US positive-evidence canary (≤200 root pairs), then its full 24 h observation, remaining popularity ≥20 stage, another full 24 h, and only then full background selection. Retain 1.3/s/six permits and 20k/30k/10% bounds. An unrestricted detector `mode=publish` switch cannot enforce that bounded title/country canary.

**No switch-on sequence is offered for approval now because the release gates fail.** Current arguments remain detector `mode=shadow`; page schedule `{}` (legacy defaults); priority schedule empty explicit IDs; daily lists enabled at 14:00 UTC. Any later approved activation must freeze exact IDs/countries and schedule arguments first, stop/drain the replacement path before restoring legacy selection on rollback, and disable new publication/selection/opened consumption independently. Preserve gate generation, request counters, validated observations, accepted opens, checkpoints, pending revisions and history intents. Never clear/reset shared state to accelerate work. Historical repair remains separately backed up and approved.

## Access boundary and verification

Worktree fetched/reset as requested. Windmill API **GETs only**, using the configured token without displaying/storing it. Crate **SELECTs only** through the repository's SSH/trusted-loopback recipe; no client initializer or monitoring-store constructor. Source evidence required Mongo read-only find/count/aggregate/index metadata operations using credentials obtained only through Windmill GETs, held in memory. No production `.env` was loaded. No Windmill job was started, schedule/script/setting changed, Coolify write, database write/DDL/SET/REFRESH, deployment, notification, push or upstream TMDB test request occurred. Existing scheduled jobs continued independently.

The local replay ran with networking disabled. Receipt arithmetic, JSON parsing and `git diff --check` were verified. No production canary, history transaction, sustained rate test, refusal/recovery exercise or full application suite was run. This review does not need production write access; fixes and eventual activation require separate authorization.
