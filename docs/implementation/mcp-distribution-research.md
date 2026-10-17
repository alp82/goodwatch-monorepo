# GoodWatch MCP distribution research

**Researched: 2026-10-17.** Client UI, plans, prices, registry schemas and submission rules are point-in-time findings; recheck the linked primary source before shipping setup copy. Code comparison uses fetched `origin/main` commit `9c3f71cbca602f55308f8892d31b35abb9cec15b`. Research only: no application code changes, production mutations, registry publishing or directory submissions.

GoodWatch's canonical endpoint is **`https://goodwatch.app/mcp`**. Members authorize their own GoodWatch account using OAuth; tools need `mcp:read`, and changes also need `mcp:write`. Poster UI is optional and delivered through `ui://goodwatch/posters-v3.html`. [Live resource metadata](https://goodwatch.app/.well-known/oauth-protected-resource/mcp), [poster implementation][gw-posters]

## Five recommendations

1. **Improve `/connect` first:** copyable URL, real Cursor/VS Code/Goose/LM Studio install buttons, CLI commands and dated per-client steps. There is no verified universal install deeplink; each documented format is shown below.
2. **Publish metadata once in the official MCP Registry**, using domain namespace `app.goodwatch/mcp`; keep the hosted endpoint and individual OAuth sign-in. This is also the present upstream path recommended by the paused PulseMCP submission page. [Registry](https://modelcontextprotocol.io/registry/remote-servers), [PulseMCP](https://www.pulsemcp.com/submit)
3. **Submit to Claude's directory next:** it is the closest consumer path to the owner's working Claude.ai setup, and supports the Interactive badge for poster cards. Use today's directory management portal and prepare real poster screenshots. [Submission](https://claude.com/docs/connectors/building/submission), [Interactive connectors](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude)
4. **Prepare an OpenAI directory package as a separate project step.** Current documentation uses Plugins, with an installable reviewed package; custom-server access has materially different plan/surface limits. A custom URL guide alone does not provide broad consumer distribution. [Current connection help](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt), [publication](https://developers.openai.com/plugins/deploy/submission)
5. **Prove compatibility before adding a “tested” badge:** prioritize scopes/refresh, poster rendering and callback behavior in the promoted clients. Audit browser Origin/CORS and the mismatch between advertised DPoP and bearer-only verification; add standard identity/icons. Evidence and remaining limits are recorded below.

## Client summary

**Reading the table:** OAuth means documented capability, not an end-to-end GoodWatch test. The owner reports Claude.ai working; repository notes record earlier local Claude Code/Inspector tests. No client was installed/authenticated in this research. **Unknown** means no adequate primary proof was found, not that support is absent. “One click” means starting an install flow; app approval, sign-in and member consent still take place.

| Client | Member installation path | One click? | OAuth compatibility | MCP Apps | Plan/access limits |
| --- | --- | --- | --- | --- | --- |
| Claude.ai web | Customize → Connectors → + Add → Add custom connector; enter name and URL; review detected authentication; Add, Connect. [Setup](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) | Directory Connect flow after listing; no documented arbitrary-server prefilled install deeplink found. [Directory](https://support.claude.com/en/articles/14328846-browse-skills-connectors-and-plugins-in-one-directory) | CIMD and DCR documented. [Auth](https://claude.com/docs/connectors/building/authentication) | Yes. [Interactive connectors](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude) | Free: one custom connector; Pro/Max/Team/Enterprise supported. Team/Enterprise setup is owner/authorized-role controlled. [Setup](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) |
| Claude Desktop / Cowork | Remote connector follows the account across Claude surfaces; use the remote connector flow. [Surfaces](https://support.claude.com/en/articles/11725091-when-to-use-desktop-and-web-connectors) | Same directory route; no arbitrary remote install URI established. | Same hosted OAuth infrastructure. [Build](https://claude.com/docs/connectors/building) | Yes. [Interactive connectors](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude) | Same connector eligibility above. |
| Claude iOS / Android | Use the remote connector connected to the Claude account; no extra setup required across surfaces. [Surfaces](https://support.claude.com/en/articles/11725091-when-to-use-desktop-and-web-connectors) | Directory connection; recommend web fallback for URL entry until mobile-specific custom-add UI is tested. | Same hosted OAuth infrastructure. [Build](https://claude.com/docs/connectors/building) | Yes; explicit all-user iOS/Android support dated 2026-08-11. [Interactive connectors](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude) | Same connector eligibility above. |
| Claude Code | `claude mcp add --transport http --scope user goodwatch https://goodwatch.app/mcp`, then `claude mcp login goodwatch` or `/mcp`. [MCP reference](https://code.claude.com/docs/en/mcp) | Copy-command; existing claude.ai connectors can also reach Code. No documented arbitrary MCP URL install button found. [MCP reference](https://code.claude.com/docs/en/mcp) | CIMD/DCR; local loopback callback. [MCP reference](https://code.claude.com/docs/en/mcp) | Terminal rendering unconfirmed; do not promise poster UI. | Requires a Claude subscription or Console account; terminal/IDE also support third-party providers. [Overview](https://code.claude.com/docs/en/overview) |
| ChatGPT custom MCP | Current UI: Plugins → + → Add custom MCP server → URL/auth → Create as a plugin; install resulting plugin. [Connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt) | No documented arbitrary endpoint install deeplink found; use steps. | CIMD, DCR and supplied clients. [Custom MCP guide](https://developers.openai.com/api/docs/guides/custom-mcp-server) | Supported for custom MCP testing. [Help](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt) | Full MCP/write: Business and Enterprise/Edu, **web only**; Pro custom MCP read/fetch only. Business: admins/owners create; Enterprise/Edu can delegate creation using RBAC. Plus custom-add eligibility is not established by the current help page. [Help](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt) |
| ChatGPT public directory | Plugins on web/desktop/mobile → find listing → Install → connect provider account. [Plugins](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt), [Account connection](https://help.openai.com/en/articles/11487775-connected-apps-in-chatgpt) | Listing and installation route after approval, with authorization still required. | Underlying app OAuth. | Capability and surface dependent; Free/Go plugin extensions unavailable. [Troubleshooting](https://help.openai.com/en/articles/20001497-troubleshooting-plugins-and-apps-in-chatgpt) | Directory spans plans; actual install/use varies by plan, role, region, workspace and included capabilities. [Plugins](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt) |
| Cursor | Add-to-Cursor deeplink, or remote `url` entry in `~/.cursor/mcp.json` / project `.cursor/mcp.json`. [Install links](https://prod.cursor.com/docs/mcp/install-links), [MCP](https://cursor.com/docs/mcp) | Yes, documented `cursor://…/mcp/install` → approval/auth prompts. | DCR/static OAuth documented; current CIMD support not established. [Support response](https://forum.cursor.com/t/mcp-oauth-cimd-support-plans-and-timelines/148096/2) | Yes, explicitly documented. [Help](https://prod.cursor.com/help/customization/mcp) | Current official pricing sources disagree in plan naming; no clear free-plan MCP entitlement established. Use account-dependent wording, not a fixed Hobby/Pro claim. [Pricing](https://cursor.com/en-US/pricing), [Current model/pricing docs](https://cursor.com/docs/models-and-pricing) |
| VS Code + GitHub Copilot | Install deeplink, `MCP: Add Server` HTTP URL, or `.vscode/mcp.json`; trust/start/authenticate. [Management](https://code.visualstudio.com/docs/agent-customization/mcp-servers) | Yes: `vscode:mcp/install?{encoded JSON}`; Insiders variant. [Developer guide](https://code.visualstudio.com/api/extension-guides/ai/mcp) | DCR/static credentials; current first-party source and client metadata also confirm CIMD. [Source](https://github.com/microsoft/vscode/blob/5b23ab39bef800e5c4dad4e544671ef20617e660/src/vs/workbench/api/browser/mainThreadAuthentication.ts#L178), [CIMD](https://vscode.dev/oauth/client-metadata.json) | Yes. [Developer guide](https://code.visualstudio.com/api/extension-guides/ai/mcp) | Copilot access, including Free; managed Business/Enterprise requires MCP policy enabled. [GitHub docs](https://docs.github.com/en/copilot/how-tos/copilot-in-your-ide/customize-copilot/extend-copilot-with-tools-and-context/extend-copilot-chat-with-mcp?tool=vscode) |
| Windsurf / now Devin Desktop, legacy Cascade | Open Cascade Actions → Open MCP config file; `mcpServers.goodwatch.serverUrl = "https://goodwatch.app/mcp"`. Current docs use `~/.config/devin/mcp_config.json` on macOS/Linux, `%APPDATA%\devin\mcp_config.json` on Windows. [Docs](https://docs.devin.ai/desktop/cascade/mcp) | Current docs explicitly say Cascade has no marketplace or one-click install; those belong to Devin Local. [Docs](https://docs.devin.ai/desktop/cascade/mcp) | Streamable HTTP and OAuth documented; CIMD/DCR details unknown. [Docs](https://docs.devin.ai/desktop/cascade/mcp) | Unknown. | 100 enabled tools; enterprise must enable MCP, admins can allowlist. Individual tier restriction not established. [Docs](https://docs.devin.ai/desktop/cascade/mcp) |
| Gemini CLI | `gemini mcp add --transport http --scope user goodwatch https://goodwatch.app/mcp`; then `/mcp auth goodwatch`. [Docs](https://geminicli.com/docs/tools/mcp-server/) | Copyable command; website install scheme not found. | DCR and automatic OAuth discovery documented; GoodWatch untested. [Docs](https://geminicli.com/docs/tools/mcp-server/) | Unknown; rich text/image tool output is distinct from Apps. | Free tier exists; Google account individual tier currently 1,000 model requests/day. No MCP-specific paid gate established. [Quotas](https://geminicli.com/docs/resources/quota-and-pricing/) |
| Mistral Le Chat / current docs call chat.mistral.ai Vibe Work | Connectors → + Add Connector → Custom MCP Connector; enter `goodwatch`, URL, optional description → Connect → consent. [MCP connectors](https://docs.mistral.ai/vibe/work/connectors/mcp-connectors) | No documented arbitrary-server install link found. | OAuth 2.1 with DCR explicitly supported; CIMD/redirect details unknown. [Docs](https://docs.mistral.ai/vibe/work/connectors/mcp-connectors) | Ordinary chat rendering unknown; workflow-only UI has specific restrictions below. | Admin required to add directory/custom connectors. Free mode can try Work, but exact custom connector plan entitlement not established. [Connectors](https://docs.mistral.ai/vibe/work/connectors/mcp-connectors), [First task](https://docs.mistral.ai/getting-started/quickstarts/vibe-work/first-task) |
| Perplexity | Account Settings → Connectors → + Custom connector → Remote; enter name and HTTPS MCP URL. [First-party workshop](https://www.perplexity.ai/en-GB/hub/workshops/perplexity-computer-for-buyside-professionals) | No primary arbitrary-server install link found. | OAuth selectable, alongside API key/open auth; CIMD/DCR, callback and scope mechanics unknown. [2026-03-13 changelog](https://www.perplexity.ai/en-GB/changelog/what-we-shipped---march-13-2026) | Unknown. | Pro, Max and Enterprise; enterprise admins can share connectors and control personal additions. [Changelog](https://www.perplexity.ai/en-GB/changelog/what-we-shipped---march-13-2026) |
| Raycast Desktop + iOS | Install MCP Server command / Manage MCP Servers → Install New Server; name/icon, HTTP, URL, OAuth Type Dynamic, then Sign In. iOS supports HTTP. [Manual](https://manual.raycast.com/ai/model-context-protocol) | Arbitrary web install deeplink not found; Store extensions may bundle/install MCPs. [Manual](https://manual.raycast.com/ai/model-context-protocol) | DCR + PKCE documented; static client credentials also supported. CIMD unknown. [Manual](https://manual.raycast.com/ai/model-context-protocol) | Unknown. | Current manual labels MCP **Pro Exclusive**. [Manual](https://manual.raycast.com/ai/model-context-protocol) |
| Goose Desktop / CLI | Desktop Extensions → Add custom extension, remote Streamable HTTP; CLI `goose configure` → Add Extension → Remote Extension (Streamable HTTP). [Docs](https://goose.vcorp.ai/docs/getting-started/using-extensions/) | **Yes:** `goose://extension?url=…&type=streamable_http&timeout=300&id=goodwatch&name=GoodWatch&description=…`. [Deeplink docs](https://goose.vcorp.ai/docs/getting-started/using-extensions/#deeplinks) | **CIMD and DCR explicitly documented**; metadata-selected scopes by default or configured `scopes`. [Docs](https://goose.vcorp.ai/docs/getting-started/using-extensions/) | **Yes on Desktop, experimental**, inline/standalone Apps documented. [Docs](https://goose.vcorp.ai/docs/guides/interactive-chat/mcp-ui/) | MCP-specific paid tier not established in setup docs. Model/provider cost separate; don't claim every provider is free. |
| Zed | Settings → AI → MCP Servers → Add Server → Add Remote Server; or `context_servers.goodwatch.url`. [Docs](https://zed.dev/docs/ai/mcp) | Custom-server deeplink not found; extension installation available. [Docs](https://zed.dev/docs/ai/mcp) | Omitting Authorization header triggers standard MCP OAuth; exact CIMD/DCR and scopes unknown. [Docs](https://zed.dev/docs/ai/mcp) | Unknown; docs explicitly list Tools and Prompts coverage, not Apps. | MCP-specific plan gate not established in setup docs. |
| LM Studio | Program sidebar → Install → Edit mcp.json; `mcpServers.goodwatch.url`. [Docs](https://lmstudio.ai/docs/app/mcp) | **Yes:** `lmstudio://add_mcp?name=goodwatch&config=<URL-encoded-base64-JSON>`. [Deeplink docs](https://lmstudio.ai/docs/app/mcp/deeplink) | Native OAuth and DCR documented; optional static credentials. [OAuth docs](https://lmstudio.ai/docs/integrations/mcp-remote) | Unknown. | Free home/work app use documented; enterprise controls separate. [First-party announcement](https://lmstudio.ai/blog/free-for-work) |
| JetBrains AI Assistant | Settings → Tools → AI Assistant → Model Context Protocol → Add → HTTP → JSON URL. [Docs](https://www.jetbrains.com/help/ai-assistant/mcp.html) | No primary arbitrary-server install link found. | **Native OAuth not established**: docs establish Streamable HTTP, while vendor tracker lists OAuth support request LLM-25012 as Open. Treat GoodWatch as unverified / do not promise native OAuth. [Docs](https://www.jetbrains.com/help/ai-assistant/mcp.html), [Vendor tracker](https://youtrack.jetbrains.com/issue/LLM-25012) | Unknown. | Organizations may preconfigure servers/block additions; MCP-specific personal plan entitlement not established. [Docs](https://www.jetbrains.com/help/ai-assistant/mcp.html) |
| Cline IDE + CLI | IDE MCP Servers → Remote Servers → name/URL → Streamable HTTP → Add Server; CLI `cline mcp add goodwatch https://goodwatch.app/mcp --transport http`, followed by OAuth wizard. [Docs](https://docs.cline.bot/mcp/mcp-overview) | CLI prefilled wizard; arbitrary website install link not found. | OAuth supported; current first-party source implements loopback browser auth. CIMD/DCR negotiation not independently established. [Docs](https://docs.cline.bot/mcp/mcp-overview), [OAuth implementation](https://github.com/cline/cline/blob/main/sdk/packages/core/src/extensions/mcp/oauth.ts) | Unknown. | MCP-specific paid gate not established in setup docs. |
| Continue IDE | Add `mcpServers: [{name: GoodWatch, type: streamable-http, url: https://goodwatch.app/mcp}]` to local YAML; JSON can be dropped into `.continue/mcpServers/mcp.json`. Agent mode required. [Docs](https://docs.continue.dev/customize/deep-dives/mcp) | No primary arbitrary-server install link found. | OAuth implemented in first-party code; docs insufficient to establish complete CIMD/DCR compatibility. [Implementation](https://github.com/continuedev/continue/blob/main/core/context/mcp/MCPOauth.ts) | Unknown. | Agent mode required; MCP-specific paid gate not established. [Docs](https://docs.continue.dev/customize/deep-dives/mcp) |
| Codex CLI / IDE, shared desktop configuration | `codex mcp add goodwatch --url https://goodwatch.app/mcp`, then `codex mcp login goodwatch`. Config `[mcp_servers.goodwatch] url = "https://goodwatch.app/mcp"`. [Official docs](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) | Copyable commands; arbitrary custom-server install deeplink not established. | **CIMD + DCR explicitly documented**; installed `codex mcp add --help` also exposes `--oauth-client-registration auto\|cimd\|dcr`. [Docs](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) | CLI rendering unknown; don't infer Apps rendering from remote tool support. | MCP-specific plan restriction not established in MCP docs. |
| OpenCode | `opencode.json`: `{"mcp":{"goodwatch":{"type":"remote","url":"https://goodwatch.app/mcp"}}}`; `opencode mcp auth goodwatch`. [Docs](https://opencode.ai/docs/mcp-servers/) | Copyable config/command; arbitrary-server deeplink not found. | Automatic 401 discovery + DCR documented; optional pre-registered ID/secret/scope. CIMD unknown. [Docs](https://opencode.ai/docs/mcp-servers/) | Unknown. | MCP-specific paid gate not established in setup docs. |
| Microsoft 365 Copilot | Package a declarative agent using Agents Toolkit and a remote MCP plugin; this is developer/admin onboarding, not a proven universal paste-URL consumer path. [MCP Apps guide](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/plugin-mcp-apps) | No GoodWatch-specific install link established. | OAuth supported; DCR/manual configuration documented. CIMD not established. [Authentication](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/plugin-authentication) | Yes, including portions of OpenAI Apps SDK. [Guide](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/plugin-mcp-apps) | Requires applicable Copilot extensibility licensing and tenant setup; exact GoodWatch entitlement not verified. |
| LibreChat | MCP Settings → + → name, URL, Streamable HTTP and OAuth → Create; select in composer and Continue with OAuth. Or administrator YAML. [Guide](https://www.librechat.ai/docs/features/mcp) | No primary arbitrary-server install deeplink established. | DCR when no static client ID/secret. Callback `${DOMAIN_SERVER}/api/mcp/goodwatch/oauth/callback`; CIMD unknown. [Configuration](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/mcp_servers) | Unknown in consulted primary docs. | Deployment/admin/model-provider constraints; no hosted universal tier entitlement established. |

## Client installation and OAuth details

### Claude hosted clients

For `/connect`, link to [Customize → Connectors](https://claude.ai/customize/connectors), display the copyable endpoint and the steps above. Team members first need an organization owner to add the connector. Free eligibility is now explicitly documented, although the individual step-by-step subsection is still titled Pro/Max. [Setup](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)

The directory's connector tab provides a Connect button that starts authentication. Directory distribution should therefore be a priority consumer route, while custom URL setup remains the fallback. No official supported URL parameter for prefilling GoodWatch in a custom-connector dialog was found. [Directory browsing](https://support.claude.com/en/articles/14328846-browse-skills-connectors-and-plugins-in-one-directory)

Claude OAuth requirements: advertise `client_id_metadata_document_supported: true` **and** include `none` in `token_endpoint_auth_methods_supported` to select CIMD; otherwise Claude falls back to DCR. DCR creates a new client on fresh connections. Hosted callback: `https://claude.ai/api/mcp/auth_callback`. Code must accept port-agnostic `http://localhost/callback` and `http://127.0.0.1/callback`. Claude requires S256 PKCE. It requests the challenge's `scope`, otherwise protected-resource `scopes_supported`, and appends `offline_access` when advertised by the authorization server. A real `401` starts sign-in; `WWW-Authenticate` on `200` is ignored. Claude uses the first `authorization_servers` entry. Token exchange/refresh use form encoding; refresh tokens must rotate or be sender constrained; invalid refresh tokens return `invalid_grant`. Discovery/registration/token timeout is 10 seconds; refresh is 30 seconds. [Authentication requirements](https://claude.com/docs/connectors/building/authentication)

For poster UI, interactive connectors show an Interactive directory badge and run in sandboxed iframes with CSP. They are enabled with the connector; Team/Enterprise can disable their rendering tools. [Interactive connectors](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude) The current developer guide gives Claude-specific `ui.domain`: first 32 hex characters of SHA-256(server URL), then `.claudemcpcontent.com`; distinguish this host-specific convention from OpenAI's origin format. [MCP Apps guide](https://claude.com/docs/connectors/building/mcp-apps/getting-started)

### Claude Code

```bash
claude mcp add --transport http --scope user goodwatch https://goodwatch.app/mcp
claude mcp login goodwatch
```

User scope makes it available across projects. OAuth tokens refresh automatically; `/mcp` also starts authentication. `--callback-port` fixes a callback port when necessary. `oauth.scopes` is a space-separated string for restricting scopes; example shape:

```json
{"mcpServers":{"goodwatch":{"type":"http","url":"https://goodwatch.app/mcp","oauth":{"scopes":"mcp:read mcp:write"}}}}
```

CIMD is automatically discovered. No poster rendering promise for terminal sessions is justified by this MCP reference. [Claude Code MCP reference](https://code.claude.com/docs/en/mcp)

### ChatGPT

Do **not** hard-code “enable Developer Mode” as the sole current path: the current Help Center says the Plugins experience no longer needs that toggle. It retains legacy Apps → Create steps for accounts showing the older UI. OAuth needs refresh-token issuance; with OIDC, advertise/request `offline_access` when needed. [Custom MCP help](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt) The directly linked current developer flow is [chatgpt.com/plugins](https://chatgpt.com/plugins) → Add custom MCP server → `https://goodwatch.app/mcp` → OAuth → Create as a plugin → install → `@` select it in a new conversation. Metadata changes need Refresh and retesting. [Connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt)

OAuth accepts public CIMD token exchange (`none`) or `private_key_jwt`, and DCR remains available. For a stable callback, advertise RFC 9207 issuer support, match `issuer` exactly to protected-resource `authorization_servers`, and return matching `iss` in authorization responses. Otherwise copy the per-connection callback from management: `https://chatgpt.com/connector/oauth/{callback_id}`. CIMD documents likewise may be callback-specific. New CIMD metadata has a plural array of token authentication methods; a legacy singular preference can still say `private_key_jwt`. Tool-triggered sign-in needs resource metadata, per-tool `securitySchemes`, and error `_meta["mcp/www_authenticate"]`. Omission of `securitySchemes` inherits server defaults, so it is **not independently proof that server-wide OAuth fails**. [Authentication](https://developers.openai.com/plugins/build/auth)

The stable callback/client identifiers were introduced in the 2026-08-21 changelog: `https://chatgpt.com/connector_platform_oauth_redirect` and `https://chatgpt.com/oauth/client.json`. [Changelog](https://developers.openai.com/plugins/changelog)

Per-tool recommendation for GoodWatch (map read/write tools to the narrow matching scope):

```json
{
  "securitySchemes": [{"type":"oauth2","scopes":["mcp:read"]}],
  "_meta": {
    "securitySchemes": [{"type":"oauth2","scopes":["mcp:read"]}]
  }
}
```

`_meta.securitySchemes` is the compatibility mirror. `readOnlyHint`, `destructiveHint`, and `openWorldHint` are required in OpenAI's reference. Standard `_meta.ui.resourceUri` is preferred; `openai/outputTemplate` remains an optional alias. A dedicated `_meta.ui.domain` is **required for UI plugin submission**, while the runtime has a default sandbox origin. Standard `ui.csp` is preferred; legacy `openai/widgetCSP.redirect_domains` still handles trusted `openExternal` destinations. These are distinct from OAuth's transport-level compatibility. [Reference](https://developers.openai.com/plugins/reference)

### Cursor

Generated from the documented install-link format; confirmation and OAuth follow the click. This is a proposed link, not a real tested installation:

```text
cursor://anysphere.cursor-deeplink/mcp/install?name=goodwatch&config=eyJ1cmwiOiJodHRwczovL2dvb2R3YXRjaC5hcHAvbWNwIn0%3D
```

Generate `config` as base64 of raw `JSON.stringify({url:"https://goodwatch.app/mcp"})`, then URL-encode the query value. Keep the `name` separate. [Install links](https://prod.cursor.com/docs/mcp/install-links)

Fallback at `~/.cursor/mcp.json`:

```json
{"mcpServers":{"goodwatch":{"url":"https://goodwatch.app/mcp"}}}
```

Static OAuth optionally uses `auth.CLIENT_ID`, `auth.CLIENT_SECRET`, and `auth.scopes`; omitted scopes are discovered from authorization-server metadata. Fixed redirects are `http://localhost:8787/callback` for desktop and `https://www.cursor.com/agents/mcp/oauth/callback` for web/Agents. [MCP reference](https://cursor.com/docs/mcp) A Cursor support representative said on 2026-01-06 that OAuth supports DCR/static credentials and CIMD had no timeline. No later authoritative confirmation of CIMD support was found; retain DCR rather than converting this into an absolute current “no.” [Support answer](https://forum.cursor.com/t/mcp-oauth-cimd-support-plans-and-timelines/148096/2)

### VS Code + Copilot

Generated install link, not an end-to-end test:

```text
vscode:mcp/install?%7B%22name%22%3A%22goodwatch%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fgoodwatch.app%2Fmcp%22%7D
```

Generate with `"vscode:mcp/install?" + encodeURIComponent(JSON.stringify({name:"goodwatch",type:"http",url:"https://goodwatch.app/mcp"}))`; replace scheme with `vscode-insiders` for Insiders. VS Code supports MCP Apps and same-authority HTTP server icons. The published OAuth guide describes DCR/static fallback and redirects `http://127.0.0.1:33418` / `https://vscode.dev/redirect`. [Developer guide](https://code.visualstudio.com/api/extension-guides/ai/mcp)

The guide omits current CIMD behavior: first-party source at commit `5b23ab39bef800e5c4dad4e544671ef20617e660` selects its client-metadata URL when metadata advertises CIMD and no supplied/stored client ID exists. [Source](https://github.com/microsoft/vscode/blob/5b23ab39bef800e5c4dad4e544671ef20617e660/src/vs/workbench/api/browser/mainThreadAuthentication.ts#L178) Live first-party metadata retrieved 2026-10-17 declares `client_id=https://vscode.dev/oauth/client-metadata.json`, public auth `none`, redirects `http://127.0.0.1:33418/` (note slash) and `https://vscode.dev/redirect`. [CIMD document](https://vscode.dev/oauth/client-metadata.json)

Workspace fallback:

```json
{"servers":{"goodwatch":{"type":"http","url":"https://goodwatch.app/mcp"}}}
```

Users can configure workspace `.vscode/mcp.json` or user profile servers, start/trust/authenticate, and select the tools in chat. [Management](https://code.visualstudio.com/docs/agent-customization/mcp-servers) Copilot Free has access; Business/Enterprise organizations must enable the MCP policy. Do not confuse this local IDE OAuth path with Copilot cloud-agent repository MCP support. [GitHub requirements](https://docs.github.com/en/copilot/how-tos/copilot-in-your-ide/customize-copilot/extend-copilot-with-tools-and-context/extend-copilot-chat-with-mcp?tool=vscode)

### Windsurf / Devin naming needs a version-aware guide

The old `docs.windsurf.com/windsurf/cascade/mcp` now redirects to the linked Devin page. Its explicit current Cascade behavior supersedes old advice about a universal Windsurf marketplace button. Devin Local uses `.devin/config.json`, `.devin/config.local.json`, or `~/.config/devin/config.json`, and has an Authenticate action for expired server credentials. Do not reuse Cascade config instructions for Devin Local. The supported arbitrary-server Devin Local install-link encoding was not established in the checked pages. [Cascade docs](https://docs.devin.ai/desktop/cascade/mcp), [Devin Local docs](https://docs.devin.ai/desktop/devin-local)

### Gemini CLI

Default redirect: `http://localhost:<random-port>/oauth/callback`; custom `oauth.redirectUri` and `oauth.scopes: ["mcp:read", "mcp:write"]` are available. The CLI needs a local browser and callback access. It validates RFC 9207 `iss`: if metadata claims `authorization_response_iss_parameter_supported: true`, callbacks must contain the matching issuer; ordinary discovery without that flag accepts omitted `iss`. Keep the auto-discovery path simplest for GoodWatch. CIMD was not found in this page. Docs were last updated 2026-10-06. [MCP docs](https://geminicli.com/docs/tools/mcp-server/)

Example config when scopes need to be explicit (a proposed configuration, not a verified GoodWatch login):

```json
{"mcpServers":{"goodwatch":{"httpUrl":"https://goodwatch.app/mcp","oauth":{"enabled":true,"scopes":["mcp:read","mcp:write"]}}}}
```

[Configuration schema and OAuth fields](https://geminicli.com/docs/tools/mcp-server/)

### Mistral and Perplexity

Mistral requires OAuth servers to return 401 plus `WWW-Authenticate` for detection. Exact DCR redirect/scopes and CIMD support were not found. [Mistral MCP docs](https://docs.mistral.ai/vibe/work/connectors/mcp-connectors)

Mistral now documents workflow-only MCP Apps: slot `allow_mcp_ui=True`, direct `ToolCallClient.call_tool()`, app-visible `ui://` metadata, and a supporting client surface. Indirect model/agent calls do not show UI through that path. This does **not** establish ordinary Le Chat/Work prompt-based GoodWatch poster rendering. [Workflow connectors](https://docs.mistral.ai/studio/workflows/building-workflows/connectors)

For Perplexity, first-party workshop and changelog established setup/tier/OAuth availability, but primary technical proof for DCR/CIMD/Apps/scopes/callbacks was not found. The referenced Help Center detail page could not be retrieved during this research. [Workshop](https://www.perplexity.ai/en-GB/hub/workshops/perplexity-computer-for-buyside-professionals), [Changelog](https://www.perplexity.ai/en-GB/changelog/what-we-shipped---march-13-2026)

### Raycast

For static OAuth, Raycast exposes Client ID/Secret/Scopes and Callback Type/URL. Copy the exact callback from the app and register it; users can select HTTPS callback or the Raycast App. Dynamic OAuth should avoid manual credentials. A Store extension can bundle a server; this is a packaging route rather than evidence of a public arbitrary-server website deeplink. [Manual](https://manual.raycast.com/ai/model-context-protocol)

### Goose

Default OAuth callback is 127.0.0.1 with an ephemeral port; `GOOSE_OAUTH_CALLBACK_PORT` fixes the port when necessary. Setting a pre-registered `client_id` takes precedence over CIMD/DCR. Scopes default to server-advertised metadata, so check that GoodWatch asks for the intended read/write access. [OAuth docs](https://goose.vcorp.ai/docs/getting-started/using-extensions/)

Concrete proposed `/connect` button:

```text
goose://extension?url=https%3A%2F%2Fgoodwatch.app%2Fmcp&type=streamable_http&timeout=300&id=goodwatch&name=GoodWatch&description=Find%20what%20to%20watch
```

All parameter values must be URL encoded. This creates an install prompt; consent still remains a user action. [Deeplink contract](https://goose.vcorp.ai/docs/getting-started/using-extensions/#deeplinks)

### LM Studio

Static OAuth callback is `http://127.0.0.1:33389/mcp-oauth-callback`. For services without DCR, `auth.CLIENT_ID` and `auth.CLIENT_SECRET` can be configured; GoodWatch's DCR path should avoid that friction. No CIMD proof found. [OAuth docs](https://lmstudio.ai/docs/integrations/mcp-remote)

For `/connect`, encode the per-server JSON `{"url":"https://goodwatch.app/mcp"}` as Base64, then URL-encode it in `config`. The `name` is separate; do not Base64 the outer `mcpServers` wrapper. The official generator accepts the server entry and produces the button. [Deeplink format](https://lmstudio.ai/docs/app/mcp/deeplink)

Concrete proposed link, generated from that documented encoding (not clicked/tested):

```text
lmstudio://add_mcp?name=goodwatch&config=eyJ1cmwiOiJodHRwczovL2dvb2R3YXRjaC5hcHAvbWNwIn0%3D
```

### Zed

The documented minimal entry is:

```json
{"context_servers":{"goodwatch":{"url":"https://goodwatch.app/mcp"}}}
```

Do not insert a placeholder Authorization header: the documented OAuth prompt depends on having no configured Authorization header. Native MCP coverage listed in docs is Tools and Prompts; no primary Apps-rendering proof found. [Zed MCP docs](https://zed.dev/docs/ai/mcp)

### Cline and Continue source-level evidence

Cline JSON must explicitly set `"type":"streamableHttp"`; omission defaults to legacy SSE. [MCP docs](https://docs.cline.bot/mcp/mcp-overview)

```json
{"mcpServers":{"goodwatch":{"type":"streamableHttp","url":"https://goodwatch.app/mcp","disabled":false,"autoApprove":[]}}}
```

Cline's current source uses `/mcp/oauth/callback` and preferred ports 1456,1457,1458; actual interactive loopback URL is selected when binding. Source reads as standard SDK-based public OAuth with authorization_code/refresh_token support. This is source inspection, not successful GoodWatch authentication. [Core OAuth](https://github.com/cline/cline/blob/main/sdk/packages/core/src/extensions/mcp/oauth.ts), [IDE OAuth provider](https://github.com/cline/cline/blob/main/apps/vscode/src/services/mcp/McpOAuthManager.ts)

Continue's OAuth provider starts from `http://localhost:3000` and can replace it using the IDE's `getExternalUri`, so remote VS Code contexts can differ. It advertises public-client `token_endpoint_auth_method: none`, authorization_code and refresh_token grants, and persists client information. Exact CIMD negotiation and release/version deployment were not established. [Source](https://github.com/continuedev/continue/blob/main/core/context/mcp/MCPOauth.ts)

### Codex

Current docs explicitly support OAuth CIMD/DCR and shared configuration across the desktop app, CLI and IDE extension. Use the exact callback displayed during add/login: current callback behavior depends on configured callback, issuer support and server-specific callback IDs; do not publish a guessed fixed URI. For loopback callback URLs without explicit port, the listener port is inserted during authorization, requiring variable-loopback-port acceptance. [MCP docs](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

### OpenCode

Minimal URL-only remote entry activates automatic OAuth/DCR; the optional `oauth.scope` field can request `"mcp:read mcp:write"`. `opencode mcp auth goodwatch` opens a browser; `opencode mcp debug goodwatch` diagnoses discovery/connectivity. Do not set `oauth:false` for GoodWatch. Native redirect and CIMD details were not established. [MCP docs](https://opencode.ai/docs/mcp-servers/)

## Registries and directories

No existing GoodWatch directory listing, publisher account or DNS verification was established in this research. “Gap” identifies missing source artifacts or owner confirmation needed; confirm existing external listings before creating duplicates.

| Destination | Submission and review | Cost observed | Metadata/assets and GoodWatch gap | Priority / actor |
|---|---|---|---|---|
| Official MCP Registry | Publish metadata with `mcp-publisher`; namespace ownership and schema validation. Remote-only entry is supported; no npm wrapper needed. Still preview. [Remote servers](https://modelcontextprotocol.io/registry/remote-servers), [CLI](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/cli/commands.md) | No publication fee stated in consulted official docs; do not infer a contractual free guarantee. | No `server.json` found in source; namespace ownership/publishing credentials need confirmation. HTTP proof URL returned 404; DNS proof was not audited. Suggested `app.goodwatch/mcp`, title, short description, version, `/connect`, HTTPS icon, remote URL. [Schema](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json) | P0; Agent prepares/validates, owner supplies domain verification and publishing identity. |
| Anthropic Connectors Directory / unified Claude directory | Current route is [developer portal](https://claude.ai/directory/manage) → Submit new → MCP connector. Automatic safety screening normally produces Community listing; some submissions get human review. [Submission](https://claude.com/docs/connectors/building/submission) | Submitter needs Pro, Max, Team or Enterprise; Team/Enterprise Owner or Enterprise custom Directory permission. No separate listing fee stated. [Eligibility](https://claude.com/docs/directory/publish) | Icon, documentation/privacy URLs, support contact, listing copy, company/contact, populated reviewer account. MCP App requires screenshots; see below. [Submission](https://claude.com/docs/connectors/building/submission) | P1; Agent prepares evidence/assets; owner chooses durable listing organization and submits. |
| OpenAI Apps directory, now documented as universal ChatGPT/Codex plugin directory | [Plugins dashboard](https://platform.openai.com/plugins): upload ZIP with MCP config; automated findings, domain proof, review, then explicit publish. [Current flow](https://developers.openai.com/plugins/deploy/submission) | No submission fee stated in reviewed primary docs. Identity verification and suitable project required. | Missing distribution ZIP, listing/support/terms URLs, dedicated account, tested review scenarios, recording and domain proof; see below. Existing `/privacy` helps; verify policy covers MCP processing. | P1; Agent prepares package and evidence; owner verifies identity, approves legal pages, supplies account and submits. |
| Smithery | [Publish URL](https://smithery.ai/new); public HTTPS + Streamable HTTP; OAuth if protected. Scanner asks submitter to authenticate; CIMD supported. Gateway proxies upstream. [Publisher docs](https://smithery.ai/docs/build/publish) | [Pricing page](https://smithery.ai/pricing) returned only site chrome in this research; no current first-party prices established. Do not repeat third-party free-listing/quota claims. | URL and namespace; tools/prompts/resources scanned. Optional static server card if scan fails; automatic vendor-verification checklist under Settings → Verification. [Publisher docs](https://smithery.ai/docs/build/publish) | P1/P2; Agent prepares; owner connects sample account and checks gateway/data handling and billing terms. |
| Glama remote connectors | [Connectors directory](https://glama.ai/mcp/connectors) → Add MCP Server → Connector. HTTPS Streamable HTTP; name, description, optional private test credentials. DCR can register automatically. Healthy connectors become public/searchable; unhealthy remain pending. [Glama's FAQ](https://glama.ai/mcp/faq) | No listing charge or review SLA stated in consulted first-party FAQ. Hosting/gateway pricing is separate and unverified here. | Name, description, URL; OAuth test setup/health verification. No need to repackage hosted GoodWatch as an installable server. [Glama FAQ](https://glama.ai/mcp/faq) | P2; Agent prepares; owner supplies auth if requested. |
| PulseMCP | **Submissions AND listing changes paused**; page last updated **2026-09-03**. Publish Official MCP Registry first; PulseMCP says it will ingest automatically when resumed. [Current submission page](https://www.pulsemcp.com/submit) | No active submission checkout/form; no current listing fee established. | Official Registry listing is current prerequisite/action. No assets/form fields obtainable while paused. | P2 monitoring; Agent publishes upstream only when separately authorized. |
| mcp.so | [Remote-server submission](https://mcp.so/submit?type=remote-server) takes endpoint URL and name; current paid flow advertises instant publication without review, badge and priority placement. | **$39 one-time publication fee**, displayed 2026-10-17. [Actual form](https://mcp.so/submit?type=remote-server) | Have URL and product name; payment/owner decision missing. This paid badge is not evidence of independent protocol/security review. | P3; Owner decides spend. |
| mcpservers.org | [Submission form](https://mcpservers.org/submit): name, category, short description, repo/website/docs URL, optional official Registry name, remote checkbox and contact email. | **Free $0**, advertised review within 2 weeks; optional **$39** premium review within 24h and priority/badge. [Form](https://mcpservers.org/submit) | Existing `/connect` can serve as docs URL; draft copy and Registry name, then submit free route. | P2; Agent prepares; owner/contact identity submits. |
| Awesome remote MCP list | `punkpeye/awesome-mcp-servers` directs remote-only services to [awesome-remote-mcp-servers](https://github.com/punkpeye/awesome-remote-mcp-servers). [Maintainer's contributing guide](https://github.com/punkpeye/awesome-mcp-servers/blob/main/CONTRIBUTING.md) | No listing fee stated; maintainer PR process. | Prepare remote URL, short factual description and correct category; inspect target list's latest contributing guide before PR. | P3; Agent can prepare PR; actual external submission needs scoped authorization. |
| MCP Central | Catalog submission publishes to official Registry, mirrored daily; hosted deployments are separate. [First-party submission docs](https://mcpcentral.io/docs/submit-a-server) | Existing-server listing stated free; hosting is paid. | Same `server.json`; no duplicate hosting necessary. | P2, follows Registry publication. |
| GitHub MCP Registry | [GitHub's public catalog](https://github.com/mcp) exposes search/install; Copilot CLI's registry search installs prefilled configs. [GitHub CLI docs](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers) | No listing cost found. | No current first-party self-service onboarding/review/asset requirements found in consulted GitHub sources. Do **not** promise Official Registry publication automatically lists GoodWatch on github.com/mcp. | P2 investigation after official Registry, no assumed automatic distribution. |

## Official Registry: concrete remote metadata and publishing

The current official Registry docs still reference **2025-12-11 server.json schema** (this is independent of MCP's current protocol version). Required fields are `name`, `description` and `version`; description max 100 characters. Optional title, website, icons and repository improve presentation. The live schema permits HTTPS icon URL plus MIME type, sizes, theme. Proposed metadata below was checked against the owning schema during this research; it has not been published. [Live owning schema](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json)

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "app.goodwatch/mcp",
  "title": "GoodWatch",
  "description": "Find movies and TV shows, track watches, and get suggestions based on your taste.",
  "version": "1.0.0",
  "websiteUrl": "https://goodwatch.app/connect",
  "remotes": [{ "type": "streamable-http", "url": "https://goodwatch.app/mcp" }]
}
```

Select the actual server release version; add a suitable public square brand icon once its canonical URL is chosen. Do not invent an OAuth token header in registry metadata: users authorize individually. The remote entry does not require publishing app source or a local package. Remote service URL must be publicly accessible. [Remote server guide](https://modelcontextprotocol.io/registry/remote-servers)

For `app.goodwatch/mcp`, prove **goodwatch.app**, not `app.goodwatch` as a hostname. Domain authentication accepts either apex DNS TXT `v=MCPv1; k=ed25519; p=<BASE64_PUBLIC_KEY>` or the same proof text hosted at `https://goodwatch.app/.well-known/mcp-registry-auth`. Retain the signing private key outside the repo. The following commands are a recipe, not executed work. [Authentication](https://modelcontextprotocol.io/registry/authentication)

```sh
brew install mcp-publisher
mcp-publisher init
# Replace template with reviewed metadata.
mcp-publisher validate ./server.json
# After hosting the matching public-key proof and obtaining a private-key hex value:
mcp-publisher login http --domain goodwatch.app --private-key "$MCP_REGISTRY_PRIVATE_KEY"
# Or: mcp-publisher login dns --domain goodwatch.app --private-key "$MCP_REGISTRY_PRIVATE_KEY"
mcp-publisher publish ./server.json
curl 'https://registry.modelcontextprotocol.io/v0.1/servers?search=app.goodwatch/mcp'
```

`publish` takes a positional filename; it does not take a `--registry` flag (`--registry` belongs to `login`). [Owning CLI reference](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/cli/commands.md) Automated release publishing can use stored domain signing credentials in an appropriately protected environment; [official Actions guidance](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/github-actions.mdx).

## Anthropic: submission kit and interactive status

Listing copy limits: name 100 characters, one-liner 200, description 2,000, 1–5 categories; listing slug becomes permanent. Authentication choices include CIMD, DCR and Anthropic-held clients. MCP App carousel requires **3–5 PNGs, at least 1000px wide, app response crop without prompt**, with paired prompt text separately; any aspect ratio, no video/GIF, one batch for desktop/mobile. [Current submission requirements](https://claude.com/docs/connectors/building/submission)

The current policy requires clear tool descriptions, privacy/data minimization, support contact, sample-data account and at least **three working prompt examples**. Confirm rights to poster images and external rendered resources, and assess any sponsored/affiliate placement: sponsored content and primarily promotional software are restricted. Remote authenticated services need secure OAuth; Streamable HTTP and applicable tool annotations are expected. [Software Directory Policy, effective 2026-04-15](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)

Review checklist explicitly wants separate read/write tools, short names (≤64), `title`, and read/write hints; its wording currently calls for `destructiveHint: true` for tools that modify/delete data. This is stricter than OpenAI's irreversible-action reading: inspect the actual GoodWatch tool annotations and review feedback instead of automatically changing truthful protocol hints solely to chase a badge. [Anthropic pre-submission checklist](https://claude.com/docs/connectors/building/review-criteria), [OpenAI annotation guidance](https://developers.openai.com/plugins/deploy/app-review)

**Interactive** is a UI capability badge: Claude's help center explicitly says directory connectors with embedded interactive apps carry it. [Interactive connectors, updated 2026-08-11](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude) It is separate from **Community/Verified** review status. Community gets screening; Verified means closer tool quality/compatibility review, explicitly not a security audit. No primary source found promising that shipping a `ui://` resource alone automatically grants the Interactive badge; submit poster screenshots and demonstrate the app. [Verification labels](https://claude.com/docs/connectors/verification)

Current portal replaces older public form advice. The September 25, 2026 announcement says paid Claude developers may submit one remote MCP connector or a plugin bundle; existing listings need no forced migration. [First-party announcement](https://claude.com/resources/articles/build-plugins-for-claude) Brand the listing as **GoodWatch**, use owned logos, and don't imply Anthropic verification before granted; actual brand/logo usage beyond listing requirements was not established in a primary source here.

## OpenAI: current publishing requirements

The old Apps SDK submission URL now redirects to Plugins. Package a remote MCP connection in a ZIP, select verified individual/business developer identity, resolve checks and submit; once approved explicitly publish. `mcp.json` can select CIMD, DCR or provided client. Host the exact plain-text proof at `/.well-known/openai-apps-challenge`. Submission materials include **five positive + three negative cases**, video walkthrough and dedicated reviewer credentials with no ongoing MFA/OTP/magic-link dependence. Four HTTPS listing URLs (website, support, privacy, terms) plus primary icon are required; square icons ≥48×48, PNG/JPEG/WebP/SVG, ≤5 MiB. [Current submission documentation](https://developers.openai.com/plugins/deploy/submission)

Use an OpenAI project with **global residency**: EU-residency projects currently cannot submit remote MCP plugins. UI needs explicit CSP with exact fetch domains. The review imports tool schemas/annotations, UI metadata and server instructions; automated/manual checks follow, timing varies. Publish under verified individual/company identity; permissions `api.apps.write` / `api.apps.read` govern submit/status access. Directory publication gives a searchable listing/direct link; enhanced placement is selective and cannot be requested. [MCP review requirements](https://developers.openai.com/plugins/deploy/app-review)

GoodWatch inference: existing `ui://goodwatch/posters-v3.html` should be tested in ChatGPT, including image CSP, auth consent, read-only versus write prompts and graceful unsupported requests. Agent can draft package/cases and prepare icon/screenshot assets. Owner must approve legal text (terms page currently absent in code audit), legal publisher identity, country availability, and an already verified password test account with safe sample data. No approval or installation behavior was tested through a logged-in directory portal during this research.

OpenAI brand guidance prohibits implying endorsement and restricts GPT branding in app/product/company names. Use **GoodWatch** as the product identity; setup button text can name its destination without adopting the host's identity. [OpenAI brand guidelines](https://openai.com/brand/)

## Smithery discovery card nuance

Smithery accepts manual metadata at `/.well-known/mcp/server-card.json` when scanning cannot complete. This vendor-documented fallback contains `serverInfo`, optional authentication and tools/resources/prompts. It is described via a spec proposal; do not call it a universally implemented MCP discovery requirement. Current docs allow OAuth-authenticated scanning, so absence of a public card is **not** a demonstrated listing blocker for GoodWatch. CLI alternative: `smithery mcp publish "https://goodwatch.app/mcp" -n @goodwatch/mcp`. [Smithery owning publication docs](https://smithery.ai/docs/build/publish)

## Server compatibility and discoverability audit

Code baseline: fetched `origin/main` at `9c3f71cbca602f55308f8892d31b35abb9cec15b` on **2026-10-17**. All GoodWatch source links below are pinned to that commit. This is a source audit plus unauthenticated production probes; it is not a certification of each client.

| Area | What GoodWatch already does | Gap / recommendation |
| --- | --- | --- |
| Transport | Uses SDK `createMcpHandler` with `{ legacy: "stateless" }`; authenticates each request; returns `private, no-store, no-transform`. [Endpoint][gw-endpoint] | Preserve compatibility with clients that still use `initialize`. The current specification is **2026-07-28**, with changed HTTP behavior and explicit older-version compatibility; publishing a supported-version claim needs a protocol test. [Transport specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http#backward-compatibility) |
| Resource discovery | Both root and `/mcp` protected-resource metadata routes delegate to the auth provider. Production `/mcp` metadata returns canonical resource `https://goodwatch.app/mcp`, issuer `https://goodwatch.app/api/auth`, scopes `mcp:read` and `mcp:write`, bearer in the header. [Routes][gw-routes], [live metadata](https://goodwatch.app/.well-known/oauth-protected-resource/mcp) | Keep the path-specific metadata URL in `WWW-Authenticate`. Resource metadata is the auth discovery document, not a directory listing or install link. [Discovery specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization#authorization-server-discovery) |
| AS discovery / registration | Production metadata advertises CIMD, registration endpoint, S256, code and refresh grants, issuer callback support, and public / secret / private-key token authentication methods. Configuration enables unauthenticated DCR and CIMD profile `mcp-2026-07-28`. [Live AS metadata](https://goodwatch.app/.well-known/oauth-authorization-server/api/auth), [configuration][gw-auth] | Retain **both CIMD and DCR** for coverage. Current MCP recommends CIMD; DCR remains a deprecated compatibility path. Metadata advertisement alone does not prove every client-auth method has been exercised. [Client registration](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration) |
| Scope discovery | Missing-token challenge intentionally omits `scope`, so clients discover both MCP scopes from resource metadata; entry requires read; write calls enforce write separately. Consent can narrow to read-only, never adds an unrequested scope, and rejects grants without read. [Endpoint][gw-endpoint], [consent][gw-consent] | Keep explicit per-client scope instructions for clients needing them. For reconnects request **`mcp:read mcp:write` together**, with optional `offline_access` where the client supports it. A write failure can be consent/scope selection, not just a plan restriction. Current client scope selection and step-up rules explain why. [Scope strategy](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization#scope-selection-strategy) |
| Refresh / sessions | Access lifetime **300 seconds**, refresh lifetime **90 days**, retry reuse interval **30 seconds**. Consent allows `offline_access`; token verification checks audience, issuer, expiry, live member/client/grant/version. [Auth][gw-auth], [verifier][gw-verifier], [consent][gw-consent] | Keep short access tokens. Test a read after >5 minutes, concurrent refresh, reconnect, and per-computer revocation for each promoted client. `offline_access` belongs in AS metadata, not resource-required scopes. [Refresh specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization#refresh-tokens) |
| Browser access / CORS | Endpoint rejects any supplied `Origin` except GoodWatch's own origin. A live cross-origin preflight returned **403 Origin rejected**, without CORS headers. [Endpoint][gw-endpoint] | This blocks direct browser fetch clients; hosted assistants may use a backend and be unaffected. If supporting a particular browser host, align a narrow Origin allowlist with unauthenticated OPTIONS, metadata/token CORS as needed, allowed Authorization/Content-Type/MCP headers, exposed `WWW-Authenticate`, and `Vary: Origin`. Keep DNS-rebinding checks and cookie consent protections. [Official SDK CORS guidance](https://csharp.sdk.modelcontextprotocol.io/v2/concepts/transports/transports.html), [Fetch CORS standard](https://fetch.spec.whatwg.org/#http-cors-protocol) |
| DPoP advertisement | Both live metadata documents advertise DPoP algorithms, but `/mcp` uses bearer verification and explicitly rejects any JWT `cnf`. [Live resource metadata](https://goodwatch.app/.well-known/oauth-protected-resource/mcp), [live AS metadata](https://goodwatch.app/.well-known/oauth-authorization-server/api/auth), [verifier][gw-verifier] | **Concrete compatibility concern:** investigate provider configuration to stop advertising unsupported end-to-end DPoP, or implement/verify proof validation before advertising it. Do not claim DPoP support. This is an inferred client-failure risk from observed metadata and code, not an authenticated DPoP test. [RFC 9449](https://datatracker.ietf.org/doc/html/rfc9449#section-5.1) |
| Server identity / icons | SDK identity is only `{ name: "goodwatch", version: "1.0.0" }`. [Tools][gw-tools] | Add display title `GoodWatch`, short description, `websiteUrl: "https://goodwatch.app/connect"`, and stable HTTPS PNG icons with MIME type/sizes; optional theme variants. These are standard optional implementation fields, not custom directory hacks. [Implementation schema](https://modelcontextprotocol.io/specification/2026-07-28/schema#implementation) |
| Tool usability / safety metadata | Read tools have human titles and read-only/non-destructive/idempotent hints; writes set destructive hints per operation. Both return text and structured content; write tools are registered only for a write grant. [Read tools][gw-tools], [write tools][gw-writes] | Retain plain text/structured fallbacks for hosts without UI. Audit each write annotation and any host-specific security descriptor against submission rules; a directory badge is not a substitute for scoped access. |
| MCP Apps posters | Resource `ui://goodwatch/posters-v3.html`, MIME `text/html;profile=mcp-app`; tool metadata includes standard `ui.resourceUri`, legacy `ui/resourceUri`, and `openai/outputTemplate`. Resource includes standard `ui.csp` plus OpenAI CSP aliases. CSP permits TMDB images/site resources, no fetch destinations. [Widget][gw-posters] | Retest actual rendering in each advertised host, especially MIME/SDK transitions. The widget's iframe CSP is separate from MCP endpoint CORS. No extra public HTML endpoint is needed: the host reads `ui://` through MCP. [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview), [CSP/CORS](https://apps.extensions.modelcontextprotocol.io/api/documents/csp-and-cors.html) |
| OpenAI publication-specific UI / auth | Current resource has CSP but no `ui.domain`; tools have no explicit `securitySchemes`. [Widget][gw-posters], [tools][gw-tools] | The OpenAI reference requires a dedicated UI domain for directory submission; plan this before submitting. Explicit per-tool schemes are recommended; absence inherits server OAuth and is **not a proven runtime blocker**. Tool-triggered account linking also needs its error metadata. [Reference](https://developers.openai.com/plugins/reference), [auth](https://developers.openai.com/plugins/build/auth) |
| Limits / recovery | Endpoint limits members to **60 requests/minute and 1,000/hour** and sends `Retry-After`. [Endpoint][gw-endpoint] | Explain 429/retry in troubleshooting. Install does not require changing these limits. |
| Privacy / help assets | `/privacy` contains an October 17 account/apps policy when connector flag is on; help page links Connected apps and `hello@goodwatch.app`. Public favicon and Apple touch PNGs exist. [Privacy][gw-privacy], [help][gw-help], [assets][gw-assets] | Confirm owner-approved Terms URL, legal publisher identity, support details, square directory logo and approved screenshots. Existing favicons are not proof of meeting directory artwork requirements. No Terms route or registry `server.json` was found in the inspected checkout. |

### Server cards: useful experiment, not a universal requirement

Do not promise that `/.well-known/mcp.json` or `/.well-known/mcp/server-card.json` will make every client discover GoodWatch. The current first-party Server Cards repository explicitly calls itself **experimental, not an accepted official MCP extension**. Its current recommendation is `<streamable-http-url>/server-card`, optionally advertised through `/.well-known/ai-catalog.json`; earlier proposals used a different well-known path. Treat this as a later experiment, with metadata generated from the same source as the registry entry. A registry-specific optional card can be added for a consumer that documents it. [Status](https://github.com/modelcontextprotocol/ext-server-card/blob/main/README.md), [current discovery design](https://github.com/modelcontextprotocol/ext-server-card/blob/main/docs/discovery.md)

### Evidence boundaries

The existing repository notes record an actual local Inspector DCR flow and Claude Code CIMD flow, including refresh, on October 14. Those are historical test results, not new runs in this research. The owner reports Claude.ai works in production; this research did not use the owner's credentials or independently replay that session. [Existing authorization evidence][gw-auth-note]

Production probes on **2026-10-17, 14:34–14:35 UTC**:

- GET path-specific resource metadata: **200**, canonical URL/issuer and both MCP scopes.
- GET AS metadata: **200**, CIMD true, DCR endpoint, S256, refresh grant, `offline_access`, issuer response support; DPoP algorithms also present.
- HEAD root resource metadata: **200**.
- Unauthenticated POST `/mcp`: **401**, `WWW-Authenticate` links path-specific resource metadata and contains no scope hint; no tool executed.
- OPTIONS `/mcp` with `Origin: https://example.com`: **403 Origin rejected**, no CORS permission.

These are reproducible observations of the linked [resource metadata](https://goodwatch.app/.well-known/oauth-protected-resource/mcp), [AS metadata](https://goodwatch.app/.well-known/oauth-authorization-server/api/auth), and [endpoint code][gw-endpoint]. No registration, member authorization, authenticated tool call, UI render, directory submission, DNS mutation, or production change was performed.

[gw-endpoint]: https://github.com/alp82/goodwatch-monorepo/blob/9c3f71cbca602f55308f8892d31b35abb9cec15b/goodwatch-webapp/app/server/mcp/endpoint.server.ts
[gw-auth]: https://github.com/alp82/goodwatch-monorepo/blob/9c3f71cbca602f55308f8892d31b35abb9cec15b/goodwatch-webapp/app/server/auth/auth.server.ts
[gw-consent]: https://github.com/alp82/goodwatch-monorepo/blob/9c3f71cbca602f55308f8892d31b35abb9cec15b/goodwatch-webapp/app/server/auth/mcp-flow.server.ts
[gw-verifier]: https://github.com/alp82/goodwatch-monorepo/blob/9c3f71cbca602f55308f8892d31b35abb9cec15b/goodwatch-webapp/app/server/mcp/authorization.server.ts
[gw-tools]: https://github.com/alp82/goodwatch-monorepo/blob/9c3f71cbca602f55308f8892d31b35abb9cec15b/goodwatch-webapp/app/server/mcp/tools.server.ts
[gw-writes]: https://github.com/alp82/goodwatch-monorepo/blob/9c3f71cbca602f55308f8892d31b35abb9cec15b/goodwatch-webapp/app/server/mcp/write-tools.server.ts
[gw-posters]: https://github.com/alp82/goodwatch-monorepo/blob/9c3f71cbca602f55308f8892d31b35abb9cec15b/goodwatch-webapp/app/server/mcp/poster-grid.server.ts
[gw-routes]: https://github.com/alp82/goodwatch-monorepo/tree/9c3f71cbca602f55308f8892d31b35abb9cec15b/goodwatch-webapp/app/routes
[gw-privacy]: https://github.com/alp82/goodwatch-monorepo/blob/9c3f71cbca602f55308f8892d31b35abb9cec15b/goodwatch-webapp/app/routes/privacy.tsx
[gw-help]: https://github.com/alp82/goodwatch-monorepo/blob/9c3f71cbca602f55308f8892d31b35abb9cec15b/goodwatch-webapp/app/ui/connector/ConnectorHelp.tsx
[gw-connect]: https://github.com/alp82/goodwatch-monorepo/blob/9c3f71cbca602f55308f8892d31b35abb9cec15b/goodwatch-webapp/app/routes/connect.tsx
[gw-assets]: https://github.com/alp82/goodwatch-monorepo/tree/9c3f71cbca602f55308f8892d31b35abb9cec15b/goodwatch-webapp/public
[gw-auth-note]: https://github.com/alp82/goodwatch-monorepo/blob/9c3f71cbca602f55308f8892d31b35abb9cec15b/docs/implementation/mcp-authorization.md


## Concrete `/connect` recommendation

The route is a thin, feature-gated wrapper; the content to update is `app/ui/connector/ConnectorHelp.tsx`. It already provides a copyable endpoint, Claude/Claude Code/ChatGPT guides, sample prompts, permissions, disconnection and troubleshooting. Extend that base rather than create a competing setup page. [Route][gw-connect], [help component][gw-help]

Recommended order and behavior:

1. Put **Copy server URL** (`https://goodwatch.app/mcp`) at the top, with “Sign in with your GoodWatch account.” Keep this usable when an app link cannot open. Preserve a clear sign-up link and permission explanation.
2. Lead with **Claude**, since the owner has a working production connection. Until listed, use **Open Claude setup** → `https://claude.ai/customize/connectors` and visible URL-entry instructions. After acceptance, offer the real directory listing's Connect flow plus manual fallback. For mobile, say “Connect on the web, then use the same Claude account on your phone” until the mobile add flow is tested. The support sources establish account-wide remote availability, not a tested GoodWatch mobile setup. [Claude surfaces](https://support.claude.com/en/articles/11725091-when-to-use-desktop-and-web-connectors)
3. Offer **Add to Cursor**, **Add to VS Code**, **Add to Goose**, **Add to LM Studio** using the exact formats above. For LM Studio, GoodWatch's generated proposal is `lmstudio://add_mcp?name=goodwatch&config=eyJ1cmwiOiJodHRwczovL2dvb2R3YXRjaC5hcHAvbWNwIn0%3D`. Pair every button with manual steps. Test each link on supported operating systems before public rollout; a browser protocol prompt or missing desktop app needs a useful fallback. [LM Studio format](https://lmstudio.ai/docs/app/mcp/deeplink)
4. Put **Claude Code**, **Codex**, **Gemini CLI** in a terminal section with two copy actions: add, then authenticate. The commands above connect directly to the hosted endpoint. A local proxy would add installation and token-handling overhead; reserve any proxy workaround for a verified client limitation.
5. Give **ChatGPT** its own dated card using the current/legacy workflows and plan/surface distinctions in the client section. After publication, add the actual reviewed listing URL. Remove mandatory Developer Mode instructions and replace the existing plan-only write-failure diagnosis with scope/consent checks. [Scope enforcement][gw-endpoint]
6. Put the remaining clients under **Other apps**, searchable or in compact accordions, with exact URL/config steps and separate “Tools” / “Poster cards” status. JetBrains should say OAuth unconfirmed; Windsurf/Devin instructions should name the specific product/version. Do not interpret remote transport support as proof of automatic OAuth or Apps.

Use a short **captioned 30–60 second walkthrough** for Claude and ChatGPT, with accessible text steps and 3–5 focused screenshots showing where to click, the canonical URL, GoodWatch consent and a successful response. This is a design recommendation, not a client requirement. Capture genuine results with a safe sample account; directory screenshots have their own rules above. Keep customer setup screenshots separate from cropped Claude directory artwork.

Recommended troubleshooting entries, grounded in the audited endpoint and client behaviors:

| Symptom | Useful explanation / next step |
| --- | --- |
| Cannot find Add custom connector/server | Check client plan, workspace role, admin policy, region and current versus legacy UI. Link that client's official help, with last-checked date. |
| Reads work, changes do not | Check client write support, granted `mcp:write`, and disabled tools. Reconnect from the client with both read/write scopes and choose the intended GoodWatch permission. Do not tell every member to upgrade their plan. |
| Sign-in opens, then callback fails | Update client, use the callback it actually supplies, retain trailing slash where present, check exact issuer and local callback/firewall access. Never ask a member to paste an authorization code or token into support mail. |
| Works once, then expires | Access tokens expire in 5 minutes; client must refresh. Retry sign-in if refresh has been revoked/expired. Client guidance must not ask members to disable server token expiry. |
| Unverified app on consent | DCR identity is not the same as a published CIMD identity. Explain the specific destination/client and allow the member to inspect it; do not promise every supported app is verified. [Consent behavior][gw-consent] |
| Text results but no posters | Host/surface may not implement Apps, rendering tools may be disabled, or a UI resource/CSP failed. Text/structured results remain available. |
| Browser Origin/CORS error | Direct browser connection is currently restricted. Capture the client/origin without secrets; use a supported native/backend path or implement a reviewed narrow CORS allowance. |
| Too many requests | Respect `Retry-After`; endpoint enforces member request limits. |
| Want to disconnect | Link `/settings/connected-apps`; revoke there and remove the entry in the client. [Existing instructions][gw-help] |

Mark client support with **Tested YYYY-MM-DD + version/surface**, **Documented, awaiting test**, or **Unconfirmed**. Avoid a broad “works everywhere” promise. Keep a small maintained source of client instructions and generate buttons from canonical URL/name/config data so encodings do not drift.

## Prioritized action list

Effort is implementation/preparation time for one person, excluding external review waits. These are proposed next tasks, not changes made by this research. An agent can prepare reviewable files and tests; forms, legal identity, account ownership and purchases remain owner work.

| Priority | Action / acceptance condition | Effort | Who |
| --- | --- | --- | --- |
| P0 | Update `/connect` with the four documented desktop install links, CLI copy commands, current ChatGPT path, explicit fallbacks and dated plan notes. No “tested” claim until real auth succeeds. | 0.5–1 day | Agent implements; owner supplies account/surface tests where access is required. |
| P0 | Add display title/description/website and HTTPS PNG icons to server identity. Prepare one canonical metadata/logo kit for all listings; validate image URLs and MIME types. | 2–4 hours | Agent; owner approves brand asset. |
| P0 | Prepare and validate Registry `server.json` for `app.goodwatch/mcp`, with the existing remote URL and no package wrapper. Set up durable Ed25519 proof via DNS or well-known route, then publish and check listing. | 2–4 hours plus proof propagation | Agent prepares/validates; owner controls signing credential/domain and authorizes publication. |
| P0 | Smoke-test Claude hosted + Code, Cursor, VS Code, Goose and LM Studio: fresh OAuth, read, chosen write permission, >5-minute refresh, reconnect/revocation, poster UI when documented. Record client versions and failure causes; avoid real member data. | 1–2 days, can stage by client | Agent exercises accessible clients; owner tests paid/mobile/workspace surfaces. |
| P0 | Resolve DPoP metadata versus bearer-only endpoint mismatch; reproduce with a proof-capable client or protocol harness first. Keep CIMD **and** DCR. Audit write-scope upgrade behavior. | 0.5–1 day investigation/fix | Agent prepares fix and meaningful auth regression checks; owner stages deployment under normal workflow. |
| P1 | Prepare Claude directory listing: permanent owner/slug, icon, privacy/docs/support, three prompt examples, populated password reviewer account and 3–5 cropped poster screenshots. Submit and follow review/Interactive badge status. | 0.5–1 day preparation + external wait | Agent prepares kit; owner chooses account/organization, approves rights and submits. |
| P1 | Prepare OpenAI plugin ZIP, dedicated UI domain/CSP, appropriate tool/security metadata, positive/negative scenarios, recording, reviewer account, Terms/support URLs and domain proof. Run ChatGPT auth/UI tests before submission. | 1–3 days + legal/review wait | Agent prepares package/evidence; owner verifies publisher/project residency, approves legal material, submits and explicitly publishes when approved. |
| P1 | Add narrow CORS only for demonstrated browser-client demand; align endpoint Origin checks, metadata/token CORS and unauthenticated preflight. Confirm this does not alter browser consent POST protections. | 0.5–1 day | Agent investigates/implements against a named host. |
| P2 | Add secondary client guides; test Raycast, Gemini, Codex, Cline/Continue, Zed, Perplexity and Mistral as access permits. Keep JetBrains native OAuth unconfirmed until evidence changes. | 0.5–2 days by client | Agent + owner for account-limited surfaces. |
| P2 | Submit Glama and free mcpservers.org listing; evaluate Smithery proxy/data terms and current costs before linking it. Monitor PulseMCP reopening and GitHub curated onboarding. | 1–3 hours per destination | Agent prepares; owner approves directory accounts/proxy terms. |
| P3 | Consider paid mcp.so promotion, optional server-card experiment, M365 packaging or a Raycast Store extension after core installation paths are measured. | $39 mcp.so; hours to days per integration | Owner decides spend/audience; agent builds only selected integrations. |
| Ongoing | Recheck key clients monthly and after client announcements; replay promoted-client install/refresh tests after auth or UI-resource changes. Track support requests by client, version and failure stage without retaining credentials. | 1–2 hours per review, plus regressions | Named owner/maintainer + agent. |

## Owner questions

1. **Audience order:** prioritize ordinary Claude members, ChatGPT directory users, or technical users? Proposed order: Claude + copyable URL, four desktop buttons, Registry, then OpenAI publication.
2. **Publisher ownership:** which durable paid Claude account/organization and verified OpenAI individual/company should own the listings, and who maintains them? OpenAI also needs an eligible global-residency project.
3. **Submission kit:** who approves public Terms/privacy/support URLs, launch countries, GoodWatch logo and poster-image rights? Can we provision a safe, already verified password reviewer account and capture genuine screenshots/recordings?
4. **Secondary distribution:** should any paid listings be used (mcp.so currently $39), and is Smithery's gateway/proxy model acceptable after its current terms/pricing are checked? Recommended initial budget: no paid community promotion.

## Verification and remaining uncertainty

All evidence is from protocol standards, official client docs/help/changelogs, first-party repositories/metadata and registry operators describing their own service. A vendor support representative's dated Cursor reply is labelled as such; it is not presented as a current feature guarantee. Missing pricing, tier, OAuth or UI evidence is identified explicitly rather than filled from third-party comparisons.

The worktree was created from the fetched main commit, without pulling or editing the main checkout. Only this Markdown file is intended for the branch. Verification for this deliverable checks Markdown/config/deeplink structure, the proposed Registry JSON against the owning schema, cited source availability, and the read-only public metadata/401/preflight probes recorded above. Browser install prompts, authenticated OAuth/refresh, directory submissions/reviews, paid entitlements and real poster rendering remain untested in this research. No application test suite is necessary for a documentation-only commit; historical test reports are linked as historical evidence.

Verification results: **8 JSON examples parsed**, proposed Registry entry passed the downloaded official schema, four generated install payloads decoded to the expected server configuration, and Markdown table/fence/reference checks passed. A supplemental GET check covered **108 unique URLs**: 95 returned 200, 11 returned access-control/bot-check 403 (primary-source content had been inspected through the web research tool where available), the proposed GoodWatch Registry HTTP proof returned 404, and the VS Code redirect returned expected 400 without an OAuth request. Login-only portals were not inspected beyond public docs; URL reachability does not certify their flows.
