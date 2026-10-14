# Better Auth + MCP OAuth spike (#533)

Tested 2026-10-14 in the throwaway worktree branch `ghostex/817e1757`. Follows [#533](https://github.com/alp82/goodwatch-monorepo/issues/533), [#528](https://github.com/alp82/goodwatch-monorepo/issues/528), [map #529](https://github.com/alp82/goodwatch-monorepo/issues/529), and [outside facts #532](https://github.com/alp82/goodwatch-monorepo/blob/research/auth-mcp-outside-facts/docs/research/auth-mcp-outside-facts.md). Baseline notes were read from `ccr-fe57dab2-zqtzlr`; client requirements and links are also collected in [mcp-oauth-client-reference.md](mcp-oauth-client-reference.md).

Current follow-up: [#535 tool-set script](mcp-tool-set-spike.md) extends this same branch with mutable read/write fixtures and new numeric title IDs. The original commands/results below are historical #533 evidence; use the #535 runbook for the current tool set.

## Verdict

Better Auth 1.7.7 works with the actual MCP Inspector 2.11.0 and Claude Code 2.1.296 on localhost: discovery, PKCE, registration, login, consent, refresh, and fixture tool calls. SDK v2.3.1 works in a Remix resource route with real Zod 4.6.7. Inspector also completed browser OAuth and modern MCP tool calls through a Cloudflare quick tunnel. The tunnel and spike server were stopped after testing; old test URLs are expired and must not be reused.

The owner verified **Claude.ai end to end on 2026-10-14**: custom connector, login/consent, three read tools, and progress under the member ID. [#533 resolution](https://github.com/alp82/goodwatch-monorepo/issues/533#issuecomment-6169860955) records this; Claude.ai refresh was not observed and moves to #535. ChatGPT owner-account connection has **not** been tested. ChatGPT's live CIMD document was accepted, and synthetic browser authorization with its stable callback produced the correct RFC 9207 issuer on both Allow and Deny. Those callback navigations were intercepted locally; they created no ChatGPT connection and performed no ChatGPT token exchange. The owner steps below are the remaining integration check.

## Isolation and implementation

- Code: `goodwatch-webapp/app/mcp-oauth-spike/`; dedicated Vite config `goodwatch-webapp/scripts/mcp-oauth-spike.vite.ts`; launcher `goodwatch-webapp/scripts/mcp-oauth-spike.mjs`.
- This is a separate, minimal Remix app in the webapp, including the real `/mcp` resource route, `/api/auth/*`, issuer-inserted `/.well-known/*`, `/login`, and `/consent`. The normal webapp root, Supabase, CrateDB, Valkey, Qdrant, production sessions and production data modules are never imported. Vite dotenv loading is disabled and the launcher passes a small environment allowlist. No production credentials are passed into the server.
- `better-auth`, `@better-auth/mcp`, `@better-auth/cimd`, and the explicitly installed `@better-auth/oauth-provider` are pinned **exactly to 1.7.7** in the spike package, with a separate committed lockfile. MCP server is **2.3.1**, Inspector **2.11.0**, Zod **4.6.7**. Parent webapp dependencies/lockfile remain unchanged; parent package changes add only three run/check scripts.
- Better Auth's memory adapter holds all auth models. Every restart or reload of `auth.server.ts` discards the account, clients, keys, consent and refresh tokens. The single demo account is `spike@example.test`, with a freshly generated password printed by the launcher. HTTP signup is disabled. No mail or social provider is configured.
- `jwt()` provides keys; `mcp()` owns OAuth and resource metadata; `cimd()` uses `metadataProfile: "mcp-2026-07-28"` and the bundled DNS-pinning Node fetcher. Both explicit DCR flags are enabled for interoperability. PKCE, signature and audience checks remain enabled. Access tokens last 60 seconds to expose refresh behavior, refresh tokens one hour, reuse window the upstream MCP default of 30 seconds.
- A fresh SDK server serves each request, with no `Mcp-Session-Id` and no protocol session store. `legacy: "stateless"` deliberately accepts both 2025 clients and modern 2026-07-28 requests. `MCP_SPIKE_LEGACY=reject npm run spike:mcp` selects strict modern mode. Authenticated unsupported GETs receive 405; unauthenticated GET/POST receive the discovery challenge. Responses use `Cache-Control: no-store, no-transform`.
- Consent verifies the provider-signed query and a live demo session, shows client identity/name, scopes, requested claims and the exact return address, and offers Allow/Deny. [Captured bare consent page](mcp-oauth-spike-consent.png). The server logs sanitized event names/statuses, registration via CIMD hooks, consent decisions, token grant type and tool names; it does not log bearer/refresh tokens, passwords, authorization codes or full query strings.
- Three annotated read tools return text and `structuredContent`: `get_title`, `get_my_shows`, `search_titles`. IDs/data are fictional: `movie:spike-1` = The Last Lighthouse; `show:spike-2` = Orbit Garden, next S1E3; `show:spike-3` = Small Town Detectives, On hold, next S2E1. No paid search or real member data is involved.

The upstream [Better Auth MCP guide](https://better-auth.com/docs/plugins/mcp) and [CIMD guide](https://better-auth.com/docs/plugins/cimd) describe the plugin composition; [SDK v2 web-standard serving](https://github.com/modelcontextprotocol/typescript-sdk/blob/v2.3.1/docs/serving/web-standard.md) describes the transport. The documentation's strict modern example is deliberately broadened by the spike's legacy stateless fallback for real-client interoperability.

## Per-client observations

“Not tested” means an actual client/account did not complete that step. Synthetic probes are explicitly identified.

| Client | Discovery | CIMD / DCR | Consent | Refresh | Tool calls | Quirks / limits |
| --- | --- | --- | --- | --- | --- | --- |
| Inspector 2.11.0, localhost | PASS: 401 → path-specific protected resource metadata → `/api/auth` issuer metadata | PASS: automatic DCR, HTTP 201, native loopback client | PASS: HTML login and Allow in actual Chromium; callback `http://127.0.0.1:6276/oauth/callback` | PASS: regular stored OAuth provider recovered from expired-token 401, token endpoint returned 200, next call succeeded | PASS: list in both eras; legacy get_title/get_my_shows; all three modern tools; strict modern schema audit | Ad-hoc URL mode defaults to legacy. `--protocol-era modern` selects 2026. `--use-stored-auth` path broke for this path-based issuer; use regular OAuth plus `--stored-auth-only` after login. An authenticated GET 405 is expected for a stateless server. |
| Inspector 2.11.0, HTTPS quick tunnel | PASS: exact public resource and HTTPS issuer/endpoint URLs | PASS: DCR | PASS: real Chromium login/Allow over HTTPS → local callback with public `iss` | PASS: expired access token → 200 refresh → successful modern tool list | PASS: `get_title`, `get_my_shows`, modern `tools/list` | Public server can complete remote OAuth while redirecting the local client to loopback. Restarting the tunnel changes the connector URL. |
| Claude Code 2.1.296 | PASS: 401/metadata discovery and connected health check | PASS: CIMD at `https://claude.ai/oauth/claude-code-client-metadata`; server logged `cimd-created` | PASS: signed-query form flow → `http://localhost:6277/callback`; CLI printed Authenticated | PASS: several real `refresh_token` requests returned 200; subsequent tool calls succeeded | PASS: actual `claude -p` made all three calls and returned fixture names/progress | CIMD registered loopback URIs have no port; the fixed-port callback worked. Use `claude mcp login --no-browser` interactively before `-p`. The short lifetime causes frequent proactive refresh. |
| Claude.ai custom connector | Owner verified connector discovery and connection | Registration path not recorded by owner | Owner verified login/consent | NOT OBSERVED; moves to #535 | Owner verified all three initial read tools and member ID | Owner adds public `/mcp`, selects published identity for CIMD or automatic registration for DCR. Hosted callback is `https://claude.ai/api/mcp/auth_callback`. Resource must exactly equal connector URL. |
| ChatGPT developer mode / Plugins | Public metadata verified; `authorization_response_iss_parameter_supported: true`. Actual ChatGPT discovery NOT TESTED | Live stable CIMD parsed and persisted by Better Auth in a **synthetic** authorization flow. Actual hosted registration/token exchange NOT TESTED | **Synthetic** real-browser Allow/Deny both worked for stable callback, with exact public `/api/auth` issuer; actual owner consent NOT TESTED | NOT TESTED | NOT TESTED | Stable callback/client ID satisfy the observed RFC 9207 server requirements. CIMD singular preference is `private_key_jwt`, while plural supported methods include `none`; Better Auth 1.7.7 uses the singular field. Hosted assertion exchange remains to be tested. Full custom writes require Business/Enterprise/Edu; this spike exposes only reads. UI depends on account rollout. |

Client requirements come from [Claude authentication](https://claude.com/docs/connectors/building/authentication), [Claude Code MCP](https://code.claude.com/docs/en/mcp), [Inspector CLI](https://github.com/modelcontextprotocol/inspector/blob/main/clients/cli/README.md), [OpenAI OAuth](https://developers.openai.com/plugins/build/auth), and [ChatGPT plan/developer-mode rules](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt).

## What broke and how it was handled

1. **Installing the auth stack in the parent webapp failed `ERESOLVE`.** The app has Zod 3.25.76, Remix utilities accept Zod 3, and Better Auth's `better-call` peer requires Zod 4. A nested package resolved this without `--force`, global Zod upgrades, or `zod/v4` type assertions. Focused TypeScript compilation passes with real Zod 4.6.7, confirming #532's recommendation.
2. **An empty memory adapter object crashed provider initialization.** `oauthResource` must exist before resource seeding. The spike initializes arrays for all core/JWT/OAuth models.
3. **Headers-only server sign-in API failed “request not found” after login.** The OAuth post-login hook re-enters authorization and needs `ctx.request`. The Remix actions now forward JSON `Request`s through `auth.handler`, preserve every Set-Cookie, and translate JSON redirect responses to browser redirects. `oauth_query` is retained through login/consent and verified by the provider. Browser navigation and fetch may get different redirect response shapes.
4. **Inspector 2.11.0 `--use-stored-auth` is not reliable here.** Its proactive refresh path looked for top-level `serverMetadata` rather than the issuer slot, probed `/mcp` and root discovery aliases, and fell back to `/token` (405). Calls initially still worked with the unexpired token; after expiry the injected resource bearer header contaminated OAuth requests, producing `invalid_client: unsupported authorization scheme`. Reproduced against the pinned client; its bundled `refreshStoredAuthToken` source shows the discovery fallback. Do not add fake root `/token` endpoints or loosen provider client authentication. Use the normal transport's OAuth provider and `--stored-auth-only`, which completed modern calls and reactive refresh successfully.
5. **HMR/restart invalidates persisted client state.** A DCR ID saved by Inspector becomes unknown after `auth.server.ts` reload. Reauthorize with a fresh disposable OAuth state file or `--relogin --no-revoke`. Do not edit auth code during an owner test.
6. **The Linux OS keychain timed out during one Inspector refresh attempt.** Disposable `MCP_INSPECTOR_SECRET_STORE=file` with an isolated `MCP_INSPECTOR_SECRET_FILE` avoids the DBus/keyring dependency; Inspector creates its secret file with mode 0600. The reproduction commands below select this store explicitly. These files hold only temporary spike credentials.
7. **A public probe registered as default `web` could not use HTTP loopback.** Explicit `application_type: "native"` fixed it; Inspector and Claude Code already chose the correct client shape.
8. **Replaying an auth code before refresh invalidated the probe's grant.** The protocol probe now tests replay after rotation/tool checks. Refresh before replay succeeds; replay is rejected with 400. No changes to upstream replay defenses were needed.

9. **Logout after the in-memory reset encountered upstream revocation errors.** Claude Code cleared its local grant and connection, but the old refresh-token revoke returned 400 and old JWT revoke returned 500 (`JWKSNoMatchingKey`) against the replacement instance. Do not treat logout against wiped signing keys as a tested revocation success; persistent-key revocation behavior needs a later storage integration test.

These are spike/client integration findings, not evidence that a production CrateDB adapter or migration is ready. DPoP, private-key assertion exchange, Google/email migration, production storage, revocation latency of already issued JWTs and production builds were not tested by this spike.

## Exact start commands

Prerequisites verified here: Node 26.8.1, npm 12.0.2, `cloudflared` 2026.8.3, Claude Code 2.1.296. Inspector requires Node 22.19+; use Node 24+ for this spike. Port 3335 must be free. No `.env` file or production credential is required.

From this worktree, install both lockfiles once:

```bash
cd /home/alper/projects/goodwatch-monorepo-817e1757/goodwatch-webapp
npm ci
npm --prefix app/mcp-oauth-spike ci
npm run spike:mcp:check
```

Local only:

```bash
npm run spike:mcp
```

Owner hosted-client test (one command starts the quick tunnel, discovers its URL, then starts the app with that exact HTTPS origin):

```bash
npm run spike:mcp:tunnel
```

Copy the **THROWAWAY MCP spike** URL ending in `/mcp` and the demo password from the terminal. Keep this terminal running only while testing. The public homepage is the same origin without `/mcp`; it describes the fixtures. The login is `/login`; `/consent` is reached through OAuth and cannot be opened without its signed query. Ctrl-C stops both the Remix process and tunnel; this cleanup was verified. Every launch creates a new password, auth secret, keys and tunnel hostname. Existing app/connector entries from old launches must be recreated or updated and reauthorized.

Equivalent manual tunnel command, if needed:

```bash
cloudflared tunnel --url http://127.0.0.1:3335 --no-autoupdate
```

After it prints the origin, start the server in another terminal:

```bash
MCP_SPIKE_ORIGIN=https://REPLACE-WITH-PRINTED-HOST.trycloudflare.com npm run spike:mcp
```

Stop both terminals after testing. Never run the server with a localhost origin while giving a hosted client the tunnel URL: discovery and token audiences would advertise the wrong authority.

## Owner: Claude.ai custom connector

1. Run `npm run spike:mcp:tunnel` as above. Copy the newly printed public `/mcp` URL and demo password. Do not use a test hostname from this note.
2. Open [Claude Connectors](https://claude.ai/customize/connectors): **Customize → Connectors → + Add → Add custom connector**. Name it **GoodWatch OAuth spike**, paste the public `/mcp` URL, and choose **Continue**. For a team account, an admin may first need **Organization settings → Connectors → Add → Custom → Web**.
3. Choose **Sign in now** and **Use Claude's published identity** for the CIMD test, then **Add**. UI ordering can vary; the authentication selection may appear after adding.
4. On the spike login page enter the generated terminal password for `spike@example.test`. On consent verify the client name/ID, scopes and `https://claude.ai/api/mcp/auth_callback` return address, then **Allow**. Confirm the connection says **Connected**.
5. Open a new chat and enable the connector through **+ → Connectors**. Send exactly:

   > Use GoodWatch OAuth spike to search_titles with query "", get_title with title_id "movie:spike-1", and get_my_shows. Report the fictional title names and next episodes.

6. Confirm the three fixture names and S1E3 / S2E1. The server should log `tool-call` for all three tools. Wait at least 70 seconds, ask `get_my_shows` again, and look for `grantType: "refresh_token"`, status 200, then a successful tool call. Note the exact client name/registration path from the log, any popup or consent loop, and the error text if it fails.
7. To compare DCR, add a separate connection choosing **Register automatically** and repeat. This should produce `/api/auth/oauth2/register` status 201 rather than `cimd-created`. Free accounts may need to remove their existing custom connector due to the one-connector limit. [Official setup](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp), [test guide](https://claude.com/docs/connectors/building/testing).

## Owner: ChatGPT developer mode

1. Keep the same tunnel process running. On ChatGPT web enable **Settings → Apps → Advanced settings → Developer mode**, if available. Workspace policy may require admin access. Open **Settings → Apps → Create** (or workspace **Apps → Create**), name it **GoodWatch OAuth spike**, paste the public `/mcp` URL, select OAuth/CIMD, and choose **Scan Tools**.
2. If your account exposes the newer interface, open [ChatGPT Plugins](https://chatgpt.com/plugins) instead: **+ → Add custom MCP server**, name/description, public `/mcp` URL under **Connection**, OAuth with CIMD, acknowledge the UI warning, then **Create as a plugin**. This alternative is documented by the current [OpenAI connect guide](https://developers.openai.com/plugins/deploy/connect-chatgpt); account interfaces differ.
3. Complete spike login with the generated password, then **Allow**. With this spike the expected CIMD ID is `https://chatgpt.com/oauth/client.json` and expected callback is `https://chatgpt.com/connector_platform_oauth_redirect`. The server discovery advertises `authorization_response_iss_parameter_supported: true`; Allow and Deny were observed to return exact `iss = PUBLIC_ORIGIN/api/auth`. If the UI displays a connection-specific callback, copy that exact URL; do not manually replace it with the stable one.
4. Review the three discovered tools and choose **Create** / install the plugin. Start a new chat and select the draft app in the tools menu (or `@` the plugin in the new interface). Send the exact three-call prompt above. Approve any requested read calls.
5. Confirm the fixture output and `tool-call` server logs. Wait 70 seconds, call `get_my_shows` again, and check refresh 200 plus the successful call. Also try a fresh connection with **Deny** once to check the callback error is handled cleanly.
6. If CIMD reaches consent but token exchange fails, record the OAuth error/status and whether ChatGPT chose `private_key_jwt` or `none`; Better Auth registers the live document's singular `private_key_jwt` preference. Retry using the UI's **Dynamic client registration** / automatic registration option, with any optional manual client ID/secret fields left blank. Record DCR separately, not as a CIMD success. Refresh/recreate the connector after any metadata change.
7. This experiment needs only reads. Full custom MCP writes are limited to Business/Enterprise/Edu under the current [Help Center rules](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt); unavailable developer mode is an account/policy limitation to record, not grounds to change auth. Record the account surface/plan actually used without publishing account credentials.
8. Remove the temporary connections if desired, then Ctrl-C the tunnel launcher. Do not leave the public tunnel running outside the test.

## Local reproduction and validation

With the local-only server running, set `MCP_SPIKE_PASSWORD` in the second terminal to the freshly printed demo password (shell `read -rs MCP_SPIKE_PASSWORD; export MCP_SPIKE_PASSWORD` avoids putting it in history). Do not commit the value.

Protocol probe, executed successfully:

```bash
node app/mcp-oauth-spike/probe-oauth.mjs
```

It prints only safe booleans/statuses and callback origin/path, and asserts discovery/issuer, native public DCR, signed login/consent, resource-bound JWT, rotated refresh token, same retry response inside the 30-second overlap, tampered JWT 401, missing-scope 403, auth-code replay 400, and Deny's `access_denied` plus exact `iss`/state. It drives the real HTTP form routes with a temporary loopback callback listener on 6280. The CLI clients below were tested independently; the probe is not a substitute for their results.

Inspector (the installed pinned binary; separate storage keeps spike credentials away from normal Inspector state):

```bash
MCP_SPIKE_INSPECTOR_DIR=$(mktemp -d)
export MCP_INSPECTOR_OAUTH_STATE_PATH="$MCP_SPIKE_INSPECTOR_DIR/oauth.json"
export MCP_INSPECTOR_SECRET_STORE=file
export MCP_INSPECTOR_SECRET_FILE="$MCP_SPIKE_INSPECTOR_DIR/secrets.json"
app/mcp-oauth-spike/node_modules/.bin/mcp-inspector --cli \
  http://127.0.0.1:3335/mcp --transport http --protocol-era modern \
  --method tools/list --strict
```

Run in a TTY, open its printed URL, enter the demo password, Allow and let the browser return to `127.0.0.1:6276`. From the same terminal/storage:

```bash
app/mcp-oauth-spike/node_modules/.bin/mcp-inspector --cli \
  http://127.0.0.1:3335/mcp --transport http --protocol-era modern \
  --stored-auth-only --method tools/call --tool-name get_title \
  --tool-args-json '{"title_id":"movie:spike-1"}'
app/mcp-oauth-spike/node_modules/.bin/mcp-inspector --cli \
  http://127.0.0.1:3335/mcp --transport http --protocol-era modern \
  --stored-auth-only --method tools/call --tool-name get_my_shows
app/mcp-oauth-spike/node_modules/.bin/mcp-inspector --cli \
  http://127.0.0.1:3335/mcp --transport http --protocol-era modern \
  --stored-auth-only --method tools/call --tool-name search_titles \
  --tool-args-json '{"query":"orbit"}'
```

Do a later call after token expiry to verify refresh. Omit `--protocol-era modern` to test the default legacy path. Replace the URL with the printed tunnel URL to reproduce the public Inspector check. Avoid `--use-stored-auth` for the reason above. If the app restarts, use fresh disposable state or `--relogin --no-revoke` in an interactive terminal.

Claude Code (run add/login/print/remove from the same directory):

```bash
claude mcp add --transport http --scope local --callback-port 6277 \
  goodwatch-oauth-spike-533 http://127.0.0.1:3335/mcp
claude mcp login goodwatch-oauth-spike-533 --no-browser
claude -p 'Use only goodwatch-oauth-spike-533 MCP tools. Call search_titles with query "", get_title with title_id "movie:spike-1", and get_my_shows. Report fixture title names and next episodes. Do not read files or use other tools.' \
  --allowedTools 'mcp__goodwatch-oauth-spike-533__search_titles,mcp__goodwatch-oauth-spike-533__get_title,mcp__goodwatch-oauth-spike-533__get_my_shows' \
  --permission-mode dontAsk --output-format json
claude mcp logout goodwatch-oauth-spike-533
claude mcp remove --scope local goodwatch-oauth-spike-533
```

The real Claude Code run completed five turns, no denied permissions, no subagents, and returned all fixture names plus the two expected next episodes. Its server trace showed CIMD creation, successful code exchange, successful refresh requests and all three tool calls. The test-specific local Claude Code connection was removed after testing.

Additional checks: `npm run spike:mcp:check`, `node --check` on the launcher and both probe scripts, and `git diff --check`; source files were formatted with the repository Biome configuration. No landing script/style/font/image was changed, so landing budget/Lighthouse checks were not applicable. A production build, deployment, main-branch edit, push, Supabase operation and production data access were not performed.
