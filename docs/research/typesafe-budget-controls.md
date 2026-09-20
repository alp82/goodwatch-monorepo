# TypeSafe/Jev budget controls

Researched 2026-09-20 for [Production architecture: cache, failure fallback, and budgets](https://github.com/alp82/goodwatch-monorepo/issues/113). Scope: direct TypeSafe API, not a Jev reseller or gateway. Public documentation and official SDK source only; no credentials used, paid requests made, or account settings changed.

## Finding

**No supported public endpoint for fetching account balance, remaining budget, or aggregate billing usage was found.** This is an absence in the published contract, not proof that an internal or account-specific endpoint cannot exist. The [complete documentation index](https://docs.typesafe.ai/llms.txt), [HTTP reference](https://docs.typesafe.ai/api), [JavaScript client reference](https://docs.typesafe.ai/sdk/javascript/api/classes/TypeSafeClient), and [Python client reference](https://docs.typesafe.ai/sdk/python/api/clients/sync) publish evaluation and model listing, without a billing resource.

The docs-linked [official JavaScript SDK v0.6.0 client source](https://github.com/typesafe-ai/typesafe-sdk-js/blob/v0.6.0/src/client.ts) corroborates that surface: `systemOne` and a `models` resource; its generic HTTP transport is private. Its [Usage interface](https://github.com/typesafe-ai/typesafe-sdk-js/blob/v0.6.0/src/types.ts) contains only `input_tokens` and `output_tokens`. Neither the documented response nor those types include a dollar cost or remaining credits. Source discovery: [official JavaScript SDK introduction](https://docs.typesafe.ai/sdk/javascript).

## What is documented

| Capability | Evidence |
| --- | --- |
| Per-request token usage | Evaluation responses contain input and output token counts. There is no documented aggregate usage endpoint. [HTTP reference](https://docs.typesafe.ai/api) |
| Price | Jev 1.13 costs $0.042 per million input tokens; output is free. This permits application-side cost calculation, subject to account pricing and changes. [Models](https://docs.typesafe.ai/models) |
| Balance visibility | The customer can view the credit balance in their account. The agreement does not promise a programmatic balance endpoint. [Master Customer Agreement, section 8.2](https://typesafe.ai/legal/mca) |
| Credit replenishment | Automatic refill is optional. With it enabled, a threshold or exhausted balance triggers the selected refill amount. [Master Customer Agreement, section 8.2(a)](https://typesafe.ai/legal/mca) |
| Exhaustion without refill | TypeSafe may decline output when credits are exhausted; this is not a documented atomic, zero-overshoot financial guarantee. [Master Customer Agreement, section 8.2(a)](https://typesafe.ai/legal/mca) |
| Daily/monthly monetary caps | None found in the public docs, SDK interface, or credit terms. Account-specific console features remain unverified. [Documentation index](https://docs.typesafe.ai/llms.txt), [Master Customer Agreement, section 8](https://typesafe.ai/legal/mca) |
| Traffic limits | Published token/request rate limits restrict throughput, not GoodWatch's daily or monthly spending. [Models](https://docs.typesafe.ai/models) |

## Unknowns that matter

- No public guarantee was found for credit-balance freshness, debit timing, or concurrent-request enforcement. A hypothetical fetched balance would still need those guarantees before it could enforce a hard cap.
- No published rule establishes whether failed, timed-out, or client-aborted requests are charged. The credit terms describe consumption for submitted input without specifying these outcomes. A client timeout is not evidence that inference was free. [Master Customer Agreement, section 8.2](https://typesafe.ai/legal/mca)
- The HTTP error list documents 401, 422, 429, and 529, without an exhausted-credit status or error shape. Do not assume that the direct API emits a reseller's `402 insufficient_credits` contract. [HTTP reference](https://docs.typesafe.ai/api)
- SDK retries can produce additional attempts. Defaults retry timeouts and connection failures and allow two retries; production's accepted no-retry policy must override them. [RetryPolicy](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RetryPolicy)

## Implication for the pending decision

**Recommendation, not a newly accepted decision:** enforce the agreed $1/day and $5/month limits using GoodWatch's own shared, durable spending ledger. It does not need a TypeSafe budget-fetch API.

Before paid work, atomically reserve a conservative cost allowance against both limits. Include every paid call required by the search, including translation if introduced; a cache hit that still invokes translation is not free. All application instances must use the same reservation mechanism so simultaneous searches cannot each spend the same remaining allowance. Reconcile received token usage at the configured price. Retain the reserved allowance for an attempt with an unknown billing outcome instead of assuming timeout means zero cost.

A post-response token counter alone cannot enforce a hard ceiling: several in-flight requests can exceed the remaining amount before any response updates it. The reservation must cover a verified upper bound on admitted requests' billable input, with request-size limits and a versioned price configuration. Average observed search cost is useful for forecasting, not a safe upper bound. These are engineering deductions from the documented per-request accounting and unknown debit timing, not TypeSafe-provided guarantees.

The clarified user decision is therefore: **if GoodWatch cannot atomically reserve its own budget allowance, should it stop new paid requests and serve basic search, while still using cached interpretations when no paid step is needed?** This remains pending live agreement.

For provider-side confirmation later: ask whether a supported balance/usage API or configurable monetary limits exist, how concurrent credit debits behave, and which failed/aborted requests are charged. No support message has been sent.
