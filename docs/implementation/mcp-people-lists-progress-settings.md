# MCP people, share lists, episode ranges and settings

Owner decision Q53 (2026-10-17). This extends the [read tools](mcp-read-tools.md), [write tools and durable receipts](mcp-write-tools.md), and [poster grid](mcp-poster-grid/README.md). Existing `mcp:read` / `mcp:write` grants apply; reconnecting is unnecessary for an existing write grant, but clients may need to refresh their tool inventory. The server now exposes 15 reads and 10 writes (including the concurrent Discover/similar-title additions).

## Tools and parameters

| Tool | Parameters and behavior |
| --- | --- |
| `search_people` | `query`, `limit`, `cursor`: indexed catalog name search requiring all query terms, ordered by TMDB popularity descending (missing popularity last, stable person-ID ties), person IDs, departments and real `/person/<id>-<name>` links. Namesakes remain distinct. |
| `get_person` | `person_id`, `role=all\|acting\|directing\|writing`, `sort=for_you\|newest\|score`, `exclude_seen`, `limit`, `cursor`. Includes every credit, including missing posters/scores. Taste order uses the site's full-precision percentile; without taste it falls back to credit weight/popularity. Sort/filter precede paging. Availability defaults to everywhere; seen titles remain included unless explicitly excluded by the site's Not seen yet rule. |
| `get_my_lists` | `limit`, `cursor`: the member's public and unlisted share lists, newest updated first, with site share links and `/lists/mine` as `page_url`. Uses the same 200-list read limit as the site. |
| `get_list` | `list_id`: one owned share list's five titles, in rank order, with share/page URL. Missing and foreign lists return the same `list_not_found` response. |
| `create_list` | `action_id`, `list_name`, `titles` (five title selectors), optional `visibility=public\|unlisted`. Uses the site's default card design and Ember theme and returns the actual `/u/<handle>/lists/<id>` share link. |
| `update_list_titles` | `action_id`, `list_id`, `add_titles`, `remove_title_ids`. Adds and removes equal numbers of titles atomically, preserving the five-title invariant. Remaining titles retain their ranks; additions go at the end. Returns both rankings and the share link. |
| `log_watch` (extended) | Existing `season` + `episode` + new inclusive `episode_end` marks a range. `season` + `whole_season=true` marks the whole season. Optional `date` sets an explicit ISO watch day on newly added watches; otherwise dates remain unknown. |
| `get_settings` | Reads country (Watching from), language (Show titles in), service IDs, saved-pair version, choices and real Settings links. No browser locale is inferred by MCP. |
| `set_settings` | `action_id`, optional `country`, optional `language` (at least one). Country codes normalize to uppercase and must exist in the catalog; languages are the site's supported codes plus `browser`. Omitted values and saved services are preserved. |

Every new title selector accepts `title_id` with redundant `title_name` / `year`; the ID wins and ignored fields do not change receipt hashes, including nested list selectors. Ambiguous names return linked candidates without a list mutation. All new mutations use `user_mcp_action` receipts and require `mcp:write`. Read tools keep read-only/idempotent hints; create and log have non-destructive hints, while list replacements and settings have destructive hints. Per-tool/member policies are checked at registration and execution.

## Site semantics and boundaries

Share lists are the existing domain object: exactly five distinct ranked titles, published under an existing handle. They are separate from Wishlist and ratings. Creating an incomplete list or leaving four/six titles would violate the site's model, so additions/removals are paired replacements in one call. A missing handle returns `handle_required` with `/lists/mine`; MCP never claims a public handle. An unlisted list is accessible to anyone with its link. Ownership is checked before reading or editing a list. Native cache invalidation refreshes the share page, profile and share card. MCP edits compare the original content hash/update time, then use a full primary-key version read and `_seq_no` / `_primary_term` CAS to reject intervening edits.

Episode ranges reuse the native tracking machine's group-watch implementation through `markRange`. Ranges use stored catalog season/episode numbers, as `get_show_progress` does (display numbering is separately named there). They mark only aired regular episodes missing in the current pass, retain previous passes and watches, and derive Watching/Seen through the same machine as the site. A completed selection is unchanged. Missing seasons/endpoints, specials in a bulk selection, descending ranges and future watch dates are refused. A range containing future episodes marks only its aired part, like Mark season on the site. One receipt covers the full operation, including an explicit group-date edit; added watches are attributed by the action's group ID. As for existing multi-statement writes, an uncertain partial outcome stays indeterminate and is never automatically executed again.

Settings use the site's atomic `media_preferences_v1` row in `user_setting`, with native version checks and cache resets. Country changes preserve language; language changes preserve country. With no saved pair, legacy country is retained, or the site's US fallback is used when no country was ever saved; language defaults to `browser`. `set_my_services` continues preserving the saved language. No new settings table or grant is needed.

