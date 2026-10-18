# Member MCP write tools (#568)

The Q53 additions (people, share lists, episode ranges and Settings) are documented in [MCP people, lists, progress and settings](mcp-people-lists-progress-settings.md).

This extension builds on the read endpoint in [#577](https://github.com/alp82/goodwatch-monorepo/pull/577). The production endpoint uses the durable Better Auth grant verifier described in [MCP authorization](mcp-authorization.md). No test verifier is installed in the Remix route.

## Surface and approval

Write-scoped members see seven additional tools. Requests require both `mcp:read` and `mcp:write`; read-only callers cannot force a hidden write, including through a batch. Member `REC_MCP_WRITE` and per-tool flags are checked at listing/registration and again at execution. Their on/off/member-allowlist syntax follows the read tools. Tool flags use the complete task name, such as `REC_MCP_LOG_WATCH` or `REC_MCP_SET_MY_SERVICES`.

| Tool | Native server function | Behavior |
| --- | --- | --- |
| `log_watch` | `applyWatchLogAction`, `applyShowTrackingAction` | One movie or episode watch, with an unknown date unless an explicit ISO day was supplied |
| `rate_title` | `updateScores` | Sets/clears a score; preserves an existing review on a score update; native score clearing removes its row/review and score-owned movie watch |
| `set_want_to_see` | `applyShowTrackingAction`, `updateWishList` | Adds/removes Wishlist membership under native show rules; adding a Seen title means Want to rewatch |
| `set_not_interested` | `updateNotInterested` | Applies only to unseen, unrated titles; setting it clears an existing Wishlist entry |
| `set_show_status` | `applyShowTrackingAction` | Native hold/drop/resume/Seen transitions; Watching from Seen performs Watch again, starts a new pass and retains earlier watches; Not started never clears history |
| `undo_watch` | `applyWatchLogAction`, `applyShowTrackingAction` | Displayed as **Remove a watch**; removes an explicit owned watch or the most recently recorded individual watch (current pass by default for shows) |
| `set_my_services` | `setUserSettings` | Replaces saved country and services; accepts known service names or numeric TMDB provider IDs; ambiguous/unknown services and unknown countries make no preference change |

Title writes use the shared cheap catalog resolver: `title_id` takes precedence and ignores accompanying `title_name`/`year`; without an ID, provide a name and optionally a year. Candidates return without mutation on ambiguity. Ignored selector fields are excluded from new receipt hashes; exact historical ID/year requests still replay their old receipts. There is no ranked-search charge. Every write requires a caller-supplied `action_id` reused with the same parameters for retries.

The [#535 resolution](https://github.com/alp82/goodwatch-monorepo/issues/535#issuecomment-6176944841) showed that Claude replayed confirmation IDs without asking the owner. These tools have no server confirmation-token protocol. Every write tool, including logging a watch and creating a share list, has `destructiveHint: true`, because Anthropic's directory checklist requires it for tools that modify data. Hints are static per tool, so a host may also ask for harmless setter additions. The server does not claim that a human approved a call; host approval behavior must be verified in client integration.

Completed writes report `before`, `after`, and added/removed watch records attributed to the operation's watch/group IDs or native score ownership, so concurrent independent watch additions are not reported as this action's additions. Snapshot watch lists are capped at 20 with a full `watch_count`; changed watch records retain IDs, original dates/precision, pass, origin and grouping. `record_created_at` is the storage timestamp; `date`, `watched_at`, and **No date recorded** describe the actual viewing date. Status/score/Wishlist/Not interested changes are visible in the before/after marks; country/service changes return the saved preferences. Reads show the latest state after native cache reset and `markTasteChanged`.

## Batches

Owner decisions Q77 and Q78: batches are lists on the existing tools, not new tools, with at most 50 items per call. `rate_title`, `set_want_to_see`, `set_not_interested`, `set_show_status` and `log_watch` take either the single-title call (unchanged schema, receipt hash and result) or `items`. The code is in `goodwatch-webapp/app/server/mcp/batch.server.ts`.

- **Shape.** We chose one `items` list beside the single call over a separate list field per selector, because a model then writes the same fields per item as in a single call. Each item takes `title_id`, or `title_name` with an optional `year`, plus the tool's fields. A field at the top level applies to every item that leaves it out, so "add these 40 to my Wishlist" is `want_to_see: true` once. A call has one title or `items`, never both.
- **Cap.** The schema refuses 51 or more items with a message that tells the model to split the list. The tool descriptions name the cap and send whole histories (hundreds of titles or more) to the file import at `/settings/imports`.
- **Per item.** Each item, with the top-level fields filled in, has to pass the tool's single-call schema. IDs resolve in one catalog read; names resolve one by one like `search_titles`. Not found, ambiguous (with up to five candidates and their links), invalid and duplicate items write nothing. Every item reports `done`, `already_set`, `not_found`, `ambiguous` or `error` from the rows read back after the writes, with only the marks that changed as `[before, after]` pairs. The result has a summary count. An item that fails doesn't stop the others.
- **Batch ID and undo.** The call's `action_id` is its `batch_id`, and the result is the call's receipt, so a retry replays it. `undo_watch` with only `batch_id` reads that receipt for the calling member alone and takes back each done item through the site's own undo: the group or watch it added, the opposite show transition, the old score, and Wishlist and Not interested as they were, with the old Wishlist time. A mark the member changed again since the batch is kept and reported, and Not interested goes back only on a title that is still unrated, unwatched and (for a show) Not started. Watch again on a Seen show can't be taken back this way. A batch is undone once: every undo of it shares the receipt `batch-undo:<batch_id>`, so a repeat replays the first undo instead of reverting a change the member made by hand since. An item whose write failed part way but landed is reported `done` with a warning, so undo covers it too.
- **CrateDB load.** A batch reads the member's data once before and once after. Wishlist and Not interested changes are multi-row statements (`library-many.server.ts`). Ratings, watches and show states go through the native per-title writers one title at a time, and `withDeferredUserDataReset` holds the member-wide refresh that each of them ends with back to one per call.
- **Write budget.** On top of the request limit (60 a minute, 1,000 an hour), write calls count against `mcp-write-items`, 300 a minute and 2,000 an hour per member. A title write costs 1, a whole show marked Seen or a whole season costs 5, a batch the sum of its items, and undoing a batch costs 50. Over budget, the endpoint answers 429 with `Retry-After` and the import link. A request with more than one batch call (JSON-RPC arrays), or costing more than a minute's budget, is refused with 400 before any write: batches of one member each judge their items against the data they read first, so they shouldn't run side by side in one request.
- **Metrics.** `goodwatch_mcp_batch_items_total{tool,status}` counts batch items by result; replays don't count again.

## Durable retries

`user_mcp_action` is keyed by `(user_id, action_id)`, routed by member. Its definition is [mcp-write-tools-schema.sql](mcp-write-tools-schema.sql), not the central Crate schema: the daily `f/sync/populate_crate` flow creates every table declared there, and this one is created by hand at the cut-over (checklist step 1.4). It stores a canonical request hash, unique claim owner, timestamps and a result receipt. A new claim stores an indeterminate response identifying the intended target before any native mutation.

A primary-key insert claims the action. The caller reads its exact owner back before proceeding, including after an ambiguous insert response; row counts are never treated as proof of ownership. Completion uses primary-key `_seq_no`/`_primary_term` compare-and-set and reads the stored outcome back, covering an applied update whose response was lost. The local test caught that an additional owner predicate on the completion update did not see a freshly inserted row before refresh; completion therefore uses Crate's primary-key CAS path.

A completed retry returns the original receipt with `replayed: true`, even after another action changed the member's state. The tool description explicitly says these are historical before/after values; use reads for current state. Another tool or different parameters under the same action ID returns `action_id_conflict`. The namespace is per member, shared across OAuth clients, and independent between members.

A running, interrupted or uncertain action returns `indeterminate` and never automatically executes again. Native writers have multiple statements and Crate has no transactions: a failure may leave a partial change. Inspect the identified title/preferences before making a fresh, intentional action; a new ID must not be used automatically to bypass uncertainty. There is no automatic pending-action recovery or receipt expiry. From #597 on, the member-deletion helper deletes receipts, with a refresh before deleting the member's rows. Before/after values are observations through the native readers; concurrent edits from other web/MCP operations may intervene.

## Rollout and verification

Search roles use `goodwatch_search`, not the page instance's database identity. After table creation, apply [mcp-write-tools-grants.sql](mcp-write-tools-grants.sql) as an administrator. Its existing schema DQL is sufficient for readers and refreshes; add DML only on `user_mcp_action`, `user_wishlist`, `user_score`, `user_not_interested`, `user_watch_log`, `user_watch_state` and `user_setting`. Do not grant schema DML/DDL or alter auth-table DENYs. The [2026-10-17 evidence](mcp-write-grants-2026-10-17.json) records the production grant and unchanged auth privileges.

Create `user_mcp_action` from [mcp-write-tools-schema.sql](mcp-write-tools-schema.sql) before enabling writes (cut-over checklist step 1.4, with that step's replica and translog settings). The application does not run DDL. Account deletion removes a member's receipts from #597 on, which lands after the table exists. The #566 authorization seam, protected-resource metadata and live OAuth remain a separate handoff. Existing Valkey request limits and Prometheus counters/histograms now cover all 14 tools; metric labels contain no member IDs or parameters. Scope preflight uses the SDK's bounded body reader.

Use the dedicated loopback services from the [read runbook](mcp-read-tools.md). On this laptop the local rootless Docker socket is `unix:///run/user/1000/docker.sock`; the Crate/Valkey containers are `gw-mcp-567-crate` and `gw-mcp-567-valkey`. The write seed checks that Crate is the dedicated `gw-mcp-567` cluster, reuses the repository schemas/catalog, and resets only the two write-probe members. Neither probe uses production credentials or an application test-token switch.

```bash
python goodwatch-webapp/scripts/mcp-write/seed-local.py
cd goodwatch-webapp
node_modules/.bin/vite-node --config scripts/arena-vite.config.mjs scripts/mcp-write/local.integration.ts
node_modules/.bin/vite-node --config scripts/arena-vite.config.mjs scripts/mcp-write/local.integration.ts --replay-only
node_modules/.bin/vite-node --config scripts/arena-vite.config.mjs scripts/mcp-read/local.integration.ts
node --test app/server/mcp/endpoint.test.ts app/server/page-cache.test.ts app/server/metrics/registry.test.ts app/server/tracking.test.ts app/server/watch-log.test.ts app/server/show-tracking.test.ts
npm run build
```

The full write probe uses real CrateDB and Valkey caching/scripts, with a larger private test rate budget for its many checks. It covers all seven writes and retries, every title write's ambiguity, known/unknown dates, implicit score watches, native transitions and Seen retry without a toggle, old removal retries after newer watches, country/service resolution, member/taste/settings cache invalidation, pending receipts, same-ID contention, separate concurrent watch attribution, conflicts, member isolation and strict input rejection. The replay-only command runs in a fresh MCP process without reseeding and proves that a historical receipt survives process restart and cannot reapply a removed/replaced watch. The read regression retains the real 60-request member limit test.

Live OAuth/JWKS, host approval prompts, forced mid-write crashes, three-node failover and a populated Taste model are not exercised here. The seeded pending receipt and real local contention/restart tests establish the narrower behaviors described above. No production service, merge or release is part of this build slice.

## Scoped identity rehearsal

The same SQL grant is exercised on the guarded local `gw-mcp-567` cluster, including denied catalog/Favorite mutations and DDL. All seven writes run through the actual endpoint with this restricted Crate identity; every title write includes redundant selectors, and ID-only retries, legacy receipts and links are checked.

```bash
python goodwatch-webapp/scripts/mcp-write/seed-local.py
python goodwatch-webapp/scripts/mcp-write/scoped-grants.py
cd goodwatch-webapp
MCP_TEST_CRATE_USER=goodwatch_search MCP_TEST_CRATE_PASS=local-mcp-test-only node_modules/.bin/vite-node --config scripts/arena-vite.config.mjs scripts/mcp-write/local.integration.ts
MCP_TEST_CRATE_USER=goodwatch_search MCP_TEST_CRATE_PASS=local-mcp-test-only node_modules/.bin/vite-node --config scripts/arena-vite.config.mjs scripts/mcp-write/local.integration.ts --replay-only
```
