# MCP compatibility and Registry preparation

Prepared 2026-10-17 from `origin/main` (`037b9396`), following the audit, Official Registry and P0 sections of `origin/research/mcp-distribution:docs/implementation/mcp-distribution-research.md`. Worktree `/tmp/goodwatch-mcp-compat`, branch `fix/mcp-compatibility-registry`. The canonical remote remains `https://goodwatch.app/mcp`.

## DPoP and permission upgrades

The server uses the MCP SDK bearer verifier and explicitly rejects JWTs with `cnf`. Better Auth's pinned 1.7.7 MCP/provider defaults advertise DPoP in **both authorization-server and protected-resource metadata**. Its DPoP options tune algorithms/replay settings; there is no disable flag. See the [provider documentation](https://better-auth.com/docs/plugins/oauth-provider) and pinned installed source in `@goodwatch/auth-stack/node_modules/@better-auth/{mcp,oauth-provider}`.

A protocol harness generated an ES256 key and signed a fresh `dpop+jwt` containing the token endpoint `htu`, POST `htm`, `iat` and unique `jti`. After synthetic local member sign-in/consent and PKCE, token exchange with that valid `DPoP` header returned **503**: the adapter rejected the provider's replay-record `verification.create` shape. Thus the advertised path fails even before the bearer-only `/mcp` rejection. The baseline log is `/tmp/gw-mcp-baseline.log`; the committed proof regression uses the same signed request and now expects explicit **400 invalid_request**, without issuing a token. No DPoP token was issued in production.

The chosen fix is bearer-only discovery and issuance. `mcp-metadata.server.ts` removes DPoP capability/required claims from AS, OIDC and protected-resource responses; CIMD, DCR, S256, offline access and refresh are retained. `auth.server.ts` refuses DPoP headers, authorization `dpop_jkt`, and DCR `dpop_bound_access_tokens: true`; it never silently downgrades such a request. Existing `cnf` rejection remains. Clients configured to require DPoP must restart using bearer tokens. Full proof verification/replay persistence is deliberately outside this change.

All supported discovery aliases are covered. The existing external `/.well-known/openid-configuration/api/auth` route previously forwarded to a provider path that returned 404; it now maps to `/api/auth/.well-known/openid-configuration`.

The write-call challenge previously requested only `mcp:write`, although every MCP grant also requires `mcp:read`. It now names **`mcp:read mcp:write`**. Integration coverage verifies a read grant cannot silently widen via reauthorization, `prompt=none` or refresh; a fresh explicit write choice upgrades the same client/session and refresh preserves it. Default consent remains read-only, consent cannot add unrequested scopes, narrowing stops old write tokens, and missing/null/foreign consent POST Origins remain refused.

## Identity and artwork

`app/server/mcp/identity.ts` supplies title, short description, website and HTTPS PNG icons to MCP `serverInfo`. Protected-resource metadata also has `resource_name`, `resource_documentation` and `logo_uri`; AS/OIDC metadata has `service_documentation`. The Registry manifest mirrors the protocol identity, with a regression checking parity and actual PNG dimensions.

The **existing** `app/img/goodwatch-logo-amber.svg` is centered with padding on a dark square. `scripts/build-mcp-icons.mjs` deterministically renders it with the existing resvg dependency; no generated branding or new image dependency. Outputs:

- `https://goodwatch.app/mcp-icons/goodwatch-48.png`
- `https://goodwatch.app/mcp-icons/goodwatch-128.png`
- `https://goodwatch.app/mcp-icons/goodwatch-512.png`

Files live in `goodwatch-webapp/public/mcp-icons/`. Canonical HTTPS protocol URLs are intentionally independent of browser rendering/static-host selection. No experimental server-card route is needed by the tested client paths.

## CORS conclusion

**No CORS allowance added.** There is no demonstrated named client requiring direct cross-origin browser access. Claude Code's real CIMD path works without a browser Origin. The prior Inspector path uses its local proxy, and hosted Claude connects from its backend. A browser-hosted Inspector/direct JS client is not certified by this result.

