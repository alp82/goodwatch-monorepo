# Production MCP follow-ups, 2026-10-17

## Claude.ai write discovery

Production's anonymous `POST /mcp` returned HTTP 401 with `scope="mcp:read"` and the correct resource-metadata URL. Protected-resource metadata already advertised both `mcp:read` and `mcp:write`. A read-only audit of the encrypted production auth records found:

- Claude's CIMD client allowed `openid profile email mcp:read mcp:write offline_access`.
- Its consent and refresh token held only `mcp:read offline_access`.
- The consent action accepted the complete signed scope request, without a subset choice, so these were the scopes requested by Claude, not scopes dropped by issuance.

[MCP scope selection](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization#scope-selection-strategy) prioritizes a challenge's scope over resource metadata. The server now omits scope guidance on invalid/missing-token 401 responses so clients discover both supported resource scopes. Verified read tokens still pass the read gate. Missing read scope and forced write calls retain HTTP 403 scope challenges; all existing write scope, policy, action-ID, retry and host-approval rules in [write tools](mcp-write-tools.md) remain.

When write is requested, consent offers **Read-only** (default) and **Read and change my GoodWatch**. The action passes only a subset of the signed request to Better Auth's supported partial-consent `scope` parameter. It cannot elevate a read request. Both access and refreshed tokens preserve the selected scopes. Existing read-only grants do not gain write permission by refresh: disconnect and reconnect to approve write access.

## Links and search wording

Existing shared title summaries already contain canonical GoodWatch `url` values, including ambiguity choices, receipts and cached search rows. Every read list now adds `page_url`; instructions in initialization and every tool description ask the client to link each title and end lists with **See it on GoodWatch:** and that page link.

| Tool/view | Existing destination |
| --- | --- |
| Name search / smarter match | `/discover?q=<encoded query>` (or `/discover` for an empty query) |
| Wishlist | `/my-library` (the member Wishlist destination) |
| Library Seen/Watching/On hold/Dropped/Not rated | `/my-library?status=seen/watching/on_hold/dropped/unrated` |
| Not interested | `/settings/hidden` |
| All library / rated only | My library / Seen, with `page_note` explaining the broader view |
| My shows | `/my-shows` |
| Tonight | `/?tv=tonight` |
| Taste | `/taste` |

Discover uses the website's search and filters; a `page_note` explicitly says its results can differ from the MCP lookup. Search snapshots preserve the query for cursor-only page links, encrypted with AES-256-GCM under the existing search storage key and authenticated to the member namespace and snapshot ID. No raw query is added to Valkey snapshots. Old snapshots remain readable for their existing 15-minute lifetime; callers can repeat their original query with old cursors to retain that query's link.

Owner decision Q50: `search_titles` appears as **Search titles by name**. Tool descriptions and result messages call the optional mode a **smarter match for descriptive queries**. The `ranked` argument, ranking, quotas, cache lifetimes, admission and result order remain intact.

Every destination above was checked against production HTTP responses and the route's query/status parser. Arrival and Game of Thrones detail URLs answered HTTP 200 with the correct titles. All destination pages answered HTTP 200 with their expected page titles; private member rows require the member's own signed-in browser. `/search?q=Arrival` redirected to `/discover?q=Arrival`; the `/wishlist` loader sends signed-in members to `/my-library` (anonymous requests go to `/watch-next`).

## Owner's Claude.ai retest

1. In GoodWatch, open Settings → Connected apps (`/settings/connected-apps`) and disconnect the existing Claude grant. In Claude.ai, disconnect/remove the existing GoodWatch connector connection.
2. Connect GoodWatch again using `https://goodwatch.app/mcp`. Sign in to GoodWatch if needed. Choose **Read and change my GoodWatch** and then **Allow Claude** on the consent page.
3. Inspect Claude's tool list: expect 14 tools, including **Set Want to See**, plus **Search titles by name**.
4. Ask “Find Arrival (2016) by name and add it to my Wishlist.” Approve the write if Claude prompts. Verify Arrival in GoodWatch My library's Want to see view. Remove it afterward if it was only a test.
5. Ask for Wishlist, My shows, tonight's pick, Taste, and a name search. Check linked title names and the final **See it on GoodWatch** page link. Descriptive queries can explicitly request a smarter match.
6. To check the read-only choice, disconnect and reconnect again, select **Read-only**, and expect seven read tools. Claude must be unable to add a title. Reconnect once more with Read and change if writes are wanted.

Hosted Claude.ai permission refresh, approval prompts and answer formatting still require this owner retest; automated OAuth tests and model instructions cannot prove host behavior.

## Verification

- `npm ci` completed in the isolated webapp worktree. The conformance test package was also installed with `npm ci --ignore-scripts` for the auth runner.
- MCP unit tests: 19 passed. The broader endpoint/cache/metrics/tracking/watch-log/show-tracking/auth-loading run: 254 passed, one existing tracking TODO, zero failures.
- `npm run test:auth:mcp`: 38 passed, including actual consent loader/action, access-token verification and refresh with read/write choices and refused escalation. The auth typecheck passed.
- Real local CrateDB/Valkey probes passed: read, write, receipt replay in a fresh process, smarter-match quota/cache/paging/live TTLs and the native search/budget fixture.
- `npm run build` passed. Whole-app `npm run typecheck` reports the same 177 pre-existing diagnostics as an archived `origin/main` checked with the same installed dependencies; no new diagnostics.
- Public route probes passed. Hosted Claude.ai still needs the owner retest above.
