# YepWatch continuous backend

Checked 2026-10-22. Implementation and local verification, not a production rollout or accepted infrastructure change. Contract: [portable DTOs](../../../packages/yepwatch-contracts/continuous.ts), [semantics](../../../packages/yepwatch-contracts/CONTINUOUS.md), [state model](../../../../../docs/design/yepwatch-state-machine.md).

## What runs

`continuous-*` is the separately versioned Glow flow. The existing `/api/yepwatch/v1/` round/shortlist API remains intact. Contract 2 uses `/api/yepwatch/v1/continuous/`, an independent `doc.yepwatch_room_v2` table, new room credentials/cookies, and separate revision/activity channels. Never reinterpret a contract-1 room or overwrite its runtime.

Thin HTTP adapters authenticate and validate, then delegate to `ContinuousService` and the pure transitions. New domain behavior is rooms, votes, current matches, picks and automatic decisions. Catalog reads reuse existing GoodWatch ranking/filter/evidence/provider/episode-presentation methods. Private saved taste/Seen inputs rank/filter server-side; room votes never write account history or preferences. Every occupied viewing screen needs country-qualified usable-service evidence; sharing a screen does not create another subscription context. Optional artwork, scores, genres and trailers come from existing catalog records.

Every current participant counts, including a late join and a disconnected or revoked actor. No leave/kick/host-transfer UI is included. Security revocation changes credential epoch, removes outstanding tickets and clears that actor's pick, while retaining quorum. It does not let the remaining people complete a previously blocked decision. Existing members may resume a decided room; new admission is refused until an explicit host restart.

A match requires unanimous private Yep votes. A pick is private; only counts per current match are shared. Joining or undoing a match invalidates its picks. Unanimous current picks persist `checking` before external work; a fresh offer check plus aggregate CAS commits Done. The durable pending-agreement index repairs interrupted checking independently of revision notification acknowledgments. No exactly-once event claim: Crate is authority, Valkey hints are repairable, and reconnect reads a scoped snapshot. Two-person counts can permit unavoidable inference; no shared payload contains individual answers, picks, current-card identities or saved history.

The active set is bounded to 120 candidates, 2,000 seen title keys, 12 participants/screens, 64 receipts per participant, four live tickets and four member intents per participant, six hours per room and a 512,000-byte plaintext aggregate ceiling. Refills dedupe canonical title keys, preserve unresolved titles/matches and each participant's most recent answer for immediate Undo. Fully answered nonmatches can retire; arbitrarily old retired votes cannot be undone. Capacity/exhaustion is explicit, not an infinite-deck promise. The current local catalog snapshot contains 36 real records: it proves adapter connectivity, not exhaustive recommendation coverage.

## Central GoodWatch member boundary

The existing central issuer is extended with one dedicated public S256 PKCE client, resource and `yepwatch:read` scope. `oauth-access.server.ts` shares signature/audience and live user/client/consent/grant-version checks with MCP; each caller retains its distinct resource policy. MCP access tokens are rejected by YepWatch, and vice versa. There is no duplicate account database, embedded client secret or session-to-room delegation bridge.

A guest actor is admitted first. Sign-in binds a bounded server-side state intent to that room actor and capability epoch. Browser callbacks require the existing HttpOnly room cookie and a server-held verifier. Native uses its securely persisted verifier/expected state and original room bearer for exchange. The issuer registers only the namespaced HTTPS API callback. The fixed native return is `yepwatch://auth/callback`; web return is exactly an approved app origin's `/room/<id>` with no query/hash. An existing linked subject cannot be replaced. Codes, state, cookies and bearer credentials must never enter logs or artifacts.

The callback responds with a no-store document with nonce-limited script and an explicit return link. A second HTTP redirect through an issuer consent form can be blocked by its `form-action` policy; the new document starts the approved app navigation instead. Browser app URLs contain no code/token; native gets only one-use code/state/roomId, which cannot exchange without the verifier and room credential. Physical iOS/Android browser return remains a separate verification gap.

Member prefill uses `getMemberViewerContext`; saved progress uses `getWatchState`, `getShowTrackingPage` and the established tracking `viewOf(...).derived.next`. Tracking keys are `show-<id>` (not numeric catalog keys). Continuation requires the same canonical next episode for every required signed-in participant, freshly read/verified; missing or differing histories do not choose an earlier/later episode or disclose another person's progress. Public title-level availability does not prove episode-level entitlement. No manual history endpoint exists.

