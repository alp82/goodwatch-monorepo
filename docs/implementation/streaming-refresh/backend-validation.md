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

The complete backend suite remains red. Under the same Python environment and offline runner, the feature checkout ran 1,863 tests with 79 failures, 112 errors and 97 skips. Clean HEAD (`a9f4cf06cd51aa73cf5e6bec6ad8eab7389751f2`) ran 1,796 tests with 79 failures, 118 errors and 89 skips. There were **zero new failure/error labels** in the feature run. The baseline export contained only `goodwatch-flows`; its six additional error labels reference unavailable sibling webapp/schema artifacts. This is a matched backend comparison, not a claim that every unrelated failure was independently diagnosed. Counts, command and limits are saved in [backend-test-comparison.json](backend-test-comparison.json).

Frontend/opened-demand results are recorded separately in [opened-demand-validation.json](opened-demand-validation.json). The frontend build and focused checks passed. Full-tree TypeScript still reports 192 diagnostics, with zero in changed files, but no clean-HEAD TypeScript comparison establishes their baseline status. All six performance-budget surfaces failed; a matching generated-chunk comparison is not a baseline browser performance run. These limitations remain visible release evidence, not passed checks.

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
