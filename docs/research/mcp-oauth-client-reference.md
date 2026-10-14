# MCP OAuth client reference

Research date: 2026-10-14. Supports [#533](https://github.com/alp82/goodwatch-monorepo/issues/533), following [#528](https://github.com/alp82/goodwatch-monorepo/issues/528). This file records primary-source client requirements. Actual spike results and its executable start commands belong in [mcp-oauth-spike.md](mcp-oauth-spike.md); documented support here is not an end-to-end test result.

## Claude hosted OAuth

Claude requires an unauthenticated `401` with a `WWW-Authenticate: Bearer resource_metadata="…"` pointer. Protected metadata `resource` must exactly equal the entered connector URL, including `/mcp`. Only the first `authorization_servers` entry is used. CIMD selection requires both `client_id_metadata_document_supported: true` and token auth method `none`; otherwise Claude falls back to DCR. Every authorization request uses S256 PKCE. Advertise `offline_access` to obtain refresh tokens. The hosted callback is exactly `https://claude.ai/api/mcp/auth_callback`. Claude Code needs port-agnostic matching for both `http://localhost/callback` and `http://127.0.0.1/callback`. Consent must clearly display the redirect hostname. Tokens refresh reactively after 401 and proactively before expiry. Public-client refresh tokens must rotate. Token requests are form encoded. Discovery, registration and code exchange have ten-second limits; refresh has thirty seconds. [Claude authentication requirements](https://claude.com/docs/connectors/building/authentication).

## Owner steps for Claude.ai

1. Start the spike and public tunnel using the commands in the spike runbook. Copy its public HTTPS URL including `/mcp`.
2. Open [Customize → Connectors](https://claude.ai/customize/connectors), select **+ Add → Add custom connector**, enter `GoodWatch OAuth spike` and the public MCP URL, then **Continue**.
3. Review detected authentication. Select **Sign in now** and **Use Claude’s published identity** for CIMD. Finish with **Add**. To test DCR separately, add another connection choosing **Register automatically**.
4. Complete the spike login and consent. Team/Enterprise owners first add through **Organization settings → Connectors → Add → Custom → Web**, then members connect individually. Free accounts are limited to one custom connector. [Claude setup instructions](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
5. Check the connection reads **Connected** and inspect **Tool permissions**. In a new chat, enable it through **+ → Connectors**. Ask: `Use GoodWatch OAuth spike to search_titles with query "", get_title with title_id "movie:spike-1", and get_my_shows.` Approve the calls if prompted. Check the server logs for the real calls. A public tunnel is necessary because hosted Claude connects from Anthropic infrastructure; stop it when testing ends. [Claude testing instructions](https://claude.com/docs/connectors/building/testing).

## Owner steps for ChatGPT

OpenAI currently documents two interfaces. The actual owner account determines which is available; this research did not inspect an authenticated owner account.

For the developer-mode Apps interface: enable **Settings → Apps → Advanced settings → Developer mode** when available. Workspace policies may require an admin to grant access. Open **Settings → Apps → Create** (or **Workspace settings → Apps → Create**), provide the public `/mcp` URL and name, choose OAuth, then **Scan Tools**. Complete spike login and consent, wait for the scan and choose **Create**. Open a new chat and select the draft app from the tools menu. Request the same three reads as above. Refresh access requires advertised `offline_access` and issued refresh tokens; recreate the app after changing discovery metadata. The current Help Center explicitly covers Business and Enterprise/Edu accounts and web access. [OpenAI developer-mode help](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt).

For the newer Plugins interface: open [ChatGPT Plugins](https://chatgpt.com/plugins), select **+ → Add custom MCP server**, enter name/description, use the public HTTPS `/mcp` endpoint under **Connection**, configure OAuth, acknowledge the warning and choose **Create as a plugin**. Review discovered tools, install it, start a new conversation and use `@` to select it. Use **Refresh** after metadata changes. [OpenAI connect/test instructions](https://developers.openai.com/plugins/deploy/connect-chatgpt).

### ChatGPT callback and client-registration details

ChatGPT prefers CIMD when advertised, with DCR also selectable. A server returning `iss` on every successful/error authorization response and advertising `authorization_response_iss_parameter_supported: true` can use stable callback `https://chatgpt.com/connector_platform_oauth_redirect` and client ID `https://chatgpt.com/oauth/client.json`. Otherwise the callback/client document contain a connection-specific `callback_id`: `https://chatgpt.com/connector/oauth/{callback_id}` and `https://chatgpt.com/oauth/{callback_id}/client.json`. Copy exact values from the connection’s management page. Issuer values must match exactly. ChatGPT sends `resource` on authorize/token requests and requires advertised S256. Its CIMD now lists supported methods `none` and `private_key_jwt`, with legacy singular preference `private_key_jwt`; a parser binding only the singular value can reject an otherwise compatible public-client flow. [OpenAI authentication contract](https://developers.openai.com/plugins/build/auth).

On 2026-10-14, fetching [the live stable ChatGPT document](https://chatgpt.com/oauth/client.json) with `curl -fsSL` confirmed both methods, singular `private_key_jwt`, the stable redirect and `jwks_uri`. This was metadata inspection, not successful ChatGPT authorization. Test CIMD and DCR separately if CIMD fails; do not disable PKCE or audience validation to make the connection pass.

## Local clients

The installed Claude Code reports `2.1.296`. For a spike running on `http://localhost:PORT/mcp`:

```bash
claude mcp add --transport http --callback-port 6277 goodwatch-oauth-spike http://localhost:PORT/mcp
claude mcp login goodwatch-oauth-spike --no-browser
```

Run login in an interactive terminal. Follow its printed authorization URL; the callback uses `http://localhost:6277/callback`. If the browser cannot reach the listener, paste the full final redirect URL at the CLI prompt. `/mcp` offers interactive authentication too; `claude -p` cannot initiate it. CIMD is discovered automatically, and stored tokens refresh automatically. A configured `Authorization` header prevents fallback to OAuth, so omit static bearer headers for this experiment. Cleanup: `claude mcp logout goodwatch-oauth-spike`, then `claude mcp remove goodwatch-oauth-spike`. [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp).

Fetching [Claude Code’s live CIMD](https://claude.ai/oauth/claude-code-client-metadata) on 2026-10-14 confirmed `none`, authorization-code/refresh grants and both loopback host forms with no port in their registered URIs. This is why the provider must ignore only the loopback port when validating the callback.

The npm registry reports Inspector `2.11.0` on this date. Its primary README identifies the current `latest` line as v2; legacy v1 uses `v1-latest`. [Inspector README](https://github.com/modelcontextprotocol/inspector/blob/main/README.md).

```bash
npx -y @modelcontextprotocol/inspector@2.11.0 --cli http://localhost:PORT/mcp --transport http --method tools/list
```

The CLI’s interactive OAuth callback defaults to `http://127.0.0.1:6276/oauth/callback`; web UI uses `http://localhost:6274/oauth/callback`. CLI OAuth requires a TTY or `MCP_AUTO_OPEN_ENABLED=true`; headless noninteractive runs otherwise fail with `auth_required`. CIMD can be selected with `--client-metadata-url`. Web/CLI share stored auth, and `--use-stored-auth` with `--server-url` performs a refresh first when a refresh token exists. [Inspector CLI documentation](https://github.com/modelcontextprotocol/inspector/blob/main/clients/cli/README.md).

## Per-client expectations before runtime verification

| Client | Discovery | CIMD / DCR | Consent | Refresh | Tool calls | Quirks |
| --- | --- | --- | --- | --- | --- | --- |
| Claude.ai | 401 challenge → protected metadata → first issuer | CIMD public client preferred; DCR configurable | Spike login and consent; show redirect hostname | Automatic; rotation required | Hosted calls via public `/mcp` | Exact resource URL; fixed hosted callback; OAuth endpoint timeouts |
| ChatGPT developer mode / Plugins | Protected metadata + OAuth metadata | CIMD preferred; DCR configurable | Spike login and consent | Needs offline/refresh access | Scan tools then select app/plugin in chat | UI varies; singular/plural CIMD methods; callback depends on `iss` support |
| Claude Code | 401 challenge, OAuth discovery | Automatic CIMD or DCR | Local browser or pasted callback | Stored tokens refresh automatically | Authenticate interactively before `-p` | Both loopback hosts, ephemeral or fixed port; omit bearer header |
| Inspector 2.11 CLI / web | OAuth on connect | CIMD configurable; DCR supported by SDK | Browser and loopback | Shared stored auth; CLI can force refresh | `tools/list`, `tools/call` | CLI/web callback hosts and paths differ; interactive CLI needs TTY |

All four rows summarize the linked requirements above. Replace expectations with observed results in the spike runbook. Owner-only hosted-client tests remain unverified until the owner completes them. Neither this research nor metadata fetching used production Supabase or production member data.
