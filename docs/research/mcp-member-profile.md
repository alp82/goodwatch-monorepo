# GoodWatch MCP: members managing their profile from an AI assistant

Research date: 2026-10-14. Status: exploration and recommendations, not an approved implementation plan. Picks up the TODO note "goodwatch MCP, skills, etc." (`TODO.md`), which the [backlog reconciliation](roadmap-backlog-reconciliation.md) left unresolved for want of "the external user journey and interface".

Two research passes produced this. One mapped the webapp code (read-only). The other read the MCP specification, client documentation, npm and the wider market. Claude's connector documentation and npm versions were read first-hand. Points about OpenAI, Chrome and the WebMCP draft rest on search summaries and are marked **(unverified)**.

## Summary

1. **The idea is viable and nobody has built it.** Every movie or TV MCP server found is a community project that runs locally with one person's API key: Trakt (three servers, one exposing all 334 endpoints as tools), TMDB, JustWatch over an unofficial API, Letterboxd by scraping with the member's password, and Plex/Jellyfin. None is hosted, signed in with OAuth and combines tracking with availability on the person's services. Neither Claude's connector directory nor ChatGPT's app directory lists Trakt, Letterboxd, JustWatch, IMDb or Netflix (absence not fully confirmed). Both directories already carry consumer brands such as Spotify, Tripadvisor and Audible.
2. **The domain logic is already reusable.** The `api.*` routes are thin wrappers over `app/server/*.server.ts` functions keyed by user id. Those writers already handle `canonicalTitleId`, cache resets and `markTasteChanged`. An MCP tool can call the same functions the routes call.
3. **The real work is authorization, not tools.** Members sign in with Supabase cookies only. Nothing accepts a bearer token, and GoodWatch issues no tokens to third parties. A remote MCP server needs OAuth 2.1 with PKCE, protected resource metadata, and CIMD or DCR client registration (details below).
4. **Two webapp constraints shape the tools.** Ranked search (combined search) runs only on the search-role processes and spends a paid model budget. Tracking, Watch next, My library, New episodes and the taste portrait sit behind `REC_*` feature flags.
5. **WebMCP is not a viable alternative today, only a cheap later add-on.** It ships in no stable browser, no production agent calls it yet, and it only works while a GoodWatch tab is open. It never reaches Claude.ai, ChatGPT or mobile.

## What a member could do

The jobs, in GoodWatch's own vocabulary (see `CONTEXT.md`):

| Job | Example prompt |
| --- | --- |
| Log watches | "I watched episodes 3–5 of Severance season 2 last night" / "I saw Dune Part Two on Saturday, 8/10" |
| Ask where they are in a show | "Where am I in The Bear?" → show status, Next episode, how many are left |
| Choose tonight | "Something funny under 100 minutes on my services" → Tonight's pick, Watch next, moods, On my services |
| Manage Wishlist | "Add Shōgun to my Wishlist", "What's on my Wishlist that's on Netflix?" |
| Rate and dismiss | Rate titles; mark Not interested; drop a show or put it On hold |
| Find and learn | "What's that show about the chef in Chicago?" → search, title details, availability in their country |
| Understand their taste | "What do I like?" → Sides of you, You vs everyone, taste match for a named title |
| Keep up | "Any new episodes?" → New episodes signal, Newly available |
| Settings | "I cancelled Disney+, I'm in Germany now" → country and services |

The assistant also brings things the website does not have: free-text logging of several things at once, comparing their taste with a friend's list pasted into the chat, and planning across sessions ("we have 3 evenings this week").

## Proposed tool set

About 15 task-shaped tools, not a copy of the API. Claude's directory review rejects a catch-all tool with a `method` parameter and requires read and write tools to be separate. Every tool needs a `title` plus `readOnlyHint` or `destructiveHint`. Read-only tools run without asking; destructive ones always prompt.

