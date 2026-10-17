# Owner retest fixes, 2026-10-17

## Write permissions

The production failure at 08:07 UTC was CrateDB `MissingPrivilegeException`, code `4011`, HTTP 401: `Missing 'DML' privilege for user 'goodwatch_search'`. The search roles could SELECT receipts but could not INSERT them. A zero-row INSERT reproduced this under the deployed identity without creating a row. The actual local MCP endpoint reproduced the exact `Could not record this action. No change was started.` result with the same DQL-only identity.

At 08:13:26 UTC an administrator (`crate`, trusted loopback inside crate-01) applied [mcp-write-tools-grants.sql](mcp-write-tools-grants.sql). It grants only DML on these existing tables:

| Tables | Native write paths |
| --- | --- |
| `doc.user_mcp_action` | Claims and completed receipts for all seven tools |
| `doc.user_wishlist`, `doc.user_not_interested` | Want to See/Not interested setters and native watch/rating/show transitions |
| `doc.user_score` | Ratings and native score-owned watch settlement |
| `doc.user_watch_log`, `doc.user_watch_state` | Movie/episode watches, status changes, rating settlement and Remove a watch |
| `doc.user_setting` | Country/media preferences and streaming services |

Existing `DQL ON SCHEMA doc` covers catalog/member readers and the native refresh operations. No DML was added for Favorite, Skip, imports, catalog, or any auth table. No schema DML, DDL or role membership was granted. The audit found no blocking member-table DENY from cut-over step 1.4. All **135** auth privilege entries remained byte-for-byte identical in the sorted before/after comparison; the [grant evidence](mcp-write-grants-2026-10-17.json) records their hash.

Both deployed search containers subsequently passed fourteen zero-row DQL/DML checks each (two per allowed table). Catalog writes still returned missing privilege; auth reads/writes remained inaccessible (Crate hides the denied relation). No production member rows were changed by these checks.

All seven tools were exercised through the real local MCP endpoint on CrateDB 5.10.16 with a scoped `goodwatch_search` identity and exactly this grant file. The same suite failed before the grant. Catalog/Favorite DML and DDL are explicitly tested as denied. Receipt restart/replay and concurrent retries remain covered.

## Consent, selectors, links and annotations

- The consent page selects **Read and change my GoodWatch** by default when write was requested. **Read-only** remains selectable. The action still cannot add unrequested scopes or grant identity scopes; a form without an access field keeps its conservative read-only fallback.
- Every title write accepts an ID together with name/year. The ID wins; name/year are ignored for resolution and new receipt hashes. Without an ID, a name is required, with optional year. Exact older ID/year requests can still replay historical receipts. Existing read selector rules stay unchanged.
- Shared summaries now return `link`, for example `[The Matrix (1999)](https://goodwatch.app/movie/603-the-matrix)`. Search, library, Tonight, details, progress, ambiguous choices and write receipts use it. Historical receipts receive the link only in presentation. My shows now reads catalog years for its returned page instead of hardcoding null. Unknown catalog years say `Year unknown`.
- Taste returns counts and attributes, not individual title rows. It carries `page_url`, as do all other list-like read tools. Server initialization and every tool description explicitly require using title `link` verbatim as Markdown, never bold/plain text, and ending lists with the GoodWatch page link.
- Read annotations remain `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`. Writes remain `readOnlyHint: false`, `idempotentHint: true` through durable action IDs; single-watch logging has `destructiveHint: false`, while setters/removal have `true`. Tests assert these values for all fourteen tools.
- Name search and its optional smarter match retain their behavior and quotas.

## Owner steps after deployment

1. Refresh the GoodWatch connector in Claude.ai and start a new conversation so the new tool descriptions and instructions are loaded. Existing write grants already have the scopes needed; the database fix itself does not require reconnecting.
2. To verify consent's new default, disconnect Claude in GoodWatch Settings → Connected apps and reconnect at `https://goodwatch.app/mcp`. Confirm **Read and change my GoodWatch** is selected. Leave it selected and Allow Claude; expect fourteen tools.
3. Ask “Find Arrival (2016) and add it to my Wishlist.” A redundant ID/name/year call must succeed. Approve the write if prompted, verify My library, and remove it afterward if desired.
4. Ask for Wishlist, My shows, Tonight, a title-name search, and Taste. Every movie/show title should be a clickable Markdown link labelled **Title (Year)**. Each list should end with the matching GoodWatch page link. Taste has no title items to link.
5. Optionally reconnect with **Read-only** to confirm seven read tools and unavailable writes, then return to write access if wanted.

Hosted Claude.ai formatting and approval UI still require this owner check; the automated checks verify returned payloads, instructions, permissions and state changes.

## Automated verification

- MCP unit tests: 21 passed. Broader MCP/cache/metrics/tracking/watch-log/show-tracking/auth-loading run: 256 passed, one existing tracking TODO, zero failures.
- OAuth suite: 44 passed, including read/write selection, scope narrowing, CSRF and identity-scope rejection. Auth typechecking passed.
- Read, scoped-write, receipt-restart, smarter-match quota/cache/live-TTL/paging and native-search probes all passed against disposable local CrateDB/Valkey. Scoped writes use production's CrateDB 5.10.16 version and the exact reviewed grant file.
- Production build passed. Whole-app typechecking reports the same 177 pre-existing diagnostics as an archived `origin/main` with the same dependencies, with no new diagnostics.
