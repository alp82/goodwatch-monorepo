# YepWatch: initial stack and architecture proposal

Checked **2026-10-20**, current checkout and primary documentation. **Recommendation, not an accepted ADR or implementation approval.** YepWatch is the working name; **yepwatch.com ownership is user-reported**, not independently authenticated. No domain/configuration changes were made.

## Recommendation

**Use Expo + React Native + TypeScript for iPhone/Android, with Expo Web for the proposed browser guest journey. Add room endpoints to the existing GoodWatch Remix server. Use a small PostgreSQL store for durable rooms and HTTP writes plus foreground polling. Reuse GoodWatch accounts, catalog, watchability and taste server-side.**

The deliberate extra cost is PostgreSQL: transactional membership, vote retries and final consent are worth ordinary database transactions. Crate can support a bounded room as one atomic document, but extending its bespoke concurrency/recovery machinery is a real alternative cost. A new service, socket infrastructure, account database or webapp migration is unnecessary initially.

| Boundary | Initial choice — proposed | Why / reversal cost |
|---|---|---|
| Native + invited browser UI | Expo, React Native, TypeScript, Expo Router; Expo Web export | Same matcher journey, platform-specific controls where useful. Separate web UI remains possible behind independent contracts. |
| Client state/forms | TanStack Query + fetch; React state/reducer; Zod contracts | Snapshots/network state plus small forms. No initial Redux, form framework, client database or persisted global query cache. |
| Backend | Room module/resource routes in existing GoodWatch page service | Direct reuse without another catalog protocol/deployment. Extract a process only after measured isolation needs. |
| Durable rooms | Dedicated PostgreSQL, explicit SQL/transactions via pg | Multi-row atomicity, constraints and deterministic retries. Adds backup/restore and operations; changing stores later still needs data conversion. |
| Identity | GoodWatch OAuth code + PKCE; separate guest credentials | One account authority. Native public client and browser server callback. Current MCP-specific provider needs a spike. |
| Live updates | HTTP writes + foreground polling | Multi-instance operation without a bus. Add SSE if measured delay/load warrants it; no current feature requires sockets. |
| Delivery | Existing Coolify/Traefik; independent Expo web/native artifacts | Reuse operations. EAS Build is optional; signing, store review and real-device checks remain. |

**Confirmed:** native iPhone/Android matcher first; couch, remote and mixed groups from version one; all existing GoodWatch catalog/country/service coverage without a geographic/service launch shortlist; optional initial GoodWatch login and guests; later a separate simplified GoodWatch companion experience. **Proposed:** browser participation, viewing-screen model, movies-first, short decks, room limits/expiry and this stack. Coverage intent proves neither current offers/entitlements nor movie-versus-show scope. Remote choosing does not authorize playback synchronization. [Product research](goodwatch-mobile-group-matcher.md), [naming context](goodwatch-matcher-naming.md).

## Repository constraints and actual reuse

Inspected **feat/shared-scoring, HEAD d0937bee**, including unrelated local changes to auth/telemetry. Findings describe the working tree, **not verified production state**. Read root/webapp AGENTS, docs/agents instructions, CONTEXT, relevant ADRs and the research skill. The root has no package.json/workspace setup; the webapp has its own npm lockfile and local package dependency.

