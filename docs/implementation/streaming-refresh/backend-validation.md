# Streaming refresh backend validation

Status: implementation and local validation only. This checkout has not been deployed. No production database migration, index creation, repair, schedule enablement or publication was performed by this implementation task. Production acceptance remains outstanding; the [approved plan](plan.md) defines the release gates.

## Recorded local checks

The following focused suites passed in the isolated implementation checkout:

| Suite | Passing checks | Scope |
| --- | ---: | --- |
| `test_streaming_countries.py` | 20 | Country identity, leases, failure backoff, verified empty results, and legacy scheduled/targeted entrypoints. |
| `test_tmdb_upstream.py` | 9 | Existing gate generations, refusal classification, Retry-After, a single leased probe, and preservation of country evidence while blocked. |
| `test_provider_identity.py` | 4 | Validated clickout context and ambiguous/malformed identity rejection. |
| `test_page_scheduling.py` | 14 | New selector, daily tier caps, sweep reservation, revision fencing, shadow behavior, redirects/retries charged individually, page 404 confirmation intent, broken partial-offer rejection, expired-probe fencing, and deleted-during-claim rejection. |
| `test_streaming_identity_republish.py` | 10 | Canonical Apple store reconciliation, stale plans, lease-held backups, apply/resume/rollback, scoped restoration, and refusal of newer source or target data. |

Page scheduling includes three tests against disposable MongoDB 8, covering: twelve concurrent admission claimers; six expiring permits with stale completion/lease fences; blocked single-probe recovery and deterministic slow start; and an eight-admission wall-clock interval within ±10% of 1.3 admissions/second. These are local shared-store checks, not a sustained TMDB throughput result. The tier cap and selector fixtures also use an isolated in-memory Mongo adapter.

The repair suite runs five scenarios against each of in-memory Mongo and disposable real Mongo. It uses the existing canonical publisher with HTTP mapping refresh budget zero and a recording Crate adapter. It verifies full scoped history and pending-intent restoration, BSON binary/decimal backup readback, interrupted apply, interrupted DELETE/INSERT rollback, preservation of other titles, and preservation of unrelated Crate metadata. It does not establish live Crate restore behavior or authorize a production repair.

The final focused backend run passed **99 checks**, including disposable real Mongo admission/repair checks and the provider timestamp/evidence integration fix. A separate provider/metadata/list/opened-demand regression run completed 206 tests successfully (two skipped). Compilation and `git diff --check` also passed.

The complete backend suite remains red. Under the same Python environment and offline runner, the feature checkout ran 1,892 tests with 79 failures, 112 errors and 109 skips. Clean HEAD (`a9f4cf06cd51aa73cf5e6bec6ad8eab7389751f2`) ran 1,796 tests with 79 failures, 118 errors and 89 skips. There were **zero new failure/error labels** in the feature run. The baseline export contained only `goodwatch-flows`; its six additional error labels reference unavailable sibling webapp/schema artifacts. This is a matched backend comparison, not a claim that every unrelated failure was independently diagnosed. Counts, command and limits are saved in [backend-test-comparison.json](backend-test-comparison.json).

Frontend/opened-demand results are recorded separately in [opened-demand-validation.json](opened-demand-validation.json). The frontend build and focused checks passed. Full-tree TypeScript reports 192 diagnostics on both clean base and feature, with byte-identical complete output and zero introduced diagnostics; see [typescript-validation.json](typescript-validation.json). The final [matched browser comparison](browser-budget-comparison.json) confirms both clean base and feature fail the same existing budget checks on all six surfaces, with zero introduced failure labels and unchanged script/request counts. Matching Sentry release settings corrected the earlier inflated chunk comparison. Source-only script growth is 691–862 bytes on five surfaces; the share list shrinks. Those five surfaces reserve 1 KiB each in script/total byte caps for the required first-view transport. No unrelated limits were widened. The single samples on a shared local machine establish resource differences, not a calibrated timing result. These limitations remain visible release evidence, not passed checks.

## Real CrateDB opened-demand checks

