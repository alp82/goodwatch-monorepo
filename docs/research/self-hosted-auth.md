# Self-hosted auth to replace Supabase

Research date: 2026-10-14. Status: exploration and recommendations, not an approved implementation plan. Companion to [the GoodWatch MCP note](mcp-member-profile.md): the replacement must also be the OAuth 2.1 authorization server for the MCP server. It picks up the TODO note "from supabase cloud to better auth" (`TODO.md`, under "authentication").

Two research passes produced this. One mapped every use of Supabase in the repo (read-only). The other read Better Auth's docs and source at commit `c3f11cc`, checked versions and advisories against npm, and searched the source of the alternatives for CIMD, DCR and RFC 8707 support. better-auth.com and several vendor sites could not be fetched from the sandbox. Resource figures for the alternatives are estimates, not measurements.

## Summary

1. **Supabase is only auth.** No app data, storage or realtime lives there. The surface to replace is sign-up, sign-in, Google, confirmation and reset emails, password change, sign-out and the session check. `@supabase/auth-ui-react` is a dead dependency.
2. **Recommended: Better Auth 1.7.7, embedded in the webapp**, with `@better-auth/mcp` (built on `@better-auth/oauth-provider`) and `@better-auth/cimd`. It is the only option found that runs inside the Remix app and supports, in released code, everything the MCP 2026-07-28 auth profile asks for: CIMD, audience-bound JWTs (RFC 8707), PKCE, refresh rotation, and RFC 8414 and RFC 9728 metadata. It also ships a request guard for the `/mcp` route.
3. **The auth tables live in CrateDB; there will be no Postgres.** This works through a strict custom adapter that turns every lookup into a primary-key read and every conditional write into a `_seq_no` compare-and-set. Uniqueness comes from deterministic primary keys and claim tables. Sessions, rate limits and single-use tokens go to Valkey. The design, and what it costs without transactions, is in [Better Auth on CrateDB](auth-on-cratedb.md).
4. **The migration keeps every user id.** A small importer, modelled on Better Auth's Supabase guide, copies `auth.users` and `auth.identities` with the same UUIDs, so every `user_id` in CrateDB stays valid. bcrypt password hashes verify unchanged, and Google accounts link by `sub`. Every member has to sign in once more, because sessions cannot move.
5. **New work that Supabase did silently:** sending email (through Purelymail, see [Email](#email)), and a cookie name that the proxy, the page cache and metrics all recognise.

## What Supabase does today

| Area | Today | Where |
| --- | --- | --- |
| Packages | `@supabase/ssr` 0.5. `@supabase/auth-ui-react` is listed but never imported. | `package.json:28-29` |
| Browser client | Loaded on demand; one `onAuthStateChange` subscription; `useSupabase` and `useUser` hooks | `utils/supabase-browser.ts`, `ui/auth/AuthProvider.tsx:62-92`, `utils/auth.ts:42-65` |
| Server session check | `resolveSession`: reads the cookie, verifies against JWKS when the key is asymmetric, otherwise calls `getUser()`. Results are shared for 30 seconds. Entry points are `getAuthFromRequest`, `getUserFromRequest` and `getUserIdFromRequest`. | `utils/auth-session.ts`, `utils/auth.ts:12-38` |
| Sign-up / sign-in / Google | Custom forms (`signUp`, `signInWithPassword`, `signInWithOAuth`), also from the taste quiz | `ui/auth/CustomAuthForm.tsx`, `ui/auth/GoogleSignInButton.tsx`, `ui/taste-quiz/continue-with-google.ts` |
| Callbacks | No server route: the browser client picks up `?code` or `#access_token` on whatever page the redirect lands on | `utils/supabase-browser.ts:24-35`, `ui/auth/AuthCallbackError.tsx` |
| Reset / change password | `resetPasswordForEmail` → `/reset-password` → `exchangeCodeForSession` + `updateUser`; Settings → Account calls `updateUser` | `routes/forgot-password.tsx`, `routes/reset-password.tsx`, `routes/settings.account.tsx:87-89` |
| Email | All of it comes from Supabase. The app has no mailer. | — |
| Google profile | `user_metadata` name and `avatar_url` | `ui/main/UserMenu.tsx`, `ui/navigation/Hub.tsx`, `routes/api.share-lists.ts` |
| Guest progress transfer | Relies on `user.created_at` and `identities`; the server requires `accountId` to be a UUID | `utils/account-transfer.ts:148-164`, `routes/api.import-guest-interactions.ts:39,253` |
| User id | Supabase UUID (JWT `sub`), stored as `TEXT` in every CrateDB `user_*` table and in `REC_PREVIEW_USERS` | `goodwatch-flows/.../crate_schemas.py` |
| Cookie name `sb-<ref>-auth-token[.N]` | Traefik's member-sticky rule, cache identity, page cache, metrics audience label, proxy test scripts | `goodwatch-proxy/traefik/goodwatch-balance.yaml:22,55`, `server/cache-identity.server.ts`, `server/page-cache.server.ts`, `server/metrics/labels.server.ts`, `utils/auth-cookie.ts` |
| Account deletion | No flow exists | `server/account-deletion.server.ts` (unused) |

Today's performance cost: the project signs with HS256, so each member's session is checked against the auth server every 30 seconds (`docs/member-session.md`). An embedded auth with sessions in Valkey removes that network call entirely.

## Better Auth

**Versions and maintenance.** `better-auth` 1.7.7 (2026-09-30). All `@better-auth/*` packages release together and are published with npm trusted publishing. Minors come about every two to four months and break things (the 1.7 upgrade guide is 771 lines), so pin exact versions and read each changelog. It raised a $5M seed round in June 2025 (Peak XV, Y Combinator). An "M&A" entry from 2026-07 on Caplight is unexplained and **unverified**.

**Fit with Remix.** The docs have a Remix v2 snippet: a splat route `app/routes/api.auth.$.ts` whose loader and action both return `auth.handler(request)`. Server code reads the session with `auth.api.getSession({ headers: request.headers })`, which is the natural replacement inside `resolveSession`.

**Sessions.** Sessions live on the server behind a session-token cookie. With `secondaryStorage` set they live in Valkey, so a session check is one Valkey read in-process instead of an HTTP call to Supabase. An optional cookie cache (HMAC, JWT or JWE) saves even that read, but delays revocation by its `maxAge`. The cookie prefix is configurable.

**Valkey.** `@better-auth/redis-storage` takes a plain ioredis `Redis`, not a `Cluster`, and its `clear()` uses SCAN, which does not cover the whole cluster. Expect to write a small custom `secondaryStorage` on the existing cluster client: five methods, with `increment` and `getAndDelete` required since 1.7. Rate limiting then uses `storage: "secondary-storage"`; the default is in memory, which is wrong with two instances. Behind Traefik, set the client-IP header explicitly: the docs warn that the leftmost `X-Forwarded-For` value can be spoofed.

**Email and password.** scrypt by default. `emailAndPassword.password.{hash, verify}` can be overridden, which is how bcrypt hashes from Supabase are accepted (see [Migration](#migration)). Verification and reset emails go through `sendVerificationEmail` and `sendResetPassword` callbacks that GoodWatch implements with its own provider.

**Extras on the shelf.** Google as a built-in provider; 2FA (TOTP, OTP, backup codes); passkeys (`@better-auth/passkey`); captcha and Have I Been Pwned plugins.

### OAuth provider for MCP

The in-core `oidcProvider` and `mcp` plugins were **removed in 1.7**. Ignore older blog posts and guides that use them. Current packages:

- **`@better-auth/mcp`** (`mcp({ loginPage, consentPage, resource })`):
  - Serves `/oauth2/authorize`, `/token` and `/userinfo`, plus RFC 8414 authorization server metadata and RFC 9728 protected resource metadata.
  - Issues JWT access tokens bound to the resource (`aud` = `https://goodwatch.app/mcp`, RFC 8707). Each resource gets its own lifetime, scopes and keys.
  - Always requires PKCE for public clients and rotates refresh tokens (30-second reuse window). DPoP is optional.
  - **GoodWatch builds the consent page.** It doubles as the place to show the client name and redirect host.
- **`@better-auth/cimd`** (`cimd({ metadataProfile: "mcp-2026-07-28" })`): fetches client metadata documents through a transport hardened against SSRF (resolves once, rejects special-use IPs, pins the address, follows no redirects), with caching and rate limits. Advertises `client_id_metadata_document_supported`.
- **DCR is off by default.** Turn it on (`allowDynamicClientRegistration`, `allowUnauthenticatedClientRegistration`) as a fallback for clients that do not do CIMD yet. Claude falls back to DCR when CIMD is not advertised, and ChatGPT supports both.
- **`requireMcpAuth`** guards the `/mcp` route: it verifies tokens locally against JWKS (issuer, audience, expiry, DPoP) and returns RFC 9728 401s and `insufficient_scope` 403s. It pairs with `createMcpHandler` from `@modelcontextprotocol/server` v2.
- The `jwt()` plugin provides the keys and `/jwks` the provider needs.

**Maturity.** The 1.7 provider and CIMD plugin are about two months old and were patched during the betas. The docs do not name Claude.ai or ChatGPT as tested clients. Test both end to end before launch.

### Security record (2025–2026, all fixed in 1.7.7)

| Severity | Advisory | Fixed in |
| --- | --- | --- |
| Critical | 2FA bypass via cookie cache (GHSA-xg6x-h9c9-2m83) | 1.4.9 |
| Critical | OAuth refresh-token replay in oidc-provider/mcp (GHSA-pw9m-5jxm-xr6h) | 1.6.11 |
| High | Concurrent auth-code redemption (GHSA-7w99-5wm4-3g79); refresh-token family fork (GHSA-392p) | 1.6.11 |
| High | Account takeover via OAuth auto-link to an unverified email (GHSA-g38m) | 1.6.11 |
| High | Stored XSS via `javascript:` redirect_uri (GHSA-86j7) | 1.6.13 |
| High | Pre-account hijack via magic link / email OTP (GHSA-qq9h) | 1.6.22 |
| High | Unprivileged OAuth client registration (GHSA-xr8f) | oauth-provider 1.6.5 |
| High | IPv6 rate-limit bypass | 1.4.17 |
| Moderate | Unbound resource audiences (GHSA-p2fr) | 1.7.0-beta.4 |

Fixes are frequent, and most of them are in the OAuth provider and in race conditions. Consequences for GoodWatch:

- Every race-sensitive operation goes through the adapter's primary-key compare-and-set, with a race test for each ([Better Auth on CrateDB](auth-on-cratedb.md#testing)).
- Upgrades kept current. Add the packages to whatever watches webapp dependencies.
- Only verified emails link to Google accounts.
- No magic-link or OTP sign-in at first.

## Alternatives

Support for CIMD, DCR and RFC 8707 was checked in each project's source unless noted. All of them except Auth.js need Postgres (or MySQL), which rules them out now that Postgres is excluded.

| Option | Shape | CIMD | DCR | RFC 8707 | Verdict |
| --- | --- | --- | --- | --- | --- |
| **Better Auth 1.7** | Library inside the webapp | yes | yes (opt-in) | yes | **Recommended** |
| Logto OSS 1.45 | Node service, ~300–500 MB, Postgres | yes | not found in core | yes | Closest standalone fit, but no DCR and a second service |
| Keycloak 26.8 | Java service, ~0.75–1.5 GB, Postgres | experimental (`--features=cimd`) | yes | workaround only | Overkill; heavy theming |
| Zitadel 4.19 | Go service, ~256–512 MB, Postgres | not found | yes | — | Solid IdP, no CIMD |
| Ory Hydra 26.2 + Kratos | Two Go services, Postgres/MySQL | no | yes | no (uses `audience`) | Lean, but every UI is built by hand |
| Authentik 2026.8 | Python server + worker, ~1–2 GB, Postgres | no | yes | not implemented | Too heavy |
| SuperTokens 24 | Java core + Node SDK, Postgres/MySQL | no | no | — | OAuth server is Hydra-based; no MCP fit |
| Self-hosted GoTrue (`supabase/auth`) | Go, ~50 MB, Postgres with Supabase's `auth` schema | no | yes | no | Least migration work, but misses the MCP profile |
| Auth.js | Client library | — | — | — | Cannot be an authorization server |
| Authelia | SSO portal for file/LDAP users | no | no | — | No self-signup; unsuitable |

**Hosted Supabase as a stopgap.** Hosted Supabase Auth now has an OAuth 2.1 server with DCR. Its source has no CIMD or RFC 8707, though. It could let the MCP ship before the migration, but would mean building the consent and Connected apps pages twice. Not recommended now that the migration is decided.

## Email

GoodWatch will send its auth emails through **Purelymail** over SMTP, from `nodemailer` inside the `sendVerificationEmail` and `sendResetPassword` callbacks.

- **Connection.** `smtp.purelymail.com`, port 465 with TLS (587 with STARTTLS as a fallback), signed in as a dedicated mailbox such as `no-reply@goodwatch.app`. The password goes in the webapp environment in Coolify, like the other secrets.
- **Limit.** Purelymail's FAQ caps outgoing external mail at about 3,000 messages a day and 300 at once, to discourage spam and marketing. Auth mail is one message per sign-up, resend or reset, far below that, but these follow from it:
  - Rate-limit resends and resets per address and per IP (Better Auth's rate limiter on the email endpoints), so nobody can burn the daily cap by abusing the forms.
  - No newsletters or bulk announcements through this mailbox, including the "please sign in again" notice at cut-over: that goes on the site, not by email.
  - Send in the background with a short retry, so a refused SMTP connection does not fail sign-up. Log failures to Sentry and count them in Prometheus.
- **Deliverability.** Add Purelymail's DKIM records for goodwatch.app, include Purelymail in SPF, and publish a DMARC policy (start at `p=none` with reports, then tighten). Purelymail provides no bounce or complaint webhooks the way transactional services do, so watch the mailbox for bounces at first.
- **Templates.** Plain, short HTML plus a text part, in the GoodWatch voice, with the link and its expiry. Links point to `https://goodwatch.app/...`, never to a tracking domain.
- **Later.** If volume ever nears the cap (a launch spike, notification emails), move to a transactional service. Only the transport in the two callbacks changes.

Purelymail's terms of service were not read, because purelymail.com could not be fetched from the sandbox. The figures come from its FAQ as quoted in search results. Confirm the current limits and the rules for automated sending before cut-over.

## Where the auth tables live

**CrateDB** (decided: no Postgres). See [Better Auth on CrateDB](auth-on-cratedb.md). Options considered and set aside:

| Option | Why not |
| --- | --- |
| A new small Postgres | Excluded by decision |
| MongoDB adapter on `goodwatch-mongo` | Sign-in would depend on the pipeline database, and the webapp cannot reach it today |
| SQLite | Two webapp instances cannot share a file |

## Migration

Better Auth's [Supabase migration guide](https://canary.better-auth.com/docs/guides/supabase-migration-guide) is a resumable batch script that reads `auth.users` joined to `auth.identities` over a direct Postgres connection to Supabase. It writes into Postgres, so GoodWatch uses it as the model for a small importer instead. The importer writes, in this order, the email claim, the user and the accounts into the CrateDB tables, all with deterministic ids and `ON CONFLICT DO NOTHING`, so it can be re-run safely.

- **Same ids.** `id: user.id`, so CrateDB `user_id`s, `REC_PREVIEW_USERS`, handles and imports stay valid with no data migration. Keep UUIDs for new users too (`generateId: "uuid"`), because the guest transfer validates `accountId` as a UUID.
- **Passwords.** Email identities become `providerId: "credential"` and keep the bcrypt hash. Better Auth has no built-in "rehash on sign-in", so:
  1. `verify` uses bcrypt for hashes starting with `$2` and scrypt otherwise.
  2. `hash` is always scrypt.
  3. An `after` hook on `/sign-in/email` rewrites the stored hash with scrypt after a successful bcrypt sign-in.

  This is custom code and needs tests.
- **Google.** Same Google client; add the redirect `https://goodwatch.app/api/auth/callback/google`. Accounts link by Google `sub`.
- **Verification state.** Map `email_confirmed_at` to `emailVerified`. Bring unconfirmed users across as unverified, and never auto-link them to Google (see GHSA-g38m).
- **Sessions are not carried over.** Everyone signs in once more. A banner ("We've moved sign-in, please sign in again") and a quiet week keep it painless.
- **Cookie name.** Pick a prefix and change, in one release, the Traefik member rule (match both the old `sb-…` and the new name for the switch-over), `utils/auth-cookie.ts`, cache identity, the page cache, the metrics audience label and the proxy test scripts. Keeping one stable name avoids ever having to repeat this.
- **Profile fields.** Map `user_metadata` name and avatar to Better Auth's `name` and `image`. Replace `created_at` and `identities` in the guest transfer with the Better Auth equivalents.

## Suggested order

1. **CrateDB and email.**
   - Upgrade CrateDB to 5.10.12 or later.
   - Secure the webapp's CrateDB traffic: TLS, or the private network only.
   - Add a dedicated CrateDB user for the auth tables.
   - Create the auth tables with fixed replicas ([Better Auth on CrateDB](auth-on-cratedb.md#table-design)).
   - Build the adapter and its conformance and race tests first.

   Then set up the Purelymail sending mailbox with DKIM, SPF and DMARC for goodwatch.app, and send a test through it from the webapp's network (SMTP egress on port 465 must be allowed).
2. **Better Auth behind a flag.**
   - Splat route `api.auth.$.ts`.
   - Valkey `secondaryStorage` and rate limits.
   - bcrypt-or-scrypt verify.
   - Google.
   - `resolveSession` reads Better Auth sessions (keeping the `goodwatch_auth_checks_total` labels).
   - Rebuild the sign-in, sign-up, reset and Settings → Account forms on the Better Auth client. The browser-side callback handling goes away; Better Auth's server callback replaces it.
3. **Rehearse the migration** against a copy of `auth.users`: counts, password sign-in for a test account of each kind, Google linking, guest transfer.
4. **Cut over.** Freeze sign-ups for a few minutes, run the final export and import, switch the flag and the proxy rule, and keep Supabase read-only for a rollback window.
5. **Delete account**, which Supabase never had: an endpoint that removes the auth rows and runs `account-deletion.server.ts` across the `user_*` tables (finishing what that module's header says is missing). Directory listings for Claude and ChatGPT expect a working privacy story.
6. **MCP authorization.** Add `@better-auth/mcp` and `@better-auth/cimd`, the `jwt()` plugin, the consent page and Connected apps, then guard `/mcp` with `requireMcpAuth`. Test with Claude.ai, Claude Code, the MCP Inspector and ChatGPT developer mode.

Steps 1–5 stand on their own merits: no per-request auth server call, our own emails and branding, account deletion, and no vendor lock-in. Step 6 is then a plugin on top, not a new system.

## Open decisions

- The CrateDB-specific decisions in [Better Auth on CrateDB](auth-on-cratedb.md#open-decisions): session durability, DPoP, TLS, orphan cleanup window.
- Session lifetime, and whether to use the cookie cache (faster, but revocation lags).
- The new cookie name.
- Whether to offer 2FA or passkeys at launch or later.
- How long Supabase stays read-only after the switch.

## Sources

- Better Auth source and docs, commit `c3f11cc`: `docs/content/docs/plugins/{mcp,cimd,oauth-provider}.mdx`, `guides/{supabase-migration-guide,1-7-upgrade-guide}.mdx`, `adapters/mongo.mdx`, `concepts/{session-management,rate-limit}.mdx`, `integrations/react-router.mdx`. Repository: https://github.com/better-auth/better-auth
- [Better Auth seed round](https://better-auth.com/blog/seed-round)
- Advisories: [GHSA-pw9m-5jxm-xr6h](https://github.com/advisories/GHSA-pw9m-5jxm-xr6h), [GHSA-7w99-5wm4-3g79](https://github.com/advisories/GHSA-7w99-5wm4-3g79) and the npm bulk advisory API
- Purelymail: [technical setup](https://purelymail.com/docs/setup/technical), [server settings](https://support.purelymail.com/support/solutions/articles/159000430778-server-settings-imap-smtp-and-pop3), [FAQ (sending limit)](https://purelymail.com/docs/faq)
- [WorkOS: migrating from Supabase](https://workos.com/docs/migrate/supabase)
- [Supabase OAuth 2.1 server](https://supabase.com/docs/guides/auth/oauth-server)
- [Keycloak as MCP authorization server](https://www.keycloak.org/securing-apps/mcp-authz-server), [Keycloak CIMD](https://skycloak.io/blog/keycloak-cimd-mcp-authorization/), [Zitadel DCR](https://zitadel.com/docs/guides/integrate/dynamic-client-registration)
- Source searched for CIMD, DCR and RFC 8707: `zitadel/zitadel`, `goauthentik/authentik`, `ory/hydra`, `logto-io/logto`, `supabase/auth`, `authelia/authelia`, `supertokens/supertokens-core`
- [MCP 2026-07-28 client registration](https://modelcontextprotocol.net/specification/2026-07-28/basic/authorization/client-registration)
