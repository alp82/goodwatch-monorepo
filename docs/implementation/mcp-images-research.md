# Posters and images in GoodWatch MCP answers

Researched **2026-10-17**, against `origin/main` at `25ff2553`. Recommendation for review; no production change.

## Decision

Add an **optional MCP Apps poster grid** to existing read tools. Keep the current title links and structured results for every client. A widget appears alongside the conversation; ordinary tool image content does not reliably become an image in the assistant's prose. Start with posters; add a single OG preview for title details later if useful. The open standard covers Claude and ChatGPT without requiring a ChatGPT-specific UI implementation. [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview)

## What clients support today

“Model can see an image”, “person can expand a tool preview”, and “image appears in the answer” are different capabilities. The core protocol supports base64 `image` blocks, embedded `resource` blocks with image blobs, and `resource_link` references. It does **not** prescribe their presentation. A resource link supplies a URI, not image bytes or an instruction to render inline. [Current MCP tools specification, 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)

| Client | Direct tool `image` block | Embedded image resource / `resource_link` | MCP Apps widget |
| --- | --- | --- | --- |
| Claude.ai web | Firsthand April reproduction: image visible in collapsed tool accordion, absent from final answer. **Reported behavior**, not a current vendor guarantee. [Report](https://github.com/anthropics/anthropic-sdk-python/issues/1329) | No current vendor guarantee found for automatic fetching, preview or answer placement of either format. Do not infer support from direct image blocks. | **Supported**, inline conversation cards and fullscreen. [Claude help](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude) |
| Claude Desktop chat | Firsthand July reproduction: human-visible collapsed tool preview, with separate model-vision problems. No guaranteed final-answer gallery. [Report](https://github.com/anthropics/claude-ai-mcp/issues/643) | Same independent evidence gap for both formats. | **Supported**. [Claude help](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude) |
| Claude Code CLI | PNG/JPEG/GIF/WebP passed to the **model**; original bytes also saved from v2.1.283. This does not promise a visible terminal poster gallery. [Docs](https://code.claude.com/docs/en/mcp#images-in-tool-results) | Resources can be attached; no documented image-gallery placement for embedded blobs or links. MCP App resources are hidden from resource suggestions/listing. [Docs](https://code.claude.com/docs/en/mcp#use-mcp-resources) | No documented CLI widget renderer found; use text fallback. |
| ChatGPT custom connectors/apps | No current official promise found that generic MCP image blocks become answer images. Do not make image-only results the product contract. | No current official promise found of automatic poster galleries from either format. | **Supported** through MCP Apps / Apps SDK. Components render alongside chat in an iframe. [OpenAI UI guide](https://developers.openai.com/plugins/build/chatgpt-ui) |

**External Markdown images in Claude.ai:** treat `![poster](https://…)` as unsupported/unreliable. The April reporter explicitly tried external URLs and found no inline rendering. No current Anthropic document establishing a blanket URL-image block was found, and this research did not perform a signed-in retest; calling it “confirmed blocked today” would overstate the evidence. Normal Markdown title links remain the fallback. [Firsthand reproduction in Anthropic's tracker](https://github.com/anthropics/anthropic-sdk-python/issues/1329)

## MCP Apps status and declaration

MCP Apps shipped as an official extension on **2026-01-26**. Claude's **2026-08-11** help article lists interactive connectors for all users on web, Cowork, Desktop and **iOS/Android**; older “mobile coming soon” descriptions are obsolete. OpenAI's changelog records **full MCP Apps compatibility on 2026-02-22**, followed by lifecycle and host-style updates in May. Host support does not establish custom connector eligibility on every account. [MCP launch](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/), [Claude availability](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude), [OpenAI changelog](https://developers.openai.com/plugins/changelog)

Minimum server contract:

```js
// Tool descriptor; keep the tool's normal input and output contract.
_meta: { ui: { resourceUri: "ui://goodwatch/posters-v1.html" } }

// resources/read response for that URI:
{
  contents: [{
    uri: "ui://goodwatch/posters-v1.html",
    mimeType: "text/html;profile=mcp-app",
    text: "<!doctype html>…bundled widget…",
    _meta: { ui: { csp: {
      resourceDomains: ["https://image.tmdb.org", "https://goodwatch.app"],
      connectDomains: []
    } } }
  }]
}
```

Use `registerAppTool` / `registerAppResource` from `@modelcontextprotocol/ext-apps/server`, or register equivalent metadata with the current SDK. Hosts advertise `extensions["io.modelcontextprotocol/ui"]` and supported MIME types during initialization; use `getUiCapability` to tailor UI metadata. Unsupported clients still call the same tool and receive `content` plus `structuredContent`. [MCP Apps specification: discovery, negotiation and fallback](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)

The widget registers `App.ontoolresult` before `App.connect()` and renders the returned data. Use the standard bridge first. ChatGPT accepts `openai/outputTemplate` as a compatibility alias for `ui.resourceUri`; its `window.openai` additions are optional. Preserve essential data in text/structured output; result `_meta` is useful for UI-only hydration, not essential facts. Version the UI URI when changing its contract. [OpenAI server guide](https://developers.openai.com/plugins/build/mcp-server), [OpenAI metadata reference](https://developers.openai.com/plugins/reference)

### Security, cost and practical limits

The host controls a sandboxed iframe, isolated from the parent DOM and cookies, with audited JSON-RPC communication. `resourceDomains` permits image/script/style/font/media origins; `connectDomains` permits fetch/XHR/WebSocket destinations. Nested frames are separately controlled and unnecessary here. No camera, microphone or other permissions are needed. [MCP security overview](https://modelcontextprotocol.io/extensions/apps/overview), [CSP API](https://apps.extensions.modelcontextprotocol.io/api/interfaces/app.McpUiResourceCsp.html)

Use a bundled script, safe DOM text insertion, validated GoodWatch title URLs, host-mediated `app.openLink`, and `referrerpolicy="no-referrer"` on posters. Anthropic's implementation guidance records external-image CSP/referrer failures, so test the exact origins in real hosts. If necessary, consider bounded, cached thumbnails as data URLs in UI-only result metadata; this adds server fetching and response bytes. Never put OAuth tokens or member-specific identifiers in image URLs. Public images can expose a viewer's IP/request to their CDN. [Anthropic sandbox guidance](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/mcp-server-dev/skills/build-mcp-app/references/iframe-sandbox.md)

No portable HTML-size ceiling or rendering-latency SLA was found. Budget for `resources/read`, iframe/bridge startup and parallel image downloads; hosts may preload templates. The spike's bundled HTML is **446,723 bytes** (**97,664 bytes gzip**, potential compression, not measured transport compression); its two `w185` posters total **35,712 bytes**. These are fixture measurements, not production bounds. URL images loaded by the iframe avoid sending poster pixels to the model; text/structured data still occupies context. Base64 image blocks add roughly one-third to binary transfer size and may also incur vision processing. [MCP loading lifecycle](https://apps.extensions.modelcontextprotocol.io/api/documents/overview.html)

## Minimal GoodWatch implementation

The existing [`tools.server.ts`](../../goodwatch-webapp/app/server/mcp/tools.server.ts) already returns text JSON plus `structuredContent`; [`links.ts`](../../goodwatch-webapp/app/server/mcp/links.ts) requires verbatim title links and `page_url`. Keep both. [`data.server.ts`](../../goodwatch-webapp/app/server/mcp/data.server.ts)'s `CatalogTitle` / `summary` currently omit posters, and name-search SQL does not select `poster_path`. Catalog availability of posters alone is insufficient: thread them through name search, ranked search and member-list hydration in batches, using [`tmdb-image.ts`](../../goodwatch-webapp/app/utils/tmdb-image.ts).

- **Presentation:** Reuse one resource for `search_titles`, `get_library` and `get_tonight`; optionally `get_title`. Render six cards initially, with title/year links, existing score/status/availability evidence where supplied, missing-image labels and an explicit GoodWatch page link. Preserve all returned results; expand further cards locally. Do not silently reduce the existing search limit of 40. `get_tonight` remains one pick, including its next-episode context; a widget must not invent extra recommendations.
- **Payload:** Add nullable `poster_url` to existing summaries and declare an output schema. Keep IDs, names, years, `url`, `link`, evidence and paging in model-visible data. Start with `w185`/`w342`, not full-size images. Avoid extra per-title `get_title` calls, write controls, new auth flows or a separate rendering-tool call in the first version.
- **OG later:** A single wide preview can use the established OG path. Current [`og-image-route.server.ts`](../../goodwatch-webapp/app/server/og-image/og-image-route.server.ts) serves JPEG even for legacy `.png` URLs; prefer `.jpg` and respect `Content-Type`. OG rendering can return a generic fallback under load. Posters suit comparison grids better than multiple 1200×630 cards.

Example no-UI answer, using the same returned links and evidence:

```text
- [The Matrix (1999)](https://goodwatch.app/movie/603-the-matrix)
- [Inception (2010)](https://goodwatch.app/movie/27205-inception)
See it on GoodWatch: [Discover](https://goodwatch.app/discover)
```

**Rough effort, engineering estimate:** Half to one day for shared poster fields, schemas and UI resource wiring; half to one day for the grid, states, links and sizing; half to one day for hosted Claude/ChatGPT checks and no-UI regression checks. Allow **2–3 days** overall, excluding account access, connector review or distribution. Tradeoff: a maintained HTML/JS surface and client testing buy predictable visual layout; raw image blocks are simpler but do not meet the inline-gallery requirement reliably.

## Local spike and evidence

[`mcp-images-spike/`](mcp-images-spike/README.md) is an isolated fixture MCP server, with its own dependencies and no app imports, OAuth, database or member data. It uses GoodWatch's server SDK **2.3.1** and ext-apps **2.0.3**. In the maintainers' [basic-host](https://github.com/modelcontextprotocol/ext-apps/tree/82221c0c8ce7661efa6771c9d461511b1650495f/examples/basic-host), Chromium rendered both external posters under declared CSP, opened a title through the host bridge, and retained its label after an image failed. A client advertising no UI capability received both text links and structured data. The [screenshot](mcp-images-spike/reference-host.png) is the **local reference host**, not Claude or ChatGPT.

Build and probe passed on Node **24.15.0**, Playwright **1.55.0**. Signed-in Claude web/Desktop/mobile and ChatGPT rendering, GoodWatch OAuth within those widgets, OG loading, six-card/mobile layout and production performance remain **unverified**. No deployment or production application code changed.

## Owner questions

1. Approve posters first on search/My library/Watch next, with OG previews deferred?
2. Is a card alongside the conversation sufficient, or must images appear inside the assistant's prose? The latter is not a reliable MCP server contract.
3. Can the owner/orchestrator arrange a signed-in check on Claude and the intended ChatGPT account before production work? Check custom-connector eligibility, image domains, link opening and actual placement.
