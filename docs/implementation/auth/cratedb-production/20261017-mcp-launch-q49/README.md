# MCP launch preparation after owner decision Q49

**Current status: the origin blocker is resolved and the search upgrade passed.**
See the [final go receipt](../20261017-mcp-search-origin-fix/README.md).
The no-go finding below is historical; the tested paste files in this directory
are unchanged and remain the final owner paste inputs.

Decision: **A — serve `/mcp`, including ranked search, on the search roles.**
Owner authorization covered the protected search environment handoff, sequential
role recreation, production read-only checks, proxy rollback copies and local
testing. Coolify settings and live proxy files were not changed. No production
OAuth client or token was created, and no authenticated tool or paid ranked
search was called.

## Historical verdict: environment ready; MCP launch still no-go

The environment blocker from the [initial receipt](../20261017-mcp-launch-readiness/README.md)
is repaired. Both roles match the working page container for all 14 required
Better Auth/MCP entries plus `REC_CONNECTOR`, have healthy readiness and loaded
query models, reach Valkey and the auth database, and contain ranked-search code.

**Do not paste either proxy file yet.** Anonymous `/mcp` now returns **403
`Origin rejected`**, both on the search roles and publicly through the page
instances. The required 401 discovery challenge is therefore not verified.
The next required change is correct external-origin reconstruction at the
HTTP adapter, followed by deployment to the roles and rerunning the challenge
check. No application origin-check bypass or image upgrade was made here.

## Production changes completed

- On vector1, saved the original `.env` before editing:
  `/root/.config/goodwatch/mcp-launch-20261017T014230Z/search.env.before`.
  Owner root, file mode 0600, directory mode 0700; content equality verified.
- Copied all 14 missing entries from the running vector1 page container
  `gk4owk8-20261017T013319` using `docker exec printenv` captured inside the
  remote Python process, then appended `REC_CONNECTOR=on`. Values were never
  printed or sent back to the development machine. The `.env` remains 0600.
- Verified the original file is an unchanged byte prefix, every previously
  resolved Compose environment entry remains equal, every added entry resolves
  to its source value, and image selection is unchanged. Catalog credentials,
  allocator settings and existing feature flags were preserved.
- Restored the missing local declared image tag to the **same existing image
  ID**, without pulling or changing the image. Both roles still use
  `sha256:8ec83331c2729b15e34fd2e9ddb870be36cc8a823d2ec1bb3eb1a94ffdf99663`,
  declared as
  `ghcr.io/alp82/goodwatch-webapp:72c6a9c06cd0ef81eada3287a63b9d8befc44087`.
  Its registry digest remains
  `sha256:be0876f109596c2af732a7cf29a72975d05d4b9d4168495d56783c5e41662fc3`.
- Recreated only `search-a` at 01:42:47 UTC; it was ready with query models
  loaded at 01:43:18. Search B retained its container ID and served readiness
  200 on all seven monitoring samples.
- Only then recreated `search-b` at 01:43:28; it was ready at 01:43:59.
  Search A retained its new container ID and served readiness 200 on all seven
  monitoring samples. Both recreations used
  `docker compose up -d --no-deps --no-build --pull never <one-service>`.
- Both roles passed Valkey `PING` (`PONG`), and read-only auth queries on all
  three configured coordinators: runtime identity, `auth_jwks LIMIT 0` and
  `auth_oauth_consent LIMIT 0`. Their catalog identities can read
  `user_mcp_action LIMIT 0`. No write-permission probe was run.

Receipts: [environment update](environment-update.jsonl),
[role A](recreate-search-a.jsonl), [role B](recreate-search-b.jsonl),
[running settings and probes](final-search-readiness.json),
[store checks](search-store-checks.json).

The remote scripts are included for audit: [copy-search-env.py](copy-search-env.py),
[recreate-one.py](recreate-one.py), [backup-proxy.py](backup-proxy.py).
The copy script intentionally refuses to run when any new entry already exists;
it is the guarded one-time repair receipt, not a general rotation utility.

## Origin handling blocker

The public failure reproduces with no credentials:

```sh
curl -sS -D - -X POST https://goodwatch.app/mcp \
  -H 'Content-Type: application/json' --data '{}'
```

Observed: HTTP 403, body `Origin rejected`, no `WWW-Authenticate` header.
[Captured headers](public-mcp.headers), [body](public-mcp.body).
[check-public-mcp.sh](check-public-mcp.sh) asserts the required 401 plus metadata
challenge and exits 1 on the current production response.

The installed `@remix-run/express/dist/server.js` builds the URL from
`req.protocol`, `req.hostname` and `req.originalUrl`. The installed
`@remix-run/serve/dist/cli.js` creates Express without enabling proxy trust.
TLS terminates at Traefik; the app receives HTTP. Its `req.protocol` stays
`http` even with `X-Forwarded-Proto: https`, while the configured resource has
the `https` origin. `createReadMcpHandler` rejects that mismatch before the
bearer challenge. Trying forwarded-host/port headers did not repair it.

