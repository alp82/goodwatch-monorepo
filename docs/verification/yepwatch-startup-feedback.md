# YepWatch connection and startup feedback — 2026-11-11

Production investigation used read-only container logs, SQL summaries and the existing authenticated room-search endpoint. No room was created or changed.

The room-search endpoint returned HTTP 503 `interpretation_unavailable` on four attempts (100–2759 ms). Search history recorded `basic / budget`. Paid search was not halted: the ledger showed $0.994544082 for the day and $3.107149542 for the month, against the existing $1/day and $5/month limits. The next reading's reservation could not fit. The endpoint discarded that reason and the room API converted the response to retryable `busy`, leaving a saved action and connection-style retries. Spending limits remain unchanged pending the owner's decision.

The search batch now carries the existing reading refusal reason. Budget refusal reaches the room API as a non-retryable catalog failure, with a message that the person can start without an idea. Generic transport failures retain their existing recovery behavior. This needs deployment of both the search roles and the YepWatch API; deploying only the app does not change the server refusal.

The new-room editor now accepts typing and preset choices while admission is pending. Its draft passes to the admitted room without entering the URL. Existing admission persistence and retries remain in place. Solo voting suppresses the MATCH celebration while retaining the vote controls and matches chip; disconnected participants still count as room members.

Start formerly awaited each show's episode catalog serially. It now reads up to six needed cards concurrently, retains ranked order and stops reading when the page is full. A controlled 12-show case with 10 ms reads measured 122 ms before and 20–21 ms after. This is a local dependency-delay test, not a production latency claim.

Validation:

- App: all 187 unit tests; TypeScript; lint (one existing unused-import warning in the legacy voting component).
- Backend/search: 218 passing tests, seven opt-in integration tests skipped; additional targeted regression checks passed.
- Browser: 25 passing checks covering delayed room creation, draft retention, presets, reconnects, starts, solo voting, multiplayer proposals and the existing room journey.
- Standalone API release bundle builds successfully using the lockfile dependencies.

Regression commands from the relevant package directory:

```sh
# goodwatch-webapp
node --test app/server/combined-search/yepwatch-room-search.test.ts app/server/yepwatch/catalog-adapter.test.ts

# yepwatch-app
npx playwright test tests/glow-browser/startup-feedback.spec.ts tests/glow-browser/new-room-arrival.spec.ts tests/glow-browser/room-redesign.spec.ts tests/glow-browser/reconnect.spec.ts
```
