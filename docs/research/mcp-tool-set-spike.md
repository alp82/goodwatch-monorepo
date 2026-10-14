# MCP tool-set conversation spike (#535)

2026-10-14, same local branch `ghostex/817e1757`, on top of #533 commit `7d28df92`. Scope: a throwaway conversation prototype with mutable in-memory fixtures, no production data, no deployment. [Issue #535](https://github.com/alp82/goodwatch-monorepo/issues/535) asks how the tools should feel; [#528](https://github.com/alp82/goodwatch-monorepo/issues/528) supplies the proposed task list. The owner closed [#533](https://github.com/alp82/goodwatch-monorepo/issues/533#issuecomment-6169860955) after verifying Claude.ai login/consent, three read tools and data under the member ID. This follow-up adds writes, while Claude.ai refresh and an actual ChatGPT connection remain owner checks.

## Start the owner test

The agent tested localhost only for #535 and **did not start a tunnel**. From the existing worktree:

```bash
cd /home/alper/projects/goodwatch-monorepo-817e1757/goodwatch-webapp
npm run spike:mcp:tunnel
```

This is the exact start command. It runs `cloudflared tunnel --url http://127.0.0.1:3335 --no-autoupdate`, captures the newly printed HTTPS origin, and starts the isolated Remix server using that exact issuer/resource authority. Copy its printed `/mcp` URL and fresh password for `spike@example.test`. Keep this terminal open while testing; Ctrl-C stops both processes. Port 3335 must be free. Do not reuse the old #533 tunnel hostname or grant. Every restart changes the auth secret/keys, resets member data and requires reauthorization.

Dependencies are unchanged from #533: Better Auth/MCP/CIMD/OAuth provider **1.7.7 exactly**, SDK **2.3.1**, separate Zod **4.6.7**, Inspector **2.11.0**. For a fresh dependency install:

```bash
npm ci
npm --prefix app/mcp-oauth-spike ci
npm run spike:mcp:check
```

Open the printed origin's homepage for the fixture explanation; `/fixture/movie/603` and `/fixture/show/1399` are browsable fixture title pages. These numeric IDs are deliberately assigned to fictional titles and are **not** claims about the real TMDB catalog. `/login` uses the printed password; `/consent` is reached through the signed OAuth flow. Consent now explicitly describes the `mcp:write` capability.

