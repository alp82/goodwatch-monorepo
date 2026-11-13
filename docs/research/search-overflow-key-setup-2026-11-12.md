# Search overflow key setup

Accessed 2026-11-12. Scope: official OpenRouter controls for a dedicated Liquid d1.1 overflow key and TypeSafe's published exhaustion errors. Read-only documentation research; no inference, key creation, settings mutation or dashboard authentication.

## Owner adjustment on 2026-11-13

The owner chose to keep the dedicated key's assigned **$1/day guardrail**, with **$5/month enforced by the application's `OPENROUTER_DECISION_MODELS_MONTHLY_BUDGET_USD` setting**. A separate provider-side monthly limit is not required for this rollout. The monthly key setup below records the earlier proposal; current setup and its nontransactional monthly accounting limits are in [search-overflow.md](../search-overflow.md).

## Original monthly-cap configuration

Use a dedicated ordinary OpenRouter inference key named `goodwatch-openrouter-decision-models`, with `limit: 5` and `limit_reset: "monthly"`. These are supported API fields: the limit is USD of OpenRouter credit usage, and the reset options are daily, weekly, monthly or no reset. API key creation returns the secret only once. [Create API key reference](https://openrouter.ai/docs/api/api-reference/api-keys/create-a-new-api-key.md)

For a restriction enforced by OpenRouter, assign a guardrail directly to that key with model allowlist containing only `liquid/d1.1`. Guardrails support specific-key assignment and model allowlists; an unassigned guardrail enforces nothing. Existing workspace/member restrictions still apply, with model allowlists intersected. The current guide locates creation under the workspace's **Guardrails** page, followed by assignment in its **API Keys** section. [Guardrails guide](https://openrouter.ai/docs/guides/features/guardrails)

An application's fixed model or a preset expresses its intended route but does not itself restrict what the credential may request. OpenRouter documents guardrail model allowlists as the enforcement mechanism; presets can be skipped or overridden. Exact model slugs are required. [Official spend-control setup](https://openrouter.ai/blog/tutorials/team-spend-controls-setup/)

## Original monthly-cap setup

1. Open the [API keys dashboard](https://openrouter.ai/settings/keys), in the account/workspace whose credits should fund GoodWatch. Create a dedicated ordinary inference key using the name, $5 limit and monthly reset above. This URL redirects to sign-in when unauthenticated; the current signed-in field labels were not inspected.
2. Open that workspace's Guardrails page, create `goodwatch-openrouter-decision-models`, allow only `liquid/d1.1`, save, and explicitly assign it to the new key. Check the eligibility preview. A separate $5 monthly guardrail budget may also be set; individual key budgets continue to apply independently. [Guardrails guide](https://openrouter.ai/docs/guides/features/guardrails)
3. Put only the ordinary inference secret in the deployment's dedicated search-overflow credential setting. Keep unrelated application OpenRouter credentials separate. API creation/rotation and permission management require a management key; the running search service needs no management credential. [Management-key permissions](https://openrouter.ai/docs/guides/overview/auth/management-api-keys.md)
4. Verify the new key with a read-only `GET https://openrouter.ai/api/v1/key` using that key's bearer authorization. Inspect `is_management_key: false`, `limit: 5`, `limit_reset: "monthly"`, `limit_remaining` and usage. The response also exposes applicable `budgets` / `effective_budget`, including remaining USD and `resets_at`. Never print the authorization secret. [Current key reference](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key.md)

The management API alternative is `POST /api/v1/keys` with body `{"name":"goodwatch-openrouter-decision-models","limit":5,"limit_reset":"monthly"}` and management-key authentication. A regular inference key cannot provision or alter its own capped replacement; `/api/v1/keys` management routes require management keys. Guardrail management also requires administrative credentials. This research performed none of those mutations. [Management-key permissions](https://openrouter.ai/docs/guides/overview/auth/management-api-keys.md)

## Reset timing and practical limits

OpenRouter documents resets at midnight UTC and describes monthly usage as the **current UTC month**. Therefore the monthly setting is a calendar-month allowance (first day at 00:00 UTC), rather than GoodWatch's TypeSafe billing cycle ending on the 17th; this boundary is an inference from those documented definitions. The create-key schema offers no custom reset day or billing-cycle anchor. Keep a separate application budget if the intended $5 allowance must follow the 17th. [Create-key schema and usage definitions](https://openrouter.ai/docs/api/api-reference/api-keys/create-a-new-api-key.md)

The $5 limit concerns inference credit spend. Purchasing credits is a separate transaction; OpenRouter's standard pay-as-you-go purchase fee is not charged per inference request. Do not describe the inference limit as a promise of a $5 card charge. [Official spend-control setup](https://openrouter.ai/blog/tutorials/team-spend-controls-setup/)

Guardrail budgets are enforced per key/member rather than pooled across everybody assigned that guardrail. Budget and allowlist blocks can both return HTTP 403, so 403 alone does not identify exhaustion. The guide says requests are rejected once a limit is reached, but the sources reviewed do not establish a strict maximum overshoot bound for concurrent or already-admitted requests. Retain application admission accounting if an exact cap matters. [Guardrail budget enforcement and blocked requests](https://openrouter.ai/docs/guides/features/guardrails)

## TypeSafe exhaustion contract remains unverified

TypeSafe's published error table currently documents 400, 401, 413, 415, 422, 429 and 529. It does **not** document HTTP 402, insufficient credits, a monthly reset timestamp, or a billing-exhaustion error code. Its public OpenAPI response definitions for `POST /v1/systemone` list 200, 400 and 422, also without a credit-exhaustion contract. Therefore a 402 fallback may be useful defensive behavior, but cannot be presented as officially confirmed exhaustion semantics based on these sources. Preserve response details in operational telemetry and confirm actual billing responses before relying on them as the sole trigger. [TypeSafe request rules and errors](https://docs.typesafe.ai/api/errors), [TypeSafe OpenAPI](https://api.typesafe.ai/openapi.json)