Code audit: `/mcp` checks canonical Host and same-origin/absent Origin before authorization; OAuth consent has its own mandatory same-origin POST check, and Better Auth also checks its direct consent API. Production OPTIONS probes using the named origin `https://claude.ai` returned:

| Path | Status | Access-Control-Allow-Origin / Credentials |
| --- | --- | --- |
| `/mcp` | 403 | Neither |
| `/.well-known/oauth-protected-resource/mcp` | 405 | Neither |
| `/.well-known/oauth-authorization-server/api/auth` | 405 | Neither |
| `/api/auth/oauth2/token` | 404 | Neither |
| `/auth/mcp/consent` | 405 | Neither |
| `/api/auth/oauth2/consent` | 404 | Neither |

A browser app needing direct access must first supply its exact origin and observed failing flow. A future narrow policy must cover discovery/token/MCP preflight together while keeping consent POST protections. Native/backend access needs no CORS relaxation. Widget iframe CSP is separate.

## Official Registry: prepared, not published

`goodwatch-webapp/server.json` declares `app.goodwatch/mcp`, version `1.0.0` (matching the existing protocol version), title, short description, website, three icons, source repository and one `streamable-http` remote. There is **no package** and no shared Authorization header. Each member authorizes individually.

Validation passed the [official 2025-12-11 JSON Schema](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json) using Python jsonschema and **mcp-publisher 1.8.1** (`mcp-publisher validate goodwatch-webapp/server.json`). The CLI archive checksum matched the upstream release checksums. Validation against the Registry does not publish a listing or reserve the namespace.

### Exact owner steps for durable domain proof and publication