In [Claude.ai Connectors](https://claude.ai/customize/connectors), add/update **GoodWatch tool-set spike** with the new `/mcp` URL and reconnect through the spike's login/Allow page. Grant `mcp:read`, `mcp:write` and `offline_access` when requested. Enable it in a fresh chat and refresh its tool list. The read and write lists should be separate, with **13 tools** by default: seven writes, six visible reads, and `get_taste` hidden. Existing read-only grants receive an HTTP 403 `insufficient_scope` challenge for `mcp:write` when attempting a write; they cannot mutate fixtures.

## Fixture baseline

All tool results carry `fixture: true` and the verified OAuth `member_id`; clients cannot select another member. Different OAuth clients signed into the same demo account share its changes. A server restart restores this baseline:

| Fixture | ID | Starting member state |
| --- | --- | --- |
| The Last Lighthouse; alias **Lighthouse** | `movie:603` | Want to See, no score, no watch; fictional Prime Video offer |
| Orbit Garden | `show:1399` | Watching, S1E1 and S1E2 watched with unknown dates; Next episode **S1E3**; six aired fixture episodes; fictional Netflix offer |
| Small Town Detectives | `show:1400` | On hold, S2E1 watched with an unknown date; Next episode **S2E2**; fictional Disney+ offer |
| Harbor (2019) | `movie:1001` | Unmarked; fictional Netflix offer |
| Harbor (2024) | `movie:1002` | Unmarked; same name, separate movie; fictional Netflix offer |
| Twenty other movies | `movie:2000`–`movie:2019` | Unmarked, for a 25-title paging exercise |

Country starts at `DE`; services are `netflix` and `prime_video`. Offers are entirely simulated, with evidence only for DE/US/GB. Every date in the watch log is null unless a member supplied a date, or the fixture explicitly seeded one (the baseline seeds none). Quota clocks and activity ordering never become watch dates.

## Eight conversational prompts

Run these in order on a fresh instance. Follow-ups in a row are part of that scenario. Claude's own per-tool permission dialogs may still appear: #533 showed reads defaulting to **Needs approval**. The server's confirmation preview is an additional behavior to observe, not a way to override Claude's permissions.

| # | Natural-language prompt | What good looks like |
| --- | --- | --- |
| 1 | **“Show me all the titles, then the next page. What is Orbit Garden, and where am I in it?”** | `search_titles` with empty query returns **20**, then **5**, without duplicates; `next_cursor` ends at null. `get_title` / `get_show_progress` resolve `show:1399`, show Watching and **S1E3** next. Fixture URLs work. No real streaming claims or paid search. |
| 2 | **“I just watched episode 3 of Orbit Garden.”** | Name resolution selects the unique show and its single fixture season. `log_watch` records **S1E3**, with a stable action ID and **date null / unknown** because no viewing date was stated. It returns a watch ID and updated progress: **S1E4** next. An exact retry with the same action ID returns `already_applied`, with no second watch. No confirmation preview for a single explicit watch. |
| 3 | **“What should I watch tonight? Show my shows and my library too.”** | `get_tonight` chooses **Orbit Garden S1E4**, on the saved fictional Netflix service. `get_my_shows` and `get_library` agree with the changed progress and show Small Town Detectives On hold. The result comes from this signed-in member's state, not the initial seed. |
| 4 | **“Remove that last watch.”** Then, after reviewing the preview: **“Yes, remove Orbit Garden season 1 episode 3.”** | `undo_watch` first returns `confirmation_required`, the exact watch/date and the projected Next episode. Nothing is removed before approval. The client should present the episode and ask for confirmation instead of automatically replaying the confirmation ID. After the follow-up it resubmits the exact operation with that ID: S1E3 is removed and **S1E3 is next again**. No other episode is deleted. This tool has `destructiveHint: true`. |
| 5 | **“Rate Lighthouse 8 and show it in my library.”** | The alias resolves uniquely to `movie:603`; `rate_title` sets **8/10** directly. The movie becomes Seen through one **undated score-owned watch**, and leaves Want to See. `get_title` / `get_library` show score 8 and watch count 1. No invented “watched today.” Rating a show, by contrast, never logs an episode or changes show status. |
| 6 | **“Add Harbor to Want to See.”** Then **“The 2019 one.”** Optional follow-ups: **“I no longer want to see that Harbor; remove it.”**, approve the preview, then **“Mark that Harbor Not interested.”** | The first call returns **two candidates**, names/years/IDs, and no write. It must not choose by popularity or list order. The 2019 follow-up adds only `movie:1001`. Removal has a confirmation preview; after approval it leaves Wishlist. Marking the unmarked, unrated movie Not interested runs directly and appears in the library. If Not interested is set while it is still in Wishlist, that removal also needs a preview. `movie:1002` stays untouched. |
| 7 | **“Drop Small Town Detectives. Show me my taste too.”** After approving the drop, **“Resume Small Town Detectives as Watching.”** | Drop previews the status change and any Wishlist removal; approval changes it to Dropped without deleting S2E1. Resume is direct, returns Watching and **S2E2** next. **`get_taste` is absent** for this member's simulated REC flag; the client says that tool is unavailable rather than inventing a taste result or calling production. |
| 8 | **“I'm in Germany and I now have Netflix and Disney+, no Prime Video. Update my services and tell me what to watch tonight.”** | `set_my_services` proposes `DE` / `[netflix, disney_plus]` and previews the removed Prime Video service. After approval the saved settings change; `get_tonight` and fixture offers reflect them. Given scenario 7's recent Resume, **Small Town Detectives S2E2** should now win over Orbit Garden; Lighthouse's Prime offer is absent. No real subscription is created, canceled or charged. |

After the eight, a useful date check is **“I watched episode 4 of Orbit Garden on 2026-10-13.”** Its watch should store exactly `2026-10-13` with day precision; it must not change any earlier unknown date. An unspecified season is returned as an invalid episode with available fixture seasons if it cannot be resolved; the API never chooses an episode from an ambiguous title.

Record the calls/output and where the conversation felt awkward: title choice, episode/season resolution, unnecessary permission dialogs, automatically replayed confirmations, or a guessed date. This is a conversation test, not a request to change every client approval setting to Always allow.

## Tool contract and recommendation

Keep these **14 task-specific snake_case names**, with the display titles below. Reads and writes are separate MCP tools; there is no generic execute/method tool and descriptions contain facts about operations, not instructions to the model. Responses are compact `structuredContent` plus matching text. Search, library, show lists and watch history use `items`, `total`, `next_cursor`, a default/max page of 20, and optional `limit`. Cursors are fixture offsets; they are not production snapshot cursors.

| Tool | Display title | Key inputs / behavior | Hint / recommended extra confirmation |
| --- | --- | --- | --- |
| `search_titles` | Search titles | Query, cursor, limit; local fixtures only | Read-only |
| `get_title` | Get a title | Title ID or name, optional year; details and current member marks | Read-only |
| `get_my_shows` | Get my shows | Cursor, limit; stored states and next episodes | Read-only |
| `get_show_progress` | Get show progress | Show ID or name, cursor/limit for watches | Read-only |
| `get_tonight` | Get tonight's pick | Saved country/services + most recently active Watching show, then Wishlist | Read-only |
| `get_library` | Get my library | Cursor, limit, filter `all/want_to_see/seen/not_interested/rated` | Read-only |
| `get_taste` | Get my taste | Fixture genre averages from scores; Wishlist count; REC flag controls exposure | Read-only; hidden by default |
| `log_watch` | Log a watch | Title ID/name; season/episode for a show; optional date; required `action_id` | Write, non-destructive; single explicit watch direct |
| `rate_title` | Rate a title | Title ID/name; score 1–10 or null | Write, destructive-capable; set/update direct, **clear confirms** |
| `set_want_to_see` | Set Want to See | Title ID/name, boolean | Write, destructive-capable; add direct, **remove confirms** |
| `set_not_interested` | Set Not interested | Title ID/name, boolean; only unseen/unrated titles | Write, destructive-capable; direct unless it **removes Wishlist** |
| `set_show_status` | Set show status | Show ID/name; Not started, Watching, On hold, Dropped, Seen | Write, destructive-capable; Watching/On hold direct; **Dropped and bulk Seen confirm** |
| `undo_watch` | Remove a watch | Title ID/name, optional watch ID; default last individually logged watch of that title | Write, **destructive**; always confirms |
| `set_my_services` | Set my country and services | ISO country + array of `netflix/prime_video/disney_plus` | Write, destructive-capable; additions direct, **country change/service removal confirms** |

All title-targeting writes accept **exactly one** of `title_id` or `title_name`, with an optional `year`. IDs are `movie:<number>` or `show:<number>`. Exact names/aliases win; otherwise a case-insensitive substring resolves only when unique. Multiple matches return at most 20 compact `choices` and a total count; no preference/state/watch is changed. A narrower year or an explicit candidate ID resolves the next call. This is a stand-in for the cheap production title palette; it never invokes ranked search or spends its budget. Settings naturally have no title selector.

Confirmation IDs bind the resolved title/action/parameters to **one member**, expire after five minutes, and become stale after another successful write. Undo binds the exact selected watch, so a retry cannot silently delete the new “last watch.” The preview returns the concrete watch and projected next episode; service replacement returns before/after settings. Repeating an already applied setter is a no-op. Read responses and confirmation previews do not increment the member's data revision. Search quota bookkeeping is separate.

**Recommendation on confirmation:** keep log, rating and Want to See additions direct when the member explicitly asks. Confirm removal/undo, rating clear, Dropped, bulk Seen, country replacement and service removal, using concrete before/after summaries. A client permission dialog and a server preview are distinct; conservative `destructiveHint: true` on setters that *can* delete may make a host confirm harmless additions too. Observe that friction before splitting more tools. A confirmation ID is **not proof of human approval**: an agent can read and replay it. Production must rely on trusted host approvals or an authenticated human approval surface if guaranteed human approval is required; do not label a model's replay “user approved.” No extra approval surface is implemented in this throwaway spike.

**Recommendation on search:** start with cheap catalog/name lookup free of the paid search budget. If ranked natural-language MCP search is introduced, allow only an explicitly enabled mode: **20 uncached ranked searches/member/UTC day**, **one in flight/member**, within the existing shared search admission/budget, with normalized-query caching (initially 60 seconds) and no extra charge for paging. Measure usage/cost before increasing it. The spike simulates 20 distinct normalized queries per member/day, repeated queries/pages are free, and returns `search_quota_exceeded` at the boundary. It never runs paid search. Unlike that simplified whole-day fixture deduplication, production accounting must charge each actual uncached computation after the cache expires. The quota must not prevent cheap name resolution needed by a write.

**Recommendation on naming:** keep the requested 14 names. Display **Remove a watch** for `undo_watch` so the destructive effect is obvious; it removes a watch record rather than rolling back arbitrary prior mutations. Keep `set_*` booleans as idempotent operations and `get_tonight` as the task name. Do not add `get_new` or `recommend` until the recommendation journey and budget deserve distinct behaviors. The named read/write tools are sufficient for this conversation trial.

## Simulated member flag

The auth bootstrap sets `REC_MCP_TASTE=false` for the demo member ID. Tool registration checks that member's flags for **every stateless request**: `get_taste` is missing from `tools/list` and a forced call is rejected as unknown. A separate fixture member with the flag on exposes 14 tools and cannot read/write the first member's changes or consume their confirmation IDs; the local isolation probe checks that.

To compare the taste tool in a separate owner run:

```bash
MCP_SPIKE_REC_TASTE=1 npm run spike:mcp:tunnel
```

This resets data/auth and creates a new tunnel/grant. Reconnect and refresh the tool list: **14 tools**, including Get my taste. After rating Lighthouse 8, genre averages are Mystery/Drama 8. This is an explicit fixture simplification, not GoodWatch's fingerprint-based taste portrait. For production use real `isEnabled` per verified member in registration **and** execution; flags must never be just client UI hiding.

## Claude.ai token-refresh check

Access-token lifetime remains **60 seconds**, refresh-token lifetime one hour. After connecting, call `get_show_progress` for Orbit Garden and note `member_id` and current progress. **Keep the same server process and connector alive, make no code edits, and leave the conversation idle for at least 75 seconds.** Then ask: **“Check my Orbit Garden progress again.”**

Good looks like: no new login/consent, same member ID and stored writes, server log `/api/auth/oauth2/token` with `grantType:"refresh_token"`, status **200**, followed by the read tool. Claude may refresh proactively during the pause or reactively after a resource 401; either is fine. Observe the log throughout the interval, not only the last call. A silent successful read without an observed refresh is insufficient evidence to tick refresh off. If sign-in reappears, capture the status/error and whether anything restarted. The pre-write #533 Claude.ai verification did not observe refresh, so this check is still open for the owner.

## ChatGPT connection check

Use the same printed HTTPS `/mcp` URL, demo account and server instance so reads can show Claude's changes. On web:

1. Enable **Settings → Apps → Advanced settings → Developer mode**, if available, then **Apps → Create**, OAuth/CIMD and **Scan Tools**. In accounts with the newer UI, [Plugins](https://chatgpt.com/plugins) → **Add custom MCP server** → Connection URL/OAuth → Create as a plugin. Workspace policy/plan can limit access.
2. Complete the spike's login/Allow page. The expected stable client ID is `https://chatgpt.com/oauth/client.json`, callback `https://chatgpt.com/connector_platform_oauth_redirect`, and `iss` must exactly match the printed HTTPS origin plus `/api/auth`. Better Auth still advertises `authorization_response_iss_parameter_supported:true`; #533 checked synthetic Allow/Deny responses. Follow any exact connection-specific callback the UI displays instead of rewriting it yourself.
3. Install/select the app/plugin in a new chat. Ask **“Show Orbit Garden's progress and my library from GoodWatch tool-set spike.”** Good looks like actual read calls, the same member ID as Claude and the mutations from the eight scenarios. It must not substitute general movie knowledge.
4. If the plan supports writes, optionally run **“Add Paper Moonlight to Want to See”** (`movie:2000`) and read it back in both clients. If writes are unavailable, **reads are enough** for this check; do not change tool annotations to evade the host's restrictions. Full custom write support is limited to Business/Enterprise/Edu under the [current Help Center rules](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt).
5. Leave it idle for 75 seconds and repeat the read, observing refresh logs. Record whether registration was CIMD (`cimd-created`) or DCR (`/oauth2/register` 201), consent, refresh, tool calls and the exact failure if any. If CIMD fails at token exchange, retry DCR separately: the live ChatGPT metadata's singular preference is `private_key_jwt`, although its plural supported methods also include `none`; Better Auth uses the singular preference. That signed exchange has not been validated by the agent.

Sources for the existing connection contract: [OpenAI OAuth](https://developers.openai.com/plugins/build/auth), [OpenAI connection UI](https://developers.openai.com/plugins/deploy/connect-chatgpt), [Claude authentication](https://claude.com/docs/connectors/building/authentication), and the original [OAuth spike runbook](mcp-oauth-spike.md). These are client requirements, not a claim that #535 hosted writes or refresh were already exercised.

## Implementation and local evidence

Code stays under `goodwatch-webapp/app/mcp-oauth-spike/`: `fixtures.server.ts` owns per-member mutable memory; `tools.server.ts` registers the separate schema-validated tools; `routes/mcp.ts` binds everything to verified JWT `sub` and enforces `mcp:write` at the HTTP boundary; auth/consent/launcher retain isolation from production. No Supabase, CrateDB, Valkey, Qdrant or paid search module is imported.

Observed locally: authenticated tool-set and OAuth probes passed; the isolation probe passed with 13/14 tools and unchanged peer state. Inspector 2.11.0 completed DCR with read/write scope and logged Orbit Garden S1E5 through the real modern transport, returning an unknown watch date and updated progress. Fixture title URLs returned HTTP 200. Focused TypeScript and Biome formatting checks passed. No tunnel was started by the agent.

Local checks:

```bash
npm run spike:mcp:check
node_modules/.bin/vite-node --config app/mcp-oauth-spike/probe.vite.ts app/mcp-oauth-spike/probe-isolation.ts
```

For the authenticated read/write exercise, start **local only** with `npm run spike:mcp`, set/export `MCP_SPIKE_PASSWORD` in another terminal to the printed demo password, then on a **fresh instance**:

```bash
node app/mcp-oauth-spike/probe-oauth.mjs --tools
```

That probe completes real DCR, signed HTML login/consent and loopback OAuth, then calls the actual `/mcp` route. It asserts all exposed tools and annotations; name ambiguity without a write; 20+5 paging; changed read projections; unknown and explicit dates; action-ID retry/conflict; implicit movie score-watch creation/clear; show rating without logging; confirmation preflight, exact replay and stale rejection; Wishlist/Not interested interactions; hold/resume/drop/Seen; service changes affecting tonight; search quota and budget-free write name resolution; forced hidden-tool rejection; and read-only tokens getting a 403 rather than writing. It also retains #533's JWT tampering, scope, refresh rotation/retry, auth-code replay and issuer-on-denial checks. **It mutates the fixtures**; do not run it during the owner's conversation trial. The isolation probe checks two members, 13/14 exposure and cross-member confirmation rejection through the SDK handler, without replacing the separate live JWT/scope probe.

The state model follows the key rules in [ADR 0008](../adr/0008-one-row-per-watch.md) and [ADR 0009](../adr/0009-tracking-is-a-state-machine.md): dates stay unknown, a movie score can own one undated watch, show ratings don't change status, undo removes one individually logged watch, and progress follows the member's current watches/state. This is a representative fixture model, not the complete production tracking machine: imports, rewatch passes, grouped Seen undo, calendar changes, real availability/taste and durable storage are outside the spike. Existing watches cannot be silently cleared by a status setter.

Owner-dependent results to record after this handover: the eight-prompt conversational quality, actual ChatGPT linking, Claude.ai refresh after expiry, and whether the host presents confirmations appropriately. #533's owner verification remains valid evidence for the initial read-only connector; it does not establish these new checks.
