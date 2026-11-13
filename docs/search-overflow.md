# Search reading overflow

JEV through TypeSafe remains the primary reader. Its $5 allowance is counted separately from paid overflow and renews on the 17th at 00:00 UTC, using the owner's stated renewal day. Confirm the provider's exact reset time before relying on boundary-hour availability; no public TypeSafe billing API was found. The existing $1/day pacing limit remains.

When a fresh reading cannot fit the remaining JEV cycle allowance, search may use **Liquid d1.1 through OpenRouter's native Decisions API**. A TypeSafe HTTP 402 also permits this path as defensive payment-required handling; TypeSafe does not publish an exhaustion response contract. A daily pacing denial, global paid-search halt, rate limit, guest navigation, missing credential, failed session, storage failure, timeout, overload or other provider error does not activate overflow. There is one alternate provider, with no cascade.

The choice follows the [ten-model benchmark](benchmarks/search-interpretation-openrouter-2026-11-12.md): Liquid was about $0.163 per 1,000 cold unique-query readings, with approximately 1-second p95 and 90.3% partial-assertion quality. This supports overflow use, not a claim of full quality parity with JEV.

## OpenRouter setup

1. In [API keys](https://openrouter.ai/settings/keys), create a new ordinary inference key named `goodwatch-openrouter-decision-models`. Owner-approved application overflow budget: **$5/month**. The owner chose a separate **$1/day OpenRouter guardrail** on 2026-11-13. Keep existing application keys separate.
2. In the workspace's **Guardrails** page, create a guardrail allowing only `liquid/d1.1`, save it and explicitly assign it to this key in its API Keys section. Check eligibility. Set its budget to **$1 with a daily reset**, as approved by the owner. The application separately tracks the $5 monthly allowance. A preset alone does not enforce a model restriction. [Official guardrail instructions](https://openrouter.ai/docs/guides/features/guardrails)
3. Store the new secret privately on both search roles (the protected `goodwatch-search/.env` on the search host). Do not put it in the browser or paste it into chat. The running application needs no management key.

```dotenv
OPENROUTER_DECISION_MODELS_API_KEY=<new dedicated inference key>
OPENROUTER_DECISION_MODELS_MONTHLY_BUDGET_USD=5
```

The two controls have different windows: OpenRouter enforces the key's $1 daily guardrail; the application's $5 overflow budget follows UTC calendar months, independently of TypeSafe's 17th-day cycle. Empty key, absent/invalid budget or a zero budget disables overflow; the shared `OPENROUTER_API_KEY` is never used for this reader. The shipped example defaults to zero.

With the two variables available in the process environment, run the read-only check from `goodwatch-webapp`:

```sh
node scripts/search-overflow/check-key.mjs
```

It calls only OpenRouter's current-key metadata endpoint, verifies an ordinary key with a positive daily or monthly provider cap no greater than the configured application monthly budget, supplied by its direct limit or an `api_key`-scoped guardrail budget. It reports the provider reset period and the application monthly budget separately, and prints budget metadata without the credential. Confirm model restriction assignment in the dashboard separately. [Current-key reference](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key.md)

The $5 cap is inference credit usage, not a promised $5 card transaction. Credit purchases and their fees are separate. Details and source limitations: [key setup research](research/search-overflow-key-setup-2026-11-12.md).

## Admission, billing and cached readings

Both search replicas share the existing Redis admission limits, trusted identity checks, encrypted reading cache and Crate spending ledger. Cache contracts distinguish JEV from Liquid and its chunking contract. JEV cache hits serve first; Liquid cache hits are considered on the overflow path and can serve even when its own monthly budget is spent. A newly available JEV cycle takes priority again.

`search_spending.budget_pool` is `jev` or `openrouter-overflow`; historical NULL values mean JEV. Estimates, settlements, duplicate-claim refunds and verified reconciliation retain the original pool and `budget_at`. Overflow never debits the free JEV ledger, and the JEV checks exclude overflow spend. Translation, if explicitly enabled, keeps its existing accounting and does not consume the overflow pool.

Before each fresh Liquid reading, admission reserves **$0.01** against its own cap. Successful readings settle to the sum of OpenRouter's reported `usage.cost`, rounded up to nanodollars. Lost, partial, failed or unpriced responses retain the whole estimate until verified reconciliation. Complete invalid native responses with known costs settle those costs and are not cached. Unexpected charges above the estimate halt new paid search admissions.

The estimate is deliberately conservative and is not a proved upper billing bound. The ledger uses nontransactional, eventually indexed Crate reads, so concurrent admissions can exceed its cutoff. The dedicated OpenRouter guardrail independently limits daily spend; the $5 monthly allowance is enforced by application accounting alone. OpenRouter's reviewed docs do not establish a strict concurrent-request overshoot bound either. Do not describe either layer as an atomic zero-overshoot guarantee.

The transport pins `liquid/d1.1` to Liquid, disables provider fallbacks and filters route rates at $0.020/M input, free output and no request fee. This rate filter is not a request-cost ceiling. It preserves original structured state, sends every question in batches of at most 128 (currently three HTTP requests per reading, at most two active), and validates the canonical model, provider, complete answers, native probabilities and truncation indicators. No generated JSON, retries or one-hot approximation are involved. The 1,500 ms reading deadline includes all batches and response-body parsing; timeout/cancellation serves basic search and retains the estimate.

Search history records `interpretation_provider`, `interpretation_model` and `overflow_reason` (`cycle-budget` or `provider-payment-required`) alongside the existing invocation attribution. `charged_nano` remains conservative accounting including retained unknown estimates, not an invoice total. The ledger pool is authoritative for separating allowance usage from overflow. Primary reading durations stay in their usual fields; overflow adds `readingOverflow*` stage durations.

## Rollout and verification

Apply `goodwatch-webapp/scripts/migrations/2026-11-12-search-overflow-budget.sql` **before deploying this runtime**, including when overflow is disabled. It adds one ledger column and three history columns; no historical backfill or new database is required. The Windmill schema initializer carries the same declarations. Verify columns before deploying either search role, then deploy the same commit/settings to both using the existing [search-role procedure](search-role-deploy.md). Keep the key empty and budget zero until ready to enable.

Server-side checks from `goodwatch-webapp`:

```sh
node --test app/server/search-runtime/*.test.ts
node --test scripts/search-overflow/check-key.test.mjs
```

The native transport test replays all 211 saved Liquid finalist responses through the production questions and decoder, without making inference calls. Other checks exercise admission restrictions, distinct cache identity, metering, unknown-cost reservations, cancellation and deadlines.

A separate loopback Crate instance checks the actual additive migration, renewal boundaries (including January), pool separation, immutable settlement/reconciliation and history columns:

```sh
docker run -d --name gw-search-overflow-crate -p 127.0.0.1:45212:4200 -e CRATE_HEAP_SIZE=256m crate:6.2.11 -Cdiscovery.type=single-node
# Once the database answers SELECT 1:
SEARCH_OVERFLOW_TEST_CRATE_URL=http://127.0.0.1:45212/_sql node --test scripts/search-overflow/store.integration.mjs
docker stop gw-search-overflow-crate
docker rm gw-search-overflow-crate
```

The integration test refuses non-loopback hosts, loads no application env, creates its own random schema and removes its tables afterwards. Never start the local webapp with the production `.env` for these tests.

Verification on 2026-11-12: 125 runtime/key-check tests passed, including the offline native replay; both the new Crate overflow integration and the existing attribution/initializer integration passed on an isolated local database. The production Remix build passed. The repository-wide TypeScript check still reports unrelated existing errors (none in the modified runtime/search files). No new paid inference calls or production database operations were used for this implementation.
