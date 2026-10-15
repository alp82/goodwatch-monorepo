# Better Auth wiring — #549

Builds on adapter PR #564. Only `BETTER_AUTH_ENABLED=true` enables `/api/auth/*`
and the Better Auth branch of `resolveSession`. The Supabase path continues when
disabled. This is the coordinated cut-over switch from #536, not a preview phase.
Auth and MCP launch together after migration rehearsal.

## Runtime

`createGoodwatchAuth` takes the strict CrateDB transport, `ValkeyAuthStorage`,
`AuthMailQueue`, the canonical origin, stable independent secrets and Google
credentials. The server entry registers the existing Cluster getter and the
resolver, keeping database/SMTP code out of shared client utilities. The Remix
splat route returns private, no-store responses. The MCP, CIMD and JWT plugins are registered by the runtime with
`MCP_RESOURCE_URL`; see [MCP authorization](../../../../docs/implementation/mcp-authorization.md). Schema migration is explicit and never runs at app startup.

`.env.example` lists the required configuration. CrateDB uses its own username
and password, private HTTP origins and payload encryption secret. Better Auth's
secret is independent and both secrets must survive redeploys. #565 additionally requires the durable JSON
`AUTH_CRATEDB_ENCRYPTION_KEYS` payload key ring; the original encryption secret
remains the permanent lookup-index root. Google and
Purelymail credentials are required only when the flag is on.
`AUTH_TRUSTED_IP_HEADER` must name a single-IP header overwritten by trusted
ingress; never pass through client-supplied forwarding headers.

Session lifetime is 90 days, renewed at most daily, stored in CrateDB and Valkey.
Cookie caching and the Supabase memo are disabled on the Better Auth path.
Server loaders call the session API directly so that they do not share the
HTTP router's missing-IP rate-limit bucket. Public HTTP endpoints stay limited.
The cookie family is `gw.session_token`; upstream adds the reserved `__Secure-`
prefix on HTTPS. Both forms bypass shared-page caching. Every cached session
read checks the current CrateDB session and user, so a missing Valkey session
index cannot undo revocation. Missing cache keys fall back to the DB; storage
errors and malformed entries fail closed. Complete enumeration is configured
at the adapter's 10,000-row enumeration bound. #565 scopes issuance allowances
to each member/client, keeps the 20 newest browser sessions per member, removes evicted Valkey entries,
bounds the cache index to 20 references, and has
no global user/account cap. DCR is limited to 30 attempts per trusted IP per hour;
unused clients expire after 24 hours and unconfirmed signups after 48 hours.
Older prerelease global ledgers need a coordinated rebuild/reimport. Browser sessions also carry a private credential
version checked against the current password hash, including DB fallback.
A password change cannot admit a login paused before session insertion.

## Account HTTP contract

- `sign-up/email`: Minimum ten characters. New and duplicate accounts both get
  `{status:true,message:"Check your inbox to continue."}`. Duplicate signup
  emails the existing owner without exposing their profile.
- `send-verification-email`: A fresh JWT nonce and private user digest make
  confirmation links newest-only, single-use and valid for 24 hours. Digest
  consumption uses a narrow `user.incrementOne(id,confirmationDigest)` CAS.
  Off-origin callbacks are rejected before consumption. Confirmation signs in.
- `sign-in/email`: Confirmation is required. Unknown address, wrong password
  and unconfirmed account share a 401 message. Imported `$2` hashes use bcrypt
  (including `$2y$`); successful sign-in upgrades to core's scrypt with a guarded
  `account.incrementOne(id,password)` CAS. A concurrent password change cannot
  be overwritten by the rehash; a stale sign-in is revoked and rejected.
- `request-password-reset`: Known and unknown addresses share the response.
  Google-only members receive Google sign-in guidance, with no reset link.
  DB verification identifiers are hashed.
- `reset-password`: Minimum ten characters, one-use token, password-changed
  notice, other-device sign-out and direct sign-in.
- `change-password`: Other-device sign-out is forced even when the caller
  submits `revokeOtherSessions:false`. The current device gets a new cookie
  and the member receives a password-changed notice.
- Google uses core's state cookie, PKCE and provider-token validation. Linking
  trusts verified Google addresses; recoverable tokens are encrypted by both
  Better Auth and the adapter.

Resends and resets have fixed-window limits of five requests per normalized
address and thirty per IP per hour, including unknown addresses. Key identifiers
are digests; metrics and alerts contain no addresses, IPs, tokens or links.
Core's endpoint/IP limiter remains enabled in production.

## Mail

[Purelymail's settings](https://smtp.purelymail.com/docs/setup/technical) specify
`smtp.purelymail.com:465` with implicit TLS, or 587 with STARTTLS. Runtime uses
465; the transport also supports mandatory STARTTLS on 587. The sender is
`GoodWatch <hello@goodwatch.app>`. Credentials never go in URLs or logs.

A bounded in-process queue has one worker, 1,000 waiting messages and three
attempts with one/two-second retry delays. Enqueueing does not await SMTP.
Permanent failure or overflow emits a generic Sentry error and increments
`goodwatch_auth_mail_total{outcome="failed"}`; sent and retry outcomes have their
own counter labels. Shutdown requests a drain, subject to the app's deadline.
This is not a durable outbox: process loss can lose mail and an ambiguous SMTP
acknowledgement can cause duplicate delivery. Templates are plain text; visual
email templates remain a presentation follow-up.

## Local verification

From `goodwatch-webapp`:

```sh
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix scripts/auth-cratedb/conformance
npm run test:auth:wiring
```

The runner forces a local Unix Docker socket and refuses to reuse an existing
`goodwatch-auth-549` project. It creates fresh three-node CrateDB 5.10.12 and
three-master Valkey 8.1.10 clusters plus Mailpit, checks focused auth types and
HTTP behavior, then removes its containers, volumes and network on every exit.
CrateDB uses 15548–15550 independently of #548's 15748–15750; Valkey uses
15601–15603; SMTP/API use 15525/15580. Every published port is loopback-only.
Ignored evidence lives in `scripts/auth-wiring/results/`. No `.env` is loaded.

Google token/cert requests are redirected only in the test to a local HTTP
fixture with signed tokens and PKCE validation. SMTP goes only to Mailpit.
The fixture verifies state rejection, callback, replay, session and Google-only
reset; it is not live Google-console interoperability. Temporary SMTP failure
is injected at the mail boundary and the final retry uses the real catcher.
Session, password, confirmation, revocation, cache eviction, flag and rate-limit
cases run through HTTP with real stores.

## Launch boundaries

Account pages, importer/rehearsal, production grants and coordinated cut-over
belong to the other map #529 tickets. #565 implements orphan cleanup and
maintenance; see [the runbook](../../../../docs/implementation/auth-maintenance.md). The adapter's
maintenance and multi-row protocol limitations remain. A consumed confirmation
followed by a later failure needs a resend; no transaction spans confirmation
and session issuance. Password updates and session sweeps are separate writes.
The MCP build must preserve #534's connected-app policy when adding provider
session-delete hooks, and must enforce its own JWT/client revocation policy.

The wiring manifest adds core's OAuth-state `verification.delete(identifier)` call and
its delete-hook pre-read. It uses the existing adapter deletion path; the callback
regression covers state validation, PKCE, successful sign-in and replay rejection.

#565 starts an idempotent maintenance worker only in the enabled auth runtime.
It runs one bounded-page pass at a time, with a 60-second delay between passes,
and stops on process shutdown. Failed work is reported generically and retried;
no schema migration runs at startup. Payload rotation preserves keyed lookups.