A separate Node process using the **installed adapter** and an isolated Express
instance reproduced:

```text
Installed default: http://goodwatch.app/mcp
Same harness with loopback proxy trust: https://goodwatch.app/mcp
```

[Harness source](origin-adapter-harness.cjs) and
[output](origin-adapter-harness.jsonl). This changed only the throwaway
Express instance; it did not instrument or change the serving process. Any
follow-up fix must preserve trusted ingress boundaries and strict browser
`Origin` checks. Changing `MCP_RESOURCE_URL` to HTTP would change the OAuth
audience and is not a repair.

## Live proxy comparison and exact paste files

Compared with `origin/main` proxy files at
`c7edf2b320e58c08f538b37d8d8665b36ccd86b2` (unchanged by the later environment
handoff commit). Private placeholders were replaced with the actual addresses.

- Both live search rules omit exact `/mcp`; repository rules include it.
- The live abio file defines `gw-webapp-www-to-apex`, used by the live balance
  file's www routers. Repository main also defines it after `5250bfae`, with
  `[.]` instead of the live escaped-dot regex. The paste file preserves the
  **entire live middleware** unchanged, including the regex and replacement.
- Other routing, retry, health-check and backend settings match after address
  substitution. Parsing the proposed and live files confirms that **adding
  exact ``Path(`/mcp`)`` is the only semantic change** in each paste file.
- The files below are full, comment-free YAML. Diff files also capture harmless
  formatting/quoting changes from serialization.

| Host | Full paste text | SHA-256 |
| --- | --- | --- |
| vector1 | [vector1-goodwatch-search-instance.paste.yaml](vector1-goodwatch-search-instance.paste.yaml) | `3cfb2d5ea6f06aaf8c6bb67b64471a65831adbf8b88059fd5e47b7f8210e3e85` |
| abio | [abio-goodwatch-search.paste.yaml](abio-goodwatch-search.paste.yaml) | `2b6e1efad58493b401af9e4481dd67c2323ce7a815f1f4cccba568465dc58aec` |

Absolute paths in this worktree:

```text
/tmp/gw-mcp-launch-pr595/docs/implementation/auth/cratedb-production/20261017-mcp-launch-q49/vector1-goodwatch-search-instance.paste.yaml
/tmp/gw-mcp-launch-pr595/docs/implementation/auth/cratedb-production/20261017-mcp-launch-q49/abio-goodwatch-search.paste.yaml
```

Live captures and diffs: [abio live search](abio-goodwatch-search.live.yaml),
[vector1 live search](vector1-goodwatch-search-instance.live.yaml),
[abio diff](abio-live-to-paste.diff), [vector1 diff](vector1-live-to-paste.diff).
The [live balance](abio-goodwatch-balance.live.yaml) and
[live page-instance](vector1-goodwatch-instance.live.yaml) files were also
captured to test the actual companion configurations.

## Owner paste sequence, after the origin gate passes

Before pasting, rerun both search-role and public anonymous probes and require
401 with
`resource_metadata="https://goodwatch.app/.well-known/oauth-protected-resource/mcp"`.
Refresh the live-file comparison and rollback copies if production has changed
since this receipt. Then:

1. **Coolify → Servers → vector1 → Proxy → Dynamic Configurations →
   `goodwatch-search-instance.yaml`**. Replace the full content with
   [the vector1 paste file](vector1-goodwatch-search-instance.paste.yaml) and
   save. This is an edit of the existing file, not a second configuration.
   No proxy restart is needed.
2. **Agent verification after vector1 save:** read back the file and compare
   parsed YAML with the paste artifact; check the proxy has no configuration
   errors and both role health checks remain green. From abio, issue an
   anonymous private request to `http://10.0.0.20/mcp`, with
   `Host: goodwatch.app`, `X-Gw-Role: search` and the trusted forwarded HTTPS
   headers. Require the 401 metadata challenge. Public `/mcp` should still
   follow the page routing until abio is saved. Check both metadata URLs
   remain 200 and normal page traffic remains healthy.
3. **Coolify → Servers → abio → Proxy → Dynamic Configurations →
   `goodwatch-search.yaml`**. Replace the full content with
   [the abio paste file](abio-goodwatch-search.paste.yaml) and save. Keep
   `gw-webapp-www-to-apex` in this file exactly once; do not add another copy
   to `goodwatch-balance.yaml`. No proxy restart is needed.
4. **Agent verification after abio save:** read back and compare parsed YAML;
   require public anonymous `POST https://goodwatch.app/mcp` to return the
   401 discovery challenge. Confirm `/mcp` requests increment search-role
   request counters and that OAuth/metadata stay with the page instances.
   Check both metadata URLs, ordinary pages, the existing search routes, and
   HTTP/HTTPS `www.goodwatch.app` redirects (301 to the matching apex path and
   query). Real authenticated tool listing and ranked/write acceptance remain
   owner-account step 3.3; no token creation was authorized in this prep.