Current limitation: the member runtime stores encrypted short-lived access grants and revalidates them, but does not refresh them yet. Expired/revoked grants become unavailable; guest modes remain usable, and continuation needs sign-in again. Refresh rotation/recovery must be completed before calling long-lived member sessions finished. Interrupted one-use code exchange requires a fresh sign-in, rather than blindly replaying a possibly consumed code.

## Runtime and provisioning

The existing Remix catch-all lazily dispatches the continuous prefix to `continuousRuntimeHandler`. It requires explicit `YEPWATCH_CONTINUOUS_CRATEDB_ORIGIN`, `YEPWATCH_CONTINUOUS_CRATEDB_USERNAME`, `YEPWATCH_CONTINUOUS_CRATEDB_PASSWORD`, `YEPWATCH_CONTINUOUS_SECRET`, `YEPWATCH_CONTINUOUS_GATEWAY_SECRET`, and comma-separated `YEPWATCH_CONTINUOUS_ALLOWED_ORIGINS`. Existing server Valkey publishes revision-only hints. No DDL runs at application startup.

Member enablement additionally requires central `AUTH_YEPWATCH_RESOURCE`, `AUTH_YEPWATCH_CLIENT_ID`, `AUTH_YEPWATCH_REDIRECT_URIS`, existing `BETTER_AUTH_URL`, and `YEPWATCH_MEMBER_CALLBACK_URL`. The dedicated enabled client must be public (`tokenEndpointAuthMethod=none`), linked to that resource and exact API callback. No production client registration, role/table provisioning or config rollout has happened. Reuse existing central operator provisioning after independent review; do not let app startup invent a client.