Seven checks passed on a dedicated disposable CrateDB 5.10.12 container: the three new opened-demand integration scenarios and four existing priority-queue integration scenarios. The new tests execute the actual frontend TypeScript SQL factory through Node, then exercise its SQL with the real queue claim/acknowledgment implementation. They cover twelve concurrent mixed-source increments, canonical alias folding, preservation of claim fields and accepted opens through metadata acknowledgment, the seven-day metadata cooldown, and recent-open selection.

This caught an implementation bug: CrateDB 5.10.12 rejects `ADD COLUMN IF NOT EXISTS`. The migration now reads `information_schema.columns`, adds a missing column using supported syntax, retains an existing matching timestamp column, and refuses an incompatible type. Applying the migration twice to an existing populated scratch table passes without resetting demand or leases. The 14 focused migration/queue unit checks also pass after this correction. These checks make no production writes and do not establish live cluster behavior.

```bash
TEST_CRATE_URL=http://127.0.0.1:<scratch-port> PYTHONPATH=goodwatch-flows/windmill:goodwatch-flows/tests python goodwatch-flows/tests/offline_unittest.py test_opened_demand_crate test_priority_queue_integration
```

## Monitoring and real BSON persistence

The final producer/monitor/publication integration run completed **201 tests successfully, with 8 optional skips**. Separate targeted runs passed all **22 monitoring tests** (including eight against disposable real Mongo) and all **21 provider observation tests** (including the real pending-change completion scenario). This supplements the earlier focused runs rather than adding their overlapping counts.

Real Mongo exposed a second implementation bug: stored millisecond proof times decode as BSON `Int64`, an integer subclass, so exact Python-type checks rejected otherwise valid persisted observations. Validators now accept integer subclasses while rejecting booleans. Regression checks exercise BSON roundtrip/reuse, stale ordering, newer API evidence, and actual Mongo projection/claim/completion.

Monitoring reuses the existing collector, incident state and notification delivery. It reports accepted opens and coalesced changes pending over 24 hours, retaining backoff/lease work as pending and excluding unsupported, deleted, invalid or verified-empty scope. `provider_change_pending_since` keeps the oldest unserved age across newer revisions; only matching successful completion clears it. Index-backed queries and bounded batches/time budgets return lower bounds or unknown on incomplete collection, preserving existing incidents through observation gaps. Parse errors are classified explicitly; at least three unresolved country failures persisting for ten observed minutes trigger the sustained-parse cause. A durable `parse_failed_at` marker survives later HTTP/transport failures; only verified parsing success clears that unresolved parse evidence. The latest failure classification remains a separate diagnostic. Existing two-hour upstream-gate alerts remain in place. Batch outcomes now contribute source success/failure evidence. All delivery tests used mocks; no recipient was contacted.

## Run tests without external network access

Use the checked-in runner so a missing HTTP mock cannot reach TMDB through another HTTP library, redirects or proxy settings:

```bash
PYTHONPATH=goodwatch-flows/windmill python goodwatch-flows/tests/offline_unittest.py discover -s goodwatch-flows/tests -p test_page_scheduling.py
PYTHONPATH=goodwatch-flows/windmill python goodwatch-flows/tests/offline_unittest.py discover -s goodwatch-flows/tests -p test_streaming_identity_republish.py
```

The runner denies non-loopback DNS resolution and socket `connect`/`connect_ex`. Tests inject HTTP responses. Synthetic refusal fixtures must remain local; never provoke a real upstream block to test recovery.

The disposable Mongo instance used locally was container `gw-streaming-page-test`, bound only to `127.0.0.1:27189`. To include its shared-store checks:

```bash
PAGE_TEST_MONGO_URI=mongodb://127.0.0.1:27189/ PYTHONPATH=goodwatch-flows/windmill python goodwatch-flows/tests/offline_unittest.py discover -s goodwatch-flows/tests -p test_page_scheduling.py
REPUBLISH_TEST_MONGO_URI=mongodb://127.0.0.1:27189/ PYTHONPATH=goodwatch-flows/windmill python goodwatch-flows/tests/offline_unittest.py discover -s goodwatch-flows/tests -p test_streaming_identity_republish.py
```

