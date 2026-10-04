# Member session checks

How the webapp decides who a request belongs to. The code is `goodwatch-webapp/app/utils/auth-session.ts`, and every
loader and action reaches it through `getAuthFromRequest`, `getUserFromRequest`, or `getUserIdFromRequest` in
`goodwatch-webapp/app/utils/auth.ts`.

## The rule

1. A request without the auth cookie has no member. Nothing is checked.
2. A request with the auth cookie is checked once. Every loader of the page view, and every request that carries the
   same cookie within 30 seconds, shares that one result. The key is the auth cookie's value, so two members never
   share a result.
3. The check verifies the access token locally if the Supabase project signs tokens with an asymmetric key (ES256,
   RS256, or EdDSA): signature, issuer, and expiry, against the project's public keys
   (`/auth/v1/.well-known/jwks.json`, fetched at most every 10 minutes). The member is built from the signed claims.
4. In every other case the check asks the auth server (`getUser()`): a token signed with the shared secret (HS256), a
   failed local verification, or a missing public key.
5. An expired token is refreshed through the auth server first, and the new cookie goes out with every response that
   shares the result.
6. Sensitive actions pass `fresh: true`. They skip the shared result and the local verification and always ask the
   auth server. Today: claiming a handle and the guest progress transfer. Add it to every action that changes or
   deletes an account.

## What a signed-out or revoked session can still do

| Check | A revoked session stops working after |
| --- | --- |
| Auth server, shared for 30 seconds (today) | At most 30 seconds |
| Local verification | The access token's lifetime at the latest. Supabase's default is 3,600 seconds: see **JWT expiry** in the project's auth settings |
| `fresh: true` | At once |

A sign-out in the browser deletes the cookie, so that browser's requests stop being member requests at once. The
table is about a copy of the cookie that someone else holds.

An auth server failure (network error or 5xx) is never remembered: the request is treated as signed out, and the
next request asks again. A definitive "no" (401, 403, no session in the cookie) is remembered for 30 seconds.

## State on October 4, 2026

The project signs with the shared secret: its JWKS endpoint lists no key. So a member page view costs one auth server
call per 30 seconds, where it cost one per loader before. Local verification starts by itself, without a deploy, when
the owner switches the project to asymmetric signing keys:

1. Supabase dashboard, project settings, **JWT Keys**: choose **Migrate JWT secret**. This imports the current secret
   and creates an asymmetric standby key.
2. Choose **Rotate keys**. New tokens are signed with the asymmetric key. Tokens signed before stay valid until they
   expire, and the app keeps asking the auth server for them.
3. Don't revoke the legacy secret: `SUPABASE_ANON_KEY` is signed with it.
4. Check: the JWKS endpoint lists a key, and `goodwatch_auth_checks_total{source="local"}` rises with member traffic
   while `source="server"` stops rising.

## Metric

`goodwatch_auth_checks_total{source}` counts every check: `none` (no cookie), `memo` (shared result), `local`,
`server`, and `error` (an auth server failure, counted in addition to `server`).