`get_person` and `get_list` carry the existing MCP Apps poster-grid hook; clients without Apps support get the same structured/text content. New title results carry links, catalog years, runtime, GoodWatch match/label and nullable posters. Public catalog caches and durable receipts never store member-derived taste. There is no people-search results page: search results link individual people and identify Discover as a broader title-search destination. Filmography links open the person's existing page; the note explains its different grouping/filter controls.

## Least privilege

[The only new grant](mcp-features-grants.sql) is `DML ON TABLE doc.user_list TO goodwatch_search`. Profiles and handles remain read only. Existing seven-table DML, schema DQL, auth-table DENYs and every other privilege are preserved. It was applied as `crate` using trusted container loopback on crate-01; the [before/after audit](mcp-features-grants-2026-10-17.json) records the single added privilege and no removals. No production member rows were changed by the grant verification.

## Verification

Use the disposable loopback CrateDB/Valkey services in the read-tool runbook. The feature seed refuses an unexpected cluster and uses only synthetic members/catalog records. The taste fixture substitutes the populated taste loader only for explicitly named local test members; production has no test token or fixture switch.

```sh
python goodwatch-webapp/scripts/mcp-features/scoped-grants.py
python goodwatch-webapp/scripts/mcp-features/seed-local.py
cd goodwatch-webapp
MCP_TEST_CRATE_USER=goodwatch_search MCP_TEST_CRATE_PASS=local-mcp-test-only node_modules/.bin/vite-node --config scripts/mcp-personal/vite.config.mjs scripts/mcp-features/local.integration.ts
MCP_TEST_CRATE_USER=goodwatch_search MCP_TEST_CRATE_PASS=local-mcp-test-only node_modules/.bin/vite-node --config scripts/mcp-personal/vite.config.mjs scripts/mcp-features/local.integration.ts --replay-only
node --test 'app/server/mcp/*.test.ts' app/domain/tracking/machine.test.ts app/server/tracking.test.ts app/server/show-tracking.test.ts
```

The endpoint probe covers every new tool/parameter, namesakes/paging, all role/sort choices, missing display/taste, unseen filtering, public/unlisted list creation and paging, missing handles, nested redundant selectors, ambiguous list titles, ownership, duplicates, stale/concurrent edits, settings/service preservation, inclusive ranges/whole seasons, dates, one receipt, independent members and write-scope rejection. The fresh-process probe proves historical list/range/settings receipts replay without repeating changes.

Owner retest prompts for Claude.ai (refresh the connector's tool inventory first):

1. “Find Greta Gerwig and show the movies she directed, best for my taste first. Include seen titles, posters and GoodWatch links; then show the newest ones I haven't seen.”
2. “Show my share lists and open one with its titles in rank order and its share link.”
3. “Create a share list called My sci-fi five with Arrival (2016), The Matrix, Alien, Blade Runner and Interstellar. Return its share link. Then replace Alien with Aliens.” (Choose the feature-length Arrival if namesakes need clarification; an existing site handle is required.)
4. “Mark Severance season 2 episodes 1–4 watched, with no date recorded. Then mark the whole first season watched. Show my progress.”
5. “Read my Watching from and Show titles in settings. Change only my language to German; keep my country and services. Then show the saved settings.”

Verification on the implementation branch: the full app unit suite passed 3,272 tests with one existing skip and one existing tracking TODO (zero failures); an additional canonical-filmography regression and all 97 focused MCP/tracking-machine checks passed afterward. The OAuth/MCP integration suite passed 44 tests and its auth typecheck. Existing read/write/fresh-process receipt, ranked cache/quota/paging/live-TTL, native provider fixture and populated-taste probes passed, as did the new scoped feature probe and fresh-process replay. Production build/precompression passed. Whole-app typechecking matches the archived starting main's 177 existing diagnostics, with none added. Local feature probes used CrateDB 5.10.12 and Valkey 8.1.3; the production grant was independently verified under the deployed search identity with zero-row list DML, while profile, handle and catalog DML remained denied.

After integration with the concurrent Discover and similar-title work: all 3,293 app unit tests passed (one existing skip, one existing tracking TODO, zero failures); all 272 focused MCP/tracking checks passed (plus that existing TODO). The complete details/similarity runner reran read/write/replay/ranked/native/taste probes and passed against real local Crate/Valkey/Qdrant; the Discover runner passed 29 filter cases, real-engine parity, ranked cursors and poster hooks. The scoped Q53 feature and fresh-process replay probes passed again. Auth typechecking and production build/precompression passed. Whole-app typechecking matches that rebased main's 178 diagnostics, with none added by Q53 (the extra diagnostic is the incoming runtime-filter chip labels).