The fixtures reject other Mongo endpoints. Page tests own only `page_scheduling_test`; repair tests create and remove databases named `streaming_republish_test_*`. Do not point these fixtures at a production database or repurpose a production Mongo URI.

## Test HTTP mishap

Before the offline runner was installed, HTTPX replaced the crawler's previous HTTP transport while older tests still mocked `requests.get`. Eight unintended read-only TMDB watch-page requests escaped those mocks and returned HTTP 404. There were no production database writes: those tests used in-memory Mongo. An offline replay of the original tests, with all socket connections denied and HTTPX stubbed, identified eight possible calls across the affected tests.

The affected tests were `test_block_does_not_fail_or_reschedule_country` (one call), `test_failed_probe_never_opens_gate_or_fails_title` (two), and five country-entrypoint tests (one each): `test_all_pending_countries_are_fetched_once_and_rate_limit_preserves_old_data`, `test_fetch_entrypoint_refreshes_fresh_unmapped_country_once`, `test_fetch_entrypoint_verifies_empty_and_reuses_country_without_another_request`, `test_scheduled_and_priority_paths_share_pending_fresh_and_deferred_eligibility`, and `test_unrecognized_200_page_is_failure_and_preserves_previous_links`.

Subsequent runs used the offline runner. Parser tests require an explicitly supplied transport, and the migrated focused fixtures also deny socket connections. These eight 404 responses are a testing error, not production parser evidence or an approved live observation.

## Production proof still required

- Review the deployed lock files, database migration and indexes, and read back the actual job arguments before enabling work.
- Observe classification for thirty minutes after deployment: zero ordinary Niger attempts, and separate challenge/refusal, HTTP, parse, identity and country-validation errors. The Just a Moment parser fixture is synthetic; production page behavior still needs observation.
- Complete three UTC shadow days for the daily detector cohort. Record observation gaps, actual API wire requests/retries/statuses/p95, changed pairs by tier, budget/window compliance, and coexistence with the daily service-list workflow.
- Exercise synthetic recovery against scratch shared-store documents: missing state fails closed, stale workers cannot publish, one probe reopens only after valid country parsing, and recovery follows 0.325 plus 0.1 per clean ten-minute interval to 1.3 requests/second.
- Record real successful verifications and freshness by tier, opened/changed backlog age, protected sweep progress, and gate duration. An admission is not a completed verification.
- Run the exact bounded publication canary and complete both 24-hour observation stages in [rollout.md](rollout.md). Cold weekly coverage requires a completed cold baseline and a second complete cold pass; daily-cohort release does not establish whole-registry weekly coverage.
- Preview, back up and prove any historical repair separately. Compare the same affected-key inventory before/after and preserve unmatched evidence and history precision.

Windmill CLI 1.803.0 successfully regenerated the affected dependency locks through the configured GoodWatch resolver, using resolution jobs only. Explicit dependency headers prevent installing standalone `bson` and include lazy runtime imports. Page locks retain Python 3.12, HTTPX 0.28.1, MongoEngine 0.29.3 and Requests 2.34.2; they add HTTP/2 with h2 4.3.0, hpack 4.2.0 and hyperframe 6.1.0, and align PyMongo 4.18.1, Pydantic 2.13.5 and wmill 1.815.0 with the existing API pins. Resolution also refreshed certifi to 2026.10.23 and soupsieve to 3.0.4. Unchanged dependency-set locks and metadata were restored byte-for-byte. Final local hashes cover 22 scripts and two flows, and the detector script timeout is 3,900 seconds. A fresh Python 3.12 uv environment installed the exact resolved fetch and selector-entrypoint locks: BSON/SON/PyMongo imports, HTTP/2 client construction, eight module imports and provider payload normalization all passed with socket connections forbidden. No application main, source HTTP request, database operation or deployment ran during this smoke check. `git diff --check` passed.