No paste or post-paste production verification has happened yet.

## Root-only rollback locations

| Host | Current live search file saved at |
| --- | --- |
| vector1 | `/root/.config/goodwatch/mcp-launch-proxy-20261017T014505Z/goodwatch-search-instance.yaml` |
| abio | `/root/.config/goodwatch/mcp-launch-proxy-20261017T014505Z/goodwatch-search.yaml` |

Both files are root-owned 0600 in root-owned 0700 directories, with SHA-256
and source equality recorded in [vector1 receipt](vector1-rollback.json) and
[abio receipt](abio-rollback.json). To roll proxy routing back, the owner restores
the **saved abio content first**, then the saved vector1 content, through the
same Coolify UI files. Restore content rather than deleting abio's file: it
also owns the www middleware required by the balance file.

The environment rollback is the separate vector1 `search.env.before` path
above; applying it would also require recreating the roles one at a time.

## Local proxy verification

Docker is available (server 29.8.2). The scratch harness at
`/tmp/gw-mcp-q49/proxy-harness` contains byte-identical copies of the two paste
files, plus the captured live balance/instance files. Tests make their usual
local network-address substitutions only. [Input hashes](proxy-input-sha256.json)
bind the delivered artifacts to the test inputs.

- `bash /tmp/gw-mcp-q49/proxy-harness/test-search-local.sh`: **71/71 passed**,
  using real Traefik v2.10.7/v3.6.25 processes and stub backends.
  [Complete output](search-suite.log).
- The Docker balance/deployment suite: **38/38 passed**, using
  `PREFIX=gw-mcp-q49-proxy-test bash /tmp/gw-mcp-q49/proxy-harness/test-local.sh`.
  [Complete output](balance-suite.log).
- Separate real-Traefik checks using the live middleware passed HTTP and HTTPS
  www-to-apex redirects with path/query preservation:
  [www-middleware-checks.json](www-middleware-checks.json).
- These suites test proxy routing against stub applications. They do not test
  the production Remix adapter's origin reconstruction, which is why the local
  routing pass does not override the current production 403 blocker.

## Step 3.2 findings

- Fresh read-only CrateDB query: `doc.user_mcp_action` exists with **3 shards,
  2 replicas, `write.wait_for_active_shards=1`, `translog.durability=REQUEST`**.
  All nine copies are `STARTED/STARTED` across the three Crate nodes.
  [SQL and results](mcp-action-table.json).
- Read-only Coolify `php artisan tinker` query for application `gk4owk8`:
  **no `REC_MCP_*` rows** for production or preview. Production
  `BETTER_AUTH_ENABLED=true`, `REC_CONNECTOR=on`. Preview's Better Auth flag
  remains false. Only relevant flag names and non-secret values were emitted.
  [Coolify evidence](coolify-flags.json). Neither running search role has a
  `REC_MCP_*` override; read, write and ranked flags therefore retain the
  implementation's unset/enabled policy.
- Protected-resource metadata:
  `https://goodwatch.app/.well-known/oauth-protected-resource/mcp` → **200**,
  resource `https://goodwatch.app/mcp`, authorization server
  `https://goodwatch.app/api/auth`, read/write scopes advertised.
- Authorization-server metadata for that issuer:
  `https://goodwatch.app/.well-known/oauth-authorization-server/api/auth` →
  **200**, correct HTTPS issuer and endpoints. The optional root
  `/.well-known/oauth-authorization-server` probe returned 404; the advertised
  issuer includes `/api/auth`, and its path-qualified metadata URL succeeds.
  [Metadata responses](public-metadata.json).
- Anonymous public POST: **403**, not the required 401; no challenge. This
  part of 3.2 and overall 3.1 readiness remain failed at the origin gate.
- `tools/list`, seven read tools/seven write tools for scoped members, token
  refresh and an actual ranked call were **not tested**. No production client
  or token was created to perform them.

## Repository handoff

Main commit **`ebc8571b9be8e8385302117fe39d92074e0296e4`** adds the 14 empty
Better Auth/MCP placeholders plus `REC_CONNECTOR` to
`goodwatch-search/.env.example`, and documents private copying of Coolify auth
changes to the separate search `.env` in `docs/search-role-deploy.md`.
The existing `goodwatch-search/test-deploy.sh` passed after the
allowlist update. Placeholder uniqueness/emptiness and `git diff --check` pass.
No proxy repository fix was needed; no proxy content was pushed to main.

This production receipt and the paste artifacts belong only on the existing
PR #595 branch `alp82/529-map-members-goodwatch-mcp-on-self-hosted-better`.
