# Isolated server metadata patch

Base: `da327cf45e6884b38b1fe9b4be5420a37d8d3efd` (`origin/main` when prepared). [Patch](../../../scripts/claude-directory/server-metadata.patch).

This patch adds human-readable annotation titles and uses focused factual tool descriptions. It preserves the base revision's production batch implementation and all execution/authentication code. It does not copy the dirty shared checkout or revert newer production work. The existing production server instructions are preserved.

`git apply --check` passed against exact files from that revision. The working-source equivalent passed all 69 MCP tests. Before release, apply this patch to a clean checkout of the intended release revision, inspect conflicts if the base changed, and rerun its MCP suite. Deploy through the existing pipeline, reconnect the portal review connection and confirm the 25 annotation suggestions disappear. Do not mark compliance complete before revalidation. The isolated patch was subsequently deployed with explicit owner authorization; the dirty shared checkout was not deployed.

## Authorized release

Owner authorized deployment on 2026-10-20. Prepared and pushed isolated commit `5140bcc4` to `main` from a clean worktree. The final patch retains current batch behavior and documentation. All **91** MCP tests in that release checkout pass. Coolify page deployment and both rolling search roles are healthy on the exact commit. Fresh Inspector discovery confirmed all 25 annotation titles and an authenticated read. Both search smoke suites passed 31 checks each. The portal now reports zero missing-title suggestions after Refresh tools list and reloading the draft. Directory submission/publication remain unauthorized. See [deployment evidence](deployment.json).

## MCP App compatibility follow-up

Hosted tests exposed eight rendering failures. The resource supplied the GoodWatch website as `ui.domain`, but MCP Apps sandbox domains are host-specific. Since the app has no API calls or CORS allowlist, release `5faa8365` omits the optional override, preserves ChatGPT's legacy `openai/widgetDomain`, and bumps the resource to `posters-v4.html` to invalidate host caches. [Official MCP Apps CSP/CORS guidance](https://github.com/modelcontextprotocol/ext-apps/blob/main/docs/csp-cors.md) explains the host-specific setting. The shared batch descriptions now describe their own reversible-batch identifier without instructions about another tool.

All 91 MCP tests passed; production image build and both rolling MCP instances completed. Both MCP smoke suites passed 31 checks. Fresh Inspector read the v4 resource and verified the metadata. All eight real hosted App renders passed after Refresh tools list, full browser-tab reload and a new conversation. A pre-existing tab kept v3 tool metadata until reloaded; this cache behavior is recorded, not counted as a successful old-session render. No listing was submitted.
