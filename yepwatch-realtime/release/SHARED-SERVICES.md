> **Normal Coolify setup:** follow [COOLIFY.md](COOLIFY.md) and `/yepwatch-app/compose.yaml`. The registry/archive route below is optional; the new path supports reusing your existing Redis user.

# Shared Redis and GoodWatch accounts

This source revision supersedes the R4 deployment topology and table names. R4 image/APK hashes remain historical evidence, not artifacts for this revision. Rebuild before activation. No production provisioning or Coolify changes are performed by these files.

## Deployments

| Deployment | Responsibility | Dependencies |
|---|---|---|
| YepWatch front | Static web/APK assets, public API/WSS forwarding | API and gateway |
| YepWatch API | Rooms, proposals, agreement, account linking | Existing Crate, existing Redis, GoodWatch HTTPS account resource |
| YepWatch gateway | Authenticated realtime and neutral activity | API and existing Redis |
| Existing GoodWatch webapp update | Existing signup/login/verification/consent; new `/api/yepwatch/account` read endpoint | Existing GoodWatch issuer/accounts/preferences/progress |

`compose.yaml` has only the first three services. `compose.isolated.yaml` retains the disposable broker solely for old local rehearsal tooling. User owns Coolify routing and activation.

## Redis

Use `release.env.example` with all three existing seeds in `YEPWATCH_MESSAGING_REDIS_NODES` and dedicated `YEPWATCH_MESSAGING_REDIS_USER=yepwatch_messaging`. Its password file is mounted as `fanout_password` for API/gateway (historical secret filename; no fanout container). Both use cluster discovery. The gateway now needs network access to advertised Redis peers as well as the API. Existing source-snapshot credentials remain API-only and separate.

Messaging uses ordinary global Pub/Sub channels `yepwatch:v3:revision` and `yepwatch:v3:activity`; the version is wire compatibility, not a table suffix. No room data is stored in Redis. Room recovery reads Crate after notification loss.

The operator should provision the messaging ACL user consistently on every Redis cluster node, via the existing private secret management process. Required commands for ioredis discovery/readiness and Pub/Sub: `PING`, `INFO`, `CLUSTER SLOTS`, `CLUSTER INFO`, `PUBLISH`, `SUBSCRIBE`, `UNSUBSCRIBE`, `QUIT`; connection metadata uses `CLIENT SETNAME` and may use `CLIENT SETINFO`. Restrict channels to the two names above; grant no key access, cache-writing commands or administrative commands. A separate messaging credential limits gateway access. The repository-based Coolify configuration also supports explicitly reusing an existing user; its broader privileges are then available to the gateway. Confirm the actual deployed Redis version and ACL support when provisioning. No ACL changes have been executed by this implementation.

Reference: [Redis ACL documentation](https://redis.io/docs/latest/operate/oss_and_stack/management/security/acl/).

The API standalone URL setting remains available for disposable tests, mutually exclusive with cluster nodes. Public Compose always requires nodes and a named credential.

## Database

See [all 14 typed schemas and current-state SQL examples](../../goodwatch-webapp/app/server/yepwatch/SCHEMA.md). Votes, proposals, agreements, decisions and related entities have dedicated tables; no generic payload columns remain in the release. Provision through the updated operator on a new/empty production store. Historical R4 commands/images and the previous three-table schema are not compatible with this source.

## Signup / sign-in

YepWatch offers **Connect GoodWatch** alongside guest use. It first preserves the guest's admission, then opens the existing GoodWatch authorization/login page. **Create account** there uses the existing signup/email verification flow and returns to consent. A returning member signs in or uses their existing session. Consent and callback attach the account to the original guest actor; neither joining nor linking agrees to a proposal.

GoodWatch retains account storage and live token verification. Its new GET `/api/yepwatch/account?view=identity|prefill|progress` derives the account from the verified grant. YepWatch calls it server-to-server with the scoped bearer, never a caller-provided user ID. Only the current participant receives preferences/progress. No password form, account database credential, issuer keys or member cache is added to the YepWatch deployment. Room votes do not write GoodWatch history.

On the existing GoodWatch webapp, configure its already implemented dedicated public OAuth client/resource policy:

```dotenv
AUTH_YEPWATCH_RESOURCE=https://yepwatch.com/api/yepwatch
AUTH_YEPWATCH_CLIENT_ID=<operator-registered-public-client-id>
AUTH_YEPWATCH_REDIRECT_URIS=https://yepwatch.com/api/yepwatch/v1/proposal/member/callback
```

Register/enable that client using the existing central operator process: public client (`token_endpoint_auth_method=none`), authorization-code grant, `yepwatch:read` scope, S256 PKCE, exact callback and resource association. There is no client secret in the app. This document does not auto-register or change the issuer.

In the YepWatch private `api.env`, use the same three values plus:

```dotenv
YEPWATCH_MEMBER_ENABLED=true
YEPWATCH_MEMBER_ISSUER_ORIGIN=https://goodwatch.app
YEPWATCH_PROPOSAL_PUBLIC_ORIGIN=https://yepwatch.com
```

The callback is derived from the public origin and validated against the explicit allowlist. `Caddyfile` now forwards exactly the member start/exchange/callback and per-room status/progress endpoints. The account resource belongs on GoodWatch, not this proxy.

Build the new app with `EXPO_PUBLIC_GUEST_ONLY=false` (now the release-script/EAS default). `true` still builds a guest-only app. Android production returns through `yepwatch://auth/callback`; the separately installed beta uses `yepwatch-preview://auth/callback`, derived from Expo configuration and stored with the PKCE intent. Both exact return URIs are accepted by the backend; the central issuer only redirects to the HTTPS callback. Other app schemes are rejected. Native behavior follows [Expo WebBrowser](https://docs.expo.dev/versions/v58.0.0/sdk/webbrowser/) and [Constants](https://docs.expo.dev/versions/v58.0.0/sdk/constants/).

Use the same browser for signup and email confirmation; if verification is completed elsewhere, return to the original browser and sign in. The room-bound intent lasts ten minutes. An expired intent can be restarted without replacing the guest. Linking grants are short-lived; after expiry the app asks to connect again. The frozen refresh work is not activated by this change.

## Acceptance before public activation

- Deploy the GoodWatch resource endpoint and configure the existing issuer/client; functional-check the new scoped resource.
- Provision the stable tables and messaging ACL user, then verify strict API and gateway readiness.
- Build new API/front artifacts and APK with this revision; old APK3 and R4 images are unchanged.
- Check real signup/email confirmation/consent and existing-account login through public HTTPS back to the same room.
- Check the rebuilt preview APK return on the physical phone. Local protocol tests do not prove Android browser return.
- Coolify/TLS activation remains with the owner. A stopped-writer expired-record cleanup command is now implemented; scheduling, full key rotation and comprehensive HTTP/read protection remain separate release work.
