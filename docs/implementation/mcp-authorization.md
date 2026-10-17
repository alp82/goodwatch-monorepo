# Member MCP authorization — #566

Branch `auth/mcp-authorization`, draft PR #581, combines Better Auth wiring
#573 (`auth/better-auth-wiring`) with member read tools #577
(`auth/mcp-read-tools`). Part of map #529. No production operation, deployment or
PR merge is part of this implementation.

## Runtime contract

The server registers Better Auth, MCP, CIMD and OAuth Provider packages at exactly
**1.7.7**, SDK **2.3.1**, and Zod **4.6.7** for the MCP/auth stack. The local
`@goodwatch/auth-stack` package isolates Zod 4 from the webapp's existing Zod 3.
Its JavaScript/declaration exports keep the auth adapter, API, cookies and plugins
on the pinned stack. `install-links=true` packs this dependency during `npm ci`;
the Docker dependency stages copy its source before installation.

`BETTER_AUTH_ENABLED=true` enables the auth runtime. `MCP_RESOURCE_URL` must be the
canonical external `/mcp` URL, with the origin used by this webapp.
`BETTER_AUTH_URL` is the site's origin; the issuer is that origin plus `/api/auth`.
Both the Better Auth secret and the independent CrateDB payload-encryption secret
must remain stable across processes and deployments. #565 adds a required
versioned payload-key ring (`AUTH_CRATEDB_ENCRYPTION_KEYS`) whose independent
keys can rotate without changing that permanent lookup root. No migration runs at app
startup; the existing explicit adapter migration already creates the OAuth/JWKS
tables. The new fields are inside the encrypted payload schema.