| Tool | Kind | Backed by |
| --- | --- | --- |
| `search_titles` | read | see [Search](#search) |
| `get_title` | read | `getDetailsForMovie` / `getDetailsForShow` (`details.server.ts`) and `getAvailabilityEvidenceBatch` + `evaluateAvailability` for the member's country and services; taste match via `loadTaste` |
| `get_my_shows` | read | `getMyShows` (`my-shows.server.ts`): Continue, Pick up, Waiting for episodes, shows to start |
| `get_show_progress` | read | `getShowTrackingPage` (`show-tracking.server.ts`) |
| `get_tonight` | read | `getTonightsPick`, `getWatchNext` with moods, runtime and On my services |
| `get_library` | read | `getLibraryPage(userId, choice, offset)`: Want to see, Seen, Watching, On hold, Dropped, Not rated |
| `get_new` | read | `getNewShows`, newly available |
| `get_taste` | read | `getTastePortrait`, `taste-profile.server.ts` |
| `recommend` | read | `getDiscoverResults` with For you, or `getUserRecommendations` |
| `log_watch` | write | movies: `applyWatchLogAction` (watch, with a date when known); shows: `applyShowTrackingAction` (watch, markEpisodes, watchUpTo, markSeason) |
| `rate_title` | write | `updateScores` |
| `set_want_to_see` | write (add/remove) | `updateWishList` |
| `set_not_interested` | write | `updateNotInterested` |
| `set_show_status` | write | `applyShowTrackingAction`: hold, drop, resume, watchAgain, pressSeen |
| `undo_watch` | **destructive** | `applyWatchLogAction` delete / show unwatch, unmarkSeason, deleteWatch |
| `set_my_services` | write | `setUserSettings` (`country_default`, `streaming_providers_default`) |

Design notes:

- **IDs.** Return one stable form, e.g. `movie:603` / `show:1399` (GoodWatch's own `MediaKey` is `movie-603`). Accept titles too, but resolve them through search and ask the member when the match is ambiguous. Never return `tv`; the media type is `show`.
- **Idempotency is already built in.** The tracking writer takes an `actionId` for watch, pressSeen, markSeason, markEpisodes and watchUpTo (`show-tracking.server.ts:336`), so a retried tool call records once. The MCP layer should derive the `actionId` from the request id.
- **Episode presentation.** `markEpisodes` / `unmarkEpisodes` need a `presentationVersion` (ADR 0012). `log_watch` should take season and episode numbers and resolve them server-side, so the model never handles presentation versions.
- **Watches keep their meaning.** A watch never gets a date nobody recorded (ADR 0008). "Last night" becomes a date only when the member said so; otherwise the watch has no date.
- **Output.** Compact `structuredContent` plus a one-line text summary. Cursor pagination, default limit around 20. Include the GoodWatch URL of each title so the member can open it.
- **Untrusted text.** Reviews, share-list names and the TMDB overview can carry prompt injection. Label or truncate them, and never put them in tool descriptions.
- **Feature flags.** Each tool calls `isEnabled(feature, {userId})` exactly as its route does. A flagged-off tool should be hidden from the member's tool list, not fail when called.

## What exists in the webapp

| Area | State | File |
| --- | --- | --- |
| Sign-in | Supabase Auth with email/password and Google. The session is the `sb-<ref>-auth-token` cookie, resolved by `resolveSession` (Cookie header only, never `Authorization`). The project signs with HS256, so every check calls the auth server (`docs/member-session.md`). | `app/utils/auth-session.ts`, `app/utils/auth.ts` |
| Tokens for third parties | None: no API keys, personal tokens or OAuth server. The only bearer check is an internal shared secret. | `routes/api.internal.homepage-warmup.ts` |
| Member data | CrateDB tables `user_score`, `user_wishlist`, `user_watch_log`, `user_watch_state`, `user_not_interested`, `user_setting` and others | `utils/crate.ts` |
| Consistency after a write | The writers already reset the member-data cache and mark taste changed. An open browser tab refetches within a minute or when it becomes visible again. | `docs/member-data-cache.md` |
| Validation | zod 3.25 in the newer routes; the older `update-*` routes do none | — |
| Rate limiting | None general. Valkey counters exist for search and poster impressions. | — |
| Server telemetry | Sentry and Prometheus; PostHog in the browser only | `app/server/metrics/*` |
| MCP dependencies | None | `package.json` |

### Search

Combined search (`api.combined-search.ts` → `combinedSearch`) runs only where `runsSearch()` is true (`server/role.server.ts:21`). The proxy sends `/api/combined-search` to the search-role processes. Search admits at most four requests at once and may spend the paid model budget. Options for `search_titles`:

- **(a)** Recommended first step: call the internal search role over HTTP from the MCP handler, with its own admission slot and a per-member quota. Results then match the website.
- **(b)** Use `getPaletteTitles` (prefix search, with a TMDB fallback on page instances). It is cheap and good enough for resolving "add Shōgun" to an id, but weak for descriptive queries.

A sensible split: `log_watch`, `rate_title` and the other writes resolve names with (b), and `search_titles` uses (a).

## Authorization

What Claude requires from a remote connector (from Claude's own [authentication doc](https://claude.com/docs/connectors/building/authentication.md)), consistent with MCP spec 2026-07-28:

- Streamable HTTP over HTTPS. An unauthenticated request gets a 401 with `WWW-Authenticate: Bearer resource_metadata=…`.
- `/.well-known/oauth-protected-resource` (RFC 9728) whose `resource` equals the connector URL exactly. Claude reads only the first `authorization_servers` entry.
- Authorization server metadata (RFC 8414), S256 PKCE, and a form-encoded token endpoint that answers within 10 seconds and rotates refresh tokens.
- **Client registration.** CIMD is the method the spec now recommends; DCR is deprecated but still used by many clients. Claude uses CIMD only when the metadata says `client_id_metadata_document_supported: true` and lists `none` among the token endpoint auth methods. GoodWatch should support both.
- Allowed redirects: `https://claude.ai/api/mcp/auth_callback`, plus loopback on any port for Claude Code, VS Code and Cursor. ChatGPT has its own callback **(unverified)**.
- The server validates audience, issuer, expiry and scope on every call. Suggested scopes: `goodwatch:read`, `goodwatch:write`, `offline_access`.

Options for the authorization server:

| Option | Fit | Notes |
| --- | --- | --- |
| **Supabase OAuth 2.1 Server** | Best on paper: members already live in Supabase, so the sign-in pages and accounts stay as they are | DCR is opt-in; CIMD support is **unconfirmed**. GoodWatch still provides the consent page. Tokens are Supabase JWTs, so moving the project to asymmetric keys (already suggested in `docs/member-session.md`) lets `/mcp` verify locally instead of calling the auth server on every tool call. **Verify first.** |
| Self-built on the Remix app (e.g. `oidc-provider`, or Better Auth's `oauth-provider` + `cimd` plugins in front of Supabase sign-in) | Full control; supports CIMD and DCR today | More code and more security surface: token storage, rotation, revocation |
| Hosted (WorkOS AuthKit, Clerk) | Both support CIMD and DCR | A second identity system bridged to Supabase users; cost per active user |

Whichever is chosen, GoodWatch also needs a **Connected apps** section in Settings for revoking access, a consent screen that shows the client name and redirect host, and a per-member audit of MCP writes.

## Where it runs

A resource route `app/routes/mcp.ts` (loader for GET, action for POST) inside the existing webapp image. Points to settle:

- **SDK.** `@modelcontextprotocol/server` 2.x (2.3.1 on npm; 2.0 shipped with spec 2026-07-28) has a web-standard handler that fits Remix's `Request`/`Response`. The v1 package `@modelcontextprotocol/sdk` 1.32 is still maintained. v2 expects Standard Schema validators such as Zod 4, while the webapp is on Zod 3.25; check whether 3.25's bundled `zod/v4` is enough.
- **Stateless.** Spec 2026-07-28 dropped `Mcp-Session-Id` and the initialize handshake, which suits two page instances behind Traefik with no sticky routing for bearer requests. Clients on 2025-11-25 will be around for a while; let the SDK negotiate the version.
- **Streaming.** Set `Cache-Control: no-transform` on streamed responses. remix-serve's compression otherwise holds them back (as in `api.combined-search.ts`).
- **Proxy.** Route `/mcp` and `/.well-known/oauth-*` to the page instances and keep them out of the page cache. `/api/` is already never cached; `/mcp` needs the same rule.
- **Limits.** A per-member Valkey counter, like the ones for search and poster impressions. Server-side metrics per tool through the existing Prometheus labels.

## WebMCP

WebMCP lets a web page register tools that an in-browser agent can call. It works either imperatively in JavaScript or declaratively with `toolname` / `tooldescription` attributes on forms. Its status:

- **Spec.** A W3C Web Machine Learning Community Group draft, not a standard. The entry point reportedly moved from `navigator.modelContext` to `document.modelContext` around July 2026 **(unverified)**.
- **Browsers.** A Chrome origin trial from M149 to M156; Edge behind a flag; nothing from Firefox or Safari. Not in stable anywhere.
- **Agents.** None confirmed in production. Google said at I/O 2026 that Gemini in Chrome *will* use it. Claude in Chrome and Copilot read the page instead.
- **Auth.** Free: tools run in the page with the member's cookie session, so no OAuth is needed. This is the one thing WebMCP does better than a remote server.
- **Limits.** It needs an open GoodWatch tab, so it never reaches Claude.ai, ChatGPT, mobile apps or "while I'm on the sofa". Human confirmation in the browser is still unsettled in the draft.

**Verdict.** Not an alternative to the remote server; at most a small complement. Once Gemini in Chrome actually calls it, adding declarative attributes to the rating, Want to See and search forms is cheap. Note that GoodWatch's writes are mostly `fetch` calls, not native forms, so the declarative API covers less than it seems; the imperative API would call the same `/api/*` routes the page uses. Revisit when one agent ships it in stable.

## Recommended path

1. **Spike, about one or two days.** `/mcp` with read-only tools (`get_my_shows`, `get_title`, `get_library`, `get_tonight`). For the spike only, accept a Supabase access token as a bearer token (a new `resolveBearer` beside `resolveSession`), copied by hand from a dev session. This tests tool shape and output size in Claude Code and the MCP Inspector before any OAuth work.
2. **Verify Supabase's OAuth 2.1 server**: DCR, CIMD, the consent page, and whether its tokens can be audience-bound to `https://goodwatch.app/mcp`. This decides between Supabase and self-built in the table above.
3. **OAuth and writes.** Add the metadata routes, the consent page and Connected apps, then the write tools (`log_watch`, `rate_title`, `set_want_to_see`, `set_show_status`, `set_not_interested`), with `destructiveHint` on undo and removal.
4. **Search** through the search role, with a per-member quota.
5. **Distribution.** Submit to Claude's connector directory (needs OAuth, annotations, a documentation page, the privacy policy updated for MCP clients, and a populated test account) and to ChatGPT's apps (needs a verified developer account; ChatGPT plan rules for write actions are **unverified**). Also publish to the MCP Registry. Any client that accepts a URL works without listing: Claude custom connectors (Free accounts get one), VS Code, Cursor, Gemini CLI, Claude Code.
6. **Later.** An MCP App (`io.modelcontextprotocol/ui`, stable since 2026-01) that renders poster cards or the episode list inline in Claude and ChatGPT. A WebMCP experiment once an agent calls it.

## Open decisions

- Which authorization server to use (step 2).
- Whether MCP access follows the `REC_*` preview lists, i.e. only preview members at first.
- Whether `search_titles` may spend the paid search budget, and the quota per member.
- Whether the assistant may write without confirmation. The suggestion is: idempotent additive writes (log a watch, rate, Want to See) run directly; removals and undo always confirm.
- The GoodWatch name and positioning in the directories ("track and choose what to watch on your services").

## Sources

- MCP specification 2026-07-28 [changelog](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/changelog.mdx); summaries by [WorkOS](https://workos.com/blog/mcp-2026-spec-agent-authentication) and [SSOJet](https://ssojet.com/blog/mcp-authorization-spec-2026-07-28-what-changed)
- Claude connectors: [authentication](https://claude.com/docs/connectors/building/authentication.md), [review criteria](https://claude.com/docs/connectors/building/review-criteria.md), [submission](https://claude.com/docs/connectors/building/submission.md), [custom connectors](https://claude.com/docs/connectors/custom/add-unlisted.md), [consumer connectors announcement](https://claude.com/it/blog/connectors-for-everyday-life)
- Anthropic, [Writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [TypeScript SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/); versions checked against the npm registry on 2026-10-14
- Auth providers: [Supabase OAuth server for MCP](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication), [Better Auth CIMD](https://better-auth.com/docs/plugins/cimd), [Clerk CIMD GA](https://clerk.com/changelog/2026-09-17-client-id-metadata-documents-ga), [WorkOS AuthKit MCP](https://workos.com/docs/authkit/mcp.md)
- OpenAI [Apps SDK auth](https://developers.openai.com/apps-sdk/build/auth) **(unverified)**; [app submissions](https://venturebeat.com/technology/openai-now-accepting-chatgpt-app-submissions-from-third-party-devs-launches)
- Existing servers: [wwiens/trakt_mcpserver](https://glama.ai/mcp/servers/wwiens/trakt_mcpserver), [kud/mcp-trakt](https://glama.ai/mcp/servers/kud/mcp-trakt), [rollecode/trakt-mcp](https://github.com/rollecode/trakt-mcp), [Letterboxd MCP](https://conare.ai/marketplace/mcp/letterboxd-mcp), [JustWatch MCP](https://glama.ai/mcp/servers/gefnnw438j), [TMDB MCP](https://glama.ai/mcp/servers/v1anitvzk1)
- WebMCP: [declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api), [secure tools](https://developer.chrome.com/docs/ai/webmcp/secure-tools), [origin trial](https://groups.google.com/a/chromium.org/g/blink-dev/c/gmYffo5WOE8/m/OJxuQRP3AAAJ), [Chrome at I/O 2026](https://developer.chrome.com/blog/chrome-at-io26), [ecosystem tracker](https://webmcp.com/ecosystem-tracker), [State of WebMCP, July 2026](https://www.spronta.com/blog/state-of-webmcp-july-2026/)