For disposable storage only, `installRoomTable(sql, 0, 'doc.yepwatch_room_v2')` installs the explicit table; the production-shaped variant accepts replicas 2 and waits for all three active shard copies. This is a proposed deployment prerequisite, not evidence of a deployed replicated cluster. Crate provides per-document `_seq_no`/`_primary_term` [optimistic concurrency](https://cratedb.com/docs/crate/reference/en/latest/general/occ.html), not ordinary multi-row transactions. Every correctness read uses the full room primary key. Only pending-work discovery relies on refresh visibility. A lost write acknowledgment requires the same command envelope/receipt reconciliation.

`continuous-local-server.ts` allows loopback room stores only, explicit synthetic fixtures or `YEPWATCH_LOCAL_CATALOG=goodwatch`, an independent room/gateway secret, selected origin(s), revision Valkey URL and selected port. `YEPWATCH_LOAD_LOCAL_ENV=1` explicitly loads existing catalog read configuration; it must not be mistaken for permission to write production rooms. `YEPWATCH_INSTALL_DISPOSABLE_TABLE=1` is an explicit local-only installer flag.

Current isolated real stack: API 15993, issuer fixture 15984, room Crate 15986, disposable account/tracking Crate 15748, Valkey 46398, gateway 4322, web 8132. API runtime private env is `/tmp/yepwatch-continuous-auth-20261022/real-api.env` (mode 0600). It contains credentials: do not copy it to a review artifact or print it. Legacy and synthetic stacks remain separate.

The local member fixture is opt-in, bound to those isolated loopback endpoints, and has no external mail or production user writes. In the app, choose GoodWatch sign-in, then **Sign in to local GoodWatch**, then **Allow read access**. No password must be typed or shared. Its generated fixture account has DE/Netflix preferences and a single local saved Breaking Bad watch. The actual central issuer and existing member read methods operate on that disposable account; public catalog/episode/offer reads remain real. This proves integration, not access to a production member account. The fixture's test-only SQL adapter rejects writes through account/catalog read methods.

## Verification

From `goodwatch-webapp/`:

```sh
node --test app/server/yepwatch/continuous.test.ts app/server/yepwatch/continuous-members.test.ts app/server/yepwatch/continuous-member-rules.test.ts app/server/yepwatch/node-http.server.test.ts
node --test app/server/yepwatch/foundation.test.ts app/server/yepwatch/guest-scope.test.ts app/server/yepwatch/catalog-adapter.test.ts app/server/yepwatch/catalog-startup.test.ts app/server/auth/yepwatch-oauth-policy.test.ts
```

Real Crate verification needs a NEW disposable store, never an active app store. Example after starting a dedicated `yepwatch-continuous-verify-<suffix>` container on an unused loopback port:

```sh
YEPWATCH_TEST_CONTINUOUS_CRATE_ORIGIN=http://127.0.0.1:<new-port> YEPWATCH_TEST_RESTART_CONTAINER=yepwatch-continuous-verify-<suffix> node --test app/server/yepwatch/continuous-crate.integration.test.ts
```

The test checks actual container-port binding before restarting only that explicit test store. It proves full-PK reads, two-writer CAS, encrypted payload, injected lost acknowledgment, persisted checking/notification recovery, actual disk-backed restart and one-use ticket concurrency. Do not set the restart flag for retained app/demo stores.

Actual existing issuer integration needs separately disposable loopback Crate/Valkey:

```sh
YEPWATCH_TEST_AUTH_DISPOSABLE=1 YEPWATCH_TEST_AUTH_CRATE_ORIGIN=http://127.0.0.1:<new-crate-port> YEPWATCH_TEST_AUTH_REDIS_URL=redis://127.0.0.1:<new-valkey-port> ./node_modules/.bin/vite-node --config app/server/yepwatch/vite.config.ts app/server/auth/yepwatch-oauth.integration.ts
```

It creates only disposable local users/clients/consents, captures verification mail locally, proves successful public PKCE/signed read consent, wrong verifier/redirect/client/resource and revoked-grant denial, then proves the existing MCP read path and both cross-token denials. It does not call external email or production accounts. Pure member tests cover actor/state/identity binding, replay, revocation and protected callback output. Core tests hold a fresh check across late join/undo/pick replacement, verify immediate-match/privacy/idempotency, durable repair, refill/Undo retention and concurrent same-context readiness.

Executed connected evidence on 2026-10-22: browser room cookie -> actual local issuer -> consent -> same app actor/host + private prefill/progress; native *protocol* callback + authenticated PKCE exchange -> real canonical continuation -> fresh-check automatic Done. Physical native SecureStore/browser return is unverified. Gateway/frontend peers separately own their real WebSocket/browser proofs. The full repository typecheck still reports unrelated existing errors; targeted owned/auth diagnostics are checked separately rather than claiming a clean repository build.

## Public-rollout gates and recommended operator defaults

These remain **unfinished implementation/operations**, not reasons for the user to choose a security design:

- **Retention/tombstones:** At six-hour expiry deny every room operation, including lease renewal. Physically redact expired payloads after a proposed 24-hour recovery grace using aggregate CAS; preserve a minimal opaque tombstone. A delayed writer must lose against that redaction revision, and insert/retry of the deterministic room ID must never resurrect a tombstone. Do not hard-delete keys without a proved late-create/replay bound. Current expiry denial exists; automatic physical redaction/tombstones do not yet.
- **Distributed limits:** Add atomic Valkey-backed per-credential/room and trusted-edge-IP budgets with short TTL; no client-supplied forwarding-header identity. Proposed configurable starting defaults: create 10/15 minutes/IP, join attempts 30/15 minutes/IP, commands 8/second with burst 16 per actor plus room cap 60/second, ticket issue 12/minute/actor, member start four live intents and 6/15 minutes/actor. Fail closed for new admissions/sign-ins if the limiter is unavailable; preserve reads and existing-room recovery with bounded backoff. These numbers are operator defaults to validate, not load guarantees. Existing durable size/receipt/ticket caps are not a distributed abuse limiter.
- **Keys/redaction:** Separate room storage/identity key and gateway bearer; store them only in operator secret storage and encrypted backup, with a documented restore owner. Add versioned encryption envelopes and dual-read/single-new-write rotation, plus a tested migration/restore procedure. Do not rotate the current single room key casually: it also derives room/admission identities and scoped leases. Suppress query strings, Authorization/Cookie/Set-Cookie, invitations, member state/code and SQL args in API/edge logs; log only allowlisted command type, outcome code, latency and aggregate revision. No raw vote/pick/history/taste payload analytics. Current payload encryption and safe shared projections do not establish infrastructure logging/backup policy.
- **Device/distribution:** Verify actual iOS/Android auth return and invite-install recovery, production HTTPS/cookie/origin/association-file behavior, graceful API/gateway rollout and multi-node Crate durability/failover. Retained local transport success is not this evidence.

No production DDL, registrations, DNS, deployment, commits or pushes form part of this slice.