The owner controls the signing key and `goodwatch.app`. No Registry login, publish, signing-key generation or DNS mutation was performed. The chosen setup is **apex DNS proof**; it needs no deployed well-known handler. See [official authentication](https://modelcontextprotocol.io/registry/authentication) and [CLI commands](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/cli/commands.md).

1. Install official `mcp-publisher` (validated with 1.8.1), and review the committed manifest and live PNGs. Confirm `app.goodwatch/mcp` is the intended durable publisher namespace and `1.0.0` is the first published version. Confirm that no existing listing/version would be overwritten.
2. Generate and back up a durable Ed25519 key **outside the repository**, in a private owner directory. Run once; do not regenerate it on every publication:

   ```bash
   umask 077
   install -d -m 700 "$HOME/.local/share/goodwatch-mcp-registry"
   cd "$HOME/.local/share/goodwatch-mcp-registry"
   test ! -e registry-key.pem && openssl genpkey -algorithm Ed25519 -out registry-key.pem
   MCP_REGISTRY_PUBLIC_KEY=$(openssl pkey -in registry-key.pem -pubout -outform DER | tail -c 32 | base64 | tr -d '\n')
   printf 'goodwatch.app. IN TXT "v=MCPv1; k=ed25519; p=%s"\n' "$MCP_REGISTRY_PUBLIC_KEY"
   ```

3. In the owner's DNS control panel, add that exact **TXT** value at the **apex `goodwatch.app`** (`@`), alongside existing TXT records. Do not replace SPF/other records. Wait for public propagation; `dig +short TXT goodwatch.app` must include it. The namespace reverses `goodwatch.app`; `app.goodwatch` is not the host to prove. Retain the record and private key for later releases.
4. From the private key directory, authenticate as domain owner. The private key is the 32-byte Ed25519 seed in hex; do not paste it into the repository, report or chat:

   ```bash
   MCP_REGISTRY_PRIVATE_KEY=$(openssl pkey -in registry-key.pem -outform DER | tail -c 32 | od -An -v -tx1 | tr -d ' \n')
   mcp-publisher login dns --domain goodwatch.app --private-key "$MCP_REGISTRY_PRIVATE_KEY"
   unset MCP_REGISTRY_PRIVATE_KEY
   ```

5. Only after the owner explicitly authorizes publication, run from the reviewed repository checkout:

   ```bash
   mcp-publisher validate goodwatch-webapp/server.json
   mcp-publisher publish goodwatch-webapp/server.json
   curl -fsS 'https://registry.modelcontextprotocol.io/v0.1/servers?search=app.goodwatch/mcp'
   ```

   Confirm the returned name/version, remote URL and icon URLs. Record the actual Registry listing link. Future metadata updates need a new version according to Registry versioning. Registry inclusion alone does not prove client compatibility or guarantee placement in every downstream directory.

## Headless production smoke and owner acceptance

Before deployment, at **2026-10-17 14:50 UTC**, `node goodwatch-webapp/scripts/auth-mcp/smoke-public.mjs`'s pre-change harness observed canonical discovery 200, unauthenticated `/mcp` 401 with `resource_metadata`, CIMD true, DCR **201**, authorize **200 with a sign-in URL**, `/sign-in` **200**, and foreign preflight 403. DPoP was still advertised. The committed script now also requires DPoP to be absent. It creates one unused DCR registration, which maintenance collects after 24 hours; no member, session, code exchange or tool call is made.

**Claude Code 2.1.302** was exercised in a new temporary `CLAUDE_CONFIG_DIR` and working directory: `claude mcp add --transport http --scope local gw-smoke https://goodwatch.app/mcp`, then `claude mcp login gw-smoke --no-browser`. It chose **CIMD**, requested `mcp:read mcp:write offline_access` with the exact canonical resource and no `dpop_jkt`. Fetching the emitted authorization URL returned a sign-in URL; `/sign-in` returned 200 with sign-in content. The CLI was terminated before authentication, and the temporary config was removed. Terminal hyperlink escapes must be stripped when capturing its URL. Evidence: `/tmp/gw-mcp-cli-smoke.log` and `/tmp/gw-mcp-public-before.log` contain only status/metadata summaries.

Owner acceptance must use a disposable verified account and record actual client version, OS and date for each of: **Claude.ai web; Claude Desktop; Claude Code; Cursor; VS Code with GitHub Copilot; Goose Desktop; LM Studio**. Also test Claude iOS and Android before claiming those surfaces work. Test fresh connection, read-only/default consent, a write attempt and explicit permission upgrade, a harmless reversible change in the disposable account, refresh after **more than five minutes**, revocation and reconnect. Check poster cards in Claude hosted/Desktop, Cursor, VS Code and Goose; retain text fallback elsewhere. Do not infer poster support in terminal clients or LM Studio from tool connectivity. Full owner sign-in, real client token storage/refresh and UI rendering remain owner work.

## Validation and deployment evidence

- `npm run test:auth:mcp`: focused auth TypeScript passed; **46 integration tests passed**, using fresh local CrateDB/Valkey/Mailpit and removing its volumes afterward.
- `node --test app/server/mcp/*.test.ts`: **71 tests passed**, including protocol identity, PNG dimensions, write challenges and CORS denial.
- `npm run build`: production build and asset precompression passed. Source-map upload was skipped because this throwaway checkout has no Sentry token.
- Focused Biome checks and `git diff --check` passed; official schema and publisher CLI validation passed.
- Production rollout uses the newest `origin/main` image and `goodwatch-search/deploy.sh <sha>` on vector1. Before mutation: check for other deployments, lock this rollout and back up `.env` mode 600 under a root-only directory. The script restarts A, waits for health and models, then restarts B.
- The final handover records the actual pushed/deployed SHA and post-rollout receipt. Verify both roles' image/health, canonical anonymous `/mcp` **401 with resource_metadata**, discovery without DPoP, all icon URLs **200 image/png** with correct dimensions, and repeat the public DCR/sign-in smoke. No authenticated production tools are part of this rollout check.