The plugin composition reuses the [#533 spike](https://github.com/alp82/goodwatch-monorepo/blob/auth/mcp-spike/docs/research/mcp-oauth-spike.md) on
`auth/mcp-spike`:

- `jwt()` stores signing keys through the CrateDB adapter. Better Auth encrypts
  private keys, and the adapter encrypts/authenticates their row envelopes.
  #565 rotates signing keys after 30 days and retains verification keys for a
  further 24 hours before collecting their private material.
- `mcp()` enables authorization code + PKCE and refresh grants, DCR and
  unauthenticated registration. Privileged client/resource management is denied;
  ordinary members cannot create a client that skips consent. Client credentials
  grants are disabled.
- `cimd()` selects `mcp-2026-07-28` and the bundled hardened Node metadata fetcher:
  public-address checks, DNS pinning and redirect refusal remain enabled.
- Supported scopes are `mcp:read`, `mcp:write`, `offline_access`, plus the provider's
  `openid`, `profile` and `email` identity scopes. A request for write access offers
  Read-only or Read and change my GoodWatch (the default selection). The consent action
  narrows the signed request using the provider's `scope` parameter; it never
  adds unrequested scopes. Both issued and refreshed tokens retain that choice.
- The consent action never grants `openid`, `profile` or `email`, so an app gets no
  ID token and `/oauth2/userinfo` returns no email or name. The consent page promises
  that an app can't see the member's email address. A request without `mcp:read`
  is refused, because every MCP call needs it.
- Access tokens last **300 seconds**. Refresh tokens last **90 days**; the
  provider's **30-second** rotation retry window is explicitly configured. The local
  rehearsal alone shortens access tokens to 60 seconds.

Resource routes retain the provider's CIMD, DCR and RFC 9207 metadata, with DPoP claims removed because the MCP verifier accepts bearer tokens only. Proof requests are refused explicitly before issuance. The issuer-path OIDC alias forwards to the provider's issuer-relative discovery route. See [compatibility and Registry preparation](mcp-compatibility-registry.md).

- `/.well-known/oauth-protected-resource` and its `/mcp` alias (RFC 9728).
- `/.well-known/oauth-authorization-server/api/auth` (RFC 8414).
- `/.well-known/openid-configuration/api/auth`.
- `/api/auth/jwks`, `/api/auth/oauth2/authorize`, `/api/auth/oauth2/register`,
  `/api/auth/oauth2/token` and the provider's member consent endpoints.

Login/consent are temporary HTML resource routes at `/auth/mcp/login` and
`/auth/mcp/consent`. Opus generated their markup. They validate the provider-signed
query, retain `oauth_query`, forward sign-in through the HTTP handler with a real
Request, preserve every Set-Cookie, require a live member session for consent and
check POST Origin. DCR clients are displayed as **Unverified app** using their
server-owned `clientDiscoveryId !== "cimd"`. CIMD proves metadata-domain control;
it is not a GoodWatch endorsement of an app's display name.

Chromium integration required `strict-origin` referrer policy: `no-referrer`
caused form submissions with `Origin: null`. The CSP allows form redirects to the
callback origin from the verified signed query. Responses are private/no-store.
#550/#570 replace this stand-in with the approved account/consent presentation.

## Verification, grant identity and revocation

`app/server/mcp/authorization.server.ts` plugs the SDK's `OAuthTokenVerifier`
seam. Every request verifies the signature against this auth instance's durable
public JWKS, the exact issuer and audience, `at+jwt` type, EdDSA algorithm, expiry,
subject, OAuth client and grant binding. ID tokens, opaque tokens and DPoP-bound
tokens are rejected by this bearer-only seam; it cannot validate a DPoP proof.
The SDK then requires `mcp:read` before dispatch. Session cookies and client
headers cannot supply a member identity.

Each authorization uses the original browser session ID as the consent
`referenceId`. This is an identifier, not a requirement that the browser session
remain live. Two computers using Claude Code's same CIMD client ID therefore
have independent consent rows. The verified `sub` supplies `extra.userId` for
the existing member read tools.

Each consent creation gets a random durable `grantVersion`. Signed access tokens
carry `gw_grant_id` and `gw_grant_version`; refresh records are conditionally
bound to that version before a successful token response leaves the HTTP
handler. Refresh looks up the exact client/member/reference grant and requires
its version. The resource verifier reads the current member, client and exact
grant: deleted/unconfirmed members, disabled/deleted clients, deleted grants,
changed grant versions and reduced permissions fail closed. Reconnecting after
disconnection cannot revive an older JWT or refresh token. Missing bindings fail
closed; prerelease grants created before this implementation need reauthorization.

Disconnect an individual computer through the member-owned
`/api/auth/oauth2/delete-consent` API. Other computers' grants remain usable.
Ordinary website sign-out and password changes leave offline app permissions
connected, as decided in #534. Already admitted requests can finish while a
revocation is occurring; subsequent authorization checks reject that grant.
#565 also closes the exact matching grant version before terminal refresh
revocation/family-sweep writes. Explicit refresh revocation therefore rejects
that grant's existing MCP JWTs immediately and fences children missed by a sweep.
Normal rotation retains the grant. An opaque access-token-only revocation is
not a general JWT denylist; Connected apps disconnection remains the supported
per-computer permission contract.

`oauthConsent.lastUsedAt` is a durable date returned by the provider's member
`get-consents`/`get-consent` APIs. Successful authorized read requests conditionally
touch it at most once a minute. A racing touch re-reads the grant rather than
resurrecting deletion. This bounds writes and receipt growth. Strict adapter
allowlist additions permit only conditional usage touches and initial refresh
version binding.

#565 implements launch maintenance and the policies in
[auth-maintenance.md](auth-maintenance.md), on `auth/maintenance-jobs` / draft
#587. Its worker reconciles non-atomic leftovers, collects receipts/expired rows,
fences orphan email claims and capacity reservations, and rotates payload keys.
A response/binding failure can still leave an unusable row and require
reauthorization. The runtime consults CrateDB during authorization, so database
availability and latency remain part of this endpoint's operation.

## Local reproduction

Use Node 24 or newer and a local Docker daemon. From `goodwatch-webapp`:

```sh
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix scripts/auth-cratedb/conformance
npm ci --ignore-scripts --prefix scripts/auth-mcp/clients
PLAYWRIGHT_SKIP_BROWSER_GC=1 scripts/auth-mcp/clients/node_modules/.bin/playwright install chromium
npm run test:auth:mcp
npm run test:auth:mcp:clients
```

`test:auth:mcp` provisions a fresh `goodwatch-auth-566` Docker project: three
CrateDB **5.10.12** nodes, three-master Valkey **8.1.10**, a separate local data
cache and Mailpit. All published ports bind loopback. It checks focused types and
runs nine OAuth integration cases plus the 19 existing auth HTTP cases, then
removes its containers/volumes/network. Ports 15548–15550, 15601–15604,
15525/15580 and 3356 must be free. The CrateDB configuration inherits the adapter
harness's `goodwatch-local-auth-548` cluster name; Docker project/ports isolate it.
The script refuses to reuse existing project containers or a remote Docker
context.

`test:auth:mcp:clients` additionally starts an isolated Remix harness mounting the
actual production MCP/auth/metadata/account resource handlers and the actual
`createGoodwatchAuth` factory with local stores. Its root excludes normal webapp
startup tasks. Vite dotenv loading is disabled, server environment is allowlisted,
SMTP goes to Mailpit, and CrateDB/catalog/Valkey endpoints are fixed loopback.
The fixture signs up and confirms a synthetic member and seeds the existing
#567 catalog/tracking fixture under the resulting real member UUID. There is no
application test-token bypass.

The client runner uses pinned **Inspector 2.11.0**, Chromium through
**Playwright 1.61.1**, and the installed Claude Code CLI/account. It drives real
browser forms for Inspector's automatic DCR and Claude Code's live CIMD document,
checks the unverified warning and `iss` callback, lists strict modern schemas,
calls all seven read tools with Inspector and three with an actual `claude -p`
request, waits past token expiry, and calls tools again. It creates a uniquely
named local Claude connection and removes it on exit. The server trace records
only endpoint/status/grant type, never passwords, auth codes or tokens. OAuth
state/credentials and detailed evidence stay in ignored
`scripts/auth-mcp/results/`; credential files use mode 0600.

For interactive reproduction use `bash scripts/auth-mcp/run.sh serve`, then use
the Inspector/Claude commands from the spike, replacing the URL with
`http://127.0.0.1:3356/mcp` and credentials with the generated ignored member file.
Inspector should use its regular OAuth provider with `--stored-auth-only` after
login; the spike's `--use-stored-auth` path-discovery problem remains a client
limitation. Stop the launcher to clean up Docker resources.

## Evidence and boundaries

Verified locally on 2026-10-14 with actual Inspector 2.11.0 and Claude Code
2.1.299: automatic DCR/CIMD respectively, browser sign-in and consent, exact issuer
callback, tool discovery/calls and successful refresh. Inspector returned all
seven tools and Local Orbit's next episode S1E3. Claude Code called catalog,
title and member tools and reported the same progress. Test cases additionally
cover restart/persistent JWKS, refresh rotation/retry, altered signatures, expiry,
audience/flag rejection, Last used, privileged client creation rejection,
disconnection, reconnect fencing and independent grants for two computers.

Focused types, production build, MCP/cache/metrics regression (63 cases) and
focused Biome checks pass. Whole-app TypeScript retains the same **174** baseline
diagnostics with no added normalized diagnostic messages. The wiring CI job includes these protocol cases; the `auth-mcp` CI job
also runs the Docker protocol/auth cases and endpoint regressions; actual Claude Code
account tests remain a local command.

Hosted Claude.ai/ChatGPT linking, assertion/private-key client authentication,
DPoP, production ingress/grants and deployment were not
verified here. The existing launch/maintenance and final UI tickets remain.

Primary API references: [Better Auth MCP](https://better-auth.com/docs/plugins/mcp),
[CIMD](https://better-auth.com/docs/plugins/cimd), and the pinned installed 1.7.7
OAuth-provider/JWT source. The spike's pinned client notes remain the reference
for the client-specific refresh commands.

#565 extends local protocol coverage with immediate refresh-revocation rejection
and real durable signing-key rollover/grace collection under a controlled clock.
Its full maintenance/auth runner and final evidence are recorded on #565/#587.
