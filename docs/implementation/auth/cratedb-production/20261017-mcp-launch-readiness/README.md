# MCP launch preparation: step 3.1 stopped at readiness

Follow-up: owner decision Q49 authorized the environment repair and sequential
role recreation. See the [Q49 receipt and prepared proxy paste files](../20261017-mcp-launch-q49/README.md).
This earlier read-only receipt remains the record of the initial stop.

Checked on 2026-10-17 at approximately 01:30–01:36 UTC for
[#572](https://github.com/alp82/goodwatch-monorepo/issues/572), recorded on
[#595](https://github.com/alp82/goodwatch-monorepo/pull/595).
Checklist: `origin/alp82/529-map-members-goodwatch-mcp-on-self-hosted-better`,
Phase 3, read using `git show`. Repository reference for the search deployment
and proxy files: `origin/main` at `c7edf2b320e58c08f538b37d8d8665b36ccd86b2`.

## Verdict: no-go

Both search roles contain MCP code but lack every required Better Auth runtime
setting, including `BETTER_AUTH_ENABLED` and `MCP_RESOURCE_URL`. Do not paste
the `/mcp` proxy extension yet. A successful general health check does not prove
MCP readiness.

The task explicitly says: “If the search role isn't ready, say exactly what the
owner must change (Coolify UI steps) and stop there.” That gate was reached.
The remaining proxy diff/paste preparation, rollback copies and step 3.2 checks
were therefore not performed. No production file, configuration, flag, database
row, OAuth client or token was changed or created.

## What serves search

The configured route is abio's `goodwatch-search.yaml` → vector1's proxy →
`goodwatch-search-instance.yaml` → `goodwatch-search-a:3000` and
`goodwatch-search-b:3000`. The final two destinations are running containers on
vector1 (`10.0.0.20`) with matching aliases on the `coolify` Docker network.
Both are healthy and have `WEBAPP_ROLE=search` (compared by hash).
This chain is established from repository configuration and container/network
metadata; the live proxy text was not fetched/diffed after the readiness stop.

These are **standalone Compose services, not Coolify applications**:

- Project: `goodwatch-search`; services: `search-a`, `search-b`.
- Live Compose configuration path:
  `/root/goodwatch/goodwatch-monorepo/goodwatch-search/docker-compose.yml`.
- Declared image for both:
  `ghcr.io/alp82/goodwatch-webapp:72c6a9c06cd0ef81eada3287a63b9d8befc44087`.
- Both containers created on 2026-10-16 at approximately 11:58 UTC.
- Actual image ID:
  `sha256:8ec83331c2729b15e34fd2e9ddb870be36cc8a823d2ec1bb3eb1a94ffdf99663`.
- Actual registry digest:
  `ghcr.io/alp82/goodwatch-webapp@sha256:be0876f109596c2af732a7cf29a72975d05d4b9d4168495d56783c5e41662fc3`.
- Docker currently lists tag `e4268159428969682974e50ff0737da607462253`
  against that image ID. No OCI revision label exists. The container's declared
  tag, `SEARCH_COMMIT` and `SOURCE_COMMIT` agree by hash. The declared commit
  identifies deployment configuration; a source revision embedded in the image
  was not independently established.
- The page instance inspected on vector1 was `gk4owk8-20261017T012118`, using
  `ghcr.io/alp82/goodwatch-webapp:f097c9b747786d3b11ccdfcdee1ad0e1c01e3da0`.
  abio's page instance used the same tag when inspected.

See [ADR 0011](../../../../adr/0011-search-runs-as-a-role-of-the-webapp-image.md)
and [search deployment](../../../../search-role-deploy.md) for the explicit
Compose deployment boundary. Redeploying `gk4owk8` does not update these roles.

## Evidence and missing configuration

[vector1-readiness.json](vector1-readiness.json) records the actual image
identifiers, environment names, missing-name checks, hash equality against the
page instance, built-code locations and anonymous response headers. It contains
no environment values or secret fingerprints. The read-only collector is
[check-search-readiness.py](check-search-readiness.py); it was executed remotely
through SSH without writing a script on production.

The built server files on **both** roles contain the MCP route registration,
`MCP_RESOURCE_URL`, `verifyAccessToken`, `BETTER_AUTH_ENABLED` and
`AUTH_CRATEDB_ORIGINS`. Scanning source text does not execute auth initialization.
The actual bundled auth runtime also names the same 13 required configuration
variables listed below, excluding the separately tested enable flag.

Absent on both search roles, present and nonempty on the inspected page instance:

| Purpose | Missing names |
| --- | --- |
| Enable auth | `BETTER_AUTH_ENABLED` |
| Auth identity and root secret | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` |
| Dedicated auth database identity | `AUTH_CRATEDB_ORIGINS`, `AUTH_CRATEDB_USERNAME`, `AUTH_CRATEDB_PASSWORD` |
| Durable encryption material | `AUTH_CRATEDB_ENCRYPTION_SECRET`, `AUTH_CRATEDB_ENCRYPTION_KEYS` |
| Trusted ingress address | `AUTH_TRUSTED_IP_HEADER` |
| Google configuration required by shared auth initialization | `AUTH_GOOGLE_CLIENT_ID`, `AUTH_GOOGLE_CLIENT_SECRET` |
| Mail configuration required by shared auth initialization | `AUTH_SMTP_USER`, `AUTH_SMTP_PASSWORD` |
| Canonical MCP audience and metadata discovery | `MCP_RESOURCE_URL` |

`REC_CONNECTOR` and `AUTH_MAINTENANCE` are also absent on both roles. No
`REC_MCP_*` names were present in either role's runtime environment. This is
not the requested Coolify database check and does not complete step 3.2.

Existing `REDIS_HOST`, `REDIS_HOST2`, `REDIS_HOST3`, `REDIS_PORT`, `REDIS_PASS`
and `SEARCH_STORAGE_KEY` are present and match the page instance by SHA-256
comparison. No Valkey command or connectivity probe was run. Catalog
`CRATE_HOSTS` and `CRATE_PORT` match; catalog `CRATE_USER`/`CRATE_PASS` differ.
That difference is not evidence of an error: catalog identities may be scoped
by role. Their MCP receipt/member permissions were not checked. Do not replace
the catalog credentials with the dedicated `goodwatch_auth` identity; these
serve different purposes.

Both loopback probes returned:

```text
GET /health/ready -> 200
POST /mcp (Host: goodwatch.app, Content-Type: application/json, body: {}) -> 401
WWW-Authenticate: Bearer error="invalid_token", error_description="Missing Authorization header", scope="mcp:read"
```

The missing `resource_metadata` challenge parameter is consistent with absent
`MCP_RESOURCE_URL`. The 401 alone is insufficient: the verifier calls
`getBetterAuth()`, which requires the enable flag and the shared auth runtime
configuration. No valid token or authenticated tool call was attempted.

## Owner changes needed before another readiness check

1. In **Coolify → Projects → the existing GoodWatch project/environment →
   webapp application `gk4owk8` → Configuration → Environment Variables**,
   use the working runtime entries as the source of truth for the 14 names in
   the table. The known intended non-secret settings are
   `BETTER_AUTH_ENABLED=true`, `BETTER_AUTH_URL=https://goodwatch.app`, and
   `MCP_RESOURCE_URL=https://goodwatch.app/mcp`. Match the permanent secret,
   encryption key ring, database origins/credentials and provider/mail settings
   to the working pages. Retain the private password-manager recovery copy.
   This inspection does not require saving or redeploying the working webapp.
2. There is **no existing Coolify Environment Variables page for search-a or
   search-b**. **Servers → vector1 → Resources** may list these containers,
   but restarting them there does not inject the webapp's environment. A
   Coolify-only change to `gk4owk8` cannot repair this gate. Keeping the existing
   architecture requires a separately authorized refresh of the root-protected
   search Compose `.env` with the missing runtime entries and recreation of
   the two roles, one at a time. No such write or deployment was performed.
   If the owner requires UI-only management of the roles themselves, that is
   a deployment migration requiring a separate decision; it is not an existing
   UI setting to toggle.
3. Before that later deployment, prepare a reviewed environment handoff that
   preserves existing role-specific catalog credentials and allocator settings,
   adds all 14 names above and carries the intended connector/MCP flag policy.
   `goodwatch-search/.env.example` on the inspected main omits **all** Better
   Auth and MCP names: the current `deploy.sh copy-env` copies only that
   allowlist and refuses to overwrite an existing `.env`. Merely running it
   again or merely upgrading the image will not repair the missing environment.
   Use the same production auth secrets/key ring; never generate replacements.
4. Recheck both recreated roles before routing `/mcp`: image/digest, all runtime
   entries present with matching hashes, general readiness, shared Valkey and
   auth database access. Through a request with the real external HTTPS origin
   and trusted forwarding path, anonymous `POST /mcp` must return 401 with
   `resource_metadata="https://goodwatch.app/.well-known/oauth-protected-resource/mcp"`.
   Then resume the remaining requested preparation. Authenticated acceptance
   still belongs to checklist 3.3 with an owner account.

## Deferred artifacts and verification

- No proxy paste texts were generated; there are no approved paste paths or
  owner paste operations for this stopped run.
- No root-only rollback copies were made because the stop preceded step 3.
- Neither live proxy file was diffed. Repository main already contains
  `gw-webapp-www-to-apex` in `goodwatch-search.yaml` from `5250bfae`; there is
  no demonstrated repository proxy defect to fix or push to main. Preserve
  that middleware when the later live comparison is done.
- Local Docker is available: `docker info` reported server **29.8.2**. No
  `test-local.sh`, 71-search suite or 38-balance suite was run, because no paste
  artifacts were prepared after the stop. These are unrun, not passing.
- Step 3.2 remains unverified: no new `doc.user_mcp_action`/1.4-settings query,
  Coolify database/tinker flag check, public `https://goodwatch.app/mcp` probe
  or metadata URL check was made. Historical step 1.4 evidence is not a fresh
  verification. No production OAuth client/token was created, and `tools/list`
  was not called.
