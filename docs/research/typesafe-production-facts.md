# TypeSafe in production: limits, failures, and data handling

Research for [#112](https://github.com/alp82/goodwatch-monorepo/issues/112), a child of the map [#100](https://github.com/alp82/goodwatch-monorepo/issues/100). It feeds [#113](https://github.com/alp82/goodwatch-monorepo/issues/113), the production architecture ticket.

- **Date read:** 2026-09-20. TypeSafe warns that limits change, so re-check before launch.
- **Sources:** the live TypeSafe docs, the legal pages that the docs link to, the public status page, and the published npm package `@typesafe-ai/sdk@0.6.0`. No secondary sources.
- **Convention:** a quoted sentence is copied from the linked page. A line marked **Derived** is arithmetic or reasoning on top of quoted facts. A line marked **Not stated** means that the docs are silent. This file doesn't guess in those places.

## Summary

| Topic | Fact |
| :-- | :-- |
| Rate limits | 250,000 tokens per second and 1,200 requests per minute for `jev-1.13.0`. Over either limit returns `429`. Limits "can change without notice". |
| Overload | `529 Overloaded` is a separate status. The docs say to retry it with exponential backoff. |
| SDK defaults | `@typesafe-ai/sdk` 0.6.0: 10 s timeout per attempt, 2 retries, 500 ms first backoff, honors `Retry-After` up to 60 s, no total time budget. The defaults don't suit an interactive search. Override them. |
| SDK and Remix | Node.js 20 or newer, ESM and CommonJS, zero runtime dependencies, uses the global `fetch`. It refuses to run in a browser by default. It fits a Remix server module. |
| Keep-alive | Not stated. The SDK has no connection settings. It accepts a custom `fetch` "for transport configuration". |
| Training | "Jev is not trained on customer requests or responses." The contract repeats this. |
| Retention | No fixed retention period is published. Zero data retention exists for enterprise customers only. |
| Status page | `https://status.typesafe.ai` exists. The docs don't link to it. 99.855% API uptime over the last 90 days. |
| SLA | None published. The contract provides the service "AS IS" and "AS AVAILABLE". |
| Model versions | `jev-latest` moves on each release. Versioned IDs such as `jev-1.13.0` can be pinned. The response reports the versioned ID that answered. No deprecation policy is published. |
| Pricing | $0.042 per million input tokens. Output tokens are free. |
| Failed requests | Not stated whether a failed request is billed. |

## Rate limits and enforcement

Source: [Models](https://docs.typesafe.ai/models.md).

- The limits for Jev 1.13 (`jev-1.13.0`) are "250,000 tokens per second / 1,200 requests per minute".
- Enforcement: "Measured in tokens per second and requests per minute. A request over either limit returns `429 Too Many Requests`. Our client SDKs retry with backoff by default and honor the `retry-after` header when the response carries one."
- Stability: "**Rate limits are adjusting dynamically.** We are serving a very large volume of demand, and the limits above can change without notice while we do, as upcoming large GPU deals land and we let in more users. Once things settle down more, we'll be able to offer more stable limits. Higher limits are available on custom and enterprise plans. Contact sales@typesafe.ai."
- Context limits also bound a request: "64k tokens per request; 32k tokens for `state` plus the longest question".
- The contract treats limits as binding. Customer must not "exceed any Usage Limits" ([Master Customer Agreement](https://typesafe.ai/legal/mca), section 2.3 (j)).

**Not stated:**

- Whether limits apply per API key, per account, or per organization.
- The counting window (fixed or sliding), and whether short bursts are allowed.
- Whether a `429` always carries a `Retry-After` header. The models page says "when the response carries one".
- Any rate-limit headers on successful responses, such as remaining quota.
- Any way to read the current limits through the API.

**Derived, for our pipeline:**

- A search makes two Jev requests. 1,200 requests per minute is 20 requests per second, so the request limit allows about 10 searches per second, or 600 per minute.
- A search uses 6,600 to 8,000 input tokens. 250,000 tokens per second allows about 31 to 37 searches per second.
- The request limit binds first. A cache that skips both Jev calls is the main lever. Merging the two requests would double the ceiling, but our measurements show that two medium requests in parallel beat one merged request on latency.
- Because limits can drop without notice, the design can't treat 600 searches per minute as a guarantee. It needs a fallback for `429`.

## JavaScript SDK behavior

Sources: [JavaScript SDK](https://docs.typesafe.ai/sdk/javascript.md), [TypeSafeClientConfig](https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig.md), [RetryPolicy](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RetryPolicy.md), [RequestOptions](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RequestOptions.md), [changelog](https://docs.typesafe.ai/sdk/javascript/changelog.md), and the npm package `@typesafe-ai/sdk@0.6.0` (`npm view`, then the tarball's `dist/index.mjs`).

### Package facts

- The package exists on npm as `@typesafe-ai/sdk`. The latest version is 0.6.0, published 2026-09-15. The license is MIT.
- "Install the SDK (Node.js 20 or newer)". The package declares `engines: { node: ">=20" }`.
- "The package includes ESM, CommonJS, and TypeScript declarations."
- It has no runtime dependencies (`npm view @typesafe-ai/sdk dependencies` is empty).
- It's young. The changelog says that v0.5.7 (2026-09-11) "is the initial public release". v0.6.0 followed four days later with a breaking change: "accept `Score.criteria` as an ordered sequence instead of a dictionary keyed by integers". Pin an exact version.

### Timeouts

- `timeout`: "Timeout per attempt in milliseconds, without a total retry budget. Default: 10000."
- The timeout covers the whole response. `APITimeoutError` means "The full response did not arrive within the timeout."
- A per-call `timeout` and an `AbortSignal` are available. `signal` is a "Cancellation signal for the request and pending retries."

### Retries

Defaults from the RetryPolicy page:

| Setting | Default | Meaning |
| :-- | :-- | :-- |
| `maxRetries` | 2 | "Maximum retries after the initial attempt; `0` disables retries." |
| `httpStatuses` | 408, 429, 500 to 599 | "HTTP status codes to retry." This range includes 529. |
| `apiConnectionError` | true | "Retry connection failures, including interrupted response bodies". |
| `apiTimeoutError` | true | "Whether to retry `APITimeoutError`." |
| `backoffInitialMs` | 500 | "First backoff delay in milliseconds, doubled up to `backoffMaxMs`." |
| `backoffMaxMs` | 5000 | "Maximum backoff delay in milliseconds." |
| `backoffJitter` | 0.25 | "Fraction of each backoff delay randomly subtracted, from 0 to 1." |
| `respectRetryAfter` | true | "Honor `Retry-After` and `retry-after-ms` up to `maxRetryAfterMs`." |
| `maxRetryAfterMs` | 60000 | "Maximum server retry delay in milliseconds; longer delays use backoff." |

Retry settings can be set per client and per call. The SDK source confirms the docs: it sends an `X-TypeSafe-Retry-Count` header on retries, and it prefers `retry-after-ms` over `Retry-After`.

**Derived:** with the defaults, one call can block for about 31.5 s (three attempts of 10 s, plus backoffs of up to 0.5 s and 1 s). If the server sends `Retry-After`, the SDK waits up to 60 s per retry, so the worst case is about 150 s. There is no total budget. An interactive search must override these values. A starting point for #113, to be tuned against measurements:

- A per-attempt `timeout` of about 1.5 to 2 s. Our requests take 320 to 530 ms for 148 questions, with a floor of about 300 ms.
- `maxRetries` of 0 or 1, with `respectRetryAfter: false` or a small `maxRetryAfterMs`, so that a server delay can't hold a user request.
- One `AbortSignal` shared by both parallel Jev calls, as the total budget. Tie it to the Remix request signal so that an abandoned search stops retrying.

### Keep-alive and connections

**Not stated.** The docs and the SDK source contain no keep-alive, agent, or pool setting. The documented hook is the `fetch` option: "Custom HTTP fetch implementation for transport configuration or tests. Default: global `fetch`." The source calls that `fetch` directly and buffers the response body inside the timeout.

Connection reuse therefore depends on the runtime's `fetch`, not on the SDK. Our measured latency floor of about 300 ms came from a dev machine with raw `fetch`. #113 should measure the floor from the production host, with a warm client, before it sets latency targets.

### Fit for a Remix (Node) server

The SDK fits:

- It targets Node.js 20 or newer and ships CommonJS and ESM. The webapp uses `@remix-run/node` and `@remix-run/serve`. `goodwatch-webapp/package.json` declares only `node >=14`, so confirm that production runs Node 20 or newer.
- It uses the global `fetch` and throws at construction when none exists.
- It guards the key. `dangerouslyAllowBrowser`: "Allow browser use, exposing the API key to page users. Default: false." Keep the client in a `.server.ts` module.
- Create one `TypeSafeClient` per process and reuse it. It reads `TYPESAFE_API_KEY`, `TYPESAFE_BASE_URL`, `TYPESAFE_DEFAULT_MODEL`, and `TYPESAFE_LOG_LEVEL`.
- Set `defaultModel` to a versioned ID. The SDK default is `jev-latest`.
- Logging: "`info` logs request summaries; `debug` adds headers and bodies. Known credential headers are redacted; bodies are not." Never run `debug` in production, because bodies contain user-typed text.
- `client.systemOne(...)` returns an `APIPromise`. The [WithResponse](https://docs.typesafe.ai/sdk/javascript/api/interfaces/WithResponse.md) type exposes the `requestId` "from `x-typesafe-request-id`". Log it with each failure.

The prototypes call the HTTP API with raw `fetch`. That also works. The SDK adds typed answers, the retry policy, and the error classes, at the cost of a dependency that's nine days old.

## Errors and recommended handling

Sources: [API reference, Errors](https://docs.typesafe.ai/api.md#errors) and the SDK error class pages.

The HTTP API documents four statuses:

| Status | Docs wording |
| :-- | :-- |
| `401 Unauthorized` | "Missing or invalid API key. Check the `Authorization` header." |
| `422 Unprocessable Entity` | "The request body failed validation — for example a missing required field or a malformed question. The body details the offending field." |
| `429 Too Many Requests` | "You have exceeded your rate limit. Back off and retry after a short delay." |
| `529 Overloaded` | "TypeSafe is temporarily overloaded. Retry after a short delay." |

Recommended handling, from the same page: "When you receive a `429 Too Many Requests` or `529 Overloaded` response, retry the request with exponential backoff instead of retrying immediately. Our client SDKs handle this automatically, so no extra handling is needed if you use one of our SDKs with its default retry policy."

SDK error classes (all extend [`TypeSafeError`](https://docs.typesafe.ai/sdk/javascript/api/classes/TypeSafeError.md)):

| Class | When | Retried by default |
| :-- | :-- | :-- |
| [`BadRequestError`](https://docs.typesafe.ai/sdk/javascript/api/classes/BadRequestError.md) | 400 | No |
| [`AuthenticationError`](https://docs.typesafe.ai/sdk/javascript/api/classes/AuthenticationError.md) | 401 | No |
| [`PermissionDeniedError`](https://docs.typesafe.ai/sdk/javascript/api/classes/PermissionDeniedError.md) | 403 | No |
| [`NotFoundError`](https://docs.typesafe.ai/sdk/javascript/api/classes/NotFoundError.md) | 404 | No |
| [`UnprocessableEntityError`](https://docs.typesafe.ai/sdk/javascript/api/classes/UnprocessableEntityError.md) | 422 | No |
| [`RateLimitError`](https://docs.typesafe.ai/sdk/javascript/api/classes/RateLimitError.md) | 429. Has `retryAfterMs`: "Server retry delay in milliseconds, or `undefined` when absent or invalid." | Yes |
| [`InternalServerError`](https://docs.typesafe.ai/sdk/javascript/api/classes/InternalServerError.md) | "HTTP 5xx". The SDK source maps every status of 500 or more here, so 529 arrives as `InternalServerError` with `status === 529`. There is no separate overloaded class. | Yes |
| [`APIConnectionError`](https://docs.typesafe.ai/sdk/javascript/api/classes/APIConnectionError.md) | "The request or response-body delivery failed (DNS, TLS, connection closed, etc.)." | Yes |
| [`APITimeoutError`](https://docs.typesafe.ai/sdk/javascript/api/classes/APITimeoutError.md) | "The full response did not arrive within the timeout. A kind of `APIConnectionError`." | Yes |
| [`APIUserAbortError`](https://docs.typesafe.ai/sdk/javascript/api/classes/APIUserAbortError.md) | "The caller cancelled the request through an `AbortSignal`." | Never |

Every [`APIError`](https://docs.typesafe.ai/sdk/javascript/api/classes/APIError.md) carries `status`, `body`, `headers`, and `requestId`.

**Not stated:** the JSON shape of error bodies, and a status for an exhausted credit balance. The contract only says that TypeSafe "may decline to generate Output" when credits run out (MCA section 8.2 (a)).

**Derived, for #113:**

- 401, 403, and 422 are bugs or configuration faults. Don't retry them. Alert on them.
- 429, 529, 5xx, timeouts, and connection errors all mean "no Jev reading in time". For a search box, the docs' advice to back off and retry is only useful within a budget of a few hundred milliseconds. After that, serve the fallback (title search and vector search without Jev).
- Log `status`, `requestId`, and `retryAfterMs`.
- A service failure is different from a low-confidence answer. [Confidence](https://docs.typesafe.ai/confidence.md) covers only the second.

## Data handling for user-typed text

Sources: [Models, Data handling](https://docs.typesafe.ai/models.md#data-handling), [Legal](https://docs.typesafe.ai/legal.md), [Master Customer Agreement](https://typesafe.ai/legal/mca) (last updated Sep 19, 2026), [Data Processing Addendum](https://typesafe.ai/legal/data-processing) (last updated Apr 24, 2026), [Privacy Policy](https://typesafe.ai/legal/privacy-policy) (last updated Nov 19, 2025).

### Training

- Models page: "Jev is not trained on customer requests or responses." Also: "Jev is not fine-tuned or LoRA-adapted with customer data."
- MCA section 4.1: TypeSafe "will not, include Customer Data in a dataset used to train (i.e., to modify the model weights of) any artificial intelligence or machine learning models without Customer's prior consent."
- Privacy Policy: "We (1) will not train or fine tune any artificial intelligence or machine learning models on Input, and (2) will not disclose any Input to a third party other than our service providers."

### Retention

- No retention period in days is published anywhere.
- Legal page: "We also offer zero data retention (ZDR) for enterprise customers. Contact privacy@typesafe.ai to learn more." Standard accounts therefore don't have zero retention.
- DPA, Schedule I, item 8: "Customer Personal Data will be retained for as long as necessary taking into account the purpose of the Processing, and in compliance with applicable laws".
- MCA section 10.3: "TypeSafe will be under no obligation to store or retain Customer Data and may delete Customer Data at any time in its sole discretion."
- MCA section 4.1 (c) grants TypeSafe a perpetual right to use Customer Data "(i) to derive and generate Telemetry, (ii) to monitor for fraud and abuse of the Services, and (iii) as necessary to comply with applicable Laws."
- MCA section 4.3: "'Telemetry' means information generated in connection with the Services, such as technical logs, hashes, summary statistics and classifications, metrics, and learnings related to Customer's use of the Services. TypeSafe may Process Telemetry without restriction, including to improve the Services".

### Sending text that end users type

- The contract allows it. MCA section 2.2 permits including the API in applications "developed and operated by Customer for the benefit of Customer's end users". Section 4.1 defines Input as material that "Customer (including Customer Users or End Users) inputs".
- The responsibility is ours. MCA section 5: "Customer is responsible for Input, including its content and accuracy, and will comply with Laws when using the Services. Customer represents, warrants, and covenants that it has made all disclosures, has provided all notices, and has obtained (and will maintain) all rights, consents, and permissions necessary".
- Roles under the DPA, section 1.1: "Customer is the 'controller'" and "Typesafe is the 'processor'". Data subjects include "Customer and Customer's users". The DPA is incorporated into the MCA by section 4.4.
- Processing scope, DPA section 2.1: "Typesafe will only Process Customer Personal Data to provide the Services and in accordance with Customer's documented instructions".
- Transfers: the DPA relies on the EU standard contractual clauses (Module 2) and the UK Addendum. TypeSafe AI, Inc. is based in San Francisco.
- Security incidents: notice "within 72 hours" (DPA section 5.2).
- Subprocessors are listed at `https://trust.typesafe.ai/subprocessors`. That page renders with JavaScript, and this research didn't read the list.
- The MCA references an Acceptable Use Policy at `typesafe.ai/legal/aup`. That URL returned 404 on 2026-09-20.

**Derived, for #113:**

- A search request is free text. It can contain personal data even though we don't ask for any. Send only the typed request. Don't send user IDs, emails, or IP addresses in the state.
- GoodWatch's privacy policy should name TypeSafe as a processor of search text. The user should confirm this. This file isn't legal advice.
- Our own cache of readings stores user-typed text too. Its retention is our decision, not TypeSafe's.

## Status page, SLA, and model versions

### Status page

- A status page exists at [status.typesafe.ai](https://status.typesafe.ai), hosted on Better Stack. **The docs don't mention it.** This research found it by probing the URL.
- It monitors `api.typesafe.ai` and `console.typesafe.ai`. Machine-readable data is at `https://status.typesafe.ai/index.json`.
- On 2026-09-20, for 2026-06-22 to 2026-09-19: API availability of 99.855%, downtime on 22 of 90 days, about 188 minutes in total. The longest day was 2026-08-04 with 59 minutes. Most incidents lasted 2 to 8 minutes.
- The page lists no incident reports, only monitor results.

**Derived:** short outages are routine, about one day in four. The fallback path in #113 will run in normal operation, not only in rare emergencies.

### SLA

**None published.** No docs page or legal page contains an uptime commitment or service credits.

- MCA section 9.3: "THE SERVICES AND DOCUMENTATION ARE PROVIDED 'AS IS' AND 'AS AVAILABLE'" and "TYPESAFE DOES NOT WARRANT THAT CUSTOMER'S USE OF THE SERVICES WILL BE UNINTERRUPTED OR ERROR-FREE".
- MCA section 3: support is "commercially reasonable efforts", by email to support@typesafe.ai.
- MCA section 6 lets TypeSafe suspend access immediately in listed cases, including when "Customer's actions risk harm to any of TypeSafe's other customers or the security, availability, or integrity of the Services".
- Higher limits "are available on custom and enterprise plans". The docs don't say whether those plans include an SLA.

### Versioned model IDs

Source: [Models, Aliases](https://docs.typesafe.ai/models.md#aliases).

- `jev-latest` points to `jev-1.13.0`: "The most recent stable, official release. The default in our client SDKs, and the name the examples in these docs use."
- `jev-preview` points to the same model today: "Moves ahead of `jev-latest` when a preview build is available."
- The key statement: "An alias moves when a new release ships, so the answers behind it can change without a change on your side. The response's `model` field reports the versioned ID that answered, so you can log which model produced each result. If you have tuned confidence thresholds against a specific version, pin that version's ID instead of the alias and move to the new one on your own schedule."
- "Versioned IDs such as `jev-1.13.0` are accepted by the `model` field whether or not they appear in the list." `GET /v1/models` "currently lists the aliases".
- MCA section 2.5: TypeSafe "may from time to time update the Services" and "will use commercially reasonable efforts to provide advance notice of any updates to the API that TypeSafe believes will materially and adversely impact Customer's ability to integrate".

**Not stated:**

- How long an old versioned ID stays available, and how much notice precedes its removal.
- Whether a versioned ID is immutable, or whether a patch can change its answers.
- A model changelog or release-notes page. Only the SDKs have changelogs. The docs do publish known weaknesses per version, for example [Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md).

**Derived, for the cache in #113:**

- Pin `jev-1.13.0` in production. Our thresholds (0.6 for wanted, -1.2 for avoided, 15% for a second phrase) were tuned on it, which is exactly the case the docs name.
- Put the response's `model` value in the cache key, together with a hash of our question set. A model change or a question change then misses the cache instead of mixing readings.
- Because no deprecation policy exists, monitor for the day the pinned ID stops working. An unknown model most likely returns a 4xx, which the SDK doesn't retry. The docs don't state which status.
- Answers aren't perfectly repeatable. The [Parallel questions cookbook](https://docs.typesafe.ai/cookbooks/parallel_questions.md) reports that most answers had a run-to-run "std dev exactly 0.0", while two nouls "carry a little run-to-run sampling noise". A cache therefore also makes results stable for repeated requests.

## Pricing and billing

Source: [Models](https://docs.typesafe.ai/models.md) and [MCA section 8](https://typesafe.ai/legal/mca). The docs have no separate pricing page. `docs.typesafe.ai/pricing` and `typesafe.ai/pricing` return 404.

- Price for `jev-1.13.0`: "$42 / $0.042" per Btok and per Mtok. "Charged per input token. Output tokens are free. A Btok is a billion tokens and an Mtok is a million tokens."
- Every response reports `usage.input_tokens` and `usage.output_tokens` ([API reference](https://docs.typesafe.ai/api.md#response-body)). Use these values for our own cost tracking.
- Billing is prepaid. MCA section 8.2: "Customer must obtain TypeSafe-managed credits that are consumed by each Input submitted to the Services".
- Credits "are not redeemable, refundable, transferable". Purchased credits "expire on the earlier of (y) the end of the Term and (z) the date that is 12 months after the purchase date".
- With a zero balance and no automatic refill, "TypeSafe may decline to generate Output". With automatic refill, TypeSafe adds the chosen refill amount.
- "The rate at which Credits are consumed may vary based on account settings, including the model used".

**Not stated:**

- Whether failed requests are billed. No page addresses 4xx, 5xx, timed-out, or client-aborted requests. The phrase "consumed by each Input submitted" can be read either way. Ask support@typesafe.ai, or compare the console's usage against our own logs during a test with forced timeouts.
- Whether an SDK retry that succeeds is billed once or per attempt. Assume per attempt until TypeSafe says otherwise.
- Billing granularity beyond "per input token": no minimum charge per request, no rounding rule, and no billing increment is documented.
- Any discount for repeated state, such as prompt caching. None is documented.
- Any spending cap or budget alert. The contract mentions only the visible credit balance and the refill threshold.

**Derived, for the budget:**

- A search at 6,600 to 8,000 input tokens costs $0.00028 to $0.00034. That's $0.28 to $0.34 per 1,000 searches, which matches the map's baseline.
- At the request-limit ceiling of 600 searches per minute, the spend is about $0.20 per minute, or about $290 per day. The rate limit isn't a cost guard. #113 needs its own budget guard, for example a daily token counter fed by `usage.input_tokens`.
- Enable automatic refill, or alert on a low balance. An empty balance stops search readings.
- Each retry resends the full 6,600 to 8,000 tokens. Until TypeSafe states that failed attempts are free, count retries as cost.

## Context from our measurements

These numbers come from the prototype session on a dev machine, not from the docs.

- A request has a latency floor of about 300 ms.
- A request with 148 questions takes about 320 to 530 ms. Question count adds little on top of the floor.
- Two medium requests in parallel beat one merged request.
- A search uses 6,600 to 8,000 input tokens, and takes about 0.65 to 0.95 s with both Jev calls in parallel.

What they mean next to the documented facts:

- The SDK's default timeout of 10 s is about 20 times our typical request time. A timeout of 1.5 to 2 s still leaves a wide margin.
- One retry after a fast failure fits inside a budget of about 2 s. A retry after a timeout doesn't.
- The floor of about 300 ms dominates latency, so connection reuse and the network path from the production host matter more than question count. The docs give no latency figures to compare against, except one [cookbook](https://docs.typesafe.ai/cookbooks/consistency_choice_cookbook.md) run that reports "a mean round-trip latency of 114ms" for a single small Choice.

## Open questions for TypeSafe support

1. Are failed, timed-out, or aborted requests billed? Is each retry attempt billed?
2. What is the retention period for request bodies on a standard account?
3. How long do versioned model IDs stay available, and how is their removal announced?
4. Are rate limits applied per key or per account, and over which window?
5. Does a `429` always carry `Retry-After`?
