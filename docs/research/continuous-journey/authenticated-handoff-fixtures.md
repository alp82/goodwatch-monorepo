# Authenticated handoff fixtures

Established 2026-09-18 against `ef163b0ac13be83069fa042a192d274f35c85acf`, using the existing localhost:3003 app and Chrome DevTools MCP 1.3.0. Canonical findings live in [Verify authenticated guest handoff and import recovery](https://github.com/alp82/goodwatch-monorepo/issues/88); this document supplies reusable setup, not release acceptance.

## Ownership and access

The user authorized `alportac+[your-label]@gmail.com`. This effort owns `alportac+goodwatch-handoff-20260918-new@gmail.com`. It was created through normal signup; the user opened its confirmation email, and normal password sign-in subsequently succeeded. No personal browser session, database authentication bypass, or confirmation-code replay was used.

Password: local mode-0600 `/tmp/goodwatch-handoff-88/credentials.json`, in a mode-0700 directory. Do not publish its contents. Dedicated browser profile: `/tmp/goodwatch-handoff-88/browser`. Chrome DevTools MCP is running behind a mode-0600 Unix socket `/tmp/goodwatch-handoff-88/bridge.sock`; its process and profile are retained for the following delivery ticket. These `/tmp` fixtures may disappear after reboot. Recreate through normal signup and user-controlled email confirmation if absent. Do not assume connected Gmail access.

## Current retained state

One account was exercised sequentially from new, through existing/incomplete onboarding, to existing/completed onboarding. These are repeatable lifecycle states, not three independent identities.

Account settings: country US, service `9`, country and streaming completion `yes`.

| Member data | Current fixture |
| --- | --- |
| Scores | movie-550 = 2, movie-680 = 7, movie-13 = 6 |
| Written review | movie-550: `Controlled handoff fixture: preserve this written review.` |
| Watched | movie-550 |
| Wishlist | movie-27205, movie-603, movie-155, movie-122 |
| Skip | show-1399 |

Original browser country is DE, services `8,9`. Pending `onboarding_ratings` holds movie-550 score 3 and movie-120 `plan`, with timestamps. This yields a score conflict, new Wishlist item, and preference differences. Completed onboarding currently bypasses this payload. The profile is left at the authenticated homepage under mobile emulation (requested 390×844 with touch; measured layout viewport 408×883), with no fetch interception active.

## Reproduce/reset within this controlled account

Authenticate normally before any setup. Use the application's authenticated endpoints from the isolated browser, so identity is always taken from its real session. Never supply another user ID.

- `/api/user-settings/set` accepts POST JSON `{ "settings": { "onboarding_country_completed": "no", "onboarding_streaming_completed": "no" } }` to establish incomplete onboarding, or `yes` for both to establish completed onboarding. `country_default` and `streaming_providers_default` establish preference conflicts. Read back `/api/user-settings/get` before navigating or seeding pending guest data: an immediate reload during fixture setup consumed stale settings once and auto-imported data before completed settings became visible.
- `/api/update-scores`: POST `{ "tmdb_id": 550, "media_type": "movie", "score": 4, "review": "Controlled handoff fixture: preserve this written review." }` creates the member conflict/review. A null score removes that score row.
- `/api/update-watch-history`: POST `{ "tmdb_id": 550, "media_type": "movie", "action": "add" }`; `remove` resets it.
- `/api/update-wishlist` and `/api/update-skipped` use the same media identity and `action: add/remove` shape. Remove only fixture IDs listed above when cleaning up.
- Read back `/api/user-data` to confirm account state. Writes and immediate reads can differ until database visibility catches up; do not interpret the first read as durable failure without rechecking.
- Seed only nonsecret browser fixture keys: `onboarding_ratings` is an array of `{tmdb_id, media_type: "movie"|"show", type: "score"|"plan"|"skip", score?, timestamp}`; `country` is `DE`; `withStreamingProviders` is `8,9`. Remove `onboarding-banner-dismissed` from sessionStorage to show retry controls. Reload to mount the real banner. These are controlled fixture preparations, not proof of every guest UI entry path.

For partial failure, one valid score row followed by a nonnumeric `tmdb_id` score row plus a valid Wishlist row caused real account-scoped partial writes and API failure. Replace the invalid ID with a real fixture ID (13 was used), then reload/retry. Do not introduce malformed IDs outside this account or change shared infrastructure. Browser-only fetch interception was used for pre-write, lost-response and settings-failure probes; a full reload removed it. No application code or automated tests were added.

## Cleanup and remaining owners

Retain this fixture through [Implement confirmed account transfer and recovery](https://github.com/alp82/goodwatch-monorepo/issues/90) and coordinate it with [Verify journey deployment access and recovery procedure](https://github.com/alp82/goodwatch-monorepo/issues/93). After consumers finish, remove its controlled rows through authenticated app APIs, verify empty member data, sign out, stop the dedicated browser/MCP bridge, and delete its private `/tmp` directory. Account deletion itself was not exercised; if permanent deletion is needed, the account/operator owner must use an established authenticated/admin account deletion mechanism. Do not improvise direct auth-table changes.

Delivery owns complete post-change desktop/mobile behavior, genuinely new signup with guest payload already present, independent account isolation, pending data through second-device confirmation, review/selection/decline semantics, and real-network interruption coverage. [Deploy and verify the completed recommendation journey](https://github.com/alp82/goodwatch-monorepo/issues/94) owns production repetition. This baseline does not waive those gates.