| Verified repository source | Reuse / necessary adaptation |
|---|---|
| [Webapp dependencies](../../goodwatch-webapp/package.json#L27), [auth package](../../goodwatch-webapp/packages/auth-stack/package.json#L1), [Dockerfile](../../goodwatch-webapp/Dockerfile#L16) | Remix/React DOM/TypeScript, Query, Zod and pg exist. Auth is isolated in a local package. Docker's build context is **the webapp directory**, explicitly copying that package. A pg dependency is not evidence of a room database deployment. |
| [Filter engine](../../goodwatch-webapp/app/server/title-filter/index.server.ts#L1), [taste](../../goodwatch-webapp/app/server/taste/index.server.ts#L1), [member context](../../goodwatch-webapp/app/server/viewer.server.ts#L86) | Actual catalog filtering, member/guest taste and private Seen/settings inputs exist. Server modules need a stable mobile API. Viewer context currently combines personal services and preferences; rooms must separate them. |
| [Availability index](../../goodwatch-webapp/app/server/availability-index.server.ts#L14), [evidence reader](../../goodwatch-webapp/app/server/availability.server.ts#L9), [evaluator](../../goodwatch-webapp/app/utils/availability-evidence.ts#L55) | Fast coarse candidates, then evidence-based watchability/no-match/unknown. Indexes may be cold/approximate; the existing evidence freshness limit is 30 days. Index membership is insufficient final proof. |
| [Batch evidence](../../goodwatch-webapp/app/server/availability.server.ts#L35) | Reads are grouped by country, but returned map keys at line 56 omit country. Repeated titles across countries can overwrite evidence. Call separately per country or add country-qualified keys for mixed/remote screens. |
| [Provider list](../../goodwatch-webapp/app/server/streaming-providers.server.ts#L23), [saved services](../../goodwatch-webapp/app/server/mcp/services.server.ts#L67), [link assembly](../../goodwatch-webapp/app/server/mcp/watch-links.ts#L38) | Reuse database choices and provider-versus-where-to-watch link distinctions. Provider folding needs tier/add-on review. Adapt underlying functions, not MCP wrappers with US defaults and MCP telemetry ([example](../../goodwatch-webapp/app/server/mcp/discover.server.ts#L21)). |
| [Role ADR](../adr/0011-search-runs-as-a-role-of-the-webapp-image.md#L20), [role code](../../goodwatch-webapp/app/server/role.server.ts#L11) | Page/search processes already isolate ranked search CPU. Room requests belong on page instances, without ranked search per swipe. Readiness can allow degraded startup ([runbook](../webapp-deploys.md#L37)); deck creation must independently refuse unavailable dependencies. |

**Missing:** room state/authorization, multi-screen eligibility, group ranking/consensus, stable contracts, YepWatch origin handling, native/browser member connection, invitations and cleanup. Expo does not supply these.

## Clients and packages

**Choose Expo Web/universal matcher screens**, rather than guest screens in Remix or a third standalone React client initially. Guests need the same join, screen setup, deck and result journey; GoodWatch's document/SEO shell is unnecessary. Expo documents [native/web routing](https://docs.expo.dev/router/introduction/) and [web development/export](https://docs.expo.dev/workflow/web/). Existing Remix pages stay independent. This choice loses if measured initial download, semantic forms, keyboard/screen-reader access or messaging-browser behavior hurts join completion; then use a small DOM guest client against the same API.

**Alternatives:** Flutter is reasonable if team expertise or a measured native interaction advantage outweighs sharing TypeScript contracts/rules; it introduces Dart and a different UI stack ([Flutter architecture](https://docs.flutter.dev/resources/architectural-overview)). Capacitor reuses DOM UI more directly, but needs a built web bundle and native plugin/release work ([setup requirements](https://capacitorjs.com/docs/getting-started)); the current SSR Remix app is not already that bundle. Neither removes room/auth work. With native clients confirmed and a new narrow matcher UI, Expo is the better initial fit; a PWA alone does not fulfill that native distribution goal.

Use Gesture Handler/Reanimated for the draggable deck, following [Expo's gesture primitives](https://docs.expo.dev/tutorial/gestures/), with labelled vote/pass/undo buttons, web keyboard controls, reduced motion and tested large text. React Native exposes [accessibility roles/actions](https://reactnative.dev/docs/accessibility); test VoiceOver/TalkBack and focus after advancing a card. Use OS sharing. Displaying a QR requires no camera permission; a dedicated scanner can wait while system cameras/manual codes handle joining.

Query owns snapshots/status/invalidation; local React state owns forms/animation. Wire app foreground/network events as the [Query native guide](https://tanstack.com/query/latest/docs/framework/react/react-native) describes. Define matcher-wide freshness/polling once rather than inheriting GoodWatch web defaults. An optimistic swipe is pending until acknowledged, not a shared match. On resume, fetch a snapshot before replaying a pending command; no indefinite offline vote queue initially.

Set browser session cookies Secure, HttpOnly and SameSite=Lax, with explicit CSRF protection for writes. Encrypt server-held OAuth refresh credentials at rest and bound their retention to the grant/session. Native room credentials/member refresh tokens belong in [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/), access tokens preferably in memory. Browser credentials use HttpOnly server-issued cookies, not localStorage. Lost credentials require explicit rejoin/transfer; nicknames never prove ownership. Avoid persisted private query caches.

Suggested boundaries, **not scaffolded**:

- **yepwatch-app/**: own npm manifest/lockfile, Expo routes, native/web UI, HTTP and credential adapters. Choose SDK-compatible versions at implementation; do not force the existing React DOM app onto Expo's dependency versions.
- **goodwatch-webapp/packages/yepwatch-contracts/**: portable schemas, identifiers, error codes and pure consensus transitions. Both apps consume a local package; no React/browser globals/server imports. Explicitly add its Docker copy when implementing. Use the existing webapp Zod major rather than adding another validator.
- **goodwatch-webapp/app/server/yepwatch/**: orchestration, storage port/PostgreSQL adapter, catalog/watchability/account adapters; thin Remix resource routes.
- A sibling infrastructure directory, such as **goodwatch-yepwatch/**, only if deployment/runbook files warrant one.

No root workspace/Turborepo/pnpm migration is needed. Prove local-package export/build resolution and native dependency isolation in a tiny native/web build; [Expo's monorepo guide](https://docs.expo.dev/guides/monorepos/) documents duplicate React/native-module constraints. Later the companion can share identity transport/contracts and proven native primitives without importing room UI. Separate product experiences do **not** settle one versus two store listings.

Use existing Node tests for pure/server rules, disposable PostgreSQL integration tests for races, and [jest-expo/React Native Testing Library](https://docs.expo.dev/develop/unit-testing/) for consequential UI behavior. Start with a few real browser/device journeys; automate them once stable.

## Server and cross-domain identity

**Keep room endpoints in the existing service initially**, with a bounded DB pool, deck-generation admission and separate metrics. Catalog/taste calls remain in-process. Keep filtering out of vote/poll handlers. A separate process becomes justified if room latency suffers from page CPU, release/scaling requirements diverge, or persistent connections dominate. Existing [search-role isolation](../search-role.md#L30) is precedent, not a reason to add another role now. Register connections/timers with [existing shutdown handling](../webapp-deploys.md#L62).

Expose versioned JSON HTTP at **/api/yepwatch/v1**: catalog choices, create/join, authenticated snapshot, screen/constraints/roster commands, private vote/undo, proposal/consent/finalize, member prefill/link. Validate server-side with shared schemas. Stable errors include conflict, expired, needs-context, no-intersection and temporarily-unavailable. Favor additive contracts compatible with older installed clients; no GraphQL/tRPC/MCP protocol is needed.

**Guests:** issue random room-scoped participant credentials, storing hashes/verifiers. Browser: a YepWatch opaque session cookie maps to credentials server-side. Native: explicit room bearer credential. Check membership/capability/expiry on every request. An invite authorizes joining, not viewing private state; short codes are rate-limited discovery, not authentication. Host capability is separate. Persist sessions/receipts with rooms, not only in Valkey.

**Members:** GoodWatch remains the account authority. Existing auth has a custom Crate adapter, email/password, Google, a gw.session_token cookie and durable sessions ([configuration](../../goodwatch-webapp/app/server/auth/auth.server.ts#L94), [session options](../../goodwatch-webapp/app/server/auth/auth.server.ts#L272), [Google](../../goodwatch-webapp/app/server/auth/auth.server.ts#L650)). Auth is conditional/configured ([runtime](../../goodwatch-webapp/app/server/auth/runtime.server.ts#L42)); deployment compatibility is unverified.

Recommend **OAuth authorization code + PKCE in the system browser**, Expo AuthSession on native and server callback/BFF on web. GoodWatch cookies stay on goodwatch.app; code exchange creates YepWatch's own session. Unrelated domains cannot share cookies ([domain rules](https://httpwg.org/specs/rfc6265.html#section-5.2.3)). Browser tokens stay server-side; native is a public client with no embedded secret. Bind state/PKCE/exact callbacks, preserve invite context, and request a dedicated YepWatch audience/resource with minimal private-prefill read scope. Validate issuer/audience/expiry/client/scopes and current grant/revocation before private reads. ID tokens are not room API access tokens. [Expo OAuth](https://docs.expo.dev/guides/authentication/), [Better Auth provider](https://better-auth.com/docs/plugins/oauth-provider).

**Auth is a spike, not a toggle:** resource-bound OAuth and refresh/revocation already exist, but configured for MCP ([provider](../../goodwatch-webapp/app/server/auth/auth.server.ts#L107), [MCP-only consent](../../goodwatch-webapp/app/server/auth/mcp-flow.server.ts#L10), [verifier](../../goodwatch-webapp/app/server/mcp/authorization.server.ts#L7)). Better Auth says **mcp() is already the OAuth provider; do not add a second provider** ([composition](https://better-auth.com/docs/plugins/mcp)). Extend this provider deliberately with registered first-party YepWatch clients/resource/consent, preserving MCP and the custom adapter's [allowed call shapes](../../goodwatch-webapp/app/server/auth/call-shapes.server.ts#L50). Public documentation supports the intended protocol, not compatibility proof. Better Auth's [Expo cookie integration](https://better-auth.com/docs/integrations/expo) is an alternative, not the preferred primary cross-domain boundary.

Link an account only after proving both account grant and existing participant credential; preserve participant/votes, reject silent duplicate-member merges. Hosts cannot access others' private data. Read Seen/taste privately; only explicitly confirmed country/services become shared screen context. Revocation/unlink removes future private reads. Room votes never write ratings, Seen, Want to See or saved services ([tracking ADR](../adr/0009-tracking-is-a-state-machine.md#L5)).

Existing [origin guards](../../goodwatch-webapp/app/server/site-origin.server.ts#L14) and [verification callback restrictions](../../goodwatch-webapp/app/server/auth/auth.server.ts#L535) target GoodWatch. Add explicit YepWatch namespace host/origin/CSRF handling; do not spoof browser headers in native or broadly relax guards. Account verification can finish centrally before returning to OAuth.

## Durable rooms and choosing flow

**PostgreSQL for rooms, Crate for existing catalog/accounts, Valkey for cache.** A short transaction locks the parent room before any membership/vote/proposal change; every writer follows that order. Unique command/vote identities make retries deterministic. Read authoritative snapshots from the primary. After a lost commit response, recover by the same operation identity. [PostgreSQL row locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS), [transaction snapshots](https://www.postgresql.org/docs/current/transaction-iso.html).

| Alternative | Verified capability / judgment |
|---|---|
| **Crate room aggregate** | One bounded room document with full-primary-key reads, sequence-number/primary-term CAS and same-document receipts can make transitions atomic. Crate documents [document atomicity, get/search consistency and outage caveats](https://cratedb.com/docs/crate/reference/en/5.10/concepts/storage-consistency.html), [OCC requirements](https://cratedb.com/docs/crate/reference/en/5.10/general/occ.html) and [lack of transactions despite PostgreSQL protocol](https://cratedb.com/docs/crate/reference/en/5.10/interfaces/postgres.html). Multi-row vote/roster/finalization operations would not be atomic. The auth adapter already handles ambiguous writes and lagging read-backs ([source](../../goodwatch-webapp/app/server/auth/crate-adapter.server.ts#L270)). Reusing the pattern needs room-specific bounds/failover tests and whole-document contention tradeoffs; do not repurpose auth tables/adapter. Reasonable if avoiding a new DB outweighs this work. |
| **Existing Valkey** | [ADR 0003](../adr/0003-redis-cluster-of-masters-with-volatile-lfu.md#L10) allows eviction/missing slots without replicas; [config](../../goodwatch-cache/valkey.conf#L15) confirms AOF/eviction. Sole room truth would conflict with its rebuildable-cache premise. Cache candidates/rate counters with TTL; correctness must survive their loss. |
| **New PostgreSQL** | Requires private connectivity, restricted role, migrations, volume, backup/restore rehearsal, monitoring and an explicit outage/recovery expectation. Existing [Windmill PostgreSQL](../../goodwatch-hq/docker-compose.yml#L9) is not permission/capacity evidence to share that database. A small managed PostgreSQL is an alternative if nobody owns restore/on-call; no provider/payment is required or price assumed. No catalog/auth migration. |

Concepts, not schema: **Room** (phase/revision/expiry), **Participant** (capabilities/account link), **Viewing screen**, **Constraints**, immutable **Deck version**, private **Vote revision**, **Proposal/consent version**, **Chosen result**. Validate roughly 2–6 people and about 20 candidates as sizing assumptions, not confirmed limits. Propose 24-hour expiry enforced on requests plus scheduled credential/vote deletion; backups need explicit retention. Avoid storing private taste vectors in rooms.

**Screen eligibility, personal preference ranking:** default to “Our screen”; remote participants choose “Watching elsewhere.” Configure one country/usable-services context per screen; couch participants inherit it. Remote screens can use different providers, but a title must work at every screen. Personal saved subscriptions are suggestions, never an automatic union of couch entitlements. All database choices remain available. Audit existing folded/ignored provider IDs so display normalization does not silently omit covered services; do not substitute a curated provider list for the full database choices.

Use coarse indexes to generate candidates, then country-qualified fresh evidence before assured watchability and again for finalists. Widen candidate search across the catalog rather than treating a fixed popular first-N pool as proof of no intersection. Unknown is not no-match. Offer context correction, another round or explicitly unverified discovery; never silently relax vetoes or imply access. Rank with equal person weight, neutral candidates and Seen/duplicate exclusions; missing guest taste is not negative taste.

Freeze roster/context/deck for a round. Late joins wait for a new round; screen/roster edits invalidate affected proposals/consents and require readiness again. Disconnection never silently drops someone. After the bounded deck, offer up to three unanimous candidates, equal-weight shortlist preferences/tie-break, then explicit final consent. An early mutual like is a shortcut offer, not automatic closure. No unanimous result means another round or an explicitly agreed compromise, never hidden majority rule.

~~~mermaid
flowchart LR
  N[Expo iOS / Android] -->|HTTP writes + snapshots| P[YepWatch HTTPS proxy]
  W[Expo Web guests] -->|same-origin cookie| P
  P --> A[Room module in GoodWatch page server]
  A --> R[(PostgreSQL rooms / sessions / receipts)]
  A --> G[Catalog / watchability / taste modules]
  G --> C[(Crate catalog / member data)]
  G --> V[(Valkey cache / snapshot)]
  N -->|system-browser OAuth + PKCE| I[GoodWatch account issuer]
  W -->|OAuth via server callback| I
  I --> C
~~~

1. **Create/join:** issue guest identity, resolve invitation, assign screen, optionally connect account and privately prefill.
2. **Start:** generate candidates outside a transaction; commit the deck only if roster/context revisions are still current.
3. **Vote/undo:** send deck/title, operation ID and expected own-vote revision. Lock room; verify phase/membership/version; replace private vote and persist command receipt atomically. Late undo cannot erase a newer vote; duplicate operation returns the same result, changed payload under the same ID is refused.
4. **Reconnect:** fetch authoritative shared snapshot plus only one's own private state, then reconcile pending operations. Browser-to-native transfer requires a short-lived single-use exchange proving old membership; an invite alone cannot recover another participant.
5. **Finalize:** bind consent to title/roster/context/proposal versions. Check watchability outside the lock; commit only if versions/consents remain current and evidence usable. Races with veto/undo/edits conflict rather than choose twice. Availability is evidence, not a third-party entitlement reservation. Stale votes cannot reopen a chosen room; reopening is explicit.

## Live updates, domains and operation

**Polling first:** proposed 1–2-second jittered foreground polls, immediate own-write responses, refresh on resume/network recovery, bounded revisioned snapshots/conditional requests, error backoff and stop on completion/expiry. Six people polling every two seconds means approximately **3 snapshot requests/second per room**, before writes: arithmetic, not capacity evidence.

Readiness, progress, shortlist and consent need foreground updates, not bidirectional sockets. No chat, typing, playback clock or durable presence is proposed. If measured delay harms choosing or polling breaches the measured HTTP/DB budget, add **SSE revision invalidations plus HTTP snapshots/writes**, after proving native support, authorization and proxy/deploy behavior. WebSockets can wait for an approved frequent two-way feature. Backgrounded mobile apps always resnapshot on resume.

Instances share durable state, without in-process room truth/sticky-session dependence. Future SSE can use Valkey Pub/Sub for revision-only hints, but [at-most-once delivery](https://valkey.io/topics/pubsub/) requires resnapshot after gaps/reconnects and periodically while connected. No private votes in broadcasts. If guaranteed delivery becomes necessary, add a transactional outbox before another broker.

Propose **https://yepwatch.com** for Expo Web, invitations at /r/INVITE, association files and /api/yepwatch/v1. Proxy only API/server-auth-callback paths to GoodWatch page instances; GoodWatch authorization remains at **https://goodwatch.app**. No api subdomain is needed initially. Static UI fallback must not swallow API, callbacks or .well-known. Private snapshots/auth responses bypass HTML/CDN caches with private, no-store. Current [host-specific routing](../../goodwatch-proxy/traefik/goodwatch-balance.yaml#L45) needs explicit additions; the inspected rules do not establish any current YepWatch deployment.

Configure [Apple associated domains/AASA](https://developer.apple.com/documentation/xcode/supporting-associated-domains) and [Android verified App Links](https://developer.android.com/training/app-links) for invites with browser fallback. Keep browser OAuth callback paths outside native interception; register distinct native callbacks. Test cold/warm links and messaging browsers in development builds ([Expo linking](https://docs.expo.dev/linking/overview/)). **Do not assume app-store installation restores an invite**: keep browser participation, display/copy the code, and ask people to reopen the original link after installing.

Use isolated staging origin, data, OAuth clients, app identifiers and secrets; TestFlight/Play testing before public release. Build native/web independently; maintain older API clients. EAS is optional ([local builds](https://docs.expo.dev/build-reference/local-builds/)); native changes require new binaries and any OTA updates must respect [runtime compatibility](https://docs.expo.dev/eas-update/runtime-versions/). Assess the optional Google login path against [Apple 4.8](https://developer.apple.com/app-store/review/guidelines/#login-services); current website auth does not establish native review acceptance.

Keep API keys/DB credentials/browser OAuth secrets server-side. Carry attribution and link-kind metadata into clients. TMDB's [FAQ](https://developer.themoviedb.org/docs/faq) distinguishes commercial licensing from attributed noncommercial API use; [watch-provider docs](https://developer.themoviedb.org/reference/movie-watch-providers) require JustWatch attribution and do not promise full deep links. New-product rights under existing agreements remain unverified. Test provider destinations rather than labelling every URL “Play.”

Reuse logging/metrics with allowlisted latency/status, lifecycle counts, failure reasons, retries/conflicts, DB saturation and time-to-choice/handoff. Exclude raw votes, preferences, emails, credentials and invitation/code values from logs/analytics/replays. Hosts get no others' votes. Aggregate progress/unanimous outcomes allow inference, especially for couples; promise access control rather than impossible secrecy of results.

## Spikes, build order and open choices

| Order | Small proof before substantial build | Evidence sought |
|---|---|---|
| **1. Auth + package isolation** | Disposable native/web shell, real-device PKCE redirects, distinct YepWatch resource/client/scope, refresh/revoke, participant linking; local package/Metro/web export. | Adapter supports necessary calls; MCP regressions pass; no duplicate account/header spoofing; invitation survives. Resolve provider composition before private prefill, keeping guests functional. |
| **2. Room correctness** | Disposable PostgreSQL races: vote/undo/finalize, roster changes, duplicate requests, lost commit response, restart/expiry and restore. If rejecting a new DB, test the Crate aggregate against the same cases first. | One winner, no lost update/leak, reliable retry recovery and demonstrated restore. |
| **3. Eligibility adapter** | Couch/remote/mixed; same title across countries; cold indexes; dense/sparse coverage, stale/unknown/no-match, different-provider success. | Country-qualified evidence, useful no-intersection recovery, measured filtering cost. Representative samples do not geographically restrict the product. |
| **4. Interaction/links** | iPhone/Android/phone browser: swipe/buttons, assistive tech/large text, reconnect, messaging links, install detour, provider handoff. | People finish with polling delay; browser fallback and universal UI earn their place. |
| **5. Vertical slices** | Guest create/join/snapshots → screens/deck/votes → shortlist/consent/handoff → optional private enrichment → release/load hardening. | Complete optional sign-in before first public release; companion/player need not be built. |

Stable recommendations: Expo/TypeScript, explicit HTTP contracts, GoodWatch server reuse, distinct room/account identity, durable transactions and foreground reconciliation. Unresolved compatibility: auth-provider extension, package resolution and device/provider links. **No supported duration, monthly cost or throughput guarantee.** Start with small rooms; measure 10/100 concurrent-room scenarios before choosing capacity. PostgreSQL adds operations, Crate adds application concurrency/recovery work, a service adds deployment work, and separate browser UI adds presentation work.

Few choices materially change direction: **movies-only versus shows initially; intended room size/expiry/rejoin policy; acceptance of operating PostgreSQL; unanimous failure/explicit compromise behavior.** Browser guests/per-screen defaults need product validation. Companion store packaging can wait. None blocks completing this research.

**Executive recommendation:** Expo matcher with a browser doorway, GoodWatch-powered API, PostgreSQL rooms and ordinary HTTP polling. Prove optional cross-domain login and room race handling first. Keep the later companion and any synchronized player separate decisions.

Verification: repository/domain/ADR/research instructions and cited source inspected; primary platform/database/auth docs checked; local references/table structure/whitespace checked. No builds, integration tests, prototypes, production probes or account/domain changes ran. Only this note was authored; unrelated edits preserved. No issues, commits, pushes or deployments.
